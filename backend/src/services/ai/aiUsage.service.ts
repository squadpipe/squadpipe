import { Prisma } from '@prisma/client';
import {
  resolveAiConfig,
  type AiCapabilities,
  type AiProviderName,
  type ResolvedAiConfig,
} from '../../config/ai.config';
import { prisma } from '../../config/prisma.config';
import { decryptSecret, encryptSecret } from '../../utils/cryptoSecret';

export const AI_USAGE_FEATURES = [
  'resume_parse',
  'email_parse',
  'capability_check',
  'match_rank',
  'pitch_draft',
  'agent_prep',
] as const;

export type AiUsageFeature = (typeof AI_USAGE_FEATURES)[number];

export type AiCreditSource = 'plan' | 'purchased' | 'unlimited' | 'byo';

export interface SeedPlanDefinition {
  id: string;
  code: string;
  name: string;
  description: string;
  monthlyAiCredits: number;
  aiEnabled: boolean;
  allowByoKey: boolean;
  actionCenterAgentEnabled: boolean;
  isCustom: boolean;
  active: boolean;
  sortOrder: number;
}

export const DEFAULT_SAAS_PLANS: readonly SeedPlanDefinition[] = [
  {
    id: 'plan_free',
    code: 'free',
    name: 'Free Trial',
    description: 'Default workspace trial plan with 100 total SquadAI credits.',
    monthlyAiCredits: 100,
    aiEnabled: true,
    allowByoKey: false,
    actionCenterAgentEnabled: false,
    isCustom: false,
    active: true,
    sortOrder: 1,
  },
  {
    id: 'plan_starter',
    code: 'starter',
    name: 'Starter',
    description: 'For small staffing teams with 1,000 monthly SquadAI credits and Action Center AI.',
    monthlyAiCredits: 1000,
    aiEnabled: true,
    allowByoKey: false,
    actionCenterAgentEnabled: true,
    isCustom: false,
    active: true,
    sortOrder: 2,
  },
  {
    id: 'plan_growth',
    code: 'growth',
    name: 'Growth',
    description: 'For scaling recruiting teams with 5,000 monthly SquadAI credits.',
    monthlyAiCredits: 5000,
    aiEnabled: true,
    allowByoKey: false,
    actionCenterAgentEnabled: true,
    isCustom: false,
    active: true,
    sortOrder: 3,
  },
  {
    id: 'plan_enterprise',
    code: 'enterprise',
    name: 'Enterprise',
    description: 'Unlimited monthly SquadAI credits with optional Bring-Your-Own-Key support.',
    monthlyAiCredits: 0,
    aiEnabled: true,
    allowByoKey: true,
    actionCenterAgentEnabled: true,
    isCustom: true,
    active: true,
    sortOrder: 4,
  },
  {
    id: 'plan_custom',
    code: 'custom',
    name: 'Custom Plan',
    description: 'Custom enterprise plan with bespoke monthly SquadAI credits and capabilities.',
    monthlyAiCredits: 0,
    aiEnabled: true,
    allowByoKey: true,
    actionCenterAgentEnabled: true,
    isCustom: true,
    active: true,
    sortOrder: 5,
  },
];

export interface SubscriptionPlanSummary {
  id: string;
  code: string;
  name: string;
  description: string;
  monthlyAiCredits: number;
  aiEnabled: boolean;
  allowByoKey: boolean;
  actionCenterAgentEnabled: boolean;
  isCustom: boolean;
  active: boolean;
  sortOrder: number;
}

export interface TenantSubscriptionSnapshot {
  tenantId?: string;
  aiEnabled: boolean;
  customPlanName?: string | null;
  customMonthlyCredits?: number | null;
  customAllowByoKey?: boolean | null;
  customActionCenterAgent?: boolean | null;
  purchasedCreditsBalance: number;
  purchasedCreditsTotal: number;
  plan: {
    id?: string;
    code: string;
    name: string;
    description?: string | null;
    monthlyAiCredits: number;
    aiEnabled: boolean;
    allowByoKey: boolean;
    actionCenterAgentEnabled: boolean;
    isCustom: boolean;
  };
}

export interface ResolvedPlanEntitlement {
  planCode: string;
  planName: string;
  planDescription: string;
  isCustomPlan: boolean;
  aiEnabled: boolean;
  monthlyPlanCredits: number;
  allowByoKey: boolean;
  actionCenterAgentEnabled: boolean;
  purchasedCreditsBalance: number;
  purchasedCreditsTotal: number;
}

export interface StoredTenantAiConfig {
  byoEnabled: boolean;
  byoProvider?: AiProviderName;
  byoApiKeyEncrypted?: string;
  maskedKeyHint?: string;
  cloudflareAccountId?: string;
  customBaseUrl?: string;
  modelFast?: string;
  modelSmart?: string;
}

export interface PublicTenantByoConfig {
  byoEnabled: boolean;
  byoProvider: AiProviderName;
  hasApiKey: boolean;
  maskedKeyHint: string;
  cloudflareAccountId: string;
  customBaseUrl: string;
  modelFast: string;
  modelSmart: string;
}

export interface QuotaCheckResult {
  exceeded: boolean;
  reason?: string;
  planCreditsUsed: number;
  totalCreditsUsedThisMonth: number;
  planCreditsLimit: number;
  planCreditsRemaining: number | null;
  purchasedCreditsRemaining: number;
  totalCreditsRemaining: number | null;
}

export interface AiCreditHistoryEntry {
  id: string;
  feature: AiUsageFeature | string;
  creditsUsed: number;
  creditSource: AiCreditSource | string;
  userId: string | null;
  userName: string;
  userEmail: string | null;
  latencyMs: number;
  createdAt: string;
}

export interface AiCreditPurchaseEntry {
  id: string;
  creditsAdded: number;
  source: string;
  referenceId: string | null;
  notes: string | null;
  createdAt: string;
}

