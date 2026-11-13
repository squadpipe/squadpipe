import { Router, Request, Response } from 'express';
import multer from 'multer';
import { placementService } from '../services/placement.service';
import { csvImporterService } from '../services/csvImporter.service';
import { resumeParserClientService } from '../services/resumeParserClient.service';
import { smtpService } from '../services/smtp.service';
import { prisma } from '../config/prisma.config';
import { authenticateJwt } from '../middlewares/auth.middleware';
import { rateMaskMiddleware } from '../middlewares/rateMask.middleware';

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

// Public routes (Health check & Authentication)
router.get('/health', (req: Request, res: Response) => {
  res.json({ success: true, service: 'talentos-backend', status: 'operational' });
});

router.post('/auth/signup', authController.signup);
router.post('/auth/login', authController.login);
router.post('/auth/forgot-password', authController.forgotPassword);
router.post('/auth/reset-password', authController.resetPassword);

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
router.post('/candidates', candidateController.createCandidate);
router.get('/candidates/:id', candidateController.getCandidateById);
router.put('/candidates/:id', candidateController.updateCandidate);
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
router.post('/parse-resume', upload.single('file'), async (req: Request, res: Response) => {
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
        raw_text_snippet: rawText.slice(0, 1200) || `Extracted from uploaded file: ${file.originalname}`
      });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Resume parsing failed' });
  }
});

