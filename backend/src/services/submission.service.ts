import crypto from 'crypto';
import {
  AutomationCategory,
  CandidatePipelineStage,
  MasterTaxonomyCategory,
  PitchTone,
  Prisma,
  SlaCategory,
} from '@prisma/client';
import { prisma } from '../config/prisma.config';
import { DEFAULT_TAXONOMIES } from '../config/taxonomies.config';
import {
  REQUIREMENT_INCLUDE,
  RequirementStatus,
  normalizeStageValue,
} from './requirement.service';
import { slaEngineService } from './slaEngine.service';
import { automationEngineService } from './automationEngine.service';
import {
  normalizePrecomputedCapabilitySummary,
  type PrecomputedCapabilityPayload,
} from './capability.service';

const CANONICAL_STAGE_RANK: Record<string, number> = {
  [RequirementStatus.REQUIREMENT]: 0,
  [RequirementStatus.SUBMITTED]: 1,
  [RequirementStatus.INTERVIEW]: 2,
  [RequirementStatus.SELECTED]: 3,
  [RequirementStatus.ONBOARDING]: 4,
  [RequirementStatus.CLOSED]: -1,
};

const CANONICAL_APPLICANT_STAGES = new Set<string>([
  RequirementStatus.SUBMITTED,
  RequirementStatus.INTERVIEW,
  RequirementStatus.SELECTED,
  RequirementStatus.ONBOARDING,
  RequirementStatus.CLOSED,
]);

const EXCLUDED_APPLICANT_STAGES = new Set(['requirement', 'billable', 'archived']);
const NON_PROMOTABLE_STAGES = new Set(['closed', 'billable', 'archived']);

const CANDIDATE_STAGE_FOR_REQ: Partial<Record<string, CandidatePipelineStage>> = {
  [RequirementStatus.SUBMITTED]: CandidatePipelineStage.SUBMITTED,
  [RequirementStatus.INTERVIEW]: CandidatePipelineStage.INTERVIEW,
  [RequirementStatus.SELECTED]: CandidatePipelineStage.SELECTED,
  [RequirementStatus.ONBOARDING]: CandidatePipelineStage.ONBOARDING,
};

function createHttpError(message: string, statusCode: number): Error & { statusCode: number } {
  const err = new Error(message) as Error & { statusCode: number };
  err.statusCode = statusCode;
  return err;
}