export interface TenantAiUsageSummary {
  tenantId: string;
  monthStart: string;
  resetsAt: string;
  aiConfigured: boolean;
  usingByoKey: boolean;
  allowByoKey: boolean;
  planTier: string;
  plan: {
    code: string;
    name: string;
    description: string;
    isCustom: boolean;
    monthlyCredits: number;
  };
  availablePlans: SubscriptionPlanSummary[];
  aiDisabledByPlan: boolean;
  creditsUsed: number;
  planCreditsUsed: number;
  purchasedCreditsUsedThisMonth: number;
  creditLimit: number;
  planCreditLimit: number;
  creditsRemaining: number | null;
  planCreditsRemaining: number | null;
  purchasedCreditsRemaining: number;
  purchasedCreditsTotal: number;
  totalCreditsRemaining: number | null;
  quotaExceeded: boolean;
  quotaReason?: string;
  byFeature: Record<AiUsageFeature, { credits: number; actions: number }>;
  creditHistory: AiCreditHistoryEntry[];
  purchaseHistory: AiCreditPurchaseEntry[];
  byo: PublicTenantByoConfig;
}

const VALID_BYO_PROVIDERS = new Set<AiProviderName>([
  'openai',
  'anthropic',
  'gemini',
  'cloudflare',
  'ollama',
  'custom',
]);

const DEFAULT_BYO_FAST: Partial<Record<AiProviderName, string>> = {
  cloudflare: '@cf/meta/llama-3.1-8b-instruct-fp8-fast',
  openai: 'gpt-4o-mini',
  gemini: 'gemini-2.5-flash',
  anthropic: 'claude-3-5-haiku-latest',
  ollama: 'llama3.1:8b',
  custom: 'gpt-4o-mini',
};

const DEFAULT_BYO_SMART: Partial<Record<AiProviderName, string>> = {
  cloudflare: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  openai: 'gpt-4.1-mini',
  gemini: 'gemini-2.5-pro',
  anthropic: 'claude-sonnet-4-0',
  ollama: 'qwen2.5:32b',
  custom: 'gpt-4.1-mini',
};

const tenantAiConfigCache = new Map<string, StoredTenantAiConfig>();
let defaultPlansEnsured = false;

export function getUtcMonthStart(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
}

export function getUtcNextMonthStart(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
}

export function maskApiKeyHint(secret?: string | null): string {
  const clean = String(secret || '').trim();
  if (!clean) return '';
  if (clean.length <= 8) return '••••••••';
  return `${clean.slice(0, 3)}••••${clean.slice(-4)}`;
}

export function normalizePlanCode(raw?: string | null): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function defaultFreeSubscriptionSnapshot(): TenantSubscriptionSnapshot {
  const free = DEFAULT_SAAS_PLANS[0];
  return {
    aiEnabled: true,
    customPlanName: null,
    customMonthlyCredits: null,
    customAllowByoKey: null,
    customActionCenterAgent: null,
    purchasedCreditsBalance: 0,
    purchasedCreditsTotal: 0,
    plan: {
      id: free.id,
      code: free.code,
      name: free.name,
      description: free.description,
      monthlyAiCredits: free.monthlyAiCredits,
      aiEnabled: free.aiEnabled,
      allowByoKey: free.allowByoKey,
      actionCenterAgentEnabled: free.actionCenterAgentEnabled,
      isCustom: free.isCustom,
    },
  };
}

function serializePlanRow(row: {
  id: string;
  code: string;
  name: string;
  description: string | null;
  monthlyAiCredits: number;
  aiEnabled: boolean;
  allowByoKey: boolean;
  actionCenterAgentEnabled: boolean;
  isCustom: boolean;
  active: boolean;
  sortOrder: number;
}): SubscriptionPlanSummary {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description || '',
    monthlyAiCredits: Math.max(0, Math.floor(row.monthlyAiCredits)),
    aiEnabled: Boolean(row.aiEnabled),
    allowByoKey: Boolean(row.allowByoKey),
    actionCenterAgentEnabled: Boolean(row.actionCenterAgentEnabled),
    isCustom: Boolean(row.isCustom),
    active: Boolean(row.active),
    sortOrder: row.sortOrder,
  };
}

/**
 * Resolves a tenant's database plan and optional custom overrides cleanly with zero `.env` limits.
 */
export function resolveTenantPlanEntitlementPure(
  baseConfig: ResolvedAiConfig,
  subscription?: TenantSubscriptionSnapshot | null
): ResolvedPlanEntitlement {
  const snap = subscription || defaultFreeSubscriptionSnapshot();
  const plan = snap.plan;
  const aiEnabled = Boolean(snap.aiEnabled && plan.aiEnabled);
  const hasCustomLimit =
    typeof snap.customMonthlyCredits === 'number' && Number.isFinite(snap.customMonthlyCredits);
  const monthlyPlanCredits = hasCustomLimit
    ? Math.max(0, Math.floor(snap.customMonthlyCredits as number))
    : Math.max(0, Math.floor(plan.monthlyAiCredits || 0));

  const customPlanName = snap.customPlanName ? snap.customPlanName.trim() : '';
  const isCustomPlan = Boolean(plan.isCustom || hasCustomLimit || customPlanName);
  const allowByoKey = aiEnabled
    ? typeof snap.customAllowByoKey === 'boolean'
      ? snap.customAllowByoKey
      : Boolean(plan.allowByoKey || baseConfig.allowByoKey)
    : false;
  const actionCenterAgentEnabled = aiEnabled
    ? typeof snap.customActionCenterAgent === 'boolean'
      ? snap.customActionCenterAgent
      : Boolean(plan.actionCenterAgentEnabled || baseConfig.actionCenterAgentEnabled)
    : false;

  return {
    planCode: plan.code || 'free',
    planName: customPlanName || plan.name || 'Free Trial',
    planDescription: plan.description || '',
    isCustomPlan,
    aiEnabled,
    monthlyPlanCredits,
    allowByoKey,
    actionCenterAgentEnabled,
    purchasedCreditsBalance: Math.max(0, Math.floor(snap.purchasedCreditsBalance || 0)),
    purchasedCreditsTotal: Math.max(0, Math.floor(snap.purchasedCreditsTotal || 0)),
  };
}