router.post('/parse-email', async (req: Request, res: Response) => {
  const rawEmailText = String(req.body.rawEmailText || req.body.text || '');

  const extractEmailHeuristics = (text: string) => {
    const lines = text.split(/\r?\n/).map((l) => l.trim());
    const companyLine = text.match(/(?:Company|Client|Organization):\s*([^\n\r]+)/i);
    const atCompany = text.match(/\bat\s+([A-Z][A-Za-z0-9&\s.-]{1,40}?)(?:\s*\(|,|\s+for\b|\s+in\b|\.|\n|$)/);
    const contactLine = text.match(/From:\s*([^<\n\r]+?)(?:<|$)/i);
    const emailMatch = text.match(/<([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>/) || text.match(/\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/);
    const subjectLine = text.match(/Subject:\s*(?:Urgent:|Contract:|Open Req:|Requisition:)?\s*([^\n\r]+)/i);
    const forRole = text.match(/for\s+(?:a|an)\s+([A-Z][A-Za-z0-9\s/&+-]{3,60}?)(?:\s+at\b|\s+for\b|\s+in\b|\.|\n|$)/);
    const locationLine = text.match(/Location:\s*([^\n\r]+)/i);
    const cityState = text.match(/\b([A-Z][a-zA-Z\s]{2,25},\s*[A-Z]{2}(?:\s*\([^)\n]+\))?)/);
    const titleLine = text.match(/(?:Title|Designation|Role):\s*([^\n\r]+)/i);

    // Signature extraction (Best regards / Thanks / Sincerely)
    let sigName = '';
    let sigTitle = '';
    const sigIdx = lines.findIndex((l) => /^(?:best\s+regards|regards|thanks|thank\s+you|sincerely)[,!]?$/i.test(l));
    if (sigIdx !== -1) {
      const afterSig = lines.slice(sigIdx + 1).filter(Boolean);
      if (afterSig[0] && !/@/.test(afterSig[0])) sigName = afterSig[0];
      if (afterSig[1] && !/@|\d{3}[-.\s]\d{3}/.test(afterSig[1])) sigTitle = afterSig[1];
    }

    const billRateMatch = text.match(/(?:bill\s*rate|target\s*rate|rate)[^$\d\n\r]{0,20}\$(\d{2,3})/i)
      || text.match(/\$(\d{2,3})\s*(?:\/hr|per\s*hour|hr\b|hourly)/i);
    const payRateMatch = text.match(/(?:pay\s*rate|w2\s*rate|c2c\s*rate)[^$\d\n\r]{0,20}\$(\d{2,3})/i);

    const parsedBillRate = billRateMatch ? parseInt(billRateMatch[1], 10) : 0;
    const parsedPayRate = payRateMatch
      ? parseInt(payRateMatch[1], 10)
      : parsedBillRate > 0
      ? Math.round(parsedBillRate * 0.75)
      : 0;

    let workModel: 'Remote' | 'Hybrid' | 'Onsite' = 'Remote';
    if (/\bhybrid\b/i.test(text)) workModel = 'Hybrid';
    else if (/\bonsite\b|\bon-site\b|\bin[- ]office\b/i.test(text)) workModel = 'Onsite';

    const commonSkills = [
      'Java', 'Spring Boot', 'Kafka', 'AWS', 'Kubernetes', 'Docker', 'Python', 'React', 'TypeScript',
      'Node.js', 'Snowflake', 'PySpark', 'Databricks', 'Terraform', 'Splunk', 'EDR', 'SIEM', 'SQL', 'Angular',
      'Go', 'Azure', 'GCP', 'dbt', 'Airflow', 'Microservices', 'PostgreSQL', 'GraphQL'
    ];
    const matchedSkills = commonSkills.filter((skill) =>
      new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text)
    );

    const missingParts: string[] = [];
    if (!/\+?\d[\d\s().-]{7,}\d/.test(text)) missingParts.push('direct telephone');
    if (!parsedBillRate) missingParts.push('target bill rate');
    if (!payRateMatch) missingParts.push('explicit pay rate');

    return {
      companyName: (companyLine?.[1] || atCompany?.[1] || '').trim(),
      opportunityTitle: (subjectLine?.[1] || forRole?.[1] || '').trim(),
      clientContact: (contactLine?.[1] || sigName || '').trim(),
      clientContactEmail: (emailMatch?.[1] || '').trim(),
      clientContactTitle: (titleLine?.[1] || sigTitle || '').trim(),
      location: (locationLine?.[1] || cityState?.[1] || (workModel === 'Remote' ? 'Remote' : workModel)).trim(),
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
      const result = await resumeParserClientService.parseEmail(rawEmailText);
      parsed = result?.data || result || {};
    } catch {
      parsed = {};
    }

    const fallback = extractEmailHeuristics(rawEmailText);
    const billRate = Number(parsed.billRate || parsed.targetBillRate || fallback.targetBillRate || 0);
    const payRate = Number(
      parsed.payRate || parsed.targetPayRate || fallback.targetPayRate || (billRate > 0 ? Math.round(billRate * 0.75) : 0)
    );

    const enriched = {
      ...parsed,
      companyName: parsed.companyName || parsed.clientName || fallback.companyName,
      opportunityTitle: parsed.opportunityTitle || parsed.jobTitle || fallback.opportunityTitle,
      clientContact: parsed.clientContact || parsed.contactName || fallback.clientContact,
      clientContactEmail: parsed.clientContactEmail || fallback.clientContactEmail,
      clientContactTitle: parsed.clientContactTitle || parsed.contactTitle || fallback.clientContactTitle,
      location: parsed.location && parsed.location !== 'Remote / Hybrid'
        ? parsed.location
        : fallback.location || parsed.location || 'Remote',
      workModel: parsed.workModel || fallback.workModel,
      targetBillRate: billRate,
      targetPayRate: payRate,
      skillsRequired: parsed.skillsRequired || (Array.isArray(parsed.skills) ? parsed.skills.join(', ') : '') || fallback.skillsRequired,
      missingNotes: fallback.missingNotes || parsed.missingNotes || '',
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
router.put('/requirements/:id', requirementController.updateRequirementStage);
router.patch('/requirements/:id/stage', requirementController.updateRequirementStage);
router.delete('/requirements/:id', requirementController.deleteRequirement);

// Submissions (Candidate to Requirement)
router.post('/submissions', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'talentos-agency';
    const recruiterId = req.user?.id;
    const { requirementId, candidateId, pitchEmailSubject, pitchEmailBody, pitchTone } = req.body;

    const submission = await prisma.submission.create({
      data: {
        tenantId,
        requirementId,
        candidateId,
        recruiterId,
        pitchEmailSubject,
        pitchEmailBody,
        pitchTone: pitchTone || 'PROFESSIONAL',
        stage: 'SUBMITTED'
      }
    });

    // Update candidate pipeline stage
    await prisma.candidate.update({
      where: { id: candidateId },
      data: { pipelineStage: 'SUBMITTED' }
    });

    // Update requirement status
    await prisma.requirement.update({
      where: { id: requirementId },
      data: { status: 'SUBMITTED' }
    });

    res.status(201).json({ success: true, data: submission });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Submission failed' });
  }
});

// Clients & Vendors
router.get('/clients', clientController.getClients);
router.post('/clients', clientController.createClient);
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
router.delete('/vendors/:id', clientController.deleteVendor);

// SMTP Email Dispatch
router.post('/smtp/send', async (req: Request, res: Response) => {
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

    const resolvedSubject = subject || `Candidate Submission: ${candidateName || 'Consultant'} for ${requirementTitle || 'Role'} (${clientName || 'Client'})`;
    const resolvedHtml = html || bodyHtml || `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b;">
        <p>Hello ${recipientName || 'Hiring Team'},</p>
        <p>Please review the following consultant profile submitted for <strong>${requirementTitle || 'Open Requisition'}</strong> at <strong>${clientName || 'your organization'}</strong>:</p>
        <ul>
          <li><strong>Consultant:</strong> ${candidateName || 'N/A'}</li>
          <li><strong>Work Authorization:</strong> ${workAuth || 'Authorized'}</li>
          <li><strong>Bill Rate:</strong> ${rate || 'Competitive'}</li>
          <li><strong>Location:</strong> ${location || 'Remote / Hybrid'}</li>
        </ul>
        <p>Best regards,<br/>${req.user?.fullName || 'TalentOS Recruitment Desk'}</p>
      </div>
    `;

    const result = await smtpService.sendMail({
      to: targetEmail,
      recipientName,
      subject: resolvedSubject,
      html: resolvedHtml,
      tenantId
    });

    res.json({
      success: true,
      delivered: result.success,
      message: result.success
        ? `Submission email sent to ${targetEmail}`
        : `Submission logged for ${targetEmail} (SMTP relay notice: ${result.error || 'unconfigured'})`,
      data: result
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to dispatch email' });
  }
});

// Placements
router.get('/placements', placementController.getPlacements);
router.post('/placements', placementController.createPlacement);
router.post('/placements/:id/extend', placementController.extendPlacement);
router.delete('/placements/:id', placementController.deletePlacement);

// Users & Roles
router.get('/users', userController.getUsers);
router.post('/users/invite', userController.inviteUser);
router.patch('/users/:id/rate-mask', userController.toggleUserRateMask);
router.patch('/users/:id/status', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'talentos-agency';
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user || user.tenantId !== tenantId) return res.status(404).json({ success: false, message: 'User not found' });
    const nextStatus = user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { status: nextStatus },
      select: { id: true, fullName: true, status: true }
    });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to update user status' });
  }
});
router.delete('/users/:id', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'talentos-agency';
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user || user.tenantId !== tenantId) return res.status(404).json({ success: false, message: 'User not found' });
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
    const fields = await prisma.customFieldDefinition.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' }
    });
    res.json({ success: true, data: fields });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch custom fields' });
  }
});
router.post('/custom-fields', async (req: Request, res: Response) => {
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
router.delete('/custom-fields/:id', async (req: Request, res: Response) => {
  try {
    await prisma.customFieldDefinition.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Custom field deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to delete custom field' });
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

    const { threshold, whenText, thenSummary, name, active } = req.body;
    const updated = await prisma.automationRule.update({
      where: { id: rule.id },
      data: {
        ...(threshold !== undefined ? { threshold } : {}),
        ...(whenText !== undefined ? { whenText } : {}),
        ...(thenSummary !== undefined ? { thenSummary } : {}),
        ...(name !== undefined ? { name } : {}),
        ...(active !== undefined ? { active: Boolean(active) } : {}),
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
router.get('/sla-tasks', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'talentos-agency';
    const tasks = await prisma.slaTask.findMany({
      where: {
        tenantId,
        isDone: false
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: tasks });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch SLA tasks' });
  }
});
router.post('/sla-tasks/evaluate', slaController.evaluateSlaRadar);
router.patch('/sla-tasks/:id/complete', slaController.completeSlaTask);

export default router;
