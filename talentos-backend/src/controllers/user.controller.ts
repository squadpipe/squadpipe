import { Request, Response } from 'express';
import { userService } from '../services/user.service';

export const getUsers = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'talentos-agency';
    const users = await userService.getUsers(tenantId);
    res.json({ success: true, data: users });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch users' });
  }
};

export const toggleUserRateMask = async (req: Request, res: Response) => {
  try {
    const updated = await userService.toggleRateMask(req.params.id);
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to toggle rate mask' });
  }
};

export const inviteUser = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'talentos-agency';
    const agencyName = req.user?.agencyName;
    const user = await userService.inviteUser(req.body, tenantId, agencyName);
    res.status(201).json({ success: true, data: user });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to invite user' });
  }
};
