export type AiProviderName =
  | 'none'
  | 'cloudflare'
  | 'openai'
  | 'gemini'
  | 'anthropic'
  | 'ollama'
  | 'custom';

export interface AiFeatureFlags {
  resumeParser: boolean;
  emailIntake: boolean;
  capabilityCheck: boolean;
  pitchDraft: boolean;
  actionCenterAgent: boolean;
}

export interface AiCapabilities {
  enabled: boolean;
  provider: AiProviderName;
  allowByoKey?: boolean;
  quotaExceeded?: boolean;
  features: AiFeatureFlags;
}

export interface ResolvedAiConfig {
  provider: AiProviderName;
  configured: boolean;
  fallbackToOffline: boolean;
  allowByoKey: boolean;
  monthlyActionLimit: number;
  monthlyTokenLimit: number;
  timeoutMs: number;
  maxInputChars: number;
  modelFast: string;
  modelSmart: string;
  gatewayBaseUrl: string;
  actionCenterAgentEnabled: boolean;
  credentials: {
    openaiApiKey: string;
    geminiApiKey: string;
    anthropicApiKey: string;
    cloudflareAccountId: string;
    cloudflareApiToken: string;
    customBaseUrl: string;
    customApiKey: string;
  };
}

const VALID_PROVIDERS = new Set<AiProviderName>([
  'none',
  'cloudflare',
  'openai',
  'gemini',
  'anthropic',
  'ollama',
  'custom',
]);

const DEFAULT_FAST_MODELS: Record<AiProviderName, string> = {
  none: '',
  cloudflare: '@cf/meta/llama-3.1-8b-instruct-fp8-fast',
  openai: 'gpt-4o-mini',
  gemini: 'gemini-2.5-flash',
  anthropic: 'claude-3-5-haiku-latest',
  ollama: 'llama3.1:8b',
  custom: 'gpt-4o-mini',
};

const DEFAULT_SMART_MODELS: Record<AiProviderName, string> = {
  none: '',
  cloudflare: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  openai: 'gpt-4.1-mini',
  gemini: 'gemini-2.5-pro',
  anthropic: 'claude-sonnet-4-0',
  ollama: 'qwen2.5:32b',
  custom: 'gpt-4.1-mini',
};

function clampInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function normalizeProvider(raw: string | undefined): AiProviderName {
  const clean = String(raw || 'none').trim().toLowerCase() as AiProviderName;
  return VALID_PROVIDERS.has(clean) ? clean : 'none';
}

function isProviderConfigured(
  provider: AiProviderName,
  credentials: ResolvedAiConfig['credentials']
): boolean {
  switch (provider) {
    case 'none':
      return false;
    case 'openai':
      return Boolean(credentials.openaiApiKey);
    case 'gemini':
      return Boolean(credentials.geminiApiKey);
    case 'anthropic':
      return Boolean(credentials.anthropicApiKey);
    case 'cloudflare':
      return Boolean(credentials.cloudflareAccountId && credentials.cloudflareApiToken);
    case 'ollama':
    case 'custom':
      return Boolean(credentials.customBaseUrl);
    default:
      return false;
  }
}

/**
 * Resolves the server's AI provider configuration from environment variables.
 * Never throws on missing credentials; unconfigured providers safely resolve as disabled.
 */
export function resolveAiConfig(env: NodeJS.ProcessEnv = process.env): ResolvedAiConfig {
  const provider = normalizeProvider(env.AI_PROVIDER);
  const defaultOllamaUrl = provider === 'ollama' ? 'http://localhost:11434/v1' : '';

  const credentials = {
    openaiApiKey: String(env.OPENAI_API_KEY || '').trim(),
    geminiApiKey: String(env.GEMINI_API_KEY || '').trim(),
    anthropicApiKey: String(env.ANTHROPIC_API_KEY || '').trim(),
    cloudflareAccountId: String(env.CLOUDFLARE_AI_ACCOUNT_ID || '').trim(),
    cloudflareApiToken: String(env.CLOUDFLARE_AI_API_TOKEN || '').trim(),
    customBaseUrl: String(env.AI_CUSTOM_BASE_URL || defaultOllamaUrl).trim(),
    customApiKey: String(env.AI_CUSTOM_API_KEY || '').trim(),
  };

  const configured = isProviderConfigured(provider, credentials);
  const fallbackToOffline =
    String(env.AI_FALLBACK_TO_OFFLINE ?? 'true').trim().toLowerCase() !== 'false';
  const allowByoKey =
    String(env.AI_ALLOW_BYO_KEY ?? 'false').trim().toLowerCase() === 'true';
  const actionCenterAgentEnabled =
    String(env.AI_ACTION_CENTER_AGENT ?? 'false').trim().toLowerCase() === 'true';

  return {
    provider,
    configured,
    fallbackToOffline,
    allowByoKey,
    monthlyActionLimit: clampInt(env.AI_MONTHLY_ACTION_LIMIT, 0, 0, 10000000),
    monthlyTokenLimit: clampInt(env.AI_MONTHLY_TOKEN_LIMIT, 0, 0, 1000000000),
    timeoutMs: clampInt(env.AI_TIMEOUT_MS, 20000, 1000, 120000),
    maxInputChars: clampInt(env.AI_MAX_INPUT_CHARS, 16000, 1000, 100000),
    modelFast: String(env.AI_MODEL_FAST || '').trim() || DEFAULT_FAST_MODELS[provider],
    modelSmart: String(env.AI_MODEL_SMART || '').trim() || DEFAULT_SMART_MODELS[provider],
    gatewayBaseUrl: String(env.AI_GATEWAY_BASE_URL || '').trim(),
    actionCenterAgentEnabled,
    credentials,
  };
}

/**
 * Returns non-secret AI capability flags safe to send to frontend clients via GET /settings.
 */
export function getPublicAiCapabilities(env: NodeJS.ProcessEnv = process.env): AiCapabilities {
  const cfg = resolveAiConfig(env);
  if (!cfg.configured) {
    return {
      enabled: false,
      provider: 'none',
      allowByoKey: cfg.allowByoKey,
      features: {
        resumeParser: false,
        emailIntake: false,
        capabilityCheck: false,
        pitchDraft: false,
        actionCenterAgent: false,
      },
    };
  }

  return {
    enabled: true,
    provider: cfg.provider,
    allowByoKey: cfg.allowByoKey,
    features: {
      resumeParser: true,
      emailIntake: true,
      capabilityCheck: true,
      pitchDraft: true,
      actionCenterAgent: cfg.actionCenterAgentEnabled,
    },
  };
}
