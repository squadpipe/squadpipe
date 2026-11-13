import { Request, Response } from 'express';
import { candidateService } from '../services/candidate.service';

export const getCandidates = async (req: Request, res: Response) => {
  try {
    const { search, stage } = req.query;
    const tenantId = req.user?.tenantId || 'talentos-agency';
    const candidates = await candidateService.getCandidates({
      tenantId,
      search: search ? String(search) : undefined,
      stage: stage ? String(stage) : undefined,
    });
    res.json({ success: true, data: candidates });
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
