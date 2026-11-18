import { Request, Response } from 'express';
import { slaEngineService } from '../services/slaEngine.service';
import { redactRatesFromText } from '../services/ai/ai.service';

function maskSlaTaskForUser(task: any, rateMasked: boolean) {
  if (!rateMasked || !task) return task;
  return {
    ...task,
    meta: task.meta ? redactRatesFromText(task.meta) : task.meta,
  };
}

export const getSlaTasks = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'squadpipe-agency';
    const includeCompleted =
      req.query.includeCompleted === 'true' || req.query.includeCompleted === '1';
    const tasks = await slaEngineService.getActiveTasks(tenantId, includeCompleted);
    const rateMasked = Boolean(req.user?.rateMasked);
    res.json({
      success: true,
      data: tasks.map((t) => maskSlaTaskForUser(t, rateMasked)),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch SLA tasks' });
  }
};

export const completeSlaTask = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'squadpipe-agency';
    const done = typeof req.body?.done === 'boolean' ? req.body.done : undefined;
    const updated = await slaEngineService.completeTask(req.params.id, tenantId, done);
    res.json({ success: true, data: maskSlaTaskForUser(updated, Boolean(req.user?.rateMasked)) });
  } catch (error: any) {
    res.status(404).json({ success: false, message: error.message || 'Failed to complete SLA task' });
  }
};

export const evaluateSlaRadar = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'squadpipe-agency';
    const generated = await slaEngineService.evaluateSlaRadar(tenantId);
    const rateMasked = Boolean(req.user?.rateMasked);
    res.json({
      success: true,
      count: generated.length,
      data: {
        tasks: generated.map((t) => maskSlaTaskForUser(t, rateMasked)),
        createdTasksCount: generated.length,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to evaluate SLA radar' });
  }
};