/**
 * Evaluates monthly plan credits plus non-expiring purchased add-on AI credits.
 */
export function evaluateCreditQuotaPure(params: {
  planCreditsUsed: number;
  totalCreditsUsedThisMonth: number;
  planCreditsLimit: number;
  purchasedCreditsBalance: number;
  usingByoKey: boolean;
  aiEnabled: boolean;
}): QuotaCheckResult {
  const planCreditsUsed = Math.max(0, Math.floor(params.planCreditsUsed || 0));
  const totalCreditsUsedThisMonth = Math.max(
    planCreditsUsed,
    Math.floor(params.totalCreditsUsedThisMonth || 0)
  );
  const planCreditsLimit = Math.max(0, Math.floor(params.planCreditsLimit || 0));
  const purchasedCreditsRemaining = Math.max(0, Math.floor(params.purchasedCreditsBalance || 0));

  if (!params.aiEnabled) {
    return {
      exceeded: true,
      reason: 'SquadAI is disabled on your current workspace plan. Upgrade your plan to enable AI features.',
      planCreditsUsed,
      totalCreditsUsedThisMonth,
      planCreditsLimit,
      planCreditsRemaining: 0,
      purchasedCreditsRemaining,
      totalCreditsRemaining: 0,
    };
  }

  if (params.usingByoKey || planCreditsLimit === 0) {
    return {
      exceeded: false,
      planCreditsUsed,
      totalCreditsUsedThisMonth,
      planCreditsLimit: 0,
      planCreditsRemaining: null,
      purchasedCreditsRemaining,
      totalCreditsRemaining: null,
    };
  }

  const planCreditsRemaining = Math.max(0, planCreditsLimit - planCreditsUsed);
  const totalCreditsRemaining = planCreditsRemaining + purchasedCreditsRemaining;

  if (totalCreditsRemaining <= 0) {
    return {
      exceeded: true,
      reason:
        'Monthly SquadAI credits exhausted (0 remaining). Upgrade your plan or buy AI credits to continue. Using standard matching mode.',
      planCreditsUsed,
      totalCreditsUsedThisMonth,
      planCreditsLimit,
      planCreditsRemaining: 0,
      purchasedCreditsRemaining: 0,
      totalCreditsRemaining: 0,
    };
  }

  return {
    exceeded: false,
    planCreditsUsed,
    totalCreditsUsedThisMonth,
    planCreditsLimit,
    planCreditsRemaining,
    purchasedCreditsRemaining,
    totalCreditsRemaining,
  };
}

export function sanitizeStoredTenantAiConfig(
  stored?: StoredTenantAiConfig | null
): PublicTenantByoConfig {
  const cfg = stored || { byoEnabled: false };
  const provider =
    cfg.byoProvider && VALID_BYO_PROVIDERS.has(cfg.byoProvider) ? cfg.byoProvider : 'openai';

  return {
    byoEnabled: Boolean(cfg.byoEnabled),
    byoProvider: provider,
    hasApiKey: Boolean(cfg.byoApiKeyEncrypted),
    maskedKeyHint: cfg.maskedKeyHint || (cfg.byoApiKeyEncrypted ? '••••••••' : ''),
    cloudflareAccountId: String(cfg.cloudflareAccountId || ''),
    customBaseUrl: String(cfg.customBaseUrl || ''),
    modelFast: String(cfg.modelFast || ''),
    modelSmart: String(cfg.modelSmart || ''),
  };
}

/**
 * Pure resolver applying database plan entitlement and encrypted tenant BYO key onto AI config.
 */
export function applyTenantEntitlementAndByoPure(
  baseConfig: ResolvedAiConfig,
  entitlement: ResolvedPlanEntitlement,
  stored?: StoredTenantAiConfig | null
): {
  config: ResolvedAiConfig;
  usingByoKey: boolean;
  aiDisabledByPlan: boolean;
  entitlement: ResolvedPlanEntitlement;
} {
  if (!entitlement.aiEnabled) {
    return {
      usingByoKey: false,
      aiDisabledByPlan: true,
      entitlement,
      config: {
        ...baseConfig,
        provider: 'none',
        configured: false,
        allowByoKey: false,
        actionCenterAgentEnabled: false,
        credentials: {
          openaiApiKey: '',
          geminiApiKey: '',
          anthropicApiKey: '',
          cloudflareAccountId: '',
          cloudflareApiToken: '',
          customBaseUrl: '',
          customApiKey: '',
        },
      },
    };
  }

  const nonByoConfig: ResolvedAiConfig = {
    ...baseConfig,
    allowByoKey: entitlement.allowByoKey,
    actionCenterAgentEnabled: entitlement.actionCenterAgentEnabled,
  };

  if (!stored || !entitlement.allowByoKey || !stored.byoEnabled || !stored.byoProvider) {
    return {
      config: nonByoConfig,
      usingByoKey: false,
      aiDisabledByPlan: false,
      entitlement,
    };
  }

  const provider = stored.byoProvider;
  if (!VALID_BYO_PROVIDERS.has(provider)) {
    return {
      config: nonByoConfig,
      usingByoKey: false,
      aiDisabledByPlan: false,
      entitlement,
    };
  }

  let decryptedKey = '';
  if (stored.byoApiKeyEncrypted) {
    try {
      decryptedKey = decryptSecret(stored.byoApiKeyEncrypted).trim();
    } catch {
      decryptedKey = '';
    }
  }

  const credentials = { ...baseConfig.credentials };
  let byoReady = false;

  switch (provider) {
    case 'openai':
      if (decryptedKey) {
        credentials.openaiApiKey = decryptedKey;
        byoReady = true;
      }
      break;
    case 'gemini':
      if (decryptedKey) {
        credentials.geminiApiKey = decryptedKey;
        byoReady = true;
      }
      break;
    case 'anthropic':
      if (decryptedKey) {
        credentials.anthropicApiKey = decryptedKey;
        byoReady = true;
      }
      break;
    case 'cloudflare':
      if (decryptedKey && stored.cloudflareAccountId?.trim()) {
        credentials.cloudflareAccountId = stored.cloudflareAccountId.trim();
        credentials.cloudflareApiToken = decryptedKey;
        byoReady = true;
      }
      break;
    case 'ollama':
    case 'custom':
      if (stored.customBaseUrl?.trim()) {
        credentials.customBaseUrl = stored.customBaseUrl.trim();
        credentials.customApiKey = decryptedKey;
        byoReady = true;
      }
      break;
  }

  if (!byoReady) {
    return {
      config: nonByoConfig,
      usingByoKey: false,
      aiDisabledByPlan: false,
      entitlement,
    };
  }

  return {
    usingByoKey: true,
    aiDisabledByPlan: false,
    entitlement,
    config: {
      ...baseConfig,
      provider,
      configured: true,
      allowByoKey: entitlement.allowByoKey,
      actionCenterAgentEnabled: entitlement.actionCenterAgentEnabled,
      modelFast:
        stored.modelFast?.trim() ||
        DEFAULT_BYO_FAST[provider] ||
        baseConfig.modelFast,
      modelSmart:
        stored.modelSmart?.trim() ||
        DEFAULT_BYO_SMART[provider] ||
        baseConfig.modelSmart,
      credentials,
    },
  };
}

