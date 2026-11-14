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
  CheckCircle2,
  AlertTriangle,
  Clock,
  X,
  FileSpreadsheet,
  FileText,
  ArrowRight,
} from 'lucide-react';
import { apiClient } from '../../config/api.config';
import { BillablePlacement } from '../../types';
import { MaskedValue } from '../../components/shared/MaskedValue';
import { TablePagination } from '../../components/shared/TablePagination';
import { useCurrency } from '../../utils/currency';
import { useDebounce } from '../../utils/useDebounce';
import { mapPlacementFromApi } from '../../utils/entityMappers';
import { getWorkspaceBrandSlug } from '../../utils/workspaceBrand';

interface ExtensionData {
  newEndDate: string;
  billing?: string;
  payRate?: string;
  purchaseOrderNumber?: string;
}

interface BillablePlacementsViewProps {
  placements: BillablePlacement[];
  rateMasked: boolean;
  onOpenNewPlacement: () => void;
  onExtendContract: (placement: BillablePlacement, extensionData?: ExtensionData) => void;
  onUpdatePlacement?: (placement: BillablePlacement) => void;
  onDeletePlacement?: (placement: BillablePlacement) => void;
  showToast?: (title: string, message: string, icon?: string) => void;
}

const parseRate = (val: any, fallback = 0): number => {
  const n = parseFloat(String(val ?? '').replace(/[^0-9.]/g, ''));
  return isNaN(n) ? fallback : n;
};

const addMonthsToDate = (dateStr: string, months: number): string => {
  const base = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
  if (isNaN(base.getTime())) {
    const fallback = new Date();
    fallback.setMonth(fallback.getMonth() + months);
    return fallback.toISOString().split('T')[0];
  }
  base.setMonth(base.getMonth() + months);
  return base.toISOString().split('T')[0];
};

