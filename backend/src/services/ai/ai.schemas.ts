import { z } from 'zod';

const cleanStringList = (maxItems: number, maxLen: number) =>
  z
    .array(z.string())
    .default([])
    .transform((items) =>
      items
        .map((s) => String(s || '').trim().slice(0, maxLen))
        .filter(Boolean)
        .slice(0, maxItems)
    );

const boundedString = (maxLen: number) =>
  z
    .string()
    .trim()
    .transform((s) => s.slice(0, maxLen));

export const ResumeParseAiSchema = z.object({
  fullName: z.string().trim().max(120).default(''),
  email: z.string().trim().max(160).default(''),
  phone: z.string().trim().max(60).default(''),
  workAuth: z.string().trim().max(80).default(''),
  currentTitle: z.string().trim().max(140).default(''),
  education: z.string().trim().max(180).default(''),
  skills: cleanStringList(30, 60),
  hourlyRate: z.string().trim().max(60).default(''),
  relocation: z.string().trim().max(80).default(''),
  professionalSummary: z.string().trim().max(1200).default(''),
});

export const EmailIntakeAiSchema = z.object({
  companyName: z.string().trim().max(120).default(''),
  opportunityTitle: z.string().trim().max(160).default(''),
  openPositions: z.coerce.number().int().min(1).max(1000).optional(),
  clientContact: z.string().trim().max(120).default(''),
  clientContactEmail: z.string().trim().max(160).default(''),
  clientContactTitle: z.string().trim().max(120).default(''),
  location: z.string().trim().max(140).default(''),
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
  missingNotes: z.string().trim().max(500).default(''),
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
