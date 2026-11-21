import { z } from 'zod';
import {
  purifyJobTitle,
  sanitizeExtractedText,
  sanitizeMissingNotes,
} from './extractionSanitizer';
import { sanitizePublicSummaryHtml } from '../../utils/publicSummary';

const coerceString = (val: unknown) =>
  val === null || val === undefined ? '' : typeof val === 'string' ? val : String(val);

const cleanStringList = (maxItems: number, maxLen: number) =>
  z.preprocess(
    (val) => (Array.isArray(val) ? val.map((item) => coerceString(item)) : []),
    z
      .array(z.string())
      .default([])
      .transform((items) =>
        items
          .map((s) => sanitizeExtractedText(s).slice(0, maxLen))
          .filter(Boolean)
          .slice(0, maxItems)
      )
  );

const sanitizedString = (maxLen: number) =>
  z.preprocess(
    coerceString,
    z
      .string()
      .default('')
      .transform((s) => sanitizeExtractedText(s).slice(0, maxLen))
  );

const boundedString = (maxLen: number) =>
  z.preprocess(
    coerceString,
    z
      .string()
      .trim()
      .transform((s) => s.slice(0, maxLen))
  );

const optionalPositiveInt = (maxVal: number) =>
  z.preprocess((val) => {
    if (val === null || val === undefined || val === '') return undefined;
    const num =
      typeof val === 'number' ? val : Number(String(val).replace(/[^0-9.-]/g, '').trim());
    if (!Number.isFinite(num) || num < 1) return undefined;
    return Math.min(maxVal, Math.round(num));
  }, z.number().int().min(1).max(maxVal).optional());

const nonNegativeNumber = (maxVal: number) =>
  z.preprocess((val) => {
    if (val === null || val === undefined || val === '') return 0;
    const num =
      typeof val === 'number' ? val : Number(String(val).replace(/[^0-9.-]/g, '').trim());
    if (!Number.isFinite(num) || num < 0) return 0;
    return Math.min(maxVal, Math.round(num * 100) / 100);
  }, z.number().min(0).max(maxVal).default(0));

const clampedScore = () =>
  z.coerce
    .number()
    .transform((n) => (Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0));

export const ResumeParseAiSchema = z.object({
  fullName: sanitizedString(120),
  email: sanitizedString(160),
  phone: sanitizedString(60),
  workAuth: sanitizedString(80),
  currentTitle: sanitizedString(140),
  education: sanitizedString(180),
  skills: cleanStringList(30, 60),
  hourlyRate: sanitizedString(60),
  relocation: sanitizedString(80),
  professionalSummary: sanitizedString(1200),
});

export const EmailIntakeAiSchema = z.object({
  companyName: sanitizedString(120),
  opportunityTitle: z.preprocess(
    coerceString,
    z
      .string()
      .default('')
      .transform((s) => purifyJobTitle(s).slice(0, 160))
  ),
  openPositions: optionalPositiveInt(1000),
  clientContact: sanitizedString(120),
  clientContactEmail: sanitizedString(160),
  clientContactTitle: sanitizedString(120),
  location: sanitizedString(140),
  workModel: z
    .preprocess((val): 'Remote' | 'Hybrid' | 'Onsite' => {
      const s = String(val || '').trim().toLowerCase();
      if (s === 'hybrid') return 'Hybrid';
      if (s === 'onsite' || s === 'on-site') return 'Onsite';
      return 'Remote';
    }, z.enum(['Remote', 'Hybrid', 'Onsite']))
    .default('Remote'),
  targetBillRate: nonNegativeNumber(10000),
  targetPayRate: nonNegativeNumber(10000),
  skills: cleanStringList(30, 60),
  missingNotes: z.preprocess(
    coerceString,
    z
      .string()
      .default('')
      .transform((s) => sanitizeMissingNotes(s).slice(0, 500))
  ),
  publicDescription: z.preprocess(
    coerceString,
    z
      .string()
      .default('')
      .transform((s) => sanitizePublicSummaryHtml(s).slice(0, 3000))
  ),
});

export const SubmissionCapabilityAiSchema = z.object({
  fitScore: clampedScore(),
  recommendation: z.enum(['STRONG_FIT', 'GOOD_FIT', 'PARTIAL_FIT', 'LOW_FIT']),
  strengths: cleanStringList(6, 180),
  gaps: cleanStringList(6, 180),
  verdict: boundedString(320).refine((s) => s.length >= 1, 'verdict must not be empty'),
});

export const BatchRankAiSchema = z.object({
  rankings: z
    .array(
      z.object({
        candidateId: z.string().trim().min(1),
        fitScore: clampedScore(),
        matchedHighlights: cleanStringList(5, 140),
        gaps: cleanStringList(5, 140),
        oneLineSummary: boundedString(240).refine((s) => s.length >= 1, 'oneLineSummary must not be empty'),
      })
    )
    .max(50),
});

export const PitchDraftAiSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  bodyText: z.string().trim().min(1).max(4000),
});

export type ResumeParseAiOutput = z.infer<typeof ResumeParseAiSchema>;
export type EmailIntakeAiOutput = z.infer<typeof EmailIntakeAiSchema>;
export type SubmissionCapabilityAiOutput = z.infer<typeof SubmissionCapabilityAiSchema>;
export type BatchRankAiOutput = z.infer<typeof BatchRankAiSchema>;
export type PitchDraftAiOutput = z.infer<typeof PitchDraftAiSchema>;
