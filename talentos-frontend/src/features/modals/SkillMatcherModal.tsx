import React, { useState, useEffect, useMemo } from 'react';
import { Check, Send, UsersRound, X } from 'lucide-react';
import { Requirement, Candidate } from '../../types';
import { useCurrency } from '../../utils/currency';

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

  useEffect(() => {
    if (isOpen) {
      setSelectedReqId(initialRequirement?.id || requirements[0]?.id || '');
      setSelectedIds([]);
      setIsSubmitting(false);
    }
  }, [isOpen, initialRequirement?.id, requirements]);

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

  const candidateMatches = candidates.map((c) => {
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
          const cand = candidates.find((c) => c.id === id);
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
            <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
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
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Requisition Selector */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Target Job Requisition</label>
              {currentReq && (
                <div className="flex items-center gap-2 text-[10px] font-semibold">
                  <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {currentReq.openPositions || 1} Open {(currentReq.openPositions || 1) === 1 ? 'Position' : 'Positions'}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
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
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-slate-700">
                Ranked Bench Matches ({candidateMatches.length})
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

            {candidateMatches.length === 0 ? (
              <div className="py-10 px-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                No bench candidates available to match yet. Add consultants to see skill matches here.
              </div>
            ) : (
              candidateMatches.map((m) => {
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
                        ? 'bg-purple-50/30 border-purple-400 cursor-pointer'
                        : 'bg-white border-slate-200 hover:border-slate-300 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <span
                        className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                          isAttached
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : isSelected
                            ? 'bg-purple-600 border-purple-600 text-white'
                            : 'bg-white border-slate-300'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3" strokeWidth={3} />}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 text-xs">{m.candidate.fullName}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600 border border-slate-200">
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
                              className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 capitalize font-medium"
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
                                  className="px-1.5 py-0.5 rounded text-[9px] bg-slate-50 text-slate-400 border border-slate-200 capitalize"
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
                        <div className="text-lg font-black text-purple-600">{m.score}%</div>
                        <div className="text-[9px] text-slate-400 font-medium uppercase tracking-wide">Match Score</div>
                      </div>
                      {isAttached ? (
                        <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5" />
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
                          className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white shadow-sm shadow-purple-600/20 flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                          <Send className="w-3 h-3" />
                          <span>Attach Applicant</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
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
