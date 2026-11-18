import { Router, Request, Response } from 'express';
import multer from 'multer';
import { placementService } from '../services/placement.service';
import { submissionService } from '../services/submission.service';
import { analyticsService } from '../services/analytics.service';
import { csvImporterService } from '../services/csvImporter.service';
import { resumeParserClientService } from '../services/resumeParserClient.service';
import { smtpService } from '../services/smtp.service';
import {
  renderSubmissionEmail,
} from '../services/emailTemplate.service';
import {
  getTenantSettings,
  saveGeneralSettings,
} from '../config/smtp.config';
import { aiUsageService } from '../services/ai/aiUsage.service';
import {
  buildEnhancedEmailParseResponse,
  buildEnhancedResumeParseResponse,
  buildNodeResumeFallback,
} from '../services/ai/parseBridge.service';
import { DEFAULT_TAXONOMIES } from '../config/taxonomies.config';
import { prisma } from '../config/prisma.config';
import { authenticateJwt, requirePlatformAdmin, requireRole, requireUnmaskedRates } from '../middlewares/auth.middleware';
import { rateMaskMiddleware } from '../middlewares/rateMask.middleware';
import {
  authRateLimiter,
  emailRateLimiter,
  sensitiveAuthRateLimiter,
  uploadRateLimiter,
} from '../middlewares/security.middleware';
import { escapeHtml, sanitizeEmailHtml } from '../utils/cryptoSecret';
import { capabilityService } from '../services/capability.service';
import { pitchDraftService } from '../services/pitchDraft.service';
import { publicIntakeService } from '../services/publicIntake.service';
import { slaEngineService } from '../services/slaEngine.service';
import { automationEngineService } from '../services/automationEngine.service';
import { AutomationCategory, PlacementStatus, SlaCategory, UserRole } from '@prisma/client';

import * as authController from '../controllers/auth.controller';
import * as candidateController from '../controllers/candidate.controller';
import * as requirementController from '../controllers/requirement.controller';
import * as placementController from '../controllers/placement.controller';
import * as clientController from '../controllers/client.controller';
import * as userController from '../controllers/user.controller';
import * as automationController from '../controllers/automation.controller';
import * as slaController from '../controllers/sla.controller';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

const optionalSingleCvUpload = (req: Request, res: Response, next: (err?: any) => void) => {
  upload.single('file')(req, res, (err: any) => {
    if (err instanceof multer.MulterError) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? 'CV file exceeds the 15 MB upload limit' : err.message;
      return res.status(400).json({ success: false, message: msg });
    }
    if (err) {
      return res.status(400).json({ success: false, message: err.message || 'Invalid file upload' });
    }
    return next();
  });
};

// Public routes (Readiness health check & Authentication)
router.get('/health', async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ success: true, service: 'squadpipe-backend', status: 'operational', database: 'connected' });
  } catch {
    res.status(503).json({
      success: false,
      service: 'squadpipe-backend',
      status: 'degraded',
      database: 'disconnected',
    });
  }
});

router.post('/auth/signup', authRateLimiter, authController.signup);
router.post('/auth/login', authRateLimiter, authController.login);
router.post('/auth/forgot-password', sensitiveAuthRateLimiter, authController.forgotPassword);
router.post('/auth/verify-reset-otp', sensitiveAuthRateLimiter, authController.verifyResetOtp);
router.post('/auth/reset-password', sensitiveAuthRateLimiter, authController.resetPassword);
router.get('/auth/invite/:token', authRateLimiter, authController.getInviteDetails);
router.post('/auth/accept-invite', sensitiveAuthRateLimiter, authController.acceptInvite);

// Public Requirement CV Intake Form routes (unauthenticated, token-gated)
router.get('/public/apply/:token', authRateLimiter, async (req: Request, res: Response) => {
  try {
    const publicReq = await publicIntakeService.getPublicRequirementByToken(req.params.token);
    res.json({ success: true, data: publicReq });
  } catch (error: any) {
    const status = error?.statusCode || 404;
    res.status(status).json({
      success: false,
      message: error?.message || 'This position is no longer accepting applications.',
    });
  }
});

router.post(
  '/public/apply/:token',
  uploadRateLimiter,
  optionalSingleCvUpload,
  async (req: Request, res: Response) => {
    try {
      const result = await publicIntakeService.submitPublicApplication({
        token: req.params.token,
        body: req.body,
        file: req.file,
      });
      res.status(201).json({ success: true, data: result });
    } catch (error: any) {
      const msg = String(error?.message || '');
      const status =
        error?.statusCode ||
        (msg.includes('Unsupported CV') || msg.includes('CV file') ? 400 : 500);
      res.status(status).json({
        success: false,
        message: msg || 'Failed to submit application.',
      });
    }
  }
);

// Platform / White-Label Partner tenant AI entitlement provisioning (PLATFORM_ADMIN_SECRET gated)
const normalizePlatformTenantId = (raw: string): string | null => {
  const clean = String(raw || '').trim();
  if (!clean || clean.length > 100 || !/^[a-zA-Z0-9._-]+$/.test(clean)) return null;
  return clean;
};

router.get(
  '/platform/tenants/:tenantId/ai-entitlement',
  sensitiveAuthRateLimiter,
  requirePlatformAdmin,
  async (req: Request, res: Response) => {
    const tenantId = normalizePlatformTenantId(req.params.tenantId);
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Invalid tenantId parameter.' });
    }
    try {
      const [entitlement, summary, capabilities] = await Promise.all([
        aiUsageService.getPlatformAiEntitlement(tenantId),
        aiUsageService.getMonthlyUsageSummary(tenantId),
        aiUsageService.getEffectivePublicAiCapabilities(tenantId),
      ]);
      res.json({ success: true, data: { tenantId, entitlement, summary, ai: capabilities } });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error?.message || 'Failed to read tenant entitlement' });
    }
  }
);

