import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import app from './app';
import { getJwtAccessSecret } from './config/jwt.config';
import { connectWithRetry, prisma } from './config/prisma.config';
import { verifySmtpConnection } from './config/smtp.config';
import { initBackgroundScheduler, stopBackgroundScheduler } from './jobs/cron.scheduler';

const PORT = process.env.PORT || 5000;
let httpServer: http.Server | null = null;
let isShuttingDown = false;

async function shutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`Received ${signal}. Starting graceful shutdown...`);

  stopBackgroundScheduler();

  const forceTimer = setTimeout(() => {
    console.error('Forced shutdown after 10s timeout waiting for active connections.');
    process.exit(1);
  }, 10000);
  forceTimer.unref();

  try {
    if (httpServer) {
      await new Promise<void>((resolve, reject) => {
        httpServer!.close((err) => (err ? reject(err) : resolve()));
      });
    }
    await prisma.$disconnect();
    clearTimeout(forceTimer);
    console.log('Graceful shutdown completed cleanly.');
    process.exit(0);
  } catch (err) {
    console.error('Error during graceful shutdown:', err);
    process.exit(1);
  }
}

async function bootstrap() {
  console.log(`Starting TalentOS Backend in ${process.env.NODE_ENV || 'development'} mode...`);

  // Fail fast in production when required security secrets are absent or weak
  getJwtAccessSecret();

  // 1. Resilient database connection with retries
  await connectWithRetry(10, 3000);

  // 2. Verify SMTP connection
  await verifySmtpConnection();

  // 3. Initialize background deterministic SLA & compliance scanner
  initBackgroundScheduler();

  // 4. Start HTTP server
  httpServer = app.listen(PORT, () => {
    console.log(`TalentOS API server listening at http://localhost:${PORT}/api/v1`);
  });

  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  console.error('Fatal initialization error:', err);
  process.exit(1);
});
