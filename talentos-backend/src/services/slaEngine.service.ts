import { prisma } from '../config/prisma.config';
import { SlaCategory, SlaActionType, AutomationCategory, AuditStatus } from '@prisma/client';

export class SlaEngineService {
  async getActiveTasks(tenantId: string) {
    return prisma.slaTask.findMany({
      where: { tenantId, isDone: false },
      orderBy: { createdAt: 'desc' },
    });
  }

  async completeTask(id: string, tenantId: string) {
    const existing = await prisma.slaTask.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new Error('SLA task not found for this tenant');

    return prisma.slaTask.update({
      where: { id: existing.id },
      data: { isDone: true },
    });
  }

  private async recordRuleExecution(
    tenantId: string,
    categories: AutomationCategory[],
    target: string,
    conditionsMet: string,
    actionDispatched: string
  ) {
    const matchingRule = await prisma.automationRule.findFirst({
      where: {
        tenantId,
        active: true,
        category: { in: categories },
      },
    });
    if (!matchingRule) return;

    await prisma.automationRule.update({
      where: { id: matchingRule.id },
      data: {
        executionsCount: { increment: 1 },
        lastFiredAt: new Date(),
      },
    });

    await prisma.automationAuditLog.create({
      data: {
        ruleId: matchingRule.id,
        ruleName: matchingRule.name,
        target,
        conditionsMet,
        actionDispatched,
        status: AuditStatus.EXECUTED,
      },
    });
  }