router.put(
  '/platform/tenants/:tenantId/ai-entitlement',
  sensitiveAuthRateLimiter,
  requirePlatformAdmin,
  async (req: Request, res: Response) => {
    const tenantId = normalizePlatformTenantId(req.params.tenantId);
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Invalid tenantId parameter.' });
    }
    try {
      const entitlement = await aiUsageService.savePlatformAiEntitlement(tenantId, req.body || {});
      const [summary, capabilities] = await Promise.all([
        aiUsageService.getMonthlyUsageSummary(tenantId),
        aiUsageService.getEffectivePublicAiCapabilities(tenantId),
      ]);
      res.json({
        success: true,
        data: { tenantId, entitlement, summary, ai: capabilities },
        message: 'Tenant AI entitlement updated',
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error?.message || 'Failed to update tenant entitlement' });
    }
  }
);

// Protected routes (JWT authentication & Rate Masking)
router.use(authenticateJwt);
router.use(rateMaskMiddleware);

// Authenticated session routes
router.get('/auth/me', authController.me);
router.patch('/auth/profile', authController.updateProfile);
router.post('/auth/logout', authController.logout);

// Dashboard metrics
router.get('/dashboard/metrics', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'squadpipe-agency';
    const [
      activeReqsCount,
      submittedCount,
      interviewsCount,
      selectedCount,
      onboardingCount,
      financials
    ] = await Promise.all([
      prisma.requirement.count({ where: { tenantId } }),
      prisma.requirement.count({ where: { tenantId, status: 'SUBMITTED' } }),
      prisma.requirement.count({ where: { tenantId, status: 'INTERVIEW' } }),
      prisma.requirement.count({ where: { tenantId, status: 'SELECTED' } }),
      prisma.requirement.count({ where: { tenantId, status: 'ONBOARDING' } }),
      placementService.getFinancialMetrics(tenantId)
    ]);

    res.json({
      success: true,
      data: {
        activeReqsCount,
        submittedCount,
        interviewsCount,
        selectedCount,
        onboardingCount,
        ...financials
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch dashboard metrics' });
  }
});

router.get('/dashboard/recruiter-performance', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'squadpipe-agency';
    const period = req.query.period ? String(req.query.period).trim().toLowerCase() : 'week';
    const report = await analyticsService.getRecruiterPerformance(tenantId, period);
    res.json({ success: true, data: report });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch recruiter performance metrics',
    });
  }
});

// Sidebar navigation counts (fast, lightweight aggregate query)
router.get('/sidebar/counts', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'squadpipe-agency';
    const [
      requirements,
      consultants,
      clients,
      vendors,
      billable,
      users,
      customFields,
      activeRules
    ] = await Promise.all([
      prisma.requirement.count({ where: { tenantId } }),
      prisma.candidate.count({ where: { tenantId } }),
      prisma.client.count({ where: { tenantId } }),
      prisma.vendor.count({ where: { tenantId } }),
      prisma.placement.count({
        where: {
          tenantId,
          status: {
            in: [
              PlacementStatus.ACTIVE,
              PlacementStatus.EXTENDED,
              PlacementStatus.EXPIRING_SOON,
            ],
          },
        },
      }),
      prisma.user.count({ where: { tenantId } }),
      prisma.customFieldDefinition.count({ where: { tenantId } }),
      prisma.automationRule.count({ where: { tenantId, active: true } })
    ]);

    res.json({
      success: true,
      data: {
        requirements,
        consultants,
        clients,
        vendors,
        billable,
        users,
        customFields,
        activeRules
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch sidebar counts' });
  }
});

// Candidates
const LEADERSHIP_ROLES: UserRole[] = [
  UserRole.ADMINISTRATOR,
  UserRole.SENIOR_RECRUITER,
  UserRole.ACCOUNT_EXECUTIVE,
  UserRole.BENCH_SALES_LEAD,
];

router.get('/candidates', candidateController.getCandidates);
router.post('/candidates', uploadRateLimiter, optionalSingleCvUpload, candidateController.createCandidate);
router.get('/candidates/:id', candidateController.getCandidateById);
router.put('/candidates/:id', uploadRateLimiter, optionalSingleCvUpload, candidateController.updateCandidate);
router.post('/candidates/:id/cv', uploadRateLimiter, optionalSingleCvUpload, candidateController.uploadCandidateCv);
router.get('/candidates/:id/cv', candidateController.downloadCandidateCv);
router.patch('/candidates/:id/stage', candidateController.updateCandidate);
router.delete('/candidates/:id', requireRole(LEADERSHIP_ROLES), candidateController.deleteCandidate);
router.post('/candidates/csv-import', requireRole(LEADERSHIP_ROLES), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'squadpipe-agency';
    const recruiterId = req.user?.id;
    const rows = Array.isArray(req.body) ? req.body : req.body.rows || [];
    const rawRequirementId = !Array.isArray(req.body) ? req.body?.requirementId : undefined;
    const requirementId = rawRequirementId ? String(rawRequirementId).trim() : '';

    if (requirementId) {
      const targetReq = await prisma.requirement.findFirst({
        where: { id: requirementId, tenantId },
        select: { id: true },
      });
      if (!targetReq) {
        return res.status(404).json({ success: false, message: 'Target requirement not found' });
      }
    }

    const results = await csvImporterService.importCandidates(rows, tenantId, recruiterId);

    if (requirementId && results.length > 0) {
      const attached = await submissionService.attachCandidates({
        tenantId,
        recruiterId,
        requirementId,
        candidateIds: results.map((c) => c.id),
      });
      return res.json({
        success: true,
        count: results.length,
        data: results,
        attachedCount: attached.addedCount,
        skippedDuplicatesCount: attached.skippedDuplicatesCount,
        requirement: attached.requirement,
      });
    }

    res.json({ success: true, count: results.length, data: results });
  } catch (error: any) {
    const status = error?.statusCode || 500;
    res.status(status).json({ success: false, message: error.message || 'CSV Import failed' });
  }
});

