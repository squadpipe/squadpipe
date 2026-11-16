import { Request, Response } from 'express';
import { placementService } from '../services/placement.service';

export const getPlacements = async (req: Request, res: Response) => {
  try {
    const { search, status, model, page, limit } = req.query;
    const tenantId = req.user?.tenantId || 'talentos-agency';
    const parsedPage = page ? Math.max(1, parseInt(String(page), 10) || 1) : undefined;
    const parsedLimit = limit ? Math.max(1, Math.min(100, parseInt(String(limit), 10) || 10)) : undefined;

    const result = await placementService.getPlacements(tenantId, {
      search: search ? String(search) : undefined,
      status: status ? String(status) : undefined,
      model: model ? String(model) : undefined,
      page: parsedPage,
      limit: parsedLimit,
    });
    res.json({ success: true, data: result.data, pagination: result.pagination });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch placements' });
  }
};

export const createPlacement = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'talentos-agency';
    const recruiterId = req.user?.id;
    const placement = await placementService.createPlacement(req.body, tenantId, recruiterId);
    res.status(201).json({ success: true, data: placement });
  } catch (error: any) {
    const status = error?.statusCode || 500;
    if (status >= 500) console.error('Error creating placement:', error);
    res.status(status).json({ success: false, message: error.message || 'Failed to create placement' });
  }
};

export const updatePlacement = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'talentos-agency';
    const updated = await placementService.updatePlacement(req.params.id, req.body, tenantId);
    res.json({ success: true, data: updated });
  } catch (error: any) {
    const status = error?.statusCode || 500;
    res.status(status).json({ success: false, message: error.message || 'Failed to update placement' });
  }
};

export const extendPlacement = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenantId || 'talentos-agency';
    const updated = await placementService.extendPlacement(id, req.body, tenantId);
    res.json({ success: true, data: updated });
  } catch (error: any) {
    const status = error?.statusCode || 500;
    res.status(status).json({ success: false, message: error.message || 'Failed to extend placement' });
  }
};

export const deletePlacement = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'talentos-agency';
    await placementService.deletePlacement(req.params.id, tenantId);
    res.json({ success: true, message: 'Placement removed' });
  } catch (error: any) {
    const status = error?.statusCode || 500;
    res.status(status).json({ success: false, message: error.message || 'Failed to delete placement' });
  }
};
