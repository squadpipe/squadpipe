import type { AiProviderName, ResolvedAiConfig } from '../../config/ai.config';
import { aiService } from '../ai/ai.service';
import type { FetchLike } from '../ai/providers/openaiCompatible.provider';

export const EMBEDDING_DIMENSIONS = 768;

export interface EmbeddingBatchResult {
  vectors: number[][];
  model: string;
  provider: AiProviderName;
  inputTokens?: number;
}

function l2Normalize(vec: number[]): number[] {
  let normSq = 0;
  for (const val of vec) {
    normSq += val * val;
  }
  if (!Number.isFinite(normSq) || normSq <= 0) return vec;
  const norm = Math.sqrt(normSq);
  return vec.map((v) => v / norm);
}

export function sanitizeEmbeddingVector(raw: unknown): number[] | null {
  if (!Array.isArray(raw) || raw.length !== EMBEDDING_DIMENSIONS) return null;
  const nums: number[] = [];
  for (const val of raw) {
    const n = Number(val);
    if (!Number.isFinite(n)) return null;
    nums.push(n);
  }
  return l2Normalize(nums);
}

/**
 * Formats a verified 768-dim finite float vector into a pgvector literal string `"[x1,x2,...]"`.
 */
export function toPgVectorLiteral(raw: number[]): string {
  const normalized = sanitizeEmbeddingVector(raw);
  if (!normalized) {
    throw new Error(`Embedding vector must contain exactly ${EMBEDDING_DIMENSIONS} finite numbers.`);
  }
  return `[${normalized.map((n) => Number(n.toFixed(6))).join(',')}]`;
}

