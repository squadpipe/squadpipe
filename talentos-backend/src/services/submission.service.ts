import {
  AutomationCategory,
  CandidatePipelineStage,
  PitchTone,
  RequirementStatus,
  SlaCategory,
} from '@prisma/client';
import { prisma } from '../config/prisma.config';
import { REQUIREMENT_INCLUDE, requirementStatusMap } from './requirement.service';
import { slaEngineService } from './slaEngine.service';
import { automationEngineService } from './automationEngine.service';

const STAGE_RANK: Record<RequirementStatus, number> = {
  [RequirementStatus.REQUIREMENT]: 0,
  [RequirementStatus.SUBMITTED]: 1,
  [RequirementStatus.INTERVIEW]: 2,
  [RequirementStatus.SELECTED]: 3,
  [RequirementStatus.ONBOARDING]: 4,
  [RequirementStatus.CLOSED]: -1,
};

const CANDIDATE_STAGE_FOR_REQ: Partial<Record<RequirementStatus, CandidatePipelineStage>> = {
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

/**
 * Given all submission stages for a requirement and the requirement's current status,
 * returns the promoted RequirementStatus if an active applicant has reached a higher milestone
 * (and the requirement isn't already ONBOARDING).
 */
export function computePromotedRequirementStage(
  submissionStages: RequirementStatus[],
  currentStatus: string
): RequirementStatus | null {
  if (
    currentStatus === RequirementStatus.ONBOARDING ||
    currentStatus === 'Billable' ||
    currentStatus === 'Archived'
  ) {
    return null;
  }

  let bestStage: RequirementStatus | null = null;
  let bestRank = STAGE_RANK[currentStatus as RequirementStatus] ?? 0;

  for (const stage of submissionStages) {
    const rank = STAGE_RANK[stage] ?? -1;
    if (rank > bestRank) {
      bestRank = rank;
      bestStage = stage;
    }
  }

  return bestStage;
}

export interface AttachCandidatesInput {
  tenantId: string;
  recruiterId?: string;
  requirementId: string;
  candidateId?: string;
  candidateIds?: string[];
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

      if (requirement.status === RequirementStatus.REQUIREMENT) {
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

  async updateSubmissionStage(params: {
    submissionId: string;
    tenantId: string;
    stageInput: string;
    interviewDate?: string;
    interviewNotes?: string;
  }) {
    const { submissionId, tenantId, stageInput, interviewDate, interviewNotes } = params;

    const existing = await prisma.submission.findFirst({
      where: { id: submissionId, tenantId },
      include: { requirement: true, candidate: true },
    });

    if (!existing) {
      throw createHttpError('Applicant submission not found for tenant', 404);
    }

    const mappedStage = requirementStatusMap[String(stageInput || '').trim()];
    if (!mappedStage || mappedStage === RequirementStatus.REQUIREMENT) {
      throw createHttpError(
        'Invalid applicant stage. Allowed values: Submitted, Interview, Selected, Onboarding, Closed',
        400
      );
    }

    const updateData: any = { stage: mappedStage };
    if (mappedStage !== RequirementStatus.SUBMITTED) {
      updateData.lastClientFeedbackDate = new Date();
    }
    if (interviewDate !== undefined) {
      updateData.interviewDate = interviewDate ? new Date(interviewDate) : null;
    }
    if (interviewNotes !== undefined) {
      updateData.interviewNotes = interviewNotes;
    }

    const updatedSubmission = await prisma.submission.update({
      where: { id: existing.id },
      data: updateData,
      include: { candidate: true },
    });

    // Keep Candidate pipeline stage aligned (never downgrade a Billable consultant)
    if (existing.candidate.pipelineStage !== CandidatePipelineStage.BILLABLE) {
      const targetCandStage = CANDIDATE_STAGE_FOR_REQ[mappedStage];
      if (targetCandStage) {
        await prisma.candidate.update({
          where: { id: existing.candidateId },
          data: { pipelineStage: targetCandStage },
        });
      }
    }

    // Advance parent Requirement stage when an applicant reaches a higher active stage
    const allSubs = await prisma.submission.findMany({
      where: { requirementId: existing.requirementId },
      select: { stage: true },
    });
    const promotedStatus = computePromotedRequirementStage(
      allSubs.map((s) => s.stage),
      existing.requirement.status
    );
    if (promotedStatus) {
      await prisma.requirement.update({
        where: { id: existing.requirementId },
        data: { status: promotedStatus },
      });
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
      submission: updatedSubmission,
      requirement: refreshedRequirement,
    };
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

    if (
      removedPlacements.count > 0 &&
      activePlacementsCount < openPositions &&
      existing.requirement.status === RequirementStatus.ONBOARDING
    ) {
      const activeSubStages = remainingSubs
        .map((s) => s.stage)
        .filter((st) => st !== RequirementStatus.CLOSED && st !== RequirementStatus.ONBOARDING);
      let fallbackStatus: RequirementStatus = RequirementStatus.REQUIREMENT;
      let bestRank = -1;
      for (const st of activeSubStages) {
        const rank = STAGE_RANK[st] ?? 0;
        if (rank > bestRank) {
          bestRank = rank;
          fallbackStatus = st;
        }
      }
      await prisma.requirement.update({
        where: { id: existing.requirementId },
        data: { status: fallbackStatus },
      });
    } else if (
      remainingSubs.length === 0 &&
      activePlacementsCount === 0 &&
      existing.requirement.status === RequirementStatus.SUBMITTED
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
