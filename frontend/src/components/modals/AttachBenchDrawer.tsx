import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, FileSpreadsheet, Loader2, Search, X } from 'lucide-react';
import { AiIcon, AiTag } from '../shared/AiBrand';
import { apiClient } from '../../config/api.config';
import { Candidate, ClientDuplicateWarning, Requirement } from '../../types';
import { useCurrency } from '../../utils/currency';
import { useAiCapabilities } from '../../utils/workspaceBrand';
import { useDebounce } from '../../utils/useDebounce';
import { mapCandidateFromApi, mapRequirementFromApi } from '../../utils/entityMappers';
import { extractResumeMatchExcerpt, matchesCandidateQuery } from '../../utils/candidateSearch';
import { useMasterTaxonomies } from '../shared/DynamicCustomFieldsSection';
import { CustomSelect } from '../shared/CustomSelect';
import { MaskedValue } from '../shared/MaskedValue';
import { ActionButton } from '../shared/ActionButton';
import { AnimatedDrawer } from '../shared/MotionPrimitives';

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

function getMatchScoreBadgeClass(score: number): string {
  if (score >= 70) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }
  if (score >= 40) {
    return 'bg-brand-50 text-brand-700 border-brand-200';
  }
  return 'bg-slate-100 text-slate-600 border-slate-200';
}

export interface AttachBenchDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  requirement?: Requirement | null;
  requirements?: Requirement[];
  allowRequirementSwitch?: boolean;
  candidates: Candidate[];
  rateMasked?: boolean;
  onAttachCandidates?: (req: Requirement, candidateIds: string[]) => Promise<void> | void;
  onAssignCandidate?: (req: Requirement, candidate: Candidate) => Promise<void> | void;
  onOpenCsvImport?: (req: Requirement) => void;
  onOpenResumeParser?: (req: Requirement) => void;
  onCandidatesSeen?: (loaded: Candidate[]) => void;
}

