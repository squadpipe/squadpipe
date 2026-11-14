import { prisma } from '../config/prisma.config';
import { CandidatePipelineStage, PlacementStatus, Prisma } from '@prisma/client';
import {
  cvStorageService,
  parseCvStorageUri,
  StoredCvMetadata,
  UploadedCvFile,
} from './cvStorage.service';

export interface CandidateFilterParams {
  tenantId?: string;
  search?: string;
  stage?: string;
  workAuth?: string;
  page?: number;
  limit?: number;
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

export class CandidateService {
  private buildWhereClause(params: CandidateFilterParams): Prisma.CandidateWhereInput {
    const { search, stage, workAuth, tenantId } = params;
    const where: Prisma.CandidateWhereInput = {};

    if (tenantId) {
      where.tenantId = tenantId;
    }

    const q = search ? String(search).trim() : '';
    if (q) {
      where.OR = [
        { fullName: { contains: q, mode: 'insensitive' } },
        { skillset: { contains: q, mode: 'insensitive' } },
        { currentTitle: { contains: q, mode: 'insensitive' } },
        { workAuth: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } }
      ];
    }
    if (stage && stage !== 'ALL' && stage !== 'All') {
      const mappedStage = stageMap[stage] || (stage as CandidatePipelineStage);
      where.pipelineStage = mappedStage;
    }
    if (workAuth && workAuth !== 'ALL' && workAuth !== 'All') {
      where.workAuth = { contains: String(workAuth).trim(), mode: 'insensitive' };
    }

    return where;
  }

  async getCandidates(params: CandidateFilterParams) {
    const where = this.buildWhereClause(params);
    return prisma.candidate.findMany({
      where,
      include: {
        assignedRecruiter: {
          select: { id: true, fullName: true, role: true, desk: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getCandidatesPaginated(params: CandidateFilterParams) {
    const where = this.buildWhereClause(params);
    const hasPagination = params.page !== undefined || params.limit !== undefined;
    const page = params.page ? Math.max(1, params.page) : 1;
    const limit = params.limit ? Math.max(1, Math.min(100, params.limit)) : 10;

    const include = {
      assignedRecruiter: {
        select: { id: true, fullName: true, role: true, desk: true }
      }
    };

    if (!hasPagination) {
      const data = await prisma.candidate.findMany({
        where,
        include,
        orderBy: { createdAt: 'desc' }
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
        orderBy: { createdAt: 'desc' },
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
        submissions: { include: { requirement: true } },
        placements: true
      }
    });

    if (cand && tenantId && cand.tenantId !== tenantId) {
      return null;
    }
    return cand;
  }

  private parseCustomFields(value: unknown): Prisma.InputJsonValue | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (parsed && typeof parsed === 'object') return parsed as Prisma.InputJsonValue;
      } catch {
        return undefined;
      }
      return undefined;
    }
    if (typeof value === 'object') {
      return value as Prisma.InputJsonValue;
    }
    return undefined;
  }

  async createCandidate(
    raw: any,
    tenantId: string = 'talentos-agency',
    recruiterId?: string,
    cvFile?: UploadedCvFile
  ) {
    const rateDisplay = raw.hourlyRateDisplay || raw.hourlyRate || '$90/hr (W2)';
    const rateDigits = parseInt(String(rateDisplay).replace(/\D/g, ''), 10) || 90;
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
    const customFields = this.parseCustomFields(raw.customFields);

    let resolvedRecruiterId: string | null = raw.assignedRecruiterId || recruiterId || null;
    if (resolvedRecruiterId) {
      const existingUser = await prisma.user.findUnique({
        where: { id: resolvedRecruiterId },
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

    try {
      return await prisma.candidate.create({
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
        },
        include: {
          assignedRecruiter: {
            select: { id: true, fullName: true, role: true, desk: true },
          },
        },
      });
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
    const parsedCustomFields = this.parseCustomFields(raw.customFields);
    if (parsedCustomFields !== undefined) {
      data.customFields = parsedCustomFields;
    }
    if (raw.pipelineStage !== undefined) {
      data.pipelineStage = stageMap[raw.pipelineStage] || raw.pipelineStage;
    }
    if (raw.hourlyRate !== undefined || raw.hourlyRateDisplay !== undefined) {
      const rateDisplay = String(raw.hourlyRateDisplay || raw.hourlyRate || '');
      data.hourlyRateDisplay = rateDisplay;
      const rateDigits = parseInt(rateDisplay.replace(/\D/g, ''), 10) || 90;
      const isC2C = rateDisplay.toUpperCase().includes('C2C');
      data.hourlyRateW2 = isC2C ? null : rateDigits;
      data.hourlyRateC2c = isC2C ? rateDigits : null;
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
        include: {
          assignedRecruiter: {
            select: { id: true, fullName: true, role: true, desk: true },
          },
        },
      });

      if (storedCv && existing.resumeFileUrl && existing.resumeFileUrl !== storedCv.storageUri) {
        await cvStorageService.deleteCv(existing.resumeFileUrl);
      }

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
    if (existing.resumeFileUrl) {
      await cvStorageService.deleteCv(existing.resumeFileUrl);
    }
    return deleted;
  }
}

export const candidateService = new CandidateService();

