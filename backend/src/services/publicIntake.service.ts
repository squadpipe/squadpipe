import crypto from 'node:crypto';
import {
  AutomationCategory,
  CandidateLawfulBasis,
  CandidatePipelineStage,
  ConsentStatus,
  SlaCategory,
} from '@prisma/client';
import { getJwtAccessSecret } from '../config/jwt.config';
import { prisma } from '../config/prisma.config';
import {
  ApplicationFormTemplate,
  CustomQuestionFieldType,
  DEFAULT_APPLICATION_FORMS,
  getApplicationForms,
  getTenantSettings,
  resolveDeploymentDataRegion,
  resolveEnvCandidateRetentionDays,
  resolveEnvGrievanceEmail,
  resolveEnvPrivacyPolicyUrl,
} from '../config/smtp.config';
import {
  complianceService,
  computeRetentionExpiresAt,
  CURRENT_PRIVACY_NOTICE_VERSION,
  resolveConsentConfirmation,
} from './compliance.service';
import { parseRateNumber } from '../utils/rateParser';
import { automationEngineService } from './automationEngine.service';
import { capabilityService } from './capability.service';
import {
  cvStorageService,
  resolveCvExtension,
  type UploadedCvFile,
} from './cvStorage.service';
import {
  purifyJobTitle,
  sanitizeCandidatePersonName,
} from './ai/extractionSanitizer';
import {
  buildEnhancedResumeParseResponse,
  buildNodeResumeFallback,
  cleanParseField,
} from './ai/parseBridge.service';
import { REQUIREMENT_INCLUDE, RequirementStatus } from './requirement.service';
import { resumeParserClientService } from './resumeParserClient.service';
import { slaEngineService } from './slaEngine.service';
import { candidateIndexingService } from './vector/candidateIndexing.service';
import { extractNormalizedSkills } from '../utils/skillMatcher';
import {
  buildClientSafePublicSummaryHtml,
  formatWorkModelLabel,
  sanitizePublicSummaryHtml,
} from '../utils/publicSummary';

export interface PublicFormCustomFieldView {
  key: string;
  name: string;
  type: CustomQuestionFieldType;
  required: boolean;
  width: 'half' | 'full';
  options: string[];
}

export interface PublicFormTemplateView {
  id: string;
  name: string;
  heading: string;
  subheading: string;
  includeCurrentTitle: boolean;
  requireCurrentTitle: boolean;
  includeExpectedRate: boolean;
  requireExpectedRate: boolean;
  includeVendorName: boolean;
  requireVendorName: boolean;
  includeNoticePeriod: boolean;
  requireNoticePeriod: boolean;
  includeLinkedinUrl: boolean;
  requireLinkedinUrl: boolean;
  fieldWidths: Record<string, 'half' | 'full'>;
  fieldOrder?: string[];
  customFields: PublicFormCustomFieldView[];
}

export interface PublicRequirementView {
  agencyName: string;
  opportunityTitle: string;
  location: string;
  workModel: 'Remote' | 'Hybrid' | 'Onsite';
  skillsRequired: string;
  openPositions: number;
  publicDescription: string | null;
  highlights: string[];
  engagementSummary: string | null;
  formTemplate?: PublicFormTemplateView;
  privacyNotice?: {
    version: string;
    retentionDays: number;
    dataRegion: 'US' | 'UK' | 'IN';
    privacyPolicyUrl: string;
    grievanceEmail: string;
  };
  isPreview?: boolean;
  publicLinkEnabled?: boolean;
}

export interface PublicBasicResumeParseResult {
  fullName: string;
  email: string;
  phone: string;
  workAuth: string;
  currentTitle: string;
}

