import crypto from 'node:crypto';
import {
  CandidateLawfulBasis,
  ConsentStatus,
  ErasureTaskStatus,
  PlacementStatus,
  Prisma,
} from '@prisma/client';
import { prisma } from '../config/prisma.config';
import {
  getTenantSettings,
  normalizeCandidateRetentionDays,
  resolveDeploymentDataRegion,
  resolveEnvCandidateRetentionDays,
  resolveEnvGrievanceEmail,
} from '../config/smtp.config';
import { maskFinancialRecord } from '../middlewares/rateMask.middleware';
import { cvStorageService } from './cvStorage.service';
import { candidateIndexingService } from './vector/candidateIndexing.service';

export const CURRENT_PRIVACY_NOTICE_VERSION = '2026-11-22';
export const DEFAULT_CANDIDATE_RETENTION_DAYS = 365;
export const SECURITY_AUDIT_RETENTION_DAYS = 365;

const SENSITIVE_AUDIT_METADATA_KEYS = new Set([
  'password',
  'passwordhash',
  'token',
  'refreshtoken',
  'accesstoken',
  'secret',
  'apikey',
  'authorization',
  'cookie',
  'bodyhtml',
  'rawsnippet',
]);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Generates a deterministic non-reversible SHA-256 subject identifier for post-erasure audit & backup-restore replay.
 */
export function hashComplianceSubject(tenantId: string, email: string): string {
  const normalized = `${String(tenantId || 'squadpipe-agency').trim().toLowerCase()}:${String(email || '').trim().toLowerCase()}`;
  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
}

/**
 * Generates an RFC 2606 non-routable placeholder address for scrubbed historical email logs.
 */
export function buildRedactedEmail(candidateId: string): string {
  const safeId = String(candidateId || 'candidate').replace(/[^a-zA-Z0-9]/g, '').slice(0, 12) || 'candidate';
  return `erased+${safeId}@redacted.invalid`;
}

export function computeRetentionExpiresAt(
  baseDate: Date = new Date(),
  retentionDays: number = DEFAULT_CANDIDATE_RETENTION_DAYS
): Date {
  const clampedDays = normalizeCandidateRetentionDays(retentionDays);
  return new Date(baseDate.getTime() + clampedDays * 24 * 60 * 60 * 1000);
}

