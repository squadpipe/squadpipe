import crypto from 'node:crypto';
import { AutomationCategory, CandidatePipelineStage, SlaCategory } from '@prisma/client';
import { prisma } from '../config/prisma.config';
import { getTenantSettings } from '../config/smtp.config';
import { parseRateNumber } from '../utils/rateParser';
import { automationEngineService } from './automationEngine.service';
import { capabilityService } from './capability.service';
import { cvStorageService, type UploadedCvFile } from './cvStorage.service';
import {
  buildEnhancedResumeParseResponse,
  buildNodeResumeFallback,
  cleanParseField,
} from './ai/parseBridge.service';
import { REQUIREMENT_INCLUDE, RequirementStatus } from './requirement.service';
import { resumeParserClientService } from './resumeParserClient.service';
import { slaEngineService } from './slaEngine.service';

export interface PublicRequirementView {
  agencyName: string;
  code: string;
  opportunityTitle: string;
  location: string;
  workModel: 'Remote' | 'Hybrid' | 'Onsite';
  skillsRequired: string;
  openPositions: number;
  publicDescription: string | null;
}

export interface ValidatedPublicApplication {
  fullName: string;
  email: string;
  phone: string;
  workAuth: string;
  submittedRate: string | null;
  submittedVendorName: string | null;
  currentTitleInput: string | null;
}

export type PublicSubmissionHook = (context: {
  submissionId: string;
  requirementId: string;
  candidateId: string;
  tenantId: string;
}) => Promise<void>;

let registeredSubmissionHook: PublicSubmissionHook | null = null;

/**
 * Allows downstream features (e.g., Step 5 Capability Evaluation) to run
 * non-blockingly whenever an applicant submits via the public form.
 */
export function registerPublicSubmissionHook(hook: PublicSubmissionHook | null) {
  registeredSubmissionHook = hook;
}

function createHttpError(message: string, statusCode: number): Error & { statusCode: number } {
  const err = new Error(message) as Error & { statusCode: number };
  err.statusCode = statusCode;
  return err;
}

/**
 * Generates an opaque, cryptographically random URL-safe public form token.
 */
export function generatePublicFormToken(): string {
  return crypto.randomBytes(18).toString('base64url');
}

export function formatWorkModelLabel(raw?: string | null): 'Remote' | 'Hybrid' | 'Onsite' {
  const upper = String(raw || '').trim().toUpperCase();
  if (upper === 'HYBRID') return 'Hybrid';
  if (upper === 'ONSITE' || upper === 'ON_SITE') return 'Onsite';
  return 'Remote';
}

/**
 * Strict allowlist serializer for public intake pages. Never exposes client names,
 * internal bill/pay rates, client contact emails, or raw forwarded emails.
 */
export function serializePublicRequirementPayload(
  reqRecord: {
    code: string;
    opportunityTitle: string;
    location: string;
    workModel?: string | null;
    skillsRequired: string;
    openPositions: number;
    publicDescription?: string | null;
  },
  agencyName: string
): PublicRequirementView {
  return {
    agencyName: String(agencyName || '').trim() || 'SquadPipe Staffing',
    code: reqRecord.code,
    opportunityTitle: reqRecord.opportunityTitle,
    location: reqRecord.location,
    workModel: formatWorkModelLabel(reqRecord.workModel),
    skillsRequired: reqRecord.skillsRequired || '',
    openPositions: Number.isInteger(reqRecord.openPositions) && reqRecord.openPositions > 0 ? reqRecord.openPositions : 1,
    publicDescription: reqRecord.publicDescription ? String(reqRecord.publicDescription).trim() : null,
  };
}

/**
 * Validates anti-spam honeypot fields, candidate contact fields, and uploaded CV.
 */
