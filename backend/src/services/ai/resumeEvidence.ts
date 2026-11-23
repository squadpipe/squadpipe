import {
  canonicalizeSkillExact,
  evaluateNormalizedSkillOverlap,
  getSkillDisplayName,
  splitSkillItems,
  textContainsCanonicalSkill,
} from '../../utils/skillMatcher';
import type { CapabilityCandidateInput, CapabilityRequirementInput } from './ai.types';

export interface CandidateSkillVerification {
  coveragePct: number;
  matchedSkills: string[];
  missingSkills: string[];
  totalRequired: number;
}

export const SHARED_CAPABILITY_SCORING_RUBRIC =
  'Recognize equivalent/adjacent skills fairly (e.g. AKS/EKS with Kubernetes, PySpark with Spark, PostgreSQL/MySQL with SQL). ' +
  'Calibrate fitScore consistently on this 0-100 scale: 80-100 = Strong Fit (covers core required skills & directly relevant project evidence), ' +
  '65-79 = Good Fit (covers most core skills or strong transferable equivalents with minor gaps), ' +
  '45-64 = Partial Fit (meaningful partial overlap or adjacent experience), 0-44 = Low Fit. ' +
  'Use the verified matched/missing skill summary and resume evidence excerpts together rather than penalizing truncated text. Never mention hidden financial rates.';

const TITLE_STOPWORDS = new Set([
  'senior',
  'junior',
  'lead',
  'staff',
  'principal',
  'engineer',
  'developer',
  'consultant',
  'architect',
  'analyst',
  'manager',
  'specialist',
  'remote',
  'hybrid',
  'onsite',
  'contract',
  'full',
  'time',
  'with',
  'and',
  'for',
]);

const EXPERIENCE_CUES_RE =
  /\b(years?|yrs?|architected|designed|built|developed|implemented|deployed|managed|led|optimized|migrated|production|microservices|pipeline)\b/i;

function splitResumeBlocks(body: string): string[] {
  const rawParagraphs = body
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length >= 20);

  const blocks: string[] = [];
  let current = '';

  const flush = () => {
    const trimmed = current.trim();
    if (trimmed) blocks.push(trimmed);
    current = '';
  };

  for (const para of rawParagraphs) {
    if (para.length <= 360) {
      const candidate = current ? `${current} ${para}` : para;
      if (candidate.length <= 380) {
        current = candidate;
      } else {
        flush();
        current = para;
      }
      continue;
    }

    flush();
    const sentences = para.split(/(?<=[.;•|])\s+/);
    let buf = '';
    for (const sentence of sentences) {
      if (sentence.length > 380) {
        if (buf) {
          blocks.push(buf.trim());
          buf = '';
        }
        for (let start = 0; start < sentence.length; start += 340) {
          const piece = sentence.slice(start, start + 340).trim();
          if (piece) blocks.push(piece);
        }
        continue;
      }
      const next = buf ? `${buf} ${sentence}` : sentence;
      if (next.length <= 380) {
        buf = next;
      } else {
        if (buf) blocks.push(buf.trim());
        buf = sentence;
      }
    }
    if (buf) blocks.push(buf.trim());
  }

  flush();
  return blocks;
}

/**
 * Computes deterministic normalized + alias-aware skill verification for grounding LLM prompts.
 */
export function computeCandidateSkillVerification(
  candidate: CapabilityCandidateInput,
  requirement?: CapabilityRequirementInput
): CandidateSkillVerification | null {
  const requiredCsv = String(requirement?.skillsRequired || '').trim();
  if (!requiredCsv) return null;

  const overlap = evaluateNormalizedSkillOverlap({
    requiredSkillsCsv: requiredCsv,
    candidateSkillset: candidate.skillset,
    candidateNormalizedSkills: candidate.normalizedSkills,
    candidateTitle: candidate.currentTitle,
    candidateRawSnippet: candidate.rawSnippet,
  });

  const totalRequired = overlap.matched.length + overlap.missing.length;
  if (totalRequired === 0) return null;

  return {
    coveragePct: overlap.score,
    matchedSkills: overlap.matched.slice(0, 12),
    missingSkills: overlap.missing.slice(0, 10),
    totalRequired,
  };
}

/**
 * Selects high-signal resume excerpts matching the requirement skills and role title within `maxChars`
 * so prompts include deep project evidence without paying full-resume token overhead.
 */