/**
 * Pure state transition for tenant-admin BYO key updates (`PUT /settings/ai-config`).
 * Workspace admins can never alter plans, monthly credits, or purchased credit balances here.
 */
export function mergeTenantAiConfigPure(
  existing: StoredTenantAiConfig,
  input: {
    byoEnabled?: boolean;
    byoProvider?: string;
    apiKey?: string;
    clearApiKey?: boolean;
    cloudflareAccountId?: string;
    customBaseUrl?: string;
    modelFast?: string;
    modelSmart?: string;
  },
  entitlement: Pick<ResolvedPlanEntitlement, 'aiEnabled' | 'allowByoKey'>
): StoredTenantAiConfig {
  const aiDisabledByPlan = !entitlement.aiEnabled;
  const effectiveAllowByoKey = aiDisabledByPlan ? false : entitlement.allowByoKey;

  const tryingByoChanges =
    input.byoEnabled === true ||
    Boolean(input.apiKey && String(input.apiKey).trim()) ||
    input.clearApiKey === true;

  if (!effectiveAllowByoKey && tryingByoChanges) {
    const err: any = new Error(
      aiDisabledByPlan
        ? 'AI features are disabled on this workspace plan.'
        : 'BYO AI key configuration is disabled on this workspace plan.'
    );
    err.statusCode = 403;
    throw err;
  }

  let nextEncrypted = existing.byoApiKeyEncrypted;
  let nextHint = existing.maskedKeyHint;

  if (input.clearApiKey === true) {
    nextEncrypted = undefined;
    nextHint = undefined;
  } else if (input.apiKey && String(input.apiKey).trim()) {
    const rawKey = String(input.apiKey).trim();
    nextEncrypted = encryptSecret(rawKey);
    nextHint = maskApiKeyHint(rawKey);
  }

  const reqProvider = String(input.byoProvider || existing.byoProvider || 'openai')
    .trim()
    .toLowerCase() as AiProviderName;

  return {
    byoEnabled:
      effectiveAllowByoKey && input.byoEnabled !== undefined
        ? Boolean(input.byoEnabled)
        : Boolean(existing.byoEnabled && effectiveAllowByoKey),
    byoProvider: VALID_BYO_PROVIDERS.has(reqProvider)
      ? reqProvider
      : existing.byoProvider || 'openai',
    ...(nextEncrypted ? { byoApiKeyEncrypted: nextEncrypted } : {}),
    ...(nextHint ? { maskedKeyHint: nextHint } : {}),
    cloudflareAccountId:
      input.cloudflareAccountId !== undefined
        ? String(input.cloudflareAccountId || '').trim()
        : existing.cloudflareAccountId || '',
    customBaseUrl:
      input.customBaseUrl !== undefined
        ? String(input.customBaseUrl || '').trim()
        : existing.customBaseUrl || '',
    modelFast:
      input.modelFast !== undefined
        ? String(input.modelFast || '').trim()
        : existing.modelFast || '',
    modelSmart:
      input.modelSmart !== undefined
        ? String(input.modelSmart || '').trim()
        : existing.modelSmart || '',
  };
}

function normalizeOptionalCredits(val: unknown): number | null | undefined {
  if (val === undefined) return undefined;
  if (val === null || val === '') return null;
  const num = Number(val);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.floor(num);
}

export class AiUsageService {
  async ensureDefaultPlansSeeded(): Promise<void> {
    if (defaultPlansEnsured) return;
    try {
      await prisma.subscriptionPlan.createMany({
        data: DEFAULT_SAAS_PLANS.map((plan) => ({
          id: plan.id,
          code: plan.code,
          name: plan.name,
          description: plan.description,
          monthlyAiCredits: plan.monthlyAiCredits,
          aiEnabled: plan.aiEnabled,
          allowByoKey: plan.allowByoKey,
          actionCenterAgentEnabled: plan.actionCenterAgentEnabled,
          isCustom: plan.isCustom,
          active: plan.active,
          sortOrder: plan.sortOrder,
        })),
        skipDuplicates: true,
      });
      defaultPlansEnsured = true;
    } catch {
      // Safe fallback when running offline or in mocked unit tests without Postgres
    }
  }

