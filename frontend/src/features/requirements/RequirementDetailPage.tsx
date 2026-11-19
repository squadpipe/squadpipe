import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  Briefcase,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Copy,
  DollarSign,
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
  Sparkles,
  Trash2,
  UserPlus,
  UsersRound,
} from 'lucide-react';
import { apiClient } from '../../config/api.config';
import {
  BillablePlacement,
  Requirement,
  Candidate,
  RequirementSubmission,
  SubmissionNote,
} from '../../types';
import { useCurrency } from '../../utils/currency';
import { useAiCapabilities } from '../../utils/workspaceBrand';
import { useClientPagination } from '../../utils/usePagination';
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
import { SkillTag } from '../../components/shared/SkillTag';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { MaskedValue } from '../../components/shared/MaskedValue';
import { ActionButton } from '../../components/shared/ActionButton';
import { TablePagination } from '../../components/shared/TablePagination';
import { CustomSelect } from '../../components/shared/CustomSelect';
import { AttachBenchDrawer } from '../../components/modals/AttachBenchDrawer';
import { PreparePitchModal } from '../../components/modals/PreparePitchModal';
import {
  CapabilityFitModal,
  EditRequirementModal,
  RequirementNotesModal,
  getCapabilityBadgeStyle,
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
  onUpdateReq?: (req: Requirement) => Promise<void> | void;
  onRequirementUpdated?: (req: Requirement) => void;
  onOpenCsvImport?: (req: Requirement) => void;
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
  onUpdateReq,
  onRequirementUpdated,
  onOpenCsvImport,
}) => {
  const { formatRate, symbol: currencySymbol } = useCurrency();
  const aiCapabilities = useAiCapabilities();
  const taxonomies = useMasterTaxonomies(true);

  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>('applicants');
  const [applicantTab, setApplicantTab] = useState<ApplicantFilterTab>('All');
  const [applicantSearch, setApplicantSearch] = useState('');
  const [sortByFit, setSortByFit] = useState(true);
  const [fitModalSubId, setFitModalSubId] = useState<string | null>(null);
  const [evaluatingSubId, setEvaluatingSubId] = useState<string | null>(null);
  const [pitchTargetSub, setPitchTargetSub] = useState<RequirementSubmission | null>(null);
  const [showBenchPicker, setShowBenchPicker] = useState(false);
  const [busySubId, setBusySubId] = useState<string | null>(null);
  const [confirmDetachId, setConfirmDetachId] = useState<string | null>(null);
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
  const [showAllSkills, setShowAllSkills] = useState(false);
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
    setFitModalSubId(null);
    setEvaluatingSubId(null);
    setPitchTargetSub(null);
    setShowBenchPicker(false);
    setConfirmDetachId(null);
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
    setShowAllSkills(false);
  }, [requirement?.id]);

  useEffect(() => {
    setHydratedReq(null);
    if (!requirement?.id) return;
    const needsFullHydration =
      !Array.isArray(requirement.submissions) ||
      (requirement.submissions.length === 0 && (requirement.submissionCount ?? 0) > 0);
    if (!needsFullHydration) return;

    let active = true;
    apiClient
      .get(`/requirements/${requirement.id}`)
      .then((res) => {
        if (active && res.data?.success && res.data.data) {
          setHydratedReq(mapRequirementFromApi(res.data.data));
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [requirement?.id]);

  useEffect(() => {
    if (requirement) {
      setEditForm(requirement);
      if (Array.isArray(requirement.submissions) && requirement.submissions.length > 0) {
        setHydratedReq(null);
      }
    }
  }, [requirement]);

  const effectiveRequirement =
    hydratedReq && requirement && hydratedReq.id === requirement.id ? hydratedReq : requirement;

  const updatePublicFormConfig = async (payload: {
    enabled?: boolean;
    regenerateToken?: boolean;
    publicDescription?: string | null;
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
  const hasAnyCapabilityScore = submissions.some((s) => typeof s.capabilityScore === 'number');

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

    if (sortByFit && hasAnyCapabilityScore) {
      return [...filtered].sort((a, b) => {
        const scoreA = typeof a.capabilityScore === 'number' ? a.capabilityScore : -1;
        const scoreB = typeof b.capabilityScore === 'number' ? b.capabilityScore : -1;
        return scoreB - scoreA;
      });
    }
    return filtered;
  }, [
    submissions,
    applicantTab,
    applicantSearch,
    sortByFit,
    hasAnyCapabilityScore,
    linkedPlacements,
  ]);

  const applicantsPg = useClientPagination(
    filteredSubmissions,
    10,
    `${requirement?.id || ''}|${applicantTab}|${applicantSearch}|${sortByFit ? 'fit' : 'recent'}`
  );

  const placedPg = useClientPagination(
    linkedPlacements,
    10,
    `${requirement?.id || ''}|placed`
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
    return (
      sub.candidate ||
      candidates.find(
        (c) =>
          (sub.candidateId && c.id === sub.candidateId) ||
          c.fullName.toLowerCase() === sub.fullName.toLowerCase()
      ) ||
      (sub.candidateId ? knownCandidatesRef.current.get(sub.candidateId) : undefined) ||
      null
    );
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
    ([, v]) => v !== null && v !== undefined && String(v).trim() !== ''
  );

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
        <div className="flex items-center gap-1.5 flex-wrap">
          {candObj ? (
            <button
              type="button"
              onClick={() => onOpenResumePreview(candObj)}
              className="font-bold text-slate-900 hover:text-brand-600 text-[13px] text-left cursor-pointer truncate"
            >
              {displayName}
            </button>
          ) : (
            <span className="font-bold text-slate-900 text-[13px] truncate">{displayName}</span>
          )}
          {sub.workAuth && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium whitespace-nowrap">
              {sub.workAuth}
            </span>
          )}
          {sub.intakeSource === 'PUBLIC_FORM' && (
            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold whitespace-nowrap">
              <Globe className="w-2.5 h-2.5" />
              <span>Form Intake</span>
            </span>
          )}
          {sub.submittedVendorName && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-medium whitespace-nowrap">
              via {sub.submittedVendorName}
            </span>
          )}
          {placed && <StatusBadge label="Active Placement" tone="emerald" size="xs" />}
        </div>

        <p className="text-[11.5px] font-medium text-slate-600 truncate max-w-md">
          {sub.currentTitle || 'Consultant'}
        </p>

        {metaLine && <p className="text-[11px] text-slate-400">{metaLine}</p>}

        {(formattedInterview || (latestNote && !isLegacy && onUpdateSubmissionNotes)) && (
          <div className="flex items-center gap-2 flex-wrap pt-1">
            {formattedInterview &&
              (!isLegacy && onUpdateSubmissionNotes ? (
                <button
                  type="button"
                  onClick={() => openNotesEditor(sub, 'interview')}
                  title="Click to update interview schedule"
                  className="inline-flex items-center gap-1 text-[10.5px] px-2 py-0.5 rounded-md bg-brand-50 hover:bg-brand-100/80 text-brand-700 border border-brand-200/80 font-medium whitespace-nowrap cursor-pointer transition-colors"
                >
                  <Calendar className="w-3 h-3 shrink-0" />
                  <span>Interview: {formattedInterview}</span>
                </button>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10.5px] px-2 py-0.5 rounded-md bg-brand-50 text-brand-700 border border-brand-200/80 font-medium whitespace-nowrap">
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
    if (typeof sub.capabilityScore !== 'number') {
      return <span className="text-[11px] text-slate-400">&mdash;</span>;
    }
    const badgeMeta = getCapabilityBadgeStyle(sub.capabilityScore, sub.capabilitySummary);
    const usedAi = Boolean(sub.capabilitySummary?.evaluatedWithAi && aiCapabilities.enabled);
    return (
      <button
        type="button"
        onClick={() => setFitModalSubId(sub.id)}
        title="Click to inspect strengths, gaps & verdict"
        className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border font-semibold whitespace-nowrap cursor-pointer transition-all hover:shadow-2xs ${badgeMeta.badgeClass}`}
      >
        {usedAi && <Sparkles className="w-2.5 h-2.5 shrink-0" />}
        <span>
          {sub.capabilityScore}% &bull; {badgeMeta.label}
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
          className="font-mono font-semibold text-slate-800 text-[12px]"
        />
      );
    }
    const { amount, term } = splitRateAndTerm(formatted);
    if (!/\d/.test(amount)) {
      return (
        <div className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <span className="text-slate-400 text-[11px] font-medium">Rate TBD</span>
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 uppercase">
            {formatted}
          </span>
        </div>
      );
    }
    return (
      <div className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
        <span className="font-mono font-bold text-slate-900 text-[12px] tabular-nums">
          {amount}
        </span>
        {term && (
          <span className="text-[10.5px] font-semibold text-slate-500 uppercase tracking-wide">
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
            onOpenPlacementWizard(reqView, candObj);
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
    if (confirmDetachId === sub.id && !isLegacy && onDetachSubmission) {
      return (
        <div className="inline-flex items-center gap-2 h-7 bg-rose-50 border border-rose-200 rounded-lg px-2.5 whitespace-nowrap">
          <span className="text-[11px] font-medium text-rose-700">Detach?</span>
          <ActionButton
            type="button"
            loading={busySubId === sub.id}
            loadingText="Removing..."
            spinnerClassName="w-2.5 h-2.5 animate-spin flex-shrink-0"
            onClick={async () => {
              if (busySubId === sub.id) return;
              setBusySubId(sub.id);
              try {
                await onDetachSubmission(reqView, sub.id);
                setConfirmDetachId(null);
              } finally {
                setBusySubId(null);
              }
            }}
            className="text-[11px] font-bold text-rose-700 hover:underline cursor-pointer"
          >
            Remove
          </ActionButton>
          <span className="text-rose-200">|</span>
          <button
            type="button"
            onClick={() => setConfirmDetachId(null)}
            className="text-[11px] font-semibold text-slate-600 hover:text-slate-800 cursor-pointer"
          >
            Cancel
          </button>
        </div>
      );
    }

    const showAiBtn = !isLegacy && aiCapabilities.enabled;
    const showNotesBtn = !isLegacy && Boolean(onUpdateSubmissionNotes);
    const showDetachBtn = !isLegacy && Boolean(onDetachSubmission);
    const hasUtilityGroup = showAiBtn || showNotesBtn || showDetachBtn;
    const hasAiEval = Boolean(sub.capabilitySummary?.evaluatedWithAi);

    return (
      <div className="inline-flex items-center gap-2 flex-wrap">
        {!placed && !isPositionsFull && (
          <button
            type="button"
            onClick={() => onOpenPlacementWizard(reqView, candObj)}
            className="h-7 px-2.5 rounded-lg border border-emerald-200 bg-emerald-50/80 hover:bg-emerald-100 text-emerald-800 text-[11px] font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
          >
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>Place</span>
          </button>
        )}

        {!isLegacy && (
          <button
            type="button"
            onClick={() => setPitchTargetSub(sub)}
            className="h-7 px-2.5 rounded-lg border border-brand-200 bg-brand-50/70 hover:bg-brand-100/80 text-brand-700 text-[11px] font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
          >
            <Mail className="w-3.5 h-3.5 shrink-0" />
            <span>Prepare Pitch</span>
          </button>
        )}

        {hasUtilityGroup && (
          <div className="inline-flex items-center h-7 rounded-lg border border-slate-200 bg-white divide-x divide-slate-200 shadow-2xs overflow-hidden">
            {showAiBtn && (
              <button
                type="button"
                disabled={evaluatingSubId === sub.id}
                onClick={() => handleEvaluateSubmission(sub)}
                title={
                  evaluatingSubId === sub.id
                    ? 'Running AI Capability Check...'
                    : hasAiEval
                      ? 'Re-run AI Capability Check'
                      : 'Run AI Capability Check'
                }
                aria-label={
                  hasAiEval
                    ? `Re-run AI check for ${displayName}`
                    : `Run AI check for ${displayName}`
                }
                className={`px-2 h-full inline-flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50 ${
                  hasAiEval
                    ? 'text-indigo-600 bg-indigo-50/60 hover:bg-indigo-100/70'
                    : 'text-slate-500 hover:text-indigo-600 hover:bg-indigo-50/60'
                }`}
              >
                {evaluatingSubId === sub.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
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
                    ? 'text-brand-700 bg-brand-50/70 hover:bg-brand-100/70'
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
                onClick={() => setConfirmDetachId(sub.id)}
                title={`Detach ${displayName} from requirement`}
                aria-label={`Detach ${displayName}`}
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

  return (
    <section className="max-w-7xl mx-auto space-y-5 pb-6 animate-fade-in">
      {/* Slim Breadcrumb */}
      <div className="flex items-center justify-between gap-3 flex-wrap text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-semibold shadow-2xs transition-colors cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{backLabel}</span>
          </button>
          <span className="text-slate-300">/</span>
          <span className="text-[11px] font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded shrink-0">
            {reqView.code}
          </span>
        </div>

        {publicFormEnabled && (
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-emerald-700 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Public CV Form Live</span>
          </div>
        )}
      </div>

      {/* Unified Requisition Hero + 4-Col Metadata Grid + Tabs */}
      <div className="bg-white rounded-xl border border-slate-200/80 card-shadow overflow-hidden">
        {/* Title & Action Bar */}
        <div className="px-6 py-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-200/70 text-brand-600 flex items-center justify-center flex-shrink-0">
              <Briefcase className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-[17px] sm:text-[18px] font-bold text-slate-900 tracking-tight leading-snug inline align-middle mr-2.5">
                {reqView.opportunityTitle}
              </h1>
              <StatusBadge
                stage={reqView.status}
                dotClass={getStageDotClass(
                  reqView.status,
                  getStageIndex(reqView.status, taxonomies.stages)
                )}
                size="xs"
                className="align-middle"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
            {onUpdateReq && (
              <button
                type="button"
                title="Edit Requirement Details"
                onClick={() => {
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
                  const firstCandidate = resolveCandidateForSubmission(
                    submissions.find((s) => s.stage === 'Selected') ||
                      submissions.find((s) => s.stage !== 'Closed') ||
                      submissions[0]
                  );
                  onOpenPlacementWizard(reqView, firstCandidate);
                }}
                className="px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100/80 text-emerald-800 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Activate Placement</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowBenchPicker(true)}
              className="px-3.5 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>
                {submissions.length > 0 ? 'Attach Applicants' : 'Attach Bench Applicants'}
              </span>
            </button>
          </div>
        </div>

        {/* Structured 4-Column Metadata Bar (Single Source of Truth) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 border-t border-slate-100 bg-slate-50/45 text-xs">
          {/* 1. Client & Work Setup */}
          <div className="px-6 py-3.5 space-y-1.5 min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Client &amp; Location
            </div>
            <div
              title={reqView.companyName}
              className="font-semibold text-slate-900 truncate flex items-center gap-1.5"
            >
              <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{reqView.companyName}</span>
            </div>
            <div className="text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
              <span>{locationLabel}</span>
              {workModelLabel && (
                <span className="px-1.5 py-0.5 rounded bg-white border border-slate-200/80 text-[10px] font-semibold text-slate-600">
                  {workModelLabel}
                </span>
              )}
            </div>
          </div>

          {/* 2. Hiring Lead & Owner */}
          <div className="px-6 py-3.5 space-y-1.5 min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Hiring Lead &amp; Owner
            </div>
            <div
              title={clientContactTitle ? `${clientContactLabel} — ${clientContactTitle}` : clientContactLabel}
              className="font-semibold text-slate-900 truncate"
            >
              {clientContactLabel}
            </div>
            <div className="text-[11px] text-slate-500 truncate">
              {clientContactTitle ? (
                <span>
                  {clientContactTitle} &middot; <strong className="text-slate-700 font-medium">Owner: {assignedRecruiterLabel}</strong>
                </span>
              ) : (
                <span>
                  Owner: <strong className="text-slate-700 font-medium">{assignedRecruiterLabel}</strong>
                </span>
              )}
            </div>
          </div>

          {/* 3. Commercial Rates */}
          <div className="px-6 py-3.5 space-y-1.5 min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <DollarSign className="w-3 h-3 text-emerald-600" />
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
          <div className="px-6 py-3.5 space-y-1.5 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Fulfillment
              </span>
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

        {/* Workspace Navigation Tabs */}
        <div
          role="tablist"
          aria-label="Requisition workspace sections"
          className="px-6 border-t border-slate-100 bg-white flex items-center gap-7 overflow-x-auto no-scrollbar"
        >
          {(
            [
              {
                id: 'applicants' as const,
                label: 'Applicants Pipeline',
                icon: UsersRound,
                badge: submissions.length,
              },
              {
                id: 'placed' as const,
                label: 'Placed Candidates',
                icon: CheckCircle2,
                badge: linkedPlacements.length,
              },
              {
                id: 'details' as const,
                label: 'Scope & Public Intake',
                icon: Globe,
                badge: publicFormEnabled ? 'Live' : undefined,
              },
            ]
          ).map((tab) => {
            const Icon = tab.icon;
            const active = workspaceTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setWorkspaceTab(tab.id)}
                className={`py-3 text-xs font-semibold inline-flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'border-brand-600 text-brand-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${active ? 'text-brand-600' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold leading-none ${
                      tab.badge === 'Live'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : active
                          ? 'bg-brand-50 text-brand-700'
                          : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: Applicants Pipeline (Full Width) */}
      {workspaceTab === 'applicants' && (
        <div className="space-y-5">
          {skills.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200/80 card-shadow px-6 py-3.5 flex items-start justify-between gap-4 text-xs">
              <div className="flex items-start gap-2.5 flex-wrap sm:flex-nowrap flex-1 min-w-0">
                <span className="h-6 inline-flex items-center text-[10.5px] font-bold uppercase tracking-wider text-slate-400 shrink-0 whitespace-nowrap">
                  Required Skills:
                </span>
                <div className="flex items-center flex-wrap gap-1.5 flex-1 min-w-0">
                  {(showAllSkills ? skills : skills.slice(0, 10)).map((s, idx) => (
                    <SkillTag key={idx} skill={s} className="!mr-0 !mb-0" />
                  ))}
                  {skills.length > 10 && (
                    <button
                      type="button"
                      onClick={() => setShowAllSkills((prev) => !prev)}
                      className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-semibold cursor-pointer"
                    >
                      {showAllSkills ? 'Show less' : `+${skills.length - 10} more`}
                    </button>
                  )}
                </div>
              </div>

              {onUpdateReq && (
                <button
                  type="button"
                  onClick={() => {
                    setEditForm(reqView);
                    setEditOpenPositions(String(reqView.openPositions || 1));
                    setEditOpenPosError('');
                    setIsEditing(true);
                  }}
                  className="h-6 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 hover:text-brand-700 hover:underline cursor-pointer shrink-0 whitespace-nowrap"
                >
                  <Pencil className="w-3 h-3" />
                  <span>Edit skills</span>
                </button>
              )}
            </div>
          )}

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
                      className={`px-2 py-0.5 rounded-md text-[10.5px] font-medium transition-colors cursor-pointer ${
                        applicantTab === t.id
                          ? 'bg-white text-slate-900 shadow-2xs font-semibold'
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
                  {hasAnyCapabilityScore && (
                    <button
                      type="button"
                      onClick={() => setSortByFit((prev) => !prev)}
                      className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors ${
                        sortByFit
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <ArrowUpDown className="w-3 h-3" />
                      <span>{sortByFit ? 'Highest Fit First' : 'Recent Order'}</span>
                    </button>
                  )}
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
                          <thead className="bg-slate-50/80 border-b border-slate-100 text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                            <tr>
                              <th className="pl-6 pr-4 py-3 min-w-[260px]">Applicant</th>
                              <th className="px-4 py-3 whitespace-nowrap">Fit Score</th>
                              <th className="px-4 py-3 whitespace-nowrap">Rate</th>
                              <th className="px-4 py-3 whitespace-nowrap">Stage</th>
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
                  onOpenPlacementWizard(reqView, resolveCandidateForSubmission(preferred));
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
                        onOpenPlacementWizard(reqView, resolveCandidateForSubmission(submissions[0]))
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
                  <thead className="bg-slate-50/80 border-b border-slate-100 text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-3">Consultant &amp; Role</th>
                      <th className="px-5 py-3 whitespace-nowrap">Client / Vendor</th>
                      <th className="px-5 py-3 whitespace-nowrap">SOW Period</th>
                      <th className="px-5 py-3 whitespace-nowrap">Commercials</th>
                      <th className="px-5 py-3 whitespace-nowrap">Status</th>
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
                                      className="font-bold text-slate-900 hover:text-brand-600 text-[13px] cursor-pointer text-left"
                                    >
                                      {pDisplayName}
                                    </button>
                                  ) : (
                                    <span className="font-bold text-slate-900 text-[13px]">
                                      {pDisplayName}
                                    </span>
                                  )}
                                  {p.purchaseOrderNumber && (
                                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">
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

      {/* TAB 3: Scope & Public Intake */}
      {workspaceTab === 'details' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-8 space-y-4">
            <div className="bg-white rounded-xl border border-slate-200/80 card-shadow p-5 space-y-4 text-xs">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-brand-50 border border-brand-200/70 text-brand-600 flex items-center justify-center shrink-0">
                    <Link2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-900 text-sm">Shareable Public CV Intake Form</h2>
                    <p className="text-[11px] text-slate-500">
                      Let candidates or partner vendors submit CVs directly into {reqView.code}.
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
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer disabled:opacity-50 ${
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

              {publicFormEnabled && publicShareUrl ? (
                <div className="space-y-3 pt-1">
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
                          <span className="text-emerald-700">Copied Link</span>
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

                  <div className="flex items-center justify-between gap-2 text-[11px] pt-1">
                    <span className="inline-flex items-center gap-1.5 text-slate-500">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Internal rates and client contacts are never exposed on the public form.</span>
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
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-500 leading-relaxed">
                  Turn on the switch above to generate a client-safe public intake link. Internal rates and client contact emails always stay hidden.
                </div>
              )}

              {publicFormError && (
                <div className="text-xs text-rose-600 font-medium">{publicFormError}</div>
              )}
            </div>

            {/* Public Description / Role Scope Editor */}
            <div className="bg-white rounded-xl border border-slate-200/80 card-shadow p-5 space-y-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">Role Scope &amp; Public Summary</h3>
                    <p className="text-[11px] text-slate-400">
                      Client-safe summary shown at the top of the public application page.
                    </p>
                  </div>
                </div>
                {!isEditingPublicDesc && (
                  <button
                    type="button"
                    onClick={() => {
                      setDraftPublicDesc(reqView.publicDescription || '');
                      setIsEditingPublicDesc(true);
                    }}
                    className="text-brand-600 font-semibold hover:underline text-xs cursor-pointer"
                  >
                    {reqView.publicDescription ? 'Edit' : 'Add Summary'}
                  </button>
                )}
              </div>

              {isEditingPublicDesc ? (
                <div className="space-y-3">
                  <textarea
                    rows={5}
                    value={draftPublicDesc}
                    onChange={(e) => setDraftPublicDesc(e.target.value)}
                    placeholder="Brief role scope shown on the public application page (never includes internal rates or client contact emails)."
                    className="w-full p-3 rounded-xl border border-slate-200 text-xs text-slate-700 leading-relaxed focus:border-brand-500 focus:outline-none"
                  />
                  <div className="flex items-center justify-end gap-2">
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
              ) : (
                <p className="text-slate-600 leading-relaxed whitespace-pre-line bg-slate-50/70 border border-slate-200/70 rounded-xl p-3.5">
                  {reqView.publicDescription ||
                    'No public summary set. Only role title, work model, location, and required skills are shown.'}
                </p>
              )}
            </div>
          </div>

          <aside className="lg:col-span-4 space-y-5">
            <div className="bg-white rounded-xl border border-slate-200/80 card-shadow p-5 space-y-3.5 text-xs">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Intake Activity
              </h3>
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2">
                <span className="text-slate-600 font-medium">Public Form Submissions</span>
                <span className="text-base font-bold font-mono text-slate-900">
                  {publicIntakeCount}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Resumes submitted through this link are automatically parsed, duplicate-checked, and tagged{' '}
                <strong className="font-semibold text-slate-700">Form Intake</strong> inside Applicants Pipeline.
              </p>
              <button
                type="button"
                onClick={() => setWorkspaceTab('applicants')}
                className="w-full py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs cursor-pointer transition-colors"
              >
                View Applicants Pipeline &rarr;
              </button>
            </div>

            {customFieldEntries.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200/80 card-shadow p-5 space-y-3 text-xs">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Custom Attributes
                </h3>
                <dl className="space-y-2.5">
                  {customFieldEntries.map(([k, v]) => (
                    <div key={k} className="flex items-start justify-between gap-2">
                      <dt className="text-slate-400 font-medium capitalize shrink-0">
                        {k.replace(/_/g, ' ')}
                      </dt>
                      <dd className="text-slate-800 font-medium text-right min-w-0 [overflow-wrap:anywhere]">
                        {String(v)}
                      </dd>
                    </div>
                  ))}
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
        onCandidatesSeen={(loaded) => {
          for (const c of loaded) {
            if (c?.id) knownCandidatesRef.current.set(c.id, c);
          }
        }}
      />

      {liveFitSub && (
        <CapabilityFitModal
          requirement={reqView}
          submission={liveFitSub}
          aiEnabled={aiCapabilities.enabled}
          isEvaluating={evaluatingSubId === liveFitSub.id}
          onRunAiCheck={
            !liveFitSub.id.startsWith('legacy_') && aiCapabilities.enabled
              ? () => handleEvaluateSubmission(liveFitSub)
              : undefined
          }
          onClose={() => setFitModalSubId(null)}
        />
      )}

      {liveEditingSub && (
        <RequirementNotesModal
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
      )}

      {isEditing && editForm && (
        <EditRequirementModal
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
            if (isSavingEdit) return;
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
      )}

      {pitchTargetSub && (
        <PreparePitchModal
          isOpen={Boolean(pitchTargetSub)}
          onClose={() => setPitchTargetSub(null)}
          submissionId={pitchTargetSub.id}
          requirementCode={reqView.code}
          requirementTitle={reqView.opportunityTitle}
          companyName={reqView.companyName}
          candidate={resolveCandidateForSubmission(pitchTargetSub)}
          fallbackCandidateName={pitchTargetSub.fullName}
          rateMasked={rateMasked}
          initialStage={pitchTargetSub.stage}
        />
      )}
    </section>
  );
};
