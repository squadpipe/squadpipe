import { Router, Request, Response } from 'express';
import { placementService } from '../services/placement.service';
import { csvImporterService } from '../services/csvImporter.service';
import { resumeParserClientService } from '../services/resumeParserClient.service';
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
router.post('/auth/logout', authController.logout);

// Dashboard metrics
router.get('/dashboard/metrics', async (req: Request, res: Response) => {
  const [
    activeReqsCount,
    submittedCount,
    interviewsCount,
    selectedCount,
    onboardingCount,
    financials
  ] = await Promise.all([
    prisma.requirement.count(),
    prisma.requirement.count({ where: { status: 'SUBMITTED' } }),
    prisma.requirement.count({ where: { status: 'INTERVIEW' } }),
    prisma.requirement.count({ where: { status: 'SELECTED' } }),
    prisma.requirement.count({ where: { status: 'ONBOARDING' } }),
    placementService.getFinancialMetrics()
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
});

// Sidebar navigation counts (fast, lightweight aggregate query)
router.get('/sidebar/counts', async (req: Request, res: Response) => {
  try {
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
      prisma.requirement.count(),
      prisma.candidate.count(),
      prisma.client.count(),
      prisma.vendor.count(),
      prisma.placement.count(),
      prisma.user.count(),
      prisma.customFieldDefinition.count(),
      prisma.automationRule.count({ where: { active: true } })
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
router.post('/candidates/csv-import', async (req: Request, res: Response) => {
  try {
    const rows = Array.isArray(req.body) ? req.body : req.body.rows || [];
    const results = await csvImporterService.importCandidates(rows);
    res.json({ success: true, count: results.length, data: results });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'CSV Import failed' });
  }
});

// NLP & AI Endpoints (FastAPI Bridge)
router.post('/parse-email', async (req: Request, res: Response) => {
  try {
    const rawEmailText = req.body.rawEmailText || req.body.text || '';
    const result = await resumeParserClientService.parseEmail(rawEmailText);
    res.json({ success: true, data: result });
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
router.patch('/requirements/:id/stage', requirementController.updateRequirementStage);

// Clients & Vendors
router.get('/clients', clientController.getClients);
router.post('/clients', clientController.createClient);
router.get('/vendors', clientController.getVendors);
router.post('/vendors', clientController.createVendor);

// Placements
router.get('/placements', placementController.getPlacements);
router.post('/placements', placementController.createPlacement);
router.post('/placements/:id/extend', placementController.extendPlacement);

// Users & Roles
router.get('/users', userController.getUsers);
router.post('/users/invite', userController.inviteUser);
router.patch('/users/:id/rate-mask', userController.toggleUserRateMask);
router.patch('/users/:id/status', async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
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
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'User removed successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to delete user' });
  }
});

// Custom Fields
router.get('/custom-fields', async (req: Request, res: Response) => {
  try {
    const fields = await prisma.customFieldDefinition.findMany({
      orderBy: { createdAt: 'asc' }
    });
    res.json({ success: true, data: fields });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch custom fields' });
  }
});
router.post('/custom-fields', async (req: Request, res: Response) => {
  try {
    const { name, entity, type, options, required } = req.body;
    const key = name.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now();
    const entityUpper = (entity || 'CONSULTANT').toUpperCase();
    const typeUpper = (type || 'TEXT').toUpperCase().replace(/[\s\(\$)]/g, '');

    const created = await prisma.customFieldDefinition.create({
      data: {
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
router.post('/automations/rules', async (req: Request, res: Response) => {
  try {
    const { name, category, whenText, threshold, thenSummary, actionPills } = req.body;
    const rule = await prisma.automationRule.create({
      data: {
        name,
        category: (category?.toUpperCase() || 'CUSTOM') as any,
        triggerEvent: 'CUSTOM',
        whenText: whenText || '',
        threshold: threshold || 'Immediate',
        thenSummary: thenSummary || '',
        actions: actionPills || [],
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
    const rule = await prisma.automationRule.findUnique({ where: { id: req.params.id } });
    if (!rule) return res.status(404).json({ success: false, message: 'Rule not found' });
    const updated = await prisma.automationRule.update({
      where: { id: req.params.id },
      data: { active: !rule.active }
    });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to toggle rule' });
  }
});
router.post('/automations/rules/:id/test', automationController.testTriggerRule);
router.get('/automations/audit-logs', automationController.getAutomationAuditLogs);

// SLA Tasks
router.get('/sla-tasks', slaController.getSlaTasks);
router.post('/sla-tasks/evaluate', slaController.evaluateSlaRadar);
router.patch('/sla-tasks/:id/complete', slaController.completeSlaTask);

export default router;
