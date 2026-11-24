import assert from 'node:assert/strict';
import { resolveDatabaseUrl } from '../../src/config/databaseUrl';

export const runDatabaseUrlTests = () => {
  console.log('--- Running Database URL Resolution Tests ---');

  // 1. Default in-house URL
  assert.equal(
    resolveDatabaseUrl({}),
    'postgresql://squadpipe_admin:squadpipe_secure_password_2026@postgres:5432/squadpipe_crm'
  );

  // 2. External RDS URL from discrete variables, encoding special characters and enabling SSL
  const rdsUrl = resolveDatabaseUrl({
    DB_LOCATION: 'external',
    EXTERNAL_DATABASE_URL: '   ',
    EXTERNAL_DB_HOST: 'squadpipe-db.abc123.ap-south-1.rds.amazonaws.com',
    EXTERNAL_DB_PORT: '5432',
    EXTERNAL_DB_USER: 'squadpipe_admin',
    EXTERNAL_DB_PASSWORD: 'p@ss#word/1?%:',
    EXTERNAL_DB_NAME: 'squadpipe_crm',
    EXTERNAL_DB_SSL: 'true',
  });
  assert.equal(
    rdsUrl,
    'postgresql://squadpipe_admin:p%40ss%23word%2F1%3F%25%3A@squadpipe-db.abc123.ap-south-1.rds.amazonaws.com:5432/squadpipe_crm?sslmode=require'
  );

  // 3. Explicit EXTERNAL_DATABASE_URL overrides discrete fields when non-empty
  const explicitUrl = resolveDatabaseUrl({
    DB_LOCATION: 'external',
    EXTERNAL_DATABASE_URL: 'postgresql://u:p@custom-host:5433/app?sslmode=verify-full',
    EXTERNAL_DB_HOST: 'ignored-host',
  });
  assert.equal(explicitUrl, 'postgresql://u:p@custom-host:5433/app?sslmode=verify-full');

  // 4. SSL disabled omits sslmode query param
  const noSslUrl = resolveDatabaseUrl({
    DB_LOCATION: 'external',
    EXTERNAL_DB_HOST: '10.0.1.25',
    EXTERNAL_DB_USER: 'app',
    EXTERNAL_DB_PASSWORD: 'secret',
    EXTERNAL_DB_NAME: 'crm',
    EXTERNAL_DB_SSL: 'false',
  });
  assert.equal(noSslUrl, 'postgresql://app:secret@10.0.1.25:5432/crm');

  console.log('✅ Database URL Resolution Tests: PASSED');
};
