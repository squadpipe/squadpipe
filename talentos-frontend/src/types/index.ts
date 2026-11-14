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
  status: 'Active' | 'Suspended' | 'Invited';
  isCurrentUser?: boolean;
  lastActive: string;
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
  hourlyRate: string;
  relocation: string;
  resumeName: string;
  resumeFormat: string;
  resumeFileUrl?: string;
  assignedRecruiter: string;
  pipelineStage: string;
  rawSnippet?: string;
  customFields?: Record<string, any>;
}

export interface ClientContact {
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
  customFields?: Record<string, any>;
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
  stage: 'Requirement' | 'Submitted' | 'Interview' | 'Selected' | 'Onboarding' | 'Closed';
  submissionDate?: string;
  interviewDate?: string;
  interviewNotes?: string;
  candidate?: Candidate;
}

export interface Requirement {
  id: string;
  code: string;
  companyName: string;
  opportunityTitle: string;
  openPositions: number;
  filledPositions?: number;
  location: string;
  clientContact: string;
  clientContactTitle?: string;
  skillsRequired: string;
  status: 'Requirement' | 'Submitted' | 'Interview' | 'Selected' | 'Onboarding';
  resourceName?: string;
  submissions?: RequirementSubmission[];
  activePlacements?: Array<{
    id: string;
    candidateId?: string | null;
    resourceName: string;
    status: string;
  }>;
  assignedRecruiter: string;
  targetBillRate?: number;
  targetPayRate?: number;
  customFields?: Record<string, any>;
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

export interface SlaTask {
  id: string;
  category: string;
  slaRuleTag: string;
  badgeClass: string;
  title: string;
  desc: string;
  meta: string;
  actionType: 'pitch' | 'pipeline' | 'matcher' | 'billable' | 'checklist';
  actionLabel: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
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
  type: 'Text' | 'Dropdown' | 'Date' | 'Number';
  options: string;
  required: boolean;
  active: boolean;
}

