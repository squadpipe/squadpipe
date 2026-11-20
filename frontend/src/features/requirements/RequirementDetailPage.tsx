import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Copy,
  DollarSign,
  Eye,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Globe,
  Link2,
  Loader2,
  Mail,
  MapPin,
  MessageSquare,
  Pencil,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  UsersRound,
} from 'lucide-react';
import { AiIcon } from '../../components/shared/AiBrand';
import { apiClient } from '../../config/api.config';
import {
  ApplicationFormTemplate,
  BillablePlacement,
  Requirement,
  Candidate,
  RequirementSubmission,
  SubmissionNote,
} from '../../types';
import {
  DEFAULT_APPLICATION_FORMS,
  summarizeFormTemplateFields,
} from '../../utils/applicationForms';
import { useCurrency } from '../../utils/currency';
import { useAiCapabilities } from '../../utils/workspaceBrand';
import { useClientPagination } from '../../utils/usePagination';
import {
  extractRateSortValue,
  sortArrayByColumn,
  useTableSort,
} from '../../utils/tableSort';
import {
  formatDateTimeBadge,
  mapRequirementFromApi,
  mapSubmissionFromApi,
} from '../../utils/entityMappers';
import {
  buildApplicantStageOptions,
  getStageDotClass,
  getStageIndex,
} from '../../utils/stageStyles';
import { useMasterTaxonomies } from '../../components/shared/DynamicCustomFieldsSection';
import {
  DetailBreadcrumb,
  DetailExpandableSkillsBar,
  DetailTabItem,
  DetailUnderlineTabs,
} from '../../components/shared/DetailPageShell';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { MaskedValue } from '../../components/shared/MaskedValue';
import { ConfirmDeleteModal } from '../../components/shared/ConfirmDeleteModal';
import { SortableTableHeader } from '../../components/shared/SortableTableHeader';
import { TablePagination } from '../../components/shared/TablePagination';
import { CustomSelect } from '../../components/shared/CustomSelect';
import { AnimatedModal } from '../../components/shared/MotionPrimitives';
import { RichTextEditor } from '../../components/shared/RichTextEditor';
import { RichTextDisplay } from '../../components/shared/RichTextDisplay';
import { buildClientSafeSummaryHtml, isHtmlContent } from '../../utils/richText';
import { AttachBenchDrawer } from '../../components/modals/AttachBenchDrawer';
import { PreparePitchModal } from '../../components/modals/PreparePitchModal';
import {
  CapabilityFitModal,
  EditRequirementModal,
  RequirementNotesModal,
  getCapabilityBadgeStyle,
  hasEvaluatedFitScore,
} from './RequirementDetailModals';

interface RequirementDetailPageProps {
  requirement: Requirement | null;
  backLabel?: string;
  onBack: () => void;
  candidates: Candidate[];
  placements?: BillablePlacement[];
  rateMasked?: boolean;
  onAssignCandidate: (req: Requirement, candidate: Candidate) => void;
  onAttachCandidates?: (req: Requirement, candidateIds: string[]) => Promise<void> | void;
  onUpdateSubmissionStage?: (
    req: Requirement,
    submissionId: string,
    stage: RequirementSubmission['stage']
  ) => Promise<void> | void;
  onUpdateSubmissionNotes?: (
    req: Requirement,
    submissionId: string,
    payload: {
      interviewDate?: string | null;
      interviewNotes?: string | null;
      stage?: string;
      action?: 'add' | 'edit' | 'delete';
      noteId?: string;
      noteText?: string | null;
    }
  ) => Promise<void> | void;
  onDetachSubmission?: (req: Requirement, submissionId: string) => Promise<void> | void;
  onOpenResumePreview: (candidate: Candidate) => void;
  onSelectPlacement?: (placement: BillablePlacement) => void;
  onOpenPlacementWizard: (req: Requirement, candidate?: Candidate | null) => void;
  onEditReq?: (req: Requirement) => void;
  onUpdateReq?: (req: Requirement) => Promise<Requirement | void> | void;
  onRequirementUpdated?: (req: Requirement) => void;
  onOpenCsvImport?: (req: Requirement) => void;
  onOpenResumeParser?: (req: Requirement) => void;
  onPreviewApplicationForm?: (req: Requirement, templateId?: string) => void;
  benchPickerCloseToken?: number;
}

type ApplicantFilterTab = 'All' | 'Active' | 'Interview' | 'Selected' | 'Placed' | 'Closed';
type WorkspaceTab = 'applicants' | 'placed' | 'details';

