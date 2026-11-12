import { prisma } from '../config/prisma.config';
import { AuditStatus } from '@prisma/client';

export class AutomationEngineService {
  async getRules() {
    return prisma.automationRule.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  async getAuditLogs(limit = 50) {
    return prisma.automationAuditLog.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' }
    });
  }

  async testTriggerRule(ruleId: string) {
    const rule = await prisma.automationRule.findUnique({ where: { id: ruleId } });
    if (!rule) throw new Error('Rule not found');

    // Increment execution count and log test event
    await prisma.automationRule.update({
      where: { id: ruleId },
      data: {
        executionsCount: { increment: 1 },
        lastFiredAt: new Date()
      }
    });

    const auditEntry = await prisma.automationAuditLog.create({
      data: {
        ruleId: rule.id,
        ruleName: rule.name,
        target: 'Manual Test Execution',
        conditionsMet: `Trigger: ${rule.triggerEvent} (Threshold: ${rule.threshold})`,
        actionDispatched: rule.thenSummary,
        status: AuditStatus.EXECUTED
      }
    });

    return auditEntry;
  }
}

export const automationEngineService = new AutomationEngineService();

