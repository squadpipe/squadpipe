import { prisma } from '../config/prisma.config';
import { slaEngineService } from '../services/slaEngine.service';

export const runComplianceWatchJob = async () => {
  try {
    const tenants = await prisma.vendor.findMany({
      distinct: ['tenantId'],
      select: { tenantId: true },
    });

    for (const { tenantId } of tenants) {
      if (!tenantId) continue;
      await slaEngineService.reconcileOpenTasks(tenantId);
      await slaEngineService.evaluateVendorComplianceForTenant(tenantId, 30);
    }
  } catch (error) {
    console.error('[Compliance Watch Job Error]:', error);
  }
};

