import { formatRateDisplay } from './currency';

export const MAX_BULK_CV_FILES = 50;

export type BulkQueueStatus = 'queued' | 'processing' | 'added' | 'duplicate' | 'failed';

export interface BulkQueueItem {
  id: string;
  file: File;
  status: BulkQueueStatus;
  candidateName?: string;
  currentTitle?: string;
  email?: string;
  aiUsed?: boolean;
  message?: string;
}

export const EMPTY_RESUME_PROFILE = {
  fullName: '',
  phone: '',
  email: '',
  workAuth: 'US Citizen',
  currentTitle: '',
  skillset: '',
  education: '',
  hourlyRate: '',
  relocation: 'Yes',
  recruiter: '',
  fileName: '',
  rawSnippet: '',
  professionalSummary: '',
};

export type ResumeProfileDraft = typeof EMPTY_RESUME_PROFILE;

export function inferResumeFormat(fileName: string): 'PDF' | 'DOCX' | 'DOC' | 'TXT' {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.docx')) return 'DOCX';
  if (lower.endsWith('.doc')) return 'DOC';
  if (lower.endsWith('.txt') || lower.endsWith('.rtf')) return 'TXT';
  return 'PDF';
}

function normalizeWorkAuth(raw?: string): string {
  const val = String(raw || '').trim();
  if (!val) return 'US Citizen';
  const lower = val.toLowerCase();
  if (lower.includes('citizen')) return 'US Citizen';
  if (lower.includes('green') || lower === 'gc' || lower.includes('permanent resident')) {
    return 'Green Card';
  }
  if (lower.includes('h-1b') || lower.includes('h1b')) return 'H-1B';
  if (lower.includes('tn')) return 'TN Visa';
  if (lower.includes('opt') || lower.includes('cpt') || lower.includes('ead')) return 'OPT EAD';
  return 'US Citizen';
}

function normalizeRelocation(raw?: string): 'Yes' | 'No' {
  const lower = String(raw || '').trim().toLowerCase();
  if (lower === 'no' || lower.includes('local only')) return 'No';
  return 'Yes';
}

const PLACEHOLDER_VALUE_RE =
  /^(?:not\s+(?:explicitly\s+)?(?:specified|mentioned|provided|stated|disclosed|available|found)|unspecified|none|n\/?a|unknown|tbd|missing|pending|assigned\s+recruiter|candidate\s+profile|uploaded\s+candidate)$/i;

const NON_PERSON_TOKEN_RE =
  /\b(?:developers?|engineers?|architects?|consultants?|analysts?|managers?|directors?|leads?|specialists?|administrators?|admins?|designers?|coordinators?|technicians?|nurses?|accountants?|controllers?|auditors?|recruiters?|scientists?|strategists?|technologies|technology|private|limited|pvt|ltd|inc|llc|corp|corporation|company|enterprise|solutions|services|systems|platform|knowledge|base|guide|workflow|manual|handbook|brochure|overview|complete|features|welcome|contents|section|curriculum|vitae|resume|cv|profile|uploaded|candidate|squadpipe|softiox|invoice|agreement|requisition|requirement|description|senior|junior|principal|staff)\b/i;

function cleanParsedField(val?: unknown): string {
  const cleaned = String(val ?? '').trim();
  return !cleaned || PLACEHOLDER_VALUE_RE.test(cleaned) ? '' : cleaned;
}

