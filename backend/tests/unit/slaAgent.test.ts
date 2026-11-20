import assert from 'node:assert/strict';
import { resolveAiConfig } from '../../src/config/ai.config';
import { AiService, redactRatesFromText } from '../../src/services/ai/ai.service';
import {
  BenchCandidateRow,
  buildContractRenewalAgentPure,
  buildFeedbackFollowupAgentPure,
  buildStaleReqSuggestionsPure,
} from '../../src/services/ai/slaAgent.service';

function makeJsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeBenchPool(count: number): BenchCandidateRow[] {
  return Array.from({ length: count }, (_, idx) => {
    const n = idx + 1;
    const isTop = n <= 3;
    return {
      id: `cand-${n}`,
      fullName: `Candidate ${n}`,
      currentTitle: isTop ? 'Senior Java Spring Boot Engineer' : 'QA Analyst',
      skillset: isTop
        ? 'Java, Spring Boot, PostgreSQL, Kubernetes, AWS'
        : 'Manual Testing, Jira, Selenium',
      workAuth: 'H1B',
      relocation: 'Open',
      rawSnippet: isTop
        ? `Built Java Spring Boot microservices on AWS. Target pay expectation $110/hr C2C (cand #${n}).`
        : `Manual QA engineer (cand #${n}). Bill cap $85/hr.`,
      ...(isTop
        ? {
            matchedChunks: [
              `Deep CV Page 3: Led Java Spring Boot core banking migration with PostgreSQL and AWS EKS.`,
            ],
          }
        : {}),
    };
  });
}

