import { Request, Response } from 'express';
import { slaEngineService } from '../services/slaEngine.service';

export const getSlaTasks = async (req: Request, res: Response) => {
  const tasks = await slaEngineService.getActiveTasks();
  res.json({ success: true, data: tasks });
};

export const completeSlaTask = async (req: Request, res: Response) => {
  const updated = await slaEngineService.completeTask(req.params.id);
  res.json({ success: true, data: updated });
};

export const evaluateSlaRadar = async (req: Request, res: Response) => {
  const generated = await slaEngineService.evaluateSlaRadar();
  res.json({ success: true, count: generated.length, data: generated });
};