// NLP & AI Endpoints (FastAPI Bridge + Optional LLM Enhancement)
router.post('/parse-resume', uploadRateLimiter, upload.single('file'), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, message: 'No resume file uploaded.' });
    }

    let upstreamPayload: Record<string, any>;
    try {
      const formData = new FormData();
      const blob = new Blob([new Uint8Array(file.buffer)], {
        type: file.mimetype || 'application/octet-stream',
      });
      formData.append('file', blob, file.originalname);
      upstreamPayload = await resumeParserClientService.parseResume(formData);
    } catch {
      upstreamPayload = buildNodeResumeFallback(file.buffer, file.originalname);
    }

    const rawTextForAi = String(
      upstreamPayload?.data?.rawSnippet ||
        upstreamPayload?.raw_text_snippet ||
        upstreamPayload?.rawSnippet ||
        ''
    );

    const responsePayload = await buildEnhancedResumeParseResponse({
      upstreamPayload,
      rawTextForAi,
      tenantId: req.user?.tenantId,
      userId: req.user?.id,
      rateMasked: Boolean(req.user?.rateMasked),
    });

    return res.json(responsePayload);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Resume parsing failed' });
  }
});

router.post('/parse-email', async (req: Request, res: Response) => {
  const rawEmailText = String(req.body.rawEmailText || req.body.text || '');

  try {
    let parsed: Record<string, any> = {};
    try {
      const result = await resumeParserClientService.parseEmail(rawEmailText.replace(/\*\*/g, ''));
      parsed = result?.data || result || {};
    } catch {
      parsed = {};
    }

    const enhanced = await buildEnhancedEmailParseResponse({
      rawEmailText,
      upstreamParsed: parsed,
      tenantId: req.user?.tenantId,
      userId: req.user?.id,
      rateMasked: Boolean(req.user?.rateMasked),
    });

    res.json({ success: true, aiUsed: enhanced.aiUsed, data: enhanced });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Email parse failed' });
  }
});

router.post('/match-skills', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'squadpipe-agency';
    const { requirementId, skillsRequired, candidateIds, candidates } = req.body || {};

    if (!requirementId) {
      return res.status(400).json({ success: false, message: 'requirementId is required' });
    }

    const result = await capabilityService.rankMatchingCandidates({
      tenantId,
      userId: req.user?.id,
      requirementId: String(requirementId).trim(),
      skillsRequiredOverride: skillsRequired ? String(skillsRequired) : undefined,
      candidateIds: Array.isArray(candidateIds) ? candidateIds : undefined,
      candidates: Array.isArray(candidates) ? candidates : undefined,
      rateMasked: Boolean(req.user?.rateMasked),
    });
    res.json({ success: true, data: result });
  } catch (error: any) {
    const status = error?.statusCode || 500;
    res.status(status).json({ success: false, message: error.message || 'Skill match failed' });
  }
});

// Requirements
router.get('/requirements', requirementController.getRequirements);
router.get('/requirements/kanban', requirementController.getKanbanBoard);
router.get('/requirements/:id', requirementController.getRequirementById);
router.post('/requirements', requirementController.createRequirement);
router.put('/requirements/:id', requirementController.updateRequirement);
router.patch('/requirements/:id/stage', requirementController.updateRequirementStage);
router.post('/requirements/:id/public-form', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'squadpipe-agency';
    const { enabled, regenerateToken, publicDescription } = req.body || {};
    const updated = await publicIntakeService.toggleRequirementPublicForm({
      requirementId: req.params.id,
      tenantId,
      ...(enabled !== undefined ? { enabled: Boolean(enabled) } : {}),
      ...(regenerateToken !== undefined ? { regenerateToken: Boolean(regenerateToken) } : {}),
      ...(publicDescription !== undefined ? { publicDescription } : {}),
    });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    const status = error?.statusCode || 500;
    res.status(status).json({
      success: false,
      message: error?.message || 'Failed to update public form settings',
    });
  }
});
router.delete('/requirements/:id', requireRole(LEADERSHIP_ROLES), requirementController.deleteRequirement);

// Submissions (Candidates / Applicants to Requirement — One-to-Many)
router.get('/submissions/duplicate-check', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'squadpipe-agency';
    const requirementId = String(req.query.requirementId || '').trim();
    const rawCandidateIds = String(req.query.candidateIds || '').trim();
    const candidateIds = rawCandidateIds
      ? rawCandidateIds.split(',').map((id) => id.trim()).filter(Boolean)
      : [];

    if (!requirementId) {
      return res.status(400).json({ success: false, message: 'requirementId query param is required' });
    }

    const result = await submissionService.checkClientDuplicates({
      tenantId,
      requirementId,
      candidateIds,
    });

    res.json({ success: true, data: result });
  } catch (error: any) {
    const status = error?.statusCode || 500;
    res.status(status).json({
      success: false,
      message: error.message || 'Failed to check duplicate client submissions',
    });
  }
});