export function normalizePitchTone(input?: unknown): PitchTone {
  const raw = String(input || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (raw === 'HIGH_IMPACT') return PitchTone.HIGH_IMPACT;
  if (raw === 'TECHNICAL_FOCUS') return PitchTone.TECHNICAL_FOCUS;
  return PitchTone.PROFESSIONAL;
}

function buildStageRankMap(orderedStages?: string[]): Map<string, number> {
  const rankMap = new Map<string, number>();
  if (orderedStages && orderedStages.length > 0) {
    orderedStages.forEach((rawStage, index) => {
      const trimmed = String(rawStage || '').trim();
      if (!trimmed) return;
      const lowerRaw = trimmed.toLowerCase();
      if (NON_PROMOTABLE_STAGES.has(lowerRaw)) {
        rankMap.set(lowerRaw, -1);
        return;
      }
      const normLower = normalizeStageValue(trimmed).toLowerCase();
      if (!rankMap.has(lowerRaw)) rankMap.set(lowerRaw, index);
      if (!rankMap.has(normLower)) rankMap.set(normLower, index);
    });
    return rankMap;
  }

  for (const [key, rank] of Object.entries(CANONICAL_STAGE_RANK)) {
    rankMap.set(key.toLowerCase(), rank);
  }
  return rankMap;
}

/**
 * Loads ordered active pipeline stage labels for a tenant from MasterTaxonomy,
 * falling back to system defaults when none are customized yet.
 */
export async function getTenantPipelineStages(tenantId: string): Promise<string[]> {
  const rows = await prisma.masterTaxonomy.findMany({
    where: {
      tenantId,
      category: MasterTaxonomyCategory.STAGES,
      active: true,
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: { optionValue: true },
  });

  if (rows.length > 0) {
    return rows.map((r) => r.optionValue.trim()).filter(Boolean);
  }

  return DEFAULT_TAXONOMIES
    .filter((t) => t.category === MasterTaxonomyCategory.STAGES)
    .map((t) => t.optionValue);
}

/**
 * Validates and canonicalizes an incoming applicant submission stage against
 * canonical milestones and active workspace STAGES taxonomies.
 */
export function resolveApplicantStage(stageInput: string, tenantStages: string[]): string {
  const trimmed = String(stageInput || '').trim();
  if (!trimmed || trimmed.length > 60) {
    throw createHttpError(
      'Invalid applicant stage. Allowed values: active pipeline stages or Closed.',
      400
    );
  }

  const lower = trimmed.toLowerCase();
  if (EXCLUDED_APPLICANT_STAGES.has(lower)) {
    throw createHttpError(
      'Invalid applicant stage. Allowed values: active pipeline stages or Closed.',
      400
    );
  }

  const normalized = normalizeStageValue(trimmed);
  if (CANONICAL_APPLICANT_STAGES.has(normalized)) {
    return normalized;
  }

  const matchedConfigured = tenantStages.find((s) => {
    const clean = s.trim();
    return clean.toLowerCase() === lower && !EXCLUDED_APPLICANT_STAGES.has(clean.toLowerCase());
  });
  if (matchedConfigured) {
    return matchedConfigured.trim();
  }

  throw createHttpError(
    'Invalid applicant stage. Allowed values: active pipeline stages or Closed.',
    400
  );
}

/**
 * Computes the highest non-closed stage among active submissions, defaulting to REQUIREMENT.
 */
export function computeHighestActiveStage(
  submissionStages: string[],
  orderedStages?: string[]
): string {
  const rankMap = buildStageRankMap(orderedStages);
  let bestStage: string = RequirementStatus.REQUIREMENT;
  let bestRank = -1;

  for (const rawStage of submissionStages) {
    const normalized = normalizeStageValue(rawStage);
    if (!normalized) continue;
    const lower = normalized.toLowerCase();
    if (NON_PROMOTABLE_STAGES.has(lower)) continue;
    const rank = rankMap.get(lower) ?? 0;
    if (rank > bestRank) {
      bestRank = rank;
      bestStage = normalized;
    }
  }

  return bestStage;
}

/**
 * Given all submission stages for a requirement and the requirement's current status,
 * returns the promoted Requirement status if an active applicant has reached a higher milestone
 * (and the requirement isn't already ONBOARDING).
 */
export function computePromotedRequirementStage(
  submissionStages: string[],
  currentStatus: string,
  orderedStages?: string[]
): string | null {
  const normalizedCurrent = normalizeStageValue(currentStatus);
  const currentLower = normalizedCurrent.toLowerCase();
  if (
    normalizedCurrent === RequirementStatus.ONBOARDING ||
    currentLower === 'billable' ||
    currentLower === 'archived'
  ) {
    return null;
  }

  const rankMap = buildStageRankMap(orderedStages);
  let bestStage: string | null = null;
  let bestRank = rankMap.get(currentLower) ?? 0;

  for (const rawStage of submissionStages) {
    const normalized = normalizeStageValue(rawStage);
    if (!normalized) continue;
    const lower = normalized.toLowerCase();
    if (NON_PROMOTABLE_STAGES.has(lower)) continue;
    const rank = rankMap.get(lower) ?? -1;
    if (rank > bestRank) {
      bestRank = rank;
      bestStage = normalized;
    }
  }

  return bestStage;
}

export interface ClientDuplicateWarning {
  candidateId: string;
  candidateName: string;
  existingSubmissionId: string;
  requirementId: string;
  requirementCode: string;
  opportunityTitle: string;
  clientName: string;
  stage: string;
  recruiterName: string | null;
  submissionDate: string;
  daysAgo: number;
}

export function parseOptionalDateInput(val: unknown): Date | null | undefined {
  if (val === undefined) return undefined;
  if (val === null) return null;
  const trimmed = String(val).trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  if (isNaN(parsed.getTime())) {
    throw createHttpError('Invalid interview date/time format.', 400);
  }
  return parsed;
}

export function normalizeOptionalNotes(val: unknown): string | null | undefined {
  if (val === undefined) return undefined;
  if (val === null) return null;
  const trimmed = String(val).trim();
  if (!trimmed) return null;
  if (trimmed.length > 5000) {
    throw createHttpError('Notes must be 5,000 characters or fewer.', 400);
  }
  return trimmed;
}

export interface SubmissionNoteItem {
  id: string;
  text: string;
  authorName: string;
  authorId?: string;
  stage?: string;
  createdAt: string;
  updatedAt?: string;
}

export function parseSubmissionNotes(
  raw?: string | null,
  fallbackAuthor?: string | null,
  fallbackDate?: Date | string | null
): SubmissionNoteItem[] {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return [];

  const defaultIso = fallbackDate ? new Date(fallbackDate).toISOString() : new Date().toISOString();

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        const items: SubmissionNoteItem[] = [];
        for (let i = 0; i < parsed.length; i++) {
          const item = parsed[i];
          if (item && typeof item === 'object' && typeof item.text === 'string' && item.text.trim()) {
            items.push({
              id: typeof item.id === 'string' && item.id.trim() ? item.id.trim() : `note_${i}`,
              text: item.text.trim(),
              authorName:
                typeof item.authorName === 'string' && item.authorName.trim()
                  ? item.authorName.trim()
                  : fallbackAuthor?.trim() || 'Recruiter',
              ...(typeof item.authorId === 'string' && item.authorId.trim()
                ? { authorId: item.authorId.trim() }
                : {}),
              ...(typeof item.stage === 'string' && item.stage.trim()
                ? { stage: item.stage.trim() }
                : {}),
              createdAt:
                typeof item.createdAt === 'string' && item.createdAt.trim()
                  ? item.createdAt
                  : defaultIso,
              ...(typeof item.updatedAt === 'string' && item.updatedAt.trim()
                ? { updatedAt: item.updatedAt }
                : {}),
            });
          }
        }
        return items;
      }
    } catch {
      // Fallback to legacy single plain-text note below
    }
  }

  return [
    {
      id: 'legacy_0',
      text: trimmed,
      authorName: fallbackAuthor?.trim() || 'Recruiter',
      createdAt: defaultIso,
    },
  ];
}

