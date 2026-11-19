import { CandidatePipelineStage, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.config';
import {
  aiService,
  computeOfflineCapabilityEvaluation,
  redactRatesFromText,
} from './ai/ai.service';
import { candidateIndexingService } from './vector/candidateIndexing.service';
import { embeddingService } from './vector/embedding.service';
import { buildRequirementSearchQuery } from './vector/resumeChunker';
import { getVectorStore } from './vector/vectorStore.router';
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

    const evaluable = submissions.filter(
      (sub) => Boolean(sub.candidate?.skillset?.trim() || sub.candidate?.rawSnippet?.trim())
    );
    if (evaluable.length === 0) return;

    if (evaluable.length === 1) {
      await this.evaluateSubmission(evaluable[0].id, options.tenantId, {
        rateMasked: true,
      });
      return;
    }

    const reqInput = toCapabilityRequirementInput(requirement);
    await Promise.all(
      evaluable.map((sub) => {
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
    retrievalMethod?: 'pgvector_hybrid' | 'pg_fts' | 'in_memory';
    totalTenantPool?: number;
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
      maxShortlist = 45,
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

    const cleanIds = Array.isArray(candidateIds) && candidateIds.length > 0
      ? Array.from(new Set(candidateIds.map((id) => String(id || '').trim()).filter(Boolean))).slice(0, 150)
      : undefined;

    let candidatePool: CapabilityCandidateInput[] = [];
    const fullRowById = new Map<string, any>();
    let retrievalMethod: 'pgvector_hybrid' | 'pg_fts' | 'in_memory' = 'pg_fts';
    let totalTenantPool = 0;

    try {
      // Ensure unchunked active consultants in this tenant are immediately searchable
      await candidateIndexingService.ensureTenantIndexedForSearch(tenantId);

      const { queryText, skillTokens } = buildRequirementSearchQuery({
        opportunityTitle: effectiveReq.opportunityTitle,
        skillsRequired: effectiveReq.skillsRequired,
        location: effectiveReq.location,
        workModel: effectiveReq.workModel,
        publicDescription: requirement.publicDescription,
        rawEmailText: effectiveReq.rawEmailText,
      });

      const queryEmbedded = await embeddingService.embedTexts([queryText], { tenantId });
      const queryVector = queryEmbedded?.vectors?.[0] ?? null;
      const vectorStore = getVectorStore();

      const hybridRes = await vectorStore.hybridSearchCandidates({
        tenantId,
        queryText,
        queryVector,
        skillTokens,
        searchFilter: search,
        workAuthFilter: workAuth,
        candidateIdsFilter: cleanIds,
        limit: Math.max(25, Math.min(100, maxShortlist)),
      });

      retrievalMethod = hybridRes.retrievalMethod;
      totalTenantPool = hybridRes.totalTenantPool;

      const matchedIds = hybridRes.matches.map((m) => m.candidateId);
      if (matchedIds.length > 0) {
        const dbRows = await prisma.candidate.findMany({
          where: { tenantId, id: { in: matchedIds } },
          select: candidateSelect,
        });
        for (const r of dbRows) fullRowById.set(r.id, r);

        const matchMetaById = new Map(hybridRes.matches.map((m) => [m.candidateId, m]));
        candidatePool = matchedIds
          .map((id) => {
            const row = fullRowById.get(id);
            if (!row) return null;
            const input = toCapabilityCandidateInput(row);
            const meta = matchMetaById.get(id);
            if (meta?.matchedChunks?.length) {
              input.matchedChunks = meta.matchedChunks;
            }
            return input;
          })
          .filter((x): x is CapabilityCandidateInput => Boolean(x));
      }
    } catch {
      // Safe fallback to in-memory/Prisma query if vector table is unavailable in isolated runs
      candidatePool = [];
    }

    if (candidatePool.length === 0 && Array.isArray(suppliedCandidates) && suppliedCandidates.length > 0) {
      retrievalMethod = 'in_memory';
      candidatePool = suppliedCandidates;
      totalTenantPool = suppliedCandidates.length;
    }

    const shortlisted =
      retrievalMethod === 'in_memory'
        ? preFilterCandidatesForMatch(candidatePool, effectiveReq, maxShortlist)
        : candidatePool.slice(0, maxShortlist);

    const aiRankBatch = shortlisted.slice(0, 30);
    const tailCandidates = shortlisted.slice(30);

    const rankedResult = await aiSvc.rankCandidatesForRequirement(aiRankBatch, effectiveReq, {
      rateMasked: Boolean(rateMasked),
      tenantId,
      userId,
    });

    const tailRankings: RankedCandidateResult[] = tailCandidates.map((c) => {
      const evalRes = computeOfflineCapabilityEvaluation(c, effectiveReq);
      return {
        candidateId: c.id,
        fitScore: evalRes.fitScore,
        matchedHighlights: evalRes.strengths.slice(0, 4),
        gaps: evalRes.gaps.slice(0, 4),
        oneLineSummary: evalRes.verdict,
      };
    });

    const sortedRankings = [...rankedResult.rankings, ...tailRankings].sort(
      (a, b) => b.fitScore - a.fitScore
    );
    const rankedCandidates = sortedRankings
      .map((r) => fullRowById.get(r.candidateId))
      .filter(Boolean);

    return {
      rankings: sortedRankings,
      candidates: rankedCandidates,
      aiUsed: rankedResult.aiUsed,
      retrievalMethod,
      totalTenantPool,
      totalEvaluated: shortlisted.length,
      ...(rankedResult.quotaNotice ? { quotaNotice: rankedResult.quotaNotice } : {}),
    };
  }
}

export const capabilityService = new CapabilityService();
