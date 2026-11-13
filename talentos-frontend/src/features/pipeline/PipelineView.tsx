import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Columns,
  GripVertical,
  List,
  MailOpen,
  MapPin,
  Pencil,
  Plus,
  Search,
  Send,
  Trash2,
  User,
  UsersRound,
  X,
} from 'lucide-react';
import { apiClient } from '../../config/api.config';
import { Requirement, Candidate } from '../../types';
import { TablePagination } from '../../components/shared/TablePagination';
import { useDebounce } from '../../utils/useDebounce';
import { mapRequirementFromApi } from '../../utils/entityMappers';

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
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [serverReqs, setServerReqs] = useState<Requirement[]>([]);
  const [totalReqs, setTotalReqs] = useState(requirements.length);
  const [isLoadingReqs, setIsLoadingReqs] = useState(false);
  const [draggedReqId, setDraggedReqId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<Requirement['status'] | null>(null);
  const [editingReq, setEditingReq] = useState<Requirement | null>(null);
  const [reqToDelete, setReqToDelete] = useState<Requirement | null>(null);

  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, displayMode]);

  useEffect(() => {
    let active = true;
    setIsLoadingReqs(true);
    const params: Record<string, any> = {
      search: debouncedSearch.trim() || undefined,
    };
    if (displayMode === 'list') {
      params.page = page;
      params.limit = limit;
    }

    apiClient
      .get('/requirements', { params })
      .then((res) => {
        if (!active) return;
        if (res.data?.success && Array.isArray(res.data.data)) {
          const mapped = res.data.data.map(mapRequirementFromApi);
          setServerReqs(mapped);
          setTotalReqs(res.data.pagination?.total ?? mapped.length);
        }
      })
      .catch(() => {
        if (!active) return;
        const q = debouncedSearch.toLowerCase();
        const fallback = requirements.filter(
          (r) =>
            !q ||
            r.opportunityTitle.toLowerCase().includes(q) ||
            r.companyName.toLowerCase().includes(q) ||
            r.skillsRequired.toLowerCase().includes(q)
        );
        setTotalReqs(fallback.length);
        setServerReqs(displayMode === 'list' ? fallback.slice((page - 1) * limit, page * limit) : fallback);
      })
      .finally(() => {
        if (active) setIsLoadingReqs(false);
      });

    return () => {
      active = false;
    };
  }, [debouncedSearch, displayMode, page, limit, requirements]);

  const stageOrder: Requirement['status'][] = [
    'Requirement',
    'Submitted',
    'Interview',
    'Selected',
    'Onboarding',
  ];

  const stageMeta: Record<
    Requirement['status'],
    { dotClass: string; headerAccent: string; pillClass: string; tableBadge: string }
  > = {
    Requirement: {
      dotClass: 'bg-slate-400',
      headerAccent: 'border-t-slate-400',
      pillClass: 'bg-slate-100 text-slate-700 border-slate-200',
      tableBadge: 'bg-slate-100 text-slate-700 border-slate-200',
    },
    Submitted: {
      dotClass: 'bg-amber-500',
      headerAccent: 'border-t-amber-400',
      pillClass: 'bg-amber-50 text-amber-700 border-amber-200',
      tableBadge: 'bg-amber-50 text-amber-700 border-amber-200',
    },
    Interview: {
      dotClass: 'bg-blue-500',
      headerAccent: 'border-t-blue-500',
      pillClass: 'bg-blue-50 text-blue-700 border-blue-200',
      tableBadge: 'bg-blue-50 text-blue-700 border-blue-200',
    },
    Selected: {
      dotClass: 'bg-purple-500',
      headerAccent: 'border-t-purple-500',
      pillClass: 'bg-purple-50 text-purple-700 border-purple-200',
      tableBadge: 'bg-purple-50 text-purple-700 border-purple-200',
    },
    Onboarding: {
      dotClass: 'bg-emerald-500',
      headerAccent: 'border-t-emerald-500',
      pillClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      tableBadge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
  };

  const getSkillsList = (skillsStr?: string) =>
    String(skillsStr || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

  const filteredReqs = serverReqs;

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
            <MailOpen className="w-3.5 h-3.5" />
            <span>Intake Email Parser</span>
          </button>
          {onOpenAddReq && (
            <button
              onClick={onOpenAddReq}
              className="px-3.5 py-1.5 rounded-md bg-brand-600 text-white text-xs font-medium hover:bg-brand-700 shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={2.4} />
              <span>Add Requirement</span>
            </button>
          )}
        </div>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white px-4 py-3 rounded-xl border border-slate-200 card-shadow">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200/80">
            <button
              onClick={() => setDisplayMode('kanban')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                displayMode === 'kanban'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              <span>Kanban</span>
            </button>
            <button
              onClick={() => setDisplayMode('list')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                displayMode === 'list'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter pipeline orders..."
              className="pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs w-64 text-slate-700 outline-none focus:bg-white focus:border-brand-500 transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                title="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <span className="px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200 font-medium text-slate-700">
            {totalReqs} {totalReqs === 1 ? 'Requisition' : 'Requisitions'}
          </span>
          <span className="hidden md:inline text-slate-400">Drag cards between columns to update stage</span>
        </div>
      </div>

      {/* Kanban Mode */}
      {displayMode === 'kanban' ? (
        <div className="overflow-x-auto pb-2 -mx-1 px-1">
          <div className="grid grid-cols-5 gap-3.5 min-w-[1160px] items-stretch">
            {stageOrder.map((stage) => {
              const reqsInStage = filteredReqs.filter((r) => r.status === stage);
              const isDropTarget = dragOverStage === stage;
              const meta = stageMeta[stage];
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
                    const droppedReq =
                      requirements.find((r) => r.id === droppedId) ||
                      serverReqs.find((r) => r.id === droppedId);
                    if (droppedReq && droppedReq.status !== stage) {
                      onStatusChange(droppedReq, stage);
                      if (stage === 'Onboarding') {
                        onOpenPlacementWizard(droppedReq);
                      }
                    }
                  }}
                  className={`p-3 rounded-xl border border-t-2 ${meta.headerAccent} flex flex-col min-h-[540px] max-h-[calc(100vh-250px)] transition-all ${
                    isDropTarget
                      ? 'ring-2 ring-brand-500 bg-brand-50/40 border-brand-300'
                      : 'bg-slate-100/75 border-slate-200/80'
                  }`}
                >
                  {/* Column Header */}
                  <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-200/80">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${meta.dotClass}`} />
                      <span className="font-bold text-xs text-slate-800 tracking-tight truncate">
                        {stage}
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex-shrink-0 ${meta.pillClass}`}
                    >
                      {reqsInStage.length}
                    </span>
                  </div>

                  {/* Cards Container */}
                  <div className="space-y-2.5 overflow-y-auto no-scrollbar flex-1 flex flex-col">
                    {reqsInStage.length === 0 ? (
                      <div
                        className={`flex-1 flex flex-col items-center justify-center p-5 text-center text-[11px] border border-dashed rounded-xl transition-colors ${
                          isDropTarget
                            ? 'border-brand-400 bg-brand-50/70 text-brand-700 font-semibold'
                            : 'border-slate-200/90 bg-white/50 text-slate-400'
                        }`}
                      >
                        <Columns className="w-5 h-5 mb-2 text-slate-300" />
                        <p className="font-medium text-slate-500">
                          {isDropTarget ? `Drop to move to ${stage}` : `No requisitions in ${stage}`}
                        </p>
                        {stage === 'Requirement' && onOpenAddReq && !isDropTarget && (
                          <button
                            type="button"
                            onClick={onOpenAddReq}
                            className="mt-2.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-600 hover:text-brand-600 hover:border-brand-200 text-[10px] font-semibold transition-colors cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Add Requirement</span>
                          </button>
                        )}
                      </div>
                    ) : (
                      reqsInStage.map((req) => {
                        const skills = getSkillsList(req.skillsRequired);
                        const stageIdx = stageOrder.indexOf(req.status);
                        return (
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
                            className={`bg-white p-3.5 rounded-xl border border-slate-200/90 card-shadow hover:border-slate-300 transition-all space-y-2.5 cursor-grab active:cursor-grabbing ${
                              draggedReqId === req.id ? 'opacity-50 scale-[0.98] ring-2 ring-brand-400' : ''
                            }`}
                          >
                            {/* Card Top Meta Row */}
                            <div className="flex items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => onSelectReq && onSelectReq(req)}
                                className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200/70 cursor-pointer hover:bg-brand-50 hover:text-brand-700 hover:border-brand-200 transition-colors inline-flex items-center gap-1 whitespace-nowrap flex-shrink-0"
                              >
                                <GripVertical className="w-2.5 h-2.5 text-slate-400 flex-shrink-0" />
                                <span>{req.code}</span>
                              </button>
                              <span
                                title={req.location}
                                className="text-[10px] text-slate-400 flex items-center justify-end gap-1 min-w-0 flex-1"
                              >
                                <MapPin className="w-2.5 h-2.5 flex-shrink-0 text-slate-300" />
                                <span className="truncate">{req.location || 'Remote'}</span>
                              </span>
                            </div>

                            {/* Role & Company */}
                            <div>
                              <h4
                                onClick={() => onSelectReq && onSelectReq(req)}
                                title={req.opportunityTitle}
                                className="font-bold text-[12.5px] text-slate-900 leading-snug line-clamp-2 cursor-pointer hover:text-brand-600 transition-colors"
                              >
                                {req.opportunityTitle}
                              </h4>
                              <div className="flex items-center gap-1 text-[11px] font-medium text-slate-500 mt-1 min-w-0">
                                <Building2 className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                <span className="truncate" title={req.companyName}>
                                  {req.companyName}
                                </span>
                              </div>
                            </div>

                            {/* Candidate Status or Bench Matcher */}
                            {req.resourceName ? (
                              <div className="px-2.5 py-1.5 rounded-lg bg-emerald-50/75 border border-emerald-200/75 flex items-center justify-between gap-2">
                                <span className="text-[11px] font-semibold text-emerald-800 flex items-center gap-1.5 min-w-0 flex-1">
                                  <User className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                                  <span className="truncate" title={req.resourceName}>
                                    {req.resourceName}
                                  </span>
                                </span>
                                <span className="text-[9px] font-semibold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded whitespace-nowrap flex-shrink-0">
                                  Assigned
                                </span>
                              </div>
                            ) : (
                              <button
                                onClick={() => onOpenMatcher(req)}
                                className="w-full py-1.5 px-2.5 rounded-lg text-[11px] font-semibold bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200/80 flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                              >
                                <UsersRound className="w-3.5 h-3.5 flex-shrink-0" />
                                <span>Match Bench Talent</span>
                              </button>
                            )}

                            {/* Capped Skills Pills */}
                            {skills.length > 0 && (
                              <div className="flex items-center gap-1 flex-wrap">
                                {skills.slice(0, 3).map((sk) => (
                                  <span
                                    key={sk}
                                    title={sk}
                                    className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-medium max-w-[96px] truncate"
                                  >
                                    {sk}
                                  </span>
                                ))}
                                {skills.length > 3 && (
                                  <span
                                    title={skills.slice(3).join(', ')}
                                    className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 text-[10px] font-semibold whitespace-nowrap"
                                  >
                                    +{skills.length - 3}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Clean Card Action Footer */}
                            <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-[11px]">
                              <div className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50/80 divide-x divide-slate-200 overflow-hidden flex-shrink-0">
                                <button
                                  disabled={stageIdx === 0}
                                  onClick={() => moveStage(req, -1)}
                                  className="p-1 text-slate-500 hover:bg-white hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                                  title="Move Backward"
                                >
                                  <ArrowLeft className="w-3 h-3" />
                                </button>
                                <button
                                  disabled={stageIdx === stageOrder.length - 1}
                                  onClick={() => moveStage(req, 1)}
                                  className="p-1 text-slate-500 hover:bg-white hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                                  title="Advance Stage"
                                >
                                  <ArrowRight className="w-3 h-3" />
                                </button>
                              </div>

                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                  onClick={() => onOpenPitchWriter(req)}
                                  title="Open submission pitch writer"
                                  className="px-2 py-1 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200/70 text-[10px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
                                >
                                  <Send className="w-2.5 h-2.5" />
                                  <span>Pitch</span>
                                </button>
                                {onUpdateReq && (
                                  <button
                                    onClick={() => setEditingReq({ ...req })}
                                    title="Edit requirement"
                                    className="p-1 text-slate-400 hover:text-brand-600 rounded-md hover:bg-brand-50 transition-colors cursor-pointer"
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                )}
                                {onDeleteReq && (
                                  <button
                                    onClick={() => setReqToDelete(req)}
                                    title="Delete requirement"
                                    className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
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
                    No requirements found.{' '}
                    {onOpenAddReq ? (
                      <>
                        Click{' '}
                        <button
                          type="button"
                          onClick={onOpenAddReq}
                          className="font-semibold text-brand-600 hover:text-brand-700 hover:underline cursor-pointer"
                        >
                          Add Requirement
                        </button>{' '}
                        to create one.
                      </>
                    ) : null}
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
                      <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                        {req.code} &bull; {req.location}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-700">{req.companyName}</td>
                    <td className="py-3 px-4 text-slate-600 text-[11px] max-w-xs truncate">
                      {req.skillsRequired}
                    </td>
                    <td className="py-3 px-4">{req.resourceName || <span className="text-slate-400 italic">Unassigned</span>}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap ${
                          stageMeta[req.status]?.tableBadge || 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {req.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => onOpenMatcher(req)}
                        className="px-2 py-1 rounded bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200/70 text-[10px] font-semibold mr-1.5 cursor-pointer transition-colors"
                      >
                        Match
                      </button>
                      <button
                        onClick={() => onOpenPitchWriter(req)}
                        className="px-2 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200/70 text-[10px] font-semibold cursor-pointer transition-colors"
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
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <TablePagination
            page={page}
            limit={limit}
            total={totalReqs}
            onPageChange={setPage}
            onLimitChange={(nextLimit) => {
              setLimit(nextLimit);
              setPage(1);
            }}
            itemLabel="requirements"
            isLoading={isLoadingReqs}
          />
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
                  <AlertTriangle className="w-4 h-4" />
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
                  <Trash2 className="w-3.5 h-3.5" />
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
