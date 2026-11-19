import { PitchTone, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.config';
import { getTenantSettings } from '../config/smtp.config';
import {
  aiService,
  normalizePitchEmailSpacing,
  redactRatesFromText,
} from './ai/ai.service';
import type {
  CapabilityCandidateInput,
  CapabilityRequirementInput,
} from './ai/ai.types';

export type PitchPurpose = 'client_pitch' | 'interview_followup';

export interface SavedPitchDraftEntry {
  subject: string;
  bodyText: string;
  aiUsed: boolean;
  manuallyEdited?: boolean;
  purpose: PitchPurpose;
  pitchTone: PitchTone;
  generatedAt: string;
}

export type PitchDraftCacheMap = Record<string, SavedPitchDraftEntry>;

export interface PitchDraftResponsePayload {
  submissionId: string;
  subject: string;
  bodyText: string;
  aiUsed: boolean;
  cached?: boolean;
  generatedAt?: string;
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

export function buildPitchCacheKey(
  purpose: PitchPurpose,
  tone: PitchTone,
  rateMasked: boolean
): string {
  return `${purpose}:${tone}:${rateMasked ? 'masked' : 'unmasked'}`;
}

export function normalizePitchCacheMap(raw: unknown): PitchDraftCacheMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const result: PitchDraftCacheMap = {};
  for (const [key, entry] of Object.entries(raw as Record<string, unknown>)) {
    if (!entry || typeof entry !== 'object') continue;
    const item = entry as Record<string, unknown>;
    const subject = typeof item.subject === 'string' ? item.subject : '';
    const bodyText = typeof item.bodyText === 'string' ? item.bodyText : '';
    if (!subject && !bodyText) continue;
    result[key] = {
      subject,
      bodyText,
      aiUsed: Boolean(item.aiUsed),
      ...(item.manuallyEdited ? { manuallyEdited: true } : {}),
      purpose: normalizePitchPurpose(item.purpose),
      pitchTone: normalizePitchToneInput(item.pitchTone),
      generatedAt:
        typeof item.generatedAt === 'string' && item.generatedAt
          ? item.generatedAt
          : new Date().toISOString(),
    };
  }
  return result;
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
  senderName?: string | null;
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
    senderName: params.senderName ? String(params.senderName).trim() : undefined,
    recipientName: params.recipientName ? String(params.recipientName).trim() : undefined,
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
    cached: false,
    generatedAt: new Date().toISOString(),
    ...(result.quotaNotice ? { quotaNotice: result.quotaNotice } : {}),
    purpose,
    pitchTone: tone,
    agencyName,
    recipientEmail: String(params.recipientEmail || '').trim(),
    recipientName: String(params.recipientName || '').trim(),
  };
}

/**
 * Pure cache-first pitch resolver: returns the saved draft for `(purpose, tone, maskState)`
 * without calling AI unless `forceRegenerate` is true or no saved draft exists yet.
 */
export async function selectOrGeneratePitchDraftPure(params: {
  submissionId: string;
  existingCache?: unknown;
  forceRegenerate?: boolean;
  candidate: CapabilityCandidateInput;
  requirement: CapabilityRequirementInput;
  agencyName: string;
  senderName?: string | null;
  recipientEmail?: string | null;
  recipientName?: string | null;
  pitchTone?: unknown;
  purpose?: unknown;
  rateMasked?: boolean;
  tenantId?: string;
  userId?: string;
  aiSvc?: Pick<typeof aiService, 'draftClientPitch'>;
}): Promise<{
  draft: PitchDraftResponsePayload;
  nextCache: PitchDraftCacheMap;
  didGenerate: boolean;
}> {
  const rateMasked = Boolean(params.rateMasked);
  const tone = normalizePitchToneInput(params.pitchTone);
  const purpose = normalizePitchPurpose(params.purpose);
  const agencyName = String(params.agencyName || '').trim() || 'SquadPipe Staffing';
  const cacheMap = normalizePitchCacheMap(params.existingCache);
  const cacheKey = buildPitchCacheKey(purpose, tone, rateMasked);
  const cachedEntry = cacheMap[cacheKey];

  if (!params.forceRegenerate && cachedEntry && (cachedEntry.subject || cachedEntry.bodyText)) {
    const cleanSubject = rateMasked ? redactRatesFromText(cachedEntry.subject) : cachedEntry.subject;
    const rawBody = cachedEntry.manuallyEdited
      ? cachedEntry.bodyText
      : normalizePitchEmailSpacing(cachedEntry.bodyText);
    const cleanBody = rateMasked ? redactRatesFromText(rawBody) : rawBody;

    return {
      didGenerate: false,
      nextCache: cacheMap,
      draft: {
        submissionId: params.submissionId,
        subject: cleanSubject,
        bodyText: cleanBody,
        aiUsed: Boolean(cachedEntry.aiUsed),
        cached: true,
        generatedAt: cachedEntry.generatedAt,
        purpose,
        pitchTone: tone,
        agencyName,
        recipientEmail: String(params.recipientEmail || '').trim(),
        recipientName: String(params.recipientName || '').trim(),
      },
    };
  }

  const generated = await generatePitchDraftPure({
    submissionId: params.submissionId,
    candidate: params.candidate,
    requirement: params.requirement,
    agencyName,
    senderName: params.senderName,
    recipientEmail: params.recipientEmail,
    recipientName: params.recipientName,
    pitchTone: tone,
    purpose,
    rateMasked,
    tenantId: params.tenantId,
    userId: params.userId,
    aiSvc: params.aiSvc,
  });

  const nextCache: PitchDraftCacheMap = {
    ...cacheMap,
    [cacheKey]: {
      subject: generated.subject,
      bodyText: generated.bodyText,
      aiUsed: generated.aiUsed,
      purpose,
      pitchTone: tone,
      generatedAt: generated.generatedAt || new Date().toISOString(),
    },
  };

  return {
    didGenerate: true,
    nextCache,
    draft: generated,
  };
}

