import type { AiProviderName } from '../../config/ai.config';

export type AiTaskTier = 'fast' | 'smart';

export interface AiChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiCompleteParams {
  tier: AiTaskTier;
  messages: AiChatMessage[];
  temperature?: number;
  maxTokens?: number;
  expectJson?: boolean;
  timeoutMs?: number;
}

export interface AiCompletionResult {
  text: string;
  provider: AiProviderName;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs: number;
}

export interface AiProviderAdapter {
  readonly name: AiProviderName;
  isConfigured(): boolean;
  complete(params: AiCompleteParams): Promise<AiCompletionResult>;
}

export interface AiExecutionMeta {
  provider: AiProviderName;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs?: number;
  repaired?: boolean;
}

export interface ResumeParseBaseline {
  fullName?: string;
  email?: string;
  phone?: string;
  workAuth?: string;
  currentTitle?: string;
  education?: string;
  skills?: string[];
  hourlyRate?: string;
  relocation?: string;
  professionalSummary?: string;
}

export interface EmailIntakeBaseline {
  companyName?: string;
  opportunityTitle?: string;
  openPositions?: number;
  clientContact?: string;
  clientContactEmail?: string;
  clientContactTitle?: string;
  location?: string;
  workModel?: 'Remote' | 'Hybrid' | 'Onsite';
  targetBillRate?: number;
  targetPayRate?: number;
  skills?: string[];
  missingNotes?: string;
}

export interface CapabilityCandidateInput {
  id: string;
  fullName?: string;
  currentTitle?: string;
  skillset?: string;
  workAuth?: string;
  relocation?: string;
  hourlyRateDisplay?: string;
  rawSnippet?: string;
}

export interface CapabilityRequirementInput {
  id?: string;
  code?: string;
  companyName?: string;
  opportunityTitle?: string;
  skillsRequired?: string;
  location?: string;
  workModel?: string;
  targetBillRate?: number | string | null;
  maxBillRate?: number | string | null;
  targetPayRate?: number | string | null;
  rawEmailText?: string | null;
}

export type CapabilityRecommendation =
  | 'STRONG_FIT'
  | 'GOOD_FIT'
  | 'PARTIAL_FIT'
  | 'LOW_FIT';

export interface CapabilityEvaluationResult {
  fitScore: number;
  recommendation: CapabilityRecommendation;
  strengths: string[];
  gaps: string[];
  verdict: string;
  aiUsed: boolean;
  quotaNotice?: string;
  meta?: AiExecutionMeta;
}

export interface RankedCandidateResult {
  candidateId: string;
  fitScore: number;
  matchedHighlights: string[];
  gaps: string[];
  oneLineSummary: string;
}

export interface PitchDraftInput {
  tone?: 'PROFESSIONAL' | 'HIGH_IMPACT' | 'TECHNICAL_FOCUS' | string;
  purpose?: 'client_pitch' | 'interview_followup';
  rateMasked?: boolean;
  agencyName?: string;
  senderName?: string;
  recipientName?: string;
  tenantId?: string;
  userId?: string;
  usageFeature?:
    | 'resume_parse'
    | 'email_parse'
    | 'capability_check'
    | 'match_rank'
    | 'pitch_draft'
    | 'agent_prep';
}

export interface PitchDraftResult {
  subject: string;
  bodyText: string;
  aiUsed: boolean;
  quotaNotice?: string;
  meta?: AiExecutionMeta;
}
