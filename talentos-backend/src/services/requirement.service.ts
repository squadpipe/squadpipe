import { prisma } from '../config/prisma.config';
import { PlacementStatus, Prisma, WorkModel, AutomationCategory } from '@prisma/client';
import { slaEngineService } from './slaEngine.service';
import { automationEngineService } from './automationEngine.service';
import { parseCustomFields } from '../utils/customFields';

export const RequirementStatus = {
  REQUIREMENT: 'REQUIREMENT',
  SUBMITTED: 'SUBMITTED',
  INTERVIEW: 'INTERVIEW',
  SELECTED: 'SELECTED',
  ONBOARDING: 'ONBOARDING',
  CLOSED: 'CLOSED',
} as const;

export type RequirementStatus =
  (typeof RequirementStatus)[keyof typeof RequirementStatus];

const CANONICAL_STAGE_BY_LOWER: Record<string, RequirementStatus> = {
  requirement: RequirementStatus.REQUIREMENT,
  submitted: RequirementStatus.SUBMITTED,
  interview: RequirementStatus.INTERVIEW,
  selected: RequirementStatus.SELECTED,
  onboarding: RequirementStatus.ONBOARDING,
  closed: RequirementStatus.CLOSED,
};

export function normalizeStageValue(input?: unknown): string {
  const trimmed = String(input ?? '').trim();
  if (!trimmed) return '';
  return CANONICAL_STAGE_BY_LOWER[trimmed.toLowerCase()] || trimmed;
}

export interface RequirementFilterParams {
  tenantId?: string;
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
  view?: 'full' | 'kanban';
}

export const KANBAN_CARD_SELECT = {
  id: true,
  code: true,
  opportunityTitle: true,
  openPositions: true,
  skillsRequired: true,
  location: true,
  workModel: true,
  targetBillRate: true,
  targetPayRate: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  client: { select: { id: true, name: true } },
  clientContact: { select: { id: true, fullName: true, designation: true } },
  assignedRecruiter: { select: { id: true, fullName: true } },
  _count: { select: { submissions: true } },
  placements: {
    where: {
      status: { notIn: ['TERMINATED' as const, 'COMPLETED' as const] },
    },
    select: {
      id: true,
      candidateId: true,
      resourceName: true,
      status: true,
    },
    orderBy: { createdAt: 'desc' as const },
  },
};

export const requirementStatusMap: Record<string, RequirementStatus> = {
  'Requirement': RequirementStatus.REQUIREMENT,
  'REQUIREMENT': RequirementStatus.REQUIREMENT,
  'Submitted': RequirementStatus.SUBMITTED,
  'SUBMITTED': RequirementStatus.SUBMITTED,
  'Interview': RequirementStatus.INTERVIEW,
  'INTERVIEW': RequirementStatus.INTERVIEW,
  'Selected': RequirementStatus.SELECTED,
  'SELECTED': RequirementStatus.SELECTED,
  'Onboarding': RequirementStatus.ONBOARDING,
  'ONBOARDING': RequirementStatus.ONBOARDING,
  'Closed': RequirementStatus.CLOSED,
  'CLOSED': RequirementStatus.CLOSED,
};

export const REQUIREMENT_INCLUDE = {
  client: true,
  clientContact: true,
  assignedRecruiter: {
    select: { id: true, fullName: true, role: true, desk: true },
  },
  submissions: {
    include: {
      candidate: true,
      recruiter: { select: { id: true, fullName: true } },
    },
    orderBy: { createdAt: 'desc' as const },
  },
  placements: {
    where: {
      status: { notIn: ['TERMINATED' as const, 'COMPLETED' as const] },
    },
    select: {
      id: true,
      candidateId: true,
      resourceName: true,
      status: true,
    },
    orderBy: { createdAt: 'desc' as const },
  },
};

/**
 * Validates and normalizes `openPositions` as a whole integer >= 1 (capped at 1000).
 * Throws an HTTP 400 error if missing or invalid.
 */
