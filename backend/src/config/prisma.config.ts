import { PrismaClient } from '@prisma/client';
import { resolveDatabaseUrl } from './databaseUrl';

export { resolveDatabaseUrl };

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
      console.warn(`PostgreSQL connection attempt ${i}/${retries} failed: ${(error as any)?.message}`);
      if (i === retries) {
        throw new Error(`Failed to connect to database after ${retries} attempts. Last error: ${(error as any)?.message}`);
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
};

