import { prisma } from '../config/prisma.config';
import { AuditStatus, AutomationCategory, Prisma, TriggerEvent } from '@prisma/client';

export const DEFAULT_TENANT_RULES: Array<{
  name: string;
  category: AutomationCategory;
  triggerEvent: TriggerEvent;
  icon: string;
  color: string;
  threshold: string;
  whenText: string;
  thenSummary: string;
  actions: Array<{ label: string; icon: string; color: string }>;
}> = [
  {
    name: 'Client Feedback Reminder',
    category: AutomationCategory.FEEDBACK,
    triggerEvent: TriggerEvent.FEEDBACK_DELAYED,
    icon: 'fa-solid fa-comments',
    color: 'amber',
    threshold: '2 Days (48h)',
    whenText: 'Client has not replied after',
    thenSummary: 'Add a follow-up reminder to your Action Center',
    actions: [
      { label: 'Follow-Up Reminder', icon: 'fa-solid fa-bell', color: 'blue' },
      { label: 'Client Check-In', icon: 'fa-solid fa-envelope', color: 'emerald' },
    ],
  },
  {
    name: 'Jobs Without Applicants',
    category: AutomationCategory.STALE_REQ,
    triggerEvent: TriggerEvent.STALE_REQ,
    icon: 'fa-solid fa-briefcase',
    color: 'rose',
    threshold: '24 Hours',
    whenText: 'Open job has no applicants for',
    thenSummary: 'Add a reminder to your Action Center',
    actions: [
      { label: 'Missing Applicants Alert', icon: 'fa-solid fa-bell', color: 'rose' },
      { label: 'Match Candidates', icon: 'fa-solid fa-wand-magic-sparkles', color: 'amber' },
    ],
  },
  {
    name: 'Interview Prep Reminder',
    category: AutomationCategory.INTERVIEW,
    triggerEvent: TriggerEvent.INTERVIEW_TODAY,
    icon: 'fa-solid fa-calendar-check',
    color: 'blue',
    threshold: 'Today',
    whenText: 'Candidate reaches Interview stage',
    thenSummary: 'Add an interview prep reminder to your Action Center',
    actions: [
      { label: 'Interview Prep', icon: 'fa-solid fa-clipboard-check', color: 'blue' },
      { label: 'Feedback Reminder', icon: 'fa-solid fa-bell', color: 'emerald' },
    ],
  },
  {
    name: 'Contract Ending Soon',
    category: AutomationCategory.CONTRACT,
    triggerEvent: TriggerEvent.CONTRACT_ENDING,
    icon: 'fa-solid fa-file-contract',
    color: 'purple',
    threshold: '30 Days to Expiry',
    whenText: 'Active contract ends within',
    thenSummary: 'Add a renewal reminder to your Action Center',
    actions: [
      { label: 'Renewal Reminder', icon: 'fa-solid fa-bell', color: 'purple' },
      { label: 'Plan Extension', icon: 'fa-solid fa-file-lines', color: 'blue' },
    ],
  },
  {
    name: 'Vendor COI & MSA Compliance Check',
    category: AutomationCategory.COMPLIANCE,
    triggerEvent: TriggerEvent.VISA_EXPIRING,
    icon: 'fa-solid fa-shield-halved',
    color: 'emerald',
    threshold: '30 Days',
    whenText: 'Sub-tier vendor MSA is unsigned or COI expires within',
    thenSummary: 'Flag vendor compliance alert in Priority Action Queue',
    actions: [
      { label: 'Compliance Queue Flag', icon: 'fa-solid fa-certificate', color: 'emerald' },
      { label: 'Account Lead Notice', icon: 'fa-solid fa-paper-plane', color: 'blue' },
    ],
  },
];

