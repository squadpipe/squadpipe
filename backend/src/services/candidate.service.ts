import { prisma } from '../config/prisma.config';
import { CandidatePipelineStage, PlacementStatus, Prisma } from '@prisma/client';
import {
  cvStorageService,
  parseCvStorageUri,
  StoredCvMetadata,
  UploadedCvFile,
} from './cvStorage.service';
import { parseCustomFields } from '../utils/customFields';
import { parseRateNumber } from '../utils/rateParser';
import { candidateIndexingService } from './vector/candidateIndexing.service';
import {
  SortDirection,
  buildPrismaOrderBy,
  sortRecordsByColumn,
} from '../utils/tableSort';

export const CANDIDATE_SORTABLE_FIELDS = [
  'fullName',
  'workAuth',
  'currentTitle',
  'hourlyRate',
  'relocation',
  'stage',
  'pipelineStage',
  'createdAt',
] as const;

export interface CandidateFilterParams {
  tenantId?: string;
  search?: string;
  stage?: string;
  workAuth?: string;
  vendorId?: string;
  minRate?: number;
  maxRate?: number;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortDir?: SortDirection;
}

export function parseCandidateSearchTokens(search?: string): string[] {
  const raw = String(search || '').trim();
  if (!raw) return [];

  const tokens: string[] = [];
  const regex = /"([^"]+)"|(\S+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(raw)) !== null) {
    const token = (match[1] ?? match[2] ?? '').replace(/^,+|,+$/g, '').trim();
    if (!token) continue;
    const upper = token.toUpperCase();
    if (upper === 'AND' || token === '&' || token === '+') continue;
    tokens.push(token);
    if (tokens.length >= 8) break;
  }
  return tokens;
}

export function buildCandidateWhereClause(params: CandidateFilterParams): Prisma.CandidateWhereInput {
  const { search, stage, workAuth, vendorId, minRate, maxRate, tenantId } = params;
  const where: Prisma.CandidateWhereInput = {};

  if (tenantId) {
    where.tenantId = tenantId;
  }

  const andClauses: Prisma.CandidateWhereInput[] = [];
  const tokens = parseCandidateSearchTokens(search);
  for (const token of tokens) {
    andClauses.push({
      OR: [
        { fullName: { contains: token, mode: 'insensitive' } },
        { skillset: { contains: token, mode: 'insensitive' } },
        { currentTitle: { contains: token, mode: 'insensitive' } },
        { workAuth: { contains: token, mode: 'insensitive' } },
        { rawSnippet: { contains: token, mode: 'insensitive' } },
        { email: { contains: token, mode: 'insensitive' } },
        { phone: { contains: token, mode: 'insensitive' } },
        { vendor: { name: { contains: token, mode: 'insensitive' } } },
      ],
    });
  }

  const hasMinRate = typeof minRate === 'number' && Number.isFinite(minRate) && minRate >= 0;
  const hasMaxRate = typeof maxRate === 'number' && Number.isFinite(maxRate) && maxRate >= 0;
  if (hasMinRate || hasMaxRate) {
    const rateCond: Prisma.DecimalNullableFilter = {
      ...(hasMinRate ? { gte: minRate } : {}),
      ...(hasMaxRate ? { lte: maxRate } : {}),
    };
    andClauses.push({
      OR: [{ hourlyRateW2: rateCond }, { hourlyRateC2c: rateCond }],
    });
  }

  if (andClauses.length > 0) {
    where.AND = andClauses;
  }

  if (stage && stage !== 'ALL' && stage !== 'All') {
    const mappedStage = stageMap[stage] || (stage as CandidatePipelineStage);
    where.pipelineStage = mappedStage;
  }
  if (workAuth && workAuth !== 'ALL' && workAuth !== 'All') {
    where.workAuth = { contains: String(workAuth).trim(), mode: 'insensitive' };
  }
  if (vendorId && vendorId !== 'ALL' && vendorId !== 'All') {
    where.vendorId = vendorId;
  }

  return where;
}

