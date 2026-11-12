import { PrismaClient } from '@prisma/client';

export const resolveDatabaseUrl = (): string => {
  const dbLocation = process.env.DB_LOCATION || 'in_house';

  if (dbLocation === 'external') {
    if (process.env.EXTERNAL_DATABASE_URL) {
      return process.env.EXTERNAL_DATABASE_URL;
    }
    const host = process.env.EXTERNAL_DB_HOST;
    const port = process.env.EXTERNAL_DB_PORT || 5432;
    const user = process.env.EXTERNAL_DB_USER;
    const pass = process.env.EXTERNAL_DB_PASSWORD;
    const name = process.env.EXTERNAL_DB_NAME;
    const ssl = process.env.EXTERNAL_DB_SSL === 'true' ? '?sslmode=require' : '';
    return `postgresql://${user}:${pass}@${host}:${port}/${name}${ssl}`;
  }

  // In-House Docker / Local fallback
  const user = process.env.DB_USER || 'talentos_admin';
  const pass = process.env.DB_PASSWORD || 'talentos_secure_password_2026';
  const host = process.env.DB_HOST || 'postgres';
  const port = process.env.DB_PORT || 5432;
  const name = process.env.DB_NAME || 'talentos_crm';
  return `postgresql://${user}:${pass}@${host}:${port}/${name}`;
};

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: resolveDatabaseUrl(),
    },
  },
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

export const connectWithRetry = async (retries = 10, delayMs = 3000): Promise<void> => {
  for (let i = 1; i <= retries; i++) {
    try {
      await prisma.$connect();
      console.log('Successfully connected to PostgreSQL database via Prisma.');
      return;
    } catch (error) {
      console.warn(`PostgreSQL connection attempt ${i}/${retries} failed. Retrying in ${delayMs / 1000}s...`);
      if (i === retries) {
        throw new Error(`Failed to connect to database after ${retries} attempts.`);
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
};

