import { Request, Response } from 'express';
import { clientService } from '../services/client.service';

export const getClients = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'talentos-agency';
    const clients = await clientService.getClients(tenantId);
    res.json({ success: true, data: clients });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch clients' });
  }
};

export const createClient = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'talentos-agency';
    const client = await clientService.createClient(req.body, tenantId);
    res.status(201).json({ success: true, data: client });
  } catch (error: any) {
    console.error('Error creating client:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to create client' });
  }
};

export const deleteClient = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'talentos-agency';
    await clientService.deleteClient(req.params.id, tenantId);
    res.json({ success: true, message: 'Client removed' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to delete client' });
  }
};

export const getVendors = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'talentos-agency';
    const vendors = await clientService.getVendors(tenantId);
    res.json({ success: true, data: vendors });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch vendors' });
  }
};

export const createVendor = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'talentos-agency';
    const vendor = await clientService.createVendor(req.body, tenantId);
    res.status(201).json({ success: true, data: vendor });
  } catch (error: any) {
    console.error('Error creating vendor:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to create vendor' });
  }
};

export const deleteVendor = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'talentos-agency';
    await clientService.deleteVendor(req.params.id, tenantId);
    res.json({ success: true, message: 'Vendor removed' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to delete vendor' });
  }
};
