import assert from 'node:assert/strict';
import { resolveAiConfig } from '../../src/config/ai.config';
import { AiService } from '../../src/services/ai/ai.service';
import {
  CapabilityService,
  evaluateCandidateCapabilityPure,
  formatRecommendationLabel,
  normalizePrecomputedCapabilitySummary,
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

  // 6. Quick Attach & batch attach never invoke AI automatically on newly attached submissions
  let attachAiCalls = 0;
  const trackingActiveAi = new AiService({
    getConfig: () =>
      resolveAiConfig({
        AI_PROVIDER: 'openai',
        OPENAI_API_KEY: 'sk-test',
        AI_FALLBACK_TO_OFFLINE: 'true',
      }),
    fetchImpl: async () => {
      attachAiCalls += 1;
      throw new Error('AI should not be invoked during Quick Attach or Batch Attach');
    },
  });

  const capabilitySvc = new CapabilityService();
  await capabilitySvc.evaluateNewlyAttachedSubmissions(
    [
      {
        id: 'sub-unscored-single',
        candidate: {
          id: 'cand-1',
          fullName: 'Samira Rao',
          currentTitle: 'QA Analyst',
          skillset: 'Selenium, Postman',
          workAuth: 'US Citizen',
          relocation: 'No',
          hourlyRateDisplay: '$60/hr',
          rawSnippet: 'Manual and Selenium API QA testing.',
        },
      },
    ],
    {
      id: 'req-1',
      code: 'REQ-900',
      companyName: 'Apex Cloud',
      opportunityTitle: 'Principal Rust Kernel Engineer',
      skillsRequired: 'Rust, Linux Kernel, eBPF',
      location: 'Remote',
      workModel: 'Remote',
      rawEmailText: null,
    },
    { tenantId: 'tenant-1', aiSvc: trackingActiveAi }
  );
  assert.equal(attachAiCalls, 0);

  await capabilitySvc.evaluateNewlyAttachedSubmissions(
    [
      {
        id: 'sub-batch-1',
        candidate: {
          id: 'c-b1',
          fullName: 'Dev One',
          currentTitle: 'Backend Engineer',
          skillset: 'Java, Spring Boot',
          workAuth: 'GC',
          relocation: 'No',
          hourlyRateDisplay: null,
          rawSnippet: 'Java microservices.',
        },
      },
      {
        id: 'sub-batch-2',
        candidate: {
          id: 'c-b2',
          fullName: 'Dev Two',
          currentTitle: 'Frontend Engineer',
          skillset: 'React, TypeScript',
          workAuth: 'USC',
          relocation: 'No',
          hourlyRateDisplay: null,
          rawSnippet: 'React dashboards.',
        },
      },
    ],
    {
      id: 'req-2',
      code: 'REQ-901',
      companyName: 'Apex Cloud',
      opportunityTitle: 'Platform Architect',
      skillsRequired: 'Rust, Kubernetes, Terraform',
      location: 'Remote',
      workModel: 'Remote',
      rawEmailText: null,
    },
    { tenantId: 'tenant-1', aiSvc: trackingActiveAi }
  );
  assert.equal(attachAiCalls, 0);

  // 7. Carrying over SquadAI Rank reports preserves score, strengths, gaps, verdict & rate masking
  assert.equal(
    normalizePrecomputedCapabilitySummary({ fitScore: 88, evaluatedWithAi: false }),
    null
  );
  const precomputedSanitized = normalizePrecomputedCapabilitySummary(
    {
      fitScore: 87.6,
      strengths: ['Kubernetes ($145/hr ceiling)', 'Terraform'],
      gaps: ['Kafka'],
      verdict: 'Strong Kubernetes match expecting $98/hr.',
      evaluatedWithAi: true,
    },
    { rateMasked: true }
  );
  assert.ok(precomputedSanitized);
  assert.equal(precomputedSanitized.capabilityScore, 88);
  assert.equal(precomputedSanitized.capabilitySummary.recommendation, 'STRONG_FIT');
  assert.equal(precomputedSanitized.capabilitySummary.recommendationLabel, 'Strong Fit');
  assert.equal(precomputedSanitized.capabilitySummary.evaluatedWithAi, true);
  assert.equal(precomputedSanitized.capabilitySummary.verdict.includes('98'), false);
  assert.equal(precomputedSanitized.capabilitySummary.strengths[0].includes('145'), false);

  // 8. Large batch (>5 candidates) chunks into parallel LLM calls, retries omitted candidates, and never emits offline fallback when configured
  const chunkSizesSeen: number[] = [];
  let failOnceIds = new Set<string>();
  let fallbackModeFlag: 'true' | 'false' = 'false';
  const chunkedAi = new AiService({
    getConfig: () =>
      resolveAiConfig({
        AI_PROVIDER: 'openai',
        OPENAI_API_KEY: 'sk-test',
        AI_FALLBACK_TO_OFFLINE: fallbackModeFlag,
      }),
    fetchImpl: async (_url, init) => {
      const parsedBody = JSON.parse(String(init?.body || '{}'));
      const userMsg = parsedBody.messages?.find((m: any) => m.role === 'user')?.content || '{}';
      const payload = JSON.parse(userMsg);
      const chunkCands = Array.isArray(payload.candidates) ? payload.candidates : [];
      chunkSizesSeen.push(chunkCands.length);

      const hitTransientFail = chunkCands.some((c: any) => failOnceIds.has(c.candidateId));
      if (hitTransientFail) {
        chunkCands.forEach((c: any) => failOnceIds.delete(c.candidateId));
        throw new Error('simulated transient chunk timeout');
      }

      return makeJsonResponse({
        choices: [
          {
            message: {
              content: JSON.stringify({
                rankings: chunkCands.map((c: any, idx: number) => ({
                  candidateId: c.candidateId,
                  fitScore: 95 - chunkCands.length - idx * 2,
                  matchedHighlights: ['Kubernetes'],
                  gaps: [],
                  oneLineSummary: `AI evaluated ${c.candidateId}`,
                })),
              }),
            },
          },
        ],
      });
    },
  });

  const twelveCandidates = Array.from({ length: 12 }, (_, idx) => ({
    id: `batch-cand-${idx + 1}`,
    skillset: idx % 2 === 0 ? 'Kubernetes, Terraform' : 'Java, SQL',
  }));
  const chunkedResult = await chunkedAi.rankCandidatesForRequirement(twelveCandidates, {
    opportunityTitle: 'Platform Engineer',
    skillsRequired: 'Kubernetes, Terraform',
  });
  assert.deepEqual(chunkSizesSeen, [5, 5, 2]);
  assert.equal(chunkedResult.aiUsed, true);
  assert.equal(chunkedResult.rankings.length, 12);
  assert.ok(chunkedResult.rankings.every((r) => r.aiEvaluated === true));
  for (let i = 1; i < chunkedResult.rankings.length; i++) {
    assert.ok(chunkedResult.rankings[i - 1].fitScore >= chunkedResult.rankings[i].fitScore);
  }

  // Transient chunk failure is automatically retried so all 12 still get genuine AI scores without offline fallback
  chunkSizesSeen.length = 0;
  failOnceIds = new Set(['batch-cand-11']);
  const retriedResult = await chunkedAi.rankCandidatesForRequirement(twelveCandidates, {
    opportunityTitle: 'Platform Engineer',
    skillsRequired: 'Kubernetes, Terraform',
  });
  assert.deepEqual(chunkSizesSeen, [5, 5, 2, 2]);
  assert.equal(retriedResult.aiUsed, true);
  assert.equal(retriedResult.rankings.length, 12);
  assert.ok(retriedResult.rankings.every((r) => r.aiEvaluated === true));

  // Strict non-fallback mode (AI_FALLBACK_TO_OFFLINE=false) never injects offline fallback scores when all chunks fail
  const alwaysFailingStrictAi = new AiService({
    getConfig: () =>
      resolveAiConfig({
        AI_PROVIDER: 'openai',
        OPENAI_API_KEY: 'sk-test',
        AI_FALLBACK_TO_OFFLINE: 'false',
      }),
    fetchImpl: async () => {
      throw new Error('Upstream unavailable');
    },
  });
  await assert.rejects(() =>
    alwaysFailingStrictAi.rankCandidatesForRequirement(twelveCandidates, {
      opportunityTitle: 'Platform Engineer',
      skillsRequired: 'Kubernetes, Terraform',
    })
  );

  // Explicit opt-in AI_FALLBACK_TO_OFFLINE=true retains offline baseline when requested
  fallbackModeFlag = 'true';
  chunkSizesSeen.length = 0;
  const alwaysFailTwoAi = new AiService({
    getConfig: () =>
      resolveAiConfig({
        AI_PROVIDER: 'openai',
        OPENAI_API_KEY: 'sk-test',
        AI_FALLBACK_TO_OFFLINE: 'true',
      }),
    fetchImpl: async (_url, init) => {
      const parsedBody = JSON.parse(String(init?.body || '{}'));
      const payload = JSON.parse(parsedBody.messages.find((m: any) => m.role === 'user').content);
      const chunkCands = payload.candidates;
      if (chunkCands.some((c: any) => c.candidateId === 'batch-cand-11')) {
        throw new Error('persistent failure');
      }
      return makeJsonResponse({
        choices: [
          {
            message: {
              content: JSON.stringify({
                rankings: chunkCands.map((c: any, idx: number) => ({
                  candidateId: c.candidateId,
                  fitScore: 90 - idx,
                  matchedHighlights: ['Kubernetes'],
                  gaps: [],
                  oneLineSummary: 'Evaluated',
                })),
              }),
            },
          },
        ],
      });
    },
  });
  const optInPartialFallback = await alwaysFailTwoAi.rankCandidatesForRequirement(twelveCandidates, {
    opportunityTitle: 'Platform Engineer',
    skillsRequired: 'Kubernetes, Terraform',
  });
  assert.equal(optInPartialFallback.aiUsed, true);
  assert.equal(optInPartialFallback.rankings.length, 12);
  assert.equal(optInPartialFallback.rankings.filter((r) => r.aiEvaluated).length, 10);
  assert.equal(
    optInPartialFallback.rankings.find((r) => r.candidateId === 'batch-cand-11')?.aiEvaluated,
    false
  );

  console.log('✅ Submitted Resume Capability Check Tests: PASSED');
};
