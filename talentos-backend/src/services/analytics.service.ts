import { PlacementStatus, UserRole } from '@prisma/client';
import { prisma } from '../config/prisma.config';
import { normalizeStageValue } from './requirement.service';

export type PerformancePeriod = 'week' | 'month' | 'all';

export interface RecruiterPerformanceRow {
  userId: string;
  fullName: string;
  role: UserRole;
  desk: string;
  openReqs: number;
  submissions: number;
  interviews: number;
  placements: number;
}

export interface LiveUserWorkload {
  openReqs: number;
  submissions: number;
  placements: number;
  workloadText: string;
}

export function formatLiveWorkloadText(openReqs: number, submissions: number, placements: number): string {
  const reqLabel = openReqs === 1 ? 'Req' : 'Reqs';
  const subLabel = submissions === 1 ? 'Sub' : 'Subs';
  const plLabel = placements === 1 ? 'Placement' : 'Placements';
  return `${openReqs} ${reqLabel} • ${submissions} ${subLabel} • ${placements} ${plLabel}`;
}

export function getPeriodStartDate(period: PerformancePeriod, now: Date = new Date()): Date | undefined {
  if (period === 'week') {
    return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
  if (period === 'month') {
    return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
  return undefined;
}

/**
 * Pure aggregator for per-recruiter activity metrics over an optional cutoff timestamp.
 */
export function buildRecruiterPerformanceRows(params: {
  users: Array<{ id: string; fullName: string; role: UserRole; desk: string }>;
  requirements: Array<{ id: string; assignedRecruiterId: string | null; status: string }>;
  submissions: Array<{
    recruiterId: string | null;
    requirementId: string;
    stage: string;
    submissionDate: Date;
    interviewDate: Date | null;
    lastClientFeedbackDate: Date | null;
    updatedAt: Date;
  }>;
  placements: Array<{
    recruiterId: string | null;
    requirementId: string | null;
    createdAt: Date;
  }>;
  sinceDate?: Date;
}): {
  team: RecruiterPerformanceRow[];
  totals: { openReqs: number; submissions: number; interviews: number; placements: number };
} {
  const { users, requirements, submissions, placements, sinceDate } = params;
  const reqOwnerById = new Map<string, string>();
  const map = new Map<string, RecruiterPerformanceRow>();

  for (const u of users) {
    map.set(u.id, {
      userId: u.id,
      fullName: u.fullName,
      role: u.role,
      desk: u.desk,
      openReqs: 0,
      submissions: 0,
      interviews: 0,
      placements: 0,
    });
  }

  for (const r of requirements) {
    if (r.assignedRecruiterId) {
      reqOwnerById.set(r.id, r.assignedRecruiterId);
      const row = map.get(r.assignedRecruiterId);
      if (row) {
        const lower = normalizeStageValue(r.status).toLowerCase();
        if (lower !== 'archived' && lower !== 'billable') {
          row.openReqs += 1;
        }
      }
    }
  }

  for (const s of submissions) {
    const ownerId = s.recruiterId || reqOwnerById.get(s.requirementId);
    if (!ownerId) continue;
    const row = map.get(ownerId);
    if (!row) continue;

    if (!sinceDate || new Date(s.submissionDate) >= sinceDate) {
      row.submissions += 1;
    }

    const normStage = normalizeStageValue(s.stage);
    const hasInterviewMilestone =
      normStage === 'INTERVIEW' ||
      (Boolean(s.interviewDate) && normStage !== 'CLOSED') ||
      ((normStage === 'SELECTED' || normStage === 'ONBOARDING') &&
        Boolean(s.interviewDate || s.lastClientFeedbackDate));

    if (hasInterviewMilestone) {
      const activityDate = new Date(
        s.interviewDate || s.lastClientFeedbackDate || s.updatedAt || s.submissionDate
      );
      if (!sinceDate || activityDate >= sinceDate) {
        row.interviews += 1;
      }
    }
  }

  for (const p of placements) {
    const ownerId = p.recruiterId || (p.requirementId ? reqOwnerById.get(p.requirementId) : undefined);
    if (!ownerId) continue;
    const row = map.get(ownerId);
    if (!row) continue;

    if (!sinceDate || new Date(p.createdAt) >= sinceDate) {
      row.placements += 1;
    }
  }

  const team = Array.from(map.values()).sort((a, b) => {
    const scoreA = a.placements * 100 + a.interviews * 10 + a.submissions + a.openReqs;
    const scoreB = b.placements * 100 + b.interviews * 10 + b.submissions + b.openReqs;
    if (scoreB !== scoreA) return scoreB - scoreA;
    return a.fullName.localeCompare(b.fullName);
  });

  const totals = team.reduce(
    (acc, item) => ({
      openReqs: acc.openReqs + item.openReqs,
      submissions: acc.submissions + item.submissions,
      interviews: acc.interviews + item.interviews,
      placements: acc.placements + item.placements,
    }),
    { openReqs: 0, submissions: 0, interviews: 0, placements: 0 }
  );

  return { team, totals };
}

export class AnalyticsService {
  async getRecruiterPerformance(tenantId: string, periodInput?: string) {
    const period: PerformancePeriod =
      periodInput === 'month' || periodInput === 'all' ? periodInput : 'week';
    const sinceDate = getPeriodStartDate(period);

    const [users, requirements, submissions, placements] = await Promise.all([
      prisma.user.findMany({
        where: { tenantId },
        select: { id: true, fullName: true, role: true, desk: true },
        orderBy: { fullName: 'asc' },
      }),
      prisma.requirement.findMany({
        where: { tenantId },
        select: { id: true, assignedRecruiterId: true, status: true },
      }),
      prisma.submission.findMany({
        where: {
          tenantId,
          ...(sinceDate
            ? {
                OR: [
                  { submissionDate: { gte: sinceDate } },
                  { updatedAt: { gte: sinceDate } },
                  { interviewDate: { gte: sinceDate } },
                ],
              }
            : {}),
        },
        select: {
          recruiterId: true,
          requirementId: true,
          stage: true,
          submissionDate: true,
          interviewDate: true,
          lastClientFeedbackDate: true,
          updatedAt: true,
        },
      }),
      prisma.placement.findMany({
        where: {
          tenantId,
          status: { not: PlacementStatus.TERMINATED },
          ...(sinceDate ? { createdAt: { gte: sinceDate } } : {}),
        },
        select: { recruiterId: true, requirementId: true, createdAt: true },
      }),
    ]);

    const { team, totals } = buildRecruiterPerformanceRows({
      users,
      requirements,
      submissions,
      placements,
      sinceDate,
    });

    return {
      period,
      sinceDate: sinceDate ? sinceDate.toISOString() : null,
      team,
      totals,
    };
  }

  async getLiveWorkloadsMap(tenantId: string, userIds?: string[]): Promise<Map<string, LiveUserWorkload>> {
    const targetIds = userIds ? new Set(userIds) : null;
    const [requirements, submissions, placements] = await Promise.all([
      prisma.requirement.findMany({
        where: { tenantId },
        select: { id: true, assignedRecruiterId: true, status: true },
      }),
      prisma.submission.findMany({
        where: { tenantId },
        select: { recruiterId: true, requirementId: true, stage: true },
      }),
      prisma.placement.findMany({
        where: {
          tenantId,
          status: { not: PlacementStatus.TERMINATED },
        },
        select: { recruiterId: true, requirementId: true },
      }),
    ]);

    const reqOwnerById = new Map<string, string>();
    const counts = new Map<string, { openReqs: number; submissions: number; placements: number }>();

    const bump = (uid: string | null | undefined, field: 'openReqs' | 'submissions' | 'placements') => {
      if (!uid) return;
      if (targetIds && !targetIds.has(uid)) return;
      const cur = counts.get(uid) || { openReqs: 0, submissions: 0, placements: 0 };
      cur[field] += 1;
      counts.set(uid, cur);
    };

    for (const r of requirements) {
      if (r.assignedRecruiterId) {
        reqOwnerById.set(r.id, r.assignedRecruiterId);
        const lower = normalizeStageValue(r.status).toLowerCase();
        if (lower !== 'archived' && lower !== 'billable') {
          bump(r.assignedRecruiterId, 'openReqs');
        }
      }
    }

    for (const s of submissions) {
      const ownerId = s.recruiterId || reqOwnerById.get(s.requirementId);
      bump(ownerId, 'submissions');
    }

    for (const p of placements) {
      const ownerId = p.recruiterId || (p.requirementId ? reqOwnerById.get(p.requirementId) : undefined);
      bump(ownerId, 'placements');
    }

    const result = new Map<string, LiveUserWorkload>();
    if (userIds) {
      for (const uid of userIds) {
        const c = counts.get(uid) || { openReqs: 0, submissions: 0, placements: 0 };
        result.set(uid, {
          ...c,
          workloadText: formatLiveWorkloadText(c.openReqs, c.submissions, c.placements),
        });
      }
    } else {
      for (const [uid, c] of counts.entries()) {
        result.set(uid, {
          ...c,
          workloadText: formatLiveWorkloadText(c.openReqs, c.submissions, c.placements),
        });
      }
    }
    return result;
  }
}

export const analyticsService = new AnalyticsService();