  async attachDefaultFreePlan(tenantId = 'squadpipe-agency'): Promise<void> {
    const key = (tenantId || 'squadpipe-agency').trim() || 'squadpipe-agency';
    try {
      const existing = await prisma.tenantSubscription.findUnique({
        where: { tenantId: key },
        select: { id: true },
      });
      if (existing) return;

      await this.ensureDefaultPlansSeeded();
      const freePlan = await prisma.subscriptionPlan.findUnique({
        where: { code: 'free' },
        select: { id: true },
      });
      if (!freePlan) return;

      await prisma.tenantSubscription.upsert({
        where: { tenantId: key },
        update: {},
        create: {
          tenantId: key,
          planId: freePlan.id,
          aiEnabled: true,
        },
      });
    } catch {
      // Do not break auth/registration if subscription provisioning races or runs offline
    }
  }

  async getTenantSubscriptionSnapshot(
    tenantId = 'squadpipe-agency'
  ): Promise<TenantSubscriptionSnapshot> {
    const key = (tenantId || 'squadpipe-agency').trim() || 'squadpipe-agency';
    try {
      let row = await prisma.tenantSubscription.findUnique({
        where: { tenantId: key },
        include: { plan: true },
      });

      if (!row) {
        await this.attachDefaultFreePlan(key);
        row = await prisma.tenantSubscription.findUnique({
          where: { tenantId: key },
          include: { plan: true },
        });
      }

      if (!row || !row.plan) {
        return defaultFreeSubscriptionSnapshot();
      }

      return {
        tenantId: row.tenantId,
        aiEnabled: row.aiEnabled,
        customPlanName: row.customPlanName,
        customMonthlyCredits: row.customMonthlyCredits,
        customAllowByoKey: row.customAllowByoKey,
        customActionCenterAgent: row.customActionCenterAgent,
        purchasedCreditsBalance: row.purchasedCreditsBalance,
        purchasedCreditsTotal: row.purchasedCreditsTotal,
        plan: {
          id: row.plan.id,
          code: row.plan.code,
          name: row.plan.name,
          description: row.plan.description,
          monthlyAiCredits: row.plan.monthlyAiCredits,
          aiEnabled: row.plan.aiEnabled,
          allowByoKey: row.plan.allowByoKey,
          actionCenterAgentEnabled: row.plan.actionCenterAgentEnabled,
          isCustom: row.plan.isCustom,
        },
      };
    } catch {
      return defaultFreeSubscriptionSnapshot();
    }
  }

  async listSubscriptionPlans(includeInactive = false): Promise<SubscriptionPlanSummary[]> {
    try {
      await this.ensureDefaultPlansSeeded();
      const rows = await prisma.subscriptionPlan.findMany({
        ...(includeInactive ? {} : { where: { active: true } }),
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      });
      if (rows.length > 0) {
        return rows.map(serializePlanRow);
      }
    } catch {
      // Fallback to static plan list if DB is temporarily unavailable
    }

    return DEFAULT_SAAS_PLANS.filter((p) => includeInactive || p.active).map((p) => ({
      ...p,
    }));
  }

  async upsertSubscriptionPlan(input: {
    code: string;
    name: string;
    description?: string;
    monthlyAiCredits: number;
    aiEnabled?: boolean;
    allowByoKey?: boolean;
    actionCenterAgentEnabled?: boolean;
    isCustom?: boolean;
    active?: boolean;
    sortOrder?: number;
  }): Promise<SubscriptionPlanSummary> {
    const code = normalizePlanCode(input.code);
    if (!code || code.length < 2 || code.length > 48) {
      const err: any = new Error('Plan code must be 2–48 alphanumeric/hyphen characters.');
      err.statusCode = 400;
      throw err;
    }

    const name = String(input.name || '').trim();
    if (!name) {
      const err: any = new Error('Plan name is required.');
      err.statusCode = 400;
      throw err;
    }

    const monthlyAiCredits = Math.max(0, Math.floor(Number(input.monthlyAiCredits ?? 0) || 0));
    await this.ensureDefaultPlansSeeded();

    const row = await prisma.subscriptionPlan.upsert({
      where: { code },
      create: {
        code,
        name,
        description: input.description ? String(input.description).trim() : null,
        monthlyAiCredits,
        aiEnabled: input.aiEnabled !== undefined ? Boolean(input.aiEnabled) : true,
        allowByoKey: input.allowByoKey !== undefined ? Boolean(input.allowByoKey) : false,
        actionCenterAgentEnabled:
          input.actionCenterAgentEnabled !== undefined
            ? Boolean(input.actionCenterAgentEnabled)
            : monthlyAiCredits !== 100,
        isCustom: input.isCustom !== undefined ? Boolean(input.isCustom) : true,
        active: input.active !== undefined ? Boolean(input.active) : true,
        sortOrder:
          typeof input.sortOrder === 'number' && Number.isFinite(input.sortOrder)
            ? Math.floor(input.sortOrder)
            : 100,
      },
      update: {
        name,
        ...(input.description !== undefined
          ? { description: input.description ? String(input.description).trim() : null }
          : {}),
        monthlyAiCredits,
        ...(input.aiEnabled !== undefined ? { aiEnabled: Boolean(input.aiEnabled) } : {}),
        ...(input.allowByoKey !== undefined ? { allowByoKey: Boolean(input.allowByoKey) } : {}),
        ...(input.actionCenterAgentEnabled !== undefined
          ? { actionCenterAgentEnabled: Boolean(input.actionCenterAgentEnabled) }
          : {}),
        ...(input.isCustom !== undefined ? { isCustom: Boolean(input.isCustom) } : {}),
        ...(input.active !== undefined ? { active: Boolean(input.active) } : {}),
        ...(typeof input.sortOrder === 'number' && Number.isFinite(input.sortOrder)
          ? { sortOrder: Math.floor(input.sortOrder) }
          : {}),
      },
    });

    return serializePlanRow(row);
  }

  async getStoredTenantAiConfig(tenantId = 'squadpipe-agency'): Promise<StoredTenantAiConfig> {
    const key = tenantId || 'squadpipe-agency';
    try {
      const row = await prisma.tenantSettings.findUnique({
        where: { tenantId: key },
        select: { aiConfig: true },
      });
      const parsed =
        row?.aiConfig && typeof row.aiConfig === 'object'
          ? (row.aiConfig as unknown as StoredTenantAiConfig)
          : { byoEnabled: false };
      tenantAiConfigCache.set(key, parsed);
      return parsed;
    } catch {
      return tenantAiConfigCache.get(key) || { byoEnabled: false };
    }
  }

