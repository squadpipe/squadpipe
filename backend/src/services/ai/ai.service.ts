import { resolveAiConfig, type ResolvedAiConfig } from '../../config/ai.config';
import { completeValidatedJson } from './ai.json';
import { createAiAdapter } from './ai.router';
import {
  aiUsageService,
  type AiUsageFeature,
  type QuotaCheckResult,
} from './aiUsage.service';
import { NoneAiProvider } from './providers/none.provider';
import {
  BatchRankAiSchema,
  EmailIntakeAiSchema,
  PitchDraftAiSchema,
  ResumeParseAiSchema,
  SubmissionCapabilityAiSchema,
} from './ai.schemas';
import {
  isGenericRoleTitle,
  purifyJobTitle,
  sanitizeCandidatePersonName,
  sanitizeExtractedText,
  sanitizeMissingNotes,
  splitContactAndDesignation,
} from './extractionSanitizer';
import {
  sanitizePublicSummaryHtml,
  scrubConfidentialText,
} from '../../utils/publicSummary';
import {
  canonicalizeSkillExact,
  normalizeSkillWithTypoFallback,
  textContainsCanonicalSkill,
} from '../../utils/skillMatcher';
import {
  computeCandidateSkillVerification,
  extractRelevantResumeEvidence,
  SHARED_CAPABILITY_SCORING_RUBRIC,
} from './resumeEvidence';
import type {
  AiProviderAdapter,
  CapabilityCandidateInput,
  CapabilityEvaluationResult,
  CapabilityRecommendation,
  CapabilityRequirementInput,
  EmailIntakeBaseline,
  PitchDraftInput,
  PitchDraftResult,
  RankedCandidateResult,
  ResumeParseBaseline,
} from './ai.types';
import type { FetchLike } from './providers/openaiCompatible.provider';

function truncateInput(text: string | null | undefined, maxChars: number): string {
  const cleaned = String(text || '').trim();
  if (!cleaned || cleaned.length <= maxChars) return cleaned;
  return `${cleaned.slice(0, maxChars)}\n...[truncated]`;
}

/**
 * Normalizes noisy upstream provider errors (429 JSON blobs, auth errors, timeouts)
 * into clean, user-friendly SaaS messages without exposing provider keys or billing internals.
 */
function formatAiProviderError(
  err: any,
  fallback = 'SquadAI service is temporarily unavailable. Please try again later.'
): { message: string; statusCode: number } {
  const raw = String(err?.message || '').trim();
  const lower = raw.toLowerCase();

  if (
    lower.includes('neurons') ||
    lower.includes('daily free allocation') ||
    lower.includes('insufficient_quota') ||
    lower.includes('quota')
  ) {
    return {
      message: 'SquadAI service has reached its limit. Please try again later.',
      statusCode: 429,
    };
  }
  if (lower.includes('status 429') || lower.includes('rate limit') || lower.includes('resource_exhausted')) {
    return {
      message: 'SquadAI service has reached its limit for now. Wait a moment and try again.',
      statusCode: 429,
    };
  }
  if (
    lower.includes('status 401') ||
    lower.includes('status 403') ||
    lower.includes('invalid api key') ||
    lower.includes('incorrect api key') ||
    lower.includes('unauthorized') ||
    lower.includes('api_key') ||
    lower.includes('not configured')
  ) {
    return {
      message: 'SquadAI service is temporarily unavailable. Please try again later.',
      statusCode: 503,
    };
  }
  if (
    lower.includes('timed out') ||
    lower.includes('timeout') ||
    lower.includes('aborted') ||
    err?.name === 'TimeoutError'
  ) {
    return {
      message: 'SquadAI request timed out before finishing. Please try again.',
      statusCode: 504,
    };
  }

  const looksTechnical =
    !raw ||
    lower.includes('ai provider') ||
    lower.includes('json repair') ||
    lower.includes('schema validation') ||
    lower.includes('validation failed') ||
    lower.includes('invalid json') ||
    lower.includes('unexpected token') ||
    lower.includes('number must be') ||
    lower.includes('expected string') ||
    lower.includes('expected number') ||
    lower.includes('zod') ||
    lower.includes('econn') ||
    lower.includes('enotfound') ||
    lower.includes('fetch failed') ||
    lower.includes('syntaxerror') ||
    lower.includes('typeerror') ||
    lower.includes('status ') ||
    lower.includes('cloudflare') ||
    lower.includes('openai') ||
    lower.includes('anthropic') ||
    lower.includes('gemini') ||
    raw.includes('{');

  return {
    message: looksTechnical ? fallback : raw.slice(0, 180),
    statusCode: typeof err?.statusCode === 'number' && err.statusCode !== 401 ? err.statusCode : 502,
  };
}

function toSafeAiHttpError(err: any, fallback: string): Error & { statusCode: number } {
  const formatted = formatAiProviderError(err, fallback);
  return Object.assign(new Error(formatted.message), { statusCode: formatted.statusCode });
}

/**
 * Scrubs explicit hourly/currency rate strings before sending free-text JDs or snippets to LLMs
 * when the requesting user has financial rates masked.
 */
export function redactRatesFromText(text?: string | null): string {
  if (!text) return '';
  return String(text).replace(
    /(?:A\$|S\$|[$£€₹])\s*\d+(?:\.\d+)?(?:\s*(?:-|to|–)\s*(?:A\$|S\$|[$£€₹])?\s*\d+(?:\.\d+)?)?(?:\s*(?:\/|\bper\s*)\s*(?:hr|hour|wk|week|mo|month|yr|year))?(?:\s*\((?:W-?2|C-?2-?C|1099)\))?/gi,
    '[RATE MASKED]'
  );
}

