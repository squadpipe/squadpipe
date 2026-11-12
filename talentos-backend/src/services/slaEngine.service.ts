import { prisma } from '../config/prisma.config';
import { SlaCategory, SlaActionType } from '@prisma/client';

export class SlaEngineService {
  async getActiveTasks() {
    return prisma.slaTask.findMany({
      where: { isDone: false },
      orderBy: { createdAt: 'desc' }
    });
  }

  async completeTask(id: string) {
    return prisma.slaTask.update({
      where: { id },
      data: { isDone: true }
    });
  }

  /**
   * Deterministic evaluation scanner: Checks database records against SLA thresholds
   * and automatically seeds or updates SLA tasks for recruiter morning queues.
   */
  async evaluateSlaRadar() {
    const generatedTasks = [];

    // 1. Scan for Stale Requirements with 0 candidate submissions
    const staleReqs = await prisma.requirement.findMany({
      where: {
        status: 'REQUIREMENT',
        submissions: { none: {} }
      },
      take: 2
    });

    for (const r of staleReqs) {
      const existing = await prisma.slaTask.findFirst({
        where: { relatedEntityId: r.id, isDone: false }
      });
      if (!existing) {
        const task = await prisma.slaTask.create({
          data: {
            category: SlaCategory.STALE_REQUIREMENT,
            slaRuleTag: 'Zero Submissions (>5d)',
            badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
            title: `${r.companyName}: ${r.opportunityTitle} Needs Sourcing`,
            description: `Open job order has 0 submittals. Target skills: ${r.skillsRequired}.`,
            meta: `Role: ${r.code} • Location: ${r.location}`,
            actionType: SlaActionType.MATCHER,
            actionLabel: 'Run Skill Matcher',
            relatedEntityType: 'requirement',
            relatedEntityId: r.id
          }
        });
        generatedTasks.push(task);
      }
    }

    // 2. Scan for Expiring Billable Placements (< 30 days)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const expiringPlacements = await prisma.placement.findMany({
      where: {
        status: 'ACTIVE',
        endDate: { lte: thirtyDaysFromNow }
      },
      take: 2
    });

    for (const b of expiringPlacements) {
      const existing = await prisma.slaTask.findFirst({
        where: { relatedEntityId: b.id, isDone: false }
      });
      if (!existing) {
        const daysRemaining = Math.ceil(
          (new Date(b.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
        );
        const task = await prisma.slaTask.create({
          data: {
            category: SlaCategory.CONTRACT_EXPIRING,
            slaRuleTag: `Contract Notice (<30d)`,
            badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
            title: `${b.resourceName}: SOW Contract Ending in ${daysRemaining} Days`,
            description: `Active deployment at ${b.customer} concludes on ${b.endDate.toISOString().split('T')[0]}. Review renewal SOW.`,
            meta: `Bill: $${b.billRate}/hr • Spread: +$${b.hourlySpread}/hr`,
            actionType: SlaActionType.BILLABLE,
            actionLabel: 'Review Billable',
            relatedEntityType: 'placement',
            relatedEntityId: b.id
          }
        });
        generatedTasks.push(task);
      }
    }

    return generatedTasks;
  }
}

export const slaEngineService = new SlaEngineService();

