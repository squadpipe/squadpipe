import { Request, Response } from 'express';
import { requirementService } from '../services/requirement.service';

export const getRequirements = async (req: Request, res: Response) => {
  try {
    const { search, status, page, limit, view } = req.query;
    const tenantId = req.user?.tenantId || 'squadpipe-agency';
    const parsedPage = page ? Math.max(1, parseInt(String(page), 10) || 1) : undefined;
    const parsedLimit = limit ? Math.max(1, Math.min(100, parseInt(String(limit), 10) || 10)) : undefined;

    const result = await requirementService.getRequirementsPaginated({
      tenantId,
      search: search ? String(search) : undefined,
      status: status ? String(status) : undefined,
      page: parsedPage,
      limit: parsedLimit,
      view: view === 'kanban' ? 'kanban' : 'full',
    });
    res.json({ success: true, data: result.data, pagination: result.pagination });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch requirements' });
  }
};

export const getKanbanBoard = async (req: Request, res: Response) => {
  try {
    const { search, stages, limit } = req.query;
    const tenantId = req.user?.tenantId || 'squadpipe-agency';
    const stageList = stages
      ? String(stages)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : ['Requirement', 'Submitted', 'Interview', 'Selected', 'Onboarding', 'Billable', 'Archived'];
    const perColumnLimit = limit ? Math.max(1, Math.min(50, parseInt(String(limit), 10) || 25)) : 25;

    const result = await requirementService.getKanbanBoard({
      tenantId,
      stages: stageList,
      search: search ? String(search) : undefined,
      perColumnLimit,
    });
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch Kanban board' });
  }
};

export const getRequirementById = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'squadpipe-agency';
    const requirement = await requirementService.getRequirementById(req.params.id, tenantId);
    if (!requirement) {
      res.status(404).json({ success: false, message: 'Requirement not found' });
      return;
    }
    res.json({ success: true, data: requirement });
  } catch (error: any) {
    const status = error?.statusCode || 500;
    res.status(status).json({ success: false, message: error.message || 'Failed to fetch requirement' });
  }
};

export const createRequirement = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'squadpipe-agency';
    const recruiterId = req.user?.id;
    const requirement = await requirementService.createRequirement(req.body, tenantId, recruiterId);
    res.status(201).json({ success: true, data: requirement });
  } catch (error: any) {
    const status = error?.statusCode || 500;
    if (status >= 500) console.error('Error creating requirement:', error);
    res.status(status).json({ success: false, message: error.message || 'Failed to create requirement' });
  }
};

export const updateRequirement = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenantId || 'squadpipe-agency';
    const updated = await requirementService.updateRequirement(id, req.body, tenantId);
    res.json({ success: true, data: updated });
  } catch (error: any) {
    const status = error?.statusCode || 500;
    res.status(status).json({ success: false, message: error.message || 'Failed to update requirement' });
  }
};

export const updateRequirementStage = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, resourceName } = req.body;
    const tenantId = req.user?.tenantId || 'squadpipe-agency';
    const updated = await requirementService.updateRequirementStage(id, status, resourceName, tenantId);
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to update requirement stage' });
  }
};

export const deleteRequirement = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'squadpipe-agency';
    await requirementService.deleteRequirement(req.params.id, tenantId);
    res.json({ success: true, message: 'Requirement removed' });
  } catch (error: any) {
    const status = error?.statusCode || 500;
    res.status(status).json({ success: false, message: error.message || 'Failed to delete requirement' });
  }
};
