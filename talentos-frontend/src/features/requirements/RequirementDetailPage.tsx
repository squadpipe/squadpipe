import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Check,
  FileSpreadsheet,
  Loader2,
  MapPin,
  MessageSquare,
  Pencil,
  Search,
  Trash2,
  UserPlus,
  UsersRound,
  X,
} from 'lucide-react';
import { apiClient } from '../../config/api.config';
import {
  Requirement,
  Candidate,
  RequirementSubmission,
  SubmissionNote,
  ClientDuplicateWarning,
} from '../../types';
import { useCurrency } from '../../utils/currency';
import { useDebounce } from '../../utils/useDebounce';
import { useClientPagination } from '../../utils/usePagination';
import {
  formatDateTimeBadge,
  mapCandidateFromApi,
  mapRequirementFromApi,
} from '../../utils/entityMappers';
import {
  extractResumeMatchExcerpt,
  matchesCandidateQuery,
} from '../../utils/candidateSearch';
import {
  buildApplicantStageOptions,
  buildRequirementStageOptions,
  getStageDotClass,
  getStageIndex,
} from '../../utils/stageStyles';
import { useMasterTaxonomies } from '../../components/shared/DynamicCustomFieldsSection';
import { SkillTagInput } from '../../components/shared/SkillTagInput';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { MaskedValue } from '../../components/shared/MaskedValue';
import { ActionButton } from '../../components/shared/ActionButton';
import { DateTimePicker } from '../../components/shared/DateTimePicker';
import { TablePagination } from '../../components/shared/TablePagination';
import { CustomSelect } from '../../components/shared/CustomSelect';

interface RequirementDetailPageProps {
  requirement: Requirement | null;
  backLabel?: string;
  onBack: () => void;
  candidates: Candidate[];
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
  onOpenPlacementWizard: (req: Requirement, candidate?: Candidate | null) => void;
  onUpdateReq?: (req: Requirement) => Promise<void> | void;
  onOpenCsvImport?: (req: Requirement) => void;
}

const BENCH_PAGE_SIZE = 50;

const QUICK_REJECTION_REASONS = [
  'Rate Mismatch',
  'Skills Gap',
  'Role Filled',
  'Client Selected Other',
  'Candidate Withdrew',
];

type ApplicantFilterTab = 'All' | 'Active' | 'Closed';