export const AttachBenchDrawer: React.FC<AttachBenchDrawerProps> = ({
  isOpen,
  onClose,
  requirement,
  requirements = [],
  allowRequirementSwitch = false,
  candidates,
  rateMasked = false,
  onAttachCandidates,
  onAssignCandidate,
  onOpenCsvImport,
  onOpenResumeParser,
  onCandidatesSeen,
}) => {
  const { formatRate } = useCurrency();
  const aiCapabilities = useAiCapabilities();
  const taxonomies = useMasterTaxonomies(isOpen);

  const [selectedReqId, setSelectedReqId] = useState<string>(
    requirement?.id || requirements[0]?.id || ''
  );
  const [hydratedReqs, setHydratedReqs] = useState<Record<string, Requirement>>({});
  const [showAllReqSkills, setShowAllReqSkills] = useState(false);
  const [expandedCandSkillIds, setExpandedCandSkillIds] = useState<Record<string, boolean>>({});
  const [benchSearch, setBenchSearch] = useState('');
  const [benchWorkAuth, setBenchWorkAuth] = useState('All');
  const debouncedBenchSearch = useDebounce(benchSearch, 250);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [isAttaching, setIsAttaching] = useState(false);
  const [isAiRanking, setIsAiRanking] = useState(false);
  const [aiRankUsed, setAiRankUsed] = useState(false);
  const [aiRankError, setAiRankError] = useState('');
  const [aiRankScopeNote, setAiRankScopeNote] = useState('');
  const [aiRankMap, setAiRankMap] = useState<
    Record<
      string,
      {
        fitScore: number;
        matchedHighlights: string[];
        gaps: string[];
        oneLineSummary: string;
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
  const benchListRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    for (const c of candidates) {
      if (c?.id) knownCandidatesRef.current.set(c.id, c);
    }
  }, [candidates]);

  // Reset picker filters & selection on open or external target change
  useEffect(() => {
    if (!isOpen) return;
    setSelectedReqId(requirement?.id || requirements[0]?.id || '');
    setShowAllReqSkills(false);
    setExpandedCandSkillIds({});
    setSelectedCandidateIds([]);
    setIsAttaching(false);
    setBenchSearch('');
    setBenchWorkAuth('All');
    setClientDuplicateMap({});
    setAiRankMap({});
    setAiRankUsed(false);
    setAiRankError('');
    setAiRankScopeNote('');
    setIsAiRanking(false);
    setBenchPage(1);
    setPagedCandidates(candidates.slice(0, BENCH_PAGE_SIZE));
    setTotalBenchCount(candidates.length);
    setHasMoreBench(candidates.length > BENCH_PAGE_SIZE);
  }, [isOpen, requirement?.id, selectedReqId]);

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
        if (active) setIsLoadingBench(false);
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
    },
    [
      benchPage,
      debouncedBenchSearch,
      benchWorkAuth,
      filteredLocalCandidates,
      hasMoreBench,
      isLoadingBench,
      isLoadingMoreBench,
      onCandidatesSeen,
    ]
  );

  const reqSkillList = useMemo(
    () =>
      String(currentReq?.skillsRequired || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    [currentReq?.skillsRequired]
  );

  const aiModeEnabled = aiCapabilities.enabled;
  const hasAiRankResults = Object.keys(aiRankMap).length > 0;

  const rankedCandidates = useMemo(() => {
    const items = pagedCandidates.map((con, idx) => {
      const localMatch = computeCandidateSkillMatch(
        currentReq?.skillsRequired,
        con.skillset,
        con.currentTitle
      );
      const aiEntry = aiRankMap[con.id];
      const isAiRanked = Boolean(aiEntry);
      const showMatch = aiModeEnabled ? isAiRanked : reqSkillList.length > 0;

      return {
        con,
        idx,
        isAiRanked,
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
    currentReq?.skillsRequired,
    reqSkillList.length,
    aiRankMap,
    aiModeEnabled,
    hasAiRankResults,
  ]);

  const handleAiRankTopMatches = async () => {
    if (!currentReq?.id || isAiRanking || totalBenchCount === 0) return;
    setIsAiRanking(true);
    setAiRankError('');
    try {
      const res = await apiClient.post('/match-skills', {
        requirementId: currentReq.id,
        skillsRequired: currentReq.skillsRequired,
        search: benchSearch.trim() || undefined,
        workAuth: benchWorkAuth !== 'All' ? benchWorkAuth : undefined,
      });
      const rankings = res.data?.data?.rankings;
      const rawMatchedCandidates = res.data?.data?.candidates;
      const used = Boolean(res.data?.data?.aiUsed);
      const retrievalMethod = String(res.data?.data?.retrievalMethod || '');
      const poolCount = Number(res.data?.data?.totalTenantPool ?? totalBenchCount);

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
          { fitScore: number; matchedHighlights: string[]; gaps: string[]; oneLineSummary: string }
        > = {};
        for (const row of rankings) {
          if (row?.candidateId) {
            nextMap[row.candidateId] = {
              fitScore: Number(row.fitScore ?? 0),
              matchedHighlights: Array.isArray(row.matchedHighlights) ? row.matchedHighlights : [],
              gaps: Array.isArray(row.gaps) ? row.gaps : [],
              oneLineSummary: String(row.oneLineSummary || ''),
            };
          }
        }
        setAiRankMap(nextMap);
        setAiRankUsed(used);
        if (poolCount > 0) {
          const modeLabel =
            retrievalMethod === 'pgvector_hybrid'
              ? used
                ? 'pgvector + AI'
                : 'pgvector semantic search'
              : used
                ? 'full-text + AI'
                : 'full-text search';
          setAiRankScopeNote(`Searched ${poolCount} consultants (${modeLabel})`);
        }
        benchListRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err: any) {
      setAiRankError(
        err?.response?.data?.message || err?.message || 'Could not rank candidates right now.'
      );
    } finally {
      setIsAiRanking(false);
    }
  };

  const openPositions = currentReq?.openPositions || 1;
  const toggleCandidateSelection = (candId: string) => {
    if (attachedStageByCandId.has(candId)) return;
    setSelectedCandidateIds((prev) =>
      prev.includes(candId) ? prev.filter((id) => id !== candId) : [...prev, candId]
    );
  };

  const handleQuickSingleAttach = async (cand: Candidate) => {
    if (!currentReq || attachedStageByCandId.has(cand.id)) return;
    setIsAttaching(true);
    try {
      if (onAttachCandidates) {
        await onAttachCandidates(currentReq, [cand.id]);
      } else if (onAssignCandidate) {
        await onAssignCandidate(currentReq, cand);
      }
      setSelectedCandidateIds((prev) => prev.filter((id) => id !== cand.id));
    } finally {
      setIsAttaching(false);
    }
  };

  const handleBatchAttach = async () => {
    if (!currentReq || selectedCandidateIds.length === 0) return;
    setIsAttaching(true);
    try {
      if (onAttachCandidates) {
        await onAttachCandidates(currentReq, selectedCandidateIds);
      } else if (onAssignCandidate) {
        for (const id of selectedCandidateIds) {
          const cand =
            candidates.find((c) => c.id === id) || knownCandidatesRef.current.get(id);
          if (cand) await onAssignCandidate(currentReq, cand);
        }
      }
      setSelectedCandidateIds([]);
      onClose();
    } finally {
      setIsAttaching(false);
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
          <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm font-bold text-slate-900">Attach Bench Candidates</h4>
                <div className="flex items-center gap-1.5 text-[11px] font-semibold">
                  <span className="px-2 py-0.5 rounded-md bg-slate-200/75 text-slate-700">
                    {openPositions} Open
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-800 border border-emerald-200/60">
                    {attachedStageByCandId.size} Attached
                  </span>
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
                <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white overflow-hidden">
                  {onOpenResumeParser && (
                    <button
                      type="button"
                      disabled={isAttaching}
                      onClick={() => {
                        onOpenResumeParser(currentReq);
                      }}
                      className={`px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 ${
                        onOpenCsvImport ? 'border-r border-slate-200' : ''
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
                      className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
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
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
                aria-label="Close candidate picker"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Required Skills Summary */}
          {reqSkillList.length > 0 && (
            <div className="px-5 py-2.5 bg-slate-50/50 border-b border-slate-200/70">
              <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-0.5">
                  Required Skills:
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
          <div className="px-5 py-3 border-b border-slate-200/80 bg-white space-y-2.5">
            <div className="flex items-center gap-2">
              <div className="relative flex-1 min-w-0">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  autoFocus
                  value={benchSearch}
                  onChange={(e) => setBenchSearch(e.target.value)}
                  placeholder="Search by candidate name, title, skills, or resume..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-brand-600 transition-colors"
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

            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] font-medium text-slate-500">
                {pagedCandidates.length < totalBenchCount ? (
                  <>
                    Showing <strong className="font-semibold text-slate-700">{pagedCandidates.length}</strong> of{' '}
                    <strong className="font-semibold text-slate-700">{totalBenchCount}</strong> bench consultants
                  </>
                ) : (
                  <span className="inline-flex items-center gap-1.5 flex-wrap">
                    <span>
                      <strong className="font-semibold text-slate-700">{totalBenchCount}</strong> bench consultant
                      {totalBenchCount === 1 ? '' : 's'}
                    </span>
                    {aiRankScopeNote && (
                      <span className="text-[11px] font-medium text-teal-800 bg-teal-50 border border-teal-200/80 px-2 py-0.5 rounded-full">
                        {aiRankScopeNote}
                      </span>
                    )}
                  </span>
                )}
              </div>

              {pagedCandidates.length > 0 && (
                <button
                  type="button"
                  disabled={isAiRanking || isLoadingBench}
                  onClick={handleAiRankTopMatches}
                  className="px-2.5 py-1 rounded-lg border border-teal-200 bg-teal-50/80 hover:bg-teal-100 text-teal-800 text-[11px] font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-60"
                >
                  {isAiRanking ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <AiIcon className="w-3 h-3 text-teal-600" />
                  )}
                  <span>
                    {isAiRanking
                      ? 'Ranking Best Fits...'
                      : aiCapabilities.enabled
                        ? 'SquadPipe AI Rank'
                        : 'Rank Top Matches'}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Scrollable Ranked Candidate List */}
          <div
            ref={benchListRef}
            onScroll={handleBenchScroll}
            className="p-4 overflow-y-auto space-y-2 flex-1 min-h-0"
          >
            {aiRankError && (
              <div className="px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-medium">
                {aiRankError}
              </div>
            )}
            {isLoadingBench && pagedCandidates.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                Loading consultants...
              </div>
            ) : rankedCandidates.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                {benchSearch.trim() || benchWorkAuth !== 'All'
                  ? 'No consultants match your filter.'
                  : 'No bench consultants available to assign yet.'}
              </div>
            ) : (
              <>
                {rankedCandidates.map(({ con, match, isAiRanked, showMatch, oneLineSummary }) => {
                  const attachedStage = attachedStageByCandId.get(con.id);
                  const alreadyAttached = Boolean(attachedStage);
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
                      className={`p-3 rounded-xl border flex flex-col gap-1.5 transition-all ${alreadyAttached
                        ? 'bg-emerald-50/40 border-emerald-200/70 opacity-85 cursor-default'
                        : isChecked
                          ? 'bg-brand-50/60 border-brand-500 cursor-pointer'
                          : latestDup
                            ? 'bg-amber-50/30 border-amber-200 hover:border-amber-400 cursor-pointer'
                            : 'bg-white border-slate-200 hover:border-brand-400 cursor-pointer'
                        }`}
                    >
                      <div className="flex items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${alreadyAttached
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
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-bold tabular-nums ${getMatchScoreBadgeClass(
                                match.score
                              )}`}
                              title={
                                isAiRanked && aiRankUsed
                                  ? 'AI capability ranking'
                                  : `${match.matched.length} of ${reqSkillList.length} required skills matched`
                              }
                            >
                              {isAiRanked && aiRankUsed && <AiIcon className="w-3 h-3 text-teal-600" />}
                              <span>
                                {match.score === 0 && !isAiRanked
                                  ? 'No Skill Overlap'
                                  : `${match.score}% Match`}
                              </span>
                            </span>
                          )}
                          {alreadyAttached ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-500/[0.1] text-emerald-800 text-[11px] font-semibold">
                              Attached{attachedStage ? ` (${attachedStage})` : ''}
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={isAttaching}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleQuickSingleAttach(con);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-[11px] font-semibold transition-colors cursor-pointer"
                            >
                              {latestDup ? 'Attach Anyway' : 'Quick Attach'}
                            </button>
                          )}
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
                                        className="px-1.5 py-0.5 rounded text-[11px] bg-emerald-500/[0.08] text-emerald-800 font-medium"
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
                                      className={`text-[11px] font-medium text-slate-400 ${
                                        match.matched.length > 0 ? 'ml-1.5' : ''
                                      }`}
                                    >
                                      Missing:
                                    </span>
                                    {visibleMissing.map((skill, idx) => (
                                      <span
                                        key={idx}
                                        className="px-1.5 py-0.5 rounded text-[11px] bg-slate-100 text-slate-500"
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
                  );
                })}
                {isLoadingMoreBench && (
                  <div className="py-2 text-center text-[11px] font-medium text-slate-400">
                    Loading next {BENCH_PAGE_SIZE} consultants...
                  </div>
                )}
                {!isLoadingMoreBench && hasMoreBench && (
                  <div className="py-1.5 text-center text-[11px] text-slate-400">
                    Scroll to load more ({pagedCandidates.length} of {totalBenchCount})
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="bg-slate-50 border-t border-slate-200 flex-shrink-0">
            {selectedDupCount > 0 && (
              <div className="px-5 py-2 bg-amber-50 border-b border-amber-200 flex items-center gap-2 text-[11px] text-amber-900 font-medium">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                <span>
                  {selectedDupCount} selected consultant{selectedDupCount === 1 ? ' was' : 's were'}{' '}
                  previously submitted to <strong>{currentReq.companyName}</strong> on another
                  requisition. Confirm before attaching to avoid duplicate client outreach.
                </span>
              </div>
            )}
            <div className="px-5 py-3.5 flex items-center justify-between gap-3">
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
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-colors cursor-pointer"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  disabled={isAttaching}
                  onClick={onClose}
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
                  className={`px-4 py-1.5 rounded-lg disabled:opacity-50 text-white text-xs font-semibold transition-colors cursor-pointer ${selectedDupCount > 0
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
            </div>
          </div>
        </>
      )}
    </AnimatedDrawer>
  );
};