export function applySubmissionNoteMutation(params: {
  existingRaw?: string | null;
  action: 'add' | 'edit' | 'delete';
  noteId?: string;
  noteText?: string | null;
  authorId?: string;
  authorName?: string;
  stage?: string;
  fallbackAuthor?: string | null;
  fallbackDate?: Date | string | null;
  now?: Date;
}): string | null {
  const {
    existingRaw,
    action,
    noteId,
    noteText,
    authorId,
    authorName,
    stage,
    fallbackAuthor,
    fallbackDate,
    now = new Date(),
  } = params;

  const existingList = parseSubmissionNotes(existingRaw, fallbackAuthor, fallbackDate);
  const nowIso = now.toISOString();

  if (action === 'add') {
    const cleanText = normalizeOptionalNotes(noteText);
    if (!cleanText) {
      throw createHttpError('Note text cannot be empty.', 400);
    }
    const nextNote: SubmissionNoteItem = {
      id: crypto.randomUUID(),
      text: cleanText,
      authorName: authorName?.trim() || 'Recruiter',
      ...(authorId ? { authorId } : {}),
      ...(stage ? { stage } : {}),
      createdAt: nowIso,
    };
    return JSON.stringify([nextNote, ...existingList]);
  }

  if (action === 'edit') {
    const targetId = String(noteId || '').trim();
    if (!targetId) {
      throw createHttpError('noteId is required to edit a note.', 400);
    }
    const cleanText = normalizeOptionalNotes(noteText);
    if (!cleanText) {
      throw createHttpError('Note text cannot be empty.', 400);
    }
    if (!existingList.some((n) => n.id === targetId)) {
      throw createHttpError('Note not found on this submission.', 404);
    }
    const updatedList = existingList.map((n) =>
      n.id === targetId ? { ...n, text: cleanText, updatedAt: nowIso } : n
    );
    return JSON.stringify(updatedList);
  }

  if (action === 'delete') {
    const targetId = String(noteId || '').trim();
    if (!targetId) {
      throw createHttpError('noteId is required to delete a note.', 400);
    }
    const updatedList = existingList.filter((n) => n.id !== targetId);
    return updatedList.length > 0 ? JSON.stringify(updatedList) : null;
  }

  throw createHttpError('Invalid note action.', 400);
}

