import assert from 'node:assert/strict';
import { resolveAiConfig } from '../../src/config/ai.config';
import { AiService } from '../../src/services/ai/ai.service';
import {
  DEFAULT_SAAS_PLANS,
  aiUsageService,
  applyTenantEntitlementAndByoPure,
  evaluateCreditQuotaPure,
  getUtcMonthStart,
  getUtcNextMonthStart,
  maskApiKeyHint,
  mergeTenantAiConfigPure,
  resolveTenantPlanEntitlementPure,
  sanitizeStoredTenantAiConfig,
  type TenantSubscriptionSnapshot,
} from '../../src/services/ai/aiUsage.service';
import { prisma } from '../../src/config/prisma.config';
import { verifyPlatformAdminSecretPure } from '../../src/middlewares/auth.middleware';
import { encryptSecret } from '../../src/utils/cryptoSecret';

function makeJsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const runAiUsageTests = async () => {
  console.log('--- Running AI Plan, Purchased Credits & Metering Tests ---');

  // 1. Month boundary helper & masked hint formatting
  const monthStart = getUtcMonthStart(new Date('2026-11-19T14:22:00Z'));
  assert.equal(monthStart.toISOString(), '2026-11-01T00:00:00.000Z');
  assert.equal(
    getUtcNextMonthStart(new Date('2026-11-19T14:22:00Z')).toISOString(),
    '2026-12-01T00:00:00.000Z'
  );
  assert.equal(
    getUtcNextMonthStart(new Date('2026-12-19T14:22:00Z')).toISOString(),
    '2027-01-01T00:00:00.000Z'
  );
  assert.equal(maskApiKeyHint('sk-proj-secret1234abcd'), 'sk-••••abcd');
  assert.equal(maskApiKeyHint('short'), '••••••••');

  // 2. Seeded plan catalog & database entitlement resolution (no .env quota fallback)
  const rawBaseConfig = resolveAiConfig({ AI_PROVIDER: 'openai', OPENAI_API_KEY: 'sk-test' });
  assert.equal('monthlyActionLimit' in rawBaseConfig, false);
  assert.equal('monthlyTokenLimit' in rawBaseConfig, false);

  const defaultFreeEnt = resolveTenantPlanEntitlementPure(rawBaseConfig, null);
  assert.equal(defaultFreeEnt.planCode, 'free');
  assert.equal(defaultFreeEnt.planName, 'Free Trial');
  assert.equal(defaultFreeEnt.monthlyPlanCredits, 100);
  assert.equal(defaultFreeEnt.isCustomPlan, false);
  assert.equal(defaultFreeEnt.purchasedCreditsBalance, 0);

  const customSub: TenantSubscriptionSnapshot = {
    aiEnabled: true,
    customPlanName: 'Apex Custom',
    customMonthlyCredits: 3500,
    customAllowByoKey: true,
    customActionCenterAgent: true,
    purchasedCreditsBalance: 450,
    purchasedCreditsTotal: 500,
    plan: {
      code: 'custom',
      name: 'Custom Plan',
      monthlyAiCredits: 0,
      aiEnabled: true,
      allowByoKey: true,
      actionCenterAgentEnabled: true,
      isCustom: true,
    },
  };
  const customEnt = resolveTenantPlanEntitlementPure(rawBaseConfig, customSub);
  assert.equal(customEnt.planCode, 'custom');
  assert.equal(customEnt.planName, 'Apex Custom');
  assert.equal(customEnt.monthlyPlanCredits, 3500);
  assert.equal(customEnt.isCustomPlan, true);
  assert.equal(customEnt.purchasedCreditsBalance, 450);

  // 3. Quota evaluation with plan credits + persistent add-on purchased credits
  const unlimitedQuota = evaluateCreditQuotaPure({
    planCreditsUsed: 5000,
    totalCreditsUsedThisMonth: 5000,
    planCreditsLimit: 0,
    purchasedCreditsBalance: 0,
    usingByoKey: false,
    aiEnabled: true,
  });
  assert.equal(unlimitedQuota.exceeded, false);
  assert.equal(unlimitedQuota.totalCreditsRemaining, null);

  const freeExhaustedQuota = evaluateCreditQuotaPure({
    planCreditsUsed: 100,
    totalCreditsUsedThisMonth: 100,
    planCreditsLimit: 100,
    purchasedCreditsBalance: 0,
    usingByoKey: false,
    aiEnabled: true,
  });
  assert.equal(freeExhaustedQuota.exceeded, true);
  assert.equal(freeExhaustedQuota.totalCreditsRemaining, 0);
  assert.ok(freeExhaustedQuota.reason?.includes('buy AI credits'));

  // Historical overage (e.g., 268 prior logs on Free=100) still allows spending newly bought credits
  const topUpAvailableQuota = evaluateCreditQuotaPure({
    planCreditsUsed: 268,
    totalCreditsUsedThisMonth: 268,
    planCreditsLimit: 100,
    purchasedCreditsBalance: 500,
    usingByoKey: false,
    aiEnabled: true,
  });
  assert.equal(topUpAvailableQuota.exceeded, false);
  assert.equal(topUpAvailableQuota.planCreditsRemaining, 0);
  assert.equal(topUpAvailableQuota.purchasedCreditsRemaining, 500);
  assert.equal(topUpAvailableQuota.totalCreditsRemaining, 500);

  const disabledQuota = evaluateCreditQuotaPure({
    planCreditsUsed: 0,
    totalCreditsUsedThisMonth: 0,
    planCreditsLimit: 100,
    purchasedCreditsBalance: 999,
    usingByoKey: false,
    aiEnabled: false,
  });
  assert.equal(disabledQuota.exceeded, true);

  // 4. BYO Key encryption, sanitization & plan-controlled BYO enforcement
  const encryptedAnthropicKey = encryptSecret('sk-ant-secret-9988');
  const storedByo = {
    byoEnabled: true,
    byoProvider: 'anthropic' as const,
    byoApiKeyEncrypted: encryptedAnthropicKey,
    maskedKeyHint: maskApiKeyHint('sk-ant-secret-9988'),
  };

  const sanitized = sanitizeStoredTenantAiConfig(storedByo);
  const sanitizedJson = JSON.stringify(sanitized);
  assert.equal(sanitized.hasApiKey, true);
  assert.equal(sanitized.maskedKeyHint, 'sk-••••9988');
  assert.equal(sanitizedJson.includes('sk-ant-secret-9988'), false);
  assert.equal(sanitizedJson.includes(encryptedAnthropicKey), false);
  assert.equal(Object.prototype.hasOwnProperty.call(sanitized, 'byoApiKeyEncrypted'), false);

  const disallowedBase = resolveAiConfig({ AI_PROVIDER: 'none', AI_ALLOW_BYO_KEY: 'false' });
  const ignoredByo = applyTenantEntitlementAndByoPure(
    disallowedBase,
    resolveTenantPlanEntitlementPure(disallowedBase, null),
    storedByo
  );
  assert.equal(ignoredByo.usingByoKey, false);
  assert.equal(ignoredByo.config.configured, false);

  const enterpriseEnt = resolveTenantPlanEntitlementPure(disallowedBase, {
    aiEnabled: true,
    purchasedCreditsBalance: 0,
    purchasedCreditsTotal: 0,
    plan: DEFAULT_SAAS_PLANS[3],
  });
  const activeByo = applyTenantEntitlementAndByoPure(disallowedBase, enterpriseEnt, storedByo);
  assert.equal(activeByo.usingByoKey, true);
  assert.equal(activeByo.config.configured, true);
  assert.equal(activeByo.config.provider, 'anthropic');
  assert.equal(activeByo.config.credentials.anthropicApiKey, 'sk-ant-secret-9988');

  assert.throws(
    () =>
      mergeTenantAiConfigPure(
        { byoEnabled: false },
        { byoEnabled: true, byoProvider: 'openai', apiKey: 'sk-user-key' },
        defaultFreeEnt
      ),
    /disabled/i
  );

  // 5. AiService records metered usage & degrades gracefully on exhausted credits
  const recordedEntries: Array<Record<string, any>> = [];
  const meteredService = new AiService({
    getConfig: () => resolveAiConfig({ AI_PROVIDER: 'openai', OPENAI_API_KEY: 'sk-test' }),
    checkQuota: async () => ({
      exceeded: false,
      planCreditsUsed: 5,
      totalCreditsUsedThisMonth: 5,
      planCreditsLimit: 100,
      planCreditsRemaining: 95,
      purchasedCreditsRemaining: 0,
      totalCreditsRemaining: 95,
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

  let llmCalledAfterLimit = false;
  const quotaBlockedService = new AiService({
    getConfig: () => resolveAiConfig({ AI_PROVIDER: 'openai', OPENAI_API_KEY: 'sk-test' }),
    checkQuota: async () => ({
      exceeded: true,
      reason: 'Monthly SquadAI credits exhausted (0 remaining). Using standard matching mode.',
      planCreditsUsed: 100,
      totalCreditsUsedThisMonth: 100,
      planCreditsLimit: 100,
      planCreditsRemaining: 0,
      purchasedCreditsRemaining: 0,
      totalCreditsRemaining: 0,
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
  assert.ok(quotaFallbackPitch.quotaNotice?.includes('exhausted'));

  // 6. Signup Free Plan Attachment, Add-on Credit Deduction & Monthly Summary Privacy
  const origTenantFind = prisma.tenantSettings.findUnique;
  const origPlanCreateMany = prisma.subscriptionPlan.createMany;
  const origPlanFindUnique = prisma.subscriptionPlan.findUnique;
  const origPlanFindMany = prisma.subscriptionPlan.findMany;
  const origSubFindUnique = prisma.tenantSubscription.findUnique;
  const origSubUpsert = prisma.tenantSubscription.upsert;
  const origLogCount = prisma.aiUsageLog.count;
  const origLogGroupBy = prisma.aiUsageLog.groupBy;
  const origLogFindMany = prisma.aiUsageLog.findMany;
  const origPurchaseFindMany = prisma.aiCreditPurchase.findMany;
  const origUserFindMany = prisma.user.findMany;
  const origTransaction = prisma.$transaction;

  const savedEnv = {
    AI_PROVIDER: process.env.AI_PROVIDER,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  };

  try {
    process.env.AI_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = 'sk-test-credits-summary';

    let attachedPlanId: string | null = null;
    (prisma.subscriptionPlan as any).createMany = async () => ({ count: 5 });
    (prisma.subscriptionPlan as any).findUnique = async ({ where }: any) =>
      where?.code === 'free' ? { id: 'plan_free', code: 'free', name: 'Free Trial' } : null;
    (prisma.tenantSubscription as any).findUnique = async () => null;
    (prisma.tenantSubscription as any).upsert = async ({ create }: any) => {
      attachedPlanId = create.planId;
      return { id: 'sub-new', ...create };
    };

    await aiUsageService.attachDefaultFreePlan('new-signup-tenant');
    assert.equal(attachedPlanId, 'plan_free');

    // Test recordUsage debits purchased credits ONLY once monthly plan credits are exhausted
    let txPurchasedBalance = 10;
    const createdLogs: Array<Record<string, any>> = [];
    (prisma.tenantSettings as any).findUnique = async () => null;
    (prisma.tenantSubscription as any).findUnique = async () => ({
      id: 'sub-1',
      tenantId: 'tenant-credits-test',
      aiEnabled: true,
      customPlanName: null,
      customMonthlyCredits: null,
      customAllowByoKey: null,
      customActionCenterAgent: null,
      purchasedCreditsBalance: txPurchasedBalance,
      purchasedCreditsTotal: 500,
      plan: DEFAULT_SAAS_PLANS[0],
    });
    (prisma as any).$transaction = async (fn: (tx: any) => Promise<any>) => {
      const txProxy = {
        aiUsageLog: {
          count: async () => 100, // Free plan limit of 100 reached
          create: async ({ data }: any) => {
            createdLogs.push(data);
            return { id: 'log-created', ...data };
          },
        },
        tenantSubscription: {
          updateMany: async () => {
            txPurchasedBalance -= 1;
            return { count: 1 };
          },
        },
      };
      return fn(txProxy);
    };

    await aiUsageService.recordUsage({
      tenantId: 'tenant-credits-test',
      userId: 'user-1',
      provider: 'openai',
      model: 'gpt-4o-mini',
      feature: 'capability_check',
      inputTokens: 500,
      outputTokens: 120,
      latencyMs: 310,
    });
    assert.equal(txPurchasedBalance, 9);
    assert.equal(createdLogs.length, 1);
    assert.equal(createdLogs[0].creditSource, 'purchased');

    // Test getMonthlyUsageSummary combines Free plan + purchased wallet + redacts model/tokens
    (prisma.subscriptionPlan as any).findMany = async () => DEFAULT_SAAS_PLANS;
    (prisma.aiUsageLog as any).count = async ({ where }: any) =>
      where?.creditSource === 'plan' ? 100 : 102;
    (prisma.aiUsageLog as any).groupBy = async () => [
      { feature: 'resume_parse', creditSource: 'plan', _count: { _all: 100 } },
      { feature: 'match_rank', creditSource: 'purchased', _count: { _all: 2 } },
    ];
    (prisma.aiUsageLog as any).findMany = async () => [
      {
        id: 'log-1',
        feature: 'match_rank',
        creditSource: 'purchased',
        userId: 'user-1',
        latencyMs: 410,
        createdAt: new Date('2026-11-19T12:00:00.000Z'),
      },
      {
        id: 'log-2',
        feature: 'resume_parse',
        creditSource: 'plan',
        userId: null,
        latencyMs: 280,
        createdAt: new Date('2026-11-19T11:30:00.000Z'),
      },
    ];
    (prisma.aiCreditPurchase as any).findMany = async () => [
      {
        id: 'pur-1',
        creditsAdded: 500,
        source: 'PURCHASE',
        referenceId: 'inv_123',
        notes: '500 Credit Top-Up Pack',
        createdAt: new Date('2026-11-18T09:00:00.000Z'),
      },
    ];
    (prisma.user as any).findMany = async () => [
      { id: 'user-1', fullName: 'Priya Sharma', email: 'priya@agency.com' },
    ];

    const summary = await aiUsageService.getMonthlyUsageSummary('tenant-credits-test');
    assert.equal(summary.plan.code, 'free');
    assert.equal(summary.plan.name, 'Free Trial');
    assert.equal(summary.availablePlans.length, 3); // Free, Starter, Growth only (Enterprise & Custom are custom-only)
    assert.deepEqual(
      summary.availablePlans.map((p) => p.code),
      ['free', 'starter', 'growth']
    );
    assert.equal(summary.creditsUsed, 102);
    assert.equal(summary.planCreditsUsed, 100);
    assert.equal(summary.purchasedCreditsUsedThisMonth, 2);
    assert.equal(summary.creditLimit, 100);
    assert.equal(summary.planCreditsRemaining, 0);
    assert.equal(summary.purchasedCreditsRemaining, 9);
    assert.equal(summary.purchasedCreditsTotal, 500);
    assert.equal(summary.totalCreditsRemaining, 9);
    assert.equal(summary.creditsRemaining, 9);
    assert.equal(summary.quotaExceeded, false);
    assert.equal(summary.purchaseHistory.length, 1);
    assert.equal(summary.purchaseHistory[0].creditsAdded, 500);
    assert.equal(summary.creditHistory[0].creditSource, 'purchased');
    assert.equal(summary.creditHistory[0].userName, 'Priya Sharma');
    assert.equal(summary.creditHistory[1].userName, 'Workspace User');

    const rawSummary = summary as unknown as Record<string, unknown>;
    for (const forbiddenKey of [
      'byModel',
      'tokensUsed',
      'inputTokens',
      'outputTokens',
      'tokenLimit',
      'planTokenLimit',
      'activeProvider',
    ]) {
      assert.equal(forbiddenKey in rawSummary, false, `Unexpected key in summary: ${forbiddenKey}`);
    }
    const rawHistoryRow = summary.creditHistory[0] as unknown as Record<string, unknown>;
    for (const forbiddenKey of ['model', 'provider', 'inputTokens', 'outputTokens', 'tokensUsed']) {
      assert.equal(
        forbiddenKey in rawHistoryRow,
        false,
        `Unexpected key in creditHistory item: ${forbiddenKey}`
      );
    }
  } finally {
    prisma.tenantSettings.findUnique = origTenantFind;
    prisma.subscriptionPlan.createMany = origPlanCreateMany;
    prisma.subscriptionPlan.findUnique = origPlanFindUnique;
    prisma.subscriptionPlan.findMany = origPlanFindMany;
    prisma.tenantSubscription.findUnique = origSubFindUnique;
    prisma.tenantSubscription.upsert = origSubUpsert;
    prisma.aiUsageLog.count = origLogCount;
    prisma.aiUsageLog.groupBy = origLogGroupBy;
    prisma.aiUsageLog.findMany = origLogFindMany;
    prisma.aiCreditPurchase.findMany = origPurchaseFindMany;
    prisma.user.findMany = origUserFindMany;
    prisma.$transaction = origTransaction;
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }

  // 7. Platform Admin secret fails closed when missing/short & verifies timing-safely
  assert.equal(verifyPlatformAdminSecretPure('', 'anything').statusCode, 503);
  assert.equal(verifyPlatformAdminSecretPure('too-short', 'too-short').statusCode, 503);
  const validSecret = 'platform_admin_secret_at_least_32_chars_long';
  assert.equal(verifyPlatformAdminSecretPure(validSecret, '').statusCode, 401);
  assert.equal(verifyPlatformAdminSecretPure(validSecret, 'wrong_secret_value').statusCode, 403);
  assert.equal(verifyPlatformAdminSecretPure(validSecret, validSecret).authorized, true);

  console.log('✅ AI Plan, Purchased Credits & Metering Tests: PASSED');
};
