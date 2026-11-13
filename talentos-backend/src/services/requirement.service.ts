import { prisma } from '../config/prisma.config';
import { RequirementStatus, Prisma, WorkModel } from '@prisma/client';

export interface RequirementFilterParams {
  tenantId?: string;
  search?: string;
  status?: string;
}

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

export class RequirementService {
  async getRequirements(params: RequirementFilterParams) {
    const { search, status, tenantId } = params;
    const where: Prisma.RequirementWhereInput = {};

    if (tenantId) {
      where.tenantId = tenantId;
    }

    if (search) {
      where.OR = [
        { opportunityTitle: { contains: String(search), mode: 'insensitive' } },
        { companyName: { contains: String(search), mode: 'insensitive' } },
        { skillsRequired: { contains: String(search), mode: 'insensitive' } }
      ];
    }
    if (status && status !== 'all' && status !== 'ALL') {
      where.status = requirementStatusMap[status] || (status as RequirementStatus);
    }

    return prisma.requirement.findMany({
      where,
      include: {
        client: true,
        clientContact: true,
        assignedRecruiter: {
          select: { id: true, fullName: true, role: true, desk: true }
        },
        submissions: {
          include: { candidate: true },
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getRequirementById(id: string, tenantId?: string) {
    const req = await prisma.requirement.findUnique({
      where: { id },
      include: {
        client: true,
        clientContact: true,
        assignedRecruiter: true,
        submissions: { include: { candidate: true } }
      }
    });

    if (req && tenantId && req.tenantId !== tenantId) {
      return null;
    }
    return req;
  }

  async createRequirement(raw: any, tenantId: string = 'talentos-agency', recruiterId?: string) {
    const count = await prisma.requirement.count({ where: { tenantId } });
    const code = raw.code || `REQ-${1000 + count + 1}`;

    const billRateNum = typeof raw.targetBillRate === 'number' && raw.targetBillRate > 0
      ? raw.targetBillRate
      : parseInt(String(raw.targetRate || raw.targetBillRate || '115').replace(/\D/g, ''), 10) || 115;
    const payRateNum = typeof raw.targetPayRate === 'number' && raw.targetPayRate > 0
      ? raw.targetPayRate
      : Math.round(billRateNum * 0.75);

    const mappedStatus = requirementStatusMap[raw.status] || RequirementStatus.REQUIREMENT;

    // Handle Client relationship or auto-create new client & hiring contact
    let resolvedClientId = raw.clientId || null;
    let resolvedContactId = raw.clientContactId || null;

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

    // Resolve assigned recruiter by name if passed
    let resolvedRecruiterId = raw.assignedRecruiterId || null;
    if (!resolvedRecruiterId && raw.assignedRecruiter && typeof raw.assignedRecruiter === 'string' && raw.assignedRecruiter.trim()) {
      const matchedUser = await prisma.user.findFirst({
        where: { tenantId, fullName: { equals: raw.assignedRecruiter.trim(), mode: 'insensitive' } },
        select: { id: true }
      });
      if (matchedUser) resolvedRecruiterId = matchedUser.id;
    }
    if (!resolvedRecruiterId) resolvedRecruiterId = recruiterId || null;

    // Map work model
    let workModel: WorkModel = WorkModel.REMOTE;
    const wmSource = String(raw.workModel || raw.location || '').toUpperCase();
    if (wmSource.includes('HYBRID')) workModel = WorkModel.HYBRID;
    else if (wmSource.includes('ONSITE')) workModel = WorkModel.ONSITE;

    return prisma.requirement.create({
      data: {
        tenantId,
        code,
        opportunityTitle: raw.opportunityTitle?.trim() || 'Software Engineer Requisition',
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
        assignedRecruiterId: resolvedRecruiterId
      },
      include: {
        client: true,
        clientContact: true,
        assignedRecruiter: {
          select: { id: true, fullName: true, role: true, desk: true }
        },
        submissions: {
          include: { candidate: true },
          orderBy: { createdAt: 'desc' }
        }
      }
    });
  }

  async updateRequirementStage(id: string, statusInput: string, resourceName?: string, tenantId?: string) {
    const status = requirementStatusMap[statusInput] || (statusInput as RequirementStatus);
    const updated = await prisma.requirement.update({
      where: { id },
      data: { status }
    });

    // Automated placement creation when moving to ONBOARDING
    if (status === RequirementStatus.ONBOARDING && resourceName) {
      const existing = await prisma.placement.findFirst({
        where: { resourceName, customer: updated.companyName, tenantId: updated.tenantId }
      });
      if (!existing) {
        await prisma.placement.create({
          data: {
            tenantId: updated.tenantId,
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

  async deleteRequirement(id: string, tenantId?: string) {
    if (tenantId) {
      const existing = await prisma.requirement.findUnique({ where: { id } });
      if (!existing || existing.tenantId !== tenantId) {
        throw new Error('Requirement not found or unauthorized');
      }
    }
    return prisma.requirement.delete({ where: { id } });
  }
}

export const requirementService = new RequirementService();

