import { Request, Response } from 'express';
import { automationEngineService } from '../services/automationEngine.service';

export const getAutomationRules = async (req: Request, res: Response) => {
  const rules = await automationEngineService.getRules();
  res.json({ success: true, data: rules });
};

export const getAutomationAuditLogs = async (req: Request, res: Response) => {
  const logs = await automationEngineService.getAuditLogs();
  res.json({ success: true, data: logs });
};

export const testTriggerRule = async (req: Request, res: Response) => {
  const result = await automationEngineService.testTriggerRule(req.params.id);
  res.json({ success: true, data: result });
};