export function validatePublicApplicationInput(
  body: Record<string, any> | undefined,
  file?: UploadedCvFile | null
): ValidatedPublicApplication {
  const input = body || {};

  // Reject automated bots that populate hidden honeypot inputs.
  const honeypot = String(input._hpWebsite || input.hpWebsite || input.website || '').trim();
  if (honeypot) {
    throw createHttpError('Unable to process application.', 400);
  }

  const fullName = String(input.fullName || '').trim();
  if (fullName.length < 2 || fullName.length > 120) {
    throw createHttpError('Full Name is required (2–120 characters).', 400);
  }

  const email = String(input.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 180) {
    throw createHttpError('A valid Email Address is required.', 400);
  }

  const phone = String(input.phone || '').trim();
  if (phone.length < 6 || phone.length > 40) {
    throw createHttpError('A valid Phone Number is required.', 400);
  }

  const workAuth = String(input.workAuth || '').trim();
  if (workAuth.length < 2 || workAuth.length > 60) {
    throw createHttpError('Work Authorization is required.', 400);
  }

  if (!file || !file.buffer || file.buffer.length === 0) {
    throw createHttpError('Please attach your resume (.pdf, .doc, .docx, .txt, or .rtf).', 400);
  }

  const rawRate = String(input.submittedRate || '').trim();
  const submittedRate = rawRate ? rawRate.slice(0, 60) : null;

  const rawVendor = String(input.submittedVendorName || '').trim();
  const submittedVendorName = rawVendor ? rawVendor.slice(0, 120) : null;

  const rawTitle = String(input.currentTitle || '').trim();
  const currentTitleInput = rawTitle ? rawTitle.slice(0, 120) : null;

  return {
    fullName,
    email,
    phone,
    workAuth,
    submittedRate,
    submittedVendorName,
    currentTitleInput,
  };
}

async function parseSubmittedCvSafely(file: UploadedCvFile, tenantId: string) {
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

  try {
    const enhanced = await buildEnhancedResumeParseResponse({
      upstreamPayload,
      rawTextForAi,
      tenantId,
      rateMasked: false,
    });
    const payload = enhanced?.data || enhanced || {};
    const skillsCsv = Array.isArray(payload.skills)
      ? payload.skills.join(', ')
      : cleanParseField(payload.skillset || payload.skills);
    return {
      currentTitle: cleanParseField(payload.currentTitle || payload.current_title) || 'Consultant',
      education: cleanParseField(payload.education) || null,
      skillset: skillsCsv || 'Software Engineering',
      hourlyRate: cleanParseField(payload.hourlyRate || payload.hourly_rate) || null,
      relocation: cleanParseField(payload.relocation) || 'Yes',
      rawSnippet: String(payload.rawSnippet || payload.raw_text_snippet || rawTextForAi || '').slice(0, 8000) || null,
    };
  } catch {
    const fallback = buildNodeResumeFallback(file.buffer, file.originalname);
    return {
      currentTitle: cleanParseField(fallback.current_title) || 'Consultant',
      education: null,
      skillset: Array.isArray(fallback.skills) ? fallback.skills.join(', ') : 'Software Engineering',
      hourlyRate: cleanParseField(fallback.hourly_rate) || null,
      relocation: cleanParseField(fallback.relocation) || 'Yes',
      rawSnippet: String(fallback.raw_text_snippet || '').slice(0, 8000) || null,
    };
  }
}

export class PublicIntakeService {
  async toggleRequirementPublicForm(params: {
    requirementId: string;
    tenantId: string;
    enabled?: boolean;
    regenerateToken?: boolean;
    publicDescription?: string | null;
  }) {
    const { requirementId, tenantId, enabled, regenerateToken, publicDescription } = params;

    const existing = await prisma.requirement.findFirst({
      where: { id: requirementId, tenantId },
    });
    if (!existing) {
      throw createHttpError('Requirement not found', 404);
    }

    const nextEnabled = enabled !== undefined ? Boolean(enabled) : existing.publicFormEnabled;
    let nextToken = existing.publicFormToken;
    if (regenerateToken === true || (nextEnabled && !nextToken)) {
      nextToken = generatePublicFormToken();
    }

    const nextDescription =
      publicDescription !== undefined
        ? String(publicDescription || '').trim() || null
        : existing.publicDescription;

    return prisma.requirement.update({
      where: { id: existing.id },
      data: {
        publicFormEnabled: nextEnabled,
        publicFormToken: nextToken,
        publicDescription: nextDescription,
      },
      include: REQUIREMENT_INCLUDE,
    });
  }

