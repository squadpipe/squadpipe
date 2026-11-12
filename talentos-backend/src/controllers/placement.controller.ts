import { Request, Response } from 'express';
import { placementService } from '../services/placement.service';

export const getPlacements = async (req: Request, res: Response) => {
  const placements = await placementService.getPlacements();
  res.json({ success: true, data: placements });
};

export const createPlacement = async (req: Request, res: Response) => {
  const placement = await placementService.createPlacement(req.body);
  res.status(201).json({ success: true, data: placement });
};

export const extendPlacement = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { newEndDate } = req.body;
  const updated = await placementService.extendPlacement(id, newEndDate);
  res.json({ success: true, data: updated });
};