function resolveOpenAiCompatibleEmbeddingEndpoint(config: ResolvedAiConfig): {
  url: string;
  apiKey: string;
  model: string;
  provider: AiProviderName;
} | null {
  const gateway = config.gatewayBaseUrl.trim().replace(/\/+$/, '');

  if (config.provider === 'openai' && config.credentials.openaiApiKey) {
    return {
      url: `${gateway || 'https://api.openai.com/v1'}/embeddings`,
      apiKey: config.credentials.openaiApiKey,
      model: config.embeddingModel || 'text-embedding-3-small',
      provider: 'openai',
    };
  }
  if (config.provider === 'cloudflare' && config.credentials.cloudflareAccountId && config.credentials.cloudflareApiToken) {
    return {
      url: `${
        gateway ||
        `https://api.cloudflare.com/client/v4/accounts/${config.credentials.cloudflareAccountId}/ai/v1`
      }/embeddings`,
      apiKey: config.credentials.cloudflareApiToken,
      model: config.embeddingModel || '@cf/baai/bge-base-en-v1.5',
      provider: 'cloudflare',
    };
  }
  if ((config.provider === 'ollama' || config.provider === 'custom') && config.credentials.customBaseUrl) {
    return {
      url: `${gateway || config.credentials.customBaseUrl.replace(/\/+$/, '')}/embeddings`,
      apiKey: config.credentials.customApiKey,
      model: config.embeddingModel || (config.provider === 'ollama' ? 'nomic-embed-text' : 'text-embedding-3-small'),
      provider: config.provider,
    };
  }

  // Anthropic lacks native embeddings; gracefully use server OpenAI key if available
  if (config.provider === 'anthropic' && process.env.OPENAI_API_KEY) {
    return {
      url: `${gateway || 'https://api.openai.com/v1'}/embeddings`,
      apiKey: String(process.env.OPENAI_API_KEY).trim(),
      model: String(process.env.AI_EMBEDDING_MODEL || '').trim() || 'text-embedding-3-small',
      provider: 'openai',
    };
  }

  return null;
}

/**
 * Generates L2-normalized 768-dim vectors across OpenAI, Gemini, Ollama, Cloudflare, or Custom endpoints.
 * Returns `null` silently when AI / embeddings are unconfigured or unavailable so SQL FTS still works.
 */
export class EmbeddingService {
  private readonly fetchFn: FetchLike;

  constructor(fetchImpl: FetchLike = fetch) {
    this.fetchFn = fetchImpl;
  }

  async isConfiguredForTenant(tenantId?: string): Promise<boolean> {
    const { config, adapter } = await aiService.getActiveRuntime({ tenantId });
    if (!config.configured || !adapter.isConfigured()) return false;
    if (config.provider === 'gemini' && config.credentials.geminiApiKey) return true;
    if (config.provider === 'anthropic' && process.env.GEMINI_API_KEY) return true;
    return Boolean(resolveOpenAiCompatibleEmbeddingEndpoint(config));
  }

  async embedTexts(
    texts: string[],
    options: { tenantId?: string; configOverride?: ResolvedAiConfig; timeoutMs?: number } = {}
  ): Promise<EmbeddingBatchResult | null> {
    const cleanInputs = texts.map((t) => String(t || '').trim().slice(0, 6000)).filter(Boolean);
    if (cleanInputs.length === 0) return null;

    let config = options.configOverride;
    if (!config) {
      const runtime = await aiService.getActiveRuntime({ tenantId: options.tenantId });
      if (!runtime.config.configured || !runtime.adapter.isConfigured()) return null;
      config = runtime.config;
    }
    if (!config.configured) return null;
    const reqTimeoutMs = options.timeoutMs ?? config.timeoutMs;

    // Gemini native REST batchEmbedContents supports outputDimensionality=768
    const geminiKey =
      config.provider === 'gemini'
        ? config.credentials.geminiApiKey
        : config.provider === 'anthropic'
          ? String(process.env.GEMINI_API_KEY || '').trim()
          : '';

    if (geminiKey && (config.provider === 'gemini' || (config.provider === 'anthropic' && !process.env.OPENAI_API_KEY))) {
      const modelName = (config.embeddingModel || 'gemini-embedding-001').replace(/^models\//, '');
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        modelName
      )}:batchEmbedContents`;

      try {
        const res = await this.fetchFn(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': geminiKey,
          },
          body: JSON.stringify({
            requests: cleanInputs.map((text) => ({
              model: `models/${modelName}`,
              content: { parts: [{ text }] },
              outputDimensionality: EMBEDDING_DIMENSIONS,
            })),
          }),
          signal: AbortSignal.timeout(reqTimeoutMs),
        });
        if (!res.ok) return null;
        const json: any = await res.json();
        const embeddingsRaw = Array.isArray(json?.embeddings) ? json.embeddings : [];
        const vectors = embeddingsRaw
          .map((item: any) => sanitizeEmbeddingVector(item?.values))
          .filter((v: number[] | null): v is number[] => Boolean(v));
        if (vectors.length !== cleanInputs.length) return null;
        return { vectors, model: modelName, provider: 'gemini' };
      } catch {
        return null;
      }
    }

    const endpoint = resolveOpenAiCompatibleEmbeddingEndpoint(config);
    if (!endpoint) return null;

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (endpoint.apiKey) headers.Authorization = `Bearer ${endpoint.apiKey}`;

      const body: Record<string, unknown> = {
        model: endpoint.model,
        input: cleanInputs,
      };
      if (endpoint.provider === 'openai' || endpoint.provider === 'custom') {
        body.dimensions = EMBEDDING_DIMENSIONS;
      }

      const res = await this.fetchFn(endpoint.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(config.timeoutMs),
      });
      if (!res.ok) return null;
      const json: any = await res.json();
      const rows = Array.isArray(json?.data)
        ? [...json.data].sort((a: any, b: any) => Number(a?.index ?? 0) - Number(b?.index ?? 0))
        : [];
      const vectors = rows
        .map((r: any) => sanitizeEmbeddingVector(r?.embedding))
        .filter((v: number[] | null): v is number[] => Boolean(v));
      if (vectors.length !== cleanInputs.length) return null;

      return {
        vectors,
        model: String(json?.model || endpoint.model),
        provider: endpoint.provider,
        inputTokens: typeof json?.usage?.prompt_tokens === 'number' ? json.usage.prompt_tokens : undefined,
      };
    } catch {
      return null;
    }
  }
}

export const embeddingService = new EmbeddingService();
