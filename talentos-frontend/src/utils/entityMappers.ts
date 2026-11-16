import {
  Requirement,
  RequirementSubmission,
  SubmissionNote,
  Candidate,
  Client,
  Vendor,
  BillablePlacement,
  User,
} from '../types';
import { formatRateDisplay, getCurrencySymbol } from './currency';

export const safeIsoDate = (val: any, fallback = ''): string => {
  if (!val || (typeof val !== 'string' && typeof val !== 'number' && !(val instanceof Date))) {
    return fallback;
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? fallback : d.toISOString().split('T')[0];
};

export const safeIsoDateTime = (val: any, fallback = ''): string => {
  if (!val || (typeof val !== 'string' && typeof val !== 'number' && !(val instanceof Date))) {
    return fallback;
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? fallback : d.toISOString();
};

export const toDateTimeLocalInput = (val?: string): string => {
  if (!val) return '';
  const d = new Date(val);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
};

export const formatDateTimeBadge = (val?: string): string => {
  if (!val) return '';
  const d = new Date(val);
  if (isNaN(d.getTime())) return '';
  const datePart = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const hasExplicitTime = d.getHours() !== 0 || d.getMinutes() !== 0;
  if (!hasExplicitTime) return datePart;
  const timePart = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${datePart} • ${timePart}`;
};

export const formatCandidateStage = (stage?: string): string => {
  const map: Record<string, string> = {
    AVAILABLE_BENCH: 'Available / Bench',
    SUBMITTED: 'Submitted',
    INTERVIEW: 'Interview',
    SELECTED: 'Selected',
    ONBOARDING: 'Onboarding',
    BILLABLE: 'Billable',
    ARCHIVED: 'Archived',
  };
  return (stage && map[stage]) || stage || 'Available / Bench';
};

export const formatRequirementStatus = (status?: string): Requirement['status'] => {
  const trimmed = String(status || '').trim();
  if (!trimmed) return 'Requirement';
  const map: Record<string, Requirement['status']> = {
    REQUIREMENT: 'Requirement',
    SUBMITTED: 'Submitted',
    INTERVIEW: 'Interview',
    SELECTED: 'Selected',
    ONBOARDING: 'Onboarding',
    CLOSED: 'Onboarding',
  };
  return map[trimmed.toUpperCase()] || (trimmed as Requirement['status']);
};

export const formatUserRole = (role?: string): string => {
  const map: Record<string, string> = {
    ADMINISTRATOR: 'Administrator',
    SENIOR_RECRUITER: 'Senior Recruiter',
    TECHNICAL_RECRUITER: 'Technical Recruiter',
    BENCH_SALES_LEAD: 'Bench Sales Lead',
    ACCOUNT_EXECUTIVE: 'Account Executive',
    ASSOCIATE_RECRUITER: 'Associate Recruiter',
  };
  return (role && map[role]) || role || 'Technical Recruiter';
};

export const formatUserStatus = (status?: string): User['status'] => {
  const map: Record<string, User['status']> = {
    ACTIVE: 'Active',
    SUSPENDED: 'Suspended',
    INVITED: 'Invited',
  };
  return (status && map[status]) || (status as User['status']) || 'Active';
};

export const formatSubmissionStage = (stage?: string): RequirementSubmission['stage'] => {
  const trimmed = String(stage || '').trim();
  if (!trimmed) return 'Submitted';
  const upper = trimmed.toUpperCase();
  if (upper === 'CLOSED' || upper === 'REJECTED') return 'Closed';
  return formatRequirementStatus(trimmed);
};

export function parseSubmissionNotes(
  raw?: string | null,
  fallbackAuthor?: string | null,
  fallbackDate?: string | null
): SubmissionNote[] {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return [];

  const defaultIso = fallbackDate || new Date().toISOString();

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((item) => item && typeof item === 'object' && typeof item.text === 'string' && item.text.trim())
          .map((item, idx) => ({
            id: typeof item.id === 'string' && item.id.trim() ? item.id.trim() : `note_${idx}`,
            text: item.text.trim(),
            authorName:
              typeof item.authorName === 'string' && item.authorName.trim()
                ? item.authorName.trim()
                : fallbackAuthor || 'Recruiter',
            ...(typeof item.authorId === 'string' && item.authorId.trim()
              ? { authorId: item.authorId.trim() }
              : {}),
            ...(typeof item.stage === 'string' && item.stage.trim()
              ? { stage: formatSubmissionStage(item.stage) }
              : {}),
            createdAt:
              typeof item.createdAt === 'string' && item.createdAt.trim()
                ? item.createdAt
                : defaultIso,
            ...(typeof item.updatedAt === 'string' && item.updatedAt.trim()
              ? { updatedAt: item.updatedAt }
              : {}),
          }));
      }
    } catch {
      // Fall back to legacy plain-text note
    }
  }

  return [
    {
      id: 'legacy_0',
      text: trimmed,
      authorName: fallbackAuthor || 'Recruiter',
      createdAt: defaultIso,
    },
  ];
}

export const mapSubmissionFromApi = (s: any): RequirementSubmission => {
  const mappedCand = s?.candidate ? mapCandidateFromApi(s.candidate) : undefined;
  const recruiterName = s.recruiter?.fullName || '';
  const fallbackIso = safeIsoDateTime(s.lastClientFeedbackDate || s.submissionDate || s.createdAt);
  const notes = parseSubmissionNotes(s.interviewNotes, recruiterName, fallbackIso);

  return {
    id: s.id,
    candidateId: s.candidateId || mappedCand?.id || '',
    fullName: mappedCand?.fullName || s.candidate?.fullName || 'Applicant',
    email: mappedCand?.email || s.candidate?.email || '',
    phone: mappedCand?.phone || s.candidate?.phone || '',
    currentTitle: mappedCand?.currentTitle || s.candidate?.currentTitle || '',
    workAuth: mappedCand?.workAuth || s.candidate?.workAuth || '',
    skillset: mappedCand?.skillset || s.candidate?.skillset || '',
    hourlyRate: mappedCand?.hourlyRate || s.candidate?.hourlyRateDisplay || '',
    resumeName: mappedCand?.resumeName || s.candidate?.resumeFileName || '',
    resumeFormat: mappedCand?.resumeFormat || s.candidate?.resumeFormat || '',
    resumeFileUrl: mappedCand?.resumeFileUrl || s.candidate?.resumeFileUrl || undefined,
    stage: formatSubmissionStage(s.stage),
    submissionDate: safeIsoDate(s.submissionDate || s.createdAt),
    lastClientFeedbackDate: safeIsoDate(s.lastClientFeedbackDate),
    interviewDate: safeIsoDate(s.interviewDate),
    interviewDateTime: safeIsoDateTime(s.interviewDate),
    interviewNotes: notes.map((n) => n.text).join('\n'),
    notes,
    recruiterName,
    candidate: mappedCand,
  };
};

export const mapRequirementFromApi = (r: any): Requirement & { createdAt?: string } => {
  const submissions: RequirementSubmission[] = Array.isArray(r.submissions)
    ? r.submissions.map(mapSubmissionFromApi)
    : [];
  const activePlacements = Array.isArray(r.placements)
    ? r.placements
        .filter((p: any) => !['TERMINATED', 'COMPLETED'].includes(String(p.status || '').toUpperCase()))
        .map((p: any) => ({
          id: p.id,
          candidateId: p.candidateId || null,
          resourceName: p.resourceName || '',
          status: p.status || 'ACTIVE',
        }))
    : [];
  const openPositionsNum = Number(r.openPositions);
  const openPositions = Number.isInteger(openPositionsNum) && openPositionsNum >= 1 ? openPositionsNum : 1;

  return {
    id: r.id,
    code: r.code || '',
    companyName: r.companyName || r.client?.name || '',
    opportunityTitle: r.opportunityTitle || '',
    openPositions,
    filledPositions: activePlacements.length,
    location: r.location || '',
    clientContact:
      r.clientContact?.fullName ||
      r.clientContact?.name ||
      (typeof r.clientContact === 'string' ? r.clientContact : ''),
    clientContactTitle:
      r.clientContact?.designation ||
      (typeof r.clientContactTitle === 'string' ? r.clientContactTitle : ''),
    skillsRequired: r.skillsRequired || '',
    status: formatRequirementStatus(r.status),
    resourceName: r.resourceName || submissions.find((s) => s.stage !== 'Closed')?.fullName || submissions[0]?.fullName || '',
    submissions,
    submissionCount: r._count?.submissions ?? submissions.length,
    activePlacements,
    assignedRecruiter:
      r.assignedRecruiter?.fullName ||
      r.assignedRecruiter?.name ||
      (typeof r.assignedRecruiter === 'string' ? r.assignedRecruiter : ''),
    targetBillRate: r.targetBillRate,
    targetPayRate: r.targetPayRate,
    customFields: r.customFields,
    createdAt: r.createdAt || new Date().toISOString(),
    updatedAt: r.updatedAt || r.createdAt || new Date().toISOString(),
  };
};

export const mapCandidateFromApi = (c: any): Candidate => ({
  id: c.id,
  fullName: c.fullName || '',
  phone: c.phone || '',
  email: c.email || '',
  workAuth: c.workAuth || '',
  education: c.education || '',
  currentTitle: c.currentTitle || '',
  skillset: c.skillset || '',
  hourlyRate: formatRateDisplay(
    c.hourlyRateDisplay || (c.hourlyRateW2 ? `${getCurrencySymbol()}${c.hourlyRateW2}/hr (W2)` : '')
  ),
  relocation: c.relocation || 'Yes',
  resumeName: c.resumeFileName || '',
  resumeFormat: c.resumeFormat || 'PDF',
  resumeFileUrl: c.resumeFileUrl || undefined,
  assignedRecruiter: c.assignedRecruiter?.fullName || c.assignedRecruiter || '',
  pipelineStage: formatCandidateStage(c.pipelineStage),
  rawSnippet: c.rawSnippet || '',
  customFields: c.customFields,
});

export const mapClientFromApi = (cl: any): Client => ({
  id: cl.id,
  name: cl.name || '',
  website: cl.website || '',
  boardNumber: cl.boardNumber || '',
  location: cl.location || '',
  contacts: (cl.contacts || []).map((cnt: any) => ({
    name: cnt.fullName || cnt.name || '',
    designation: cnt.designation || '',
    phone: cnt.phone || '',
    email: cnt.email || '',
    isPrimary: cnt.isPrimary ?? false,
  })),
  customFields: cl.customFields,
});

export const mapVendorFromApi = (v: any): Vendor => {
  const mappedContacts =
    Array.isArray(v.contacts) && v.contacts.length > 0
      ? v.contacts.map((c: any) => ({
          id: c.id,
          fullName: c.fullName || '',
          designation: c.designation || '',
          phone: c.phone || '',
          email: c.email || '',
          isPrimary: Boolean(c.isPrimary),
        }))
      : v.contactName || v.email
      ? [
          {
            fullName: v.contactName || '',
            designation: '',
            phone: v.phone || '',
            email: v.email || '',
            isPrimary: true,
          },
        ]
      : [];

  const primary = mappedContacts.find((c: any) => c.isPrimary) || mappedContacts[0];

  return {
    id: v.id,
    name: v.name || '',
    contactName: primary?.fullName || v.contactName || '',
    phone: primary?.phone || v.phone || '',
    email: primary?.email || v.email || '',
    location: v.location || '',
    skillSpecialization: v.skillSpecialization || '',
    paymentTerms: v.paymentTerms || '',
    invoicingTerms: v.invoicingTerms || '',
    msa: v.msaSigned ? 'Active' : v.msa || 'Pending',
    contacts: mappedContacts,
    customFields: v.customFields,
  };
};

export const mapPlacementFromApi = (p: any): BillablePlacement => {
  const depRaw = String(p.deployment || 'Onshore').toUpperCase();
  const deployment =
    depRaw === 'OFFSHORE'
      ? 'Offshore'
      : depRaw === 'NEARSHORE'
      ? 'Nearshore'
      : depRaw === 'ONSHORE'
      ? 'Onshore'
      : p.deployment || 'Onshore';

  const typeRaw = String(p.placementType || 'C2C Subcontractor').toUpperCase();
  const placementType =
    typeRaw === 'W2_HOURLY'
      ? 'W2 Hourly'
      : typeRaw === 'TEN_NINETY_NINE'
      ? '1099'
      : typeRaw === 'FULL_TIME'
      ? 'Full-Time'
      : typeRaw === 'C2C_SUBCONTRACTOR'
      ? 'C2C Subcontractor'
      : p.placementType || 'C2C Subcontractor';

  const statusRaw = String(p.status || 'Active').toUpperCase().replace(/\s+/g, '_');
  const statusMap: Record<string, BillablePlacement['status']> = {
    ACTIVE: 'Active',
    EXTENDED: 'Extended',
    EXPIRING_SOON: 'Expiring Soon',
    COMPLETED: 'Completed',
    TERMINATED: 'Terminated',
  };
  const status = statusMap[statusRaw] || 'Active';

  const parseNum = (val: any): number => {
    const n = parseFloat(String(val ?? '').replace(/[^0-9.]/g, ''));
    return isNaN(n) ? 0 : n;
  };

  const sym = getCurrencySymbol();
  let billing = '';
  if (typeof p.billing === 'string' && p.billing.trim()) {
    const num = parseNum(p.billing);
    billing = /(?:A\$|S\$|[$£€₹])/.test(p.billing)
      ? formatRateDisplay(p.billing.trim(), sym)
      : num > 0
      ? `${sym}${num}/hr`
      : p.billing.trim();
  } else if (p.billRate !== undefined && p.billRate !== null && p.billRate !== '') {
    billing = `${sym}${parseNum(p.billRate)}/hr`;
  }

  let payRate = '';
  if (typeof p.payRate === 'string' && /(?:A\$|S\$|[$£€₹])/.test(p.payRate)) {
    payRate = formatRateDisplay(p.payRate.trim(), sym);
  } else if (p.payRate !== undefined && p.payRate !== null && p.payRate !== '') {
    payRate = `${sym}${parseNum(p.payRate)}/hr`;
  } else if (p.payRateAmount !== undefined && p.payRateAmount !== null && p.payRateAmount !== '') {
    payRate = `${sym}${parseNum(p.payRateAmount)}/hr`;
  }

  const billNum = parseNum(billing || p.billRate);
  const payNum = parseNum(payRate || p.payRateAmount);
  const computedSpread = billNum - payNum;
  const computedMargin = billNum > 0 ? parseFloat(((computedSpread / billNum) * 100).toFixed(2)) : 0;

  return {
    id: p.id,
    recruiter:
      p.recruiter?.fullName ||
      p.recruiter?.name ||
      (typeof p.recruiter === 'string' ? p.recruiter : ''),
    deployment,
    customer: p.customer || p.client?.name || '',
    customerContact:
      p.customerContact?.fullName ||
      p.customerContact?.name ||
      (typeof p.customerContact === 'string' ? p.customerContact : ''),
    resourceName:
      p.resourceName ||
      p.candidate?.fullName ||
      p.candidate?.name ||
      (typeof p.candidate === 'string' ? p.candidate : ''),
    phone: p.phone || p.candidate?.phone || '',
    email: p.email || p.candidate?.email || '',
    skillRole: p.skillRole || '',
    startDate: safeIsoDate(p.startDate),
    endDate: safeIsoDate(p.endDate),
    billing,
    payRate,
    placementType,
    hourlySpread:
      p.hourlySpread !== undefined && p.hourlySpread !== null ? Number(p.hourlySpread) : computedSpread,
    marginPct:
      p.marginPct !== undefined && p.marginPct !== null ? Number(p.marginPct) : computedMargin,
    status,
    purchaseOrderNumber: p.purchaseOrderNumber || '',
    vendorName: p.vendor?.name || p.vendorName || '',
    candidateId: p.candidateId || p.candidate?.id || undefined,
    requirementId: p.requirementId || undefined,
    clientId: p.clientId || p.client?.id || undefined,
    vendorId: p.vendorId || p.vendor?.id || undefined,
    customFields: p.customFields,
  };
};

export const mapUserFromApi = (u: any, currentUserEmail?: string): User => ({
  id: u.id,
  name: u.fullName || u.name || '',
  email: u.email || '',
  role: formatUserRole(u.role),
  desk: u.desk || '',
  rateMasked: u.rateMasked ?? true,
  workload: u.workload || '0 Reqs • 0 Subs • 0 Placements',
  metrics: u.metrics
    ? {
        openReqs: Number(u.metrics.openReqs) || 0,
        submissions: Number(u.metrics.submissions) || 0,
        placements: Number(u.metrics.placements) || 0,
      }
    : undefined,
  status: formatUserStatus(u.status),
  isCurrentUser: u.isCurrentUser ?? (currentUserEmail ? u.email === currentUserEmail : false),
  lastActive: u.lastActive || 'Active Now',
});