  /**
   * Deterministic evaluation scanner: Checks tenant-scoped database records
   * against SLA thresholds and generates Priority Action Queue alerts + audit logs.
   */
  async evaluateSlaRadar(tenantId: string) {
    const generatedTasks = [];
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    // 1. Scan for Unsourced Open Requirements (0 candidate submissions)
    const staleReqs = await prisma.requirement.findMany({
      where: {
        tenantId,
        status: 'REQUIREMENT',
        submissions: { none: {} },
      },
      take: 5,
    });

    for (const r of staleReqs) {
      const existing = await prisma.slaTask.findFirst({
        where: { tenantId, relatedEntityId: r.id, isDone: false },
      });
      if (!existing) {
        const task = await prisma.slaTask.create({
          data: {
            tenantId,
            category: SlaCategory.STALE_REQUIREMENT,
            slaRuleTag: 'Zero Submissions',
            badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
            title: `${r.companyName}: ${r.opportunityTitle} Needs Sourcing`,
            description: `Open job order has 0 submittals. Target skills: ${r.skillsRequired}.`,
            meta: `Role: ${r.code} • Location: ${r.location}`,
            actionType: SlaActionType.MATCHER,
            actionLabel: 'Run Skill Matcher',
            relatedEntityType: 'requirement',
            relatedEntityId: r.id,
          },
        });
        generatedTasks.push(task);
        await this.recordRuleExecution(
          tenantId,
          [AutomationCategory.STALE_REQ, AutomationCategory.FEEDBACK],
          task.title,
          `Requirement ${r.code} has 0 submissions`,
          task.description
        );
      }
    }

    // 2. Scan for Submissions Awaiting Client Feedback
    const submittedReqs = await prisma.requirement.findMany({
      where: {
        tenantId,
        status: 'SUBMITTED',
      },
      take: 5,
    });

    for (const r of submittedReqs) {
      const existing = await prisma.slaTask.findFirst({
        where: { tenantId, relatedEntityId: r.id, isDone: false },
      });
      if (!existing) {
        const task = await prisma.slaTask.create({
          data: {
            tenantId,
            category: SlaCategory.AWAITING_FEEDBACK,
            slaRuleTag: 'Awaiting Feedback',
            badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
            title: `${r.companyName}: Client Feedback Due (${r.opportunityTitle})`,
            description: `Requirement ${r.code} is in Submitted stage awaiting client review.`,
            meta: `Role: ${r.code} • Location: ${r.location}`,
            actionType: SlaActionType.PITCH,
            actionLabel: 'Follow Up Client',
            relatedEntityType: 'requirement',
            relatedEntityId: r.id,
          },
        });
        generatedTasks.push(task);
        await this.recordRuleExecution(
          tenantId,
          [AutomationCategory.FEEDBACK],
          task.title,
          `Requirement ${r.code} is in SUBMITTED stage`,
          task.description
        );
      }
    }

    // 3. Scan for Active Interviews
    const interviewReqs = await prisma.requirement.findMany({
      where: {
        tenantId,
        status: 'INTERVIEW',
      },
      take: 5,
    });

    for (const r of interviewReqs) {
      const existing = await prisma.slaTask.findFirst({
        where: { tenantId, relatedEntityId: r.id, isDone: false },
      });
      if (!existing) {
        const task = await prisma.slaTask.create({
          data: {
            tenantId,
            category: SlaCategory.INTERVIEW_TODAY,
            slaRuleTag: 'Active Interview',
            badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
            title: `${r.companyName}: Interview Prep (${r.opportunityTitle})`,
            description: `Active interview round on ${r.code}. Confirm candidate briefing & debrief check.`,
            meta: `Role: ${r.code} • Location: ${r.location}`,
            actionType: SlaActionType.PIPELINE,
            actionLabel: 'Prep Candidate',
            relatedEntityType: 'requirement',
            relatedEntityId: r.id,
          },
        });
        generatedTasks.push(task);
        await this.recordRuleExecution(
          tenantId,
          [AutomationCategory.INTERVIEW],
          task.title,
          `Requirement ${r.code} is in INTERVIEW stage`,
          task.description
        );
      }
    }

    // 4. Scan for Expiring Billable Placements (< 30 days)
    const expiringPlacements = await prisma.placement.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
        endDate: { lte: thirtyDaysFromNow },
      },
      take: 5,
    });

    for (const b of expiringPlacements) {
      const existing = await prisma.slaTask.findFirst({
        where: { tenantId, relatedEntityId: b.id, isDone: false },
      });
      if (!existing) {
        const daysRemaining = Math.ceil(
          (new Date(b.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
        );
        const task = await prisma.slaTask.create({
          data: {
            tenantId,
            category: SlaCategory.CONTRACT_EXPIRING,
            slaRuleTag: 'Contract Notice (<30d)',
            badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
            title: `${b.resourceName}: SOW Contract Ending in ${daysRemaining} Days`,
            description: `Active deployment at ${b.customer} concludes on ${b.endDate.toISOString().split('T')[0]}. Review renewal SOW.`,
            meta: `Bill: $${b.billRate}/hr • Spread: +$${b.hourlySpread}/hr`,
            actionType: SlaActionType.BILLABLE,
            actionLabel: 'Review Billable',
            relatedEntityType: 'placement',
            relatedEntityId: b.id,
          },
        });
        generatedTasks.push(task);
        await this.recordRuleExecution(
          tenantId,
          [AutomationCategory.CONTRACT],
          task.title,
          `Placement at ${b.customer} ends in ${daysRemaining} days`,
          task.description
        );
      }
    }

    // 5. Scan for Vendor Compliance Issues (Unsigned MSA or Expiring COI < 30 days)
    const complianceVendors = await prisma.vendor.findMany({
      where: {
        tenantId,
        OR: [{ msaSigned: false }, { coiExpiryDate: { lte: thirtyDaysFromNow } }],
      },
      take: 5,
    });

    for (const v of complianceVendors) {
      const existing = await prisma.slaTask.findFirst({
        where: { tenantId, relatedEntityId: v.id, isDone: false },
      });
      if (!existing) {
        const issueLabel = !v.msaSigned ? 'Unsigned MSA' : 'COI Expiring (<30d)';
        const task = await prisma.slaTask.create({
          data: {
            tenantId,
            category: SlaCategory.COMPLIANCE_ALERT,
            slaRuleTag: issueLabel,
            badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            title: `${v.name}: Vendor Compliance Alert (${issueLabel})`,
            description: `Sub-tier vendor ${v.name} (${v.contactName}) requires compliance verification.`,
            meta: `Terms: ${v.paymentTerms} • Email: ${v.email}`,
            actionType: SlaActionType.CHECKLIST,
            actionLabel: 'Review Vendor',
            relatedEntityType: 'vendor',
            relatedEntityId: v.id,
          },
        });
        generatedTasks.push(task);
        await this.recordRuleExecution(
          tenantId,
          [AutomationCategory.COMPLIANCE],
          task.title,
          `Vendor ${v.name}: ${issueLabel}`,
          task.description
        );
      }
    }

    return generatedTasks;
  }
}

export const slaEngineService = new SlaEngineService();