export function formatClientDuplicateWarnings(
  rows: Array<{
    id: string;
    candidateId: string;
    stage: string;
    submissionDate: Date;
    createdAt: Date;
    candidate?: { fullName: string } | null;
    recruiter?: { fullName: string } | null;
    requirement?: { id: string; code: string; opportunityTitle: string; companyName: string } | null;
  }>,
  now: Date = new Date()
): ClientDuplicateWarning[] {
  const msPerDay = 24 * 60 * 60 * 1000;
  return rows.map((row) => {
    const subAt = row.submissionDate || row.createdAt || now;
    const diffMs = Math.max(0, now.getTime() - new Date(subAt).getTime());
    const daysAgo = Math.floor(diffMs / msPerDay);
    return {
      candidateId: row.candidateId,
      candidateName: row.candidate?.fullName || 'Consultant',
      existingSubmissionId: row.id,
      requirementId: row.requirement?.id || '',
      requirementCode: row.requirement?.code || '',
      opportunityTitle: row.requirement?.opportunityTitle || '',
      clientName: row.requirement?.companyName || 'Client',
      stage: row.stage,
      recruiterName: row.recruiter?.fullName || null,
      submissionDate: new Date(subAt).toISOString(),
      daysAgo,
    };
  });
}

export interface AttachCandidatesInput {
  tenantId: string;
  recruiterId?: string;
  requirementId: string;
  candidateId?: string;
  candidateIds?: string[];
  precomputedCapabilities?: Record<string, PrecomputedCapabilityPayload>;
  rateMasked?: boolean;
  pitchEmailSubject?: string;
  pitchEmailBody?: string;
  pitchTone?: string;
}