export const RequirementDetailPage: React.FC<RequirementDetailPageProps> = ({
  requirement,
  backLabel = 'Back to Pipeline',
  onBack,
  candidates,
  rateMasked = false,
  onAssignCandidate,
  onAttachCandidates,
  onUpdateSubmissionStage,
  onUpdateSubmissionNotes,
  onDetachSubmission,
  onOpenResumePreview,
  onOpenPlacementWizard,
  onUpdateReq,
  onOpenCsvImport,
}) => {
  const { formatRate, symbol: currencySymbol } = useCurrency();
  const taxonomies = useMasterTaxonomies(true);
  const [applicantTab, setApplicantTab] = useState<ApplicantFilterTab>('All');
  const [applicantSearch, setApplicantSearch] = useState('');
  const [showBenchPicker, setShowBenchPicker] = useState(false);
  const [benchSearch, setBenchSearch] = useState('');
  const [benchWorkAuth, setBenchWorkAuth] = useState('All');
  const debouncedBenchSearch = useDebounce(benchSearch, 250);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [isAttaching, setIsAttaching] = useState(false);
  const [busySubId, setBusySubId] = useState<string | null>(null);
  const [confirmDetachId, setConfirmDetachId] = useState<string | null>(null);
  const [editingNotesSub, setEditingNotesSub] = useState<RequirementSubmission | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [busyNoteId, setBusyNoteId] = useState<string | null>(null);
  const [draftInterviewDate, setDraftInterviewDate] = useState('');
  const [draftNotesText, setDraftNotesText] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [clientDuplicateMap, setClientDuplicateMap] = useState<Record<string, ClientDuplicateWarning[]>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState<Requirement | null>(requirement);
  const [pagedCandidates, setPagedCandidates] = useState<Candidate[]>(() =>
    candidates.slice(0, BENCH_PAGE_SIZE)
  );
  const [totalBenchCount, setTotalBenchCount] = useState<number>(candidates.length);
  const [editOpenPositions, setEditOpenPositions] = useState<string>('1');
  const [editOpenPosError, setEditOpenPosError] = useState<string>('');
  const [hydratedReq, setHydratedReq] = useState<Requirement | null>(null);
  const [benchPage, setBenchPage] = useState<number>(1);
  const [hasMoreBench, setHasMoreBench] = useState<boolean>(candidates.length > BENCH_PAGE_SIZE);
  const [isLoadingBench, setIsLoadingBench] = useState<boolean>(false);
  const [isLoadingMoreBench, setIsLoadingMoreBench] = useState<boolean>(false);
  const knownCandidatesRef = useRef<Map<string, Candidate>>(new Map());
  const activeSearchRef = useRef<string>('');

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
    setApplicantTab('All');
    setApplicantSearch('');
    setShowBenchPicker(false);
    setSelectedCandidateIds([]);
    setBenchSearch('');
    setBenchWorkAuth('All');
    setConfirmDetachId(null);
    setEditingNotesSub(null);
    setEditingNoteId(null);
    setBusyNoteId(null);
    setDraftInterviewDate('');
    setDraftNotesText('');
    setClientDuplicateMap({});
    setBenchPage(1);
    setPagedCandidates(candidates.slice(0, BENCH_PAGE_SIZE));
    setTotalBenchCount(candidates.length);
    setHasMoreBench(candidates.length > BENCH_PAGE_SIZE);
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
          stage: effectiveRequirement.status === 'Requirement' ? 'Submitted' : effectiveRequirement.status,
          candidate: legacyCand,
        },
      ];
    }
    return [];
  }, [effectiveRequirement, candidates]);

  const attachedCandidateIdSet = useMemo(
    () => new Set(submissions.map((s) => s.candidateId).filter(Boolean)),
    [submissions]
  );

  const filteredLocalCandidates = useMemo(() => {
    return candidates.filter((c) => {
      const matchesSearch = matchesCandidateQuery(c, debouncedBenchSearch);
      const matchesAuth =
        benchWorkAuth === 'All' ||
        (c.workAuth || '').toLowerCase().includes(benchWorkAuth.toLowerCase());
      return matchesSearch && matchesAuth;
    });
  }, [candidates, debouncedBenchSearch, benchWorkAuth]);

  const pickerActive = Boolean(requirement && showBenchPicker);

  useEffect(() => {
    if (!pickerActive) return;
    let active = true;
    const searchTerm = debouncedBenchSearch.trim();
    const filterKey = `${searchTerm}|${benchWorkAuth}`;
    activeSearchRef.current = filterKey;
    setIsLoadingBench(true);

    apiClient
      .get('/candidates', {
        params: {
          page: 1,
          limit: BENCH_PAGE_SIZE,
          search: searchTerm || undefined,
          workAuth: benchWorkAuth !== 'All' ? benchWorkAuth : undefined,
        },
      })
      .then((res) => {
        if (!active) return;
        const raw = Array.isArray(res.data?.data) ? res.data.data : [];
        const mapped: Candidate[] = raw.map(mapCandidateFromApi);
        for (const c of mapped) {
          if (c?.id) knownCandidatesRef.current.set(c.id, c);
        }
        const pagination = res.data?.pagination;
        const total = typeof pagination?.total === 'number' ? pagination.total : mapped.length;
        const totalPages = typeof pagination?.totalPages === 'number' ? pagination.totalPages : 1;
        setPagedCandidates(mapped);
        setBenchPage(1);
        setTotalBenchCount(total);
        setHasMoreBench(1 < totalPages);
      })
      .catch(() => {
        if (!active) return;
        const slice = filteredLocalCandidates.slice(0, BENCH_PAGE_SIZE);
        setPagedCandidates(slice);
        setBenchPage(1);
        setTotalBenchCount(filteredLocalCandidates.length);
        setHasMoreBench(filteredLocalCandidates.length > slice.length);
      })
      .finally(() => {
        if (active) setIsLoadingBench(false);
      });

    return () => {
      active = false;
    };
  }, [pickerActive, debouncedBenchSearch, benchWorkAuth]);

  useEffect(() => {
    if (!pickerActive || !requirement?.id || pagedCandidates.length === 0) return;
    const candidateIdsToCheck = pagedCandidates
      .filter((c) => !attachedCandidateIdSet.has(c.id))
      .map((c) => c.id);
    if (candidateIdsToCheck.length === 0) return;

    let active = true;
    apiClient
      .get('/submissions/duplicate-check', {
        params: {
          requirementId: requirement.id,
          candidateIds: candidateIdsToCheck.join(','),
        },
      })
      .then((res) => {
        if (!active) return;
        const byId = res.data?.data?.byCandidateId;
        if (byId && typeof byId === 'object') {
          setClientDuplicateMap((prev) => ({ ...prev, ...byId }));
        }
      })
      .catch(() => {
        // Non-blocking advisory check
      });

    return () => {
      active = false;
    };
  }, [pickerActive, requirement?.id, pagedCandidates, attachedCandidateIdSet]);

  const handleBenchScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
      if (
        scrollHeight - scrollTop - clientHeight > 48 ||
        isLoadingBench ||
        isLoadingMoreBench ||
        !hasMoreBench
      ) {
        return;
      }

      const nextPage = benchPage + 1;
      const searchTerm = debouncedBenchSearch.trim();
      const filterKey = `${searchTerm}|${benchWorkAuth}`;
      setIsLoadingMoreBench(true);

      apiClient
        .get('/candidates', {
          params: {
            page: nextPage,
            limit: BENCH_PAGE_SIZE,
            search: searchTerm || undefined,
            workAuth: benchWorkAuth !== 'All' ? benchWorkAuth : undefined,
          },
        })
        .then((res) => {
          if (activeSearchRef.current !== filterKey) return;
          const raw = Array.isArray(res.data?.data) ? res.data.data : [];
          const mapped: Candidate[] = raw.map(mapCandidateFromApi);
          for (const c of mapped) {
            if (c?.id) knownCandidatesRef.current.set(c.id, c);
          }
          const pagination = res.data?.pagination;
          const total = typeof pagination?.total === 'number' ? pagination.total : undefined;
          const totalPages = typeof pagination?.totalPages === 'number' ? pagination.totalPages : nextPage;
          setPagedCandidates((prev) => {
            const seen = new Set(prev.map((p) => p.id));
            const extra = mapped.filter((c) => !seen.has(c.id));
            return [...prev, ...extra];
          });
          setBenchPage(nextPage);
          if (typeof total === 'number') setTotalBenchCount(total);
          setHasMoreBench(nextPage < totalPages);
        })
        .catch(() => {
          if (activeSearchRef.current !== filterKey) return;
          const nextSlice = filteredLocalCandidates.slice(0, nextPage * BENCH_PAGE_SIZE);
          setPagedCandidates(nextSlice);
          setBenchPage(nextPage);
          setHasMoreBench(filteredLocalCandidates.length > nextSlice.length);
        })
        .finally(() => {
          setIsLoadingMoreBench(false);
        });
    },
    [
      benchPage,
      debouncedBenchSearch,
      benchWorkAuth,
      filteredLocalCandidates,
      hasMoreBench,
      isLoadingBench,
      isLoadingMoreBench,
    ]
  );

  const openNotesEditor = (sub: RequirementSubmission, targetNote?: SubmissionNote | null) => {
    setEditingNotesSub(sub);
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
    const dateChanged = draftInterviewDate !== prevDate;

    if (editingNoteId && !cleanText) {
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
      setEditingNotesSub(null);
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

  const activeApplicantsCount = submissions.filter((s) => s.stage !== 'Closed').length;
  const closedApplicantsCount = submissions.length - activeApplicantsCount;

  const filteredSubmissions = useMemo(
    () =>
      submissions.filter((sub) => {
        if (applicantTab === 'Active' && sub.stage === 'Closed') return false;
        if (applicantTab === 'Closed' && sub.stage !== 'Closed') return false;
        const q = applicantSearch.trim().toLowerCase();
        if (!q) return true;
        return (
          sub.fullName.toLowerCase().includes(q) ||
          (sub.currentTitle || '').toLowerCase().includes(q) ||
          sub.stage.toLowerCase().includes(q) ||
          (sub.interviewNotes || '').toLowerCase().includes(q)
        );
      }),
    [submissions, applicantTab, applicantSearch]
  );

  const applicantsPg = useClientPagination(
    filteredSubmissions,
    5,
    `${requirement?.id || ''}|${applicantTab}|${applicantSearch}`
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

  const openPositions = requirement.openPositions || 1;
  const filledPositions =
    requirement.filledPositions ?? requirement.activePlacements?.length ?? 0;
  const isPositionsFull = filledPositions >= openPositions;

  const toggleCandidateSelection = (candId: string) => {
    if (attachedCandidateIdSet.has(candId)) return;
    setSelectedCandidateIds((prev) =>
      prev.includes(candId) ? prev.filter((id) => id !== candId) : [...prev, candId]
    );
  };

  const handleBatchAttach = async () => {
    if (selectedCandidateIds.length === 0) return;
    setIsAttaching(true);
    try {
      if (onAttachCandidates) {
        await onAttachCandidates(requirement, selectedCandidateIds);
      } else {
        for (const id of selectedCandidateIds) {
          const cand = candidates.find((c) => c.id === id) || knownCandidatesRef.current.get(id);
          if (cand) onAssignCandidate(requirement, cand);
        }
      }
      setSelectedCandidateIds([]);
      setShowBenchPicker(false);
    } finally {
      setIsAttaching(false);
    }
  };

  const handleQuickSingleAttach = async (cand: Candidate) => {
    if (attachedCandidateIdSet.has(cand.id)) return;
    setIsAttaching(true);
    try {
      if (onAttachCandidates) {
        await onAttachCandidates(requirement, [cand.id]);
      } else {
        onAssignCandidate(requirement, cand);
      }
      setSelectedCandidateIds((prev) => prev.filter((id) => id !== cand.id));
    } finally {
      setIsAttaching(false);
    }
  };

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

  const isPlacedApplicant = (sub: RequirementSubmission): boolean => {
    const placements = requirement.activePlacements || [];
    return placements.some(
      (p) =>
        (sub.candidateId && p.candidateId === sub.candidateId) ||
        p.resourceName.trim().toLowerCase() === sub.fullName.trim().toLowerCase()
    );
  };

  const skills = requirement.skillsRequired
    ? requirement.skillsRequired.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  const clientContactLabel =
    typeof requirement.clientContact === 'object' && requirement.clientContact !== null
      ? (requirement.clientContact as any).fullName ||
        (requirement.clientContact as any).name ||
        'Primary Hiring Lead'
      : requirement.clientContact || 'Primary Hiring Lead';

  const clientContactTitle = requirement.clientContactTitle
    ? typeof requirement.clientContactTitle === 'object' && requirement.clientContactTitle !== null
      ? (requirement.clientContactTitle as any).designation || ''
      : requirement.clientContactTitle
    : '';

  const assignedRecruiterLabel =
    typeof requirement.assignedRecruiter === 'object' && requirement.assignedRecruiter !== null
      ? (requirement.assignedRecruiter as any).fullName ||
        (requirement.assignedRecruiter as any).name ||
        'Desk Sourcing Specialist'
      : requirement.assignedRecruiter || 'Desk Sourcing Specialist';

  const customFieldEntries = Object.entries(requirement.customFields || {}).filter(
    ([, v]) => v !== null && v !== undefined && String(v).trim() !== ''
  );

  return (
    <section className="max-w-7xl mx-auto space-y-4 animate-fade-in">
      {/* Slim Breadcrumb */}
      <div className="flex items-center gap-2 text-xs">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-semibold shadow-2xs transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{backLabel}</span>
        </button>
        <span className="text-slate-300">/</span>
        <span className="text-[11px] font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
          {requirement.code}
        </span>
        <span className="text-slate-400 truncate max-w-xs hidden sm:inline">
          {requirement.opportunityTitle}
        </span>
      </div>

      {/* Main Header Card */}
      <div className="bg-white rounded-xl border border-slate-200/80 card-shadow px-5 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-lg font-bold text-slate-900 tracking-tight truncate">
              {requirement.opportunityTitle}
            </h1>
            <StatusBadge
              stage={requirement.status}
              dotClass={getStageDotClass(
                requirement.status,
                getStageIndex(requirement.status, taxonomies.stages)
              )}
              size="xs"
            />
          </div>
          <div className="flex items-center gap-2.5 text-xs text-slate-500 flex-wrap">
            <span className="font-semibold text-slate-700">{requirement.companyName}</span>
            <span className="text-slate-300">&bull;</span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="w-3 h-3 text-slate-400" />
              <span>{requirement.location}</span>
            </span>
            <span className="text-slate-300">&bull;</span>
            <span className="text-slate-600 font-medium">
              {filledPositions} / {openPositions}{' '}
              {openPositions === 1 ? 'position' : 'positions'} filled
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
          {onUpdateReq && (
            <button
              type="button"
              onClick={() => {
                setEditForm(requirement);
                setEditOpenPositions(String(requirement.openPositions || 1));
                setEditOpenPosError('');
                setIsEditing(true);
              }}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Edit Requirement</span>
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
                onOpenPlacementWizard(requirement, firstCandidate);
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

      {/* Main 2-Column Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Main Workspace: Submitted Applicants */}
        <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200/80 card-shadow overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <UsersRound className="w-4 h-4 text-brand-600" />
              <h2 className="font-bold text-slate-900 text-xs">
                Submitted Applicants ({submissions.length})
              </h2>
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 ml-1">
                {([
                  { id: 'All', count: submissions.length },
                  { id: 'Active', count: activeApplicantsCount },
                  { id: 'Closed', count: closedApplicantsCount },
                ] as const).map((t) => (
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
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={applicantSearch}
                  onChange={(e) => setApplicantSearch(e.target.value)}
                  placeholder="Filter applicants or notes..."
                  className="pl-8 pr-3 py-1 text-xs border border-slate-200 rounded-lg bg-white w-full sm:w-52 text-slate-700 focus:outline-none focus:border-brand-600"
                />
              </div>
            )}
          </div>

          {submissions.length === 0 ? (
            <div className="p-4">
              <div className="py-12 px-4 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-3">
                <p>No applicants attached yet. Open the candidate picker to attach bench consultants.</p>
                <button
                  type="button"
                  onClick={() => setShowBenchPicker(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Attach Bench Applicants</span>
                </button>
              </div>
            </div>
          ) : filteredSubmissions.length === 0 ? (
            <div className="p-4">
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
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase">
                    <tr>
                      <th className="px-4 py-2.5">Applicant</th>
                      <th className="px-3 py-2.5 whitespace-nowrap">Rate</th>
                      <th className="px-3 py-2.5 whitespace-nowrap">Stage</th>
                      <th className="px-4 py-2.5 text-right whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applicantsPg.pagedItems.map((sub, idx) => {
                      const candObj = resolveCandidateForSubmission(sub);
                      const placed = isPlacedApplicant(sub);
                      const isLegacy = sub.id.startsWith('legacy_');
                      const applicantStageOptions = buildApplicantStageOptions(taxonomies.stages, sub.stage);
                      const stageIdx = getStageIndex(sub.stage, taxonomies.stages);
                      const initials = sub.fullName
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase();
                      const formattedInterview = formatDateTimeBadge(sub.interviewDateTime || sub.interviewDate);
                      const subNotes = sub.notes || [];
                      const isClosedStage = sub.stage.trim().toLowerCase() === 'closed';
                      const rowBorder = idx > 0 ? 'border-t border-slate-100' : '';

                      return (
                        <React.Fragment key={sub.id}>
                          <tr className={`${rowBorder} hover:bg-slate-50/70 transition-colors align-top`}>
                            <td className={`px-4 pt-3 ${subNotes.length > 0 ? 'pb-2' : 'pb-3'} min-w-[260px]`}>
                              <div className="flex items-start gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-[11px] flex-shrink-0 mt-0.5">
                                  {initials}
                                </div>
                                <div className="min-w-0 flex-1 space-y-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {candObj ? (
                                      <button
                                        type="button"
                                        onClick={() => onOpenResumePreview(candObj)}
                                        className="font-bold text-slate-900 hover:text-brand-600 text-[12.5px] text-left cursor-pointer"
                                      >
                                        {sub.fullName}
                                      </button>
                                    ) : (
                                      <span className="font-bold text-slate-900 text-[12.5px]">
                                        {sub.fullName}
                                      </span>
                                    )}
                                    {sub.workAuth && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium whitespace-nowrap">
                                        {sub.workAuth}
                                      </span>
                                    )}
                                    {placed && (
                                      <StatusBadge label="Active Placement" tone="emerald" size="xs" />
                                    )}
                                    {formattedInterview && (
                                      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-brand-50 text-brand-700 border border-brand-200/80 font-medium whitespace-nowrap">
                                        <Calendar className="w-2.5 h-2.5 shrink-0" />
                                        <span>{formattedInterview}</span>
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-slate-500 leading-snug flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                                    <span className="font-medium text-slate-600">
                                      {sub.currentTitle || 'Consultant'}
                                    </span>
                                    {sub.submissionDate && (
                                      <span className="whitespace-nowrap">&bull; Attached {sub.submissionDate}</span>
                                    )}
                                    {sub.recruiterName && (
                                      <span className="whitespace-nowrap">&bull; by {sub.recruiterName}</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className={`px-3 pt-3 ${subNotes.length > 0 ? 'pb-2' : 'pb-3'} whitespace-nowrap text-slate-700`}>
                              {sub.hourlyRate ? (
                                <MaskedValue value={formatRate(sub.hourlyRate)} isMasked={rateMasked} />
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>

                            <td className={`px-3 pt-3 ${subNotes.length > 0 ? 'pb-2' : 'pb-3'} whitespace-nowrap`}>
                              {!isLegacy && onUpdateSubmissionStage ? (
                                <CustomSelect
                                  ariaLabel={`Stage for ${sub.fullName}`}
                                  disabled={busySubId === sub.id}
                                  value={sub.stage}
                                  size="xs"
                                  fullWidth={false}
                                  minMenuWidth={145}
                                  prefixNode={
                                    busySubId === sub.id ? (
                                      <Loader2 className="w-2.5 h-2.5 text-brand-600 animate-spin shrink-0" />
                                    ) : undefined
                                  }
                                  options={applicantStageOptions.map((st) => ({
                                    value: st,
                                    label: st,
                                    dotClass: getStageDotClass(
                                      st,
                                      getStageIndex(st, taxonomies.stages)
                                    ),
                                  }))}
                                  onChange={async (nextVal) => {
                                    const nextStage = nextVal as RequirementSubmission['stage'];
                                    const nextLower = nextStage.trim().toLowerCase();
                                    if (nextLower === 'onboarding' && !placed) {
                                      onOpenPlacementWizard(requirement, candObj);
                                      return;
                                    }
                                    setBusySubId(sub.id);
                                    try {
                                      await onUpdateSubmissionStage(requirement, sub.id, nextStage);
                                      if (
                                        onUpdateSubmissionNotes &&
                                        (nextLower === 'interview' || nextLower === 'closed')
                                      ) {
                                        openNotesEditor({ ...sub, stage: nextStage });
                                      }
                                    } catch {
                                      // Error toast handled by caller; keep select synced to persisted stage
                                    } finally {
                                      setBusySubId(null);
                                    }
                                  }}
                                />
                              ) : (
                                <StatusBadge
                                  stage={sub.stage}
                                  dotClass={getStageDotClass(sub.stage, stageIdx)}
                                  size="xs"
                                />
                              )}
                            </td>

                            <td className={`px-4 pt-3 ${subNotes.length > 0 ? 'pb-2' : 'pb-3'} text-right whitespace-nowrap`}>
                              <div className="inline-flex items-center gap-1.5">
                                {!isLegacy && onUpdateSubmissionNotes && (
                                  <button
                                    type="button"
                                    onClick={() => openNotesEditor(sub)}
                                    className={`px-2 py-1 rounded-md border text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap ${
                                      editingNotesSub?.id === sub.id
                                        ? 'bg-brand-50 border-brand-300 text-brand-700'
                                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                    }`}
                                  >
                                    <MessageSquare className="w-3 h-3" />
                                    <span>{subNotes.length > 0 ? `Notes (${subNotes.length})` : 'Add Note'}</span>
                                  </button>
                                )}

                                {candObj && (
                                  <button
                                    type="button"
                                    onClick={() => onOpenResumePreview(candObj)}
                                    className="px-2 py-1 rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 text-[11px] font-semibold cursor-pointer whitespace-nowrap"
                                  >
                                    Profile
                                  </button>
                                )}

                                {!placed && !isPositionsFull && (
                                  <button
                                    type="button"
                                    onClick={() => onOpenPlacementWizard(requirement, candObj)}
                                    className="px-2 py-1 rounded-md bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-[11px] font-semibold cursor-pointer transition-colors whitespace-nowrap"
                                  >
                                    Place
                                  </button>
                                )}

                                {!isLegacy && onDetachSubmission && (
                                  confirmDetachId === sub.id ? (
                                    <div className="inline-flex items-center gap-1 bg-rose-50 border border-rose-200 rounded-md px-1.5 py-0.5 whitespace-nowrap">
                                      <ActionButton
                                        type="button"
                                        loading={busySubId === sub.id}
                                        loadingText="Removing..."
                                        spinnerClassName="w-2.5 h-2.5 animate-spin flex-shrink-0"
                                        onClick={async () => {
                                          if (busySubId === sub.id) return;
                                          setBusySubId(sub.id);
                                          try {
                                            await onDetachSubmission(requirement, sub.id);
                                            setConfirmDetachId(null);
                                          } finally {
                                            setBusySubId(null);
                                          }
                                        }}
                                        className="text-[10px] font-bold text-rose-700 hover:underline cursor-pointer"
                                      >
                                        Remove
                                      </ActionButton>
                                      <span className="text-slate-300">|</span>
                                      <button
                                        type="button"
                                        onClick={() => setConfirmDetachId(null)}
                                        className="text-[10px] text-slate-500 hover:text-slate-700 cursor-pointer"
                                      >
                                        No
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDetachId(sub.id)}
                                      title={`Detach ${sub.fullName} from requirement`}
                                      className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors cursor-pointer flex-shrink-0"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )
                                )}
                              </div>
                            </td>
                          </tr>

                          {subNotes.length > 0 && (
                            <tr>
                              <td colSpan={4} className="pl-[58px] pr-4 pb-3 pt-0.5">
                                <div className="rounded-lg border border-slate-200/80 bg-slate-50/75 divide-y divide-slate-200/60">
                                  {subNotes.map((note) => {
                                    const noteTime = formatDateTimeBadge(note.updatedAt || note.createdAt);
                                    const isNoteClosed =
                                      (note.stage || '').trim().toLowerCase() === 'closed' || isClosedStage;
                                    return (
                                      <div
                                        key={note.id}
                                        className="px-3 py-2 flex items-start justify-between gap-3 text-[11px]"
                                      >
                                        <div className="min-w-0 flex-1 space-y-0.5">
                                          <div className="flex items-center gap-1.5 text-[10.5px] text-slate-400 flex-wrap">
                                            <span className="font-semibold text-slate-700 whitespace-nowrap">
                                              {note.authorName}
                                            </span>
                                            {noteTime && (
                                              <span className="whitespace-nowrap">&bull; {noteTime}</span>
                                            )}
                                            {note.updatedAt && (
                                              <span className="whitespace-nowrap">(edited)</span>
                                            )}
                                            {isNoteClosed && (
                                              <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 font-medium whitespace-nowrap">
                                                Rejection Feedback
                                              </span>
                                            )}
                                          </div>
                                          <p className="text-slate-700 whitespace-pre-line break-words leading-relaxed">
                                            {note.text}
                                          </p>
                                        </div>
                                        {!isLegacy && onUpdateSubmissionNotes && (
                                          <div className="flex items-center gap-0.5 flex-shrink-0">
                                            <button
                                              type="button"
                                              disabled={busyNoteId === note.id}
                                              onClick={() => openNotesEditor(sub, note)}
                                              title="Edit note"
                                              aria-label={`Edit note by ${note.authorName}`}
                                              className="p-1 rounded text-slate-400 hover:text-brand-600 hover:bg-white transition-colors cursor-pointer"
                                            >
                                              <Pencil className="w-3 h-3" />
                                            </button>
                                            <button
                                              type="button"
                                              disabled={busyNoteId === note.id}
                                              onClick={() => handleDeleteSubmissionNote(sub, note.id)}
                                              title="Delete note"
                                              aria-label={`Delete note by ${note.authorName}`}
                                              className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                            >
                                              {busyNoteId === note.id ? (
                                                <Loader2 className="w-3 h-3 animate-spin" />
                                              ) : (
                                                <Trash2 className="w-3 h-3" />
                                              )}
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <TablePagination
                page={applicantsPg.page}
                limit={applicantsPg.limit}
                total={applicantsPg.total}
                onPageChange={applicantsPg.setPage}
                onLimitChange={applicantsPg.setLimit}
                itemLabel="applicants"
                pageSizeOptions={[5, 10, 20, 50]}
              />
            </>
          )}
        </div>

        {/* Right Sidebar: Requisition Brief & Details */}
        <aside className="lg:col-span-4 space-y-4 lg:sticky lg:top-4">
          {/* Fulfillment & Targets Card */}
          <div className="bg-white rounded-xl border border-slate-200/80 card-shadow p-4 space-y-3.5 text-xs">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Requisition Summary
            </h3>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-2.5">
                <span className="text-[10px] font-semibold uppercase text-slate-400 block">
                  Open Positions
                </span>
                <span className="text-base font-bold text-slate-900 mt-0.5 block">
                  {openPositions}
                </span>
              </div>
              <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-2.5 space-y-1.5">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-semibold uppercase text-slate-400">
                    Filled / Placed
                  </span>
                </div>
                <span
                  className={`text-base font-bold block leading-none ${
                    isPositionsFull ? 'text-emerald-700' : 'text-slate-900'
                  }`}
                >
                  {filledPositions} / {openPositions}
                </span>
                <div className="w-full h-1.5 rounded-full bg-slate-200/80 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      isPositionsFull ? 'bg-emerald-500' : 'bg-brand-600'
                    }`}
                    style={{
                      width: `${Math.min(100, Math.round((filledPositions / openPositions) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            <dl className="space-y-2.5 pt-1 border-t border-slate-100">
              <div className="flex items-start justify-between gap-2">
                <dt className="text-slate-400 font-medium">Client</dt>
                <dd className="text-slate-900 font-semibold text-right">{requirement.companyName}</dd>
              </div>
              <div className="flex items-start justify-between gap-2">
                <dt className="text-slate-400 font-medium">Hiring Contact</dt>
                <dd className="text-slate-800 font-medium text-right">
                  {clientContactLabel}
                  {clientContactTitle ? (
                    <span className="block text-[10px] text-slate-400">{clientContactTitle}</span>
                  ) : null}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-2">
                <dt className="text-slate-400 font-medium">Assigned Recruiter</dt>
                <dd className="text-slate-800 font-medium text-right">{assignedRecruiterLabel}</dd>
              </div>
              <div className="flex items-start justify-between gap-2">
                <dt className="text-slate-400 font-medium">Location</dt>
                <dd className="text-slate-800 font-medium text-right">{requirement.location}</dd>
              </div>
              {requirement.targetBillRate ? (
                <div className="flex items-start justify-between gap-2">
                  <dt className="text-slate-400 font-medium">Target Bill Rate</dt>
                  <dd className="text-slate-900 font-semibold text-right">
                    <MaskedValue
                      value={`${currencySymbol}${requirement.targetBillRate}/hr`}
                      isMasked={rateMasked}
                    />
                  </dd>
                </div>
              ) : null}
              {requirement.targetPayRate ? (
                <div className="flex items-start justify-between gap-2">
                  <dt className="text-slate-400 font-medium">Target Pay Rate</dt>
                  <dd className="text-slate-800 font-medium text-right">
                    <MaskedValue
                      value={`${currencySymbol}${requirement.targetPayRate}/hr`}
                      isMasked={rateMasked}
                    />
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>

          {/* Required Competencies Card */}
          <div className="bg-white rounded-xl border border-slate-200/80 card-shadow p-4 space-y-2.5 text-xs">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Required Competencies
            </h3>
            {skills.length === 0 ? (
              <p className="text-slate-400 text-[11px]">No specific skills listed.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {skills.map((s, idx) => (
                  <span
                    key={idx}
                    className="text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-medium"
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>

          {customFieldEntries.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200/80 card-shadow p-4 space-y-2.5 text-xs">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Custom Attributes
              </h3>
              <dl className="space-y-1.5">
                {customFieldEntries.map(([k, v]) => (
                  <div key={k} className="flex items-start justify-between gap-2">
                    <dt className="text-slate-400 font-medium capitalize">
                      {k.replace(/_/g, ' ')}
                    </dt>
                    <dd className="text-slate-800 font-medium text-right">{String(v)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </aside>
      </div>

      {/* Right Slide-Over Bench Candidate Picker Drawer */}
      {showBenchPicker && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-[1px] animate-fade-in"
          onClick={() => !isAttaching && setShowBenchPicker(false)}
        >
          <div
            className="w-full max-w-xl bg-white h-full border-l border-slate-200 shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-slate-900">Attach Bench Candidates</h4>
                <p className="text-[11px] text-slate-500 truncate mt-0.5">
                  {requirement.code} &bull; {requirement.opportunityTitle}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {onOpenCsvImport && (
                  <button
                    type="button"
                    disabled={isAttaching}
                    onClick={() => {
                      setShowBenchPicker(false);
                      onOpenCsvImport(requirement);
                    }}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-800 inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                    title="Import candidates from CSV and attach directly to this requirement"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Import CSV</span>
                  </button>
                )}
                <button
                  type="button"
                  disabled={isAttaching}
                  onClick={() => setShowBenchPicker(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
                  aria-label="Close candidate picker"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-2 flex-wrap bg-white">
              <div className="text-[11px] font-semibold text-slate-500">
                {totalBenchCount} consultant{totalBenchCount === 1 ? '' : 's'}
                {pagedCandidates.length < totalBenchCount
                  ? ` • showing ${pagedCandidates.length}`
                  : ''}
              </div>
              <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-end">
                <CustomSelect
                  ariaLabel="Filter bench by work authorization"
                  value={benchWorkAuth}
                  onChange={setBenchWorkAuth}
                  size="sm"
                  fullWidth={false}
                  minMenuWidth={155}
                  options={[
                    { value: 'All', label: 'All Work Auth' },
                    ...taxonomies.workAuth.map((auth) => ({ value: auth, label: auth })),
                  ]}
                />
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    autoFocus
                    value={benchSearch}
                    onChange={(e) => setBenchSearch(e.target.value)}
                    placeholder="Search name, skills, or resume text..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-brand-600"
                  />
                </div>
              </div>
            </div>

            <div
              onScroll={handleBenchScroll}
              className="p-4 overflow-y-auto space-y-2 flex-1 min-h-0"
            >
              {isLoadingBench && pagedCandidates.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  Loading consultants...
                </div>
              ) : pagedCandidates.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  {benchSearch.trim() || benchWorkAuth !== 'All'
                    ? 'No consultants match your filter.'
                    : 'No bench consultants available to assign yet.'}
                </div>
              ) : (
                <>
                  {pagedCandidates.map((con) => {
                    const alreadyAttached = attachedCandidateIdSet.has(con.id);
                    const isChecked = alreadyAttached || selectedCandidateIds.includes(con.id);
                    const dupWarnings = !alreadyAttached ? clientDuplicateMap[con.id] || [] : [];
                    const latestDup = dupWarnings[0];
                    const cvExcerpt = benchSearch.trim()
                      ? extractResumeMatchExcerpt(con.rawSnippet, benchSearch)
                      : null;

                    return (
                      <div
                        key={con.id}
                        onClick={() => !alreadyAttached && toggleCandidateSelection(con.id)}
                        className={`p-3 rounded-xl border flex flex-col gap-1.5 transition-all ${
                          alreadyAttached
                            ? 'bg-emerald-50/40 border-emerald-200/70 opacity-75 cursor-default'
                            : isChecked
                            ? 'bg-brand-50/60 border-brand-500 cursor-pointer'
                            : latestDup
                            ? 'bg-amber-50/30 border-amber-200 hover:border-amber-400 cursor-pointer'
                            : 'bg-white border-slate-200 hover:border-brand-400 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                                alreadyAttached
                                  ? 'bg-emerald-600 border-emerald-600 text-white'
                                  : isChecked
                                  ? 'bg-brand-600 border-brand-600 text-white'
                                  : 'bg-white border-slate-300'
                              }`}
                            >
                              {isChecked && <Check className="w-3 h-3" strokeWidth={3} />}
                            </span>
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5 flex-wrap">
                                <span className="truncate">{con.fullName}</span>
                                <span className="text-[10px] font-normal text-slate-400">({con.workAuth})</span>
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                                {con.currentTitle} &bull;{' '}
                                <MaskedValue value={formatRate(con.hourlyRate)} isMasked={rateMasked} />
                              </div>
                            </div>
                          </div>

                          {alreadyAttached ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-500/[0.1] text-emerald-800 text-[10px] font-semibold flex-shrink-0">
                              Attached
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={isAttaching}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleQuickSingleAttach(con);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-[10px] font-semibold transition-colors flex-shrink-0 cursor-pointer"
                            >
                              {latestDup ? 'Attach Anyway' : 'Quick Attach'}
                            </button>
                          )}
                        </div>

                        {cvExcerpt && (
                          <div className="pl-6 text-[10px] text-brand-700 truncate">
                            CV match: {cvExcerpt}
                          </div>
                        )}

                        {latestDup && (
                          <div className="ml-6 inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-50 border border-amber-200 text-amber-900 text-[10px] font-medium">
                            <AlertTriangle className="w-3 h-3 text-amber-600 flex-shrink-0" />
                            <span>
                              Already submitted to <strong>{latestDup.clientName}</strong>{' '}
                              {latestDup.daysAgo === 0
                                ? 'today'
                                : latestDup.daysAgo === 1
                                ? '1 day ago'
                                : `${latestDup.daysAgo} days ago`}{' '}
                              on <span className="font-mono font-semibold">{latestDup.requirementCode}</span> (
                              {latestDup.stage}
                              {latestDup.recruiterName ? ` • by ${latestDup.recruiterName}` : ''})
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {isLoadingMoreBench && (
                    <div className="py-2 text-center text-[10px] font-medium text-slate-400">
                      Loading next {BENCH_PAGE_SIZE} consultants...
                    </div>
                  )}
                  {!isLoadingMoreBench && hasMoreBench && (
                    <div className="py-1.5 text-center text-[10px] text-slate-400">
                      Scroll to load more ({pagedCandidates.length} of {totalBenchCount})
                    </div>
                  )}
                </>
              )}
            </div>

            {(() => {
              const selectedDupCount = selectedCandidateIds.filter(
                (id) => (clientDuplicateMap[id]?.length || 0) > 0
              ).length;
              return (
                <div className="bg-slate-50 border-t border-slate-200 flex-shrink-0">
                  {selectedDupCount > 0 && (
                    <div className="px-5 py-2 bg-amber-50 border-b border-amber-200 flex items-center gap-2 text-[11px] text-amber-900 font-medium">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                      <span>
                        {selectedDupCount} selected consultant{selectedDupCount === 1 ? ' was' : 's were'}{' '}
                        previously submitted to <strong>{requirement.companyName}</strong> on another requisition. Confirm before attaching to avoid duplicate client outreach.
                      </span>
                    </div>
                  )}
                  <div className="px-5 py-3.5 flex items-center justify-between gap-3">
                    <span className="text-xs font-medium text-slate-600">
                      {selectedCandidateIds.length > 0
                        ? `${selectedCandidateIds.length} consultant${selectedCandidateIds.length === 1 ? '' : 's'} selected`
                        : 'Select one or more candidates'}
                    </span>
                    <div className="flex items-center gap-2">
                      {selectedCandidateIds.length > 0 && (
                        <button
                          type="button"
                          disabled={isAttaching}
                          onClick={() => setSelectedCandidateIds([])}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-colors cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={isAttaching}
                        onClick={() => setShowBenchPicker(false)}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <ActionButton
                        type="button"
                        loading={isAttaching}
                        loadingText="Attaching..."
                        disabled={selectedCandidateIds.length === 0}
                        onClick={handleBatchAttach}
                        className={`px-4 py-1.5 rounded-lg disabled:opacity-50 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer ${
                          selectedDupCount > 0
                            ? 'bg-amber-600 hover:bg-amber-700'
                            : 'bg-brand-600 hover:bg-brand-700'
                        }`}
                      >
                        {selectedDupCount > 0
                          ? `Attach Anyway (${selectedCandidateIds.length})`
                          : `Attach ${selectedCandidateIds.length || ''} Applicant${selectedCandidateIds.length === 1 ? '' : 's'}`}
                      </ActionButton>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Applicant Call Notes, Interview Schedule & Rejection Feedback Modal */}
      {editingNotesSub && (() => {
        const liveEditingSub =
          submissions.find((s) => s.id === editingNotesSub.id) || editingNotesSub;
        const isClosedModalStage = liveEditingSub.stage.trim().toLowerCase() === 'closed';
        const modalStageIdx = getStageIndex(liveEditingSub.stage, taxonomies.stages);
        const modalInitials = liveEditingSub.fullName
          .split(' ')
          .map((n) => n[0])
          .join('')
          .slice(0, 2)
          .toUpperCase();
        const prevDate = liveEditingSub.interviewDateTime || liveEditingSub.interviewDate || '';
        const dateChanged = draftInterviewDate !== prevDate;
        const hasNoteText = Boolean(draftNotesText.trim());
        const submitDisabled =
          isSavingNotes ||
          (editingNoteId ? !hasNoteText : !hasNoteText && !dateChanged);
        const submitLabel = editingNoteId
          ? 'Update Note'
          : hasNoteText
          ? 'Add Note'
          : 'Save Schedule';

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[1px] animate-fade-in"
            onClick={() => !isSavingNotes && setEditingNotesSub(null)}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveSubmissionNotes();
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-visible flex flex-col animate-fade-in"
            >
              {/* Modal Header */}
              <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 rounded-t-2xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-white border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
                    {modalInitials}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-slate-900 truncate">
                        {liveEditingSub.fullName}
                      </h4>
                      <StatusBadge
                        stage={liveEditingSub.stage}
                        dotClass={getStageDotClass(liveEditingSub.stage, modalStageIdx)}
                        size="xs"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      {requirement.code} &bull; {requirement.opportunityTitle}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isSavingNotes}
                  onClick={() => setEditingNotesSub(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
                  aria-label="Close notes dialog"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 space-y-4 overflow-visible">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1.5">
                    Interview Date &amp; Time
                  </label>
                  <DateTimePicker
                    value={draftInterviewDate}
                    onChange={setDraftInterviewDate}
                    placeholder="Select interview date & time..."
                    ariaLabel={`Interview date for ${liveEditingSub.fullName}`}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                    <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isClosedModalStage ? 'bg-rose-500' : 'bg-brand-600'
                        }`}
                      />
                      <span>
                        {editingNoteId
                          ? 'Edit Note'
                          : isClosedModalStage
                          ? 'Add Rejection Feedback'
                          : 'Add Call / Interview Note'}
                      </span>
                    </label>
                  </div>

                  {isClosedModalStage && (
                    <div className="flex items-center gap-1.5 flex-wrap mb-2">
                      {QUICK_REJECTION_REASONS.map((reason) => (
                        <button
                          key={reason}
                          type="button"
                          onClick={() =>
                            setDraftNotesText((prev) => {
                              const clean = prev.trim();
                              if (!clean) return reason;
                              if (clean.toLowerCase().includes(reason.toLowerCase())) return prev;
                              return `${clean}\n${reason}`;
                            })
                          }
                          className="px-2 py-0.5 rounded-md bg-rose-50/70 hover:bg-rose-100/80 border border-rose-200/80 text-[10.5px] font-medium text-rose-700 transition-colors cursor-pointer"
                        >
                          + {reason}
                        </button>
                      ))}
                    </div>
                  )}

                  <textarea
                    rows={4}
                    autoFocus
                    aria-label={`Call notes and feedback for ${liveEditingSub.fullName}`}
                    value={draftNotesText}
                    onChange={(e) => setDraftNotesText(e.target.value)}
                    placeholder={
                      isClosedModalStage
                        ? 'Why did the client reject or close out this applicant? (e.g. Budget ceiling, needed hands-on GCP)'
                        : 'Log recruiter call summary, Round 1/2 debrief, or client feedback...'
                    }
                    className="w-full px-3 py-2.5 text-xs border border-slate-200 rounded-lg bg-slate-50/40 focus:bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-500/10 transition-colors"
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 rounded-b-2xl flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={isSavingNotes}
                  onClick={() => setEditingNotesSub(null)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <ActionButton
                  type="submit"
                  loading={isSavingNotes}
                  loadingText="Saving..."
                  disabled={submitDisabled}
                  spinnerClassName="w-3.5 h-3.5 animate-spin flex-shrink-0"
                  className="px-4 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                >
                  {submitLabel}
                </ActionButton>
              </div>
            </form>
          </div>
        );
      })()}

      {/* Edit Requisition Details Modal */}
      {isEditing && editForm && (
        <div
          onClick={() => !isSavingEdit && setIsEditing(false)}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col animate-fade-in max-h-[92vh]"
          >
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-[#141615] text-white shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white shrink-0">
                  <Pencil className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-white truncate">
                    Edit Requisition Details
                  </h2>
                  <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                    {requirement.code} &bull; {requirement.opportunityTitle}
                  </div>
                </div>
              </div>
              <button
                type="button"
                disabled={isSavingEdit}
                onClick={() => setIsEditing(false)}
                aria-label="Close modal"
                className="text-slate-400 hover:text-white w-7 h-7 rounded flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              noValidate
              onSubmit={async (e) => {
                e.preventDefault();
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
                  // Error toast handled by parent handler; keep edit form open
                } finally {
                  setIsSavingEdit(false);
                }
              }}
              className="flex flex-col flex-1 overflow-hidden"
            >
              <div className="p-6 overflow-y-auto space-y-4 text-xs flex-1">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Opportunity Title *
                    </label>
                    <input
                      type="text"
                      required
                      value={editForm.opportunityTitle}
                      onChange={(e) =>
                        setEditForm({ ...editForm, opportunityTitle: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:border-brand-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Client Company *
                    </label>
                    <input
                      type="text"
                      required
                      value={editForm.companyName}
                      onChange={(e) => setEditForm({ ...editForm, companyName: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:border-brand-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Location
                    </label>
                    <input
                      type="text"
                      value={editForm.location}
                      onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:border-brand-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      No. of Open Positions *
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={1000}
                      step={1}
                      value={editOpenPositions}
                      onChange={(e) => {
                        setEditOpenPositions(e.target.value);
                        if (editOpenPosError) setEditOpenPosError('');
                      }}
                      className={`w-full px-3 py-2 border rounded-lg text-xs bg-white focus:outline-none ${
                        editOpenPosError
                          ? 'border-rose-400 focus:border-rose-500'
                          : 'border-slate-200 focus:border-brand-600'
                      }`}
                    />
                    {editOpenPosError && (
                      <p className="text-[10px] font-semibold text-rose-600 mt-1">
                        {editOpenPosError}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Stage
                    </label>
                    <CustomSelect
                      value={editForm.status}
                      onChange={(val) =>
                        setEditForm({ ...editForm, status: val as Requirement['status'] })
                      }
                      ariaLabel="Stage"
                      options={buildRequirementStageOptions(taxonomies.stages, editForm.status).map(
                        (s) => ({
                          value: s,
                          label: s,
                          dotClass: getStageDotClass(s, getStageIndex(s, taxonomies.stages)),
                        })
                      )}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Assigned Recruiter
                    </label>
                    <input
                      type="text"
                      value={editForm.assignedRecruiter || ''}
                      onChange={(e) =>
                        setEditForm({ ...editForm, assignedRecruiter: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:border-brand-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Required Competencies
                  </label>
                  <SkillTagInput
                    value={editForm.skillsRequired}
                    onChange={(nextCsv) => setEditForm({ ...editForm, skillsRequired: nextCsv })}
                  />
                </div>
              </div>

              <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  disabled={isSavingEdit}
                  onClick={() => setIsEditing(false)}
                  className="px-3.5 py-1.5 border border-slate-200 bg-white rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
                >
                  Cancel
                </button>
                <ActionButton
                  type="submit"
                  loading={isSavingEdit}
                  loadingText="Saving..."
                  className="px-4 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Save Requirement
                </ActionButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