export class AutomationEngineService {
  async getRules(tenantId: string) {
    return prisma.automationRule.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAuditLogs(tenantId: string, params: { search?: string; page?: number; limit?: number } = {}) {
    const where: Prisma.AutomationAuditLogWhereInput = {
      rule: { tenantId },
    };

    const q = params.search ? String(params.search).trim() : '';
    if (q) {
      where.OR = [
        { ruleName: { contains: q, mode: 'insensitive' } },
        { target: { contains: q, mode: 'insensitive' } },
        { actionDispatched: { contains: q, mode: 'insensitive' } },
      ];
    }

    const hasPagination = params.page !== undefined || params.limit !== undefined;
    if (!hasPagination) {
      const data = await prisma.automationAuditLog.findMany({
        where,
        take: 50,
        orderBy: { createdAt: 'desc' },
      });
      return {
        data,
        pagination: { page: 1, limit: data.length || 10, total: data.length, totalPages: 1 },
      };
    }

    const page = params.page ? Math.max(1, params.page) : 1;
    const limit = params.limit ? Math.max(1, Math.min(100, params.limit)) : 10;
    const [total, data] = await Promise.all([
      prisma.automationAuditLog.count({ where }),
      prisma.automationAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async testTriggerRule(ruleId: string, tenantId: string) {
    const rule = await prisma.automationRule.findFirst({
      where: { id: ruleId, tenantId },
    });
    if (!rule) throw new Error('Rule not found for this tenant');

    const updatedRule = await prisma.automationRule.update({
      where: { id: rule.id },
      data: {
        executionsCount: { increment: 1 },
        lastFiredAt: new Date(),
      },
    });

    const auditEntry = await prisma.automationAuditLog.create({
      data: {
        ruleId: rule.id,
        ruleName: rule.name,
        target: 'Manual Test Execution',
        conditionsMet: `Trigger: ${rule.triggerEvent} (Threshold: ${rule.threshold})`,
        actionDispatched: rule.thenSummary,
        status: AuditStatus.EXECUTED,
      },
    });

    return { rule: updatedRule, auditLog: auditEntry };
  }

  async recordLifecycleEvent(params: {
    tenantId: string;
    preferredCategories?: AutomationCategory[];
    ruleName: string;
    target: string;
    conditionsMet: string;
    actionDispatched: string;
    status?: AuditStatus;
    incrementRuleCounter?: boolean;
    requireActiveRule?: boolean;
  }) {
    const {
      tenantId,
      preferredCategories = [],
      ruleName,
      target,
      conditionsMet,
      actionDispatched,
      status = AuditStatus.EXECUTED,
      incrementRuleCounter = false,
      requireActiveRule = false,
    } = params;

    const matchingActiveRule =
      preferredCategories.length > 0
        ? await prisma.automationRule.findFirst({
            where: {
              tenantId,
              active: true,
              category: { in: preferredCategories },
            },
            orderBy: { createdAt: 'asc' },
          })
        : null;

    if (requireActiveRule && !matchingActiveRule) {
      return null;
    }

    const fallbackRule =
      matchingActiveRule ||
      (await prisma.automationRule.findFirst({
        where: { tenantId },
        orderBy: { createdAt: 'asc' },
      }));

    if (matchingActiveRule && incrementRuleCounter) {
      await prisma.automationRule.update({
        where: { id: matchingActiveRule.id },
        data: {
          executionsCount: { increment: 1 },
          lastFiredAt: new Date(),
        },
      });
    }

    return prisma.automationAuditLog.create({
      data: {
        ruleId: fallbackRule?.id ?? null,
        ruleName: matchingActiveRule && incrementRuleCounter ? matchingActiveRule.name : ruleName,
        target,
        conditionsMet,
        actionDispatched,
        status,
      },
    });
  }

  async seedDefaultRulesForTenant(tenantId: string, userId?: string) {
    const existing = await prisma.automationRule.findMany({
      where: { tenantId },
      select: { name: true },
    });
    const existingNames = new Set(existing.map((r) => r.name));
    const missing = DEFAULT_TENANT_RULES.filter((r) => !existingNames.has(r.name));

    const created = [];
    for (const template of missing) {
      const rule = await prisma.automationRule.create({
        data: {
          tenantId,
          name: template.name,
          category: template.category,
          triggerEvent: template.triggerEvent,
          icon: template.icon,
          color: template.color,
          threshold: template.threshold,
          whenText: template.whenText,
          thenSummary: template.thenSummary,
          actions: template.actions,
          createdById: userId,
          active: true,
        },
      });
      created.push(rule);
    }

    return prisma.automationRule.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }
}

export const automationEngineService = new AutomationEngineService();

