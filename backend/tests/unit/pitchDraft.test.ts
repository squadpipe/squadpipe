import assert from 'node:assert/strict';
import { resolveAiConfig } from '../../src/config/ai.config';
import { AiService } from '../../src/services/ai/ai.service';
import {
  generatePitchDraftPure,
  normalizePitchPurpose,
  normalizePitchToneInput,
} from '../../src/services/pitchDraft.service';

function makeJsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const runPitchDraftTests = async () => {
  console.log('--- Running Rate-Safe Pitch Draft Tests ---');

  // 1. Purpose and tone normalization
  assert.equal(normalizePitchPurpose('client_pitch'), 'client_pitch');
  assert.equal(normalizePitchPurpose('interview_followup'), 'interview_followup');
  assert.equal(normalizePitchPurpose('followup'), 'interview_followup');
  assert.equal(normalizePitchToneInput('high_impact'), 'HIGH_IMPACT');
  assert.equal(normalizePitchToneInput('technical-focus'), 'TECHNICAL_FOCUS');
  assert.equal(normalizePitchToneInput('unknown'), 'PROFESSIONAL');

  const candidate = {
    id: 'cand-1',
    fullName: 'Meera Krishnan',
    currentTitle: 'Principal Snowflake Data Engineer',
    skillset: 'Snowflake, PySpark, Databricks, dbt, AWS',
    workAuth: 'Green Card',
    hourlyRateDisplay: '$98/hr (W2)',
    rawSnippet: 'Built Snowflake pipelines on AWS. Current rate expectation $98/hr.',
  };

  const requirement = {
    id: 'req-1',
    code: 'REQ-301',
    companyName: 'Apex Health',
    opportunityTitle: 'Principal Data Platform Engineer',
    location: 'Austin, TX',
    workModel: 'Hybrid',
    skillsRequired: 'Snowflake, PySpark, AWS, dbt',
    targetBillRate: 145,
    maxBillRate: 160,
    targetPayRate: 105,
    rawEmailText: 'Client bill budget $145/hr - $160/hr max.',
  };

  // 2. Non-AI offline template respects rateMasked=true and includes agency/recipient metadata
  const offlineAi = new AiService({
    getConfig: () => resolveAiConfig({ AI_PROVIDER: 'none' }),
  });

  const maskedOfflinePitch = await generatePitchDraftPure({
    submissionId: 'sub-1',
    candidate,
    requirement,
    agencyName: 'Softiox Partners',
    recipientEmail: 'hiring@apexhealth.com',
    recipientName: 'Maya Lin',
    purpose: 'client_pitch',
    pitchTone: 'PROFESSIONAL',
    rateMasked: true,
    aiSvc: offlineAi,
  });

  assert.equal(maskedOfflinePitch.aiUsed, false);
  assert.equal(maskedOfflinePitch.recipientEmail, 'hiring@apexhealth.com');
  assert.equal(maskedOfflinePitch.purpose, 'client_pitch');
  assert.ok(maskedOfflinePitch.subject.includes('Meera Krishnan'));
  assert.ok(maskedOfflinePitch.bodyText.includes('Softiox Partners'));
  assert.ok(maskedOfflinePitch.bodyText.includes('Snowflake'));
  assert.equal(maskedOfflinePitch.bodyText.includes('98'), false);
  assert.equal(maskedOfflinePitch.bodyText.includes('145'), false);

  const followUpOffline = await generatePitchDraftPure({
    submissionId: 'sub-1',
    candidate,
    requirement,
    agencyName: 'Softiox Partners',
    purpose: 'interview_followup',
    rateMasked: true,
    aiSvc: offlineAi,
  });
  assert.equal(followUpOffline.purpose, 'interview_followup');
  assert.ok(followUpOffline.subject.startsWith('Follow-Up:'));

  // 3. Unmasked offline pitch permits candidate hourlyRateDisplay
  const unmaskedOfflinePitch = await generatePitchDraftPure({
    submissionId: 'sub-1',
    candidate,
    requirement,
    agencyName: 'Softiox Partners',
    rateMasked: false,
    aiSvc: offlineAi,
  });
  assert.ok(unmaskedOfflinePitch.bodyText.includes('98'));

  // 4. Active AI draft + defense-in-depth scrubbing when rateMasked=true
  let seenPromptBody = '';
  const activeAi = new AiService({
    getConfig: () =>
      resolveAiConfig({
        AI_PROVIDER: 'openai',
        OPENAI_API_KEY: 'sk-test',
        AI_FALLBACK_TO_OFFLINE: 'true',
      }),
    fetchImpl: async (_url, init) => {
      seenPromptBody = String(init?.body || '');
      return makeJsonResponse({
        choices: [
          {
            message: {
              content: JSON.stringify({
                subject: 'Meera Krishnan — Principal Data Platform Engineer ($145/hr)',
                bodyText:
                  'Hi Maya,\n\nSharing Meera Krishnan for REQ-301. She brings deep Snowflake, PySpark, and dbt delivery experience on AWS at $98/hr.\n\nBest regards,\nSoftiox Partners',
              }),
            },
          },
        ],
      });
    },
  });

  const maskedAiPitch = await generatePitchDraftPure({
    submissionId: 'sub-1',
    candidate,
    requirement,
    agencyName: 'Softiox Partners',
    recipientEmail: 'maya@apexhealth.com',
    pitchTone: 'TECHNICAL_FOCUS',
    rateMasked: true,
    aiSvc: activeAi,
  });

  assert.equal(maskedAiPitch.aiUsed, true);
  assert.equal(maskedAiPitch.pitchTone, 'TECHNICAL_FOCUS');
  assert.equal(seenPromptBody.includes('145'), false);
  assert.equal(seenPromptBody.includes('160'), false);
  assert.equal(seenPromptBody.includes('105'), false);
  assert.equal(seenPromptBody.includes('98'), false);
  assert.equal(maskedAiPitch.subject.includes('145'), false);
  assert.equal(maskedAiPitch.bodyText.includes('98'), false);

  // 5. Fallback cleanly to structured template when AI call fails
  const failingAi = new AiService({
    getConfig: () =>
      resolveAiConfig({
        AI_PROVIDER: 'openai',
        OPENAI_API_KEY: 'sk-test',
        AI_FALLBACK_TO_OFFLINE: 'true',
      }),
    fetchImpl: async () => {
      throw new Error('Upstream error');
    },
  });

  const fallbackDraft = await generatePitchDraftPure({
    submissionId: 'sub-1',
    candidate,
    requirement,
    agencyName: 'Softiox Partners',
    rateMasked: true,
    aiSvc: failingAi,
  });
  assert.equal(fallbackDraft.aiUsed, false);
  assert.ok(fallbackDraft.bodyText.includes('Softiox Partners'));

  console.log('✅ Rate-Safe Pitch Draft Tests: PASSED');
};
