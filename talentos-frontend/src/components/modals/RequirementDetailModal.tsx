import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Check,
  FileSpreadsheet,
  Pencil,
  Search,
  Trash2,
  UserPlus,
  UsersRound,
  X,
} from 'lucide-react';
import { apiClient } from '../../config/api.config';
import { Requirement, Candidate, RequirementSubmission } from '../../types';
import { useCurrency } from '../../utils/currency';
import { useDebounce } from '../../utils/useDebounce';
import { mapCandidateFromApi, mapRequirementFromApi } from '../../utils/entityMappers';

interface RequirementDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  requirement: Requirement | null;
  candidates: Candidate[];
  onAssignCandidate: (req: Requirement, candidate: Candidate) => void;
  onAttachCandidates?: (req: Requirement, candidateIds: string[]) => Promise<void> | void;
  onUpdateSubmissionStage?: (
    req: Requirement,
    submissionId: string,
    stage: RequirementSubmission['stage']
  ) => Promise<void> | void;
  onDetachSubmission?: (req: Requirement, submissionId: string) => Promise<void> | void;
  onOpenResumePreview: (candidate: Candidate) => void;
  onOpenPitchWriter: (req: Requirement, candidate?: Candidate | null) => void;
  onOpenPlacementWizard: (req: Requirement, candidate?: Candidate | null) => void;
  onUpdateReq?: (req: Requirement) => void;
}

const BENCH_PAGE_SIZE = 50;

const SUBMISSION_STAGES: RequirementSubmission['stage'][] = [
  'Submitted',
  'Interview',
  'Selected',
  'Onboarding',
  'Closed',
];

