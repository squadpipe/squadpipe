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

