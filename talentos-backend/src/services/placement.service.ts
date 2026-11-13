import { prisma } from '../config/prisma.config';
import { PlacementStatus, Prisma, DeploymentType, PlacementType } from '@prisma/client';

export class PlacementService {
  private parseRate(val: any, fallback: number): number {
    if (typeof val === 'number') return isNaN(val) ? fallback : val;
    const cleaned = String(val ?? '').replace(/[^0-9.]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? fallback : parsed;
  }

  private mapPlacementStatus(status?: string): PlacementStatus {
    const s = String(status || '').toUpperCase().replace(/\s+/g, '_');
    if (s === 'EXTENDED') return PlacementStatus.EXTENDED;
    if (s === 'EXPIRING_SOON') return PlacementStatus.EXPIRING_SOON;
    if (s === 'COMPLETED') return PlacementStatus.COMPLETED;
    if (s === 'TERMINATED') return PlacementStatus.TERMINATED;
    return PlacementStatus.ACTIVE;
  }

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
    const billNum = this.parseRate(payload.billing ?? payload.billRate, 115);
    const payNum = this.parseRate(payload.payRate, 85);

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

    // Resolve and validate relational IDs so synthetic/stale IDs never fail FK constraints
    let candidateId: string | null = payload.candidateId || null;
    if (candidateId) {
      const existingCand = await prisma.candidate.findUnique({ where: { id: candidateId }, select: { id: true } });
      if (!existingCand) candidateId = null;
    }
    if (!candidateId && payload.resourceName) {
      const matchedCand = await prisma.candidate.findFirst({
        where: { tenantId, fullName: { equals: String(payload.resourceName).trim(), mode: 'insensitive' } },
        select: { id: true },
      });
      if (matchedCand) candidateId = matchedCand.id;
    }

    let clientId: string | null = payload.clientId || null;
    if (clientId) {
      const existingClient = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
      if (!existingClient) clientId = null;
    }
    if (!clientId && payload.customer) {
      const matchedClient = await prisma.client.findFirst({
        where: { tenantId, name: { equals: String(payload.customer).trim(), mode: 'insensitive' } },
        select: { id: true },
      });
      if (matchedClient) clientId = matchedClient.id;
    }

    let vendorId: string | null = payload.vendorId || null;
    if (vendorId) {
      const existingVendor = await prisma.vendor.findUnique({ where: { id: vendorId }, select: { id: true } });
      if (!existingVendor) vendorId = null;
    }
    if (!vendorId && payload.vendorName) {
      const matchedVendor = await prisma.vendor.findFirst({
        where: { tenantId, name: { equals: String(payload.vendorName).trim(), mode: 'insensitive' } },
        select: { id: true },
      });
      if (matchedVendor) vendorId = matchedVendor.id;
    }

    let requirementId: string | null = payload.requirementId || null;
    if (requirementId) {
      const existingReq = await prisma.requirement.findUnique({ where: { id: requirementId }, select: { id: true } });
      if (!existingReq) requirementId = null;
    }

    let resolvedRecruiterId: string | null = payload.recruiterId || recruiterId || null;
    if (resolvedRecruiterId) {
      const existingUser = await prisma.user.findUnique({ where: { id: resolvedRecruiterId }, select: { id: true } });
      if (!existingUser) resolvedRecruiterId = null;
    }
    if (!resolvedRecruiterId && payload.recruiter && typeof payload.recruiter === 'string' && payload.recruiter.trim()) {
      const matchedUser = await prisma.user.findFirst({
        where: { tenantId, fullName: { equals: payload.recruiter.trim(), mode: 'insensitive' } },
        select: { id: true },
      });
      if (matchedUser) resolvedRecruiterId = matchedUser.id;
    }

    const status = this.mapPlacementStatus(payload.status);

    const placement = await prisma.placement.create({
      data: {
        tenantId,
        candidateId,
        requirementId,
        clientId,
        vendorId,
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
        purchaseOrderNumber: payload.purchaseOrderNumber?.trim() || null,
        recruiterId: resolvedRecruiterId,
        status,
      },
      include: {
        recruiter: { select: { id: true, fullName: true, desk: true } },
        candidate: true,
        client: true,
        vendor: true
      }
    });

    if (candidateId) {
      try {
        await prisma.candidate.update({
          where: { id: candidateId },
          data: { pipelineStage: 'BILLABLE' },
        });
      } catch {
        // Non-critical stage sync failure
      }
    }

    if (requirementId) {
      try {
        await prisma.requirement.update({
          where: { id: requirementId },
          data: { status: 'ONBOARDING' },
        });
      } catch {
        // Non-critical stage sync failure
      }
    }

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

  async updatePlacement(id: string, payload: any, tenantId?: string) {
    const existing = await prisma.placement.findUnique({ where: { id } });
    if (!existing || (tenantId && existing.tenantId !== tenantId)) {
      throw new Error('Placement not found or unauthorized');
    }

    const billNum =
      payload.billRate !== undefined || payload.billing !== undefined
        ? this.parseRate(payload.billing ?? payload.billRate, Number(existing.billRate))
        : Number(existing.billRate);

    const payNum =
      payload.payRate !== undefined
        ? this.parseRate(payload.payRate, Number(existing.payRate))
        : Number(existing.payRate);

    const hourlySpread = billNum - payNum;
    const marginPct = billNum > 0 ? parseFloat(((hourlySpread / billNum) * 100).toFixed(2)) : 0;

    const data: Prisma.PlacementUpdateInput = {
      billRate: billNum,
      payRate: payNum,
      hourlySpread,
      marginPct,
    };

    if (payload.customer !== undefined) data.customer = String(payload.customer).trim();
    if (payload.customerContact !== undefined) data.customerContact = String(payload.customerContact).trim();
    if (payload.resourceName !== undefined) data.resourceName = String(payload.resourceName).trim();
    if (payload.phone !== undefined) data.phone = payload.phone;
    if (payload.email !== undefined) data.email = payload.email;
    if (payload.skillRole !== undefined) data.skillRole = String(payload.skillRole).trim();
    if (payload.startDate) data.startDate = new Date(payload.startDate);
    if (payload.endDate) data.endDate = new Date(payload.endDate);
    if (payload.purchaseOrderNumber !== undefined) {
      data.purchaseOrderNumber = payload.purchaseOrderNumber ? String(payload.purchaseOrderNumber).trim() : null;
    }
    if (payload.candidateId !== undefined) {
      data.candidate = payload.candidateId ? { connect: { id: payload.candidateId } } : { disconnect: true };
    }
    if (payload.clientId !== undefined) {
      data.client = payload.clientId ? { connect: { id: payload.clientId } } : { disconnect: true };
    }
    if (payload.vendorId !== undefined) {
      data.vendor = payload.vendorId ? { connect: { id: payload.vendorId } } : { disconnect: true };
    } else if (payload.vendorName !== undefined && tenantId) {
      const matchedVendor = payload.vendorName
        ? await prisma.vendor.findFirst({
            where: { tenantId, name: { equals: String(payload.vendorName).trim(), mode: 'insensitive' } },
            select: { id: true },
          })
        : null;
      if (matchedVendor) data.vendor = { connect: { id: matchedVendor.id } };
    }

    if (payload.status !== undefined) {
      data.status = this.mapPlacementStatus(payload.status);
    }

    if (payload.deployment !== undefined) {
      const depStr = String(payload.deployment).toUpperCase();
      data.deployment = depStr.includes('OFFSHORE')
        ? DeploymentType.OFFSHORE
        : depStr.includes('NEARSHORE')
        ? DeploymentType.NEARSHORE
        : DeploymentType.ONSHORE;
    }

    if (payload.placementType !== undefined) {
      const typeStr = String(payload.placementType).toUpperCase();
      data.placementType = typeStr.includes('W2')
        ? PlacementType.W2_HOURLY
        : typeStr.includes('1099')
        ? PlacementType.TEN_NINETY_NINE
        : typeStr.includes('FULL')
        ? PlacementType.FULL_TIME
        : PlacementType.C2C_SUBCONTRACTOR;
    }

    const updated = await prisma.placement.update({
      where: { id },
      data,
      include: {
        recruiter: { select: { id: true, fullName: true, desk: true } },
        candidate: true,
        client: true,
        vendor: true,
      },
    });

    if (payload.status !== undefined && existing.candidateId) {
      const normalizedStatus = this.mapPlacementStatus(payload.status);
      try {
        if (normalizedStatus === PlacementStatus.COMPLETED || normalizedStatus === PlacementStatus.TERMINATED) {
          await prisma.candidate.update({
            where: { id: existing.candidateId },
            data: { pipelineStage: 'AVAILABLE_BENCH' },
          });
        } else if (normalizedStatus === PlacementStatus.ACTIVE || normalizedStatus === PlacementStatus.EXTENDED) {
          await prisma.candidate.update({
            where: { id: existing.candidateId },
            data: { pipelineStage: 'BILLABLE' },
          });
        }
      } catch {
        // Non-critical stage sync failure
      }
    }

    return updated;
  }

  async extendPlacement(
    id: string,
    payloadOrDate?:
      | string
      | {
          newEndDate?: string;
          billing?: string;
          billRate?: number;
          payRate?: string | number;
          purchaseOrderNumber?: string;
        },
    tenantId?: string
  ) {
    const payload = typeof payloadOrDate === 'string' ? { newEndDate: payloadOrDate } : payloadOrDate || {};
    const existing = await prisma.placement.findUnique({ where: { id } });
    if (!existing || (tenantId && existing.tenantId !== tenantId)) {
      throw new Error('Placement not found or unauthorized');
    }

    const defaultExtension = new Date(existing.endDate || new Date());
    defaultExtension.setFullYear(defaultExtension.getFullYear() + 1);

    const billNum =
      payload.billing !== undefined || payload.billRate !== undefined
        ? this.parseRate(payload.billing ?? payload.billRate, Number(existing.billRate))
        : Number(existing.billRate);

    const payNum =
      payload.payRate !== undefined
        ? this.parseRate(payload.payRate, Number(existing.payRate))
        : Number(existing.payRate);

    const hourlySpread = billNum - payNum;
    const marginPct = billNum > 0 ? parseFloat(((hourlySpread / billNum) * 100).toFixed(2)) : 0;

    const updated = await prisma.placement.update({
      where: { id },
      data: {
        endDate: new Date(payload.newEndDate || defaultExtension.toISOString()),
        status: PlacementStatus.EXTENDED,
        billRate: billNum,
        payRate: payNum,
        hourlySpread,
        marginPct,
        purchaseOrderNumber:
          payload.purchaseOrderNumber !== undefined
            ? payload.purchaseOrderNumber
              ? String(payload.purchaseOrderNumber).trim()
              : null
            : existing.purchaseOrderNumber,
      },
      include: {
        recruiter: { select: { id: true, fullName: true, desk: true } },
        candidate: true,
        client: true,
        vendor: true,
      },
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

