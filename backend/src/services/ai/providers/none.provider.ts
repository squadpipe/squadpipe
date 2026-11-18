import type { AiCompleteParams, AiCompletionResult, AiProviderAdapter } from '../ai.types';

/**
 * Offline / non-AI provider adapter. Ensures calling code cleanly recognizes AI is disabled.
 */
export class NoneAiProvider implements AiProviderAdapter {
  readonly name = 'none' as const;

  isConfigured(): boolean {
    return false;
  }

  async complete(_params: AiCompleteParams): Promise<AiCompletionResult> {
    throw new Error('AI provider is disabled (AI_PROVIDER=none).');
  }
}
