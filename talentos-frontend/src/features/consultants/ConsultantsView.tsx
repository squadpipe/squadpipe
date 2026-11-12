import React, { useState } from 'react';
import { Candidate } from '../../types';
import { MaskedValue } from '../../components/shared/MaskedValue';

interface ConsultantsViewProps {
  candidates: Candidate[];
  rateMasked: boolean;
  onOpenResumeParser: () => void;
  onPreviewResume: (candidate: Candidate) => void;
}

export const ConsultantsView: React.FC<ConsultantsViewProps> = ({
  candidates,
  rateMasked,
  onOpenResumeParser,
  onPreviewResume,
}) => {
  const [search, setSearch] = useState('');
  const [workAuthFilter, setWorkAuthFilter] = useState('All');

  const filtered = candidates.filter((c) => {
    const matchesSearch =
      c.fullName.toLowerCase().includes(search.toLowerCase()) ||
      c.skillset.toLowerCase().includes(search.toLowerCase()) ||
      c.currentTitle.toLowerCase().includes(search.toLowerCase());
    const matchesAuth =
      workAuthFilter === 'All' || c.workAuth.includes(workAuthFilter);
    return matchesSearch && matchesAuth;
  });

  return (
    <div className="space-y-4">
      {/* Controls & Filter Subheader */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 card-shadow">
        <div className="flex items-center gap-3">
          <div className="relative">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search consultants, skills..."
              className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs w-64 text-slate-700"
            />
          </div>

          <select
            value={workAuthFilter}
            onChange={(e) => setWorkAuthFilter(e.target.value)}
            className="py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer"
          >
            <option value="All">All Authorizations</option>
            <option value="US Citizen">US Citizen</option>
            <option value="Green Card">Green Card</option>
            <option value="H-1B">H-1B</option>
            <option value="TN Visa">TN Visa</option>
            <option value="OPT">OPT / CPT</option>
          </select>
        </div>

        <button
          onClick={onOpenResumeParser}
          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm shadow-emerald-600/20 transition-all"
        >
          <i className="fa-solid fa-file-arrow-up text-xs"></i>
          <span>Upload & Parse Resume</span>
        </button>
      </div>

      {/* Candidate Bench Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((c) => (
          <div
            key={c.id}
            className="bg-white p-5 rounded-xl border border-slate-200 card-shadow hover:border-slate-300 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3
                    onClick={() => onPreviewResume(c)}
                    className="font-extrabold text-sm text-slate-900 cursor-pointer hover:text-brand-600 transition-colors"
                  >
                    {c.fullName}
                  </h3>
                  <div className="text-xs font-semibold text-brand-600 mt-0.5">{c.currentTitle}</div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                  {c.workAuth}
                </span>
              </div>

              <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-envelope text-[11px] text-slate-400 w-3.5"></i>
                  <span className="font-mono text-[11px] truncate">{c.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-phone text-[11px] text-slate-400 w-3.5"></i>
                  <span className="font-mono text-[11px]">{c.phone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-dollar-sign text-[11px] text-slate-400 w-3.5"></i>
                  <span className="font-mono font-bold text-slate-800">
                    <MaskedValue value={c.hourlyRate} isMasked={rateMasked} />
                  </span>
                  <span className="text-[10px] text-slate-400">({c.relocation === 'Yes' ? 'Relocation OK' : 'No Relo'})</span>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-100">
                <div className="text-[10px] font-bold uppercase text-slate-400 mb-1.5">Core Competencies</div>
                <div className="flex flex-wrap gap-1">
                  {c.skillset.split(',').map((skill, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-50 text-slate-700 border border-slate-200/80"
                    >
                      {skill.trim()}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-[11px] text-slate-400">
                Stage: <strong className="text-slate-700 font-semibold">{c.pipelineStage}</strong>
              </span>
              <button
                onClick={() => onPreviewResume(c)}
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200 flex items-center gap-1 transition-colors"
              >
                <i className="fa-solid fa-file-pdf text-[10px]"></i>
                <span>Resume</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
