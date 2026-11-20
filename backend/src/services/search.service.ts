import { CandidatePipelineStage } from '@prisma/client';
import { prisma } from '../config/prisma.config';

export interface WorkspaceSearchResult {
  query: string;
  requirements: any[];
  candidates: any[];
  placements: any[];
  clients: any[];
  vendors: any[];
}

function tokenizeQuery(rawQuery: string): string[] {
  return String(rawQuery || '')
    .trim()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 4);
}

/**
 * Performs tenant-scoped global record search across requirements, consultants
 * (including resume snippets), billable placements/POs, clients/contacts, and vendors.
 */
export class SearchService {
  async searchWorkspace(params: {
    tenantId: string;
    query?: string;
    limitPerGroup?: number;
  }): Promise<WorkspaceSearchResult> {
    const { tenantId } = params;
    const rawQuery = String(params.query || '').trim();
    const tokens = tokenizeQuery(rawQuery);
    const hasQuery = tokens.length > 0;
    const limit = Math.max(1, Math.min(15, Number(params.limitPerGroup) || (hasQuery ? 8 : 4)));

    const reqWhere = hasQuery
      ? {
          tenantId,
          AND: tokens.map((tok) => ({
            OR: [
              { code: { contains: tok, mode: 'insensitive' as const } },
              { opportunityTitle: { contains: tok, mode: 'insensitive' as const } },
              { companyName: { contains: tok, mode: 'insensitive' as const } },
              { skillsRequired: { contains: tok, mode: 'insensitive' as const } },
              { location: { contains: tok, mode: 'insensitive' as const } },
              { vmsReqId: { contains: tok, mode: 'insensitive' as const } },
              { rawEmailText: { contains: tok, mode: 'insensitive' as const } },
              { assignedRecruiter: { is: { fullName: { contains: tok, mode: 'insensitive' as const } } } },
              { clientContact: { is: { fullName: { contains: tok, mode: 'insensitive' as const } } } },
              {
                submissions: {
                  some: {
                    candidate: {
                      fullName: { contains: tok, mode: 'insensitive' as const },
                    },
                  },
                },
              },
            ],
          })),
        }
      : { tenantId };

    const candWhere = hasQuery
      ? {
          tenantId,
          pipelineStage: { not: CandidatePipelineStage.ARCHIVED },
          AND: tokens.map((tok) => ({
            OR: [
              { fullName: { contains: tok, mode: 'insensitive' as const } },
              { email: { contains: tok, mode: 'insensitive' as const } },
              { phone: { contains: tok, mode: 'insensitive' as const } },
              { currentTitle: { contains: tok, mode: 'insensitive' as const } },
              { skillset: { contains: tok, mode: 'insensitive' as const } },
              { workAuth: { contains: tok, mode: 'insensitive' as const } },
              { education: { contains: tok, mode: 'insensitive' as const } },
              { rawSnippet: { contains: tok, mode: 'insensitive' as const } },
              { vendor: { is: { name: { contains: tok, mode: 'insensitive' as const } } } },
              { assignedRecruiter: { is: { fullName: { contains: tok, mode: 'insensitive' as const } } } },
            ],
          })),
        }
      : {
          tenantId,
          pipelineStage: { not: CandidatePipelineStage.ARCHIVED },
        };

    const placementWhere = hasQuery
      ? {
          tenantId,
          AND: tokens.map((tok) => ({
            OR: [
              { resourceName: { contains: tok, mode: 'insensitive' as const } },
              { customer: { contains: tok, mode: 'insensitive' as const } },
              { customerContact: { contains: tok, mode: 'insensitive' as const } },
              { skillRole: { contains: tok, mode: 'insensitive' as const } },
              { purchaseOrderNumber: { contains: tok, mode: 'insensitive' as const } },
              { email: { contains: tok, mode: 'insensitive' as const } },
              { phone: { contains: tok, mode: 'insensitive' as const } },
              { vendor: { is: { name: { contains: tok, mode: 'insensitive' as const } } } },
              { client: { is: { name: { contains: tok, mode: 'insensitive' as const } } } },
              { recruiter: { is: { fullName: { contains: tok, mode: 'insensitive' as const } } } },
            ],
          })),
        }
      : { tenantId };

    const clientWhere = hasQuery
      ? {
          tenantId,
          AND: tokens.map((tok) => ({
            OR: [
              { name: { contains: tok, mode: 'insensitive' as const } },
              { location: { contains: tok, mode: 'insensitive' as const } },
              { website: { contains: tok, mode: 'insensitive' as const } },
              { boardNumber: { contains: tok, mode: 'insensitive' as const } },
              {
                contacts: {
                  some: {
                    OR: [
                      { fullName: { contains: tok, mode: 'insensitive' as const } },
                      { email: { contains: tok, mode: 'insensitive' as const } },
                      { phone: { contains: tok, mode: 'insensitive' as const } },
                      { designation: { contains: tok, mode: 'insensitive' as const } },
                    ],
                  },
                },
              },
            ],
          })),
        }
      : { tenantId };

    const vendorWhere = hasQuery
      ? {
          tenantId,
          AND: tokens.map((tok) => ({
            OR: [
              { name: { contains: tok, mode: 'insensitive' as const } },
              { location: { contains: tok, mode: 'insensitive' as const } },
              { skillSpecialization: { contains: tok, mode: 'insensitive' as const } },
              { contactName: { contains: tok, mode: 'insensitive' as const } },
              { email: { contains: tok, mode: 'insensitive' as const } },
              { phone: { contains: tok, mode: 'insensitive' as const } },
              {
                contacts: {
                  some: {
                    OR: [
                      { fullName: { contains: tok, mode: 'insensitive' as const } },
                      { email: { contains: tok, mode: 'insensitive' as const } },
                      { phone: { contains: tok, mode: 'insensitive' as const } },
                      { designation: { contains: tok, mode: 'insensitive' as const } },
                    ],
                  },
                },
              },
            ],
          })),
        }
      : { tenantId };

    const [requirements, candidates, placements, clients, vendors] = await Promise.all([
      prisma.requirement.findMany({
        where: reqWhere,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          client: { select: { id: true, name: true, location: true } },
          clientContact: {
            select: { id: true, fullName: true, designation: true, email: true, phone: true },
          },
          assignedRecruiter: { select: { id: true, fullName: true, email: true } },
          submissions: {
            include: {
              candidate: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                  phone: true,
                  currentTitle: true,
                  workAuth: true,
                  skillset: true,
                  hourlyRateDisplay: true,
                  resumeFileName: true,
                  resumeFormat: true,
                  resumeFileUrl: true,
                },
              },
              recruiter: { select: { id: true, fullName: true } },
            },
          },
          placements: {
            select: { id: true, resourceName: true, status: true },
          },
        },
      }),
      prisma.candidate.findMany({
        where: candWhere,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          assignedRecruiter: { select: { id: true, fullName: true } },
          vendor: { select: { id: true, name: true } },
        },
      }),
      prisma.placement.findMany({
        where: placementWhere,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          recruiter: { select: { id: true, fullName: true } },
          candidate: { select: { id: true, fullName: true, phone: true, email: true } },
          client: { select: { id: true, name: true } },
          vendor: { select: { id: true, name: true } },
        },
      }),
      prisma.client.findMany({
        where: clientWhere,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          contacts: {
            orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
          },
          requirements: {
            select: { id: true, code: true, opportunityTitle: true, status: true },
          },
          placements: {
            select: { id: true, resourceName: true, skillRole: true, status: true, billRate: true },
          },
        },
      }),
      prisma.vendor.findMany({
        where: vendorWhere,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          contacts: {
            orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
          },
        },
      }),
    ]);

    return {
      query: rawQuery,
      requirements,
      candidates,
      placements,
      clients,
      vendors,
    };
  }
}

export const searchService = new SearchService();
