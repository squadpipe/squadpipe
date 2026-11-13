import React, { useState } from 'react';
import { Pencil, X } from 'lucide-react';
import { Candidate } from '../../types';
import { MaskedValue } from '../../components/shared/MaskedValue';

interface ConsultantsViewProps {
  candidates: Candidate[];
  rateMasked: boolean;
  onOpenResumeParser: () => void;
  onPreviewResume: (candidate: Candidate) => void;
  onOpenAddConsultant?: () => void;
  onOpenCsvImport?: () => void;
  onUpdateCandidate?: (candidate: Candidate) => void;
  onDeleteCandidate?: (candidate: Candidate) => void;
}

export const ConsultantsView: React.FC<ConsultantsViewProps> = ({
  candidates,
  rateMasked,
  onOpenResumeParser,
  onPreviewResume,
  onOpenAddConsultant,
  onOpenCsvImport,
  onUpdateCandidate,
  onDeleteCandidate,
}) => {
  const [search, setSearch] = useState('');
  const [workAuthFilter, setWorkAuthFilter] = useState('All');
  const [editingCandidate, setEditingCandidate] = useState<Candidate | null>(null);

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
                {(onUpdateCandidate || onDeleteCandidate) && <th className="px-4 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={onUpdateCandidate || onDeleteCandidate ? 9 : 8}
                    className="px-6 py-10 text-center text-xs text-slate-400"
                  >
                    No consultants found in the roster. Click{' '}
                    <span className="font-semibold text-slate-600">Add Consultant</span> or{' '}
                    <span className="font-semibold text-slate-600">Upload Resume</span> to add talent.
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                  {/* Full Name & Contacts */}
                  <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                    <div
                      className="font-semibold hover:text-brand-600 cursor-pointer"
                      onClick={() => onPreviewResume(c)}
                    >
                      {c.fullName}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {c.email} &bull; {c.phone}
                    </div>
                  </td>

                  {/* Work Auth */}
                  <td className="px-4 py-3 whitespace-nowrap text-[10px]">
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
                            className="text-[9px] bg-brand-50 text-brand-700 px-1.5 py-0.2 rounded border border-brand-200"
                          >
                            {sk.trim()}
                          </span>
                        ))}
                    </div>
                  </td>

                  {/* Hourly Rate */}
                  <td className="px-4 py-3 whitespace-nowrap">
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
                      className="text-[11px] text-brand-600 hover:underline flex items-center gap-1 cursor-pointer"
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

                  {(onUpdateCandidate || onDeleteCandidate) && (
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        {onUpdateCandidate && (
                          <button
                            onClick={() => setEditingCandidate({ ...c })}
                            title="Edit consultant"
                            className="p-1.5 text-slate-400 hover:text-brand-600 rounded hover:bg-brand-50 transition-colors cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {onDeleteCandidate && (
                          <button
                            onClick={() => onDeleteCandidate(c)}
                            title="Delete consultant"
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                          >
                            <i className="fa-solid fa-trash-can text-xs"></i>
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Consultant Modal */}
      {editingCandidate && (
        <div
          onClick={() => setEditingCandidate(null)}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-scale-up"
          >
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Edit Consultant</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">{editingCandidate.fullName}</p>
              </div>
              <button
                onClick={() => setEditingCandidate(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (onUpdateCandidate) onUpdateCandidate(editingCandidate);
                setEditingCandidate(null);
              }}
              className="p-6 space-y-3.5 text-xs"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={editingCandidate.fullName}
                    onChange={(e) => setEditingCandidate({ ...editingCandidate, fullName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Current Title *</label>
                  <input
                    type="text"
                    required
                    value={editingCandidate.currentTitle}
                    onChange={(e) => setEditingCandidate({ ...editingCandidate, currentTitle: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    value={editingCandidate.email}
                    onChange={(e) => setEditingCandidate({ ...editingCandidate, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Phone</label>
                  <input
                    type="text"
                    value={editingCandidate.phone}
                    onChange={(e) => setEditingCandidate({ ...editingCandidate, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Work Auth</label>
                  <select
                    value={editingCandidate.workAuth}
                    onChange={(e) => setEditingCandidate({ ...editingCandidate, workAuth: e.target.value })}
                    className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:border-brand-600 focus:outline-none cursor-pointer"
                  >
                    <option value="US Citizen">US Citizen</option>
                    <option value="Green Card">Green Card</option>
                    <option value="H-1B">H-1B</option>
                    <option value="TN Visa">TN Visa</option>
                    <option value="OPT">OPT / CPT</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Hourly Rate</label>
                  <input
                    type="text"
                    value={editingCandidate.hourlyRate}
                    onChange={(e) => setEditingCandidate({ ...editingCandidate, hourlyRate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Relocation</label>
                  <select
                    value={editingCandidate.relocation}
                    onChange={(e) => setEditingCandidate({ ...editingCandidate, relocation: e.target.value })}
                    className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:border-brand-600 focus:outline-none cursor-pointer"
                  >
                    <option value="Yes">Open (Yes)</option>
                    <option value="No">Local Only (No)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Pipeline Stage</label>
                <select
                  value={editingCandidate.pipelineStage}
                  onChange={(e) => setEditingCandidate({ ...editingCandidate, pipelineStage: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:border-brand-600 focus:outline-none cursor-pointer"
                >
                  <option value="Available / Bench">Available / Bench</option>
                  <option value="Submitted">Submitted</option>
                  <option value="Interview">Interview</option>
                  <option value="Selected">Selected</option>
                  <option value="Onboarding">Onboarding</option>
                  <option value="Placed">Placed</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Key Skillset</label>
                <input
                  type="text"
                  value={editingCandidate.skillset}
                  onChange={(e) => setEditingCandidate({ ...editingCandidate, skillset: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingCandidate(null)}
                  className="px-3.5 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
