import { Request, Response } from 'express';
import { slaEngineService } from '../services/slaEngine.service';

export const getSlaTasks = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'talentos-agency';
    const tasks = await slaEngineService.getActiveTasks(tenantId);
    res.json({ success: true, data: tasks });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch SLA tasks' });
  }
};

export const completeSlaTask = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'talentos-agency';
    const updated = await slaEngineService.completeTask(req.params.id, tenantId);
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(404).json({ success: false, message: error.message || 'Failed to complete SLA task' });
  }
};

export const evaluateSlaRadar = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'talentos-agency';
    const generated = await slaEngineService.evaluateSlaRadar(tenantId);
    res.json({
      success: true,
      count: generated.length,
      data: {
        tasks: generated,
        createdTasksCount: generated.length,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to evaluate SLA radar' });
  }
};