export class SubmissionService {
  async attachCandidates(input: AttachCandidatesInput) {
    const {
      tenantId,
      recruiterId,
      requirementId,
      candidateId,
      candidateIds,
      precomputedCapabilities,
      rateMasked = false,
      pitchEmailSubject,
      pitchEmailBody,
      pitchTone,
    } = input;

    const rawIds = [
      ...(Array.isArray(candidateIds) ? candidateIds : []),
      ...(candidateId ? [candidateId] : []),
    ]
      .map((id) => String(id || '').trim())
      .filter(Boolean);

    const uniqueCandidateIds = Array.from(new Set(rawIds));
    const isBatchRequest = Array.isArray(candidateIds) && candidateIds.length > 0;

    if (!requirementId || uniqueCandidateIds.length === 0) {
      throw createHttpError('requirementId and at least one candidateId are required', 400);
    }

    const [requirement, candidates] = await Promise.all([
      prisma.requirement.findFirst({ where: { id: requirementId, tenantId } }),
      prisma.candidate.findMany({
        where: { id: { in: uniqueCandidateIds }, tenantId },
      }),
    ]);

    if (!requirement) {
      throw createHttpError('Requirement not found for tenant', 404);
    }
    if (candidates.length === 0) {
      throw createHttpError('Candidate(s) not found for tenant', 404);
    }

    const foundById = new Map(candidates.map((c) => [c.id, c]));
    const orderedCandidates = uniqueCandidateIds
      .map((id) => foundById.get(id))
      .filter((c): c is NonNullable<typeof c> => Boolean(c));

    const existingSubmissions = await prisma.submission.findMany({
      where: {
        requirementId: requirement.id,
        candidateId: { in: orderedCandidates.map((c) => c.id) },
      },
      include: { candidate: true },
    });

    const existingByCandId = new Map(existingSubmissions.map((s) => [s.candidateId, s]));
    const candidatesToAttach = orderedCandidates.filter((c) => !existingByCandId.has(c.id));

    const toneEnum = normalizePitchTone(pitchTone);

    // If caller is logging a pitch email for an already-attached consultant, update that submission's pitch cleanly
    if (
      candidatesToAttach.length === 0 &&
      !isBatchRequest &&
      orderedCandidates.length === 1 &&
      (pitchEmailSubject || pitchEmailBody)
    ) {
      const existing = existingByCandId.get(orderedCandidates[0].id)!;
      const updated = await prisma.submission.update({
        where: { id: existing.id },
        data: {
          pitchEmailSubject: pitchEmailSubject ?? existing.pitchEmailSubject,
          pitchEmailBody: pitchEmailBody ?? existing.pitchEmailBody,
          pitchTone: toneEnum,
        },
        include: { candidate: true },
      });
      const refreshedRequirement = await prisma.requirement.findUnique({
        where: { id: requirement.id },
        include: REQUIREMENT_INCLUDE,
      });
      return {
        statusCode: 200,
        data: updated,
        createdSubmissions: [updated],
        requirement: refreshedRequirement,
        addedCount: 0,
        skippedDuplicatesCount: 1,
      };
    }

    if (candidatesToAttach.length === 0) {
      throw createHttpError(
        orderedCandidates.length === 1
          ? `${orderedCandidates[0].fullName} is already attached to this requirement`
          : 'All selected candidates are already attached to this requirement',
        409
      );
    }

    const createdSubmissions = await prisma.$transaction(async (tx) => {
      const createdList = [];
      for (const cand of candidatesToAttach) {
        const precomputed = normalizePrecomputedCapabilitySummary(
          precomputedCapabilities?.[cand.id],
          { rateMasked }
        );
        const sub = await tx.submission.create({
          data: {
            tenantId,
            requirementId: requirement.id,
            candidateId: cand.id,
            recruiterId: recruiterId || null,
            pitchEmailSubject: pitchEmailSubject || null,
            pitchEmailBody: pitchEmailBody || null,
            pitchTone: toneEnum,
            stage: RequirementStatus.SUBMITTED,
            ...(precomputed
              ? {
                  capabilityScore: precomputed.capabilityScore,
                  capabilitySummary: precomputed.capabilitySummary as unknown as Prisma.InputJsonValue,
                }
              : {}),
          },
          include: { candidate: true },
        });
        createdList.push(sub);
      }

      const benchIds = candidatesToAttach
        .filter((c) => c.pipelineStage === CandidatePipelineStage.AVAILABLE_BENCH)
        .map((c) => c.id);

      if (benchIds.length > 0) {
        await tx.candidate.updateMany({
          where: { id: { in: benchIds } },
          data: { pipelineStage: CandidatePipelineStage.SUBMITTED },
        });
      }

      if (normalizeStageValue(requirement.status) === RequirementStatus.REQUIREMENT) {
        await tx.requirement.update({
          where: { id: requirement.id },
          data: { status: RequirementStatus.SUBMITTED },
        });
      }

      return createdList;
    });

    const candidateNames = candidatesToAttach.map((c) => c.fullName).join(', ');
    try {
      await slaEngineService.resolveTasksForEntity(tenantId, 'requirement', requirement.id, [
        SlaCategory.STALE_REQUIREMENT,
      ]);
      await automationEngineService.recordLifecycleEvent({
        tenantId,
        preferredCategories: [AutomationCategory.FEEDBACK, AutomationCategory.STALE_REQ],
        ruleName:
          candidatesToAttach.length > 1 ? 'Multi-Applicant Submittal' : 'Direct Candidate Submittal',
        target: `${candidateNames} -> ${requirement.code} (${requirement.companyName})`,
        conditionsMet: `Attached ${candidatesToAttach.length} applicant(s) for ${requirement.openPositions} open position(s)`,
        actionDispatched: 'Logged Submission(s) & Cleared Unsourced SLA Alert',
      });
      await slaEngineService.evaluateSlaRadar(tenantId);
    } catch {
      // Non-critical automation hook
    }

    const refreshedRequirement = await prisma.requirement.findUnique({
      where: { id: requirement.id },
      include: REQUIREMENT_INCLUDE,
    });

    return {
      statusCode: 201,
      data: isBatchRequest ? createdSubmissions : createdSubmissions[0],
      createdSubmissions,
      requirement: refreshedRequirement,
      addedCount: createdSubmissions.length,
      skippedDuplicatesCount: existingSubmissions.length,
    };
  }

