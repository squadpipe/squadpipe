import { slaEngineService } from '../services/slaEngine.service';

export const runSlaRadarJob = async () => {
  try {
    const generated = await slaEngineService.evaluateSlaRadar();
    if (generated.length > 0) {
      console.log(`[SLA Radar Job] Provisioned ${generated.length} actionable priority tasks.`);
    }
  } catch (error) {
    console.error('[SLA Radar Job Error]:', error);
  }
};

