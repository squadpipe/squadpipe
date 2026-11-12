import { Request, Response } from 'express';
import { userService } from '../services/user.service';

export const getUsers = async (req: Request, res: Response) => {
  const users = await userService.getUsers();
  res.json({ success: true, data: users });
};

export const toggleUserRateMask = async (req: Request, res: Response) => {
  const updated = await userService.toggleRateMask(req.params.id);
  res.json({ success: true, data: updated });
};

export const inviteUser = async (req: Request, res: Response) => {
  const user = await userService.inviteUser(req.body);
  res.status(201).json({ success: true, data: user });
};