  private async syncPostSubmissionUpdate(params: {
    tenantId: string;
    requirementId: string;
    requirementStatus: string;
    candidateId: string;
    candidatePipelineStage: CandidatePipelineStage;
    mappedStage?: string;
    tenantStages?: string[];
  }) {
    const {
      tenantId,
      requirementId,
      requirementStatus,
      candidateId,
      candidatePipelineStage,
      mappedStage,
      tenantStages,
    } = params;

    if (mappedStage) {
      if (candidatePipelineStage !== CandidatePipelineStage.BILLABLE) {
        const targetCandStage =
          CANDIDATE_STAGE_FOR_REQ[mappedStage] ??
          (candidatePipelineStage === CandidatePipelineStage.AVAILABLE_BENCH &&
          mappedStage !== RequirementStatus.CLOSED
            ? CandidatePipelineStage.SUBMITTED
            : undefined);
        if (targetCandStage) {
          await prisma.candidate.update({
            where: { id: candidateId },
            data: { pipelineStage: targetCandStage },
          });
        }
      }

      const allSubs = await prisma.submission.findMany({
        where: { requirementId },
        select: { stage: true },
      });
      const promotedStatus = computePromotedRequirementStage(
        allSubs.map((s) => s.stage),
        requirementStatus,
        tenantStages
      );
      if (promotedStatus) {
        await prisma.requirement.update({
          where: { id: requirementId },
          data: { status: promotedStatus },
        });
      }
    }

    try {
      await slaEngineService.evaluateSlaRadar(tenantId);
    } catch {
      // Non-critical SLA sync
    }

    return prisma.requirement.findUnique({
      where: { id: requirementId },
      include: REQUIREMENT_INCLUDE,
    });
  }

  async updateSubmissionStage(params: {
    submissionId: string;
    tenantId: string;
    stageInput: string;
    interviewDate?: string | null;
    interviewNotes?: string | null;
  }) {
    const { submissionId, tenantId, stageInput, interviewDate, interviewNotes } = params;

    const existing = await prisma.submission.findFirst({
      where: { id: submissionId, tenantId },
      include: { requirement: true, candidate: true },
    });

    if (!existing) {
      throw createHttpError('Applicant submission not found for tenant', 404);
    }

    const tenantStages = await getTenantPipelineStages(tenantId);
    const mappedStage = resolveApplicantStage(stageInput, tenantStages);
    const parsedDate = parseOptionalDateInput(interviewDate);
    const parsedNotes = normalizeOptionalNotes(interviewNotes);

    const updateData: any = { stage: mappedStage };
    if (mappedStage !== RequirementStatus.SUBMITTED) {
      updateData.lastClientFeedbackDate = new Date();
    }
    if (parsedDate !== undefined) updateData.interviewDate = parsedDate;
    if (parsedNotes !== undefined) updateData.interviewNotes = parsedNotes;

    const updatedSubmission = await prisma.submission.update({
      where: { id: existing.id },
      data: updateData,
      include: {
        candidate: true,
        recruiter: { select: { id: true, fullName: true } },
      },
    });

    const refreshedRequirement = await this.syncPostSubmissionUpdate({
      tenantId,
      requirementId: existing.requirementId,
      requirementStatus: existing.requirement.status,
      candidateId: existing.candidateId,
      candidatePipelineStage: existing.candidate.pipelineStage,
      mappedStage,
      tenantStages,
    });

    return {
      submission: updatedSubmission,
      requirement: refreshedRequirement,
    };
  }

