import assert from 'node:assert/strict';
import { resolveAiConfig } from '../../src/config/ai.config';
import {
  AiService,
  extractCleanRecipientGreeting,
  normalizeDisplayCandidateName,
  normalizePitchEmailSpacing,
} from '../../src/services/ai/ai.service';
import {
  buildPitchCacheKey,
  generatePitchDraftPure,
  normalizePitchPurpose,
  normalizePitchToneInput,
  selectOrGeneratePitchDraftPure,
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
  assert.ok(unmaskedOfflinePitch.bodyText.includes('$98/hr') || unmaskedOfflinePitch.bodyText.includes('98'));
  // Req code appears in subject, NEVER in bodyText
  assert.ok(unmaskedOfflinePitch.subject.includes('REQ-301'));
  assert.equal(unmaskedOfflinePitch.bodyText.includes('REQ-301'), false);
  assert.equal(followUpOffline.bodyText.includes('REQ-301'), false);
  // Bare numeric rate formats as $56/hr and duplicate (Onsite) • ONSITE is avoided
  const bareRateReqOffline = await generatePitchDraftPure({
    submissionId: 'sub-bare',
    candidate: { ...candidate, hourlyRateDisplay: '56' },
    requirement: { ...requirement, location: 'Phoenix, AZ (Onsite)', workModel: 'ONSITE' },
    agencyName: 'Softiox Partners',
    rateMasked: false,
    aiSvc: offlineAi,
  });
  assert.ok(bareRateReqOffline.bodyText.includes('Target Rate: $56/hr'));
  assert.equal(bareRateReqOffline.bodyText.includes('• ONSITE'), false);
  assert.equal(bareRateReqOffline.bodyText.includes('REQ-301'), false);

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
    recipientName: 'Maya Lin',
    pitchTone: 'TECHNICAL_FOCUS',
    rateMasked: true,
    aiSvc: activeAi,
  });

  assert.equal(maskedAiPitch.aiUsed, true);
  assert.equal(maskedAiPitch.pitchTone, 'TECHNICAL_FOCUS');
  assert.ok(seenPromptBody.includes('Maya Lin'));
  assert.ok(seenPromptBody.includes('THIRD PERSON'));
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

  // 6. Clean greeting (strips job title), clean underscore name, sender sign-off, scannable snapshot format
  assert.deepEqual(
    extractCleanRecipientGreeting('Robert "Bob" Miller, Senior Director of ERP Transformation'),
    { cleanName: 'Robert "Bob" Miller', greeting: 'Hi Robert,' }
  );
  assert.deepEqual(extractCleanRecipientGreeting('Maya Lin | VP Engineering'), {
    cleanName: 'Maya Lin',
    greeting: 'Hi Maya,',
  });
  assert.deepEqual(extractCleanRecipientGreeting(''), {
    cleanName: '',
    greeting: 'Hi Hiring Team,',
  });
  assert.equal(normalizeDisplayCandidateName('Chirag_Mehra'), 'Chirag Mehra');

  const formattedPitch = await generatePitchDraftPure({
    submissionId: 'sub-2',
    candidate: { ...candidate, fullName: 'Chirag_Mehra' },
    requirement,
    agencyName: 'Softiox Partners',
    senderName: 'Nakul Das',
    recipientName: 'Robert "Bob" Miller, Senior Director of ERP Transformation',
    purpose: 'client_pitch',
    pitchTone: 'PROFESSIONAL',
    rateMasked: true,
    aiSvc: offlineAi,
  });
  assert.equal(formattedPitch.subject.includes('Chirag_Mehra'), false);
  assert.ok(formattedPitch.subject.includes('Chirag Mehra'));
  assert.ok(formattedPitch.bodyText.startsWith('Hi Robert,'));
  assert.equal(formattedPitch.bodyText.includes('Senior Director of ERP Transformation'), false);
  assert.ok(formattedPitch.bodyText.includes('Candidate Snapshot:\n- Current Role:'));
  assert.ok(formattedPitch.bodyText.includes('Nakul Das\nSoftiox Partners'));
  assert.equal(formattedPitch.bodyText.includes('[Your Name]'), false);

  // 7. Scrubs [Your Name] placeholder from LLM output if model ignores signOffName instruction
  const placeholderScrubAi = new AiService({
    getConfig: () =>
      resolveAiConfig({
        AI_PROVIDER: 'openai',
        OPENAI_API_KEY: 'sk-test',
        AI_MODEL_SMART: 'gpt-4o-mini',
      }),
    fetchImpl: async () =>
      makeJsonResponse({
        choices: [
          {
            message: {
              content: JSON.stringify({
                subject: 'Candidate Submittal: Chirag Mehra',
                bodyText: 'Hi Robert,\n\nQuick summary.\n\nBest regards,\n[Your Name]',
              }),
            },
          },
        ],
      }),
  });
  const scrubbedAiDraft = await generatePitchDraftPure({
    submissionId: 'sub-2',
    candidate: { ...candidate, fullName: 'Chirag_Mehra' },
    requirement,
    agencyName: 'Softiox Partners',
    senderName: 'Nakul Das',
    recipientName: 'Robert "Bob" Miller, Senior Director of ERP Transformation',
    rateMasked: true,
    aiSvc: placeholderScrubAi,
  });
  assert.equal(scrubbedAiDraft.bodyText.includes('[Your Name]'), false);
  assert.ok(scrubbedAiDraft.bodyText.includes('Nakul Das'));

  // 8. Cache-first pitch resolution saves AI tokens across re-opens and isolates masked vs unmasked keys
  let draftCalls = 0;
  const countingAi = new AiService({
    getConfig: () =>
      resolveAiConfig({
        AI_PROVIDER: 'openai',
        OPENAI_API_KEY: 'sk-test',
        AI_MODEL_SMART: 'gpt-4o-mini',
      }),
    fetchImpl: async () => {
      draftCalls += 1;
      return makeJsonResponse({
        choices: [
          {
            message: {
              content: JSON.stringify({
                subject: `Submittal v${draftCalls}: Meera Krishnan`,
                bodyText: `Hi Maya,\n\nPitch body v${draftCalls}.\n\nBest regards,\nNakul Das`,
              }),
            },
          },
        ],
      });
    },
  });

  // Cache-only probe on uncached submission never calls AI and reports hasDraft: false
  const probeEmpty = await selectOrGeneratePitchDraftPure({
    submissionId: 'sub-cache-1',
    cacheOnly: true,
    candidate,
    requirement,
    agencyName: 'Softiox Partners',
    senderName: 'Nakul Das',
    recipientEmail: 'maya@apexhealth.com',
    recipientName: 'Maya Lin',
    purpose: 'client_pitch',
    pitchTone: 'PROFESSIONAL',
    rateMasked: true,
    aiSvc: countingAi,
  });
  assert.equal(draftCalls, 0);
  assert.equal(probeEmpty.didGenerate, false);
  assert.equal(probeEmpty.draft.hasDraft, false);
  assert.deepEqual(probeEmpty.draft.savedDraftKeys, []);
  assert.equal(probeEmpty.draft.recipientEmail, 'maya@apexhealth.com');

  const firstRun = await selectOrGeneratePitchDraftPure({
    submissionId: 'sub-cache-1',
    candidate,
    requirement,
    agencyName: 'Softiox Partners',
    senderName: 'Nakul Das',
    recipientName: 'Maya Lin',
    purpose: 'client_pitch',
    pitchTone: 'PROFESSIONAL',
    rateMasked: true,
    aiSvc: countingAi,
  });
  assert.equal(draftCalls, 1);
  assert.equal(firstRun.didGenerate, true);
  assert.equal(firstRun.draft.cached, false);
  assert.ok(firstRun.nextCache[buildPitchCacheKey('client_pitch', 'PROFESSIONAL', true)]);

  // Switching Type & Tone with cacheOnly=true does not generate if slot is uncached
  const probeUncachedSwitch = await selectOrGeneratePitchDraftPure({
    submissionId: 'sub-cache-1',
    existingCache: firstRun.nextCache,
    cacheOnly: true,
    candidate,
    requirement,
    agencyName: 'Softiox Partners',
    senderName: 'Nakul Das',
    recipientName: 'Maya Lin',
    purpose: 'interview_followup',
    pitchTone: 'HIGH_IMPACT',
    rateMasked: true,
    aiSvc: countingAi,
  });
  assert.equal(draftCalls, 1);
  assert.equal(probeUncachedSwitch.didGenerate, false);
  assert.equal(probeUncachedSwitch.draft.hasDraft, false);
  assert.deepEqual(probeUncachedSwitch.draft.savedDraftKeys, ['client_pitch:PROFESSIONAL']);

  // Re-opening or switching back hits saved draft with 0 LLM calls
  const secondRun = await selectOrGeneratePitchDraftPure({
    submissionId: 'sub-cache-1',
    existingCache: firstRun.nextCache,
    candidate,
    requirement,
    agencyName: 'Softiox Partners',
    senderName: 'Nakul Das',
    recipientName: 'Maya Lin',
    purpose: 'client_pitch',
    pitchTone: 'PROFESSIONAL',
    rateMasked: true,
    aiSvc: countingAi,
  });
  assert.equal(draftCalls, 1);
  assert.equal(secondRun.didGenerate, false);
  assert.equal(secondRun.draft.cached, true);
  assert.equal(secondRun.draft.subject, firstRun.draft.subject);

  // Explicit Regenerate refreshes the saved cache entry
  const regenRun = await selectOrGeneratePitchDraftPure({
    submissionId: 'sub-cache-1',
    existingCache: secondRun.nextCache,
    forceRegenerate: true,
    candidate,
    requirement,
    agencyName: 'Softiox Partners',
    senderName: 'Nakul Das',
    recipientName: 'Maya Lin',
    purpose: 'client_pitch',
    pitchTone: 'PROFESSIONAL',
    rateMasked: true,
    aiSvc: countingAi,
  });
  assert.equal(draftCalls, 2);
  assert.equal(regenRun.didGenerate, true);
  assert.equal(regenRun.draft.cached, false);
  assert.ok(regenRun.draft.subject.includes('v2'));

  // Masked vs unmasked rates use isolated cache slots so unmasked never leaks to masked users
  const unmaskedRun = await selectOrGeneratePitchDraftPure({
    submissionId: 'sub-cache-1',
    existingCache: regenRun.nextCache,
    candidate,
    requirement,
    agencyName: 'Softiox Partners',
    senderName: 'Nakul Das',
    recipientName: 'Maya Lin',
    purpose: 'client_pitch',
    pitchTone: 'PROFESSIONAL',
    rateMasked: false,
    aiSvc: countingAi,
  });
  assert.equal(draftCalls, 3);
  assert.equal(unmaskedRun.didGenerate, true);
  assert.ok(unmaskedRun.nextCache[buildPitchCacheKey('client_pitch', 'PROFESSIONAL', true)]);
  assert.ok(unmaskedRun.nextCache[buildPitchCacheKey('client_pitch', 'PROFESSIONAL', false)]);

  // 9. Enforces clean blank lines around greeting, snapshot bullets, paragraphs, and closing signature
  const crampedAiBody = [
    'Hi Robert,',
    'We are excited to submit Ashwin Raman for the Lead SAP S/4HANA FICO role (REQ-1002).',
    'Candidate Snapshot:',
    '• 9+ years of IT experience in cloud networking and architecture',
    '* Skilled in AWS, Azure, Terraform, and Python',
    'Ashwin Raman brings strong client-facing consulting skills and integration leadership.',
    'Please let us schedule an interview with Ashwin Raman at your earliest convenience.',
    'Best regards,',
    'Nakul Das',
    'Softiox Partners',
  ].join('\n');

  const spacedExpected = [
    'Hi Robert,',
    '',
    'We are excited to submit Ashwin Raman for the Lead SAP S/4HANA FICO role (REQ-1002).',
    '',
    'Candidate Snapshot:',
    '- 9+ years of IT experience in cloud networking and architecture',
    '- Skilled in AWS, Azure, Terraform, and Python',
    '',
    'Ashwin Raman brings strong client-facing consulting skills and integration leadership.',
    '',
    'Please let us schedule an interview with Ashwin Raman at your earliest convenience.',
    '',
    'Best regards,',
    'Nakul Das',
    'Softiox Partners',
  ].join('\n');

  assert.equal(normalizePitchEmailSpacing(crampedAiBody), spacedExpected);
  assert.equal(normalizePitchEmailSpacing(spacedExpected), spacedExpected);

  // Also auto-heals cramped unedited cached drafts on read with zero LLM calls, while leaving manual edits untouched
  const legacyKey = buildPitchCacheKey('client_pitch', 'TECHNICAL_FOCUS', true);
  const legacyHealed = await selectOrGeneratePitchDraftPure({
    submissionId: 'sub-cache-heal',
    existingCache: {
      [legacyKey]: {
        subject: 'Submittal: Ashwin Raman',
        bodyText: crampedAiBody,
        aiUsed: true,
        purpose: 'client_pitch',
        pitchTone: 'TECHNICAL_FOCUS',
        generatedAt: '2026-11-19T10:00:00.000Z',
      },
    },
    candidate,
    requirement,
    agencyName: 'Softiox Partners',
    purpose: 'client_pitch',
    pitchTone: 'TECHNICAL_FOCUS',
    rateMasked: true,
    aiSvc: countingAi,
  });
  assert.equal(draftCalls, 3);
  assert.equal(legacyHealed.didGenerate, false);
  assert.equal(legacyHealed.draft.bodyText, spacedExpected);

  const manualPreserved = await selectOrGeneratePitchDraftPure({
    submissionId: 'sub-cache-manual',
    existingCache: {
      [legacyKey]: {
        subject: 'Custom Subject',
        bodyText: 'Hi Robert,\nCustom manual compact line',
        aiUsed: true,
        manuallyEdited: true,
        purpose: 'client_pitch',
        pitchTone: 'TECHNICAL_FOCUS',
        generatedAt: '2026-11-19T10:00:00.000Z',
      },
    },
    candidate,
    requirement,
    agencyName: 'Softiox Partners',
    purpose: 'client_pitch',
    pitchTone: 'TECHNICAL_FOCUS',
    rateMasked: true,
    aiSvc: countingAi,
  });
  assert.equal(manualPreserved.draft.bodyText, 'Hi Robert,\nCustom manual compact line');

  console.log('✅ Rate-Safe Pitch Draft Tests: PASSED');
};
