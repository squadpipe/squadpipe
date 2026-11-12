import { prisma } from '../config/prisma.config';
import { CandidatePipelineStage, Prisma } from '@prisma/client';

export interface CandidateFilterParams {
  search?: string;
  stage?: string;
}

export class CandidateService {
  async getCandidates(params: CandidateFilterParams) {
    const { search, stage } = params;
    const where: Prisma.CandidateWhereInput = {};

    if (search) {
      where.OR = [
        { fullName: { contains: String(search), mode: 'insensitive' } },
        { skillset: { contains: String(search), mode: 'insensitive' } },
        { currentTitle: { contains: String(search), mode: 'insensitive' } },
        { workAuth: { contains: String(search), mode: 'insensitive' } }
      ];
    }
    if (stage && stage !== 'ALL') {
      where.pipelineStage = stage as CandidatePipelineStage;
    }

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

  async getCandidateById(id: string) {
    return prisma.candidate.findUnique({
      where: { id },
      include: {
        assignedRecruiter: true,
        submissions: { include: { requirement: true } },
        placements: true
      }
    });
  }

  async createCandidate(data: Prisma.CandidateCreateInput) {
    return prisma.candidate.create({
      data
    });
  }

  async updateCandidate(id: string, data: Prisma.CandidateUpdateInput) {
    return prisma.candidate.update({
      where: { id },
      data
    });
  }
}

export const candidateService = new CandidateService();

