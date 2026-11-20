import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  DropAnimation,
  KeyboardSensor,
  PointerSensor,
  CollisionDetection,
  closestCenter,
  defaultDropAnimationSideEffects,
  getFirstCollision,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Building2,
  Clock,
  Columns,
  FileSpreadsheet,
  List,
  Lock,
  Pencil,
  Plus,
  Search,
  Trash2,
  UsersRound,
  X,
} from 'lucide-react';
import { AiIcon, AiTag } from '../../components/shared/AiBrand';
import { apiClient } from '../../config/api.config';
import { Requirement, Candidate } from '../../types';
import { SortableTableHeader } from '../../components/shared/SortableTableHeader';
import { TablePagination } from '../../components/shared/TablePagination';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { ActionButton } from '../../components/shared/ActionButton';
import { CustomSelect } from '../../components/shared/CustomSelect';
import { RoleSummaryField } from '../../components/shared/RichTextEditor';
import { buildClientSafeSummaryHtml } from '../../utils/richText';
import { ModalPortal } from '../../components/shared/ModalPortal';
import { AnimatedModal } from '../../components/shared/MotionPrimitives';
import { SkillTagInput } from '../../components/shared/SkillTagInput';
import { useDebounce } from '../../utils/useDebounce';
import { mapRequirementFromApi } from '../../utils/entityMappers';
import { useCurrency } from '../../utils/currency';
import { getStageStyle } from '../../utils/stageStyles';
import { sortArrayByColumn, useTableSort } from '../../utils/tableSort';
import { getWorkspaceBrandSlug, useAiCapabilities } from '../../utils/workspaceBrand';
import { useMasterTaxonomies } from '../../components/shared/DynamicCustomFieldsSection';

type KanbanColumnState = {
  items: Requirement[];
  total: number;
  page: number;
  hasMore: boolean;
  loadingMore: boolean;
};

const kanbanDropAnimation: DropAnimation = {
  duration: 220,
  easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
  sideEffects: defaultDropAnimationSideEffects({
    styles: {
      active: {
        opacity: '0.35',
      },
    },
  }),
};

function loadSavedStageOrder(storageKey: string): Record<string, string[]> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const normalized: Record<string, string[]> = {};
    for (const [stage, ids] of Object.entries(parsed as Record<string, unknown>)) {
      if (Array.isArray(ids)) {
        normalized[stage] = ids.map((id) => String(id));
      }
    }
    return normalized;
  } catch {
    return {};
  }
}

function saveStageOrder(storageKey: string, orderMap: Record<string, string[]>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(orderMap));
  } catch {
    // Ignore storage quota errors
  }
}

function applyStageOrderToItems(
  stage: string,
  items: Requirement[],
  orderMap: Record<string, string[]>
): Requirement[] {
  const savedIds = orderMap[stage];
  if (!savedIds || savedIds.length === 0 || items.length <= 1) return items;
  const orderIndex = new Map<string, number>();
  savedIds.forEach((id, idx) => orderIndex.set(id, idx));

  const newItems: Requirement[] = [];
  const orderedExisting: Array<{ req: Requirement; pos: number }> = [];
  for (const item of items) {
    const pos = orderIndex.get(item.id);
    if (pos === undefined) {
      newItems.push(item);
    } else {
      orderedExisting.push({ req: item, pos });
    }
  }
  orderedExisting.sort((a, b) => a.pos - b.pos);
  return [...newItems, ...orderedExisting.map((entry) => entry.req)];
}

interface DroppableKanbanColumnProps {
  stage: string;
  itemIds: string[];
  dotClass: string;
  totalCount: number;
  totalOpenings: number;
  isDropTarget: boolean;
  isMovingIntoStage: boolean;
  children: React.ReactNode;
}

