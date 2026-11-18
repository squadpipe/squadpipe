import assert from 'node:assert/strict';
import { resolveAiConfig } from '../../src/config/ai.config';
import { AiService } from '../../src/services/ai/ai.service';
import {
  evaluateCandidateCapabilityPure,
  formatRecommendationLabel,
  preFilterCandidatesForMatch,
} from '../../src/services/capability.service';

function makeJsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const runCapabilityTests = async () => {
  console.log('--- Running Submitted Resume Capability Check Tests ---');

  // 1. Recommendation label formatting
  assert.equal(formatRecommendationLabel('STRONG_FIT'), 'Strong Fit');
  assert.equal(formatRecommendationLabel('GOOD_FIT'), 'Good Fit');
  assert.equal(formatRecommendationLabel('PARTIAL_FIT'), 'Partial Fit');
  assert.equal(formatRecommendationLabel('LOW_FIT'), 'Low Fit');

  // 2. Deterministic Non-AI offline mode capability evaluation
  const offlineAi = new AiService({
    getConfig: () => resolveAiConfig({ AI_PROVIDER: 'none' }),
  });

  const offlineEval = await evaluateCandidateCapabilityPure(
    {
      id: 'cand-offline',
      currentTitle: 'Senior Cloud Engineer',
      skillset: 'AWS, Terraform, Docker',
      rawSnippet: 'Built production AWS EKS clusters and Terraform modules.',
    },
    {
      opportunityTitle: 'Cloud Infrastructure Engineer',
      skillsRequired: 'AWS, Terraform, Kubernetes, Kafka',
    },
    { aiSvc: offlineAi }
  );

  assert.equal(offlineEval.capabilitySummary.evaluatedWithAi, false);
  assert.equal(offlineEval.capabilityScore, 50);
  assert.equal(offlineEval.capabilitySummary.recommendation, 'PARTIAL_FIT');
  assert.equal(offlineEval.capabilitySummary.recommendationLabel, 'Partial Fit');
  assert.deepEqual(offlineEval.capabilitySummary.strengths, ['AWS', 'Terraform']);
  assert.deepEqual(offlineEval.capabilitySummary.gaps, ['Kubernetes', 'Kafka']);

  // 3. Active AI mode semantic capability evaluation + rate-masked defense-in-depth scrubbing
  let capturedPrompt = '';
  const activeAi = new AiService({
    getConfig: () =>
      resolveAiConfig({
        AI_PROVIDER: 'openai',
        OPENAI_API_KEY: 'sk-test',
        AI_FALLBACK_TO_OFFLINE: 'true',
      }),
    fetchImpl: async (_url, init) => {
      capturedPrompt = String(init?.body || '');
      return makeJsonResponse({
        choices: [
          {
            message: {
              content: JSON.stringify({
                fitScore: 91,
                recommendation: 'STRONG_FIT',
                strengths: [
                  'AKS orchestration aligns with Kubernetes requirement',
                  'Terraform Infrastructure as Code',
                ],
                gaps: ['No explicit Kafka production streaming noted ($145/hr ceiling)'],
                verdict: 'Strong container & AWS fit ($98/hr expected).',
              }),
            },
          },
        ],
      });
    },
  });

  const maskedAiEval = await evaluateCandidateCapabilityPure(
    {
      id: 'cand-ai',
      fullName: 'Meera Krishnan',
      currentTitle: 'Azure & AWS AKS Engineer',
      skillset: 'AWS, AKS, Terraform',
      hourlyRateDisplay: '$98/hr (W2)',
      rawSnippet: 'Managed multi-cluster AKS platform and Terraform pipelines. Expects $98/hr.',
    },
    {
      code: 'REQ-500',
      companyName: 'Apex Cloud',
      opportunityTitle: 'Lead Kubernetes Engineer',
      skillsRequired: 'AWS, Kubernetes, Terraform, Kafka',
      targetBillRate: 145,
      targetPayRate: 105,
    },
    { rateMasked: true, aiSvc: activeAi }
  );

  assert.equal(maskedAiEval.capabilityScore, 91);
  assert.equal(maskedAiEval.capabilitySummary.evaluatedWithAi, true);
  assert.equal(maskedAiEval.capabilitySummary.recommendationLabel, 'Strong Fit');
  assert.equal(capturedPrompt.includes('145'), false);
  assert.equal(capturedPrompt.includes('105'), false);
  assert.equal(capturedPrompt.includes('98'), false);
  assert.equal(maskedAiEval.capabilitySummary.verdict.includes('98'), false);
  assert.equal(maskedAiEval.capabilitySummary.gaps[0].includes('145'), false);

  // 4. SQL/in-memory pre-filter selects top 25 highest offline matches before AI shortlist ranking
  const pool = Array.from({ length: 40 }, (_, i) => ({
    id: `c_${i}`,
    skillset: i === 33 ? 'AWS, Kubernetes, Terraform, Kafka' : i % 2 === 0 ? 'AWS' : 'PHP',
  }));
  const shortlisted = preFilterCandidatesForMatch(
    pool,
    { skillsRequired: 'AWS, Kubernetes, Terraform, Kafka' },
    25
  );
  assert.equal(shortlisted.length, 25);
  assert.equal(shortlisted[0].id, 'c_33');

  // 5. rankCandidatesForRequirement always returns rankings strictly descending by fitScore
  const partialBatchAi = new AiService({
    getConfig: () =>
      resolveAiConfig({
        AI_PROVIDER: 'openai',
        OPENAI_API_KEY: 'sk-test',
        AI_FALLBACK_TO_OFFLINE: 'true',
      }),
    fetchImpl: async () =>
      makeJsonResponse({
        choices: [
          {
            message: {
              content: JSON.stringify({
                rankings: [
                  {
                    candidateId: 'c1',
                    fitScore: 45,
                    matchedHighlights: ['Kubernetes'],
                    gaps: ['Terraform'],
                    oneLineSummary: 'Partial match.',
                  },
                  {
                    candidateId: 'c2',
                    fitScore: 94,
                    matchedHighlights: ['Kubernetes', 'Terraform', 'Istio'],
                    gaps: [],
                    oneLineSummary: 'Best overall fit.',
                  },
                ],
              }),
            },
          },
        ],
      }),
  });

  const sortedBatch = await partialBatchAi.rankCandidatesForRequirement(
    [
      { id: 'c1', skillset: 'Kubernetes' },
      { id: 'c2', skillset: 'Kubernetes, Terraform, Istio' },
      { id: 'c3', skillset: 'Kubernetes, Terraform' },
    ],
    { opportunityTitle: 'Cloud Architect', skillsRequired: 'Kubernetes, Terraform, Istio' }
  );
  assert.equal(sortedBatch.aiUsed, true);
  assert.equal(sortedBatch.rankings[0].candidateId, 'c2');
  assert.equal(sortedBatch.rankings[0].fitScore, 94);
  assert.ok(sortedBatch.rankings[0].fitScore >= sortedBatch.rankings[1].fitScore);
  assert.ok(sortedBatch.rankings[1].fitScore >= sortedBatch.rankings[2].fitScore);

  console.log('✅ Submitted Resume Capability Check Tests: PASSED');
};
