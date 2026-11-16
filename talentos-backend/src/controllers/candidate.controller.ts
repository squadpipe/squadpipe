import { Request, Response } from 'express';
import { candidateService } from '../services/candidate.service';

export const getCandidates = async (req: Request, res: Response) => {
  try {
    const { search, stage, workAuth, minRate, maxRate, page, limit } = req.query;
    const tenantId = req.user?.tenantId || 'talentos-agency';
    const parsedPage = page ? Math.max(1, parseInt(String(page), 10) || 1) : undefined;
    const parsedLimit = limit ? Math.max(1, Math.min(100, parseInt(String(limit), 10) || 10)) : undefined;

    const allowRateFilter = !req.user?.rateMasked;
    const parsedMinRate =
      allowRateFilter && minRate !== undefined && String(minRate).trim() !== ''
        ? Number(minRate)
        : undefined;
    const parsedMaxRate =
      allowRateFilter && maxRate !== undefined && String(maxRate).trim() !== ''
        ? Number(maxRate)
        : undefined;

    const result = await candidateService.getCandidatesPaginated({
      tenantId,
      search: search ? String(search) : undefined,
      stage: stage ? String(stage) : undefined,
      workAuth: workAuth ? String(workAuth) : undefined,
      minRate: parsedMinRate !== undefined && Number.isFinite(parsedMinRate) ? parsedMinRate : undefined,
      maxRate: parsedMaxRate !== undefined && Number.isFinite(parsedMaxRate) ? parsedMaxRate : undefined,
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
    const candidate = await candidateService.createCandidate(req.body, tenantId, recruiterId, req.file);
    res.status(201).json({ success: true, data: candidate });
  } catch (error: any) {
    console.error('Error creating candidate:', error);
    const status = error.statusCode || (String(error.message || '').includes('Unsupported CV') || String(error.message || '').includes('CV file') ? 400 : 500);
    res.status(status).json({ success: false, message: error.message || 'Failed to create candidate' });
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
    const updated = await candidateService.updateCandidate(req.params.id, req.body, tenantId, req.file);
    res.json({ success: true, data: updated });
  } catch (error: any) {
    const status = error.statusCode || (String(error.message || '').includes('Unsupported CV') || String(error.message || '').includes('CV file') ? 400 : 500);
    res.status(status).json({ success: false, message: error.message || 'Failed to update candidate' });
  }
};

export const uploadCandidateCv = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No CV file uploaded.' });
    }
    const tenantId = req.user?.tenantId || 'talentos-agency';
    const updated = await candidateService.uploadCandidateCv(req.params.id, req.file, tenantId);
    res.json({ success: true, data: updated });
  } catch (error: any) {
    const status = error.statusCode || (String(error.message || '').includes('Unsupported CV') || String(error.message || '').includes('CV file') ? 400 : 500);
    res.status(status).json({ success: false, message: error.message || 'Failed to upload CV' });
  }
};

export const downloadCandidateCv = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'talentos-agency';
    const downloaded = await candidateService.downloadCandidateCv(req.params.id, tenantId);
    const fallbackName = downloaded.fileName.replace(/["\\\r\n]/g, '_');
    const encodedName = encodeURIComponent(downloaded.fileName);

    res.setHeader('Content-Type', downloaded.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${fallbackName}"; filename*=UTF-8''${encodedName}`
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(downloaded.buffer);
  } catch (error: any) {
    const status = error.statusCode || 500;
    res.status(status).json({ success: false, message: error.message || 'Failed to download CV' });
  }
};

export const deleteCandidate = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'talentos-agency';
    await candidateService.deleteCandidate(req.params.id, tenantId);
    res.json({ success: true, message: 'Candidate removed from roster' });
  } catch (error: any) {
    const status = error.statusCode || 500;
    res.status(status).json({ success: false, message: error.message || 'Failed to delete candidate' });
  }
};
