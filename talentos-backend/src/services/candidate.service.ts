import { prisma } from '../config/prisma.config';
import { CandidatePipelineStage, Prisma } from '@prisma/client';

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

  async createCandidate(raw: any, tenantId: string = 'talentos-agency', recruiterId?: string) {
    const rateDisplay = raw.hourlyRateDisplay || raw.hourlyRate || '$90/hr (W2)';
    const rateDigits = parseInt(String(rateDisplay).replace(/\D/g, ''), 10) || 90;
    const isC2C = String(rateDisplay).toUpperCase().includes('C2C');

    const mappedStage = stageMap[raw.pipelineStage] || CandidatePipelineStage.AVAILABLE_BENCH;

    const resumeFileName =
      raw.resumeFileName ||
      raw.resumeName ||
      `${(raw.fullName || 'Candidate').replace(/\s+/g, '_')}_Resume.pdf`;

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

    return prisma.candidate.create({
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
        resumeFormat: raw.resumeFormat || 'PDF',
        resumeFileUrl: raw.resumeFileUrl || null,
        rawSnippet: raw.rawSnippet || null,
        pipelineStage: mappedStage,
        assignedRecruiterId: resolvedRecruiterId
      },
      include: {
        assignedRecruiter: {
          select: { id: true, fullName: true, role: true, desk: true }
        }
      }
    });
  }

  async updateCandidate(id: string, raw: any, tenantId?: string) {
    if (tenantId) {
      const existing = await prisma.candidate.findUnique({ where: { id } });
      if (!existing || existing.tenantId !== tenantId) {
        throw new Error('Candidate not found or unauthorized');
      }
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

    return prisma.candidate.update({
      where: { id },
      data,
      include: {
        assignedRecruiter: {
          select: { id: true, fullName: true, role: true, desk: true }
        }
      }
    });
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

    return prisma.candidate.delete({ where: { id } });
  }
}

export const candidateService = new CandidateService();

