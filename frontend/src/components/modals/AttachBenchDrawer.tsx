import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, FileSpreadsheet, Loader2, RotateCcw, Search, X } from 'lucide-react';
import { AiIcon, AiTag } from '../shared/AiBrand';
import { apiClient, emitAppToast } from '../../config/api.config';
import {
  Candidate,
  CapabilitySummary,
  ClientDuplicateWarning,
  Requirement,
} from '../../types';
import { useCurrency } from '../../utils/currency';
import { useAiCapabilities } from '../../utils/workspaceBrand';
import { useDebounce } from '../../utils/useDebounce';
import { mapCandidateFromApi, mapRequirementFromApi } from '../../utils/entityMappers';
import { extractResumeMatchExcerpt, matchesCandidateQuery } from '../../utils/candidateSearch';
import { useMasterTaxonomies } from '../shared/DynamicCustomFieldsSection';
import { CustomSelect } from '../shared/CustomSelect';
import { MaskedValue } from '../shared/MaskedValue';
import { ActionButton } from '../shared/ActionButton';
import { SegmentedControl } from '../shared/SegmentedControl';
import { StatusBadge } from '../shared/StatusBadge';
import { AnimatedDrawer } from '../shared/MotionPrimitives';
import {
  getCapabilityBadgeStyle,
  hasEvaluatedFitScore,
} from '../../features/requirements/RequirementDetailModals';

const BENCH_PAGE_SIZE = 50;

export interface SkillMatchSummary {
  score: number;
  matched: string[];
  missing: string[];
}

function normalizeSkillToken(token: string): string {
  return token.trim().toLowerCase();
}

/**
 * Scores a candidate's skillset and title against the requirement's comma-separated skills,
 * preserving display casing and avoiding short-token false positives.
 */