  /**
   * Updates call/interview notes, scheduled interview date/time, or rejection feedback,
   * optionally also advancing or closing the applicant stage in the same operation.
   */
  async updateSubmissionNotes(params: {
    submissionId: string;
    tenantId: string;
    interviewDate?: string | null;
    interviewNotes?: string | null;
    stageInput?: string;
    action?: 'add' | 'edit' | 'delete';
    noteId?: string;
    noteText?: string | null;
    authorId?: string;
    authorName?: string;
  }) {
    const {
      submissionId,
      tenantId,
      interviewDate,
      interviewNotes,
      stageInput,
      action,
      noteId,
      noteText,
      authorId,
      authorName,
    } = params;

    const existing = await prisma.submission.findFirst({
      where: { id: submissionId, tenantId },
      include: {
        requirement: true,
        candidate: true,
        recruiter: { select: { id: true, fullName: true } },
      },
    });

    if (!existing) {
      throw createHttpError('Applicant submission not found for tenant', 404);
    }

    const parsedDate = parseOptionalDateInput(interviewDate);
    let tenantStages: string[] | undefined;
    let mappedStage: string | undefined;

    if (stageInput !== undefined && String(stageInput).trim() !== '') {
      tenantStages = await getTenantPipelineStages(tenantId);
      mappedStage = resolveApplicantStage(stageInput, tenantStages);
    }

    const updateData: any = {};
    if (mappedStage) updateData.stage = mappedStage;
    if (parsedDate !== undefined) updateData.interviewDate = parsedDate;

    if (action) {
      updateData.interviewNotes = applySubmissionNoteMutation({
        existingRaw: existing.interviewNotes,
        action,
        noteId,
        noteText,
        authorId,
        authorName,
        stage: mappedStage || existing.stage,
        fallbackAuthor: existing.recruiter?.fullName,
        fallbackDate: existing.lastClientFeedbackDate || existing.submissionDate || existing.createdAt,
      });
      updateData.lastClientFeedbackDate = new Date();
    } else {
      const parsedNotes = normalizeOptionalNotes(interviewNotes);
      if (parsedNotes !== undefined) {
        updateData.interviewNotes = parsedNotes;
        updateData.lastClientFeedbackDate = new Date();
      }
    }

    if (mappedStage && mappedStage !== RequirementStatus.SUBMITTED) {
      updateData.lastClientFeedbackDate = new Date();
    }

    if (Object.keys(updateData).length === 0) {
      throw createHttpError('Provide a note action, interviewDate, interviewNotes, or stage.', 400);
    }

    const updatedSubmission = await prisma.submission.update({
      where: { id: existing.id },
      data: updateData,
      include: {
        candidate: true,
        recruiter: { select: { id: true, fullName: true } },
      },
    });

    const refreshedRequirement = await this.syncPostSubmissionUpdate({
      tenantId,
      requirementId: existing.requirementId,
      requirementStatus: existing.requirement.status,
      candidateId: existing.candidateId,
      candidatePipelineStage: existing.candidate.pipelineStage,
      mappedStage,
      tenantStages,
    });

    return {
      submission: updatedSubmission,
      requirement: refreshedRequirement,
    };
  }

