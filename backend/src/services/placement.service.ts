import { prisma } from '../config/prisma.config';
import { CandidatePipelineStage, PlacementStatus, Prisma, DeploymentType, PlacementType, AutomationCategory } from '@prisma/client';
import { automationEngineService } from './automationEngine.service';
import { slaEngineService } from './slaEngine.service';
import { parseCustomFields } from '../utils/customFields';
import { parseRateNumber } from '../utils/rateParser';
import { RequirementStatus, normalizeStageValue } from './requirement.service';
import { computeHighestActiveStage, getTenantPipelineStages } from './submission.service';
import { getTenantSettings } from '../config/smtp.config';
import { SortDirection, buildPrismaOrderBy } from '../utils/tableSort';

export const PLACEMENT_SORTABLE_FIELDS = [
  'customer',
  'resourceName',
  'status',
  'placementType',
  'payRate',
  'billRate',
  'hourlySpread',
  'startDate',
  'endDate',
  'createdAt',
] as const;

export function validateRequiredPoNumber(
  requirePoForPlacement: boolean,
  purchaseOrderNumber?: string | null
): void {
  if (requirePoForPlacement && !String(purchaseOrderNumber ?? '').trim()) {
    const err: any = new Error(
      'PO / SOW Number is required on placements by your workspace General Settings.'
    );
    err.statusCode = 400;
    throw err;
  }
}

export function validatePlacementCanDelete(status: PlacementStatus): void {
  if (status !== PlacementStatus.COMPLETED && status !== PlacementStatus.TERMINATED) {
    const err: any = new Error(
      'Active billable placements cannot be deleted. Please end the contract first.'
    );
    err.statusCode = 400;
    throw err;
  }
}

export function mapPlacementStatusValue(status?: string): PlacementStatus {
  const s = String(status || '').toUpperCase().replace(/\s+/g, '_');
  if (s === 'EXTENDED') return PlacementStatus.EXTENDED;
  if (s === 'EXPIRING_SOON') return PlacementStatus.EXPIRING_SOON;
  if (s === 'COMPLETED') return PlacementStatus.COMPLETED;
  if (s === 'TERMINATED') return PlacementStatus.TERMINATED;
  return PlacementStatus.ACTIVE;
}

/**
 * Builds the Prisma status filter aligned with the UI ledger tabs and active KPI counts:
 * `'Active'` matches all ongoing placements (not Completed or Terminated), while
 * `'Expiring Soon'` and `'Extended'` drill into subsets of active contracts.
 */
export function buildPlacementStatusWhere(
  status?: string,
  now: Date = new Date()
): Prisma.PlacementWhereInput | null {
  const statusParam = status ? String(status).trim() : '';
  if (!statusParam || statusParam === 'All' || statusParam === 'ALL') {
    return null;
  }

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const in30Days = new Date(startOfToday);
  in30Days.setDate(in30Days.getDate() + 30);

  if (statusParam === 'Ended') {
    return { status: { in: [PlacementStatus.COMPLETED, PlacementStatus.TERMINATED] } };
  }
  if (statusParam === 'Expiring Soon') {
    return {
      status: { notIn: [PlacementStatus.COMPLETED, PlacementStatus.TERMINATED] },
      endDate: { gte: startOfToday, lte: in30Days },
    };
  }
  if (statusParam === 'Extended') {
    return {
      status: PlacementStatus.EXTENDED,
      OR: [{ endDate: { lt: startOfToday } }, { endDate: { gt: in30Days } }],
    };
  }
  if (statusParam === 'Active' || statusParam.toUpperCase() === 'ACTIVE') {
    return {
      status: { notIn: [PlacementStatus.COMPLETED, PlacementStatus.TERMINATED] },
    };
  }
  return { status: mapPlacementStatusValue(statusParam) };
}

export interface PlacementFilterParams {
  search?: string;
  status?: string;
  model?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortDir?: SortDirection;
}

