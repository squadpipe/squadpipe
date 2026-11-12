import { runSlaRadarJob } from './slaRadar.job';
import { runComplianceWatchJob } from './complianceWatch.job';

export const initBackgroundScheduler = () => {
  console.log('TalentOS deterministic background jobs scheduler initialized.');

  // Run immediately on boot
  runSlaRadarJob();
  runComplianceWatchJob();

  // Run periodic evaluation every 10 minutes (600,000ms)
  setInterval(() => {
    runSlaRadarJob();
    runComplianceWatchJob();
  }, 10 * 60 * 1000);
};