  /**
   * Checks whether any candidate in candidateIds was previously submitted on another
   * requirement for the same Client / Company so multi-recruiter teams get a re-submission warning.
   */
  async checkClientDuplicates(params: {
    tenantId: string;
    requirementId: string;
    candidateIds: string[];
  }) {
    const { tenantId, requirementId, candidateIds } = params;
    const cleanCandidateIds = Array.from(
      new Set((candidateIds || []).map((id) => String(id || '').trim()).filter(Boolean))
    );

    const targetReq = await prisma.requirement.findFirst({
      where: { id: requirementId, tenantId },
      select: { id: true, clientId: true, companyName: true },
    });

    if (!targetReq) {
      throw createHttpError('Requirement not found for tenant', 404);
    }

    if (cleanCandidateIds.length === 0) {
      return { warnings: [] as ClientDuplicateWarning[], byCandidateId: {} as Record<string, ClientDuplicateWarning[]> };
    }

    const companyName = String(targetReq.companyName || '').trim();
    if (!targetReq.clientId && !companyName) {
      return { warnings: [] as ClientDuplicateWarning[], byCandidateId: {} as Record<string, ClientDuplicateWarning[]> };
    }

    const clientFilter: any = targetReq.clientId
      ? {
          OR: [
            { clientId: targetReq.clientId },
            ...(companyName
              ? [{ clientId: null, companyName: { equals: companyName, mode: 'insensitive' as const } }]
              : []),
          ],
        }
      : { companyName: { equals: companyName, mode: 'insensitive' as const } };

    const matchingSubmissions = await prisma.submission.findMany({
      where: {
        tenantId,
        candidateId: { in: cleanCandidateIds },
        requirementId: { not: targetReq.id },
        requirement: clientFilter,
      },
      orderBy: [{ submissionDate: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        candidateId: true,
        stage: true,
        submissionDate: true,
        createdAt: true,
        candidate: { select: { fullName: true } },
        recruiter: { select: { fullName: true } },
        requirement: {
          select: { id: true, code: true, opportunityTitle: true, companyName: true },
        },
      },
    });

    const warnings = formatClientDuplicateWarnings(matchingSubmissions);
    const byCandidateId: Record<string, ClientDuplicateWarning[]> = {};
    for (const w of warnings) {
      if (!byCandidateId[w.candidateId]) byCandidateId[w.candidateId] = [];
      byCandidateId[w.candidateId].push(w);
    }

    return { warnings, byCandidateId };
  }

  async detachSubmission(params: { submissionId: string; tenantId: string }) {
    const { submissionId, tenantId } = params;

    const existing = await prisma.submission.findFirst({
      where: { id: submissionId, tenantId },
      include: { requirement: true, candidate: true },
    });

    if (!existing) {
      throw createHttpError('Applicant submission not found for tenant', 404);
    }

    await prisma.submission.delete({ where: { id: existing.id } });

    // If this applicant also had an active placement on this requirement, remove it so
    // filledPositions / activePlacements and Billable Consultants stay in sync.
    const removedPlacements = await prisma.placement.deleteMany({
      where: {
        tenantId,
        requirementId: existing.requirementId,
        status: { notIn: ['TERMINATED', 'COMPLETED'] },
        OR: [
          { candidateId: existing.candidateId },
          {
            candidateId: null,
            resourceName: { equals: existing.candidate.fullName, mode: 'insensitive' },
          },
        ],
      },
    });

    const [remainingSubs, activePlacementsCount] = await Promise.all([
      prisma.submission.findMany({
        where: { requirementId: existing.requirementId },
        select: { stage: true },
      }),
      prisma.placement.count({
        where: {
          requirementId: existing.requirementId,
          status: { notIn: ['TERMINATED', 'COMPLETED'] },
        },
      }),
    ]);

    const openPositions = Math.max(1, existing.requirement.openPositions ?? 1);

    const tenantStages = await getTenantPipelineStages(tenantId);

    if (
      removedPlacements.count > 0 &&
      activePlacementsCount < openPositions &&
      normalizeStageValue(existing.requirement.status) === RequirementStatus.ONBOARDING
    ) {
      const activeSubStages = remainingSubs
        .map((s) => s.stage)
        .filter((st) => {
          const norm = normalizeStageValue(st);
          return norm !== RequirementStatus.CLOSED && norm !== RequirementStatus.ONBOARDING;
        });
      const fallbackStatus = computeHighestActiveStage(activeSubStages, tenantStages);
      await prisma.requirement.update({
        where: { id: existing.requirementId },
        data: { status: fallbackStatus },
      });
    } else if (
      remainingSubs.length === 0 &&
      activePlacementsCount === 0 &&
      normalizeStageValue(existing.requirement.status) === RequirementStatus.SUBMITTED
    ) {
      await prisma.requirement.update({
        where: { id: existing.requirementId },
        data: { status: RequirementStatus.REQUIREMENT },
      });
    }

    const [otherActiveSubs, otherPlacements] = await Promise.all([
      prisma.submission.count({
        where: {
          candidateId: existing.candidateId,
          stage: { not: RequirementStatus.CLOSED },
        },
      }),
      prisma.placement.count({
        where: {
          candidateId: existing.candidateId,
          status: { notIn: ['TERMINATED', 'COMPLETED'] },
        },
      }),
    ]);

    if (otherPlacements === 0) {
      if (otherActiveSubs === 0) {
        await prisma.candidate.update({
          where: { id: existing.candidateId },
          data: { pipelineStage: CandidatePipelineStage.AVAILABLE_BENCH },
        });
      } else if (
        existing.candidate.pipelineStage === CandidatePipelineStage.BILLABLE ||
        existing.candidate.pipelineStage === CandidatePipelineStage.ONBOARDING
      ) {
        await prisma.candidate.update({
          where: { id: existing.candidateId },
          data: { pipelineStage: CandidatePipelineStage.SUBMITTED },
        });
      }
    }

    try {
      await slaEngineService.evaluateSlaRadar(tenantId);
    } catch {
      // Non-critical SLA sync
    }

    const refreshedRequirement = await prisma.requirement.findUnique({
      where: { id: existing.requirementId },
      include: REQUIREMENT_INCLUDE,
    });

    return {
      deletedId: existing.id,
      requirementId: existing.requirementId,
      candidateId: existing.candidateId,
      requirement: refreshedRequirement,
    };
  }
}

export const submissionService = new SubmissionService();
