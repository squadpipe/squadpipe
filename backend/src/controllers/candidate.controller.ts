import { Request, Response } from 'express';
import {
  CANDIDATE_SORTABLE_FIELDS,
  candidateService,
} from '../services/candidate.service';
import {
  complianceService,
  extractRequestNetworkMeta,
} from '../services/compliance.service';
import { parseSortParams } from '../utils/tableSort';

export const getCandidates = async (req: Request, res: Response) => {
  try {
    const { search, exactOnly, stage, workAuth, vendorId, minRate, maxRate, page, limit } = req.query;
    const tenantId = req.user?.tenantId || 'squadpipe-agency';
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

    const { sortBy, sortDir } = parseSortParams(
      req.query as Record<string, any>,
      CANDIDATE_SORTABLE_FIELDS,
      allowRateFilter ? [] : ['hourlyRate']
    );

    const result = await candidateService.getCandidatesPaginated({
      tenantId,
      search: search ? String(search) : undefined,
      exactOnly: String(exactOnly || '').toLowerCase() === 'true',
      stage: stage ? String(stage) : undefined,
      workAuth: workAuth ? String(workAuth) : undefined,
      vendorId: vendorId ? String(vendorId) : undefined,
      minRate: parsedMinRate !== undefined && Number.isFinite(parsedMinRate) ? parsedMinRate : undefined,
      maxRate: parsedMaxRate !== undefined && Number.isFinite(parsedMaxRate) ? parsedMaxRate : undefined,
      page: parsedPage,
      limit: parsedLimit,
      sortBy,
      sortDir,
    });
    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
      meta: result.meta,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch candidates' });
  }
};

export const matchSearchCandidates = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'squadpipe-agency';
    const body = req.body || {};
    const allowRateFilter = !req.user?.rateMasked;
    const rawMaxRate = body.maxRate;
    const parsedMaxRate =
      allowRateFilter && rawMaxRate !== undefined && rawMaxRate !== null && String(rawMaxRate).trim() !== ''
        ? Number(rawMaxRate)
        : undefined;

    const result = await candidateService.searchMatchedCandidates({
      tenantId,
      requirementId: body.requirementId ? String(body.requirementId).trim() : undefined,
      skillsRequired: body.skillsRequired !== undefined ? String(body.skillsRequired) : undefined,
      search: body.search ? String(body.search) : undefined,
      exactOnly: Boolean(body.exactOnly),
      workAuth: body.workAuth ? String(body.workAuth) : undefined,
      availabilityScope:
        body.availabilityScope === 'bench' ||
        body.availabilityScope === 'non_billable' ||
        body.availabilityScope === 'all'
          ? body.availabilityScope
          : 'non_billable',
      relocation: body.relocation ? String(body.relocation) : undefined,
      maxRate: parsedMaxRate !== undefined && Number.isFinite(parsedMaxRate) ? parsedMaxRate : undefined,
      rateMasked: Boolean(req.user?.rateMasked),
      matchMode:
        body.matchMode === 'strict' || body.matchMode === 'overlap' || body.matchMode === 'all'
          ? body.matchMode
          : undefined,
      sortBy:
        body.sortBy === 'match' ||
        body.sortBy === 'bench' ||
        body.sortBy === 'rate_asc' ||
        body.sortBy === 'recent'
          ? body.sortBy
          : undefined,
      excludeAttached: typeof body.excludeAttached === 'boolean' ? body.excludeAttached : true,
      excludeCandidateIds: Array.isArray(body.excludeCandidateIds) ? body.excludeCandidateIds : undefined,
      page: body.page ? Number(body.page) : 1,
      limit: body.limit ? Number(body.limit) : 50,
    });
    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
      meta: result.meta,
    });
  } catch (error: any) {
    const status = error?.statusCode || 500;
    res.status(status).json({ success: false, message: error.message || 'Candidate match search failed' });
  }
};

export const createCandidate = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'squadpipe-agency';
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
    const tenantId = req.user?.tenantId || 'squadpipe-agency';
    const candidate = await candidateService.getCandidateById(req.params.id, tenantId);
    if (!candidate) return res.status(404).json({ success: false, message: 'Candidate not found' });
    res.json({ success: true, data: candidate });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch candidate' });
  }
};

export const updateCandidate = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'squadpipe-agency';
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
    const tenantId = req.user?.tenantId || 'squadpipe-agency';
    const updated = await candidateService.uploadCandidateCv(req.params.id, req.file, tenantId);
    res.json({ success: true, data: updated });
  } catch (error: any) {
    const status = error.statusCode || (String(error.message || '').includes('Unsupported CV') || String(error.message || '').includes('CV file') ? 400 : 500);
    res.status(status).json({ success: false, message: error.message || 'Failed to upload CV' });
  }
};

export const downloadCandidateCv = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'squadpipe-agency';
    const downloaded = await candidateService.downloadCandidateCv(req.params.id, tenantId);
    const netMeta = extractRequestNetworkMeta(req);
    await complianceService.recordSecurityAuditEvent({
      tenantId,
      actorUserId: req.user?.id,
      actorEmail: req.user?.email,
      actorRole: req.user?.role,
      action: 'CV_DOWNLOADED',
      targetType: 'CANDIDATE',
      targetId: req.params.id,
      ...netMeta,
      metadata: {
        provider: downloaded.provider,
        fileName: downloaded.fileName,
      },
    });
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
    const tenantId = req.user?.tenantId || 'squadpipe-agency';
    const netMeta = extractRequestNetworkMeta(req);
    const erasure = await candidateService.deleteCandidate(req.params.id, tenantId, {
      userId: req.user?.id,
      email: req.user?.email,
      role: req.user?.role,
      ...netMeta,
      reason: 'CANDIDATE_DELETED',
    });
    res.json({
      success: true,
      message: 'Candidate removed and PII scrubbed',
      data: erasure,
    });
  } catch (error: any) {
    const status = error.statusCode || 500;
    res.status(status).json({ success: false, message: error.message || 'Failed to delete candidate' });
  }
};
