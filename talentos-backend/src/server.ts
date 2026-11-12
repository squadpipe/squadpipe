import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { connectWithRetry } from './config/prisma.config';
import { verifySmtpConnection } from './config/smtp.config';
import { initBackgroundScheduler } from './jobs/cron.scheduler';

const PORT = process.env.PORT || 5000;

async function bootstrap() {
  console.log(`Starting TalentOS Backend in ${process.env.NODE_ENV || 'development'} mode...`);

  // 1. Resilient database connection with retries
  await connectWithRetry(10, 3000);

  // 2. Verify SMTP connection
  await verifySmtpConnection();

  // 3. Initialize background deterministic SLA & compliance scanner
  initBackgroundScheduler();

  // 4. Start HTTP server
  app.listen(PORT, () => {
    console.log(`TalentOS API server listening at http://localhost:${PORT}/api/v1`);
  });
}

bootstrap().catch((err) => {
  console.error('Fatal initialization error:', err);
  process.exit(1);
});

