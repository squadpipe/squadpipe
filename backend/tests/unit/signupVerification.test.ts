import assert from 'node:assert/strict';
import { isOtpDevFallbackEnabled } from '../../src/controllers/auth.controller';
import { getTenantSettings, saveGeneralSettings } from '../../src/config/smtp.config';
import { prisma } from '../../src/config/prisma.config';

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

export async function runSignupVerificationTests() {
  console.log('--- Running Signup OTP Dev Fallback & Tenant Onboarding Config Tests ---');

  // 1. Explicit OTP_DEV_FALLBACK flag overrides NODE_ENV=production safely
  withEnv({ NODE_ENV: 'production', OTP_DEV_FALLBACK: 'true' }, () => {
    assert.equal(isOtpDevFallbackEnabled(), true, 'OTP_DEV_FALLBACK=true must enable dev fallback even when NODE_ENV=production');
  });

  // 2. Strict production behavior when OTP_DEV_FALLBACK is false or unset under NODE_ENV=production
  withEnv({ NODE_ENV: 'production', OTP_DEV_FALLBACK: 'false' }, () => {
    assert.equal(isOtpDevFallbackEnabled(), false, 'OTP_DEV_FALLBACK=false must keep production strict');
  });
  withEnv({ NODE_ENV: 'production', OTP_DEV_FALLBACK: undefined }, () => {
    assert.equal(isOtpDevFallbackEnabled(), false, 'Unset OTP_DEV_FALLBACK in production must disable dev fallback');
  });

  // 3. Development default allows local OTP fallback unless explicitly turned off
  withEnv({ NODE_ENV: 'development', OTP_DEV_FALLBACK: undefined }, () => {
    assert.equal(isOtpDevFallbackEnabled(), true, 'Development mode without explicit flag enables OTP fallback');
  });
  withEnv({ NODE_ENV: 'development', OTP_DEV_FALLBACK: 'false' }, () => {
    assert.equal(isOtpDevFallbackEnabled(), false, 'Explicit OTP_DEV_FALLBACK=false disables fallback even in dev');
  });

  // 4. Tenant onboardingCompleted backwards compatibility (with mocked Prisma methods)
  const originalExec = prisma.$executeRawUnsafe;
  const originalQuery = prisma.$queryRawUnsafe;
  const fakeStore = new Map<string, any>();

  (prisma as any).$executeRawUnsafe = async (sql: string, ...args: any[]) => {
    if (sql.includes('INSERT INTO tenant_settings') && args[0] && args[1]) {
      const parsed = JSON.parse(String(args[1]));
      if (sql.includes('ON CONFLICT (tenant_id) DO UPDATE') || !fakeStore.has(args[0])) {
        fakeStore.set(args[0], parsed);
      }
    }
    return 1;
  };
  (prisma as any).$queryRawUnsafe = async (_sql: string, tenantId: string) => {
    if (!fakeStore.has(tenantId)) return [];
    return [{ general_config: fakeStore.get(tenantId) }];
  };

  try {
    // Legacy tenant missing onboardingCompleted flag defaults to true
    fakeStore.set('legacy_tenant', { agencyName: 'Legacy Co' });
    const legacy = await getTenantSettings('legacy_tenant');
    assert.equal(
      legacy.general.onboardingCompleted,
      true,
      'Legacy tenant without onboardingCompleted key must remain completed (true)'
    );

    // Brand-new tenant initialized with onboardingCompleted: false stays pending until completed
    await saveGeneralSettings('new_tenant_1', {
      agencyName: 'New Agency',
      onboardingCompleted: false,
    });
    const pending = await getTenantSettings('new_tenant_1');
    assert.equal(
      pending.general.onboardingCompleted,
      false,
      'New signup tenant must persist onboardingCompleted=false'
    );

    // Saving partial Step 1 settings does not accidentally reset onboardingCompleted to true
    await saveGeneralSettings('new_tenant_1', {
      headquarters: 'Austin, TX',
    });
    const midOnboarding = await getTenantSettings('new_tenant_1');
    assert.equal(
      midOnboarding.general.onboardingCompleted,
      false,
      'Partial settings save during onboarding must preserve onboardingCompleted=false'
    );

    // Completing or skipping marks onboardingCompleted=true
    await saveGeneralSettings('new_tenant_1', {
      onboardingCompleted: true,
    });
    const completed = await getTenantSettings('new_tenant_1');
    assert.equal(
      completed.general.onboardingCompleted,
      true,
      'Completing onboarding must flip onboardingCompleted=true'
    );
  } finally {
    (prisma as any).$executeRawUnsafe = originalExec;
    (prisma as any).$queryRawUnsafe = originalQuery;
  }

  console.log('  ✅ Signup OTP dev fallback matrix & tenant onboarding persistence passed');
}