export const stageMap: Record<string, CandidatePipelineStage> = {
  'Available / Bench': CandidatePipelineStage.AVAILABLE_BENCH,
  'AVAILABLE_BENCH': CandidatePipelineStage.AVAILABLE_BENCH,
  'Submitted': CandidatePipelineStage.SUBMITTED,
  'SUBMITTED': CandidatePipelineStage.SUBMITTED,
  'Interview': CandidatePipelineStage.INTERVIEW,
  'INTERVIEW': CandidatePipelineStage.INTERVIEW,
  'Selected': CandidatePipelineStage.SELECTED,
  'SELECTED': CandidatePipelineStage.SELECTED,
  'Onboarding': CandidatePipelineStage.ONBOARDING,
  'ONBOARDING': CandidatePipelineStage.ONBOARDING,
  'Billable': CandidatePipelineStage.BILLABLE,
  'BILLABLE': CandidatePipelineStage.BILLABLE,
  'Archived': CandidatePipelineStage.ARCHIVED,
  'ARCHIVED': CandidatePipelineStage.ARCHIVED
};

const CANDIDATE_DEFAULT_INCLUDE = {
  assignedRecruiter: {
    select: { id: true, fullName: true, role: true, desk: true },
  },
  vendor: {
    select: { id: true, name: true, msaSigned: true, coiExpiryDate: true },
  },
} satisfies Prisma.CandidateInclude;

export class CandidateService {
  private buildWhereClause(params: CandidateFilterParams): Prisma.CandidateWhereInput {
    return buildCandidateWhereClause(params);
  }

  private async resolveTenantVendorId(
    tenantId: string,
    raw: any
  ): Promise<string | null | undefined> {
    if (raw.vendorId === undefined && raw.vendorName === undefined) {
      return undefined;
    }
    const rawId = typeof raw.vendorId === 'string' ? raw.vendorId.trim() : raw.vendorId;
    if (rawId) {
      const existingVendor = await prisma.vendor.findFirst({
        where: { id: String(rawId), tenantId },
        select: { id: true },
      });
      return existingVendor?.id ?? null;
    }
    const rawName = typeof raw.vendorName === 'string' ? raw.vendorName.trim() : '';
    if (rawName) {
      const matchedVendor = await prisma.vendor.findFirst({
        where: { tenantId, name: { equals: rawName, mode: 'insensitive' } },
        select: { id: true },
      });
      return matchedVendor?.id ?? null;
    }
    return null;
  }

  private getCandidateOrderBy(
    sortBy?: string,
    sortDir: SortDirection = 'desc'
  ): Prisma.CandidateOrderByWithRelationInput[] {
    const defaultOrder: Prisma.CandidateOrderByWithRelationInput[] = [
      { createdAt: 'desc' },
      { id: 'desc' },
    ];
    return buildPrismaOrderBy<Prisma.CandidateOrderByWithRelationInput>(
      sortBy,
      sortDir,
      {
        fullName: (d) => [{ fullName: d }, { id: d }],
        workAuth: (d) => [{ workAuth: d }, { id: d }],
        currentTitle: (d) => [{ currentTitle: d }, { id: d }],
        relocation: (d) => [{ relocation: d }, { id: d }],
        stage: (d) => [{ pipelineStage: d }, { id: d }],
        pipelineStage: (d) => [{ pipelineStage: d }, { id: d }],
        createdAt: (d) => [{ createdAt: d }, { id: d }],
      },
      defaultOrder
    ) as Prisma.CandidateOrderByWithRelationInput[];
  }

  async getCandidates(params: CandidateFilterParams) {
    const where = this.buildWhereClause(params);
    return prisma.candidate.findMany({
      where,
      include: CANDIDATE_DEFAULT_INCLUDE,
      orderBy: this.getCandidateOrderBy(params.sortBy, params.sortDir),
    });
  }

