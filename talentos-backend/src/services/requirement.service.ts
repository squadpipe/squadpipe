import { prisma } from '../config/prisma.config';
import { RequirementStatus, Prisma } from '@prisma/client';

export interface RequirementFilterParams {
  search?: string;
  status?: string;
}

export class RequirementService {
  async getRequirements(params: RequirementFilterParams) {
    const { search, status } = params;
    const where: Prisma.RequirementWhereInput = {};

    if (search) {
      where.OR = [
        { opportunityTitle: { contains: String(search), mode: 'insensitive' } },
        { companyName: { contains: String(search), mode: 'insensitive' } },
        { skillsRequired: { contains: String(search), mode: 'insensitive' } }
      ];
    }
    if (status && status !== 'all') {
      where.status = status as RequirementStatus;
    }

    return prisma.requirement.findMany({
      where,
      include: {
        client: true,
        clientContact: true,
        assignedRecruiter: {
          select: { id: true, fullName: true, role: true, desk: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getRequirementById(id: string) {
    return prisma.requirement.findUnique({
      where: { id },
      include: {
        client: true,
        clientContact: true,
        assignedRecruiter: true,
        submissions: { include: { candidate: true } }
      }
    });
  }

  async createRequirement(data: any) {
    const count = await prisma.requirement.count();
    const code = `REQ-${1000 + count + 1}`;
    
    return prisma.requirement.create({
      data: {
        code,
        ...data
      }
    });
  }

  async updateRequirementStage(id: string, status: RequirementStatus, resourceName?: string) {
    const updated = await prisma.requirement.update({
      where: { id },
      data: { status }
    });

    // Automated placement creation when moving to ONBOARDING
    if (status === RequirementStatus.ONBOARDING && resourceName) {
      const existing = await prisma.placement.findFirst({
        where: { resourceName, customer: updated.companyName }
      });
      if (!existing) {
        await prisma.placement.create({
          data: {
            customer: updated.companyName,
            resourceName,
            skillRole: updated.opportunityTitle,
            startDate: new Date(),
            endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
            billRate: 115.00,
            payRate: 85.00,
            hourlySpread: 30.00,
            marginPct: 26.08,
            status: 'ACTIVE'
          }
        });
      }
    }

    return updated;
  }
}

export const requirementService = new RequirementService();