router.post('/submissions', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'squadpipe-agency';
    const recruiterId = req.user?.id;
    const {
      requirementId,
      candidateId,
      candidateIds,
      pitchEmailSubject,
      pitchEmailBody,
      pitchTone,
    } = req.body;

    const result = await submissionService.attachCandidates({
      tenantId,
      recruiterId,
      requirementId,
      candidateId,
      candidateIds,
      pitchEmailSubject,
      pitchEmailBody,
      pitchTone,
    });

    res.status(result.statusCode).json({
      success: true,
      data: result.data,
      submissions: result.createdSubmissions,
      requirement: result.requirement,
      addedCount: result.addedCount,
      skippedDuplicatesCount: result.skippedDuplicatesCount,
    });
  } catch (error: any) {
    const status = error?.statusCode || 500;
    res.status(status).json({ success: false, message: error.message || 'Submission failed' });
  }
});

router.patch('/submissions/:id/stage', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'squadpipe-agency';
    const { id } = req.params;
    const { stage, status, interviewDate, interviewNotes } = req.body;
    const stageInput = stage || status;

    const result = await submissionService.updateSubmissionStage({
      submissionId: id,
      tenantId,
      stageInput,
      interviewDate,
      interviewNotes,
    });

    res.json({
      success: true,
      data: result.submission,
      requirement: result.requirement,
    });
  } catch (error: any) {
    const status = error?.statusCode || 500;
    res.status(status).json({ success: false, message: error.message || 'Failed to update applicant stage' });
  }
});

router.patch('/submissions/:id/notes', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'squadpipe-agency';
    const { id } = req.params;
    const { interviewDate, interviewNotes, stage, status, action, noteId, noteText } = req.body;
    const stageInput = stage || status;

    const result = await submissionService.updateSubmissionNotes({
      submissionId: id,
      tenantId,
      interviewDate,
      interviewNotes,
      stageInput,
      action,
      noteId,
      noteText,
      authorId: req.user?.id,
      authorName: req.user?.fullName,
    });

    res.json({
      success: true,
      data: result.submission,
      requirement: result.requirement,
    });
  } catch (error: any) {
    const status = error?.statusCode || 500;
    res.status(status).json({ success: false, message: error.message || 'Failed to save applicant notes' });
  }
});

router.post('/submissions/:id/evaluate', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'squadpipe-agency';
    const updatedSubmission = await capabilityService.evaluateSubmission(
      req.params.id,
      tenantId,
      {
        rateMasked: Boolean(req.user?.rateMasked),
        userId: req.user?.id,
      }
    );
    res.json({ success: true, data: updatedSubmission });
  } catch (error: any) {
    const status = error?.statusCode || 500;
    res.status(status).json({
      success: false,
      message: error?.message || 'Failed to evaluate submission capability',
    });
  }
});

router.post('/submissions/:id/pitch-draft', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'squadpipe-agency';
    const { pitchTone, tone, purpose } = req.body || {};
    const draft = await pitchDraftService.draftForSubmission({
      submissionId: req.params.id,
      tenantId,
      userId: req.user?.id,
      pitchTone: pitchTone || tone,
      purpose,
      rateMasked: Boolean(req.user?.rateMasked),
    });
    res.json({ success: true, data: draft });
  } catch (error: any) {
    const status = error?.statusCode || 500;
    res.status(status).json({
      success: false,
      message: error?.message || 'Failed to generate client pitch draft',
    });
  }
});

router.delete('/submissions/:id', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'squadpipe-agency';
    const result = await submissionService.detachSubmission({
      submissionId: req.params.id,
      tenantId,
    });

    res.json({
      success: true,
      message: 'Applicant detached from requirement',
      data: result,
    });
  } catch (error: any) {
    const status = error?.statusCode || 500;
    res.status(status).json({ success: false, message: error.message || 'Failed to detach applicant' });
  }
});

// Clients & Vendors
router.get('/clients', clientController.getClients);
router.post('/clients', clientController.createClient);
router.put('/clients/:id', clientController.updateClient);
router.post('/clients/:id/contacts', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'squadpipe-agency';
    const client = await prisma.client.findUnique({ where: { id: req.params.id } });
    if (!client || client.tenantId !== tenantId) {
      return res.status(404).json({ success: false, message: 'Client account not found' });
    }
    const { fullName, name, designation, role, email, phone, isPrimary } = req.body;
    const contact = await prisma.clientContact.create({
      data: {
        clientId: client.id,
        fullName: (fullName || name || 'Hiring Manager').trim(),
        designation: (designation || role || 'Hiring Manager').trim(),
        email: (email || '').trim().toLowerCase(),
        phone: (phone || '').trim(),
        isPrimary: Boolean(isPrimary)
      }
    });
    res.status(201).json({ success: true, data: contact });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to add client contact' });
  }
});
router.delete('/clients/:id', requireRole([UserRole.ADMINISTRATOR]), clientController.deleteClient);
router.get('/vendors', clientController.getVendors);
router.post('/vendors', clientController.createVendor);
router.put('/vendors/:id', clientController.updateVendor);
router.delete('/vendors/:id', requireRole([UserRole.ADMINISTRATOR]), clientController.deleteVendor);

