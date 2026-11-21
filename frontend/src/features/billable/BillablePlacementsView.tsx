import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  Building2,
  CalendarClock,
  CalendarPlus,
  CalendarX,
  DollarSign,
  FileSpreadsheet,
  FileText,
  Layers,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  TrendingUp,
  User,
  Wallet,
} from 'lucide-react';
import { apiClient } from '../../config/api.config';
import { BillablePlacement, Vendor } from '../../types';
import { MaskedValue } from '../../components/shared/MaskedValue';
import { SortableTableHeader } from '../../components/shared/SortableTableHeader';
import {
  GridColumnHeader,
  STAFFING_GRID_CELL_CLASS,
  STAFFING_GRID_FRAME_CLASS,
  STAFFING_GRID_ROW_CLASS,
  STAFFING_GRID_ROW_STATIC_CLASS,
  STAFFING_GRID_STICKY_TD_CLASS,
  STAFFING_GRID_STICKY_TH_CLASS,
  STAFFING_GRID_TABLE_CLASS,
  STAFFING_GRID_THEAD_CLASS,
  STAFFING_GRID_TH_CLASS,
} from '../../components/shared/StaffingGrid';
import { TablePagination } from '../../components/shared/TablePagination';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { CustomSelect } from '../../components/shared/CustomSelect';
import { useCurrency } from '../../utils/currency';
import { useDebounce } from '../../utils/useDebounce';
import { mapPlacementFromApi } from '../../utils/entityMappers';
import { getWorkspaceBrandSlug } from '../../utils/workspaceBrand';
import {
  extractRateSortValue,
  sortArrayByColumn,
  useTableSort,
} from '../../utils/tableSort';
import { PlacementModals } from './PlacementModals';
import {
  ExtensionData,
  formatMargin,
  formatSpread,
  getDaysRemaining,
  getEffectiveStatus,
  getPlacementStatusMeta,
  isExpiringSoon,
} from './placementUtils';

export type BillableStatusFilter = 'All' | 'Active' | 'Expiring Soon' | 'Extended' | 'Ended';

interface BillablePlacementsViewProps {
  placements: BillablePlacement[];
  vendors?: Vendor[];
  rateMasked: boolean;
  initialStatusFilter?: BillableStatusFilter;
  onStatusFilterChange?: (status: BillableStatusFilter) => void;
  onOpenNewPlacement?: () => void;
  onSelectPlacement?: (placement: BillablePlacement) => void;
  onExtendContract?: (placement: BillablePlacement, extensionData?: ExtensionData) => Promise<void> | void;
  onUpdatePlacement?: (placement: BillablePlacement) => Promise<void> | void;
  onDeletePlacement?: (placement: BillablePlacement) => Promise<void> | void;
  showToast?: (title: string, message: string, icon?: string) => void;
}

