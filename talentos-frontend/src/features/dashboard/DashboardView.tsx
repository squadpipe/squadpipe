import React, { useState } from 'react';
import { apiClient } from '../../config/api.config';
import { Requirement, Candidate, BillablePlacement, SlaTask } from '../../types';
import { MaskedValue } from '../../components/shared/MaskedValue';

interface DashboardViewProps {
  requirements: Requirement[];
  candidates: Candidate[];
  placements: BillablePlacement[];
  slaTasks: SlaTask[];
  rateMasked: boolean;
  onNavigate: (view: string) => void;
  onOpenCreateReq: () => void;
  onSelectReq: (req: Requirement) => void;
  onPreviewResumeByName: (candidateName: string) => void;
  onStatusChange: (req: Requirement, newStatus: any) => void;
  onOpenMatcher: (req: Requirement) => void;
  onOpenPitchWriter: (req: Requirement) => void;
  onOpenSlaDrawer: () => void;
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
  onPreviewResumeByName,
  onStatusChange,
  onOpenMatcher,
  onOpenPitchWriter,
  onOpenSlaDrawer,
  showToast,
}) => {
  const [tableSearch, setTableSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [remarksState, setRemarksState] = useState<Record<string, string>>({});

  // 6 KPI Counts
  const activeReqsCount = requirements.length;
  const submittedCount = requirements.filter((r) => r.status === 'Submitted').length;
  const interviewsCount = requirements.filter((r) => r.status === 'Interview').length;
  const selectedCount = requirements.filter((r) => r.status === 'Selected').length;
  const onboardingCount = requirements.filter((r) => r.status === 'Onboarding').length;
  const activeBillableCount = placements.length;

  const filteredRequirements = requirements.filter((r) => {
    const matchesSearch =
      r.opportunityTitle.toLowerCase().includes(tableSearch.toLowerCase()) ||
      r.companyName.toLowerCase().includes(tableSearch.toLowerCase()) ||
      r.code.toLowerCase().includes(tableSearch.toLowerCase()) ||
      (r.resourceName || '').toLowerCase().includes(tableSearch.toLowerCase()) ||
      r.skillsRequired.toLowerCase().includes(tableSearch.toLowerCase());

    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

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

  const handleExport = (type: 'Excel' | 'PDF') => {
    if (type === 'Excel') {
      const headers = ['Req Code', 'Opportunity Title', 'Client Company', 'Client Contact', 'Location', 'Skills Required', 'Assigned Resource', 'Status'];
      const rows = filteredRequirements.map((r) => [
        `"${r.code}"`,
        `"${r.opportunityTitle}"`,
        `"${r.companyName}"`,
        `"${r.clientContact}"`,
        `"${r.location}"`,
        `"${r.skillsRequired.replace(/"/g, '""')}"`,
        `"${r.resourceName || '-'}"`,
        `"${r.status}"`,
      ]);
      const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `TalentOS_Requirements_Pipeline_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      showToast('Export Complete', 'Downloaded TalentOS Requirements Pipeline spreadsheet.', 'fa-regular fa-file-excel text-emerald-600');
    } else {
      window.print();
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
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExport('Excel')}
            className="px-3 py-1.5 rounded-md border border-slate-200 hover:bg-white text-slate-700 text-xs font-medium flex items-center gap-1.5 bg-white shadow-2xs transition-colors cursor-pointer"
          >
            <i className="fa-regular fa-file-excel text-emerald-600 text-xs"></i>
            <span>Export to Excel</span>
          </button>
          <button
            onClick={() => handleExport('PDF')}
            className="px-3 py-1.5 rounded-md border border-slate-200 hover:bg-white text-slate-700 text-xs font-medium flex items-center gap-1.5 bg-white shadow-2xs transition-colors cursor-pointer"
          >
            <i className="fa-regular fa-file-pdf text-rose-600 text-xs"></i>
            <span>Export to PDF</span>
          </button>
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
              <i className="fa-solid fa-briefcase text-xs"></i>
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
              <i className="fa-solid fa-paper-plane text-xs"></i>
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
              <i className="fa-solid fa-calendar-check text-xs"></i>
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
              <i className="fa-solid fa-award text-xs"></i>
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
              <i className="fa-solid fa-user-check text-xs"></i>
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
              <i className="fa-solid fa-dollar-sign text-xs"></i>
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
              {filteredRequirements.length} rows
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
              className="px-2.5 py-1 rounded border border-slate-200 hover:bg-white text-xs font-medium text-slate-700 shadow-2xs transition-colors cursor-pointer"
            >
              <i className="fa-solid fa-plus text-[10px] mr-1"></i> Add Req
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Date Received</th>
                <th className="px-4 py-3">Opportunity</th>
                <th className="px-4 py-3">Client Contact</th>
                <th className="px-4 py-3">Company Name</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Resource Name</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Remarks</th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredRequirements.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-10 text-center text-xs text-slate-400">
                    No active requirements found. Click{' '}
                    <button
                      type="button"
                      onClick={onOpenCreateReq}
                      className="font-semibold text-brand-600 hover:text-brand-700 hover:underline cursor-pointer"
                    >
                      Add Req
                    </button>{' '}
                    to create a job order.
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
                    <tr key={req.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 text-[11px] text-slate-500 whitespace-nowrap">
                        {dateStr}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900 max-w-xs">
                        <div
                          className="flex items-center gap-1.5 cursor-pointer hover:text-brand-600 transition-colors"
                          onClick={() => onSelectReq(req)}
                        >
                          <span className="truncate font-semibold">{req.opportunityTitle}</span>
                          <span className="text-[9px] text-slate-400 bg-slate-100 px-1 py-0.2 rounded">
                            {req.code}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 truncate mt-0.5">{req.skillsRequired}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        <div className="font-medium text-slate-800">{contactName}</div>
                        <div className="text-[10px] text-slate-400">{contactTitle}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-semibold text-slate-800">
                        {req.companyName}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600">{req.location}</td>
                      <td className="px-4 py-3">
                        {req.resourceName ? (
                          <div className="flex items-center gap-1.5">
                            <span
                              className="font-medium text-slate-800 hover:text-brand-600 cursor-pointer transition-colors"
                              onClick={() => onPreviewResumeByName(req.resourceName!)}
                            >
                              {req.resourceName}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <select
                          value={req.status}
                          onChange={(e) => onStatusChange(req, e.target.value)}
                          className={`px-2 py-0.5 rounded text-[11px] font-medium border font-sans cursor-pointer ${getStatusBadgeClass(
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
                      <td className="px-4 py-3 max-w-xs">
                        <input
                          value={remarksState[req.id] ?? ''}
                          onChange={(e) => setRemarksState({ ...remarksState, [req.id]: e.target.value })}
                          onBlur={() => showToast('Remarks Saved', `Saved notes for ${req.code}`)}
                          placeholder="Click to add remarks..."
                          className="w-full bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-slate-200 focus:border-brand-600 rounded px-1.5 py-0.5 text-xs text-slate-700 truncate outline-none"
                        />
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => onSelectReq(req)}
                          title="View Requisition Details"
                          className="text-slate-400 hover:text-brand-600 p-1 transition-colors cursor-pointer"
                        >
                          <i className="fa-solid fa-arrow-up-right-from-square text-[11px]"></i>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2-Column Dashboard Lower Section matching prototype lines 2135-2220 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-1">
        {/* Left: Today's Priority Action Queue */}
        <div className="lg:col-span-6 bg-white rounded-xl border border-slate-200/80 card-shadow p-5 space-y-3.5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center text-xs">
                <i className="fa-solid fa-list-check"></i>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-xs text-slate-900">Today's Priority Action Queue</h3>
                  <span className="text-[9px] bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded border border-emerald-200 font-semibold">
                    {slaTasks.length} Rules
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
                  try {
                    const res = await apiClient.post('/sla-tasks/evaluate');
                    const count = res.data?.data?.createdTasksCount ?? 0;
                    showToast('Rules Evaluated', `Evaluated SLA criteria across pipeline (${count} alert(s) synced).`);
                  } catch {
                    showToast('Evaluation Failed', 'Unable to evaluate SLA rules right now.', 'fa-solid fa-triangle-exclamation text-rose-500');
                  }
                }}
                title="Re-evaluate SLA rules across pipeline"
                className="w-6 h-6 rounded border border-slate-200 text-slate-600 hover:text-brand-600 hover:bg-slate-50 flex items-center justify-center text-[11px] transition-colors cursor-pointer"
              >
                <i className="fa-solid fa-rotate"></i>
              </button>
              <button
                onClick={onOpenSlaDrawer}
                className="text-xs font-semibold text-brand-600 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Open Queue</span> &rarr;
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {slaTasks.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
                No pending SLA priority actions right now.
              </div>
            ) : (
              slaTasks.slice(0, 3).map((item) => (
              <div
                key={item.id}
                className="p-2.5 bg-slate-50/80 hover:bg-slate-100/70 rounded-lg border border-slate-200/60 flex items-center justify-between text-xs transition-colors"
              >
                <div className="space-y-0.5 overflow-hidden pr-2">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                        item.badgeClass || 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      {item.category}
                    </span>
                    <span className="font-semibold text-slate-800 text-[11px] truncate">{item.title}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">{item.desc}</div>
                </div>
                {item.actionType === 'pitch' ? (
                  <button
                    onClick={() => {
                      const r = requirements.find((x) => x.id);
                      if (r) onOpenPitchWriter(r);
                    }}
                    className="flex-shrink-0 px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-medium hover:bg-amber-200 transition-colors"
                  >
                    Follow-up
                  </button>
                ) : item.actionType === 'matcher' ? (
                  <button
                    onClick={() => {
                      const r = requirements.find((x) => x.id);
                      if (r) onOpenMatcher(r);
                    }}
                    className="flex-shrink-0 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-medium hover:bg-emerald-200 transition-colors"
                  >
                    Match
                  </button>
                ) : (
                  <button
                    onClick={() => onNavigate('pipeline')}
                    className="flex-shrink-0 px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-medium hover:bg-blue-200 transition-colors"
                  >
                    View
                  </button>
                )}
              </div>
            ))
            )}
          </div>
        </div>

        {/* Right: Live Billable Consultants Summary */}
        <div className="lg:col-span-6 bg-white rounded-xl border border-slate-200/80 card-shadow p-5 space-y-3.5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center text-xs">
                <i className="fa-solid fa-file-invoice-dollar"></i>
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
              <span>View All ({placements.length})</span> &rarr;
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
    </section>
  );
};
