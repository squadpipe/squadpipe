export interface User {
  id: string;
  tenantId?: string;
  agencyName?: string;
  name: string;
  email: string;
  role: string;
  roleBadgeClass?: string;
  roleIcon?: string;
  desk: string;
  rateMasked: boolean;
  workload: string;
  metrics?: {
    openReqs: number;
    submissions: number;
    placements: number;
  };
  status: 'Active' | 'Suspended' | 'Invited';
  isSuperAdmin?: boolean;
  isCurrentUser?: boolean;
  onboardingCompleted?: boolean;
  lastActive: string;
  lastActiveAt?: string;
  createdAt?: string;
}

export interface Candidate {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  workAuth: string;
  education: string;
  currentTitle: string;
  skillset: string;
  normalizedSkills?: string[];
  matchSummary?: {
    score: number;
    matched: string[];
    missing: string[];
  };
  hourlyRate: string;
  relocation: string;
  resumeName: string;
  resumeFormat: string;
  resumeFileUrl?: string;
  assignedRecruiter: string;
  pipelineStage: string;
  vendorId?: string;
  vendorName?: string;
  rawSnippet?: string;
  customFields?: Record<string, any>;
}

export interface ClientContact {
  id?: string;
  name: string;
  designation: string;
  phone: string;
  email: string;
  isPrimary: boolean;
}

export interface Client {
  id: string;
  name: string;
  website: string;
  boardNumber: string;
  location: string;
  contacts: ClientContact[];
  customFields?: Record<string, any>;
}

export interface VendorContact {
  id?: string;
  fullName: string;
  designation?: string;
  phone?: string;
  email: string;
  isPrimary?: boolean;
}

export interface Vendor {
  id: string;
  name: string;
  contactName: string;
  phone: string;
  email: string;
  location: string;
  skillSpecialization: string;
  paymentTerms: string;
  invoicingTerms: string;
  msa: string;
  coiExpiryDate?: string;
  contacts?: VendorContact[];
  customFields?: Record<string, any>;
}