export const BillablePlacementsView: React.FC<BillablePlacementsViewProps> = ({
  placements,
  vendors = [],
  rateMasked,
  initialStatusFilter,
  onStatusFilterChange,
  onOpenNewPlacement,
  onSelectPlacement,
  onExtendContract,
  onUpdatePlacement,
  onDeletePlacement,
  showToast,
}) => {
  const { symbol: currencySymbol, formatRate } = useCurrency();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<BillableStatusFilter>(initialStatusFilter || 'All');

  useEffect(() => {
    setStatusFilter(initialStatusFilter || 'All');
  }, [initialStatusFilter]);
  const [modelFilter, setModelFilter] = useState<'All' | 'W2 Hourly' | 'C2C Subcontractor' | '1099' | 'Full-Time'>('All');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const tableSort = useTableSort<
    'customer' | 'resourceName' | 'skillRole' | 'status' | 'payRate' | 'billRate' | 'hourlySpread' | 'endDate'
  >();
  const [tableRows, setTableRows] = useState<BillablePlacement[]>(() => placements.slice(0, 10));
  const [totalRows, setTotalRows] = useState(placements.length);
  const [isLoadingRows, setIsLoadingRows] = useState(false);
  const hasServerSyncRef = React.useRef(false);

  const debouncedSearch = useDebounce(search, 150);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, modelFilter, tableSort.sort.sortBy, tableSort.sort.sortDir]);

  useEffect(() => {
    let active = true;
    const q = debouncedSearch.toLowerCase();
    const localFiltered = placements.filter((p) => {
      const matchesSearch =
        !q ||
        p.resourceName.toLowerCase().includes(q) ||
        p.customer.toLowerCase().includes(q) ||
        p.skillRole.toLowerCase().includes(q) ||
        p.recruiter.toLowerCase().includes(q) ||
        (p.purchaseOrderNumber || '').toLowerCase().includes(q) ||
        (p.vendorName || '').toLowerCase().includes(q);
      const effStatus = getEffectiveStatus(p);
      const matchesStatus =
        statusFilter === 'All'
          ? true
          : statusFilter === 'Active'
            ? p.status !== 'Completed' && p.status !== 'Terminated'
            : statusFilter === 'Ended'
              ? effStatus === 'Completed' || effStatus === 'Terminated'
              : effStatus === statusFilter;
      const pModel = p.placementType || 'C2C Subcontractor';
      const matchesModel = modelFilter === 'All' || pModel.toLowerCase().includes(modelFilter.toLowerCase());
      return matchesSearch && matchesStatus && matchesModel;
    });

    if (!hasServerSyncRef.current && placements.length > 0 && !tableSort.sort.sortBy) {
      setTotalRows(localFiltered.length);
      setTableRows(localFiltered.slice((page - 1) * limit, page * limit));
      setIsLoadingRows(false);
    } else {
      setIsLoadingRows(true);
    }

    const activeSortParams =
      rateMasked &&
      (tableSort.sort.sortBy === 'payRate' ||
        tableSort.sort.sortBy === 'billRate' ||
        tableSort.sort.sortBy === 'hourlySpread')
        ? {}
        : tableSort.sortParams;

    apiClient
      .get('/placements', {
        params: {
          search: debouncedSearch.trim() || undefined,
          status: statusFilter !== 'All' ? statusFilter : undefined,
          model: modelFilter !== 'All' ? modelFilter : undefined,
          page,
          limit,
          ...activeSortParams,
        },
      })
      .then((res) => {
        if (!active) return;
        if (res.data?.success && Array.isArray(res.data.data)) {
          hasServerSyncRef.current = true;
          const mapped = res.data.data.map(mapPlacementFromApi);
          setTableRows(mapped);
          setTotalRows(res.data.pagination?.total ?? mapped.length);
        }
      })
      .catch(() => {
        if (!active) return;
        const sortedFallback = sortArrayByColumn(localFiltered, tableSort.sort, {
          customer: (p) => p.customer,
          resourceName: (p) => p.resourceName,
          skillRole: (p) => p.skillRole,
          status: (p) => getEffectiveStatus(p),
          payRate: (p) => (rateMasked ? null : extractRateSortValue(p.payRate)),
          billRate: (p) => (rateMasked ? null : extractRateSortValue(p.billing)),
          hourlySpread: (p) => (rateMasked ? null : Number(p.hourlySpread) || 0),
          endDate: (p) => (p.endDate ? new Date(p.endDate) : null),
        });
        setTotalRows(sortedFallback.length);
        setTableRows(sortedFallback.slice((page - 1) * limit, page * limit));
      })
      .finally(() => {
        if (active) setIsLoadingRows(false);
      });
    return () => {
      active = false;
    };
  }, [
    debouncedSearch,
    statusFilter,
    modelFilter,
    page,
    limit,
    placements,
    rateMasked,
    tableSort.sort.sortBy,
    tableSort.sort.sortDir,
    tableSort.sortParams,
  ]);

  const [editingPlacement, setEditingPlacement] = useState<BillablePlacement | null>(null);
  const [deletingPlacement, setDeletingPlacement] = useState<BillablePlacement | null>(null);
  const [extendingPlacement, setExtendingPlacement] = useState<BillablePlacement | null>(null);
  const [endingPlacement, setEndingPlacement] = useState<BillablePlacement | null>(null);

  const filtered = tableRows;

  const activePlacements = placements.filter((p) => p.status !== 'Completed' && p.status !== 'Terminated');
  const totalHourlySpread = activePlacements.reduce((sum, p) => sum + (Number(p.hourlySpread) || 0), 0);
  const avgHourlySpread =
    activePlacements.length && !isNaN(totalHourlySpread / activePlacements.length)
      ? (totalHourlySpread / activePlacements.length).toFixed(2)
      : '0.00';
  const totalMarginPct = activePlacements.reduce((sum, p) => sum + (Number(p.marginPct) || 0), 0);
  const avgMarginPercent =
    activePlacements.length && !isNaN(totalMarginPct / activePlacements.length)
      ? (totalMarginPct / activePlacements.length).toFixed(1)
      : '0.0';
  const totalMonthlyGrossProfit = Math.round(totalHourlySpread * 160);
  const contractsExpiringSoon = placements.filter((p) => isExpiringSoon(p)).length;

  const handleExport = () => {
    const headers = [
      'Placed Resource',
      'Client Customer',
      'PO / SOW #',
      'Skill / Role',
      'Deployment',
      'Placement Model',
      'Status',
      'Pay Rate',
      'Bill Rate',
      'Hourly Spread',
      'Margin %',
      'Start Date',
      'End Date',
    ];
    const rows = filtered.map((p) => [
      `"${p.resourceName}"`,
      `"${p.customer}"`,
      `"${p.purchaseOrderNumber || '-'}"`,
      `"${p.skillRole}"`,
      `"${p.deployment}"`,
      `"${p.placementType || 'C2C Subcontractor'}"`,
      `"${getEffectiveStatus(p)}"`,
      `"${rateMasked ? '••••' : formatRate(p.payRate) || '-'}"`,
      `"${rateMasked ? '••••' : formatRate(p.billing)}"`,
      `"${rateMasked ? '••••' : formatSpread(p.hourlySpread, currencySymbol)}"`,
      `"${rateMasked ? '••••' : formatMargin(p.marginPct)}"`,
      `"${p.startDate}"`,
      `"${p.endDate}"`,
    ]);
    const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${getWorkspaceBrandSlug()}_Billable_Placements_Ledger_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    if (showToast) {
      showToast('Export Generated', 'Billable placements ledger exported to CSV file.', 'fa-regular fa-file-excel text-emerald-600');
    }
  };

  const getStatusBadge = (p: BillablePlacement) => {
    const meta = getPlacementStatusMeta(p);
    return <StatusBadge label={meta.label} tone={meta.tone} size="xs" />;
  };

  return (
    <section className="max-w-7xl mx-auto px-1 sm:px-2 lg:px-4 space-y-5 pb-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg sm:text-[19px] font-semibold text-slate-900 tracking-tight leading-snug">Billable Consultants</h1>
            <StatusBadge
              label={`${activePlacements.length} Active Placements`}
              tone="emerald"
              size="xs"
            />
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Active client placements, hourly margins, and upcoming contract renewals.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="h-8 px-3 rounded-lg border border-slate-200 hover:bg-slate-50 bg-white text-slate-700 text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export to Excel</span>
          </button>
          {onOpenNewPlacement && (
          <button
            onClick={onOpenNewPlacement}
            className="h-8 px-3.5 rounded-lg bg-brand-600 text-white text-[11px] font-semibold hover:bg-brand-700 active:bg-brand-800 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Placement</span>
          </button>
          )}
        </div>
      </div>

      {rateMasked && (
        <div className="bg-amber-50/70 border border-amber-200 rounded-xl px-4 py-2.5 text-xs text-amber-900 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span>Commercial billing rates are masked for your account. Contact an administrator to enable rate editing.</span>
        </div>
      )}

      {/* 4 Executive Financial KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 card-shadow flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Active Billing</span>
            <div className="w-7 h-7 rounded-md bg-slate-50 border border-slate-200/80 text-slate-600 flex items-center justify-center flex-shrink-0">
              <DollarSign className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-lg font-bold font-mono text-slate-900 tabular-nums">{activePlacements.length} Consultants</div>
          <div className="text-[11px] text-emerald-700 font-medium mt-0.5 tabular-nums">{placements.length} Total Ledger Records</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/90 card-shadow flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Avg. Hourly Spread</span>
            <div className="w-7 h-7 rounded-md bg-slate-50 border border-slate-200/80 text-slate-600 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-lg font-bold font-mono text-brand-700 tabular-nums">
            <MaskedValue value={`+${currencySymbol}${avgHourlySpread}/hr`} isMasked={rateMasked} />
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
            <MaskedValue value={`${avgMarginPercent}% Gross Profit Margin`} isMasked={rateMasked} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/90 card-shadow flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Monthly Gross Profit</span>
            <div className="w-7 h-7 rounded-md bg-slate-50 border border-slate-200/80 text-slate-600 flex items-center justify-center flex-shrink-0">
              <Wallet className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-lg font-bold font-mono text-slate-900 tabular-nums">
            <MaskedValue value={`${currencySymbol}${totalMonthlyGrossProfit.toLocaleString()}/mo`} isMasked={rateMasked} />
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
            <MaskedValue value={`${currencySymbol}${Math.round(totalMonthlyGrossProfit * 12).toLocaleString()} Annual Run-Rate`} isMasked={rateMasked} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/90 card-shadow flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Contract Expiry Radar</span>
            <div className="w-7 h-7 rounded-md bg-slate-50 border border-slate-200/80 text-amber-700 flex items-center justify-center flex-shrink-0">
              <CalendarClock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-lg font-bold font-mono text-amber-700 tabular-nums">{contractsExpiringSoon} Pending Renewal</div>
          <div className="text-[11px] text-amber-700 font-medium mt-0.5">Expiring within 30 days</div>
        </div>
      </div>

      {/* Billable Ledger Table Card */}
      <div className={STAFFING_GRID_FRAME_CLASS}>
        {/* Table Filter Bar */}
        <div className="px-5 py-3 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3 bg-white">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-xs text-slate-900 mr-1">
              {totalRows} Placements
            </span>
            {(['All', 'Active', 'Expiring Soon', 'Extended', 'Ended'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setStatusFilter(tab);
                  onStatusFilterChange?.(tab);
                }}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  statusFilter === tab
                    ? 'bg-white text-slate-900 border border-slate-300 shadow-sm font-semibold'
                    : 'bg-slate-50/70 text-slate-500 border border-slate-200/80 hover:bg-white hover:text-slate-800'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <CustomSelect
              value={modelFilter}
              onChange={(val) => setModelFilter(val as any)}
              ariaLabel="Filter placements by contract model"
              size="xs"
              fullWidth={false}
              minMenuWidth={165}
              options={[
                { value: 'All', label: 'All Models' },
                'W2 Hourly',
                'C2C Subcontractor',
                '1099',
                'Full-Time',
              ]}
            />
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search consultants, clients, PO#..."
                className="h-8 pl-8 pr-3 text-xs border border-slate-200 rounded-lg bg-white w-56 text-slate-700 outline-none focus:border-brand-500"
              />
            </div>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto">
          <table className={STAFFING_GRID_TABLE_CLASS}>
            <thead className={STAFFING_GRID_THEAD_CLASS}>
              <tr>
                <SortableTableHeader
                  label="Customer & PO"
                  icon={<Building2 className="w-3 h-3" />}
                  column="customer"
                  sort={tableSort.sort}
                  onSort={tableSort.handleSort}
                  defaultDir="asc"
                  uppercase={false}
                  className={`${STAFFING_GRID_TH_CLASS} ${STAFFING_GRID_STICKY_TH_CLASS}`}
                />
                <SortableTableHeader
                  label="Consultant"
                  icon={<User className="w-3 h-3" />}
                  column="resourceName"
                  sort={tableSort.sort}
                  onSort={tableSort.handleSort}
                  defaultDir="asc"
                  uppercase={false}
                  className={STAFFING_GRID_TH_CLASS}
                />
                <SortableTableHeader
                  label="Role"
                  icon={<Briefcase className="w-3 h-3" />}
                  column="skillRole"
                  sort={tableSort.sort}
                  onSort={tableSort.handleSort}
                  defaultDir="asc"
                  uppercase={false}
                  className={STAFFING_GRID_TH_CLASS}
                />
                <SortableTableHeader
                  label="Model & Status"
                  icon={<Layers className="w-3 h-3" />}
                  column="status"
                  sort={tableSort.sort}
                  onSort={tableSort.handleSort}
                  defaultDir="asc"
                  uppercase={false}
                  className={STAFFING_GRID_TH_CLASS}
                />
                <SortableTableHeader
                  label="Pay Rate"
                  icon={<DollarSign className="w-3 h-3" />}
                  column="payRate"
                  sort={tableSort.sort}
                  onSort={tableSort.handleSort}
                  defaultDir="desc"
                  disabled={rateMasked}
                  uppercase={false}
                  className={STAFFING_GRID_TH_CLASS}
                />
                <SortableTableHeader
                  label="Bill Rate"
                  icon={<Wallet className="w-3 h-3" />}
                  column="billRate"
                  sort={tableSort.sort}
                  onSort={tableSort.handleSort}
                  defaultDir="desc"
                  disabled={rateMasked}
                  uppercase={false}
                  className={STAFFING_GRID_TH_CLASS}
                />
                <SortableTableHeader
                  label="Hourly Spread"
                  icon={<TrendingUp className="w-3 h-3" />}
                  column="hourlySpread"
                  sort={tableSort.sort}
                  onSort={tableSort.handleSort}
                  defaultDir="desc"
                  disabled={rateMasked}
                  uppercase={false}
                  className={STAFFING_GRID_TH_CLASS}
                />
                <SortableTableHeader
                  label="Contract Period"
                  icon={<CalendarClock className="w-3 h-3" />}
                  column="endDate"
                  sort={tableSort.sort}
                  onSort={tableSort.handleSort}
                  defaultDir="asc"
                  uppercase={false}
                  className={STAFFING_GRID_TH_CLASS}
                />
                <GridColumnHeader
                  icon={<SlidersHorizontal className="w-3 h-3" />}
                  label="Actions"
                  align="right"
                />
              </tr>
            </thead>
            <tbody className="text-slate-700">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-10 text-center text-slate-400 text-xs">
                    {search.trim() || statusFilter !== 'All' || modelFilter !== 'All' ? (
                      <>
                        No billable placements match your current filters.{' '}
                        <button
                          type="button"
                          onClick={() => {
                            setSearch('');
                            setStatusFilter('All');
                            onStatusFilterChange?.('All');
                            setModelFilter('All');
                          }}
                          className="font-semibold text-brand-600 hover:text-brand-700 hover:underline cursor-pointer"
                        >
                          Clear Filters
                        </button>
                      </>
                    ) : (
                      <>
                        No billable placements found. Click{' '}
                        <button
                          type="button"
                          onClick={onOpenNewPlacement}
                          className="font-semibold text-brand-600 hover:text-brand-700 hover:underline cursor-pointer"
                        >
                          New Placement
                        </button>{' '}
                        to register one.
                      </>
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const daysLeft = getDaysRemaining(p.endDate);
                  const ended = p.status === 'Completed' || p.status === 'Terminated';
                  return (
                    <tr
                      key={p.id}
                      onClick={onSelectPlacement ? () => onSelectPlacement(p) : undefined}
                      className={
                        onSelectPlacement ? STAFFING_GRID_ROW_CLASS : STAFFING_GRID_ROW_STATIC_CLASS
                      }
                    >
                      {/* Customer & PO */}
                      <td className={`${STAFFING_GRID_CELL_CLASS} ${STAFFING_GRID_STICKY_TD_CLASS} whitespace-nowrap`}>
                        <div className={`font-semibold text-slate-900 ${onSelectPlacement ? 'group-hover:text-brand-700 transition-colors' : ''}`}>
                          {p.customer}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-500">
                          <span>{p.customerContact || 'Hiring Manager'}</span>
                          {p.purchaseOrderNumber && (
                            <span className="inline-flex items-center gap-0.5 text-[11px] bg-white border border-slate-300/90 text-slate-600 px-1.5 py-0.5 rounded">
                              <FileText className="w-2.5 h-2.5" />
                              <span>PO: {p.purchaseOrderNumber}</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Consultant */}
                      <td className={`${STAFFING_GRID_CELL_CLASS} whitespace-nowrap`}>
                        <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                          <span className={onSelectPlacement ? 'group-hover:text-brand-700 transition-colors' : ''}>
                            {p.resourceName}
                          </span>
                          {p.deployment && (
                            <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-white border border-slate-300/90 text-slate-600">
                              {p.deployment}
                            </span>
                          )}
                        </div>
                        {p.vendorName && (
                          <div className="text-[11px] text-amber-700 font-medium mt-0.5 truncate max-w-[200px]">
                            via {p.vendorName}
                          </div>
                        )}
                      </td>

                      {/* Role */}
                      <td className={`${STAFFING_GRID_CELL_CLASS} max-w-[210px]`}>
                        <div
                          className="font-medium text-slate-600 truncate"
                          title={p.skillRole || ''}
                        >
                          {p.skillRole || '—'}
                        </div>
                      </td>

                      {/* Placement Model & Status */}
                      <td className={`${STAFFING_GRID_CELL_CLASS} space-y-1 whitespace-nowrap`}>
                        <div>
                          <StatusBadge
                            tone={
                              p.placementType && p.placementType.includes('W2')
                                ? 'emerald'
                                : 'slate'
                            }
                            size="xs"
                            label={p.placementType || 'C2C Subcontractor'}
                          />
                        </div>
                        <div>{getStatusBadge(p)}</div>
                      </td>

                      {/* Pay Rate */}
                      <td className={`${STAFFING_GRID_CELL_CLASS} font-medium text-slate-600 tabular-nums whitespace-nowrap`}>
                        <MaskedValue value={p.payRate || '-'} isMasked={rateMasked} />
                      </td>

                      {/* Bill Rate */}
                      <td className={`${STAFFING_GRID_CELL_CLASS} font-bold text-slate-900 tabular-nums whitespace-nowrap`}>
                        <MaskedValue value={p.billing} isMasked={rateMasked} />
                      </td>

                      {/* Hourly Margin Spread */}
                      <td className={`${STAFFING_GRID_CELL_CLASS} tabular-nums whitespace-nowrap`}>
                        <div className="font-bold text-emerald-600 text-xs">
                          <MaskedValue value={formatSpread(p.hourlySpread, currencySymbol)} isMasked={rateMasked} />
                        </div>
                        <div className="text-[11px] text-slate-400">
                          <MaskedValue value={formatMargin(p.marginPct)} isMasked={rateMasked} />
                        </div>
                      </td>

                      {/* Contract Period */}
                      <td className={`${STAFFING_GRID_CELL_CLASS} text-[11px] text-slate-600 whitespace-nowrap`}>
                        <div className="inline-flex items-center gap-1 tabular-nums">
                          <span>{p.startDate}</span>
                          <ArrowRight className="w-3 h-3 text-slate-400 flex-shrink-0" />
                          <span>{p.endDate}</span>
                        </div>
                        {daysLeft !== null && !ended && (
                          <div
                            className={`mt-0.5 text-[11px] font-sans font-medium ${
                              daysLeft <= 30 && daysLeft >= 0
                                ? 'text-amber-700'
                                : daysLeft < 0
                                ? 'text-rose-600'
                                : 'text-slate-400'
                            }`}
                          >
                            {daysLeft < 0
                              ? 'Past end date'
                              : daysLeft <= 30
                              ? `Expiring in ${daysLeft}d`
                              : `${daysLeft}d remaining`}
                          </div>
                        )}
                        {ended && <div className="mt-0.5 text-[11px] font-sans text-slate-400">Contract ended</div>}
                      </td>

                      {/* Actions */}
                      <td
                        className={`${STAFFING_GRID_CELL_CLASS} text-right whitespace-nowrap`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {onExtendContract && (
                          <button
                            onClick={() => setExtendingPlacement(p)}
                            className="h-7 px-2.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-[11px] font-semibold transition-colors cursor-pointer inline-flex items-center gap-1"
                          >
                            <CalendarPlus className="w-3 h-3 text-brand-600" />
                            <span>{ended ? 'Renew SOW' : 'Extend SOW'}</span>
                          </button>
                          )}
                          {!ended && onUpdatePlacement && (
                            <button
                              onClick={() => setEndingPlacement(p)}
                              title="End consultant placement"
                              className="h-7 px-2.5 rounded-lg bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 hover:border-rose-200 text-[11px] font-semibold transition-colors cursor-pointer inline-flex items-center gap-1"
                            >
                              <CalendarX className="w-3 h-3 text-rose-500" />
                              <span>End</span>
                            </button>
                          )}
                          {onUpdatePlacement && (
                            <button
                              onClick={() => setEditingPlacement({ ...p })}
                              title="Edit placement"
                              className="p-1.5 text-slate-400 hover:text-brand-600 rounded hover:bg-brand-50 transition-colors cursor-pointer inline-flex items-center"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {ended && onDeletePlacement && (
                            <button
                              onClick={() => setDeletingPlacement(p)}
                              title="Delete ended placement"
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors cursor-pointer inline-flex items-center"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <TablePagination
          page={page}
          limit={limit}
          total={totalRows}
          onPageChange={setPage}
          onLimitChange={(nextLimit) => {
            setLimit(nextLimit);
            setPage(1);
          }}
          itemLabel="placements"
          isLoading={isLoadingRows}
        />
      </div>

      <PlacementModals
        vendors={vendors}
        extendingPlacement={extendingPlacement}
        onCloseExtend={() => setExtendingPlacement(null)}
        onExtendContract={onExtendContract}
        editingPlacement={editingPlacement}
        onCloseEdit={() => setEditingPlacement(null)}
        onUpdatePlacement={onUpdatePlacement}
        endingPlacement={endingPlacement}
        onCloseEnd={() => setEndingPlacement(null)}
        deletingPlacement={deletingPlacement}
        onCloseDelete={() => setDeletingPlacement(null)}
        onDeletePlacement={onDeletePlacement}
      />
    </section>
  );
};
