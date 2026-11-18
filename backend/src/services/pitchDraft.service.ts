import { PitchTone } from '@prisma/client';
import { prisma } from '../config/prisma.config';
import { getTenantSettings } from '../config/smtp.config';
import { aiService, redactRatesFromText } from './ai/ai.service';
import type {
  CapabilityCandidateInput,
  CapabilityRequirementInput,
} from './ai/ai.types';

export type PitchPurpose = 'client_pitch' | 'interview_followup';

export interface PitchDraftResponsePayload {
  submissionId: string;
  subject: string;
  bodyText: string;
  aiUsed: boolean;
  quotaNotice?: string;
  purpose: PitchPurpose;
  pitchTone: PitchTone;
  agencyName: string;
  recipientEmail: string;
  recipientName: string;
}

function createHttpError(message: string, statusCode: number): Error & { statusCode: number } {
  const err = new Error(message) as Error & { statusCode: number };
  err.statusCode = statusCode;
  return err;
}

export function normalizePitchPurpose(input?: unknown): PitchPurpose {
  const raw = String(input || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (raw === 'interview_followup' || raw === 'followup' || raw === 'follow_up') {
    return 'interview_followup';
  }
  return 'client_pitch';
}

export function normalizePitchToneInput(input?: unknown): PitchTone {
  const raw = String(input || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (raw === 'HIGH_IMPACT') return PitchTone.HIGH_IMPACT;
  if (raw === 'TECHNICAL_FOCUS') return PitchTone.TECHNICAL_FOCUS;
  return PitchTone.PROFESSIONAL;
}

/**
 * Pure rate-safe pitch generator delegating to `aiService.draftClientPitch()` and
 * applying defense-in-depth rate scrubbing when `rateMasked` is enabled.
 */
export async function generatePitchDraftPure(params: {
  submissionId: string;
  candidate: CapabilityCandidateInput;
  requirement: CapabilityRequirementInput;
  agencyName: string;
  recipientEmail?: string | null;
  recipientName?: string | null;
  pitchTone?: unknown;
  purpose?: unknown;
  rateMasked?: boolean;
  tenantId?: string;
  userId?: string;
  aiSvc?: Pick<typeof aiService, 'draftClientPitch'>;
}): Promise<PitchDraftResponsePayload> {
  const rateMasked = Boolean(params.rateMasked);
  const tone = normalizePitchToneInput(params.pitchTone);
  const purpose = normalizePitchPurpose(params.purpose);
  const agencyName = String(params.agencyName || '').trim() || 'SquadPipe Staffing';
  const aiSvc = params.aiSvc || aiService;

  const safeCandidate: CapabilityCandidateInput = rateMasked
    ? {
        ...params.candidate,
        hourlyRateDisplay: undefined,
        rawSnippet: redactRatesFromText(params.candidate.rawSnippet),
      }
    : params.candidate;

  const safeRequirement: CapabilityRequirementInput = rateMasked
    ? {
        ...params.requirement,
        targetBillRate: null,
        maxBillRate: null,
        targetPayRate: null,
        rawEmailText: redactRatesFromText(params.requirement.rawEmailText),
      }
    : params.requirement;

  const result = await aiSvc.draftClientPitch(safeCandidate, safeRequirement, {
    tone,
    purpose,
    rateMasked,
    agencyName,
    tenantId: params.tenantId,
    userId: params.userId,
  });

  const cleanSubject = rateMasked ? redactRatesFromText(result.subject) : result.subject;
  const cleanBody = rateMasked ? redactRatesFromText(result.bodyText) : result.bodyText;

  return {
    submissionId: params.submissionId,
    subject: cleanSubject,
    bodyText: cleanBody,
    aiUsed: result.aiUsed,
    ...(result.quotaNotice ? { quotaNotice: result.quotaNotice } : {}),
    purpose,
    pitchTone: tone,
    agencyName,
    recipientEmail: String(params.recipientEmail || '').trim(),
    recipientName: String(params.recipientName || '').trim(),
  };
}

export class PitchDraftService {
  async draftForSubmission(params: {
    submissionId: string;
    tenantId: string;
    userId?: string;
    pitchTone?: unknown;
    purpose?: unknown;
    rateMasked?: boolean;
    aiSvc?: Pick<typeof aiService, 'draftClientPitch'>;
  }): Promise<PitchDraftResponsePayload> {
    const submission = await prisma.submission.findFirst({
      where: { id: params.submissionId, tenantId: params.tenantId },
      include: {
        candidate: true,
        requirement: {
          include: {
            clientContact: true,
          },
        },
      },
    });

    if (!submission || !submission.candidate || !submission.requirement) {
      throw createHttpError('Submission not found for tenant', 404);
    }

    const settings = await getTenantSettings(params.tenantId);
    const agencyName = settings.general.agencyName || 'SquadPipe Staffing';

    return generatePitchDraftPure({
      submissionId: submission.id,
      candidate: {
        id: submission.candidate.id,
        fullName: submission.candidate.fullName,
        currentTitle: submission.candidate.currentTitle,
        skillset: submission.candidate.skillset,
        workAuth: submission.candidate.workAuth,
        relocation: submission.candidate.relocation,
        hourlyRateDisplay:
          submission.submittedRate || submission.candidate.hourlyRateDisplay || undefined,
        rawSnippet: submission.candidate.rawSnippet ?? undefined,
      },
      requirement: {
        id: submission.requirement.id,
        code: submission.requirement.code,
        companyName: submission.requirement.companyName,
        opportunityTitle: submission.requirement.opportunityTitle,
        skillsRequired: submission.requirement.skillsRequired,
        location: submission.requirement.location,
        workModel: submission.requirement.workModel,
        targetBillRate: submission.requirement.targetBillRate
          ? Number(submission.requirement.targetBillRate)
          : null,
        maxBillRate: submission.requirement.maxBillRate
          ? Number(submission.requirement.maxBillRate)
          : null,
        targetPayRate: submission.requirement.targetPayRate
          ? Number(submission.requirement.targetPayRate)
          : null,
        rawEmailText:
          submission.requirement.publicDescription ||
          submission.requirement.rawEmailText ||
          null,
      },
      agencyName,
      recipientEmail: submission.requirement.clientContact?.email || '',
      recipientName: submission.requirement.clientContact?.fullName || '',
      pitchTone: params.pitchTone || submission.pitchTone,
      purpose: params.purpose,
      rateMasked: params.rateMasked,
      tenantId: params.tenantId,
      userId: params.userId,
      aiSvc: params.aiSvc,
    });
  }
}

export const pitchDraftService = new PitchDraftService();
