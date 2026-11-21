import React, { useEffect, useState } from 'react';
import {
  Briefcase,
  CheckCircle2,
  Loader2,
  Percent,
  RefreshCw,
  Search,
  Send,
  User,
  UserCheck,
  Users,
} from 'lucide-react';
import { apiClient } from '../../config/api.config';
import { RecruiterPerformanceRow } from '../../types';
import { formatUserRole } from '../../utils/entityMappers';
import { PageHeader } from '../../components/shared/PageHeader';
import { SegmentedControl } from '../../components/shared/SegmentedControl';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { SortableTableHeader } from '../../components/shared/SortableTableHeader';
import {
  STAFFING_GRID_CELL_CLASS,
  STAFFING_GRID_FRAME_CLASS,
  STAFFING_GRID_ROW_STATIC_CLASS,
  STAFFING_GRID_STICKY_TD_CLASS,
  STAFFING_GRID_STICKY_TH_CLASS,
  STAFFING_GRID_TABLE_CLASS,
  STAFFING_GRID_THEAD_CLASS,
  STAFFING_GRID_TH_CLASS,
} from '../../components/shared/StaffingGrid';
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
          'refresh'
        );
      }
    } catch (err: any) {
      if (showToast) {
        showToast(
          'Performance Load Failed',
          err?.response?.data?.message || 'Unable to load recruiter performance metrics.',
          'error'
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
      .catch(() => { })
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
    <section className="max-w-7xl mx-auto px-1 sm:px-2 lg:px-4 space-y-5 pb-8 animate-fade-in">
      <PageHeader
        title="Team Performance"
        subtitle="Administrator view of recruiter workload, submittal output, interview progress, and placement conversion rates."
        badges={
          <span className="text-xs font-medium text-slate-500 tabular-nums">
            {team.length} {team.length === 1 ? 'recruiter' : 'recruiters'}
          </span>
        }
        actions={
          <>
            <SegmentedControl<PerformancePeriod>
              value={period}
              onChange={setPeriod}
              ariaLabel="Performance time window"
              options={[
                { value: 'week', label: 'This Week' },
                { value: 'month', label: 'This Month' },
                { value: 'all', label: 'All Time' },
              ]}
            />
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
          </>
        }
      />

      {/* 4-Column Team KPI Summary Strip */}
      <div className="bg-white rounded-xl border border-slate-200/90 card-shadow overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 text-xs">
          <div className="px-6 py-4 space-y-1.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-slate-400" />
              <span>Open Requisitions</span>
            </div>
            <div className="text-lg font-bold font-mono text-slate-900 tabular-nums">
              {totals.openReqs.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-500">Assigned active job orders</div>
          </div>

          <div className="px-6 py-4 space-y-1.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5 text-brand-600" />
              <span>Candidate Submissions</span>
            </div>
            <div className="text-lg font-bold font-mono text-slate-900 tabular-nums">
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

          <div className="px-6 py-4 space-y-1.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-indigo-600" />
              <span>Interviews</span>
            </div>
            <div className="text-lg font-bold font-mono text-slate-900 tabular-nums">
              {totals.interviews.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-500">
              {teamInterviewRate}% sub-to-interview rate
            </div>
          </div>

          <div className="px-6 py-4 space-y-1.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Placements &amp; Conversion</span>
            </div>
            <div className="text-lg font-bold font-mono text-emerald-700 tabular-nums">
              {totals.placements.toLocaleString()}
              <span className="ml-2 text-xs font-sans font-semibold text-slate-500">
                ({teamPlacementRate}%)
              </span>
            </div>
            <div className="text-[11px] text-slate-500">Overall submittal conversion</div>
          </div>
        </div>
      </div>

      {/* Recruiter Scorecard Table */}
      <div className={STAFFING_GRID_FRAME_CLASS}>
        <div className="px-5 py-3 border-b border-slate-200/80 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-xs text-slate-900">
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
                className="h-8 pl-8 pr-3 text-xs border border-slate-200 rounded-lg bg-white w-full sm:w-64 text-slate-700 focus:outline-none focus:border-brand-600"
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
            <table className={STAFFING_GRID_TABLE_CLASS}>
              <thead className={STAFFING_GRID_THEAD_CLASS}>
                <tr>
                  <SortableTableHeader
                    label="Recruiter"
                    icon={<User className="w-3 h-3" />}
                    column="recruiterName"
                    sort={perfSort.sort}
                    onSort={perfSort.handleSort}
                    defaultDir="asc"
                    className={`${STAFFING_GRID_TH_CLASS} ${STAFFING_GRID_STICKY_TH_CLASS}`}
                  />
                  <SortableTableHeader
                    label="Open Reqs"
                    icon={<Briefcase className="w-3 h-3" />}
                    column="openReqs"
                    sort={perfSort.sort}
                    onSort={perfSort.handleSort}
                    defaultDir="desc"
                    align="right"
                    className={STAFFING_GRID_TH_CLASS}
                  />
                  <SortableTableHeader
                    label="Submissions"
                    icon={<Send className="w-3 h-3" />}
                    column="submissions"
                    sort={perfSort.sort}
                    onSort={perfSort.handleSort}
                    defaultDir="desc"
                    align="right"
                    className={STAFFING_GRID_TH_CLASS}
                  />
                  <SortableTableHeader
                    label="Interviews"
                    icon={<UserCheck className="w-3 h-3" />}
                    column="interviews"
                    sort={perfSort.sort}
                    onSort={perfSort.handleSort}
                    defaultDir="desc"
                    align="right"
                    className={STAFFING_GRID_TH_CLASS}
                  />
                  <SortableTableHeader
                    label="Placements"
                    icon={<CheckCircle2 className="w-3 h-3" />}
                    column="placements"
                    sort={perfSort.sort}
                    onSort={perfSort.handleSort}
                    defaultDir="desc"
                    align="right"
                    className={STAFFING_GRID_TH_CLASS}
                  />
                  <SortableTableHeader
                    label="Conversion %"
                    icon={<Percent className="w-3 h-3" />}
                    column="conversionPct"
                    sort={perfSort.sort}
                    onSort={perfSort.handleSort}
                    defaultDir="desc"
                    align="right"
                    className={STAFFING_GRID_TH_CLASS}
                  />
                </tr>
              </thead>
              <tbody className="text-slate-700">
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
                    <tr key={row.userId} className={STAFFING_GRID_ROW_STATIC_CLASS}>
                      <td className={`${STAFFING_GRID_CELL_CLASS} ${STAFFING_GRID_STICKY_TD_CLASS}`}>
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-bold text-[11px] flex items-center justify-center flex-shrink-0">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 truncate">
                              {row.fullName}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate">
                              {formatUserRole(row.role)}
                              {row.desk ? ` · ${row.desk}` : ''}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className={`${STAFFING_GRID_CELL_CLASS} text-right font-semibold text-slate-700 tabular-nums`}>
                        {row.openReqs}
                      </td>
                      <td className={`${STAFFING_GRID_CELL_CLASS} text-right font-semibold text-slate-900 tabular-nums`}>
                        {row.submissions}
                      </td>
                      <td className={`${STAFFING_GRID_CELL_CLASS} text-right tabular-nums`}>
                        <span className="font-semibold text-slate-800">{row.interviews}</span>
                        {row.submissions > 0 && (
                          <span className="ml-1.5 text-[11px] text-slate-400">
                            ({interviewRate}%)
                          </span>
                        )}
                      </td>
                      <td className={`${STAFFING_GRID_CELL_CLASS} text-right font-bold text-emerald-700 tabular-nums`}>
                        {row.placements}
                      </td>
                      <td className={`${STAFFING_GRID_CELL_CLASS} text-right whitespace-nowrap tabular-nums`}>
                        <StatusBadge
                          tone={
                            placementRate >= 15
                              ? 'emerald'
                              : placementRate > 0
                                ? 'brand'
                                : 'slate'
                          }
                          size="xs"
                          label={`${placementRate}%`}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="text-[11px] font-bold text-slate-800">
                <tr>
                  <td className={`${STAFFING_GRID_CELL_CLASS} sticky left-0 z-10 bg-slate-50 shadow-[2px_0_6px_-4px_rgba(15,23,42,0.06)]`}>Team Totals</td>
                  <td className={`${STAFFING_GRID_CELL_CLASS} text-right tabular-nums`}>{totals.openReqs}</td>
                  <td className={`${STAFFING_GRID_CELL_CLASS} text-right tabular-nums`}>{totals.submissions}</td>
                  <td className={`${STAFFING_GRID_CELL_CLASS} text-right tabular-nums`}>{totals.interviews}</td>
                  <td className={`${STAFFING_GRID_CELL_CLASS} text-right text-emerald-700 tabular-nums`}>
                    {totals.placements}
                  </td>
                  <td className={`${STAFFING_GRID_CELL_CLASS} text-right tabular-nums`}>{teamPlacementRate}%</td>
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