export interface ValidatedPublicApplication {
  fullName: string;
  email: string;
  phone: string;
  workAuth: string;
  submittedRate: string | null;
  submittedVendorName: string | null;
  currentTitleInput: string | null;
  noticePeriod: string | null;
  linkedinUrl: string | null;
  customFieldValues: Record<string, string>;
  privacyConsent: boolean;
  privacyNoticeVersion: string;
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

const PREVIEW_TOKEN_TTL_MS = 2 * 60 * 60 * 1000;

function computePreviewTokenSignature(params: {
  requirementId: string;
  publicFormToken: string;
  templateId?: string | null;
  expStr: string;
}): string {
  const templatePart = String(params.templateId || '').trim();
  const payload = `public-form-preview:${params.requirementId}:${params.publicFormToken}:${templatePart}:${params.expStr}`;
  return crypto
    .createHmac('sha256', getJwtAccessSecret())
    .update(payload)
    .digest('base64url');
}

/**
 * Issues a short-lived HMAC-signed token allowing authorized CRM users to preview
 * the public apply route in a new tab even while the public link is disabled.
 */
export function createPublicFormPreviewToken(params: {
  requirementId: string;
  publicFormToken: string;
  templateId?: string | null;
  expiresInMs?: number;
  nowMs?: number;
}): string {
  const expMs = (params.nowMs ?? Date.now()) + (params.expiresInMs ?? PREVIEW_TOKEN_TTL_MS);
  const expStr = expMs.toString(36);
  const sig = computePreviewTokenSignature({
    requirementId: params.requirementId,
    publicFormToken: params.publicFormToken,
    templateId: params.templateId,
    expStr,
  });
  return `${expStr}.${sig}`;
}

export function verifyPublicFormPreviewToken(
  previewToken: string,
  expected: {
    requirementId: string;
    publicFormToken: string;
    templateId?: string | null;
  },
  nowMs = Date.now()
): boolean {
  const clean = String(previewToken || '').trim();
  const dotIdx = clean.indexOf('.');
  if (dotIdx <= 0) return false;

  const expStr = clean.slice(0, dotIdx);
  const providedSig = clean.slice(dotIdx + 1);
  if (!expStr || !providedSig) return false;

  const expMs = Number.parseInt(expStr, 36);
  if (!Number.isFinite(expMs) || expMs <= nowMs) return false;

  const expectedSig = computePreviewTokenSignature({
    requirementId: expected.requirementId,
    publicFormToken: expected.publicFormToken,
    templateId: expected.templateId,
    expStr,
  });

  const a = Buffer.from(providedSig, 'utf8');
  const b = Buffer.from(expectedSig, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export { formatWorkModelLabel };

export function extractSafePublicJobDetails(reqRecord: {
  code?: string | null;
  companyName?: string | null;
  clientContact?: { fullName?: string | null } | null;
  opportunityTitle: string;
  location: string;
  workModel?: string | null;
  skillsRequired: string;
  openPositions: number;
  publicDescription?: string | null;
  rawEmailText?: string | null;
}): {
  publicDescription: string | null;
  highlights: string[];
  engagementSummary: string | null;
} {
  return buildClientSafePublicSummaryHtml(reqRecord);
}

/**
 * Strict allowlist serializer for public intake pages. Never exposes internal tracking codes,
 * client names, internal bill/pay rates, client contact emails, or raw forwarded emails.
 */
export function serializePublicRequirementPayload(
  reqRecord: {
    code?: string | null;
    companyName?: string | null;
    clientContact?: { fullName?: string | null } | null;
    opportunityTitle: string;
    location: string;
    workModel?: string | null;
    skillsRequired: string;
    openPositions: number;
    publicDescription?: string | null;
    rawEmailText?: string | null;
  },
  agencyName: string,
  formTemplate?: PublicFormTemplateView,
  previewMeta?: { isPreview?: boolean; publicLinkEnabled?: boolean }
): PublicRequirementView {
  const safeDetails = extractSafePublicJobDetails(reqRecord);
  return {
    agencyName: String(agencyName || '').trim() || 'SquadPipe Staffing',
    opportunityTitle: reqRecord.opportunityTitle,
    location: reqRecord.location,
    workModel: formatWorkModelLabel(reqRecord.workModel),
    skillsRequired: reqRecord.skillsRequired || '',
    openPositions:
      Number.isInteger(reqRecord.openPositions) && reqRecord.openPositions > 0
        ? reqRecord.openPositions
        : 1,
    publicDescription: safeDetails.publicDescription,
    highlights: safeDetails.highlights,
    engagementSummary: safeDetails.engagementSummary,
    ...(formTemplate ? { formTemplate } : {}),
    ...(previewMeta?.isPreview
      ? {
          isPreview: true,
          publicLinkEnabled: Boolean(previewMeta.publicLinkEnabled),
        }
      : {}),
  };
}

/**
 * Validates anti-spam honeypot fields, candidate contact fields, and uploaded CV.
 */
export function validatePublicApplicationInput(
  body: Record<string, any> | undefined,
  file?: UploadedCvFile | null,
  formTemplate?: PublicFormTemplateView
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

  const privacyConsent = resolveConsentConfirmation(
    input.privacyConsent ?? input.consentAccepted ?? input.acceptedPrivacyNotice
  );
  if (!privacyConsent) {
    throw createHttpError(
      'Please confirm consent to process your application and resume before submitting.',
      400
    );
  }
  const privacyNoticeVersion =
    String(input.privacyNoticeVersion || '').trim().slice(0, 40) || CURRENT_PRIVACY_NOTICE_VERSION;

  if (!file || !file.buffer || file.buffer.length === 0) {
    throw createHttpError('Please attach your resume (.pdf, .doc, .docx, .txt, or .rtf).', 400);
  }

  const rawRate = String(input.submittedRate || '').trim();
  const submittedRate = rawRate ? rawRate.slice(0, 60) : null;

  const rawVendor = String(input.submittedVendorName || '').trim();
  const submittedVendorName = rawVendor ? rawVendor.slice(0, 120) : null;

  const rawTitle = String(input.currentTitle || '').trim();
  const currentTitleInput = rawTitle ? rawTitle.slice(0, 120) : null;

  const rawNotice = String(input.noticePeriod || '').trim();
  const noticePeriod = rawNotice ? rawNotice.slice(0, 80) : null;

  const rawLinkedin = String(input.linkedinUrl || '').trim();
  const linkedinUrl = rawLinkedin ? rawLinkedin.slice(0, 200) : null;

  if (formTemplate) {
    if (formTemplate.includeCurrentTitle && formTemplate.requireCurrentTitle && !currentTitleInput) {
      throw createHttpError('Current Title / Role is required.', 400);
    }
    if (formTemplate.includeExpectedRate && formTemplate.requireExpectedRate && !submittedRate) {
      throw createHttpError('Expected Hourly Rate is required.', 400);
    }
    if (formTemplate.includeVendorName && formTemplate.requireVendorName && !submittedVendorName) {
      throw createHttpError('Partner / Vendor Agency Name is required.', 400);
    }
    if (formTemplate.includeNoticePeriod && formTemplate.requireNoticePeriod && !noticePeriod) {
      throw createHttpError('Availability / Notice Period is required.', 400);
    }
    if (formTemplate.includeLinkedinUrl && formTemplate.requireLinkedinUrl && !linkedinUrl) {
      throw createHttpError('LinkedIn Profile URL is required.', 400);
    }
  }

  let parsedCustomFields: Record<string, any> = {};
  if (typeof input.customFields === 'string' && input.customFields.trim()) {
    try {
      parsedCustomFields = JSON.parse(input.customFields);
    } catch {
      parsedCustomFields = {};
    }
  } else if (input.customFields && typeof input.customFields === 'object') {
    parsedCustomFields = input.customFields;
  }

  const customFieldValues: Record<string, string> = {};
  if (formTemplate?.customFields) {
    for (const cf of formTemplate.customFields) {
      const rawInput = String(
        parsedCustomFields[cf.key] ?? parsedCustomFields[cf.name] ?? ''
      ).trim();

      if (cf.type === 'RICH_TEXT') {
        const sanitizedHtml = sanitizePublicSummaryHtml(rawInput);
        const plainText = sanitizedHtml
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/gi, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (cf.required && !plainText) {
          throw createHttpError(`${cf.name} is required.`, 400);
        }
        if (plainText && sanitizedHtml) {
          customFieldValues[cf.name] = sanitizedHtml.slice(0, 8000);
        }
        continue;
      }

      if (cf.required && !rawInput) {
        throw createHttpError(`${cf.name} is required.`, 400);
      }
      if (!rawInput) continue;

      if (cf.type === 'EMAIL' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(rawInput)) {
        throw createHttpError(`${cf.name} must be a valid email address.`, 400);
      }
      if (cf.type === 'NUMBER' && Number.isNaN(Number(rawInput))) {
        throw createHttpError(`${cf.name} must be a valid number.`, 400);
      }
      if (cf.type === 'URL') {
        const normalizedUrl = /^https?:\/\//i.test(rawInput) ? rawInput : `https://${rawInput}`;
        try {
          const parsedUrl = new URL(normalizedUrl);
          if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            throw new Error('Invalid protocol');
          }
          customFieldValues[cf.name] = parsedUrl.toString().slice(0, 500);
          continue;
        } catch {
          throw createHttpError(`${cf.name} must be a valid website URL.`, 400);
        }
      }

      const maxLen = cf.type === 'TEXTAREA' ? 2000 : 500;
      customFieldValues[cf.name] = rawInput.slice(0, maxLen);
    }
  }

  return {
    fullName,
    email,
    phone,
    workAuth,
    submittedRate,
    submittedVendorName,
    currentTitleInput,
    noticePeriod,
    linkedinUrl,
    customFieldValues,
    privacyConsent,
    privacyNoticeVersion,
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
      rawSnippet: String(payload.rawSnippet || payload.raw_text_snippet || rawTextForAi || '').slice(0, 32000) || null,
    };
  } catch {
    const fallback = buildNodeResumeFallback(file.buffer, file.originalname);
    return {
      currentTitle: cleanParseField(fallback.current_title) || 'Consultant',
      education: null,
      skillset: Array.isArray(fallback.skills) ? fallback.skills.join(', ') : 'Software Engineering',
      hourlyRate: cleanParseField(fallback.hourly_rate) || null,
      relocation: cleanParseField(fallback.relocation) || 'Yes',
      rawSnippet: String(fallback.raw_text_snippet || '').slice(0, 32000) || null,
    };
  }
}

export class PublicIntakeService {
  private async resolveRequirementFormTemplateView(
    tenantId: string,
    reqCustomFields?: unknown,
    overrideTemplateId?: string
  ): Promise<PublicFormTemplateView> {
    const forms = await getApplicationForms(tenantId);
    const cfObj =
      reqCustomFields && typeof reqCustomFields === 'object' && !Array.isArray(reqCustomFields)
        ? (reqCustomFields as Record<string, any>)
        : {};
    const requestedTemplateId = String(overrideTemplateId || cfObj._publicFormTemplateId || '').trim();
    const matchedTemplate: ApplicationFormTemplate =
      (requestedTemplateId ? forms.find((f) => f.id === requestedTemplateId) : undefined) ||
      forms.find((f) => f.isDefault) ||
      forms[0] ||
      DEFAULT_APPLICATION_FORMS[0];

    const customFields: PublicFormCustomFieldView[] = Array.isArray(matchedTemplate.customFields)
      ? matchedTemplate.customFields.map((cf) => ({
        key: cf.key,
        name: cf.name,
        type: cf.type,
        required: Boolean(cf.required),
        width: cf.width === 'full' ? 'full' : 'half',
        options: Array.isArray(cf.options) ? cf.options : [],
      }))
      : [];
    if (matchedTemplate.customFieldKeys.length > 0) {
      try {
        const dbFields = await prisma.customFieldDefinition.findMany({
          where: {
            tenantId,
            active: true,
            key: { in: matchedTemplate.customFieldKeys },
          },
        });
        const byKey = new Map(dbFields.map((f) => [f.key, f]));
        const seenKeys = new Set(customFields.map((cf) => cf.key));
        for (const key of matchedTemplate.customFieldKeys) {
          const f = byKey.get(key);
          if (!f || seenKeys.has(f.key)) continue;
          const rawOpts = (f.options as any)?.values;
          const options = Array.isArray(rawOpts)
            ? rawOpts.map((v: any) => String(v).trim()).filter(Boolean)
            : typeof rawOpts === 'string'
              ? rawOpts
                .split(',')
                .map((v) => v.trim())
                .filter(Boolean)
              : [];
          customFields.push({
            key: f.key,
            name: f.name,
            type: f.type,
            required: Boolean(f.required),
            width: 'half',
            options,
          });
          seenKeys.add(f.key);
        }
      } catch {
        // Keep form-level customFields if DB lookup is unavailable
      }
    }

    return {
      id: matchedTemplate.id,
      name: matchedTemplate.name,
      heading: matchedTemplate.heading,
      subheading: matchedTemplate.subheading,
      includeCurrentTitle: matchedTemplate.includeCurrentTitle,
      requireCurrentTitle: matchedTemplate.requireCurrentTitle,
      includeExpectedRate: matchedTemplate.includeExpectedRate,
      requireExpectedRate: matchedTemplate.requireExpectedRate,
      includeVendorName: matchedTemplate.includeVendorName,
      requireVendorName: matchedTemplate.requireVendorName,
      includeNoticePeriod: matchedTemplate.includeNoticePeriod,
      requireNoticePeriod: matchedTemplate.requireNoticePeriod,
      includeLinkedinUrl: matchedTemplate.includeLinkedinUrl,
      requireLinkedinUrl: matchedTemplate.requireLinkedinUrl,
      fieldWidths: matchedTemplate.fieldWidths || { vendorName: 'full' },
      ...(Array.isArray(matchedTemplate.fieldOrder)
        ? { fieldOrder: matchedTemplate.fieldOrder }
        : {}),
      customFields,
    };
  }

