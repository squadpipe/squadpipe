import assert from 'node:assert/strict';
import { resolveAiConfig } from '../../src/config/ai.config';
import { AiService } from '../../src/services/ai/ai.service';
import {
  applyTenantByoOverridePure,
  evaluateQuotaStatusPure,
  getUtcMonthStart,
  maskApiKeyHint,
  mergePlatformEntitlementPure,
  mergeTenantAiConfigPure,
  resolveEffectiveQuotaCeilingPure,
  sanitizeStoredTenantAiConfig,
} from '../../src/services/ai/aiUsage.service';
import { verifyPlatformAdminSecretPure } from '../../src/middlewares/auth.middleware';
import { encryptSecret } from '../../src/utils/cryptoSecret';

function makeJsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const runAiUsageTests = async () => {
  console.log('--- Running AI Usage Metering, Quota & BYO Key Tests ---');

  // 1. Month boundary helper & masked hint formatting
  const monthStart = getUtcMonthStart(new Date('2026-11-19T14:22:00Z'));
  assert.equal(monthStart.toISOString(), '2026-11-01T00:00:00.000Z');
  assert.equal(maskApiKeyHint('sk-proj-secret1234abcd'), 'sk-••••abcd');
  assert.equal(maskApiKeyHint('short'), '••••••••');

  // 2. Quota evaluation thresholds (unlimited, action cap, token cap)
  const unlimited = evaluateQuotaStatusPure({
    actionsUsed: 5000,
    tokensUsed: 9000000,
    actionLimit: 0,
    tokenLimit: 0,
  });
  assert.equal(unlimited.exceeded, false);

  const actionExceeded = evaluateQuotaStatusPure({
    actionsUsed: 100,
    tokensUsed: 5000,
    actionLimit: 100,
    tokenLimit: 0,
  });
  assert.equal(actionExceeded.exceeded, true);
  assert.ok(actionExceeded.reason?.includes('100/100'));

  const tokenExceeded = evaluateQuotaStatusPure({
    actionsUsed: 12,
    tokensUsed: 250000,
    actionLimit: 500,
    tokenLimit: 200000,
  });
  assert.equal(tokenExceeded.exceeded, true);
  assert.ok(tokenExceeded.reason?.includes('250000/200000'));

  // 3. BYO Key encryption, sanitization & AI_ALLOW_BYO_KEY enforcement
  const encryptedAnthropicKey = encryptSecret('sk-ant-secret-9988');
  const storedByo = {
    byoEnabled: true,
    byoProvider: 'anthropic' as const,
    byoApiKeyEncrypted: encryptedAnthropicKey,
    maskedKeyHint: maskApiKeyHint('sk-ant-secret-9988'),
    monthlyActionLimit: 250,
    monthlyTokenLimit: null,
  };

  const sanitized = sanitizeStoredTenantAiConfig(storedByo);
  const sanitizedJson = JSON.stringify(sanitized);
  assert.equal(sanitized.hasApiKey, true);
  assert.equal(sanitized.maskedKeyHint, 'sk-••••9988');
  assert.equal(sanitizedJson.includes('sk-ant-secret-9988'), false);
  assert.equal(sanitizedJson.includes(encryptedAnthropicKey), false);
  assert.equal(Object.prototype.hasOwnProperty.call(sanitized, 'byoApiKeyEncrypted'), false);

  const disallowedBase = resolveAiConfig({ AI_PROVIDER: 'none', AI_ALLOW_BYO_KEY: 'false' });
  const ignoredByo = applyTenantByoOverridePure(disallowedBase, storedByo);
  assert.equal(ignoredByo.usingByoKey, false);
  assert.equal(ignoredByo.config.configured, false);
  assert.equal(ignoredByo.config.monthlyActionLimit, 250);

  const allowedBase = resolveAiConfig({ AI_PROVIDER: 'none', AI_ALLOW_BYO_KEY: 'true' });
  const activeByo = applyTenantByoOverridePure(allowedBase, storedByo);
  assert.equal(activeByo.usingByoKey, true);
  assert.equal(activeByo.config.configured, true);
  assert.equal(activeByo.config.provider, 'anthropic');
  assert.equal(activeByo.config.credentials.anthropicApiKey, 'sk-ant-secret-9988');

  // 4. AiService records metered token usage on success & degrades gracefully on quota limit
  const recordedEntries: Array<Record<string, any>> = [];
  const meteredService = new AiService({
    getConfig: () => resolveAiConfig({ AI_PROVIDER: 'openai', OPENAI_API_KEY: 'sk-test' }),
    checkQuota: async () => ({
      exceeded: false,
      actionsUsed: 5,
      tokensUsed: 1000,
      actionLimit: 100,
      tokenLimit: 0,
    }),
    recordUsage: async (entry) => {
      recordedEntries.push(entry);
    },
    fetchImpl: async () =>
      makeJsonResponse({
        model: 'gpt-4.1-mini',
        choices: [
          {
            message: {
              content: JSON.stringify({
                subject: 'Candidate Profile: Maya',
                bodyText: 'Hi,\n\nSharing Maya for the Lead Cloud role.\n\nBest regards,\nApex Staffing',
              }),
            },
          },
        ],
        usage: { prompt_tokens: 120, completion_tokens: 45 },
      }),
  });

  const meteredPitch = await meteredService.draftClientPitch(
    { id: 'c1', fullName: 'Maya', currentTitle: 'Cloud Architect', skillset: 'AWS, Terraform' },
    { opportunityTitle: 'Lead Cloud Architect' },
    { tenantId: 'tenant-1', userId: 'usr-9', agencyName: 'Apex Staffing' }
  );
  assert.equal(meteredPitch.aiUsed, true);
  assert.equal(recordedEntries.length, 1);
  assert.equal(recordedEntries[0].tenantId, 'tenant-1');
  assert.equal(recordedEntries[0].userId, 'usr-9');
  assert.equal(recordedEntries[0].feature, 'pitch_draft');
  assert.equal(recordedEntries[0].inputTokens, 120);
  assert.equal(recordedEntries[0].outputTokens, 45);

  let llmCalledAfterLimit = false;
  const quotaBlockedService = new AiService({
    getConfig: () => resolveAiConfig({ AI_PROVIDER: 'openai', OPENAI_API_KEY: 'sk-test' }),
    checkQuota: async () => ({
      exceeded: true,
      reason: 'Monthly AI action quota reached (100/100). Falling back to offline mode.',
      actionsUsed: 100,
      tokensUsed: 12000,
      actionLimit: 100,
      tokenLimit: 0,
    }),
    fetchImpl: async () => {
      llmCalledAfterLimit = true;
      return makeJsonResponse({});
    },
  });

  const quotaFallbackPitch = await quotaBlockedService.draftClientPitch(
    { id: 'c1', fullName: 'Maya', currentTitle: 'Cloud Architect', skillset: 'AWS, Terraform' },
    { opportunityTitle: 'Lead Cloud Architect' },
    { tenantId: 'tenant-1', agencyName: 'Apex Staffing' }
  );
  assert.equal(llmCalledAfterLimit, false);
  assert.equal(quotaFallbackPitch.aiUsed, false);
  assert.ok(quotaFallbackPitch.quotaNotice?.includes('100/100'));
  assert.ok(quotaFallbackPitch.bodyText.includes('Apex Staffing'));

  // 5. Multi-tenant SaaS / White-Label / On-Prem Plan Entitlements vs Tenant Self-Caps
  assert.equal(resolveEffectiveQuotaCeilingPure(0, 0, false), 0);
  assert.equal(resolveEffectiveQuotaCeilingPure(100, 999999, false), 100);
  assert.equal(resolveEffectiveQuotaCeilingPure(2500, 500, false), 500);
  assert.equal(resolveEffectiveQuotaCeilingPure(100, 0, true), 0);
  assert.equal(resolveEffectiveQuotaCeilingPure(100, 300, true), 300);

  const saasServerBase = resolveAiConfig({
    AI_PROVIDER: 'openai',
    OPENAI_API_KEY: 'sk-platform-shared',
    AI_MONTHLY_ACTION_LIMIT: '100',
    AI_ALLOW_BYO_KEY: 'false',
  });

  // 5a. Starter tenant tries to raise quota & inject forged platformEntitlement
  const starterStored = mergeTenantAiConfigPure(
    { byoEnabled: false },
    {
      monthlyActionLimit: 999999,
      platformEntitlement: { monthlyActionLimit: 0, allowByoKey: true },
    } as any,
    saasServerBase
  );
  assert.equal(starterStored.platformEntitlement, undefined);
  assert.equal(starterStored.selfActionLimit, 999999);
  const starterEffective = applyTenantByoOverridePure(saasServerBase, starterStored);
  assert.equal(starterEffective.config.monthlyActionLimit, 100);
  assert.equal(starterEffective.planActionLimit, 100);
  assert.equal(starterEffective.usingByoKey, false);

  assert.throws(
    () =>
      mergeTenantAiConfigPure(
        { byoEnabled: false },
        { byoEnabled: true, byoProvider: 'openai', apiKey: 'sk-user-key' },
        saasServerBase
      ),
    /disabled/i
  );

  // 5b. Platform unlocks Enterprise unlimited (`0`) + BYO Key per-tenant even when .env defaults are 100 / false
  const enterpriseEntitled = mergePlatformEntitlementPure(
    { byoEnabled: false, selfActionLimit: 2000 },
    {
      planTier: 'enterprise',
      monthlyActionLimit: 0,
      allowByoKey: true,
    }
  );
  const entWithByoKey = mergeTenantAiConfigPure(
    enterpriseEntitled,
    {
      byoEnabled: true,
      byoProvider: 'anthropic',
      apiKey: 'sk-ant-customer-key-1234',
      selfActionLimit: null,
    },
    saasServerBase
  );
  assert.equal(entWithByoKey.platformEntitlement?.planTier, 'enterprise');
  assert.equal(entWithByoKey.platformEntitlement?.monthlyActionLimit, 0);
  assert.equal(entWithByoKey.platformEntitlement?.allowByoKey, true);

  const enterpriseEffective = applyTenantByoOverridePure(saasServerBase, entWithByoKey);
  assert.equal(enterpriseEffective.usingByoKey, true);
  assert.equal(enterpriseEffective.config.provider, 'anthropic');
  assert.equal(enterpriseEffective.config.monthlyActionLimit, 0);
  assert.equal(enterpriseEffective.planActionLimit, 0);

  // 5c. Platform update preserves existing tenant BYO key & disables AI cleanly when suspended (`aiEnabled: false`)
  const suspendedTenant = mergePlatformEntitlementPure(entWithByoKey, {
    planTier: 'free',
    aiEnabled: false,
  });
  assert.equal(suspendedTenant.byoApiKeyEncrypted, entWithByoKey.byoApiKeyEncrypted);
  const suspendedEffective = applyTenantByoOverridePure(saasServerBase, suspendedTenant);
  assert.equal(suspendedEffective.aiDisabledByPlan, true);
  assert.equal(suspendedEffective.config.configured, false);
  assert.equal(suspendedEffective.config.provider, 'none');
  assert.equal(suspendedEffective.usingByoKey, false);

  // 5d. On-Prem multi-tenant default (`AI_MONTHLY_ACTION_LIMIT=0`) stays unlimited with optional dept self-cap
  const onPremBase = resolveAiConfig({
    AI_PROVIDER: 'openai',
    OPENAI_API_KEY: 'sk-onprem',
    AI_MONTHLY_ACTION_LIMIT: '0',
  });
  assert.equal(applyTenantByoOverridePure(onPremBase, { byoEnabled: false }).config.monthlyActionLimit, 0);
  assert.equal(
    applyTenantByoOverridePure(onPremBase, { byoEnabled: false, selfActionLimit: 400 }).config
      .monthlyActionLimit,
    400
  );

  // 5e. Platform Admin secret fails closed when missing/short & verifies timing-safely
  assert.equal(verifyPlatformAdminSecretPure('', 'anything').statusCode, 503);
  assert.equal(verifyPlatformAdminSecretPure('too-short', 'too-short').statusCode, 503);
  const validSecret = 'platform_admin_secret_at_least_32_chars_long';
  assert.equal(verifyPlatformAdminSecretPure(validSecret, '').statusCode, 401);
  assert.equal(verifyPlatformAdminSecretPure(validSecret, 'wrong_secret_value').statusCode, 403);
  assert.equal(verifyPlatformAdminSecretPure(validSecret, validSecret).authorized, true);

  console.log('✅ AI Usage Metering, Quota & BYO Key Tests: PASSED');
};