export class PlacementService {
  private parseRate(val: any, fallback: number): number {
    return parseRateNumber(val, fallback);
  }

  private mapPlacementStatus(status?: string): PlacementStatus {
    return mapPlacementStatusValue(status);
  }

  private mapPlacementType(model?: string): PlacementType | undefined {
    const m = String(model || '').trim().toUpperCase();
    if (!m || m === 'ALL') return undefined;
    if (m.includes('W2')) return PlacementType.W2_HOURLY;
    if (m.includes('1099') || m.includes('TEN_NINETY_NINE')) return PlacementType.TEN_NINETY_NINE;
    if (m.includes('FULL')) return PlacementType.FULL_TIME;
    if (m.includes('C2C')) return PlacementType.C2C_SUBCONTRACTOR;
    return undefined;
  }

  async getPlacements(tenantId?: string, params: PlacementFilterParams = {}) {
    const where: Prisma.PlacementWhereInput = {};
    const andConditions: Prisma.PlacementWhereInput[] = [];
    if (tenantId) where.tenantId = tenantId;

    const q = params.search ? String(params.search).trim() : '';
    if (q) {
      andConditions.push({
        OR: [
          { resourceName: { contains: q, mode: 'insensitive' } },
          { customer: { contains: q, mode: 'insensitive' } },
          { skillRole: { contains: q, mode: 'insensitive' } },
          { purchaseOrderNumber: { contains: q, mode: 'insensitive' } },
          { vendor: { name: { contains: q, mode: 'insensitive' } } },
          { recruiter: { fullName: { contains: q, mode: 'insensitive' } } },
        ],
      });
    }

    const mappedModel = this.mapPlacementType(params.model);
    if (mappedModel) {
      andConditions.push({ placementType: mappedModel });
    }

    const statusWhere = buildPlacementStatusWhere(params.status);
    if (statusWhere) {
      andConditions.push(statusWhere);
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    const include = {
      recruiter: { select: { id: true, fullName: true, desk: true } },
      candidate: true,
      client: true,
      vendor: true
    };

    const orderBy = buildPrismaOrderBy<Prisma.PlacementOrderByWithRelationInput>(
      params.sortBy,
      params.sortDir || 'desc',
      {
        customer: (d) => [{ customer: d }, { purchaseOrderNumber: d }, { id: d }],
        resourceName: (d) => [{ resourceName: d }, { id: d }],
        skillRole: (d) => [{ skillRole: d }, { id: d }],
        status: (d) => [{ status: d }, { placementType: d }, { id: d }],
        placementType: (d) => [{ placementType: d }, { status: d }, { id: d }],
        payRate: (d) => [{ payRate: d }, { id: d }],
        billRate: (d) => [{ billRate: d }, { id: d }],
        hourlySpread: (d) => [{ hourlySpread: d }, { id: d }],
        startDate: (d) => [{ startDate: d }, { id: d }],
        endDate: (d) => [{ endDate: d }, { id: d }],
        createdAt: (d) => [{ createdAt: d }, { id: d }],
      },
      [{ createdAt: 'desc' }, { id: 'desc' }]
    ) as Prisma.PlacementOrderByWithRelationInput[];

    const hasPagination = params.page !== undefined || params.limit !== undefined;
    if (!hasPagination) {
      const data = await prisma.placement.findMany({
        where,
        include,
        orderBy,
      });
      return {
        data,
        pagination: { page: 1, limit: data.length || 10, total: data.length, totalPages: 1 }
      };
    }

    const page = params.page ? Math.max(1, params.page) : 1;
    const limit = params.limit ? Math.max(1, Math.min(100, params.limit)) : 10;
    const [total, data] = await Promise.all([
      prisma.placement.count({ where }),
      prisma.placement.findMany({
        where,
        include,
        orderBy,
        skip: (page - 1) * limit,
        take: limit
      })
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit))
      }
    };
  }

  async createPlacement(payload: any, tenantId: string = 'squadpipe-agency', recruiterId?: string) {
    const { general } = await getTenantSettings(tenantId);
    validateRequiredPoNumber(Boolean(general?.requirePoForPlacement), payload.purchaseOrderNumber);

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

    // Resolve and validate relational IDs within tenant so synthetic/cross-tenant IDs cannot link
    let candidateId: string | null = payload.candidateId || null;
    if (candidateId) {
      const existingCand = await prisma.candidate.findFirst({ where: { id: candidateId, tenantId }, select: { id: true } });
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
      const existingClient = await prisma.client.findFirst({ where: { id: clientId, tenantId }, select: { id: true } });
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
      const existingVendor = await prisma.vendor.findFirst({ where: { id: vendorId, tenantId }, select: { id: true } });
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
      const existingReq = await prisma.requirement.findFirst({ where: { id: requirementId, tenantId }, select: { id: true } });
      if (!existingReq) requirementId = null;
    }

    if (requirementId && candidateId) {
      const duplicatePlacement = await prisma.placement.findFirst({
        where: {
          tenantId,
          requirementId,
          candidateId,
          status: { in: [PlacementStatus.ACTIVE, PlacementStatus.EXTENDED, PlacementStatus.EXPIRING_SOON] },
        },
        select: { id: true },
      });
      if (duplicatePlacement) {
        const err: any = new Error('This consultant is already placed on this requirement.');
        err.statusCode = 409;
        throw err;
      }
    }

    if (requirementId) {
      const reqInfo = await prisma.requirement.findUnique({
        where: { id: requirementId },
        select: { openPositions: true },
      });
      const openPositions = Math.max(1, reqInfo?.openPositions ?? 1);
      const activePlacedCount = await prisma.placement.count({
        where: {
          tenantId,
          requirementId,
          status: { in: [PlacementStatus.ACTIVE, PlacementStatus.EXTENDED, PlacementStatus.EXPIRING_SOON] },
        },
      });
      if (activePlacedCount >= openPositions) {
        const err: any = new Error(
          `All ${openPositions} open position(s) for this requirement are already filled (${activePlacedCount}/${openPositions} placed).`
        );
        err.statusCode = 409;
        throw err;
      }
    }

    let resolvedRecruiterId: string | null = payload.recruiterId || recruiterId || null;
    if (resolvedRecruiterId) {
      const existingUser = await prisma.user.findFirst({ where: { id: resolvedRecruiterId, tenantId }, select: { id: true } });
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
    const customFields = parseCustomFields(payload.customFields);

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
        ...(customFields !== undefined ? { customFields } : {}),
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
        if (candidateId) {
          await prisma.submission.updateMany({
            where: { tenantId, requirementId, candidateId },
            data: { stage: 'ONBOARDING', lastClientFeedbackDate: new Date() },
          });
        }
        const reqInfo = await prisma.requirement.findUnique({
          where: { id: requirementId },
          select: { openPositions: true },
        });
        const openPositions = Math.max(1, reqInfo?.openPositions ?? 1);
        const filledCount = await prisma.placement.count({
          where: {
            tenantId,
            requirementId,
            status: { in: [PlacementStatus.ACTIVE, PlacementStatus.EXTENDED, PlacementStatus.EXPIRING_SOON] },
          },
        });
        if (filledCount >= openPositions) {
          await prisma.requirement.update({
            where: { id: requirementId },
            data: { status: 'ONBOARDING' },
          });
          await slaEngineService.resolveTasksForEntity(tenantId, 'requirement', requirementId);
        }
      } catch {
        // Non-critical stage sync failure
      }
    }

    // Automatically record in the Automation Audit Ledger scoped to tenant
    try {
      await automationEngineService.recordLifecycleEvent({
        tenantId,
        preferredCategories: [AutomationCategory.CONTRACT],
        ruleName: 'Placement Activation & Margin Lock',
        target: `${placement.resourceName} @ ${placement.customer}`,
        conditionsMet: `Bill: $${billNum}/hr | Pay: $${payNum}/hr (Spread: +$${hourlySpread.toFixed(2)}/hr)`,
        actionDispatched: 'Registered to Billable Ledger & 30d Expiration Radar Scheduled',
      });
      await slaEngineService.evaluateSlaRadar(tenantId);
    } catch {
      // Non-critical audit log failure
    }

    return placement;
  }

  private async validateTenantReference(
    findFn: () => Promise<{ id: string } | null>,
    label: string
  ): Promise<string> {
    const rec = await findFn();
    if (!rec) {
      const err: any = new Error(`Referenced ${label} does not belong to this workspace.`);
      err.statusCode = 404;
      throw err;
    }
    return rec.id;
  }

  async updatePlacement(id: string, payload: any, tenantId?: string) {
    const existing = await prisma.placement.findUnique({ where: { id } });
    if (!existing || (tenantId && existing.tenantId !== tenantId)) {
      const err: any = new Error('Placement not found or unauthorized');
      err.statusCode = 404;
      throw err;
    }
    const effectiveTenantId = tenantId || existing.tenantId;
    const nextStatus =
      payload.status !== undefined ? this.mapPlacementStatus(payload.status) : existing.status;
    const nextPo =
      payload.purchaseOrderNumber !== undefined
        ? payload.purchaseOrderNumber
        : existing.purchaseOrderNumber;

    if (
      nextStatus !== PlacementStatus.COMPLETED &&
      nextStatus !== PlacementStatus.TERMINATED &&
      (payload.purchaseOrderNumber !== undefined || existing.status !== nextStatus)
    ) {
      const { general } = await getTenantSettings(effectiveTenantId);
      validateRequiredPoNumber(Boolean(general?.requirePoForPlacement), nextPo);
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
      if (!payload.candidateId) {
        data.candidate = { disconnect: true };
      } else {
        const validCandId = await this.validateTenantReference(
          () =>
            prisma.candidate.findFirst({
              where: { id: payload.candidateId, tenantId: effectiveTenantId },
              select: { id: true },
            }),
          'consultant'
        );
        data.candidate = { connect: { id: validCandId } };
      }
    }
    if (payload.clientId !== undefined) {
      if (!payload.clientId) {
        data.client = { disconnect: true };
      } else {
        const validClientId = await this.validateTenantReference(
          () =>
            prisma.client.findFirst({
              where: { id: payload.clientId, tenantId: effectiveTenantId },
              select: { id: true },
            }),
          'client'
        );
        data.client = { connect: { id: validClientId } };
      }
    }
    if (payload.vendorId !== undefined) {
      if (!payload.vendorId) {
        data.vendor = { disconnect: true };
      } else {
        const validVendorId = await this.validateTenantReference(
          () =>
            prisma.vendor.findFirst({
              where: { id: payload.vendorId, tenantId: effectiveTenantId },
              select: { id: true },
            }),
          'vendor'
        );
        data.vendor = { connect: { id: validVendorId } };
      }
    } else if (payload.vendorName !== undefined) {
      const trimmedVendor = String(payload.vendorName || '').trim();
      if (!trimmedVendor) {
        data.vendor = { disconnect: true };
      } else {
        const matchedVendor = await prisma.vendor.findFirst({
          where: { tenantId: effectiveTenantId, name: { equals: trimmedVendor, mode: 'insensitive' } },
          select: { id: true },
        });
        if (matchedVendor) data.vendor = { connect: { id: matchedVendor.id } };
      }
    }
    const parsedCustomFields = parseCustomFields(payload.customFields);
    if (parsedCustomFields !== undefined) {
      data.customFields = parsedCustomFields;
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
      if (data.placementType !== PlacementType.C2C_SUBCONTRACTOR && payload.vendorId === undefined && payload.vendorName === undefined) {
        data.vendor = { disconnect: true };
      }
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

    if (payload.status !== undefined) {
      const normalizedStatus = this.mapPlacementStatus(payload.status);
      try {
        if (
          normalizedStatus === PlacementStatus.COMPLETED ||
          normalizedStatus === PlacementStatus.TERMINATED
        ) {
          await this.syncCandidatePipelineStage(existing, CandidatePipelineStage.AVAILABLE_BENCH);
          await slaEngineService.resolveTasksForEntity(effectiveTenantId, 'placement', updated.id);
          if (existing.status !== normalizedStatus) {
            const endDateStr = updated.endDate.toISOString().split('T')[0];
            await automationEngineService.recordLifecycleEvent({
              tenantId: effectiveTenantId,
              preferredCategories: [AutomationCategory.CONTRACT],
              ruleName: `Placement ${normalizedStatus === PlacementStatus.COMPLETED ? 'Completed' : 'Terminated'}`,
              target: `${updated.resourceName} @ ${updated.customer}`,
              conditionsMet: `Resource engagement ${normalizedStatus.toLowerCase()} (effective ${endDateStr})`,
              actionDispatched: 'Placement archived to Ended ledger & bench availability synchronized',
            });
          }
        } else if (
          normalizedStatus === PlacementStatus.ACTIVE ||
          normalizedStatus === PlacementStatus.EXTENDED ||
          normalizedStatus === PlacementStatus.EXPIRING_SOON
        ) {
          await this.syncCandidatePipelineStage(existing, CandidatePipelineStage.BILLABLE);
        }
      } catch {
        // Non-critical stage sync failure
      }
    }

    try {
      await slaEngineService.reconcileOpenTasks(effectiveTenantId);
      await slaEngineService.evaluateSlaRadar(effectiveTenantId);
    } catch {
      // Non-critical SLA sync
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

    const effectiveTenantId = tenantId || existing.tenantId;
    const { general } = await getTenantSettings(effectiveTenantId);
    const nextPo =
      payload.purchaseOrderNumber !== undefined
        ? payload.purchaseOrderNumber
        : existing.purchaseOrderNumber;
    validateRequiredPoNumber(Boolean(general?.requirePoForPlacement), nextPo);

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
      const effectiveTenantId = tenantId || existing.tenantId;
      await this.syncCandidatePipelineStage(existing, CandidatePipelineStage.BILLABLE);
      await slaEngineService.resolveTasksForEntity(effectiveTenantId, 'placement', updated.id);
      await automationEngineService.recordLifecycleEvent({
        tenantId: effectiveTenantId,
        preferredCategories: [AutomationCategory.CONTRACT],
        ruleName: 'SOW Extension Protocol',
        target: `${updated.resourceName} @ ${updated.customer}`,
        conditionsMet: 'Client Extension Verified',
        actionDispatched: `Extended SOW through ${updated.endDate.toISOString().split('T')[0]}`,
      });
    } catch {
      // Non-critical
    }

    return updated;
  }

  async deletePlacement(id: string, tenantId?: string) {
    const existing = await prisma.placement.findUnique({ where: { id } });
    if (!existing || (tenantId && existing.tenantId !== tenantId)) {
      throw new Error('Placement not found or unauthorized');
    }

    validatePlacementCanDelete(existing.status);
    const deleted = await prisma.placement.delete({ where: { id } });

    try {
      const targetCandidate = existing.candidateId
        ? await prisma.candidate.findUnique({ where: { id: existing.candidateId } })
        : await prisma.candidate.findFirst({
            where: {
              tenantId: existing.tenantId,
              fullName: { equals: existing.resourceName.trim(), mode: 'insensitive' },
            },
          });

      if (targetCandidate && targetCandidate.pipelineStage === CandidatePipelineStage.BILLABLE) {
        const remainingPlacements = await prisma.placement.count({
          where: {
            tenantId: existing.tenantId,
            OR: [
              { candidateId: targetCandidate.id },
              {
                candidateId: null,
                resourceName: { equals: targetCandidate.fullName, mode: 'insensitive' },
              },
            ],
          },
        });
        if (remainingPlacements === 0) {
          await prisma.candidate.update({
            where: { id: targetCandidate.id },
            data: { pipelineStage: CandidatePipelineStage.AVAILABLE_BENCH },
          });
        }
      }

      if (existing.requirementId && targetCandidate) {
        await prisma.submission.updateMany({
          where: {
            tenantId: existing.tenantId,
            requirementId: existing.requirementId,
            candidateId: targetCandidate.id,
            stage: 'ONBOARDING',
          },
          data: { stage: 'SELECTED' },
        });

        const reqRecord = await prisma.requirement.findUnique({
          where: { id: existing.requirementId },
          select: { status: true, openPositions: true },
        });
        if (reqRecord?.status === 'ONBOARDING') {
          const activePlaced = await prisma.placement.count({
            where: {
              tenantId: existing.tenantId,
              requirementId: existing.requirementId,
              status: { in: [PlacementStatus.ACTIVE, PlacementStatus.EXTENDED, PlacementStatus.EXPIRING_SOON] },
            },
          });
          if (activePlaced < Math.max(1, reqRecord.openPositions)) {
            const [subs, tenantStages] = await Promise.all([
              prisma.submission.findMany({
                where: { requirementId: existing.requirementId },
                select: { stage: true },
              }),
              getTenantPipelineStages(existing.tenantId),
            ]);
            const nextStatus = computeHighestActiveStage(
              subs
                .map((s) => s.stage)
                .filter((st) => normalizeStageValue(st) !== RequirementStatus.ONBOARDING),
              tenantStages
            );
            await prisma.requirement.update({
              where: { id: existing.requirementId },
              data: { status: nextStatus },
            });
          }
        }
      }

      await slaEngineService.resolveTasksForEntity(existing.tenantId, 'placement', id);
    } catch {
      // Non-critical
    }
    return deleted;
  }

  /**
   * Keeps the linked consultant's pipeline stage synchronized with active placement state.
   * Only returns a consultant to AVAILABLE_BENCH when no other active placement remains.
   */
  private async syncCandidatePipelineStage(
    existing: { id: string; tenantId: string; candidateId: string | null; resourceName: string },
    targetStage: CandidatePipelineStage,
    options?: { excludePlacementId?: string }
  ) {
    const targetCandidate = existing.candidateId
      ? await prisma.candidate.findUnique({ where: { id: existing.candidateId } })
      : await prisma.candidate.findFirst({
          where: {
            tenantId: existing.tenantId,
            fullName: { equals: existing.resourceName.trim(), mode: 'insensitive' },
          },
        });

    if (!targetCandidate) return;

    if (targetStage === CandidatePipelineStage.AVAILABLE_BENCH) {
      const remainingActiveCount = await prisma.placement.count({
        where: {
          tenantId: existing.tenantId,
          id: { not: options?.excludePlacementId ?? existing.id },
          status: {
            in: [
              PlacementStatus.ACTIVE,
              PlacementStatus.EXTENDED,
              PlacementStatus.EXPIRING_SOON,
            ],
          },
          OR: [
            { candidateId: targetCandidate.id },
            {
              candidateId: null,
              resourceName: { equals: targetCandidate.fullName, mode: 'insensitive' },
            },
          ],
        },
      });
      if (remainingActiveCount > 0) return;
    }

    await prisma.candidate.update({
      where: { id: targetCandidate.id },
      data: { pipelineStage: targetStage },
    });
  }

  async getFinancialMetrics(tenantId?: string) {
    const where: Prisma.PlacementWhereInput = {
      status: {
        in: [
          PlacementStatus.ACTIVE,
          PlacementStatus.EXTENDED,
          PlacementStatus.EXPIRING_SOON,
        ],
      },
    };
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

