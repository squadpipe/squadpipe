import { CandidatePipelineStage, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.config';
import {
  aiService,
  computeOfflineCapabilityEvaluation,
  redactRatesFromText,
} from './ai/ai.service';
import type {
  CapabilityCandidateInput,
  CapabilityEvaluationResult,
  CapabilityRecommendation,
  CapabilityRequirementInput,
  RankedCandidateResult,
} from './ai/ai.types';

export interface StoredCapabilitySummary {
  fitScore: number;
  recommendation: CapabilityRecommendation;
  recommendationLabel: string;
  verdict: string;
  strengths: string[];
  gaps: string[];
  evaluatedWithAi: boolean;
  evaluatedAt: string;
}

function createHttpError(message: string, statusCode: number): Error & { statusCode: number } {
  const err = new Error(message) as Error & { statusCode: number };
  err.statusCode = statusCode;
  return err;
}

export function formatRecommendationLabel(rec?: string | null): string {
  switch (String(rec || '').toUpperCase()) {
    case 'STRONG_FIT':
      return 'Strong Fit';
    case 'GOOD_FIT':
      return 'Good Fit';
    case 'PARTIAL_FIT':
      return 'Partial Fit';
    case 'LOW_FIT':
      return 'Low Fit';
    default:
      return 'Evaluated';
  }
}

export function buildStoredCapabilitySummary(
  evalResult: CapabilityEvaluationResult,
  options?: { rateMasked?: boolean; evaluatedAt?: string }
): StoredCapabilitySummary {
  const rateMasked = Boolean(options?.rateMasked);
  const scrub = (val: string) => (rateMasked ? redactRatesFromText(val) : val);

  return {
    fitScore: Math.max(0, Math.min(100, Math.round(evalResult.fitScore))),
    recommendation: evalResult.recommendation,
    recommendationLabel: formatRecommendationLabel(evalResult.recommendation),
    verdict: scrub(evalResult.verdict),
    strengths: (evalResult.strengths || []).map((s) => scrub(String(s))).filter(Boolean).slice(0, 6),
    gaps: (evalResult.gaps || []).map((g) => scrub(String(g))).filter(Boolean).slice(0, 6),
    evaluatedWithAi: Boolean(evalResult.aiUsed),
    evaluatedAt: options?.evaluatedAt || new Date().toISOString(),
  };
}

/**
 * Pure capability evaluator supporting both active LLM evaluation and offline keyword parity.
 */
export async function evaluateCandidateCapabilityPure(
  candidate: CapabilityCandidateInput,
  requirement: CapabilityRequirementInput,
  options?: {
    rateMasked?: boolean;
    tenantId?: string;
    userId?: string;
    aiSvc?: Pick<typeof aiService, 'evaluateSubmissionCapability'>;
  }
): Promise<{ capabilityScore: number; capabilitySummary: StoredCapabilitySummary }> {
  const aiSvc = options?.aiSvc || aiService;
  const rateMasked = Boolean(options?.rateMasked);

  const evalResult = await aiSvc.evaluateSubmissionCapability(candidate, requirement, {
    rateMasked,
    tenantId: options?.tenantId,
    userId: options?.userId,
  });

  const summary = buildStoredCapabilitySummary(evalResult, { rateMasked });
  return {
    capabilityScore: summary.fitScore,
    capabilitySummary: summary,
  };
}

/**
 * Deterministic SQL/in-memory pre-filter selecting the top candidates for AI batch ranking.
 */
export function preFilterCandidatesForMatch(
  candidates: CapabilityCandidateInput[],
  requirement: CapabilityRequirementInput,
  limit = 25
): CapabilityCandidateInput[] {
  if (candidates.length <= limit) return candidates;
  return candidates
    .map((candidate, index) => ({
      candidate,
      index,
      score: computeOfflineCapabilityEvaluation(candidate, requirement).fitScore,
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map((item) => item.candidate);
}

function toCapabilityCandidateInput(cand: {
  id: string;
  fullName?: string | null;
  currentTitle?: string | null;
  skillset?: string | null;
  workAuth?: string | null;
  relocation?: string | null;
  hourlyRateDisplay?: string | null;
  rawSnippet?: string | null;
}): CapabilityCandidateInput {
  return {
    id: cand.id,
    fullName: cand.fullName ?? undefined,
    currentTitle: cand.currentTitle ?? undefined,
    skillset: cand.skillset ?? undefined,
    workAuth: cand.workAuth ?? undefined,
    relocation: cand.relocation ?? undefined,
    hourlyRateDisplay: cand.hourlyRateDisplay ?? undefined,
    rawSnippet: cand.rawSnippet ?? undefined,
  };
}

function toCapabilityRequirementInput(req: {
  code?: string | null;
  companyName?: string | null;
  opportunityTitle?: string | null;
  skillsRequired?: string | null;
  location?: string | null;
  workModel?: string | null;
  targetBillRate?: unknown;
  maxBillRate?: unknown;
  targetPayRate?: unknown;
  rawEmailText?: string | null;
  publicDescription?: string | null;
}): CapabilityRequirementInput {
  return {
    code: req.code ?? undefined,
    companyName: req.companyName ?? undefined,
    opportunityTitle: req.opportunityTitle ?? undefined,
    skillsRequired: req.skillsRequired ?? undefined,
    location: req.location ?? undefined,
    workModel: req.workModel ?? undefined,
    targetBillRate: req.targetBillRate ? Number(req.targetBillRate) : null,
    maxBillRate: req.maxBillRate ? Number(req.maxBillRate) : null,
    targetPayRate: req.targetPayRate ? Number(req.targetPayRate) : null,
    rawEmailText: req.rawEmailText || req.publicDescription || null,
  };
}

export class CapabilityService {
  async evaluateSubmission(
    submissionId: string,
    tenantId: string,
    options?: {
      rateMasked?: boolean;
      userId?: string;
      aiSvc?: Pick<typeof aiService, 'evaluateSubmissionCapability'>;
    }
  ) {
    const submission = await prisma.submission.findFirst({
      where: { id: submissionId, tenantId },
      include: {
        candidate: true,
        requirement: true,
      },
    });

    if (!submission || !submission.candidate || !submission.requirement) {
      throw createHttpError('Submission not found for tenant', 404);
    }

    const { capabilityScore, capabilitySummary } = await evaluateCandidateCapabilityPure(
      toCapabilityCandidateInput(submission.candidate),
      toCapabilityRequirementInput(submission.requirement),
      {
        rateMasked: Boolean(options?.rateMasked),
        tenantId,
        userId: options?.userId,
        aiSvc: options?.aiSvc,
      }
    );

    return prisma.submission.update({
      where: { id: submission.id },
      data: {
        capabilityScore,
        capabilitySummary: capabilitySummary as unknown as Prisma.InputJsonValue,
      },
      include: {
        candidate: true,
        recruiter: { select: { id: true, fullName: true } },
      },
    });
  }

  /**
   * Computes capability checks on newly attached submissions. Single-candidate attaches use
   * active AI when configured (with rate masking enforced); multi-candidate batches store fast
   * deterministic scores immediately so batch attaches stay responsive.
   */
  async evaluateNewlyAttachedSubmissions(
    submissions: Array<{
      id: string;
      candidate: {
        id: string;
        fullName: string;
        currentTitle: string;
        skillset: string;
        workAuth: string;
        relocation: string;
        hourlyRateDisplay: string | null;
        rawSnippet: string | null;
      };
    }>,
    requirement: {
      id: string;
      code: string;
      companyName: string;
      opportunityTitle: string;
      skillsRequired: string;
      location: string;
      workModel: string;
      rawEmailText: string | null;
      publicDescription?: string | null;
    },
    options: { tenantId: string }
  ) {
    if (!submissions || submissions.length === 0) return;

    if (submissions.length === 1) {
      await this.evaluateSubmission(submissions[0].id, options.tenantId, {
        rateMasked: true,
      });
      return;
    }

    const reqInput = toCapabilityRequirementInput(requirement);
    await Promise.all(
      submissions.map((sub) => {
        const evalResult = computeOfflineCapabilityEvaluation(
          toCapabilityCandidateInput(sub.candidate),
          reqInput
        );
        const summary = buildStoredCapabilitySummary(evalResult, { rateMasked: true });
        return prisma.submission.update({
          where: { id: sub.id },
          data: {
            capabilityScore: summary.fitScore,
            capabilitySummary: summary as unknown as Prisma.InputJsonValue,
          },
        });
      })
    );
  }

  async rankMatchingCandidates(params: {
    tenantId: string;
    userId?: string;
    requirementId: string;
    skillsRequiredOverride?: string;
    search?: string;
    workAuth?: string;
    candidateIds?: string[];
    candidates?: CapabilityCandidateInput[];
    rateMasked?: boolean;
    maxShortlist?: number;
    aiSvc?: Pick<typeof aiService, 'rankCandidatesForRequirement'>;
  }): Promise<{
    rankings: RankedCandidateResult[];
    candidates: any[];
    aiUsed: boolean;
    totalEvaluated: number;
    quotaNotice?: string;
  }> {
    const {
      tenantId,
      userId,
      requirementId,
      skillsRequiredOverride,
      search,
      workAuth,
      candidateIds,
      candidates: suppliedCandidates,
      rateMasked = false,
      maxShortlist = 25,
      aiSvc = aiService,
    } = params;

    const requirement = await prisma.requirement.findFirst({
      where: { id: requirementId, tenantId },
    });
    if (!requirement) {
      throw createHttpError('Requirement not found for tenant', 404);
    }

    const effectiveReq = toCapabilityRequirementInput({
      ...requirement,
      ...(skillsRequiredOverride !== undefined
        ? { skillsRequired: skillsRequiredOverride }
        : {}),
    });

    const candidateSelect = {
      id: true,
      fullName: true,
      phone: true,
      email: true,
      workAuth: true,
      education: true,
      currentTitle: true,
      skillset: true,
      hourlyRateW2: true,
      hourlyRateC2c: true,
      hourlyRateDisplay: true,
      relocation: true,
      resumeFileName: true,
      resumeFormat: true,
      pipelineStage: true,
      rawSnippet: true,
      assignedRecruiterId: true,
      assignedRecruiter: {
        select: { fullName: true },
      },
      createdAt: true,
      updatedAt: true,
    } as const;

    let candidatePool: CapabilityCandidateInput[] = [];
    const fullRowById = new Map<string, any>();

    if (Array.isArray(candidateIds) && candidateIds.length > 0) {
      const cleanIds = Array.from(
        new Set(candidateIds.map((id) => String(id || '').trim()).filter(Boolean))
      ).slice(0, 150);

      const dbRows = await prisma.candidate.findMany({
        where: {
          tenantId,
          id: { in: cleanIds },
          pipelineStage: { not: CandidatePipelineStage.ARCHIVED },
        },
        select: candidateSelect,
      });
      for (const r of dbRows) fullRowById.set(r.id, r);
      candidatePool = dbRows.map(toCapabilityCandidateInput);
    } else {
      const cleanSearch = String(search || '').trim();
      const cleanWorkAuth = String(workAuth || '').trim();
      const skillTokens = String(effectiveReq.skillsRequired || '')
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length >= 2)
        .slice(0, 12);

      const andConditions: Prisma.CandidateWhereInput[] = [
        { tenantId },
        { pipelineStage: { not: CandidatePipelineStage.ARCHIVED } },
      ];
      if (cleanWorkAuth && cleanWorkAuth !== 'All') {
        andConditions.push({ workAuth: { contains: cleanWorkAuth, mode: 'insensitive' } });
      }
      if (cleanSearch) {
        andConditions.push({
          OR: [
            { fullName: { contains: cleanSearch, mode: 'insensitive' } },
            { skillset: { contains: cleanSearch, mode: 'insensitive' } },
            { currentTitle: { contains: cleanSearch, mode: 'insensitive' } },
            { rawSnippet: { contains: cleanSearch, mode: 'insensitive' } },
          ],
        });
      }

      const baseWhere: Prisma.CandidateWhereInput = { AND: andConditions };

      const tokenOrFilters: Prisma.CandidateWhereInput[] = skillTokens.flatMap((token) => [
        { skillset: { contains: token, mode: 'insensitive' } },
        { currentTitle: { contains: token, mode: 'insensitive' } },
        { rawSnippet: { contains: token, mode: 'insensitive' } },
      ]);

      const filteredRows =
        tokenOrFilters.length > 0
          ? await prisma.candidate.findMany({
              where: { AND: [...andConditions, { OR: tokenOrFilters }] },
              select: candidateSelect,
              take: 300,
              orderBy: { updatedAt: 'desc' },
            })
          : [];

      let mergedRows = filteredRows;
      if (mergedRows.length < maxShortlist) {
        const existingIds = mergedRows.map((r) => r.id);
        const topUpRows = await prisma.candidate.findMany({
          where: {
            AND: [
              ...andConditions,
              ...(existingIds.length > 0 ? [{ id: { notIn: existingIds } }] : []),
            ],
          },
          select: candidateSelect,
          take: Math.max(0, 300 - mergedRows.length),
          orderBy: { updatedAt: 'desc' },
        });
        mergedRows = [...mergedRows, ...topUpRows];
      }

      for (const r of mergedRows) fullRowById.set(r.id, r);
      candidatePool = mergedRows.map(toCapabilityCandidateInput);
    }

    if (candidatePool.length === 0 && Array.isArray(suppliedCandidates) && suppliedCandidates.length > 0) {
      candidatePool = suppliedCandidates;
    }

    const shortlisted = preFilterCandidatesForMatch(candidatePool, effectiveReq, maxShortlist);
    const rankedResult = await aiSvc.rankCandidatesForRequirement(shortlisted, effectiveReq, {
      rateMasked: Boolean(rateMasked),
      tenantId,
      userId,
    });

    const sortedRankings = [...rankedResult.rankings].sort((a, b) => b.fitScore - a.fitScore);
    const rankedCandidates = sortedRankings
      .map((r) => fullRowById.get(r.candidateId))
      .filter(Boolean);

    return {
      rankings: sortedRankings,
      candidates: rankedCandidates,
      aiUsed: rankedResult.aiUsed,
      totalEvaluated: shortlisted.length,
      ...(rankedResult.quotaNotice ? { quotaNotice: rankedResult.quotaNotice } : {}),
    };
  }
}

export const capabilityService = new CapabilityService();