  async toggleRequirementPublicForm(params: {
    requirementId: string;
    tenantId: string;
    enabled?: boolean;
    regenerateToken?: boolean;
    publicDescription?: string | null;
    publicFormTemplateId?: string | null;
  }) {
    const {
      requirementId,
      tenantId,
      enabled,
      regenerateToken,
      publicDescription,
      publicFormTemplateId,
    } = params;

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
        ? sanitizePublicSummaryHtml(String(publicDescription || '')) || null
        : existing.publicDescription;

    const currentCf =
      existing.customFields &&
        typeof existing.customFields === 'object' &&
        !Array.isArray(existing.customFields)
        ? { ...(existing.customFields as Record<string, any>) }
        : {};

    if (publicFormTemplateId !== undefined) {
      const cleanTemplateId = String(publicFormTemplateId || '').trim();
      if (cleanTemplateId) {
        currentCf._publicFormTemplateId = cleanTemplateId;
      } else {
        delete currentCf._publicFormTemplateId;
      }
    }

    return prisma.requirement.update({
      where: { id: existing.id },
      data: {
        publicFormEnabled: nextEnabled,
        publicFormToken: nextToken,
        publicDescription: nextDescription,
        ...(publicFormTemplateId !== undefined ? { customFields: currentCf } : {}),
      },
      include: REQUIREMENT_INCLUDE,
    });
  }

