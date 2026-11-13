import { prisma } from '../config/prisma.config';
import { PlacementStatus, Prisma, DeploymentType, PlacementType } from '@prisma/client';

export class PlacementService {
  async getPlacements(tenantId?: string) {
    const where: Prisma.PlacementWhereInput = {};
    if (tenantId) where.tenantId = tenantId;

    return prisma.placement.findMany({
      where,
      include: {
        recruiter: { select: { id: true, fullName: true, desk: true } },
        candidate: true,
        client: true,
        vendor: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async createPlacement(payload: any, tenantId: string = 'talentos-agency', recruiterId?: string) {
    const billNum = typeof payload.billRate === 'number'
      ? payload.billRate
      : parseInt(String(payload.billing || payload.billRate || '115').replace(/\D/g, ''), 10) || 115;
    const payNum = typeof payload.payRate === 'number'
      ? payload.payRate
      : parseInt(String(payload.payRate || '85').replace(/\D/g, ''), 10) || 85;

    const hourlySpread = billNum - payNum;
    const marginPct = billNum > 0 ? (hourlySpread / billNum) * 100 : 0;

    const startDate = payload.startDate ? new Date(payload.startDate) : new Date();
    const endDate = payload.endDate
      ? new Date(payload.endDate)
      : new Date(new Date().setFullYear(new Date().getFullYear() + 1));

    // Deployment type mapping
    let deployment: DeploymentType = DeploymentType.ONSHORE;
    const depStr = String(payload.deployment || '').toUpperCase();
    if (depStr.includes('OFFSHORE')) deployment = DeploymentType.OFFSHORE;
    else if (depStr.includes('NEARSHORE')) deployment = DeploymentType.NEARSHORE;

    // Placement type mapping
    let placementType: PlacementType = PlacementType.C2C_SUBCONTRACTOR;
    const typeStr = String(payload.placementType || '').toUpperCase();
    if (typeStr.includes('W2')) placementType = PlacementType.W2_HOURLY;
    else if (typeStr.includes('1099')) placementType = PlacementType.TEN_NINETY_NINE;
    else if (typeStr.includes('FULL')) placementType = PlacementType.FULL_TIME;

    const placement = await prisma.placement.create({
      data: {
        tenantId,
        customer: payload.customer?.trim() || 'Client Enterprise',
        customerContact: payload.customerContact?.trim() || 'Hiring Manager',
        resourceName: payload.resourceName?.trim() || 'Placed Consultant',
        phone: payload.phone?.trim() || null,
        email: payload.email?.trim() || null,
        skillRole: payload.skillRole?.trim() || 'Software Engineer',
        deployment,
        placementType,
        startDate,
        endDate,
        billRate: billNum,
        payRate: payNum,
        hourlySpread,
        marginPct: parseFloat(marginPct.toFixed(2)),
        recruiterId: recruiterId || payload.recruiterId || null,
        status: PlacementStatus.ACTIVE
      },
      include: {
        recruiter: { select: { id: true, fullName: true, desk: true } },
        candidate: true,
        client: true,
        vendor: true
      }
    });

    // Automatically record in the Automation Audit Ledger
    try {
      await prisma.automationAuditLog.create({
        data: {
          ruleName: 'Placement Activation & Margin Lock',
          target: `${placement.resourceName} @ ${placement.customer}`,
          conditionsMet: `Bill: $${billNum}/hr | Pay: $${payNum}/hr (Spread: +$${hourlySpread.toFixed(2)}/hr)`,
          actionDispatched: 'Registered to Billable Ledger & 30d Expiration Radar Scheduled',
          status: 'EXECUTED'
        }
      });
    } catch {
      // Non-critical audit log failure
    }

    return placement;
  }

  async extendPlacement(id: string, newEndDate?: string, tenantId?: string) {
    const defaultExtension = new Date();
    defaultExtension.setFullYear(defaultExtension.getFullYear() + 1);

    if (tenantId) {
      const existing = await prisma.placement.findUnique({ where: { id } });
      if (!existing || existing.tenantId !== tenantId) {
        throw new Error('Placement not found or unauthorized');
      }
    }

    const updated = await prisma.placement.update({
      where: { id },
      data: {
        endDate: new Date(newEndDate || defaultExtension.toISOString()),
        status: PlacementStatus.EXTENDED
      }
    });

    try {
      await prisma.automationAuditLog.create({
        data: {
          ruleName: 'SOW Extension Protocol',
          target: `${updated.resourceName} @ ${updated.customer}`,
          conditionsMet: 'Client Extension Verified',
          actionDispatched: `Extended SOW through ${updated.endDate.toISOString().split('T')[0]}`,
          status: 'EXECUTED'
        }
      });
    } catch {
      // Non-critical
    }

    return updated;
  }

  async deletePlacement(id: string, tenantId?: string) {
    if (tenantId) {
      const existing = await prisma.placement.findUnique({ where: { id } });
      if (!existing || existing.tenantId !== tenantId) {
        throw new Error('Placement not found or unauthorized');
      }
    }
    return prisma.placement.delete({ where: { id } });
  }

  async getFinancialMetrics(tenantId?: string) {
    const where: Prisma.PlacementWhereInput = { status: PlacementStatus.ACTIVE };
    if (tenantId) where.tenantId = tenantId;

    const placements = await prisma.placement.findMany({ where });

    const totalMonthlyGrossProfit = placements.reduce(
      (sum, p) => sum + (Number(p.hourlySpread) * 160),
      0
    );

    const avgHourlyMarginSpread = placements.length
      ? (placements.reduce((sum, p) => sum + Number(p.hourlySpread), 0) / placements.length).toFixed(2)
      : '0.00';

    const avgMarginPercent = placements.length
      ? (placements.reduce((sum, p) => sum + Number(p.marginPct), 0) / placements.length).toFixed(1)
      : '0.0';

    const expiringThreshold = new Date();
    expiringThreshold.setDate(expiringThreshold.getDate() + 30);
    const expiringPlacementsCount = placements.filter(
      (p) => new Date(p.endDate) <= expiringThreshold
    ).length;

    return {
      totalMonthlyGrossProfit,
      avgHourlyMarginSpread,
      avgMarginPercent,
      expiringPlacementsCount
    };
  }
}

export const placementService = new PlacementService();