  async getCandidatesPaginated(params: CandidateFilterParams) {
    const where = this.buildWhereClause(params);
    const hasPagination = params.page !== undefined || params.limit !== undefined;
    const page = params.page ? Math.max(1, params.page) : 1;
    const limit = params.limit ? Math.max(1, Math.min(100, params.limit)) : 10;
    const include = CANDIDATE_DEFAULT_INCLUDE;

    if (params.sortBy === 'hourlyRate') {
      const rateDir = params.sortDir || 'desc';
      const rateCandidates = await prisma.candidate.findMany({
        where,
        select: {
          id: true,
          hourlyRateW2: true,
          hourlyRateC2c: true,
          hourlyRateDisplay: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });

      const extractNumericRate = (c: typeof rateCandidates[number]): number | null => {
        if (c.hourlyRateW2 !== null) return Number(c.hourlyRateW2);
        if (c.hourlyRateC2c !== null) return Number(c.hourlyRateC2c);
        if (c.hourlyRateDisplay && /\d/.test(c.hourlyRateDisplay)) {
          return parseRateNumber(c.hourlyRateDisplay, 0);
        }
        return null;
      };

      const sortedRows = sortRecordsByColumn(rateCandidates, 'hourlyRate', rateDir, {
        hourlyRate: extractNumericRate,
      });

      const total = sortedRows.length;
      const sliced = hasPagination
        ? sortedRows.slice((page - 1) * limit, page * limit)
        : sortedRows;
      const pageIds = sliced.map((r) => r.id);

      const fullRows =
        pageIds.length > 0
          ? await prisma.candidate.findMany({
              where: { id: { in: pageIds } },
              include,
            })
          : [];
      const rowById = new Map(fullRows.map((r) => [r.id, r]));
      const orderedData = pageIds.map((id) => rowById.get(id)).filter((r): r is NonNullable<typeof r> => Boolean(r));

      return {
        data: orderedData,
        pagination: {
          page: hasPagination ? page : 1,
          limit: hasPagination ? limit : orderedData.length || 10,
          total,
          totalPages: hasPagination ? Math.max(1, Math.ceil(total / limit)) : 1,
        },
      };
    }

    const orderBy = this.getCandidateOrderBy(params.sortBy, params.sortDir);

    if (!hasPagination) {
      const data = await prisma.candidate.findMany({
        where,
        include,
        orderBy,
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

    const [total, data] = await Promise.all([
      prisma.candidate.count({ where }),
      prisma.candidate.findMany({
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

  async getCandidateById(id: string, tenantId?: string) {
    const where: Prisma.CandidateWhereUniqueInput = { id };
    const cand = await prisma.candidate.findUnique({
      where,
      include: {
        assignedRecruiter: true,
        vendor: {
          select: { id: true, name: true, msaSigned: true, coiExpiryDate: true },
        },
        submissions: { include: { requirement: true } },
        placements: true
      }
    });

    if (cand && tenantId && cand.tenantId !== tenantId) {
      return null;
    }
    return cand;
  }

  async createCandidate(
    raw: any,
    tenantId: string = 'squadpipe-agency',
    recruiterId?: string,
    cvFile?: UploadedCvFile
  ) {
    const rateDisplay = raw.hourlyRateDisplay || raw.hourlyRate || '$90/hr (W2)';
    const rateDigits = Math.round(parseRateNumber(rateDisplay, 90)) || 90;
    const isC2C = String(rateDisplay).toUpperCase().includes('C2C');

    const mappedStage = stageMap[raw.pipelineStage] || CandidatePipelineStage.AVAILABLE_BENCH;

    let storedCv: StoredCvMetadata | null = null;
    if (cvFile) {
      storedCv = await cvStorageService.uploadCv(cvFile, tenantId);
    }

    const resumeFileName =
      storedCv?.originalFileName ||
      raw.resumeFileName ||
      raw.resumeName ||
      `${(raw.fullName || 'Candidate').replace(/\s+/g, '_')}_Resume.pdf`;
    const resumeFormat = storedCv?.resumeFormat || raw.resumeFormat || 'PDF';
    const resumeFileUrl = storedCv?.storageUri || raw.resumeFileUrl || null;
    const customFields = parseCustomFields(raw.customFields);

    let resolvedRecruiterId: string | null = raw.assignedRecruiterId || recruiterId || null;
    if (resolvedRecruiterId) {
      const existingUser = await prisma.user.findFirst({
        where: { id: resolvedRecruiterId, tenantId },
        select: { id: true },
      });
      if (!existingUser) resolvedRecruiterId = null;
    }
    const recruiterName = raw.assignedRecruiter || raw.recruiter;
    if (!resolvedRecruiterId && recruiterName && typeof recruiterName === 'string' && recruiterName.trim()) {
      const matchedUser = await prisma.user.findFirst({
        where: { tenantId, fullName: { equals: recruiterName.trim(), mode: 'insensitive' } },
        select: { id: true },
      });
      if (matchedUser) resolvedRecruiterId = matchedUser.id;
    }

    const resolvedVendorId = await this.resolveTenantVendorId(tenantId, raw);

    try {
      const created = await prisma.candidate.create({
        data: {
          tenantId,
          fullName: raw.fullName?.trim() || 'Anonymous Candidate',
          email: raw.email?.trim()?.toLowerCase() || `cand_${Date.now()}@domain.com`,
          phone: raw.phone?.trim() || null,
          currentTitle: raw.currentTitle?.trim() || 'Software Engineer',
          workAuth: raw.workAuth?.trim() || 'US Citizen',
          education: raw.education?.trim() || "Master's Degree",
          skillset: raw.skillset?.trim() || 'General Engineering',
          hourlyRateDisplay: rateDisplay,
          hourlyRateW2: isC2C ? null : rateDigits,
          hourlyRateC2c: isC2C ? rateDigits : null,
          relocation: raw.relocation || 'Yes',
          resumeFileName,
          resumeFormat,
          resumeFileUrl,
          rawSnippet: raw.rawSnippet || null,
          pipelineStage: mappedStage,
          ...(customFields !== undefined ? { customFields } : {}),
          assignedRecruiterId: resolvedRecruiterId,
          ...(resolvedVendorId ? { vendorId: resolvedVendorId } : {}),
        },
        include: CANDIDATE_DEFAULT_INCLUDE,
      });
      candidateIndexingService.scheduleCandidateSync(created.id, tenantId);
      return created;
    } catch (error: any) {
      if (storedCv?.storageUri) {
        await cvStorageService.deleteCv(storedCv.storageUri);
      }
      if (error?.code === 'P2002') {
        const dupErr: any = new Error('A consultant with this email already exists in this workspace.');
        dupErr.statusCode = 409;
        throw dupErr;
      }
      throw error;
    }
  }

  async updateCandidate(
    id: string,
    raw: any,
    tenantId?: string,
    cvFile?: UploadedCvFile
  ) {
    const existing = await prisma.candidate.findUnique({ where: { id } });
    if (!existing || (tenantId && existing.tenantId !== tenantId)) {
      const notFoundErr: any = new Error('Candidate not found or unauthorized');
      notFoundErr.statusCode = 404;
      throw notFoundErr;
    }

    const data: Prisma.CandidateUpdateInput = {};
    if (raw.fullName !== undefined) data.fullName = String(raw.fullName).trim();
    if (raw.email !== undefined) data.email = String(raw.email).trim().toLowerCase();
    if (raw.phone !== undefined) data.phone = raw.phone;
    if (raw.currentTitle !== undefined) data.currentTitle = String(raw.currentTitle).trim();
    if (raw.workAuth !== undefined) data.workAuth = String(raw.workAuth).trim();
    if (raw.education !== undefined) data.education = raw.education;
    if (raw.skillset !== undefined) data.skillset = String(raw.skillset).trim();
    if (raw.relocation !== undefined) data.relocation = String(raw.relocation).trim();
    if (raw.rawSnippet !== undefined) data.rawSnippet = raw.rawSnippet || null;
    if (raw.resumeFileName !== undefined || raw.resumeName !== undefined) {
      data.resumeFileName = raw.resumeFileName ?? raw.resumeName ?? null;
    }
    if (raw.resumeFormat !== undefined) {
      data.resumeFormat = raw.resumeFormat || 'PDF';
    }
    if (raw.resumeFileUrl !== undefined) {
      data.resumeFileUrl = raw.resumeFileUrl || null;
    }
    const parsedCustomFields = parseCustomFields(raw.customFields);
    if (parsedCustomFields !== undefined) {
      data.customFields = parsedCustomFields;
    }
    if (raw.pipelineStage !== undefined) {
      data.pipelineStage = stageMap[raw.pipelineStage] || raw.pipelineStage;
    }
    if (raw.hourlyRate !== undefined || raw.hourlyRateDisplay !== undefined) {
      const rateDisplay = String(raw.hourlyRateDisplay || raw.hourlyRate || '');
      data.hourlyRateDisplay = rateDisplay;
      const rateDigits = Math.round(parseRateNumber(rateDisplay, 90)) || 90;
      const isC2C = rateDisplay.toUpperCase().includes('C2C');
      data.hourlyRateW2 = isC2C ? null : rateDigits;
      data.hourlyRateC2c = isC2C ? rateDigits : null;
    }

    const resolvedVendorId = await this.resolveTenantVendorId(existing.tenantId, raw);
    if (resolvedVendorId !== undefined) {
      data.vendor = resolvedVendorId
        ? { connect: { id: resolvedVendorId } }
        : { disconnect: true };
    }

    let storedCv: StoredCvMetadata | null = null;
    if (cvFile) {
      storedCv = await cvStorageService.uploadCv(cvFile, existing.tenantId);
      data.resumeFileUrl = storedCv.storageUri;
      data.resumeFileName = storedCv.originalFileName;
      data.resumeFormat = storedCv.resumeFormat;
    }

    try {
      const updated = await prisma.candidate.update({
        where: { id },
        data,
        include: CANDIDATE_DEFAULT_INCLUDE,
      });

      if (storedCv && existing.resumeFileUrl && existing.resumeFileUrl !== storedCv.storageUri) {
        await cvStorageService.deleteCv(existing.resumeFileUrl);
      }

      candidateIndexingService.scheduleCandidateSync(updated.id, updated.tenantId);
      return updated;
    } catch (error: any) {
      if (storedCv?.storageUri) {
        await cvStorageService.deleteCv(storedCv.storageUri);
      }
      if (error?.code === 'P2002') {
        const dupErr: any = new Error('A consultant with this email already exists in this workspace.');
        dupErr.statusCode = 409;
        throw dupErr;
      }
      throw error;
    }
  }

  /**
   * Attaches or replaces the original stored CV for an existing candidate.
   */
  async uploadCandidateCv(id: string, cvFile: UploadedCvFile, tenantId?: string) {
    return this.updateCandidate(id, {}, tenantId, cvFile);
  }

  /**
   * Downloads a candidate's original stored CV file, enforcing tenant isolation.
   */
  async downloadCandidateCv(id: string, tenantId?: string) {
    const candidate = await this.getCandidateById(id, tenantId);
    if (!candidate) {
      const notFoundErr: any = new Error('Candidate not found or unauthorized');
      notFoundErr.statusCode = 404;
      throw notFoundErr;
    }
    if (!candidate.resumeFileUrl || !parseCvStorageUri(candidate.resumeFileUrl)) {
      const missingCvErr: any = new Error('No original CV file is stored for this consultant');
      missingCvErr.statusCode = 404;
      throw missingCvErr;
    }
    return cvStorageService.downloadCv(
      candidate.resumeFileUrl,
      candidate.resumeFileName || undefined
    );
  }

  async deleteCandidate(id: string, tenantId?: string) {
    const existing = await prisma.candidate.findUnique({ where: { id } });
    if (!existing || (tenantId && existing.tenantId !== tenantId)) {
      const notFoundErr: any = new Error('Candidate not found or unauthorized');
      notFoundErr.statusCode = 404;
      throw notFoundErr;
    }

    const linkedPlacementsCount = await prisma.placement.count({
      where: {
        tenantId: existing.tenantId,
        status: { in: [PlacementStatus.ACTIVE, PlacementStatus.EXTENDED, PlacementStatus.EXPIRING_SOON] },
        OR: [
          { candidateId: existing.id },
          {
            candidateId: null,
            resourceName: { equals: existing.fullName, mode: 'insensitive' },
          },
        ],
      },
    });

    if (linkedPlacementsCount > 0 || existing.pipelineStage === CandidatePipelineStage.BILLABLE) {
      const conflictErr: any = new Error(
        'Cannot delete a billable consultant. Please remove them from Billable Consultants first.'
      );
      conflictErr.statusCode = 409;
      throw conflictErr;
    }

    const deleted = await prisma.candidate.delete({ where: { id } });
    await candidateIndexingService.deleteCandidate(existing.tenantId, id).catch(() => {});
    if (existing.resumeFileUrl) {
      await cvStorageService.deleteCv(existing.resumeFileUrl);
    }
    return deleted;
  }
}

export const candidateService = new CandidateService();