  private async resolvePublicTokenRequirement(params: {
    token: string;
    preview?: string;
    templateId?: string;
  }) {
    const cleanToken = String(params.token || '').trim();
    if (!cleanToken || !/^[a-zA-Z0-9_-]{8,128}$/.test(cleanToken)) {
      throw createHttpError('This position is no longer accepting applications.', 404);
    }

    const reqRecord = await prisma.requirement.findFirst({
      where: {
        publicFormToken: cleanToken,
        status: { not: RequirementStatus.CLOSED },
      },
      select: {
        id: true,
        tenantId: true,
        publicFormEnabled: true,
        publicFormToken: true,
        code: true,
        companyName: true,
        clientContact: { select: { fullName: true } },
        opportunityTitle: true,
        location: true,
        workModel: true,
        skillsRequired: true,
        openPositions: true,
        publicDescription: true,
        rawEmailText: true,
        customFields: true,
      },
    });

    if (!reqRecord) {
      throw createHttpError('This position is no longer accepting applications.', 404);
    }

    const previewParam = String(params.preview || '').trim();
    const requestedTemplateId = String(params.templateId || '').trim();
    const hasSignedPreview = previewParam
      ? verifyPublicFormPreviewToken(previewParam, {
          requirementId: reqRecord.id,
          publicFormToken: cleanToken,
          templateId: requestedTemplateId,
        })
      : false;
    const isPublicPreviewFlag =
      Boolean(reqRecord.publicFormEnabled) &&
      (previewParam === '1' || previewParam.toLowerCase() === 'true');

    if (!reqRecord.publicFormEnabled && !hasSignedPreview) {
      throw createHttpError('This position is no longer accepting applications.', 404);
    }

    return {
      reqRecord,
      isPreview: hasSignedPreview || isPublicPreviewFlag,
      overrideTemplateId:
        hasSignedPreview && requestedTemplateId ? requestedTemplateId : undefined,
    };
  }

