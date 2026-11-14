import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  AlertTriangle,
  Building2,
  Clock,
  Columns,
  FileSpreadsheet,
  List,
  MailOpen,
  Pencil,
  Plus,
  Search,
  Trash2,
  User,
  UsersRound,
  X,
} from 'lucide-react';
import { apiClient } from '../../config/api.config';
import { Requirement, Candidate } from '../../types';
import { TablePagination } from '../../components/shared/TablePagination';
import { ModalPortal } from '../../components/shared/ModalPortal';
import { useDebounce } from '../../utils/useDebounce';
import { mapRequirementFromApi } from '../../utils/entityMappers';
import { useCurrency } from '../../utils/currency';
import { getWorkspaceBrandSlug } from '../../utils/workspaceBrand';
import { useMasterTaxonomies } from '../../components/shared/DynamicCustomFieldsSection';

interface PipelineViewProps {
  requirements: Requirement[];
  candidates: Candidate[];
  rateMasked?: boolean;
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
  rateMasked = false,
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
  const { symbol: currencySymbol } = useCurrency();
  const [displayMode, setDisplayMode] = useState<'kanban' | 'list'>('kanban');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [serverReqs, setServerReqs] = useState<Requirement[]>(requirements);
  const [totalReqs, setTotalReqs] = useState(requirements.length);
  const [isLoadingReqs, setIsLoadingReqs] = useState(false);
  const KANBAN_PAGE_SIZE = 25;
  const [kanbanColumns, setKanbanColumns] = useState<
    Record<
      string,
      { items: Requirement[]; total: number; page: number; hasMore: boolean; loadingMore: boolean }
    >
  >({});
  const [useServerKanban, setUseServerKanban] = useState(false);
  const [activeDrag, setActiveDrag] = useState<{
    req: Requirement;
    width: number;
    height: number;
    initialX: number;
    initialY: number;
  } | null>(null);
  const [dragOverStage, setDragOverStage] = useState<Requirement['status'] | null>(null);
  const [editingReq, setEditingReq] = useState<Requirement | null>(null);
  const [editOpenPositions, setEditOpenPositions] = useState<string>('1');
  const [editOpenPosError, setEditOpenPosError] = useState<string>('');
  const [reqToDelete, setReqToDelete] = useState<Requirement | null>(null);

  useEffect(() => {
    if (editingReq) {
      setEditOpenPositions(String(editingReq.openPositions || 1));
      setEditOpenPosError('');
    }
  }, [editingReq?.id]);

  const boardScrollRef = useRef<HTMLDivElement | null>(null);
  const columnRefs = useRef<Partial<Record<Requirement['status'], HTMLDivElement | null>>>({});
  const floatingPreviewRef = useRef<HTMLDivElement | null>(null);
  const dragOverStageRef = useRef<Requirement['status'] | null>(null);
  const suppressClickRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const cleanupDragRef = useRef<(() => void) | null>(null);
  const pendingStageMapRef = useRef<Map<string, { stage: Requirement['status']; until: number }>>(new Map());
  const dragSessionRef = useRef<{
    req: Requirement;
    startX: number;
    startY: number;
    offsetX: number;
    offsetY: number;
    width: number;
    height: number;
    active: boolean;
    latestX: number;
    latestY: number;
    clientX: number;
    clientY: number;
  } | null>(null);

  const debouncedSearch = useDebounce(search, 300);

