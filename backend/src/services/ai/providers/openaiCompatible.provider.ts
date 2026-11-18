import type { AiProviderName, ResolvedAiConfig } from '../../../config/ai.config';
import type { AiCompleteParams, AiCompletionResult, AiProviderAdapter } from '../ai.types';

export type FetchLike = typeof fetch;

function buildChatCompletionsUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  if (trimmed.endsWith('/chat/completions')) return trimmed;
  return `${trimmed}/chat/completions`;
}

function resolveBaseUrlAndKey(config: ResolvedAiConfig): { baseUrl: string; apiKey: string } {
  const gateway = config.gatewayBaseUrl.trim();
  switch (config.provider) {
    case 'openai':
      return {
        baseUrl: gateway || 'https://api.openai.com/v1',
        apiKey: config.credentials.openaiApiKey,
      };
    case 'gemini':
      return {
        baseUrl: gateway || 'https://generativelanguage.googleapis.com/v1beta/openai',
        apiKey: config.credentials.geminiApiKey,
      };
    case 'cloudflare':
      return {
        baseUrl:
          gateway ||
          `https://api.cloudflare.com/client/v4/accounts/${config.credentials.cloudflareAccountId}/ai/v1`,
        apiKey: config.credentials.cloudflareApiToken,
      };
    case 'ollama':
    case 'custom':
      return {
        baseUrl: gateway || config.credentials.customBaseUrl,
        apiKey: config.credentials.customApiKey,
      };
    default:
      return { baseUrl: '', apiKey: '' };
  }
}

function extractMessageText(content: unknown): string {
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part: any) => (typeof part === 'string' ? part : String(part?.text || '')))
      .join('\n')
      .trim();
  }
  return '';
}

/**
 * Unified native-fetch adapter for OpenAI, Google Gemini (OpenAI endpoint),
 * Cloudflare Workers AI, Ollama, and custom OpenAI-compatible servers.
 */
export class OpenAiCompatibleProvider implements AiProviderAdapter {
  readonly name: AiProviderName;
  private readonly config: ResolvedAiConfig;
  private readonly fetchFn: FetchLike;

  constructor(config: ResolvedAiConfig, fetchImpl: FetchLike = fetch) {
    this.name = config.provider;
    this.config = config;
    this.fetchFn = fetchImpl;
  }

  isConfigured(): boolean {
    const { baseUrl } = resolveBaseUrlAndKey(this.config);
    return this.config.configured && Boolean(baseUrl);
  }

  async complete(params: AiCompleteParams): Promise<AiCompletionResult> {
    if (!this.isConfigured()) {
      throw new Error(`AI provider "${this.name}" is not configured.`);
    }

    const { baseUrl, apiKey } = resolveBaseUrlAndKey(this.config);
    const endpoint = buildChatCompletionsUrl(baseUrl);
    const model = params.tier === 'smart' ? this.config.modelSmart : this.config.modelFast;
    const timeoutMs = params.timeoutMs ?? this.config.timeoutMs;
    const startedAt = Date.now();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    const runRequest = async (includeResponseFormat: boolean): Promise<Response> => {
      const body: Record<string, unknown> = {
        model,
        messages: params.messages,
        temperature: params.temperature ?? 0.2,
      };
      if (params.maxTokens) {
        body.max_tokens = params.maxTokens;
      }
      if (includeResponseFormat) {
        body.response_format = { type: 'json_object' };
      }

      return this.fetchFn(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    };

    let response = await runRequest(Boolean(params.expectJson));
    if (!response.ok && response.status === 400 && params.expectJson) {
      const errPreview = await response.text().catch(() => '');
      if (/response_format|json_object/i.test(errPreview)) {
        response = await runRequest(false);
      } else {
        throw new Error(
          `AI provider "${this.name}" failed with status 400: ${errPreview.slice(0, 200)}`
        );
      }
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(
        `AI provider "${this.name}" failed with status ${response.status}: ${errText.slice(0, 200)}`
      );
    }

    const json: any = await response.json();
    const text = extractMessageText(json?.choices?.[0]?.message?.content);
    if (!text) {
      throw new Error(`AI provider "${this.name}" returned an empty completion.`);
    }

    return {
      text,
      provider: this.name,
      model: String(json?.model || model),
      inputTokens:
        typeof json?.usage?.prompt_tokens === 'number' ? json.usage.prompt_tokens : undefined,
      outputTokens:
        typeof json?.usage?.completion_tokens === 'number'
          ? json.usage.completion_tokens
          : undefined,
      latencyMs: Date.now() - startedAt,
    };
  }
}
