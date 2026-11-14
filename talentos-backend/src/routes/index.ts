import { Router, Request, Response } from 'express';
import multer from 'multer';
import { placementService } from '../services/placement.service';
import { submissionService } from '../services/submission.service';
import { csvImporterService } from '../services/csvImporter.service';
import { resumeParserClientService } from '../services/resumeParserClient.service';
import { smtpService } from '../services/smtp.service';
import {
  getTenantSettings,
  isSmtpConfigured,
  redactSmtpSettings,
  saveGeneralSettings,
  saveSmtpSettings,
} from '../config/smtp.config';
import { DEFAULT_TAXONOMIES } from '../config/taxonomies.config';
import { prisma } from '../config/prisma.config';
import { authenticateJwt, requireRole } from '../middlewares/auth.middleware';
import { rateMaskMiddleware } from '../middlewares/rateMask.middleware';
import {
  authRateLimiter,
  emailRateLimiter,
  sensitiveAuthRateLimiter,
  uploadRateLimiter,
} from '../middlewares/security.middleware';
import { escapeHtml, sanitizeEmailHtml } from '../utils/cryptoSecret';
import { slaEngineService } from '../services/slaEngine.service';
import { automationEngineService } from '../services/automationEngine.service';
import { AutomationCategory, SlaCategory, UserRole } from '@prisma/client';

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
    res.json({ success: true, service: 'talentos-backend', status: 'operational', database: 'connected' });
  } catch {
    res.status(503).json({
      success: false,
      service: 'talentos-backend',
      status: 'degraded',
      database: 'disconnected',
    });
  }
});

router.post('/auth/signup', authRateLimiter, authController.signup);
router.post('/auth/login', authRateLimiter, authController.login);
router.post('/auth/forgot-password', sensitiveAuthRateLimiter, authController.forgotPassword);
router.post('/auth/reset-password', sensitiveAuthRateLimiter, authController.resetPassword);

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
    const tenantId = req.user?.tenantId || 'talentos-agency';
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

// Sidebar navigation counts (fast, lightweight aggregate query)
router.get('/sidebar/counts', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'talentos-agency';
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
      prisma.placement.count({ where: { tenantId } }),
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
router.get('/candidates', candidateController.getCandidates);
router.post('/candidates', uploadRateLimiter, optionalSingleCvUpload, candidateController.createCandidate);
router.get('/candidates/:id', candidateController.getCandidateById);
router.put('/candidates/:id', uploadRateLimiter, optionalSingleCvUpload, candidateController.updateCandidate);
router.post('/candidates/:id/cv', uploadRateLimiter, optionalSingleCvUpload, candidateController.uploadCandidateCv);
router.get('/candidates/:id/cv', candidateController.downloadCandidateCv);
router.patch('/candidates/:id/stage', candidateController.updateCandidate);
router.delete('/candidates/:id', candidateController.deleteCandidate);
router.post('/candidates/csv-import', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'talentos-agency';
    const recruiterId = req.user?.id;
    const rows = Array.isArray(req.body) ? req.body : req.body.rows || [];
    const results = await csvImporterService.importCandidates(rows, tenantId, recruiterId);
    res.json({ success: true, count: results.length, data: results });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'CSV Import failed' });
  }
});

