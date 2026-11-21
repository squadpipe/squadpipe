const KNOWN_INSECURE_SECRETS = new Set([
  'dev_secret_key',
  'secret',
  'changeme',
  'your_jwt_secret',
  'your_super_secret_jwt_key',
  'your_super_secret_jwt_key_change_in_production',
  'talentos_secret',
  'squadpipe_secret',
]);

export function getJwtAccessSecret(): string {
  const configured = (process.env.JWT_ACCESS_SECRET || '').trim();
  const isProd = process.env.NODE_ENV === 'production';

  if (isProd) {
    if (!configured) {
      throw new Error('FATAL: JWT_ACCESS_SECRET must be set in production.');
    }
    if (
      configured.length < 32 ||
      KNOWN_INSECURE_SECRETS.has(configured.toLowerCase()) ||
      configured.toLowerCase().includes('change_in_production') ||
      configured.toLowerCase().includes('replace-with')
    ) {
      throw new Error(
        'FATAL: JWT_ACCESS_SECRET in production must be at least 32 characters and not a default placeholder.'
      );
    }
    return configured;
  }

  return configured || 'dev_secret_key';
}

export function getJwtAccessExpiry(): string {
  return (process.env.JWT_ACCESS_EXPIRY || '7d').trim() || '7d';
}

export function getJwtRefreshExpiry(): string {
  return (process.env.JWT_REFRESH_EXPIRY || '7d').trim() || '7d';
}

export function parseDurationToMs(spec: string, fallbackMs: number): number {
  const cleaned = String(spec || '').trim().toLowerCase();
  if (!cleaned) return fallbackMs;

  if (/^\d+$/.test(cleaned)) {
    const seconds = Number(cleaned);
    return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : fallbackMs;
  }

  const match = cleaned.match(/^(\d+)\s*(ms|s|m|h|d|w)$/);
  if (!match) return fallbackMs;

  const value = Number(match[1]);
  const unit = match[2];
  if (!Number.isFinite(value) || value <= 0) return fallbackMs;

  const multipliers: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
  };
  return value * (multipliers[unit] || 1000);
}

const SHORT_SESSION_FALLBACK_MS = 24 * 60 * 60 * 1000;
const DEFAULT_REFRESH_MS = 7 * 24 * 60 * 60 * 1000;

export function getJwtRefreshExpiryMs(persistent = true): number {
  const configuredMs = parseDurationToMs(getJwtRefreshExpiry(), DEFAULT_REFRESH_MS);
  if (!persistent) {
    return Math.min(configuredMs, SHORT_SESSION_FALLBACK_MS);
  }
  return configuredMs;
}

