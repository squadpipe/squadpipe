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

  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Preserve short symbols like C#, C++, .NET, Go without failing \b word-boundary checks
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
  options: { rateMasked: boolean; maxSnippetChars: number; includeHourlyRate?: boolean }
): Record<string, unknown> {
  const safeCand: Record<string, unknown> = {
    candidateId: candidate.id,
    currentTitle: candidate.currentTitle || '',
    skillset: candidate.skillset || '',
    workAuth: candidate.workAuth || '',
    relocation: candidate.relocation || '',
    resumeSummaryExcerpt: truncateInput(
      options.rateMasked ? redactRatesFromText(candidate.rawSnippet) : candidate.rawSnippet,
      options.maxSnippetChars
    ),
  };

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

  private async getActiveRuntime(context?: {
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
    const normalizedBaseline: Required<ResumeParseBaseline> = {
      fullName: String(baselineFields.fullName || '').trim(),
      email: String(baselineFields.email || '').trim(),
      phone: String(baselineFields.phone || '').trim(),
      workAuth: String(baselineFields.workAuth || '').trim(),
      currentTitle: String(baselineFields.currentTitle || '').trim(),
      education: String(baselineFields.education || '').trim(),
      skills: Array.isArray(baselineFields.skills) ? baselineFields.skills.filter(Boolean) : [],
      hourlyRate: String(baselineFields.hourlyRate || '').trim(),
      relocation: String(baselineFields.relocation || '').trim(),
      professionalSummary: String(baselineFields.professionalSummary || '').trim(),
    };

    const { config, adapter, quotaNotice } = await this.getActiveRuntime(context);
    if (!config.configured || !adapter.isConfigured()) {
      return {
        data: normalizedBaseline,
        aiUsed: false,
        ...(quotaNotice ? { quotaNotice } : {}),
      };
    }

    const clippedResume = truncateInput(rawText, config.maxInputChars);
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
              'You extract clean structured candidate fields from resume text. Return ONLY strict JSON matching keys: fullName, email, phone, workAuth, currentTitle, education, skills (array of concise skill names), hourlyRate, relocation, professionalSummary (2-3 crisp sentences). Preserve facts only; never invent contact details or work authorization.',
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

      return {
        data: {
          fullName: result.data.fullName || normalizedBaseline.fullName,
          email: result.data.email || normalizedBaseline.email,
          phone: result.data.phone || normalizedBaseline.phone,
          workAuth: result.data.workAuth || normalizedBaseline.workAuth,
          currentTitle: result.data.currentTitle || normalizedBaseline.currentTitle,
          education: result.data.education || normalizedBaseline.education,
          skills: mergedSkills,
          hourlyRate: result.data.hourlyRate || normalizedBaseline.hourlyRate,
          relocation: result.data.relocation || normalizedBaseline.relocation,
          professionalSummary:
            result.data.professionalSummary || normalizedBaseline.professionalSummary,
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
      if (!config.fallbackToOffline) throw err;
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
    const normalizedBaseline: Required<Omit<EmailIntakeBaseline, 'openPositions'>> & {
      openPositions?: number;
    } = {
      companyName: String(baselineFields.companyName || '').trim(),
      opportunityTitle: String(baselineFields.opportunityTitle || '').trim(),
      openPositions: baselineFields.openPositions,
      clientContact: String(baselineFields.clientContact || '').trim(),
      clientContactEmail: String(baselineFields.clientContactEmail || '').trim(),
      clientContactTitle: String(baselineFields.clientContactTitle || '').trim(),
      location: String(baselineFields.location || '').trim(),
      workModel: baselineFields.workModel || 'Remote',
      targetBillRate: Number(baselineFields.targetBillRate || 0),
      targetPayRate: Number(baselineFields.targetPayRate || 0),
      skills: Array.isArray(baselineFields.skills) ? baselineFields.skills.filter(Boolean) : [],
      missingNotes: String(baselineFields.missingNotes || '').trim(),
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
              'You extract structured staffing job requisition fields from client/vendor email threads. Return ONLY strict JSON with keys: companyName, opportunityTitle, openPositions (integer >=1 if mentioned), clientContact, clientContactEmail, clientContactTitle, location, workModel ("Remote"|"Hybrid"|"Onsite"), targetBillRate (number, 0 if unknown), targetPayRate (number, 0 if unknown), skills (string array), missingNotes (concise note on missing commercial/contact fields).',
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

      return {
        data: {
          companyName: result.data.companyName || normalizedBaseline.companyName,
          opportunityTitle:
            result.data.opportunityTitle || normalizedBaseline.opportunityTitle,
          openPositions: result.data.openPositions ?? normalizedBaseline.openPositions,
          clientContact: result.data.clientContact || normalizedBaseline.clientContact,
          clientContactEmail:
            result.data.clientContactEmail || normalizedBaseline.clientContactEmail,
          clientContactTitle:
            result.data.clientContactTitle || normalizedBaseline.clientContactTitle,
          location: result.data.location || normalizedBaseline.location,
          workModel: result.data.workModel || normalizedBaseline.workModel,
          targetBillRate: resolvedBill,
          targetPayRate: resolvedPay,
          skills: result.data.skills.length > 0 ? result.data.skills : normalizedBaseline.skills,
          missingNotes: result.data.missingNotes || normalizedBaseline.missingNotes,
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
      if (!config.fallbackToOffline) throw err;
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
        maxSnippetChars: Math.min(config.maxInputChars, 9000),
        includeHourlyRate: !rateMasked,
      });

      const result = await completeValidatedJson({
        adapter,
        tier: 'smart',
        schema: SubmissionCapabilityAiSchema,
        messages: [
          {
            role: 'system',
            content:
              'You are an IT staffing capability evaluator. Score how well the candidate resume satisfies the job requirement, recognizing equivalent/adjacent skills (e.g. AKS/EKS with Kubernetes, PySpark with Spark). Never mention hidden financial rates. Return ONLY JSON with keys: fitScore (0-100 integer), recommendation ("STRONG_FIT"|"GOOD_FIT"|"PARTIAL_FIT"|"LOW_FIT"), strengths (max 5 concise bullets), gaps (max 5 concise bullets), verdict (1 clear sentence).',
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
      if (!config.fallbackToOffline) throw err;
      console.warn(
        '[AI] evaluateSubmissionCapability fallback to offline baseline:',
        err?.message || err
      );
      return offlineBaseline;
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

    const offlineRankings: RankedCandidateResult[] = clippedCandidates
      .map((c) => {
        const evalRes = computeOfflineCapabilityEvaluation(c, requirement);
        return {
          candidateId: c.id,
          fitScore: evalRes.fitScore,
          matchedHighlights: evalRes.strengths.slice(0, 4),
          gaps: evalRes.gaps.slice(0, 4),
          oneLineSummary: evalRes.verdict,
        };
      })
      .sort((a, b) => b.fitScore - a.fitScore);

    const { config, adapter, quotaNotice } = await this.getActiveRuntime({
      tenantId: options.tenantId,
    });
    if (!config.configured || !adapter.isConfigured() || clippedCandidates.length === 0) {
      return {
        rankings: offlineRankings,
        aiUsed: false,
        ...(quotaNotice ? { quotaNotice } : {}),
      };
    }

    try {
      const safeReq = buildRateSafeRequirementPromptData(
        requirement,
        rateMasked,
        config.maxInputChars
      );
      const safeCandidates = clippedCandidates.map((c) =>
        buildPiiSafeCandidatePromptData(c, {
          rateMasked,
          maxSnippetChars: 1200,
          includeHourlyRate: false,
        })
      );

      const result = await completeValidatedJson({
        adapter,
        tier: 'smart',
        schema: BatchRankAiSchema,
        messages: [
          {
            role: 'system',
            content:
              'You rank shortlisted staffing candidates against a requirement using anonymized candidate profiles. Return ONLY JSON: { "rankings": [{ "candidateId": string, "fitScore": 0-100, "matchedHighlights": string[], "gaps": string[], "oneLineSummary": string }] } ordered highest fitScore first.',
          },
          {
            role: 'user',
            content: JSON.stringify({ requirement: safeReq, candidates: safeCandidates }),
          },
        ],
      });

      const validIds = new Set(clippedCandidates.map((c) => c.id));
      const ranked = result.data.rankings
        .filter((r) => validIds.has(r.candidateId))
        .sort((a, b) => b.fitScore - a.fitScore);

      if (ranked.length === 0) {
        return { rankings: offlineRankings, aiUsed: false };
      }

      const seen = new Set(ranked.map((r) => r.candidateId));
      const missingFallback = offlineRankings.filter((r) => !seen.has(r.candidateId));
      await this.recordFeatureUsage(
        options.usageFeature || 'match_rank',
        result.completion,
        options
      );

      return {
        rankings: [...ranked, ...missingFallback],
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
      if (!config.fallbackToOffline) throw err;
      console.warn(
        '[AI] rankCandidatesForRequirement fallback to offline baseline:',
        err?.message || err
      );
      return { rankings: offlineRankings, aiUsed: false };
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
    const agencyName = (options.agencyName || 'Our Staffing Team').trim();
    const roleTitle = (requirement.opportunityTitle || 'Open Requirement').trim();
    const candidateName = (candidate.fullName || 'Consultant').trim();
    const candidateTitle = (candidate.currentTitle || 'Technology Consultant').trim();
    const skillsList = splitSkillList(candidate.skillset).slice(0, 6).join(', ');

    const offlineSubject =
      purpose === 'interview_followup'
        ? `Follow-Up: ${candidateName} — ${roleTitle}${requirement.code ? ` (${requirement.code})` : ''}`
        : `Candidate Submittal: ${candidateName} — ${roleTitle}${requirement.code ? ` (${requirement.code})` : ''}`;

    const rateLine =
      !rateMasked && candidate.hourlyRateDisplay
        ? `\nTarget Rate: ${candidate.hourlyRateDisplay}`
        : '';

    const offlineBody =
      purpose === 'interview_followup'
        ? [
            'Hi,',
            '',
            `Checking in regarding ${candidateName} (${candidateTitle}) for the ${roleTitle} position.`,
            skillsList ? `Key strengths: ${skillsList}.` : '',
            'Please let us know your feedback or next steps for scheduling.',
            '',
            `Best regards,\n${agencyName}`,
          ]
            .filter((line, idx, arr) => !(line === '' && arr[idx - 1] === ''))
            .join('\n')
        : [
            'Hi,',
            '',
            `Please find ${candidateName}'s profile attached for your ${roleTitle} requirement${requirement.location ? ` (${requirement.location})` : ''}.`,
            `- Title: ${candidateTitle}`,
            skillsList ? `- Core Skills: ${skillsList}` : '',
            candidate.workAuth ? `- Work Authorization: ${candidate.workAuth}` : '',
            rateLine ? rateLine.trim() : '',
            '',
            'Let us know if you would like to schedule an interview slot.',
            '',
            `Best regards,\n${agencyName}`,
          ]
            .filter(Boolean)
            .join('\n')
            .replace(/\n{3,}/g, '\n\n');

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
      const safeCand = buildPiiSafeCandidatePromptData(candidate, {
        rateMasked,
        maxSnippetChars: 3000,
        includeHourlyRate: !rateMasked,
      });

      const result = await completeValidatedJson({
        adapter,
        tier: 'smart',
        schema: PitchDraftAiSchema,
        messages: [
          {
            role: 'system',
            content:
              'You draft crisp, natural IT staffing client emails ready to paste into Gmail/Outlook. Tone options: PROFESSIONAL, HIGH_IMPACT, TECHNICAL_FOCUS. NEVER mention bill rates, margins, or hourly rates if none are provided in input. Return ONLY JSON: { "subject": string, "bodyText": string }.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              purpose,
              tone,
              agencyName,
              candidateName,
              requirement: safeReq,
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

      return {
        subject: result.data.subject,
        bodyText: result.data.bodyText,
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
      if (!config.fallbackToOffline) throw err;
      console.warn('[AI] draftClientPitch fallback to offline template:', err?.message || err);
      return { subject: offlineSubject, bodyText: offlineBody, aiUsed: false };
    }
  }
}

export const aiService = new AiService();
