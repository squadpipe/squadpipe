import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  Briefcase,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Search,
  Send,
  Users,
} from 'lucide-react';
import { apiClient } from '../../config/api.config';
import { RecruiterPerformanceRow } from '../../types';
import { formatUserRole } from '../../utils/entityMappers';
import { SortableTableHeader } from '../../components/shared/SortableTableHeader';
import { TablePagination } from '../../components/shared/TablePagination';
import { useClientPagination } from '../../utils/usePagination';
import { useTableSort } from '../../utils/tableSort';

type PerformancePeriod = 'week' | 'month' | 'all';

interface TeamPerformanceViewProps {
  showToast?: (title: string, message: string, icon?: string) => void;
}

export const TeamPerformanceView: React.FC<TeamPerformanceViewProps> = ({ showToast }) => {
  const [period, setPeriod] = useState<PerformancePeriod>('week');
  const [search, setSearch] = useState('');
  const [team, setTeam] = useState<RecruiterPerformanceRow[]>([]);
  const [totals, setTotals] = useState({
    openReqs: 0,
    submissions: 0,
    interviews: 0,
    placements: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const perfSort = useTableSort<
    'recruiterName' | 'openReqs' | 'submissions' | 'interviews' | 'placements' | 'conversionPct'
  >();

  const fetchPerformance = async (targetPeriod: PerformancePeriod = period, manualRefresh = false) => {
    setIsLoading(true);
    try {
      const res = await apiClient.get('/dashboard/recruiter-performance', {
        params: { period: targetPeriod, ...perfSort.sortParams },
      });
      const report = res.data?.data;
      if (report && Array.isArray(report.team)) {
        setTeam(report.team);
        setTotals(
          report.totals || { openReqs: 0, submissions: 0, interviews: 0, placements: 0 }
        );
      }
      if (manualRefresh && showToast) {
        showToast(
          'Scorecard Refreshed',
          'Recruiter activity and conversion metrics updated.',
          'fa-solid fa-rotate text-brand-500'
        );
      }
    } catch (err: any) {
      if (showToast) {
        showToast(
          'Performance Load Failed',
          err?.response?.data?.message || 'Unable to load recruiter performance metrics.',
          'fa-solid fa-triangle-exclamation text-rose-500'
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    apiClient
      .get('/dashboard/recruiter-performance', {
        params: { period, ...perfSort.sortParams },
      })
      .then((res) => {
        if (!active) return;
        const report = res.data?.data;
        if (report && Array.isArray(report.team)) {
          setTeam(report.team);
          setTotals(
            report.totals || { openReqs: 0, submissions: 0, interviews: 0, placements: 0 }
          );
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [period, perfSort.sort.sortBy, perfSort.sort.sortDir, perfSort.sortParams]);

  const filteredTeam = search.trim()
    ? team.filter((row) => {
        const q = search.toLowerCase();
        return (
          row.fullName.toLowerCase().includes(q) ||
          formatUserRole(row.role).toLowerCase().includes(q) ||
          (row.desk || '').toLowerCase().includes(q)
        );
      })
    : team;

  const pg = useClientPagination(
    filteredTeam,
    10,
    `${period}|${search}|${perfSort.sort.sortBy || ''}|${perfSort.sort.sortDir}`
  );

  const teamInterviewRate =
    totals.submissions > 0 ? Math.round((totals.interviews / totals.submissions) * 100) : 0;
  const teamPlacementRate =
    totals.submissions > 0 ? Math.round((totals.placements / totals.submissions) * 100) : 0;

  return (
    <section className="max-w-7xl mx-auto space-y-5 animate-fade-in">
      {/* Unified Header + 4-Col Team KPI Strip */}
      <div className="bg-white rounded-xl border border-slate-200/80 card-shadow overflow-hidden">
        <div className="px-6 py-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-200/70 text-brand-600 flex items-center justify-center flex-shrink-0">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-[17px] sm:text-[18px] font-bold text-slate-900 tracking-tight">
                  Team Performance
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-slate-100 text-slate-600">
                  {team.length} {team.length === 1 ? 'Recruiter' : 'Recruiters'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Administrator view of recruiter workload, submittal output, interview progress, and placement conversion rates.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <div className="inline-flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
              {(
                [
                  { id: 'week', label: 'This Week' },
                  { id: 'month', label: 'This Month' },
                  { id: 'all', label: 'All Time' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPeriod(opt.id)}
                  className={`px-3 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                    period === opt.id
                      ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={isLoading}
              onClick={() => void fetchPerformance(period, true)}
              title="Refresh recruiter metrics"
              className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 hover:text-brand-600 hover:bg-slate-50 disabled:opacity-60 inline-flex items-center gap-1.5 text-[11px] font-semibold transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* 4-Column Summary Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 border-t border-slate-100 bg-slate-50/45 text-xs">
          <div className="px-6 py-3.5 space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Briefcase className="w-3 h-3 text-slate-400" />
              <span>Open Requisitions</span>
            </div>
            <div className="text-lg font-extrabold text-slate-900 tabular-nums">
              {totals.openReqs.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-500">Assigned active job orders</div>
          </div>

          <div className="px-6 py-3.5 space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Send className="w-3 h-3 text-brand-600" />
              <span>Candidate Submissions</span>
            </div>
            <div className="text-lg font-extrabold text-slate-900 tabular-nums">
              {totals.submissions.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-500">
              {period === 'week'
                ? 'Submitted in last 7 days'
                : period === 'month'
                  ? 'Submitted in last 30 days'
                  : 'All-time submittals'}
            </div>
          </div>

          <div className="px-6 py-3.5 space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Users className="w-3 h-3 text-indigo-600" />
              <span>Interviews</span>
            </div>
            <div className="text-lg font-extrabold text-slate-900 tabular-nums">
              {totals.interviews.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-500">
              {teamInterviewRate}% sub-to-interview rate
            </div>
          </div>

          <div className="px-6 py-3.5 space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>Placements &amp; Conversion</span>
            </div>
            <div className="text-lg font-extrabold text-emerald-700 tabular-nums">
              {totals.placements.toLocaleString()}
              <span className="ml-2 text-xs font-semibold text-slate-500">
                ({teamPlacementRate}%)
              </span>
            </div>
            <div className="text-[11px] text-slate-500">Overall submittal conversion</div>
          </div>
        </div>
      </div>

      {/* Recruiter Scorecard Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 card-shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-xs text-slate-900">
              Recruiter Scorecard ({filteredTeam.length})
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Sort any column to compare recruiter volume and conversion ratios.
            </p>
          </div>
          {team.length > 0 && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter by recruiter, role, or desk..."
                className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white w-full sm:w-64 text-slate-700 focus:outline-none focus:border-brand-600"
              />
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          {isLoading && team.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-brand-600" />
              <span>Loading recruiter scorecard...</span>
            </div>
          ) : filteredTeam.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400">
              {team.length === 0
                ? 'No recruiter activity recorded for this period yet.'
                : `No team members match "${search}".`}
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-100 text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
                <tr>
                  <SortableTableHeader
                    label="Recruiter"
                    column="recruiterName"
                    sort={perfSort.sort}
                    onSort={perfSort.handleSort}
                    defaultDir="asc"
                    className="pl-6 pr-4 py-3 whitespace-nowrap"
                  />
                  <SortableTableHeader
                    label="Open Reqs"
                    column="openReqs"
                    sort={perfSort.sort}
                    onSort={perfSort.handleSort}
                    defaultDir="desc"
                    align="right"
                    className="px-4 py-3 whitespace-nowrap"
                  />
                  <SortableTableHeader
                    label="Submissions"
                    column="submissions"
                    sort={perfSort.sort}
                    onSort={perfSort.handleSort}
                    defaultDir="desc"
                    align="right"
                    className="px-4 py-3 whitespace-nowrap"
                  />
                  <SortableTableHeader
                    label="Interviews"
                    column="interviews"
                    sort={perfSort.sort}
                    onSort={perfSort.handleSort}
                    defaultDir="desc"
                    align="right"
                    className="px-4 py-3 whitespace-nowrap"
                  />
                  <SortableTableHeader
                    label="Placements"
                    column="placements"
                    sort={perfSort.sort}
                    onSort={perfSort.handleSort}
                    defaultDir="desc"
                    align="right"
                    className="px-4 py-3 whitespace-nowrap"
                  />
                  <SortableTableHeader
                    label="Conversion %"
                    column="conversionPct"
                    sort={perfSort.sort}
                    onSort={perfSort.handleSort}
                    defaultDir="desc"
                    align="right"
                    className="pl-4 pr-6 py-3 whitespace-nowrap"
                  />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pg.pagedItems.map((row) => {
                  const interviewRate =
                    row.submissions > 0
                      ? Math.round((row.interviews / row.submissions) * 100)
                      : 0;
                  const placementRate =
                    row.submissions > 0
                      ? Math.round((row.placements / row.submissions) * 100)
                      : 0;
                  const initials = (row.fullName || 'U')
                    .split(/\s+/)
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2);

                  return (
                    <tr key={row.userId} className="hover:bg-slate-50/70 transition-colors">
                      <td className="pl-6 pr-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-bold text-[10px] flex items-center justify-center flex-shrink-0">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 truncate">
                              {row.fullName}
                            </div>
                            <div className="text-[10.5px] text-slate-400 truncate">
                              {formatUserRole(row.role)}
                              {row.desk ? ` · ${row.desk}` : ''}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right font-semibold text-slate-700 tabular-nums">
                        {row.openReqs}
                      </td>
                      <td className="px-4 py-3.5 text-right font-semibold text-slate-900 tabular-nums">
                        {row.submissions}
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums">
                        <span className="font-semibold text-slate-800">{row.interviews}</span>
                        {row.submissions > 0 && (
                          <span className="ml-1.5 text-[10px] text-slate-400">
                            ({interviewRate}%)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right font-bold text-emerald-700 tabular-nums">
                        {row.placements}
                      </td>
                      <td className="pl-4 pr-6 py-3.5 text-right whitespace-nowrap tabular-nums">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-bold border ${
                            placementRate >= 15
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : placementRate > 0
                                ? 'bg-brand-50 text-brand-700 border-brand-200'
                                : 'bg-slate-100 text-slate-500 border-slate-200'
                          }`}
                        >
                          {placementRate}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50 border-t border-slate-200 text-[11px] font-bold text-slate-800">
                <tr>
                  <td className="pl-6 pr-4 py-3">Team Totals</td>
                  <td className="px-4 py-3 text-right tabular-nums">{totals.openReqs}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{totals.submissions}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{totals.interviews}</td>
                  <td className="px-4 py-3 text-right text-emerald-700 tabular-nums">
                    {totals.placements}
                  </td>
                  <td className="pl-4 pr-6 py-3 text-right tabular-nums">{teamPlacementRate}%</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        <TablePagination
          page={pg.page}
          limit={pg.limit}
          total={pg.total}
          onPageChange={pg.setPage}
          onLimitChange={pg.setLimit}
          itemLabel="recruiters"
          pageSizeOptions={[10, 20, 50]}
        />
      </div>
    </section>
  );
};
