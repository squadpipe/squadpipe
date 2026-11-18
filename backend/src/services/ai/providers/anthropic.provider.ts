import type { ResolvedAiConfig } from '../../../config/ai.config';
import type { AiCompleteParams, AiCompletionResult, AiProviderAdapter } from '../ai.types';
import type { FetchLike } from './openaiCompatible.provider';

function buildAnthropicMessagesUrl(gatewayBaseUrl: string): string {
  const trimmed = gatewayBaseUrl.trim().replace(/\/+$/, '');
  if (!trimmed) return 'https://api.anthropic.com/v1/messages';
  if (trimmed.endsWith('/v1/messages')) return trimmed;
  if (trimmed.endsWith('/messages')) return trimmed;
  if (trimmed.endsWith('/v1')) return `${trimmed}/messages`;
  return `${trimmed}/v1/messages`;
}

/**
 * Native-fetch adapter for Anthropic Claude Messages API.
 */
export class AnthropicAiProvider implements AiProviderAdapter {
  readonly name = 'anthropic' as const;
  private readonly config: ResolvedAiConfig;
  private readonly fetchFn: FetchLike;

  constructor(config: ResolvedAiConfig, fetchImpl: FetchLike = fetch) {
    this.config = config;
    this.fetchFn = fetchImpl;
  }

  isConfigured(): boolean {
    return (
      this.config.provider === 'anthropic' &&
      this.config.configured &&
      Boolean(this.config.credentials.anthropicApiKey)
    );
  }

  async complete(params: AiCompleteParams): Promise<AiCompletionResult> {
    if (!this.isConfigured()) {
      throw new Error('Anthropic AI provider is not configured.');
    }

    const endpoint = buildAnthropicMessagesUrl(this.config.gatewayBaseUrl);
    const model = params.tier === 'smart' ? this.config.modelSmart : this.config.modelFast;
    const timeoutMs = params.timeoutMs ?? this.config.timeoutMs;
    const startedAt = Date.now();

    const systemParts: string[] = [];
    const nonSystemMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    for (const msg of params.messages) {
      if (msg.role === 'system') {
        systemParts.push(msg.content);
      } else {
        nonSystemMessages.push({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content,
        });
      }
    }

    const body: Record<string, unknown> = {
      model,
      max_tokens: params.maxTokens ?? 1400,
      temperature: params.temperature ?? 0.2,
      messages:
        nonSystemMessages.length > 0
          ? nonSystemMessages
          : [{ role: 'user', content: 'Respond with valid JSON.' }],
    };

    if (systemParts.length > 0) {
      body.system = systemParts.join('\n\n');
    }

    const response = await this.fetchFn(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.credentials.anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(
        `Anthropic AI request failed with status ${response.status}: ${errText.slice(0, 200)}`
      );
    }

    const json: any = await response.json();
    const text = Array.isArray(json?.content)
      ? json.content
          .filter((b: any) => b?.type === 'text' && typeof b?.text === 'string')
          .map((b: any) => b.text)
          .join('\n')
          .trim()
      : '';

    if (!text) {
      throw new Error('Anthropic AI returned an empty completion.');
    }

    return {
      text,
      provider: 'anthropic',
      model: String(json?.model || model),
      inputTokens:
        typeof json?.usage?.input_tokens === 'number' ? json.usage.input_tokens : undefined,
      outputTokens:
        typeof json?.usage?.output_tokens === 'number' ? json.usage.output_tokens : undefined,
      latencyMs: Date.now() - startedAt,
    };
  }
}
