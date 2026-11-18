import { z } from 'zod';
import type { AiChatMessage, AiCompletionResult, AiProviderAdapter, AiTaskTier } from './ai.types';

/**
 * Removes surrounding markdown code fences and extracts the outermost JSON object if extra prose surrounds it.
 */
export function stripJsonMarkdownFences(rawText: string): string {
  let cleaned = String(rawText || '').trim();
  const fenced = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced && fenced[1]) {
    cleaned = fenced[1].trim();
  }

  if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
    return cleaned;
  }

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return cleaned.slice(firstBrace, lastBrace + 1).trim();
  }
  return cleaned;
}

export function parseAndValidateJson<T>(
  rawText: string,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>
): { ok: true; data: T } | { ok: false; error: string } {
  const candidate = stripJsonMarkdownFences(rawText);
  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch (err: any) {
    return {
      ok: false,
      error: `Invalid JSON syntax: ${err?.message || 'Unable to parse JSON'}`,
    };
  }

  const validated = schema.safeParse(parsed);
  if (!validated.success) {
    const issueSummary = validated.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join('.') || 'root'}: ${i.message}`)
      .join('; ');
    return {
      ok: false,
      error: `Schema validation failed: ${issueSummary}`,
    };
  }

  return { ok: true, data: validated.data };
}

/**
 * Executes an AI completion expecting JSON, validates with Zod, and runs at most
 * one lightweight repair retry if the initial output fails JSON parsing or schema checks.
 */
export async function completeValidatedJson<T>(params: {
  adapter: AiProviderAdapter;
  tier: AiTaskTier;
  messages: AiChatMessage[];
  schema: z.ZodType<T, z.ZodTypeDef, unknown>;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<{
  data: T;
  completion: AiCompletionResult;
  repaired: boolean;
}> {
  const first = await params.adapter.complete({
    tier: params.tier,
    messages: params.messages,
    temperature: params.temperature ?? 0.1,
    maxTokens: params.maxTokens,
    expectJson: true,
    timeoutMs: params.timeoutMs,
  });

  const firstAttempt = parseAndValidateJson(first.text, params.schema);
  if (firstAttempt.ok) {
    return { data: firstAttempt.data, completion: first, repaired: false };
  }

  const repairMessages: AiChatMessage[] = [
    {
      role: 'system',
      content:
        'You repair malformed JSON outputs. Return ONLY valid raw JSON with no markdown fences and no explanation.',
    },
    {
      role: 'user',
      content: `Fix this JSON output so it passes validation (${firstAttempt.error}):\n\n${first.text.slice(0, 6000)}`,
    },
  ];

  const second = await params.adapter.complete({
    tier: 'fast',
    messages: repairMessages,
    temperature: 0,
    maxTokens: params.maxTokens,
    expectJson: true,
    timeoutMs: params.timeoutMs,
  });

  const secondAttempt = parseAndValidateJson(second.text, params.schema);
  if (!secondAttempt.ok) {
    throw new Error(`AI JSON repair failed: ${secondAttempt.error}`);
  }

  const combinedCompletion: AiCompletionResult = {
    text: second.text,
    provider: second.provider,
    model: second.model || first.model,
    inputTokens: (first.inputTokens ?? 0) + (second.inputTokens ?? 0) || undefined,
    outputTokens: (first.outputTokens ?? 0) + (second.outputTokens ?? 0) || undefined,
    latencyMs: first.latencyMs + second.latencyMs,
  };

  return {
    data: secondAttempt.data,
    completion: combinedCompletion,
    repaired: true,
  };
}
