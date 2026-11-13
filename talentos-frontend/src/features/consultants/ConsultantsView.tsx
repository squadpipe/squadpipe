import React, { useState } from 'react';
import { Candidate } from '../../types';
import { MaskedValue } from '../../components/shared/MaskedValue';

interface ConsultantsViewProps {
  candidates: Candidate[];
  rateMasked: boolean;
  onOpenResumeParser: () => void;
  onPreviewResume: (candidate: Candidate) => void;
  onOpenAddConsultant?: () => void;
  onOpenCsvImport?: () => void;
  onDeleteCandidate?: (candidate: Candidate) => void;
}

export const ConsultantsView: React.FC<ConsultantsViewProps> = ({
  candidates,
  rateMasked,
  onOpenResumeParser,
  onPreviewResume,
  onOpenAddConsultant,
  onOpenCsvImport,
  onDeleteCandidate,
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

  const getStageBadgeClass = (stage: string) => {
    switch (stage) {
      case 'Available / Bench':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Submitted':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Interview':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Selected':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Placed':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <section className="max-w-7xl mx-auto space-y-5 animate-fade-in">
      {/* Header with Title & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Consultant Roster</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Candidate profiles, work authorizations, verified skills, and resume documents.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onOpenCsvImport && (
            <button
              onClick={onOpenCsvImport}
              className="px-3 py-1.5 rounded-md border border-emerald-300 bg-emerald-50 text-emerald-800 text-xs font-semibold hover:bg-emerald-100 flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
            >
              <i className="fa-solid fa-file-csv text-emerald-600 text-[12px]"></i>
              <span>CSV Import & Column Mapping</span>
            </button>
          )}
          <button
            onClick={onOpenResumeParser}
            className="px-3 py-1.5 rounded-md border border-brand-200 bg-brand-50 text-brand-700 text-xs font-medium hover:bg-brand-100 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <i className="fa-solid fa-file-lines text-[11px]"></i>
            <span>Resume Parser</span>
          </button>
          {onOpenAddConsultant && (
            <button
              onClick={onOpenAddConsultant}
              className="px-3.5 py-1.5 rounded-md bg-brand-600 text-white text-xs font-medium hover:bg-brand-700 shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <i className="fa-solid fa-plus text-[10px]"></i>
              <span>Add Consultant</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Roster Table Card */}
      <div className="bg-white rounded-xl border border-slate-200/80 card-shadow overflow-hidden">
        {/* Subheader Filter Bar */}
        <div className="px-5 py-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-xs text-slate-900">
              {filtered.length} Active Consultants
            </span>
            <select
              value={workAuthFilter}
              onChange={(e) => setWorkAuthFilter(e.target.value)}
              className="py-1 px-2.5 bg-white border border-slate-200 rounded-md text-xs font-semibold text-slate-700 cursor-pointer outline-none"
            >
              <option value="All">All Authorizations</option>
              <option value="US Citizen">US Citizen</option>
              <option value="Green Card">Green Card</option>
              <option value="H-1B">H-1B</option>
              <option value="TN Visa">TN Visa</option>
              <option value="OPT">OPT / CPT</option>
            </select>
          </div>

          <div className="relative">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, skill, title..."
              className="pl-8 pr-3 py-1 text-xs border border-slate-200 rounded-md bg-white w-64 text-slate-700 outline-none focus:border-brand-500"
            />
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase">
              <tr>
                <th className="px-4 py-3">Full Name</th>
                <th className="px-4 py-3">Work Auth</th>
                <th className="px-4 py-3">Current Title</th>
                <th className="px-4 py-3">Key Skillset</th>
                <th className="px-4 py-3">Hourly Rate</th>
                <th className="px-4 py-3">Relocation</th>
                <th className="px-4 py-3">Resume</th>
                <th className="px-4 py-3">Stage</th>
                {onDeleteCandidate && <th className="px-4 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                  {/* Full Name & Contacts */}
                  <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                    <div
                      className="font-semibold hover:text-brand-600 cursor-pointer"
                      onClick={() => onPreviewResume(c)}
                    >
                      {c.fullName}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {c.email} &bull; {c.phone}
                    </div>
                  </td>

                  {/* Work Auth */}
                  <td className="px-4 py-3 whitespace-nowrap font-mono text-[10px]">
                    <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200">
                      {c.workAuth}
                    </span>
                  </td>

                  {/* Current Title */}
                  <td className="px-4 py-3 text-slate-800 font-medium">
                    {c.currentTitle}
                  </td>

                  {/* Key Skillset */}
                  <td className="px-4 py-3 max-w-xs">
                    <div className="flex flex-wrap gap-1">
                      {c.skillset
                        .split(',')
                        .slice(0, 3)
                        .map((sk) => (
                          <span
                            key={sk}
                            className="text-[9px] font-mono bg-brand-50 text-brand-700 px-1.5 py-0.2 rounded border border-brand-200"
                          >
                            {sk.trim()}
                          </span>
                        ))}
                    </div>
                  </td>

                  {/* Hourly Rate */}
                  <td className="px-4 py-3 font-mono whitespace-nowrap">
                    <MaskedValue value={c.hourlyRate} isMasked={rateMasked} />
                  </td>

                  {/* Relocation */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        c.relocation === 'Yes'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {c.relocation === 'Yes' ? 'Open' : 'Local Only'}
                    </span>
                  </td>

                  {/* Resume Document Link */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <button
                      onClick={() => onPreviewResume(c)}
                      className="text-[11px] text-brand-600 hover:underline flex items-center gap-1 font-mono cursor-pointer"
                    >
                      <i className="fa-regular fa-file-pdf text-rose-500"></i>
                      <span>{c.resumeFormat || 'PDF'}</span>
                    </button>
                  </td>

                  {/* Pipeline Stage */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-semibold border ${getStageBadgeClass(
                        c.pipelineStage
                      )}`}
                    >
                      {c.pipelineStage}
                    </span>
                  </td>

                  {onDeleteCandidate && (
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => onDeleteCandidate(c)}
                        title="Delete consultant"
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                      >
                        <i className="fa-solid fa-trash-can text-xs"></i>
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