// NLP & AI Endpoints (FastAPI Bridge)
router.post('/parse-resume', uploadRateLimiter, upload.single('file'), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, message: 'No resume file uploaded.' });
    }

    try {
      const formData = new FormData();
      const blob = new Blob([new Uint8Array(file.buffer)], { type: file.mimetype || 'application/octet-stream' });
      formData.append('file', blob, file.originalname);
      const parsed = await resumeParserClientService.parseResume(formData);
      return res.json(parsed);
    } catch (upstreamError) {
      // Fallback text/regex extraction when microservice is unavailable
      const rawText = file.buffer.toString('utf8').replace(/[^\x20-\x7E\r\n]/g, ' ').replace(/\s+/g, ' ').trim();
      const emailMatch = rawText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      const phoneMatch = rawText.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
      const baseName = file.originalname.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\bresume\b/i, '').trim() || 'Uploaded Candidate';
      const commonSkills = ['React', 'TypeScript', 'JavaScript', 'Node.js', 'Python', 'Java', 'Spring Boot', 'AWS', 'Kubernetes', 'Docker', 'Terraform', 'SQL', 'PostgreSQL', 'MongoDB', 'Go', 'C#', '.NET', 'Kafka', 'PySpark', 'Snowflake'];
      const extractedSkills = commonSkills.filter((skill) => new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(rawText));

      return res.json({
        full_name: baseName,
        email: emailMatch ? emailMatch[0] : `${baseName.toLowerCase().replace(/\s+/g, '.')}@candidate.io`,
        phone: phoneMatch ? phoneMatch[0] : '+1 (555) 000-0000',
        work_auth: /\bUS\s*Citizen\b/i.test(rawText) ? 'US Citizen' : /\bGreen\s*Card\b/i.test(rawText) ? 'Green Card' : /\bH-?1B\b/i.test(rawText) ? 'H-1B' : 'Authorized to Work',
        current_title: 'Senior Software Consultant',
        skills: extractedSkills.length > 0 ? extractedSkills : ['Full Stack Engineering', 'Cloud Architecture'],
        hourly_rate: '$95/hr (C2C)',
        relocation: /\brelocate|open\b/i.test(rawText) ? 'Open' : 'Remote / Negotiable',
        page_count: 2,
        confidence_score: 0.78,
        raw_text_snippet: rawText.slice(0, 8000) || `Extracted from uploaded file: ${file.originalname}`
      });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Resume parsing failed' });
  }
});