// SMTP Email Dispatch
router.post('/smtp/send', emailRateLimiter, async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'squadpipe-agency';
    const {
      to,
      recipientEmail,
      recipientName,
      subject,
      html,
      bodyHtml,
      candidateName,
      requirementTitle,
      clientName,
      rate,
      workAuth,
      location
    } = req.body;

    const targetEmail = (to || recipientEmail || '').trim();
    if (!targetEmail) {
      return res.status(400).json({ success: false, message: 'Recipient email address is required.' });
    }

    const { general } = await getTenantSettings(tenantId);
    const brandName = (general.agencyName || general.legalEntityName || req.user?.agencyName || 'Staffing Agency').trim();

    const customSubject =
      typeof subject === 'string' && subject.trim()
        ? subject.replace(/[\r\n]+/g, ' ').trim()
        : undefined;
    const renderedSubmission = renderSubmissionEmail({
      brandName,
      recipientName: recipientName || 'Hiring Team',
      requirementTitle: requirementTitle || 'Open Requisition',
      clientName: clientName || 'your organization',
      candidateName: candidateName || 'N/A',
      workAuth: workAuth || 'Authorized',
      rate: rate || 'Competitive',
      location: location || 'Remote / Hybrid',
      senderName: req.user?.fullName || 'Recruitment Team',
      subject: customSubject,
    });
    const resolvedSubject = renderedSubmission.subject;
    const rawCustomHtml = html || bodyHtml;
    const resolvedHtml = rawCustomHtml
      ? sanitizeEmailHtml(String(rawCustomHtml))
      : renderedSubmission.html;

    const result = await smtpService.sendMail({
      to: targetEmail,
      recipientName,
      subject: resolvedSubject,
      html: resolvedHtml,
      tenantId,
      replyTo: typeof req.body?.replyTo === 'string' ? req.body.replyTo : req.user?.email,
    });

    if (!result.success) {
      const isUnconfigured = (result as any).code === 'SMTP_NOT_CONFIGURED';
      return res.status(400).json({
        success: false,
        delivered: false,
        configured: !isUnconfigured,
        code: isUnconfigured ? 'SMTP_NOT_CONFIGURED' : 'SMTP_SEND_FAILED',
        message:
          result.error ||
          (isUnconfigured
            ? 'Email (SMTP) is not configured. Please configure your SMTP settings in Settings → Email Setup (SMTP) to dispatch emails.'
            : 'Failed to dispatch email via SMTP.'),
        data: result,
      });
    }

    res.json({
      success: true,
      delivered: true,
      configured: true,
      message: `Submission email sent to ${targetEmail}`,
      data: result
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to dispatch email' });
  }
});

// Placements (commercial financial rate clearance required for mutations)
router.get('/placements', placementController.getPlacements);
router.post('/placements', requireUnmaskedRates, placementController.createPlacement);
router.put('/placements/:id', requireUnmaskedRates, placementController.updatePlacement);
router.post('/placements/:id/extend', requireUnmaskedRates, placementController.extendPlacement);
router.delete('/placements/:id', requireRole([UserRole.ADMINISTRATOR]), requireUnmaskedRates, placementController.deletePlacement);

// Users & Roles
router.get('/users', userController.getUsers);
router.post('/users/invite', requireRole([UserRole.ADMINISTRATOR]), userController.inviteUser);
router.put('/users/:id', requireRole([UserRole.ADMINISTRATOR]), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'squadpipe-agency';
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user || user.tenantId !== tenantId) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const { name, fullName, email, role, desk, rateMasked, status } = req.body;
    const roleMap: Record<string, any> = {
      Administrator: 'ADMINISTRATOR',
      ADMINISTRATOR: 'ADMINISTRATOR',
      'Senior Recruiter': 'SENIOR_RECRUITER',
      SENIOR_RECRUITER: 'SENIOR_RECRUITER',
      'Technical Recruiter': 'TECHNICAL_RECRUITER',
      TECHNICAL_RECRUITER: 'TECHNICAL_RECRUITER',
      'Bench Sales Lead': 'BENCH_SALES_LEAD',
      BENCH_SALES_LEAD: 'BENCH_SALES_LEAD',
      'Account Executive': 'ACCOUNT_EXECUTIVE',
      ACCOUNT_EXECUTIVE: 'ACCOUNT_EXECUTIVE',
      'Associate Recruiter': 'ASSOCIATE_RECRUITER',
      ASSOCIATE_RECRUITER: 'ASSOCIATE_RECRUITER',
    };
    const statusMap: Record<string, any> = {
      Active: 'ACTIVE',
      ACTIVE: 'ACTIVE',
      Suspended: 'SUSPENDED',
      SUSPENDED: 'SUSPENDED',
      Invited: 'INVITED',
      INVITED: 'INVITED',
    };

    const resolvedNextStatus = status && statusMap[status] ? statusMap[status] : undefined;
    const isSuspending = resolvedNextStatus === 'SUSPENDED' && user.status !== 'SUSPENDED';

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(fullName || name ? { fullName: String(fullName || name).trim() } : {}),
        ...(email ? { email: String(email).trim().toLowerCase() } : {}),
        ...(role && roleMap[role] ? { role: roleMap[role] } : {}),
        ...(desk !== undefined ? { desk: String(desk).trim() } : {}),
        ...(rateMasked !== undefined ? { rateMasked: Boolean(rateMasked) } : {}),
        ...(resolvedNextStatus ? { status: resolvedNextStatus } : {}),
        ...(isSuspending ? { tokenVersion: { increment: 1 } } : {}),
      },
      select: {
        id: true,
        tenantId: true,
        fullName: true,
        email: true,
        role: true,
        desk: true,
        rateMasked: true,
        workload: true,
        status: true,
      },
    });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to update user' });
  }
});
router.patch('/users/:id/rate-mask', requireRole([UserRole.ADMINISTRATOR]), userController.toggleUserRateMask);
router.patch('/users/:id/status', requireRole([UserRole.ADMINISTRATOR]), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'squadpipe-agency';
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user || user.tenantId !== tenantId) return res.status(404).json({ success: false, message: 'User not found' });
    if (req.user?.id === user.id) {
      return res.status(400).json({ success: false, message: 'Cannot suspend your own active administrator account.' });
    }
    const nextStatus = user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        status: nextStatus,
        ...(nextStatus === 'SUSPENDED' ? { tokenVersion: { increment: 1 } } : {}),
      },
      select: { id: true, fullName: true, status: true }
    });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to update user status' });
  }
});
router.delete('/users/:id', requireRole([UserRole.ADMINISTRATOR]), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'squadpipe-agency';
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user || user.tenantId !== tenantId) return res.status(404).json({ success: false, message: 'User not found' });
    if (req.user?.id === user.id) {
      return res.status(400).json({ success: false, message: 'Cannot delete your own administrator account.' });
    }
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'User removed successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to delete user' });
  }
});

