import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Award,
  Briefcase,
  CalendarCheck,
  DollarSign,
  FileSpreadsheet,
  ListChecks,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import { apiClient } from '../../config/api.config';
import { Requirement, Candidate, BillablePlacement, SlaTask } from '../../types';
import { MaskedValue } from '../../components/shared/MaskedValue';
import { TablePagination } from '../../components/shared/TablePagination';
import { useDebounce } from '../../utils/useDebounce';
import { mapRequirementFromApi } from '../../utils/entityMappers';

interface DashboardViewProps {
  requirements: Requirement[];
  candidates: Candidate[];
  placements: BillablePlacement[];
  slaTasks: SlaTask[];
  rateMasked: boolean;
  onNavigate: (view: string) => void;
  onOpenCreateReq: () => void;
  onSelectReq: (req: Requirement) => void;
  onUpdateReq?: (req: Requirement) => void;
  onDeleteReq?: (req: Requirement) => void;
  onPreviewResumeByName: (candidateName: string) => void;
  onStatusChange: (req: Requirement, newStatus: any) => void;
  onOpenMatcher: (req: Requirement) => void;
  onOpenSlaDrawer: () => void;
  onRefreshSla?: () => Promise<void> | void;
  showToast: (title: string, message: string, icon?: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  requirements,
  candidates,
  placements,
  slaTasks,
  rateMasked,
  onNavigate,
  onOpenCreateReq,
  onSelectReq,
  onUpdateReq,
  onDeleteReq,
  onPreviewResumeByName,
  onStatusChange,
  onOpenMatcher,
  onOpenSlaDrawer,
  onRefreshSla,
  showToast,
}) => {
  const [isEvaluatingSla, setIsEvaluatingSla] = useState(false);
  const [tableSearch, setTableSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [tableRows, setTableRows] = useState<Requirement[]>(() => requirements.slice(0, 10));
  const [totalRows, setTotalRows] = useState(requirements.length);
  const [isLoadingRows, setIsLoadingRows] = useState(false);
  const [editingReq, setEditingReq] = useState<Requirement | null>(null);
  const [reqToDelete, setReqToDelete] = useState<Requirement | null>(null);

  const debouncedSearch = useDebounce(tableSearch, 150);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  useEffect(() => {
    let active = true;
    const q = debouncedSearch.toLowerCase();
    const localFiltered = requirements.filter((r) => {
      const matchesSearch =
        !q ||
        r.opportunityTitle.toLowerCase().includes(q) ||
        r.companyName.toLowerCase().includes(q) ||
        r.code.toLowerCase().includes(q) ||
        (r.resourceName || '').toLowerCase().includes(q) ||
        r.skillsRequired.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
      return matchesSearch && matchesStatus;
    });

    if (requirements.length > 0) {
      setTotalRows(localFiltered.length);
      setTableRows(localFiltered.slice((page - 1) * limit, page * limit));
      setIsLoadingRows(false);
    } else {
      setIsLoadingRows(true);
    }

    apiClient
      .get('/requirements', {
        params: {
          search: debouncedSearch.trim() || undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          page,
          limit,
        },
      })
      .then((res) => {
        if (!active) return;
        if (res.data?.success && Array.isArray(res.data.data)) {
          const mapped = res.data.data.map(mapRequirementFromApi);
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
  }, [debouncedSearch, statusFilter, page, limit, requirements]);

  // 6 KPI Counts
  const activeReqsCount = requirements.length;
  const submittedCount = requirements.filter((r) => r.status === 'Submitted').length;
  const interviewsCount = requirements.filter((r) => r.status === 'Interview').length;
  const selectedCount = requirements.filter((r) => r.status === 'Selected').length;
  const onboardingCount = requirements.filter((r) => r.status === 'Onboarding').length;
  const activeBillableCount = placements.length;

  const filteredRequirements = tableRows;

  const getStatusBadgeClass = (status: Requirement['status']) => {
    switch (status) {
      case 'Submitted':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Interview':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Selected':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Onboarding':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <section className="max-w-7xl mx-auto space-y-6">
      {/* Top Header matching prototype lines 1965-1980 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Recruitment Operations Overview</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time candidate placement pipeline, active requirements, and billable roster.
          </p>
        </div>
      </div>

      {/* 6 KPI Summary Cards matching prototype lines 1983-2049 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Card 1: Active Reqs */}
        <div
          onClick={() => setStatusFilter('all')}
          className="p-4 rounded-xl border border-slate-200/80 bg-white card-shadow card-hover cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Active Reqs</span>
            <div className="w-6 h-6 rounded-md bg-slate-100 flex items-center justify-center text-slate-600 group-hover:bg-brand-50 group-hover:text-brand-600 transition-colors">
              <Briefcase className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{activeReqsCount}</div>
          <div className="text-[10px] text-slate-400 mt-1">
            <span className="text-emerald-600 font-medium">Open pipeline</span> orders
          </div>
        </div>

        {/* Card 2: Submitted */}
        <div
          onClick={() => setStatusFilter('Submitted')}
          className="p-4 rounded-xl border border-slate-200/80 bg-white card-shadow card-hover cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Submitted</span>
            <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center">
              <Send className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{submittedCount}</div>
          <div className="text-[10px] text-slate-400 mt-1">
            <span className="text-blue-600 font-medium">Client review</span>
          </div>
        </div>

        {/* Card 3: Interviews */}
        <div
          onClick={() => setStatusFilter('Interview')}
          className="p-4 rounded-xl border border-slate-200/80 bg-white card-shadow card-hover cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Interviews</span>
            <div className="w-6 h-6 rounded-md bg-amber-50 text-amber-600 flex items-center justify-center">
              <CalendarCheck className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{interviewsCount}</div>
          <div className="text-[10px] text-slate-400 mt-1">
            <span className="text-amber-600 font-medium">Active rounds</span>
          </div>
        </div>

        {/* Card 4: Selected */}
        <div
          onClick={() => setStatusFilter('Selected')}
          className="p-4 rounded-xl border border-slate-200/80 bg-white card-shadow card-hover cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Selected</span>
            <div className="w-6 h-6 rounded-md bg-purple-50 text-purple-600 flex items-center justify-center">
              <Award className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{selectedCount}</div>
          <div className="text-[10px] text-slate-400 mt-1">
            <span className="text-purple-600 font-medium">Offers finalized</span>
          </div>
        </div>

        {/* Card 5: Onboarding */}
        <div
          onClick={() => setStatusFilter('Onboarding')}
          className="p-4 rounded-xl border border-slate-200/80 bg-white card-shadow card-hover cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Onboarding</span>
            <div className="w-6 h-6 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <UserCheck className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{onboardingCount}</div>
          <div className="text-[10px] text-slate-400 mt-1">
            <span className="text-indigo-600 font-medium">Background check</span>
          </div>
        </div>

        {/* Card 6: Active Billable */}
        <div
          onClick={() => onNavigate('billable')}
          className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/30 card-shadow card-hover cursor-pointer group"
        >
          <div className="flex items-center justify-between text-emerald-800 mb-2">
            <span className="text-xs font-semibold">Active Billable</span>
            <div className="w-6 h-6 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <DollarSign className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-950">{activeBillableCount}</div>
          <div className="text-[10px] text-emerald-700 mt-1">Generating revenue</div>
        </div>
      </div>

      {/* Requirements Overview Table matching prototype lines 2052-2134 */}
      <div className="bg-white rounded-xl border border-slate-200/80 card-shadow overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-xs text-slate-900">Requirements Overview</span>
            <span className="text-[11px] text-slate-400 bg-white border border-slate-200 px-1.5 py-0.2 rounded">
              {totalRows} rows
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <input
              type="text"
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              placeholder="Filter rows..."
              className="px-2.5 py-1 text-xs border border-slate-200 rounded-md bg-white w-48 text-slate-700 focus:outline-none focus:border-brand-600"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1 text-xs border border-slate-200 rounded-md bg-white text-slate-700 focus:outline-none focus:border-brand-600 cursor-pointer"
            >
              <option value="all">All Stages</option>
              <option value="Requirement">Requirement</option>
              <option value="Submitted">Submitted</option>
              <option value="Interview">Interview</option>
              <option value="Selected">Selected</option>
              <option value="Onboarding">Onboarding</option>
            </select>
            <button
              onClick={onOpenCreateReq}
              className="px-2.5 py-1 rounded border border-slate-200 hover:bg-white text-xs font-medium text-slate-700 shadow-2xs transition-colors cursor-pointer inline-flex items-center gap-1"
            >
              <Plus className="w-3 h-3" strokeWidth={2.3} /> Add Req
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200/80 text-[10.5px] font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-3.5 py-2.5 whitespace-nowrap">Req #</th>
                <th className="px-3.5 py-2.5 whitespace-nowrap">Opportunity</th>
                <th className="px-3.5 py-2.5 whitespace-nowrap">Client Contact</th>
                <th className="px-3.5 py-2.5 whitespace-nowrap">Company</th>
                <th className="px-3.5 py-2.5 whitespace-nowrap">Location</th>
                <th className="px-3.5 py-2.5 whitespace-nowrap">Consultant</th>
                <th className="px-3.5 py-2.5 whitespace-nowrap">Status</th>
                <th className="px-3.5 py-2.5 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredRequirements.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-xs text-slate-400">
                    {tableSearch.trim() || statusFilter !== 'all' ? (
                      <>
                        No requirements match your current filters.{' '}
                        <button
                          type="button"
                          onClick={() => {
                            setTableSearch('');
                            setStatusFilter('all');
                          }}
                          className="font-semibold text-brand-600 hover:text-brand-700 hover:underline cursor-pointer"
                        >
                          Clear Filters
                        </button>
                      </>
                    ) : (
                      <>
                        No active requirements found. Click{' '}
                        <button
                          type="button"
                          onClick={onOpenCreateReq}
                          className="font-semibold text-brand-600 hover:text-brand-700 hover:underline cursor-pointer"
                        >
                          Add Req
                        </button>{' '}
                        to create a job order.
                      </>
                    )}
                  </td>
                </tr>
              ) : (
                filteredRequirements.map((req, idx) => {
                  const contactName =
                    typeof req.clientContact === 'object' && req.clientContact !== null
                      ? (req.clientContact as any).fullName || (req.clientContact as any).name || ''
                      : String(req.clientContact || '');

                  const contactTitle =
                    typeof req.clientContactTitle === 'object' && req.clientContactTitle !== null
                      ? (req.clientContactTitle as any).designation || ''
                      : String(req.clientContactTitle || '');

                  const rawDate = (req as any).createdAt;
                  const parsedDate =
                    rawDate && (typeof rawDate === 'string' || typeof rawDate === 'number' || rawDate instanceof Date)
                      ? new Date(rawDate)
                      : null;
                  const dateStr =
                    parsedDate && !isNaN(parsedDate.getTime())
                      ? parsedDate.toISOString().split('T')[0]
                      : new Date().toISOString().split('T')[0];

                  return (
                    <tr key={req.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        <div className="font-mono font-semibold text-[11px] text-slate-700">
                          {req.code}
                        </div>
                        <div className="text-[10px] text-slate-400 tabular-nums mt-0.5">
                          {dateStr}
                        </div>
                      </td>
                      <td className="px-3.5 py-3 font-medium text-slate-900 min-w-[220px] max-w-[280px]">
                        <div
                          className="cursor-pointer hover:text-brand-600 transition-colors truncate font-semibold"
                          title={req.opportunityTitle}
                          onClick={() => onSelectReq(req)}
                        >
                          {req.opportunityTitle}
                        </div>
                        {req.skillsRequired && (
                          <div className="text-[10.5px] text-slate-400 truncate mt-0.5" title={req.skillsRequired}>
                            {req.skillsRequired}
                          </div>
                        )}
                      </td>
                      <td className="px-3.5 py-3 text-slate-600 max-w-[160px]">
                        {contactName ? (
                          <>
                            <div className="font-medium text-slate-800 truncate" title={contactName}>
                              {contactName}
                            </div>
                            {contactTitle && (
                              <div className="text-[10px] text-slate-400 truncate" title={contactTitle}>
                                {contactTitle}
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-3.5 py-3 font-medium text-slate-800 max-w-[170px] truncate" title={req.companyName}>
                        {req.companyName || <span className="text-slate-300 font-normal">—</span>}
                      </td>
                      <td className="px-3.5 py-3 text-slate-600 max-w-[155px] truncate" title={req.location}>
                        {req.location || <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        {req.resourceName ? (
                          <span
                            className="font-medium text-slate-800 hover:text-brand-600 cursor-pointer transition-colors"
                            onClick={() => onPreviewResumeByName(req.resourceName!)}
                          >
                            {req.resourceName}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Unassigned</span>
                        )}
                      </td>
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        <select
                          value={req.status}
                          onChange={(e) => onStatusChange(req, e.target.value)}
                          className={`px-2 py-1 rounded-md text-[11px] font-medium border font-sans cursor-pointer outline-none ${getStatusBadgeClass(
                            req.status
                          )}`}
                        >
                          <option value="Requirement">Requirement</option>
                          <option value="Submitted">Submitted</option>
                          <option value="Interview">Interview</option>
                          <option value="Selected">Selected</option>
                          <option value="Onboarding">Onboarding</option>
                        </select>
                      </td>
                      <td className="px-3.5 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1">
                          {onUpdateReq && (
                            <button
                              type="button"
                              onClick={() => setEditingReq({ ...req })}
                              title="Edit requirement"
                              className="p-1.5 rounded-md text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {onDeleteReq && (
                            <button
                              type="button"
                              onClick={() => setReqToDelete(req)}
                              title="Delete requirement"
                              className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
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
          itemLabel="requirements"
          isLoading={isLoadingRows}
        />
      </div>

      {/* 2-Column Dashboard Lower Section matching prototype lines 2135-2220 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-1">
        {/* Left: Today's Priority Action Queue */}
        <div className="lg:col-span-6 bg-white rounded-xl border border-slate-200/80 card-shadow p-5 space-y-3.5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                <ListChecks className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-xs text-slate-900">Today's Priority Action Queue</h3>
                  <span className="text-[9px] bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded border border-emerald-200 font-semibold">
                    {slaTasks.filter((t) => !t.done).length} Pending
                  </span>
                </div>
                <span className="text-[10px] text-slate-400">
                  Overdue client feedback, interviews, and expiring contracts
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  if (isEvaluatingSla) return;
                  setIsEvaluatingSla(true);
                  try {
                    const res = await apiClient.post('/sla-tasks/evaluate');
                    const count = res.data?.data?.createdTasksCount ?? 0;
                    await onRefreshSla?.();
                    showToast('Rules Evaluated', `Evaluated SLA criteria across pipeline (${count} new alert(s)).`);
                  } catch {
                    showToast('Evaluation Failed', 'Unable to evaluate SLA rules right now.', 'fa-solid fa-triangle-exclamation text-rose-500');
                  } finally {
                    setIsEvaluatingSla(false);
                  }
                }}
                disabled={isEvaluatingSla}
                title="Re-evaluate SLA rules across pipeline"
                className="w-6 h-6 rounded border border-slate-200 text-slate-600 hover:text-brand-600 hover:bg-slate-50 disabled:opacity-60 flex items-center justify-center text-[11px] transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${isEvaluatingSla ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={onOpenSlaDrawer}
                className="text-xs font-semibold text-brand-600 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Open Queue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {slaTasks.filter((t) => !t.done).length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
                No pending SLA priority actions right now.
              </div>
            ) : (
              slaTasks
                .filter((t) => !t.done)
                .slice(0, 3)
                .map((item) => {
                  const categoryBadge =
                    item.slaRuleTag ||
                    String(item.category || '')
                      .replace(/_/g, ' ')
                      .toLowerCase()
                      .replace(/\b\w/g, (ch) => ch.toUpperCase());
                  const actionType = String(item.actionType || '').toLowerCase();
                  return (
                    <div
                      key={item.id}
                      className="p-2.5 bg-slate-50/80 hover:bg-slate-100/70 rounded-lg border border-slate-200/60 flex items-center justify-between text-xs transition-colors"
                    >
                      <div className="space-y-0.5 overflow-hidden pr-2">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded border whitespace-nowrap ${
                              item.badgeClass || 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            {categoryBadge}
                          </span>
                          <span className="font-semibold text-slate-800 text-[11px] truncate">{item.title}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 truncate">{item.desc}</div>
                      </div>
                      {actionType === 'matcher' ? (
                        <button
                          onClick={() => {
                            const r =
                              (item.relatedEntityId
                                ? requirements.find((x) => x.id === item.relatedEntityId)
                                : undefined) || requirements[0];
                            if (r) onOpenMatcher(r);
                          }}
                          className="flex-shrink-0 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-medium hover:bg-emerald-200 transition-colors cursor-pointer"
                        >
                          Match
                        </button>
                      ) : actionType === 'billable' ? (
                        <button
                          onClick={() => onNavigate('billable')}
                          className="flex-shrink-0 px-2 py-0.5 rounded bg-purple-100 text-purple-800 text-[10px] font-medium hover:bg-purple-200 transition-colors cursor-pointer"
                        >
                          Review
                        </button>
                      ) : actionType === 'checklist' ? (
                        <button
                          onClick={() => onNavigate('vendors')}
                          className="flex-shrink-0 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-medium hover:bg-emerald-200 transition-colors cursor-pointer"
                        >
                          Audit
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            const r = item.relatedEntityId
                              ? requirements.find((x) => x.id === item.relatedEntityId)
                              : undefined;
                            if (r) onSelectReq(r);
                            else onNavigate('pipeline');
                          }}
                          className="flex-shrink-0 px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-medium hover:bg-blue-200 transition-colors cursor-pointer"
                        >
                          View
                        </button>
                      )}
                    </div>
                  );
                })
            )}
          </div>
        </div>

        {/* Right: Live Billable Consultants Summary */}
        <div className="lg:col-span-6 bg-white rounded-xl border border-slate-200/80 card-shadow p-5 space-y-3.5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-xs text-slate-900">Active Billable Consultants (Live Sync)</h3>
                <span className="text-[10px] text-slate-400">Auto-updated when candidates complete onboarding</span>
              </div>
            </div>
            <button
              onClick={() => onNavigate('billable')}
              className="text-xs font-semibold text-emerald-700 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>View All ({placements.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2">
            {placements.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
                No active billable consultants yet.
              </div>
            ) : (
              placements.slice(0, 3).map((b) => (
                <div
                  key={b.id}
                  className="p-2.5 bg-emerald-50/30 hover:bg-emerald-50/60 rounded-lg border border-emerald-100 flex items-center justify-between text-xs transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span
                        onClick={() => onPreviewResumeByName(b.resourceName)}
                        className="font-bold text-slate-900 text-xs cursor-pointer hover:text-brand-600 transition-colors"
                      >
                        {b.resourceName}
                      </span>
                      <span className="text-[9px] bg-white border border-slate-200 px-1 py-0.2 rounded text-slate-600">
                        {b.deployment}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {b.customer} &bull; {b.skillRole}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-emerald-700 text-xs">
                      <MaskedValue value={b.billing} isMasked={rateMasked} />
                    </span>
                    <div className="text-[9px] text-slate-400">Ends {b.endDate}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Edit Requisition Modal */}
      {editingReq && (
        <div
          onClick={() => setEditingReq(null)}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-scale-up"
          >
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono font-semibold text-brand-700 bg-brand-50 border border-brand-200 px-2 py-0.5 rounded">
                  {editingReq.code}
                </span>
                <h3 className="text-sm font-bold text-slate-900">Edit Requisition</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingReq(null)}
                className="text-slate-400 hover:text-slate-700 w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 cursor-pointer"
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
              className="p-6 space-y-4 text-xs"
            >
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Opportunity Title</label>
                <input
                  type="text"
                  required
                  value={editingReq.opportunityTitle}
                  onChange={(e) => setEditingReq({ ...editingReq, opportunityTitle: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Client Company</label>
                  <input
                    type="text"
                    required
                    value={editingReq.companyName}
                    onChange={(e) => setEditingReq({ ...editingReq, companyName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                  />
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
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Stage</label>
                  <select
                    value={editingReq.status}
                    onChange={(e) => setEditingReq({ ...editingReq, status: e.target.value as Requirement['status'] })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:border-brand-600 focus:outline-none cursor-pointer"
                  >
                    <option value="Requirement">Requirement</option>
                    <option value="Submitted">Submitted</option>
                    <option value="Interview">Interview</option>
                    <option value="Selected">Selected</option>
                    <option value="Onboarding">Onboarding</option>
                  </select>
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
    </section>
  );
};