const DroppableKanbanColumn: React.FC<DroppableKanbanColumnProps> = ({
  stage,
  itemIds,
  dotClass,
  totalCount,
  totalOpenings,
  isDropTarget,
  isMovingIntoStage,
  children,
}) => {
  const { setNodeRef } = useDroppable({ id: stage });

  return (
    <div
      ref={setNodeRef}
      data-kanban-stage={stage}
      className={`p-3 rounded-xl border flex flex-col min-h-[560px] max-h-[calc(100vh-195px)] transition-all duration-200 ${isMovingIntoStage
        ? 'bg-brand-50/45 border-brand-300 ring-2 ring-brand-500/15'
        : isDropTarget
          ? 'border-slate-300 bg-slate-100/95'
          : 'bg-slate-100/70 border-slate-200/80'
        }`}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between gap-2 px-0.5 pb-2.5 mb-2.5 border-b border-slate-200/80 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotClass}`} />
          <span className="font-bold text-xs text-slate-800 tracking-tight truncate">
            {stage}
          </span>
          <span className="px-1.5 py-0.5 rounded-md text-[11px] font-bold bg-white border border-slate-200/90 text-slate-700 flex-shrink-0 tabular-nums">
            {totalCount}
          </span>
        </div>
        {totalOpenings > 0 && (
          <span className="text-[11px] font-medium text-slate-400 tabular-nums whitespace-nowrap flex-shrink-0">
            {totalOpenings} {totalOpenings === 1 ? 'opening' : 'openings'}
          </span>
        )}
      </div>

      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-2.5 overflow-y-auto overflow-x-hidden min-h-0 flex-1 flex flex-col pr-0.5 custom-scrollbar">
          {children}
        </div>
      </SortableContext>
    </div>
  );
};

interface SortableKanbanCardProps {
  req: Requirement;
  children: React.ReactNode;
}

const SortableKanbanCard: React.FC<SortableKanbanCardProps> = ({ req, children }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: req.id,
    data: { req, stage: req.status },
    transition: {
      duration: 210,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
    },
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`group/card flex-shrink-0 rounded-xl border overflow-hidden select-none touch-none transition-all duration-150 ${isDragging
        ? 'opacity-35 border-dashed border-brand-400 bg-brand-50/40 shadow-none ring-1 ring-brand-300/60'
        : 'bg-white border-slate-200/90 card-shadow card-hover cursor-grab active:cursor-grabbing'
        }`}
    >
      {children}
    </div>
  );
};

interface PipelineViewProps {
  requirements: Requirement[];
  candidates: Candidate[];
  rateMasked?: boolean;
  onStatusChange: (req: Requirement, newStatus: any) => void;
  onOpenEmailParser: () => void;
  onOpenMatcher: (req: Requirement) => void;
  onOpenPlacementWizard: (req: Requirement) => void;
  onSelectReq?: (req: Requirement) => void;
  onOpenAddReq?: () => void;
  onEditReq?: (req: Requirement) => void;
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
  onOpenPlacementWizard,
  onSelectReq,
  onOpenAddReq,
  onEditReq,
  onUpdateReq,
  onDeleteReq,
}) => {
  const { symbol: currencySymbol } = useCurrency();
  const aiCapabilities = useAiCapabilities();
  const [displayMode, setDisplayMode] = useState<'kanban' | 'list'>('kanban');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const tableSort = useTableSort<'title' | 'companyName' | 'applicants' | 'status'>();
  const [serverReqs, setServerReqs] = useState<Requirement[]>(requirements);
  const [totalReqs, setTotalReqs] = useState(requirements.length);
  const [isLoadingReqs, setIsLoadingReqs] = useState(false);
  const KANBAN_PAGE_SIZE = 25;
  const [kanbanColumns, setKanbanColumns] = useState<Record<string, KanbanColumnState>>({});
  const [useServerKanban, setUseServerKanban] = useState(false);
  const [activeDragReq, setActiveDragReq] = useState<Requirement | null>(null);
  const [activeDragWidth, setActiveDragWidth] = useState<number | null>(null);
  const [dragOverStage, setDragOverStage] = useState<Requirement['status'] | null>(null);
  const [editingReq, setEditingReq] = useState<Requirement | null>(null);
  const [editOpenPositions, setEditOpenPositions] = useState<string>('1');
  const [editOpenPosError, setEditOpenPosError] = useState<string>('');
  const [reqToDelete, setReqToDelete] = useState<Requirement | null>(null);
  const [isUpdatingReq, setIsUpdatingReq] = useState(false);
  const [isDeletingReq, setIsDeletingReq] = useState(false);

  useEffect(() => {
    if (editingReq) {
      setEditOpenPositions(String(editingReq.openPositions || 1));
      setEditOpenPosError('');
    }
  }, [editingReq?.id]);

  const orderStorageKey = `squadpipe_kanban_order_${getWorkspaceBrandSlug()}`;
  const [stageOrderMap, setStageOrderMap] = useState<Record<string, string[]>>(() =>
    loadSavedStageOrder(orderStorageKey)
  );
  const stageOrderMapRef = useRef<Record<string, string[]>>(stageOrderMap);
  useEffect(() => {
    stageOrderMapRef.current = stageOrderMap;
  }, [stageOrderMap]);

  const suppressClickRef = useRef(false);
  const lastOverIdRef = useRef<string | null>(null);
  const dragOriginRef = useRef<{
    req: Requirement;
    originStage: string;
    snapshotColumns: Record<string, KanbanColumnState>;
    snapshotReqs: Requirement[];
  } | null>(null);
  const pendingStageMapRef = useRef<Map<string, { stage: Requirement['status']; until: number }>>(new Map());

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
  }, [debouncedSearch, displayMode, tableSort.sort.sortBy, tableSort.sort.sortDir]);

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
          if (!active || dragOriginRef.current) return;
          if (res.data?.success && res.data.data?.columns) {
            const nextCols: Record<
              string,
              { items: Requirement[]; total: number; page: number; hasMore: boolean; loadingMore: boolean }
            > = {};
            const flatItems: Requirement[] = [];
            for (const col of res.data.data.columns) {
              const mappedItems = applyStageOrderToItems(
                col.stage,
                applyPendingStages((col.items || []).map(mapRequirementFromApi)),
                stageOrderMapRef.current
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
      ...tableSort.sortParams,
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
        const fallbackFiltered = applyPendingStages(requirements).filter(
          (r) =>
            !q ||
            r.opportunityTitle.toLowerCase().includes(q) ||
            r.companyName.toLowerCase().includes(q) ||
            r.skillsRequired.toLowerCase().includes(q)
        );
        const fallback = sortArrayByColumn(fallbackFiltered, tableSort.sort, {
          title: (r) => r.opportunityTitle,
          companyName: (r) => r.companyName,
          applicants: (r) => r.submissionCount ?? r.submissions?.length ?? 0,
          status: (r) => r.status,
        });
        setTotalReqs(fallback.length);
        setServerReqs(fallback.slice((page - 1) * limit, page * limit));
      })
      .finally(() => {
        if (active) setIsLoadingReqs(false);
      });

    return () => {
      active = false;
    };
  }, [
    debouncedSearch,
    displayMode,
    page,
    limit,
    requirements,
    taxonomies.stages,
    applyPendingStages,
    tableSort.sort.sortBy,
    tableSort.sort.sortDir,
    tableSort.sortParams,
  ]);

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
            const mergedRaw = [...current.items, ...nextItems.filter((i) => !existingIds.has(i.id))];
            const merged = applyStageOrderToItems(stage, mergedRaw, stageOrderMapRef.current);
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

  const getStageMeta = (stage: string) => {
    const idx = Math.max(0, stageOrder.indexOf(stage));
    const style = getStageStyle(stage, idx);
    return {
      dotClass: style.dot,
      pillClass: style.badge,
      tableBadge: style.badge,
    };
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

  const getItemsForStage = useCallback(
    (stage: string): Requirement[] => {
      if (useServerKanban && kanbanColumns[stage]) {
        return kanbanColumns[stage].items;
      }
      return applyStageOrderToItems(
        stage,
        serverReqs.filter((r) => r.status === stage),
        stageOrderMapRef.current
      );
    },
    [useServerKanban, kanbanColumns, serverReqs]
  );

  const findStageContainer = useCallback(
    (id: string): string | null => {
      if (stageOrder.includes(id)) return id;
      for (const st of stageOrder) {
        if (getItemsForStage(st).some((r) => r.id === id)) {
          return st;
        }
      }
      return null;
    },
    [stageOrder, getItemsForStage]
  );

  const collisionDetectionStrategy: CollisionDetection = useCallback(
    (args) => {
      const pointerIntersections = pointerWithin(args);
      const intersections =
        pointerIntersections.length > 0 ? pointerIntersections : rectIntersection(args);
      let overId = getFirstCollision(intersections, 'id');

      if (overId != null) {
        const overKey = String(overId);
        if (stageOrder.includes(overKey)) {
          const colItems = getItemsForStage(overKey);
          if (colItems.length > 0) {
            const colItemIds = new Set(colItems.map((r) => r.id));
            const closest = closestCenter({
              ...args,
              droppableContainers: args.droppableContainers.filter((c) =>
                colItemIds.has(String(c.id))
              ),
            });
            overId = closest[0]?.id ?? overId;
          }
        }
        lastOverIdRef.current = String(overId);
        return [{ id: overId }];
      }

      return lastOverIdRef.current ? [{ id: lastOverIdRef.current }] : [];
    },
    [stageOrder, getItemsForStage]
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const activeId = String(event.active.id);
      const req =
        (event.active.data.current?.req as Requirement | undefined) ||
        serverReqs.find((r) => r.id === activeId);
      if (!req) return;

      suppressClickRef.current = true;
      lastOverIdRef.current = activeId;
      dragOriginRef.current = {
        req,
        originStage: req.status,
        snapshotColumns: kanbanColumns,
        snapshotReqs: serverReqs,
      };
      setActiveDragReq(req);
      setActiveDragWidth(event.active.rect.current.initial?.width ?? null);
      setDragOverStage(req.status);
    },
    [kanbanColumns, serverReqs]
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over) return;
      const activeId = String(active.id);
      const overId = String(over.id);
      if (activeId === overId) return;

      const activeContainer = findStageContainer(activeId);
      const overContainer = findStageContainer(overId);
      if (!activeContainer || !overContainer) return;

      setDragOverStage(overContainer);
      if (activeContainer === overContainer) return;

      const fromItems = getItemsForStage(activeContainer);
      const overItems = getItemsForStage(overContainer);
      const movingCard = fromItems.find((r) => r.id === activeId);
      if (!movingCard) return;

      const updatedCard: Requirement = { ...movingCard, status: overContainer };
      const overIndex = overItems.findIndex((r) => r.id === overId);

      let newIndex: number;
      if (stageOrder.includes(overId)) {
        newIndex = overItems.length;
      } else {
        const activeTranslated = active.rect.current.translated;
        const isBelowOverItem = Boolean(
          activeTranslated && activeTranslated.top > over.rect.top + over.rect.height / 2
        );
        const modifier = isBelowOverItem ? 1 : 0;
        newIndex = overIndex >= 0 ? overIndex + modifier : overItems.length;
      }
      newIndex = Math.max(0, Math.min(overItems.length, newIndex));

      const nextFromItems = fromItems.filter((r) => r.id !== activeId);
      const nextOverItems = [
        ...overItems.slice(0, newIndex),
        updatedCard,
        ...overItems.slice(newIndex),
      ];

      setKanbanColumns((prev) => {
        if (!prev[activeContainer] && !prev[overContainer]) return prev;
        const next = { ...prev };
        if (next[activeContainer]) {
          next[activeContainer] = {
            ...next[activeContainer],
            items: nextFromItems,
            total: Math.max(0, next[activeContainer].total - 1),
          };
        }
        if (next[overContainer]) {
          next[overContainer] = {
            ...next[overContainer],
            items: nextOverItems,
            total: next[overContainer].total + 1,
          };
        }
        return next;
      });

      setServerReqs((prev) => {
        const without = prev.filter((r) => r.id !== activeId);
        const stageSubset = nextOverItems;
        const nextAnchorId = stageSubset[newIndex + 1]?.id;
        if (nextAnchorId) {
          const anchorIdx = without.findIndex((r) => r.id === nextAnchorId);
          if (anchorIdx !== -1) {
            return [...without.slice(0, anchorIdx), updatedCard, ...without.slice(anchorIdx)];
          }
        }
        return [...without, updatedCard];
      });
    },
    [findStageContainer, getItemsForStage, stageOrder]
  );

  const handleDragCancel = useCallback(() => {
    const origin = dragOriginRef.current;
    if (origin) {
      setKanbanColumns(origin.snapshotColumns);
      setServerReqs(origin.snapshotReqs);
    }
    dragOriginRef.current = null;
    lastOverIdRef.current = null;
    setActiveDragReq(null);
    setActiveDragWidth(null);
    setDragOverStage(null);
    setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const origin = dragOriginRef.current;
      dragOriginRef.current = null;
      lastOverIdRef.current = null;
      setActiveDragReq(null);
      setActiveDragWidth(null);
      setDragOverStage(null);
      setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);

      if (!origin) return;

      const { active, over } = event;
      if (!over) {
        setKanbanColumns(origin.snapshotColumns);
        setServerReqs(origin.snapshotReqs);
        return;
      }

      const activeId = String(active.id);
      const overId = String(over.id);
      const currentContainer = findStageContainer(activeId);
      const overContainer = findStageContainer(overId) ?? currentContainer;

      if (!currentContainer || !overContainer) {
        setKanbanColumns(origin.snapshotColumns);
        setServerReqs(origin.snapshotReqs);
        return;
      }

      const itemsInTarget = getItemsForStage(overContainer);
      const activeIdx = itemsInTarget.findIndex((r) => r.id === activeId);
      const overIdx = itemsInTarget.findIndex((r) => r.id === overId);

      let finalTargetItems = itemsInTarget;
      if (activeIdx !== -1 && overIdx !== -1 && activeIdx !== overIdx) {
        finalTargetItems = arrayMove(itemsInTarget, activeIdx, overIdx);
        setKanbanColumns((prev) =>
          prev[overContainer]
            ? {
              ...prev,
              [overContainer]: {
                ...prev[overContainer],
                items: finalTargetItems,
              },
            }
            : prev
        );
        setServerReqs((prev) => {
          const withoutStage = prev.filter((r) => r.status !== overContainer);
          return [...withoutStage, ...finalTargetItems];
        });
      }

      const originStageItems =
        origin.originStage === overContainer
          ? finalTargetItems
          : getItemsForStage(origin.originStage).filter((r) => r.id !== activeId);

      const nextOrderMap: Record<string, string[]> = {
        ...stageOrderMapRef.current,
        [origin.originStage]: originStageItems.map((r) => r.id),
        [overContainer]: finalTargetItems.map((r) => r.id),
      };
      stageOrderMapRef.current = nextOrderMap;
      setStageOrderMap(nextOrderMap);
      saveStageOrder(orderStorageKey, nextOrderMap);

      if (overContainer !== origin.originStage) {
        pendingStageMapRef.current.set(origin.req.id, {
          stage: overContainer as Requirement['status'],
          until: Date.now() + 3000,
        });
        onStatusChange(origin.req, overContainer as Requirement['status']);
      }
    },
    [findStageContainer, getItemsForStage, onStatusChange, orderStorageKey]
  );

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

  const avatarPalette = ['bg-[#141615]', 'bg-brand-600', 'bg-slate-600'];

  const renderCardBody = (req: Requirement) => {
    const meta = getStageMeta(req.status);
    const skills = getSkillsList(req.skillsRequired);
    // Show 2 wider skill chips if the first two skills are long, otherwise up to 3
    const firstTwoLen = (skills[0]?.length || 0) + (skills[1]?.length || 0);
    const maxVisibleSkills = firstTwoLen > 18 ? 2 : 3;
    const visibleSkills = skills.slice(0, maxVisibleSkills);
    const extraSkillCount = Math.max(0, skills.length - visibleSkills.length);

    const activeSubs = (req.submissions || []).filter((s) => s.stage !== 'Closed');
    const totalApplicants =
      activeSubs.length > 0 ? activeSubs.length : (req.submissionCount ?? (req.resourceName ? 1 : 0));
    const singleApplicantName = activeSubs[0]?.fullName || req.resourceName || 'Applicant';
    const previewNames =
      activeSubs.length > 0
        ? activeSubs.slice(0, 3).map((s) => s.fullName)
        : req.resourceName
          ? [req.resourceName]
          : [];
    const timeLabel = formatRelativeTime(req.createdAt);
    const openPos = Math.max(1, Number(req.openPositions) || 1);
    const filledPos = req.filledPositions ?? req.activePlacements?.length ?? 0;
    const workModeTag = req.workModel || (req.location?.toLowerCase().includes('remote') ? 'Remote' : '');

    return (
      <div className="p-3.5 space-y-2.5">
        {/* Row 1: Stage Dot + Req Code + Openings Pill & Bill Rate */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <button
              type="button"
              data-allow-drag="true"
              onClick={() => handleCardTitleClick(req)}
              className="inline-flex items-center gap-1.5 text-[11px] font-mono font-semibold text-slate-500 hover:text-brand-600 transition-colors cursor-pointer"
            >
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${meta.dotClass}`} />
              <span>{req.code}</span>
            </button>

            <span
              className={`px-1.5 py-0.5 rounded text-[11px] font-semibold tabular-nums whitespace-nowrap ${filledPos >= openPos
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/70'
                : filledPos > 0
                  ? 'bg-brand-50 text-brand-700 border border-brand-200/70'
                  : 'bg-slate-100 text-slate-600'
                }`}
            >
              {filledPos > 0 ? `${filledPos}/${openPos} Filled` : `${openPos} Open`}
            </span>
          </div>

          {!rateMasked && Boolean(req.targetBillRate) && (
            <span className="tabular-nums whitespace-nowrap bg-slate-50 border border-slate-200/80 px-1.5 py-0.5 rounded-md">
              <span className="text-[12px] font-bold font-mono text-slate-800">
                {currencySymbol}
                {req.targetBillRate}
              </span>
              <span className="text-[11px] font-normal text-slate-400">/hr</span>
            </span>
          )}
        </div>

        {/* Row 2: Role Title & Client Company + Work Model */}
        <div className="space-y-1">
          <h4
            onClick={() => handleCardTitleClick(req)}
            title={req.opportunityTitle}
            className="font-semibold text-sm text-slate-900 leading-[1.35] line-clamp-2 tracking-tight cursor-pointer hover:text-brand-600 transition-colors"
          >
            {req.opportunityTitle}
          </h4>
          <div className="flex items-center gap-1.5 text-[12px] text-slate-500 min-w-0">
            <Building2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <span className="truncate font-medium text-slate-600" title={req.companyName}>
              {req.companyName}
            </span>
            {workModeTag && (
              <>
                <span className="text-slate-300 flex-shrink-0">&middot;</span>
                <span className="text-[11px] text-slate-400 flex-shrink-0">{workModeTag}</span>
              </>
            )}
          </div>
        </div>

        {/* Row 3: Readable Skill Tags */}
        {visibleSkills.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap pt-0.5">
            {visibleSkills.map((sk) => (
              <span
                key={sk}
                title={sk}
                className="px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200/80 text-slate-600 text-[11px] font-medium whitespace-nowrap truncate max-w-[145px]"
              >
                {sk}
              </span>
            ))}
            {extraSkillCount > 0 && (
              <span
                title={skills.slice(visibleSkills.length).join(', ')}
                className="px-1.5 py-0.5 rounded-md bg-slate-100/80 text-slate-500 text-[11px] font-semibold whitespace-nowrap flex-shrink-0"
              >
                +{extraSkillCount}
              </span>
            )}
          </div>
        )}

        {/* Row 4: Unified Footer — Applicants + Hover Edit/Delete + Match Pill */}
        <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-1.5">
          <button
            type="button"
            onClick={() => handleCardTitleClick(req)}
            title={
              activeSubs.length > 0
                ? activeSubs.map((s) => `${s.fullName} (${s.stage})`).join(', ')
                : totalApplicants > 0
                  ? singleApplicantName
                  : `Posted ${timeLabel}`
            }
            className="flex items-center gap-1.5 min-w-0 flex-1 text-left cursor-pointer group/app"
          >
            {totalApplicants > 0 ? (
              <>
                {previewNames.length > 0 ? (
                  <div className="flex items-center -space-x-1.5 flex-shrink-0">
                    {previewNames.map((name, idx) => (
                      <span
                        key={`${name}_${idx}`}
                        className={`w-5 h-5 rounded-full text-[11px] font-bold text-white flex items-center justify-center ring-2 ring-white ${avatarPalette[idx % avatarPalette.length]
                          }`}
                      >
                        {previewNames.length === 1 ? getTwoInitials(name) : getSingleInitial(name)}
                      </span>
                    ))}
                  </div>
                ) : (
                  <UsersRound className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                )}
                <span className="text-[12px] font-medium text-slate-700 group-hover/app:text-brand-600 truncate transition-colors">
                  {totalApplicants === 1 && previewNames.length === 1
                    ? singleApplicantName
                    : `${totalApplicants} applicants`}
                </span>
              </>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                <Clock className="w-3 h-3 text-slate-300 flex-shrink-0" />
                <span>{timeLabel}</span>
              </span>
            )}
          </button>

          <div
            onPointerDown={(e) => e.stopPropagation()}
            className="flex items-center gap-1 flex-shrink-0"
          >
            {(onEditReq || onUpdateReq) && (
              <button
                type="button"
                onClick={() => {
                  if (onEditReq) {
                    onEditReq(req);
                    return;
                  }
                  setEditingReq({ ...req });
                }}
                title="Edit requirement"
                aria-label="Edit requirement"
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 opacity-0 group-hover/card:opacity-100 focus:opacity-100 transition-all cursor-pointer"
              >
                <Pencil className="w-3 h-3" />
              </button>
            )}
            {onDeleteReq && (
              <button
                type="button"
                onClick={() => setReqToDelete(req)}
                title={
                  filledPos > 0
                    ? `Protected: ${filledPos} active billable consultant(s) attached`
                    : 'Delete requirement'
                }
                aria-label={
                  filledPos > 0
                    ? `Protected: ${filledPos} active billable consultant(s) attached`
                    : 'Delete requirement'
                }
                className={`p-1 rounded-md opacity-0 group-hover/card:opacity-100 focus:opacity-100 transition-all cursor-pointer ${filledPos > 0
                  ? 'text-amber-500 hover:text-amber-700 hover:bg-amber-50'
                  : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                  }`}
              >
                {filledPos > 0 ? <Lock className="w-3 h-3" /> : <Trash2 className="w-3 h-3" />}
              </button>
            )}
            <button
              type="button"
              onClick={() => onOpenMatcher(req)}
              title="Match bench consultants"
              className="px-2 py-1 rounded-md border border-slate-200 bg-white hover:border-brand-300 hover:bg-brand-50/40 text-slate-700 hover:text-brand-700 text-[11px] font-semibold inline-flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap"
            >
              <UsersRound className="w-3 h-3 flex-shrink-0" />
              <span>Match</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header matching Prototype */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">Pipeline</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Track open job requirements and candidate submissions across stages.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenEmailParser}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-medium hover:bg-slate-50 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <AiIcon className="w-3.5 h-3.5 text-teal-600 shrink-0" />
            <span>Parse Email</span>
            {aiCapabilities.enabled && <AiTag />}
          </button>
          {onOpenAddReq && (
            <button
              onClick={onOpenAddReq}
              className="px-3.5 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-medium hover:bg-brand-700 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={1.75} />
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
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${displayMode === 'kanban'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
                }`}
            >
              <Columns className="w-3.5 h-3.5" />
              <span>Kanban</span>
            </button>
            <button
              onClick={() => setDisplayMode('list')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${displayMode === 'list'
                ? 'bg-white text-slate-900 shadow-sm'
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
              className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center gap-1.5 bg-white transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export to Excel</span>
            </button>
          )}
          <span className="text-xs font-medium text-slate-500 tabular-nums px-1">
            {totalReqs} {totalReqs === 1 ? 'requisition' : 'requisitions'}
          </span>
          {displayMode === 'kanban' && (
            <span className="hidden md:inline text-slate-400">Drag cards between columns to update stage</span>
          )}
        </div>
      </div>

      {/* Kanban Mode */}
      {displayMode === 'kanban' ? (
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetectionStrategy}
          autoScroll={{ threshold: { x: 0.12, y: 0.15 }, acceleration: 12 }}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div className="overflow-x-auto pb-2 -mx-1 px-1 custom-scrollbar">
            <div
              style={{
                gridTemplateColumns: `repeat(${Math.max(1, stageOrder.length)}, minmax(310px, 1fr))`,
              }}
              className="grid gap-4 items-stretch"
            >
              {stageOrder.map((stage) => {
                const serverCol = useServerKanban ? kanbanColumns[stage] : undefined;
                const reqsInStage = getItemsForStage(stage);
                const colTotal = serverCol ? serverCol.total : reqsInStage.length;
                const colHasMore = serverCol ? serverCol.hasMore : false;
                const colLoadingMore = serverCol ? serverCol.loadingMore : false;
                const isDropTarget = Boolean(activeDragReq && dragOverStage === stage);
                const isMovingIntoStage = Boolean(
                  isDropTarget && dragOriginRef.current?.originStage !== stage
                );
                const meta = getStageMeta(stage);
                const stageOpenings = reqsInStage.reduce(
                  (sum, r) => sum + Math.max(1, Number(r.openPositions) || 1),
                  0
                );

                return (
                  <DroppableKanbanColumn
                    key={stage}
                    stage={stage}
                    itemIds={reqsInStage.map((r) => r.id)}
                    dotClass={meta.dotClass}
                    totalCount={colTotal}
                    totalOpenings={stageOpenings}
                    isDropTarget={isDropTarget}
                    isMovingIntoStage={isMovingIntoStage}
                  >
                    {reqsInStage.length === 0 ? (
                      <div
                        className={`h-32 flex flex-col items-center justify-center p-4 text-center text-[11px] rounded-xl transition-all ${isMovingIntoStage
                          ? 'bg-brand-50/70 text-brand-700 font-semibold border-2 border-dashed border-brand-300 shadow-sm'
                          : 'border border-dashed border-slate-200/90 bg-white/55 text-slate-400'
                          }`}
                      >
                        <Columns className="w-4 h-4 mb-1.5 text-slate-300" />
                        <p className="font-medium text-slate-500">
                          {isMovingIntoStage
                            ? `Release to move to ${stage}`
                            : `No requisitions in ${stage}`}
                        </p>
                        {stage === 'Requirement' && onOpenAddReq && !isMovingIntoStage && (
                          <button
                            type="button"
                            onClick={onOpenAddReq}
                            className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-600 hover:text-brand-600 hover:border-brand-200 text-[11px] font-semibold transition-colors cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Add Requirement</span>
                          </button>
                        )}
                      </div>
                    ) : (
                      reqsInStage.map((req) => (
                        <SortableKanbanCard key={req.id} req={req}>
                          {renderCardBody(req)}
                        </SortableKanbanCard>
                      ))
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
                  </DroppableKanbanColumn>
                );
              })}
            </div>
          </div>

          <ModalPortal>
            <DragOverlay dropAnimation={kanbanDropAnimation} zIndex={9990}>
              {activeDragReq ? (
                <motion.div
                  initial={{ scale: 1, rotate: 0 }}
                  animate={{ scale: 1.025, rotate: 1.25 }}
                  transition={{ type: 'spring', stiffness: 460, damping: 30 }}
                  style={{ width: activeDragWidth ?? undefined }}
                  className="pointer-events-none select-none bg-white rounded-xl border border-brand-300/80 ring-2 ring-brand-500/20 shadow-2xl overflow-hidden"
                >
                  {renderCardBody(activeDragReq)}
                </motion.div>
              ) : null}
            </DragOverlay>
          </ModalPortal>
        </DndContext>
      ) : (
        /* List Mode */
        <div className="bg-white rounded-xl border border-slate-200 card-shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-[11px] uppercase font-bold text-slate-400">
                  <SortableTableHeader
                    label="Code &amp; Role"
                    column="title"
                    sort={tableSort.sort}
                    onSort={tableSort.handleSort}
                    defaultDir="asc"
                    className="py-2.5 px-4"
                  />
                  <SortableTableHeader
                    label="Client Company"
                    column="companyName"
                    sort={tableSort.sort}
                    onSort={tableSort.handleSort}
                    defaultDir="asc"
                    className="py-2.5 px-4"
                  />
                  <th className="py-2.5 px-4">Required Skills</th>
                  <SortableTableHeader
                    label="Openings &amp; Applicants"
                    column="applicants"
                    sort={tableSort.sort}
                    onSort={tableSort.handleSort}
                    defaultDir="desc"
                    className="py-2.5 px-4"
                  />
                  <SortableTableHeader
                    label="Stage"
                    column="status"
                    sort={tableSort.sort}
                    onSort={tableSort.handleSort}
                    defaultDir="asc"
                    className="py-2.5 px-4"
                  />
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
                        <div className="text-[11px] text-slate-400 font-medium mt-0.5">
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
                                <span
                                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium ${filledPos >= openPos
                                    ? 'bg-emerald-500/[0.08] text-emerald-800'
                                    : 'bg-slate-100 text-slate-700'
                                    }`}
                                >
                                  {filledPos > 0 ? `${filledPos}/${openPos} Filled` : `${openPos} Open`}
                                </span>
                                <span className="text-[11px] font-medium text-slate-500">
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
                        <StatusBadge stage={req.status} size="xs" />
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => onOpenMatcher(req)}
                          className="px-2.5 py-1 rounded bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-[11px] font-semibold cursor-pointer transition-colors"
                        >
                          Match
                        </button>
                        {(onEditReq || onUpdateReq) && (
                          <button
                            onClick={() => {
                              if (onEditReq) {
                                onEditReq(req);
                                return;
                              }
                              setEditingReq({ ...req });
                            }}
                            title="Edit requirement"
                            className="ml-1.5 p-1 text-slate-400 hover:text-brand-600 rounded hover:bg-brand-50 transition-colors cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {onDeleteReq && (() => {
                          const rowFilledPos = req.filledPositions ?? req.activePlacements?.length ?? 0;
                          return (
                            <button
                              onClick={() => setReqToDelete(req)}
                              title={
                                rowFilledPos > 0
                                  ? `Protected: ${rowFilledPos} active billable consultant(s) attached`
                                  : 'Delete requirement'
                              }
                              className={`ml-1 p-1 rounded transition-colors cursor-pointer ${rowFilledPos > 0
                                ? 'text-amber-500 hover:text-amber-700 hover:bg-amber-50'
                                : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                                }`}
                            >
                              {rowFilledPos > 0 ? (
                                <Lock className="w-3.5 h-3.5" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                          );
                        })()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
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
      <AnimatedModal
        isOpen={Boolean(editingReq)}
        onBackdropClick={() => setEditingReq(null)}
        zIndexClass="z-50"
        panelClassName="bg-white rounded-xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {editingReq && (
          <>
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
              onSubmit={async (e) => {
                e.preventDefault();
                if (isUpdatingReq) return;
                const trimmed = editOpenPositions.trim();
                const parsed = Number(trimmed);
                if (!trimmed || !/^\d+$/.test(trimmed) || !Number.isInteger(parsed) || parsed < 1 || parsed > 1000) {
                  setEditOpenPosError('Please enter at least 1 open position.');
                  return;
                }
                setIsUpdatingReq(true);
                try {
                  if (onUpdateReq) await onUpdateReq({ ...editingReq, openPositions: parsed });
                  setEditOpenPosError('');
                  setEditingReq(null);
                } catch {
                  // Error toast is already displayed by parent handler; keep modal open
                } finally {
                  setIsUpdatingReq(false);
                }
              }}
              className="p-6 space-y-3.5 text-xs overflow-y-auto"
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
                    className={`w-full px-3 py-2 border rounded-lg text-xs focus:outline-none ${editOpenPosError ? 'border-rose-400 focus:border-rose-500' : 'border-slate-200 focus:border-brand-600'
                      }`}
                  />
                  {editOpenPosError && (
                    <p className="text-[11px] font-semibold text-rose-600 mt-1">{editOpenPosError}</p>
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
                  <CustomSelect
                    value={editingReq.status}
                    onChange={(val) =>
                      setEditingReq({ ...editingReq, status: val as Requirement['status'] })
                    }
                    ariaLabel="Stage"
                    options={stageOrder}
                  />
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
                <SkillTagInput
                  value={editingReq.skillsRequired}
                  onChange={(nextCsv) => setEditingReq({ ...editingReq, skillsRequired: nextCsv })}
                />
              </div>

              <RoleSummaryField
                label="Role Scope & Public Summary"
                value={editingReq.publicDescription || ''}
                onChange={(nextHtml) =>
                  setEditingReq({ ...editingReq, publicDescription: nextHtml })
                }
                onAutoFill={() =>
                  setEditingReq({
                    ...editingReq,
                    publicDescription: buildClientSafeSummaryHtml({
                      opportunityTitle: editingReq.opportunityTitle,
                      openPositions: Number(editOpenPositions) || editingReq.openPositions || 1,
                      workModel: editingReq.workModel,
                      location: editingReq.location,
                      skillsRequired: editingReq.skillsRequired,
                      companyName: editingReq.companyName,
                      rawEmailText: editingReq.rawEmailText,
                    }),
                  })
                }
                minHeight={105}
                maxHeight={240}
              />

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={isUpdatingReq}
                  onClick={() => setEditingReq(null)}
                  className="px-3.5 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
                >
                  Cancel
                </button>
                <ActionButton
                  type="submit"
                  loading={isUpdatingReq}
                  loadingText="Saving..."
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Save Changes
                </ActionButton>
              </div>
            </form>
          </>
        )}
      </AnimatedModal>

      {/* Delete Requisition Confirmation Modal */}
      <AnimatedModal
        isOpen={Boolean(reqToDelete)}
        onBackdropClick={() => setReqToDelete(null)}
        zIndexClass="z-50"
        panelClassName="bg-white rounded-xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden"
      >
        {reqToDelete && (() => {
          const activePlacedCount = reqToDelete.filledPositions ?? reqToDelete.activePlacements?.length ?? 0;
          const hasBillable = activePlacedCount > 0;
          const activePlacementList = reqToDelete.activePlacements || [];
          return (
            <div className="p-6 space-y-4">
              <div className="flex items-start gap-3.5">
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${hasBillable ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-rose-50 border-rose-200 text-rose-600'}`}>
                  {hasBillable ? <Lock className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                </div>
                <div className="space-y-1.5 min-w-0 flex-1">
                  <h3 className="text-sm font-bold text-slate-900">
                    {hasBillable ? 'Protected: Active Billable Requirement' : 'Delete Requirement?'}
                  </h3>
                  {hasBillable ? (
                    <>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        <span className="font-bold text-slate-800">{reqToDelete.code}</span> ({reqToDelete.opportunityTitle}) currently has{' '}
                        <span className="font-bold text-amber-700">{activePlacedCount} active billable consultant{activePlacedCount === 1 ? '' : 's'}</span>.
                        To protect billing records and submission audit history, release all placed consultant(s) before deleting this requirement.
                      </p>
                      {activePlacementList.length > 0 && (
                        <div className="pt-1 flex flex-wrap gap-1.5">
                          {activePlacementList.map((pl) => (
                            <span
                              key={pl.id}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50/80 border border-amber-200/80 text-[11px] font-semibold text-amber-900"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              <span>{pl.resourceName}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </>
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
                  disabled={isDeletingReq}
                  onClick={() => setReqToDelete(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
                >
                  {hasBillable ? 'Close' : 'Cancel'}
                </button>
                {hasBillable && onSelectReq ? (
                  <button
                    type="button"
                    onClick={() => {
                      const target = reqToDelete;
                      setReqToDelete(null);
                      onSelectReq(target);
                    }}
                    className="px-4 py-2 text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors cursor-pointer"
                  >
                    View Placed Consultants &rarr;
                  </button>
                ) : !hasBillable ? (
                  <ActionButton
                    type="button"
                    loading={isDeletingReq}
                    loadingText="Deleting..."
                    icon={<Trash2 className="w-3.5 h-3.5" />}
                    onClick={async () => {
                      if (isDeletingReq) return;
                      setIsDeletingReq(true);
                      try {
                        if (onDeleteReq) await onDeleteReq(reqToDelete);
                        setReqToDelete(null);
                      } catch {
                        setReqToDelete(null);
                      } finally {
                        setIsDeletingReq(false);
                      }
                    }}
                    className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors cursor-pointer"
                  >
                    Delete Requisition
                  </ActionButton>
                ) : null}
              </div>
            </div>
          );
        })()}
      </AnimatedModal>
    </div>
  );
};