  async saveTenantAiConfig(
    tenantId: string,
    input: {
      byoEnabled?: boolean;
      byoProvider?: string;
      apiKey?: string;
      clearApiKey?: boolean;
      cloudflareAccountId?: string;
      customBaseUrl?: string;
      modelFast?: string;
      modelSmart?: string;
    }
  ): Promise<PublicTenantByoConfig> {
    const key = tenantId || 'squadpipe-agency';
    const [existing, runtime] = await Promise.all([
      this.getStoredTenantAiConfig(key),
      this.resolveEffectiveRuntimeConfig(key),
    ]);
    const nextStored = mergeTenantAiConfigPure(existing, input, runtime.entitlement);

    await prisma.tenantSettings.upsert({
      where: { tenantId: key },
      create: {
        tenantId: key,
        generalConfig: {},
        aiConfig: nextStored as unknown as Prisma.InputJsonValue,
      },
      update: {
        aiConfig: nextStored as unknown as Prisma.InputJsonValue,
      },
    });
    tenantAiConfigCache.set(key, nextStored);

    return sanitizeStoredTenantAiConfig(nextStored);
  }

  async savePlatformAiEntitlement(
    tenantId: string,
    input: {
      planCode?: string;
      planTier?: string;
      customPlanName?: string | null;
      customMonthlyCredits?: number | null;
      monthlyActionLimit?: number | null;
      aiEnabled?: boolean | null;
      allowByoKey?: boolean | null;
      actionCenterAgentEnabled?: boolean | null;
    }
  ): Promise<ResolvedPlanEntitlement> {
    const key = (tenantId || 'squadpipe-agency').trim() || 'squadpipe-agency';
    await this.ensureDefaultPlansSeeded();
    await this.attachDefaultFreePlan(key);

    const requestedCode = normalizePlanCode(input.planCode ?? input.planTier);
    const customMonthlyInput = normalizeOptionalCredits(
      input.customMonthlyCredits !== undefined
        ? input.customMonthlyCredits
        : input.monthlyActionLimit
    );

    let targetPlan = requestedCode
      ? await prisma.subscriptionPlan.findUnique({ where: { code: requestedCode } })
      : null;

    let inferredCustomName: string | null | undefined =
      input.customPlanName !== undefined
        ? input.customPlanName
          ? String(input.customPlanName).trim()
          : null
        : undefined;

    if (requestedCode && !targetPlan) {
      // Unknown planTier/planCode maps onto the reusable `custom` plan with bespoke label
      targetPlan = await prisma.subscriptionPlan.findUnique({ where: { code: 'custom' } });
      if (inferredCustomName === undefined) {
        inferredCustomName = String(input.planCode ?? input.planTier ?? '').trim() || null;
      }
    }

    const switchingPlans = Boolean(targetPlan);
    const current = await prisma.tenantSubscription.findUnique({ where: { tenantId: key } });
    const planId = targetPlan?.id || current?.planId;
    if (!planId) {
      const err: any = new Error('Target subscription plan not found.');
      err.statusCode = 404;
      throw err;
    }

    const updated = await prisma.tenantSubscription.update({
      where: { tenantId: key },
      data: {
        planId,
        ...(input.aiEnabled !== undefined && input.aiEnabled !== null
          ? { aiEnabled: Boolean(input.aiEnabled) }
          : {}),
        ...(inferredCustomName !== undefined
          ? { customPlanName: inferredCustomName }
          : switchingPlans && targetPlan?.code !== 'custom'
            ? { customPlanName: null }
            : {}),
        ...(customMonthlyInput !== undefined
          ? { customMonthlyCredits: customMonthlyInput }
          : switchingPlans && targetPlan?.code !== 'custom'
            ? { customMonthlyCredits: null }
            : {}),
        ...(input.allowByoKey !== undefined ? { customAllowByoKey: input.allowByoKey } : {}),
        ...(input.actionCenterAgentEnabled !== undefined
          ? { customActionCenterAgent: input.actionCenterAgentEnabled }
          : {}),
      },
      include: { plan: true },
    });

    return resolveTenantPlanEntitlementPure(resolveAiConfig(), updated);
  }

  async addPurchasedAiCredits(
    tenantId: string,
    input: {
      credits: number;
      source?: 'PURCHASE' | 'PLATFORM_GRANT' | 'PLAN_BONUS';
      referenceId?: string;
      notes?: string;
      userId?: string;
    }
  ): Promise<{
    purchase: AiCreditPurchaseEntry;
    entitlement: ResolvedPlanEntitlement;
  }> {
    const key = (tenantId || 'squadpipe-agency').trim() || 'squadpipe-agency';
    const credits = Math.floor(Number(input.credits));
    if (!Number.isFinite(credits) || credits <= 0 || credits > 10_000_000) {
      const err: any = new Error('Credits to add must be an integer between 1 and 10,000,000.');
      err.statusCode = 400;
      throw err;
    }

    await this.ensureDefaultPlansSeeded();
    await this.attachDefaultFreePlan(key);

    const source = input.source || 'PURCHASE';
    const result = await prisma.$transaction(async (tx) => {
      const sub = await tx.tenantSubscription.update({
        where: { tenantId: key },
        data: {
          purchasedCreditsBalance: { increment: credits },
          purchasedCreditsTotal: { increment: credits },
        },
        include: { plan: true },
      });

      const purchase = await tx.aiCreditPurchase.create({
        data: {
          tenantId: key,
          subscriptionId: sub.id,
          userId: input.userId || null,
          creditsAdded: credits,
          source,
          referenceId: input.referenceId ? String(input.referenceId).trim() : null,
          notes: input.notes ? String(input.notes).trim() : null,
        },
      });

      return { sub, purchase };
    });

    return {
      purchase: {
        id: result.purchase.id,
        creditsAdded: result.purchase.creditsAdded,
        source: result.purchase.source,
        referenceId: result.purchase.referenceId,
        notes: result.purchase.notes,
        createdAt: result.purchase.createdAt.toISOString(),
      },
      entitlement: resolveTenantPlanEntitlementPure(resolveAiConfig(), result.sub),
    };
  }

