/**
 * Resolves the active PostgreSQL connection string for both the backend runtime
 * and container startup/migration scripts.
 */
export const resolveDatabaseUrl = (env: NodeJS.ProcessEnv = process.env): string => {
  const dbLocation = (env.DB_LOCATION || 'in_house').trim();

  if (dbLocation === 'external') {
    const explicitUrl = (env.EXTERNAL_DATABASE_URL || '').trim();
    if (explicitUrl) {
      return explicitUrl;
    }

    const host = (env.EXTERNAL_DB_HOST || '').trim();
    const port = (env.EXTERNAL_DB_PORT || '5432').trim();
    const user = encodeURIComponent(env.EXTERNAL_DB_USER || '');
    const pass = encodeURIComponent(env.EXTERNAL_DB_PASSWORD || '');
    const name = encodeURIComponent(env.EXTERNAL_DB_NAME || '');
    const ssl = (env.EXTERNAL_DB_SSL || '').trim() === 'true' ? '?sslmode=require' : '';
    return `postgresql://${user}:${pass}@${host}:${port}/${name}${ssl}`;
  }

  const user = encodeURIComponent(env.DB_USER || 'squadpipe_admin');
  const pass = encodeURIComponent(env.DB_PASSWORD || 'squadpipe_secure_password_2026');
  const host = (env.DB_HOST || 'postgres').trim();
  const port = (env.DB_PORT || '5432').trim();
  const name = encodeURIComponent(env.DB_NAME || 'squadpipe_crm');
  return `postgresql://${user}:${pass}@${host}:${port}/${name}`;
};
