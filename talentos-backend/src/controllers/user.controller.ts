import { Request, Response } from 'express';
import { userService } from '../services/user.service';

export const getUsers = async (req: Request, res: Response) => {
  try {
    const { search, role, status, page, limit } = req.query;
    const tenantId = req.user?.tenantId || 'talentos-agency';
    const parsedPage = page ? Math.max(1, parseInt(String(page), 10) || 1) : undefined;
    const parsedLimit = limit ? Math.max(1, Math.min(100, parseInt(String(limit), 10) || 10)) : undefined;

    const result = await userService.getUsers(tenantId, {
      search: search ? String(search) : undefined,
      role: role ? String(role) : undefined,
      status: status ? String(status) : undefined,
      page: parsedPage,
      limit: parsedLimit,
    });
    res.json({ success: true, data: result.data, pagination: result.pagination });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch users' });
  }
};

export const toggleUserRateMask = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'talentos-agency';
    const updated = await userService.toggleRateMask(req.params.id, tenantId);
    res.json({ success: true, data: updated });
  } catch (error: any) {
    const status = error.message === 'User not found' ? 404 : 500;
    res.status(status).json({ success: false, message: error.message || 'Failed to toggle rate mask' });
  }
};

export const inviteUser = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'talentos-agency';
    const agencyName = req.user?.agencyName;
    const user = await userService.inviteUser(req.body, tenantId, agencyName);
    res.status(201).json({ success: true, data: user });
  } catch (error: any) {
    const msg = error?.message || 'Failed to invite user';
    const status = msg.includes('already exists') ? 409 : msg.includes('valid corporate email') ? 400 : 500;
    res.status(status).json({ success: false, message: msg });
  }
};