  async getPublicRequirementByToken(token: string): Promise<PublicRequirementView> {
    const cleanToken = String(token || '').trim();
    if (!cleanToken || !/^[a-zA-Z0-9_-]{8,128}$/.test(cleanToken)) {
      throw createHttpError('This position is no longer accepting applications.', 404);
    }

    const reqRecord = await prisma.requirement.findFirst({
      where: {
        publicFormToken: cleanToken,
        publicFormEnabled: true,
        status: { not: RequirementStatus.CLOSED },
      },
      select: {
        id: true,
        tenantId: true,
        code: true,
        opportunityTitle: true,
        location: true,
        workModel: true,
        skillsRequired: true,
        openPositions: true,
        publicDescription: true,
      },
    });

    if (!reqRecord) {
      throw createHttpError('This position is no longer accepting applications.', 404);
    }

    const tenantSettings = await getTenantSettings(reqRecord.tenantId);
    return serializePublicRequirementPayload(reqRecord, tenantSettings.general.agencyName);
  }

  async submitPublicApplication(params: {
    token: string;
    body: Record<string, any>;
    file?: UploadedCvFile;
  }) {
    const cleanToken = String(params.token || '').trim();
    if (!cleanToken || !/^[a-zA-Z0-9_-]{8,128}$/.test(cleanToken)) {
      throw createHttpError('This position is no longer accepting applications.', 404);
    }

    const requirement = await prisma.requirement.findFirst({
      where: {
        publicFormToken: cleanToken,
        publicFormEnabled: true,
        status: { not: RequirementStatus.CLOSED },
      },
    });
    if (!requirement) {
      throw createHttpError('This position is no longer accepting applications.', 404);
    }

    const valid = validatePublicApplicationInput(params.body, params.file);

    // Pre-check duplicate application on this requirement before writing CV bytes to disk/bucket.
    const preMatchedCand = await prisma.candidate.findUnique({
      where: {
        tenantId_email: {
          tenantId: requirement.tenantId,
          email: valid.email,
        },
      },
      select: { id: true },
    });

    if (preMatchedCand) {
      const existingSub = await prisma.submission.findUnique({
        where: {
          requirementId_candidateId: {
            requirementId: requirement.id,
            candidateId: preMatchedCand.id,
          },
        },
        select: { id: true },
      });
      if (existingSub) {
        throw createHttpError(
          'An application with this email has already been submitted for this position.',
          409
        );
      }
    }

    const cvFile = params.file!;
    const storedCv = await cvStorageService.uploadCv(cvFile, requirement.tenantId);

    const parsedCv = await parseSubmittedCvSafely(cvFile, requirement.tenantId);
    const rateSource = valid.submittedRate || parsedCv.hourlyRate || '';
    const rateDigits = rateSource ? parseRateNumber(rateSource, 0) : 0;
    const isC2C = /c2c/i.test(rateSource);

    let createdResult: {
      candidateId: string;
      candidateName: string;
      submissionId: string;
      submittedAt: Date;
    };

    try {
      createdResult = await prisma.$transaction(async (tx) => {
        const existingCandidate = await tx.candidate.findUnique({
          where: {
            tenantId_email: {
              tenantId: requirement.tenantId,
              email: valid.email,
            },
          },
        });

        let candidateId: string;
        let candidateName: string;

        if (existingCandidate) {
          const existingSub = await tx.submission.findUnique({
            where: {
              requirementId_candidateId: {
                requirementId: requirement.id,
                candidateId: existingCandidate.id,
              },
            },
            select: { id: true },
          });
          if (existingSub) {
            throw createHttpError(
              'An application with this email has already been submitted for this position.',
              409
            );
          }

          const shouldAdvanceToSubmitted =
            existingCandidate.pipelineStage === CandidatePipelineStage.AVAILABLE_BENCH;

          const updatedCand = await tx.candidate.update({
            where: { id: existingCandidate.id },
            data: {
              phone: valid.phone || existingCandidate.phone,
              workAuth: valid.workAuth || existingCandidate.workAuth,
              resumeFileName: storedCv.originalFileName,
              resumeFormat: storedCv.resumeFormat,
              resumeFileUrl: storedCv.storageUri,
              ...(parsedCv.rawSnippet ? { rawSnippet: parsedCv.rawSnippet } : {}),
              ...(parsedCv.skillset &&
              parsedCv.skillset !== 'Software Engineering' &&
              parsedCv.skillset.length > existingCandidate.skillset.length
                ? { skillset: parsedCv.skillset }
                : {}),
              ...(shouldAdvanceToSubmitted
                ? { pipelineStage: CandidatePipelineStage.SUBMITTED }
                : {}),
            },
            select: { id: true, fullName: true },
          });
          candidateId = updatedCand.id;
          candidateName = updatedCand.fullName;
        } else {
          const newCand = await tx.candidate.create({
            data: {
              tenantId: requirement.tenantId,
              fullName: valid.fullName,
              email: valid.email,
              phone: valid.phone,
              currentTitle: valid.currentTitleInput || parsedCv.currentTitle,
              workAuth: valid.workAuth,
              education: parsedCv.education,
              skillset: parsedCv.skillset,
              hourlyRateDisplay: valid.submittedRate || parsedCv.hourlyRate,
              hourlyRateW2: rateDigits > 0 && !isC2C ? rateDigits : null,
              hourlyRateC2c: rateDigits > 0 && isC2C ? rateDigits : null,
              relocation: parsedCv.relocation,
              resumeFileName: storedCv.originalFileName,
              resumeFormat: storedCv.resumeFormat,
              resumeFileUrl: storedCv.storageUri,
              rawSnippet: parsedCv.rawSnippet,
              pipelineStage: CandidatePipelineStage.SUBMITTED,
              assignedRecruiterId: requirement.assignedRecruiterId || null,
            },
            select: { id: true, fullName: true },
          });
          candidateId = newCand.id;
          candidateName = newCand.fullName;
        }

        const submission = await tx.submission.create({
          data: {
            tenantId: requirement.tenantId,
            requirementId: requirement.id,
            candidateId,
            recruiterId: requirement.assignedRecruiterId || null,
            stage: RequirementStatus.SUBMITTED,
            intakeSource: 'PUBLIC_FORM',
            submittedRate: valid.submittedRate,
            submittedVendorName: valid.submittedVendorName,
          },
          select: { id: true, createdAt: true },
        });

        if (requirement.status === RequirementStatus.REQUIREMENT) {
          await tx.requirement.update({
            where: { id: requirement.id },
            data: { status: RequirementStatus.SUBMITTED },
          });
        }

        return {
          candidateId,
          candidateName,
          submissionId: submission.id,
          submittedAt: submission.createdAt,
        };
      });
    } catch (err) {
      await cvStorageService.deleteCv(storedCv.storageUri).catch(() => {});
      throw err;
    }

    // Non-critical post-intake lifecycle notifications & downstream capability hook.
    try {
      await slaEngineService.resolveTasksForEntity(requirement.tenantId, 'requirement', requirement.id, [
        SlaCategory.STALE_REQUIREMENT,
      ]);
      await automationEngineService.recordLifecycleEvent({
        tenantId: requirement.tenantId,
        preferredCategories: [AutomationCategory.FEEDBACK, AutomationCategory.STALE_REQ],
        ruleName: 'Public CV Form Intake',
        target: `${createdResult.candidateName} -> ${requirement.code} (${requirement.opportunityTitle})`,
        conditionsMet: valid.submittedVendorName
          ? `Applied via shareable form by vendor "${valid.submittedVendorName}"`
          : 'Applied directly via shareable CV intake form',
        actionDispatched: 'Saved CV, linked applicant to requirement & notified recruiter',
      });
      await slaEngineService.evaluateSlaRadar(requirement.tenantId);
    } catch {
      // Non-critical audit / SLA update
    }

    // Automatically evaluate submitted resume capability (AI or deterministic offline fallback).
    try {
      await capabilityService.evaluateSubmission(createdResult.submissionId, requirement.tenantId, {
        rateMasked: true,
      });
    } catch {
      // Non-critical capability check
    }

    if (registeredSubmissionHook) {
      try {
        await registeredSubmissionHook({
          submissionId: createdResult.submissionId,
          requirementId: requirement.id,
          candidateId: createdResult.candidateId,
          tenantId: requirement.tenantId,
        });
      } catch {
        // Non-critical downstream evaluation hook
      }
    }

    const tenantSettings = await getTenantSettings(requirement.tenantId);

    return {
      agencyName: tenantSettings.general.agencyName || 'SquadPipe Staffing',
      submissionId: createdResult.submissionId,
      candidateName: createdResult.candidateName,
      requirementCode: requirement.code,
      opportunityTitle: requirement.opportunityTitle,
      submittedAt: createdResult.submittedAt,
    };
  }
}

export const publicIntakeService = new PublicIntakeService();
