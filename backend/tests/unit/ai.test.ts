import assert from 'node:assert/strict';
import { resolveAiConfig } from '../../src/config/ai.config';
import {
  completeValidatedJson,
  parseAndValidateJson,
  stripJsonMarkdownFences,
} from '../../src/services/ai/ai.json';
import { SubmissionCapabilityAiSchema } from '../../src/services/ai/ai.schemas';
import { createAiAdapter } from '../../src/services/ai/ai.router';
import {
  AiService,
  computeOfflineCapabilityEvaluation,
  redactRatesFromText,
} from '../../src/services/ai/ai.service';
import {
  buildEnhancedEmailParseResponse,
  buildEnhancedResumeParseResponse,
  buildNodeResumeFallback,
} from '../../src/services/ai/parseBridge.service';
import type { AiProviderAdapter } from '../../src/services/ai/ai.types';

function makeJsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const runAiServiceTests = async () => {
  console.log('--- Running Provider-Agnostic AI Adapter & Guardrail Tests ---');

  // 1. Fence & prose stripping + Zod schema parsing
  const fenced = 'Here is the JSON:\n```json\n{"fitScore": 87.6, "recommendation": "STRONG_FIT", "strengths": ["AWS", "Kafka"], "gaps": ["Docker"], "verdict": "Great cloud match."}\n```\nDone!';
  assert.ok(stripJsonMarkdownFences(fenced).startsWith('{'));
  const parsed = parseAndValidateJson(fenced, SubmissionCapabilityAiSchema);
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.data.fitScore, 88);
    assert.equal(parsed.data.recommendation, 'STRONG_FIT');
  }

  // 2. 1-shot repair retry succeeds on malformed initial response & aggregates token usage
  let mockCalls = 0;
  const repairAdapter: AiProviderAdapter = {
    name: 'openai',
    isConfigured: () => true,
    async complete() {
      mockCalls += 1;
      if (mockCalls === 1) {
        return {
          text: '{"fitScore": 82, "recommendation": "INVALID_ENUM"}',
          provider: 'openai',
          model: 'gpt-4.1-mini',
          inputTokens: 100,
          outputTokens: 20,
          latencyMs: 40,
        };
      }
      return {
        text: '{"fitScore": 82, "recommendation": "STRONG_FIT", "strengths": ["Java"], "gaps": [], "verdict": "Solid fit."}',
        provider: 'openai',
        model: 'gpt-4o-mini',
        inputTokens: 80,
        outputTokens: 30,
        latencyMs: 25,
      };
    },
  };
  const repaired = await completeValidatedJson({
    adapter: repairAdapter,
    tier: 'smart',
    schema: SubmissionCapabilityAiSchema,
    messages: [{ role: 'user', content: 'Evaluate candidate' }],
  });
  assert.equal(mockCalls, 2);
  assert.equal(repaired.repaired, true);
  assert.equal(repaired.data.fitScore, 82);
  assert.equal(repaired.completion.inputTokens, 180);
  assert.equal(repaired.completion.outputTokens, 50);

  // 3. Router creates NoneAiProvider when disabled & fails safely
  const noneCfg = resolveAiConfig({ AI_PROVIDER: 'none' });
  const noneAdapter = createAiAdapter(noneCfg);
  assert.equal(noneAdapter.name, 'none');
  assert.equal(noneAdapter.isConfigured(), false);
  await assert.rejects(() =>
    noneAdapter.complete({ tier: 'fast', messages: [{ role: 'user', content: 'hi' }] })
  );

  // 4. OpenAiCompatibleProvider routes Cloudflare & falls back when response_format is rejected
  const capturedUrls: string[] = [];
  let cfAttempt = 0;
  const cfCfg = resolveAiConfig({
    AI_PROVIDER: 'cloudflare',
    CLOUDFLARE_AI_ACCOUNT_ID: 'acct-999',
    CLOUDFLARE_AI_API_TOKEN: 'cf-secret-token',
  });
  const cfAdapter = createAiAdapter(cfCfg, async (url) => {
    capturedUrls.push(String(url));
    cfAttempt += 1;
    if (cfAttempt === 1) {
      return new Response('{"error":"unsupported parameter response_format"}', { status: 400 });
    }
    return makeJsonResponse({
      model: '@cf/meta/llama-3.1-8b-instruct-fp8-fast',
      choices: [{ message: { content: '{"ok":true}' } }],
      usage: { prompt_tokens: 15, completion_tokens: 8 },
    });
  });
  const cfRes = await cfAdapter.complete({
    tier: 'fast',
    expectJson: true,
    messages: [{ role: 'user', content: 'hello' }],
  });
  assert.equal(
    capturedUrls[0],
    'https://api.cloudflare.com/client/v4/accounts/acct-999/ai/v1/chat/completions'
  );
  assert.equal(cfAttempt, 2);
  assert.equal(cfRes.inputTokens, 15);
  assert.equal(cfRes.outputTokens, 8);

  // 5. AnthropicAiProvider formats Messages API headers & splits system prompt
  let anthropicCapturedHeaders: Record<string, string> = {};
  let anthropicCapturedBody: any = null;
  const antCfg = resolveAiConfig({
    AI_PROVIDER: 'anthropic',
    ANTHROPIC_API_KEY: 'ant-secret-key',
  });
  const antAdapter = createAiAdapter(antCfg, async (_url, init) => {
    anthropicCapturedHeaders = (init?.headers || {}) as Record<string, string>;
    anthropicCapturedBody = JSON.parse(String(init?.body || '{}'));
    return makeJsonResponse({
      model: 'claude-3-5-haiku-latest',
      content: [{ type: 'text', text: '{"subject":"Hello","bodyText":"Hi there"}' }],
      usage: { input_tokens: 42, output_tokens: 18 },
    });
  });
  const antRes = await antAdapter.complete({
    tier: 'fast',
    messages: [
      { role: 'system', content: 'System rule' },
      { role: 'user', content: 'Draft' },
    ],
  });
  assert.equal(anthropicCapturedHeaders['x-api-key'], 'ant-secret-key');
  assert.equal(anthropicCapturedHeaders['anthropic-version'], '2023-06-01');
  assert.equal(anthropicCapturedBody.system, 'System rule');
  assert.equal(anthropicCapturedBody.messages.length, 1);
  assert.equal(antRes.inputTokens, 42);

  // 6. Rate redaction & PII scrubbing + RateMask enforcement in AiService
  const scrubbed = redactRatesFromText(
    'Target bill rate $135/hr (C2C) and candidate pay $95/hr - $105/hr.'
  );
  assert.equal(scrubbed.includes('135'), false);
  assert.equal(scrubbed.includes('95'), false);
  assert.ok(scrubbed.includes('[RATE MASKED]'));

  let leakedPromptPayload = '';
  const inspectingAiService = new AiService({
    getConfig: () =>
      resolveAiConfig({
        AI_PROVIDER: 'openai',
        OPENAI_API_KEY: 'sk-test',
        AI_MAX_INPUT_CHARS: '1000',
      }),
    fetchImpl: async (_url, init) => {
      leakedPromptPayload = String(init?.body || '');
      return makeJsonResponse({
        choices: [
          {
            message: {
              content: JSON.stringify({
                fitScore: 91,
                recommendation: 'STRONG_FIT',
                strengths: ['Java', 'Kubernetes'],
                gaps: ['Kafka'],
                verdict: 'Strong backend cloud match.',
              }),
            },
          },
        ],
      });
    },
  });

  const maskedEval = await inspectingAiService.evaluateSubmissionCapability(
    {
      id: 'cand-1',
      fullName: 'Arjun Patel',
      currentTitle: 'Java Cloud Engineer',
      skillset: 'Java, Spring Boot, AWS, Kubernetes',
      hourlyRateDisplay: '$98/hr (C2C)',
      rawSnippet: `${'A'.repeat(2500)} Bill rate expectation $140/hr.`,
    },
    {
      code: 'REQ-101',
      companyName: 'Apex Health',
      opportunityTitle: 'Senior Java Cloud Engineer',
      skillsRequired: 'Java, Spring Boot, Kubernetes, Kafka',
      targetBillRate: 145,
      maxBillRate: 155,
      targetPayRate: 105,
      rawEmailText: 'Budget bill rate is $145/hr for Austin hybrid.',
    },
    { rateMasked: true }
  );
  assert.equal(maskedEval.aiUsed, true);
  assert.equal(maskedEval.fitScore, 91);
  assert.equal(leakedPromptPayload.includes('145'), false);
  assert.equal(leakedPromptPayload.includes('155'), false);
  assert.equal(leakedPromptPayload.includes('105'), false);
  assert.equal(leakedPromptPayload.includes('140'), false);
  assert.equal(leakedPromptPayload.includes('$98/hr'), false);
  assert.equal(leakedPromptPayload.includes('arjun'), false);
  assert.ok(leakedPromptPayload.includes('...[truncated]'));

  // 7. Fail-safe offline fallback when AI endpoint fails / times out
  const failingAiService = new AiService({
    getConfig: () =>
      resolveAiConfig({
        AI_PROVIDER: 'openai',
        OPENAI_API_KEY: 'sk-test',
        AI_FALLBACK_TO_OFFLINE: 'true',
      }),
    fetchImpl: async () => {
      throw new Error('ETIMEDOUT');
    },
  });

  const fallbackCap = await failingAiService.evaluateSubmissionCapability(
    {
      id: 'cand-2',
      currentTitle: 'DevOps Engineer',
      skillset: 'AWS, Kubernetes, Terraform, C#, .NET',
      rawSnippet: 'Built EKS and .NET pipelines.',
    },
    {
      opportunityTitle: 'Cloud DevOps Engineer',
      skillsRequired: 'AWS, Kubernetes, Docker, C#',
    }
  );
  assert.equal(fallbackCap.aiUsed, false);
  assert.equal(fallbackCap.fitScore, 75);
  assert.deepEqual(fallbackCap.gaps, ['Docker']);

  // 8. Strict mode throws when fallbackToOffline=false
  const strictAiService = new AiService({
    getConfig: () =>
      resolveAiConfig({
        AI_PROVIDER: 'openai',
        OPENAI_API_KEY: 'sk-test',
        AI_FALLBACK_TO_OFFLINE: 'false',
      }),
    fetchImpl: async () => new Response('Server error', { status: 500 }),
  });
  await assert.rejects(() =>
    strictAiService.draftClientPitch(
      { id: 'c1', fullName: 'Test User' },
      { opportunityTitle: 'Java Dev' }
    )
  );

  // 9. Offline service mode returns clean deterministic outputs for all tasks
  const offlineService = new AiService({
    getConfig: () => resolveAiConfig({ AI_PROVIDER: 'none' }),
  });
  const resumeOffline = await offlineService.enhanceResumeParse('Java resume', {
    fullName: 'Arjun Patel',
    skills: ['Java', 'AWS'],
  });
  assert.equal(resumeOffline.aiUsed, false);
  assert.equal(resumeOffline.data.fullName, 'Arjun Patel');

  const emailOffline = await offlineService.enhanceEmailIntakeParse('Client email', {
    companyName: 'Apex Health',
    workModel: 'Hybrid',
    targetBillRate: 125,
  });
  assert.equal(emailOffline.aiUsed, false);
  assert.equal(emailOffline.data.companyName, 'Apex Health');

  const rankOffline = await offlineService.rankCandidatesForRequirement(
    [
      { id: 'c1', skillset: 'Java, Spring Boot' },
      { id: 'c2', skillset: 'Java, Spring Boot, AWS, Kafka' },
    ],
    { skillsRequired: 'Java, Spring Boot, AWS, Kafka' }
  );
  assert.equal(rankOffline.aiUsed, false);
  assert.equal(rankOffline.rankings[0].candidateId, 'c2');
  assert.equal(rankOffline.rankings[0].fitScore, 100);

  const pitchOffline = await offlineService.draftClientPitch(
    {
      id: 'c1',
      fullName: 'Arjun Patel',
      currentTitle: 'Senior Java Engineer',
      skillset: 'Java, Spring Boot',
      hourlyRateDisplay: '$95/hr (C2C)',
    },
    { opportunityTitle: 'Lead Java Engineer', location: 'Austin, TX' },
    { rateMasked: true, agencyName: 'Softiox Talent' }
  );
  assert.equal(pitchOffline.aiUsed, false);
  assert.equal(pitchOffline.bodyText.includes('95'), false);
  assert.ok(pitchOffline.bodyText.includes('Softiox Talent'));

  const emptySkillEval = computeOfflineCapabilityEvaluation(
    { id: 'c1', currentTitle: 'Java Developer', skillset: 'Java, AWS' },
    { opportunityTitle: 'Senior Java Developer', skillsRequired: '' }
  );
  assert.equal(emptySkillEval.fitScore, 72);

  // 10. Step 3 Parse Bridge: Resume offline parity & AI enhancement merge (Python wrapped & Node fallback)
  const pythonResumeEnvelope = {
    success: true,
    data: {
      fullName: 'Anand Verma',
      phone: '+1 (512) 555-0144',
      email: 'anand.verma@cloudmail.com',
      workAuth: 'US Citizen',
      currentTitle: 'Lead AWS Architect',
      skillset: 'AWS, Terraform',
      hourlyRate: '$92/hr (W2)',
      relocation: 'Yes',
      fileName: 'Anand_Verma.pdf',
      rawSnippet: 'Anand Verma\nLead AWS Architect with Terraform and EKS experience.',
    },
  };

  const offlineWrappedResume = await buildEnhancedResumeParseResponse({
    upstreamPayload: pythonResumeEnvelope,
    rawTextForAi: pythonResumeEnvelope.data.rawSnippet,
    aiSvc: offlineService,
  });
  assert.equal(offlineWrappedResume.aiUsed, false);
  assert.equal(offlineWrappedResume.data.aiUsed, false);
  assert.equal(offlineWrappedResume.data.skillset, 'AWS, Terraform');

  const activeParseAiService = new AiService({
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
                fullName: 'Anand Verma',
                email: 'anand.verma@cloudmail.com',
                phone: '+1 (512) 555-0144',
                workAuth: 'US Citizen',
                currentTitle: 'Principal Cloud & Kubernetes Architect',
                education: 'MS in Computer Science',
                skills: ['AWS', 'Terraform', 'EKS', 'Kubernetes'],
                hourlyRate: '$92/hr (W2)',
                relocation: 'Yes',
                professionalSummary:
                  'Cloud architect with deep AWS, Terraform, and EKS platform experience.',
              }),
            },
          },
        ],
      }),
  });

  const aiWrappedResume = await buildEnhancedResumeParseResponse({
    upstreamPayload: pythonResumeEnvelope,
    rawTextForAi: pythonResumeEnvelope.data.rawSnippet,
    aiSvc: activeParseAiService,
  });
  assert.equal(aiWrappedResume.aiUsed, true);
  assert.equal(aiWrappedResume.data.aiUsed, true);
  assert.equal(aiWrappedResume.data.currentTitle, 'Principal Cloud & Kubernetes Architect');
  assert.equal(aiWrappedResume.data.skillset, 'AWS, Terraform, EKS, Kubernetes');
  assert.ok(aiWrappedResume.data.professionalSummary.includes('AWS'));

  const nodeFlatResume = buildNodeResumeFallback(
    Buffer.from('Jane Doe\njane@dev.io\nReact TypeScript AWS US Citizen'),
    'Jane_Doe_Resume.txt'
  );
  const aiFlatResume = await buildEnhancedResumeParseResponse({
    upstreamPayload: nodeFlatResume,
    rawTextForAi: nodeFlatResume.raw_text_snippet,
    aiSvc: activeParseAiService,
  });
  assert.equal(aiFlatResume.aiUsed, true);
  assert.equal(aiFlatResume.current_title, 'Principal Cloud & Kubernetes Architect');

  // 11. Step 3 Parse Bridge: Email intake offline parity, AI refinement, rate masking, and timeout fallback
  const sampleEmail = [
    'Target Company: Apex Health Systems',
    'Role: Principal Data Engineer',
    'Location: Austin, TX (Hybrid)',
    'Contact: Maya Lin <maya@apexhealth.com>',
    'Bill Rate: $135/hr',
    'Pay Rate: $95/hr',
    'Looking for PySpark, Snowflake, Airflow and AWS.',
  ].join('\n');

  const offlineEmailRes = await buildEnhancedEmailParseResponse({
    rawEmailText: sampleEmail,
    aiSvc: offlineService,
  });
  assert.equal(offlineEmailRes.aiUsed, false);
  assert.equal(offlineEmailRes.companyName, 'Apex Health Systems');
  assert.equal(offlineEmailRes.targetBillRate, 135);
  assert.equal(offlineEmailRes.targetPayRate, 95);

  let seenPromptForMaskedEmail = '';
  const emailInspectingAiService = new AiService({
    getConfig: () =>
      resolveAiConfig({
        AI_PROVIDER: 'openai',
        OPENAI_API_KEY: 'sk-test',
        AI_FALLBACK_TO_OFFLINE: 'true',
      }),
    fetchImpl: async (_url, init) => {
      seenPromptForMaskedEmail = String(init?.body || '');
      return makeJsonResponse({
        choices: [
          {
            message: {
              content: JSON.stringify({
                companyName: 'Apex Health Systems',
                opportunityTitle: 'Principal Data Platform Engineer',
                openPositions: 2,
                clientContact: 'Maya Lin',
                clientContactEmail: 'maya@apexhealth.com',
                clientContactTitle: 'Hiring Manager',
                location: 'Austin, TX',
                workModel: 'Hybrid',
                targetBillRate: 0,
                targetPayRate: 0,
                skills: ['PySpark', 'Snowflake', 'Airflow', 'AWS'],
                missingNotes: 'Direct phone number missing.',
              }),
            },
          },
        ],
      });
    },
  });

  const maskedAiEmailRes = await buildEnhancedEmailParseResponse({
    rawEmailText: sampleEmail,
    rateMasked: true,
    aiSvc: emailInspectingAiService,
  });
  assert.equal(maskedAiEmailRes.aiUsed, true);
  assert.equal(seenPromptForMaskedEmail.includes('135'), false);
  assert.equal(seenPromptForMaskedEmail.includes('95'), false);

  const failingEmailAiService = new AiService({
    getConfig: () =>
      resolveAiConfig({
        AI_PROVIDER: 'openai',
        OPENAI_API_KEY: 'sk-test',
        AI_FALLBACK_TO_OFFLINE: 'true',
      }),
    fetchImpl: async () => {
      throw new Error('Upstream timeout');
    },
  });

  const fallbackOnErrorEmail = await buildEnhancedEmailParseResponse({
    rawEmailText: sampleEmail,
    aiSvc: failingEmailAiService,
  });
  assert.equal(fallbackOnErrorEmail.aiUsed, false);
  assert.equal(fallbackOnErrorEmail.companyName, 'Apex Health Systems');
  assert.equal(fallbackOnErrorEmail.targetBillRate, 135);

  console.log('✅ Provider-Agnostic AI Adapter & Guardrail Tests: PASSED');
};