const getSubStageClass = (stage: RequirementSubmission['stage']) => {
  switch (stage) {
    case 'Submitted':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'Interview':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'Selected':
      return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'Onboarding':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'Closed':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
};

export const RequirementDetailModal: React.FC<RequirementDetailModalProps> = ({
  isOpen,
  onClose,
  requirement,
  candidates,
  onAssignCandidate,
  onAttachCandidates,
  onUpdateSubmissionStage,
  onDetachSubmission,
  onOpenResumePreview,
  onOpenPitchWriter,
  onOpenPlacementWizard,
  onUpdateReq,
}) => {
  const { formatRate } = useCurrency();
  const [showBenchPicker, setShowBenchPicker] = useState(false);
  const [benchSearch, setBenchSearch] = useState('');
  const debouncedBenchSearch = useDebounce(benchSearch, 250);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [isAttaching, setIsAttaching] = useState(false);
  const [busySubId, setBusySubId] = useState<string | null>(null);
  const [confirmDetachId, setConfirmDetachId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
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
    setShowBenchPicker(false);
    setSelectedCandidateIds([]);
    setBenchSearch('');
    setConfirmDetachId(null);
    setBenchPage(1);
    setPagedCandidates(candidates.slice(0, BENCH_PAGE_SIZE));
    setTotalBenchCount(candidates.length);
    setHasMoreBench(candidates.length > BENCH_PAGE_SIZE);
  }, [requirement?.id, isOpen]);

  useEffect(() => {
    setHydratedReq(null);
    if (!isOpen || !requirement?.id) return;
    if ((!requirement.submissions || requirement.submissions.length === 0) && (requirement.submissionCount ?? 0) > 0) {
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
    }
  }, [requirement?.id, isOpen]);

  useEffect(() => {
    if (isOpen && requirement) {
      setEditForm(requirement);
      if (Array.isArray(requirement.submissions) && requirement.submissions.length > 0) {
        setHydratedReq(null);
      }
    }
  }, [requirement, isOpen]);

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
    const q = debouncedBenchSearch.trim().toLowerCase();
    return candidates.filter((c) => {
      if (!q) return true;
      return (
        c.fullName.toLowerCase().includes(q) ||
        (c.currentTitle || '').toLowerCase().includes(q) ||
        (c.skillset || '').toLowerCase().includes(q) ||
        (c.workAuth || '').toLowerCase().includes(q)
      );
    });
  }, [candidates, debouncedBenchSearch]);

  const pickerActive = Boolean(isOpen && requirement && (showBenchPicker || submissions.length === 0));

  useEffect(() => {
    if (!pickerActive) return;
    let active = true;
    const searchTerm = debouncedBenchSearch.trim();
    activeSearchRef.current = searchTerm;
    setIsLoadingBench(true);

    apiClient
      .get('/candidates', {
        params: {
          page: 1,
          limit: BENCH_PAGE_SIZE,
          search: searchTerm || undefined,
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
  }, [pickerActive, debouncedBenchSearch]);

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
      setIsLoadingMoreBench(true);

      apiClient
        .get('/candidates', {
          params: {
            page: nextPage,
            limit: BENCH_PAGE_SIZE,
            search: searchTerm || undefined,
          },
        })
        .then((res) => {
          if (activeSearchRef.current !== searchTerm) return;
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
          if (activeSearchRef.current !== searchTerm) return;
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
      filteredLocalCandidates,
      hasMoreBench,
      isLoadingBench,
      isLoadingMoreBench,
    ]
  );

  if (!isOpen || !requirement) return null;

  const openPositions = requirement.openPositions || 1;
  const filledPositions =
    requirement.filledPositions ?? requirement.activePlacements?.length ?? 0;
  const isPositionsFull = filledPositions >= openPositions;
  const activeApplicantsCount = submissions.filter((s) => s.stage !== 'Closed').length;

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

  const getStatusBadge = (status: Requirement['status']) => {
    switch (status) {
      case 'Submitted':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Interview':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Selected':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Onboarding':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const skills = requirement.skillsRequired
    ? requirement.skillsRequired.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden flex flex-col animate-fade-in max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                {requirement.code}
              </span>
              <h2 className="text-sm font-bold text-slate-900">{requirement.opportunityTitle}</h2>
            </div>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              {requirement.companyName} &bull; {requirement.location}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onUpdateReq && (
              <button
                onClick={() => {
                  setEditForm(requirement);
                  setEditOpenPositions(String(requirement.openPositions || 1));
                  setEditOpenPosError('');
                  setIsEditing((prev) => !prev);
                }}
                className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isEditing
                    ? 'bg-slate-900 border-slate-900 text-white'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Pencil className="w-3 h-3" />
                <span>{isEditing ? 'Viewing' : 'Edit'}</span>
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Close modal"
              className="text-slate-400 hover:text-slate-700 w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs flex-1 min-h-0">
          {isEditing && editForm ? (
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                const trimmed = editOpenPositions.trim();
                const parsed = Number(trimmed);
                if (!trimmed || !/^\d+$/.test(trimmed) || !Number.isInteger(parsed) || parsed < 1 || parsed > 1000) {
                  setEditOpenPosError('Please enter at least 1 open position.');
                  return;
                }
                if (onUpdateReq) onUpdateReq({ ...editForm, openPositions: parsed });
                setEditOpenPosError('');
                setIsEditing(false);
              }}
              className="space-y-3.5 bg-slate-50 p-4 rounded-xl border border-slate-200"
            >
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Opportunity Title</label>
                <input
                  type="text"
                  required
                  value={editForm.opportunityTitle}
                  onChange={(e) => setEditForm({ ...editForm, opportunityTitle: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:border-brand-600 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Client Company</label>
                  <input
                    type="text"
                    required
                    value={editForm.companyName}
                    onChange={(e) => setEditForm({ ...editForm, companyName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:border-brand-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Location</label>
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
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">No. of Open Positions *</label>
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
                      editOpenPosError ? 'border-rose-400 focus:border-rose-500' : 'border-slate-200 focus:border-brand-600'
                    }`}
                  />
                  {editOpenPosError && (
                    <p className="text-[10px] font-semibold text-rose-600 mt-1">{editOpenPosError}</p>
                  )}
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Stage</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value as Requirement['status'] })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:border-brand-600 focus:outline-none cursor-pointer"
                  >
                    {(['Requirement', 'Submitted', 'Interview', 'Selected', 'Onboarding'] as const).map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Assigned Recruiter</label>
                  <input
                    type="text"
                    value={editForm.assignedRecruiter || ''}
                    onChange={(e) => setEditForm({ ...editForm, assignedRecruiter: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:border-brand-600 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Required Competencies</label>
                <input
                  type="text"
                  value={editForm.skillsRequired}
                  onChange={(e) => setEditForm({ ...editForm, skillsRequired: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:border-brand-600 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1.5 border border-slate-200 bg-white rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Save Requirement
                </button>
              </div>
            </form>
          ) : null}
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div>
              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Client Contact</span>
              <span className="font-semibold text-slate-800 text-xs mt-0.5 block">
                {typeof requirement.clientContact === 'object' && requirement.clientContact !== null
                  ? (requirement.clientContact as any).fullName || (requirement.clientContact as any).name || 'Primary Hiring Lead'
                  : requirement.clientContact || 'Primary Hiring Lead'}{' '}
                {requirement.clientContactTitle
                  ? `(${
                      typeof requirement.clientContactTitle === 'object' && requirement.clientContactTitle !== null
                        ? (requirement.clientContactTitle as any).designation || ''
                        : requirement.clientContactTitle
                    })`
                  : ''}
              </span>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Assigned Recruiter</span>
              <span className="font-semibold text-slate-800 text-xs mt-0.5 block">
                {typeof requirement.assignedRecruiter === 'object' && requirement.assignedRecruiter !== null
                  ? (requirement.assignedRecruiter as any).fullName || (requirement.assignedRecruiter as any).name || 'Desk Sourcing Specialist'
                  : requirement.assignedRecruiter || 'Desk Sourcing Specialist'}
              </span>
            </div>
          </div>

          {/* Skillset Pills */}
          <div>
            <span className="font-bold text-slate-800 text-[11px] block mb-1.5">Required Competencies</span>
            <div className="flex flex-wrap gap-1.5">
              {skills.map((s, idx) => (
                <span
                  key={idx}
                  className="text-xs bg-brand-50 text-brand-700 border border-brand-200 px-2 py-0.5 rounded-md font-medium"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>

          {/* Headcount & Lifecycle Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Open Positions</span>
              <span className="text-xs font-extrabold text-slate-900">
                {openPositions} {openPositions === 1 ? 'Position' : 'Positions'}
              </span>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Filled / Placed</span>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-md border ${
                  filledPositions >= openPositions
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-white text-slate-700 border-slate-200'
                }`}
              >
                {filledPositions} / {openPositions} Placed
              </span>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Req Stage</span>
              <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${getStatusBadge(requirement.status)}`}>
                {requirement.status}
              </span>
            </div>
          </div>

          {/* Multi-Applicant Roster & Submissions Section */}
          <div className="pt-1 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UsersRound className="w-3.5 h-3.5 text-brand-600" />
                <span className="font-bold text-slate-800 text-[11px]">
                  Submitted Applicants ({submissions.length})
                </span>
                {submissions.length > 0 && activeApplicantsCount !== submissions.length && (
                  <span className="text-[10px] text-slate-400">({activeApplicantsCount} active)</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowBenchPicker(true)}
                className="text-brand-600 hover:text-brand-700 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
              >
                <UserPlus className="w-3 h-3" />
                <span>
                  {submissions.length > 0
                    ? 'Attach More Applicants'
                    : 'Attach Bench Applicants'}
                </span>
              </button>
            </div>

            {/* Attached Applicants List */}
            {submissions.length > 0 && (
              <div className="space-y-2">
                {submissions.map((sub) => {
                  const candObj = resolveCandidateForSubmission(sub);
                  const placed = isPlacedApplicant(sub);
                  const isLegacy = sub.id.startsWith('legacy_');
                  const initials = sub.fullName
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase();

                  return (
                    <div
                      key={sub.id}
                      className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-2xs hover:border-slate-300 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-brand-50 text-brand-700 border border-brand-200 flex items-center justify-center font-bold text-xs flex-shrink-0">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-slate-900 text-xs truncate">{sub.fullName}</span>
                            {sub.workAuth && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 font-medium">
                                {sub.workAuth}
                              </span>
                            )}
                            {placed && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                                Active Placement
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                            {sub.currentTitle || 'Consultant'}
                            {sub.hourlyRate ? ` • ${formatRate(sub.hourlyRate)}` : ''}
                            {sub.submissionDate ? ` • Attached ${sub.submissionDate}` : ''}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        {!isLegacy && onUpdateSubmissionStage ? (
                          <select
                            aria-label={`Stage for ${sub.fullName}`}
                            disabled={busySubId === sub.id}
                            value={sub.stage}
                            onChange={async (e) => {
                              const nextStage = e.target.value as RequirementSubmission['stage'];
                              if (nextStage === 'Onboarding' && !placed) {
                                onClose();
                                onOpenPlacementWizard(requirement, candObj);
                                return;
                              }
                              setBusySubId(sub.id);
                              try {
                                await onUpdateSubmissionStage(requirement, sub.id, nextStage);
                              } finally {
                                setBusySubId(null);
                              }
                            }}
                            className={`text-[10px] font-semibold px-2 py-1 rounded-md border cursor-pointer focus:outline-none ${getSubStageClass(sub.stage)}`}
                          >
                            {SUBMISSION_STAGES.map((st) => (
                              <option key={st} value={st} className="bg-white text-slate-800">
                                {st}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${getSubStageClass(sub.stage)}`}>
                            {sub.stage}
                          </span>
                        )}

                        {candObj && (
                          <button
                            type="button"
                            onClick={() => onOpenResumePreview(candObj)}
                            className="px-2 py-1 rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 text-[10px] font-semibold cursor-pointer"
                          >
                            Profile
                          </button>
                        )}

                        {!placed && !isPositionsFull && (
                          <button
                            type="button"
                            onClick={() => {
                              onOpenPlacementWizard(requirement, candObj);
                            }}
                            className="px-2 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] font-semibold cursor-pointer"
                          >
                            Place
                          </button>
                        )}

                        {!isLegacy && onDetachSubmission && (
                          confirmDetachId === sub.id ? (
                            <div className="inline-flex items-center gap-1 bg-rose-50 border border-rose-200 rounded-md px-1.5 py-0.5">
                              <button
                                type="button"
                                disabled={busySubId === sub.id}
                                onClick={async () => {
                                  setBusySubId(sub.id);
                                  try {
                                    await onDetachSubmission(requirement, sub.id);
                                    setConfirmDetachId(null);
                                  } finally {
                                    setBusySubId(null);
                                  }
                                }}
                                className="text-[9px] font-bold text-rose-700 hover:underline cursor-pointer"
                              >
                                Remove
                              </button>
                              <span className="text-slate-300">|</span>
                              <button
                                type="button"
                                onClick={() => setConfirmDetachId(null)}
                                className="text-[9px] text-slate-500 hover:text-slate-700 cursor-pointer"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDetachId(sub.id)}
                              title={`Detach ${sub.fullName} from requirement`}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {submissions.length === 0 && (
              <div className="py-5 px-4 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-2.5">
                <p>No applicants attached yet. Open the candidate picker to attach bench consultants.</p>
                <button
                  type="button"
                  onClick={() => setShowBenchPicker(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-[11px] font-semibold transition-colors cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Attach Bench Applicants</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs flex-shrink-0">
          <div className="flex items-center gap-3">
            {submissions.length > 0 && !isPositionsFull && (
              <button
                onClick={() => {
                  const firstCandidate = resolveCandidateForSubmission(
                    submissions.find((s) => s.stage === 'Selected') ||
                      submissions.find((s) => s.stage !== 'Closed') ||
                      submissions[0]
                  );
                  onOpenPlacementWizard(requirement, firstCandidate);
                }}
                className="text-emerald-700 font-semibold hover:text-emerald-800 flex items-center gap-1.5 cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Activate Placement</span>
              </button>
            )}
            {isPositionsFull && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                All {openPositions} {openPositions === 1 ? 'Position' : 'Positions'} Filled
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Separate Candidate Picker Popup */}
      {showBenchPicker && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[1px]"
          onClick={() => !isAttaching && setShowBenchPicker(false)}
        >
          <div
            className="w-full max-w-xl bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-slate-900">Attach Bench Candidates</h4>
                <p className="text-[11px] text-slate-500 truncate mt-0.5">
                  {requirement.id} • {requirement.opportunityTitle}
                </p>
              </div>
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

            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-2 flex-wrap bg-white">
              <div className="text-[11px] font-semibold text-slate-500">
                {totalBenchCount} consultant{totalBenchCount === 1 ? '' : 's'}
                {pagedCandidates.length < totalBenchCount
                  ? ` • showing ${pagedCandidates.length}`
                  : ''}
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  autoFocus
                  value={benchSearch}
                  onChange={(e) => setBenchSearch(e.target.value)}
                  placeholder="Filter name, title, skill..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-brand-600"
                />
              </div>
            </div>

            <div
              onScroll={handleBenchScroll}
              className="p-4 overflow-y-auto space-y-2 flex-1 min-h-[260px]"
            >
              {isLoadingBench && pagedCandidates.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  Loading consultants...
                </div>
              ) : pagedCandidates.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  {benchSearch.trim()
                    ? 'No consultants match your filter.'
                    : 'No bench consultants available to assign yet.'}
                </div>
              ) : (
                <>
                  {pagedCandidates.map((con) => {
                    const alreadyAttached = attachedCandidateIdSet.has(con.id);
                    const isChecked = alreadyAttached || selectedCandidateIds.includes(con.id);

                    return (
                      <div
                        key={con.id}
                        onClick={() => !alreadyAttached && toggleCandidateSelection(con.id)}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                          alreadyAttached
                            ? 'bg-emerald-50/40 border-emerald-200/70 opacity-75 cursor-default'
                            : isChecked
                            ? 'bg-brand-50/60 border-brand-500 cursor-pointer'
                            : 'bg-white border-slate-200 hover:border-brand-400 cursor-pointer'
                        }`}
                      >
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
                              {con.currentTitle} &bull; {formatRate(con.hourlyRate)}
                            </div>
                          </div>
                        </div>

                        {alreadyAttached ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-semibold flex-shrink-0">
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
                            className="px-2.5 py-1 rounded-lg bg-white hover:bg-brand-600 text-brand-700 hover:text-white border border-brand-200 text-[10px] font-semibold transition-colors flex-shrink-0 cursor-pointer"
                          >
                            Quick Attach
                          </button>
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

            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
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
                <button
                  type="button"
                  disabled={isAttaching || selectedCandidateIds.length === 0}
                  onClick={handleBatchAttach}
                  className="px-4 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                >
                  {isAttaching
                    ? 'Attaching...'
                    : `Attach ${selectedCandidateIds.length || ''} Applicant${selectedCandidateIds.length === 1 ? '' : 's'}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

