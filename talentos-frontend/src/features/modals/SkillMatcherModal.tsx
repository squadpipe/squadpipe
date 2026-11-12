import React, { useState } from 'react';
import { Requirement, Candidate } from '../../types';

interface SkillMatcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  requirements: Requirement[];
  candidates: Candidate[];
  onSubmitCandidate: (candidate: Candidate, requirement: Requirement) => void;
  showToast: (title: string, message: string, icon?: string) => void;
}

export const SkillMatcherModal: React.FC<SkillMatcherModalProps> = ({
  isOpen,
  onClose,
  requirements,
  candidates,
  onSubmitCandidate,
  showToast,
}) => {
  const [selectedReqId, setSelectedReqId] = useState<string>(
    requirements[0]?.id || ''
  );

  if (!isOpen) return null;

  const currentReq = requirements.find((r) => r.id === selectedReqId) || requirements[0];
  const reqSkills = currentReq
    ? currentReq.skillsRequired.split(',').map((s) => s.trim().toLowerCase())
    : [];

  const candidateMatches = candidates.map((c) => {
    const cSkills = c.skillset.split(',').map((s) => s.trim().toLowerCase());
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
    };
  }).sort((a, b) => b.score - a.score);

  const handleSubmit = (match: typeof candidateMatches[0]) => {
    if (!currentReq) return;
    onSubmitCandidate(match.candidate, currentReq);
    onClose();
    showToast(
      'Candidate Submitted',
      `${match.candidate.fullName} has been submitted to ${currentReq.code} (${currentReq.companyName})!`,
      'fa-solid fa-circle-check text-emerald-400'
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full border border-slate-200 card-shadow overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
              <i className="fa-solid fa-users-viewfinder text-sm"></i>
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Automated Bench Skill Matcher</h3>
              <p className="text-[11px] text-slate-400">Ranks available bench candidates against job order skill requirements</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
            <i className="fa-solid fa-xmark text-sm"></i>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Requisition Selector */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Target Job Requisition</label>
            <select
              value={selectedReqId}
              onChange={(e) => setSelectedReqId(e.target.value)}
              className="mt-1 w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 font-semibold"
            >
              {requirements.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.code} — {r.opportunityTitle} ({r.companyName})
                </option>
              ))}
            </select>

            {currentReq && (
              <div className="mt-3 flex items-center gap-2 text-xs text-slate-600 flex-wrap">
                <span className="font-semibold text-slate-700">Required Competencies:</span>
                <span className="font-mono text-slate-500 bg-white px-2.5 py-1 rounded-md border border-slate-200 text-[11px]">
                  {currentReq.skillsRequired}
                </span>
              </div>
            )}
          </div>

          {/* Matches List */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-slate-700">Ranked Bench Matches ({candidateMatches.length})</div>

            {candidateMatches.map((m) => (
              <div
                key={m.candidate.id}
                className="p-4 rounded-xl border border-slate-200 card-shadow bg-white hover:border-slate-300 transition-all flex items-center justify-between gap-4"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-xs">{m.candidate.fullName}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600 border border-slate-200">
                      {m.candidate.workAuth}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">{m.candidate.hourlyRate}</span>
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

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-lg font-black text-purple-600">{m.score}%</div>
                    <div className="text-[9px] text-slate-400 font-medium uppercase tracking-wide">Match Score</div>
                  </div>
                  <button
                    onClick={() => handleSubmit(m)}
                    className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow-sm shadow-purple-600/20 flex items-center gap-1.5 transition-all"
                  >
                    <i className="fa-solid fa-paper-plane text-[10px]"></i>
                    <span>1-Click Submit</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="text-[11px] text-slate-400">
            Automated Skillset Semantic Matrix Evaluated
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