export const BillablePlacementsView: React.FC<BillablePlacementsViewProps> = ({
  placements,
  rateMasked,
  onOpenNewPlacement,
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
  const [extendForm, setExtendForm] = useState<ExtensionData>({
    newEndDate: '',
    billing: '',
    payRate: '',
    purchaseOrderNumber: '',
  });

  const getDaysRemaining = (endDateStr: string): number | null => {
    if (!endDateStr) return null;
    const end = new Date(endDateStr + 'T00:00:00').getTime();
    if (isNaN(end)) return null;
    return Math.ceil((end - new Date().setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24));
  };

  const isExpiringSoon = (p: BillablePlacement) => {
    if (p.status === 'Completed' || p.status === 'Terminated') return false;
    const diff = getDaysRemaining(p.endDate);
    return diff !== null && diff >= 0 && diff <= 30;
  };

  const getEffectiveStatus = (p: BillablePlacement): 'Active' | 'Extended' | 'Expiring Soon' | 'Completed' | 'Terminated' => {
    if (p.status === 'Completed' || p.status === 'Terminated') return p.status;
    if (isExpiringSoon(p)) return 'Expiring Soon';
    if (p.status === 'Extended') return 'Extended';
    return 'Active';
  };

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

  const formatSpread = (val: any) => {
    if (val === undefined || val === null || val === '') return '-';
    const n = Number(val);
    return isNaN(n) ? '-' : `${n >= 0 ? '+' : '-'}${currencySymbol}${Math.abs(n).toFixed(2)}/hr`;
  };

  const formatMargin = (val: any) => {
    if (val === undefined || val === null || val === '') return '-';
    const n = Number(val);
    return isNaN(n) ? '-' : `${n.toFixed(1)}% margin`;
  };

  const openExtendModal = (p: BillablePlacement) => {
    setExtendingPlacement(p);
    setExtendForm({
      newEndDate: addMonthsToDate(p.endDate, 12),
      billing: p.billing || '',
      payRate: p.payRate || '',
      purchaseOrderNumber: p.purchaseOrderNumber || '',
    });
  };

  const handleExport = (type: 'Excel' | 'PDF') => {
    if (type === 'PDF') {
      window.print();
      return;
    }
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
      `"${rateMasked ? '••••' : formatSpread(p.hourlySpread)}"`,
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
    const status = getEffectiveStatus(p);
    if (status === 'Expiring Soon') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <Clock className="w-2.5 h-2.5" />
          Expiring &lt;30d
        </span>
      );
    }
    if (status === 'Extended') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
          <CalendarPlus className="w-2.5 h-2.5" />
          Extended
        </span>
      );
    }
    if (status === 'Completed') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
          Completed
        </span>
      );
    }
    if (status === 'Terminated') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          Terminated
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <CheckCircle2 className="w-2.5 h-2.5" />
        Active
      </span>
    );
  };

  const editBill = editingPlacement ? parseRate(editingPlacement.billing, 0) : 0;
  const editPay = editingPlacement ? parseRate(editingPlacement.payRate, 0) : 0;
  const editSpread = editBill - editPay;
  const editMargin = editBill > 0 ? ((editSpread / editBill) * 100).toFixed(1) : '0.0';

  const extBill = parseRate(extendForm.billing, 0);
  const extPay = parseRate(extendForm.payRate, 0);
  const extSpread = extBill - extPay;
  const extMargin = extBill > 0 ? ((extSpread / extBill) * 100).toFixed(1) : '0.0';

  return (
    <section className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Active Billable Consultants</h2>
            <span className="text-[10px] font-bold bg-emerald-500/15 text-emerald-700 border border-emerald-500/30 px-2 py-0.5 rounded">
              {activePlacements.length} Active Placements
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time consultant client engagements, hourly margin spreads, and contract renewal sentinels.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExport('Excel')}
            className="px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 bg-white text-slate-700 text-xs font-medium flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export to Excel</span>
          </button>
          <button
            onClick={() => handleExport('PDF')}
            className="px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 bg-white text-slate-700 text-xs font-medium flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-rose-600" />
            <span>Export to PDF</span>
          </button>
          <button
            onClick={onOpenNewPlacement}
            className="px-3.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Placement</span>
          </button>
        </div>
      </div>

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
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Avg. Hourly Spread</div>
            <div className="text-lg font-bold text-blue-700">
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
            <select
              value={modelFilter}
              onChange={(e) => setModelFilter(e.target.value as any)}
              className="px-2.5 py-1 text-xs border border-slate-200 rounded-md bg-white text-slate-700 outline-none focus:border-brand-500 cursor-pointer"
            >
              <option value="All">All Models</option>
              <option value="W2 Hourly">W2 Hourly</option>
              <option value="C2C Subcontractor">C2C Subcontractor</option>
              <option value="1099">1099</option>
              <option value="Full-Time">Full-Time</option>
            </select>
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
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
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
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Customer & PO */}
                      <td className="px-3.5 py-3">
                        <div className="font-bold text-slate-900">{p.customer}</div>
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
                          <span>{p.resourceName}</span>
                          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                            {p.deployment}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-sans mt-0.5">{p.skillRole}</div>
                        {p.vendorName && (
                          <div className="text-[10px] text-purple-600 font-medium mt-0.5">via {p.vendorName}</div>
                        )}
                      </td>

                      {/* Placement Model & Status */}
                      <td className="px-3.5 py-3 space-y-1">
                        <div>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                              p.placementType && p.placementType.includes('W2')
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                : 'bg-purple-50 text-purple-700 border-purple-200'
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
                          <MaskedValue value={formatSpread(p.hourlySpread)} isMasked={rateMasked} />
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
                      <td className="px-3.5 py-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => openExtendModal(p)}
                          className="px-2.5 py-1 rounded bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-[10px] font-semibold transition-colors cursor-pointer inline-flex items-center gap-1"
                        >
                          <CalendarPlus className="w-3 h-3" />
                          <span>Extend SOW</span>
                        </button>
                        {onUpdatePlacement && (
                          <button
                            onClick={() => setEditingPlacement({ ...p })}
                            title="Edit placement"
                            className="ml-1.5 p-1.5 text-slate-400 hover:text-brand-600 rounded hover:bg-brand-50 transition-colors cursor-pointer inline-flex items-center"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {onDeletePlacement && (
                          <button
                            onClick={() => setDeletingPlacement(p)}
                            title="Delete placement"
                            className="ml-1 p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors cursor-pointer inline-flex items-center"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
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

      {/* Interactive Extend SOW Modal */}
      {extendingPlacement && (
        <div
          onClick={() => setExtendingPlacement(null)}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-scale-up"
          >
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
                  <CalendarPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Extend Contract / SOW</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {extendingPlacement.resourceName} @ {extendingPlacement.customer}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setExtendingPlacement(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                onExtendContract(extendingPlacement, extendForm);
                setExtendingPlacement(null);
              }}
              className="p-6 space-y-4 text-xs"
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-semibold text-slate-700 text-[11px]">Quick Extension Presets</label>
                  <span className="text-[10px] text-slate-400">Current End: {extendingPlacement.endDate}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: '+3 Months', months: 3 },
                    { label: '+6 Months', months: 6 },
                    { label: '+1 Year', months: 12 },
                  ].map((preset) => {
                    const targetDate = addMonthsToDate(extendingPlacement.endDate, preset.months);
                    const active = extendForm.newEndDate === targetDate;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setExtendForm((prev) => ({ ...prev, newEndDate: targetDate }))}
                        className={`py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                          active
                            ? 'bg-purple-600 text-white border-purple-600'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-purple-50'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">New End Date *</label>
                <input
                  type="date"
                  required
                  value={extendForm.newEndDate}
                  onChange={(e) => setExtendForm({ ...extendForm, newEndDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                />
              </div>

              <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg px-3.5 py-2.5 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-emerald-800">Revised Spread Preview</span>
                <span className="font-bold text-emerald-700">
                  {extSpread >= 0 ? `+${currencySymbol}${extSpread.toFixed(2)}/hr` : `-${currencySymbol}${Math.abs(extSpread).toFixed(2)}/hr`} ({extMargin}%)
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Client Bill Rate</label>
                  <input
                    type="text"
                    value={extendForm.billing || ''}
                    onChange={(e) => setExtendForm({ ...extendForm, billing: e.target.value })}
                    placeholder={`${currencySymbol}115/hr`}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Consultant Pay Rate</label>
                  <input
                    type="text"
                    value={extendForm.payRate || ''}
                    onChange={(e) => setExtendForm({ ...extendForm, payRate: e.target.value })}
                    placeholder={`${currencySymbol}85/hr`}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">PO / SOW Reference</label>
                <input
                  type="text"
                  value={extendForm.purchaseOrderNumber || ''}
                  onChange={(e) => setExtendForm({ ...extendForm, purchaseOrderNumber: e.target.value })}
                  placeholder="e.g. PO-2026-9901"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setExtendingPlacement(null)}
                  className="px-3.5 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Confirm SOW Extension
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Placement Modal */}
      {editingPlacement && (
        <div
          onClick={() => setEditingPlacement(null)}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-scale-up max-h-[92vh] flex flex-col"
          >
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Edit Billable Placement</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">{editingPlacement.resourceName}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingPlacement(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (onUpdatePlacement) onUpdatePlacement(editingPlacement);
                setEditingPlacement(null);
              }}
              className="p-6 space-y-3.5 text-xs overflow-y-auto"
            >
              {/* Live Spread Bar */}
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg px-3.5 py-2.5 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-emerald-800">Hourly Margin Spread</span>
                <span className="font-bold text-emerald-700">
                  {editSpread >= 0 ? `+${currencySymbol}${editSpread.toFixed(2)}/hr` : `-${currencySymbol}${Math.abs(editSpread).toFixed(2)}/hr`} ({editMargin}%)
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Consultant Name *</label>
                  <input
                    type="text"
                    required
                    value={editingPlacement.resourceName}
                    onChange={(e) => setEditingPlacement({ ...editingPlacement, resourceName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Skill / Role *</label>
                  <input
                    type="text"
                    required
                    value={editingPlacement.skillRole}
                    onChange={(e) => setEditingPlacement({ ...editingPlacement, skillRole: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Client / Customer *</label>
                  <input
                    type="text"
                    required
                    value={editingPlacement.customer}
                    onChange={(e) => setEditingPlacement({ ...editingPlacement, customer: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Client Contact</label>
                  <input
                    type="text"
                    value={editingPlacement.customerContact || ''}
                    onChange={(e) => setEditingPlacement({ ...editingPlacement, customerContact: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={editingPlacement.status || 'Active'}
                    onChange={(e) => setEditingPlacement({ ...editingPlacement, status: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:border-brand-600 focus:outline-none cursor-pointer"
                  >
                    <option value="Active">Active</option>
                    <option value="Extended">Extended</option>
                    <option value="Completed">Completed</option>
                    <option value="Terminated">Terminated</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Deployment</label>
                  <select
                    value={editingPlacement.deployment}
                    onChange={(e) => setEditingPlacement({ ...editingPlacement, deployment: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:border-brand-600 focus:outline-none cursor-pointer"
                  >
                    <option value="Onshore">Onshore</option>
                    <option value="Nearshore">Nearshore</option>
                    <option value="Offshore">Offshore</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Placement Model</label>
                  <select
                    value={editingPlacement.placementType || 'C2C Subcontractor'}
                    onChange={(e) => setEditingPlacement({ ...editingPlacement, placementType: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:border-brand-600 focus:outline-none cursor-pointer"
                  >
                    <option value="C2C Subcontractor">C2C Subcontractor</option>
                    <option value="W2 Hourly">W2 Hourly</option>
                    <option value="1099">1099</option>
                    <option value="Full-Time">Full-Time</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Pay Rate</label>
                  <input
                    type="text"
                    value={editingPlacement.payRate || ''}
                    onChange={(e) => setEditingPlacement({ ...editingPlacement, payRate: e.target.value })}
                    placeholder={`${currencySymbol}85/hr`}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Bill Rate</label>
                  <input
                    type="text"
                    value={editingPlacement.billing}
                    onChange={(e) => setEditingPlacement({ ...editingPlacement, billing: e.target.value })}
                    placeholder={`${currencySymbol}115/hr`}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">PO / SOW #</label>
                  <input
                    type="text"
                    value={editingPlacement.purchaseOrderNumber || ''}
                    onChange={(e) => setEditingPlacement({ ...editingPlacement, purchaseOrderNumber: e.target.value })}
                    placeholder="PO-2026-01"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={editingPlacement.startDate}
                    onChange={(e) => setEditingPlacement({ ...editingPlacement, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={editingPlacement.endDate}
                    onChange={(e) => setEditingPlacement({ ...editingPlacement, endDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Phone</label>
                  <input
                    type="text"
                    value={editingPlacement.phone || ''}
                    onChange={(e) => setEditingPlacement({ ...editingPlacement, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Work Email</label>
                  <input
                    type="email"
                    value={editingPlacement.email || ''}
                    onChange={(e) => setEditingPlacement({ ...editingPlacement, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingPlacement(null)}
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

      {/* Delete Placement Confirmation Modal */}
      {deletingPlacement && (
        <div
          onClick={() => setDeletingPlacement(null)}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-xl max-w-sm w-full border border-slate-200 shadow-2xl overflow-hidden animate-scale-up p-6 space-y-4"
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Remove Billable Placement?</h3>
                <p className="text-xs text-slate-500 mt-1">
                  This will remove <span className="font-semibold text-slate-700">{deletingPlacement.resourceName}</span>&apos;s placement at{' '}
                  <span className="font-semibold text-slate-700">{deletingPlacement.customer}</span> from the ledger.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDeletingPlacement(null)}
                className="px-3.5 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeletePlacement) onDeletePlacement(deletingPlacement);
                  setDeletingPlacement(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Remove Placement
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