function formatDisplayName(rawName?: string | null, fallback = 'Applicant'): string {
  return (
    String(rawName || '')
      .replace(/_+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || fallback
  );
}

function formatWorkModelLabel(raw?: string | null): string {
  const upper = String(raw || '').trim().toUpperCase();
  if (upper === 'REMOTE') return 'Remote';
  if (upper === 'HYBRID') return 'Hybrid';
  if (upper === 'ONSITE') return 'Onsite';
  return upper ? upper.charAt(0) + upper.slice(1).toLowerCase() : '';
}

function formatLocationDisplay(rawLocation?: string | null, workModelLabel?: string): string {
  const loc = String(rawLocation || '').trim();
  if (!loc) return 'Location TBD';
  if (!workModelLabel) return loc;
  const escaped = workModelLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const cleaned = loc
    .replace(new RegExp(`\\s*\\(${escaped}\\)\\s*$`, 'i'), '')
    .replace(/\s*\((?:onsite|on-site|hybrid|remote)\)\s*$/i, '')
    .trim();
  return cleaned || loc;
}

function formatClientContactDisplay(
  rawContact: Requirement['clientContact'],
  rawTitle?: Requirement['clientContactTitle']
): { name: string; title: string } {
  const rawNameStr =
    typeof rawContact === 'object' && rawContact !== null
      ? (rawContact as any).fullName || (rawContact as any).name || ''
      : String(rawContact || '');
  const explicitTitle =
    typeof rawTitle === 'object' && rawTitle !== null
      ? String((rawTitle as any).designation || '').trim()
      : String(rawTitle || '').trim();

  const trimmedName = rawNameStr.trim();
  if (!trimmedName) {
    return { name: 'Primary Hiring Lead', title: explicitTitle };
  }

  // Strip duplicated trailing designation if it matches explicitTitle (e.g. "Name, Senior Director")
  if (explicitTitle) {
    const escaped = explicitTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const stripped = trimmedName
      .replace(new RegExp(`\\s*(?:,|\\||-)\\s*${escaped}\\s*$`, 'i'), '')
      .trim();
    return {
      name: stripped || trimmedName,
      title: explicitTitle,
    };
  }

  const sepMatch = trimmedName.match(/^([^,|]+?)\s*(?:,|\|)\s*(.{6,})$/);
  if (sepMatch && !/^(?:jr\.?|sr\.?|ii|iii|iv|phd|mba|pmp|cpa)$/i.test(sepMatch[2].trim())) {
    return {
      name: sepMatch[1].trim(),
      title: sepMatch[2].trim(),
    };
  }

  return {
    name: trimmedName,
    title: explicitTitle,
  };
}

function splitRateAndTerm(formatted: string): { amount: string; term: string } {
  const clean = formatted.trim();
  const parenMatch = clean.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (parenMatch) {
    return {
      amount: parenMatch[1].trim(),
      term: parenMatch[2].trim(),
    };
  }
  return { amount: clean, term: '' };
}

export const RequirementDetailPage: React.FC<RequirementDetailPageProps> = ({
  requirement,
  backLabel = 'Back to Pipeline',
  onBack,
  candidates,
  placements = [],
  rateMasked = false,
  onAssignCandidate,
  onAttachCandidates,
  onUpdateSubmissionStage,
  onUpdateSubmissionNotes,
  onDetachSubmission,
  onOpenResumePreview,
  onSelectPlacement,
  onOpenPlacementWizard,
  onEditReq,
  onUpdateReq,
  onRequirementUpdated,
  onOpenCsvImport,
  onOpenResumeParser,
  onPreviewApplicationForm,
  benchPickerCloseToken,
}) => {
  const { formatRate, symbol: currencySymbol } = useCurrency();
  const aiCapabilities = useAiCapabilities();
  const taxonomies = useMasterTaxonomies(true);

  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>('applicants');
  const [applicantTab, setApplicantTab] = useState<ApplicantFilterTab>('All');
  const [applicantSearch, setApplicantSearch] = useState('');
  const applicantsSort = useTableSort<'applicant' | 'fitScore' | 'rate' | 'stage'>('fitScore', 'desc');
  const placedSort = useTableSort<'resourceName' | 'customer' | 'startDate' | 'billRate' | 'status'>();
  const [fitModalSubId, setFitModalSubId] = useState<string | null>(null);
  const [evaluatingSubId, setEvaluatingSubId] = useState<string | null>(null);
  const [pitchTargetSub, setPitchTargetSub] = useState<RequirementSubmission | null>(null);
  const [showBenchPicker, setShowBenchPicker] = useState(false);

  useEffect(() => {
    if (benchPickerCloseToken) {
      setShowBenchPicker(false);
    }
  }, [benchPickerCloseToken]);
  const [busySubId, setBusySubId] = useState<string | null>(null);
  const [subToDetach, setSubToDetach] = useState<{
    sub: RequirementSubmission;
    displayName: string;
  } | null>(null);
  const [editingNotesSub, setEditingNotesSub] = useState<RequirementSubmission | null>(null);
  const [notesModalMode, setNotesModalMode] = useState<'notes' | 'interview' | 'closed'>('notes');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [confirmDeleteNoteId, setConfirmDeleteNoteId] = useState<string | null>(null);
  const [busyNoteId, setBusyNoteId] = useState<string | null>(null);
  const [draftInterviewDate, setDraftInterviewDate] = useState('');
  const [draftNotesText, setDraftNotesText] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState<Requirement | null>(requirement);
  const [editOpenPositions, setEditOpenPositions] = useState<string>('1');
  const [editOpenPosError, setEditOpenPosError] = useState<string>('');
  const [hydratedReq, setHydratedReq] = useState<Requirement | null>(null);
  const [isUpdatingPublicForm, setIsUpdatingPublicForm] = useState(false);
  const [isEditingPublicDesc, setIsEditingPublicDesc] = useState(false);
  const [draftPublicDesc, setDraftPublicDesc] = useState('');
  const [copiedPublicLink, setCopiedPublicLink] = useState(false);
  const [publicFormError, setPublicFormError] = useState('');
  const [applicationForms, setApplicationForms] =
    useState<ApplicationFormTemplate[]>(DEFAULT_APPLICATION_FORMS);
  const knownCandidatesRef = useRef<Map<string, Candidate>>(new Map());
  const notesTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    for (const c of candidates) {
      if (c?.id) knownCandidatesRef.current.set(c.id, c);
    }
  }, [candidates]);

  useEffect(() => {
    setEditForm(requirement);
    setEditOpenPositions(requirement ? String(requirement.openPositions || 1) : '1');
    setEditOpenPosError('');
    setIsEditing(false);
    setWorkspaceTab('applicants');
    setApplicantTab('All');
    setApplicantSearch('');
    applicantsSort.resetSort();
    placedSort.resetSort();
    setFitModalSubId(null);
    setEvaluatingSubId(null);
    setPitchTargetSub(null);
    setShowBenchPicker(false);
    setSubToDetach(null);
    setConfirmDeleteNoteId(null);
    setEditingNotesSub(null);
    setEditingNoteId(null);
    setBusyNoteId(null);
    setDraftInterviewDate('');
    setDraftNotesText('');
    setIsEditingPublicDesc(false);
    setDraftPublicDesc(requirement?.publicDescription || '');
    setCopiedPublicLink(false);
    setPublicFormError('');
  }, [requirement?.id]);

  useEffect(() => {
    setHydratedReq(null);
  }, [requirement?.id]);

  useEffect(() => {
    if (!requirement?.id) return;
    const needsFullHydration =
      !Array.isArray(requirement.submissions) ||
      (requirement.submissions.length === 0 && (requirement.submissionCount ?? 0) > 0);
    const hasCustomSort = Boolean(applicantsSort.sort.sortBy);
    if (!needsFullHydration && !hasCustomSort) return;

    let active = true;
    apiClient
      .get(`/requirements/${requirement.id}`, {
        params: applicantsSort.sortParams,
      })
      .then((res) => {
        if (active && res.data?.success && res.data.data) {
          setHydratedReq(mapRequirementFromApi(res.data.data));
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [
    requirement?.id,
    applicantsSort.sort.sortBy,
    applicantsSort.sort.sortDir,
    applicantsSort.sortParams,
    requirement?.submissions?.length,
    requirement?.submissionCount,
  ]);

  useEffect(() => {
    if (requirement) {
      setEditForm(requirement);
    }
  }, [requirement]);

  const effectiveRequirement =
    hydratedReq && requirement && hydratedReq.id === requirement.id ? hydratedReq : requirement;

  useEffect(() => {
    let active = true;
    apiClient
      .get('/application-forms')
      .then((res) => {
        if (!active) return;
        if (res.data?.success && Array.isArray(res.data.data) && res.data.data.length > 0) {
          setApplicationForms(res.data.data);
        }
      })
      .catch(() => {
        // Fallback to default templates
      });
    return () => {
      active = false;
    };
  }, [workspaceTab]);

  const updatePublicFormConfig = async (payload: {
    enabled?: boolean;
    regenerateToken?: boolean;
    publicDescription?: string | null;
    publicFormTemplateId?: string | null;
  }) => {
    if (!effectiveRequirement || isUpdatingPublicForm) return;
    setIsUpdatingPublicForm(true);
    setPublicFormError('');
    try {
      const res = await apiClient.post(
        `/requirements/${effectiveRequirement.id}/public-form`,
        payload
      );
      if (res.data?.success && res.data.data) {
        const mapped = mapRequirementFromApi(res.data.data);
        setHydratedReq(mapped);
        onRequirementUpdated?.(mapped);
        setDraftPublicDesc(mapped.publicDescription || '');
        if (payload.publicDescription !== undefined) {
          setIsEditingPublicDesc(false);
        }
      }
    } catch (err: any) {
      setPublicFormError(
        err?.response?.data?.message || err?.message || 'Failed to update public form settings.'
      );
    } finally {
      setIsUpdatingPublicForm(false);
    }
  };

  const publicFormEnabled = Boolean(effectiveRequirement?.publicFormEnabled);
  const publicFormToken = effectiveRequirement?.publicFormToken || '';
  const publicShareUrl =
    publicFormToken && typeof window !== 'undefined'
      ? `${window.location.origin}/apply/${publicFormToken}`
      : '';

  const handleCopyPublicLink = async () => {
    if (!publicShareUrl) return;
    try {
      await navigator.clipboard.writeText(publicShareUrl);
      setCopiedPublicLink(true);
      setTimeout(() => setCopiedPublicLink(false), 2000);
    } catch {
      setPublicFormError('Could not copy link automatically. Copy it directly from the field.');
    }
  };

  const handleEvaluateSubmission = async (sub: RequirementSubmission) => {
    if (!effectiveRequirement || evaluatingSubId || sub.id.startsWith('legacy_')) return;
    setEvaluatingSubId(sub.id);
    try {
      const res = await apiClient.post(`/submissions/${sub.id}/evaluate`);
      if (res.data?.success && res.data.data) {
        const updatedSub = mapSubmissionFromApi(res.data.data);
        const currentSubs = Array.isArray(effectiveRequirement.submissions)
          ? effectiveRequirement.submissions
          : [];
        const nextSubs = currentSubs.map((item) =>
          item.id === updatedSub.id ? { ...item, ...updatedSub } : item
        );
        const updatedReq: Requirement = {
          ...effectiveRequirement,
          submissions: nextSubs,
        };
        setHydratedReq(updatedReq);
        onRequirementUpdated?.(updatedReq);
        setFitModalSubId(sub.id);
      }
    } catch {
      // Non-blocking for existing rows
    } finally {
      setEvaluatingSubId(null);
    }
  };

  const submissions = useMemo<RequirementSubmission[]>(() => {
    if (!effectiveRequirement) return [];
    if (Array.isArray(effectiveRequirement.submissions) && effectiveRequirement.submissions.length > 0) {
      return effectiveRequirement.submissions;
    }
    if (effectiveRequirement.resourceName) {
      const legacyCand = candidates.find(
        (c) => c.fullName.toLowerCase() === effectiveRequirement.resourceName!.toLowerCase()
      );
      return [
        {
          id: `legacy_${effectiveRequirement.id}`,
          candidateId: legacyCand?.id || '',
          fullName: effectiveRequirement.resourceName,
          currentTitle: legacyCand?.currentTitle,
          workAuth: legacyCand?.workAuth,
          hourlyRate: legacyCand?.hourlyRate,
          stage:
            effectiveRequirement.status === 'Requirement'
              ? 'Submitted'
              : effectiveRequirement.status,
          candidate: legacyCand,
        },
      ];
    }
    return [];
  }, [effectiveRequirement, candidates]);

  const openNotesEditor = (
    sub: RequirementSubmission,
    mode: 'notes' | 'interview' | 'closed' = 'notes',
    targetNote?: SubmissionNote | null
  ) => {
    setEditingNotesSub(sub);
    setConfirmDeleteNoteId(null);
    setNotesModalMode(mode);
    setDraftInterviewDate(sub.interviewDateTime || sub.interviewDate || '');
    if (targetNote) {
      setEditingNoteId(targetNote.id);
      setDraftNotesText(targetNote.text);
    } else {
      setEditingNoteId(null);
      setDraftNotesText('');
    }
  };

  const handleSaveSubmissionNotes = async () => {
    if (!requirement || !onUpdateSubmissionNotes || !editingNotesSub || isSavingNotes) return;
    const liveSub = submissions.find((s) => s.id === editingNotesSub.id) || editingNotesSub;
    const cleanText = draftNotesText.trim();
    const prevDate = liveSub.interviewDateTime || liveSub.interviewDate || '';
    const dateChanged = notesModalMode === 'interview' && draftInterviewDate !== prevDate;

    if ((notesModalMode === 'notes' || notesModalMode === 'closed' || editingNoteId) && !cleanText) {
      return;
    }
    if (!editingNoteId && !cleanText && !dateChanged) {
      setEditingNotesSub(null);
      return;
    }

    setIsSavingNotes(true);
    try {
      await onUpdateSubmissionNotes(requirement, liveSub.id, {
        ...(cleanText
          ? {
              action: editingNoteId ? 'edit' : 'add',
              ...(editingNoteId ? { noteId: editingNoteId } : {}),
              noteText: cleanText,
            }
          : {}),
        ...(dateChanged ? { interviewDate: draftInterviewDate || null } : {}),
      });
      setEditingNoteId(null);
      setDraftNotesText('');
      if (notesModalMode !== 'notes' || !cleanText) {
        setEditingNotesSub(null);
      }
    } catch {
      // Toast handled by parent caller
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleDeleteSubmissionNote = async (sub: RequirementSubmission, noteId: string) => {
    if (!requirement || !onUpdateSubmissionNotes || busyNoteId) return;
    setBusyNoteId(noteId);
    try {
      await onUpdateSubmissionNotes(requirement, sub.id, {
        action: 'delete',
        noteId,
      });
      setConfirmDeleteNoteId(null);
      if (editingNoteId === noteId) {
        setEditingNoteId(null);
        setDraftNotesText('');
      }
    } catch {
      // Toast handled by parent caller
    } finally {
      setBusyNoteId(null);
    }
  };

  const reqPlacementsSummary =
    effectiveRequirement?.activePlacements || requirement?.activePlacements || [];

  const linkedPlacements = useMemo<Array<BillablePlacement & { isSummaryOnly: boolean }>>(() => {
    const reqId = effectiveRequirement?.id || requirement?.id;
    const summaryIds = new Set(reqPlacementsSummary.map((p) => p.id));
    const matchedFull = placements.filter(
      (p) => (reqId && p.requirementId === reqId) || summaryIds.has(p.id)
    );
    const fullById = new Map(matchedFull.map((p) => [p.id, p]));
    const fallbackEntries = reqPlacementsSummary
      .filter((ap) => !fullById.has(ap.id))
      .map((ap) => ({
        id: ap.id,
        recruiter: '',
        deployment: 'Onshore',
        customer: effectiveRequirement?.companyName || requirement?.companyName || '',
        resourceName: ap.resourceName,
        phone: '',
        email: '',
        skillRole: effectiveRequirement?.opportunityTitle || requirement?.opportunityTitle || '',
        startDate: '',
        endDate: '',
        billing: '',
        status: (ap.status === 'ACTIVE' ? 'Active' : ap.status) as BillablePlacement['status'],
        candidateId: ap.candidateId || undefined,
        requirementId: reqId,
        isSummaryOnly: true,
      }));
    return [
      ...matchedFull.map((p) => ({ ...p, isSummaryOnly: false })),
      ...fallbackEntries,
    ];
  }, [
    placements,
    reqPlacementsSummary,
    effectiveRequirement?.id,
    requirement?.id,
    effectiveRequirement?.companyName,
    requirement?.companyName,
    effectiveRequirement?.opportunityTitle,
    requirement?.opportunityTitle,
  ]);

  const isPlacedApplicant = (sub: RequirementSubmission): boolean => {
    const nameLower = sub.fullName.trim().toLowerCase();
    return linkedPlacements.some(
      (p) =>
        p.status !== 'Terminated' &&
        p.status !== 'Completed' &&
        ((sub.candidateId && p.candidateId === sub.candidateId) ||
          p.resourceName.trim().toLowerCase() === nameLower)
    );
  };

  const activeApplicantsCount = submissions.filter(
    (s) => s.stage.trim().toLowerCase() !== 'closed'
  ).length;
  const interviewApplicantsCount = submissions.filter(
    (s) => s.stage.trim().toLowerCase() === 'interview'
  ).length;
  const selectedApplicantsCount = submissions.filter(
    (s) => s.stage.trim().toLowerCase() === 'selected'
  ).length;
  const placedApplicantsCount = submissions.filter(isPlacedApplicant).length;
  const closedApplicantsCount = submissions.length - activeApplicantsCount;
  const publicIntakeCount = submissions.filter((s) => s.intakeSource === 'PUBLIC_FORM').length;

  const filteredSubmissions = useMemo(() => {
    const filtered = submissions.filter((sub) => {
      const stageLower = sub.stage.trim().toLowerCase();
      if (applicantTab === 'Active' && stageLower === 'closed') return false;
      if (applicantTab === 'Interview' && stageLower !== 'interview') return false;
      if (applicantTab === 'Selected' && stageLower !== 'selected') return false;
      if (applicantTab === 'Placed' && !isPlacedApplicant(sub)) return false;
      if (applicantTab === 'Closed' && stageLower !== 'closed') return false;
      const q = applicantSearch.trim().toLowerCase();
      if (!q) return true;
      return (
        formatDisplayName(sub.fullName).toLowerCase().includes(q) ||
        (sub.currentTitle || '').toLowerCase().includes(q) ||
        sub.stage.toLowerCase().includes(q) ||
        (sub.interviewNotes || '').toLowerCase().includes(q)
      );
    });

    if (!applicantsSort.sort.sortBy) {
      return filtered;
    }

    return sortArrayByColumn(filtered, applicantsSort.sort, {
      applicant: (s) => formatDisplayName(s.fullName),
      fitScore: (s) =>
        hasEvaluatedFitScore(s.capabilityScore, s.capabilitySummary, aiCapabilities.enabled)
          ? (s.capabilityScore ?? null)
          : null,
      rate: (s) => (rateMasked ? null : extractRateSortValue(s.submittedRate || s.hourlyRate)),
      stage: (s) => s.stage || '',
    });
  }, [
    submissions,
    applicantTab,
    applicantSearch,
    applicantsSort.sort,
    linkedPlacements,
    rateMasked,
    aiCapabilities.enabled,
  ]);

  const sortedPlacements = useMemo(() => {
    if (!placedSort.sort.sortBy) return linkedPlacements;
    return sortArrayByColumn(linkedPlacements, placedSort.sort, {
      resourceName: (p) => formatDisplayName(p.resourceName, 'Consultant'),
      customer: (p) => p.customer || effectiveRequirement?.companyName || '',
      startDate: (p) => (p.startDate ? new Date(p.startDate) : null),
      billRate: (p) => (rateMasked ? null : extractRateSortValue(p.billing || p.payRate)),
      status: (p) => p.status || 'Active',
    });
  }, [linkedPlacements, placedSort.sort, effectiveRequirement?.companyName, rateMasked]);

  const applicantsPg = useClientPagination(
    filteredSubmissions,
    10,
    `${requirement?.id || ''}|${applicantTab}|${applicantSearch}|${applicantsSort.sort.sortBy || ''}|${applicantsSort.sort.sortDir}`
  );

  const placedPg = useClientPagination(
    sortedPlacements,
    10,
    `${requirement?.id || ''}|placed|${placedSort.sort.sortBy || ''}|${placedSort.sort.sortDir}`
  );

  if (!requirement) {
    return (
      <section className="max-w-7xl mx-auto py-16 text-center space-y-3">
        <p className="text-sm font-semibold text-slate-700">Requisition not found.</p>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{backLabel}</span>
        </button>
      </section>
    );
  }

  const reqView = effectiveRequirement || requirement;
  const openPositions = reqView.openPositions || 1;
  const filledPositions =
    reqView.filledPositions ?? reqView.activePlacements?.length ?? 0;
  const fillPercent = Math.min(100, Math.round((filledPositions / openPositions) * 100));
  const isPositionsFull = filledPositions >= openPositions;
  const workModelLabel = formatWorkModelLabel(reqView.workModel);
  const locationLabel = formatLocationDisplay(reqView.location, workModelLabel);

  const resolveCandidateForSubmission = (sub: RequirementSubmission): Candidate | null => {
    if (sub.candidate) return sub.candidate;
    if (sub.candidateId) {
      const byId =
        candidates.find((c) => c.id === sub.candidateId) ||
        knownCandidatesRef.current.get(sub.candidateId);
      if (byId) return byId;
    }
    return (
      candidates.find((c) => c.fullName.trim().toLowerCase() === sub.fullName.trim().toLowerCase()) ||
      null
    );
  };

  const resolvePlacementCandidateForSubmission = (
    sub: RequirementSubmission,
    resolvedBase?: Candidate | null
  ): Candidate => {
    const base = resolvedBase ?? resolveCandidateForSubmission(sub);
    if (base) {
      return {
        ...base,
        hourlyRate: sub.submittedRate || base.hourlyRate || sub.hourlyRate || '',
        vendorName: sub.submittedVendorName || base.vendorName,
      };
    }
    return {
      id: sub.candidateId || sub.id,
      fullName: sub.fullName,
      email: sub.email || '',
      phone: sub.phone || '',
      currentTitle: sub.currentTitle || '',
      workAuth: sub.workAuth || '',
      education: '',
      skillset: sub.skillset || '',
      hourlyRate: sub.submittedRate || sub.hourlyRate || '',
      relocation: '',
      resumeName: sub.resumeName || '',
      resumeFormat: sub.resumeFormat || 'PDF',
      resumeFileUrl: sub.resumeFileUrl,
      assignedRecruiter: sub.recruiterName || '',
      pipelineStage: sub.stage,
      vendorName: sub.submittedVendorName || undefined,
    };
  };

  const skills = reqView.skillsRequired
    ? reqView.skillsRequired.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  const { name: clientContactLabel, title: clientContactTitle } = formatClientContactDisplay(
    reqView.clientContact,
    reqView.clientContactTitle
  );

  const assignedRecruiterLabel =
    typeof reqView.assignedRecruiter === 'object' && reqView.assignedRecruiter !== null
      ? (reqView.assignedRecruiter as any).fullName ||
        (reqView.assignedRecruiter as any).name ||
        'Desk Sourcing Specialist'
      : reqView.assignedRecruiter || 'Desk Sourcing Specialist';

  const customFieldEntries = Object.entries(reqView.customFields || {}).filter(
    ([k, v]) => !k.startsWith('_') && v !== null && v !== undefined && String(v).trim() !== ''
  );

  const defaultApplicationForm =
    applicationForms.find((f) => f.isDefault) || applicationForms[0] || DEFAULT_APPLICATION_FORMS[0];
  const explicitFormId =
    reqView.publicFormTemplateId ||
    (reqView.customFields && typeof reqView.customFields === 'object'
      ? reqView.customFields._publicFormTemplateId || ''
      : '');
  const activeApplicationForm =
    (explicitFormId ? applicationForms.find((f) => f.id === explicitFormId) : undefined) ||
    defaultApplicationForm;
  const activeFormFieldChips = summarizeFormTemplateFields(activeApplicationForm);
  const onlineSubmissions = submissions.filter((s) => s.intakeSource === 'PUBLIC_FORM');
  const onlineActiveCount = onlineSubmissions.filter(
    (s) => s.stage.trim().toLowerCase() !== 'closed'
  ).length;

  const generateDefaultPublicSummary = () =>
    buildClientSafeSummaryHtml({
      opportunityTitle: reqView.opportunityTitle,
      openPositions: reqView.openPositions,
      workModel: workModelLabel || 'Remote',
      location: locationLabel,
      skillsRequired: reqView.skillsRequired,
      companyName: reqView.companyName,
      rawEmailText: reqView.rawEmailText,
    });

  const effectivePublicSummary =
    (reqView.publicDescription && reqView.publicDescription.trim()) ||
    generateDefaultPublicSummary();

  const liveEditingSub = editingNotesSub
    ? submissions.find((s) => s.id === editingNotesSub.id) || editingNotesSub
    : null;
  const liveFitSub = fitModalSubId
    ? submissions.find((s) => s.id === fitModalSubId) || null
    : null;

  const prepareApplicantRow = (sub: RequirementSubmission) => {
    const candObj = resolveCandidateForSubmission(sub);
    const placed = isPlacedApplicant(sub);
    const isLegacy = sub.id.startsWith('legacy_');
    const displayName = formatDisplayName(sub.fullName);
    const initials = displayName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
    const formattedInterview = formatDateTimeBadge(sub.interviewDateTime || sub.interviewDate);
    const subNotes = sub.notes || [];
    const latestNote = subNotes[0] || null;
    const metaLine = [
      sub.submissionDate ? `Attached ${sub.submissionDate}` : '',
      sub.recruiterName ? `by ${sub.recruiterName}` : '',
    ]
      .filter(Boolean)
      .join(' \u00B7 ');

    return {
      sub,
      candObj,
      placed,
      isLegacy,
      displayName,
      initials,
      formattedInterview,
      subNotes,
      latestNote,
      metaLine,
      stageIdx: getStageIndex(sub.stage, taxonomies.stages),
      applicantStageOptions: buildApplicantStageOptions(taxonomies.stages, sub.stage),
    };
  };

  type PreparedApplicantRow = ReturnType<typeof prepareApplicantRow>;

  const renderApplicantIdentity = ({
    sub,
    candObj,
    placed,
    isLegacy,
    displayName,
    initials,
    formattedInterview,
    latestNote,
    metaLine,
  }: PreparedApplicantRow) => (
    <div className="flex items-start gap-3.5 min-w-0">
      <div
        className={`w-9 h-9 rounded-full border flex items-center justify-center font-bold text-[11px] flex-shrink-0 ${
          placed
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : 'bg-slate-100 border-slate-200/80 text-slate-700'
        }`}
      >
        {initials}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          {candObj ? (
            <button
              type="button"
              onClick={() => onOpenResumePreview(candObj)}
              className="font-bold text-slate-900 hover:text-brand-600 text-sm text-left cursor-pointer truncate"
            >
              {displayName}
            </button>
          ) : (
            <span className="font-bold text-slate-900 text-sm truncate">{displayName}</span>
          )}
          {placed && (
            <StatusBadge
              label="Active Placement"
              tone="emerald"
              size="xs"
              className="!bg-emerald-50 !text-emerald-700 !border-emerald-200 !font-semibold !px-2 !text-[11px]"
            />
          )}
        </div>

        <div className="flex items-center flex-wrap gap-x-1.5 gap-y-0.5 text-[12px] leading-snug">
          <span className="font-medium text-slate-600 truncate max-w-md">
            {sub.currentTitle || 'Consultant'}
          </span>
          {sub.workAuth && (
            <>
              <span className="text-slate-300" aria-hidden="true">
                &middot;
              </span>
              <span className="text-slate-500 font-medium whitespace-nowrap">{sub.workAuth}</span>
            </>
          )}
          {sub.intakeSource === 'PUBLIC_FORM' && (
            <>
              <span className="text-slate-300" aria-hidden="true">
                &middot;
              </span>
              <span className="inline-flex items-center gap-1 text-indigo-600 font-medium whitespace-nowrap">
                <Globe className="w-3 h-3 shrink-0" />
                <span>Applied Online</span>
              </span>
            </>
          )}
          {sub.submittedVendorName && (
            <>
              <span className="text-slate-300" aria-hidden="true">
                &middot;
              </span>
              <span className="text-amber-700 font-medium whitespace-nowrap">
                via {sub.submittedVendorName}
              </span>
            </>
          )}
        </div>

        {metaLine && <p className="text-[11px] text-slate-400">{metaLine}</p>}

        {(formattedInterview || (latestNote && !isLegacy && onUpdateSubmissionNotes)) && (
          <div className="flex items-center gap-2 flex-wrap pt-1">
            {formattedInterview &&
              (!isLegacy && onUpdateSubmissionNotes ? (
                <button
                  type="button"
                  onClick={() => openNotesEditor(sub, 'interview')}
                  title="Click to update interview schedule"
                  className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-brand-50 hover:bg-brand-100/80 text-brand-700 border border-brand-200/80 font-medium whitespace-nowrap cursor-pointer transition-colors"
                >
                  <Calendar className="w-3 h-3 shrink-0" />
                  <span>Interview: {formattedInterview}</span>
                </button>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-brand-50 text-brand-700 border border-brand-200/80 font-medium whitespace-nowrap">
                  <Calendar className="w-3 h-3 shrink-0" />
                  <span>Interview: {formattedInterview}</span>
                </span>
              ))}

            {latestNote && !isLegacy && onUpdateSubmissionNotes && (
              <button
                type="button"
                onClick={() => openNotesEditor(sub, 'notes')}
                className="inline-flex items-center gap-1.5 max-w-md text-[11px] px-2 py-0.5 rounded-md bg-slate-50 hover:bg-slate-100 border border-slate-200/80 text-slate-600 transition-colors cursor-pointer min-w-0"
              >
                <MessageSquare className="w-3 h-3 text-slate-400 shrink-0" />
                <span className="truncate">
                  <strong className="font-semibold text-slate-700">
                    {latestNote.authorName}:
                  </strong>{' '}
                  {latestNote.text}
                </span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const renderFitScoreButton = (sub: RequirementSubmission) => {
    const isChecking = evaluatingSubId === sub.id;
    const isScoreEvaluated = hasEvaluatedFitScore(
      sub.capabilityScore,
      sub.capabilitySummary,
      aiCapabilities.enabled
    );
    if (!isScoreEvaluated) {
      if (sub.id.startsWith('legacy_')) {
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[11px] font-medium whitespace-nowrap">
            Not Checked
          </span>
        );
      }
      return (
        <button
          type="button"
          disabled={isChecking}
          onClick={() => handleEvaluateSubmission(sub)}
          title={aiCapabilities.enabled ? 'Run SquadPipe AI Fit Score Check' : 'Run Skill Fit Score Check'}
          className="group inline-flex flex-col items-start gap-1 text-left px-1.5 py-1 -mx-1.5 rounded-md hover:bg-teal-50/80 transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap"
        >
          <span className="inline-flex items-center gap-1.5 text-[12px] leading-none">
            <span className="font-semibold text-teal-700 group-hover:text-teal-800">
              {isChecking ? 'Checking Fit...' : 'Check Fit Score'}
            </span>
            {isChecking ? (
              <Loader2 className="w-3 h-3 animate-spin text-teal-600 shrink-0" />
            ) : (
              <AiIcon className="w-3.5 h-3.5 text-teal-600 shrink-0 group-hover:scale-110 transition-transform" />
            )}
          </span>
          <span className="w-24 h-1 rounded-full bg-teal-100/90 overflow-hidden block">
            <span
              className={`block h-full rounded-full bg-teal-600 transition-all duration-200 ${
                isChecking ? 'w-2/3 animate-pulse' : 'w-0 group-hover:w-1/2'
              }`}
            />
          </span>
        </button>
      );
    }
    const rawScore = sub.capabilityScore ?? 0;
    const badgeMeta = getCapabilityBadgeStyle(rawScore, sub.capabilitySummary);
    const usedAi = Boolean(sub.capabilitySummary?.evaluatedWithAi && aiCapabilities.enabled);
    const clampedScore = Math.max(0, Math.min(100, Math.round(rawScore)));
    return (
      <button
        type="button"
        onClick={() => setFitModalSubId(sub.id)}
        title="Click to inspect strengths, gaps, or re-run fit check"
        className="group inline-flex flex-col items-start gap-1 text-left px-1.5 py-1 -mx-1.5 rounded-md hover:bg-slate-100/80 transition-colors cursor-pointer whitespace-nowrap"
      >
        <span className="inline-flex items-center gap-1.5 text-[12px] leading-none">
          <span className={`font-bold tabular-nums ${badgeMeta.scoreTextClass}`}>
            {clampedScore}%
          </span>
          <span className="text-slate-600 font-medium group-hover:text-slate-900">
            {badgeMeta.label}
          </span>
          {isChecking ? (
            <Loader2 className="w-2.5 h-2.5 animate-spin shrink-0 text-brand-600" />
          ) : (
            usedAi && <AiIcon className={`w-3 h-3 shrink-0 ${badgeMeta.scoreTextClass}`} />
          )}
        </span>
        <span className="w-24 h-1 rounded-full bg-slate-200/80 overflow-hidden block">
          <span
            className={`block h-full rounded-full ${badgeMeta.barClass}`}
            style={{ width: `${clampedScore}%` }}
          />
        </span>
      </button>
    );
  };

  const renderRateCell = (sub: RequirementSubmission) => {
    const rawRate = sub.submittedRate || sub.hourlyRate || '';
    if (!rawRate) {
      return <span className="text-slate-400 font-medium text-[11px]">Rate TBD</span>;
    }
    const formatted = formatRate(rawRate);
    if (rateMasked) {
      return (
        <MaskedValue
          value={formatted}
          isMasked={true}
          className="font-mono font-semibold text-slate-800 text-xs"
        />
      );
    }
    const { amount, term } = splitRateAndTerm(formatted);
    if (!/\d/.test(amount)) {
      return (
        <div className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <span className="text-slate-400 text-[11px] font-medium">Rate TBD</span>
          <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 uppercase">
            {formatted}
          </span>
        </div>
      );
    }
    return (
      <div className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
        <span className="font-mono font-bold text-slate-900 text-xs tabular-nums">
          {amount}
        </span>
        {term && (
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
            {term}
          </span>
        )}
      </div>
    );
  };

  const renderStageControl = ({
    sub,
    candObj,
    placed,
    isLegacy,
    displayName,
    stageIdx,
    applicantStageOptions,
  }: PreparedApplicantRow) =>
    !isLegacy && onUpdateSubmissionStage ? (
      <CustomSelect
        ariaLabel={`Stage for ${displayName}`}
        disabled={busySubId === sub.id}
        value={sub.stage}
        size="xs"
        fullWidth={false}
        minMenuWidth={136}
        prefixNode={
          busySubId === sub.id ? (
            <Loader2 className="w-2.5 h-2.5 text-brand-600 animate-spin shrink-0" />
          ) : undefined
        }
        options={applicantStageOptions.map((st) => ({
          value: st,
          label: st,
          dotClass: getStageDotClass(st, getStageIndex(st, taxonomies.stages)),
        }))}
        onChange={async (nextVal) => {
          const nextStage = nextVal as RequirementSubmission['stage'];
          const nextLower = nextStage.trim().toLowerCase();
          if (nextLower === 'onboarding' && !placed) {
            onOpenPlacementWizard(reqView, resolvePlacementCandidateForSubmission(sub, candObj));
            return;
          }
          setBusySubId(sub.id);
          try {
            await onUpdateSubmissionStage(reqView, sub.id, nextStage);
            if (
              onUpdateSubmissionNotes &&
              (nextLower === 'interview' || nextLower === 'closed')
            ) {
              openNotesEditor(
                { ...sub, stage: nextStage },
                nextLower === 'interview' ? 'interview' : 'closed'
              );
            }
          } catch {
            // Parent handles toast
          } finally {
            setBusySubId(null);
          }
        }}
      />
    ) : (
      <StatusBadge stage={sub.stage} dotClass={getStageDotClass(sub.stage, stageIdx)} size="xs" />
    );

  const renderApplicantActions = ({
    sub,
    candObj,
    placed,
    isLegacy,
    displayName,
    subNotes,
  }: PreparedApplicantRow) => {
    const showNotesBtn = !isLegacy && Boolean(onUpdateSubmissionNotes);
    const showDetachBtn = !isLegacy && Boolean(onDetachSubmission);
    const showPitchBtn = !isLegacy;
    const hasToolbarGroup = showPitchBtn || showNotesBtn || showDetachBtn;

    return (
      <div className="inline-flex items-center justify-start lg:justify-end gap-1.5 flex-wrap lg:flex-nowrap">
        {!placed && !isPositionsFull && (
          <button
            type="button"
            onClick={() => onOpenPlacementWizard(reqView, resolvePlacementCandidateForSubmission(sub, candObj))}
            title="Start placement onboarding for this candidate"
            className="h-7 px-2.5 rounded-lg border border-emerald-200 bg-white hover:bg-emerald-50 hover:border-emerald-300 text-emerald-700 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap"
          >
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>Place</span>
          </button>
        )}

        {hasToolbarGroup && (
          <div className="inline-flex items-center h-7 rounded-lg border border-slate-200 bg-white divide-x divide-slate-200 overflow-hidden whitespace-nowrap">
            {showPitchBtn && (
              <button
                type="button"
                onClick={() => setPitchTargetSub(sub)}
                title="Prepare client pitch email draft"
                className="px-2.5 h-full inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 hover:text-brand-700 hover:bg-brand-50/70 transition-colors cursor-pointer"
              >
                <Mail className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                <span>Prepare Pitch</span>
              </button>
            )}

            {showNotesBtn && (
              <button
                type="button"
                onClick={() => openNotesEditor(sub, 'notes')}
                title={
                  subNotes.length > 0
                    ? `View or add notes (${subNotes.length})`
                    : `Add note for ${displayName}`
                }
                aria-label={`Notes for ${displayName}`}
                className={`px-2 h-full inline-flex items-center justify-center gap-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                  editingNotesSub?.id === sub.id || subNotes.length > 0
                    ? 'text-brand-700 bg-brand-50/60 hover:bg-brand-100/70'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                {subNotes.length > 0 && <span className="tabular-nums">{subNotes.length}</span>}
              </button>
            )}

            {showDetachBtn && (
              <button
                type="button"
                onClick={() => setSubToDetach({ sub, displayName })}
                title={`Remove ${displayName} from requirement`}
                aria-label={`Remove ${displayName}`}
                className="px-2 h-full inline-flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  const reqTabs: Array<DetailTabItem<'applicants' | 'placed' | 'details'>> = [
    {
      id: 'applicants',
      label: 'Applicants Pipeline',
      icon: UsersRound,
      badge: submissions.length,
    },
    {
      id: 'placed',
      label: 'Placed Candidates',
      icon: CheckCircle2,
      badge: linkedPlacements.length,
    },
    {
      id: 'details',
      label: 'Job Scope & Apply Link',
      icon: Globe,
      badge: publicFormEnabled ? 'Live' : undefined,
      badgeTone: publicFormEnabled ? 'emerald' : undefined,
    },
  ];

  return (
    <section className="max-w-7xl mx-auto space-y-6 pb-6 animate-fade-in">
      <DetailBreadcrumb
        backLabel={backLabel}
        onBack={onBack}
        codePill={reqView.code}
        title={reqView.opportunityTitle}
        rightSlot={
          publicFormEnabled ? (
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Public CV Form Live</span>
            </div>
          ) : undefined
        }
      />

      {/* Bare Canvas Entity Title & Actions */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight leading-snug">
              {reqView.opportunityTitle}
            </h1>
            <StatusBadge
              stage={reqView.status}
              dotClass={getStageDotClass(
                reqView.status,
                getStageIndex(reqView.status, taxonomies.stages)
              )}
              size="xs"
            />
          </div>
          <p className="text-xs text-slate-500 truncate">
            <span className="font-medium text-slate-700">{reqView.companyName}</span>
            {locationLabel && <span> &middot; {locationLabel}</span>}
            {workModelLabel && <span> &middot; {workModelLabel}</span>}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
          {(onEditReq || onUpdateReq) && (
            <button
              type="button"
              title="Edit Requirement Details"
              onClick={() => {
                if (onEditReq) {
                  onEditReq(reqView);
                  return;
                }
                setEditForm(reqView);
                setEditOpenPositions(String(reqView.openPositions || 1));
                setEditOpenPosError('');
                setIsEditing(true);
              }}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Edit</span>
            </button>
          )}

          {submissions.length > 0 && !isPositionsFull && (
            <button
              type="button"
              onClick={() => {
                const preferredSub =
                  submissions.find((s) => s.stage === 'Selected') ||
                  submissions.find((s) => s.stage !== 'Closed') ||
                  submissions[0];
                onOpenPlacementWizard(
                  reqView,
                  preferredSub ? resolvePlacementCandidateForSubmission(preferredSub) : null
                );
              }}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Activate Placement</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowBenchPicker(true)}
            className="px-3.5 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>
              {submissions.length > 0 ? 'Attach Applicants' : 'Attach Bench Applicants'}
            </span>
          </button>
        </div>
      </div>

      {/* Standalone 4-Column Summary Card + Embedded Required Skills */}
      <div className="bg-white rounded-xl border border-slate-200/80 card-shadow overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 text-xs">
          {/* 1. Client & Work Setup */}
          <div className="px-6 py-4 space-y-1.5 min-w-0">
            <div className="text-xs font-medium text-slate-500">Client &amp; Location</div>
            <div className="font-semibold text-slate-900 leading-snug break-words flex items-start gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
              <span className="break-words">{reqView.companyName}</span>
            </div>
            <div className="text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
              <span>{locationLabel}</span>
              {workModelLabel && (
                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[11px] font-medium text-slate-700">
                  {workModelLabel}
                </span>
              )}
            </div>
          </div>

          {/* 2. Hiring Lead & Owner */}
          <div className="px-6 py-4 space-y-1.5 min-w-0">
            <div className="text-xs font-medium text-slate-500">Hiring Lead &amp; Owner</div>
            <div className="font-semibold text-slate-900 leading-snug break-words">
              {clientContactLabel}
            </div>
            <div className="text-[11px] text-slate-500 leading-snug flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              {clientContactTitle && (
                <>
                  <span className="break-words">{clientContactTitle}</span>
                  <span className="text-slate-300">&middot;</span>
                </>
              )}
              <span className="whitespace-nowrap">
                Owner: <strong className="text-slate-700 font-medium">{assignedRecruiterLabel}</strong>
              </span>
            </div>
          </div>

          {/* 3. Commercial Rates */}
          <div className="px-6 py-4 space-y-1.5 min-w-0">
            <div className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
              <span>Commercial Rates</span>
            </div>
            {rateMasked ? (
              <>
                <MaskedValue value="" isMasked={true} className="text-sm font-bold block" />
                <div className="text-[11px] text-slate-400">Rate protected for your role</div>
              </>
            ) : reqView.targetBillRate || reqView.maxBillRate || reqView.targetPayRate ? (
              <>
                <div className="font-mono font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                  <span>
                    {reqView.targetBillRate
                      ? `Bill ${currencySymbol}${reqView.targetBillRate}/hr`
                      : 'Bill TBD'}
                  </span>
                  {reqView.maxBillRate && reqView.maxBillRate !== reqView.targetBillRate ? (
                    <span className="text-[11px] font-medium text-slate-500">
                      (Max {currencySymbol}
                      {reqView.maxBillRate}/hr)
                    </span>
                  ) : null}
                </div>
                <div className="text-[11px] font-mono text-slate-500">
                  {reqView.targetPayRate
                    ? `Target Pay ${currencySymbol}${reqView.targetPayRate}/hr`
                    : 'Target Pay TBD'}
                </div>
              </>
            ) : (
              <div className="text-[11px] text-slate-400 pt-0.5">Rates not specified</div>
            )}
          </div>

          {/* 4. Fulfillment & Public CV Intake */}
          <div className="px-6 py-4 space-y-1.5 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-500">Fulfillment</span>
              <span className="text-[11px] font-mono font-bold text-slate-800">
                {filledPositions}/{openPositions} filled
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-200/80 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  isPositionsFull ? 'bg-emerald-500' : 'bg-brand-600'
                }`}
                style={{ width: `${fillPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between gap-2 text-[11px] pt-0.5">
              {publicFormEnabled && publicShareUrl ? (
                <>
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>Public Form Live</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyPublicLink}
                    className="font-semibold text-brand-700 hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    {copiedPublicLink ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy Link</span>
                      </>
                    )}
                  </button>
                </>
              ) : (
                <>
                  <span className="text-slate-400">Public Form Off</span>
                  <button
                    type="button"
                    disabled={isUpdatingPublicForm}
                    onClick={() => updatePublicFormConfig({ enabled: true })}
                    className="font-semibold text-brand-600 hover:underline cursor-pointer disabled:opacity-50"
                  >
                    {isUpdatingPublicForm ? 'Enabling...' : 'Enable Link'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {skills.length > 0 && (
          <DetailExpandableSkillsBar
            embedded
            label="Required Skills:"
            skills={skills}
            initialVisibleCount={10}
            onEdit={
              onEditReq || onUpdateReq
                ? () => {
                    if (onEditReq) {
                      onEditReq(reqView);
                      return;
                    }
                    setEditForm(reqView);
                    setEditOpenPositions(String(reqView.openPositions || 1));
                    setEditOpenPosError('');
                    setIsEditing(true);
                  }
                : undefined
            }
          />
        )}
      </div>

      {/* Floating Underline Workspace Tabs */}
      <DetailUnderlineTabs
        ariaLabel="Requisition workspace sections"
        tabs={reqTabs}
        activeTab={workspaceTab}
        onChange={setWorkspaceTab}
      />

      {/* TAB 1: Applicants Pipeline (Full Width) */}
      {workspaceTab === 'applicants' && (
        <div className="space-y-6">
          {/* Full-Width Submitted Applicants Card */}
          <div className="bg-white rounded-xl border border-slate-200/80 card-shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="font-bold text-slate-900 text-xs">
                  Submitted Applicants ({submissions.length})
                </h2>
                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 flex-wrap">
                  {(
                    [
                      { id: 'All' as const, count: submissions.length },
                      { id: 'Active' as const, count: activeApplicantsCount },
                      ...(interviewApplicantsCount > 0
                        ? [{ id: 'Interview' as const, count: interviewApplicantsCount }]
                        : []),
                      ...(selectedApplicantsCount > 0
                        ? [{ id: 'Selected' as const, count: selectedApplicantsCount }]
                        : []),
                      { id: 'Placed' as const, count: placedApplicantsCount },
                      { id: 'Closed' as const, count: closedApplicantsCount },
                    ]
                  ).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setApplicantTab(t.id)}
                      className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                        applicantTab === t.id
                          ? 'bg-white text-slate-900 shadow-sm font-semibold'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {t.id} ({t.count})
                    </button>
                  ))}
                </div>
              </div>

              {submissions.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative flex-1 sm:flex-initial">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={applicantSearch}
                      onChange={(e) => setApplicantSearch(e.target.value)}
                      placeholder="Filter applicants or notes..."
                      className="pl-8 pr-3 py-1 text-xs border border-slate-200 rounded-lg bg-white w-full sm:w-52 text-slate-700 focus:outline-none focus:border-brand-600"
                    />
                  </div>
                </div>
              )}
            </div>

            {submissions.length === 0 ? (
              <div className="p-5">
                <div className="py-12 px-4 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-3">
                  <p>No applicants attached yet. Open the candidate picker to attach bench consultants or enable the Public CV Link.</p>
                  <div className="flex items-center justify-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setShowBenchPicker(true)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Attach Bench Applicants</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setWorkspaceTab('details')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      <span>Configure Public Form</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : filteredSubmissions.length === 0 ? (
              <div className="p-5">
                <div className="py-10 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  No applicants match your current tab/search.{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setApplicantTab('All');
                      setApplicantSearch('');
                    }}
                    className="font-semibold text-brand-600 hover:underline cursor-pointer"
                  >
                    Show all applicants
                  </button>
                </div>
              </div>
            ) : (
              <>
                {(() => {
                  const preparedRows = applicantsPg.pagedItems.map(prepareApplicantRow);
                  return (
                    <>
                      {/* Desktop Table Layout (auto-sized columns prevent badge collision) */}
                      <div className="hidden lg:block overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            <tr>
                              <SortableTableHeader
                                label="Applicant"
                                column="applicant"
                                sort={applicantsSort.sort}
                                onSort={applicantsSort.handleSort}
                                defaultDir="asc"
                                className="pl-6 pr-4 py-3 min-w-[260px]"
                              />
                              <SortableTableHeader
                                label="Fit Score"
                                column="fitScore"
                                sort={applicantsSort.sort}
                                onSort={applicantsSort.handleSort}
                                defaultDir="desc"
                                className="px-4 py-3 whitespace-nowrap"
                              />
                              <SortableTableHeader
                                label="Rate"
                                column="rate"
                                sort={applicantsSort.sort}
                                onSort={applicantsSort.handleSort}
                                defaultDir="desc"
                                disabled={rateMasked}
                                className="px-4 py-3 whitespace-nowrap"
                              />
                              <SortableTableHeader
                                label="Stage"
                                column="stage"
                                sort={applicantsSort.sort}
                                onSort={applicantsSort.handleSort}
                                defaultDir="asc"
                                className="px-4 py-3 whitespace-nowrap"
                              />
                              <th className="pl-4 pr-6 py-3 text-right whitespace-nowrap">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {preparedRows.map((row) => (
                              <tr
                                key={row.sub.id}
                                className="hover:bg-slate-50/60 transition-colors"
                              >
                                <td className="pl-6 pr-4 py-4 align-middle">
                                  {renderApplicantIdentity(row)}
                                </td>
                                <td className="px-4 py-4 align-middle whitespace-nowrap">
                                  {renderFitScoreButton(row.sub)}
                                </td>
                                <td className="px-4 py-4 align-middle whitespace-nowrap">
                                  {renderRateCell(row.sub)}
                                </td>
                                <td className="px-4 py-4 align-middle whitespace-nowrap">
                                  {renderStageControl(row)}
                                </td>
                                <td className="pl-4 pr-6 py-4 align-middle text-right whitespace-nowrap">
                                  {renderApplicantActions(row)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Compact / Mobile Stacked Cards */}
                      <div className="lg:hidden divide-y divide-slate-100">
                        {preparedRows.map((row) => (
                          <div key={row.sub.id} className="px-5 py-4 space-y-3">
                            {renderApplicantIdentity(row)}
                            <div className="flex items-center gap-3 flex-wrap pl-12">
                              {renderFitScoreButton(row.sub)}
                              <span className="text-slate-300" aria-hidden="true">
                                &bull;
                              </span>
                              {renderRateCell(row.sub)}
                              {renderStageControl(row)}
                            </div>
                            <div className="pl-12">{renderApplicantActions(row)}</div>
                          </div>
                        ))}
                      </div>
                    </>
                  );
                })()}

                <TablePagination
                  page={applicantsPg.page}
                  limit={applicantsPg.limit}
                  total={applicantsPg.total}
                  onPageChange={applicantsPg.setPage}
                  onLimitChange={applicantsPg.setLimit}
                  itemLabel="applicants"
                  pageSizeOptions={[10, 20, 50]}
                />
              </>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Placed Candidates (Full Width) */}
      {workspaceTab === 'placed' && (
        <div className="bg-white rounded-xl border border-slate-200/80 card-shadow overflow-hidden text-xs">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="font-bold text-slate-900 text-xs">
                Placed Candidates ({linkedPlacements.length})
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-white border border-slate-200 text-[11px] font-mono font-semibold text-slate-600">
                {filledPositions} / {openPositions} filled
              </span>
            </div>

            {submissions.length > 0 && !isPositionsFull && (
              <button
                type="button"
                onClick={() => {
                  const preferred =
                    submissions.find((s) => s.stage === 'Selected' && !isPlacedApplicant(s)) ||
                    submissions.find((s) => s.stage !== 'Closed' && !isPlacedApplicant(s)) ||
                    submissions[0];
                  onOpenPlacementWizard(reqView, resolvePlacementCandidateForSubmission(preferred));
                }}
                className="px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100/80 text-emerald-800 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>+ Activate Placement</span>
              </button>
            )}
          </div>

          {linkedPlacements.length === 0 ? (
            <div className="p-6">
              <div className="py-12 px-4 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-3">
                <p>
                  No candidates placed on this requisition yet. Click{' '}
                  <strong className="font-semibold text-slate-700">Place</strong> on a shortlisted candidate or move them to Onboarding.
                </p>
                <div className="flex items-center justify-center gap-2.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setWorkspaceTab('applicants')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <span>View Applicants Pipeline</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  {submissions.length > 0 && !isPositionsFull && (
                    <button
                      type="button"
                      onClick={() =>
                        onOpenPlacementWizard(reqView, resolvePlacementCandidateForSubmission(submissions[0]))
                      }
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Activate Placement</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <tr>
                      <SortableTableHeader
                        label="Consultant &amp; Role"
                        column="resourceName"
                        sort={placedSort.sort}
                        onSort={placedSort.handleSort}
                        defaultDir="asc"
                        className="px-6 py-3"
                      />
                      <SortableTableHeader
                        label="Client / Vendor"
                        column="customer"
                        sort={placedSort.sort}
                        onSort={placedSort.handleSort}
                        defaultDir="asc"
                        className="px-5 py-3 whitespace-nowrap"
                      />
                      <SortableTableHeader
                        label="SOW Period"
                        column="startDate"
                        sort={placedSort.sort}
                        onSort={placedSort.handleSort}
                        defaultDir="desc"
                        className="px-5 py-3 whitespace-nowrap"
                      />
                      <SortableTableHeader
                        label="Commercials"
                        column="billRate"
                        sort={placedSort.sort}
                        onSort={placedSort.handleSort}
                        defaultDir="desc"
                        disabled={rateMasked}
                        className="px-5 py-3 whitespace-nowrap"
                      />
                      <SortableTableHeader
                        label="Status"
                        column="status"
                        sort={placedSort.sort}
                        onSort={placedSort.handleSort}
                        defaultDir="asc"
                        className="px-5 py-3 whitespace-nowrap"
                      />
                      <th className="px-6 py-3 text-right whitespace-nowrap">Record</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {placedPg.pagedItems.map((p) => {
                      const pDisplayName = formatDisplayName(p.resourceName, 'Consultant');
                      const pInitials = pDisplayName
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase();
                      const matchedCand = candidates.find(
                        (c) =>
                          (p.candidateId && c.id === p.candidateId) ||
                          c.fullName.trim().toLowerCase() === p.resourceName.trim().toLowerCase()
                      );
                      const statusStr = p.status || 'Active';
                      const statusTone =
                        statusStr === 'Completed' || statusStr === 'Terminated'
                          ? 'slate'
                          : statusStr === 'Expiring Soon'
                            ? 'amber'
                            : 'emerald';

                      return (
                        <tr
                          key={p.id}
                          onClick={
                            !p.isSummaryOnly && onSelectPlacement
                              ? () => onSelectPlacement(p)
                              : undefined
                          }
                          className={`transition-colors ${
                            !p.isSummaryOnly && onSelectPlacement
                              ? 'hover:bg-slate-50/80 cursor-pointer group'
                              : 'hover:bg-slate-50/50'
                          }`}
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3.5 min-w-0">
                              <div className="w-9 h-9 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center font-bold text-[11px] flex-shrink-0">
                                {pInitials}
                              </div>
                              <div className="min-w-0 space-y-0.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {matchedCand ? (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onOpenResumePreview(matchedCand);
                                      }}
                                      className="font-bold text-slate-900 hover:text-brand-600 text-sm cursor-pointer text-left"
                                    >
                                      {pDisplayName}
                                    </button>
                                  ) : (
                                    <span className="font-bold text-slate-900 text-sm">
                                      {pDisplayName}
                                    </span>
                                  )}
                                  {p.purchaseOrderNumber && (
                                    <span className="inline-flex items-center text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-slate-100/80 border border-slate-200 text-slate-700 font-semibold">
                                      PO {p.purchaseOrderNumber}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
                                  <span className="font-medium text-slate-600">
                                    {p.skillRole || reqView.opportunityTitle}
                                  </span>
                                  {p.placementType && (
                                    <>
                                      <span className="text-slate-300">&bull;</span>
                                      <span>{p.placementType}</span>
                                    </>
                                  )}
                                  {p.deployment && (
                                    <>
                                      <span className="text-slate-300">&bull;</span>
                                      <span>{p.deployment}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-4 whitespace-nowrap">
                            <div className="font-semibold text-slate-800">
                              {p.customer || reqView.companyName}
                            </div>
                            {p.vendorName && (
                              <div className="text-[11px] text-amber-700 font-medium">
                                via {p.vendorName}
                              </div>
                            )}
                          </td>

                          <td className="px-5 py-4 whitespace-nowrap text-slate-600 font-mono text-[11px]">
                            {p.startDate || p.endDate ? (
                              <span>
                                {p.startDate || 'TBD'} &rarr; {p.endDate || 'Ongoing'}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-sans">Dates in billing record</span>
                            )}
                          </td>

                          <td className="px-5 py-4 whitespace-nowrap font-mono">
                            {rateMasked ? (
                              <MaskedValue value="" isMasked={true} className="font-semibold" />
                            ) : p.billing || p.payRate ? (
                              <div className="space-y-0.5">
                                <div className="font-bold text-slate-900">
                                  {p.billing ? `Bill ${formatRate(p.billing)}` : 'Bill TBD'}
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  {p.payRate ? `Pay ${formatRate(p.payRate)}` : ''}
                                  {typeof p.hourlySpread === 'number' && p.hourlySpread !== 0 && (
                                    <span className="ml-1.5 text-emerald-700 font-semibold">
                                      (+{currencySymbol}
                                      {p.hourlySpread.toFixed(2)}/hr)
                                    </span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-400 font-sans">&mdash;</span>
                            )}
                          </td>

                          <td className="px-5 py-4 whitespace-nowrap">
                            <StatusBadge label={statusStr} tone={statusTone} size="xs" />
                          </td>

                          <td className="px-6 py-4 text-right whitespace-nowrap">
                            {!p.isSummaryOnly && onSelectPlacement ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectPlacement(p);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 bg-white group-hover:border-brand-300 group-hover:text-brand-700 text-slate-700 text-[11px] font-semibold transition-colors cursor-pointer"
                              >
                                <span>View Details</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            ) : (
                              <span className="text-[11px] text-slate-400">Placed</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <TablePagination
                page={placedPg.page}
                limit={placedPg.limit}
                total={placedPg.total}
                onPageChange={placedPg.setPage}
                onLimitChange={placedPg.setLimit}
                itemLabel="placements"
                pageSizeOptions={[10, 20, 50]}
              />
            </>
          )}
        </div>
      )}

      {/* TAB 3: Job Scope & Apply Link */}
      {workspaceTab === 'details' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-8 space-y-5">
            {/* Card 1: Public Job Application Link & Attached Form Template */}
            <div className="bg-white rounded-xl border border-slate-200/80 card-shadow overflow-hidden text-xs">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <Link2 className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-bold text-slate-900 text-sm">
                        Public Job Application Link
                      </h2>
                      <StatusBadge
                        label={publicFormEnabled ? 'Live & Accepting CVs' : 'Link Disabled'}
                        tone={publicFormEnabled ? 'emerald' : 'slate'}
                        size="xs"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Share a client-safe application link for candidates or partner vendors to submit resumes directly into {reqView.code}.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={publicFormEnabled}
                  aria-label="Toggle public CV form"
                  disabled={isUpdatingPublicForm}
                  onClick={() => updatePublicFormConfig({ enabled: !publicFormEnabled })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer disabled:opacity-50 shrink-0 ${
                    publicFormEnabled ? 'bg-emerald-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      publicFormEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {publicFormEnabled && publicShareUrl ? (
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                      <input
                        type="text"
                        readOnly
                        value={publicShareUrl}
                        aria-label="Shareable public application link"
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                        className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-700 font-mono focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleCopyPublicLink}
                        title="Copy Form Link"
                        className="px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xs inline-flex items-center gap-1.5 cursor-pointer flex-shrink-0"
                      >
                        {copiedPublicLink ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-700">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy Link</span>
                          </>
                        )}
                      </button>
                      <a
                        href={`/apply/${publicFormToken}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs inline-flex items-center gap-1.5 flex-shrink-0"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Open Form</span>
                      </a>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="inline-flex items-center gap-1.5 text-slate-500">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Client company name, contact emails, and internal rates are never exposed.</span>
                      </span>
                      <button
                        type="button"
                        disabled={isUpdatingPublicForm}
                        onClick={() =>
                          updatePublicFormConfig({ enabled: true, regenerateToken: true })
                        }
                        className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 font-semibold cursor-pointer disabled:opacity-50 shrink-0"
                      >
                        <RefreshCw
                          className={`w-3 h-3 ${isUpdatingPublicForm ? 'animate-spin' : ''}`}
                        />
                        <span>Regenerate Link</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="text-slate-600 leading-relaxed">
                      Turn on the link above to create a shareable application page for candidates and partner vendors.
                    </div>
                    <button
                      type="button"
                      disabled={isUpdatingPublicForm}
                      onClick={() => updatePublicFormConfig({ enabled: true })}
                      className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      Enable Link Now
                    </button>
                  </div>
                )}

                {/* Attached Application Form Template Selector (Compact Single Row) */}
                <div className="pt-3.5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900">Attached Application Form</span>
                      <StatusBadge
                        tone={explicitFormId ? 'brand' : 'emerald'}
                        shape="rounded"
                        size="xs"
                        label={explicitFormId ? 'Custom Template' : 'Default Form'}
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {activeApplicationForm.name} &middot; {activeFormFieldChips.length} fields ({activeFormFieldChips.filter((c) => c.required).length} required)
                    </p>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                    <div className="flex-1 sm:w-64">
                      <CustomSelect
                        value={explicitFormId || ''}
                        onChange={(val) =>
                          updatePublicFormConfig({ publicFormTemplateId: val || null })
                        }
                        ariaLabel="Select attached application form template"
                        size="sm"
                        options={[
                          {
                            value: '',
                            label: `Default: ${defaultApplicationForm.name}`,
                          },
                          ...applicationForms.map((f) => ({
                            value: f.id,
                            label: `${f.name}${f.isDefault ? ' (Default)' : ''}`,
                          })),
                        ]}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => onPreviewApplicationForm?.(reqView, activeApplicationForm.id)}
                      title="Open dedicated form preview page"
                      className="px-2.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-brand-50 hover:border-brand-200 text-slate-700 hover:text-brand-700 text-[11px] font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Preview</span>
                    </button>
                  </div>
                </div>

                {publicFormError && (
                  <div className="text-xs text-rose-600 font-medium">{publicFormError}</div>
                )}
              </div>
            </div>

            {/* Card 2: Role Scope & Public Summary (Clean Requirement Summary, No Redundant Header Box) */}
            <div className="bg-white rounded-xl border border-slate-200/80 card-shadow overflow-hidden text-xs">
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">Role Scope &amp; Public Summary</h3>
                    <p className="text-[11px] text-slate-400">
                      Client-safe requirement summary shown on the left side of the public application page.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!isEditingPublicDesc && (
                    <button
                      type="button"
                      disabled={isUpdatingPublicForm}
                      onClick={() => {
                        const generated = generateDefaultPublicSummary();
                        setDraftPublicDesc(generated);
                        updatePublicFormConfig({ publicDescription: generated });
                      }}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-[11px] inline-flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-50"
                    >
                      <AiIcon className="w-3 h-3 text-brand-600" />
                      <span>Auto-Fill Summary</span>
                    </button>
                  )}
                  {!isEditingPublicDesc && (
                    <button
                      type="button"
                      onClick={() => {
                        setDraftPublicDesc(effectivePublicSummary);
                        setIsEditingPublicDesc(true);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-brand-50 hover:bg-brand-100/80 text-brand-700 font-semibold text-[11px] inline-flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Pencil className="w-3 h-3" />
                      <span>Edit Summary</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="p-5">
                {isEditingPublicDesc ? (
                  <div className="space-y-3">
                    <RichTextEditor
                      value={draftPublicDesc}
                      onChange={setDraftPublicDesc}
                      minHeight={140}
                      maxHeight={360}
                      disabled={isUpdatingPublicForm}
                      ariaLabel="Role Scope & Public Summary Editor"
                      placeholder="Brief client-safe role scope shown on the public application page (never includes internal rates or client contact details)..."
                    />
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <button
                        type="button"
                        disabled={isUpdatingPublicForm}
                        onClick={() => setDraftPublicDesc(generateDefaultPublicSummary())}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-[11px] inline-flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-50"
                      >
                        <AiIcon className="w-3 h-3 text-brand-600" />
                        <span>Auto-Fill Summary</span>
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={isUpdatingPublicForm}
                          onClick={() => setIsEditingPublicDesc(false)}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={isUpdatingPublicForm}
                          onClick={() => updatePublicFormConfig({ publicDescription: draftPublicDesc })}
                          className="px-3.5 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                        >
                          {isUpdatingPublicForm ? 'Saving...' : 'Save Summary'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-50/70 border border-slate-200/70 rounded-xl p-4">
                    <RichTextDisplay content={effectivePublicSummary} />
                  </div>
                )}
              </div>
            </div>
          </div>

          <aside className="lg:col-span-4 space-y-4">
            <div className="bg-white rounded-xl border border-slate-200/80 card-shadow overflow-hidden text-xs">
              <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5 text-brand-600" />
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    Submitted Applications
                  </h3>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold font-mono bg-slate-100 text-slate-700 border border-slate-200">
                  {publicIntakeCount} Total &middot; {onlineActiveCount} Active
                </span>
              </div>

              <div className="p-4 space-y-3.5">
                {onlineSubmissions.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      <span>Latest 5 Submissions</span>
                      <span>
                        {Math.min(5, onlineSubmissions.length)} of {onlineSubmissions.length}
                      </span>
                    </div>
                    <div className="divide-y divide-slate-100 rounded-xl border border-slate-200/80 overflow-hidden">
                      {onlineSubmissions.slice(0, 5).map((sub) => {
                        const matchedCand = resolveCandidateForSubmission(sub);
                        return (
                          <div
                            key={sub.id}
                            onClick={() => {
                              if (matchedCand) {
                                onOpenResumePreview(matchedCand);
                              } else {
                                setWorkspaceTab('applicants');
                              }
                            }}
                            className="px-3 py-2.5 bg-white hover:bg-slate-50 flex items-center justify-between gap-2 cursor-pointer transition-colors"
                          >
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-900 leading-snug break-words">
                                {formatDisplayName(sub.fullName)}
                              </div>
                              <div className="text-[11px] text-slate-500 leading-snug">
                                {[
                                  sub.workAuth || matchedCand?.workAuth,
                                  sub.submittedVendorName ? `via ${sub.submittedVendorName}` : 'Direct',
                                ]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </div>
                            </div>
                            <StatusBadge
                              stage={sub.stage}
                              dotClass={getStageDotClass(
                                sub.stage,
                                getStageIndex(sub.stage, taxonomies.stages)
                              )}
                              size="xs"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="py-4 px-3 rounded-xl bg-slate-50/70 border border-dashed border-slate-200 text-center text-[11px] text-slate-500 leading-relaxed">
                    No public link applications yet. Resumes submitted through the public link will appear here (latest 5 shown).
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setWorkspaceTab('applicants')}
                  className="w-full py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs cursor-pointer transition-colors"
                >
                  View All in Applicants Pipeline &rarr;
                </button>
              </div>
            </div>

            {customFieldEntries.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200/80 card-shadow p-5 space-y-3 text-xs">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Custom Attributes
                </h3>
                <dl className="space-y-2.5">
                  {customFieldEntries.map(([k, v]) => {
                    const strVal = String(v);
                    if (isHtmlContent(strVal)) {
                      return (
                        <div key={k} className="space-y-1">
                          <dt className="text-slate-400 font-medium capitalize">
                            {k.replace(/_/g, ' ')}
                          </dt>
                          <dd>
                            <RichTextDisplay
                              content={strVal}
                              className="text-xs text-slate-700 bg-slate-50/70 border border-slate-200/70 rounded-lg p-2.5"
                            />
                          </dd>
                        </div>
                      );
                    }
                    return (
                      <div key={k} className="flex items-start justify-between gap-2">
                        <dt className="text-slate-400 font-medium capitalize shrink-0">
                          {k.replace(/_/g, ' ')}
                        </dt>
                        <dd className="text-slate-800 font-medium text-right min-w-0 [overflow-wrap:anywhere]">
                          {/^https?:\/\/\S+$/i.test(strVal.trim()) ? (
                            <a
                              href={strVal.trim()}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-brand-600 hover:underline"
                            >
                              {strVal.trim()}
                            </a>
                          ) : (
                            strVal
                          )}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </div>
            )}
          </aside>
        </div>
      )}

      {/* Shared Ranked Bench Candidate Picker Drawer */}
      <AttachBenchDrawer
        isOpen={showBenchPicker}
        onClose={() => setShowBenchPicker(false)}
        requirement={reqView}
        candidates={candidates}
        rateMasked={rateMasked}
        onAttachCandidates={onAttachCandidates}
        onAssignCandidate={(req, cand) => onAssignCandidate(req, cand)}
        onOpenCsvImport={onOpenCsvImport}
        onOpenResumeParser={onOpenResumeParser}
        onCandidatesSeen={(loaded) => {
          for (const c of loaded) {
            if (c?.id) knownCandidatesRef.current.set(c.id, c);
          }
        }}
      />

      <CapabilityFitModal
        isOpen={Boolean(liveFitSub)}
        requirement={reqView}
        submission={liveFitSub}
        aiEnabled={aiCapabilities.enabled}
        isEvaluating={Boolean(liveFitSub && evaluatingSubId === liveFitSub.id)}
        onRunAiCheck={
          liveFitSub && !liveFitSub.id.startsWith('legacy_')
            ? () => handleEvaluateSubmission(liveFitSub)
            : undefined
        }
        onClose={() => setFitModalSubId(null)}
      />

      <RequirementNotesModal
        isOpen={Boolean(liveEditingSub)}
        requirement={reqView}
        liveEditingSub={liveEditingSub}
        mode={notesModalMode}
        taxonomies={taxonomies}
        editingNoteId={editingNoteId}
        confirmDeleteNoteId={confirmDeleteNoteId}
        busyNoteId={busyNoteId}
        draftInterviewDate={draftInterviewDate}
        draftNotesText={draftNotesText}
        isSavingNotes={isSavingNotes}
        notesTextareaRef={notesTextareaRef}
        onChangeInterviewDate={setDraftInterviewDate}
        onChangeNotesText={setDraftNotesText}
        onSelectEditNote={(note) => {
          setConfirmDeleteNoteId(null);
          setEditingNoteId(note.id);
          setDraftNotesText(note.text);
          notesTextareaRef.current?.focus();
        }}
        onSwitchToNewNote={() => {
          setEditingNoteId(null);
          setDraftNotesText('');
          notesTextareaRef.current?.focus();
        }}
        onConfirmDeleteChange={setConfirmDeleteNoteId}
        onDeleteNote={handleDeleteSubmissionNote}
        onSubmit={handleSaveSubmissionNotes}
        onClose={() => {
          setConfirmDeleteNoteId(null);
          setEditingNotesSub(null);
        }}
      />

      <EditRequirementModal
        isOpen={Boolean(isEditing && editForm)}
        requirement={reqView}
        editForm={editForm}
        editOpenPositions={editOpenPositions}
        editOpenPosError={editOpenPosError}
        isSavingEdit={isSavingEdit}
        taxonomies={taxonomies}
        onChangeForm={setEditForm}
        onChangeOpenPositions={(val) => {
          setEditOpenPositions(val);
          if (editOpenPosError) setEditOpenPosError('');
        }}
        onSave={async () => {
          if (isSavingEdit || !editForm) return;
          const trimmed = editOpenPositions.trim();
          const parsed = Number(trimmed);
          if (
            !trimmed ||
            !/^\d+$/.test(trimmed) ||
            !Number.isInteger(parsed) ||
            parsed < 1 ||
            parsed > 1000
          ) {
            setEditOpenPosError('Please enter at least 1 open position.');
            return;
          }
          setIsSavingEdit(true);
          try {
            if (onUpdateReq) await onUpdateReq({ ...editForm, openPositions: parsed });
            setEditOpenPosError('');
            setIsEditing(false);
          } catch {
            // Error toast handled by parent
          } finally {
            setIsSavingEdit(false);
          }
        }}
        onClose={() => setIsEditing(false)}
      />

      <PreparePitchModal
        isOpen={Boolean(pitchTargetSub)}
        onClose={() => setPitchTargetSub(null)}
        submissionId={pitchTargetSub?.id || ''}
        requirementCode={reqView.code}
        requirementTitle={reqView.opportunityTitle}
        companyName={reqView.companyName}
        candidate={pitchTargetSub ? resolveCandidateForSubmission(pitchTargetSub) : null}
        fallbackCandidateName={pitchTargetSub?.fullName}
        rateMasked={rateMasked}
        initialStage={pitchTargetSub?.stage}
      />

      {onDetachSubmission && (
        <ConfirmDeleteModal
          isOpen={Boolean(subToDetach)}
          onClose={() => setSubToDetach(null)}
          title="Remove Candidate from Requirement?"
          description={
            subToDetach ? (
              <>
                Remove <strong className="text-slate-800">{subToDetach.displayName}</strong> from{' '}
                <strong className="text-slate-800">{reqView.code}</strong> ({reqView.opportunityTitle})?
              </>
            ) : null
          }
          warningText="Their candidate profile stays saved in your roster."
          confirmLabel="Remove Candidate"
          loadingText="Removing..."
          onConfirm={async () => {
            if (!subToDetach) return;
            await onDetachSubmission(reqView, subToDetach.sub.id);
          }}
        />
      )}

    </section>
  );
};