export function computeCandidateSkillMatch(
  requiredSkillsCsv: string | undefined,
  candidateSkillsCsv: string | undefined,
  candidateTitle?: string
): SkillMatchSummary {
  const rawReqSkills = String(requiredSkillsCsv || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (rawReqSkills.length === 0) {
    return { score: 0, matched: [], missing: [] };
  }

  const reqSkills: Array<{ label: string; norm: string }> = [];
  const seenReq = new Set<string>();
  for (const s of rawReqSkills) {
    const norm = normalizeSkillToken(s);
    if (!norm || seenReq.has(norm)) continue;
    seenReq.add(norm);
    reqSkills.push({ label: s, norm });
  }

  const candSkills = String(candidateSkillsCsv || '')
    .split(/[,;|]/)
    .map(normalizeSkillToken)
    .filter(Boolean);
  const titleLower = normalizeSkillToken(candidateTitle || '');

  const matched: string[] = [];
  const missing: string[] = [];

  for (const req of reqSkills) {
    const isDirectMatch = candSkills.some((cs) => {
      if (cs === req.norm) return true;
      if (req.norm.length >= 3 && cs.includes(req.norm)) return true;
      if (cs.length >= 3 && req.norm.includes(cs)) return true;
      return false;
    });

    const isTitleMatch =
      !isDirectMatch && req.norm.length >= 3 && titleLower.includes(req.norm);

    if (isDirectMatch || isTitleMatch) {
      matched.push(req.label);
    } else {
      missing.push(req.label);
    }
  }

  const score = Math.round((matched.length / reqSkills.length) * 100);
  return { score, matched, missing };
}

function getMatchScoreDotClass(score: number): string {
  if (score >= 70) return 'bg-emerald-500';
  if (score >= 40) return 'bg-brand-600';
  return 'bg-slate-400';
}

interface RankingProgressBodyProps {
  progress: number;
  elapsedSec?: number;
  aiEnabled: boolean;
  isNextBatch?: boolean;
  skeletonCount?: number;
}

const RankingProgressBody: React.FC<RankingProgressBodyProps> = ({
  progress,
  elapsedSec = 0,
  aiEnabled,
  isNextBatch = false,
  skeletonCount = 6,
}) => {
  const smoothWidth = Math.max(8, Math.min(100, progress));
  const pct = Math.max(8, Math.min(100, Math.round(progress)));
  const stageText =
    pct >= 100
      ? 'Top candidate rankings ready!'
      : pct < 30
        ? 'Scanning bench resumes and skill profiles...'
        : pct < 60
          ? 'Evaluating experience and role fit criteria...'
          : pct < 85
            ? 'Scoring strengths, gaps, and domain alignment...'
            : elapsedSec >= 9
              ? 'Still wrapping up final AI candidate scores...'
              : 'Ordering best-fit candidates for this role...';

  return (
    <div className="space-y-2.5">
      <div className="p-3.5 rounded-xl border border-slate-200/90 bg-white shadow-sm space-y-2.5">
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-white border border-slate-200/90 flex items-center justify-center shrink-0">
              <AiIcon className="w-3.5 h-3.5 text-teal-600 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-900 truncate">
                {aiEnabled
                  ? isNextBatch
                    ? 'SquadAI is ranking the next batch...'
                    : 'SquadAI is ranking best-fit candidates...'
                  : isNextBatch
                    ? 'Ranking the next batch of candidates...'
                    : 'Ranking matching bench candidates...'}
              </div>
              <div className="text-[11px] text-slate-500 truncate">{stageText}</div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white border border-slate-200/90 text-slate-700 text-[11px] font-semibold tabular-nums shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-600 animate-pulse" />
            {pct}%
          </span>
        </div>

        <div
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          className="w-full h-2 rounded-full bg-slate-100 overflow-hidden"
        >
          <div
            className="h-full rounded-full bg-teal-600 transition-[width] duration-150 ease-out"
            style={{ width: `${smoothWidth}%` }}
          />
        </div>
      </div>

      {Array.from({ length: skeletonCount }).map((_, idx) => (
        <div
          key={`rank-skeleton-${idx}`}
          className="p-3 rounded-xl border border-slate-200/90 bg-white space-y-2.5 animate-pulse"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="w-4 h-4 rounded bg-slate-200 shrink-0" />
              <div className="space-y-1.5 flex-1 max-w-[260px]">
                <div className="h-3.5 w-3/4 rounded bg-slate-200" />
                <div className="h-2.5 w-1/2 rounded bg-slate-100" />
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="h-6 w-24 rounded-md bg-slate-100" />
              <div className="h-7 w-20 rounded-lg bg-slate-100" />
            </div>
          </div>
          <div className="flex items-center gap-1.5 pl-6">
            <div className="h-4 w-16 rounded bg-slate-100" />
            <div className="h-4 w-20 rounded bg-slate-100" />
            <div className="h-4 w-14 rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
};

export interface AttachBenchDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  requirement?: Requirement | null;
  requirements?: Requirement[];
  allowRequirementSwitch?: boolean;
  autoRankOnOpen?: boolean;
  candidates: Candidate[];
  rateMasked?: boolean;
  onAttachCandidates?: (
    req: Requirement,
    candidateIds: string[],
    precomputedCapabilities?: Record<string, CapabilitySummary>
  ) => Promise<void> | void;
  onAssignCandidate?: (req: Requirement, candidate: Candidate) => Promise<void> | void;
  onOpenCsvImport?: (req: Requirement) => void;
  onOpenResumeParser?: (req: Requirement) => void;
  onCandidatesSeen?: (loaded: Candidate[]) => void;
  showToast?: (title: string, message: string, icon?: string) => void;
}

export const AttachBenchDrawer: React.FC<AttachBenchDrawerProps> = ({
  isOpen,
  onClose,
  requirement,
  requirements = [],
  allowRequirementSwitch = false,
  autoRankOnOpen = false,
  candidates,
  rateMasked = false,
  onAttachCandidates,
  onAssignCandidate,
  onOpenCsvImport,
  onOpenResumeParser,
  onCandidatesSeen,
  showToast,
}) => {
  const { formatRate } = useCurrency();
  const aiCapabilities = useAiCapabilities();
  const taxonomies = useMasterTaxonomies(isOpen);

  const notifyToast = useCallback(
    (
      title: string,
      message: string,
      icon: 'success' | 'error' | 'warning' | 'info' = 'info'
    ) => {
      if (showToast) {
        showToast(title, message, icon);
      } else {
        emitAppToast(title, message, icon);
      }
    },
    [showToast]
  );

  const [selectedReqId, setSelectedReqId] = useState<string>(
    requirement?.id || requirements[0]?.id || ''
  );
  const [drawerTab, setDrawerTab] = useState<'available' | 'attached'>('available');
  const [hydratedReqs, setHydratedReqs] = useState<Record<string, Requirement>>({});
  const [showAllReqSkills, setShowAllReqSkills] = useState(false);
  const [expandedCandSkillIds, setExpandedCandSkillIds] = useState<Record<string, boolean>>({});
  const [benchSearch, setBenchSearch] = useState('');
  const [benchWorkAuth, setBenchWorkAuth] = useState('All');
  const debouncedBenchSearch = useDebounce(benchSearch, 250);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [attachingCandId, setAttachingCandId] = useState<string | null>(null);
  const [isBatchAttaching, setIsBatchAttaching] = useState(false);
  const isAttaching = Boolean(attachingCandId) || isBatchAttaching;
  const [isAiRanking, setIsAiRanking] = useState(false);
  const [aiRankBatchMode, setAiRankBatchMode] = useState<'initial' | 'next'>('initial');
  const [aiRankProgress, setAiRankProgress] = useState(0);
  const [aiRankElapsedSec, setAiRankElapsedSec] = useState(0);
  const [benchReadyForAutoRank, setBenchReadyForAutoRank] = useState(false);
  const [aiRankError, setAiRankError] = useState('');
  const [aiRankScopeNote, setAiRankScopeNote] = useState('');
  const [remainingUnrankedCount, setRemainingUnrankedCount] = useState<number | null>(null);
  const [aiRankMap, setAiRankMap] = useState<
    Record<
      string,
      {
        fitScore: number;
        matchedHighlights: string[];
        gaps: string[];
        oneLineSummary: string;
        aiEvaluated?: boolean;
      }
    >
  >({});
  const [clientDuplicateMap, setClientDuplicateMap] = useState<
    Record<string, ClientDuplicateWarning[]>
  >({});
  const [pagedCandidates, setPagedCandidates] = useState<Candidate[]>(() =>
    candidates.slice(0, BENCH_PAGE_SIZE)
  );
  const [totalBenchCount, setTotalBenchCount] = useState<number>(candidates.length);
  const [benchPage, setBenchPage] = useState<number>(1);
  const [hasMoreBench, setHasMoreBench] = useState<boolean>(candidates.length > BENCH_PAGE_SIZE);
  const [isLoadingBench, setIsLoadingBench] = useState<boolean>(false);
  const [isLoadingMoreBench, setIsLoadingMoreBench] = useState<boolean>(false);
  const knownCandidatesRef = useRef<Map<string, Candidate>>(new Map());
  const activeSearchRef = useRef<string>('');
  const autoRankTriggeredRef = useRef<boolean>(false);
  const benchListRef = useRef<HTMLDivElement | null>(null);
  const rankAbortRef = useRef<AbortController | null>(null);
  const rankCompleteTimerRef = useRef<number | null>(null);

  useEffect(() => {
    for (const c of candidates) {
      if (c?.id) knownCandidatesRef.current.set(c.id, c);
    }
  }, [candidates]);

  // Reset picker filters & selection on open or external target change
  useEffect(() => {
    rankAbortRef.current?.abort();
    rankAbortRef.current = null;
    if (rankCompleteTimerRef.current !== null) {
      window.clearTimeout(rankCompleteTimerRef.current);
      rankCompleteTimerRef.current = null;
    }

    if (!isOpen) {
      autoRankTriggeredRef.current = false;
      setBenchReadyForAutoRank(false);
      setIsAiRanking(false);
      setAiRankProgress(0);
      setAiRankElapsedSec(0);
      return;
    }
    autoRankTriggeredRef.current = false;
    setBenchReadyForAutoRank(false);
    setSelectedReqId(requirement?.id || requirements[0]?.id || '');
    setDrawerTab('available');
    setShowAllReqSkills(false);
    setExpandedCandSkillIds({});
    setSelectedCandidateIds([]);
    setAttachingCandId(null);
    setIsBatchAttaching(false);
    setBenchSearch('');
    setBenchWorkAuth('All');
    setClientDuplicateMap({});
    setAiRankMap({});
    setAiRankError('');
    setAiRankScopeNote('');
    setRemainingUnrankedCount(null);
    setIsAiRanking(false);
    setAiRankBatchMode('initial');
    setAiRankProgress(0);
    setAiRankElapsedSec(0);
    setBenchPage(1);
    setPagedCandidates(candidates.slice(0, BENCH_PAGE_SIZE));
    setTotalBenchCount(candidates.length);
    setHasMoreBench(candidates.length > BENCH_PAGE_SIZE);
  }, [isOpen, requirement?.id, selectedReqId]);

  useEffect(() => {
    if (!isAiRanking) {
      setAiRankElapsedSec(0);
      return;
    }
    const startedAt = Date.now();
    setAiRankProgress((prev) => (prev > 12 && prev < 100 ? prev : 12));
    const timer = window.setInterval(() => {
      const elapsedMs = Date.now() - startedAt;
      setAiRankElapsedSec(Math.floor(elapsedMs / 1000));
      setAiRankProgress((prev) => {
        if (prev >= 100) return 100;
        const target = 12 + 85 * (1 - Math.exp(-elapsedMs / 3200));
        return Math.min(97, Math.max(prev, target));
      });
    }, 90);
    return () => window.clearInterval(timer);
  }, [isAiRanking]);

  // Clear cached AI batch rankings and abort stale ranking request when filters change
  useEffect(() => {
    rankAbortRef.current?.abort();
    rankAbortRef.current = null;
    setIsAiRanking(false);
    setAiRankProgress(0);
    setAiRankMap({});
    setAiRankError('');
    setAiRankScopeNote('');
    setRemainingUnrankedCount(null);
  }, [debouncedBenchSearch, benchWorkAuth]);

  const baseReq = useMemo(() => {
    if (allowRequirementSwitch && requirements.length > 0) {
      return (
        requirements.find((r) => r.id === selectedReqId) ||
        requirement ||
        requirements[0] ||
        null
      );
    }
    return requirement || requirements.find((r) => r.id === selectedReqId) || null;
  }, [allowRequirementSwitch, requirements, requirement, selectedReqId]);

  const currentReq = useMemo(() => {
    if (!baseReq) return null;
    const hydrated = hydratedReqs[baseReq.id];
    if (
      hydrated &&
      (!Array.isArray(baseReq.submissions) ||
        (baseReq.submissions.length === 0 && (baseReq.submissionCount ?? 0) > 0))
    ) {
      return hydrated;
    }
    return baseReq;
  }, [baseReq, hydratedReqs]);

  // Ensure submissions list is hydrated when launched from a lean Kanban summary card
  useEffect(() => {
    if (!isOpen || !baseReq?.id) return;
    const needsHydration =
      !Array.isArray(baseReq.submissions) ||
      (baseReq.submissions.length === 0 && (baseReq.submissionCount ?? 0) > 0);
    if (!needsHydration) return;

    let active = true;
    apiClient
      .get(`/requirements/${baseReq.id}`)
      .then((res) => {
        if (active && res.data?.success && res.data.data) {
          const mapped = mapRequirementFromApi(res.data.data);
          setHydratedReqs((prev) => ({ ...prev, [mapped.id]: mapped }));
        }
      })
      .catch(() => { });

    return () => {
      active = false;
    };
  }, [isOpen, baseReq?.id, baseReq?.submissions, baseReq?.submissionCount]);

  const attachedStageByCandId = useMemo(() => {
    const map = new Map<string, string>();
    for (const sub of currentReq?.submissions || []) {
      if (sub.candidateId) map.set(sub.candidateId, sub.stage);
    }
    return map;
  }, [currentReq?.submissions]);

  const filteredLocalCandidates = useMemo(() => {
    return candidates.filter((c) => {
      const matchesSearch = matchesCandidateQuery(c, debouncedBenchSearch);
      const matchesAuth =
        benchWorkAuth === 'All' ||
        (c.workAuth || '').toLowerCase().includes(benchWorkAuth.toLowerCase());
      return matchesSearch && matchesAuth;
    });
  }, [candidates, debouncedBenchSearch, benchWorkAuth]);

  useEffect(() => {
    if (!isOpen) return;
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
        onCandidatesSeen?.(mapped);
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
        if (active) {
          setIsLoadingBench(false);
          if (!searchTerm && benchWorkAuth === 'All') {
            setBenchReadyForAutoRank(true);
          }
        }
      });

    return () => {
      active = false;
    };
  }, [isOpen, debouncedBenchSearch, benchWorkAuth]);

  // Keep open drawer synchronized when inline Resume/CSV popups add or update candidates
  useEffect(() => {
    if (!isOpen || candidates.length === 0) return;
    setPagedCandidates((prev) => {
      const byId = new Map(candidates.map((c) => [c.id, c]));
      const existingIds = new Set(prev.map((c) => c.id));
      const newMatching = candidates.filter(
        (c) =>
          !existingIds.has(c.id) &&
          matchesCandidateQuery(c, debouncedBenchSearch) &&
          (benchWorkAuth === 'All' ||
            (c.workAuth || '').toLowerCase().includes(benchWorkAuth.toLowerCase()))
      );

      let updatedExisting = false;
      const nextPrev = prev.map((item) => {
        const latest = byId.get(item.id);
        if (latest && latest.pipelineStage !== item.pipelineStage) {
          updatedExisting = true;
          return latest;
        }
        return item;
      });

      if (newMatching.length === 0) {
        return updatedExisting ? nextPrev : prev;
      }

      setTotalBenchCount((t) => t + newMatching.length);
      return [...newMatching, ...nextPrev];
    });
  }, [isOpen, candidates, debouncedBenchSearch, benchWorkAuth]);

  useEffect(() => {
    if (!isOpen || !currentReq?.id || pagedCandidates.length === 0) return;
    const candidateIdsToCheck = pagedCandidates
      .filter((c) => !attachedStageByCandId.has(c.id))
      .map((c) => c.id);
    if (candidateIdsToCheck.length === 0) return;

    let active = true;
    apiClient
      .get('/submissions/duplicate-check', {
        params: {
          requirementId: currentReq.id,
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
  }, [isOpen, currentReq?.id, pagedCandidates, attachedStageByCandId]);

  const loadNextBenchPage = useCallback(() => {
    if (isLoadingBench || isLoadingMoreBench || !hasMoreBench) return;

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
        onCandidatesSeen?.(mapped);
        const pagination = res.data?.pagination;
        const total = typeof pagination?.total === 'number' ? pagination.total : undefined;
        const totalPages =
          typeof pagination?.totalPages === 'number' ? pagination.totalPages : nextPage;
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
  }, [
    benchPage,
    debouncedBenchSearch,
    benchWorkAuth,
    filteredLocalCandidates,
    hasMoreBench,
    isLoadingBench,
    isLoadingMoreBench,
    onCandidatesSeen,
  ]);

  const handleBenchScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
      if (scrollHeight - scrollTop - clientHeight > 48) {
        return;
      }
      loadNextBenchPage();
    },
    [loadNextBenchPage]
  );

  const attachedEntries = useMemo(() => {
    const subs = currentReq?.submissions || [];
    const seen = new Set<string>();
    const rows: Array<{
      key: string;
      candidate: Candidate;
      stage: string;
      capabilityScore?: number | null;
      capabilitySummary?: CapabilitySummary | null;
    }> = [];

    for (const sub of subs) {
      const candId = sub.candidateId || sub.id;
      if (seen.has(candId)) continue;
      seen.add(candId);

      const base =
        sub.candidate ||
        candidates.find((c) => sub.candidateId && c.id === sub.candidateId) ||
        (sub.candidateId ? knownCandidatesRef.current.get(sub.candidateId) : undefined);

      const candObj: Candidate = base || {
        id: candId,
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

      rows.push({
        key: sub.id,
        candidate: candObj,
        stage: sub.stage,
        capabilityScore: sub.capabilityScore,
        capabilitySummary: sub.capabilitySummary,
      });
    }
    return rows;
  }, [currentReq?.submissions, candidates]);

  const filteredAttachedEntries = useMemo(() => {
    return attachedEntries.filter(({ candidate }) => {
      const matchesSearch = matchesCandidateQuery(candidate, debouncedBenchSearch);
      const matchesAuth =
        benchWorkAuth === 'All' ||
        (candidate.workAuth || '').toLowerCase().includes(benchWorkAuth.toLowerCase());
      return matchesSearch && matchesAuth;
    });
  }, [attachedEntries, debouncedBenchSearch, benchWorkAuth]);

  const reqSkillList = useMemo(
    () =>
      String(currentReq?.skillsRequired || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    [currentReq?.skillsRequired]
  );

  const aiModeEnabled = aiCapabilities.enabled;
  const aiRankedCount = Object.keys(aiRankMap).length;
  const hasAiRankResults = aiRankedCount > 0;

  const availableRankedCandidates = useMemo(() => {
    const unattached = pagedCandidates.filter((con) => !attachedStageByCandId.has(con.id));
    const items = unattached.map((con, idx) => {
      const localMatch = computeCandidateSkillMatch(
        currentReq?.skillsRequired,
        con.skillset,
        con.currentTitle
      );
      const aiEntry = aiRankMap[con.id];
      const isAiRanked = Boolean(aiEntry);
      const isRowAiEvaluated = Boolean(aiEntry?.aiEvaluated);
      const showMatch = aiModeEnabled ? isAiRanked : reqSkillList.length > 0;

      return {
        con,
        idx,
        isAiRanked,
        isRowAiEvaluated,
        showMatch,
        oneLineSummary: aiEntry?.oneLineSummary || '',
        match: aiEntry
          ? {
            score: aiEntry.fitScore,
            matched:
              aiEntry.matchedHighlights.length > 0
                ? aiEntry.matchedHighlights
                : localMatch.matched,
            missing: aiEntry.gaps.length > 0 ? aiEntry.gaps : localMatch.missing,
          }
          : localMatch,
      };
    });

    if (aiModeEnabled) {
      if (hasAiRankResults) {
        items.sort((a, b) => {
          if (a.isAiRanked !== b.isAiRanked) return a.isAiRanked ? -1 : 1;
          if (a.isAiRanked && b.isAiRanked) {
            return b.match.score - a.match.score || a.idx - b.idx;
          }
          return a.idx - b.idx;
        });
      }
      return items;
    }

    if (reqSkillList.length > 0 || hasAiRankResults) {
      items.sort((a, b) => {
        if (a.isAiRanked !== b.isAiRanked) return a.isAiRanked ? -1 : 1;
        return b.match.score - a.match.score || a.idx - b.idx;
      });
    }
    return items;
  }, [
    pagedCandidates,
    attachedStageByCandId,
    currentReq?.skillsRequired,
    reqSkillList.length,
    aiRankMap,
    aiModeEnabled,
    hasAiRankResults,
  ]);

  const availableTabCount = Math.max(
    availableRankedCandidates.length,
    totalBenchCount - filteredAttachedEntries.length
  );

  // If every consultant on the currently loaded page is already attached, automatically load the next page
  useEffect(() => {
    if (
      isOpen &&
      drawerTab === 'available' &&
      !isLoadingBench &&
      !isLoadingMoreBench &&
      hasMoreBench &&
      availableRankedCandidates.length === 0
    ) {
      loadNextBenchPage();
    }
  }, [
    isOpen,
    drawerTab,
    isLoadingBench,
    isLoadingMoreBench,
    hasMoreBench,
    availableRankedCandidates.length,
    loadNextBenchPage,
  ]);

  const handleAiRankTopMatches = async (appendNextBatch = false) => {
    if (!currentReq?.id || isAiRanking || availableTabCount === 0) return;
    rankAbortRef.current?.abort();
    const controller = new AbortController();
    rankAbortRef.current = controller;
    if (rankCompleteTimerRef.current !== null) {
      window.clearTimeout(rankCompleteTimerRef.current);
      rankCompleteTimerRef.current = null;
    }

    setAiRankBatchMode(appendNextBatch ? 'next' : 'initial');
    setIsAiRanking(true);
    setAiRankError('');
    let finishedCleanly = false;

    try {
      const excludeCandidateIds = Array.from(
        new Set([
          ...Array.from(attachedStageByCandId.keys()),
          ...(appendNextBatch ? Object.keys(aiRankMap) : []),
        ])
      );
      const res = await apiClient.post(
        '/match-skills',
        {
          requirementId: currentReq.id,
          skillsRequired: currentReq.skillsRequired,
          search: benchSearch.trim() || undefined,
          workAuth: benchWorkAuth !== 'All' ? benchWorkAuth : undefined,
          excludeCandidateIds,
        },
        {
          signal: controller.signal,
          timeout: 35000,
        }
      );
      if (controller.signal.aborted) return;

      const rankings = res.data?.data?.rankings;
      const rawMatchedCandidates = res.data?.data?.candidates;
      const used = Boolean(res.data?.data?.aiUsed);
      const quotaNotice = String(res.data?.data?.quotaNotice || '').trim();
      const remainingFromApi =
        typeof res.data?.data?.remainingUnrankedCount === 'number'
          ? res.data.data.remainingUnrankedCount
          : null;

      if (Array.isArray(rawMatchedCandidates) && rawMatchedCandidates.length > 0) {
        const hydratedTop: Candidate[] = rawMatchedCandidates.map(mapCandidateFromApi);
        for (const c of hydratedTop) {
          if (c?.id) knownCandidatesRef.current.set(c.id, c);
        }
        onCandidatesSeen?.(hydratedTop);
        setPagedCandidates((prev) => {
          const topIds = new Set(hydratedTop.map((c) => c.id));
          const remaining = prev.filter((p) => !topIds.has(p.id));
          return [...hydratedTop, ...remaining];
        });
      }

      if (Array.isArray(rankings)) {
        const nextMap: Record<
          string,
          {
            fitScore: number;
            matchedHighlights: string[];
            gaps: string[];
            oneLineSummary: string;
            aiEvaluated?: boolean;
          }
        > = {};
        for (const row of rankings) {
          if (row?.candidateId) {
            const rowAiEvaluated =
              typeof row.aiEvaluated === 'boolean' ? row.aiEvaluated : used;
            nextMap[row.candidateId] = {
              fitScore: Number(row.fitScore ?? 0),
              matchedHighlights: Array.isArray(row.matchedHighlights) ? row.matchedHighlights : [],
              gaps: Array.isArray(row.gaps) ? row.gaps : [],
              oneLineSummary: String(row.oneLineSummary || ''),
              aiEvaluated: rowAiEvaluated,
            };
          }
        }
        const mergedMap = appendNextBatch ? { ...aiRankMap, ...nextMap } : nextMap;
        const evaluatedCount = aiModeEnabled
          ? Object.values(mergedMap).filter((entry) => entry.aiEvaluated).length
          : Object.keys(mergedMap).length;
        setAiRankMap(mergedMap);
        setRemainingUnrankedCount(remainingFromApi);
        if (quotaNotice && !used) {
          setAiRankError(quotaNotice);
          notifyToast('SquadAI Notice', quotaNotice, 'warning');
        }
        setAiRankScopeNote(
          `${evaluatedCount} ${evaluatedCount === 1 ? 'candidate' : 'candidates'} evaluated${remainingFromApi && remainingFromApi > 0
            ? ` · ${remainingFromApi} more available`
            : ''
          }`
        );
        if (!appendNextBatch) {
          benchListRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }

      finishedCleanly = true;
      setAiRankProgress(100);
      rankCompleteTimerRef.current = window.setTimeout(() => {
        rankCompleteTimerRef.current = null;
        if (!controller.signal.aborted) {
          setIsAiRanking(false);
          setAiRankProgress(0);
        }
      }, 160);
    } catch (err: any) {
      if (
        controller.signal.aborted ||
        err?.code === 'ERR_CANCELED' ||
        err?.name === 'CanceledError' ||
        err?.name === 'AbortError'
      ) {
        return;
      }
      const errMsg =
        err?.code === 'ECONNABORTED'
          ? 'SquadAI search timed out before finishing. Please try again.'
          : err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          'Could not rank candidates right now.';
      setAiRankError(errMsg);
      notifyToast('SquadAI Search Failed', errMsg, 'error');
    } finally {
      if (rankAbortRef.current === controller) {
        rankAbortRef.current = null;
      }
      if (!finishedCleanly) {
        setIsAiRanking(false);
        setAiRankProgress(0);
      }
    }
  };

  const isAutoRankWaiting =
    isOpen &&
    autoRankOnOpen &&
    drawerTab === 'available' &&
    !hasAiRankResults &&
    !aiRankError &&
    !benchSearch.trim() &&
    benchWorkAuth === 'All' &&
    (!benchReadyForAutoRank || availableTabCount > 0) &&
    !autoRankTriggeredRef.current;

  useEffect(() => {
    if (
      !isOpen ||
      !autoRankOnOpen ||
      autoRankTriggeredRef.current ||
      !benchReadyForAutoRank ||
      drawerTab !== 'available' ||
      !currentReq?.id ||
      isAiRanking ||
      hasAiRankResults ||
      benchSearch.trim() ||
      benchWorkAuth !== 'All' ||
      availableTabCount === 0
    ) {
      return;
    }
    autoRankTriggeredRef.current = true;
    void handleAiRankTopMatches(false);
  }, [
    isOpen,
    autoRankOnOpen,
    benchReadyForAutoRank,
    drawerTab,
    currentReq?.id,
    isAiRanking,
    hasAiRankResults,
    benchSearch,
    benchWorkAuth,
    availableTabCount,
  ]);

  const buildPrecomputedCapabilities = (
    candIds: string[]
  ): Record<string, CapabilitySummary> | undefined => {
    const out: Record<string, CapabilitySummary> = {};
    const nowIso = new Date().toISOString();
    for (const id of candIds) {
      const entry = aiRankMap[id];
      if (!entry || !entry.aiEvaluated) continue;
      const score = Math.max(0, Math.min(100, Math.round(Number(entry.fitScore ?? 0))));
      const rec =
        score >= 80
          ? 'STRONG_FIT'
          : score >= 65
            ? 'GOOD_FIT'
            : score >= 45
              ? 'PARTIAL_FIT'
              : 'LOW_FIT';
      out[id] = {
        fitScore: score,
        recommendation: rec,
        verdict: entry.oneLineSummary || '',
        strengths: entry.matchedHighlights || [],
        gaps: entry.gaps || [],
        evaluatedWithAi: true,
        evaluatedAt: nowIso,
      };
    }
    return Object.keys(out).length > 0 ? out : undefined;
  };

  const openPositions = currentReq?.openPositions || 1;
  const toggleCandidateSelection = (candId: string) => {
    if (attachedStageByCandId.has(candId)) return;
    setSelectedCandidateIds((prev) =>
      prev.includes(candId) ? prev.filter((id) => id !== candId) : [...prev, candId]
    );
  };

  const handleQuickSingleAttach = async (cand: Candidate) => {
    if (!currentReq || isAttaching || attachedStageByCandId.has(cand.id)) return;
    setAttachingCandId(cand.id);
    try {
      const precomputed = buildPrecomputedCapabilities([cand.id]);
      if (onAttachCandidates) {
        await onAttachCandidates(currentReq, [cand.id], precomputed);
      } else if (onAssignCandidate) {
        await onAssignCandidate(currentReq, cand);
      }
      setSelectedCandidateIds((prev) => prev.filter((id) => id !== cand.id));
    } catch {
      // Parent handler surfaces feedback toast
    } finally {
      setAttachingCandId(null);
    }
  };

  const handleBatchAttach = async () => {
    if (!currentReq || isAttaching || selectedCandidateIds.length === 0) return;
    setIsBatchAttaching(true);
    try {
      const precomputed = buildPrecomputedCapabilities(selectedCandidateIds);
      if (onAttachCandidates) {
        await onAttachCandidates(currentReq, selectedCandidateIds, precomputed);
      } else if (onAssignCandidate) {
        for (const id of selectedCandidateIds) {
          const cand =
            candidates.find((c) => c.id === id) || knownCandidatesRef.current.get(id);
          if (cand) await onAssignCandidate(currentReq, cand);
        }
      }
      setSelectedCandidateIds([]);
      onClose();
    } catch {
      // Parent handler surfaces feedback toast
    } finally {
      setIsBatchAttaching(false);
    }
  };

  const selectedDupCount = selectedCandidateIds.filter(
    (id) => (clientDuplicateMap[id]?.length || 0) > 0
  ).length;

  return (
    <AnimatedDrawer
      isOpen={Boolean(isOpen && currentReq)}
      onBackdropClick={() => !isAttaching && onClose()}
      zIndexClass="z-50"
      backdropClassName="bg-slate-900/40 backdrop-blur-[1px] flex justify-end"
      panelClassName="w-full max-w-2xl bg-white h-full border-l border-slate-200 shadow-2xl flex flex-col overflow-hidden"
      ariaLabel="Attach Bench Candidates"
    >
      {currentReq && (
        <>
          {/* Header */}
          <div className="px-6 py-4 bg-white border-b border-slate-100 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm font-semibold text-slate-900">Attach Bench Candidates</h4>
                <div className="flex items-center gap-1.5">
                  <StatusBadge tone="slate" size="xs" label={`${openPositions} Open`} />
                  <StatusBadge
                    tone="emerald"
                    size="xs"
                    label={`${attachedStageByCandId.size} Attached`}
                  />
                </div>
              </div>
              <p className="text-[11px] text-slate-500 leading-snug break-words mt-1">
                <span className="font-mono font-semibold text-slate-700">{currentReq.code}</span>
                {' \u2022 '}
                <span className="font-medium text-slate-700">{currentReq.opportunityTitle}</span>
                {currentReq.companyName ? ` \u2022 ${currentReq.companyName}` : ''}
              </p>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {(onOpenResumeParser || onOpenCsvImport) && (
                <div className="inline-flex items-center h-8 rounded-lg border border-slate-200 bg-white overflow-hidden">
                  {onOpenResumeParser && (
                    <button
                      type="button"
                      disabled={isAttaching}
                      onClick={() => {
                        onOpenResumeParser(currentReq);
                      }}
                      className={`h-full px-2.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 ${onOpenCsvImport ? 'border-r border-slate-200' : ''
                        }`}
                      title="Upload & parse resumes (PDF/DOCX) to add candidates"
                    >
                      <AiIcon className="w-3.5 h-3.5 text-teal-600" />
                      <span>Parse Resumes</span>
                      {aiCapabilities.enabled && <AiTag />}
                    </button>
                  )}
                  {onOpenCsvImport && (
                    <button
                      type="button"
                      disabled={isAttaching}
                      onClick={() => {
                        onOpenCsvImport(currentReq);
                      }}
                      className="h-full px-2.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                      title="Bulk import candidates from CSV"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Import CSV</span>
                    </button>
                  )}
                </div>
              )}
              <button
                type="button"
                disabled={isAttaching}
                onClick={onClose}
                className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Close candidate picker"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Required Skills Summary */}
          {reqSkillList.length > 0 && (
            <div className="px-6 py-2.5 bg-white border-b border-slate-100">
              <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mr-0.5">
                  Required Skills
                </span>
                {(showAllReqSkills ? reqSkillList : reqSkillList.slice(0, 6)).map((skill, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded-md bg-white border border-slate-200/90 text-slate-700 text-[11px] font-medium"
                  >
                    {skill}
                  </span>
                ))}
                {reqSkillList.length > 6 && (
                  <button
                    type="button"
                    onClick={() => setShowAllReqSkills((prev) => !prev)}
                    className="ml-0.5 text-[11px] font-semibold text-brand-600 hover:text-brand-700 underline underline-offset-2 cursor-pointer transition-colors"
                  >
                    {showAllReqSkills ? 'Show less' : `+${reqSkillList.length - 6} more`}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Search, Filter & AI Rank Bar */}
          <div className="px-6 py-3 border-b border-slate-100 bg-white space-y-2.5">
            <div className="flex items-center gap-2">
              <div className="relative flex-1 min-w-0">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  autoFocus
                  value={benchSearch}
                  onChange={(e) => setBenchSearch(e.target.value)}
                  placeholder="Search by candidate name, title, skills, or resume..."
                  className="w-full h-8 pl-8 pr-3 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-brand-600 transition-colors"
                />
              </div>
              <div className="shrink-0">
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
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 flex-wrap">
              <SegmentedControl<'available' | 'attached'>
                value={drawerTab}
                onChange={setDrawerTab}
                ariaLabel="Switch between available and attached candidates"
                options={[
                  { value: 'available', label: `Available (${availableTabCount})` },
                  { value: 'attached', label: `Attached (${attachedEntries.length})` },
                ]}
              />

              {drawerTab === 'available' && availableTabCount > 0 && (
                hasAiRankResults && (remainingUnrankedCount ?? 0) > 0 ? (
                  <button
                    type="button"
                    disabled={isAiRanking || isAutoRankWaiting || isLoadingBench || isAttaching}
                    onClick={() => void handleAiRankTopMatches(true)}
                    title={`Rank the next ${Math.min(20, remainingUnrankedCount!)} unattached consultants (${remainingUnrankedCount} remaining)`}
                    className="px-2.5 py-1 rounded-lg border border-teal-300 bg-white hover:bg-teal-50/50 text-teal-700 text-[11px] font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-60"
                  >
                    {isAiRanking ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <AiIcon className="w-3 h-3 text-teal-600" />
                    )}
                    <span>
                      {isAiRanking
                        ? 'Ranking Next Batch...'
                        : `Rank Next ${Math.min(20, remainingUnrankedCount!)} (${remainingUnrankedCount} left)`}
                    </span>
                  </button>
                ) : hasAiRankResults && remainingUnrankedCount === 0 ? (
                  <StatusBadge
                    tone="emerald"
                    size="xs"
                    icon={<AiIcon className="w-3 h-3 text-teal-600 shrink-0" />}
                    label={`All ${aiRankedCount} Ranked`}
                  />
                ) : (
                  <button
                    type="button"
                    disabled={isAiRanking || isAutoRankWaiting || isLoadingBench || isAttaching}
                    onClick={() => void handleAiRankTopMatches(false)}
                    className="px-2.5 py-1 rounded-lg border border-teal-300 bg-white hover:bg-teal-50/50 text-teal-700 text-[11px] font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-60"
                  >
                    {isAiRanking || isAutoRankWaiting ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <AiIcon className="w-3 h-3 text-teal-600" />
                    )}
                    <span>
                      {isAiRanking || isAutoRankWaiting
                        ? 'Ranking Best Fits...'
                        : aiCapabilities.enabled
                          ? 'SquadAI Rank'
                          : 'Rank Top Matches'}
                    </span>
                  </button>
                )
              )}
            </div>

            {drawerTab === 'available' && (availableRankedCandidates.length < availableTabCount || aiRankScopeNote) && (
              <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-slate-500 flex-wrap">
                <span>
                  {availableRankedCandidates.length < availableTabCount ? (
                    <>
                      Showing <strong className="font-semibold text-slate-700">{availableRankedCandidates.length}</strong> of{' '}
                      <strong className="font-semibold text-slate-700">{availableTabCount}</strong> available consultants
                    </>
                  ) : (
                    <>
                      <strong className="font-semibold text-slate-700">{availableTabCount}</strong> available consultant
                      {availableTabCount === 1 ? '' : 's'}
                    </>
                  )}
                </span>
                {aiRankScopeNote && (
                  <StatusBadge tone="emerald" size="xs" label={aiRankScopeNote} />
                )}
              </div>
            )}
          </div>

          {/* Scrollable Candidate List */}
          <div
            ref={benchListRef}
            onScroll={drawerTab === 'available' ? handleBenchScroll : undefined}
            className="p-4 overflow-y-auto space-y-2 flex-1 min-h-0"
          >
            {drawerTab === 'available' && aiRankError && (
              <div className="px-3 py-2 rounded-lg bg-rose-50/80 border border-rose-200 text-rose-800 text-[11px] font-medium flex items-center justify-between gap-2.5">
                <span className="min-w-0 leading-snug">{aiRankError}</span>
                <button
                  type="button"
                  disabled={isAiRanking || isLoadingBench || isAttaching}
                  onClick={() => void handleAiRankTopMatches(false)}
                  className="px-2 py-1 rounded-md bg-white border border-rose-200 hover:bg-rose-50 text-rose-700 font-semibold text-[11px] inline-flex items-center gap-1 shrink-0 cursor-pointer disabled:opacity-50"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Retry</span>
                </button>
              </div>
            )}
            {drawerTab === 'attached' ? (
              filteredAttachedEntries.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  {attachedEntries.length === 0
                    ? 'No consultants attached to this requirement yet. Switch to Available to attach.'
                    : 'No attached consultants match your filter.'}
                </div>
              ) : (
                filteredAttachedEntries.map(({ key, candidate: con, stage, capabilityScore, capabilitySummary }) => {
                  const hasScore = hasEvaluatedFitScore(capabilityScore, capabilitySummary, aiModeEnabled);
                  const badgeMeta = hasScore
                    ? getCapabilityBadgeStyle(Math.round(capabilityScore!), capabilitySummary)
                    : null;
                  const usedAi = Boolean(capabilitySummary?.evaluatedWithAi && aiModeEnabled);

                  return (
                    <div
                      key={key}
                      className="p-3 rounded-xl border border-emerald-200/80 bg-emerald-50/35 flex items-center justify-between gap-2.5"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-4 h-4 rounded bg-emerald-600 border border-emerald-600 text-white flex items-center justify-center flex-shrink-0">
                          <Check className="w-3 h-3" strokeWidth={3} />
                        </span>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5 flex-wrap">
                            <span className="truncate">{con.fullName}</span>
                            {con.workAuth && (
                              <span className="text-[11px] font-normal text-slate-400">
                                ({con.workAuth})
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                            {con.currentTitle || 'Consultant'} &bull;{' '}
                            <MaskedValue value={formatRate(con.hourlyRate)} isMasked={rateMasked} />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {badgeMeta ? (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-bold tabular-nums ${badgeMeta.badgeClass}`}
                          >
                            {usedAi && <AiIcon className="w-3 h-3 shrink-0" />}
                            <span>
                              {Math.round(capabilityScore!)}% &middot; {badgeMeta.label}
                            </span>
                          </span>
                        ) : (
                          <StatusBadge tone="slate" size="xs" label="Fit Not Checked" />
                        )}
                        <StatusBadge stage={stage} size="xs" />
                      </div>
                    </div>
                  );
                })
              )
            ) : isAutoRankWaiting || (isAiRanking && aiRankBatchMode === 'initial') ? (
              <RankingProgressBody
                progress={isAiRanking ? aiRankProgress : 10}
                elapsedSec={aiRankElapsedSec}
                aiEnabled={aiModeEnabled}
                skeletonCount={6}
              />
            ) : (isLoadingBench && pagedCandidates.length === 0) ||
              (isLoadingMoreBench && availableRankedCandidates.length === 0) ? (
              <div className="py-10 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                Loading available consultants...
              </div>
            ) : availableRankedCandidates.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                {benchSearch.trim() || benchWorkAuth !== 'All'
                  ? 'No unattached consultants match your filter.'
                  : attachedEntries.length > 0
                    ? 'All matching consultants are already attached to this requirement.'
                    : 'No bench consultants available to assign yet.'}
              </div>
            ) : (
              <>
                {isAiRanking && aiRankBatchMode === 'next' && (
                  <RankingProgressBody
                    progress={aiRankProgress}
                    aiEnabled={aiModeEnabled}
                    isNextBatch={true}
                    skeletonCount={3}
                  />
                )}
                {availableRankedCandidates.map(({ con, match, isAiRanked, isRowAiEvaluated, showMatch, oneLineSummary }, rowIndex) => {
                  const isChecked = selectedCandidateIds.includes(con.id);
                  const dupWarnings = clientDuplicateMap[con.id] || [];
                  const latestDup = dupWarnings[0];
                  const cvExcerpt = benchSearch.trim()
                    ? extractResumeMatchExcerpt(con.rawSnippet, benchSearch)
                    : null;
                  const nextRow = availableRankedCandidates[rowIndex + 1];
                  const isLastAiRankedRow =
                    hasAiRankResults && isAiRanked && (!nextRow || !nextRow.isAiRanked);

                  return (
                    <React.Fragment key={con.id}>
                      <div
                        onClick={() => !isAttaching && toggleCandidateSelection(con.id)}
                        className={`p-3 rounded-xl border flex flex-col gap-1.5 transition-all cursor-pointer ${isChecked
                          ? 'bg-brand-50/60 border-brand-500'
                          : latestDup
                            ? 'bg-amber-50/30 border-amber-200 hover:border-amber-400'
                            : 'bg-white border-slate-200 hover:border-brand-400'
                          }`}
                      >
                        <div className="flex items-center justify-between gap-2.5">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${isChecked
                                ? 'bg-brand-600 border-brand-600 text-white'
                                : 'bg-white border-slate-300'
                                }`}
                            >
                              {isChecked && <Check className="w-3 h-3" strokeWidth={3} />}
                            </span>
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5 flex-wrap">
                                <span className="truncate">{con.fullName}</span>
                                <span className="text-[11px] font-normal text-slate-400">
                                  ({con.workAuth})
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                                {con.currentTitle} &bull;{' '}
                                <MaskedValue value={formatRate(con.hourlyRate)} isMasked={rateMasked} />
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            {showMatch && (
                              <span
                                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white border border-slate-200/90 text-slate-700 text-[11px] font-medium tabular-nums whitespace-nowrap leading-none"
                                title={
                                  isRowAiEvaluated
                                    ? 'Evaluated by SquadAI'
                                    : `${match.matched.length} of ${reqSkillList.length} required skills matched`
                                }
                              >
                                {isRowAiEvaluated ? (
                                  <AiIcon className="w-3 h-3 text-teal-600 shrink-0" />
                                ) : (
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${getMatchScoreDotClass(
                                      match.score
                                    )}`}
                                  />
                                )}
                                <span>
                                  {match.score === 0 && !isAiRanked
                                    ? 'No Skill Overlap'
                                    : `${match.score}% Match`}
                                </span>
                              </span>
                            )}
                            <ActionButton
                              type="button"
                              loading={attachingCandId === con.id}
                              loadingText="Attaching..."
                              disabled={isAttaching}
                              spinnerClassName="w-3 h-3 animate-spin shrink-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleQuickSingleAttach(con);
                              }}
                              className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer ${attachingCandId === con.id
                                  ? 'bg-brand-50 border-brand-200 text-brand-700'
                                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                                }`}
                            >
                              {latestDup ? 'Attach Anyway' : 'Quick Attach'}
                            </ActionButton>
                          </div>
                        </div>

                        {showMatch && (
                          <div className="pl-6 space-y-1">
                            {(() => {
                              const isSkillsExpanded = Boolean(expandedCandSkillIds[con.id]);
                              const visibleMatched = isSkillsExpanded
                                ? match.matched
                                : match.matched.slice(0, 4);
                              const visibleMissing = isSkillsExpanded
                                ? match.missing
                                : match.missing.slice(0, 3);
                              const hasHiddenCandSkills =
                                match.matched.length > 4 || match.missing.length > 3;

                              return (
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {match.matched.length > 0 && (
                                    <>
                                      <span className="text-[11px] font-semibold text-emerald-700">
                                        Matched:
                                      </span>
                                      {visibleMatched.map((skill, idx) => (
                                        <span
                                          key={idx}
                                          className="px-1.5 py-0.5 rounded text-[11px] bg-white border border-emerald-300 text-emerald-700 font-medium"
                                        >
                                          {skill}
                                        </span>
                                      ))}
                                      {!isSkillsExpanded && match.matched.length > 4 && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setExpandedCandSkillIds((prev) => ({
                                              ...prev,
                                              [con.id]: true,
                                            }));
                                          }}
                                          className="text-[11px] font-semibold text-emerald-700 hover:underline cursor-pointer"
                                        >
                                          +{match.matched.length - 4} more
                                        </button>
                                      )}
                                    </>
                                  )}
                                  {match.missing.length > 0 && (
                                    <>
                                      <span
                                        className={`text-[11px] font-medium text-slate-400 ${match.matched.length > 0 ? 'ml-1.5' : ''
                                          }`}
                                      >
                                        Missing:
                                      </span>
                                      {visibleMissing.map((skill, idx) => (
                                        <span
                                          key={idx}
                                          className="px-1.5 py-0.5 rounded text-[11px] bg-white border border-slate-300 text-slate-500"
                                        >
                                          {skill}
                                        </span>
                                      ))}
                                      {!isSkillsExpanded && match.missing.length > 3 && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setExpandedCandSkillIds((prev) => ({
                                              ...prev,
                                              [con.id]: true,
                                            }));
                                          }}
                                          className="text-[11px] font-semibold text-brand-600 hover:underline cursor-pointer"
                                        >
                                          +{match.missing.length - 3} more
                                        </button>
                                      )}
                                    </>
                                  )}
                                  {isSkillsExpanded && hasHiddenCandSkills && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setExpandedCandSkillIds((prev) => ({
                                          ...prev,
                                          [con.id]: false,
                                        }));
                                      }}
                                      className="text-[11px] font-semibold text-brand-600 hover:underline cursor-pointer ml-1"
                                    >
                                      Show less
                                    </button>
                                  )}
                                </div>
                              );
                            })()}
                            {isAiRanked && oneLineSummary && (
                              <div className="text-[11px] text-teal-700 font-medium">
                                {oneLineSummary}
                              </div>
                            )}
                          </div>
                        )}

                        {cvExcerpt && (
                          <div className="pl-6 text-[11px] text-brand-700 truncate">
                            CV match: {cvExcerpt}
                          </div>
                        )}

                        {latestDup && (
                          <div className="ml-6 inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-medium">
                            <AlertTriangle className="w-3 h-3 text-amber-600 flex-shrink-0" />
                            <span>
                              Already submitted to <strong>{latestDup.clientName}</strong>{' '}
                              {latestDup.daysAgo === 0
                                ? 'today'
                                : latestDup.daysAgo === 1
                                  ? '1 day ago'
                                  : `${latestDup.daysAgo} days ago`}{' '}
                              on{' '}
                              <span className="font-mono font-semibold">
                                {latestDup.requirementCode}
                              </span>{' '}
                              ({latestDup.stage}
                              {latestDup.recruiterName ? ` • by ${latestDup.recruiterName}` : ''})
                            </span>
                          </div>
                        )}
                      </div>
                      {isLastAiRankedRow && (remainingUnrankedCount ?? 0) > 0 && (
                        <div className="p-3 rounded-xl border border-teal-200/80 bg-teal-50/50 flex items-center justify-between gap-3 flex-wrap">
                          <div className="text-[11px] text-slate-700 font-medium">
                            Ranked top <strong className="font-semibold text-slate-900">{aiRankedCount}</strong> available &bull;{' '}
                            <strong className="font-semibold text-teal-800">{remainingUnrankedCount}</strong> more remaining
                          </div>
                          <button
                            type="button"
                            disabled={isAiRanking || isLoadingBench || isAttaching}
                            onClick={() => void handleAiRankTopMatches(true)}
                            className="px-3 py-1.5 rounded-lg border border-teal-200 bg-white hover:bg-teal-50 text-teal-800 text-[11px] font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-60"
                          >
                            {isAiRanking ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <AiIcon className="w-3 h-3 text-teal-600" />
                            )}
                            <span>
                              {isAiRanking
                                ? 'Ranking Next Batch...'
                                : `Rank Next ${Math.min(20, remainingUnrankedCount!)}`}
                            </span>
                          </button>
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
                {isLoadingMoreBench && (
                  <div className="py-2 text-center text-[11px] font-medium text-slate-400">
                    Loading next {BENCH_PAGE_SIZE} consultants...
                  </div>
                )}
                {!isLoadingMoreBench && hasMoreBench && (
                  <div className="py-1.5 text-center text-[11px] text-slate-400">
                    Scroll to load more ({availableRankedCandidates.length} of {availableTabCount})
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="bg-slate-50/60 border-t border-slate-100 flex-shrink-0">
            {drawerTab === 'available' && selectedDupCount > 0 && (
              <div className="px-6 py-2 bg-amber-50 border-b border-amber-200 flex items-center gap-2 text-[11px] text-amber-900 font-medium">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                <span>
                  {selectedDupCount} selected consultant{selectedDupCount === 1 ? ' was' : 's were'}{' '}
                  previously submitted to <strong>{currentReq.companyName}</strong> on another
                  requisition. Confirm before attaching to avoid duplicate client outreach.
                </span>
              </div>
            )}
            <div className="px-6 py-3.5 flex items-center justify-between gap-3">
              {drawerTab === 'attached' ? (
                <>
                  <span className="text-xs font-medium text-slate-600">
                    {attachedEntries.length} applicant{attachedEntries.length === 1 ? '' : 's'} attached to{' '}
                    <strong className="font-semibold text-slate-800">{currentReq.code}</strong>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDrawerTab('available')}
                      className="h-8 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-semibold transition-colors cursor-pointer"
                    >
                      Browse Available ({availableTabCount})
                    </button>
                    <button
                      type="button"
                      onClick={onClose}
                      className="h-8 px-3.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-[11px] font-semibold transition-colors cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <span className="text-xs font-medium text-slate-600">
                    {selectedCandidateIds.length > 0
                      ? `${selectedCandidateIds.length} consultant${selectedCandidateIds.length === 1 ? '' : 's'
                      } selected`
                      : 'Select one or more candidates'}
                  </span>
                  <div className="flex items-center gap-2">
                    {selectedCandidateIds.length > 0 && (
                      <button
                        type="button"
                        disabled={isAttaching}
                        onClick={() => setSelectedCandidateIds([])}
                        className="h-8 px-2.5 rounded-lg text-[11px] font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={isAttaching}
                      onClick={onClose}
                      className="h-8 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-semibold transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <ActionButton
                      type="button"
                      loading={isBatchAttaching}
                      loadingText="Attaching..."
                      disabled={isAttaching || selectedCandidateIds.length === 0}
                      onClick={handleBatchAttach}
                      className={`h-8 px-4 rounded-lg disabled:opacity-50 text-white text-[11px] font-semibold transition-colors cursor-pointer inline-flex items-center ${selectedDupCount > 0
                        ? 'bg-amber-600 hover:bg-amber-700'
                        : 'bg-brand-600 hover:bg-brand-700'
                        }`}
                    >
                      {selectedDupCount > 0
                        ? `Attach Anyway (${selectedCandidateIds.length})`
                        : `Attach ${selectedCandidateIds.length || ''} Applicant${selectedCandidateIds.length === 1 ? '' : 's'
                        }`}
                    </ActionButton>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </AnimatedDrawer>
  );
};
