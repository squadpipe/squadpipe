import assert from 'node:assert/strict';
import zlib from 'node:zlib';
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
  purifyJobTitle,
  sanitizeExtractedText,
} from '../../src/services/ai/extractionSanitizer';
import {
  buildEnhancedEmailParseResponse,
  buildEnhancedResumeParseResponse,
  buildNodeResumeFallback,
  extractEmailHeuristics,
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

  // 12. Node resume fallback extracts clean text from compressed DOCX ZIP archives & never emits raw binary PDF bytes
  const xmlName = Buffer.from('word/document.xml', 'utf8');
  const xmlBody = Buffer.from(
    '<w:document><w:body><w:p><w:r><w:t>Pooja Sharma</w:t></w:r></w:p><w:p><w:r><w:t>pooja.sharma@azuredev.io</w:t></w:r></w:p><w:p><w:r><w:t>Skills: C#, Azure, Kubernetes, Terraform</w:t></w:r></w:p></w:body></w:document>',
    'utf8'
  );
  const deflated = zlib.deflateRawSync(xmlBody);
  const localHeader = Buffer.alloc(30);
  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(8, 8);
  localHeader.writeUInt32LE(deflated.length, 18);
  localHeader.writeUInt16LE(xmlName.length, 26);
  const syntheticDocxZip = Buffer.concat([localHeader, xmlName, deflated]);

  const parsedDocxFallback = buildNodeResumeFallback(
    syntheticDocxZip,
    '14_Pooja_Sharma_NET_Core_Azure_Developer.docx'
  );
  assert.equal(parsedDocxFallback.email, 'pooja.sharma@azuredev.io');
  assert.ok(parsedDocxFallback.skills.includes('Kubernetes'));
  assert.ok(parsedDocxFallback.raw_text_snippet.includes('Pooja Sharma'));
  assert.equal(parsedDocxFallback.raw_text_snippet.includes('PK'), false);

  const parsedPdfBinaryFallback = buildNodeResumeFallback(
    Buffer.from('%PDF-1.4\n1 0 obj\n<< /Length 25 >>\nstream\nraw compressed bytes go here\nendstream'),
    'sample_resume.pdf'
  );
  assert.equal(parsedPdfBinaryFallback.raw_text_snippet.includes('%PDF-'), false);

  // 13. Cloudflare JSON requests include safe default max_tokens >= 2048 when maxTokens is omitted
  let seenCfBody: Record<string, any> = {};
  const cfJsonAdapter = createAiAdapter(
    resolveAiConfig({
      AI_PROVIDER: 'cloudflare',
      CLOUDFLARE_AI_ACCOUNT_ID: 'acct-1',
      CLOUDFLARE_AI_API_TOKEN: 'tok-1',
    }),
    async (_url, init) => {
      seenCfBody = JSON.parse(String(init?.body || '{}'));
      return makeJsonResponse({
        choices: [{ message: { content: '{"ok":true}' } }],
      });
    }
  );
  await cfJsonAdapter.complete({
    tier: 'smart',
    expectJson: true,
    messages: [{ role: 'user', content: 'Return JSON' }],
  });
  assert.ok((seenCfBody.max_tokens || 0) >= 2048);

  // 14. Extraction Engine: placeholder stripping -> blank, pure job titles, and conversational email parsing
  assert.equal(sanitizeExtractedText('Not specified in email'), '');
  assert.equal(sanitizeExtractedText('Unknown'), '');
  assert.equal(sanitizeExtractedText('N/A'), '');
  assert.equal(purifyJobTitle('React developer for one of our ongoing projects'), 'React Developer');
  assert.equal(
    purifyJobTitle('Urgent: Fwd: Lead SAP S/4HANA FICO Solution Architect - Remote (12 mos)'),
    'Lead SAP S/4HANA FICO Solution Architect'
  );
  assert.equal(purifyJobTitle('aws devops engineer role in Austin, TX'), 'AWS DevOps Engineer');
  assert.equal(purifyJobTitle('ui/ux product designers with 5+ years'), 'UI/UX Product Designer');

  const screenshotEmail = [
    'Hi,',
    '',
    'We are looking for a React developer for one of our ongoing projects. The client needs someone with around 4–5 years of experience in React, JavaScript, Redux and REST APIs. Good knowledge of Node.js and AWS would be an advantage.',
    '',
    'The role is remote and initially for 6 months. The budget is around $75 per hour, but there is some flexibility for the right candidate. They would prefer someone who can join within 2 weeks.',
    '',
    'Thanks,',
    'David',
  ].join('\n');

  const heuristicScreenshotRes = extractEmailHeuristics(screenshotEmail);
  assert.equal(heuristicScreenshotRes.companyName, '');
  assert.equal(heuristicScreenshotRes.clientContactTitle, '');
  assert.equal(heuristicScreenshotRes.clientContact, 'David');
  assert.equal(heuristicScreenshotRes.opportunityTitle, 'React Developer');
  assert.equal(heuristicScreenshotRes.location, 'Remote');
  assert.equal(heuristicScreenshotRes.workModel, 'Remote');
  assert.equal(heuristicScreenshotRes.targetBillRate, 75);
  assert.ok(heuristicScreenshotRes.skillsRequired.includes('React'));
  assert.ok(heuristicScreenshotRes.skillsRequired.includes('JavaScript'));
  assert.ok(heuristicScreenshotRes.skillsRequired.includes('Redux'));
  assert.ok(heuristicScreenshotRes.skillsRequired.includes('REST APIs'));
  assert.ok(heuristicScreenshotRes.skillsRequired.includes('Node.js'));
  assert.ok(heuristicScreenshotRes.skillsRequired.includes('AWS'));
  assert.equal(/not specified in email/i.test(heuristicScreenshotRes.missingNotes), false);

  // LLM returning placeholder strings and noisy title is sanitized back to blank + pure title
  const noisySentinelAiService = new AiService({
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
                companyName: 'Not specified in email',
                opportunityTitle: 'React Developer for one of our ongoing projects',
                clientContact: 'David',
                clientContactEmail: 'N/A',
                clientContactTitle: 'Not specified in email',
                location: 'Remote',
                workModel: 'Remote',
                targetBillRate: 75,
                targetPayRate: 0,
                skills: ['React', 'JavaScript', 'Redux', 'REST APIs', 'Node.js', 'AWS'],
                missingNotes: 'Not specified in email: company name, explicit pay rate.',
              }),
            },
          },
        ],
      }),
  });

  const cleanedAiEmailRes = await buildEnhancedEmailParseResponse({
    rawEmailText: screenshotEmail,
    aiSvc: noisySentinelAiService,
  });
  assert.equal(cleanedAiEmailRes.aiUsed, true);
  assert.equal(cleanedAiEmailRes.companyName, '');
  assert.equal(cleanedAiEmailRes.clientContactTitle, '');
  assert.equal(cleanedAiEmailRes.clientContactEmail, '');
  assert.equal(cleanedAiEmailRes.opportunityTitle, 'React Developer');
  assert.equal(/not specified in email/i.test(cleanedAiEmailRes.missingNotes), false);

  // Sparse email with no location/company/signature leaves blank fields & extracts multi-headcount pure role
  const sparseEmailRes = extractEmailHeuristics(
    'Subject: Staffing Update\nWe are looking for 2 python data engineers with Airflow and Snowflake experience and at least 5 years in production. Salary band around $150,000.'
  );
  assert.equal(sparseEmailRes.companyName, '');
  assert.equal(sparseEmailRes.location, '');
  assert.equal(sparseEmailRes.clientContact, '');
  assert.equal(sparseEmailRes.clientContactTitle, '');
  assert.equal(sparseEmailRes.targetBillRate, 0);
  assert.equal(sparseEmailRes.openPositions, 2);
  assert.equal(sparseEmailRes.opportunityTitle, 'Python Data Engineer');

  console.log('✅ Provider-Agnostic AI Adapter & Guardrail Tests: PASSED');
};