// Custom Fields
router.get('/custom-fields', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'squadpipe-agency';
    const { search, scope, entity, page, limit } = req.query;
    const where: any = { tenantId };

    const rawScope = String(scope || entity || '').trim().toUpperCase();
    if (rawScope && rawScope !== 'ALL') {
      where.entity = rawScope;
    }

    const q = search ? String(search).trim() : '';
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { key: { contains: q, mode: 'insensitive' } },
      ];
    }

    const parsedPage = page ? Math.max(1, parseInt(String(page), 10) || 1) : undefined;
    const parsedLimit = limit ? Math.max(1, Math.min(100, parseInt(String(limit), 10) || 10)) : undefined;

    if (parsedPage === undefined && parsedLimit === undefined) {
      const fields = await prisma.customFieldDefinition.findMany({
        where,
        orderBy: { createdAt: 'desc' }
      });
      return res.json({
        success: true,
        data: fields,
        pagination: { page: 1, limit: fields.length || 10, total: fields.length, totalPages: 1 }
      });
    }

    const currentPage = parsedPage || 1;
    const currentLimit = parsedLimit || 10;
    const [total, fields] = await Promise.all([
      prisma.customFieldDefinition.count({ where }),
      prisma.customFieldDefinition.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (currentPage - 1) * currentLimit,
        take: currentLimit
      })
    ]);

    res.json({
      success: true,
      data: fields,
      pagination: {
        page: currentPage,
        limit: currentLimit,
        total,
        totalPages: Math.max(1, Math.ceil(total / currentLimit))
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch custom fields' });
  }
});
router.post('/custom-fields', requireRole([UserRole.ADMINISTRATOR]), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'squadpipe-agency';
    const { name, entity, type, options, required } = req.body;
    const key = name.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now();
    const entityUpper = (entity || 'CONSULTANT').toUpperCase();
    const typeUpper = (type || 'TEXT').toUpperCase().replace(/[\s\(\$)]/g, '');

    const created = await prisma.customFieldDefinition.create({
      data: {
        tenantId,
        name,
        key,
        entity: (entityUpper as any),
        type: (['TEXT', 'DROPDOWN', 'DATE', 'NUMBER', 'BOOLEAN'].includes(typeUpper) ? typeUpper : 'TEXT') as any,
        options: options ? { values: options } : undefined,
        required: !!required,
        active: true
      }
    });
    res.status(201).json({ success: true, data: created });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to create custom field' });
  }
});
router.put('/custom-fields/:id', requireRole([UserRole.ADMINISTRATOR]), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'squadpipe-agency';
    const existing = await prisma.customFieldDefinition.findFirst({
      where: { id: req.params.id, tenantId },
    });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Custom field not found' });
    }
    const { name, entity, type, options, required, active } = req.body;
    const entityUpper = entity ? String(entity).toUpperCase() : undefined;
    const typeUpper = type ? String(type).toUpperCase().replace(/[\s\(\$)]/g, '') : undefined;

    const updated = await prisma.customFieldDefinition.update({
      where: { id: existing.id },
      data: {
        ...(name !== undefined ? { name: String(name).trim() } : {}),
        ...(entityUpper ? { entity: entityUpper as any } : {}),
        ...(typeUpper
          ? { type: (['TEXT', 'DROPDOWN', 'DATE', 'NUMBER', 'BOOLEAN'].includes(typeUpper) ? typeUpper : 'TEXT') as any }
          : {}),
        ...(options !== undefined ? { options: options ? { values: options } : undefined } : {}),
        ...(required !== undefined ? { required: Boolean(required) } : {}),
        ...(active !== undefined ? { active: Boolean(active) } : {}),
      },
    });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to update custom field' });
  }
});
router.delete('/custom-fields/:id', requireRole([UserRole.ADMINISTRATOR]), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'squadpipe-agency';
    const existing = await prisma.customFieldDefinition.findFirst({
      where: { id: req.params.id, tenantId },
    });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Custom field not found' });
    }
    await prisma.customFieldDefinition.delete({ where: { id: existing.id } });
    res.json({ success: true, message: 'Custom field deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to delete custom field' });
  }
});

