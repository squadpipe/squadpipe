import React, { useState } from 'react';
import { Requirement, Candidate } from '../../types';

interface PipelineViewProps {
  requirements: Requirement[];
  candidates: Candidate[];
  onStatusChange: (req: Requirement, newStatus: any) => void;
  onOpenEmailParser: () => void;
  onOpenMatcher: (req: Requirement) => void;
  onOpenPitchWriter: (req: Requirement) => void;
  onOpenPlacementWizard: (req: Requirement) => void;
  onSelectReq?: (req: Requirement) => void;
}

export const PipelineView: React.FC<PipelineViewProps> = ({
  requirements,
  candidates,
  onStatusChange,
  onOpenEmailParser,
  onOpenMatcher,
  onOpenPitchWriter,
  onOpenPlacementWizard,
  onSelectReq,
}) => {
  const [displayMode, setDisplayMode] = useState<'kanban' | 'list'>('kanban');
  const [search, setSearch] = useState('');

  const stageOrder: Requirement['status'][] = [
    'Requirement',
    'Submitted',
    'Interview',
    'Selected',
    'Onboarding',
  ];

  const filteredReqs = requirements.filter(
    (r) =>
      r.opportunityTitle.toLowerCase().includes(search.toLowerCase()) ||
      r.companyName.toLowerCase().includes(search.toLowerCase()) ||
      r.skillsRequired.toLowerCase().includes(search.toLowerCase())
  );

  const moveStage = (req: Requirement, direction: number) => {
    const currentIndex = stageOrder.indexOf(req.status);
    const nextIndex = currentIndex + direction;
    if (nextIndex >= 0 && nextIndex < stageOrder.length) {
      const nextStage = stageOrder[nextIndex];
      onStatusChange(req, nextStage);
      if (nextStage === 'Onboarding') {
        onOpenPlacementWizard(req);
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Subheader & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 card-shadow">
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              onClick={() => setDisplayMode('kanban')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                displayMode === 'kanban'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <i className="fa-solid fa-table-columns text-xs"></i>
              <span>Kanban</span>
            </button>
            <button
              onClick={() => setDisplayMode('list')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                displayMode === 'list'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <i className="fa-solid fa-list-ul text-xs"></i>
              <span>Table</span>
            </button>
          </div>

          <div className="relative">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter pipeline orders..."
              className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs w-56 text-slate-700"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenEmailParser}
            className="px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <i className="fa-solid fa-envelope-open-text text-xs"></i>
            <span>Intake Email Parser</span>
          </button>
        </div>
      </div>

      {/* Kanban Mode */}
      {displayMode === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5 items-start">
          {stageOrder.map((stage) => {
            const reqsInStage = filteredReqs.filter((r) => r.status === stage);
            return (
              <div
                key={stage}
                className="bg-slate-100/70 p-3 rounded-xl border border-slate-200/80 flex flex-col max-h-[82vh]"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-slate-200">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs text-slate-800 tracking-tight">{stage}</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-white text-slate-600 border border-slate-200">
                      {reqsInStage.length}
                    </span>
                  </div>
                </div>

                {/* Cards Container */}
                <div className="space-y-2.5 overflow-y-auto no-scrollbar flex-1 pr-0.5">
                  {reqsInStage.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-[11px] border border-dashed border-slate-200 rounded-lg bg-white/40">
                      No requisitions in {stage}
                    </div>
                  ) : (
                    reqsInStage.map((req) => (
                      <div
                        key={req.id}
                        className="bg-white p-3.5 rounded-xl border border-slate-200 card-shadow hover:border-slate-300 transition-all space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span
                            onClick={() => onSelectReq && onSelectReq(req)}
                            className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 cursor-pointer hover:bg-brand-50 hover:text-brand-600 transition-colors"
                          >
                            {req.code}
                          </span>
                          <span className="text-[10px] text-slate-400">{req.location}</span>
                        </div>

                        <div>
                          <h4
                            onClick={() => onSelectReq && onSelectReq(req)}
                            className="font-bold text-xs text-slate-900 leading-snug cursor-pointer hover:text-brand-600 transition-colors"
                          >
                            {req.opportunityTitle}
                          </h4>
                          <div className="text-[11px] font-semibold text-slate-600 mt-0.5">
                            {req.companyName}
                          </div>
                        </div>

                        {req.resourceName ? (
                          <div className="p-2 rounded-lg bg-emerald-50/60 border border-emerald-100 flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-emerald-800 flex items-center gap-1.5">
                              <i className="fa-solid fa-user text-[10px] text-emerald-600"></i>
                              {req.resourceName}
                            </span>
                            <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                              Assigned
                            </span>
                          </div>
                        ) : (
                          <button
                            onClick={() => onOpenMatcher(req)}
                            className="w-full py-1.5 px-2 rounded-lg text-[10px] font-semibold bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 flex items-center justify-center gap-1 transition-colors"
                          >
                            <i className="fa-solid fa-users-viewfinder"></i>
                            <span>Match Bench Talent</span>
                          </button>
                        )}

                        <div className="text-[10px] text-slate-500 font-mono truncate">
                          {req.skillsRequired}
                        </div>

                        {/* Card Movement Footer */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                          <button
                            disabled={stageOrder.indexOf(req.status) === 0}
                            onClick={() => moveStage(req, -1)}
                            className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20"
                            title="Move Backward"
                          >
                            <i className="fa-solid fa-arrow-left"></i>
                          </button>

                          <div className="flex gap-1.5">
                            <button
                              onClick={() => onOpenPitchWriter(req)}
                              className="px-2 py-0.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-700 text-[10px] font-semibold"
                            >
                              Pitch
                            </button>
                          </div>

                          <button
                            disabled={stageOrder.indexOf(req.status) === stageOrder.length - 1}
                            onClick={() => moveStage(req, 1)}
                            className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20"
                            title="Advance Stage"
                          >
                            <i className="fa-solid fa-arrow-right"></i>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List Mode */
        <div className="bg-white rounded-xl border border-slate-200 card-shadow overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-200">
                <th className="py-2.5 px-4">Code & Role</th>
                <th className="py-2.5 px-4">Client Company</th>
                <th className="py-2.5 px-4">Required Skills</th>
                <th className="py-2.5 px-4">Candidate</th>
                <th className="py-2.5 px-4">Stage</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredReqs.map((req) => (
                <tr key={req.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-4 font-bold text-slate-900">
                    <span
                      onClick={() => onSelectReq && onSelectReq(req)}
                      className="cursor-pointer hover:text-brand-600 transition-colors block"
                    >
                      {req.opportunityTitle}
                    </span>
                    <div className="font-mono text-[10px] text-slate-400">{req.code}</div>
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-700">{req.companyName}</td>
                  <td className="py-3 px-4 text-slate-600 font-mono text-[11px] max-w-xs truncate">
                    {req.skillsRequired}
                  </td>
                  <td className="py-3 px-4">{req.resourceName || <span className="text-slate-400 italic">Unassigned</span>}</td>
                  <td className="py-3 px-4 font-semibold text-brand-600">{req.status}</td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => onOpenMatcher(req)}
                      className="px-2 py-1 rounded bg-purple-50 text-purple-700 text-[10px] font-semibold mr-1.5"
                    >
                      Match
                    </button>
                    <button
                      onClick={() => onOpenPitchWriter(req)}
                      className="px-2 py-1 rounded bg-amber-50 text-amber-700 text-[10px] font-semibold"
                    >
                      Pitch
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
