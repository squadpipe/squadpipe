import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Check, Search, Send, UsersRound, X } from 'lucide-react';
import { apiClient } from '../../config/api.config';
import { Requirement, Candidate } from '../../types';
import { useCurrency } from '../../utils/currency';
import { useDebounce } from '../../utils/useDebounce';
import { mapCandidateFromApi } from '../../utils/entityMappers';

const MATCHER_PAGE_SIZE = 50;

interface SkillMatcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  requirements: Requirement[];
  candidates: Candidate[];
  initialRequirement?: Requirement | null;
  onSubmitCandidate: (candidate: Candidate, requirement: Requirement) => Promise<void> | void;
  onAttachCandidates?: (requirement: Requirement, candidateIds: string[]) => Promise<void> | void;
  showToast: (title: string, message: string, icon?: string) => void;
}

export const SkillMatcherModal: React.FC<SkillMatcherModalProps> = ({
  isOpen,
  onClose,
  requirements,
  candidates,
  initialRequirement,
  onSubmitCandidate,
  onAttachCandidates,
  showToast,
}) => {
  const { formatRate } = useCurrency();
  const [selectedReqId, setSelectedReqId] = useState<string>(
    initialRequirement?.id || requirements[0]?.id || ''
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 250);
  const [pagedCandidates, setPagedCandidates] = useState<Candidate[]>(() =>
    candidates.slice(0, MATCHER_PAGE_SIZE)
  );
  const [totalCount, setTotalCount] = useState<number>(candidates.length);
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(candidates.length > MATCHER_PAGE_SIZE);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const knownCandidatesRef = useRef<Map<string, Candidate>>(new Map());
  const activeSearchRef = useRef<string>('');

  useEffect(() => {
    for (const c of candidates) {
      if (c?.id) knownCandidatesRef.current.set(c.id, c);
    }
  }, [candidates]);

  useEffect(() => {
    if (isOpen) {
      setSelectedReqId(initialRequirement?.id || requirements[0]?.id || '');
      setSelectedIds([]);
      setIsSubmitting(false);
      setSearch('');
      setPage(1);
      setPagedCandidates(candidates.slice(0, MATCHER_PAGE_SIZE));
      setTotalCount(candidates.length);
      setHasMore(candidates.length > MATCHER_PAGE_SIZE);
    }
  }, [isOpen, initialRequirement?.id, requirements]);

  const filteredLocalCandidates = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return candidates.filter((c) => {
      if (!q) return true;
      return (
        c.fullName.toLowerCase().includes(q) ||
        (c.currentTitle || '').toLowerCase().includes(q) ||
        (c.skillset || '').toLowerCase().includes(q) ||
        (c.workAuth || '').toLowerCase().includes(q)
      );
    });
  }, [candidates, debouncedSearch]);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    const searchTerm = debouncedSearch.trim();
    activeSearchRef.current = searchTerm;
    setIsLoading(true);

    apiClient
      .get('/candidates', {
        params: {
          page: 1,
          limit: MATCHER_PAGE_SIZE,
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
        setPage(1);
        setTotalCount(total);
        setHasMore(1 < totalPages);
      })
      .catch(() => {
        if (!active) return;
        const slice = filteredLocalCandidates.slice(0, MATCHER_PAGE_SIZE);
        setPagedCandidates(slice);
        setPage(1);
        setTotalCount(filteredLocalCandidates.length);
        setHasMore(filteredLocalCandidates.length > slice.length);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen, debouncedSearch]);

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
      if (
        scrollHeight - scrollTop - clientHeight > 80 ||
        isLoading ||
        isLoadingMore ||
        !hasMore
      ) {
        return;
      }

      const nextPage = page + 1;
      const searchTerm = debouncedSearch.trim();
      setIsLoadingMore(true);

      apiClient
        .get('/candidates', {
          params: {
            page: nextPage,
            limit: MATCHER_PAGE_SIZE,
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
          setPage(nextPage);
          if (typeof total === 'number') setTotalCount(total);
          setHasMore(nextPage < totalPages);
        })
        .catch(() => {
          if (activeSearchRef.current !== searchTerm) return;
          const nextSlice = filteredLocalCandidates.slice(0, nextPage * MATCHER_PAGE_SIZE);
          setPagedCandidates(nextSlice);
          setPage(nextPage);
          setHasMore(filteredLocalCandidates.length > nextSlice.length);
        })
        .finally(() => {
          setIsLoadingMore(false);
        });
    },
    [page, debouncedSearch, filteredLocalCandidates, hasMore, isLoading, isLoadingMore]
  );

  const currentReq = requirements.find((r) => r.id === selectedReqId) || requirements[0];

  const attachedSubmissionByCandId = useMemo(() => {
    const map = new Map<string, string>();
    for (const sub of currentReq?.submissions || []) {
      if (sub.candidateId) map.set(sub.candidateId, sub.stage);
    }
    return map;
  }, [currentReq?.submissions]);

  if (!isOpen) return null;

  const reqSkills = currentReq
    ? currentReq.skillsRequired.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
    : [];

  const candidateMatches = pagedCandidates.map((c) => {
    const cSkills = c.skillset.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    const matched = reqSkills.filter((rs) =>
      cSkills.some((cs) => cs.includes(rs) || rs.includes(cs))
    );
    const missing = reqSkills.filter((rs) => !matched.includes(rs));
    const score = Math.min(
      98,
      Math.max(45, Math.round((matched.length / Math.max(reqSkills.length, 1)) * 100))
    );

    return {
      candidate: c,
      score,
      matched,
      missing,
      attachedStage: attachedSubmissionByCandId.get(c.id),
    };
  }).sort((a, b) => b.score - a.score);

  const toggleSelect = (candId: string) => {
    if (attachedSubmissionByCandId.has(candId)) return;
    setSelectedIds((prev) =>
      prev.includes(candId) ? prev.filter((id) => id !== candId) : [...prev, candId]
    );
  };

  const handleSubmit = async (match: typeof candidateMatches[0]) => {
    if (!currentReq || attachedSubmissionByCandId.has(match.candidate.id)) return;
    setIsSubmitting(true);
    try {
      await onSubmitCandidate(match.candidate, currentReq);
      setSelectedIds((prev) => prev.filter((id) => id !== match.candidate.id));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBatchAttach = async () => {
    if (!currentReq || selectedIds.length === 0) return;
    setIsSubmitting(true);
    try {
      if (onAttachCandidates) {
        await onAttachCandidates(currentReq, selectedIds);
      } else {
        for (const id of selectedIds) {
          const cand = candidates.find((c) => c.id === id) || knownCandidatesRef.current.get(id);
          if (cand) await onSubmitCandidate(cand, currentReq);
        }
      }
      setSelectedIds([]);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-5xl w-full border border-slate-200 card-shadow overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-brand-600">
              <UsersRound className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Automated Bench Skill Matcher</h3>
              <p className="text-[11px] text-slate-400">Ranks available bench candidates against job order skill requirements</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div onScroll={handleScroll} className="p-6 overflow-y-auto space-y-5">
          {/* Requisition Selector */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Target Job Requisition</label>
              {currentReq && (
                <div className="flex items-center gap-2 text-[10px] font-medium">
                  <span className="px-2 py-0.5 rounded bg-slate-200/70 text-slate-700">
                    {currentReq.openPositions || 1} Open {(currentReq.openPositions || 1) === 1 ? 'Position' : 'Positions'}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/[0.08] text-emerald-800">
                    {attachedSubmissionByCandId.size} Attached
                  </span>
                </div>
              )}
            </div>
            <select
              value={selectedReqId}
              onChange={(e) => {
                setSelectedReqId(e.target.value);
                setSelectedIds([]);
              }}
              className="mt-1 w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 font-semibold"
            >
              {requirements.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.code} — {r.opportunityTitle} ({r.companyName}) • {r.openPositions || 1} Open
                </option>
              ))}
            </select>

            {currentReq && (
              <div className="mt-3 flex items-center gap-2 text-xs text-slate-600 flex-wrap">
                <span className="font-semibold text-slate-700">Required Competencies:</span>
                <span className="text-slate-500 bg-white px-2.5 py-1 rounded-md border border-slate-200 text-[11px]">
                  {currentReq.skillsRequired}
                </span>
              </div>
            )}
          </div>

          {/* Matches List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-xs font-bold text-slate-700">
                Ranked Bench Matches ({totalCount} total
                {pagedCandidates.length < totalCount ? ` • showing ${pagedCandidates.length}` : ''})
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative w-56">
                  <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Filter name, title, skill..."
                    className="w-full pl-7 pr-2.5 py-1.5 text-[11px] bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-brand-600"
                  />
                </div>
                {selectedIds.length > 0 && (
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleBatchAttach}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Send className="w-3 h-3" />
                    <span>Attach {selectedIds.length} Selected Applicant{selectedIds.length === 1 ? '' : 's'}</span>
                  </button>
                )}
              </div>
            </div>

            {isLoading && candidateMatches.length === 0 ? (
              <div className="py-10 px-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                {search.trim() ? 'Searching bench consultants...' : 'Loading bench matches...'}
              </div>
            ) : candidateMatches.length === 0 ? (
              <div className="py-10 px-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                {search.trim()
                  ? 'No bench consultants match your filter.'
                  : 'No bench candidates available to match yet. Add consultants to see skill matches here.'}
              </div>
            ) : (
              <>
                {candidateMatches.map((m) => {
                const isAttached = Boolean(m.attachedStage);
                const isSelected = isAttached || selectedIds.includes(m.candidate.id);
                return (
                  <div
                    key={m.candidate.id}
                    onClick={() => !isAttached && toggleSelect(m.candidate.id)}
                    className={`p-4 rounded-xl border card-shadow transition-all flex items-center justify-between gap-4 ${
                      isAttached
                        ? 'bg-emerald-50/30 border-emerald-200'
                        : isSelected
                        ? 'bg-brand-50/40 border-brand-500 cursor-pointer'
                        : 'bg-white border-slate-200 hover:border-slate-300 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <span
                        className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                          isAttached
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : isSelected
                            ? 'bg-brand-600 border-brand-600 text-white'
                            : 'bg-white border-slate-300'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3" strokeWidth={3} />}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 text-xs">{m.candidate.fullName}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600 font-medium">
                            {m.candidate.workAuth}
                          </span>
                          <span className="text-[10px] text-slate-400">{formatRate(m.candidate.hourlyRate)}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{m.candidate.currentTitle}</div>

                        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-semibold text-emerald-600">Matched:</span>
                          {m.matched.map((s, idx) => (
                            <span
                              key={idx}
                              className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/[0.08] text-emerald-800 capitalize font-medium"
                            >
                              {s}
                            </span>
                          ))}
                          {m.missing.length > 0 && (
                            <>
                              <span className="text-[10px] font-semibold text-slate-400 ml-2">Missing:</span>
                              {m.missing.slice(0, 3).map((s, idx) => (
                                <span
                                  key={idx}
                                  className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-500 capitalize"
                                >
                                  {s}
                                </span>
                              ))}
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 flex-shrink-0">
                      <div className="text-right">
                        <div className="text-lg font-black text-brand-700">{m.score}%</div>
                        <div className="text-[9px] text-slate-400 font-medium uppercase tracking-wide">Match Score</div>
                      </div>
                      {isAttached ? (
                        <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-white text-slate-700 border border-slate-200 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span>Attached ({m.attachedStage})</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSubmit(m);
                          }}
                          className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-700 active:bg-brand-800 disabled:opacity-50 text-white shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                          <Send className="w-3 h-3" />
                          <span>Attach Applicant</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {isLoadingMore && (
                <div className="py-2 text-center text-[11px] font-medium text-slate-400">
                  Loading next {MATCHER_PAGE_SIZE} consultants...
                </div>
              )}
              {!isLoadingMore && hasMore && (
                <div className="py-2 text-center text-[11px] text-slate-400">
                  Scroll down to load more ({candidateMatches.length} of {totalCount})
                </div>
              )}
            </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="text-[11px] text-slate-400">
            Select multiple consultants or click Attach Applicant individually
          </div>
          <div className="flex items-center gap-2">
            {selectedIds.length > 0 && (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleBatchAttach}
                className="px-4 py-2 text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors cursor-pointer"
              >
                Attach Selected ({selectedIds.length})
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
