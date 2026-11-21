import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Eraser,
  FileText,
  FileUp,
  Info,
  Loader2,
  Plus,
  X,
} from 'lucide-react';
import { apiClient } from '../../config/api.config';
import { Client, Requirement, User } from '../../types';
import { useCurrency } from '../../utils/currency';
import { useAiCapabilities } from '../../utils/workspaceBrand';
import { mapRequirementFromApi } from '../../utils/entityMappers';
import { MULTI_INDUSTRY_SKILLS_TAXONOMY } from '../../utils/skillsTaxonomy';
import { buildClientSafeSummaryHtml } from '../../utils/richText';
import { formatMissingFieldsMessage, getMissingFieldLabels } from '../../utils/formValidation';
import { SearchableSelectInput } from '../../components/shared/SearchableSelectInput';
import { CustomSelect } from '../../components/shared/CustomSelect';
import { RoleSummaryField } from '../../components/shared/RichTextEditor';
import { DetailBreadcrumb } from '../../components/shared/DetailPageShell';
import { PageHeader } from '../../components/shared/PageHeader';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { AiBadge, AiIcon } from '../../components/shared/AiBrand';
import { ActionButton } from '../../components/shared/ActionButton';
import { UnsavedChangesModal, useFormShortcuts } from '../../hooks/useFormShortcuts';

const PLACEHOLDER_FIELD_RE =
  /^(?:not\s+(?:explicitly\s+)?(?:specified|mentioned|provided|stated|disclosed|available|found|given|listed|known|applicable|included)(?:\s+in\s+(?:the\s+)?(?:email|message|thread|resume|cv|document)(?:\s+body)?)?|unspecified|none|n\/?a|unknown|unk|tbd|tba|to\s+be\s+(?:determined|confirmed)|missing|pending(?:\s+confirmation)?|blank|empty|nil|null|undisclosed)$/i;