  async issueRequirementPublicFormPreview(params: {
    requirementId: string;
    tenantId: string;
    templateId?: string | null;
  }) {
    const existing = await prisma.requirement.findFirst({
      where: { id: params.requirementId, tenantId: params.tenantId },
    });
    if (!existing) {
      throw createHttpError('Requirement not found', 404);
    }
    if (existing.status === RequirementStatus.CLOSED) {
      throw createHttpError(
        'Closed requirements do not support public application form preview.',
        400
      );
    }

    let publicFormToken = existing.publicFormToken;
    let updatedRequirement: any = null;
    if (!publicFormToken) {
      publicFormToken = generatePublicFormToken();
      updatedRequirement = await prisma.requirement.update({
        where: { id: existing.id },
        data: { publicFormToken },
        include: REQUIREMENT_INCLUDE,
      });
    }

    const currentCf =
      existing.customFields &&
      typeof existing.customFields === 'object' &&
      !Array.isArray(existing.customFields)
        ? (existing.customFields as Record<string, any>)
        : {};
    const effectiveTemplateId = String(
      params.templateId || currentCf._publicFormTemplateId || ''
    ).trim();

    const previewToken = createPublicFormPreviewToken({
      requirementId: existing.id,
      publicFormToken,
      templateId: effectiveTemplateId,
    });

    const queryParams = new URLSearchParams();
    queryParams.set('preview', previewToken);
    if (effectiveTemplateId) {
      queryParams.set('templateId', effectiveTemplateId);
    }

    return {
      publicFormToken,
      publicFormEnabled: Boolean(existing.publicFormEnabled),
      previewToken,
      previewPath: `/apply/${publicFormToken}?${queryParams.toString()}`,
      ...(updatedRequirement ? { requirement: updatedRequirement } : {}),
    };
  }

