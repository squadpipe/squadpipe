import { Request, Response } from 'express';
import { automationEngineService } from '../services/automationEngine.service';

export const getAutomationRules = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'squadpipe-agency';
    const rules = await automationEngineService.getRules(tenantId);
    res.json({ success: true, data: rules });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch rules' });
  }
};

export const getAutomationAuditLogs = async (req: Request, res: Response) => {
  try {
    const { search, page, limit } = req.query;
    const tenantId = req.user?.tenantId || 'squadpipe-agency';
    const parsedPage = page ? Math.max(1, parseInt(String(page), 10) || 1) : undefined;
    const parsedLimit = limit ? Math.max(1, Math.min(100, parseInt(String(limit), 10) || 10)) : undefined;

    const result = await automationEngineService.getAuditLogs(tenantId, {
      search: search ? String(search) : undefined,
      page: parsedPage,
      limit: parsedLimit,
    });
    res.json({ success: true, data: result.data, pagination: result.pagination });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch audit logs' });
  }
};

export const testTriggerRule = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'squadpipe-agency';
    const result = await automationEngineService.testTriggerRule(req.params.id, tenantId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(404).json({ success: false, message: error.message || 'Failed to test trigger rule' });
  }
};

export const seedDefaultAutomationRules = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'squadpipe-agency';
    const rules = await automationEngineService.seedDefaultRulesForTenant(tenantId, req.user?.id);
    res.status(201).json({ success: true, data: rules });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to seed default rules' });
  }
};