export function parseOpenPositions(value: unknown): number {
  const createHttpError = (msg: string) => {
    const err: any = new Error(msg);
    err.statusCode = 400;
    return err;
  };

  if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
    throw createHttpError('Number of open positions is required and must be a whole number >= 1');
  }

  let parsed: number;
  if (typeof value === 'number') {
    parsed = value;
  } else if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!/^-?\d+$/.test(trimmed)) {
      throw createHttpError('Number of open positions must be a whole number >= 1');
    }
    parsed = Number(trimmed);
  } else {
    throw createHttpError('Number of open positions must be a whole number >= 1');
  }

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 1000) {
    throw createHttpError('Number of open positions must be a whole number between 1 and 1000');
  }

  return parsed;
}

export class RequirementService {
  private buildWhereClause(params: RequirementFilterParams): Prisma.RequirementWhereInput {
    const { search, status, tenantId } = params;
    const where: Prisma.RequirementWhereInput = {};

    if (tenantId) {
      where.tenantId = tenantId;
    }

    const q = search ? String(search).trim() : '';
    if (q) {
      where.OR = [
        { opportunityTitle: { contains: q, mode: 'insensitive' } },
        { companyName: { contains: q, mode: 'insensitive' } },
        { code: { contains: q, mode: 'insensitive' } },
        { skillsRequired: { contains: q, mode: 'insensitive' } },
        { location: { contains: q, mode: 'insensitive' } },
        { clientContact: { fullName: { contains: q, mode: 'insensitive' } } },
        { submissions: { some: { candidate: { fullName: { contains: q, mode: 'insensitive' } } } } },
      ];
    }
    if (status && status !== 'all' && status !== 'ALL') {
      where.status = requirementStatusMap[status] || status;
    }

    return where;
  }

  async getRequirements(params: RequirementFilterParams) {
    const where = this.buildWhereClause(params);
    return prisma.requirement.findMany({
      where,
      include: REQUIREMENT_INCLUDE,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
    });
  }