  async getPublicRequirementByToken(
    token: string,
    options?: { preview?: string; templateId?: string }
  ): Promise<PublicRequirementView> {
    const { reqRecord, isPreview, overrideTemplateId } =
      await this.resolvePublicTokenRequirement({
        token,
        preview: options?.preview,
        templateId: options?.templateId,
      });

    const [tenantSettings, formTemplate] = await Promise.all([
      getTenantSettings(reqRecord.tenantId),
      this.resolveRequirementFormTemplateView(
        reqRecord.tenantId,
        (reqRecord as any).customFields,
        overrideTemplateId
      ),
    ]);
    const basePayload = serializePublicRequirementPayload(
      reqRecord,
      tenantSettings.general.agencyName,
      formTemplate,
      isPreview
        ? { isPreview: true, publicLinkEnabled: Boolean(reqRecord.publicFormEnabled) }
        : undefined
    );
    return {
      ...basePayload,
      privacyNotice: {
        version: CURRENT_PRIVACY_NOTICE_VERSION,
        retentionDays: resolveEnvCandidateRetentionDays(),
        dataRegion: resolveDeploymentDataRegion(),
        privacyPolicyUrl: resolveEnvPrivacyPolicyUrl(),
        grievanceEmail:
          resolveEnvGrievanceEmail() ||
          tenantSettings.general.grievanceEmail ||
          tenantSettings.general.supportEmail ||
          'privacy@squadpipe.com',
      },
    };
  }

  /**
   * Basic deterministic resume pre-fill parser for public applicants.
   * Deliberately bypasses AI/LLM calls so unauthenticated public form traffic never consumes AI quota.
   */
  async parsePublicResumeBasic(params: {
    token: string;
    file?: UploadedCvFile;
    preview?: string;
    templateId?: string;
  }): Promise<PublicBasicResumeParseResult> {
    if (!params.file || !params.file.buffer || params.file.buffer.length === 0) {
      throw createHttpError('Resume file is required for parsing.', 400);
    }
    resolveCvExtension(params.file.originalname, params.file.mimetype);

    await this.resolvePublicTokenRequirement({
      token: params.token,
      preview: params.preview,
      templateId: params.templateId,
    });

    let upstreamPayload: Record<string, any>;
    try {
      const formData = new FormData();
      const blob = new Blob([new Uint8Array(params.file.buffer)], {
        type: params.file.mimetype || 'application/octet-stream',
      });
      formData.append('file', blob, params.file.originalname);
      upstreamPayload = await resumeParserClientService.parseResume(formData);
    } catch {
      upstreamPayload = buildNodeResumeFallback(params.file.buffer, params.file.originalname);
    }

    const rawObj =
      upstreamPayload?.data && typeof upstreamPayload.data === 'object'
        ? upstreamPayload.data
        : upstreamPayload || {};

    const parsedTitle =
      purifyJobTitle(rawObj.currentTitle ?? rawObj.current_title) ||
      cleanParseField(rawObj.currentTitle ?? rawObj.current_title);
    const parsedName = sanitizeCandidatePersonName(
      rawObj.fullName ?? rawObj.full_name,
      parsedTitle
    );
    const parsedEmail = cleanParseField(rawObj.email);
    const parsedPhone = cleanParseField(rawObj.phone);
    const rawAuth = cleanParseField(rawObj.workAuth ?? rawObj.work_auth).toLowerCase();
    const parsedWorkAuth = rawAuth.includes('green')
      ? 'Green Card'
      : rawAuth.includes('h-1b') || rawAuth.includes('h1b')
        ? 'H-1B'
        : rawAuth.includes('tn')
          ? 'TN Visa'
          : rawAuth.includes('opt') || rawAuth.includes('cpt') || rawAuth.includes('ead')
            ? 'OPT EAD'
            : rawAuth.includes('citizen')
              ? 'US Citizen'
              : rawAuth.includes('authorized')
                ? 'Authorized to Work'
                : '';

    return {
      fullName: parsedName,
      email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(parsedEmail) ? parsedEmail : '',
      phone: parsedPhone && !/000-0000|555\)? 010-0200/.test(parsedPhone) ? parsedPhone : '',
      workAuth: parsedWorkAuth,
      currentTitle: parsedTitle,
    };
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

