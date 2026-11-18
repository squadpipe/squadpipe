import { CandidatePipelineStage, Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.config';
import { getTenantSettings } from '../../config/smtp.config';
import { aiService, redactRatesFromText } from './ai.service';
import type { CapabilityCandidateInput, CapabilityRequirementInput } from './ai.types';

export interface StaleReqAgentSuggestion {
  candidateId: string;
  fullName: string;
  currentTitle: string;
  workAuth: string;
  fitScore: number;
  matchedHighlights: string[];
  gaps: string[];
  oneLineSummary: string;
}

export interface SlaAgentPayload {
  kind: 'candidate_shortlist' | 'followup_draft' | 'renewal_draft';
  generatedAt: string;
  evaluatedWithAi: boolean;
  requirementId?: string;
  placementId?: string;
  suggestions?: StaleReqAgentSuggestion[];
  draftSubject?: string;
  draftBody?: string;
  recipientEmail?: string;
}

export interface BenchCandidateRow {
  id: string;
  fullName: string;
  currentTitle: string;
  skillset: string;
  workAuth: string;
  relocation: string;
  rawSnippet?: string | null;
}

export async function buildStaleReqSuggestionsPure(params: {
  requirement: {
    id: string;
    code: string;
    companyName?: string | null;
    opportunityTitle: string;
    skillsRequired: string;
    location: string;
    workModel?: string | null;
    publicDescription?: string | null;
    rawEmailText?: string | null;
  };
  benchCandidates: BenchCandidateRow[];
  tenantId: string;
  aiSvc?: Pick<typeof aiService, 'rankCandidatesForRequirement'>;
}): Promise<SlaAgentPayload | null> {
  const { requirement, benchCandidates, tenantId, aiSvc = aiService } = params;
  const pool = benchCandidates.slice(0, 20);
  if (pool.length === 0) return null;

  const safeReq: CapabilityRequirementInput = {
    id: requirement.id,
    code: requirement.code,
    companyName: requirement.companyName ?? undefined,
    opportunityTitle: requirement.opportunityTitle,
    skillsRequired: requirement.skillsRequired,
    location: requirement.location,
    workModel: requirement.workModel ?? undefined,
    rawEmailText: redactRatesFromText(
      requirement.publicDescription || requirement.rawEmailText || ''
    ),
  };

  const candInputs: CapabilityCandidateInput[] = pool.map((c) => ({
    id: c.id,
    fullName: c.fullName,
    currentTitle: c.currentTitle,
    skillset: c.skillset,
    workAuth: c.workAuth,
    relocation: c.relocation,
    rawSnippet: redactRatesFromText(c.rawSnippet),
  }));

  const ranked = await aiSvc.rankCandidatesForRequirement(candInputs, safeReq, {
    rateMasked: true,
    tenantId,
    usageFeature: 'agent_prep',
  });

  const byId = new Map(pool.map((c) => [c.id, c]));
  const suggestions: StaleReqAgentSuggestion[] = ranked.rankings
    .slice(0, 3)
    .map((item) => {
      const cand = byId.get(item.candidateId);
      return {
        candidateId: item.candidateId,
        fullName: cand?.fullName || 'Consultant',
        currentTitle: cand?.currentTitle || '',
        workAuth: cand?.workAuth || '',
        fitScore: Math.max(0, Math.min(100, Math.round(item.fitScore))),
        matchedHighlights: (item.matchedHighlights || []).slice(0, 4),
        gaps: (item.gaps || []).slice(0, 3),
        oneLineSummary: redactRatesFromText(item.oneLineSummary),
      };
    });

  if (suggestions.length === 0) return null;

  return {
    kind: 'candidate_shortlist',
    generatedAt: new Date().toISOString(),
    evaluatedWithAi: ranked.aiUsed,
    requirementId: requirement.id,
    suggestions,
  };
}

export async function buildFeedbackFollowupAgentPure(params: {
  requirement: {
    id: string;
    code: string;
    companyName?: string | null;
    opportunityTitle: string;
    skillsRequired: string;
    location: string;
    workModel?: string | null;
  };
  primaryCandidate?: {
    id: string;
    fullName: string;
    currentTitle: string;
    skillset: string;
    workAuth: string;
  } | null;
  agencyName: string;
  recipientEmail?: string | null;
  tenantId: string;
  aiSvc?: Pick<typeof aiService, 'draftClientPitch'>;
}): Promise<SlaAgentPayload> {
  const {
    requirement,
    primaryCandidate,
    agencyName,
    recipientEmail,
    tenantId,
    aiSvc = aiService,
  } = params;

  const candInput: CapabilityCandidateInput = primaryCandidate
    ? {
        id: primaryCandidate.id,
        fullName: primaryCandidate.fullName,
        currentTitle: primaryCandidate.currentTitle,
        skillset: primaryCandidate.skillset,
        workAuth: primaryCandidate.workAuth,
      }
    : {
        id: `req-${requirement.id}`,
        fullName: 'our submitted candidate(s)',
        currentTitle: requirement.opportunityTitle,
        skillset: requirement.skillsRequired,
      };

  const draft = await aiSvc.draftClientPitch(
    candInput,
    {
      id: requirement.id,
      code: requirement.code,
      companyName: requirement.companyName ?? undefined,
      opportunityTitle: requirement.opportunityTitle,
      skillsRequired: requirement.skillsRequired,
      location: requirement.location,
      workModel: requirement.workModel ?? undefined,
    },
    {
      purpose: 'interview_followup',
      tone: 'PROFESSIONAL',
      rateMasked: true,
      agencyName: agencyName || 'SquadPipe Staffing',
      tenantId,
      usageFeature: 'agent_prep',
    }
  );

  return {
    kind: 'followup_draft',
    generatedAt: new Date().toISOString(),
    evaluatedWithAi: draft.aiUsed,
    requirementId: requirement.id,
    draftSubject: redactRatesFromText(draft.subject),
    draftBody: redactRatesFromText(draft.bodyText),
    ...(recipientEmail ? { recipientEmail: String(recipientEmail).trim() } : {}),
  };
}

export async function buildContractRenewalAgentPure(params: {
  placement: {
    id: string;
    customer: string;
    resourceName: string;
    skillRole: string;
    endDate: Date | string;
  };
  agencyName: string;
  tenantId: string;
  aiSvc?: Pick<typeof aiService, 'draftClientPitch'>;
}): Promise<SlaAgentPayload> {
  const { placement, agencyName, tenantId, aiSvc = aiService } = params;
  const endIso =
    placement.endDate instanceof Date
      ? placement.endDate.toISOString().split('T')[0]
      : String(placement.endDate || '').split('T')[0];

  const draft = await aiSvc.draftClientPitch(
    {
      id: `plc-${placement.id}`,
      fullName: placement.resourceName,
      currentTitle: placement.skillRole,
      skillset: placement.skillRole,
      rawSnippet: `Active engagement at ${placement.customer} scheduled to conclude on ${endIso}. Discuss extension or renewal timeline without referencing billing rates.`,
    },
    {
      companyName: placement.customer,
      opportunityTitle: `Contract Extension / Renewal Check-In (${placement.skillRole}) — Ends ${endIso}`,
      skillsRequired: placement.skillRole,
    },
    {
      purpose: 'interview_followup',
      tone: 'PROFESSIONAL',
      rateMasked: true,
      agencyName: agencyName || 'SquadPipe Staffing',
      tenantId,
      usageFeature: 'agent_prep',
    }
  );

  const fallbackSubject = `Contract Extension Check-In: ${placement.resourceName} — ${placement.customer} (Ends ${endIso})`;

  return {
    kind: 'renewal_draft',
    generatedAt: new Date().toISOString(),
    evaluatedWithAi: draft.aiUsed,
    placementId: placement.id,
    draftSubject: draft.aiUsed
      ? redactRatesFromText(draft.subject)
      : fallbackSubject,
    draftBody: redactRatesFromText(draft.bodyText),
  };
}

export class SlaAgentService {
  async prepareStaleReqPayload(
    reqRecord: {
      id: string;
      code: string;
      companyName: string;
      opportunityTitle: string;
      skillsRequired: string;
      location: string;
      workModel: string;
      publicDescription: string | null;
      rawEmailText: string | null;
    },
    tenantId: string
  ): Promise<SlaAgentPayload | null> {
    const skillTokens = String(reqRecord.skillsRequired || '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length >= 2)
      .slice(0, 8);

    const baseWhere: Prisma.CandidateWhereInput = {
      tenantId,
      pipelineStage: CandidatePipelineStage.AVAILABLE_BENCH,
    };

    const orFilters: Prisma.CandidateWhereInput[] = skillTokens.flatMap((token) => [
      { skillset: { contains: token, mode: 'insensitive' } },
      { currentTitle: { contains: token, mode: 'insensitive' } },
      { rawSnippet: { contains: token, mode: 'insensitive' } },
    ]);

    const selectFields = {
      id: true,
      fullName: true,
      currentTitle: true,
      skillset: true,
      workAuth: true,
      relocation: true,
      rawSnippet: true,
    };

    const primaryRows =
      orFilters.length > 0
        ? await prisma.candidate.findMany({
            where: { ...baseWhere, OR: orFilters },
            select: selectFields,
            orderBy: { updatedAt: 'desc' },
            take: 20,
          })
        : [];

    let combined = primaryRows;
    if (combined.length < 20) {
      const seenIds = combined.map((c) => c.id);
      const topUp = await prisma.candidate.findMany({
        where: {
          ...baseWhere,
          ...(seenIds.length > 0 ? { id: { notIn: seenIds } } : {}),
        },
        select: selectFields,
        orderBy: { updatedAt: 'desc' },
        take: 20 - combined.length,
      });
      combined = [...combined, ...topUp];
    }

    return buildStaleReqSuggestionsPure({
      requirement: reqRecord,
      benchCandidates: combined,
      tenantId,
    });
  }

  async prepareAwaitingFeedbackPayload(
    reqRecord: {
      id: string;
      code: string;
      companyName: string;
      opportunityTitle: string;
      skillsRequired: string;
      location: string;
      workModel: string;
      clientContactId: string | null;
    },
    tenantId: string
  ): Promise<SlaAgentPayload> {
    const [topSub, contact, settings] = await Promise.all([
      prisma.submission.findFirst({
        where: {
          requirementId: reqRecord.id,
          tenantId,
          stage: { not: 'CLOSED' },
        },
        include: {
          candidate: {
            select: {
              id: true,
              fullName: true,
              currentTitle: true,
              skillset: true,
              workAuth: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      reqRecord.clientContactId
        ? prisma.clientContact.findUnique({
            where: { id: reqRecord.clientContactId },
            select: { email: true },
          })
        : Promise.resolve(null),
      getTenantSettings(tenantId),
    ]);

    return buildFeedbackFollowupAgentPure({
      requirement: reqRecord,
      primaryCandidate: topSub?.candidate || null,
      agencyName: settings.general.agencyName || 'SquadPipe Staffing',
      recipientEmail: contact?.email || null,
      tenantId,
    });
  }

  async prepareContractExpiringPayload(
    placementRecord: {
      id: string;
      customer: string;
      resourceName: string;
      skillRole: string;
      endDate: Date;
    },
    tenantId: string
  ): Promise<SlaAgentPayload> {
    const settings = await getTenantSettings(tenantId);
    return buildContractRenewalAgentPure({
      placement: placementRecord,
      agencyName: settings.general.agencyName || 'SquadPipe Staffing',
      tenantId,
    });
  }
}

export const slaAgentService = new SlaAgentService();