  const applyPendingStages = useCallback((list: Requirement[]): Requirement[] => {
    const now = Date.now();
    if (pendingStageMapRef.current.size === 0) return list;
    for (const [id, entry] of pendingStageMapRef.current.entries()) {
      if (entry.until <= now) pendingStageMapRef.current.delete(id);
    }
    if (pendingStageMapRef.current.size === 0) return list;
    return list.map((r) => {
      const pending = pendingStageMapRef.current.get(r.id);
      return pending && r.status !== pending.stage ? { ...r, status: pending.stage } : r;
    });
  }, []);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, displayMode]);

  const taxonomies = useMasterTaxonomies(true);

  useEffect(() => {
    let active = true;

    if (displayMode === 'kanban') {
      const stagesParam = (
        Array.isArray(taxonomies.stages) && taxonomies.stages.length > 0
          ? taxonomies.stages
          : ['Requirement', 'Submitted', 'Interview', 'Selected', 'Onboarding']
      ).join(',');

      apiClient
        .get('/requirements/kanban', {
          params: {
            stages: stagesParam,
            search: debouncedSearch.trim() || undefined,
            limit: KANBAN_PAGE_SIZE,
          },
        })
        .then((res) => {
          if (!active) return;
          if (res.data?.success && res.data.data?.columns) {
            const nextCols: Record<
              string,
              { items: Requirement[]; total: number; page: number; hasMore: boolean; loadingMore: boolean }
            > = {};
            const flatItems: Requirement[] = [];
            for (const col of res.data.data.columns) {
              const mappedItems = applyPendingStages(
                (col.items || []).map(mapRequirementFromApi)
              );
              nextCols[col.stage] = {
                items: mappedItems,
                total: Number(col.total || 0),
                page: 1,
                hasMore: Boolean(col.hasMore),
                loadingMore: false,
              };
              flatItems.push(...mappedItems);
            }
            setKanbanColumns(nextCols);
            setUseServerKanban(true);
            setServerReqs(flatItems);
            setTotalReqs(Number(res.data.data.total ?? flatItems.length));
          }
        })
        .catch(() => {
          if (!active) return;
          setUseServerKanban(false);
          const q = debouncedSearch.toLowerCase();
          const fallback = applyPendingStages(requirements).filter(
            (r) =>
              !q ||
              r.opportunityTitle.toLowerCase().includes(q) ||
              r.companyName.toLowerCase().includes(q) ||
              r.skillsRequired.toLowerCase().includes(q)
          );
          setServerReqs(fallback);
          setTotalReqs(fallback.length);
        })
        .finally(() => {
          if (active) setIsLoadingReqs(false);
        });

      return () => {
        active = false;
      };
    }

    setIsLoadingReqs(true);
    const params: Record<string, any> = {
      search: debouncedSearch.trim() || undefined,
      page,
      limit,
    };

    apiClient
      .get('/requirements', { params })
      .then((res) => {
        if (!active) return;
        if (res.data?.success && Array.isArray(res.data.data)) {
          const mapped = applyPendingStages(res.data.data.map(mapRequirementFromApi));
          setServerReqs(mapped);
          setTotalReqs(res.data.pagination?.total ?? mapped.length);
        }
      })
      .catch(() => {
        if (!active) return;
        const q = debouncedSearch.toLowerCase();
        const fallback = applyPendingStages(requirements).filter(
          (r) =>
            !q ||
            r.opportunityTitle.toLowerCase().includes(q) ||
            r.companyName.toLowerCase().includes(q) ||
            r.skillsRequired.toLowerCase().includes(q)
        );
        setTotalReqs(fallback.length);
        setServerReqs(fallback.slice((page - 1) * limit, page * limit));
      })
      .finally(() => {
        if (active) setIsLoadingReqs(false);
      });

    return () => {
      active = false;
    };
  }, [debouncedSearch, displayMode, page, limit, requirements, taxonomies.stages, applyPendingStages]);

  const handleLoadMoreStage = useCallback(
    async (stage: string) => {
      const col = kanbanColumns[stage];
      if (!col || col.loadingMore || !col.hasMore) return;
      const nextPage = col.page + 1;
      setKanbanColumns((prev) => ({
        ...prev,
        [stage]: { ...prev[stage], loadingMore: true },
      }));
      try {
        const res = await apiClient.get('/requirements', {
          params: {
            status: stage,
            search: debouncedSearch.trim() || undefined,
            page: nextPage,
            limit: KANBAN_PAGE_SIZE,
            view: 'kanban',
          },
        });
        if (res.data?.success && Array.isArray(res.data.data)) {
          const nextItems = applyPendingStages(res.data.data.map(mapRequirementFromApi));
          setKanbanColumns((prev) => {
            const current = prev[stage];
            if (!current) return prev;
            const existingIds = new Set(current.items.map((i) => i.id));
            const merged = [...current.items, ...nextItems.filter((i) => !existingIds.has(i.id))];
            const total = res.data.pagination?.total ?? current.total;
            return {
              ...prev,
              [stage]: {
                items: merged,
                total,
                page: nextPage,
                hasMore: merged.length < total,
                loadingMore: false,
              },
            };
          });
        }
      } catch {
        setKanbanColumns((prev) =>
          prev[stage] ? { ...prev, [stage]: { ...prev[stage], loadingMore: false } } : prev
        );
      }
    },
    [kanbanColumns, debouncedSearch, applyPendingStages]
  );

  const stageOrder: string[] = useMemo(() => {
    const base =
      Array.isArray(taxonomies.stages) && taxonomies.stages.length > 0
        ? taxonomies.stages
        : ['Requirement', 'Submitted', 'Interview', 'Selected', 'Onboarding'];
    const seen = new Set(base);
    const result = [...base];
    for (const r of serverReqs) {
      if (r.status && !seen.has(r.status)) {
        seen.add(r.status);
        result.push(r.status);
      }
    }
    return result;
  }, [taxonomies.stages, serverReqs]);

  const stageMeta: Record<
    string,
    { dotClass: string; pillClass: string; tableBadge: string }
  > = {
    Requirement: {
      dotClass: 'bg-slate-400',
      pillClass: 'bg-slate-100 text-slate-700 border-slate-200',
      tableBadge: 'bg-slate-100 text-slate-700 border-slate-200',
    },
    Submitted: {
      dotClass: 'bg-amber-500',
      pillClass: 'bg-amber-50 text-amber-700 border-amber-200',
      tableBadge: 'bg-amber-50 text-amber-700 border-amber-200',
    },
    Interview: {
      dotClass: 'bg-blue-500',
      pillClass: 'bg-blue-50 text-blue-700 border-blue-200',
      tableBadge: 'bg-blue-50 text-blue-700 border-blue-200',
    },
    Selected: {
      dotClass: 'bg-purple-500',
      pillClass: 'bg-purple-50 text-purple-700 border-purple-200',
      tableBadge: 'bg-purple-50 text-purple-700 border-purple-200',
    },
    Onboarding: {
      dotClass: 'bg-emerald-500',
      pillClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      tableBadge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
    Billable: {
      dotClass: 'bg-teal-500',
      pillClass: 'bg-teal-50 text-teal-700 border-teal-200',
      tableBadge: 'bg-teal-50 text-teal-700 border-teal-200',
    },
    Archived: {
      dotClass: 'bg-zinc-400',
      pillClass: 'bg-zinc-100 text-zinc-600 border-zinc-200',
      tableBadge: 'bg-zinc-100 text-zinc-600 border-zinc-200',
    },
  };

  const fallbackPalettes = [
    { dotClass: 'bg-indigo-500', pillClass: 'bg-indigo-50 text-indigo-700 border-indigo-200', tableBadge: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    { dotClass: 'bg-cyan-500', pillClass: 'bg-cyan-50 text-cyan-700 border-cyan-200', tableBadge: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
    { dotClass: 'bg-rose-500', pillClass: 'bg-rose-50 text-rose-700 border-rose-200', tableBadge: 'bg-rose-50 text-rose-700 border-rose-200' },
  ];

  const getStageMeta = (stage: string) => {
    if (stageMeta[stage]) return stageMeta[stage];
    const idx = Math.max(0, stageOrder.indexOf(stage));
    return fallbackPalettes[idx % fallbackPalettes.length];
  };

  const filteredReqs = serverReqs;

  const handleExportExcel = () => {
    const headers = [
      'Req Code',
      'Opportunity Title',
      'Client Company',
      'Client Contact',
      'Open Positions',
      'Filled',
      'Location',
      'Skills Required',
      'Assigned Resource',
      'Stage',
    ];
    const rows = filteredReqs.map((r) => [
      `"${(r.code || '').replace(/"/g, '""')}"`,
      `"${(r.opportunityTitle || '').replace(/"/g, '""')}"`,
      `"${(r.companyName || '').replace(/"/g, '""')}"`,
      `"${(r.clientContact || '').replace(/"/g, '""')}"`,
      `${r.openPositions || 1}`,
      `${r.filledPositions ?? r.activePlacements?.length ?? 0}`,
      `"${(r.location || '').replace(/"/g, '""')}"`,
      `"${(r.skillsRequired || '').replace(/"/g, '""')}"`,
      `"${(r.resourceName || '-').replace(/"/g, '""')}"`,
      `"${(r.status || '').replace(/"/g, '""')}"`,
    ]);
    const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${getWorkspaceBrandSlug()}_Requirements_List_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const commitStageMove = useCallback(
    (req: Requirement, nextStage: Requirement['status']) => {
      if (req.status === nextStage) return;
      const fromStage = req.status;
      pendingStageMapRef.current.set(req.id, { stage: nextStage, until: Date.now() + 2500 });
      setServerReqs((prev) => {
        const existing = prev.find((r) => r.id === req.id);
        const updatedReq = existing ? { ...existing, status: nextStage } : { ...req, status: nextStage };
        return [updatedReq, ...prev.filter((r) => r.id !== req.id)];
      });
      setKanbanColumns((prev) => {
        if (!prev[fromStage] && !prev[nextStage]) return prev;
        const next = { ...prev };
        const movedCard = { ...(prev[fromStage]?.items.find((r) => r.id === req.id) || req), status: nextStage };
        if (next[fromStage]) {
          next[fromStage] = {
            ...next[fromStage],
            items: next[fromStage].items.filter((r) => r.id !== req.id),
            total: Math.max(0, next[fromStage].total - 1),
          };
        }
        if (next[nextStage]) {
          next[nextStage] = {
            ...next[nextStage],
            items: [movedCard, ...next[nextStage].items.filter((r) => r.id !== req.id)],
            total: next[nextStage].total + 1,
          };
        }
        return next;
      });
      onStatusChange(req, nextStage);
    },
    [onStatusChange]
  );

  const hitTestStage = useCallback((clientX: number, clientY: number): Requirement['status'] | null => {
    for (const st of stageOrder) {
      const col = columnRefs.current[st];
      if (!col) continue;
      const rect = col.getBoundingClientRect();
      if (
        clientX >= rect.left - 7 &&
        clientX <= rect.right + 7 &&
        clientY >= rect.top - 40 &&
        clientY <= rect.bottom + 40
      ) {
        return st;
      }
    }
    return null;
  }, []);

  useEffect(() => {
    return () => {
      cleanupDragRef.current?.();
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, []);

  const handleCardPointerDown = (e: React.PointerEvent<HTMLDivElement>, req: Requirement) => {
    if (e.button !== 0) return;
    const targetEl = e.target as HTMLElement;
    if (targetEl.closest('button:not([data-allow-drag]), a, input, select, textarea, [data-no-drag="true"]')) return;

    const cardRect = e.currentTarget.getBoundingClientRect();
    const session = {
      req,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: e.clientX - cardRect.left,
      offsetY: e.clientY - cardRect.top,
      width: cardRect.width,
      height: cardRect.height,
      active: false,
      latestX: cardRect.left,
      latestY: cardRect.top,
      clientX: e.clientX,
      clientY: e.clientY,
    };
    dragSessionRef.current = session;

    const resetDragVisuals = () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      dragOverStageRef.current = null;
      setDragOverStage(null);
      setActiveDrag(null);
      dragSessionRef.current = null;
      cleanupDragRef.current?.();
      cleanupDragRef.current = null;
    };

    const updateFrame = () => {
      rafRef.current = null;
      const cur = dragSessionRef.current;
      if (!cur || !cur.active) return;

      if (floatingPreviewRef.current) {
        floatingPreviewRef.current.style.transform = `translate3d(${cur.latestX}px, ${cur.latestY}px, 0) rotate(1.2deg)`;
      }

      // Smooth horizontal auto-scroll when dragging near left/right edge of the board
      const scroller = boardScrollRef.current;
      if (scroller && scroller.scrollWidth > scroller.clientWidth) {
        const sRect = scroller.getBoundingClientRect();
        const edgeZone = 56;
        if (cur.clientX < sRect.left + edgeZone) {
          scroller.scrollLeft -= 12;
        } else if (cur.clientX > sRect.right - edgeZone) {
          scroller.scrollLeft += 12;
        }
      }

      const hovered = hitTestStage(cur.clientX, cur.clientY);
      if (hovered !== dragOverStageRef.current) {
        dragOverStageRef.current = hovered;
        setDragOverStage(hovered);
      }
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const cur = dragSessionRef.current;
      if (!cur) return;

      cur.clientX = moveEvent.clientX;
      cur.clientY = moveEvent.clientY;
      cur.latestX = moveEvent.clientX - cur.offsetX;
      cur.latestY = moveEvent.clientY - cur.offsetY;

      if (!cur.active) {
        const dist = Math.hypot(moveEvent.clientX - cur.startX, moveEvent.clientY - cur.startY);
        if (dist <= 5) return;
        cur.active = true;
        suppressClickRef.current = true;
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'grabbing';
        setActiveDrag({
          req: cur.req,
          width: cur.width,
          height: cur.height,
          initialX: cur.latestX,
          initialY: cur.latestY,
        });
        dragOverStageRef.current = cur.req.status;
        setDragOverStage(cur.req.status);
      }

      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(updateFrame);
      }
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      const cur = dragSessionRef.current;
      const wasActive = Boolean(cur?.active);
      const targetStage = wasActive
        ? hitTestStage(upEvent.clientX, upEvent.clientY) ?? dragOverStageRef.current
        : null;
      const movedReq = cur?.req;

      resetDragVisuals();

      if (wasActive) {
        setTimeout(() => {
          suppressClickRef.current = false;
        }, 0);
        if (movedReq && targetStage && targetStage !== movedReq.status) {
          commitStageMove(movedReq, targetStage);
        }
      }
    };

    const handleKeyDown = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key === 'Escape' && dragSessionRef.current?.active) {
        resetDragVisuals();
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', resetDragVisuals);
    window.addEventListener('keydown', handleKeyDown);

    cleanupDragRef.current = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', resetDragVisuals);
      window.removeEventListener('keydown', handleKeyDown);
    };
  };

  const handleCardTitleClick = (req: Requirement) => {
    if (suppressClickRef.current) return;
    if (onSelectReq) onSelectReq(req);
  };

  const getSkillsList = (skillsStr?: string) =>
    String(skillsStr || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

  const getTwoInitials = (name?: string): string => {
    const parts = String(name || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (parts.length === 0) return 'C';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  };

  const getSingleInitial = (name?: string): string => {
    const ch = String(name || '').trim()[0];
    return ch ? ch.toUpperCase() : 'C';
  };

  const formatRelativeTime = (dateInput?: string): string => {
    if (!dateInput) return 'Today';
    const parsed = new Date(dateInput);
    if (isNaN(parsed.getTime())) return 'Today';
    const diffMs = Math.max(0, Date.now() - parsed.getTime());
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60 && String(dateInput).includes('T')) {
      return diffMins <= 1 ? 'Just now' : `${diffMins}m ago`;
    }
    const diffHours = Math.floor(diffMs / 3600000);
    if (diffHours < 24 && String(dateInput).includes('T')) {
      return `${diffHours}h ago`;
    }
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays <= 0) return 'Today';
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 30) return `${diffDays} days ago`;
    const diffMonths = Math.floor(diffDays / 30);
    return diffMonths === 1 ? '1 month ago' : `${diffMonths} months ago`;
  };

  const avatarPalette = ['bg-indigo-500', 'bg-sky-500', 'bg-emerald-500'];

  const renderCardBody = (req: Requirement) => {
    const meta = getStageMeta(req.status);
    const skills = getSkillsList(req.skillsRequired);
    const visibleSkills = skills.slice(0, 3);
    const extraSkillCount = Math.max(0, skills.length - visibleSkills.length);
    const activeSubs = (req.submissions || []).filter((s) => s.stage !== 'Closed');
    const totalApplicants =
      activeSubs.length > 0 ? activeSubs.length : (req.submissionCount ?? (req.resourceName ? 1 : 0));
    const singleApplicantName = activeSubs[0]?.fullName || req.resourceName || 'Applicant';
    const timeLabel = formatRelativeTime(req.createdAt);
    const footerColsClass =
      onUpdateReq && onDeleteReq
        ? 'grid-cols-3'
        : onUpdateReq || onDeleteReq
        ? 'grid-cols-2'
        : 'grid-cols-1';

    return (
      <>
        <div className="px-4 pt-4 pb-4 space-y-3">
          {/* Row 1: Stage Dot + Req Code & Bold Rate */}
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              data-allow-drag="true"
              onClick={() => handleCardTitleClick(req)}
              className="inline-flex items-center gap-1.5 text-[11px] font-mono font-medium text-slate-400 hover:text-brand-600 transition-colors cursor-pointer"
            >
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${meta.dotClass}`} />
              <span>{req.code}</span>
            </button>

            {!rateMasked && Boolean(req.targetBillRate) && (
              <span className="tabular-nums whitespace-nowrap">
                <span className="text-[12px] font-medium text-slate-700">
                  {currencySymbol}
                  {req.targetBillRate}
                </span>
                <span className="text-[10.5px] font-normal text-slate-400">/hr</span>
              </span>
            )}
          </div>

          {/* Row 2: Role Title & Client Company */}
          <div className="space-y-1">
            <h4
              onClick={() => handleCardTitleClick(req)}
              title={req.opportunityTitle}
              className="font-medium text-[14px] text-slate-900 leading-[1.35] line-clamp-2 tracking-[-0.01em] cursor-pointer hover:text-brand-600 transition-colors"
            >
              {req.opportunityTitle}
            </h4>
            <div className="flex items-center gap-1.5 text-[12px] text-slate-500 font-normal min-w-0">
              <Building2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <span className="truncate" title={req.companyName}>
                {req.companyName}
              </span>
            </div>
          </div>

          {/* Row 3: Skill Tags */}
          {visibleSkills.length > 0 && (
            <div className="flex items-center gap-1.5 flex-nowrap overflow-hidden pt-0.5">
              {visibleSkills.map((sk) => (
                <span
                  key={sk}
                  title={sk}
                  className="px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200/70 text-slate-600 text-[11px] font-medium whitespace-nowrap truncate max-w-[120px]"
                >
                  {sk}
                </span>
              ))}
              {extraSkillCount > 0 && (
                <span
                  title={skills.slice(visibleSkills.length).join(', ')}
                  className="px-1.5 py-0.5 rounded-md bg-slate-50 border border-slate-200/70 text-slate-500 text-[11px] font-medium whitespace-nowrap flex-shrink-0"
                >
                  +{extraSkillCount}
                </span>
              )}
            </div>
          )}

          {/* Row 4: Applicants + Relative Time OR Dashed Bench Match CTA */}
          {totalApplicants > 0 ? (
            <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => handleCardTitleClick(req)}
                title={
                  activeSubs.length > 0
                    ? activeSubs.map((s) => `${s.fullName} (${s.stage})`).join(', ')
                    : singleApplicantName
                }
                className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer group"
              >
                {totalApplicants === 1 ? (
                  <>
                    <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="text-[12px] font-medium text-slate-700 group-hover:text-brand-600 truncate transition-colors">
                      {singleApplicantName}
                    </span>
                  </>
                ) : (
                  <>
                    <UsersRound className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="text-[12px] font-medium text-slate-700 group-hover:text-brand-600 truncate transition-colors">
                      {totalApplicants} applicants
                    </span>
                  </>
                )}
              </button>

              <div className="flex items-center gap-1 text-[11px] text-slate-400 flex-shrink-0 whitespace-nowrap">
                <Clock className="w-3 h-3 text-slate-400" />
                <span>{timeLabel}</span>
              </div>
            </div>
          ) : (
            <div className="pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => onOpenMatcher(req)}
                className="w-full py-2 px-3 rounded-lg border border-dashed border-indigo-200 bg-indigo-50/30 hover:bg-indigo-50/70 text-indigo-600 text-[11.5px] font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <UsersRound className="w-3.5 h-3.5 flex-shrink-0" />
                <span>No applicants yet — match from bench</span>
              </button>
            </div>
          )}
        </div>

        {/* Row 5: Flush Bottom 3-Segment Action Bar */}
        <div className={`grid ${footerColsClass} border-t border-slate-100 divide-x divide-slate-100 bg-slate-50/40 text-[11px]`}>
          <button
            type="button"
            onClick={() => onOpenMatcher(req)}
            title="Match bench consultants"
            className="py-1.5 px-1.5 flex items-center justify-center gap-1 hover:bg-indigo-50/70 text-indigo-600 font-medium transition-colors cursor-pointer whitespace-nowrap"
          >
            <UsersRound className="w-3 h-3 text-indigo-500 flex-shrink-0" />
            <span>Match</span>
          </button>

          {onUpdateReq && (
            <button
              type="button"
              onClick={() => setEditingReq({ ...req })}
              title="Edit requirement"
              className="py-1.5 px-1.5 flex items-center justify-center gap-1 text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium transition-colors cursor-pointer whitespace-nowrap"
            >
              <Pencil className="w-3 h-3 text-slate-500 flex-shrink-0" />
              <span>Edit</span>
            </button>
          )}

          {onDeleteReq && (
            <button
              type="button"
              onClick={() => setReqToDelete(req)}
              title="Delete requirement"
              className="py-1.5 px-1.5 flex items-center justify-center text-rose-500 hover:bg-rose-50/70 hover:text-rose-600 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </>
    );
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
          {displayMode === 'list' && (
            <button
              type="button"
              onClick={handleExportExcel}
              className="px-3 py-1.5 rounded-md border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center gap-1.5 bg-white shadow-2xs transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export to Excel</span>
            </button>
          )}
          <span className="px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200 font-medium text-slate-700">
            {totalReqs} {totalReqs === 1 ? 'Requisition' : 'Requisitions'}
          </span>
          {displayMode === 'kanban' && (
            <span className="hidden md:inline text-slate-400">Drag cards between columns to update stage</span>
          )}
        </div>
      </div>

      {/* Kanban Mode */}
      {displayMode === 'kanban' ? (
        <div ref={boardScrollRef} className="overflow-x-auto pb-2 -mx-1 px-1">
          <div
            style={{
              gridTemplateColumns: `repeat(${Math.max(1, stageOrder.length)}, minmax(310px, 1fr))`,
            }}
            className="grid gap-4 items-stretch"
          >
            {stageOrder.map((stage) => {
              const serverCol = useServerKanban ? kanbanColumns[stage] : undefined;
              const reqsInStage = serverCol
                ? serverCol.items
                : filteredReqs.filter((r) => r.status === stage);
              const colTotal = serverCol ? serverCol.total : reqsInStage.length;
              const colHasMore = serverCol ? serverCol.hasMore : false;
              const colLoadingMore = serverCol ? serverCol.loadingMore : false;
              const isDropTarget = Boolean(activeDrag && dragOverStage === stage);
              const isMovingIntoStage = Boolean(isDropTarget && activeDrag?.req.status !== stage);
              const meta = getStageMeta(stage);
              return (
                <div
                  key={stage}
                  ref={(el) => {
                    columnRefs.current[stage] = el;
                  }}
                  data-kanban-stage={stage}
                  className={`p-3.5 rounded-xl border flex flex-col min-h-[600px] max-h-[calc(100vh-195px)] transition-colors duration-150 ${
                    isMovingIntoStage
                      ? 'ring-2 ring-brand-500 bg-brand-50/50 border-brand-300'
                      : isDropTarget
                      ? 'border-brand-300 bg-slate-100/90'
                      : 'bg-slate-100/75 border-slate-200/80'
                  }`}
                >
                  {/* Column Header */}
                  <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-200/80 flex-shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${meta.dotClass}`} />
                      <span className="font-bold text-xs text-slate-800 tracking-tight truncate">
                        {stage}
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex-shrink-0 ${meta.pillClass}`}
                    >
                      {colTotal}
                    </span>
                  </div>

                  {/* Cards Container */}
                  <div className="space-y-3 overflow-y-auto min-h-0 flex-1 flex flex-col pr-0.5">
                    {reqsInStage.length === 0 ? (
                      <div
                        className={`flex-1 flex flex-col items-center justify-center p-5 text-center text-[11px] border border-dashed rounded-xl transition-colors ${
                          isMovingIntoStage
                            ? 'border-brand-400 bg-brand-50/80 text-brand-700 font-semibold'
                            : 'border-slate-200/90 bg-white/50 text-slate-400'
                        }`}
                      >
                        <Columns className="w-5 h-5 mb-2 text-slate-300" />
                        <p className="font-medium text-slate-500">
                          {isMovingIntoStage ? `Release to move to ${stage}` : `No requisitions in ${stage}`}
                        </p>
                        {stage === 'Requirement' && onOpenAddReq && !isMovingIntoStage && (
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
                        const isBeingDragged = activeDrag?.req.id === req.id;
                        return (
                          <div
                            key={req.id}
                            onPointerDown={(e) => handleCardPointerDown(e, req)}
                            className={`flex-shrink-0 rounded-xl border overflow-hidden select-none transition-all duration-150 ${
                              isBeingDragged
                                ? 'opacity-30 border-dashed border-brand-300 bg-brand-50/30 shadow-none pointer-events-none'
                                : 'bg-white border-slate-200/90 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:shadow-[0_4px_12px_rgba(15,23,42,0.06)] hover:border-slate-300/90 cursor-grab active:cursor-grabbing'
                            }`}
                          >
                            {renderCardBody(req)}
                          </div>
                        );
                      })
                    )}
                    {colHasMore && (
                      <button
                        type="button"
                        disabled={colLoadingMore}
                        onClick={() => handleLoadMoreStage(stage)}
                        className="w-full py-2 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-semibold text-slate-600 hover:text-brand-600 transition-colors cursor-pointer disabled:opacity-60 flex-shrink-0"
                      >
                        {colLoadingMore
                          ? 'Loading more...'
                          : `Load more (${Math.max(0, colTotal - reqsInStage.length)} remaining)`}
                      </button>
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
                <th className="py-2.5 px-4">Openings & Applicants</th>
                <th className="py-2.5 px-4">Stage</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredReqs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 px-6 text-center text-xs text-slate-400">
                    {search.trim() ? (
                      <>
                        No requirements match your search.{' '}
                        <button
                          type="button"
                          onClick={() => setSearch('')}
                          className="font-semibold text-brand-600 hover:text-brand-700 hover:underline cursor-pointer"
                        >
                          Clear Search
                        </button>
                      </>
                    ) : (
                      <>
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
                      </>
                    )}
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
                    <td className="py-3 px-4">
                      {(() => {
                        const openPos = req.openPositions || 1;
                        const filledPos = req.filledPositions ?? req.activePlacements?.length ?? 0;
                        const activeSubs = (req.submissions || []).filter((s) => s.stage !== 'Closed');
                        return (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200/70 text-[10px] font-semibold">
                                {filledPos > 0 ? `${filledPos}/${openPos} Filled` : `${openPos} Open`}
                              </span>
                              <span className="text-[10px] font-medium text-slate-500">
                                {activeSubs.length} {activeSubs.length === 1 ? 'Applicant' : 'Applicants'}
                              </span>
                            </div>
                            {activeSubs.length > 0 ? (
                              <button
                                type="button"
                                onClick={() => onSelectReq && onSelectReq(req)}
                                className="text-left text-[11px] font-semibold text-slate-800 hover:text-brand-600 truncate max-w-[200px] block cursor-pointer"
                                title={activeSubs.map((s) => `${s.fullName} (${s.stage})`).join(', ')}
                              >
                                {activeSubs.length === 1
                                  ? activeSubs[0].fullName
                                  : `${activeSubs[0].fullName} +${activeSubs.length - 1} more`}
                              </button>
                            ) : req.resourceName ? (
                              <span className="text-[11px] font-medium text-slate-700">{req.resourceName}</span>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">Unassigned</span>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap ${
                          getStageMeta(req.status).tableBadge
                        }`}
                      >
                        {req.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => onOpenMatcher(req)}
                        className="px-2 py-1 rounded bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200/70 text-[10px] font-semibold cursor-pointer transition-colors"
                      >
                        Match
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
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                const trimmed = editOpenPositions.trim();
                const parsed = Number(trimmed);
                if (!trimmed || !/^\d+$/.test(trimmed) || !Number.isInteger(parsed) || parsed < 1 || parsed > 1000) {
                  setEditOpenPosError('Please enter at least 1 open position.');
                  return;
                }
                if (onUpdateReq) onUpdateReq({ ...editingReq, openPositions: parsed });
                setEditOpenPosError('');
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

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">No. of Open Positions *</label>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    step={1}
                    value={editOpenPositions}
                    onChange={(e) => {
                      setEditOpenPositions(e.target.value);
                      if (editOpenPosError) setEditOpenPosError('');
                    }}
                    className={`w-full px-3 py-2 border rounded-lg text-xs focus:outline-none ${
                      editOpenPosError ? 'border-rose-400 focus:border-rose-500' : 'border-slate-200 focus:border-brand-600'
                    }`}
                  />
                  {editOpenPosError && (
                    <p className="text-[10px] font-semibold text-rose-600 mt-1">{editOpenPosError}</p>
                  )}
                </div>
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
      {reqToDelete && (() => {
        const activePlacedCount = reqToDelete.filledPositions ?? reqToDelete.activePlacements?.length ?? 0;
        const hasBillable = activePlacedCount > 0;
        return (
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
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${hasBillable ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-rose-50 border-rose-200 text-rose-600'}`}>
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-900">
                    {hasBillable ? 'Cannot Delete Active Requirement' : 'Delete Requirement?'}
                  </h3>
                  {hasBillable ? (
                    <p className="text-xs text-slate-600 leading-relaxed">
                      <span className="font-bold text-slate-800">{reqToDelete.code}</span> currently has{' '}
                      <span className="font-bold text-amber-700">{activePlacedCount} active billable consultant(s)</span>.
                      Please release all placed consultant(s) from <span className="font-semibold text-slate-800">Billable Consultants</span> before deleting this requirement.
                    </p>
                  ) : (
                    <>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Are you sure you want to permanently remove{' '}
                        <span className="font-bold text-slate-800">{reqToDelete.code}</span> —{' '}
                        <span className="font-semibold text-slate-800">{reqToDelete.opportunityTitle}</span> at{' '}
                        <span className="font-semibold text-slate-800">{reqToDelete.companyName}</span>?
                      </p>
                      <p className="text-[11px] text-rose-600 font-medium pt-0.5">
                        This action cannot be undone and removes linked submission records.
                      </p>
                    </>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setReqToDelete(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                >
                  {hasBillable ? 'Close' : 'Cancel'}
                </button>
                {!hasBillable && (
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
                )}
              </div>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Smooth 60fps Floating Drag Card Preview */}
      {activeDrag && (
        <ModalPortal>
          <div
            ref={floatingPreviewRef}
            style={{
              width: activeDrag.width,
              height: activeDrag.height,
              transform: `translate3d(${activeDrag.initialX}px, ${activeDrag.initialY}px, 0) rotate(1.2deg)`,
              willChange: 'transform',
            }}
            className="fixed top-0 left-0 z-[9990] pointer-events-none select-none bg-white rounded-xl border border-brand-400 shadow-2xl ring-2 ring-brand-500/20 overflow-hidden opacity-95"
          >
            {renderCardBody(activeDrag.req)}
          </div>
        </ModalPortal>
      )}
    </div>
  );
};