  async resolveEffectiveRuntimeConfig(
    tenantId?: string,
    env: NodeJS.ProcessEnv = process.env
  ): Promise<{
    config: ResolvedAiConfig;
    entitlement: ResolvedPlanEntitlement;
    usingByoKey: boolean;
    aiDisabledByPlan: boolean;
    stored: StoredTenantAiConfig;
  }> {
    const baseConfig = resolveAiConfig(env);
    if (!tenantId) {
      const entitlement = resolveTenantPlanEntitlementPure(baseConfig, null);
      return {
        config: {
          ...baseConfig,
          allowByoKey: entitlement.allowByoKey,
          actionCenterAgentEnabled: entitlement.actionCenterAgentEnabled,
        },
        entitlement,
        usingByoKey: false,
        aiDisabledByPlan: false,
        stored: { byoEnabled: false },
      };
    }

    const [stored, snapshot] = await Promise.all([
      this.getStoredTenantAiConfig(tenantId),
      this.getTenantSubscriptionSnapshot(tenantId),
    ]);
    const entitlement = resolveTenantPlanEntitlementPure(baseConfig, snapshot);
    const merged = applyTenantEntitlementAndByoPure(baseConfig, entitlement, stored);
    return { ...merged, stored };
  }

  async checkQuota(
    tenantId = 'squadpipe-agency',
    effectiveConfig?: ResolvedAiConfig
  ): Promise<QuotaCheckResult> {
    const runtime = await this.resolveEffectiveRuntimeConfig(tenantId);
    const usingByoKey =
      effectiveConfig && !runtime.usingByoKey
        ? false
        : runtime.usingByoKey;
    const monthStart = getUtcMonthStart();

    try {
      const [planCreditsUsed, totalCreditsUsedThisMonth] = await Promise.all([
        prisma.aiUsageLog.count({
          where: {
            tenantId,
            creditSource: 'plan',
            createdAt: { gte: monthStart },
          },
        }),
        prisma.aiUsageLog.count({
          where: {
            tenantId,
            createdAt: { gte: monthStart },
          },
        }),
      ]);

      return evaluateCreditQuotaPure({
        planCreditsUsed,
        totalCreditsUsedThisMonth,
        planCreditsLimit: runtime.entitlement.monthlyPlanCredits,
        purchasedCreditsBalance: runtime.entitlement.purchasedCreditsBalance,
        usingByoKey,
        aiEnabled: runtime.entitlement.aiEnabled,
      });
    } catch {
      return evaluateCreditQuotaPure({
        planCreditsUsed: 0,
        totalCreditsUsedThisMonth: 0,
        planCreditsLimit: runtime.entitlement.monthlyPlanCredits,
        purchasedCreditsBalance: runtime.entitlement.purchasedCreditsBalance,
        usingByoKey,
        aiEnabled: runtime.entitlement.aiEnabled,
      });
    }
  }

  async recordUsage(params: {
    tenantId?: string;
    userId?: string;
    provider: string;
    model: string;
    feature: AiUsageFeature;
    inputTokens?: number;
    outputTokens?: number;
    latencyMs?: number;
  }) {
    const tenantId = params.tenantId || 'squadpipe-agency';
    try {
      const runtime = await this.resolveEffectiveRuntimeConfig(tenantId);
      const monthStart = getUtcMonthStart();

      await prisma.$transaction(async (tx) => {
        let creditSource: AiCreditSource = 'plan';

        if (runtime.usingByoKey) {
          creditSource = 'byo';
        } else if (runtime.entitlement.monthlyPlanCredits === 0) {
          creditSource = 'unlimited';
        } else {
          const planUsed = await tx.aiUsageLog.count({
            where: {
              tenantId,
              creditSource: 'plan',
              createdAt: { gte: monthStart },
            },
          });
          if (planUsed < runtime.entitlement.monthlyPlanCredits) {
            creditSource = 'plan';
          } else {
            const debited = await tx.tenantSubscription.updateMany({
              where: {
                tenantId,
                purchasedCreditsBalance: { gt: 0 },
              },
              data: {
                purchasedCreditsBalance: { decrement: 1 },
              },
            });
            creditSource = debited.count > 0 ? 'purchased' : 'plan';
          }
        }

        await tx.aiUsageLog.create({
          data: {
            tenantId,
            userId: params.userId || null,
            provider: params.provider,
            model: params.model,
            feature: params.feature,
            creditSource,
            inputTokens: Math.max(0, Math.round(params.inputTokens || 0)),
            outputTokens: Math.max(0, Math.round(params.outputTokens || 0)),
            latencyMs: Math.max(0, Math.round(params.latencyMs || 0)),
          },
        });
      });
    } catch {
      // Usage telemetry must never block user-facing workflows
    }
  }

  async getEffectivePublicAiCapabilities(tenantId?: string): Promise<AiCapabilities> {
    const { config } = await this.resolveEffectiveRuntimeConfig(tenantId);
    if (!config.configured) {
      return {
        enabled: false,
        provider: 'none',
        allowByoKey: config.allowByoKey,
        quotaExceeded: false,
        features: {
          resumeParser: false,
          emailIntake: false,
          capabilityCheck: false,
          pitchDraft: false,
          actionCenterAgent: false,
        },
      };
    }

    const quota = tenantId
      ? await this.checkQuota(tenantId, config)
      : { exceeded: false };

    const active = config.configured && !quota.exceeded;
    return {
      enabled: active,
      provider: config.provider,
      allowByoKey: config.allowByoKey,
      quotaExceeded: quota.exceeded,
      features: {
        resumeParser: active,
        emailIntake: active,
        capabilityCheck: active,
        pitchDraft: active,
        actionCenterAgent: active && config.actionCenterAgentEnabled,
      },
    };
  }

