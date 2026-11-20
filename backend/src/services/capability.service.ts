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

export interface PrecomputedCapabilityPayload {
  fitScore: number;
  recommendation?: string;
  strengths?: string[];
  gaps?: string[];
  verdict?: string;
  evaluatedWithAi?: boolean;
  evaluatedAt?: string;
}

export function inferRecommendationFromScore(fitScore: number): CapabilityRecommendation {
  if (fitScore >= 80) return 'STRONG_FIT';
  if (fitScore >= 65) return 'GOOD_FIT';
  if (fitScore >= 45) return 'PARTIAL_FIT';
  return 'LOW_FIT';
}

function normalizeRecommendationEnum(raw: string | undefined, fitScore: number): CapabilityRecommendation {
  switch (String(raw || '').toUpperCase()) {
    case 'STRONG_FIT':
    case 'GOOD_FIT':
    case 'PARTIAL_FIT':
    case 'LOW_FIT':
      return String(raw).toUpperCase() as CapabilityRecommendation;
    default:
      return inferRecommendationFromScore(fitScore);
  }
}

/**
 * Validates and sanitizes an AI-ranked capability report so attaching pre-ranked candidates
 * persists their score, strengths, gaps, and verdict without invoking redundant LLM calls.
 */
export function normalizePrecomputedCapabilitySummary(
  payload: PrecomputedCapabilityPayload | undefined | null,
  options?: { rateMasked?: boolean }
): { capabilityScore: number; capabilitySummary: StoredCapabilitySummary } | null {
  if (!payload || payload.evaluatedWithAi !== true) return null;
  const rawScore = Number(payload.fitScore);
  if (!Number.isFinite(rawScore)) return null;

  const fitScore = Math.max(0, Math.min(100, Math.round(rawScore)));
  const recommendation = normalizeRecommendationEnum(payload.recommendation, fitScore);
  const summary = buildStoredCapabilitySummary(
    {
      fitScore,
      recommendation,
      verdict: String(payload.verdict || '').trim() || formatRecommendationLabel(recommendation),
      strengths: Array.isArray(payload.strengths) ? payload.strengths.map(String) : [],
      gaps: Array.isArray(payload.gaps) ? payload.gaps.map(String) : [],
      aiUsed: true,
    },
    {
      rateMasked: Boolean(options?.rateMasked),
      evaluatedAt: payload.evaluatedAt,
    }
  );

  return {
    capabilityScore: summary.fitScore,
    capabilitySummary: summary,
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
   * Attaching candidates (single Quick Attach or multi-applicant batch) must remain fast and never
   * invoke LLM calls automatically; users explicitly trigger Fit Checks on demand.
   */
  async evaluateNewlyAttachedSubmissions(
    _submissions: Array<{
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
    _requirement: {
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
    _options: { tenantId: string; aiSvc?: Pick<typeof aiService, 'evaluateSubmissionCapability' | 'getActiveRuntime'> }
  ) {
    return;
  }

  async rankMatchingCandidates(params: {
    tenantId: string;
    userId?: string;
    requirementId: string;
    skillsRequiredOverride?: string;
    search?: string;
    workAuth?: string;
    candidateIds?: string[];
    excludeCandidateIds?: string[];
    excludeAttached?: boolean;
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
    remainingUnrankedCount: number;
    excludedCount: number;
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
      excludeCandidateIds,
      excludeAttached = true,
      candidates: suppliedCandidates,
      rateMasked = false,
      maxShortlist = 20,
      aiSvc = aiService,
    } = params;

    const requirement = await prisma.requirement.findFirst({
      where: { id: requirementId, tenantId },
    });
    if (!requirement) {
      throw createHttpError('Requirement not found for tenant', 404);
    }

    const attachedRows = excludeAttached
      ? await prisma.submission.findMany({
          where: { requirementId, tenantId },
          select: { candidateId: true },
        })
      : [];

    const cleanExcludeIds = Array.from(
      new Set(
        [
          ...(Array.isArray(excludeCandidateIds) ? excludeCandidateIds : []),
          ...attachedRows.map((s) => s.candidateId),
        ]
          .map((id) => String(id || '').trim())
          .filter(Boolean)
      )
    ).slice(0, 500);
    const excludeSet = new Set(cleanExcludeIds);

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
      ? Array.from(new Set(candidateIds.map((id) => String(id || '').trim()).filter(Boolean)))
          .filter((id) => !excludeSet.has(id))
          .slice(0, 150)
      : undefined;

    const batchLimit = Math.max(1, Math.min(20, maxShortlist));
    let candidatePool: CapabilityCandidateInput[] = [];
    const fullRowById = new Map<string, any>();
    let retrievalMethod: 'pgvector_hybrid' | 'pg_fts' | 'in_memory' = 'pg_fts';
    let totalTenantPool = 0;

    try {
      // Sync FTS chunks fast locally; run heavy embedding backfill asynchronously so interactive search stays responsive
      await candidateIndexingService.ensureTenantIndexedForSearch(tenantId, {
        maxChunkSync: 250,
        maxEmbedChunks: 0,
      });
      void candidateIndexingService
        .ensureTenantIndexedForSearch(tenantId, {
          maxChunkSync: 0,
          maxEmbedChunks: 24,
        })
        .catch(() => {});

      const { queryText, skillTokens } = buildRequirementSearchQuery({
        opportunityTitle: effectiveReq.opportunityTitle,
        skillsRequired: effectiveReq.skillsRequired,
        location: effectiveReq.location,
        workModel: effectiveReq.workModel,
        publicDescription: requirement.publicDescription,
        rawEmailText: effectiveReq.rawEmailText,
      });

      const queryEmbedded = await embeddingService.embedTexts([queryText], {
        tenantId,
        timeoutMs: 3500,
      });
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
        excludeCandidateIds: cleanExcludeIds,
        limit: batchLimit,
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
      candidatePool = suppliedCandidates.filter((c) => !excludeSet.has(c.id));
      totalTenantPool = candidatePool.length;
    }

    const shortlisted =
      retrievalMethod === 'in_memory'
        ? preFilterCandidatesForMatch(candidatePool, effectiveReq, batchLimit)
        : candidatePool.slice(0, batchLimit);

    const rankedResult = await aiSvc.rankCandidatesForRequirement(shortlisted, effectiveReq, {
      rateMasked: Boolean(rateMasked),
      tenantId,
      userId,
    });

    const sortedRankings = [...rankedResult.rankings].sort(
      (a, b) => b.fitScore - a.fitScore
    );
    const rankedCandidates = sortedRankings
      .map((r) => fullRowById.get(r.candidateId))
      .filter(Boolean);
    const remainingUnrankedCount = Math.max(0, totalTenantPool - shortlisted.length);

    return {
      rankings: sortedRankings,
      candidates: rankedCandidates,
      aiUsed: rankedResult.aiUsed,
      retrievalMethod,
      totalTenantPool,
      totalEvaluated: sortedRankings.length,
      remainingUnrankedCount,
      excludedCount: cleanExcludeIds.length,
      ...(rankedResult.quotaNotice ? { quotaNotice: rankedResult.quotaNotice } : {}),
    };
  }
}

export const capabilityService = new CapabilityService();
