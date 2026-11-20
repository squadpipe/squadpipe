import assert from 'node:assert/strict';
import { getPublicAiCapabilities, resolveAiConfig } from '../../src/config/ai.config';

export const runAiConfigTests = () => {
  console.log('--- Running Single-Switch AI Provider Config Tests ---');

  // 1. Default / unset -> AI completely off
  const unsetCaps = getPublicAiCapabilities({});
  assert.equal(unsetCaps.enabled, false);
  assert.equal(unsetCaps.provider, 'none');
  assert.deepEqual(unsetCaps.features, {
    resumeParser: false,
    emailIntake: false,
    capabilityCheck: false,
    pitchDraft: false,
    actionCenterAgent: false,
  });

  // 2. Explicit AI_PROVIDER=none overrides even if API keys exist in env
  const noneCaps = getPublicAiCapabilities({
    AI_PROVIDER: 'none',
    OPENAI_API_KEY: 'sk-test-123',
  });
  assert.equal(noneCaps.enabled, false);
  assert.equal(noneCaps.provider, 'none');

  // 3. Unknown provider safely degrades to offline
  const unknownCaps = getPublicAiCapabilities({
    AI_PROVIDER: 'unknown-vendor',
    OPENAI_API_KEY: 'sk-test-123',
  });
  assert.equal(unknownCaps.enabled, false);
  assert.equal(unknownCaps.provider, 'none');

  // 4. AI_PROVIDER=openai without key -> safely fails closed (enabled: false)
  const missingKeyCaps = getPublicAiCapabilities({
    AI_PROVIDER: 'openai',
    OPENAI_API_KEY: '   ',
  });
  assert.equal(missingKeyCaps.enabled, false);
  assert.equal(missingKeyCaps.provider, 'none');

  // 5. AI_PROVIDER=openai with key -> enabled: true, core features active, agent opt-in off by default
  const openaiCaps = getPublicAiCapabilities({
    AI_PROVIDER: 'OPENAI',
    OPENAI_API_KEY: 'sk-live-secret-key',
  });
  assert.equal(openaiCaps.enabled, true);
  assert.equal(openaiCaps.provider, 'openai');
  assert.equal(openaiCaps.features.resumeParser, true);
  assert.equal(openaiCaps.features.emailIntake, true);
  assert.equal(openaiCaps.features.capabilityCheck, true);
  assert.equal(openaiCaps.features.pitchDraft, true);
  assert.equal(openaiCaps.features.actionCenterAgent, false);
  assert.equal(JSON.stringify(openaiCaps).includes('sk-live-secret-key'), false);

  // 6. Cloudflare requires both account ID and token
  assert.equal(
    getPublicAiCapabilities({
      AI_PROVIDER: 'cloudflare',
      CLOUDFLARE_AI_ACCOUNT_ID: 'acc-123',
    }).enabled,
    false
  );
  assert.equal(
    getPublicAiCapabilities({
      AI_PROVIDER: 'cloudflare',
      CLOUDFLARE_AI_ACCOUNT_ID: 'acc-123',
      CLOUDFLARE_AI_API_TOKEN: 'cf-tok-456',
    }).enabled,
    true
  );

  // 7. Gemini & Anthropic require their respective keys
  assert.equal(getPublicAiCapabilities({ AI_PROVIDER: 'gemini' }).enabled, false);
  assert.equal(
    getPublicAiCapabilities({ AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'gem-key' }).enabled,
    true
  );
  assert.equal(getPublicAiCapabilities({ AI_PROVIDER: 'anthropic' }).enabled, false);
  assert.equal(
    getPublicAiCapabilities({ AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'ant-key' }).enabled,
    true
  );

  // 8. Ollama defaults localhost endpoint; Custom requires explicit AI_CUSTOM_BASE_URL
  const ollamaCfg = resolveAiConfig({ AI_PROVIDER: 'ollama' });
  assert.equal(ollamaCfg.configured, true);
  assert.equal(ollamaCfg.credentials.customBaseUrl, 'http://localhost:11434/v1');
  assert.equal(getPublicAiCapabilities({ AI_PROVIDER: 'custom' }).enabled, false);
  assert.equal(
    getPublicAiCapabilities({
      AI_PROVIDER: 'custom',
      AI_CUSTOM_BASE_URL: 'https://llm.internal.local/v1',
      AI_ACTION_CENTER_AGENT: 'true',
    }).features.actionCenterAgent,
    true
  );

  // 9. Bounds clamping for timeout & maxInputChars + configured AI disables offline fallback by default
  const defaultConfiguredCfg = resolveAiConfig({
    AI_PROVIDER: 'cloudflare',
    CLOUDFLARE_AI_ACCOUNT_ID: 'acc-123',
    CLOUDFLARE_AI_API_TOKEN: 'cf-tok-456',
  });
  assert.equal(defaultConfiguredCfg.configured, true);
  assert.equal(defaultConfiguredCfg.fallbackToOffline, false);

  const boundedCfg = resolveAiConfig({
    AI_PROVIDER: 'openai',
    OPENAI_API_KEY: 'sk-123',
    AI_TIMEOUT_MS: '50',
    AI_MAX_INPUT_CHARS: '9999999',
    AI_FALLBACK_TO_OFFLINE: 'true',
  });
  assert.equal(boundedCfg.timeoutMs, 1000);
  assert.equal(boundedCfg.maxInputChars, 100000);
  assert.equal(boundedCfg.fallbackToOffline, true);

  console.log('✅ Single-Switch AI Provider Config Tests: PASSED');
};
