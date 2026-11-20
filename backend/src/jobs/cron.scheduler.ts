import { prisma } from '../config/prisma.config';
import { runSlaRadarJob } from './slaRadar.job';
import { runComplianceWatchJob } from './complianceWatch.job';
import { candidateIndexingService } from '../services/vector/candidateIndexing.service';

const CRON_ADVISORY_LOCK_KEY = 948201;
let schedulerInterval: NodeJS.Timeout | null = null;
let jobInProgress = false;

async function executeScheduledJobsWithLock() {
  if (jobInProgress) return;
  jobInProgress = true;
  try {
    await prisma.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<Array<{ locked: boolean }>>`
          SELECT pg_try_advisory_xact_lock(${CRON_ADVISORY_LOCK_KEY}) AS locked
        `;
        if (!rows?.[0]?.locked) {
          return;
        }
        await runSlaRadarJob();
        await runComplianceWatchJob();

        // Enforce 30-day retention on automation audit logs
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        await tx.automationAuditLog.deleteMany({
          where: { createdAt: { lt: thirtyDaysAgo } },
        });
      },
      { maxWait: 5000, timeout: 120000 }
    );

    // Non-blocking background chunk & vector backfill catch-up for large 10k+ resume pools
    void candidateIndexingService
      .runBackgroundBackfillTick({ maxChunkSync: 400, maxEmbedChunks: 96 })
      .catch((err) => {
        console.warn('[Scheduler] Background vector backfill paused:', err?.message || err);
      });
  } catch (error) {
    console.error('[Scheduler] Failed during locked cron execution:', error);
  } finally {
    jobInProgress = false;
  }
}

export const initBackgroundScheduler = () => {
  console.log('SquadPipe deterministic background jobs scheduler initialized.');

  // Run initial evaluation immediately on boot (advisory-locked across replicas)
  void executeScheduledJobsWithLock();

  // Run periodic evaluation every 10 minutes (600,000ms)
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
  }
  schedulerInterval = setInterval(() => {
    void executeScheduledJobsWithLock();
  }, 10 * 60 * 1000);
};

export const stopBackgroundScheduler = () => {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
};
