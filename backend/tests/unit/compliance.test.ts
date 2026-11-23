import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ErasureTaskStatus } from '@prisma/client';
import { prisma } from '../../src/config/prisma.config';
import {
  getTenantSettings,
  normalizeCandidateRetentionDays,
  normalizeTenantDataRegion,
  resolveDeploymentDataRegion,
  saveGeneralSettings,
} from '../../src/config/smtp.config';
import { cvStorageService, getS3CompatibleConfig } from '../../src/services/cvStorage.service';
import {
  buildPlacementScrubPatch,
  buildRedactedEmail,
  complianceService,
  computeRetentionExpiresAt,
  CURRENT_PRIVACY_NOTICE_VERSION,
  hashComplianceSubject,
  resolveConsentConfirmation,
  resolveSecurityAuditRetentionCutoff,
  sanitizeAuditMetadata,
  scrubTextWithCandidatePii,
  SECURITY_AUDIT_RETENTION_DAYS,
} from '../../src/services/compliance.service';
import { candidateIndexingService } from '../../src/services/vector/candidateIndexing.service';

function withEnv(overrides: Record<string, string | undefined>, fn: () => Promise<void> | void) {
  const prev: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(overrides)) {
    prev[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  const restore = () => {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  };
  try {
    const res = fn();
    if (res && typeof (res as Promise<void>).then === 'function') {
      return (res as Promise<void>).finally(restore);
    }
    restore();
    return res;
  } catch (err) {
    restore();
    throw err;
  }
}

export async function runComplianceTests() {
  console.log('--- Running GDPR & India DPDPA Compliance Tests ---');

  // 1. Verified CV deletion on local disk
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sp-cv-compliance-'));
  try {
    await withEnv({ CV_STORAGE_PROVIDER: 'local', CV_LOCAL_DIR: tmpDir }, async () => {
      const stored = await cvStorageService.uploadCv(
        {
          originalname: 'Aarav_Sharma.pdf',
          mimetype: 'application/pdf',
          buffer: Buffer.from('%PDF-1.4 test-cv-bytes'),
        },
        'tenant-us-1'
      );

      const firstDelete = await cvStorageService.deleteCvVerified(stored.storageUri);
      assert.equal(firstDelete.deleted, true);
      assert.equal(firstDelete.alreadyMissing, false);

      const secondDelete = await cvStorageService.deleteCvVerified(stored.storageUri);
      assert.equal(secondDelete.deleted, true);
      assert.equal(secondDelete.alreadyMissing, true);
    });
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }

  // 2. Verified CV deletion against Cloudflare R2 (handles 204, 404, 500 & network errors)
  const originalFetch = globalThis.fetch;
  try {
    await withEnv(
      {
        CLOUDFLARE_R2_ACCOUNT_ID: 'cf-acct-123',
        CLOUDFLARE_R2_BUCKET: 'squadpipe-cvs-us-prod',
        CLOUDFLARE_R2_ACCESS_KEY_ID: 'r2-access-key',
        CLOUDFLARE_R2_SECRET_ACCESS_KEY: 'r2-secret-key',
        CLOUDFLARE_R2_ENDPOINT: 'https://cf-acct-123.us.r2.cloudflarestorage.com',
      },
      async () => {
        const uri = 'r2://squadpipe-cvs-us-prod/tenants/t1/cvs/sample.pdf';

        globalThis.fetch = (async () => new Response(null, { status: 204 })) as typeof fetch;
        const okRes = await cvStorageService.deleteCvVerified(uri);
        assert.equal(okRes.deleted, true);
        assert.equal(okRes.alreadyMissing, false);

        globalThis.fetch = (async () => new Response('Not Found', { status: 404 })) as typeof fetch;
        const missingRes = await cvStorageService.deleteCvVerified(uri);
        assert.equal(missingRes.deleted, true);
        assert.equal(missingRes.alreadyMissing, true);

        globalThis.fetch = (async () => new Response('AccessDenied', { status: 500 })) as typeof fetch;
        const errRes = await cvStorageService.deleteCvVerified(uri);
        assert.equal(errRes.deleted, false);
        assert.match(errRes.error || '', /500/);

        await assert.rejects(
          () => cvStorageService.deleteCv(uri, { throwOnError: true }),
          /500/
        );
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  // 3. PII scrubbing helpers for Placement, EmailLog & AutomationAuditLog
  const piiTarget = {
    fullName: 'Priya Nair',
    email: 'Priya.Nair@Example.com',
    phone: '+1 (512) 555-0199',
  };
  const scrubbedMsg = scrubTextWithCandidatePii(
    'Submitted Priya Nair (priya.nair@example.com, 512-555-0199) for Sr Java Role at ClientX.',
    piiTarget
  );
  assert.equal(scrubbedMsg.includes('Priya Nair'), false);
  assert.equal(scrubbedMsg.toLowerCase().includes('priya.nair@example.com'), false);
  assert.equal(scrubbedMsg.includes('555-0199'), false);
  assert.ok(scrubbedMsg.includes('Sr Java Role at ClientX'));

  const indiaScrubbed = scrubTextWithCandidatePii('Call 9876543210 for interview', {
    fullName: 'Rohan Mehta',
    email: 'rohan@example.in',
    phone: '+91 98765-43210',
  });
  assert.equal(indiaScrubbed.includes('9876543210'), false);

  const boundaryScrubbed = scrubTextWithCandidatePii(
    'Analytics summary for Ana (ana@example.com) on Pattern project',
    {
      fullName: 'Ana',
      email: 'ana@example.com',
      phone: null,
    }
  );
  assert.equal(boundaryScrubbed, 'Analytics summary for [REDACTED] ([REDACTED]) on Pattern project');

  const placementPatch = buildPlacementScrubPatch(
    {
      customerContact: 'Manager (notify priya.nair@example.com)',
      customFields: { candidateEmail: 'priya.nair@example.com', workMode: 'Remote' },
    },
    piiTarget
  );
  assert.equal(placementPatch.resourceName, 'Redacted Consultant');
  assert.equal(placementPatch.email, null);
  assert.equal(placementPatch.phone, null);
  assert.equal((placementPatch.customFields as Record<string, any>).workMode, 'Remote');
  assert.equal((placementPatch.customFields as Record<string, any>).candidateEmail, '[REDACTED]');

  assert.equal(
    hashComplianceSubject('Tenant-A', ' Priya.Nair@Example.com '),
    hashComplianceSubject('tenant-a', 'priya.nair@example.com')
  );
  assert.match(buildRedactedEmail('cand_1234567890'), /^erased\+[a-zA-Z0-9]+@redacted\.invalid$/);

  // 4. Consent, retention, region normalization & 365-day SecurityAuditLog cutoff
  assert.equal(resolveConsentConfirmation(true), true);
  assert.equal(resolveConsentConfirmation('true'), true);
  assert.equal(resolveConsentConfirmation('1'), true);
  assert.equal(resolveConsentConfirmation('yes'), true);
  assert.equal(resolveConsentConfirmation(false), false);
  assert.equal(resolveConsentConfirmation(''), false);

  assert.equal(normalizeTenantDataRegion('uk'), 'UK');
  assert.equal(normalizeTenantDataRegion('eu'), 'UK');
  assert.equal(normalizeTenantDataRegion('india'), 'IN');
  assert.equal(normalizeTenantDataRegion('other'), 'US');
  assert.equal(resolveDeploymentDataRegion({ DEPLOYMENT_REGION: 'IN' }), 'IN');
  assert.equal(resolveDeploymentDataRegion({ DEPLOYMENT_REGION: 'UK' }), 'UK');
  assert.equal(resolveDeploymentDataRegion({ AWS_S3_REGION: 'ap-south-1' }), 'IN');
  assert.equal(resolveDeploymentDataRegion({ AWS_S3_REGION: 'eu-west-2' }), 'UK');
  assert.equal(resolveDeploymentDataRegion({ CLOUDFLARE_R2_JURISDICTION: 'eu' }), 'UK');
  assert.equal(resolveDeploymentDataRegion({ CLOUDFLARE_R2_JURISDICTION: 'us' }), 'US');

  await withEnv(
    {
      CLOUDFLARE_R2_ACCOUNT_ID: 'cf-uk-acct',
      CLOUDFLARE_R2_BUCKET: 'squadpipe-cvs-uk-prod',
      CLOUDFLARE_R2_ACCESS_KEY_ID: 'uk-key',
      CLOUDFLARE_R2_SECRET_ACCESS_KEY: 'uk-secret',
      CLOUDFLARE_R2_JURISDICTION: 'eu',
      CLOUDFLARE_R2_ENDPOINT: undefined,
    },
    () => {
      const r2EuCfg = getS3CompatibleConfig('cloudflare');
      assert.equal(r2EuCfg.endpointUrl, 'https://cf-uk-acct.eu.r2.cloudflarestorage.com');
    }
  );
  assert.equal(normalizeCandidateRetentionDays(5), 30);
  assert.equal(normalizeCandidateRetentionDays(5000), 1825);
  assert.equal(normalizeCandidateRetentionDays(undefined), 365);

  const baseNow = new Date('2026-11-24T00:00:00.000Z');
  const retentionDate = computeRetentionExpiresAt(baseNow, 365);
  assert.equal(
    Math.round((retentionDate.getTime() - baseNow.getTime()) / (24 * 60 * 60 * 1000)),
    365
  );
  const auditCutoff = resolveSecurityAuditRetentionCutoff(baseNow, 90);
  assert.equal(
    Math.round((baseNow.getTime() - auditCutoff.getTime()) / (24 * 60 * 60 * 1000)),
    SECURITY_AUDIT_RETENTION_DAYS,
    'SecurityAuditLog retention must never drop below 365 days (India DPDPA Rule 6)'
  );

  const safeMeta = sanitizeAuditMetadata({
    role: 'ADMINISTRATOR',
    passwordHash: 'secret',
    token: 'jwt_xyz',
    bodyHtml: '<p>raw</p>',
    rawSnippet: 'cv text',
  });
  assert.deepEqual(safeMeta, { role: 'ADMINISTRATOR' });

  // 5. Verified Erasure + Outbox Retry + DSAR / Workspace Export (mocked Prisma)
  const originalTx = prisma.$transaction;
  const originalCandidateFindUnique = prisma.candidate.findUnique;
  const originalCandidateFindFirst = prisma.candidate.findFirst;
  const originalCandidateFindMany = prisma.candidate.findMany;
  const originalPlacementCount = prisma.placement.count;
  const originalPlacementFindMany = prisma.placement.findMany;
  const originalOutboxUpdate = prisma.erasureOutbox.update;
  const originalOutboxFindMany = prisma.erasureOutbox.findMany;
  const originalAuditCreate = prisma.securityAuditLog.create;
  const originalAuditDeleteMany = prisma.securityAuditLog.deleteMany;
  const originalAuditFindMany = prisma.securityAuditLog.findMany;
  const originalUserFindMany = prisma.user.findMany;
  const originalClientFindMany = prisma.client.findMany;
  const originalVendorFindMany = prisma.vendor.findMany;
  const originalReqFindMany = prisma.requirement.findMany;
  const originalSubFindMany = prisma.submission.findMany;
  const originalCfFindMany = prisma.customFieldDefinition.findMany;
  const originalTaxFindMany = prisma.masterTaxonomy.findMany;
  const originalRuleFindMany = prisma.automationRule.findMany;
  const originalSlaFindMany = prisma.slaTask.findMany;
  const originalEmailFindMany = prisma.emailLog.findMany;
  const originalQueryRaw = prisma.$queryRawUnsafe;
  const originalExecRaw = prisma.$executeRawUnsafe;
  const originalVectorDelete = candidateIndexingService.deleteCandidate;

  try {
    const outboxStore = new Map<string, any>();
    const auditLogs: any[] = [];
    const placementUpdates: any[] = [];
    const emailUpdates: any[] = [];
    const automationAuditUpdates: any[] = [];

    (prisma as any).$executeRawUnsafe = async () => 1;
    (prisma as any).$queryRawUnsafe = async () => [
      {
        general_config: {
          agencyName: 'Beacon Staffing US',
          legalEntityName: 'Beacon Staffing LLC',
          dataRegion: 'US',
          candidateRetentionDays: 365,
          grievanceEmail: 'privacy@beacon.example',
        },
      },
    ];

    (prisma.candidate as any).findUnique = async () => ({
      id: 'cand-erasure-1',
      tenantId: 'tenant-us',
      fullName: 'Jordan Patel',
      email: 'jordan.patel@example.com',
      phone: '+1 555-333-4444',
      pipelineStage: 'AVAILABLE_BENCH',
      resumeFileUrl: 'r2://squadpipe-cvs-us-prod/tenants/tenant-us/cvs/jordan.pdf',
    });
    (prisma.placement as any).count = async () => 0;

    (prisma as any).$transaction = async (fn: (tx: any) => Promise<any>) => {
      const txMock = {
        placement: {
          findMany: async () => [
            { id: 'pl-1', customerContact: 'Hiring Mgr / Jordan Patel', customFields: null },
          ],
          update: async (args: any) => {
            placementUpdates.push(args);
            return args;
          },
        },
        emailLog: {
          findMany: async () => [
            {
              id: 'em-1',
              recipientEmail: 'jordan.patel@example.com',
              recipientName: 'Jordan Patel',
              subject: 'Interview for Jordan Patel',
              bodyHtml: '<p>Hi Jordan Patel, call +1 555-333-4444</p>',
            },
          ],
          update: async (args: any) => {
            emailUpdates.push(args);
            return args;
          },
        },
        automationAuditLog: {
          findMany: async () => [
            {
              id: 'aa-1',
              target: 'Jordan Patel -> REQ-101',
              conditionsMet: 'Applied via public link (jordan.patel@example.com)',
              actionDispatched: 'Saved CV for Jordan Patel',
              errorDetails: null,
            },
          ],
          update: async (args: any) => {
            automationAuditUpdates.push(args);
            return args;
          },
        },
        candidate: {
          delete: async () => ({ id: 'cand-erasure-1' }),
        },
        erasureOutbox: {
          create: async ({ data }: any) => {
            const row = { id: 'outbox-1', ...data };
            outboxStore.set(row.id, row);
            return row;
          },
        },
        securityAuditLog: {
          create: async ({ data }: any) => {
            auditLogs.push(data);
            return { id: `audit-${auditLogs.length}`, ...data };
          },
        },
      };
      return fn(txMock);
    };

    (prisma.erasureOutbox as any).update = async ({ where, data }: any) => {
      const cur = outboxStore.get(where.id) || {};
      const next = { ...cur, ...data };
      outboxStore.set(where.id, next);
      return next;
    };
    (prisma.erasureOutbox as any).findMany = async () =>
      Array.from(outboxStore.values()).filter((j) => j.status === ErasureTaskStatus.PENDING);

    (candidateIndexingService as any).deleteCandidate = async () => {};

    // First attempt: simulate R2 503 failure -> ErasureOutbox stays PENDING for retry
    await withEnv(
      {
        CLOUDFLARE_R2_ACCOUNT_ID: 'cf-acct-123',
        CLOUDFLARE_R2_BUCKET: 'squadpipe-cvs-us-prod',
        CLOUDFLARE_R2_ACCESS_KEY_ID: 'r2-access-key',
        CLOUDFLARE_R2_SECRET_ACCESS_KEY: 'r2-secret-key',
        CLOUDFLARE_R2_ENDPOINT: 'https://cf-acct-123.us.r2.cloudflarestorage.com',
      },
      async () => {
        globalThis.fetch = (async () => new Response('Service Unavailable', { status: 503 })) as typeof fetch;

        const firstPass = await complianceService.executeVerifiedCandidateErasure({
          candidateId: 'cand-erasure-1',
          tenantId: 'tenant-us',
          requestedById: 'usr-admin',
          requestedByEmail: 'admin@beacon.example',
          requestedByRole: 'ADMINISTRATOR',
        });

        assert.equal(firstPass.outboxStatus, ErasureTaskStatus.PENDING);
        assert.equal(firstPass.vectorDeleted, true);
        assert.equal(firstPass.storageDeleted, false);
        assert.equal(firstPass.scrubbedCounts.placements, 1);
        assert.equal(firstPass.scrubbedCounts.emailLogs, 1);
        assert.equal(firstPass.scrubbedCounts.automationAuditLogs, 1);

        assert.equal(placementUpdates[0].data.resourceName, 'Redacted Consultant');
        assert.equal(placementUpdates[0].data.email, null);
        assert.match(emailUpdates[0].data.recipientEmail, /@redacted\.invalid$/);
        assert.equal(emailUpdates[0].data.bodyHtml.includes('555-333-4444'), false);
        assert.equal(automationAuditUpdates[0].data.target.includes('Jordan Patel'), false);

        // Retry via outbox when R2 recovers (204) -> transitions to COMPLETED
        globalThis.fetch = (async () => new Response(null, { status: 204 })) as typeof fetch;
        const retryRes = await complianceService.processPendingErasureOutbox(10);
        assert.equal(retryRes.processed, 1);
        assert.equal(retryRes.completed, 1);
        assert.equal(outboxStore.get('outbox-1')?.status, ErasureTaskStatus.COMPLETED);
      }
    );

    // 6. DSAR candidate export masks rates when rateMasked=true and logs audit event
    (prisma.securityAuditLog as any).create = async ({ data }: any) => {
      auditLogs.push(data);
      return { id: `audit-${auditLogs.length}`, ...data };
    };
    (prisma.candidate as any).findFirst = async () => ({
      id: 'cand-dsar-1',
      tenantId: 'tenant-us',
      fullName: 'Jordan Patel',
      email: 'jordan@example.com',
      phone: '+1 555-333-4444',
      currentTitle: 'Staff Engineer',
      workAuth: 'US Citizen',
      education: 'MS CS',
      skillset: 'TypeScript, AWS',
      normalizedSkills: ['typescript', 'aws'],
      hourlyRateW2: 95,
      hourlyRateC2c: null,
      hourlyRateDisplay: '$95/hr (W2)',
      relocation: 'Yes',
      pipelineStage: 'SUBMITTED',
      customFields: {},
      rawSnippet: 'Resume body',
      vendor: null,
      resumeFileName: 'Jordan_CV.pdf',
      resumeFormat: 'PDF',
      resumeFileUrl: 'r2://squadpipe-cvs-us-prod/tenants/tenant-us/cvs/jordan.pdf',
      lawfulBasis: 'CONSENT',
      consentStatus: 'GRANTED',
      consentCapturedAt: new Date('2026-11-22T00:00:00.000Z'),
      consentWithdrawnAt: null,
      privacyNoticeVersion: CURRENT_PRIVACY_NOTICE_VERSION,
      intakeSource: 'PUBLIC_FORM',
      retentionExpiresAt: new Date('2027-11-22T00:00:00.000Z'),
      erasureNoticeSentAt: null,
      createdAt: new Date('2026-11-22T00:00:00.000Z'),
      updatedAt: new Date('2026-11-22T00:00:00.000Z'),
      submissions: [
        {
          id: 'sub-1',
          stage: 'SUBMITTED',
          intakeSource: 'PUBLIC_FORM',
          submittedRate: '$95/hr (W2)',
          submittedVendorName: null,
          submissionDate: new Date('2026-11-22T00:00:00.000Z'),
          interviewDate: null,
          requirement: {
            id: 'req-1',
            code: 'REQ-100',
            opportunityTitle: 'Cloud Architect',
            companyName: 'Acme Corp',
            location: 'Austin, TX',
            workModel: 'REMOTE',
            status: 'SUBMITTED',
          },
        },
      ],
      placements: [],
    });
    (prisma.emailLog as any).findMany = async () => [];

    const maskedDsar = await withEnv(
      { DEPLOYMENT_REGION: 'IN', AWS_S3_REGION: 'ap-south-1' },
      () =>
        complianceService.exportCandidateDsar('cand-dsar-1', 'tenant-us', {
          rateMasked: true,
          actorUserId: 'usr-recruiter',
        })
    );
    assert.equal(maskedDsar.exportType, 'CANDIDATE_DSAR');
    assert.equal(maskedDsar.dataRegion, 'IN');
    assert.equal(maskedDsar.candidate.hourlyRateDisplay, '••••••');
    assert.equal(maskedDsar.sharedWithThirdParties[0].clientCompany, 'Acme Corp');
    assert.equal(maskedDsar.sharedWithThirdParties[0].submittedRate, '••••••');
    assert.ok(auditLogs.some((a) => a.action === 'CANDIDATE_EXPORTED'));

    // Verify tenants cannot override server .env dataRegion via saveGeneralSettings
    await withEnv({ DEPLOYMENT_REGION: 'IN', CANDIDATE_RETENTION_DAYS: '365' }, async () => {
      const saved = await saveGeneralSettings('tenant-in-locked', {
        agencyName: 'Mumbai Staffing',
        dataRegion: 'UK' as any,
      });
      assert.equal(saved.dataRegion, 'IN');
      const fetched = await getTenantSettings('tenant-in-locked');
      assert.equal(fetched.general.dataRegion, 'IN');
    });

    // 7. Workspace export never exposes passwordHash and records WORKSPACE_EXPORTED
    (prisma.user as any).findMany = async ({ select }: any) => {
      assert.equal(Boolean(select?.passwordHash), false, 'Workspace export must never select passwordHash');
      return [
        {
          id: 'usr-1',
          email: 'admin@beacon.example',
          fullName: 'Admin User',
          agencyName: 'Beacon Staffing US',
          role: 'ADMINISTRATOR',
          desk: 'US IT',
          rateMasked: false,
          status: 'ACTIVE',
          lastActiveAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
    };
    (prisma.candidate as any).findMany = async () => [];
    (prisma.client as any).findMany = async () => [];
    (prisma.vendor as any).findMany = async () => [];
    (prisma.requirement as any).findMany = async () => [];
    (prisma.submission as any).findMany = async () => [];
    (prisma.placement as any).findMany = async () => [];
    (prisma.customFieldDefinition as any).findMany = async () => [];
    (prisma.masterTaxonomy as any).findMany = async () => [];
    (prisma.automationRule as any).findMany = async () => [];
    (prisma.slaTask as any).findMany = async () => [];
    (prisma.securityAuditLog as any).findMany = async () => [];

    const workspaceExport = await withEnv({ DEPLOYMENT_REGION: 'UK' }, () =>
      complianceService.exportWorkspaceData('tenant-us', {
        actorUserId: 'usr-1',
      })
    );
    assert.equal(workspaceExport.exportType, 'WORKSPACE_FULL_EXPORT');
    assert.equal(workspaceExport.dataRegion, 'UK');
    assert.equal(Object.prototype.hasOwnProperty.call(workspaceExport.users[0], 'passwordHash'), false);
    assert.ok(auditLogs.some((a) => a.action === 'WORKSPACE_EXPORTED'));

    // 8. 365-day SecurityAuditLog purge uses >= 365-day cutoff
    let capturedCutoff: Date | undefined;
    (prisma.securityAuditLog as any).deleteMany = async ({ where }: any) => {
      capturedCutoff = where.createdAt.lt;
      return { count: 4 };
    };
    const purged = await complianceService.purgeExpiredSecurityAuditLogs(baseNow);
    assert.equal(purged, 4);
    assert.ok(capturedCutoff);
    assert.equal(
      Math.round((baseNow.getTime() - capturedCutoff!.getTime()) / (24 * 60 * 60 * 1000)),
      365
    );

    // 9. Candidates are NEVER auto-deleted by background cron (only logs auto-clean)
    assert.equal((complianceService as any).processCandidateRetentionCycle, undefined);
  } finally {
    globalThis.fetch = originalFetch;
    (prisma as any).$transaction = originalTx;
    (prisma.candidate as any).findUnique = originalCandidateFindUnique;
    (prisma.candidate as any).findFirst = originalCandidateFindFirst;
    (prisma.candidate as any).findMany = originalCandidateFindMany;
    (prisma.placement as any).count = originalPlacementCount;
    (prisma.placement as any).findMany = originalPlacementFindMany;
    (prisma.erasureOutbox as any).update = originalOutboxUpdate;
    (prisma.erasureOutbox as any).findMany = originalOutboxFindMany;
    (prisma.securityAuditLog as any).create = originalAuditCreate;
    (prisma.securityAuditLog as any).deleteMany = originalAuditDeleteMany;
    (prisma.securityAuditLog as any).findMany = originalAuditFindMany;
    (prisma.user as any).findMany = originalUserFindMany;
    (prisma.client as any).findMany = originalClientFindMany;
    (prisma.vendor as any).findMany = originalVendorFindMany;
    (prisma.requirement as any).findMany = originalReqFindMany;
    (prisma.submission as any).findMany = originalSubFindMany;
    (prisma.customFieldDefinition as any).findMany = originalCfFindMany;
    (prisma.masterTaxonomy as any).findMany = originalTaxFindMany;
    (prisma.automationRule as any).findMany = originalRuleFindMany;
    (prisma.slaTask as any).findMany = originalSlaFindMany;
    (prisma.emailLog as any).findMany = originalEmailFindMany;
    (prisma as any).$queryRawUnsafe = originalQueryRaw;
    (prisma as any).$executeRawUnsafe = originalExecRaw;
    (candidateIndexingService as any).deleteCandidate = originalVectorDelete;
  }

  console.log('✅ GDPR & India DPDPA Compliance Tests: PASSED');
}
