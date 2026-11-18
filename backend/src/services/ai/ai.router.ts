import { resolveAiConfig, type ResolvedAiConfig } from '../../config/ai.config';
import type { AiProviderAdapter } from './ai.types';
import { NoneAiProvider } from './providers/none.provider';
import { AnthropicAiProvider } from './providers/anthropic.provider';
import {
  OpenAiCompatibleProvider,
  type FetchLike,
} from './providers/openaiCompatible.provider';

/**
 * Instantiates the provider adapter matching a resolved configuration.
 */
export function createAiAdapter(
  config: ResolvedAiConfig = resolveAiConfig(),
  fetchImpl?: FetchLike
): AiProviderAdapter {
  if (!config.configured || config.provider === 'none') {
    return new NoneAiProvider();
  }

  if (config.provider === 'anthropic') {
    return new AnthropicAiProvider(config, fetchImpl);
  }

  return new OpenAiCompatibleProvider(config, fetchImpl);
}

/**
 * Resolves live AI config and adapter for the current environment (or supplied env override).
 */
export function getAiAdapter(
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl?: FetchLike
): { config: ResolvedAiConfig; adapter: AiProviderAdapter } {
  const config = resolveAiConfig(env);
  return {
    config,
    adapter: createAiAdapter(config, fetchImpl),
  };
}
