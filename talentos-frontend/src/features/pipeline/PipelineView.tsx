import React, { useState } from 'react';
import { Pencil, X } from 'lucide-react';
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
  onOpenAddReq?: () => void;
  onUpdateReq?: (req: Requirement) => void;
  onDeleteReq?: (req: Requirement) => void;
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
  onOpenAddReq,
  onUpdateReq,
  onDeleteReq,
}) => {
  const [displayMode, setDisplayMode] = useState<'kanban' | 'list'>('kanban');
  const [search, setSearch] = useState('');
  const [draggedReqId, setDraggedReqId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<Requirement['status'] | null>(null);
  const [editingReq, setEditingReq] = useState<Requirement | null>(null);
  const [reqToDelete, setReqToDelete] = useState<Requirement | null>(null);

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
    <div className="space-y-5 animate-fade-in">
      {/* Header matching Prototype */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Recruitment Pipeline</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Track candidate submissions across the 5 standard recruitment lifecycle stages.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenEmailParser}
            className="px-3 py-1.5 rounded-md border border-brand-200 bg-brand-50 text-brand-700 text-xs font-medium hover:bg-brand-100 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <i className="fa-solid fa-envelope-open-text text-xs"></i>
            <span>Intake Email Parser</span>
          </button>
          {onOpenAddReq && (
            <button
              onClick={onOpenAddReq}
              className="px-3.5 py-1.5 rounded-md bg-brand-600 text-white text-xs font-medium hover:bg-brand-700 shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <i className="fa-solid fa-plus text-[10px]"></i>
              <span>Add Requirement</span>
            </button>
          )}
        </div>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 card-shadow">
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              onClick={() => setDisplayMode('kanban')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
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
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
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
              className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs w-64 text-slate-700 outline-none focus:bg-white focus:border-brand-500 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Kanban Mode */}
      {displayMode === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5 items-start">
          {stageOrder.map((stage) => {
            const reqsInStage = filteredReqs.filter((r) => r.status === stage);
            const isDropTarget = dragOverStage === stage;
            return (
              <div
                key={stage}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (dragOverStage !== stage) setDragOverStage(stage);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setDragOverStage(null);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const droppedId = e.dataTransfer.getData('text/plain') || draggedReqId;
                  setDragOverStage(null);
                  setDraggedReqId(null);
                  if (!droppedId) return;
                  const droppedReq = requirements.find((r) => r.id === droppedId);
                  if (droppedReq && droppedReq.status !== stage) {
                    onStatusChange(droppedReq, stage);
                    if (stage === 'Onboarding') {
                      onOpenPlacementWizard(droppedReq);
                    }
                  }
                }}
                className={`p-3 rounded-xl border flex flex-col max-h-[82vh] transition-all ${
                  isDropTarget
                    ? 'ring-2 ring-brand-500 bg-brand-50/40 border-brand-300'
                    : 'bg-slate-100/70 border-slate-200/80'
                }`}
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
                <div className="space-y-2.5 overflow-y-auto no-scrollbar flex-1 pr-0.5 min-h-[120px]">
                  {reqsInStage.length === 0 ? (
                    <div
                      className={`py-8 text-center text-[11px] border border-dashed rounded-lg transition-colors ${
                        isDropTarget
                          ? 'border-brand-400 bg-brand-50/60 text-brand-700 font-semibold'
                          : 'border-slate-200 bg-white/40 text-slate-400'
                      }`}
                    >
                      {isDropTarget ? `Drop to move to ${stage}` : `No requisitions in ${stage}`}
                    </div>
                  ) : (
                    reqsInStage.map((req) => (
                      <div
                        key={req.id}
                        draggable
                        onDragStart={(e) => {
                          setDraggedReqId(req.id);
                          e.dataTransfer.effectAllowed = 'move';
                          e.dataTransfer.setData('text/plain', req.id);
                        }}
                        onDragEnd={() => {
                          setDraggedReqId(null);
                          setDragOverStage(null);
                        }}
                        className={`bg-white p-3.5 rounded-xl border border-slate-200 card-shadow hover:border-slate-300 transition-all space-y-2 cursor-grab active:cursor-grabbing ${
                          draggedReqId === req.id ? 'opacity-50 scale-[0.98] ring-2 ring-brand-400' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span
                            onClick={() => onSelectReq && onSelectReq(req)}
                            className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 cursor-pointer hover:bg-brand-50 hover:text-brand-600 transition-colors inline-flex items-center"
                          >
                            <i className="fa-solid fa-grip-vertical text-[9px] text-slate-300 mr-1"></i>
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

                        <div className="text-[10px] text-slate-500 truncate">
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

                          <div className="flex gap-1.5 items-center">
                            <button
                              onClick={() => onOpenPitchWriter(req)}
                              className="px-2 py-0.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-700 text-[10px] font-semibold cursor-pointer"
                            >
                              Pitch
                            </button>
                            {onUpdateReq && (
                              <button
                                onClick={() => setEditingReq({ ...req })}
                                title="Edit requirement"
                                className="p-1 text-slate-400 hover:text-brand-600 rounded hover:bg-brand-50 transition-colors cursor-pointer"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            )}
                            {onDeleteReq && (
                              <button
                                onClick={() => setReqToDelete(req)}
                                title="Delete requirement"
                                className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                              >
                                <i className="fa-solid fa-trash-can text-[10px]"></i>
                              </button>
                            )}
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
              {filteredReqs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 px-6 text-center text-xs text-slate-400">
                    No requirements found. Click <span className="font-semibold text-slate-600">Add Requirement</span> to create one.
                  </td>
                </tr>
              ) : (
                filteredReqs.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      <span
                        onClick={() => onSelectReq && onSelectReq(req)}
                        className="cursor-pointer hover:text-brand-600 transition-colors block"
                      >
                        {req.opportunityTitle}
                      </span>
                      <div className="text-[10px] text-slate-400">{req.code}</div>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-700">{req.companyName}</td>
                    <td className="py-3 px-4 text-slate-600 text-[11px] max-w-xs truncate">
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
                      {onUpdateReq && (
                        <button
                          onClick={() => setEditingReq({ ...req })}
                          title="Edit requirement"
                          className="ml-1.5 p-1 text-slate-400 hover:text-brand-600 rounded hover:bg-brand-50 transition-colors cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {onDeleteReq && (
                        <button
                          onClick={() => setReqToDelete(req)}
                          title="Delete requirement"
                          className="ml-1 p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                        >
                          <i className="fa-solid fa-trash-can text-xs"></i>
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Requisition Modal */}
      {editingReq && (
        <div
          onClick={() => setEditingReq(null)}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-scale-up"
          >
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Edit Requirement</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">{editingReq.code}</p>
              </div>
              <button
                onClick={() => setEditingReq(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (onUpdateReq) onUpdateReq(editingReq);
                setEditingReq(null);
              }}
              className="p-6 space-y-3.5 text-xs"
            >
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Opportunity Title *</label>
                <input
                  type="text"
                  required
                  value={editingReq.opportunityTitle}
                  onChange={(e) => setEditingReq({ ...editingReq, opportunityTitle: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Client Company *</label>
                  <input
                    type="text"
                    required
                    value={editingReq.companyName}
                    onChange={(e) => setEditingReq({ ...editingReq, companyName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Client Contact</label>
                  <input
                    type="text"
                    value={editingReq.clientContact || ''}
                    onChange={(e) => setEditingReq({ ...editingReq, clientContact: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Location</label>
                  <input
                    type="text"
                    value={editingReq.location}
                    onChange={(e) => setEditingReq({ ...editingReq, location: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Stage</label>
                  <select
                    value={editingReq.status}
                    onChange={(e) => setEditingReq({ ...editingReq, status: e.target.value as Requirement['status'] })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:border-brand-600 focus:outline-none cursor-pointer"
                  >
                    {stageOrder.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Assigned Recruiter</label>
                <input
                  type="text"
                  value={editingReq.assignedRecruiter || ''}
                  onChange={(e) => setEditingReq({ ...editingReq, assignedRecruiter: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Required Skills</label>
                <input
                  type="text"
                  value={editingReq.skillsRequired}
                  onChange={(e) => setEditingReq({ ...editingReq, skillsRequired: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingReq(null)}
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

      {/* Delete Requisition Confirmation Modal */}
      {reqToDelete && (
        <div
          onClick={() => setReqToDelete(null)}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-scale-up"
          >
            <div className="p-6 space-y-4">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center flex-shrink-0">
                  <i className="fa-solid fa-triangle-exclamation text-base"></i>
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-900">Delete Requirement?</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Are you sure you want to permanently remove{' '}
                    <span className="font-bold text-slate-800">{reqToDelete.code}</span> —{' '}
                    <span className="font-semibold text-slate-800">{reqToDelete.opportunityTitle}</span> at{' '}
                    <span className="font-semibold text-slate-800">{reqToDelete.companyName}</span>?
                  </p>
                  <p className="text-[11px] text-rose-600 font-medium pt-0.5">
                    This action cannot be undone and removes linked submission records.
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setReqToDelete(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onDeleteReq) onDeleteReq(reqToDelete);
                    setReqToDelete(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <i className="fa-solid fa-trash-can text-[11px]"></i>
                  <span>Delete Requisition</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