  async getRequirementsPaginated(params: RequirementFilterParams) {
    const where = this.buildWhereClause(params);
    const hasPagination = params.page !== undefined || params.limit !== undefined;
    const page = params.page ? Math.max(1, params.page) : 1;
    const limit = params.limit ? Math.max(1, Math.min(100, params.limit)) : 10;

    if (!hasPagination) {
      const data = await prisma.requirement.findMany({
        where,
        include: REQUIREMENT_INCLUDE,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
      });
      return {
        data,
        pagination: {
          page: 1,
          limit: data.length || 10,
          total: data.length,
          totalPages: 1
        }
      };
    }

    const isKanbanView = params.view === 'kanban';
    const [total, data] = await Promise.all([
      prisma.requirement.count({ where }),
      isKanbanView
        ? prisma.requirement.findMany({
            where,
            select: KANBAN_CARD_SELECT,
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            skip: (page - 1) * limit,
            take: limit,
          })
        : prisma.requirement.findMany({
            where,
            include: REQUIREMENT_INCLUDE,
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            skip: (page - 1) * limit,
            take: limit,
          }),
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

  async getKanbanBoard(params: {
    tenantId?: string;
    stages: string[];
    search?: string;
    perColumnLimit?: number;
  }) {
    const perColumnLimit = Math.max(1, Math.min(50, params.perColumnLimit || 25));
    const baseWhere = this.buildWhereClause({
      tenantId: params.tenantId,
      search: params.search,
    });

    const groupedCounts = await prisma.requirement.groupBy({
      by: ['status'],
      where: baseWhere,
      _count: { _all: true },
    });

    const dbToDisplay: Record<string, string> = {
      REQUIREMENT: 'Requirement',
      SUBMITTED: 'Submitted',
      INTERVIEW: 'Interview',
      SELECTED: 'Selected',
      ONBOARDING: 'Onboarding',
      CLOSED: 'Onboarding',
    };

    const countByStage = new Map<string, number>();
    for (const row of groupedCounts) {
      const displayStage = dbToDisplay[row.status] || row.status;
      countByStage.set(displayStage, (countByStage.get(displayStage) || 0) + row._count._all);
    }

    const stageList = [...params.stages];
    for (const st of countByStage.keys()) {
      if (!stageList.includes(st)) stageList.push(st);
    }

    const columns = await Promise.all(
      stageList.map(async (stage) => {
        const dbStatus = requirementStatusMap[stage] || stage;
        const stageWhere = {
          ...baseWhere,
          status: dbStatus,
        };
        const items = await prisma.requirement.findMany({
          where: stageWhere,
          select: KANBAN_CARD_SELECT,
          orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
          take: perColumnLimit,
        });
        const total = countByStage.get(stage) || 0;
        return {
          stage,
          total,
          items,
          hasMore: items.length < total,
        };
      })
    );

    const totalRequirements = Array.from(countByStage.values()).reduce((sum, n) => sum + n, 0);
    return {
      total: totalRequirements,
      perColumnLimit,
      columns,
    };
  }

  async getRequirementById(id: string, tenantId?: string) {
    const req = await prisma.requirement.findUnique({
      where: { id },
      include: REQUIREMENT_INCLUDE
    });

    if (req && tenantId && req.tenantId !== tenantId) {
      return null;
    }
    return req;
  }

  private async generateNextReqCode(tenantId: string, preferredCode?: string): Promise<string> {
    if (preferredCode && typeof preferredCode === 'string' && preferredCode.trim()) {
      const candidate = preferredCode.trim();
      const exists = await prisma.requirement.findFirst({
        where: { tenantId, code: candidate },
        select: { id: true },
      });
      if (!exists) return candidate;
    }
    const existingCodes = await prisma.requirement.findMany({
      where: { tenantId },
      select: { code: true },
    });
    let maxNum = 1000;
    for (const row of existingCodes) {
      const match = /^REQ-(\d+)$/i.exec(row.code || '');
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
    return `REQ-${maxNum + 1}`;
  }

  async createRequirement(raw: any, tenantId: string = 'talentos-agency', recruiterId?: string) {
    const openPositions = parseOpenPositions(raw.openPositions);
    const code = await this.generateNextReqCode(tenantId, raw.code);

    const billRateNum = typeof raw.targetBillRate === 'number' && raw.targetBillRate > 0
      ? raw.targetBillRate
      : parseInt(String(raw.targetRate || raw.targetBillRate || '115').replace(/\D/g, ''), 10) || 115;
    const payRateNum = typeof raw.targetPayRate === 'number' && raw.targetPayRate > 0
      ? raw.targetPayRate
      : Math.round(billRateNum * 0.75);

    const mappedStatus = requirementStatusMap[raw.status] || (typeof raw.status === 'string' && raw.status.trim() ? raw.status.trim() : RequirementStatus.REQUIREMENT);

    // Handle Client relationship or auto-create new client & hiring contact
    let resolvedClientId: string | null = raw.clientId || null;
    if (resolvedClientId) {
      const existingClientById = await prisma.client.findUnique({
        where: { id: resolvedClientId },
        select: { id: true },
      });
      if (!existingClientById) resolvedClientId = null;
    }

    let resolvedContactId: string | null = raw.clientContactId || null;
    if (resolvedContactId) {
      const existingContactById = await prisma.clientContact.findUnique({
        where: { id: resolvedContactId },
        select: { id: true },
      });
      if (!existingContactById) resolvedContactId = null;
    }

    if (!resolvedClientId && raw.companyName && raw.companyName.trim()) {
      const companyTrimmed = raw.companyName.trim();
      let existingClient = await prisma.client.findFirst({
        where: { name: { equals: companyTrimmed, mode: 'insensitive' }, tenantId },
        include: { contacts: true }
      });

      if (!existingClient) {
        existingClient = await prisma.client.create({
          data: {
            tenantId,
            name: companyTrimmed,
            location: raw.location?.trim() || 'Remote',
            clientType: 'End Client',
            msaStatus: true,
          },
          include: { contacts: true }
        });
      }

      resolvedClientId = existingClient.id;

      if (raw.clientContact && typeof raw.clientContact === 'string' && raw.clientContact.trim()) {
        const contactNameTrimmed = raw.clientContact.trim();
        const existingContact = existingClient.contacts.find(
          (c) => c.fullName.toLowerCase() === contactNameTrimmed.toLowerCase()
        );
        if (existingContact) {
          resolvedContactId = existingContact.id;
        } else {
          const createdContact = await prisma.clientContact.create({
            data: {
              clientId: existingClient.id,
              fullName: contactNameTrimmed,
              designation: raw.clientContactTitle?.trim() || 'Hiring Lead',
              email: raw.clientContactEmail?.trim().toLowerCase() || '',
              isPrimary: existingClient.contacts.length === 0,
            }
          });
          resolvedContactId = createdContact.id;
        }
      } else if (existingClient.contacts.length > 0) {
        resolvedContactId = existingClient.contacts[0].id;
      }
    }

    // Resolve assigned recruiter by name or validate supplied/auth user ID
    let resolvedRecruiterId: string | null = raw.assignedRecruiterId || null;
    if (!resolvedRecruiterId && raw.assignedRecruiter && typeof raw.assignedRecruiter === 'string' && raw.assignedRecruiter.trim()) {
      const matchedUser = await prisma.user.findFirst({
        where: { tenantId, fullName: { equals: raw.assignedRecruiter.trim(), mode: 'insensitive' } },
        select: { id: true }
      });
      if (matchedUser) resolvedRecruiterId = matchedUser.id;
    }
    if (!resolvedRecruiterId) resolvedRecruiterId = recruiterId || null;
    if (resolvedRecruiterId) {
      const existingUser = await prisma.user.findFirst({
        where: { id: resolvedRecruiterId, tenantId },
        select: { id: true },
      });
      if (!existingUser) resolvedRecruiterId = null;
    }

    // Map work model
    let workModel: WorkModel = WorkModel.REMOTE;
    const wmSource = String(raw.workModel || raw.location || '').toUpperCase();
    if (wmSource.includes('HYBRID')) workModel = WorkModel.HYBRID;
    else if (wmSource.includes('ONSITE')) workModel = WorkModel.ONSITE;

    const created = await prisma.requirement.create({
      data: {
        tenantId,
        code,
        opportunityTitle: raw.opportunityTitle?.trim() || 'Software Engineer Requisition',
        openPositions,
        companyName: raw.companyName?.trim() || 'Partner Enterprise',
        clientId: resolvedClientId,
        clientContactId: resolvedContactId,
        skillsRequired: raw.skillsRequired?.trim() || 'Software Engineering',
        location: raw.location?.trim() || 'Remote',
        workModel,
        targetBillRate: billRateNum,
        targetPayRate: payRateNum,
        status: mappedStatus,
        rawEmailText: raw.rawEmailText || null,
        missingNotes: raw.missingNotes || null,
        customFields: parseCustomFields(raw.customFields) ?? {},
        assignedRecruiterId: resolvedRecruiterId
      },
      include: REQUIREMENT_INCLUDE
    });

    try {
      await slaEngineService.evaluateSlaRadar(tenantId);
    } catch {
      // Non-critical initial SLA check
    }

    return created;
  }

  async updateRequirement(id: string, raw: any, tenantId?: string) {
    const existing = await prisma.requirement.findUnique({ where: { id } });
    if (!existing || (tenantId && existing.tenantId !== tenantId)) {
      throw new Error('Requirement not found or unauthorized');
    }

    const data: Prisma.RequirementUpdateInput = {};
    if (raw.opportunityTitle !== undefined) data.opportunityTitle = String(raw.opportunityTitle).trim();
    if (raw.openPositions !== undefined) data.openPositions = parseOpenPositions(raw.openPositions);
    if (raw.companyName !== undefined) data.companyName = String(raw.companyName).trim();
    if (raw.location !== undefined) data.location = String(raw.location).trim();
    if (raw.skillsRequired !== undefined) data.skillsRequired = String(raw.skillsRequired).trim();
    if (raw.customFields !== undefined) data.customFields = parseCustomFields(raw.customFields) ?? {};
    if (raw.status !== undefined) {
      data.status = requirementStatusMap[raw.status] || String(raw.status).trim();
    }
    if (raw.workModel !== undefined) {
      const wm = String(raw.workModel).toUpperCase();
      data.workModel = wm.includes('HYBRID')
        ? WorkModel.HYBRID
        : wm.includes('ONSITE')
        ? WorkModel.ONSITE
        : WorkModel.REMOTE;
    }
    if (raw.targetBillRate !== undefined) {
      data.targetBillRate = Number(raw.targetBillRate) || 0;
    }
    if (raw.targetPayRate !== undefined) {
      data.targetPayRate = Number(raw.targetPayRate) || 0;
    }
    if (raw.assignedRecruiterId !== undefined) {
      let validRecruiterId: string | null = raw.assignedRecruiterId || null;
      if (validRecruiterId) {
        const existingUser = await prisma.user.findFirst({
          where: { id: validRecruiterId, tenantId: existing.tenantId },
          select: { id: true },
        });
        if (!existingUser) validRecruiterId = null;
      }
      data.assignedRecruiter = validRecruiterId
        ? { connect: { id: validRecruiterId } }
        : { disconnect: true };
    } else if (raw.assignedRecruiter !== undefined && typeof raw.assignedRecruiter === 'string' && raw.assignedRecruiter.trim()) {
      const matchedUser = await prisma.user.findFirst({
        where: {
          tenantId: existing.tenantId,
          fullName: { equals: raw.assignedRecruiter.trim(), mode: 'insensitive' },
        },
        select: { id: true },
      });
      if (matchedUser) {
        data.assignedRecruiter = { connect: { id: matchedUser.id } };
      }
    }

    return prisma.requirement.update({
      where: { id },
      data,
      include: REQUIREMENT_INCLUDE
    });
  }

  async updateRequirementStage(id: string, statusInput: string, resourceName?: string, tenantId?: string) {
    const existingReq = await prisma.requirement.findUnique({ where: { id } });
    if (!existingReq || (tenantId && existingReq.tenantId !== tenantId)) {
      throw new Error('Requirement not found or unauthorized');
    }

    const effectiveTenantId = tenantId || existingReq.tenantId;
    const status = requirementStatusMap[statusInput] || String(statusInput).trim();
    const updated = await prisma.requirement.update({
      where: { id },
      data: { status },
      include: REQUIREMENT_INCLUDE
    });

    try {
      await slaEngineService.evaluateSlaRadar(effectiveTenantId);
    } catch {
      // Non-critical SLA sync
    }

    return updated;
  }

  async deleteRequirement(id: string, tenantId?: string) {
    const existing = await prisma.requirement.findUnique({ where: { id } });
    if (!existing || (tenantId && existing.tenantId !== tenantId)) {
      const notFoundErr: any = new Error('Requirement not found or unauthorized');
      notFoundErr.statusCode = 404;
      throw notFoundErr;
    }

    const activePlacementsCount = await prisma.placement.count({
      where: {
        tenantId: existing.tenantId,
        requirementId: existing.id,
        status: { in: [PlacementStatus.ACTIVE, PlacementStatus.EXTENDED, PlacementStatus.EXPIRING_SOON] },
      },
    });
    if (activePlacementsCount > 0) {
      const conflictErr: any = new Error(
        `Cannot delete this requirement while ${activePlacementsCount} billable consultant(s) are active on it. Please release them first.`
      );
      conflictErr.statusCode = 409;
      throw conflictErr;
    }

    const deleted = await prisma.requirement.delete({ where: { id } });
    try {
      await slaEngineService.resolveTasksForEntity(existing.tenantId, 'requirement', id);
    } catch {
      // Non-critical
    }
    return deleted;
  }
}

export const requirementService = new RequirementService();

