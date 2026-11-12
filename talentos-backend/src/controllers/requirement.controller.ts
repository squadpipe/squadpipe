import { Request, Response } from 'express';
import { requirementService } from '../services/requirement.service';

export const getRequirements = async (req: Request, res: Response) => {
  const { search, status } = req.query;
  const reqs = await requirementService.getRequirements({
    search: search ? String(search) : undefined,
    status: status ? String(status) : undefined,
  });
  res.json({ success: true, data: reqs });
};

export const createRequirement = async (req: Request, res: Response) => {
  const requirement = await requirementService.createRequirement(req.body);
  res.status(201).json({ success: true, data: requirement });
};

export const updateRequirementStage = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, resourceName } = req.body;
  const updated = await requirementService.updateRequirementStage(id, status, resourceName);
  res.json({ success: true, data: updated });
};