function cleanCandidatePersonName(rawName?: unknown, currentTitle?: unknown): string {
  const cleaned = cleanParsedField(rawName);
  if (!cleaned) return '';
  const titleClean = cleanParsedField(currentTitle);
  if (titleClean && cleaned.toLowerCase() === titleClean.toLowerCase()) {
    return '';
  }
  if (NON_PERSON_TOKEN_RE.test(cleaned) || /[@0-9/\\]/.test(cleaned)) {
    return '';
  }
  const words = cleaned
    .split(/\s+/)
    .map((w) => w.replace(/^[.'"-]+|[.'"-]+$/g, ''))
    .filter(Boolean);
  if (words.length < 2 || words.length > 4) {
    return '';
  }
  if (Math.max(...words.map((w) => w.length)) < 3) {
    return '';
  }
  if (words.filter((w) => w.length >= 2).length < 2) {
    return '';
  }
  return cleaned;
}

export function inferPersonNameFromFileName(fileName: string, currentTitle?: string): string {
  const stem = fileName
    .replace(/\.[^/.]+$/, '')
    .replace(/^\d+[_-\s]+/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b(?:resume|cv|curriculum|vitae|updated|final|draft|v\d+|\d{4})\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!stem) return '';
  const firstTwoOrThree = stem.split(' ').slice(0, 2).join(' ');
  return (
    cleanCandidatePersonName(stem, currentTitle) ||
    cleanCandidatePersonName(firstTwoOrThree, currentTitle)
  );
}

export function mapParsedResumeToDraft(
  resData: any,
  file: File,
  currencySymbol: string,
  options?: { defaultRecruiter?: string; uniqueFallbackEmail?: boolean; batchIndex?: number }
): { profile: ResumeProfileDraft; aiUsed: boolean } {
  const parsed = resData?.data || resData || {};
  const aiUsed = Boolean(resData?.aiUsed ?? parsed?.aiUsed);
  const isBulkMode = Boolean(options?.uniqueFallbackEmail);
  const skillsText = Array.isArray(parsed.skills)
    ? parsed.skills.map((s: unknown) => cleanParsedField(s)).filter(Boolean).join(', ')
    : cleanParsedField(parsed.skillset || parsed.skills);
  const extractedTitle = cleanParsedField(parsed.current_title || parsed.currentTitle);
  const extractedName =
    cleanCandidatePersonName(parsed.full_name || parsed.fullName, extractedTitle) ||
    inferPersonNameFromFileName(file.name, extractedTitle);
  const baseName =
    file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Uploaded Candidate';
  const emailSlug =
    (extractedName || baseName)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '.')
      .replace(/^\.+|\.+$/g, '') || 'candidate';
  const extractedEmail = cleanParsedField(parsed.email);
  const resolvedEmail =
    extractedEmail ||
    (isBulkMode ? `${emailSlug}.${Date.now()}${options?.batchIndex ?? 0}@no-email.local` : '');
  const rawRate = cleanParsedField(parsed.hourly_rate || parsed.hourlyRate);

  return {
    aiUsed,
    profile: {
      fullName: extractedName || (isBulkMode ? baseName : ''),
      phone: cleanParsedField(parsed.phone),
      email: resolvedEmail,
      workAuth: normalizeWorkAuth(cleanParsedField(parsed.work_auth || parsed.workAuth)),
      education: cleanParsedField(parsed.education),
      currentTitle: extractedTitle,
      skillset: skillsText,
      hourlyRate: rawRate ? formatRateDisplay(rawRate, currencySymbol) : '',
      relocation: normalizeRelocation(cleanParsedField(parsed.relocation)),
      recruiter: options?.defaultRecruiter?.trim() || cleanParsedField(parsed.recruiter) || '',
      fileName: file.name,
      rawSnippet:
        parsed.raw_text_snippet ||
        parsed.rawSnippet ||
        `Document text extracted from: ${file.name}`,
      professionalSummary: cleanParsedField(
        parsed.professionalSummary || parsed.professional_summary
      ),
    },
  };
}

export function buildCandidateSavePayload(
  profile: ResumeProfileDraft,
  fallbackResumeName: string
) {
  return {
    fullName: profile.fullName.trim(),
    email: profile.email.trim(),
    phone: profile.phone,
    currentTitle: profile.currentTitle,
    workAuth: profile.workAuth,
    education: profile.education,
    skillset: profile.skillset,
    hourlyRateDisplay: profile.hourlyRate,
    relocation: profile.relocation,
    resumeFileName: fallbackResumeName,
    resumeFormat: inferResumeFormat(fallbackResumeName),
    assignedRecruiter: profile.recruiter || undefined,
    rawSnippet: profile.rawSnippet,
  };
}
