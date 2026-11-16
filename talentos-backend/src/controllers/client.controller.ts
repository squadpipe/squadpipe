import { Request, Response } from 'express';
import { clientService } from '../services/client.service';

export const getClients = async (req: Request, res: Response) => {
  try {
    const { search, page, limit } = req.query;
    const tenantId = req.user?.tenantId || 'talentos-agency';
    const parsedPage = page ? Math.max(1, parseInt(String(page), 10) || 1) : undefined;
    const parsedLimit = limit ? Math.max(1, Math.min(100, parseInt(String(limit), 10) || 10)) : undefined;

    const result = await clientService.getClients(tenantId, {
      search: search ? String(search) : undefined,
      page: parsedPage,
      limit: parsedLimit,
    });
    res.json({ success: true, data: result.data, pagination: result.pagination });
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
    const status = error?.statusCode || 500;
    if (status >= 500) console.error('Error creating client:', error);
    res.status(status).json({ success: false, message: error.message || 'Failed to create client' });
  }
};

export const updateClient = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'talentos-agency';
    const updated = await clientService.updateClient(req.params.id, req.body, tenantId);
    res.json({ success: true, data: updated });
  } catch (error: any) {
    const status = error?.statusCode || 500;
    res.status(status).json({ success: false, message: error.message || 'Failed to update client' });
  }
};

export const deleteClient = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'talentos-agency';
    await clientService.deleteClient(req.params.id, tenantId);
    res.json({ success: true, message: 'Client removed' });
  } catch (error: any) {
    const status = error?.statusCode || 500;
    res.status(status).json({ success: false, message: error.message || 'Failed to delete client' });
  }
};

export const getVendors = async (req: Request, res: Response) => {
  try {
    const { search, page, limit } = req.query;
    const tenantId = req.user?.tenantId || 'talentos-agency';
    const parsedPage = page ? Math.max(1, parseInt(String(page), 10) || 1) : undefined;
    const parsedLimit = limit ? Math.max(1, Math.min(100, parseInt(String(limit), 10) || 10)) : undefined;

    const result = await clientService.getVendors(tenantId, {
      search: search ? String(search) : undefined,
      page: parsedPage,
      limit: parsedLimit,
    });
    res.json({ success: true, data: result.data, pagination: result.pagination });
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
    const status = error?.statusCode || 500;
    if (status >= 500) console.error('Error creating vendor:', error);
    res.status(status).json({ success: false, message: error.message || 'Failed to create vendor' });
  }
};

export const updateVendor = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'talentos-agency';
    const updated = await clientService.updateVendor(req.params.id, req.body, tenantId);
    res.json({ success: true, data: updated });
  } catch (error: any) {
    const status = error?.statusCode || 500;
    res.status(status).json({ success: false, message: error.message || 'Failed to update vendor' });
  }
};

export const deleteVendor = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'talentos-agency';
    await clientService.deleteVendor(req.params.id, tenantId);
    res.json({ success: true, message: 'Vendor removed' });
  } catch (error: any) {
    const status = error?.statusCode || 500;
    res.status(status).json({ success: false, message: error.message || 'Failed to delete vendor' });
  }
};
