import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Loader2,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';
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
import {
  extractResumeMatchExcerpt,
  matchesCandidateQuery,
  parseCandidateHourlyRate,
} from '../../utils/candidateSearch';
import {
  canonicalizeSkillExact,
  suggestSkillCorrection,
  textContainsCanonicalSkill,
  type SkillTypoCorrection,
} from '../../utils/skillMatcher';
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
 * normalizing skill aliases (React.js -> React, K8s -> Kubernetes) and safe typo matches (Rect -> React).
 */
export function computeCandidateSkillMatch(
  requiredSkillsCsv: string | undefined,
  candidateSkillsCsv: string | undefined,
  candidateTitle?: string,
  candidateNormalizedSkills?: string[]
): SkillMatchSummary {
  const rawReqSkills = String(requiredSkillsCsv || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (rawReqSkills.length === 0) {
    return { score: 0, matched: [], missing: [] };
  }

  const reqSkills: Array<{ label: string; norm: string; canonical: string }> = [];
  const seenReq = new Set<string>();
  for (const s of rawReqSkills) {
    const norm = normalizeSkillToken(s);
    const exactCanon = canonicalizeSkillExact(s);
    const typoFix = suggestSkillCorrection(s, { allowSearchStopwords: true });
    const canonical = typoFix?.canonical || exactCanon || norm;
    if (!canonical || seenReq.has(canonical)) continue;
    seenReq.add(canonical);
    reqSkills.push({ label: s, norm, canonical });
  }

  const candSkills = String(candidateSkillsCsv || '')
    .split(/[,;|]/)
    .map(normalizeSkillToken)
    .filter(Boolean);
  const candCanonicalSet = new Set<string>([
    ...candSkills.map((cs) => canonicalizeSkillExact(cs)).filter(Boolean),
    ...(Array.isArray(candidateNormalizedSkills)
      ? candidateNormalizedSkills.map((s) => canonicalizeSkillExact(s)).filter(Boolean)
      : []),
  ]);
  const titleLower = normalizeSkillToken(candidateTitle || '');

  const matched: string[] = [];
  const missing: string[] = [];

  for (const req of reqSkills) {
    const isDirectMatch =
      candCanonicalSet.has(req.canonical) ||
      candSkills.some((cs) => {
        if (cs === req.norm) return true;
        if (req.norm.length >= 3 && cs.includes(req.norm)) return true;
        if (cs.length >= 3 && req.norm.includes(cs)) return true;
        return false;
      });

    const isTitleMatch =
      !isDirectMatch &&
      (textContainsCanonicalSkill(titleLower, req.canonical) ||
        (req.norm.length >= 3 && titleLower.includes(req.norm)));

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
  skeletonCount?: number;
}

const RankingProgressBody: React.FC<RankingProgressBodyProps> = ({
  progress,
  skeletonCount = 6,
}) => {
  const smoothWidth = Math.max(4, Math.min(100, progress));
  const pct = Math.max(4, Math.min(100, Math.round(progress)));
  const stageText =
    pct >= 100
      ? 'Top skill matches ready!'
      : pct < 30
        ? 'Scanning skills, keywords, and bench profiles...'
        : pct < 60
          ? 'Matching normalized skills and availability...'
          : pct < 88
            ? 'Ordering highest skill matches first...'
            : 'Finalizing ranked shortlist...';

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
                SquadAI Rank is ordering best matches...
              </div>
              <div className="text-[11px] text-slate-500 truncate">{stageText}</div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white border border-slate-200/90 text-slate-700 text-[11px] font-semibold tabular-nums shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-600 animate-pulse" />
            <span>{pct}%</span>
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
            className="h-full rounded-full bg-teal-600 will-change-[width]"
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
  const { formatRate, symbol: currencySymbol } = useCurrency();
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
  const [exactOnly, setExactOnly] = useState(false);
  const [benchWorkAuth, setBenchWorkAuth] = useState('All');
  const [availabilityScope, setAvailabilityScope] = useState<'bench' | 'non_billable' | 'all'>(
    'non_billable'
  );
  const [matchMode, setMatchMode] = useState<'overlap' | 'strict' | 'all'>('overlap');
  const [benchSortBy, setBenchSortBy] = useState<'match' | 'bench' | 'rate_asc' | 'recent'>('match');
  const [maxRate, setMaxRate] = useState('');
  const debouncedBenchSearch = useDebounce(benchSearch, 250);
  const debouncedMaxRate = useDebounce(maxRate, 250);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [attachingCandId, setAttachingCandId] = useState<string | null>(null);
  const [isBatchAttaching, setIsBatchAttaching] = useState(false);
  const isAttaching = Boolean(attachingCandId) || isBatchAttaching;
  const [isQuickRanking, setIsQuickRanking] = useState(false);
  const [quickRankProgress, setQuickRankProgress] = useState(0);
  const [justRankedPulse, setJustRankedPulse] = useState(false);
  const [totalPoolCount, setTotalPoolCount] = useState<number>(candidates.length);
  const [exactAllCount, setExactAllCount] = useState<number>(0);
  const [searchCorrections, setSearchCorrections] = useState<SkillTypoCorrection[]>([]);
  const [fitSummaryByCandId, setFitSummaryByCandId] = useState<Record<string, CapabilitySummary>>({});
  const [checkingFitCandIds, setCheckingFitCandIds] = useState<Record<string, boolean>>({});
  const [expandedFitCandIds, setExpandedFitCandIds] = useState<Record<string, boolean>>({});
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
  const rankRunIdRef = useRef<number>(0);
  const rankAbortRef = useRef<AbortController | null>(null);
  const rankRafRef = useRef<number | null>(null);
  const rankFinishTimerRef = useRef<number | null>(null);
  const rankPulseTimerRef = useRef<number | null>(null);
  const skipNextFilterFetchRef = useRef<boolean>(false);
  const autoRankTriggeredRef = useRef<boolean>(false);
  const handleInstantKeywordRankRef = useRef<() => Promise<void>>(async () => {});
  const benchListRef = useRef<HTMLDivElement | null>(null);

  const stopQuickRank = useCallback((clearPulse = false) => {
    rankRunIdRef.current += 1;
    rankAbortRef.current?.abort();
    rankAbortRef.current = null;
    if (rankRafRef.current !== null) {
      window.cancelAnimationFrame(rankRafRef.current);
      rankRafRef.current = null;
    }
    if (rankFinishTimerRef.current !== null) {
      window.clearTimeout(rankFinishTimerRef.current);
      rankFinishTimerRef.current = null;
    }
    if (clearPulse && rankPulseTimerRef.current !== null) {
      window.clearTimeout(rankPulseTimerRef.current);
      rankPulseTimerRef.current = null;
    }
    setIsQuickRanking(false);
    setQuickRankProgress(0);
    if (clearPulse) setJustRankedPulse(false);
  }, []);

  useEffect(() => {
    for (const c of candidates) {
      if (c?.id) knownCandidatesRef.current.set(c.id, c);
    }
  }, [candidates]);

  useEffect(() => () => stopQuickRank(true), [stopQuickRank]);

  const openResetKey = isOpen
    ? `${requirement?.id || ''}|${allowRequirementSwitch ? selectedReqId : ''}`
    : 'closed';

  // Reset picker filters & selection on open or external target change
  useEffect(() => {
    skipNextFilterFetchRef.current = false;
    autoRankTriggeredRef.current = false;
    stopQuickRank(true);

    setBenchSearch('');
    setExactOnly(false);
    setBenchWorkAuth('All');
    setAvailabilityScope('non_billable');
    setMatchMode('overlap');
    setBenchSortBy('match');
    setMaxRate('');

    if (!isOpen) {
      return;
    }
    setSelectedReqId(requirement?.id || requirements[0]?.id || '');
    setDrawerTab('available');
    setShowAllReqSkills(false);
    setExpandedCandSkillIds({});
    setSelectedCandidateIds([]);
    setAttachingCandId(null);
    setIsBatchAttaching(false);
    setClientDuplicateMap({});
    setFitSummaryByCandId({});
    setCheckingFitCandIds({});
    setExpandedFitCandIds({});
    setTotalPoolCount(candidates.length);
    setExactAllCount(0);
    setSearchCorrections([]);
    setBenchPage(1);
    setPagedCandidates(candidates.slice(0, BENCH_PAGE_SIZE));
    setTotalBenchCount(candidates.length);
    setHasMoreBench(candidates.length > BENCH_PAGE_SIZE);
  }, [openResetKey]);

  useEffect(() => {
    setExactOnly(false);
  }, [benchSearch]);

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

  const reqSkillList = useMemo(
    () =>
      String(currentReq?.skillsRequired || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    [currentReq?.skillsRequired]
  );

  const parsedMaxRate = useMemo(() => {
    if (rateMasked || !debouncedMaxRate.trim()) return undefined;
    const num = Number(debouncedMaxRate);
    return Number.isFinite(num) && num > 0 ? num : undefined;
  }, [rateMasked, debouncedMaxRate]);

  const effectiveMatchMode = reqSkillList.length === 0 ? 'all' : matchMode;

  const filteredLocalCandidates = useMemo(() => {
    const filtered = candidates.filter((c) => {
      if (availabilityScope === 'bench' && c.pipelineStage !== 'Available / Bench') return false;
      if (availabilityScope === 'non_billable' && c.pipelineStage === 'Billable') return false;
      const matchesSearch = matchesCandidateQuery(c, debouncedBenchSearch, { exactOnly });
      const matchesAuth =
        benchWorkAuth === 'All' ||
        (c.workAuth || '').toLowerCase().includes(benchWorkAuth.toLowerCase());
      let matchesRate = true;
      if (parsedMaxRate !== undefined) {
        const rateNum = parseCandidateHourlyRate(c.hourlyRate);
        matchesRate = rateNum !== null && rateNum <= parsedMaxRate;
      }
      if (!matchesSearch || !matchesAuth || !matchesRate) return false;
      if (reqSkillList.length > 0 && effectiveMatchMode !== 'all') {
        const summary =
          c.matchSummary ||
          computeCandidateSkillMatch(
            currentReq?.skillsRequired,
            c.skillset,
            c.currentTitle,
            c.normalizedSkills
          );
        if (effectiveMatchMode === 'strict' && summary.missing.length > 0) return false;
        if (effectiveMatchMode === 'overlap' && summary.matched.length === 0) return false;
      }
      return true;
    });

    const effectiveLocalSort =
      benchSortBy === 'rate_asc' && rateMasked ? 'match' : benchSortBy;

    return [...filtered].sort((a, b) => {
      const aMatch =
        a.matchSummary?.score ??
        computeCandidateSkillMatch(
          currentReq?.skillsRequired,
          a.skillset,
          a.currentTitle,
          a.normalizedSkills
        ).score;
      const bMatch =
        b.matchSummary?.score ??
        computeCandidateSkillMatch(
          currentReq?.skillsRequired,
          b.skillset,
          b.currentTitle,
          b.normalizedSkills
        ).score;
      const aBench = a.pipelineStage === 'Available / Bench' ? 1 : 0;
      const bBench = b.pipelineStage === 'Available / Bench' ? 1 : 0;

      if (effectiveLocalSort === 'bench') {
        return bBench - aBench || bMatch - aMatch;
      }
      if (effectiveLocalSort === 'rate_asc') {
        const aRate = parseCandidateHourlyRate(a.hourlyRate) ?? Number.POSITIVE_INFINITY;
        const bRate = parseCandidateHourlyRate(b.hourlyRate) ?? Number.POSITIVE_INFINITY;
        return aRate - bRate || bMatch - aMatch;
      }
      if (effectiveLocalSort === 'recent') {
        return bMatch - aMatch || bBench - aBench;
      }
      return bMatch - aMatch || bBench - aBench;
    });
  }, [
    candidates,
    availabilityScope,
    debouncedBenchSearch,
    exactOnly,
    benchWorkAuth,
    parsedMaxRate,
    rateMasked,
    reqSkillList.length,
    effectiveMatchMode,
    benchSortBy,
    currentReq?.skillsRequired,
  ]);

  useEffect(() => {
    if (!isOpen) return;
    if (skipNextFilterFetchRef.current) {
      skipNextFilterFetchRef.current = false;
      return;
    }
    if (
      autoRankOnOpen &&
      currentReq?.id &&
      !autoRankTriggeredRef.current &&
      !debouncedBenchSearch.trim() &&
      benchWorkAuth === 'All' &&
      availabilityScope === 'non_billable' &&
      benchSortBy === 'match' &&
      parsedMaxRate === undefined
    ) {
      autoRankTriggeredRef.current = true;
      void handleInstantKeywordRankRef.current();
      return;
    }
    stopQuickRank(true);
    let active = true;
    const searchTerm = debouncedBenchSearch.trim();
    const filterKey = `${currentReq?.id || ''}|${searchTerm}|${exactOnly}|${benchWorkAuth}|${availabilityScope}|${parsedMaxRate ?? ''}|${effectiveMatchMode}|${benchSortBy}`;
    activeSearchRef.current = filterKey;
    setIsLoadingBench(true);

    apiClient
      .post('/candidates/match-search', {
        requirementId: currentReq?.id || undefined,
        skillsRequired: currentReq?.skillsRequired || undefined,
        search: searchTerm || undefined,
        exactOnly,
        workAuth: benchWorkAuth !== 'All' ? benchWorkAuth : undefined,
        availabilityScope,
        maxRate: parsedMaxRate,
        matchMode: effectiveMatchMode,
        sortBy: benchSortBy,
        excludeAttached: true,
        page: 1,
        limit: BENCH_PAGE_SIZE,
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
        const meta = res.data?.meta;
        const total = typeof pagination?.total === 'number' ? pagination.total : mapped.length;
        const totalPages = typeof pagination?.totalPages === 'number' ? pagination.totalPages : 1;
        setPagedCandidates(mapped);
        setBenchPage(1);
        setTotalBenchCount(total);
        setHasMoreBench(1 < totalPages);
        if (typeof meta?.totalPool === 'number') setTotalPoolCount(meta.totalPool);
        if (typeof meta?.exactAllCount === 'number') setExactAllCount(meta.exactAllCount);
        setSearchCorrections(Array.isArray(meta?.corrections) ? meta.corrections : []);
      })
      .catch(() => {
        if (!active) return;
        const slice = filteredLocalCandidates.slice(0, BENCH_PAGE_SIZE);
        setPagedCandidates(slice);
        setBenchPage(1);
        setTotalBenchCount(filteredLocalCandidates.length);
        setHasMoreBench(filteredLocalCandidates.length > slice.length);
        setTotalPoolCount(candidates.length);
        setExactAllCount(
          filteredLocalCandidates.filter((c) => {
            const s = computeCandidateSkillMatch(
              currentReq?.skillsRequired,
              c.skillset,
              c.currentTitle,
              c.normalizedSkills
            );
            return reqSkillList.length > 0 && s.missing.length === 0;
          }).length
        );
      })
      .finally(() => {
        if (active) {
          setIsLoadingBench(false);
        }
      });

    return () => {
      active = false;
    };
  }, [
    isOpen,
    currentReq?.id,
    currentReq?.skillsRequired,
    debouncedBenchSearch,
    exactOnly,
    benchWorkAuth,
    availabilityScope,
    parsedMaxRate,
    effectiveMatchMode,
    benchSortBy,
    stopQuickRank,
  ]);

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
    const filterKey = `${currentReq?.id || ''}|${searchTerm}|${exactOnly}|${benchWorkAuth}|${availabilityScope}|${parsedMaxRate ?? ''}|${effectiveMatchMode}|${benchSortBy}`;
    setIsLoadingMoreBench(true);

    apiClient
      .post('/candidates/match-search', {
        requirementId: currentReq?.id || undefined,
        skillsRequired: currentReq?.skillsRequired || undefined,
        search: searchTerm || undefined,
        exactOnly,
        workAuth: benchWorkAuth !== 'All' ? benchWorkAuth : undefined,
        availabilityScope,
        maxRate: parsedMaxRate,
        matchMode: effectiveMatchMode,
        sortBy: benchSortBy,
        excludeAttached: true,
        page: nextPage,
        limit: BENCH_PAGE_SIZE,
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
    currentReq?.id,
    currentReq?.skillsRequired,
    debouncedBenchSearch,
    exactOnly,
    benchWorkAuth,
    availabilityScope,
    parsedMaxRate,
    effectiveMatchMode,
    benchSortBy,
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

  const aiModeEnabled = aiCapabilities.enabled;
  const checkedFitCount = Object.keys(fitSummaryByCandId).length;

  const availableRankedCandidates = useMemo(() => {
    const unattached = pagedCandidates.filter((con) => !attachedStageByCandId.has(con.id));
    return unattached.map((con, idx) => {
      const localMatch =
        con.matchSummary ||
        computeCandidateSkillMatch(
          currentReq?.skillsRequired,
          con.skillset,
          con.currentTitle,
          con.normalizedSkills
        );
      const checkedFit = fitSummaryByCandId[con.id] || null;
      const showMatch = reqSkillList.length > 0 || Boolean(checkedFit);

      return {
        con,
        idx,
        checkedFit,
        showMatch,
        match: localMatch,
      };
    });
  }, [
    pagedCandidates,
    attachedStageByCandId,
    currentReq?.skillsRequired,
    reqSkillList.length,
    fitSummaryByCandId,
  ]);

  const availableTabCount = Math.max(availableRankedCandidates.length, totalBenchCount);

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

  const handleInstantKeywordRank = async () => {
    if (isQuickRanking || isAttaching) return;
    stopQuickRank(true);
    const runId = ++rankRunIdRef.current;
    const targetMatchMode = reqSkillList.length === 0 ? 'all' : 'overlap';
    if (benchSortBy !== 'match' || (reqSkillList.length > 0 && matchMode === 'all')) {
      skipNextFilterFetchRef.current = true;
      setBenchSortBy('match');
      if (reqSkillList.length > 0 && matchMode === 'all') {
        setMatchMode('overlap');
      }
    }

    const controller = new AbortController();
    rankAbortRef.current = controller;
    setIsQuickRanking(true);
    setQuickRankProgress(4);

    const requestStart = performance.now();
    let apiDone = false;
    let responseStartTime = requestStart;
    let phase2StartPct = 4;
    let currentPct = 4;
    const POST_RESPONSE_SWEEP_MS = 10000;

    const tickFrame = (now: number) => {
      if (rankRunIdRef.current !== runId) return;
      const totalElapsed = now - requestStart;

      if (!apiDone) {
        currentPct = 4 + 24 * (1 - Math.exp(-totalElapsed / 1200));
        setQuickRankProgress(currentPct);
        rankRafRef.current = window.requestAnimationFrame(tickFrame);
        return;
      }

      const postElapsed = Math.max(0, now - responseStartTime);
      const ratio = Math.min(1, postElapsed / POST_RESPONSE_SWEEP_MS);
      const eased = 1 - Math.pow(1 - ratio, 1.35);
      currentPct = phase2StartPct + (100 - phase2StartPct) * eased;
      setQuickRankProgress(currentPct);

      if (ratio < 1) {
        rankRafRef.current = window.requestAnimationFrame(tickFrame);
        return;
      }

      rankRafRef.current = null;
      setQuickRankProgress(100);
      rankFinishTimerRef.current = window.setTimeout(() => {
        if (rankRunIdRef.current !== runId) return;
        rankFinishTimerRef.current = null;
        setIsQuickRanking(false);
        setQuickRankProgress(0);
        setJustRankedPulse(true);
        benchListRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        rankPulseTimerRef.current = window.setTimeout(() => {
          rankPulseTimerRef.current = null;
          setJustRankedPulse(false);
        }, 1800);
      }, 350);
    };

    rankRafRef.current = window.requestAnimationFrame(tickFrame);

    try {
      const searchTerm = debouncedBenchSearch.trim();
      const filterKey = `${currentReq?.id || ''}|${searchTerm}|${exactOnly}|${benchWorkAuth}|${availabilityScope}|${parsedMaxRate ?? ''}|${targetMatchMode}|match`;
      activeSearchRef.current = filterKey;

      const res = await apiClient.post(
        '/candidates/match-search',
        {
          requirementId: currentReq?.id || undefined,
          skillsRequired: currentReq?.skillsRequired || undefined,
          search: searchTerm || undefined,
          exactOnly,
          workAuth: benchWorkAuth !== 'All' ? benchWorkAuth : undefined,
          availabilityScope,
          maxRate: parsedMaxRate,
          matchMode: targetMatchMode,
          sortBy: 'match',
          excludeAttached: true,
          page: 1,
          limit: BENCH_PAGE_SIZE,
        },
        { signal: controller.signal }
      );

      if (rankRunIdRef.current !== runId) return;
      const raw = Array.isArray(res.data?.data) ? res.data.data : [];
      const mapped: Candidate[] = raw.map(mapCandidateFromApi);
      for (const c of mapped) {
        if (c?.id) knownCandidatesRef.current.set(c.id, c);
      }
      onCandidatesSeen?.(mapped);
      const pagination = res.data?.pagination;
      const meta = res.data?.meta;
      const total = typeof pagination?.total === 'number' ? pagination.total : mapped.length;
      const totalPages = typeof pagination?.totalPages === 'number' ? pagination.totalPages : 1;
      setPagedCandidates(mapped);
      setBenchPage(1);
      setTotalBenchCount(total);
      setHasMoreBench(1 < totalPages);
      if (typeof meta?.totalPool === 'number') setTotalPoolCount(meta.totalPool);
      if (typeof meta?.exactAllCount === 'number') setExactAllCount(meta.exactAllCount);
      setSearchCorrections(Array.isArray(meta?.corrections) ? meta.corrections : []);
    } catch (err: any) {
      if (
        controller.signal.aborted ||
        err?.code === 'ERR_CANCELED' ||
        err?.name === 'CanceledError' ||
        err?.name === 'AbortError' ||
        rankRunIdRef.current !== runId
      ) {
        return;
      }
      const slice = filteredLocalCandidates.slice(0, BENCH_PAGE_SIZE);
      setPagedCandidates(slice);
      setBenchPage(1);
      setTotalBenchCount(filteredLocalCandidates.length);
      setHasMoreBench(filteredLocalCandidates.length > slice.length);
    } finally {
      if (rankAbortRef.current === controller) {
        rankAbortRef.current = null;
      }
      if (rankRunIdRef.current === runId) {
        phase2StartPct = currentPct;
        responseStartTime = performance.now();
        apiDone = true;
      }
    }
  };

  handleInstantKeywordRankRef.current = handleInstantKeywordRank;

  const handleCheckCandidateFit = async (cand: Candidate, forceRefresh = false) => {
    if (!currentReq?.id || checkingFitCandIds[cand.id]) return;
    setCheckingFitCandIds((prev) => ({ ...prev, [cand.id]: true }));
    try {
      const res = await apiClient.post(
        `/requirements/${currentReq.id}/candidates/${cand.id}/evaluate`,
        { forceRefresh },
        { timeout: 30000 }
      );
      const summary = res.data?.data?.capabilitySummary as CapabilitySummary | undefined;
      if (summary) {
        setFitSummaryByCandId((prev) => ({ ...prev, [cand.id]: summary }));
        setExpandedFitCandIds((prev) => ({ ...prev, [cand.id]: true }));
      }
    } catch (err: any) {
      const errMsg =
        err?.code === 'ECONNABORTED'
          ? 'Fit check timed out. Please try again.'
          : err?.response?.data?.message ||
            err?.message ||
            'Could not evaluate candidate fit right now.';
      notifyToast('Check Fit Failed', errMsg, 'error');
    } finally {
      setCheckingFitCandIds((prev) => {
        const next = { ...prev };
        delete next[cand.id];
        return next;
      });
    }
  };

  const buildPrecomputedCapabilities = (
    candIds: string[]
  ): Record<string, CapabilitySummary> | undefined => {
    const out: Record<string, CapabilitySummary> = {};
    for (const id of candIds) {
      const entry = fitSummaryByCandId[id];
      if (!entry || !entry.evaluatedWithAi) continue;
      out[id] = entry;
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
      panelClassName="w-full max-w-4xl bg-white h-full border-l border-slate-200 shadow-2xl flex flex-col overflow-hidden"
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
                  placeholder="Search skills, boolean (AND / OR / NOT), or resume..."
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
                  minMenuWidth={145}
                  options={[
                    { value: 'All', label: 'All Work Auth' },
                    ...taxonomies.workAuth.map((auth) => ({ value: auth, label: auth })),
                  ]}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <CustomSelect
                ariaLabel="Availability pool"
                value={availabilityScope}
                onChange={(val) =>
                  setAvailabilityScope(val as 'bench' | 'non_billable' | 'all')
                }
                size="sm"
                fullWidth={false}
                minMenuWidth={155}
                options={[
                  { value: 'non_billable', label: 'Bench + In-Process' },
                  { value: 'bench', label: 'Bench Only' },
                  { value: 'all', label: 'All (incl. Billable)' },
                ]}
              />

              {reqSkillList.length > 0 && (
                <CustomSelect
                  ariaLabel="Skill filter mode"
                  value={matchMode}
                  onChange={(val) =>
                    setMatchMode(val as 'overlap' | 'strict' | 'all')
                  }
                  size="sm"
                  fullWidth={false}
                  minMenuWidth={155}
                  options={[
                    { value: 'overlap', label: 'Best Skill Overlap' },
                    { value: 'strict', label: 'Exact All Skills' },
                    { value: 'all', label: 'All Consultants' },
                  ]}
                />
              )}

              {!rateMasked && (
                <div className="inline-flex items-center h-8 bg-white border border-slate-200 rounded-lg px-2 gap-1 focus-within:border-brand-600 transition-all">
                  <span className="text-[11px] font-semibold text-slate-400 pr-1 border-r border-slate-100 select-none whitespace-nowrap">
                    Max {currencySymbol}/hr
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={maxRate}
                    onChange={(e) => setMaxRate(e.target.value.replace(/[^\d]/g, ''))}
                    placeholder="Any"
                    aria-label="Maximum hourly pay rate"
                    className="w-12 text-center text-xs text-slate-700 placeholder:text-slate-400 bg-transparent outline-none"
                  />
                </div>
              )}

              <CustomSelect
                ariaLabel="Sort matched consultants"
                value={benchSortBy}
                onChange={(val) =>
                  setBenchSortBy(val as 'match' | 'bench' | 'rate_asc' | 'recent')
                }
                size="sm"
                fullWidth={false}
                minMenuWidth={155}
                options={[
                  { value: 'match', label: 'Sort: Best Match' },
                  { value: 'bench', label: 'Sort: Bench First' },
                  ...(!rateMasked
                    ? [{ value: 'rate_asc', label: 'Sort: Lowest Rate' }]
                    : []),
                  { value: 'recent', label: 'Sort: Recently Updated' },
                ]}
              />
            </div>

            <div className="flex items-center justify-between gap-2 flex-wrap">
              <SegmentedControl<'available' | 'attached'>
                value={drawerTab}
                onChange={setDrawerTab}
                ariaLabel="Switch between available and attached candidates"
                options={[
                  { value: 'available', label: `Matches (${availableTabCount})` },
                  { value: 'attached', label: `Attached (${attachedEntries.length})` },
                ]}
              />

              {drawerTab === 'available' && availableTabCount > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  {checkedFitCount > 0 && (
                    <StatusBadge
                      tone="emerald"
                      size="xs"
                      icon={<AiIcon className="w-3 h-3 text-teal-600 shrink-0" />}
                      label={`${checkedFitCount} Fit Check${checkedFitCount === 1 ? '' : 's'}`}
                    />
                  )}
                  <button
                    type="button"
                    disabled={isQuickRanking || isLoadingBench || isAttaching}
                    onClick={() => void handleInstantKeywordRank()}
                    title="Instant keyword & skill rank across all matching consultants"
                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-all duration-150 disabled:opacity-60 ${justRankedPulse
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                      : 'border-teal-300 bg-white hover:bg-teal-50/70 text-teal-700'
                      }`}
                  >
                    {isQuickRanking ? (
                      <Loader2 className="w-3 h-3 animate-spin text-teal-600 shrink-0" />
                    ) : justRankedPulse ? (
                      <Check className="w-3 h-3 text-emerald-600 shrink-0" strokeWidth={2.5} />
                    ) : (
                      <AiIcon className="w-3 h-3 text-teal-600 shrink-0" />
                    )}
                    <span>
                      {isQuickRanking
                        ? 'Ranking...'
                        : justRankedPulse
                          ? 'SquadAI Ranked'
                          : 'SquadAI Rank'}
                    </span>
                  </button>
                </div>
              )}
            </div>

            {drawerTab === 'available' && (totalPoolCount > 0 || searchCorrections.length > 0) && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-slate-500 flex-wrap">
                  <span>
                    <strong className="font-semibold text-slate-800">{availableTabCount}</strong>{' '}
                    {effectiveMatchMode === 'strict'
                      ? availableTabCount === 1
                        ? 'exact all-skill match'
                        : 'exact all-skill matches'
                      : effectiveMatchMode === 'overlap' && reqSkillList.length > 0
                        ? availableTabCount === 1
                          ? 'skill match'
                          : 'skill matches'
                        : availableTabCount === 1
                          ? 'eligible consultant'
                          : 'eligible consultants'}
                    {totalPoolCount > 0 && (
                      <>
                        {' '}out of <strong className="font-semibold text-slate-700">{totalPoolCount}</strong> total
                      </>
                    )}
                    {reqSkillList.length > 0 && exactAllCount > 0 && effectiveMatchMode !== 'strict' && (
                      <>
                        {' '}&bull;{' '}
                        <button
                          type="button"
                          onClick={() => setMatchMode('strict')}
                          className="font-semibold text-emerald-700 hover:underline cursor-pointer"
                        >
                          {exactAllCount} match all skills
                        </button>
                      </>
                    )}
                  </span>
                </div>

                {(searchCorrections.length > 0 || (exactOnly && benchSearch.trim())) && (
                  <div className="px-2.5 py-1.5 rounded-lg bg-brand-50/50 border border-brand-200/70 flex items-center justify-between gap-2 text-[11px] text-slate-700 flex-wrap">
                    {exactOnly ? (
                      <span>
                        Exact literal filter active (no typo auto-correction).
                      </span>
                    ) : (
                      <span>
                        Typo auto-matched:{' '}
                        {searchCorrections.map((c, i) => (
                          <React.Fragment key={`${c.from}-${c.canonical}`}>
                            {i > 0 ? ', ' : ''}
                            <span className="font-mono text-slate-500">"{c.from}"</span> &rarr;{' '}
                            <strong className="font-semibold text-slate-900">{c.display}</strong>
                          </React.Fragment>
                        ))}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setExactOnly((prev) => !prev)}
                      className="font-semibold text-brand-700 hover:underline cursor-pointer whitespace-nowrap"
                    >
                      {exactOnly ? 'Enable typo fix' : 'Exact only'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Scrollable Candidate List */}
          <div
            ref={benchListRef}
            onScroll={drawerTab === 'available' ? handleBenchScroll : undefined}
            className={`p-4 overflow-y-auto space-y-2 flex-1 min-h-0 transition-opacity duration-150 ${isLoadingBench && !isQuickRanking && pagedCandidates.length > 0 ? 'opacity-65' : 'opacity-100'}`}
          >
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
            ) : isQuickRanking ? (
              <RankingProgressBody progress={quickRankProgress} skeletonCount={6} />
            ) : (isLoadingBench && pagedCandidates.length === 0) ||
              (isLoadingMoreBench && availableRankedCandidates.length === 0) ? (
              <div className="py-10 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                Loading available consultants...
              </div>
            ) : availableRankedCandidates.length === 0 ? (
              <div className="py-10 px-4 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-3">
                <p>
                  {effectiveMatchMode === 'strict'
                    ? 'No unattached consultants match ALL required skills under your current filters.'
                    : effectiveMatchMode === 'overlap' && reqSkillList.length > 0
                      ? 'No exact skill matches found under your current filters.'
                      : benchSearch.trim() || benchWorkAuth !== 'All' || parsedMaxRate !== undefined
                        ? 'No unattached consultants match your filter.'
                        : attachedEntries.length > 0
                          ? 'All matching consultants are already attached to this requirement.'
                          : 'No bench consultants available to assign yet.'}
                </p>
                {reqSkillList.length > 0 && effectiveMatchMode !== 'all' && (
                  <div className="flex items-center justify-center gap-2 flex-wrap">
                    {effectiveMatchMode === 'strict' && (
                      <button
                        type="button"
                        onClick={() => setMatchMode('overlap')}
                        className="h-7 px-3 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-[11px] font-semibold cursor-pointer transition-colors"
                      >
                        Show Partial Skill Matches
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setMatchMode('all')}
                      className="h-7 px-3 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-[11px] font-semibold cursor-pointer transition-colors"
                    >
                      Browse All Consultants
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                {availableRankedCandidates.map(({ con, match, checkedFit, showMatch }) => {
                  const isChecked = selectedCandidateIds.includes(con.id);
                  const isCheckingFit = Boolean(checkingFitCandIds[con.id]);
                  const isFitExpanded = Boolean(expandedFitCandIds[con.id]);
                  const checkedFitScore =
                    typeof checkedFit?.fitScore === 'number'
                      ? Math.round(checkedFit.fitScore)
                      : null;
                  const fitBadgeMeta =
                    checkedFit && checkedFitScore !== null
                      ? getCapabilityBadgeStyle(checkedFitScore, checkedFit)
                      : null;
                  const dupWarnings = clientDuplicateMap[con.id] || [];
                  const latestDup = dupWarnings[0];
                  const cvExcerpt = benchSearch.trim()
                    ? extractResumeMatchExcerpt(con.rawSnippet, benchSearch)
                    : null;

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

                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {reqSkillList.length > 0 && (
                              <span
                                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white border border-slate-200/90 text-slate-700 text-[11px] font-medium tabular-nums whitespace-nowrap leading-none"
                                title={`${match.matched.length} of ${reqSkillList.length} required skills matched`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${getMatchScoreDotClass(
                                    match.score
                                  )}`}
                                />
                                <span>
                                  {match.matched.length === 0
                                    ? '0 Skill Match'
                                    : `${match.matched.length}/${reqSkillList.length} Skills`}
                                </span>
                              </span>
                            )}

                            {checkedFit && fitBadgeMeta && checkedFitScore !== null ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedFitCandIds((prev) => ({
                                    ...prev,
                                    [con.id]: !prev[con.id],
                                  }));
                                }}
                                title="Toggle Fit Score breakdown"
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-bold tabular-nums cursor-pointer transition-colors whitespace-nowrap ${fitBadgeMeta.badgeClass}`}
                              >
                                {checkedFit.evaluatedWithAi && (
                                  <AiIcon className="w-3 h-3 shrink-0" />
                                )}
                                <span>
                                  {checkedFitScore}% &middot; {fitBadgeMeta.label}
                                </span>
                                {isFitExpanded ? (
                                  <ChevronUp className="w-3 h-3 shrink-0" />
                                ) : (
                                  <ChevronDown className="w-3 h-3 shrink-0" />
                                )}
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={isCheckingFit || isAttaching}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleCheckCandidateFit(con);
                                }}
                                title={
                                  aiModeEnabled
                                    ? 'Run SquadAI Fit Check (0–100 Fit Score, strengths & gaps)'
                                    : 'Run Skill Fit Check'
                                }
                                className="px-2 py-1 rounded-lg border border-teal-200 bg-white hover:bg-teal-50/70 text-teal-700 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-60 whitespace-nowrap"
                              >
                                {isCheckingFit ? (
                                  <Loader2 className="w-3 h-3 animate-spin text-teal-600 shrink-0" />
                                ) : (
                                  <AiIcon className="w-3 h-3 text-teal-600 shrink-0" />
                                )}
                                <span>{isCheckingFit ? 'Checking...' : 'Fit Check'}</span>
                              </button>
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
                          </div>
                        )}

                        {checkedFit && isFitExpanded && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="ml-6 mt-0.5 p-2.5 rounded-lg bg-teal-50/40 border border-teal-200/80 space-y-1.5 text-[11px]"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-teal-900">
                                {checkedFit.evaluatedWithAi ? 'SquadAI Fit Check' : 'Skill Fit Summary'}
                              </span>
                              <button
                                type="button"
                                disabled={isCheckingFit || isAttaching}
                                onClick={() => void handleCheckCandidateFit(con, true)}
                                className="inline-flex items-center gap-1 font-semibold text-teal-700 hover:text-teal-900 cursor-pointer disabled:opacity-50"
                              >
                                <RotateCcw className={`w-3 h-3 ${isCheckingFit ? 'animate-spin' : ''}`} />
                                <span>{isCheckingFit ? 'Re-checking...' : 'Re-check'}</span>
                              </button>
                            </div>
                            {checkedFit.verdict && (
                              <p className="text-slate-700 leading-snug">{checkedFit.verdict}</p>
                            )}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                              {checkedFit.strengths.length > 0 && (
                                <div className="space-y-0.5">
                                  <div className="font-semibold text-emerald-700">Strengths</div>
                                  <ul className="list-disc list-inside text-slate-600 space-y-0.5">
                                    {checkedFit.strengths.map((s, i) => (
                                      <li key={i}>{s}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {checkedFit.gaps.length > 0 && (
                                <div className="space-y-0.5">
                                  <div className="font-semibold text-amber-700">Gaps</div>
                                  <ul className="list-disc list-inside text-slate-600 space-y-0.5">
                                    {checkedFit.gaps.map((g, i) => (
                                      <li key={i}>{g}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
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
