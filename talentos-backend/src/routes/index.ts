import { Router, Request, Response } from 'express';
import { placementService } from '../services/placement.service';
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

router.post('/auth/login', authController.login);

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

// Candidates
router.get('/candidates', candidateController.getCandidates);
router.post('/candidates', candidateController.createCandidate);
router.get('/candidates/:id', candidateController.getCandidateById);

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

// Automations & Audits
router.get('/automations/rules', automationController.getAutomationRules);
router.post('/automations/rules/:id/test', automationController.testTriggerRule);
router.get('/automations/audit-logs', automationController.getAutomationAuditLogs);

// SLA Tasks
router.get('/sla-tasks', slaController.getSlaTasks);
router.post('/sla-tasks/evaluate', slaController.evaluateSlaRadar);
router.patch('/sla-tasks/:id/complete', slaController.completeSlaTask);

export default router;