// Master Dropdown Taxonomies (Add, Edit, Remove)
const mapTaxonomyCategory = (category?: string): 'WORK_AUTH' | 'PAYMENT_TERMS' | 'EDUCATION' | 'STAGES' | null => {
  const map: Record<string, 'WORK_AUTH' | 'PAYMENT_TERMS' | 'EDUCATION' | 'STAGES'> = {
    workAuth: 'WORK_AUTH',
    WORK_AUTH: 'WORK_AUTH',
    paymentTerms: 'PAYMENT_TERMS',
    PAYMENT_TERMS: 'PAYMENT_TERMS',
    education: 'EDUCATION',
    EDUCATION: 'EDUCATION',
    stages: 'STAGES',
    STAGES: 'STAGES',
  };
  return (category && map[category]) || null;
};

router.get('/taxonomies', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'squadpipe-agency';
    const allRows = await prisma.masterTaxonomy.findMany({
      where: { tenantId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    const existingKeySet = new Set(allRows.map((r) => `${r.category}:${r.optionValue}`));
    const missingDefaults = DEFAULT_TAXONOMIES.filter(
      (d) => !existingKeySet.has(`${d.category}:${d.optionValue}`)
    ).map((d) => ({
      ...d,
      tenantId,
    }));

    let rows = allRows.filter((r) => r.active);
    if (missingDefaults.length > 0) {
      await prisma.masterTaxonomy.createMany({
        data: missingDefaults,
        skipDuplicates: true,
      });
      rows = await prisma.masterTaxonomy.findMany({
        where: { tenantId, active: true },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      });
    }

    const grouped = {
      workAuth: rows.filter((r) => r.category === 'WORK_AUTH').map((r) => r.optionValue),
      paymentTerms: rows.filter((r) => r.category === 'PAYMENT_TERMS').map((r) => r.optionValue),
      education: rows.filter((r) => r.category === 'EDUCATION').map((r) => r.optionValue),
      stages: rows.filter((r) => r.category === 'STAGES').map((r) => r.optionValue),
    };

    res.json({ success: true, data: grouped, items: rows });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch taxonomies' });
  }
});

router.post('/taxonomies', requireRole([UserRole.ADMINISTRATOR]), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'squadpipe-agency';
    const mappedCat = mapTaxonomyCategory(req.body.category);
    const trimmed = String(req.body.optionValue || '').trim();
    if (!mappedCat || !trimmed) {
      return res.status(400).json({ success: false, message: 'Valid category and optionValue are required' });
    }
    const item = await prisma.masterTaxonomy.upsert({
      where: { tenantId_category_optionValue: { tenantId, category: mappedCat, optionValue: trimmed } },
      update: { active: true },
      create: { tenantId, category: mappedCat, optionValue: trimmed, active: true },
    });
    res.status(201).json({ success: true, data: item });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to add taxonomy option' });
  }
});

router.put('/taxonomies', requireRole([UserRole.ADMINISTRATOR]), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'squadpipe-agency';
    const mappedCat = mapTaxonomyCategory(req.body.category);
    const oldValue = String(req.body.oldValue || '').trim();
    const newValue = String(req.body.newValue || '').trim();
    if (!mappedCat || !oldValue || !newValue) {
      return res.status(400).json({ success: false, message: 'Valid category, oldValue, and newValue are required' });
    }
    await prisma.masterTaxonomy.updateMany({
      where: { tenantId, category: mappedCat, optionValue: oldValue },
      data: { optionValue: newValue },
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to update taxonomy option' });
  }
});

router.delete('/taxonomies', requireRole([UserRole.ADMINISTRATOR]), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'squadpipe-agency';
    const category = (req.body?.category ?? req.query?.category) as string | undefined;
    const optionValue = (req.body?.optionValue ?? req.query?.optionValue) as string | undefined;
    const mappedCat = mapTaxonomyCategory(category);
    const trimmed = String(optionValue || '').trim();
    if (!mappedCat || !trimmed) {
      return res.status(400).json({ success: false, message: 'Valid category and optionValue are required' });
    }
    await prisma.masterTaxonomy.updateMany({
      where: { tenantId, category: mappedCat, optionValue: trimmed },
      data: { active: false },
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to delete taxonomy option' });
  }
});