  async getPlatformAiEntitlement(tenantId = 'squadpipe-agency'): Promise<ResolvedPlanEntitlement> {
    const snapshot = await this.getTenantSubscriptionSnapshot(tenantId);
    return resolveTenantPlanEntitlementPure(resolveAiConfig(), snapshot);
  }

  async getMonthlyUsageSummary(tenantId = 'squadpipe-agency'): Promise<TenantAiUsageSummary> {
    const key = (tenantId || 'squadpipe-agency').trim() || 'squadpipe-agency';
    const now = new Date();
    const monthStart = getUtcMonthStart(now);
    const resetsAt = getUtcNextMonthStart(now);
    const [{ config, entitlement, usingByoKey, aiDisabledByPlan, stored }, allPlans] =
      await Promise.all([
        this.resolveEffectiveRuntimeConfig(key),
        this.listSubscriptionPlans(false),
      ]);

    const byFeature: TenantAiUsageSummary['byFeature'] = {
      resume_parse: { credits: 0, actions: 0 },
      email_parse: { credits: 0, actions: 0 },
      capability_check: { credits: 0, actions: 0 },
      match_rank: { credits: 0, actions: 0 },
      pitch_draft: { credits: 0, actions: 0 },
      agent_prep: { credits: 0, actions: 0 },
    };

    let creditsUsed = 0;
    let planCreditsUsed = 0;
    let purchasedCreditsUsedThisMonth = 0;
    let creditHistory: AiCreditHistoryEntry[] = [];
    let purchaseHistory: AiCreditPurchaseEntry[] = [];

    try {
      const [grouped, recentLogs, purchases] = await Promise.all([
        prisma.aiUsageLog.groupBy({
          by: ['feature', 'creditSource'],
          where: {
            tenantId: key,
            createdAt: { gte: monthStart },
          },
          _count: { _all: true },
        }),
        prisma.aiUsageLog.findMany({
          where: {
            tenantId: key,
            createdAt: { gte: monthStart },
          },
          select: {
            id: true,
            feature: true,
            creditSource: true,
            userId: true,
            latencyMs: true,
            createdAt: true,
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 100,
        }),
        prisma.aiCreditPurchase.findMany({
          where: { tenantId: key },
          orderBy: { createdAt: 'desc' },
          take: 25,
        }),
      ]);

      for (const row of grouped) {
        const count = row._count._all || 0;
        creditsUsed += count;
        if (row.creditSource === 'purchased') {
          purchasedCreditsUsedThisMonth += count;
        } else if (row.creditSource === 'plan') {
          planCreditsUsed += count;
        }

        if (row.feature in byFeature) {
          const feat = row.feature as AiUsageFeature;
          byFeature[feat] = {
            credits: byFeature[feat].credits + count,
            actions: byFeature[feat].actions + count,
          };
        }
      }

      const actorIds = Array.from(
        new Set(recentLogs.map((r) => r.userId).filter((id): id is string => Boolean(id)))
      );
      const actors =
        actorIds.length > 0
          ? await prisma.user.findMany({
              where: { tenantId: key, id: { in: actorIds } },
              select: { id: true, fullName: true, email: true },
            })
          : [];
      const actorMap = new Map(actors.map((u) => [u.id, u]));

      creditHistory = recentLogs.map((log) => {
        const actor = log.userId ? actorMap.get(log.userId) : undefined;
        return {
          id: log.id,
          feature: log.feature,
          creditsUsed: 1,
          creditSource: log.creditSource || 'plan',
          userId: log.userId || null,
          userName: actor?.fullName || 'Workspace User',
          userEmail: actor?.email || null,
          latencyMs: log.latencyMs || 0,
          createdAt: log.createdAt.toISOString(),
        };
      });

      purchaseHistory = purchases.map((p) => ({
        id: p.id,
        creditsAdded: p.creditsAdded,
        source: p.source,
        referenceId: p.referenceId,
        notes: p.notes,
        createdAt: p.createdAt.toISOString(),
      }));
    } catch {
      // Graceful zero usage if table/query is unavailable
    }

    const quota = evaluateCreditQuotaPure({
      planCreditsUsed,
      totalCreditsUsedThisMonth: creditsUsed,
      planCreditsLimit: entitlement.monthlyPlanCredits,
      purchasedCreditsBalance: entitlement.purchasedCreditsBalance,
      usingByoKey,
      aiEnabled: entitlement.aiEnabled,
    });

    const availablePlans = allPlans.filter((p) => !p.isCustom || p.code === entitlement.planCode);

    return {
      tenantId: key,
      monthStart: monthStart.toISOString(),
      resetsAt: resetsAt.toISOString(),
      aiConfigured: config.configured,
      usingByoKey,
      allowByoKey: config.allowByoKey,
      planTier: entitlement.planCode,
      plan: {
        code: entitlement.planCode,
        name: entitlement.planName,
        description: entitlement.planDescription,
        isCustom: entitlement.isCustomPlan,
        monthlyCredits: quota.planCreditsLimit,
      },
      availablePlans,
      aiDisabledByPlan,
      creditsUsed,
      planCreditsUsed,
      purchasedCreditsUsedThisMonth,
      creditLimit: quota.planCreditsLimit,
      planCreditLimit: quota.planCreditsLimit,
      creditsRemaining: quota.totalCreditsRemaining,
      planCreditsRemaining: quota.planCreditsRemaining,
      purchasedCreditsRemaining: quota.purchasedCreditsRemaining,
      purchasedCreditsTotal: entitlement.purchasedCreditsTotal,
      totalCreditsRemaining: quota.totalCreditsRemaining,
      quotaExceeded: quota.exceeded,
      ...(quota.reason ? { quotaReason: quota.reason } : {}),
      byFeature,
      creditHistory,
      purchaseHistory,
      byo: sanitizeStoredTenantAiConfig(stored),
    };
  }
}

export const aiUsageService = new AiUsageService();
