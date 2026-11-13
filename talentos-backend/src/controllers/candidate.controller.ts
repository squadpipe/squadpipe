import { Request, Response } from 'express';
import { candidateService } from '../services/candidate.service';

export const getCandidates = async (req: Request, res: Response) => {
  try {
    const { search, stage, workAuth, page, limit } = req.query;
    const tenantId = req.user?.tenantId || 'talentos-agency';
    const parsedPage = page ? Math.max(1, parseInt(String(page), 10) || 1) : undefined;
    const parsedLimit = limit ? Math.max(1, Math.min(100, parseInt(String(limit), 10) || 10)) : undefined;

    const result = await candidateService.getCandidatesPaginated({
      tenantId,
      search: search ? String(search) : undefined,
      stage: stage ? String(stage) : undefined,
      workAuth: workAuth ? String(workAuth) : undefined,
      page: parsedPage,
      limit: parsedLimit,
    });
    res.json({ success: true, data: result.data, pagination: result.pagination });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch candidates' });
  }
};

export const createCandidate = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'talentos-agency';
    const recruiterId = req.user?.id;
    const candidate = await candidateService.createCandidate(req.body, tenantId, recruiterId);
    res.status(201).json({ success: true, data: candidate });
  } catch (error: any) {
    console.error('Error creating candidate:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to create candidate' });
  }
};

export const getCandidateById = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'talentos-agency';
    const candidate = await candidateService.getCandidateById(req.params.id, tenantId);
    if (!candidate) return res.status(404).json({ success: false, message: 'Candidate not found' });
    res.json({ success: true, data: candidate });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch candidate' });
  }
};

export const updateCandidate = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'talentos-agency';
    const updated = await candidateService.updateCandidate(req.params.id, req.body, tenantId);
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to update candidate' });
  }
};

export const deleteCandidate = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'talentos-agency';
    await candidateService.deleteCandidate(req.params.id, tenantId);
    res.json({ success: true, message: 'Candidate removed from roster' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to delete candidate' });
  }
};
