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

export interface PlatformTenantAiEntitlement {
  planTier?: string;
  aiEnabled?: boolean | null;
  allowByoKey?: boolean | null;
  actionCenterAgentEnabled?: boolean | null;
  monthlyActionLimit?: number | null;
  monthlyTokenLimit?: number | null;
  updatedAt?: string;
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
  /** Optional tenant self-imposed soft ceiling (never exceeds platformEntitlement). */
  selfActionLimit?: number | null;
  selfTokenLimit?: number | null;
  /** Legacy aliases kept for backwards-compatible deserialization of existing rows. */
  monthlyActionLimit?: number | null;
  monthlyTokenLimit?: number | null;
  /** Server/Platform/Partner-controlled entitlement block; never editable by tenant admins. */
  platformEntitlement?: PlatformTenantAiEntitlement;
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
  selfActionLimit: number | null;
  selfTokenLimit: number | null;
  monthlyActionLimit: number | null;
  monthlyTokenLimit: number | null;
}

export interface QuotaCheckResult {
  exceeded: boolean;
  reason?: string;
  actionsUsed: number;
  tokensUsed: number;
  actionLimit: number;
  tokenLimit: number;
}

export interface TenantAiUsageSummary {
  monthStart: string;
  activeProvider: AiProviderName;
  aiConfigured: boolean;
  usingByoKey: boolean;
  allowByoKey: boolean;
  planTier: string;
  aiDisabledByPlan: boolean;
  planActionLimit: number;
  planTokenLimit: number;
  actionsUsed: number;
  inputTokens: number;
  outputTokens: number;
  tokensUsed: number;
  actionLimit: number;
  tokenLimit: number;
  quotaExceeded: boolean;
  quotaReason?: string;
  byFeature: Record<
    AiUsageFeature,
    { actions: number; inputTokens: number; outputTokens: number }
  >;
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

export function getUtcMonthStart(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
}

export function maskApiKeyHint(secret?: string | null): string {
  const clean = String(secret || '').trim();
  if (!clean) return '';
  if (clean.length <= 8) return '••••••••';
  return `${clean.slice(0, 3)}••••${clean.slice(-4)}`;
}

export function evaluateQuotaStatusPure(params: {
  actionsUsed: number;
  tokensUsed: number;
  actionLimit: number;
  tokenLimit: number;
}): QuotaCheckResult {
  const actionsUsed = Math.max(0, Math.floor(params.actionsUsed || 0));
  const tokensUsed = Math.max(0, Math.floor(params.tokensUsed || 0));
  const actionLimit = Math.max(0, Math.floor(params.actionLimit || 0));
  const tokenLimit = Math.max(0, Math.floor(params.tokenLimit || 0));

  if (actionLimit > 0 && actionsUsed >= actionLimit) {
    return {
      exceeded: true,
      reason: `Monthly AI action quota reached (${actionsUsed}/${actionLimit}). Falling back to offline mode.`,
      actionsUsed,
      tokensUsed,
      actionLimit,
      tokenLimit,
    };
  }

  if (tokenLimit > 0 && tokensUsed >= tokenLimit) {
    return {
      exceeded: true,
      reason: `Monthly AI token quota reached (${tokensUsed}/${tokenLimit}). Falling back to offline mode.`,
      actionsUsed,
      tokensUsed,
      actionLimit,
      tokenLimit,
    };
  }

  return {
    exceeded: false,
    actionsUsed,
    tokensUsed,
    actionLimit,
    tokenLimit,
  };
}

function readSelfCap(val: unknown): number | null {
  if (typeof val !== 'number' || !Number.isFinite(val) || val <= 0) return null;
  return Math.floor(val);
}

/**
 * Resolves the effective enforced monthly ceiling (`0` = unlimited):
 * - When `usingByoKey` is true, the tenant pays their own LLM bill, so only
 *   their optional self-imposed cap applies.
 * - When using the platform's shared key, a tenant can only lower their cap
 *   below `planLimit` (`min(planLimit, selfLimit)`); never raise above it.
 */
export function resolveEffectiveQuotaCeilingPure(
  planLimit: number,
  selfLimit: number | null | undefined,
  usingByoKey: boolean
): number {
  const safePlan = Math.max(0, Math.floor(planLimit || 0));
  const safeSelf = readSelfCap(selfLimit) || 0;

  if (usingByoKey) {
    return safeSelf;
  }
  if (safePlan > 0 && safeSelf > 0) {
    return Math.min(safePlan, safeSelf);
  }
  if (safePlan > 0) {
    return safePlan;
  }
  return safeSelf;
}

export function sanitizeStoredTenantAiConfig(
  stored?: StoredTenantAiConfig | null
): PublicTenantByoConfig {
  const cfg = stored || { byoEnabled: false };
  const provider =
    cfg.byoProvider && VALID_BYO_PROVIDERS.has(cfg.byoProvider) ? cfg.byoProvider : 'openai';
  const selfActionLimit = readSelfCap(cfg.selfActionLimit ?? cfg.monthlyActionLimit);
  const selfTokenLimit = readSelfCap(cfg.selfTokenLimit ?? cfg.monthlyTokenLimit);

  return {
    byoEnabled: Boolean(cfg.byoEnabled),
    byoProvider: provider,
    hasApiKey: Boolean(cfg.byoApiKeyEncrypted),
    maskedKeyHint: cfg.maskedKeyHint || (cfg.byoApiKeyEncrypted ? '••••••••' : ''),
    cloudflareAccountId: String(cfg.cloudflareAccountId || ''),
    customBaseUrl: String(cfg.customBaseUrl || ''),
    modelFast: String(cfg.modelFast || ''),
    modelSmart: String(cfg.modelSmart || ''),
    selfActionLimit,
    selfTokenLimit,
    monthlyActionLimit: selfActionLimit,
    monthlyTokenLimit: selfTokenLimit,
  };
}

/**
 * Pure resolver merging platform/partner plan entitlements (locked per tenantId)
 * and optional tenant self-budget + encrypted BYO credentials onto server `.env` defaults.
 */
export function applyTenantByoOverridePure(
  baseConfig: ResolvedAiConfig,
  stored?: StoredTenantAiConfig | null
): {
  config: ResolvedAiConfig;
  usingByoKey: boolean;
  planTier: string;
  aiDisabledByPlan: boolean;
  planActionLimit: number;
  planTokenLimit: number;
} {
  const ent = stored?.platformEntitlement;
  const planTier = String(ent?.planTier || 'default').trim() || 'default';
  const aiDisabledByPlan = ent?.aiEnabled === false;

  const planActionLimit =
    typeof ent?.monthlyActionLimit === 'number' &&
    Number.isFinite(ent.monthlyActionLimit) &&
    ent.monthlyActionLimit >= 0
      ? Math.floor(ent.monthlyActionLimit)
      : baseConfig.monthlyActionLimit;

  const planTokenLimit =
    typeof ent?.monthlyTokenLimit === 'number' &&
    Number.isFinite(ent.monthlyTokenLimit) &&
    ent.monthlyTokenLimit >= 0
      ? Math.floor(ent.monthlyTokenLimit)
      : baseConfig.monthlyTokenLimit;

  const effectiveAllowByoKey = aiDisabledByPlan
    ? false
    : typeof ent?.allowByoKey === 'boolean'
      ? ent.allowByoKey
      : baseConfig.allowByoKey;

  const effectiveAgentEnabled = aiDisabledByPlan
    ? false
    : typeof ent?.actionCenterAgentEnabled === 'boolean'
      ? ent.actionCenterAgentEnabled
      : baseConfig.actionCenterAgentEnabled;

  if (aiDisabledByPlan) {
    return {
      usingByoKey: false,
      planTier,
      aiDisabledByPlan: true,
      planActionLimit,
      planTokenLimit,
      config: {
        ...baseConfig,
        provider: 'none',
        configured: false,
        allowByoKey: false,
        actionCenterAgentEnabled: false,
        monthlyActionLimit: planActionLimit,
        monthlyTokenLimit: planTokenLimit,
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

  const selfActionLimit = stored?.selfActionLimit ?? stored?.monthlyActionLimit;
  const selfTokenLimit = stored?.selfTokenLimit ?? stored?.monthlyTokenLimit;

  const sharedActionLimit = resolveEffectiveQuotaCeilingPure(
    planActionLimit,
    selfActionLimit,
    false
  );
  const sharedTokenLimit = resolveEffectiveQuotaCeilingPure(
    planTokenLimit,
    selfTokenLimit,
    false
  );

  const nonByoConfig: ResolvedAiConfig = {
    ...baseConfig,
    allowByoKey: effectiveAllowByoKey,
    actionCenterAgentEnabled: effectiveAgentEnabled,
    monthlyActionLimit: sharedActionLimit,
    monthlyTokenLimit: sharedTokenLimit,
  };

  if (!stored || !effectiveAllowByoKey || !stored.byoEnabled || !stored.byoProvider) {
    return {
      config: nonByoConfig,
      usingByoKey: false,
      planTier,
      aiDisabledByPlan: false,
      planActionLimit,
      planTokenLimit,
    };
  }

  const provider = stored.byoProvider;
  if (!VALID_BYO_PROVIDERS.has(provider)) {
    return {
      config: nonByoConfig,
      usingByoKey: false,
      planTier,
      aiDisabledByPlan: false,
      planActionLimit,
      planTokenLimit,
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
      planTier,
      aiDisabledByPlan: false,
      planActionLimit,
      planTokenLimit,
    };
  }

  return {
    usingByoKey: true,
    planTier,
    aiDisabledByPlan: false,
    planActionLimit,
    planTokenLimit,
    config: {
      ...baseConfig,
      provider,
      configured: true,
      allowByoKey: effectiveAllowByoKey,
      actionCenterAgentEnabled: effectiveAgentEnabled,
      monthlyActionLimit: resolveEffectiveQuotaCeilingPure(planActionLimit, selfActionLimit, true),
      monthlyTokenLimit: resolveEffectiveQuotaCeilingPure(planTokenLimit, selfTokenLimit, true),
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

function normalizeTenantSelfCapOrNull(val: unknown): number | null | undefined {
  if (val === undefined) return undefined;
  if (val === null || val === '') return null;
  const num = Number(val);
  return Number.isFinite(num) && num > 0 ? Math.floor(num) : null;
}

function normalizePlatformCapOrNull(val: unknown): number | null | undefined {
  if (val === undefined) return undefined;
  if (val === null || val === '') return null;
  const num = Number(val);
  return Number.isFinite(num) && num >= 0 ? Math.floor(num) : null;
}

/**
 * Pure state transition for tenant-admin updates (`PUT /settings/ai-config`).
 * Strictly preserves `existing.platformEntitlement` untouched so workspace admins
 * can never raise plan quotas or enable BYO keys without platform authorization.
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
    selfActionLimit?: number | null;
    selfTokenLimit?: number | null;
    monthlyActionLimit?: number | null;
    monthlyTokenLimit?: number | null;
  },
  baseCfg: ResolvedAiConfig
): StoredTenantAiConfig {
  const ent = existing.platformEntitlement;
  const aiDisabledByPlan = ent?.aiEnabled === false;
  const effectiveAllowByoKey = aiDisabledByPlan
    ? false
    : typeof ent?.allowByoKey === 'boolean'
      ? ent.allowByoKey
      : baseCfg.allowByoKey;

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

  const requestedActionLimit =
    input.selfActionLimit !== undefined ? input.selfActionLimit : input.monthlyActionLimit;
  const requestedTokenLimit =
    input.selfTokenLimit !== undefined ? input.selfTokenLimit : input.monthlyTokenLimit;

  const nextSelfActionLimit = normalizeTenantSelfCapOrNull(requestedActionLimit);
  const nextSelfTokenLimit = normalizeTenantSelfCapOrNull(requestedTokenLimit);

  const existingSelfAction = readSelfCap(existing.selfActionLimit ?? existing.monthlyActionLimit);
  const existingSelfToken = readSelfCap(existing.selfTokenLimit ?? existing.monthlyTokenLimit);

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
    selfActionLimit:
      nextSelfActionLimit !== undefined ? nextSelfActionLimit : existingSelfAction,
    selfTokenLimit:
      nextSelfTokenLimit !== undefined ? nextSelfTokenLimit : existingSelfToken,
    ...(ent ? { platformEntitlement: ent } : {}),
  };
}

/**
 * Pure state transition for platform / white-label partner entitlement updates.
 * Preserves tenant-configured BYO keys and optional self-budget preferences untouched.
 */
export function mergePlatformEntitlementPure(
  existing: StoredTenantAiConfig,
  input: {
    planTier?: string;
    aiEnabled?: boolean | null;
    allowByoKey?: boolean | null;
    actionCenterAgentEnabled?: boolean | null;
    monthlyActionLimit?: number | null;
    monthlyTokenLimit?: number | null;
  }
): StoredTenantAiConfig {
  const prev = existing.platformEntitlement || {};
  const nextEntitlement: PlatformTenantAiEntitlement = {
    planTier:
      input.planTier !== undefined
        ? String(input.planTier || 'default').trim() || 'default'
        : prev.planTier || 'default',
    aiEnabled:
      input.aiEnabled === undefined
        ? prev.aiEnabled ?? null
        : input.aiEnabled === null
          ? null
          : Boolean(input.aiEnabled),
    allowByoKey:
      input.allowByoKey === undefined
        ? prev.allowByoKey ?? null
        : input.allowByoKey === null
          ? null
          : Boolean(input.allowByoKey),
    actionCenterAgentEnabled:
      input.actionCenterAgentEnabled === undefined
        ? prev.actionCenterAgentEnabled ?? null
        : input.actionCenterAgentEnabled === null
          ? null
          : Boolean(input.actionCenterAgentEnabled),
    monthlyActionLimit:
      input.monthlyActionLimit === undefined
        ? prev.monthlyActionLimit ?? null
        : normalizePlatformCapOrNull(input.monthlyActionLimit) ?? null,
    monthlyTokenLimit:
      input.monthlyTokenLimit === undefined
        ? prev.monthlyTokenLimit ?? null
        : normalizePlatformCapOrNull(input.monthlyTokenLimit) ?? null,
    updatedAt: new Date().toISOString(),
  };

  return {
    ...existing,
    platformEntitlement: nextEntitlement,
  };
}

export class AiUsageService {
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
      selfActionLimit?: number | null;
      selfTokenLimit?: number | null;
      monthlyActionLimit?: number | null;
      monthlyTokenLimit?: number | null;
    }
  ): Promise<PublicTenantByoConfig> {
    const key = tenantId || 'squadpipe-agency';
    const baseCfg = resolveAiConfig();
    const existing = await this.getStoredTenantAiConfig(key);
    const nextStored = mergeTenantAiConfigPure(existing, input, baseCfg);

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
      planTier?: string;
      aiEnabled?: boolean | null;
      allowByoKey?: boolean | null;
      actionCenterAgentEnabled?: boolean | null;
      monthlyActionLimit?: number | null;
      monthlyTokenLimit?: number | null;
    }
  ): Promise<PlatformTenantAiEntitlement> {
    const key = tenantId || 'squadpipe-agency';
    const existing = await this.getStoredTenantAiConfig(key);
    const nextStored = mergePlatformEntitlementPure(existing, input);

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

    return nextStored.platformEntitlement || {};
  }

  async resolveEffectiveRuntimeConfig(
    tenantId?: string,
    env: NodeJS.ProcessEnv = process.env
  ): Promise<{
    config: ResolvedAiConfig;
    usingByoKey: boolean;
    planTier: string;
    aiDisabledByPlan: boolean;
    planActionLimit: number;
    planTokenLimit: number;
    stored: StoredTenantAiConfig;
  }> {
    const baseConfig = resolveAiConfig(env);
    if (!tenantId) {
      return {
        config: baseConfig,
        usingByoKey: false,
        planTier: 'default',
        aiDisabledByPlan: false,
        planActionLimit: baseConfig.monthlyActionLimit,
        planTokenLimit: baseConfig.monthlyTokenLimit,
        stored: { byoEnabled: false },
      };
    }
    const stored = await this.getStoredTenantAiConfig(tenantId);
    const merged = applyTenantByoOverridePure(baseConfig, stored);
    return { ...merged, stored };
  }

  async checkQuota(
    tenantId = 'squadpipe-agency',
    effectiveConfig?: ResolvedAiConfig
  ): Promise<QuotaCheckResult> {
    const cfg =
      effectiveConfig || (await this.resolveEffectiveRuntimeConfig(tenantId)).config;
    const monthStart = getUtcMonthStart();

    try {
      const agg = await prisma.aiUsageLog.aggregate({
        where: {
          tenantId,
          createdAt: { gte: monthStart },
        },
        _count: { _all: true },
        _sum: {
          inputTokens: true,
          outputTokens: true,
        },
      });

      const actionsUsed = agg._count?._all || 0;
      const tokensUsed =
        (agg._sum?.inputTokens || 0) + (agg._sum?.outputTokens || 0);

      return evaluateQuotaStatusPure({
        actionsUsed,
        tokensUsed,
        actionLimit: cfg.monthlyActionLimit,
        tokenLimit: cfg.monthlyTokenLimit,
      });
    } catch {
      return evaluateQuotaStatusPure({
        actionsUsed: 0,
        tokensUsed: 0,
        actionLimit: cfg.monthlyActionLimit,
        tokenLimit: cfg.monthlyTokenLimit,
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
    try {
      await prisma.aiUsageLog.create({
        data: {
          tenantId: params.tenantId || 'squadpipe-agency',
          userId: params.userId || null,
          provider: params.provider,
          model: params.model,
          feature: params.feature,
          inputTokens: Math.max(0, Math.round(params.inputTokens || 0)),
          outputTokens: Math.max(0, Math.round(params.outputTokens || 0)),
          latencyMs: Math.max(0, Math.round(params.latencyMs || 0)),
        },
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

  async getPlatformAiEntitlement(tenantId = 'squadpipe-agency'): Promise<PlatformTenantAiEntitlement> {
    const stored = await this.getStoredTenantAiConfig(tenantId);
    const ent = stored.platformEntitlement || {};
    return {
      planTier: ent.planTier || 'default',
      aiEnabled: ent.aiEnabled ?? null,
      allowByoKey: ent.allowByoKey ?? null,
      actionCenterAgentEnabled: ent.actionCenterAgentEnabled ?? null,
      monthlyActionLimit: ent.monthlyActionLimit ?? null,
      monthlyTokenLimit: ent.monthlyTokenLimit ?? null,
      ...(ent.updatedAt ? { updatedAt: ent.updatedAt } : {}),
    };
  }

  async getMonthlyUsageSummary(tenantId = 'squadpipe-agency'): Promise<TenantAiUsageSummary> {
    const monthStart = getUtcMonthStart();
    const {
      config,
      usingByoKey,
      planTier,
      aiDisabledByPlan,
      planActionLimit,
      planTokenLimit,
      stored,
    } = await this.resolveEffectiveRuntimeConfig(tenantId);

    const byFeature: TenantAiUsageSummary['byFeature'] = {
      resume_parse: { actions: 0, inputTokens: 0, outputTokens: 0 },
      email_parse: { actions: 0, inputTokens: 0, outputTokens: 0 },
      capability_check: { actions: 0, inputTokens: 0, outputTokens: 0 },
      match_rank: { actions: 0, inputTokens: 0, outputTokens: 0 },
      pitch_draft: { actions: 0, inputTokens: 0, outputTokens: 0 },
      agent_prep: { actions: 0, inputTokens: 0, outputTokens: 0 },
    };

    let actionsUsed = 0;
    let totalInput = 0;
    let totalOutput = 0;

    try {
      const grouped = await prisma.aiUsageLog.groupBy({
        by: ['feature'],
        where: {
          tenantId,
          createdAt: { gte: monthStart },
        },
        _count: { _all: true },
        _sum: {
          inputTokens: true,
          outputTokens: true,
        },
      });

      for (const row of grouped) {
        const count = row._count._all || 0;
        const inp = row._sum.inputTokens || 0;
        const out = row._sum.outputTokens || 0;
        actionsUsed += count;
        totalInput += inp;
        totalOutput += out;

        if (row.feature in byFeature) {
          const key = row.feature as AiUsageFeature;
          byFeature[key] = { actions: count, inputTokens: inp, outputTokens: out };
        }
      }
    } catch {
      // Graceful zero summary if table/query is unavailable
    }

    const quota = evaluateQuotaStatusPure({
      actionsUsed,
      tokensUsed: totalInput + totalOutput,
      actionLimit: config.monthlyActionLimit,
      tokenLimit: config.monthlyTokenLimit,
    });

    return {
      monthStart: monthStart.toISOString(),
      activeProvider: config.configured ? config.provider : 'none',
      aiConfigured: config.configured,
      usingByoKey,
      allowByoKey: config.allowByoKey,
      planTier,
      aiDisabledByPlan,
      planActionLimit,
      planTokenLimit,
      actionsUsed,
      inputTokens: totalInput,
      outputTokens: totalOutput,
      tokensUsed: totalInput + totalOutput,
      actionLimit: config.monthlyActionLimit,
      tokenLimit: config.monthlyTokenLimit,
      quotaExceeded: quota.exceeded,
      ...(quota.reason ? { quotaReason: quota.reason } : {}),
      byFeature,
      byo: sanitizeStoredTenantAiConfig(stored),
    };
  }
}

export const aiUsageService = new AiUsageService();
