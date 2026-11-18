import { prisma } from '../config/prisma.config';
import {
  Prisma,
  SlaCategory,
  SlaActionType,
  AutomationCategory,
  TriggerEvent,
  AuditStatus,
  AutomationRule,
} from '@prisma/client';
import { aiUsageService } from './ai/aiUsage.service';
import { slaAgentService } from './ai/slaAgent.service';

export class SlaEngineService {
  /**
   * Fetch pending (and optionally recently completed) SLA tasks for a tenant.
   */
  async getActiveTasks(tenantId: string, includeCompleted = false) {
    if (!includeCompleted) {
      return prisma.slaTask.findMany({
        where: { tenantId, isDone: false },
        orderBy: { createdAt: 'desc' },
      });
    }

    const [pending, completed] = await Promise.all([
      prisma.slaTask.findMany({
        where: { tenantId, isDone: false },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.slaTask.findMany({
        where: { tenantId, isDone: true },
        orderBy: { updatedAt: 'desc' },
        take: 25,
      }),
    ]);

    return [...pending, ...completed];
  }

  /**
   * Toggle or set completion status on an SLA task scoped to tenantId.
   */
  async completeTask(id: string, tenantId: string, done?: boolean) {
    const existing = await prisma.slaTask.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new Error('SLA task not found for this tenant');

    return prisma.slaTask.update({
      where: { id: existing.id },
      data: { isDone: typeof done === 'boolean' ? done : !existing.isDone },
    });
  }

  /**
   * Mark matching open SLA tasks done when an underlying CRM entity changes state or is removed.
   */
  async resolveTasksForEntity(
    tenantId: string,
    relatedEntityType: 'requirement' | 'placement' | 'vendor',
    relatedEntityId: string,
    categories?: SlaCategory[]
  ) {
    return prisma.slaTask.updateMany({
      where: {
        tenantId,
        relatedEntityType,
        relatedEntityId,
        isDone: false,
        ...(categories && categories.length > 0 ? { category: { in: categories } } : {}),
      },
      data: { isDone: true },
    });
  }

  private parseThresholdHours(threshold?: string | null, fallbackHours = 0): number {
    const raw = String(threshold || '').trim().toLowerCase();
    if (!raw || raw.includes('immediate') || raw === 'today') return 0;

    const hoursMatch = raw.match(/(\d+)\s*(?:hours?|hrs?|h\b)/i);
    if (hoursMatch) return parseInt(hoursMatch[1], 10);

    const daysMatch = raw.match(/(\d+)\s*(?:days?|d\b)/i);
    if (daysMatch) return parseInt(daysMatch[1], 10) * 24;

    const numMatch = raw.match(/(\d+)/);
    if (numMatch) return parseInt(numMatch[1], 10) * 24;

    return fallbackHours;
  }

  private parseThresholdDays(threshold?: string | null, fallbackDays = 30): number {
    const raw = String(threshold || '').trim().toLowerCase();
    if (!raw || raw.includes('immediate')) return fallbackDays;
    if (raw === 'today') return 1;

    const daysMatch = raw.match(/(\d+)\s*(?:days?|d\b)/i);
    if (daysMatch) return Math.max(1, parseInt(daysMatch[1], 10));

    const hoursMatch = raw.match(/(\d+)\s*(?:hours?|hrs?|h\b)/i);
    if (hoursMatch) return Math.max(1, Math.ceil(parseInt(hoursMatch[1], 10) / 24));

    const numMatch = raw.match(/(\d+)/);
    if (numMatch) return Math.max(1, parseInt(numMatch[1], 10));

    return fallbackDays;
  }

  private filterMatchingRules(
    allRules: AutomationRule[],
    categories: AutomationCategory[],
    triggerEvents: TriggerEvent[]
  ): AutomationRule[] {
    return allRules.filter(
      (r) =>
        categories.includes(r.category) || triggerEvents.includes(r.triggerEvent)
    );
  }

  private async recordRuleExecutionForMatches(
    matchingActiveRules: AutomationRule[],
    target: string,
    conditionsMet: string,
    actionDispatched: string
  ) {
    for (const rule of matchingActiveRules) {
      await prisma.automationRule.update({
        where: { id: rule.id },
        data: {
          executionsCount: { increment: 1 },
          lastFiredAt: new Date(),
        },
      });

      await prisma.automationAuditLog.create({
        data: {
          ruleId: rule.id,
          ruleName: rule.name,
          target,
          conditionsMet,
          actionDispatched,
          status: AuditStatus.EXECUTED,
        },
      });
    }
  }

  /**
   * Auto-resolve open SLA tasks whose underlying entity was deleted or has progressed past the alert condition.
   */
  async reconcileOpenTasks(tenantId: string) {
    const openTasks = await prisma.slaTask.findMany({
      where: { tenantId, isDone: false },
    });
    if (openTasks.length === 0) return 0;

    const reqIds = openTasks
      .filter((t) => t.relatedEntityType === 'requirement' && t.relatedEntityId)
      .map((t) => t.relatedEntityId as string);
    const placementIds = openTasks
      .filter((t) => t.relatedEntityType === 'placement' && t.relatedEntityId)
      .map((t) => t.relatedEntityId as string);
    const vendorIds = openTasks
      .filter((t) => t.relatedEntityType === 'vendor' && t.relatedEntityId)
      .map((t) => t.relatedEntityId as string);

    const [reqs, placements, vendors] = await Promise.all([
      reqIds.length > 0
        ? prisma.requirement.findMany({
            where: { id: { in: reqIds }, tenantId },
            select: { id: true, status: true, _count: { select: { submissions: true } } },
          })
        : Promise.resolve([]),
      placementIds.length > 0
        ? prisma.placement.findMany({
            where: { id: { in: placementIds }, tenantId },
            select: { id: true, status: true, endDate: true },
          })
        : Promise.resolve([]),
      vendorIds.length > 0
        ? prisma.vendor.findMany({
            where: { id: { in: vendorIds }, tenantId },
            select: { id: true, msaSigned: true, coiExpiryDate: true },
          })
        : Promise.resolve([]),
    ]);

    const reqMap = new Map(reqs.map((r) => [r.id, r]));
    const placementMap = new Map(placements.map((p) => [p.id, p]));
    const vendorMap = new Map(vendors.map((v) => [v.id, v]));
    const complianceSafeDate = new Date();
    complianceSafeDate.setDate(complianceSafeDate.getDate() + 30);

    const tenantContractRules = await prisma.automationRule.findMany({
      where: {
        tenantId,
        active: true,
        OR: [{ category: AutomationCategory.CONTRACT }, { triggerEvent: TriggerEvent.CONTRACT_ENDING }],
      },
    });
    const maxContractDays =
      tenantContractRules.length > 0
        ? Math.max(...tenantContractRules.map((r) => this.parseThresholdDays(r.threshold, 30)))
        : 30;
    const contractSafeDate = new Date();
    contractSafeDate.setDate(contractSafeDate.getDate() + maxContractDays);

    const idsToResolve: string[] = [];

    for (const task of openTasks) {
      const entityId = task.relatedEntityId;
      if (!entityId) continue;

      if (task.relatedEntityType === 'requirement') {
        const req = reqMap.get(entityId);
        if (!req) {
          idsToResolve.push(task.id);
          continue;
        }
        if (
          task.category === SlaCategory.STALE_REQUIREMENT &&
          (req.status !== 'REQUIREMENT' || req._count.submissions > 0)
        ) {
          idsToResolve.push(task.id);
        } else if (
          task.category === SlaCategory.AWAITING_FEEDBACK &&
          req.status !== 'SUBMITTED'
        ) {
          idsToResolve.push(task.id);
        } else if (
          task.category === SlaCategory.INTERVIEW_TODAY &&
          req.status !== 'INTERVIEW'
        ) {
          idsToResolve.push(task.id);
        }
      } else if (task.relatedEntityType === 'placement') {
        const placement = placementMap.get(entityId);
        if (!placement) {
          idsToResolve.push(task.id);
          continue;
        }
        if (
          placement.status === 'COMPLETED' ||
          placement.status === 'TERMINATED' ||
          placement.status === 'EXTENDED' ||
          new Date(placement.endDate) > contractSafeDate
        ) {
          idsToResolve.push(task.id);
        }
      } else if (task.relatedEntityType === 'vendor') {
        const vendor = vendorMap.get(entityId);
        if (!vendor) {
          idsToResolve.push(task.id);
          continue;
        }
        const coiOk =
          !vendor.coiExpiryDate || new Date(vendor.coiExpiryDate) > complianceSafeDate;
        if (vendor.msaSigned && coiOk) {
          idsToResolve.push(task.id);
        }
      }
    }

    if (idsToResolve.length > 0) {
      await prisma.slaTask.updateMany({
        where: { id: { in: idsToResolve }, tenantId },
        data: { isDone: true },
      });
    }

    return idsToResolve.length;
  }

  /**
   * Evaluate vendor COI & MSA compliance rules for a specific tenant.
   */
  async evaluateVendorComplianceForTenant(tenantId: string, fallbackDays = 30) {
    const tenantRules = await prisma.automationRule.findMany({ where: { tenantId } });
    const complianceRules = this.filterMatchingRules(
      tenantRules,
      [AutomationCategory.COMPLIANCE],
      [TriggerEvent.VISA_EXPIRING]
    );
    const activeComplianceRules = complianceRules.filter((r) => r.active);
    if (activeComplianceRules.length === 0) return [];

    const maxWindowDays = Math.max(
      ...activeComplianceRules.map((r) => this.parseThresholdDays(r.threshold, fallbackDays))
    );
    const windowDate = new Date();
    windowDate.setDate(windowDate.getDate() + maxWindowDays);

    const complianceVendors = await prisma.vendor.findMany({
      where: {
        tenantId,
        OR: [{ msaSigned: false }, { coiExpiryDate: { lte: windowDate } }],
      },
      take: 50,
    });

    const createdTasks = [];
    for (const v of complianceVendors) {
      const triggeredRules = activeComplianceRules.filter((r) => {
        if (!v.msaSigned) return true;
        if (!v.coiExpiryDate) return false;
        const ruleDays = this.parseThresholdDays(r.threshold, fallbackDays);
        const ruleCutoff = new Date();
        ruleCutoff.setDate(ruleCutoff.getDate() + ruleDays);
        return new Date(v.coiExpiryDate) <= ruleCutoff;
      });
      if (triggeredRules.length === 0) continue;

      const existing = await prisma.slaTask.findFirst({
        where: {
          tenantId,
          category: SlaCategory.COMPLIANCE_ALERT,
          relatedEntityType: 'vendor',
          relatedEntityId: v.id,
          isDone: false,
        },
      });
      if (!existing) {
        const minRuleDays = Math.min(
          ...triggeredRules.map((r) => this.parseThresholdDays(r.threshold, fallbackDays))
        );
        const issueLabel = !v.msaSigned ? 'Agreement Pending' : `Insurance Expiring (<${minRuleDays}d)`;
        const task = await prisma.slaTask.create({
          data: {
            tenantId,
            category: SlaCategory.COMPLIANCE_ALERT,
            slaRuleTag: issueLabel,
            badgeClass: 'bg-emerald-500/[0.08] text-emerald-800 border-transparent',
            title: `${v.name}: Vendor check needed (${issueLabel})`,
            description: `Partner vendor ${v.name} (${v.contactName}) needs agreement or insurance verification.`,
            meta: `Terms: ${v.paymentTerms} • Email: ${v.email}`,
            actionType: SlaActionType.CHECKLIST,
            actionLabel: 'Review Vendor',
            relatedEntityType: 'vendor',
            relatedEntityId: v.id,
          },
        });
        createdTasks.push(task);
        await this.recordRuleExecutionForMatches(
          triggeredRules,
          task.title,
          `Vendor ${v.name}: ${issueLabel}`,
          task.description
        );
      }
    }

    return createdTasks;
  }

  /**
   * Deterministic evaluation scanner: Reconciles resolved tasks, then checks tenant-scoped
   * database records against active AutomationRules and their thresholds.
   */
  async evaluateSlaRadar(tenantId: string) {
    await this.reconcileOpenTasks(tenantId);

    const generatedTasks = [];
    const now = new Date();
    const [tenantRules, aiCaps] = await Promise.all([
      prisma.automationRule.findMany({ where: { tenantId } }),
      aiUsageService.getEffectivePublicAiCapabilities(tenantId).catch(() => null),
    ]);
    const agentActive = Boolean(aiCaps?.enabled && aiCaps?.features?.actionCenterAgent);

    // 1. Scan for Unsourced Open Requirements (0 candidate submissions)
    const staleActiveRules = this.filterMatchingRules(
      tenantRules,
      [AutomationCategory.STALE_REQ],
      [TriggerEvent.STALE_REQ]
    ).filter((r) => r.active);

    if (staleActiveRules.length > 0) {
      const minStaleHours = Math.min(
        ...staleActiveRules.map((r) => this.parseThresholdHours(r.threshold, 24))
      );
      const staleCutoff = new Date(now.getTime() - minStaleHours * 60 * 60 * 1000);

      const staleReqs = await prisma.requirement.findMany({
        where: {
          tenantId,
          status: 'REQUIREMENT',
          submissions: { none: {} },
          ...(minStaleHours > 0 ? { createdAt: { lte: staleCutoff } } : {}),
        },
        take: 50,
      });

      for (const r of staleReqs) {
        const ageHours = (now.getTime() - new Date(r.createdAt).getTime()) / (1000 * 60 * 60);
        const triggeredRules = staleActiveRules.filter(
          (rule) => ageHours >= this.parseThresholdHours(rule.threshold, 24)
        );
        if (triggeredRules.length === 0) continue;

        const existing = await prisma.slaTask.findFirst({
          where: {
            tenantId,
            category: SlaCategory.STALE_REQUIREMENT,
            relatedEntityType: 'requirement',
            relatedEntityId: r.id,
            isDone: false,
          },
        });
        if (!existing) {
          const agentPayload = agentActive
            ? await slaAgentService.prepareStaleReqPayload(r, tenantId).catch(() => null)
            : null;
          const task = await prisma.slaTask.create({
            data: {
              tenantId,
              category: SlaCategory.STALE_REQUIREMENT,
              slaRuleTag: 'No Applicants',
              badgeClass: 'bg-rose-500/[0.08] text-rose-700 border-transparent',
              title: `${r.companyName}: ${r.opportunityTitle} needs candidates`,
              description: `No candidates attached yet. Skills needed: ${r.skillsRequired}.`,
              meta: `Role: ${r.code} • Location: ${r.location}`,
              actionType: SlaActionType.MATCHER,
              actionLabel: 'Find Candidates',
              relatedEntityType: 'requirement',
              relatedEntityId: r.id,
              ...(agentPayload
                ? { agentPayload: agentPayload as unknown as Prisma.InputJsonValue }
                : {}),
            },
          });
          generatedTasks.push(task);
          await this.recordRuleExecutionForMatches(
            triggeredRules,
            task.title,
            `Requirement ${r.code} has 0 submissions (${Math.floor(ageHours)}h open)`,
            task.description
          );
        }
      }
    }

    // 2. Scan for Submissions Awaiting Client Feedback
    const feedbackActiveRules = this.filterMatchingRules(
      tenantRules,
      [AutomationCategory.FEEDBACK],
      [TriggerEvent.FEEDBACK_DELAYED]
    ).filter((r) => r.active);

    if (feedbackActiveRules.length > 0) {
      const minFeedbackHours = Math.min(
        ...feedbackActiveRules.map((r) => this.parseThresholdHours(r.threshold, 48))
      );
      const feedbackCutoff = new Date(now.getTime() - minFeedbackHours * 60 * 60 * 1000);

      const submittedReqs = await prisma.requirement.findMany({
        where: {
          tenantId,
          status: 'SUBMITTED',
          ...(minFeedbackHours > 0 ? { updatedAt: { lte: feedbackCutoff } } : {}),
        },
        take: 50,
      });

      for (const r of submittedReqs) {
        const ageHours = (now.getTime() - new Date(r.updatedAt).getTime()) / (1000 * 60 * 60);
        const triggeredRules = feedbackActiveRules.filter(
          (rule) => ageHours >= this.parseThresholdHours(rule.threshold, 48)
        );
        if (triggeredRules.length === 0) continue;

        const existing = await prisma.slaTask.findFirst({
          where: {
            tenantId,
            category: SlaCategory.AWAITING_FEEDBACK,
            relatedEntityType: 'requirement',
            relatedEntityId: r.id,
            isDone: false,
          },
        });
        if (!existing) {
          const agentPayload = agentActive
            ? await slaAgentService
                .prepareAwaitingFeedbackPayload(r, tenantId)
                .catch(() => null)
            : null;
          const task = await prisma.slaTask.create({
            data: {
              tenantId,
              category: SlaCategory.AWAITING_FEEDBACK,
              slaRuleTag: 'Waiting on Client',
              badgeClass: 'bg-amber-500/[0.08] text-amber-800 border-transparent',
              title: `${r.companyName}: Follow up on ${r.opportunityTitle}`,
              description: `Candidates were submitted for ${r.code} and are waiting for a client reply.`,
              meta: `Role: ${r.code} • Location: ${r.location}`,
              actionType: SlaActionType.PIPELINE,
              actionLabel: 'Open Requirement',
              relatedEntityType: 'requirement',
              relatedEntityId: r.id,
              ...(agentPayload
                ? { agentPayload: agentPayload as unknown as Prisma.InputJsonValue }
                : {}),
            },
          });
          generatedTasks.push(task);
          await this.recordRuleExecutionForMatches(
            triggeredRules,
            task.title,
            `Requirement ${r.code} is in SUBMITTED stage (${Math.floor(ageHours)}h awaiting feedback)`,
            task.description
          );
        }
      }
    }

    // 3. Scan for Active Interviews
    const interviewActiveRules = this.filterMatchingRules(
      tenantRules,
      [AutomationCategory.INTERVIEW],
      [TriggerEvent.INTERVIEW_TODAY]
    ).filter((r) => r.active);

    if (interviewActiveRules.length > 0) {
      const minInterviewHours = Math.min(
        ...interviewActiveRules.map((r) => this.parseThresholdHours(r.threshold, 0))
      );
      const interviewCutoff = new Date(now.getTime() - minInterviewHours * 60 * 60 * 1000);

      const interviewReqs = await prisma.requirement.findMany({
        where: {
          tenantId,
          status: 'INTERVIEW',
          ...(minInterviewHours > 0 ? { updatedAt: { lte: interviewCutoff } } : {}),
        },
        take: 50,
      });

      for (const r of interviewReqs) {
        const ageHours = (now.getTime() - new Date(r.updatedAt).getTime()) / (1000 * 60 * 60);
        const triggeredRules = interviewActiveRules.filter(
          (rule) => ageHours >= this.parseThresholdHours(rule.threshold, 0)
        );
        if (triggeredRules.length === 0) continue;

        const existing = await prisma.slaTask.findFirst({
          where: {
            tenantId,
            category: SlaCategory.INTERVIEW_TODAY,
            relatedEntityType: 'requirement',
            relatedEntityId: r.id,
            isDone: false,
          },
        });
        if (!existing) {
          const task = await prisma.slaTask.create({
            data: {
              tenantId,
              category: SlaCategory.INTERVIEW_TODAY,
              slaRuleTag: 'Interview Prep',
              badgeClass: 'bg-brand-500/[0.08] text-brand-800 border-transparent',
              title: `${r.companyName}: Interview prep for ${r.opportunityTitle}`,
              description: `Interview active for ${r.code}. Prepare the candidate and follow up on feedback.`,
              meta: `Role: ${r.code} • Location: ${r.location}`,
              actionType: SlaActionType.PIPELINE,
              actionLabel: 'Open Interview',
              relatedEntityType: 'requirement',
              relatedEntityId: r.id,
            },
          });
          generatedTasks.push(task);
          await this.recordRuleExecutionForMatches(
            triggeredRules,
            task.title,
            `Requirement ${r.code} is in INTERVIEW stage`,
            task.description
          );
        }
      }
    }

    // 4. Scan for Expiring Billable Placements
    const contractActiveRules = this.filterMatchingRules(
      tenantRules,
      [AutomationCategory.CONTRACT],
      [TriggerEvent.CONTRACT_ENDING]
    ).filter((r) => r.active);

    if (contractActiveRules.length > 0) {
      const maxContractDays = Math.max(
        ...contractActiveRules.map((r) => this.parseThresholdDays(r.threshold, 30))
      );
      const contractWindowDate = new Date();
      contractWindowDate.setDate(contractWindowDate.getDate() + maxContractDays);

      const expiringPlacements = await prisma.placement.findMany({
        where: {
          tenantId,
          status: { in: ['ACTIVE', 'EXPIRING_SOON'] },
          endDate: { lte: contractWindowDate },
        },
        take: 50,
      });

      for (const b of expiringPlacements) {
        const daysRemaining = Math.ceil(
          (new Date(b.endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );
        const triggeredRules = contractActiveRules.filter(
          (rule) => daysRemaining <= this.parseThresholdDays(rule.threshold, 30)
        );
        if (triggeredRules.length === 0) continue;

        const existing = await prisma.slaTask.findFirst({
          where: {
            tenantId,
            category: SlaCategory.CONTRACT_EXPIRING,
            relatedEntityType: 'placement',
            relatedEntityId: b.id,
            isDone: false,
          },
        });
        if (!existing) {
          const minWindowDays = Math.min(
            ...triggeredRules.map((r) => this.parseThresholdDays(r.threshold, 30))
          );
          const agentPayload = agentActive
            ? await slaAgentService
                .prepareContractExpiringPayload(b, tenantId)
                .catch(() => null)
            : null;
          const task = await prisma.slaTask.create({
            data: {
              tenantId,
              category: SlaCategory.CONTRACT_EXPIRING,
              slaRuleTag: `Ending Soon (<${minWindowDays}d)`,
              badgeClass: 'bg-amber-500/[0.08] text-amber-800 border-transparent',
              title:
                daysRemaining <= 0
                  ? `${b.resourceName}: Contract ended (${Math.abs(daysRemaining)}d ago)`
                  : `${b.resourceName}: Contract ends in ${daysRemaining} days`,
              description: `Placement at ${b.customer} ends on ${b.endDate.toISOString().split('T')[0]}. Review extension or renewal.`,
              meta: `Bill: $${b.billRate}/hr • Spread: +$${b.hourlySpread}/hr`,
              actionType: SlaActionType.BILLABLE,
              actionLabel: 'View Placement',
              relatedEntityType: 'placement',
              relatedEntityId: b.id,
              ...(agentPayload
                ? { agentPayload: agentPayload as unknown as Prisma.InputJsonValue }
                : {}),
            },
          });
          generatedTasks.push(task);
          await this.recordRuleExecutionForMatches(
            triggeredRules,
            task.title,
            `Placement at ${b.customer} ends in ${daysRemaining} days`,
            task.description
          );
        }
      }
    }

    // 5. Scan for Vendor Compliance Issues (Unsigned MSA or Expiring COI)
    const vendorTasks = await this.evaluateVendorComplianceForTenant(tenantId, 30);
    generatedTasks.push(...vendorTasks);

    return generatedTasks;
  }
}

export const slaEngineService = new SlaEngineService();