export function extractRelevantResumeEvidence(
  rawText: string,
  requirement: CapabilityRequirementInput | undefined,
  maxChars: number
): string {
  const clean = String(rawText || '').trim();
  if (!clean || maxChars <= 0) return '';
  if (clean.length <= maxChars) return clean;

  const reqSlugs = Array.from(
    new Set(
      splitSkillItems(requirement?.skillsRequired)
        .map((s) => canonicalizeSkillExact(s))
        .filter(Boolean)
    )
  ).slice(0, 20);

  const titleWords = String(requirement?.opportunityTitle || '')
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 4 && !TITLE_STOPWORDS.has(w))
    .slice(0, 8);

  const headerBudget = Math.min(280, Math.floor(maxChars * 0.25));
  let headerEnd = Math.min(clean.length, headerBudget);
  const nextSpace = clean.lastIndexOf(' ', headerEnd);
  if (nextSpace > Math.floor(headerBudget * 0.6)) {
    headerEnd = nextSpace;
  }
  const header = clean.slice(0, headerEnd).trim();
  const remainder = clean.slice(headerEnd).trim();

  const blocks = remainder ? splitResumeBlocks(remainder) : [];
  const truncatedFallback = () => {
    const suffix = '\n...[truncated]';
    const sliceLen = maxChars > suffix.length + 10 ? maxChars - suffix.length : maxChars;
    return `${clean.slice(0, sliceLen)}${suffix}`;
  };

  if (blocks.length === 0 || (!header.includes(' ') && remainder.length > maxChars)) {
    return truncatedFallback();
  }

  const coveredSlugs = new Set<string>();
  const headerLower = header.toLowerCase();
  for (const slug of reqSlugs) {
    if (textContainsCanonicalSkill(headerLower, slug)) {
      coveredSlugs.add(slug);
    }
  }

  const scoredBlocks = blocks.map((text, index) => {
    const lower = text.toLowerCase();
    const matchedInBlock: string[] = [];
    for (const slug of reqSlugs) {
      if (
        textContainsCanonicalSkill(lower, slug) ||
        lower.includes(getSkillDisplayName(slug).toLowerCase())
      ) {
        matchedInBlock.push(slug);
      }
    }
    let titleHits = 0;
    for (const tw of titleWords) {
      if (lower.includes(tw)) titleHits++;
    }
    const expBonus = EXPERIENCE_CUES_RE.test(text) ? 2 : 0;
    return { index, text, matchedInBlock, titleHits, expBonus };
  });

  const pickedIndices = new Set<number>();
  let remainingBudget = maxChars - header.length - 6;

  while (remainingBudget > 40) {
    let best: (typeof scoredBlocks)[number] | null = null;
    let bestScore = -1;

    for (const item of scoredBlocks) {
      if (pickedIndices.has(item.index)) continue;
      if (item.text.length + 5 > remainingBudget && pickedIndices.size > 0) continue;

      let novelHits = 0;
      for (const slug of item.matchedInBlock) {
        if (!coveredSlugs.has(slug)) novelHits++;
      }
      const score =
        novelHits * 14 +
        item.matchedInBlock.length * 8 +
        item.titleHits * 3 +
        item.expBonus;

      if (score > bestScore) {
        bestScore = score;
        best = item;
      }
    }

    if (!best || bestScore <= 0) break;
    pickedIndices.add(best.index);
    for (const slug of best.matchedInBlock) coveredSlugs.add(slug);
    remainingBudget -= best.text.length + 5;
  }

  if (pickedIndices.size === 0) {
    for (const item of scoredBlocks) {
      if (item.text.length + 5 > remainingBudget) break;
      pickedIndices.add(item.index);
      remainingBudget -= item.text.length + 5;
    }
  }

  const orderedBody = scoredBlocks
    .filter((b) => pickedIndices.has(b.index))
    .sort((a, b) => a.index - b.index)
    .map((b) => b.text);

  if (orderedBody.length === 0) {
    return truncatedFallback();
  }

  const joined = `${header}\n...\n${orderedBody.join('\n...\n')}`.trim();
  if (joined.length <= maxChars) {
    return joined;
  }
  const suffix = '\n...[truncated]';
  const sliceLen = maxChars > suffix.length + 10 ? maxChars - suffix.length : maxChars;
  return `${joined.slice(0, sliceLen)}${suffix}`;
}