function splitSkillList(skillsCsv?: string | null): string[] {
  return Array.from(
    new Set(
      String(skillsCsv || '')
        .split(/[,;\n]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    )
  );
}

function skillMatchesHaystack(skill: string, haystackLower: string, skillSetLower: Set<string>): boolean {
  const needle = skill.trim().toLowerCase();
  if (!needle) return false;
  if (skillSetLower.has(needle)) return true;

  const exactSlug = canonicalizeSkillExact(needle);
  const normalized = normalizeSkillWithTypoFallback(needle, { allowTypoCorrection: true });
  const targetSlug = normalized.canonical || exactSlug;

  for (const candSkill of skillSetLower) {
    if (canonicalizeSkillExact(candSkill) === targetSlug) return true;
  }
  if (textContainsCanonicalSkill(haystackLower, targetSlug)) return true;

  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const hasEdgeSymbols = /[^a-z0-9]/i.test(needle);
  if (hasEdgeSymbols) {
    return haystackLower.includes(needle);
  }
  return new RegExp(`\\b${escaped}\\b`, 'i').test(haystackLower);
}

function toRecommendation(score: number): CapabilityRecommendation {
  if (score >= 80) return 'STRONG_FIT';
  if (score >= 60) return 'GOOD_FIT';
  if (score >= 35) return 'PARTIAL_FIT';
  return 'LOW_FIT';
}

export function buildRateSafeRequirementPromptData(
  requirement: CapabilityRequirementInput,
  rateMasked: boolean,
  maxChars: number
): Record<string, unknown> {
  const safeReq: Record<string, unknown> = {
    code: requirement.code || '',
    opportunityTitle: requirement.opportunityTitle || '',
    skillsRequired: requirement.skillsRequired || '',
    location: requirement.location || '',
    workModel: requirement.workModel || '',
  };

  if (!rateMasked) {
    safeReq.companyName = requirement.companyName || '';
    if (requirement.targetBillRate) safeReq.targetBillRate = requirement.targetBillRate;
    if (requirement.maxBillRate) safeReq.maxBillRate = requirement.maxBillRate;
    if (requirement.targetPayRate) safeReq.targetPayRate = requirement.targetPayRate;
  }

  if (requirement.rawEmailText) {
    const rawJd = rateMasked
      ? redactRatesFromText(requirement.rawEmailText)
      : requirement.rawEmailText;
    safeReq.jobNotes = truncateInput(rawJd, Math.min(maxChars, 5000));
  }

  return safeReq;
}

export function buildPiiSafeCandidatePromptData(
  candidate: CapabilityCandidateInput,
  options: {
    rateMasked: boolean;
    maxSnippetChars: number;
    maxMatchedChunkChars?: number;
    includeHourlyRate?: boolean;
    requirement?: CapabilityRequirementInput;
    includeSkillVerification?: boolean;
  }
): Record<string, unknown> {
  const retrievedContext =
    Array.isArray(candidate.matchedChunks) && candidate.matchedChunks.length > 0
      ? candidate.matchedChunks.join('\n---\n')
      : candidate.rawSnippet;

  const matchedChunkLimit =
    options.maxMatchedChunkChars ?? Math.max(options.maxSnippetChars, 2400);
  const effectiveLimit = candidate.matchedChunks?.length
    ? matchedChunkLimit
    : options.maxSnippetChars;

  const rateCleanContext = options.rateMasked
    ? redactRatesFromText(retrievedContext)
    : String(retrievedContext || '').trim();

  const targetedContext = options.requirement
    ? extractRelevantResumeEvidence(rateCleanContext, options.requirement, effectiveLimit)
    : rateCleanContext;

  const safeCand: Record<string, unknown> = {
    candidateId: candidate.id,
    currentTitle: candidate.currentTitle || '',
    skillset: candidate.skillset || '',
    workAuth: candidate.workAuth || '',
    relocation: candidate.relocation || '',
    resumeSummaryExcerpt: truncateInput(targetedContext, effectiveLimit),
  };

  if (options.includeSkillVerification && options.requirement) {
    const skillFacts = computeCandidateSkillVerification(candidate, options.requirement);
    if (skillFacts) {
      safeCand.skillVerification = skillFacts;
    }
  }

  if (options.includeHourlyRate && !options.rateMasked && candidate.hourlyRateDisplay) {
    safeCand.hourlyRateDisplay = candidate.hourlyRateDisplay;
  }

  return safeCand;
}

export function computeOfflineCapabilityEvaluation(
  candidate: CapabilityCandidateInput,
  requirement: CapabilityRequirementInput
): CapabilityEvaluationResult {
  const requiredSkills = splitSkillList(requirement.skillsRequired);
  const candidateSkills = splitSkillList(candidate.skillset);
  const candidateSkillSetLower = new Set(candidateSkills.map((s) => s.toLowerCase()));
  const haystackLower = [
    candidate.currentTitle,
    candidate.skillset,
    candidate.rawSnippet,
  ]
    .filter(Boolean)
    .join('\n')
    .toLowerCase();

  if (requiredSkills.length === 0) {
    const fallbackStrengths = candidateSkills.slice(0, 4);
    const titleMatched = Boolean(
      requirement.opportunityTitle &&
      candidate.currentTitle &&
      candidate.currentTitle
        .toLowerCase()
        .split(/\s+/)
        .some((w) => w.length > 3 && requirement.opportunityTitle!.toLowerCase().includes(w))
    );
    const fitScore = titleMatched ? 72 : fallbackStrengths.length > 0 ? 58 : 40;
    return {
      fitScore,
      recommendation: toRecommendation(fitScore),
      strengths: fallbackStrengths,
      gaps: [],
      verdict:
        fallbackStrengths.length > 0
          ? `Baseline keyword profile ready (${fallbackStrengths.join(', ')}).`
          : 'No required skills listed on requirement for automated skill scoring.',
      aiUsed: false,
    };
  }

  const matched: string[] = [];
  const missing: string[] = [];

  for (const reqSkill of requiredSkills) {
    if (skillMatchesHaystack(reqSkill, haystackLower, candidateSkillSetLower)) {
      matched.push(reqSkill);
    } else {
      missing.push(reqSkill);
    }
  }

  const fitScore = Math.round((matched.length / requiredSkills.length) * 100);
  const recommendation = toRecommendation(fitScore);
  const verdict =
    missing.length === 0
      ? `Matches all ${matched.length} listed skills (${matched.slice(0, 4).join(', ')}).`
      : `Matches ${matched.length} of ${requiredSkills.length} listed skills; missing ${missing.slice(0, 4).join(', ')}.`;

  return {
    fitScore,
    recommendation,
    strengths: matched.slice(0, 6),
    gaps: missing.slice(0, 6),
    verdict,
    aiUsed: false,
  };
}

export function extractCleanRecipientGreeting(rawName?: string): {
  cleanName: string;
  greeting: string;
} {
  const withoutTitle = String(rawName || '')
    .split(/\s*(?:,|\||\s-\s)\s*/)[0]
    .replace(/\s+/g, ' ')
    .trim();
  if (!withoutTitle) {
    return { cleanName: '', greeting: 'Hi Hiring Team,' };
  }
  const firstWord = withoutTitle.replace(/["'()]/g, '').split(/\s+/)[0] || '';
  return {
    cleanName: withoutTitle,
    greeting: firstWord ? `Hi ${firstWord},` : 'Hi Hiring Team,',
  };
}

export function normalizeDisplayCandidateName(rawName?: string | null): string {
  return (
    String(rawName || 'Consultant')
      .replace(/_+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || 'Consultant'
  );
}

/**
 * Ensures recruiter email pitches always have clean, readable paragraph spacing:
 * - blank line after greeting, before section headings, after bullet blocks, before prose paragraphs, and before sign-off
 * - tight grouping for section headings directly above "- " bullets, consecutive bullets, and sign-off signature lines
 */
export function normalizePitchEmailSpacing(rawBody: string): string {
  const normalized = String(rawBody || '')
    .replace(/\r\n/g, '\n')
    .trim();
  if (!normalized) return '';

  const lines = normalized.split('\n');
  const isGreeting = (line: string) =>
    /^(?:hi|hello|dear|good\s+(?:morning|afternoon|evening))\b.*[,:]$/i.test(line);
  const isBullet = (line: string) => /^(?:[-*•]|\u2022|\d+[.)])\s+/.test(line);
  const isSignOff = (line: string) =>
    /^(?:best\s+regards|kind\s+regards|warm\s+regards|thanks\s*(?:&|and)?\s*regards|regards|sincerely|thank\s+you|thanks|best|warmly|cheers)[,.!]?$/i.test(
      line
    );

  const output: string[] = [];
  let prevKind: 'greeting' | 'heading' | 'bullet' | 'prose' | 'signoff' | 'signature' | null = null;
  let prevProseText = '';
  let hadBlankBefore = false;
  let inSignature = false;

  const ensureBlankLine = () => {
    if (output.length > 0 && output[output.length - 1] !== '') {
      output.push('');
    }
  };

  for (let i = 0; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      hadBlankBefore = true;
      continue;
    }

    let nextNonEmpty = '';
    for (let j = i + 1; j < lines.length; j += 1) {
      const candidateLine = lines[j].trim();
      if (candidateLine) {
        nextNonEmpty = candidateLine;
        break;
      }
    }

    if (isSignOff(trimmed)) {
      ensureBlankLine();
      output.push(trimmed);
      inSignature = true;
      prevKind = 'signoff';
      hadBlankBefore = false;
      continue;
    }

    if (inSignature) {
      output.push(trimmed);
      prevKind = 'signature';
      hadBlankBefore = false;
      continue;
    }

    if (prevKind === null && isGreeting(trimmed)) {
      output.push(trimmed);
      prevKind = 'greeting';
      hadBlankBefore = false;
      continue;
    }

    if (isBullet(trimmed)) {
      const normalizedBullet = trimmed.replace(/^(?:[-*•]|\u2022)\s+/, '- ');
      if (prevKind !== 'heading' && prevKind !== 'bullet') {
        ensureBlankLine();
      }
      output.push(normalizedBullet);
      prevKind = 'bullet';
      hadBlankBefore = false;
      continue;
    }

    if (/:\s*$/.test(trimmed) && nextNonEmpty && isBullet(nextNonEmpty)) {
      ensureBlankLine();
      output.push(trimmed);
      prevKind = 'heading';
      hadBlankBefore = false;
      continue;
    }

    // Normal prose paragraph line
    if (
      prevKind === 'greeting' ||
      prevKind === 'bullet' ||
      prevKind === 'heading' ||
      (prevKind === 'prose' &&
        (hadBlankBefore || /[.!?]["')\]]*$/.test(prevProseText)))
    ) {
      ensureBlankLine();
    }

    output.push(trimmed);
    prevKind = 'prose';
    prevProseText = trimmed;
    hadBlankBefore = false;
  }

  return output.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export class AiService {
  private readonly getConfigFn: () => ResolvedAiConfig;
  private readonly hasExplicitConfigProvider: boolean;
  private readonly resolveTenantConfigFn?: (tenantId?: string) => Promise<ResolvedAiConfig>;
  private readonly checkQuotaFn?: (
    tenantId: string,
    cfg: ResolvedAiConfig
  ) => Promise<QuotaCheckResult>;
  private readonly recordUsageFn?: (entry: {
    tenantId?: string;
    userId?: string;
    provider: string;
    model: string;
    feature: AiUsageFeature;
    inputTokens?: number;
    outputTokens?: number;
    latencyMs?: number;
  }) => Promise<void>;
  private readonly createAdapterFn: (config: ResolvedAiConfig) => AiProviderAdapter;

  constructor(options?: {
    getConfig?: () => ResolvedAiConfig;
    resolveTenantConfig?: (tenantId?: string) => Promise<ResolvedAiConfig>;
    checkQuota?: (tenantId: string, cfg: ResolvedAiConfig) => Promise<QuotaCheckResult>;
    recordUsage?: (entry: {
      tenantId?: string;
      userId?: string;
      provider: string;
      model: string;
      feature: AiUsageFeature;
      inputTokens?: number;
      outputTokens?: number;
      latencyMs?: number;
    }) => Promise<void>;
    createAdapter?: (config: ResolvedAiConfig) => AiProviderAdapter;
    fetchImpl?: FetchLike;
  }) {
    this.hasExplicitConfigProvider = Boolean(options?.getConfig);
    this.getConfigFn = options?.getConfig ?? (() => resolveAiConfig());
    this.resolveTenantConfigFn = options?.resolveTenantConfig;
    this.checkQuotaFn = options?.checkQuota;
    this.recordUsageFn = options?.recordUsage;
    this.createAdapterFn =
      options?.createAdapter ?? ((cfg) => createAiAdapter(cfg, options?.fetchImpl));
  }

  async getActiveRuntime(context?: {
    tenantId?: string;
  }): Promise<{
    config: ResolvedAiConfig;
    adapter: AiProviderAdapter;
    quotaNotice?: string;
  }> {
    const config = this.resolveTenantConfigFn
      ? await this.resolveTenantConfigFn(context?.tenantId)
      : this.hasExplicitConfigProvider
        ? this.getConfigFn()
        : (await aiUsageService.resolveEffectiveRuntimeConfig(context?.tenantId)).config;

    if (!config.configured) {
      return { config, adapter: new NoneAiProvider() };
    }

    const quotaChecker =
      this.checkQuotaFn ||
      (!this.hasExplicitConfigProvider
        ? (tid: string, cfg: ResolvedAiConfig) => aiUsageService.checkQuota(tid, cfg)
        : undefined);

    if (quotaChecker && (context?.tenantId || !this.hasExplicitConfigProvider)) {
      const tenantId = context?.tenantId || 'squadpipe-agency';
      const quota = await quotaChecker(tenantId, config);
      if (quota.exceeded) {
        console.warn(`[AI] ${quota.reason}`);
        return {
          config,
          adapter: new NoneAiProvider(),
          quotaNotice: quota.reason,
        };
      }
    }

    const adapter = this.createAdapterFn(config);
    return { config, adapter };
  }

  private async recordFeatureUsage(
    feature: AiUsageFeature,
    completion: {
      provider: string;
      model: string;
      inputTokens?: number;
      outputTokens?: number;
      latencyMs: number;
    },
    context?: { tenantId?: string; userId?: string }
  ) {
    const recorder =
      this.recordUsageFn ||
      (!this.hasExplicitConfigProvider
        ? (entry: {
          tenantId?: string;
          userId?: string;
          provider: string;
          model: string;
          feature: AiUsageFeature;
          inputTokens?: number;
          outputTokens?: number;
          latencyMs?: number;
        }) => aiUsageService.recordUsage(entry)
        : undefined);

    if (!recorder) return;
    await recorder({
      tenantId: context?.tenantId || 'squadpipe-agency',
      userId: context?.userId,
      provider: completion.provider,
      model: completion.model,
      feature,
      inputTokens: completion.inputTokens,
      outputTokens: completion.outputTokens,
      latencyMs: completion.latencyMs,
    });
  }

  async enhanceResumeParse(
    rawText: string,
    baselineFields: ResumeParseBaseline,
    context?: { tenantId?: string; userId?: string }
  ): Promise<{
    data: Required<ResumeParseBaseline>;
    aiUsed: boolean;
    quotaNotice?: string;
    meta?: {
      provider: string;
      model: string;
      inputTokens?: number;
      outputTokens?: number;
      latencyMs: number;
      repaired: boolean;
    };
  }> {
    const baselineTitle =
      purifyJobTitle(baselineFields.currentTitle) ||
      sanitizeExtractedText(baselineFields.currentTitle);
    const normalizedBaseline: Required<ResumeParseBaseline> = {
      fullName: sanitizeCandidatePersonName(baselineFields.fullName, baselineTitle),
      email: sanitizeExtractedText(baselineFields.email),
      phone: sanitizeExtractedText(baselineFields.phone),
      workAuth: sanitizeExtractedText(baselineFields.workAuth),
      currentTitle: baselineTitle,
      education: sanitizeExtractedText(baselineFields.education),
      skills: Array.isArray(baselineFields.skills)
        ? baselineFields.skills.map((s) => sanitizeExtractedText(s)).filter(Boolean)
        : [],
      hourlyRate: sanitizeExtractedText(baselineFields.hourlyRate),
      relocation: sanitizeExtractedText(baselineFields.relocation),
      professionalSummary: sanitizeExtractedText(baselineFields.professionalSummary),
    };

    const { config, adapter, quotaNotice } = await this.getActiveRuntime(context);
    if (!config.configured || !adapter.isConfigured()) {
      return {
        data: normalizedBaseline,
        aiUsed: false,
        ...(quotaNotice ? { quotaNotice } : {}),
      };
    }

    // For bulky/long multi-page CVs, allow up to 24,000 chars and preserve both head (header + recent roles)
    // and tail (skills, education, certifications on final pages) so long CVs are never cut off or blocked.
    const cleanResumeText = String(rawText || '').trim();
    const resumeMaxChars = Math.max(config.maxInputChars, 24000);
    const clippedResume =
      cleanResumeText.length <= resumeMaxChars
        ? cleanResumeText
        : `${cleanResumeText.slice(0, Math.floor(resumeMaxChars * 0.65))}\n\n...[middle pages condensed]...\n\n${cleanResumeText.slice(-Math.floor(resumeMaxChars * 0.35))}`;
    if (!clippedResume) {
      return { data: normalizedBaseline, aiUsed: false };
    }

    try {
      const result = await completeValidatedJson({
        adapter,
        tier: 'fast',
        schema: ResumeParseAiSchema,
        messages: [
          {
            role: 'system',
            content:
              'You extract clean structured candidate fields from resume text (including long multi-page CVs). Return ONLY strict JSON matching keys: fullName, email, phone, workAuth, currentTitle, education, skills (array of concise skill names across all pages), hourlyRate, relocation, professionalSummary (2-3 crisp sentences).\n\nCRITICAL RULES:\n1. fullName MUST ONLY be a real human person\'s name (e.g. "Anand Verma", "Priya Nair"). NEVER put a job title (e.g. "Senior Financial Analyst", "Lead Cloud Architect"), company name (e.g. "Acme Technologies"), or document title (e.g. "Knowledge Base", "Workflow Guide") into fullName. If no human person\'s name is present in the text, return "" for fullName.\n2. Preserve facts only: return "" for any missing text field (never write "Not specified", "Unknown", or "N/A", and never invent default rates like "$85/hr" or degrees like "Bachelor\'s Degree" if not explicitly in the text).\n3. Keep currentTitle as a pure concise job title (or "" if the document is not a resume and has no candidate job title).',
          },
          {
            role: 'user',
            content: JSON.stringify({
              baselineFields: normalizedBaseline,
              resumeText: clippedResume,
            }),
          },
        ],
      });

      await this.recordFeatureUsage('resume_parse', result.completion, context);

      const mergedSkills =
        result.data.skills.length > 0 ? result.data.skills : normalizedBaseline.skills;
      const resolvedTitle =
        purifyJobTitle(result.data.currentTitle) ||
        sanitizeExtractedText(result.data.currentTitle) ||
        normalizedBaseline.currentTitle;
      const resolvedFullName =
        sanitizeCandidatePersonName(result.data.fullName, resolvedTitle) ||
        sanitizeCandidatePersonName(normalizedBaseline.fullName, resolvedTitle);

      return {
        data: {
          fullName: resolvedFullName,
          email: sanitizeExtractedText(result.data.email) || normalizedBaseline.email,
          phone: sanitizeExtractedText(result.data.phone) || normalizedBaseline.phone,
          workAuth: sanitizeExtractedText(result.data.workAuth) || normalizedBaseline.workAuth,
          currentTitle: resolvedTitle,
          education: sanitizeExtractedText(result.data.education) || normalizedBaseline.education,
          skills: mergedSkills,
          hourlyRate: sanitizeExtractedText(result.data.hourlyRate) || normalizedBaseline.hourlyRate,
          relocation: sanitizeExtractedText(result.data.relocation) || normalizedBaseline.relocation,
          professionalSummary:
            sanitizeExtractedText(result.data.professionalSummary) ||
            normalizedBaseline.professionalSummary,
        },
        aiUsed: true,
        meta: {
          provider: result.completion.provider,
          model: result.completion.model,
          inputTokens: result.completion.inputTokens,
          outputTokens: result.completion.outputTokens,
          latencyMs: result.completion.latencyMs,
          repaired: result.repaired,
        },
      };
    } catch (err: any) {
      if (!config.fallbackToOffline) {
        throw toSafeAiHttpError(
          err,
          'We could not read the uploaded resume automatically right now. Please try again in a moment.'
        );
      }
      console.warn('[AI] enhanceResumeParse fallback to offline baseline:', err?.message || err);
      return { data: normalizedBaseline, aiUsed: false };
    }
  }

  async enhanceEmailIntakeParse(
    rawEmailText: string,
    baselineFields: EmailIntakeBaseline,
    context?: { tenantId?: string; userId?: string }
  ): Promise<{
    data: Required<Omit<EmailIntakeBaseline, 'openPositions'>> & { openPositions?: number };
    aiUsed: boolean;
    quotaNotice?: string;
    meta?: {
      provider: string;
      model: string;
      inputTokens?: number;
      outputTokens?: number;
      latencyMs: number;
      repaired: boolean;
    };
  }> {
    const baselineContact = splitContactAndDesignation(
      baselineFields.clientContact,
      baselineFields.clientContactTitle
    );
    const normalizedBaseline: Required<Omit<EmailIntakeBaseline, 'openPositions'>> & {
      openPositions?: number;
    } = {
      companyName: sanitizeExtractedText(baselineFields.companyName),
      opportunityTitle: purifyJobTitle(baselineFields.opportunityTitle),
      openPositions: baselineFields.openPositions,
      clientContact: baselineContact.name,
      clientContactEmail: sanitizeExtractedText(baselineFields.clientContactEmail),
      clientContactTitle: baselineContact.title,
      location: sanitizeExtractedText(baselineFields.location),
      workModel: baselineFields.workModel || 'Remote',
      targetBillRate: Number(baselineFields.targetBillRate || 0),
      targetPayRate: Number(baselineFields.targetPayRate || 0),
      skills: Array.isArray(baselineFields.skills)
        ? baselineFields.skills.map((s) => sanitizeExtractedText(s)).filter(Boolean)
        : [],
      missingNotes: sanitizeMissingNotes(baselineFields.missingNotes),
      publicDescription: sanitizePublicSummaryHtml(baselineFields.publicDescription || ''),
    };

    const { config, adapter, quotaNotice } = await this.getActiveRuntime(context);
    if (!config.configured || !adapter.isConfigured()) {
      return {
        data: normalizedBaseline,
        aiUsed: false,
        ...(quotaNotice ? { quotaNotice } : {}),
      };
    }

    const clippedEmail = truncateInput(rawEmailText, config.maxInputChars);
    if (!clippedEmail) {
      return { data: normalizedBaseline, aiUsed: false };
    }

    try {
      const result = await completeValidatedJson({
        adapter,
        tier: 'fast',
        schema: EmailIntakeAiSchema,
        messages: [
          {
            role: 'system',
            content:
              'You extract structured staffing job requisition fields from client/vendor email threads or PDFs. Return ONLY strict JSON with keys: companyName, opportunityTitle, openPositions (integer >=1 only if explicitly stated), clientContact, clientContactEmail, clientContactTitle, location, workModel ("Remote"|"Hybrid"|"Onsite"), targetBillRate (number, 0 if unknown), targetPayRate (number, 0 if unknown), skills (array of concise skill names), missingNotes (brief list of absent form fields), publicDescription (candidate-facing client-safe rich HTML summary).\n\nCRITICAL RULES:\n1. Never output placeholders like "Not specified in email", "Not specified", "Unknown", "N/A", "None", or "TBD" in any field. If a text field (companyName, clientContact, clientContactTitle, clientContactEmail, location) is not explicitly mentioned in the email, return "".\n2. opportunityTitle MUST be ONLY the pure canonical job role title (typically 2-6 words, e.g. "React Developer", "Data Engineer", "Senior Java Cloud Engineer"). NEVER pick generic plural or overview words ("Consultants", "Candidates", "Contractors", "Resources", "Positions", "Engineers", "Developers") from an overview sentence when a specific role heading exists. When itemized/numbered roles appear (e.g. "1. Data Engineer"), extract the primary specific role title without its leading number ("Data Engineer"), and note any additional roles concisely in missingNotes. Remove filler prose, durations, locations, work models, and hourly rates.\n3. Split inline contact designations: when a contact header reads "Kevin Roberts, Delivery Manager" or "Name - Title", put ONLY the person name in clientContact ("Kevin Roberts") and put the title/role in clientContactTitle ("Delivery Manager"). Never mix person names with designations or guess companyName, clientContact, clientContactTitle, or location if omitted.\n4. For location, extract cleanly (e.g. "United States", "Austin, TX") without spilling into adjacent table labels like "Work model", "Experience", or rates.\n5. In missingNotes, ONLY report missing fields that exist on our Requirement form: Target Company, Job Title, Client Contact Name, Contact Designation, Contact Email, Location, Bill Rate, Pay Rate, Required Skillset. NEVER mention telephone/phone numbers (there is no phone field on the form) or write "Not specified in email"; write concisely like "Missing: Target Company, Contact Email, Pay Rate." or "All form fields detected from source."\n6. For publicDescription: write a clean, engaging, candidate-facing job overview using only simple HTML tags (<p>, <strong>, <ul>, <li>) summarizing the role scope, core responsibilities as bullets, and expected experience/engagement duration if present. NEVER include end-client company names, hiring manager names, emails, phone numbers, bill/pay rates, or REQ codes inside publicDescription.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              baselineFields: normalizedBaseline,
              rawEmailText: clippedEmail,
            }),
          },
        ],
      });

      const resolvedBill = result.data.targetBillRate || normalizedBaseline.targetBillRate;
      const resolvedPay = result.data.targetPayRate || normalizedBaseline.targetPayRate;
      await this.recordFeatureUsage('email_parse', result.completion, context);

      const rawAiTitle = purifyJobTitle(result.data.opportunityTitle);
      const pureTitle =
        rawAiTitle && !isGenericRoleTitle(rawAiTitle)
          ? rawAiTitle
          : normalizedBaseline.opportunityTitle || rawAiTitle;

      const resolvedCompanyName =
        sanitizeExtractedText(result.data.companyName) || normalizedBaseline.companyName;
      const aiContactParts = splitContactAndDesignation(
        result.data.clientContact,
        result.data.clientContactTitle
      );
      const resolvedContactName = aiContactParts.name || normalizedBaseline.clientContact;
      const resolvedContactTitle = aiContactParts.title || normalizedBaseline.clientContactTitle;
      const rawAiSummary = result.data.publicDescription || '';
      const scrubbedAiSummary = rawAiSummary
        ? sanitizePublicSummaryHtml(
          scrubConfidentialText(rawAiSummary, {
            companyName: resolvedCompanyName,
            contactName: resolvedContactName,
          })
        )
        : '';

      return {
        data: {
          companyName: resolvedCompanyName,
          opportunityTitle: pureTitle,
          openPositions: result.data.openPositions ?? normalizedBaseline.openPositions,
          clientContact: resolvedContactName,
          clientContactEmail:
            sanitizeExtractedText(result.data.clientContactEmail) ||
            normalizedBaseline.clientContactEmail,
          clientContactTitle: resolvedContactTitle,
          location: sanitizeExtractedText(result.data.location) || normalizedBaseline.location,
          workModel: result.data.workModel || normalizedBaseline.workModel,
          targetBillRate: resolvedBill,
          targetPayRate: resolvedPay,
          skills: result.data.skills.length > 0 ? result.data.skills : normalizedBaseline.skills,
          missingNotes:
            sanitizeMissingNotes(result.data.missingNotes) || normalizedBaseline.missingNotes,
          publicDescription: scrubbedAiSummary || normalizedBaseline.publicDescription,
        },
        aiUsed: true,
        meta: {
          provider: result.completion.provider,
          model: result.completion.model,
          inputTokens: result.completion.inputTokens,
          outputTokens: result.completion.outputTokens,
          latencyMs: result.completion.latencyMs,
          repaired: result.repaired,
        },
      };
    } catch (err: any) {
      if (!config.fallbackToOffline) {
        throw toSafeAiHttpError(
          err,
          'We could not extract all requirement details automatically right now. Please try again or review fields manually.'
        );
      }
      console.warn('[AI] enhanceEmailIntakeParse fallback to offline baseline:', err?.message || err);
      return { data: normalizedBaseline, aiUsed: false };
    }
  }

  async evaluateSubmissionCapability(
    candidate: CapabilityCandidateInput,
    requirement: CapabilityRequirementInput,
    options: { rateMasked?: boolean; tenantId?: string; userId?: string } = {}
  ): Promise<CapabilityEvaluationResult> {
    const rateMasked = Boolean(options.rateMasked);
    const offlineBaseline = computeOfflineCapabilityEvaluation(candidate, requirement);
    const { config, adapter, quotaNotice } = await this.getActiveRuntime({
      tenantId: options.tenantId,
    });
    if (!config.configured || !adapter.isConfigured()) {
      return quotaNotice ? { ...offlineBaseline, quotaNotice } : offlineBaseline;
    }

    try {
      const safeReq = buildRateSafeRequirementPromptData(
        requirement,
        rateMasked,
        config.maxInputChars
      );
      const safeCand = buildPiiSafeCandidatePromptData(candidate, {
        rateMasked,
        maxSnippetChars: Math.min(config.maxInputChars, 3500),
        includeHourlyRate: !rateMasked,
        requirement,
        includeSkillVerification: true,
      });

      const result = await completeValidatedJson({
        adapter,
        tier: 'smart',
        schema: SubmissionCapabilityAiSchema,
        messages: [
          {
            role: 'system',
            content:
              `You are an IT staffing capability evaluator. Score how well the candidate resume satisfies the job requirement. ${SHARED_CAPABILITY_SCORING_RUBRIC} Return ONLY JSON with keys: fitScore (0-100 integer), recommendation ("STRONG_FIT"|"GOOD_FIT"|"PARTIAL_FIT"|"LOW_FIT"), strengths (max 5 concise bullets), gaps (max 5 concise bullets), verdict (1 clear sentence).`,
          },
          {
            role: 'user',
            content: JSON.stringify({ requirement: safeReq, candidate: safeCand }),
          },
        ],
      });

      await this.recordFeatureUsage('capability_check', result.completion, options);

      return {
        fitScore: result.data.fitScore,
        recommendation: result.data.recommendation,
        strengths: result.data.strengths,
        gaps: result.data.gaps,
        verdict: result.data.verdict,
        aiUsed: true,
        meta: {
          provider: result.completion.provider,
          model: result.completion.model,
          inputTokens: result.completion.inputTokens,
          outputTokens: result.completion.outputTokens,
          latencyMs: result.completion.latencyMs,
          repaired: result.repaired,
        },
      };
    } catch (err: any) {
      if (!config.fallbackToOffline) {
        throw toSafeAiHttpError(
          err,
          'We could not complete the candidate fit review right now. Please try again shortly.'
        );
      }
      console.warn(
        '[AI] evaluateSubmissionCapability fallback to offline baseline:',
        err?.message || err
      );
      return offlineBaseline;
    }
  }

  private async rankCandidateChunk(
    chunk: CapabilityCandidateInput[],
    safeReq: Record<string, unknown>,
    params: {
      adapter: AiProviderAdapter;
      rateMasked: boolean;
      timeoutMs: number;
      maxTokens: number;
      allowChunkSkipOnError: boolean;
      requirement: CapabilityRequirementInput;
    }
  ) {
    try {
      const safeCandidates = chunk.map((c) =>
        buildPiiSafeCandidatePromptData(c, {
          rateMasked: params.rateMasked,
          maxSnippetChars: 1350,
          maxMatchedChunkChars: 1500,
          includeHourlyRate: false,
          requirement: params.requirement,
          includeSkillVerification: true,
        })
      );

      const result = await completeValidatedJson({
        adapter: params.adapter,
        tier: 'fast',
        schema: BatchRankAiSchema,
        maxTokens: params.maxTokens,
        timeoutMs: params.timeoutMs,
        messages: [
          {
            role: 'system',
            content:
              `You rank shortlisted staffing candidates against a requirement using anonymized candidate profiles. ${SHARED_CAPABILITY_SCORING_RUBRIC} You MUST evaluate and return ALL ${chunk.length} candidateIds from the input candidates array without skipping any. Return ONLY JSON: { "rankings": [{ "candidateId": string, "fitScore": 0-100, "matchedHighlights": string[], "gaps": string[], "oneLineSummary": string }] } ordered highest fitScore first.`,
          },
          {
            role: 'user',
            content: JSON.stringify({ requirement: safeReq, candidates: safeCandidates }),
          },
        ],
      });
      return { ok: true as const, result };
    } catch (err: any) {
      if (!params.allowChunkSkipOnError) throw err;
      console.warn(
        '[AI] rankCandidatesForRequirement chunk error (will retry missing candidates if needed):',
        err?.message || err
      );
      return { ok: false as const, error: err };
    }
  }

  async rankCandidatesForRequirement(
    candidates: CapabilityCandidateInput[],
    requirement: CapabilityRequirementInput,
    options: {
      rateMasked?: boolean;
      tenantId?: string;
      userId?: string;
      usageFeature?: AiUsageFeature;
    } = {}
  ): Promise<{
    rankings: RankedCandidateResult[];
    aiUsed: boolean;
    quotaNotice?: string;
    meta?: {
      provider: string;
      model: string;
      inputTokens?: number;
      outputTokens?: number;
      latencyMs: number;
      repaired: boolean;
    };
  }> {
    const rateMasked = Boolean(options.rateMasked);
    const clippedCandidates = candidates.slice(0, 30);

    const buildOfflineRankings = (list: CapabilityCandidateInput[]): RankedCandidateResult[] =>
      list
        .map((c) => {
          const evalRes = computeOfflineCapabilityEvaluation(c, requirement);
          return {
            candidateId: c.id,
            fitScore: evalRes.fitScore,
            matchedHighlights: evalRes.strengths.slice(0, 4),
            gaps: evalRes.gaps.slice(0, 4),
            oneLineSummary: evalRes.verdict,
            aiEvaluated: false,
          };
        })
        .sort((a, b) => b.fitScore - a.fitScore);

    const { config, adapter, quotaNotice } = await this.getActiveRuntime({
      tenantId: options.tenantId,
    });
    if (!config.configured || !adapter.isConfigured() || clippedCandidates.length === 0) {
      return {
        rankings: buildOfflineRankings(clippedCandidates),
        aiUsed: false,
        ...(quotaNotice ? { quotaNotice } : {}),
      };
    }

    try {
      // Split into compact parallel chunks of 5 on the fast model tier for low-latency ranking
      const BATCH_CHUNK_SIZE = 5;
      const chunkTimeoutMs = Math.min(Math.max(config.timeoutMs, 15000), 25000);
      const safeReq = buildRateSafeRequirementPromptData(
        requirement,
        rateMasked,
        Math.min(config.maxInputChars, 2800)
      );

      const toChunks = (list: CapabilityCandidateInput[]) => {
        const out: CapabilityCandidateInput[][] = [];
        for (let i = 0; i < list.length; i += BATCH_CHUNK_SIZE) {
          out.push(list.slice(i, i + BATCH_CHUNK_SIZE));
        }
        return out;
      };

      const validIds = new Set(clippedCandidates.map((c) => c.id));
      const seenRanked = new Set<string>();
      const ranked: RankedCandidateResult[] = [];
      const acc: {
        totalInputTokens: number;
        totalOutputTokens: number;
        hasInputTokens: boolean;
        hasOutputTokens: boolean;
        maxLatencyMs: number;
        anyRepaired: boolean;
        meta: { provider: string; model: string } | null;
        firstError: any;
      } = {
        totalInputTokens: 0,
        totalOutputTokens: 0,
        hasInputTokens: false,
        hasOutputTokens: false,
        maxLatencyMs: 0,
        anyRepaired: false,
        meta: null,
        firstError: null,
      };

      const collectChunkResults = (
        results: Awaited<ReturnType<AiService['rankCandidateChunk']>>[]
      ) => {
        for (const cr of results) {
          if (!cr.ok) {
            if (!acc.firstError) acc.firstError = cr.error;
            continue;
          }
          const { data, completion, repaired } = cr.result;
          acc.meta = { provider: completion.provider, model: completion.model };
          if (typeof completion.inputTokens === 'number') {
            acc.totalInputTokens += completion.inputTokens;
            acc.hasInputTokens = true;
          }
          if (typeof completion.outputTokens === 'number') {
            acc.totalOutputTokens += completion.outputTokens;
            acc.hasOutputTokens = true;
          }
          acc.maxLatencyMs = Math.max(acc.maxLatencyMs, completion.latencyMs);
          acc.anyRepaired = acc.anyRepaired || repaired;

          for (const r of data.rankings) {
            if (!validIds.has(r.candidateId) || seenRanked.has(r.candidateId)) continue;
            seenRanked.add(r.candidateId);
            ranked.push({ ...r, aiEvaluated: true });
          }
        }
      };

      const firstPassResults = await Promise.all(
        toChunks(clippedCandidates).map((chunk) =>
          this.rankCandidateChunk(chunk, safeReq, {
            adapter,
            rateMasked,
            timeoutMs: chunkTimeoutMs,
            maxTokens: 1800,
            allowChunkSkipOnError: true,
            requirement,
          })
        )
      );
      collectChunkResults(firstPassResults);

      const firstErrText = String(acc.firstError?.message || '').toLowerCase();
      const isFatalQuotaOrAuth =
        firstErrText.includes('status 429') ||
        firstErrText.includes('status 401') ||
        firstErrText.includes('status 403') ||
        firstErrText.includes('neurons') ||
        firstErrText.includes('insufficient_quota');

      // Retry once for any candidateIds omitted by a transient chunk failure (skip on quota/auth errors)
      const missingAfterFirstPass = clippedCandidates.filter((c) => !seenRanked.has(c.id));
      if (missingAfterFirstPass.length > 0 && ranked.length > 0 && !isFatalQuotaOrAuth) {
        const retryResults = await Promise.all(
          toChunks(missingAfterFirstPass).map((chunk) =>
            this.rankCandidateChunk(chunk, safeReq, {
              adapter,
              rateMasked,
              timeoutMs: chunkTimeoutMs,
              maxTokens: 1800,
              allowChunkSkipOnError: true,
              requirement,
            })
          )
        );
        collectChunkResults(retryResults);
      }

      if (ranked.length === 0 || !acc.meta) {
        if (!config.fallbackToOffline) {
          throw toSafeAiHttpError(
            acc.firstError,
            'We could not rank candidates automatically right now. Please try again shortly.'
          );
        }
        return { rankings: buildOfflineRankings(clippedCandidates), aiUsed: false };
      }

      const missingFallback = config.fallbackToOffline
        ? buildOfflineRankings(clippedCandidates.filter((c) => !seenRanked.has(c.id)))
        : [];
      const combinedRankings = [...ranked, ...missingFallback].sort(
        (a, b) => b.fitScore - a.fitScore
      );
      const aggregatedCompletion = {
        provider: acc.meta.provider,
        model: acc.meta.model,
        ...(acc.hasInputTokens ? { inputTokens: acc.totalInputTokens } : {}),
        ...(acc.hasOutputTokens ? { outputTokens: acc.totalOutputTokens } : {}),
        latencyMs: acc.maxLatencyMs,
      };

      await this.recordFeatureUsage(
        options.usageFeature || 'match_rank',
        aggregatedCompletion,
        options
      );

      return {
        rankings: combinedRankings,
        aiUsed: true,
        meta: {
          ...aggregatedCompletion,
          repaired: acc.anyRepaired,
        },
      };
    } catch (err: any) {
      if (!config.fallbackToOffline) {
        throw toSafeAiHttpError(
          err,
          'We could not rank candidates automatically right now. Please try again shortly.'
        );
      }
      console.warn(
        '[AI] rankCandidatesForRequirement fallback to offline baseline:',
        err?.message || err
      );
      return { rankings: buildOfflineRankings(clippedCandidates), aiUsed: false };
    }
  }

  async draftClientPitch(
    candidate: CapabilityCandidateInput,
    requirement: CapabilityRequirementInput,
    options: PitchDraftInput = {}
  ): Promise<PitchDraftResult> {
    const rateMasked = Boolean(options.rateMasked);
    const purpose = options.purpose || 'client_pitch';
    const tone = String(options.tone || 'PROFESSIONAL').toUpperCase();
    const agencyName = (options.agencyName || 'SquadPipe Staffing').trim();
    const senderName = String(options.senderName || '').trim();
    const { cleanName: recipientCleanName, greeting } = extractCleanRecipientGreeting(
      options.recipientName
    );
    const roleTitle = (requirement.opportunityTitle || 'Open Requirement').trim();
    const candidateName = normalizeDisplayCandidateName(candidate.fullName);
    const candidateTitle = (candidate.currentTitle || 'Technology Consultant').trim();
    const skillsList = splitSkillList(candidate.skillset).slice(0, 6).join(', ');
    const signOffName = senderName
      ? `${senderName}\n${agencyName}`
      : `${agencyName} Recruiting Team`;

    const rawLocation = String(requirement.location || '').trim();
    const rawWorkModel = String(requirement.workModel || '').trim();
    const formattedWorkModel = rawWorkModel
      ? rawWorkModel.charAt(0).toUpperCase() + rawWorkModel.slice(1).toLowerCase()
      : '';
    const locationHasModel = /\b(?:onsite|on-site|hybrid|remote)\b/i.test(rawLocation);
    const reqContextTag = locationHasModel
      ? rawLocation
      : [rawLocation, formattedWorkModel].filter(Boolean).join(' \u2022 ');
    const clientClause = requirement.companyName ? ` at ${requirement.companyName}` : '';
    const reqRefClause = requirement.code ? ` (${requirement.code})` : '';

    const offlineSubject =
      purpose === 'interview_followup'
        ? `Follow-Up: ${candidateName} — ${roleTitle}${reqRefClause}`
        : `Candidate Submittal: ${candidateName} — ${roleTitle}${reqRefClause}`;

    const rawRateDisplay = String(candidate.hourlyRateDisplay || '').trim();
    const formattedRateDisplay = rawRateDisplay
      ? /^\d+(?:\.\d+)?$/.test(rawRateDisplay)
        ? `$${rawRateDisplay}/hr`
        : rawRateDisplay
      : '';
    const rateBullet = !rateMasked && formattedRateDisplay ? `- Target Rate: ${formattedRateDisplay}` : '';

    const authRelocParts = [
      candidate.workAuth ? `Work Auth: ${candidate.workAuth}` : '',
      candidate.relocation ? `Relocation: ${candidate.relocation}` : '',
    ].filter(Boolean);

    const offlineBody =
      purpose === 'interview_followup'
        ? [
          greeting,
          '',
          `Following up from ${agencyName} on our submitted consultant, ${candidateName}, for the ${roleTitle} opening${clientClause}.`,
          '',
          'Quick Recap:',
          `- Candidate: ${candidateName} (${candidateTitle})`,
          skillsList ? `- Key Alignment: ${skillsList}` : '',
          '',
          'Could you share any interview feedback or next steps on scheduling? Happy to coordinate availability on our end.',
          '',
          'Best regards,',
          signOffName,
        ]
          .filter((line, idx, arr) => line !== '' || (idx > 0 && arr[idx - 1] !== ''))
          .join('\n')
        : [
          greeting,
          '',
          `Please find ${candidateName}'s profile attached for your ${roleTitle} opening${clientClause}${reqContextTag ? ` (${reqContextTag})` : ''}.`,
          '',
          'Candidate Snapshot:',
          `- Current Role: ${candidateTitle}`,
          skillsList ? `- Core Skills: ${skillsList}` : '',
          authRelocParts.length > 0 ? `- ${authRelocParts.join(' | ')}` : '',
          rateBullet,
          '',
          'Please let me know if you would like to schedule an introductory call or interview slot.',
          '',
          'Best regards,',
          signOffName,
        ]
          .filter((line, idx, arr) => line !== '' || (idx > 0 && arr[idx - 1] !== ''))
          .join('\n');

    const { config, adapter, quotaNotice } = await this.getActiveRuntime({
      tenantId: options.tenantId,
    });
    if (!config.configured || !adapter.isConfigured()) {
      return {
        subject: offlineSubject,
        bodyText: offlineBody,
        aiUsed: false,
        ...(quotaNotice ? { quotaNotice } : {}),
      };
    }

    try {
      const safeReq = buildRateSafeRequirementPromptData(
        requirement,
        rateMasked,
        Math.min(config.maxInputChars, 4000)
      );
      const { code: _omitInternalCode, ...clientFacingReq } = safeReq as Record<string, any>;
      const safeCand = buildPiiSafeCandidatePromptData(candidate, {
        rateMasked,
        maxSnippetChars: 3000,
        includeHourlyRate: !rateMasked,
      });

      const emailGoal =
        purpose === 'interview_followup'
          ? `Recruiter ${senderName || agencyName} following up with ${recipientCleanName || 'the client hiring team'} regarding interview feedback or next scheduling steps for submitted consultant ${candidateName}.`
          : `Recruiter ${senderName || agencyName} pitching submitted consultant ${candidateName} to ${recipientCleanName || 'the client hiring team'} for the ${roleTitle} role.`;

      const result = await completeValidatedJson({
        adapter,
        tier: 'smart',
        schema: PitchDraftAiSchema,
        messages: [
          {
            role: 'system',
            content: [
              'You are an experienced US/global B2B IT staffing recruiter writing a clean, structured email TO a client hiring manager ABOUT your submitted consultant in THIRD PERSON.',
              'STRICT RULES:',
              '1. Perspective: Always write as the recruiter/agency ("we", "our consultant <candidateName>", "<candidateName> brings..."). NEVER write in first person as the candidate.',
              '2. Positive framing: Highlight concrete relevant skills, architecture strengths, and transferable project delivery. NEVER apologize for missing skills or write negative caveats like "Although background is primarily X" or "with proper training and support".',
              '3. Scannable spacing & format: ALWAYS separate every section with a blank line (\\n\\n): greeting ("Hi <FirstName>,"), opening paragraph, "Candidate Snapshot:" (or "Quick Recap:"), relevance paragraph, 1-line CTA, and closing signature. Keep NO blank line between "Candidate Snapshot:" and its "- " bullet points, NO blank line between consecutive bullets, and NO blank line between the closing phrase ("Best regards,") and the exact provided signOffName (NEVER use "[Your Name]" or placeholders).',
              '4. Tone: PROFESSIONAL (balanced executive), HIGH_IMPACT (punchy results & speed-to-value), TECHNICAL_FOCUS (concrete stack & engineering depth).',
              '5. Rate privacy: NEVER mention bill rates, margins, or hourly rates unless hourlyRate is explicitly provided in input.',
              '6. Client-facing confidentiality: NEVER include internal requisition/tracking codes (e.g. REQ-1002) inside bodyText.',
              'Return ONLY JSON: { "subject": string, "bodyText": string }.',
            ].join('\n'),
          },
          {
            role: 'user',
            content: JSON.stringify({
              greeting,
              signOffName,
              senderRole: senderName
                ? `${senderName}, Staffing Recruiter at ${agencyName}`
                : `Staffing Recruiter at ${agencyName}`,
              emailGoal,
              purpose,
              tone,
              agencyName,
              recipientName: recipientCleanName || undefined,
              candidateName,
              requirement: clientFacingReq,
              candidate: safeCand,
            }),
          },
        ],
      });

      await this.recordFeatureUsage(
        options.usageFeature || 'pitch_draft',
        result.completion,
        options
      );

      let rawCleanedBody = result.data.bodyText
        .replace(/\[(?:Your Name|Recruiter Name|Sender Name)\]/gi, senderName || agencyName)
        .trim();
      if (requirement.code && String(requirement.code).trim()) {
        const escapedReqCode = String(requirement.code)
          .trim()
          .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        rawCleanedBody = rawCleanedBody
          .replace(new RegExp(`\\s*\\(\\s*${escapedReqCode}\\s*\\)`, 'gi'), '')
          .replace(new RegExp(`\\b${escapedReqCode}\\b`, 'gi'), '')
          .replace(/[ \t]{2,}/g, ' ')
          .trim();
      }
      const cleanedBody = normalizePitchEmailSpacing(rawCleanedBody);

      return {
        subject: result.data.subject,
        bodyText: cleanedBody,
        aiUsed: true,
        meta: {
          provider: result.completion.provider,
          model: result.completion.model,
          inputTokens: result.completion.inputTokens,
          outputTokens: result.completion.outputTokens,
          latencyMs: result.completion.latencyMs,
          repaired: result.repaired,
        },
      };
    } catch (err: any) {
      if (!config.fallbackToOffline) {
        throw toSafeAiHttpError(
          err,
          'We could not draft the client email right now. Please try again in a moment.'
        );
      }
      console.warn('[AI] draftClientPitch fallback to offline template:', err?.message || err);
      return { subject: offlineSubject, bodyText: offlineBody, aiUsed: false };
    }
  }
}

export const aiService = new AiService();