const cleanField = (val?: unknown) => {
  const cleaned = String(val || '')
    .replace(/\*+/g, '')
    .replace(/[_`~]+/g, '')
    .replace(/^[\s:•\-–—]+|[\s*]+$/g, '')
    .trim();
  const unwrapped = cleaned.replace(/^["'\[\]()<>]+|["'\[\]()<>.:;]+$/g, '').trim();
  if (!cleaned || !unwrapped || PLACEHOLDER_FIELD_RE.test(unwrapped)) {
    return '';
  }
  return cleaned;
};

const cleanNotes = (val?: unknown) => {
  const cleaned = cleanField(val);
  if (!cleaned) return '';
  return cleaned.replace(
    /\b(?:were|was|are|is)?\s*not\s+(?:explicitly\s+)?specified(?:\s+in\s+(?:the\s+)?email(?:\s+body)?)?\s*:?/gi,
    'Missing in email:'
  );
};

const stripClientLocation = (name?: string) =>
  String(name || '')
    .replace(/\s+Location:\s*.*$/i, '')
    .trim();

const INLINE_DESIGNATION_HINT_RE =
  /\b(?:manager|director|lead|head|vp|vice\s+president|president|chief|officer|ceo|cto|cfo|cio|coo|partner|principal|architect|recruiter|coordinator|specialist|supervisor|executive|owner|founder|delivery|account|hiring|talent|acquisition|staffing|operations|practice|program|project|hr|vendor)\b/i;

const splitInlineContactDesignation = (rawContact: unknown, rawTitle: unknown) => {
  let contact = cleanField(rawContact).replace(/<[^>]*@[^>]*>/g, '').trim();
  const explicitTitle = cleanField(rawTitle);
  let inferredTitle = '';

  const delimMatch = contact.match(
    /^([A-Za-z][A-Za-z.'-]*(?:\s+[A-Za-z.'-]+){0,3})\s*(?:,\s*|\s+[-–—|]\s+)\s*(.+)$/
  );
  if (delimMatch) {
    const left = cleanField(delimMatch[1]);
    const rhs = cleanField(delimMatch[2]);
    if (left && rhs && INLINE_DESIGNATION_HINT_RE.test(rhs)) {
      contact = left;
      inferredTitle = rhs;
    }
  }

  return {
    clientContact: contact,
    clientContactTitle: explicitTitle || inferredTitle,
  };
};

const resolveClientContactFields = (
  rawContact: string,
  rawTitle: string,
  matchedClient?: Client
) => {
  const split = splitInlineContactDesignation(rawContact, rawTitle);
  if (!matchedClient?.contacts?.length) {
    return split;
  }

  if (split.clientContact) {
    const exactSavedContact = matchedClient.contacts.find(
      (c) => cleanField(c.name).toLowerCase() === split.clientContact.toLowerCase()
    );
    return {
      clientContact: split.clientContact,
      clientContactTitle:
        split.clientContactTitle ||
        (exactSavedContact ? cleanField(exactSavedContact.designation) : ''),
    };
  }

  const primaryContact = matchedClient.contacts[0];
  return {
    clientContact: cleanField(primaryContact?.name),
    clientContactTitle: split.clientContactTitle || cleanField(primaryContact?.designation),
  };
};

const buildFormMissingNotes = (
  fields: {
    companyName: string;
    opportunityTitle: string;
    clientContact: string;
    clientContactTitle: string;
    clientContactEmail: string;
    location: string;
    targetBillRate: number;
    targetPayRate: number;
    skillsRequired: string;
  },
  backendNotes?: unknown
): string => {
  const missing: string[] = [];
  if (!fields.companyName.trim()) missing.push('Target Company');
  if (!fields.opportunityTitle.trim()) missing.push('Job Title');
  if (!fields.clientContact.trim()) missing.push('Client Contact Name');
  if (!fields.clientContactTitle.trim()) missing.push('Contact Designation');
  if (!fields.clientContactEmail.trim()) missing.push('Contact Email');
  if (!fields.location.trim()) missing.push('Location');
  if (!(Number(fields.targetBillRate) > 0)) missing.push('Bill Rate');
  if (!(Number(fields.targetPayRate) > 0)) missing.push('Pay Rate');
  if (!fields.skillsRequired.trim()) missing.push('Required Skillset');

  const multiRoleMatch = cleanNotes(backendNotes).match(
    /(Multiple itemized roles found \([^)]+\); extracted Role #1\.)/
  );
  const base =
    missing.length > 0
      ? `Missing: ${missing.join(', ')}.`
      : 'All form fields detected from source.';
  return multiRoleMatch?.[1] ? `${base} ${multiRoleMatch[1]}` : base;
};

const normalizeCompanyKey = (name?: string) =>
  stripClientLocation(name)
    .toLowerCase()
    .replace(/[.,]+/g, ' ')
    .replace(/\b(incorporated|inc|llc|ltd|limited|corp|corporation|co)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const findMatchingClient = (
  rawCompany: string,
  clientsList: Client[],
  rawEmail?: string
): Client | undefined => {
  const clean = stripClientLocation(rawCompany);
  if (clean) {
    const exactLower = clean.toLowerCase();
    const exact = clientsList.find(
      (c) => stripClientLocation(c.name).toLowerCase() === exactLower
    );
    if (exact) return exact;

    const normKey = normalizeCompanyKey(clean);
    if (normKey) {
      const normMatches = clientsList.filter(
        (c) => normalizeCompanyKey(c.name) === normKey
      );
      if (normMatches.length === 1) return normMatches[0];

      if (normKey.length >= 3) {
        const prefixMatches = clientsList.filter((c) => {
          const ck = normalizeCompanyKey(c.name);
          return ck.length >= 3 && (ck.startsWith(normKey) || normKey.startsWith(ck));
        });
        if (prefixMatches.length === 1) return prefixMatches[0];
      }
    }
  }

  if (!clean && rawEmail) {
    const emailLower = rawEmail.toLowerCase();
    const mentioned = clientsList.filter((c) => {
      const label = stripClientLocation(c.name).toLowerCase();
      if (label.length < 3) return false;
      const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`\\b${escaped}\\b`, 'i').test(emailLower);
    });
    if (mentioned.length === 1) return mentioned[0];
  }

  return undefined;
};

interface RequirementFromEmailPageProps {
  clients?: Client[];
  users?: User[];
  backLabel?: string;
  onBack: () => void;
  onApprove: (req: Requirement) => void;
  showToast: (title: string, message: string, icon?: string) => void;
}

const EMPTY_FORM = {
  companyName: '',
  opportunityTitle: '',
  openPositions: '1',
  location: '',
  workModel: 'Remote' as 'Remote' | 'Hybrid' | 'Onsite',
  clientContact: '',
  clientContactTitle: '',
  clientContactEmail: '',
  skillsRequired: '',
  assignedRecruiter: '',
  initialStage: 'Requirement' as 'Requirement' | 'Submitted' | 'Interview',
  targetBillRate: 0,
  targetPayRate: 0,
  missingNotes: '',
  publicDescription: '',
};

/**
 * Dedicated full-page email-to-requisition workspace (/requirements/from-email).
 */
export const RequirementFromEmailPage: React.FC<RequirementFromEmailPageProps> = ({
  clients = [],
  users = [],
  backLabel = 'Back to Pipeline',
  onBack,
  onApprove,
  showToast,
}) => {
  const { symbol: currencySymbol } = useCurrency();
  const aiCapabilities = useAiCapabilities();
  const [isParsing, setIsParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState<number>(0);
  const [parseStageLabel, setParseStageLabel] = useState<string>('');
  const [hasParsed, setHasParsed] = useState(false);
  const [aiUsed, setAiUsed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [rawEmailText, setRawEmailText] = useState<string>('');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isDragOverFile, setIsDragOverFile] = useState(false);
  const [skillInput, setSkillInput] = useState<string>('');
  const [showSkillSuggestions, setShowSkillSuggestions] = useState(false);
  const [highlightedSkillIdx, setHighlightedSkillIdx] = useState<number>(-1);
  const [extractedReq, setExtractedReq] = useState(EMPTY_FORM);
  const lastParsedTextRef = useRef<string>('');
  const parseTimersRef = useRef<number[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const clientsRef = useRef<Client[]>(clients);
  clientsRef.current = clients;

  const clearParseTimers = () => {
    parseTimersRef.current.forEach((id) => window.clearTimeout(id));
    parseTimersRef.current = [];
  };

  useEffect(() => () => clearParseTimers(), []);

  const startParseProgress = (source: 'file' | 'text') => {
    clearParseTimers();
    setParseProgress(source === 'file' ? 18 : 28);
    setParseStageLabel(
      source === 'file'
        ? 'Uploading & reading document text...'
        : 'Analyzing source text & detecting entities...'
    );
    parseTimersRef.current.push(
      window.setTimeout(() => {
        setParseProgress((prev) => (prev < 58 ? 58 : prev));
        setParseStageLabel('Extracting role, contact, rates & required skills...');
      }, 320),
      window.setTimeout(() => {
        setParseProgress((prev) => (prev < 86 ? 86 : prev));
        setParseStageLabel('Refining fields & generating client-safe summary...');
      }, 950)
    );
  };

  const finishParseProgress = (ok: boolean) => {
    clearParseTimers();
    if (ok) {
      setParseProgress(100);
      setParseStageLabel('Extraction complete');
      parseTimersRef.current.push(
        window.setTimeout(() => {
          setParseProgress(0);
          setParseStageLabel('');
        }, 3000)
      );
    } else {
      setParseProgress(0);
      setParseStageLabel('');
    }
  };

  const applyParsedRequirement = (
    d: Record<string, any>,
    usedAi: boolean,
    cleanInput: string
  ) => {
    const parsedSkills = cleanField(
      d.skillsRequired || (Array.isArray(d.skills) ? d.skills.join(', ') : d.skills)
    );
    const parsedBillRate = Number(d.billRate || d.targetBillRate || 0);
    const parsedPayRate = Number(
      d.payRate ||
      d.targetPayRate ||
      (parsedBillRate > 0 ? Math.round(parsedBillRate * 0.75) : 0)
    );
    const rawWorkModel = String(d.workModel || d.location || '').toLowerCase();
    const detectedWorkModel: 'Remote' | 'Hybrid' | 'Onsite' = rawWorkModel.includes('hybrid')
      ? 'Hybrid'
      : rawWorkModel.includes('onsite')
        ? 'Onsite'
        : 'Remote';
    const parsedCompany = stripClientLocation(cleanField(d.companyName || d.clientName));
    const matchedClient = findMatchingClient(parsedCompany, clientsRef.current, cleanInput);
    const resolvedCompany = matchedClient
      ? stripClientLocation(matchedClient.name)
      : parsedCompany;

    setExtractedReq((prev) => {
      const nextLocation = cleanField(d.location) || matchedClient?.location || '';
      const contactFields = resolveClientContactFields(
        cleanField(d.clientContact || d.contactName),
        cleanField(d.clientContactTitle || d.contactTitle),
        matchedClient
      );
      const resolvedLoc =
        nextLocation === 'Remote' && matchedClient?.location
          ? matchedClient.location
          : nextLocation;
      const resolvedTitle = cleanField(d.opportunityTitle || d.jobTitle) || '';
      const resolvedEmail = cleanField(d.clientContactEmail) || '';
      const resolvedSkills = parsedSkills || '';
      const rawBackendNotes = Array.isArray(d.missingFields)
        ? d.missingFields.map((item: unknown) => cleanField(item)).filter(Boolean).join(', ')
        : cleanNotes(d.missingNotes);
      return {
        ...prev,
        companyName: resolvedCompany || '',
        opportunityTitle: resolvedTitle,
        openPositions: d.openPositions ? String(d.openPositions) : '1',
        location: resolvedLoc,
        workModel: detectedWorkModel,
        clientContact: contactFields.clientContact,
        clientContactTitle: contactFields.clientContactTitle,
        clientContactEmail: resolvedEmail,
        skillsRequired: resolvedSkills,
        assignedRecruiter:
          cleanField(d.assignedRecruiter) || prev.assignedRecruiter || users[0]?.name || '',
        targetBillRate: parsedBillRate,
        targetPayRate: parsedPayRate,
        missingNotes: buildFormMissingNotes(
          {
            companyName: resolvedCompany || '',
            opportunityTitle: resolvedTitle,
            clientContact: contactFields.clientContact,
            clientContactTitle: contactFields.clientContactTitle,
            clientContactEmail: resolvedEmail,
            location: resolvedLoc,
            targetBillRate: parsedBillRate,
            targetPayRate: parsedPayRate,
            skillsRequired: resolvedSkills,
          },
          rawBackendNotes
        ),
        publicDescription:
          String(d.publicDescription || '').trim() ||
          buildClientSafeSummaryHtml({
            opportunityTitle: resolvedTitle || 'Technical Specialist',
            openPositions: d.openPositions ? Number(d.openPositions) : 1,
            workModel: detectedWorkModel,
            location: resolvedLoc,
            skillsRequired: resolvedSkills,
            companyName: resolvedCompany || '',
            rawEmailText: cleanInput,
          }),
      };
    });
    setAiUsed(usedAi);
    setHasParsed(true);
  };

  const parseEmailText = async (textToParse: string, force = false) => {
    const cleanInput = textToParse.trim();
    if (!cleanInput) return;
    if (!force && cleanInput === lastParsedTextRef.current) return;
    lastParsedTextRef.current = cleanInput;
    setIsParsing(true);
    setAiUsed(false);
    setValidationAttempted(false);
    startParseProgress('text');
    let parsedOk = false;
    try {
      const res = await apiClient.post('/parse-email', { rawEmailText: cleanInput });
      const d = res.data?.data?.data || res.data?.data;
      if (d) {
        applyParsedRequirement(d, Boolean(res.data?.aiUsed ?? d?.aiUsed), cleanInput);
        parsedOk = true;
      }
    } catch (err: any) {
      setAiUsed(false);
      showToast(
        'Extraction Issue',
        err.response?.data?.message ||
          'We could not extract all fields automatically right now. Please try again or review the fields manually.',
        'error'
      );
    } finally {
      finishParseProgress(parsedOk);
      setIsParsing(false);
    }
  };

  const handleRequirementFileSelected = async (file?: File | null) => {
    if (!file) return;
    const validExt = /\.(pdf|docx?|txt|rtf|eml)$/i;
    const isAllowedMime =
      file.type === 'application/pdf' ||
      file.type === 'text/plain' ||
      file.type === 'message/rfc822' ||
      file.type === 'application/rtf' ||
      file.type === 'text/rtf' ||
      file.type.includes('wordprocessingml') ||
      file.type === 'application/msword';
    if (!validExt.test(file.name) && !isAllowedMime) {
      showToast(
        'Unsupported File',
        'Please upload a PDF, DOCX, DOC, TXT, RTF, or EML file.',
        'warning'
      );
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      showToast('File Too Large', 'Requirement document exceeds the 15 MB limit.', 'warning');
      return;
    }

    setIsParsing(true);
    setAiUsed(false);
    setValidationAttempted(false);
    startParseProgress('file');
    let parsedOk = false;
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiClient.post('/parse-email-file', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const extractedText = String(res.data?.extractedText || '').trim();
      const d = res.data?.data?.data || res.data?.data;
      if (extractedText) {
        // Record parsed text before updating rawEmailText so the debounce effect avoids a duplicate call
        lastParsedTextRef.current = extractedText;
        setRawEmailText(extractedText);
      }
      setUploadedFileName(res.data?.fileName || file.name);
      if (d) {
        applyParsedRequirement(
          d,
          Boolean(res.data?.aiUsed ?? d?.aiUsed),
          extractedText || rawEmailText.trim()
        );
      }
      parsedOk = true;
      showToast(
        'Document Extracted',
        `Loaded and parsed fields from "${res.data?.fileName || file.name}".`,
        'success'
      );
    } catch (err: any) {
      setAiUsed(false);
      showToast(
        'Could Not Read File',
        err.response?.data?.message ||
          'We could not extract text from that document. Try another PDF/DOCX or paste the text directly.',
        'error'
      );
    } finally {
      finishParseProgress(parsedOk);
      setIsParsing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Auto-resolve extracted client details when clients finish hydrating
  useEffect(() => {
    if (!hasParsed || clients.length === 0) return;
    setExtractedReq((prev) => {
      const matched = findMatchingClient(prev.companyName, clients, rawEmailText);
      if (!matched) return prev;
      const canonicalName = stripClientLocation(matched.name);
      const resolvedContact = resolveClientContactFields(
        prev.clientContact,
        prev.clientContactTitle,
        matched
      );
      const nextContact = resolvedContact.clientContact;
      const nextTitle = resolvedContact.clientContactTitle;
      const nextLoc =
        (!prev.location || prev.location === 'Remote') && matched.location
          ? matched.location
          : prev.location;
      if (
        canonicalName === prev.companyName &&
        nextContact === prev.clientContact &&
        nextTitle === prev.clientContactTitle &&
        nextLoc === prev.location
      ) {
        return prev;
      }
      return {
        ...prev,
        companyName: canonicalName,
        clientContact: nextContact,
        clientContactTitle: nextTitle,
        location: nextLoc,
        missingNotes: buildFormMissingNotes(
          {
            companyName: canonicalName,
            opportunityTitle: prev.opportunityTitle,
            clientContact: nextContact,
            clientContactTitle: nextTitle,
            clientContactEmail: prev.clientContactEmail,
            location: nextLoc,
            targetBillRate: prev.targetBillRate,
            targetPayRate: prev.targetPayRate,
            skillsRequired: prev.skillsRequired,
          },
          prev.missingNotes
        ),
      };
    });
  }, [clients, hasParsed, rawEmailText]);

  useEffect(() => {
    const trimmed = rawEmailText.trim();
    if (trimmed.length <= 20) {
      setHasParsed(false);
      setAiUsed(false);
      if (!trimmed) {
        clearParseTimers();
        setParseProgress(0);
        setParseStageLabel('');
        lastParsedTextRef.current = '';
        setExtractedReq(EMPTY_FORM);
      }
      return;
    }
    const timer = setTimeout(() => {
      parseEmailText(trimmed);
    }, 350);
    return () => clearTimeout(timer);
  }, [rawEmailText]);

  const handleClearAll = () => {
    clearParseTimers();
    setRawEmailText('');
    setUploadedFileName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setSkillInput('');
    setHasParsed(false);
    setAiUsed(false);
    setIsParsing(false);
    setParseProgress(0);
    setParseStageLabel('');
    setValidationAttempted(false);
    lastParsedTextRef.current = '';
    setExtractedReq(EMPTY_FORM);
  };

  const skillTags = extractedReq.skillsRequired
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const selectedSkillSet = new Set(skillTags.map((t) => t.toLowerCase()));
  const skillQuery = skillInput.trim().toLowerCase();
  const skillSuggestions = useMemo(() => {
    const available = MULTI_INDUSTRY_SKILLS_TAXONOMY.filter(
      (s) => !selectedSkillSet.has(s.toLowerCase())
    );
    if (!skillQuery) return available.slice(0, 12);
    const startsWith: string[] = [];
    const contains: string[] = [];
    for (const s of available) {
      const lower = s.toLowerCase();
      if (lower.startsWith(skillQuery)) startsWith.push(s);
      else if (lower.includes(skillQuery)) contains.push(s);
    }
    return [...startsWith, ...contains].slice(0, 12);
  }, [skillQuery, extractedReq.skillsRequired]);

  const mergeSkillTags = (existingCsv: string, rawToAdd: string): string => {
    const existing = existingCsv
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const additions = rawToAdd
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (additions.length === 0) return existing.join(', ');
    const seen = new Set(existing.map((t) => t.toLowerCase()));
    const merged = [...existing];
    for (const item of additions) {
      if (!seen.has(item.toLowerCase())) {
        seen.add(item.toLowerCase());
        merged.push(item);
      }
    }
    return merged.join(', ');
  };

  const handleAddSkillTag = (raw: string) => {
    if (!raw.trim()) return;
    setExtractedReq((prev) => ({
      ...prev,
      skillsRequired: mergeSkillTags(prev.skillsRequired, raw),
    }));
    setSkillInput('');
  };

  const handleRemoveSkillTag = (tagToRemove: string) => {
    const remaining = skillTags.filter((t) => t !== tagToRemove);
    setExtractedReq((prev) => ({ ...prev, skillsRequired: remaining.join(', ') }));
  };

  const marginSpread = Math.max(
    0,
    (Number(extractedReq.targetBillRate) || 0) - (Number(extractedReq.targetPayRate) || 0)
  );

  const capturedFieldCount = useMemo(() => {
    const checks = [
      Boolean(extractedReq.companyName.trim()),
      Boolean(extractedReq.opportunityTitle.trim()),
      Number(extractedReq.openPositions) >= 1,
      Boolean(extractedReq.clientContact.trim()),
      Boolean(extractedReq.clientContactTitle.trim()),
      Boolean(extractedReq.clientContactEmail.trim()),
      Boolean(extractedReq.location.trim()),
      Number(extractedReq.targetBillRate) > 0,
      Number(extractedReq.targetPayRate) > 0,
      Boolean(extractedReq.skillsRequired.trim()),
    ];
    return checks.filter(Boolean).length;
  }, [extractedReq]);

  const isCompanyMissing = !extractedReq.companyName.trim();
  const isTitleMissing = !extractedReq.opportunityTitle.trim();
  const openPosStr = String(extractedReq.openPositions || '').trim();
  const openPosNum = Number(openPosStr);
  const isOpenPosInvalid =
    !openPosStr ||
    !/^\d+$/.test(openPosStr) ||
    !Number.isInteger(openPosNum) ||
    openPosNum < 1 ||
    openPosNum > 1000;

  const showCompanyError = (hasParsed || validationAttempted) && isCompanyMissing;
  const showTitleError = (hasParsed || validationAttempted) && isTitleMissing;
  const showOpenPosError = (hasParsed || validationAttempted) && isOpenPosInvalid;

  const renderActionButtons = () => (
    <>
      {(rawEmailText || uploadedFileName || extractedReq.companyName) && (
        <button
          type="button"
          onClick={handleClearAll}
          disabled={isSaving || isParsing}
          className="h-8 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-[11px] font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <Eraser className="w-3.5 h-3.5" />
          <span>Clear</span>
        </button>
      )}
      <button
        type="button"
        onClick={() => guardNavigation(onBack)}
        disabled={isSaving}
        className="h-8 px-3.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-semibold cursor-pointer disabled:opacity-50"
      >
        Cancel
      </button>
      <ActionButton
        loading={isSaving}
        loadingText="Creating..."
        disabled={isParsing}
        onClick={handleApprove}
        icon={<Plus className="w-3.5 h-3.5" strokeWidth={2} />}
        className="h-8 px-4 rounded-lg bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white text-[11px] font-semibold cursor-pointer"
      >
        Create Requisition
      </ActionButton>
    </>
  );

  const handleApprove = async () => {
    const missingFields = getMissingFieldLabels([
      { label: 'Target Company', valid: !isCompanyMissing },
      { label: 'Job Title', valid: !isTitleMissing },
      { label: 'No. of Open Positions (at least 1)', valid: !isOpenPosInvalid },
    ]);

    if (missingFields.length > 0) {
      setValidationAttempted(true);
      showToast(
        'Validation Required',
        formatMissingFieldsMessage(missingFields, 'before creating the requisition'),
        'warning'
      );
      return;
    }

    setIsSaving(true);
    const resolvedLocation = extractedReq.location.trim() || extractedReq.workModel;
    const formattedLocation = resolvedLocation
      .toLowerCase()
      .includes(extractedReq.workModel.toLowerCase())
      ? resolvedLocation
      : `${resolvedLocation} (${extractedReq.workModel})`;

    const finalSkillsRequired = mergeSkillTags(extractedReq.skillsRequired, skillInput);

    let newReq: Requirement = {
      id: 'req_' + Date.now(),
      code: 'REQ-' + Math.floor(1004 + Math.random() * 50),
      companyName: extractedReq.companyName.trim(),
      opportunityTitle: extractedReq.opportunityTitle.trim(),
      openPositions: openPosNum,
      location: formattedLocation,
      clientContact: extractedReq.clientContact.trim(),
      clientContactTitle: extractedReq.clientContactTitle.trim(),
      skillsRequired: finalSkillsRequired,
      status: extractedReq.initialStage,
      assignedRecruiter: extractedReq.assignedRecruiter.trim(),
      targetBillRate: Number(extractedReq.targetBillRate) || 115,
      targetPayRate: Number(extractedReq.targetPayRate) || 85,
      publicDescription: extractedReq.publicDescription.trim() || null,
    };

    try {
      const res = await apiClient.post('/requirements', {
        companyName: newReq.companyName,
        opportunityTitle: newReq.opportunityTitle,
        openPositions: openPosNum,
        location: newReq.location,
        workModel: extractedReq.workModel.toUpperCase(),
        skillsRequired: newReq.skillsRequired,
        clientContact: newReq.clientContact,
        clientContactTitle: newReq.clientContactTitle,
        clientContactEmail: extractedReq.clientContactEmail.trim(),
        assignedRecruiter: newReq.assignedRecruiter,
        targetBillRate: newReq.targetBillRate,
        targetPayRate: newReq.targetPayRate,
        status: newReq.status,
        rawEmailText,
        publicDescription: extractedReq.publicDescription.trim() || null,
        missingNotes: extractedReq.missingNotes,
      });
      if (res.data?.data) {
        newReq = mapRequirementFromApi(res.data.data);
      }
      showToast(
        'Requirement Created',
        `${newReq.code} (${newReq.opportunityTitle}) saved to pipeline!`,
        'success'
      );
      onApprove(newReq);
    } catch (err: any) {
      showToast(
        'Save Failed',
        err.response?.data?.message || 'Could not save requisition. Please try again.',
        'error'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const isDirty = Boolean(
    rawEmailText.trim() ||
    extractedReq.opportunityTitle.trim() ||
    extractedReq.companyName.trim()
  );
  const { showLeaveModal, guardNavigation, confirmLeave, cancelLeave } = useFormShortcuts({
    isDirty,
    isSubmitting: isSaving || isParsing,
    onSubmit: () => handleApprove(),
  });

  return (
    <div className="max-w-7xl mx-auto px-1 sm:px-2 lg:px-4 space-y-5 pb-8 animate-fade-in">
      <DetailBreadcrumb
        backLabel={backLabel}
        onBack={() => guardNavigation(onBack)}
        title="Create Job from Client Email"
        codePill="From Email"
      />

      <PageHeader
        title="Create Job from Client Email or PDF"
        subtitle="Paste any hiring manager email or upload a requirement PDF on the left to populate client, role, skills, rates, and a client-safe public job description."
        badges={
          <>
            {aiCapabilities.enabled && (
              <AiBadge label="PipeAI Extractor" size="xs" />
            )}
            {marginSpread > 0 && (
              <StatusBadge
                tone="emerald"
                size="xs"
                label={`Est. Spread: +${currencySymbol}${marginSpread}/hr`}
                className="tabular-nums"
              />
            )}
          </>
        }
        actions={renderActionButtons()}
      />

      {(isParsing || (hasParsed && parseProgress > 0)) && (
        <div
          className={`rounded-xl border px-4 py-2.5 space-y-1.5 transition-colors ${
            isParsing
              ? 'bg-brand-50/90 border-brand-200 text-brand-900'
              : 'bg-white border-slate-200/90 text-slate-700 card-shadow'
          }`}
        >
          <div className="flex items-center justify-between gap-2 text-xs font-semibold">
            <span className="flex items-center gap-2 min-w-0">
              {isParsing ? (
                <Loader2 className="w-3.5 h-3.5 text-brand-600 animate-spin shrink-0" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              )}
              <span className="truncate">
                {isParsing
                  ? parseStageLabel || 'Extracting requirement details...'
                  : `Extraction complete · ${capturedFieldCount}/10 form fields detected`}
              </span>
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] font-semibold tabular-nums text-slate-600">
                {parseProgress}%
              </span>
              {!isParsing && (
                <button
                  type="button"
                  onClick={() => {
                    clearParseTimers();
                    setParseProgress(0);
                    setParseStageLabel('');
                  }}
                  title="Dismiss"
                  aria-label="Dismiss extraction progress banner"
                  className="p-0.5 text-slate-400 hover:text-slate-600 rounded cursor-pointer transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
          <div
            role="progressbar"
            aria-valuenow={parseProgress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Email and PDF extraction progress"
            className={`w-full h-1.5 rounded-full overflow-hidden ${
              isParsing ? 'bg-brand-200/80' : 'bg-slate-100'
            }`}
          >
            <div
              className={`h-full transition-all duration-300 ${
                isParsing ? 'bg-brand-600' : 'bg-emerald-500'
              }`}
              style={{ width: `${parseProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Main 12-Column Split Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Raw Email Input & PDF Upload */}
        <div
          onDragOver={(e) => {
            if (e.dataTransfer?.types?.includes('Files')) {
              e.preventDefault();
              setIsDragOverFile(true);
            }
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              setIsDragOverFile(false);
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOverFile(false);
            const dropped = e.dataTransfer?.files?.[0];
            if (dropped) {
              handleRequirementFileSelected(dropped);
            }
          }}
          className={`lg:col-span-5 bg-white rounded-xl border p-5 card-shadow space-y-3 lg:sticky lg:top-4 transition-colors ${isDragOverFile
            ? 'border-brand-600 ring-2 ring-brand-500/15 bg-brand-50/15'
            : 'border-slate-200/90'
            }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt,.rtf,.eml,application/pdf,text/plain"
            onChange={(e) => handleRequirementFileSelected(e.target.files?.[0])}
            className="hidden"
          />

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <label className="text-sm font-semibold text-slate-900 inline-flex items-center gap-1.5">
              <AiIcon className="w-3.5 h-3.5 text-teal-600 shrink-0" />
              <span>Client email / PDF source</span>
            </label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {isParsing ? (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-brand-600">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Extracting fields...</span>
                </span>
              ) : hasParsed ? (
                <StatusBadge tone="emerald" size="xs" label="Parsed" />
              ) : null}
              {rawEmailText.trim().length > 20 && (
                <button
                  type="button"
                  disabled={isParsing || isSaving}
                  onClick={() => parseEmailText(rawEmailText, true)}
                  className="h-7 px-2.5 rounded-lg border border-brand-200 bg-brand-50/70 hover:bg-brand-100/70 text-brand-700 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50 transition-colors"
                >
                  <AiIcon className="w-3 h-3 text-teal-600 shrink-0" />
                  <span>Re-run {aiCapabilities.enabled ? 'AI ' : ''}Extraction</span>
                </button>
              )}
              <button
                type="button"
                disabled={isParsing || isSaving}
                onClick={() => fileInputRef.current?.click()}
                className="h-7 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
              >
                <FileUp className="w-3.5 h-3.5 text-slate-500" />
                <span>{uploadedFileName ? 'Replace PDF' : 'Upload PDF'}</span>
              </button>
            </div>
          </div>

          {uploadedFileName ? (
            <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50/60">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white border border-slate-200/90 text-slate-700 text-[11px] font-medium min-w-0 leading-none">
                <FileText className="w-3 h-3 text-emerald-600 shrink-0" />
                <span className="truncate">{uploadedFileName}</span>
              </span>
              <button
                type="button"
                disabled={isParsing}
                onClick={() => {
                  setUploadedFileName(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                title="Detach file tag"
                aria-label="Detach uploaded filename"
                className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={isParsing || isSaving}
              onClick={() => fileInputRef.current?.click()}
              className="w-full px-3 py-2 rounded-lg border border-dashed border-slate-300 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-400 text-left flex items-center justify-between gap-2 text-[11px] text-slate-500 transition-colors cursor-pointer disabled:opacity-50"
            >
              <span className="truncate">
                Drop a JD or email PDF here, or{' '}
                <span className="font-semibold text-brand-700 underline underline-offset-2">
                  browse file
                </span>
              </span>
              <span className="text-[10px] text-slate-400 shrink-0">PDF, DOCX, TXT</span>
            </button>
          )}

          <textarea
            rows={17}
            value={rawEmailText}
            onChange={(e) => setRawEmailText(e.target.value)}
            onPaste={(e) => {
              const pasted = e.clipboardData?.getData('text');
              if (pasted && pasted.trim().length > 20) {
                setTimeout(() => parseEmailText(pasted), 50);
              }
            }}
            placeholder="Paste any hiring manager or vendor email here, or upload/drop a PDF above — parsing runs automatically..."
            className="w-full p-3.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-700 leading-relaxed focus:border-brand-600 focus:outline-none min-h-[340px]"
          />

          <div className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-0.5">
            <Info className="w-3.5 h-3.5 shrink-0" />
            <span>Pasting text or uploading a PDF automatically triggers extraction.</span>
          </div>
        </div>

        {/* Right Column: Structured Extracted Requirement Form */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200/90 p-5 card-shadow space-y-4 text-xs">
          <div className="flex items-center justify-between gap-2 flex-wrap border-b border-slate-100 pb-3">
            <div className="font-semibold text-slate-900 text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Extracted requirement details</span>
              {hasParsed && aiUsed && aiCapabilities.enabled && (
                <AiBadge label="PipeAI Extracted" size="xs" />
              )}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <span>Initial Stage:</span>
              <StatusBadge stage={extractedReq.initialStage} size="xs" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-medium text-slate-700">Target Company *</label>
                {showCompanyError && (
                  <span className="text-[11px] font-semibold text-rose-600">Required</span>
                )}
              </div>
              <SearchableSelectInput
                value={extractedReq.companyName}
                onChange={(val) => {
                  const selClient = clients.find(
                    (c) => stripClientLocation(c.name).toLowerCase() === val.trim().toLowerCase()
                  );
                  setExtractedReq((prev) => ({
                    ...prev,
                    companyName: val,
                    clientContact: prev.clientContact || selClient?.contacts?.[0]?.name || '',
                    clientContactTitle:
                      prev.clientContactTitle || selClient?.contacts?.[0]?.designation || '',
                    location:
                      (!prev.location || prev.location === 'Remote') && selClient?.location
                        ? selClient.location
                        : prev.location,
                  }));
                }}
                options={clients.map((c) => ({
                  id: c.id,
                  label: stripClientLocation(c.name),
                  sublabel: c.location,
                }))}
                placeholder="Select or type client company..."
                emptyLabel="No saved clients — type company name"
                newOptionBadge="Auto-saved on create"
                inputClassName={`w-full pl-2.5 pr-7 py-2 text-xs rounded-lg text-slate-800 font-bold focus:outline-none border ${showCompanyError
                  ? 'border-rose-500 bg-rose-50/30 ring-1 ring-rose-500/25 focus:border-rose-500'
                  : 'bg-white border-slate-200 focus:border-brand-600'
                  }`}
              />
              {extractedReq.companyName.trim() &&
                !clients.some(
                  (c) =>
                    stripClientLocation(c.name).toLowerCase() ===
                    extractedReq.companyName.trim().toLowerCase()
                ) && (
                  <div className="mt-1">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-700 bg-white border border-slate-200/90 px-2 py-0.5 rounded-full leading-none">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-600" />
                      New client (auto-saved on create)
                    </span>
                  </div>
                )}
            </div>

            <div>
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-medium text-slate-700">
                  Job / Opportunity Title *
                </label>
                {showTitleError && (
                  <span className="text-[11px] font-semibold text-rose-600">Required</span>
                )}
              </div>
              <input
                type="text"
                value={extractedReq.opportunityTitle}
                onChange={(e) =>
                  setExtractedReq({ ...extractedReq, opportunityTitle: e.target.value })
                }
                placeholder="e.g. Senior Java Architect"
                className={`mt-0.5 w-full px-3 py-2 text-xs border rounded-lg text-slate-800 font-semibold focus:outline-none ${showTitleError
                  ? 'border-rose-500 bg-rose-50/30 ring-1 ring-rose-500/25 focus:border-rose-500'
                  : 'bg-white border-slate-200 focus:border-brand-600'
                  }`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="text-xs font-medium text-slate-700">
                Client Contact Name
              </label>
              <input
                type="text"
                value={extractedReq.clientContact}
                onChange={(e) =>
                  setExtractedReq({ ...extractedReq, clientContact: e.target.value })
                }
                placeholder="e.g. Rachel Adams"
                className="mt-0.5 w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:border-brand-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700">
                Contact Designation
              </label>
              <input
                type="text"
                value={extractedReq.clientContactTitle}
                onChange={(e) =>
                  setExtractedReq({ ...extractedReq, clientContactTitle: e.target.value })
                }
                placeholder="e.g. VP of Engineering"
                className="mt-0.5 w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:border-brand-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700">
                Contact Email
              </label>
              <input
                type="email"
                value={extractedReq.clientContactEmail}
                onChange={(e) =>
                  setExtractedReq({ ...extractedReq, clientContactEmail: e.target.value })
                }
                placeholder="rachel@client.com"
                className="mt-0.5 w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:border-brand-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-medium text-slate-700">
                  Open Positions *
                </label>
                {showOpenPosError && (
                  <span className="text-[11px] font-semibold text-rose-600">Required</span>
                )}
              </div>
              <input
                type="number"
                min={1}
                max={1000}
                step={1}
                required
                value={extractedReq.openPositions}
                onChange={(e) =>
                  setExtractedReq({ ...extractedReq, openPositions: e.target.value })
                }
                placeholder="e.g. 2"
                className={`mt-0.5 w-full px-3 py-2 text-xs border rounded-lg text-slate-800 font-semibold focus:outline-none ${showOpenPosError
                  ? 'border-rose-500 bg-rose-50/30 ring-1 ring-rose-500/25 focus:border-rose-500'
                  : !extractedReq.openPositions
                    ? 'border-amber-300 bg-amber-50/30 focus:border-brand-600'
                    : 'bg-white border-slate-200 focus:border-brand-600'
                  }`}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700">Location</label>
              <input
                type="text"
                value={extractedReq.location}
                onChange={(e) => setExtractedReq({ ...extractedReq, location: e.target.value })}
                placeholder="e.g. Austin, TX or Remote"
                className="mt-0.5 w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:border-brand-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700">Work Model</label>
              <div className="mt-0.5 grid grid-cols-3 bg-slate-50/90 p-0.5 rounded-lg border border-slate-200 gap-0.5">
                {(['Remote', 'Hybrid', 'Onsite'] as const).map((wm) => (
                  <button
                    type="button"
                    key={wm}
                    onClick={() => setExtractedReq({ ...extractedReq, workModel: wm })}
                    className={`h-7 rounded-md text-[11px] font-semibold border transition-all cursor-pointer ${extractedReq.workModel === wm
                      ? 'bg-white text-slate-900 border-slate-200/90'
                      : 'text-slate-500 border-transparent hover:text-slate-800'
                      }`}
                  >
                    {wm}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-700">
                Bill Rate ({currencySymbol}/hr)
              </label>
              <input
                type="number"
                min={0}
                value={extractedReq.targetBillRate || ''}
                onChange={(e) => {
                  const bill = Number(e.target.value) || 0;
                  setExtractedReq((prev) => ({
                    ...prev,
                    targetBillRate: bill,
                    targetPayRate:
                      prev.targetPayRate || (bill > 0 ? Math.round(bill * 0.75) : 0),
                  }));
                }}
                placeholder="120"
                className="mt-0.5 w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:border-brand-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700">
                Pay Rate ({currencySymbol}/hr)
              </label>
              <input
                type="number"
                min={0}
                value={extractedReq.targetPayRate || ''}
                onChange={(e) =>
                  setExtractedReq({ ...extractedReq, targetPayRate: Number(e.target.value) || 0 })
                }
                placeholder="90"
                className="mt-0.5 w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:border-brand-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700">
                Assigned Recruiter
              </label>
              <SearchableSelectInput
                value={extractedReq.assignedRecruiter}
                onChange={(val) =>
                  setExtractedReq({ ...extractedReq, assignedRecruiter: val })
                }
                options={users.map((u) => ({
                  id: u.id,
                  label: u.name,
                  sublabel: u.desk || u.role,
                }))}
                placeholder="Desk Owner"
                emptyLabel="No recruiters found"
                inputClassName="w-full pl-2.5 pr-7 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:border-brand-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700">
                Initial Stage
              </label>
              <CustomSelect
                value={extractedReq.initialStage}
                onChange={(val) => setExtractedReq({ ...extractedReq, initialStage: val as any })}
                ariaLabel="Initial Stage"
                size="sm"
                className="mt-0.5"
                options={['Requirement', 'Submitted', 'Interview']}
              />
            </div>
          </div>

          {/* Required Skillset with Interactive Chips */}
          <div>
            <label className="text-xs font-medium text-slate-700">
              Required Skillset
            </label>
            {skillTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1.5 mb-2">
                {skillTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-white border border-slate-200/90 text-slate-700 text-[11px] font-medium"
                  >
                    <span>{tag}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSkillTag(tag)}
                      aria-label={`Remove ${tag}`}
                      className="text-slate-400 hover:text-rose-600 cursor-pointer inline-flex items-center"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="relative flex gap-1.5">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={skillInput}
                  onFocus={() => setShowSkillSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSkillSuggestions(false), 120)}
                  onChange={(e) => {
                    setSkillInput(e.target.value);
                    setShowSkillSuggestions(true);
                    setHighlightedSkillIdx(-1);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown' && skillSuggestions.length > 0) {
                      e.preventDefault();
                      setShowSkillSuggestions(true);
                      setHighlightedSkillIdx((prev) => (prev + 1) % skillSuggestions.length);
                    } else if (e.key === 'ArrowUp' && skillSuggestions.length > 0) {
                      e.preventDefault();
                      setHighlightedSkillIdx((prev) =>
                        prev <= 0 ? skillSuggestions.length - 1 : prev - 1
                      );
                    } else if (e.key === 'Escape') {
                      setShowSkillSuggestions(false);
                      setHighlightedSkillIdx(-1);
                    } else if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault();
                      if (
                        e.key === 'Enter' &&
                        showSkillSuggestions &&
                        highlightedSkillIdx >= 0 &&
                        skillSuggestions[highlightedSkillIdx]
                      ) {
                        handleAddSkillTag(skillSuggestions[highlightedSkillIdx]);
                        setHighlightedSkillIdx(-1);
                      } else {
                        handleAddSkillTag(skillInput);
                      }
                    }
                  }}
                  placeholder="Type skill & press Enter (or pick from suggestions)..."
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:border-brand-600 focus:outline-none"
                />
                {showSkillSuggestions && skillSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 mt-1 z-30 bg-white border border-slate-200 rounded-xl popover-shadow p-2 max-h-48 overflow-y-auto">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1 pb-1.5">
                      Suggested Skills ({skillSuggestions.length})
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {skillSuggestions.map((suggestion, idx) => (
                        <button
                          key={suggestion}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleAddSkillTag(suggestion);
                            setHighlightedSkillIdx(-1);
                          }}
                          className={`px-2 py-1 rounded-md text-[11px] font-medium border transition-colors cursor-pointer ${idx === highlightedSkillIdx
                            ? 'bg-brand-50 text-brand-800 border-brand-300'
                            : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200/90'
                            }`}
                        >
                          + {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleAddSkillTag(skillInput)}
                className="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-700 cursor-pointer"
              >
                + Add
              </button>
            </div>
            <input
              type="text"
              value={extractedReq.skillsRequired}
              onChange={(e) =>
                setExtractedReq({ ...extractedReq, skillsRequired: e.target.value })
              }
              placeholder="Java, Spring Boot, Kafka, AWS..."
              className="mt-1.5 w-full px-3 py-1.5 text-[11px] bg-slate-50/70 border border-slate-200 rounded-lg text-slate-600 focus:bg-white focus:border-brand-600 focus:outline-none"
            />
          </div>

          <RoleSummaryField
            label="Role Scope & Public Summary (Candidate-Facing)"
            labelClassName="text-xs font-medium text-slate-700"
            value={extractedReq.publicDescription}
            onChange={(nextHtml) =>
              setExtractedReq((prev) => ({ ...prev, publicDescription: nextHtml }))
            }
            onAutoFill={() =>
              setExtractedReq((prev) => ({
                ...prev,
                publicDescription: buildClientSafeSummaryHtml({
                  opportunityTitle: prev.opportunityTitle || 'Technical Specialist',
                  openPositions: Number(prev.openPositions) || 1,
                  workModel: prev.workModel,
                  location: prev.location,
                  skillsRequired: prev.skillsRequired,
                  companyName: prev.companyName,
                  rawEmailText,
                }),
              }))
            }
            minHeight={130}
            maxHeight={300}
            placeholder="AI will draft a client-safe job overview & key responsibilities when you paste an email on the left..."
            helperText="Client-safe summary shown on public application links (never exposes client names, contacts, or rates)."
          />

          <div>
            <label className="text-xs font-medium text-slate-700">
              Extraction Notes / Missing Info
            </label>
            <input
              type="text"
              value={extractedReq.missingNotes}
              onChange={(e) => setExtractedReq({ ...extractedReq, missingNotes: e.target.value })}
              placeholder="Missing follow-up notes or client SLA instructions..."
              className="mt-1 w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 focus:border-brand-600 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="bg-white rounded-xl border border-slate-200/90 px-5 py-3.5 card-shadow flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-600 min-w-0">
          {isCompanyMissing || isTitleMissing || isOpenPosInvalid ? (
            <>
              <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
              <span className="truncate">
                {hasParsed
                  ? 'Review required fields (Target Company, Job Title, Open Positions) before creating.'
                  : 'Paste an email or upload a PDF on the left to extract requisition details.'}
              </span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="truncate text-slate-700">
                Ready to create requisition for{' '}
                <span className="font-semibold text-slate-900">
                  {extractedReq.opportunityTitle}
                </span>
                {extractedReq.companyName ? ` at ${extractedReq.companyName}` : ''}.
              </span>
            </>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 shrink-0">
          {renderActionButtons()}
        </div>
      </div>

      <UnsavedChangesModal
        isOpen={showLeaveModal}
        onConfirmLeave={confirmLeave}
        onCancelLeave={cancelLeave}
      />
    </div>
  );
};