    const formTemplate = await this.resolveRequirementFormTemplateView(
      requirement.tenantId,
      (requirement as any).customFields
    );
    const valid = validatePublicApplicationInput(params.body, params.file, formTemplate);

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

    const tenantSettings = await getTenantSettings(requirement.tenantId);
    const now = new Date();
    const retentionExpiresAt = computeRetentionExpiresAt(
      now,
      tenantSettings.general.candidateRetentionDays
    );

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
        const extraCandidateAttributes: Record<string, string> = {
          ...(valid.noticePeriod ? { 'Notice Period': valid.noticePeriod } : {}),
          ...(valid.linkedinUrl ? { 'LinkedIn Profile': valid.linkedinUrl } : {}),
          ...valid.customFieldValues,
        };

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
          const existingCf =
            existingCandidate.customFields &&
              typeof existingCandidate.customFields === 'object' &&
              !Array.isArray(existingCandidate.customFields)
              ? (existingCandidate.customFields as Record<string, any>)
              : {};

          const nextSkillset =
            parsedCv.skillset &&
            parsedCv.skillset !== 'Software Engineering' &&
            parsedCv.skillset.length > existingCandidate.skillset.length
              ? parsedCv.skillset
              : existingCandidate.skillset;
          const nextRawSnippet = parsedCv.rawSnippet || existingCandidate.rawSnippet;

