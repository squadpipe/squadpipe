import { prisma } from '../config/prisma.config';
import { PlacementStatus, Prisma } from '@prisma/client';

export class PlacementService {
  async getPlacements() {
    return prisma.placement.findMany({
      include: {
        recruiter: { select: { id: true, fullName: true, desk: true } },
        candidate: true,
        client: true,
        vendor: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async createPlacement(payload: any) {
    const { billRate, payRate, ...rest } = payload;
    const bill = Number(billRate);
    const pay = Number(payRate);
    const hourlySpread = bill - pay;
    const marginPct = bill > 0 ? (hourlySpread / bill) * 100 : 0;

    const placement = await prisma.placement.create({
      data: {
        ...rest,
        billRate: bill,
        payRate: pay,
        hourlySpread,
        marginPct: parseFloat(marginPct.toFixed(2))
      }
    });

    // Automatically record in the Automation Audit Ledger
    await prisma.automationAuditLog.create({
      data: {
        ruleName: 'Placement Activation & Margin Lock',
        target: `${placement.resourceName} @ ${placement.customer}`,
        conditionsMet: `Bill: $${bill}/hr | Pay: $${pay}/hr (Spread: +$${hourlySpread.toFixed(2)}/hr)`,
        actionDispatched: 'Registered to Billable Ledger & 30d Expiration Radar Scheduled',
        status: 'EXECUTED'
      }
    });

    return placement;
  }

  async extendPlacement(id: string, newEndDate?: string) {
    const defaultExtension = new Date();
    defaultExtension.setFullYear(defaultExtension.getFullYear() + 1);

    const updated = await prisma.placement.update({
      where: { id },
      data: {
        endDate: new Date(newEndDate || defaultExtension.toISOString()),
        status: PlacementStatus.EXTENDED
      }
    });

    await prisma.automationAuditLog.create({
      data: {
        ruleName: 'SOW Extension Protocol',
        target: `${updated.resourceName} @ ${updated.customer}`,
        conditionsMet: 'Client Extension Verified',
        actionDispatched: `Extended SOW through ${updated.endDate.toISOString().split('T')[0]}`,
        status: 'EXECUTED'
      }
    });

    return updated;
  }

  async getFinancialMetrics() {
    const placements = await prisma.placement.findMany({
      where: { status: PlacementStatus.ACTIVE }
    });

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

