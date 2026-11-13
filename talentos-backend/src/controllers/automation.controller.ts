import { Request, Response } from 'express';
import { automationEngineService } from '../services/automationEngine.service';

export const getAutomationRules = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'talentos-agency';
    const rules = await automationEngineService.getRules(tenantId);
    res.json({ success: true, data: rules });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch rules' });
  }
};

export const getAutomationAuditLogs = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'talentos-agency';
    const logs = await automationEngineService.getAuditLogs(tenantId);
    res.json({ success: true, data: logs });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch audit logs' });
  }
};

export const testTriggerRule = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'talentos-agency';
    const result = await automationEngineService.testTriggerRule(req.params.id, tenantId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(404).json({ success: false, message: error.message || 'Failed to test trigger rule' });
  }
};

export const seedDefaultAutomationRules = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'talentos-agency';
    const rules = await automationEngineService.seedDefaultRulesForTenant(tenantId, req.user?.id);
    res.status(201).json({ success: true, data: rules });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to seed default rules' });
  }
};