// Automations & Audits (workspace rule configuration restricted to Administrators)
router.get('/automations/rules', automationController.getAutomationRules);
router.post('/automations/rules/seed-defaults', requireRole([UserRole.ADMINISTRATOR]), automationController.seedDefaultAutomationRules);
router.post('/automations/rules', requireRole([UserRole.ADMINISTRATOR]), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'squadpipe-agency';
    const { name, category, triggerEvent, icon, color, whenText, threshold, thenSummary, actionPills } = req.body;
    const catUpper = String(category || 'CUSTOM').toUpperCase();
    const validCategories = ['FEEDBACK', 'INTERVIEW', 'STALE_REQ', 'CONTRACT', 'COMPLIANCE', 'CUSTOM'];
    const normalizedCategory = validCategories.includes(catUpper) ? catUpper : 'CUSTOM';

    const triggerMap: Record<string, string> = {
      FEEDBACK: 'FEEDBACK_DELAYED',
      INTERVIEW: 'INTERVIEW_TODAY',
      STALE_REQ: 'STALE_REQ',
      CONTRACT: 'CONTRACT_ENDING',
      COMPLIANCE: 'VISA_EXPIRING',
      CUSTOM: 'CUSTOM',
    };
    const defaultIconMap: Record<string, string> = {
      FEEDBACK: 'fa-solid fa-comments',
      INTERVIEW: 'fa-solid fa-calendar-check',
      STALE_REQ: 'fa-solid fa-briefcase',
      CONTRACT: 'fa-solid fa-file-contract',
      COMPLIANCE: 'fa-solid fa-shield-halved',
      CUSTOM: 'fa-solid fa-bolt',
    };
    const defaultColorMap: Record<string, string> = {
      FEEDBACK: 'amber',
      INTERVIEW: 'blue',
      STALE_REQ: 'rose',
      CONTRACT: 'purple',
      COMPLIANCE: 'emerald',
      CUSTOM: 'amber',
    };

    const rule = await prisma.automationRule.create({
      data: {
        tenantId,
        name,
        category: normalizedCategory as any,
        triggerEvent: (triggerEvent || triggerMap[normalizedCategory] || 'CUSTOM') as any,
        icon: icon || defaultIconMap[normalizedCategory] || 'fa-solid fa-bolt',
        color: color || defaultColorMap[normalizedCategory] || 'amber',
        whenText: whenText || '',
        threshold: threshold || 'Immediate',
        thenSummary: thenSummary || '',
        actions: actionPills || [],
        createdById: req.user?.id,
        active: true
      }
    });
    res.status(201).json({ success: true, data: rule });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to create rule' });
  }
});
router.patch('/automations/rules/:id/toggle', requireRole([UserRole.ADMINISTRATOR]), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'squadpipe-agency';
    const rule = await prisma.automationRule.findFirst({ where: { id: req.params.id, tenantId } });
    if (!rule) return res.status(404).json({ success: false, message: 'Rule not found' });
    const updated = await prisma.automationRule.update({
      where: { id: rule.id },
      data: { active: !rule.active }
    });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to toggle rule' });
  }
});
router.patch('/automations/rules/:id', requireRole([UserRole.ADMINISTRATOR]), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'squadpipe-agency';
    const rule = await prisma.automationRule.findFirst({ where: { id: req.params.id, tenantId } });
    if (!rule) return res.status(404).json({ success: false, message: 'Rule not found' });

    const { threshold, whenText, thenSummary, name, active, category, triggerEvent, actionPills } = req.body;
    const catUpper = category ? String(category).toUpperCase() : undefined;
    const validCategories = ['FEEDBACK', 'INTERVIEW', 'STALE_REQ', 'CONTRACT', 'COMPLIANCE', 'CUSTOM'];

    const updated = await prisma.automationRule.update({
      where: { id: rule.id },
      data: {
        ...(threshold !== undefined ? { threshold } : {}),
        ...(whenText !== undefined ? { whenText } : {}),
        ...(thenSummary !== undefined ? { thenSummary } : {}),
        ...(name !== undefined ? { name } : {}),
        ...(active !== undefined ? { active: Boolean(active) } : {}),
        ...(catUpper && validCategories.includes(catUpper) ? { category: catUpper as any } : {}),
        ...(triggerEvent !== undefined ? { triggerEvent: triggerEvent as any } : {}),
        ...(actionPills !== undefined ? { actions: actionPills } : {}),
      }
    });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to update rule' });
  }
});
router.delete('/automations/rules/:id', requireRole([UserRole.ADMINISTRATOR]), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'squadpipe-agency';
    const rule = await prisma.automationRule.findFirst({ where: { id: req.params.id, tenantId } });
    if (!rule) return res.status(404).json({ success: false, message: 'Rule not found' });
    await prisma.automationRule.delete({ where: { id: rule.id } });
    res.json({ success: true, message: 'Automation rule deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to delete rule' });
  }
});
router.post('/automations/rules/:id/test', automationController.testTriggerRule);
router.get('/automations/audit-logs', automationController.getAutomationAuditLogs);

// SLA Tasks
router.get('/sla-tasks', slaController.getSlaTasks);
router.post('/sla-tasks/evaluate', slaController.evaluateSlaRadar);
router.patch('/sla-tasks/:id/complete', slaController.completeSlaTask);

// Workspace General & AI Usage Settings
router.get('/settings', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'squadpipe-agency';
    const [settings, aiCapabilities] = await Promise.all([
      getTenantSettings(tenantId),
      aiUsageService.getEffectivePublicAiCapabilities(tenantId),
    ]);

    res.json({
      success: true,
      data: {
        general: settings.general,
        ai: aiCapabilities,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to load settings' });
  }
});

router.get('/settings/ai-usage', requireRole([UserRole.ADMINISTRATOR]), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'squadpipe-agency';
    const summary = await aiUsageService.getMonthlyUsageSummary(tenantId);
    res.json({ success: true, data: summary });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to load AI usage metrics' });
  }
});

router.put('/settings/ai-config', requireRole([UserRole.ADMINISTRATOR]), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'squadpipe-agency';
    const byo = await aiUsageService.saveTenantAiConfig(tenantId, req.body || {});
    const [summary, aiCapabilities] = await Promise.all([
      aiUsageService.getMonthlyUsageSummary(tenantId),
      aiUsageService.getEffectivePublicAiCapabilities(tenantId),
    ]);
    res.json({
      success: true,
      data: {
        byo,
        summary,
        ai: aiCapabilities,
      },
      message: 'AI usage & provider settings updated',
    });
  } catch (error: any) {
    const status = error?.statusCode || 500;
    res.status(status).json({
      success: false,
      message: error?.message || 'Failed to save AI configuration',
    });
  }
});

router.put('/settings/general', requireRole([UserRole.ADMINISTRATOR]), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'squadpipe-agency';
    const updated = await saveGeneralSettings(tenantId, req.body || {});
    res.json({ success: true, data: updated, message: 'General settings updated' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to save general settings' });
  }
});

export default router;
