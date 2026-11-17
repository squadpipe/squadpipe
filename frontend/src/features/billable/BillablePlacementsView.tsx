import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  TrendingUp,
  Wallet,
  CalendarClock,
  Search,
  Plus,
  Pencil,
  Trash2,
  CalendarPlus,
  CalendarX,
  AlertTriangle,
  FileSpreadsheet,
  FileText,
  ArrowRight,
} from 'lucide-react';
import { apiClient } from '../../config/api.config';
import { BillablePlacement, Vendor } from '../../types';
import { MaskedValue } from '../../components/shared/MaskedValue';
import { TablePagination } from '../../components/shared/TablePagination';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { CustomSelect } from '../../components/shared/CustomSelect';
import { useCurrency } from '../../utils/currency';
import { useDebounce } from '../../utils/useDebounce';
import { mapPlacementFromApi } from '../../utils/entityMappers';
import { getWorkspaceBrandSlug } from '../../utils/workspaceBrand';
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

interface BillablePlacementsViewProps {
  placements: BillablePlacement[];
  vendors?: Vendor[];
  rateMasked: boolean;
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
  onOpenNewPlacement,
  onSelectPlacement,
  onExtendContract,
  onUpdatePlacement,
  onDeletePlacement,
  showToast,
}) => {
  const { symbol: currencySymbol, formatRate } = useCurrency();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Expiring Soon' | 'Extended' | 'Ended'>('All');
  const [modelFilter, setModelFilter] = useState<'All' | 'W2 Hourly' | 'C2C Subcontractor' | '1099' | 'Full-Time'>('All');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [tableRows, setTableRows] = useState<BillablePlacement[]>(() => placements.slice(0, 10));
  const [totalRows, setTotalRows] = useState(placements.length);
  const [isLoadingRows, setIsLoadingRows] = useState(false);

  const debouncedSearch = useDebounce(search, 150);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, modelFilter]);

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
        statusFilter === 'All' ||
        (statusFilter === 'Ended' ? effStatus === 'Completed' || effStatus === 'Terminated' : effStatus === statusFilter);
      const pModel = p.placementType || 'C2C Subcontractor';
      const matchesModel = modelFilter === 'All' || pModel.toLowerCase().includes(modelFilter.toLowerCase());
      return matchesSearch && matchesStatus && matchesModel;
    });

    if (placements.length > 0) {
      setTotalRows(localFiltered.length);
      setTableRows(localFiltered.slice((page - 1) * limit, page * limit));
      setIsLoadingRows(false);
    } else {
      setIsLoadingRows(true);
    }

    apiClient
      .get('/placements', {
        params: {
          search: debouncedSearch.trim() || undefined,
          status: statusFilter !== 'All' ? statusFilter : undefined,
          model: modelFilter !== 'All' ? modelFilter : undefined,
          page,
          limit,
        },
      })
      .then((res) => {
        if (!active) return;
        if (res.data?.success && Array.isArray(res.data.data)) {
          const mapped = res.data.data.map(mapPlacementFromApi);
          setTableRows(mapped);
          setTotalRows(res.data.pagination?.total ?? mapped.length);
        }
      })
      .catch(() => {
        if (!active) return;
        setTotalRows(localFiltered.length);
        setTableRows(localFiltered.slice((page - 1) * limit, page * limit));
      })
      .finally(() => {
        if (active) setIsLoadingRows(false);
      });
    return () => {
      active = false;
    };
  }, [debouncedSearch, statusFilter, modelFilter, page, limit, placements]);

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
    <section className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Active Billable Consultants</h2>
            <StatusBadge
              label={`${activePlacements.length} Active Placements`}
              tone="emerald"
              size="xs"
            />
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time consultant client engagements, hourly margin spreads, and contract renewal sentinels.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 bg-white text-slate-700 text-xs font-medium flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export to Excel</span>
          </button>
          {onOpenNewPlacement && (
          <button
            onClick={onOpenNewPlacement}
            className="px-3.5 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-semibold hover:bg-brand-700 active:bg-brand-800 shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
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
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Active Billing</div>
            <div className="text-lg font-bold text-slate-900">{activePlacements.length} Consultants</div>
            <div className="text-[10px] text-emerald-600 font-medium mt-0.5">{placements.length} Total Ledger Records</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Avg. Hourly Spread</div>
            <div className="text-lg font-bold text-brand-700">
              <MaskedValue value={`+${currencySymbol}${avgHourlySpread}/hr`} isMasked={rateMasked} />
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              <MaskedValue value={`${avgMarginPercent}% Gross Profit Margin`} isMasked={rateMasked} />
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center flex-shrink-0">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Monthly Gross Profit</div>
            <div className="text-lg font-bold text-emerald-800">
              <MaskedValue value={`${currencySymbol}${totalMonthlyGrossProfit.toLocaleString()}/mo`} isMasked={rateMasked} />
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              <MaskedValue value={`${currencySymbol}${Math.round(totalMonthlyGrossProfit * 12).toLocaleString()} Annual Run-Rate`} isMasked={rateMasked} />
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
            <CalendarClock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Contract Expiry Radar</div>
            <div className="text-lg font-bold text-amber-700">{contractsExpiringSoon} Pending Renewal</div>
            <div className="text-[10px] text-amber-700 font-medium mt-0.5">Expiring within 30 days</div>
          </div>
        </div>
      </div>

      {/* Billable Ledger Table Card */}
      <div className="bg-white rounded-xl border border-slate-200/80 card-shadow overflow-hidden">
        {/* Table Filter Bar */}
        <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-xs text-slate-900 mr-1">
              {totalRows} Placements
            </span>
            {(['All', 'Active', 'Expiring Soon', 'Extended', 'Ended'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  statusFilter === tab
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
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
                className="pl-8 pr-3 py-1 text-xs border border-slate-200 rounded-md bg-white w-56 text-slate-700 outline-none focus:border-brand-500"
              />
            </div>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="max-h-[440px] overflow-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 z-10 bg-slate-50 shadow-[inset_0_-1px_0_rgb(226,232,240)] text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
              <tr>
                <th className="px-3.5 py-3">Customer &amp; PO</th>
                <th className="px-3.5 py-3">Consultant &amp; Role</th>
                <th className="px-3.5 py-3">Model &amp; Status</th>
                <th className="px-3.5 py-3">Pay Rate</th>
                <th className="px-3.5 py-3">Bill Rate</th>
                <th className="px-3.5 py-3">Hourly Spread</th>
                <th className="px-3.5 py-3">Contract Period</th>
                <th className="px-3.5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-slate-400 text-xs">
                    {search.trim() || statusFilter !== 'All' || modelFilter !== 'All' ? (
                      <>
                        No billable placements match your current filters.{' '}
                        <button
                          type="button"
                          onClick={() => {
                            setSearch('');
                            setStatusFilter('All');
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
                      className={`group transition-colors ${
                        onSelectPlacement ? 'hover:bg-slate-50/90 cursor-pointer' : 'hover:bg-slate-50/80'
                      }`}
                    >
                      {/* Customer & PO */}
                      <td className="px-3.5 py-3">
                        <div className={`font-bold text-slate-900 ${onSelectPlacement ? 'group-hover:text-brand-700 transition-colors' : ''}`}>{p.customer}</div>
                        <div className="text-[11px] text-slate-500 font-sans mt-0.5">{p.customerContact || 'Hiring Manager'}</div>
                        {p.purchaseOrderNumber && (
                          <div className="mt-1 inline-flex items-center gap-1 text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                            <FileText className="w-2.5 h-2.5" />
                            <span>PO: {p.purchaseOrderNumber}</span>
                          </div>
                        )}
                      </td>

                      {/* Consultant & Role */}
                      <td className="px-3.5 py-3">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <span className={onSelectPlacement ? 'group-hover:text-brand-700 transition-colors' : ''}>{p.resourceName}</span>
                          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                            {p.deployment}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-sans mt-0.5">{p.skillRole}</div>
                        {p.vendorName && (
                          <div className="text-[10px] text-amber-700 font-medium mt-0.5">via {p.vendorName}</div>
                        )}
                      </td>

                      {/* Placement Model & Status */}
                      <td className="px-3.5 py-3 space-y-1.5">
                        <div>
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${
                              p.placementType && p.placementType.includes('W2')
                                ? 'bg-brand-500/[0.08] text-brand-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {p.placementType || 'C2C Subcontractor'}
                          </span>
                        </div>
                        <div>{getStatusBadge(p)}</div>
                      </td>

                      {/* Pay Rate */}
                      <td className="px-3.5 py-3 font-medium text-slate-600">
                        <MaskedValue value={p.payRate || '-'} isMasked={rateMasked} />
                      </td>

                      {/* Bill Rate */}
                      <td className="px-3.5 py-3 font-bold text-slate-900">
                        <MaskedValue value={p.billing} isMasked={rateMasked} />
                      </td>

                      {/* Hourly Margin Spread */}
                      <td className="px-3.5 py-3">
                        <div className="font-bold text-emerald-600 text-xs">
                          <MaskedValue value={formatSpread(p.hourlySpread, currencySymbol)} isMasked={rateMasked} />
                        </div>
                        <div className="text-[10px] text-slate-400">
                          <MaskedValue value={formatMargin(p.marginPct)} isMasked={rateMasked} />
                        </div>
                      </td>

                      {/* Contract Period */}
                      <td className="px-3.5 py-3 text-[11px] text-slate-600">
                        <div className="inline-flex items-center gap-1">
                          <span>{p.startDate}</span>
                          <ArrowRight className="w-3 h-3 text-slate-400 flex-shrink-0" />
                          <span>{p.endDate}</span>
                        </div>
                        {daysLeft !== null && !ended && (
                          <div
                            className={`mt-0.5 text-[10px] font-sans font-medium ${
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
                        {ended && <div className="mt-0.5 text-[10px] font-sans text-slate-400">Contract ended</div>}
                      </td>

                      {/* Actions */}
                      <td
                        className="px-3.5 py-3 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {onExtendContract && (
                          <button
                            onClick={() => setExtendingPlacement(p)}
                            className="px-2.5 py-1 rounded bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-[10px] font-semibold transition-colors cursor-pointer inline-flex items-center gap-1"
                          >
                            <CalendarPlus className="w-3 h-3 text-brand-600" />
                            <span>{ended ? 'Renew SOW' : 'Extend SOW'}</span>
                          </button>
                          )}
                          {!ended && onUpdatePlacement && (
                            <button
                              onClick={() => setEndingPlacement(p)}
                              title="End consultant placement"
                              className="px-2.5 py-1 rounded bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 hover:border-rose-200 text-[10px] font-semibold transition-colors cursor-pointer inline-flex items-center gap-1"
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
