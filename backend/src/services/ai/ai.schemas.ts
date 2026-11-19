import { z } from 'zod';
import {
  purifyJobTitle,
  sanitizeExtractedText,
  sanitizeMissingNotes,
} from './extractionSanitizer';

const cleanStringList = (maxItems: number, maxLen: number) =>
  z
    .array(z.string())
    .default([])
    .transform((items) =>
      items
        .map((s) => sanitizeExtractedText(s).slice(0, maxLen))
        .filter(Boolean)
        .slice(0, maxItems)
    );

const sanitizedString = (maxLen: number) =>
  z
    .string()
    .default('')
    .transform((s) => sanitizeExtractedText(s).slice(0, maxLen));

const boundedString = (maxLen: number) =>
  z
    .string()
    .trim()
    .transform((s) => s.slice(0, maxLen));

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
  opportunityTitle: z
    .string()
    .default('')
    .transform((s) => purifyJobTitle(s).slice(0, 160)),
  openPositions: z.coerce.number().int().min(1).max(1000).optional(),
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
  targetBillRate: z.coerce.number().min(0).max(10000).default(0),
  targetPayRate: z.coerce.number().min(0).max(10000).default(0),
  skills: cleanStringList(30, 60),
  missingNotes: z
    .string()
    .default('')
    .transform((s) => sanitizeMissingNotes(s).slice(0, 500)),
});

export const SubmissionCapabilityAiSchema = z.object({
  fitScore: z.coerce
    .number()
    .min(0)
    .max(100)
    .transform((n) => Math.round(n)),
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
        fitScore: z.coerce
          .number()
          .min(0)
          .max(100)
          .transform((n) => Math.round(n)),
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