export function resolveSecurityAuditRetentionCutoff(
  now: Date = new Date(),
  retentionDays: number = SECURITY_AUDIT_RETENTION_DAYS
): Date {
  const days = Math.max(365, Math.floor(Number(retentionDays) || SECURITY_AUDIT_RETENTION_DAYS));
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export function resolveConsentConfirmation(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (typeof value === 'string') {
    const clean = value.trim().toLowerCase();
    return clean === 'true' || clean === '1' || clean === 'yes' || clean === 'on';
  }
  return false;
}

/**
 * Scrubs direct candidate identifiers (email, fullName, phone variants) from historical logs and text blobs.
 */
export function scrubTextWithCandidatePii(
  rawText: string | null | undefined,
  candidate: { fullName?: string | null; email?: string | null; phone?: string | null }
): string {
  let output = String(rawText ?? '');
  if (!output) return '';

  const email = String(candidate.email || '').trim();
  if (email.length >= 3) {
    output = output.replace(new RegExp(escapeRegExp(email), 'gi'), '[REDACTED]');
  }

  const fullName = String(candidate.fullName || '').trim();
  if (fullName.length >= 3) {
    output = output.replace(
      new RegExp(`(?<![a-zA-Z0-9])${escapeRegExp(fullName)}(?![a-zA-Z0-9])`, 'gi'),
      '[REDACTED]'
    );
  }

  const phone = String(candidate.phone || '').trim();
  if (phone.length >= 6) {
    output = output.replace(new RegExp(escapeRegExp(phone), 'gi'), '[REDACTED]');
    const digits = phone.replace(/\D/g, '');
    const digitVariants = new Set<string>();
    if (digits.length >= 7) digitVariants.add(digits);
    if (digits.length > 10) digitVariants.add(digits.slice(-10));
    for (const variant of digitVariants) {
      const flexiblePhoneRegex = new RegExp(
        `(?<!\\d)${variant.split('').map(escapeRegExp).join('\\D{0,3}')}(?!\\d)`,
        'g'
      );
      output = output.replace(flexiblePhoneRegex, '[REDACTED]');
    }
  }

  return output;
}

/**
 * Sanitizes audit metadata so credentials, tokens, and raw CV/email bodies never land in SecurityAuditLog.
 */
export function sanitizeAuditMetadata(input: unknown, depth = 0): Record<string, any> | undefined {
  if (!input || typeof input !== 'object' || Array.isArray(input) || depth > 3) {
    return undefined;
  }
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (SENSITIVE_AUDIT_METADATA_KEYS.has(k.toLowerCase())) continue;
    if (v === undefined) continue;
    if (v === null || typeof v === 'boolean' || typeof v === 'number') {
      out[k] = v;
    } else if (typeof v === 'string') {
      out[k] = v.slice(0, 500);
    } else if (Array.isArray(v)) {
      out[k] = v.slice(0, 20).map((item) =>
        typeof item === 'string' ? item.slice(0, 120) : typeof item === 'number' || typeof item === 'boolean' ? item : '[object]'
      );
    } else if (typeof v === 'object') {
      const nested = sanitizeAuditMetadata(v, depth + 1);
      if (nested) out[k] = nested;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function buildPlacementScrubPatch(
  placement: {
    customerContact?: string | null;
    customFields?: unknown;
  },
  candidate: { fullName?: string | null; email?: string | null; phone?: string | null }
): Prisma.PlacementUpdateInput {
  const nextCustomFields =
    placement.customFields &&
    typeof placement.customFields === 'object' &&
    !Array.isArray(placement.customFields)
      ? Object.fromEntries(
          Object.entries(placement.customFields as Record<string, unknown>).map(([k, v]) => [
            k,
            typeof v === 'string' ? scrubTextWithCandidatePii(v, candidate) : v,
          ])
        )
      : undefined;

  return {
    candidate: { disconnect: true },
    resourceName: 'Redacted Consultant',
    email: null,
    phone: null,
    ...(placement.customerContact
      ? { customerContact: scrubTextWithCandidatePii(placement.customerContact, candidate) }
      : {}),
    ...(nextCustomFields !== undefined ? { customFields: nextCustomFields as Prisma.InputJsonValue } : {}),
  };
}

export function extractRequestNetworkMeta(req?: {
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
}): { ipAddress?: string; userAgent?: string } {
  if (!req) return {};
  const forwarded = req.headers?.['x-forwarded-for'];
  const rawIp = Array.isArray(forwarded)
    ? forwarded[0]
    : typeof forwarded === 'string'
      ? forwarded.split(',')[0]
      : req.ip;
  const rawUa = req.headers?.['user-agent'];
  const userAgent = Array.isArray(rawUa) ? rawUa[0] : rawUa;
  return {
    ipAddress: rawIp ? String(rawIp).trim().slice(0, 64) : undefined,
    userAgent: userAgent ? String(userAgent).trim().slice(0, 300) : undefined,
  };
}

export interface SecurityAuditEventInput {
  tenantId?: string;
  actorUserId?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}

export interface CandidateErasureResult {
  candidateId: string;
  tenantId: string;
  outboxId: string;
  outboxStatus: ErasureTaskStatus;
  vectorDeleted: boolean;
  storageDeleted: boolean;
  storageError?: string;
  scrubbedCounts: {
    placements: number;
    emailLogs: number;
    automationAuditLogs: number;
  };
}

export class ComplianceService {
  /**
   * Persists an immutable security/privacy audit entry (retained for at least 365 days under India DPDPA Rule 6).
   * Non-throwing so logging outages do not interrupt user operations.
   */
  async recordSecurityAuditEvent(input: SecurityAuditEventInput): Promise<void> {
    try {
      const metadata = sanitizeAuditMetadata(input.metadata);
      await prisma.securityAuditLog.create({
        data: {
          tenantId: String(input.tenantId || 'squadpipe-agency').trim() || 'squadpipe-agency',
          actorUserId: input.actorUserId || null,
          actorEmail: input.actorEmail ? String(input.actorEmail).trim().toLowerCase().slice(0, 180) : null,
          actorRole: input.actorRole || null,
          action: String(input.action || 'UNKNOWN_EVENT').trim().toUpperCase().slice(0, 80),
          targetType: input.targetType ? String(input.targetType).trim().toUpperCase().slice(0, 50) : null,
          targetId: input.targetId ? String(input.targetId).trim().slice(0, 120) : null,
          ipAddress: input.ipAddress ? String(input.ipAddress).trim().slice(0, 64) : null,
          userAgent: input.userAgent ? String(input.userAgent).trim().slice(0, 300) : null,
          ...(metadata ? { metadata: metadata as Prisma.InputJsonValue } : {}),
        },
      });
    } catch (err: any) {
      console.warn('[Compliance] Failed to record SecurityAuditLog:', err?.message || err);
    }
  }

  async getSecurityAuditLogs(
    tenantId: string,
    params: {
      action?: string;
      targetType?: string;
      actorUserId?: string;
      from?: string;
      to?: string;
      page?: number;
      limit?: number;
    } = {}
  ) {
    const where: Prisma.SecurityAuditLogWhereInput = { tenantId };
    if (params.action?.trim()) {
      where.action = params.action.trim().toUpperCase();
    }
    if (params.targetType?.trim()) {
      where.targetType = params.targetType.trim().toUpperCase();
    }
    if (params.actorUserId?.trim()) {
      where.actorUserId = params.actorUserId.trim();
    }

    const createdAtFilter: Prisma.DateTimeFilter = {};
    if (params.from) {
      const fromDate = new Date(params.from);
      if (!Number.isNaN(fromDate.getTime())) createdAtFilter.gte = fromDate;
    }
    if (params.to) {
      const toDate = new Date(params.to);
      if (!Number.isNaN(toDate.getTime())) createdAtFilter.lte = toDate;
    }
    if (createdAtFilter.gte || createdAtFilter.lte) {
      where.createdAt = createdAtFilter;
    }

    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(params.limit) || 25));

    const [total, items] = await Promise.all([
      prisma.securityAuditLog.count({ where }),
      prisma.securityAuditLog.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async purgeExpiredSecurityAuditLogs(now: Date = new Date()): Promise<number> {
    const cutoff = resolveSecurityAuditRetentionCutoff(now, SECURITY_AUDIT_RETENTION_DAYS);
    const result = await prisma.securityAuditLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    return result.count;
  }

  /**
   * Performs verified GDPR/DPDPA candidate erasure:
   * 1) Scrubs PII from Placement, EmailLog, and AutomationAuditLog inside the transaction
   * 2) Deletes Candidate (cascading CandidateChunk & Submission)
   * 3) Persists an ErasureOutbox ledger entry & SecurityAuditLog
   * 4) Executes verified CV storage deletion & vector index cleanup, queuing retries if either fails
   */
  async executeVerifiedCandidateErasure(params: {
    candidateId: string;
    tenantId?: string;
    requestedById?: string | null;
    requestedByEmail?: string | null;
    requestedByRole?: string | null;
    reason?: string;
    ipAddress?: string | null;
    userAgent?: string | null;
    allowActivePlacements?: boolean;
  }): Promise<CandidateErasureResult> {
    const existing = await prisma.candidate.findUnique({
      where: { id: params.candidateId },
    });
    if (!existing || (params.tenantId && existing.tenantId !== params.tenantId)) {
      const notFoundErr: any = new Error('Candidate not found or unauthorized');
      notFoundErr.statusCode = 404;
      throw notFoundErr;
    }

    if (!params.allowActivePlacements) {
      const activePlacementsCount = await prisma.placement.count({
        where: {
          tenantId: existing.tenantId,
          status: {
            in: [PlacementStatus.ACTIVE, PlacementStatus.EXTENDED, PlacementStatus.EXPIRING_SOON],
          },
          OR: [
            { candidateId: existing.id },
            {
              candidateId: null,
              resourceName: { equals: existing.fullName, mode: 'insensitive' },
            },
          ],
        },
      });
      if (activePlacementsCount > 0 || existing.pipelineStage === 'BILLABLE') {
        const conflictErr: any = new Error(
          'Cannot delete a billable consultant. Please remove them from Billable Consultants first.'
        );
        conflictErr.statusCode = 409;
        throw conflictErr;
      }
    }

    const candidatePii = {
      fullName: existing.fullName,
      email: existing.email,
      phone: existing.phone,
    };
    const subjectHash = hashComplianceSubject(existing.tenantId, existing.email);
    const redactedEmail = buildRedactedEmail(existing.id);

    const txResult = await prisma.$transaction(async (tx) => {
      // 1. Scrub Placement records (keep statutory accounting/PO fields intact)
      const matchingPlacements = await tx.placement.findMany({
        where: {
          tenantId: existing.tenantId,
          OR: [
            { candidateId: existing.id },
            {
              candidateId: null,
              OR: [
                { email: { equals: existing.email, mode: 'insensitive' } },
                { resourceName: { equals: existing.fullName, mode: 'insensitive' } },
              ],
            },
          ],
        },
        select: { id: true, customerContact: true, customFields: true },
      });

      for (const pl of matchingPlacements) {
        await tx.placement.update({
          where: { id: pl.id },
          data: buildPlacementScrubPatch(pl, candidatePii),
        });
      }

      // 2. Scrub EmailLog rows mentioning or addressed to the candidate
      const emailFilters: Prisma.EmailLogWhereInput[] = [
        { recipientEmail: { equals: existing.email, mode: 'insensitive' } },
        { subject: { contains: existing.email, mode: 'insensitive' } },
        { bodyHtml: { contains: existing.email, mode: 'insensitive' } },
      ];
      if (existing.fullName.trim().length >= 4) {
        emailFilters.push(
          { subject: { contains: existing.fullName.trim(), mode: 'insensitive' } },
          { bodyHtml: { contains: existing.fullName.trim(), mode: 'insensitive' } }
        );
      }

      const matchingEmailLogs = await tx.emailLog.findMany({
        where: {
          tenantId: existing.tenantId,
          OR: emailFilters,
        },
        select: { id: true, recipientEmail: true, recipientName: true, subject: true, bodyHtml: true },
      });

      for (const log of matchingEmailLogs) {
        const isDirectRecipient =
          log.recipientEmail.trim().toLowerCase() === existing.email.trim().toLowerCase();
        await tx.emailLog.update({
          where: { id: log.id },
          data: {
            ...(isDirectRecipient
              ? {
                  recipientEmail: redactedEmail,
                  recipientName: '[REDACTED]',
                }
              : {}),
            subject: scrubTextWithCandidatePii(log.subject, candidatePii),
            bodyHtml: scrubTextWithCandidatePii(log.bodyHtml, candidatePii),
          },
        });
      }

      // 3. Scrub AutomationAuditLog entries (scoped via parent rule tenant or null lifecycle rule)
      const auditTextFilters: Prisma.AutomationAuditLogWhereInput[] = [
        { target: { contains: existing.email, mode: 'insensitive' } },
        { conditionsMet: { contains: existing.email, mode: 'insensitive' } },
        { actionDispatched: { contains: existing.email, mode: 'insensitive' } },
      ];
      if (existing.fullName.trim().length >= 4) {
        const cleanName = existing.fullName.trim();
        auditTextFilters.push(
          { target: { contains: cleanName, mode: 'insensitive' } },
          { conditionsMet: { contains: cleanName, mode: 'insensitive' } },
          { actionDispatched: { contains: cleanName, mode: 'insensitive' } }
        );
      }

      const matchingAuditLogs = await tx.automationAuditLog.findMany({
        where: {
          AND: [
            {
              OR: [{ rule: { tenantId: existing.tenantId } }, { ruleId: null }],
            },
            { OR: auditTextFilters },
          ],
        },
        select: { id: true, target: true, conditionsMet: true, actionDispatched: true, errorDetails: true },
      });

      for (const audit of matchingAuditLogs) {
        await tx.automationAuditLog.update({
          where: { id: audit.id },
          data: {
            target: scrubTextWithCandidatePii(audit.target, candidatePii),
            conditionsMet: audit.conditionsMet
              ? scrubTextWithCandidatePii(audit.conditionsMet, candidatePii)
              : null,
            actionDispatched: scrubTextWithCandidatePii(audit.actionDispatched, candidatePii),
            errorDetails: audit.errorDetails
              ? scrubTextWithCandidatePii(audit.errorDetails, candidatePii)
              : null,
          },
        });
      }

      // 4. Delete candidate record (cascades CandidateChunk & Submission)
      await tx.candidate.delete({ where: { id: existing.id } });

      // 5. Enqueue ErasureOutbox for verified storage + vector cleanup
      const outbox = await tx.erasureOutbox.create({
        data: {
          tenantId: existing.tenantId,
          candidateId: existing.id,
          subjectHash,
          storageUri: existing.resumeFileUrl || null,
          vectorDeleted: false,
          storageDeleted: !existing.resumeFileUrl,
          status: ErasureTaskStatus.PENDING,
          attempts: 0,
          requestedById: params.requestedById || null,
          reason: params.reason || 'CANDIDATE_ERASURE',
        },
      });

      await tx.securityAuditLog.create({
        data: {
          tenantId: existing.tenantId,
          actorUserId: params.requestedById || null,
          actorEmail: params.requestedByEmail || null,
          actorRole: params.requestedByRole || null,
          action: 'CANDIDATE_ERASED',
          targetType: 'CANDIDATE',
          targetId: existing.id,
          ipAddress: params.ipAddress || null,
          userAgent: params.userAgent || null,
          metadata: {
            subjectHash,
            hadCv: Boolean(existing.resumeFileUrl),
            reason: params.reason || 'CANDIDATE_ERASURE',
            placementsScrubbed: matchingPlacements.length,
            emailLogsScrubbed: matchingEmailLogs.length,
            automationAuditLogsScrubbed: matchingAuditLogs.length,
          },
        },
      });

      return {
        outbox,
        scrubbedCounts: {
          placements: matchingPlacements.length,
          emailLogs: matchingEmailLogs.length,
          automationAuditLogs: matchingAuditLogs.length,
        },
      };
    });

    // 6. Execute external CV storage deletion & vector cleanup, updating ErasureOutbox verification
    let vectorDeleted = false;
    let vectorError: string | undefined;
    try {
      await candidateIndexingService.deleteCandidate(existing.tenantId, existing.id);
      vectorDeleted = true;
    } catch (err: any) {
      vectorError = err?.message || 'Vector cleanup failed';
    }

    let storageDeleted = !existing.resumeFileUrl;
    let storageError: string | undefined;
    if (existing.resumeFileUrl) {
      const cvRes = await cvStorageService.deleteCvVerified(existing.resumeFileUrl);
      storageDeleted = cvRes.deleted;
      storageError = cvRes.error;
    }

    const nextStatus =
      vectorDeleted && storageDeleted ? ErasureTaskStatus.COMPLETED : ErasureTaskStatus.PENDING;
    const combinedError = [vectorError, storageError].filter(Boolean).join(' | ') || null;

    await prisma.erasureOutbox.update({
      where: { id: txResult.outbox.id },
      data: {
        vectorDeleted,
        storageDeleted,
        attempts: 1,
        lastError: combinedError,
        status: nextStatus,
        ...(nextStatus === ErasureTaskStatus.COMPLETED ? { completedAt: new Date() } : {}),
      },
    });

    return {
      candidateId: existing.id,
      tenantId: existing.tenantId,
      outboxId: txResult.outbox.id,
      outboxStatus: nextStatus,
      vectorDeleted,
      storageDeleted,
      ...(storageError ? { storageError } : {}),
      scrubbedCounts: txResult.scrubbedCounts,
    };
  }

  /**
   * Retries incomplete CV storage / vector cleanup jobs from ErasureOutbox.
   */
  async processPendingErasureOutbox(batchLimit = 25): Promise<{
    processed: number;
    completed: number;
    failed: number;
  }> {
    const pending = await prisma.erasureOutbox.findMany({
      where: { status: ErasureTaskStatus.PENDING },
      orderBy: { updatedAt: 'asc' },
      take: batchLimit,
    });

    let completed = 0;
    let failed = 0;

    for (const job of pending) {
      let vectorDeleted = job.vectorDeleted;
      let storageDeleted = job.storageDeleted;
      const errors: string[] = [];

      if (!vectorDeleted) {
        try {
          await candidateIndexingService.deleteCandidate(job.tenantId, job.candidateId);
          vectorDeleted = true;
        } catch (err: any) {
          errors.push(err?.message || 'Vector cleanup retry failed');
        }
      }

      if (!storageDeleted) {
        if (!job.storageUri) {
          storageDeleted = true;
        } else {
          const cvRes = await cvStorageService.deleteCvVerified(job.storageUri);
          storageDeleted = cvRes.deleted;
          if (!cvRes.deleted && cvRes.error) {
            errors.push(cvRes.error);
          }
        }
      }

      const nextAttempts = job.attempts + 1;
      const isDone = vectorDeleted && storageDeleted;
      const nextStatus = isDone
        ? ErasureTaskStatus.COMPLETED
        : nextAttempts >= 10
          ? ErasureTaskStatus.FAILED
          : ErasureTaskStatus.PENDING;

      if (isDone) completed += 1;
      else if (nextStatus === ErasureTaskStatus.FAILED) failed += 1;

      await prisma.erasureOutbox.update({
        where: { id: job.id },
        data: {
          vectorDeleted,
          storageDeleted,
          attempts: nextAttempts,
          lastError: errors.join(' | ') || null,
          status: nextStatus,
          ...(isDone ? { completedAt: new Date() } : {}),
        },
      });
    }

    return { processed: pending.length, completed, failed };
  }

  async updateCandidateConsent(params: {
    candidateId: string;
    tenantId: string;
    consentStatus?: ConsentStatus | string;
    lawfulBasis?: CandidateLawfulBasis | string;
    privacyNoticeVersion?: string;
    retentionDays?: number;
    actorUserId?: string;
    actorEmail?: string;
    actorRole?: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const existing = await prisma.candidate.findFirst({
      where: { id: params.candidateId, tenantId: params.tenantId },
    });
    if (!existing) {
      const err: any = new Error('Candidate not found');
      err.statusCode = 404;
      throw err;
    }

    const now = new Date();
    const { general } = await getTenantSettings(params.tenantId);
    const nextRetentionDays = normalizeCandidateRetentionDays(
      params.retentionDays ?? general.candidateRetentionDays
    );

    const statusUpper = params.consentStatus
      ? String(params.consentStatus).trim().toUpperCase()
      : undefined;
    const validConsentStatus =
      statusUpper && Object.values(ConsentStatus).includes(statusUpper as ConsentStatus)
        ? (statusUpper as ConsentStatus)
        : undefined;

    const basisUpper = params.lawfulBasis
      ? String(params.lawfulBasis).trim().toUpperCase()
      : undefined;
    const validBasis =
      basisUpper && Object.values(CandidateLawfulBasis).includes(basisUpper as CandidateLawfulBasis)
        ? (basisUpper as CandidateLawfulBasis)
        : undefined;

    const data: Prisma.CandidateUpdateInput = {
      ...(validBasis ? { lawfulBasis: validBasis } : {}),
      ...(validConsentStatus ? { consentStatus: validConsentStatus } : {}),
      ...(params.privacyNoticeVersion !== undefined
        ? { privacyNoticeVersion: String(params.privacyNoticeVersion).trim() || CURRENT_PRIVACY_NOTICE_VERSION }
        : {}),
    };

    if (validConsentStatus === ConsentStatus.GRANTED) {
      data.consentCapturedAt = now;
      data.consentWithdrawnAt = null;
      data.erasureNoticeSentAt = null;
      data.retentionExpiresAt = computeRetentionExpiresAt(now, nextRetentionDays);
    } else if (validConsentStatus === ConsentStatus.WITHDRAWN) {
      data.consentWithdrawnAt = now;
    } else if (params.retentionDays !== undefined) {
      data.retentionExpiresAt = computeRetentionExpiresAt(now, nextRetentionDays);
    }

    const updated = await prisma.candidate.update({
      where: { id: existing.id },
      data,
    });

    await this.recordSecurityAuditEvent({
      tenantId: params.tenantId,
      actorUserId: params.actorUserId,
      actorEmail: params.actorEmail,
      actorRole: params.actorRole,
      action:
        validConsentStatus === ConsentStatus.WITHDRAWN ? 'CONSENT_WITHDRAWN' : 'CONSENT_UPDATED',
      targetType: 'CANDIDATE',
      targetId: existing.id,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      metadata: {
        consentStatus: updated.consentStatus,
        lawfulBasis: updated.lawfulBasis,
        retentionExpiresAt: updated.retentionExpiresAt?.toISOString() || null,
      },
    });

    return updated;
  }

  /**
   * Builds a portable DSAR JSON package for a single candidate (GDPR Art. 15/20 & India DPDPA §11).
   */
  async exportCandidateDsar(
    candidateId: string,
    tenantId: string,
    options: {
      rateMasked?: boolean;
      actorUserId?: string;
      actorEmail?: string;
      actorRole?: string;
      ipAddress?: string;
      userAgent?: string;
    } = {}
  ) {
    const candidate = await prisma.candidate.findFirst({
      where: { id: candidateId, tenantId },
      include: {
        vendor: { select: { id: true, name: true } },
        submissions: {
          include: {
            requirement: {
              select: {
                id: true,
                code: true,
                opportunityTitle: true,
                companyName: true,
                location: true,
                workModel: true,
                status: true,
              },
            },
          },
          orderBy: { submissionDate: 'desc' },
        },
        placements: {
          orderBy: { startDate: 'desc' },
        },
      },
    });

    if (!candidate) {
      const err: any = new Error('Candidate not found or unauthorized');
      err.statusCode = 404;
      throw err;
    }

    const [settings, emailLogs] = await Promise.all([
      getTenantSettings(tenantId),
      prisma.emailLog.findMany({
        where: {
          tenantId,
          recipientEmail: { equals: candidate.email, mode: 'insensitive' },
        },
        select: {
          id: true,
          recipientEmail: true,
          subject: true,
          status: true,
          sentAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const rateMasked = Boolean(options.rateMasked);
    const sanitizeRates = <T extends Record<string, any>>(record: T): T =>
      rateMasked ? maskFinancialRecord(record) : record;

    const exportedPayload = {
      schemaVersion: '1.0',
      exportType: 'CANDIDATE_DSAR',
      exportedAt: new Date().toISOString(),
      tenantId,
      dataRegion: resolveDeploymentDataRegion(),
      controller: {
        agencyName: settings.general.agencyName,
        legalEntityName: settings.general.legalEntityName || settings.general.agencyName,
        grievanceEmail:
          resolveEnvGrievanceEmail() ||
          settings.general.grievanceEmail ||
          settings.general.supportEmail ||
          'privacy@squadpipe.com',
      },
      candidate: sanitizeRates({
        id: candidate.id,
        fullName: candidate.fullName,
        email: candidate.email,
        phone: candidate.phone,
        currentTitle: candidate.currentTitle,
        workAuth: candidate.workAuth,
        education: candidate.education,
        skillset: candidate.skillset,
        normalizedSkills: candidate.normalizedSkills,
        hourlyRateW2: candidate.hourlyRateW2,
        hourlyRateC2c: candidate.hourlyRateC2c,
        hourlyRateDisplay: candidate.hourlyRateDisplay,
        relocation: candidate.relocation,
        pipelineStage: candidate.pipelineStage,
        customFields: candidate.customFields,
        rawSnippet: candidate.rawSnippet,
        vendor: candidate.vendor,
        resume: {
          fileName: candidate.resumeFileName,
          format: candidate.resumeFormat,
          storageUri: candidate.resumeFileUrl,
        },
        createdAt: candidate.createdAt,
        updatedAt: candidate.updatedAt,
      }),
      privacyAndConsent: {
        lawfulBasis: candidate.lawfulBasis,
        consentStatus: candidate.consentStatus,
        consentCapturedAt: candidate.consentCapturedAt,
        consentWithdrawnAt: candidate.consentWithdrawnAt,
        privacyNoticeVersion: candidate.privacyNoticeVersion,
        intakeSource: candidate.intakeSource,
        retentionExpiresAt: candidate.retentionExpiresAt,
        erasureNoticeSentAt: candidate.erasureNoticeSentAt,
      },
      sharedWithThirdParties: candidate.submissions.map((sub) =>
        sanitizeRates({
          submissionId: sub.id,
          stage: sub.stage,
          intakeSource: sub.intakeSource,
          submittedRate: sub.submittedRate,
          submittedVendorName: sub.submittedVendorName,
          submissionDate: sub.submissionDate,
          interviewDate: sub.interviewDate,
          clientCompany: sub.requirement?.companyName || null,
          requirementCode: sub.requirement?.code || null,
          opportunityTitle: sub.requirement?.opportunityTitle || null,
          location: sub.requirement?.location || null,
        })
      ),
      placements: candidate.placements.map((pl) => sanitizeRates({ ...pl })),
      emailCommunications: emailLogs,
    };

    await this.recordSecurityAuditEvent({
      tenantId,
      actorUserId: options.actorUserId,
      actorEmail: options.actorEmail,
      actorRole: options.actorRole,
      action: 'CANDIDATE_EXPORTED',
      targetType: 'CANDIDATE',
      targetId: candidate.id,
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
      metadata: {
        submissionsCount: candidate.submissions.length,
        placementsCount: candidate.placements.length,
      },
    });

    return exportedPayload;
  }

  /**
   * Builds a complete isolated tenant workspace export (fulfills Privacy Policy §07 & Terms §09).
   */
  async exportWorkspaceData(
    tenantId: string,
    options: {
      rateMasked?: boolean;
      actorUserId?: string;
      actorEmail?: string;
      actorRole?: string;
      ipAddress?: string;
      userAgent?: string;
    } = {}
  ) {
    const rateMasked = Boolean(options.rateMasked);
    const sanitizeRates = <T extends Record<string, any>>(record: T): T =>
      rateMasked ? maskFinancialRecord(record) : record;

    const [
      settings,
      users,
      candidates,
      clients,
      vendors,
      requirements,
      submissions,
      placements,
      customFields,
      taxonomies,
      automationRules,
      slaTasks,
      securityAuditLogs,
    ] = await Promise.all([
      getTenantSettings(tenantId),
      prisma.user.findMany({
        where: { tenantId },
        select: {
          id: true,
          email: true,
          fullName: true,
          agencyName: true,
          role: true,
          desk: true,
          rateMasked: true,
          status: true,
          lastActiveAt: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.candidate.findMany({ where: { tenantId }, orderBy: { createdAt: 'asc' } }),
      prisma.client.findMany({
        where: { tenantId },
        include: { contacts: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.vendor.findMany({
        where: { tenantId },
        include: { contacts: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.requirement.findMany({ where: { tenantId }, orderBy: { createdAt: 'asc' } }),
      prisma.submission.findMany({ where: { tenantId }, orderBy: { createdAt: 'asc' } }),
      prisma.placement.findMany({ where: { tenantId }, orderBy: { createdAt: 'asc' } }),
      prisma.customFieldDefinition.findMany({ where: { tenantId }, orderBy: { createdAt: 'asc' } }),
      prisma.masterTaxonomy.findMany({ where: { tenantId }, orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }] }),
      prisma.automationRule.findMany({ where: { tenantId }, orderBy: { createdAt: 'asc' } }),
      prisma.slaTask.findMany({ where: { tenantId }, orderBy: { createdAt: 'asc' } }),
      prisma.securityAuditLog.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 5000,
      }),
    ]);

    const exportBundle = {
      schemaVersion: '1.0',
      exportType: 'WORKSPACE_FULL_EXPORT',
      exportedAt: new Date().toISOString(),
      tenantId,
      dataRegion: resolveDeploymentDataRegion(),
      settings: settings.general,
      counts: {
        users: users.length,
        candidates: candidates.length,
        clients: clients.length,
        vendors: vendors.length,
        requirements: requirements.length,
        submissions: submissions.length,
        placements: placements.length,
      },
      users,
      candidates: candidates.map((c) => sanitizeRates({ ...c })),
      clients,
      vendors,
      requirements: requirements.map((r) => sanitizeRates({ ...r })),
      submissions: submissions.map((s) => sanitizeRates({ ...s })),
      placements: placements.map((p) => sanitizeRates({ ...p })),
      customFields,
      taxonomies,
      automationRules,
      slaTasks,
      securityAuditLogs,
    };

    await this.recordSecurityAuditEvent({
      tenantId,
      actorUserId: options.actorUserId,
      actorEmail: options.actorEmail,
      actorRole: options.actorRole,
      action: 'WORKSPACE_EXPORTED',
      targetType: 'WORKSPACE',
      targetId: tenantId,
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
      metadata: exportBundle.counts,
    });

    return exportBundle;
  }

  async getComplianceOverview(tenantId: string) {
    const now = new Date();
    const [
      settings,
      totalCandidates,
      consentedCount,
      withdrawnCount,
      pendingConsentCount,
      retentionReviewDueCount,
      pendingErasureJobs,
      securityAuditLogCount,
    ] = await Promise.all([
      getTenantSettings(tenantId),
      prisma.candidate.count({ where: { tenantId } }),
      prisma.candidate.count({ where: { tenantId, consentStatus: ConsentStatus.GRANTED } }),
      prisma.candidate.count({ where: { tenantId, consentStatus: ConsentStatus.WITHDRAWN } }),
      prisma.candidate.count({ where: { tenantId, consentStatus: ConsentStatus.PENDING } }),
      prisma.candidate.count({
        where: {
          tenantId,
          retentionExpiresAt: { lte: now },
          pipelineStage: { not: 'BILLABLE' },
        },
      }),
      prisma.erasureOutbox.count({
        where: { tenantId, status: { in: [ErasureTaskStatus.PENDING, ErasureTaskStatus.FAILED] } },
      }),
      prisma.securityAuditLog.count({ where: { tenantId } }),
    ]);

    return {
      tenantId,
      dataRegion: resolveDeploymentDataRegion(),
      candidateRetentionDays: resolveEnvCandidateRetentionDays(),
      autoDeleteCandidates: false,
      privacyNoticeVersion: CURRENT_PRIVACY_NOTICE_VERSION,
      securityLogRetentionDays: SECURITY_AUDIT_RETENTION_DAYS,
      grievanceEmail:
        resolveEnvGrievanceEmail() ||
        settings.general.grievanceEmail ||
        settings.general.supportEmail ||
        'privacy@squadpipe.com',
      candidates: {
        total: totalCandidates,
        consentGranted: consentedCount,
        consentWithdrawn: withdrawnCount,
        consentPending: pendingConsentCount,
        retentionReviewDue: retentionReviewDueCount,
      },
      erasureQueue: {
        pendingOrFailed: pendingErasureJobs,
      },
      securityAuditLogCount,
    };
  }
}

export const complianceService = new ComplianceService();