export interface SubmissionNote {
  id: string;
  text: string;
  authorName: string;
  authorId?: string;
  stage?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CapabilitySummary {
  fitScore?: number;
  recommendation: string;
  recommendationLabel?: string;
  verdict: string;
  strengths: string[];
  gaps: string[];
  evaluatedWithAi: boolean;
  evaluatedAt?: string;
}

export interface RequirementSubmission {
  id: string;
  candidateId: string;
  fullName: string;
  email?: string;
  phone?: string;
  currentTitle?: string;
  workAuth?: string;
  skillset?: string;
  hourlyRate?: string;
  resumeName?: string;
  resumeFormat?: string;
  resumeFileUrl?: string;
  stage: string;
  intakeSource?: 'MANUAL' | 'BENCH_MATCH' | 'PUBLIC_FORM' | string;
  submittedRate?: string;
  submittedVendorName?: string;
  capabilityScore?: number | null;
  capabilitySummary?: CapabilitySummary | null;
  submissionDate?: string;
  lastClientFeedbackDate?: string;
  interviewDate?: string;
  interviewDateTime?: string;
  interviewNotes?: string;
  notes?: SubmissionNote[];
  recruiterName?: string;
  candidate?: Candidate;
}

export interface ClientDuplicateWarning {
  candidateId: string;
  candidateName: string;
  existingSubmissionId: string;
  requirementId: string;
  requirementCode: string;
  opportunityTitle: string;
  clientName: string;
  stage: string;
  recruiterName: string | null;
  submissionDate: string;
  daysAgo: number;
}

export interface RecruiterPerformanceRow {
  userId: string;
  fullName: string;
  role: string;
  desk: string;
  openReqs: number;
  submissions: number;
  interviews: number;
  placements: number;
}

export type ApplicationFormFieldWidth = 'half' | 'full';

export type CustomQuestionFieldType =
  | 'TEXT'
  | 'TEXTAREA'
  | 'RICH_TEXT'
  | 'NUMBER'
  | 'DATE'
  | 'BOOLEAN'
  | 'DROPDOWN'
  | 'MULTISELECT'
  | 'EMAIL'
  | 'PHONE'
  | 'URL';

export interface ApplicationFormCustomField {
  key: string;
  name: string;
  type: CustomQuestionFieldType;
  required: boolean;
  width?: ApplicationFormFieldWidth;
  options?: string[];
}

export interface ApplicationFormTemplate {
  id: string;
  name: string;
  description: string;
  heading: string;
  subheading: string;
  isDefault: boolean;
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
  fieldWidths?: Record<string, ApplicationFormFieldWidth>;
  fieldOrder?: string[];
  customFieldKeys: string[];
  customFields?: ApplicationFormCustomField[];
  updatedAt?: string;
}

export interface Requirement {
  id: string;
  code: string;
  companyName: string;
  opportunityTitle: string;
  openPositions: number;
  filledPositions?: number;
  location: string;
  workModel?: string;
  clientContact: string;
  clientContactTitle?: string;
  skillsRequired: string;
  status: string;
  resourceName?: string;
  submissions?: RequirementSubmission[];
  submissionCount?: number;
  activePlacements?: Array<{
    id: string;
    candidateId?: string | null;
    resourceName: string;
    status: string;
  }>;
  assignedRecruiter: string;
  targetBillRate?: number;
  maxBillRate?: number;
  targetPayRate?: number;
  publicFormEnabled?: boolean;
  publicFormToken?: string | null;
  publicDescription?: string | null;
  rawEmailText?: string | null;
  publicFormTemplateId?: string | null;
  customFields?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}

export interface BillablePlacement {
  id: string;
  recruiter: string;
  deployment: string;
  customer: string;
  customerContact?: string;
  resourceName: string;
  phone: string;
  email: string;
  skillRole: string;
  startDate: string;
  endDate: string;
  billing: string;
  payRate?: string;
  placementType?: string;
  hourlySpread?: number;
  marginPct?: number;
  status?: 'Active' | 'Extended' | 'Expiring Soon' | 'Completed' | 'Terminated';
  purchaseOrderNumber?: string;
  vendorName?: string;
  candidateId?: string;
  requirementId?: string;
  clientId?: string;
  vendorId?: string;
  customFields?: Record<string, any>;
}

export interface SlaAgentSuggestion {
  candidateId: string;
  fullName: string;
  currentTitle: string;
  workAuth: string;
  fitScore: number;
  matchedHighlights: string[];
  gaps: string[];
  oneLineSummary: string;
}

export interface SlaAgentPayload {
  kind: 'candidate_shortlist' | 'followup_draft' | 'renewal_draft';
  generatedAt: string;
  evaluatedWithAi: boolean;
  requirementId?: string;
  placementId?: string;
  suggestions?: SlaAgentSuggestion[];
  draftSubject?: string;
  draftBody?: string;
  recipientEmail?: string;
}

export interface SlaTask {
  id: string;
  category: string;
  slaRuleTag: string;
  badgeClass: string;
  title: string;
  desc: string;
  meta: string;
  actionType: 'pipeline' | 'matcher' | 'billable' | 'checklist';
  actionLabel: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  agentPayload?: SlaAgentPayload | null;
  done: boolean;
}

export interface AutomationRule {
  id: string;
  tenantId?: string;
  name: string;
  category: string;
  triggerEvent?: string;
  icon: string;
  color: string;
  active: boolean;
  whenText: string;
  threshold: string;
  thresholdOptions?: string[];
  thenSummary: string;
  actionPills: { icon: string; label: string; color: string }[];
  executionsToday: number;
  lastFired: string;
}

export interface AutomationAuditLog {
  id: string;
  timestamp: string;
  ruleName: string;
  target: string;
  conditionsMet: string;
  actionDispatched: string;
  status: 'Executed' | 'Completed' | 'Failed';
}

export interface CustomField {
  id: string;
  name: string;
  entity: 'consultant' | 'requirement' | 'client' | 'vendor' | 'placement';
  entityLabel: string;
  type:
    | 'Text'
    | 'Long Text'
    | 'Rich Text'
    | 'Dropdown'
    | 'Multi-Select'
    | 'Date'
    | 'Number'
    | 'Yes / No'
    | 'Email'
    | 'Phone'
    | 'URL'
    | string;
  options: string;
  required: boolean;
  active: boolean;
}