export class PitchDraftService {
  async draftForSubmission(params: {
    submissionId: string;
    tenantId: string;
    userId?: string;
    senderName?: string | null;
    pitchTone?: unknown;
    purpose?: unknown;
    rateMasked?: boolean;
    forceRegenerate?: boolean;
    aiSvc?: Pick<typeof aiService, 'draftClientPitch'>;
  }): Promise<PitchDraftResponsePayload> {
    const submission = await prisma.submission.findFirst({
      where: { id: params.submissionId, tenantId: params.tenantId },
      include: {
        candidate: true,
        recruiter: { select: { fullName: true } },
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
    const senderName =
      String(params.senderName || submission.recruiter?.fullName || '').trim() || undefined;

    const { draft, nextCache, didGenerate } = await selectOrGeneratePitchDraftPure({
      submissionId: submission.id,
      existingCache: submission.pitchDrafts,
      forceRegenerate: Boolean(params.forceRegenerate),
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
      senderName,
      recipientEmail: submission.requirement.clientContact?.email || '',
      recipientName: submission.requirement.clientContact?.fullName || '',
      pitchTone: params.pitchTone || submission.pitchTone,
      purpose: params.purpose,
      rateMasked: params.rateMasked,
      tenantId: params.tenantId,
      userId: params.userId,
      aiSvc: params.aiSvc,
    });

    if (didGenerate) {
      await prisma.submission.update({
        where: { id: submission.id },
        data: {
          pitchDrafts: nextCache as unknown as Prisma.InputJsonValue,
          pitchEmailSubject: draft.subject,
          pitchEmailBody: draft.bodyText,
          pitchTone: draft.pitchTone,
        },
      });
    }

    return draft;
  }

  async saveManualDraft(params: {
    submissionId: string;
    tenantId: string;
    purpose?: unknown;
    pitchTone?: unknown;
    rateMasked?: boolean;
    subject: string;
    bodyText: string;
  }): Promise<PitchDraftResponsePayload> {
    const submission = await prisma.submission.findFirst({
      where: { id: params.submissionId, tenantId: params.tenantId },
      include: {
        requirement: {
          include: { clientContact: true },
        },
      },
    });

    if (!submission || !submission.requirement) {
      throw createHttpError('Submission not found for tenant', 404);
    }

    const rateMasked = Boolean(params.rateMasked);
    const purpose = normalizePitchPurpose(params.purpose);
    const tone = normalizePitchToneInput(params.pitchTone);
    const cleanSubject = rateMasked
      ? redactRatesFromText(String(params.subject || '').trim())
      : String(params.subject || '').trim();
    const cleanBody = rateMasked
      ? redactRatesFromText(String(params.bodyText || '').trim())
      : String(params.bodyText || '').trim();

    if (!cleanSubject && !cleanBody) {
      throw createHttpError('Subject or email body is required', 400);
    }

    const settings = await getTenantSettings(params.tenantId);
    const agencyName = settings.general.agencyName || 'SquadPipe Staffing';
    const cacheMap = normalizePitchCacheMap(submission.pitchDrafts);
    const cacheKey = buildPitchCacheKey(purpose, tone, rateMasked);
    const prevEntry = cacheMap[cacheKey];
    const generatedAt = new Date().toISOString();

    const nextCache: PitchDraftCacheMap = {
      ...cacheMap,
      [cacheKey]: {
        subject: cleanSubject,
        bodyText: cleanBody,
        aiUsed: Boolean(prevEntry?.aiUsed),
        manuallyEdited: true,
        purpose,
        pitchTone: tone,
        generatedAt,
      },
    };

    await prisma.submission.update({
      where: { id: submission.id },
      data: {
        pitchDrafts: nextCache as unknown as Prisma.InputJsonValue,
        pitchEmailSubject: cleanSubject,
        pitchEmailBody: cleanBody,
        pitchTone: tone,
      },
    });

    return {
      submissionId: submission.id,
      subject: cleanSubject,
      bodyText: cleanBody,
      aiUsed: Boolean(prevEntry?.aiUsed),
      cached: true,
      generatedAt,
      purpose,
      pitchTone: tone,
      agencyName,
      recipientEmail: submission.requirement.clientContact?.email || '',
      recipientName: submission.requirement.clientContact?.fullName || '',
    };
  }
}

export const pitchDraftService = new PitchDraftService();