export const runSlaAgentTests = async () => {
  console.log('--- Running Action Center SLA Agent Tests ---');

  const reqInput = {
    id: 'req-401',
    code: 'REQ-401',
    companyName: 'Meridian FinTech',
    opportunityTitle: 'Senior Java Spring Boot Engineer',
    skillsRequired: 'Java, Spring Boot, PostgreSQL, AWS',
    location: 'Charlotte, NC',
    workModel: 'Hybrid',
    publicDescription: 'Core banking microservices modernization.',
    rawEmailText: 'Client bill rate cap $145/hr. Need strong Java and Spring Boot engineer.',
  };

  // 1. Offline stale-requirement preparation returns deterministic top-3 shortlist & caps at 20 bench rows
  const offlineAi = new AiService({
    getConfig: () => resolveAiConfig({ AI_PROVIDER: 'none' }),
  });

  const emptyShortlist = await buildStaleReqSuggestionsPure({
    requirement: reqInput,
    benchCandidates: [],
    tenantId: 'tenant-1',
    aiSvc: offlineAi,
  });
  assert.equal(emptyShortlist, null);

  const offlineShortlist = await buildStaleReqSuggestionsPure({
    requirement: reqInput,
    benchCandidates: makeBenchPool(25),
    tenantId: 'tenant-1',
    aiSvc: offlineAi,
  });
  assert.ok(offlineShortlist);
  assert.equal(offlineShortlist.kind, 'candidate_shortlist');
  assert.equal(offlineShortlist.evaluatedWithAi, false);
  assert.equal(offlineShortlist.requirementId, 'req-401');
  assert.equal(offlineShortlist.suggestions?.length, 3);
  assert.ok(offlineShortlist.suggestions!.every((s) => ['cand-1', 'cand-2', 'cand-3'].includes(s.candidateId)));
  assert.ok(offlineShortlist.suggestions!.every((s) => s.fitScore >= 0 && s.fitScore <= 100));

  // 2. Active AI stale-requirement prep caps input to 20 bench candidates, scrubs rates, and meters agent_prep usage
  const recordedUsage: Array<Record<string, any>> = [];
  let seenShortlistPrompt = '';
  const activeRankAi = new AiService({
    getConfig: () =>
      resolveAiConfig({
        AI_PROVIDER: 'openai',
        OPENAI_API_KEY: 'sk-test',
        AI_FALLBACK_TO_OFFLINE: 'true',
      }),
    checkQuota: async () => ({
      exceeded: false,
      actionsUsed: 1,
      tokensUsed: 100,
      actionLimit: 100,
      tokenLimit: 0,
    }),
    recordUsage: async (entry) => {
      recordedUsage.push(entry);
    },
    fetchImpl: async (_url, init) => {
      seenShortlistPrompt += `${seenShortlistPrompt ? '\n' : ''}${String(init?.body || '')}`;
      return makeJsonResponse({
        model: 'gpt-4.1-mini',
        choices: [
          {
            message: {
              content: JSON.stringify({
                rankings: [
                  {
                    candidateId: 'cand-2',
                    fitScore: 95,
                    matchedHighlights: ['Java', 'Spring Boot', 'PostgreSQL', 'AWS'],
                    gaps: [],
                    oneLineSummary: 'Strong Java microservices fit; rate target $145/hr.',
                  },
                  {
                    candidateId: 'cand-1',
                    fitScore: 91,
                    matchedHighlights: ['Java', 'Spring Boot', 'AWS'],
                    gaps: ['Kafka'],
                    oneLineSummary: 'Solid backend background with AWS Kubernetes depth.',
                  },
                  {
                    candidateId: 'cand-3',
                    fitScore: 88,
                    matchedHighlights: ['Java', 'PostgreSQL'],
                    gaps: [],
                    oneLineSummary: 'Experienced enterprise Java engineer.',
                  },
                  {
                    candidateId: 'cand-4',
                    fitScore: 30,
                    matchedHighlights: [],
                    gaps: ['Java', 'Spring Boot'],
                    oneLineSummary: 'Mostly QA background.',
                  },
                ],
              }),
            },
          },
        ],
        usage: { prompt_tokens: 240, completion_tokens: 95 },
      });
    },
  });

  const activeShortlist = await buildStaleReqSuggestionsPure({
    requirement: reqInput,
    benchCandidates: makeBenchPool(25),
    tenantId: 'tenant-1',
    aiSvc: activeRankAi,
  });

  assert.ok(activeShortlist);
  assert.equal(activeShortlist.evaluatedWithAi, true);
  assert.equal(activeShortlist.suggestions?.length, 3);
  assert.equal(activeShortlist.suggestions?.[0].candidateId, 'cand-2');
  assert.equal(activeShortlist.suggestions?.[0].fullName, 'Candidate 2');
  // Pool capped at 20 before calling LLM
  assert.equal(seenShortlistPrompt.includes('cand-20'), true);
  assert.equal(seenShortlistPrompt.includes('cand-21'), false);
  // Deep retrieved chunks flow cleanly into prompt; zero rates leaked
  assert.equal(seenShortlistPrompt.includes('Deep CV Page 3'), true);
  assert.equal(seenShortlistPrompt.includes('145'), false);
  assert.equal(seenShortlistPrompt.includes('110'), false);
  assert.equal(activeShortlist.suggestions?.[0].oneLineSummary.includes('145'), false);
  // Usage feature metered as agent_prep
  assert.equal(recordedUsage.length, 1);
  assert.equal(recordedUsage[0].feature, 'agent_prep');
  assert.equal(recordedUsage[0].tenantId, 'tenant-1');

  // 3. Feedback follow-up pre-draft respects rate masking and records agent_prep
  let seenFollowupPrompt = '';
  const activeDraftAi = new AiService({
    getConfig: () =>
      resolveAiConfig({
        AI_PROVIDER: 'openai',
        OPENAI_API_KEY: 'sk-test',
        AI_FALLBACK_TO_OFFLINE: 'true',
      }),
    checkQuota: async () => ({
      exceeded: false,
      actionsUsed: 2,
      tokensUsed: 435,
      actionLimit: 100,
      tokenLimit: 0,
    }),
    recordUsage: async (entry) => {
      recordedUsage.push(entry);
    },
    fetchImpl: async (_url, init) => {
      seenFollowupPrompt = String(init?.body || '');
      return makeJsonResponse({
        model: 'gpt-4.1-mini',
        choices: [
          {
            message: {
              content: JSON.stringify({
                subject: 'Follow-Up: Priya Nair — REQ-401 ($145/hr)',
                bodyText:
                  'Hi Meridian team,\n\nChecking in on interview availability for Priya Nair (target $110/hr).\n\nBest,\nSoftiox Staffing',
              }),
            },
          },
        ],
        usage: { prompt_tokens: 110, completion_tokens: 40 },
      });
    },
  });

  const followupPayload = await buildFeedbackFollowupAgentPure({
    requirement: reqInput,
    primaryCandidate: {
      id: 'cand-99',
      fullName: 'Priya Nair',
      currentTitle: 'Principal Java Architect',
      skillset: 'Java, Spring Boot, AWS',
      workAuth: 'GC',
    },
    agencyName: 'Softiox Staffing',
    recipientEmail: 'vendor@meridian.com',
    tenantId: 'tenant-1',
    aiSvc: activeDraftAi,
  });

  assert.equal(followupPayload.kind, 'followup_draft');
  assert.equal(followupPayload.evaluatedWithAi, true);
  assert.equal(followupPayload.requirementId, 'req-401');
  assert.equal(followupPayload.recipientEmail, 'vendor@meridian.com');
  assert.equal(followupPayload.draftSubject?.includes('145'), false);
  assert.equal(followupPayload.draftBody?.includes('110'), false);
  assert.equal(seenFollowupPrompt.includes('145'), false);
  assert.equal(recordedUsage[1].feature, 'agent_prep');

  // 4. Contract renewal pre-draft (offline fallback + active AI defense-in-depth rate redaction)
  const offlineRenewal = await buildContractRenewalAgentPure({
    placement: {
      id: 'plc-77',
      customer: 'Horizon Bio',
      resourceName: 'Arjun Verma',
      skillRole: 'Snowflake Data Architect',
      endDate: new Date('2026-12-15T00:00:00Z'),
    },
    agencyName: 'Softiox Staffing',
    tenantId: 'tenant-1',
    aiSvc: offlineAi,
  });

  assert.equal(offlineRenewal.kind, 'renewal_draft');
  assert.equal(offlineRenewal.evaluatedWithAi, false);
  assert.equal(offlineRenewal.placementId, 'plc-77');
  assert.ok(offlineRenewal.draftSubject?.includes('Arjun Verma'));
  assert.ok(offlineRenewal.draftSubject?.includes('2026-12-15'));

  const activeRenewal = await buildContractRenewalAgentPure({
    placement: {
      id: 'plc-77',
      customer: 'Horizon Bio',
      resourceName: 'Arjun Verma',
      skillRole: 'Snowflake Data Architect',
      endDate: new Date('2026-12-15T00:00:00Z'),
    },
    agencyName: 'Softiox Staffing',
    tenantId: 'tenant-1',
    aiSvc: activeDraftAi,
  });
  assert.equal(activeRenewal.kind, 'renewal_draft');
  assert.equal(activeRenewal.evaluatedWithAi, true);
  assert.equal(activeRenewal.draftSubject?.includes('145'), false);
  assert.equal(activeRenewal.draftBody?.includes('110'), false);
  assert.equal(recordedUsage[2].feature, 'agent_prep');

  // 5. Rate-masked SLA task meta scrubbing matches SlaController behavior
  const rawMeta = 'Bill: $145/hr • Spread: +$35/hr';
  const scrubbedMeta = redactRatesFromText(rawMeta);
  assert.equal(scrubbedMeta.includes('145'), false);
  assert.equal(scrubbedMeta.includes('35'), false);
  assert.ok(scrubbedMeta.includes('[RATE MASKED]'));

  console.log('✅ Action Center SLA Agent Tests: PASSED');
};