router.post('/parse-email', async (req: Request, res: Response) => {
  const rawEmailText = String(req.body.rawEmailText || req.body.text || '');

  const cleanField = (val?: any) =>
    String(val || '')
      .replace(/\*+/g, '')
      .replace(/[_`~]+/g, '')
      .replace(/^[\s:•\-–—]+|[\s*]+$/g, '')
      .trim();

  const extractEmailHeuristics = (rawText: string) => {
    const text = rawText.replace(/\*\*/g, '').replace(/__/g, '');
    const lines = text.split(/\r?\n/).map((l) => cleanField(l));
    const cleanCompany = (val?: string) =>
      cleanField(val)
        .replace(/\s+(?:Location|Position|Job\s*Title|Role|Work\s*Model)\s*:[\s\S]*$/i, '')
        .replace(/[.,;]+$/, '')
        .trim();

    const companyLine = text.match(/(?:Target\s*Company|Company(?:\s*Name)?|Client(?:\s*Company)?|Organization)\s*:\s*([^\n\r]+)/i);
    const managerFromCompany = text.match(/(?:hiring\s*manager|contact)\s+is\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\s+(?:from|at|with)\s+([A-Z][A-Za-z0-9&\s.-]{1,50}?)(?:\.|,|\n|$)/i);
    const atCompany = text.match(/(?:\bat|\bfrom)\s+([A-Z][A-Za-z0-9&\s.-]{1,40}?)(?:\s*\(|,|\s+for\b|\s+in\b|\s+is\b|\s+He\b|\s+She\b|\.|\n|$)/);
    const contactLine = text.match(/(?:From|Hiring\s*Manager|Contact(?:\s*Name)?)\s*:\s*([^<\n\r]+?)(?:<|$)/i);
    const emailMatch = text.match(/<([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>/) || text.match(/\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/);
    const subjectLine = text.match(/Subject:\s*(?:Urgent:|Contract:|Open Req:|Requisition:)?\s*([^\n\r]+)/i);
    const jobTitleLine = text.match(/(?:Job\s*Title|Position(?:\s*Title)?|Opportunity(?:\s*Title)?|Role(?:\s*Title)?|Opening)\s*:\s*([^\n\r]+)/i);
    const conversationalRole = text.match(/(?:join\s+(?:their|our|the)\s+team\s+as\s+(?:a|an)\s+|looking\s+for\s+(?:a|an)\s+|seeking\s+(?:a|an)\s+|hiring\s+(?:a|an)\s+)([A-Za-z][A-Za-z0-9\s/&+-]{2,50}?)(?:\.|,|\n|\s+(?:in|at|with|who)\b|$)/i);
    const forRole = text.match(/(?:for|seeking|hiring)\s+(?:a|an)\s+([A-Z][A-Za-z0-9\s/&+-]{3,60}?)(?:\s+at\b|\s+for\b|\s+in\b|\.|\n|$)/i);
    const locationLine = text.match(/(?:Work\s*Location|Location)\s*:\s*([^\n\r]+)/i);
    const basedInLocation = text.match(/(?:based\s+in|located\s+in)\s+([A-Z][A-Za-z.\s,]{2,40}?)(?:\s+but\b|\s+and\b|\.|,|\n|$)/i);
    const cityState = text.match(/\b([A-Z][a-zA-Z\s]{2,25},\s*[A-Z]{2}(?:\s*\([^)\n]+\))?)/);
    const contactTitleLine = text.match(/(?:Contact\s*Title|Designation|Hiring\s*Manager\s*Title|(?:^|\n)\s*Title)\s*:\s*([^\n\r]+)/i);
    const sentenceContactTitle = text.match(/(?:He|She|They)\s+(?:is|are)\s+(?:the|a|an)\s+([A-Za-z][A-Za-z\s/&,-]{2,50}?)(?:\.|,|\n|$)/i);

    const toTitleCase = (s: string) =>
      s.replace(/\b([a-z])([a-z]*)/g, (_, a, b) => a.toUpperCase() + b);

    // Signature extraction (Best regards / Thanks / Sincerely)
    let sigName = '';
    let sigTitle = '';
    let sigCompany = '';
    const sigIdx = lines.findIndex((l) => /^(?:best\s+regards|regards|warm\s+regards|thanks|thank\s+you|sincerely)[,!]?$/i.test(l));
    if (sigIdx !== -1) {
      const afterSig = lines.slice(sigIdx + 1).filter(Boolean);
      if (afterSig[0] && !/@/.test(afterSig[0])) sigName = afterSig[0];
      if (afterSig[1] && !/@|\d{3}[-.\s]\d{3}/.test(afterSig[1])) sigTitle = afterSig[1];
      if (afterSig[2] && !/@|\d{3}[-.\s]\d{3}/.test(afterSig[2])) sigCompany = afterSig[2];
    }

    const billRangeMatch = text.match(/(?:budget|bill(?:ing)?(?:\s*rate)?)[^.\n\r]{0,35}\$\d{2,3}\s*(?:to|-|–)\s*\$?(\d{2,3})/i);
    const billRateMatch = billRangeMatch
      || text.match(/(?:max(?:imum)?\s*bill\s*rate|bill\s*rate|target\s*rate|budget)[^$\d\n\r]{0,30}\$?(\d{2,3})\s*(?:\/hr|per\s*hour|hr\b|hourly)?/i)
      || text.match(/\$(\d{2,3})\s*(?:\/hr|per\s*hour|hr\b|hourly)/i);
    const payRangeMatch = text.match(/(?:pay(?:\s+(?:the\s+\w+\s+)*candidate)?|pay\s*rate|w2\s*rate|c2c\s*rate)[^.\n\r]{0,40}\$\d{2,3}\s*(?:to|-|–)\s*\$?(\d{2,3})/i);
    const payRateMatch = payRangeMatch
      || text.match(/(?:candidate\s*pay\s*rate|pay\s*rate|w2\s*rate|c2c\s*rate|pay[^.\n\r]{0,20})[^$\d\n\r]{0,20}\$(\d{2,3})/i);

    const parsedBillRate = billRateMatch ? parseInt(billRateMatch[1], 10) : 0;
    const parsedPayRate = payRateMatch
      ? parseInt(payRateMatch[1], 10)
      : parsedBillRate > 0
        ? Math.round(parsedBillRate * 0.75)
        : 0;

    let workModel: 'Remote' | 'Hybrid' | 'Onsite' = 'Remote';
    if (/\bhybrid\b/i.test(text)) workModel = 'Hybrid';
    else if (/\bonsite\b|\bon-site\b|\bin[- ]office\b/i.test(text)) workModel = 'Onsite';
    else if (/\bbased in\b/i.test(text) && !/\bremote\b/i.test(text)) workModel = 'Onsite';

    const commonSkills = [
      'Java', 'Spring Boot', 'Kafka', 'AWS', 'Kubernetes', 'Docker', 'Python', 'React', 'TypeScript',
      'Node.js', 'Express', 'MongoDB', 'Snowflake', 'PySpark', 'Databricks', 'Terraform', 'Splunk', 'EDR', 'SIEM', 'SQL', 'Angular',
      'Go', 'Azure', 'GCP', 'dbt', 'Airflow', 'Microservices', 'PostgreSQL', 'GraphQL', 'REST API'
    ];
    const matchedSkills = commonSkills.filter((skill) =>
      new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text)
    );

    const missingParts: string[] = [];
    if (!/\+?\d[\d\s().-]{7,}\d/.test(text)) missingParts.push('direct telephone');
    if (!parsedBillRate) missingParts.push('target bill rate');
    if (!payRateMatch) missingParts.push('explicit pay rate');

    const rawOppTitle = cleanField(
      jobTitleLine?.[1]
      || subjectLine?.[1]
      || (conversationalRole?.[1] ? toTitleCase(conversationalRole[1].trim()) : '')
      || forRole?.[1]
    );

    const rawLocation = cleanField(
      locationLine?.[1]
      || (basedInLocation?.[1] ? (/\bremote\b/i.test(text) ? `${basedInLocation[1].trim()} / Remote` : basedInLocation[1].trim()) : '')
      || cityState?.[1]
      || (workModel === 'Remote' ? 'Remote' : workModel)
    );

    const positionsMatch = text.match(/(?:open\s*positions?|openings?|headcount|positions?\s*open|roles?\s*open|no\.?\s*of\s*positions?)\s*[:\-]?\s*(\d{1,3})\b/i)
      || text.match(/\b(\d{1,3})\s*(?:open\s*positions?|openings?|headcount)\b/i);
    const parsedOpenPositions = positionsMatch
      ? Math.max(1, Math.min(1000, parseInt(positionsMatch[1], 10)))
      : undefined;

    return {
      companyName: cleanCompany(companyLine?.[1] || managerFromCompany?.[2] || sigCompany || atCompany?.[1]),
      opportunityTitle: rawOppTitle,
      openPositions: parsedOpenPositions,
      clientContact: cleanField(contactLine?.[1] || managerFromCompany?.[1] || sigName),
      clientContactEmail: cleanField(emailMatch?.[1]),
      clientContactTitle: cleanField(contactTitleLine?.[1] || sentenceContactTitle?.[1] || sigTitle),
      location: rawLocation,
      workModel,
      targetBillRate: parsedBillRate,
      targetPayRate: parsedPayRate,
      skillsRequired: matchedSkills.join(', '),
      missingNotes: missingParts.length > 0
        ? `Not specified in email: ${missingParts.join(', ')}.`
        : 'All primary intake fields detected from email body.',
    };
  };

  try {
    let parsed: Record<string, any> = {};
    try {
      const result = await resumeParserClientService.parseEmail(rawEmailText.replace(/\*\*/g, ''));
      parsed = result?.data || result || {};
    } catch {
      parsed = {};
    }

    const fallback = extractEmailHeuristics(rawEmailText);
    const billRate = Number(parsed.billRate || parsed.targetBillRate || fallback.targetBillRate || 0);
    const payRate = Number(
      parsed.payRate || parsed.targetPayRate || fallback.targetPayRate || (billRate > 0 ? Math.round(billRate * 0.75) : 0)
    );

    const parsedCompany = cleanField(parsed.companyName || parsed.clientName)
      .replace(/\s+(?:Location|Position|Job\s*Title|Role|Work\s*Model)\s*:[\s\S]*$/i, '')
      .trim();
    const parsedLocation = cleanField(parsed.location);
    const enriched = {
      ...parsed,
      companyName: (parsedCompany && parsedCompany !== 'Not Specified' ? parsedCompany : '') || fallback.companyName,
      opportunityTitle: (cleanField(parsed.opportunityTitle || parsed.jobTitle) || fallback.opportunityTitle),
      openPositions: parsed.openPositions || fallback.openPositions,
      clientContact: cleanField(parsed.clientContact || parsed.contactName) || fallback.clientContact,
      clientContactEmail: cleanField(parsed.clientContactEmail) || fallback.clientContactEmail,
      clientContactTitle: cleanField(parsed.clientContactTitle || parsed.contactTitle) || fallback.clientContactTitle,
      location: parsedLocation && parsedLocation !== 'Remote / Hybrid'
        ? parsedLocation
        : fallback.location || parsedLocation || 'Remote',
      workModel: parsed.workModel || fallback.workModel,
      targetBillRate: billRate,
      targetPayRate: payRate,
      skillsRequired: cleanField(parsed.skillsRequired || (Array.isArray(parsed.skills) ? parsed.skills.join(', ') : '')) || fallback.skillsRequired,
      missingNotes: fallback.missingNotes || cleanField(parsed.missingNotes) || '',
    };

    res.json({ success: true, data: enriched });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Email parse failed' });
  }
});

router.post('/match-skills', async (req: Request, res: Response) => {
  try {
    const { requirementId, skillsRequired, candidates } = req.body;
    const result = await resumeParserClientService.matchSkills(requirementId, skillsRequired, candidates || []);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Skill match failed' });
  }
});

router.post('/generate-pitch', async (req: Request, res: Response) => {
  try {
    const result = await resumeParserClientService.generatePitch(req.body);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Pitch generation failed' });
  }
});

// Requirements
router.get('/requirements', requirementController.getRequirements);
router.post('/requirements', requirementController.createRequirement);
router.put('/requirements/:id', requirementController.updateRequirement);
router.patch('/requirements/:id/stage', requirementController.updateRequirementStage);
router.delete('/requirements/:id', requirementController.deleteRequirement);

// Submissions (Candidates / Applicants to Requirement — One-to-Many)
router.post('/submissions', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'talentos-agency';
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
    const tenantId = req.user?.tenantId || 'talentos-agency';
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

router.delete('/submissions/:id', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'talentos-agency';
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
    const tenantId = req.user?.tenantId || 'talentos-agency';
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
router.delete('/clients/:id', clientController.deleteClient);
router.get('/vendors', clientController.getVendors);
router.post('/vendors', clientController.createVendor);
router.put('/vendors/:id', clientController.updateVendor);
router.delete('/vendors/:id', clientController.deleteVendor);

// SMTP Email Dispatch
router.post('/smtp/send', emailRateLimiter, async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'talentos-agency';
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

    const { general, smtp } = await getTenantSettings(tenantId);
    const brandName = (general.agencyName || general.legalEntityName || req.user?.agencyName || 'Staffing Agency').trim();

    if (!isSmtpConfigured(smtp)) {
      const msg = !smtp.enabled
        ? 'Email dispatch is paused. Please enable Outbound SMTP in Settings → Email Setup (SMTP) to dispatch emails.'
        : 'Email (SMTP) is not configured. Please configure your SMTP settings in Settings → Email Setup (SMTP) to dispatch emails.';
      return res.status(400).json({
        success: false,
        delivered: false,
        configured: false,
        code: 'SMTP_NOT_CONFIGURED',
        message: msg,
      });
    }

    const rawSubject = subject || `Candidate Submission: ${candidateName || 'Consultant'} for ${requirementTitle || 'Role'} (${clientName || 'Client'})`;
    const resolvedSubject = String(rawSubject).replace(/[\r\n]+/g, ' ').trim();
    const rawCustomHtml = html || bodyHtml;
    const resolvedHtml = rawCustomHtml
      ? sanitizeEmailHtml(String(rawCustomHtml))
      : `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b;">
        <p>Hello ${escapeHtml(recipientName || 'Hiring Team')},</p>
        <p>Please review the following consultant profile submitted for <strong>${escapeHtml(requirementTitle || 'Open Requisition')}</strong> at <strong>${escapeHtml(clientName || 'your organization')}</strong>:</p>
        <ul>
          <li><strong>Consultant:</strong> ${escapeHtml(candidateName || 'N/A')}</li>
          <li><strong>Work Authorization:</strong> ${escapeHtml(workAuth || 'Authorized')}</li>
          <li><strong>Bill Rate:</strong> ${escapeHtml(rate || 'Competitive')}</li>
          <li><strong>Location:</strong> ${escapeHtml(location || 'Remote / Hybrid')}</li>
        </ul>
        <p>Best regards,<br/>${escapeHtml(req.user?.fullName || `${brandName} Recruitment Desk`)}<br/>${escapeHtml(brandName)}</p>
      </div>
    `;

    const result = await smtpService.sendMail({
      to: targetEmail,
      recipientName,
      subject: resolvedSubject,
      html: resolvedHtml,
      tenantId
    });

    if (!result.success) {
      const isUnconfigured = (result as any).code === 'SMTP_NOT_CONFIGURED' || !isSmtpConfigured(smtp);
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

// Placements
router.get('/placements', placementController.getPlacements);
router.post('/placements', placementController.createPlacement);
router.put('/placements/:id', placementController.updatePlacement);
router.post('/placements/:id/extend', placementController.extendPlacement);
router.delete('/placements/:id', placementController.deletePlacement);

// Users & Roles
router.get('/users', userController.getUsers);
router.post('/users/invite', requireRole([UserRole.ADMINISTRATOR]), userController.inviteUser);
router.put('/users/:id', requireRole([UserRole.ADMINISTRATOR]), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'talentos-agency';
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
    const tenantId = req.user?.tenantId || 'talentos-agency';
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
    const tenantId = req.user?.tenantId || 'talentos-agency';
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
    const tenantId = req.user?.tenantId || 'talentos-agency';
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
        orderBy: { createdAt: 'asc' }
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
        orderBy: { createdAt: 'asc' },
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
    const tenantId = req.user?.tenantId || 'talentos-agency';
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
    const tenantId = req.user?.tenantId || 'talentos-agency';
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
    const tenantId = req.user?.tenantId || 'talentos-agency';
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
    const tenantId = req.user?.tenantId || 'talentos-agency';
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
    const tenantId = req.user?.tenantId || 'talentos-agency';
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
    const tenantId = req.user?.tenantId || 'talentos-agency';
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
    const tenantId = req.user?.tenantId || 'talentos-agency';
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

// Automations & Audits
router.get('/automations/rules', automationController.getAutomationRules);
router.post('/automations/rules/seed-defaults', automationController.seedDefaultAutomationRules);
router.post('/automations/rules', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'talentos-agency';
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
router.patch('/automations/rules/:id/toggle', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'talentos-agency';
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
router.patch('/automations/rules/:id', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'talentos-agency';
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
router.delete('/automations/rules/:id', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'talentos-agency';
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

// Workspace General & User-Configured SMTP Settings (zero .env dependency)
router.get('/settings', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'talentos-agency';
    const settings = await getTenantSettings(tenantId);
    const isAdmin = req.user?.role === UserRole.ADMINISTRATOR;
    const emailLogs = isAdmin
      ? await prisma.emailLog.findMany({
          where: { tenantId },
          orderBy: { createdAt: 'desc' },
          take: 15,
        })
      : [];

    res.json({
      success: true,
      data: {
        general: settings.general,
        smtp: isAdmin
          ? redactSmtpSettings(settings.smtp)
          : {
              enabled: settings.smtp.enabled,
              host: '',
              port: 587,
              encryption: 'STARTTLS',
              username: '',
              password: '',
              fromName: settings.smtp.fromName,
              fromEmail: '',
              replyToEmail: '',
              hasPassword: false,
              configured: isSmtpConfigured(settings.smtp),
            },
        emailLogs,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to load settings' });
  }
});

router.put('/settings/general', requireRole([UserRole.ADMINISTRATOR]), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'talentos-agency';
    const updated = await saveGeneralSettings(tenantId, req.body || {});
    res.json({ success: true, data: updated, message: 'General settings updated' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to save general settings' });
  }
});

router.put('/settings/smtp', requireRole([UserRole.ADMINISTRATOR]), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'talentos-agency';
    const updated = await saveSmtpSettings(tenantId, req.body || {});
    res.json({ success: true, data: redactSmtpSettings(updated), message: 'SMTP settings saved' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to save SMTP settings' });
  }
});

router.post('/settings/smtp/test', requireRole([UserRole.ADMINISTRATOR]), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'talentos-agency';
    const { recipientEmail, smtp } = req.body || {};
    const targetEmail = String(recipientEmail || '').trim();
    if (!targetEmail) {
      return res.status(400).json({ success: false, message: 'Test recipient email address is required' });
    }
    if (smtp && typeof smtp === 'object') {
      await saveSmtpSettings(tenantId, smtp);
    }
    const { general } = await getTenantSettings(tenantId);
    const brandName = (general.agencyName || general.legalEntityName || req.user?.agencyName || 'Workspace').trim();
    const result = await smtpService.sendMail({
      to: targetEmail,
      subject: `${brandName} Custom SMTP Connection Test`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.6; color: #1e293b;">
          <h3 style="margin: 0 0 8px;">${escapeHtml(brandName)} SMTP Test Successful</h3>
          <p>Your custom outbound SMTP server configuration is active and delivering messages.</p>
          <p style="font-size: 12px; color: #64748b;">Sent from ${escapeHtml(brandName)} Workspace Settings</p>
        </div>
      `,
      tenantId,
    });
    const emailLogs = await prisma.emailLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 15,
    });
    res.json({
      success: true,
      delivered: result.success,
      message: result.success
        ? `Test email delivered to ${targetEmail}`
        : result.error || 'SMTP test delivery failed',
      data: result,
      emailLogs,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'SMTP test failed' });
  }
});

export default router;
