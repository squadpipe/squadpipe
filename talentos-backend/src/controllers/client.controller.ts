import { Request, Response } from 'express';
import { clientService } from '../services/client.service';

export const getClients = async (req: Request, res: Response) => {
  const clients = await clientService.getClients();
  res.json({ success: true, data: clients });
};

export const createClient = async (req: Request, res: Response) => {
  const client = await clientService.createClient(req.body);
  res.status(201).json({ success: true, data: client });
};

export const getVendors = async (req: Request, res: Response) => {
  const vendors = await clientService.getVendors();
  res.json({ success: true, data: vendors });
};

export const createVendor = async (req: Request, res: Response) => {
  const vendor = await clientService.createVendor(req.body);
  res.status(201).json({ success: true, data: vendor });
};