          const updatedCand = await tx.candidate.update({
            where: { id: existingCandidate.id },
            data: {
              phone: valid.phone || existingCandidate.phone,
              workAuth: valid.workAuth || existingCandidate.workAuth,
              resumeFileName: storedCv.originalFileName,
              resumeFormat: storedCv.resumeFormat,
              resumeFileUrl: storedCv.storageUri,
              lawfulBasis: CandidateLawfulBasis.CONSENT,
              consentStatus: ConsentStatus.GRANTED,
              consentCapturedAt: now,
              consentWithdrawnAt: null,
              privacyNoticeVersion: valid.privacyNoticeVersion,
              intakeSource: 'PUBLIC_FORM',
              retentionExpiresAt,
              erasureNoticeSentAt: null,
              ...(Object.keys(extraCandidateAttributes).length > 0
                ? { customFields: { ...existingCf, ...extraCandidateAttributes } }
                : {}),
              ...(parsedCv.rawSnippet ? { rawSnippet: parsedCv.rawSnippet } : {}),
              ...(parsedCv.skillset &&
                parsedCv.skillset !== 'Software Engineering' &&
                parsedCv.skillset.length > existingCandidate.skillset.length
                ? { skillset: parsedCv.skillset }
                : {}),
              normalizedSkills: extractNormalizedSkills({
                skillset: nextSkillset,
                currentTitle: existingCandidate.currentTitle,
                rawSnippet: nextRawSnippet,
              }),
              ...(shouldAdvanceToSubmitted
                ? { pipelineStage: CandidatePipelineStage.SUBMITTED }
                : {}),
            },
            select: { id: true, fullName: true },
          });
          candidateId = updatedCand.id;
          candidateName = updatedCand.fullName;
        } else {
          const newCandTitle = valid.currentTitleInput || parsedCv.currentTitle;
          const newCand = await tx.candidate.create({
            data: {
              tenantId: requirement.tenantId,
              fullName: valid.fullName,
              email: valid.email,
              phone: valid.phone,
              currentTitle: newCandTitle,
              workAuth: valid.workAuth,
              education: parsedCv.education,
              skillset: parsedCv.skillset,
              normalizedSkills: extractNormalizedSkills({
                skillset: parsedCv.skillset,
                currentTitle: newCandTitle,
                rawSnippet: parsedCv.rawSnippet,
              }),
              hourlyRateDisplay: valid.submittedRate || parsedCv.hourlyRate,
              hourlyRateW2: rateDigits > 0 && !isC2C ? rateDigits : null,
              hourlyRateC2c: rateDigits > 0 && isC2C ? rateDigits : null,
              relocation: parsedCv.relocation,
              resumeFileName: storedCv.originalFileName,
              resumeFormat: storedCv.resumeFormat,
              resumeFileUrl: storedCv.storageUri,
              rawSnippet: parsedCv.rawSnippet,
              pipelineStage: CandidatePipelineStage.SUBMITTED,
              lawfulBasis: CandidateLawfulBasis.CONSENT,
              consentStatus: ConsentStatus.GRANTED,
              consentCapturedAt: now,
              privacyNoticeVersion: valid.privacyNoticeVersion,
              intakeSource: 'PUBLIC_FORM',
              retentionExpiresAt,
              assignedRecruiterId: requirement.assignedRecruiterId || null,
              ...(Object.keys(extraCandidateAttributes).length > 0
                ? { customFields: extraCandidateAttributes }
                : {}),
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
      await cvStorageService.deleteCv(storedCv.storageUri).catch(() => { });
      throw err;
    }

    // Non-critical post-intake lifecycle notifications & downstream capability hook.
    try {
      await complianceService.recordSecurityAuditEvent({
        tenantId: requirement.tenantId,
        action: 'PUBLIC_APPLICATION_CONSENT_GRANTED',
        targetType: 'CANDIDATE',
        targetId: createdResult.candidateId,
        metadata: {
          requirementId: requirement.id,
          privacyNoticeVersion: valid.privacyNoticeVersion,
          retentionExpiresAt: retentionExpiresAt.toISOString(),
        },
      });
      await slaEngineService.resolveTasksForEntity(requirement.tenantId, 'requirement', requirement.id, [
        SlaCategory.STALE_REQUIREMENT,
      ]);
      await automationEngineService.recordLifecycleEvent({
        tenantId: requirement.tenantId,
        preferredCategories: [AutomationCategory.FEEDBACK, AutomationCategory.STALE_REQ],
        ruleName: 'Online Job Application',
        target: `${createdResult.candidateName} -> ${requirement.code} (${requirement.opportunityTitle})`,
        conditionsMet: valid.submittedVendorName
          ? `Applied via shareable form by vendor "${valid.submittedVendorName}"`
          : 'Applied directly through the public application link',
        actionDispatched: 'Saved CV, linked applicant to requirement & notified recruiter',
      });
      await slaEngineService.evaluateSlaRadar(requirement.tenantId);
    } catch {
      // Non-critical audit / SLA update
    }

    // Index uploaded candidate chunks + embeddings asynchronously for hybrid pgvector search
    candidateIndexingService.scheduleCandidateSync(createdResult.candidateId, requirement.tenantId);

    // Automatically evaluate submitted resume capability when readable resume text or skills exist.
    if (parsedCv.skillset?.trim() || parsedCv.rawSnippet?.trim()) {
      try {
        await capabilityService.evaluateSubmission(createdResult.submissionId, requirement.tenantId, {
          rateMasked: true,
        });
      } catch {
        // Non-critical capability check
      }
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

    return {
      agencyName: tenantSettings.general.agencyName || 'SquadPipe Staffing',
      submissionId: createdResult.submissionId,
      candidateName: createdResult.candidateName,
      opportunityTitle: requirement.opportunityTitle,
      submittedAt: createdResult.submittedAt,
    };
  }
}

export const publicIntakeService = new PublicIntakeService();
