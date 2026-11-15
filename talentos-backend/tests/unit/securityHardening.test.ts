import assert from 'node:assert/strict';
import { getJwtAccessSecret } from '../../src/config/jwt.config';
import {
  decryptSecret,
  encryptSecret,
  escapeHtml,
  sanitizeEmailHtml,
} from '../../src/utils/cryptoSecret';
import { isSmtpConfigured } from '../../src/config/smtp.config';
import { DEFAULT_TAXONOMIES } from '../../src/config/taxonomies.config';
import { MasterTaxonomyCategory } from '@prisma/client';
import { getAllowedCorsOrigins } from '../../src/middlewares/security.middleware';
import { sanitizeErrorMessage, sanitizeThrownError } from '../../src/utils/errorSanitizer';
import {
  buildUniqueCvObjectKey,
  resolveCvStorageProvider,
  sanitizeTenantSegment,
} from '../../src/services/cvStorage.service';

function withEnv(overrides: Record<string, string | undefined>, fn: () => void) {
  const previous: Record<string, string | undefined> = {};
  for (const [key, val] of Object.entries(overrides)) {
    previous[key] = process.env[key];
    if (val === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = val;
    }
  }
  try {
    fn();
  } finally {
    for (const [key, val] of Object.entries(previous)) {
      if (val === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = val;
      }
    }
  }
}

export const runSecurityHardeningTests = () => {
  console.log('--- Running Security, Encryption, CORS & Storage Hardening Tests ---');

  // 1. JWT Secret production fail-fast checks
  withEnv({ NODE_ENV: 'production', JWT_ACCESS_SECRET: undefined }, () => {
    assert.throws(() => getJwtAccessSecret(), /must be set in production/i);
  });
  withEnv({ NODE_ENV: 'production', JWT_ACCESS_SECRET: 'dev_secret_key' }, () => {
    assert.throws(() => getJwtAccessSecret(), /at least 32 characters/i);
  });
  withEnv({ NODE_ENV: 'production', JWT_ACCESS_SECRET: 'short_secret' }, () => {
    assert.throws(() => getJwtAccessSecret(), /at least 32 characters/i);
  });
  withEnv(
    {
      NODE_ENV: 'production',
      JWT_ACCESS_SECRET: '9f8e7d6c5b4a392817263544536271809f8e7d6c5b4a',
    },
    () => {
      assert.equal(getJwtAccessSecret(), '9f8e7d6c5b4a392817263544536271809f8e7d6c5b4a');
    }
  );
  withEnv({ NODE_ENV: 'development', JWT_ACCESS_SECRET: undefined }, () => {
    assert.equal(getJwtAccessSecret(), 'dev_secret_key');
  });

  // 2. AES-256-GCM encryption at rest & tampering resistance
  withEnv(
    {
      NODE_ENV: 'production',
      SETTINGS_ENCRYPTION_KEY: 'super_strong_settings_aes_key_2026',
    },
    () => {
      const cipher = encryptSecret('smtp_app_password_xyz!');
      assert.ok(cipher.startsWith('enc:v1:'), 'Encrypted payload must use enc:v1: envelope');
      assert.notEqual(cipher, 'smtp_app_password_xyz!');
      assert.equal(encryptSecret(cipher), cipher, 'Double encryption must be a no-op');
      assert.equal(decryptSecret(cipher), 'smtp_app_password_xyz!');
      assert.equal(decryptSecret('legacy-plaintext'), 'legacy-plaintext');

      // Tamper ciphertext auth tag/data
      const parts = cipher.split(':');
      const tampered = `${parts[0]}:${parts[1]}:${parts[2]}:${parts[3]}:AAAA${parts[4]}`;
      assert.throws(() => decryptSecret(tampered));
    }
  );

  // 3. SMTP configuration check
  assert.equal(isSmtpConfigured(null), false);
  assert.equal(
    isSmtpConfigured({
      enabled: true,
      host: 'smtp.gmail.com',
      port: 587,
      encryption: 'STARTTLS',
      username: 'recruiting@acme.com',
      password: 'app-password',
      fromName: 'Acme Desk',
      fromEmail: 'recruiting@acme.com',
      replyToEmail: 'recruiting@acme.com',
    }),
    true
  );
  assert.equal(
    isSmtpConfigured({
      enabled: false,
      host: 'smtp.gmail.com',
      port: 587,
      encryption: 'STARTTLS',
      username: 'recruiting@acme.com',
      password: 'app-password',
      fromName: 'Acme Desk',
      fromEmail: 'recruiting@acme.com',
      replyToEmail: 'recruiting@acme.com',
    }),
    false
  );

  // 4. Email HTML escaping & XSS sanitization
  assert.equal(
    escapeHtml('<script>alert("xss")</script>'),
    '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
  );
  const sanitized = sanitizeEmailHtml(
    '<p onclick="evil()">Hello</p><script>steal()</script><a href="javascript:alert(1)">Link</a>'
  );
  assert.ok(!sanitized.includes('<script>'));
  assert.ok(!sanitized.includes('onclick='));
  assert.ok(!sanitized.includes('javascript:'));

  // 5. CORS origin restriction in production
  withEnv({ NODE_ENV: 'production', CORS_ORIGIN: '*,https://app.squadpipe.io' }, () => {
    assert.deepEqual(getAllowedCorsOrigins(), ['https://app.squadpipe.io']);
  });
  withEnv({ NODE_ENV: 'production', CORS_ORIGIN: '*', FRONTEND_URL: undefined }, () => {
    assert.deepEqual(getAllowedCorsOrigins(), []);
  });

  // 6. Error sanitization against Postgres / Prisma leakage
  assert.equal(
    sanitizeErrorMessage("Can't reach database server at `postgres:5432`", 'Fallback error', true),
    'Fallback error'
  );
  assert.equal(
    sanitizeThrownError({ code: 'P2002' }, 'Fallback error', false),
    'A record with these details already exists.'
  );

  // 7. Tenant-isolated unique CV object keys
  assert.equal(resolveCvStorageProvider('local'), 'local');
  assert.equal(resolveCvStorageProvider('s3'), 's3');
  assert.equal(resolveCvStorageProvider('cloudflare'), 'cloudflare');
  assert.equal(sanitizeTenantSegment('../evil/tenant'), 'evil_tenant');

  const keyA = buildUniqueCvObjectKey('tenant-acme', 'John Doe Resume.pdf', 'application/pdf');
  const keyB = buildUniqueCvObjectKey('tenant-acme', 'John Doe Resume.pdf', 'application/pdf');
  assert.ok(keyA.objectKey.startsWith('tenants/tenant-acme/cvs/'));
  assert.notEqual(keyA.objectKey, keyB.objectKey, 'Successive uploads must have unique keys');

  // 8. Default taxonomy STAGES include Billable and Archived
  const defaultStageOptions = DEFAULT_TAXONOMIES
    .filter((item) => item.category === MasterTaxonomyCategory.STAGES)
    .map((item) => item.optionValue);
  assert.ok(defaultStageOptions.includes('Billable'), 'Default STAGES taxonomy must include Billable');
  assert.ok(defaultStageOptions.includes('Archived'), 'Default STAGES taxonomy must include Archived');

  console.log('✅ Security, Encryption, CORS & Storage Hardening: PASSED');
};

