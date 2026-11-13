import { prisma } from '../config/prisma.config';
import { slaEngineService } from '../services/slaEngine.service';

export const runSlaRadarJob = async () => {
  try {
    const tenants = await prisma.user.findMany({
      distinct: ['tenantId'],
      select: { tenantId: true },
    });
    let totalGenerated = 0;
    for (const { tenantId } of tenants) {
      const generated = await slaEngineService.evaluateSlaRadar(tenantId);
      totalGenerated += generated.length;
    }
    if (totalGenerated > 0) {
      console.log(`[SLA Radar Job] Provisioned ${totalGenerated} actionable priority tasks across ${tenants.length} tenant(s).`);
    }
  } catch (error) {
    console.error('[SLA Radar Job Error]:', error);
  }
};

