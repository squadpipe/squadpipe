import React from 'react';
import { Requirement, Candidate, BillablePlacement, SlaTask } from '../../types';
import { MaskedValue } from '../../components/shared/MaskedValue';

interface DashboardViewProps {
  metrics: any;
  rateMasked: boolean;
  requirements: Requirement[];
  candidates: Candidate[];
  placements?: BillablePlacement[];
  slaTasks?: SlaTask[];
  onNavigate: (view: string) => void;
  onOpenMatcher: (req: Requirement) => void;
  onOpenPitchWriter: (req: Requirement) => void;
  onStatusChange: (req: Requirement, newStatus: any) => void;
  onAssignCandidate: (req: Requirement, candidate: Candidate) => void;
  onOpenSlaDrawer?: () => void;
  onSelectReq?: (req: Requirement) => void;
  onPreviewResume?: (candidate: Candidate) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  metrics,
  rateMasked,
  requirements,
  candidates,
  placements = [],
  slaTasks = [],
  onNavigate,
  onOpenMatcher,
  onOpenPitchWriter,
  onStatusChange,
  onAssignCandidate,
  onOpenSlaDrawer,
  onSelectReq,
  onPreviewResume,
}) => {
  return (
    <div className="space-y-6">
      {/* 4 KPI Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => onNavigate('pipeline')}
          className="p-4 bg-white rounded-xl border border-slate-200 card-shadow card-hover cursor-pointer group"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Active Requisitions</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <i className="fa-solid fa-briefcase text-xs"></i>
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">
            {metrics.activeReqsCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
            <span className="text-emerald-600 font-semibold">{metrics.submittedCount} Submitted</span>
            <span>&bull;</span>
            <span className="text-blue-600 font-semibold">{metrics.interviewsCount} Interviewing</span>
          </div>
        </div>

        <div
          onClick={() => onNavigate('billable')}
          className="p-4 bg-white rounded-xl border border-slate-200 card-shadow card-hover cursor-pointer group"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Monthly Gross Profit</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <i className="fa-solid fa-dollar-sign text-xs"></i>
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600 mt-2 font-mono">
            <MaskedValue
              value={`$${Number(metrics.totalMonthlyGrossProfit).toLocaleString()}/mo`}
              isMasked={rateMasked}
            />
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Based on 160h/consultant</div>
        </div>

        <div
          onClick={() => onNavigate('billable')}
          className="p-4 bg-white rounded-xl border border-slate-200 card-shadow card-hover cursor-pointer group"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Avg Hourly Spread</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <i className="fa-solid fa-chart-line text-xs"></i>
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2 font-mono">
            <MaskedValue
              value={`+$${metrics.avgHourlyMarginSpread}/hr`}
              isMasked={rateMasked}
            />
          </div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-1">
            <MaskedValue value={`${metrics.avgMarginPercent}% avg margin`} isMasked={rateMasked} />
          </div>
        </div>

        <div
          onClick={() => onNavigate('billable')}
          className="p-4 bg-white rounded-xl border border-slate-200 card-shadow card-hover cursor-pointer group"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Expiring SOW Radar</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-colors">
              <i className="fa-solid fa-triangle-exclamation text-xs"></i>
            </div>
          </div>
          <div className="text-2xl font-black text-amber-600 mt-2">
            {metrics.expiringPlacementsCount} Placements
          </div>
          <div className="text-[11px] text-amber-700 font-semibold mt-1">Ending within 30 days</div>
        </div>
      </div>

      {/* Two-Column Midsection: Daily SLA Alerts & Live Billable Consultants */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Daily SLA & Compliance Alerts */}
        <div className="lg:col-span-6 bg-white rounded-xl border border-slate-200/80 card-shadow p-5 space-y-3.5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center text-xs">
                <i className="fa-solid fa-bell"></i>
              </div>
              <div>
                <h3 className="font-bold text-xs text-slate-900">Daily SLA & Compliance Alerts</h3>
                <span className="text-[10px] text-slate-400">Overdue client feedback, interviews, and expiring contracts</span>
              </div>
            </div>
            <button
              onClick={onOpenSlaDrawer}
              className="text-xs font-semibold text-brand-600 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Open Queue</span> &rarr;
            </button>
          </div>

          <div className="space-y-2">
            {slaTasks.slice(0, 3).map((item) => (
              <div
                key={item.id}
                className="p-2.5 bg-slate-50/80 hover:bg-slate-100/70 rounded-lg border border-slate-200/60 flex items-center justify-between text-xs transition-colors"
              >
                <div className="space-y-0.5 overflow-hidden pr-2">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border ${
                        item.badgeClass || 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      {item.category}
                    </span>
                    <span className="font-semibold text-slate-800 text-[11px] truncate">{item.title}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">{item.desc}</div>
                </div>
                <button
                  onClick={onOpenSlaDrawer}
                  className="flex-shrink-0 px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-semibold hover:bg-blue-100 transition-colors"
                >
                  View
                </button>
              </div>
            ))}
            {slaTasks.length === 0 && (
              <div className="py-6 text-center text-slate-400 text-xs">
                <i className="fa-solid fa-circle-check text-emerald-500 text-sm mb-1 block"></i>
                All SLAs and reminder actions currently up to date!
              </div>
            )}
          </div>
        </div>

        {/* Right: Active Billable Consultants Summary */}
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
            {placements.slice(0, 3).map((b) => (
              <div
                key={b.id}
                className="p-2.5 bg-emerald-50/30 hover:bg-emerald-50/60 rounded-lg border border-emerald-100 flex items-center justify-between text-xs transition-colors"
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-900 text-xs">{b.resourceName}</span>
                    <span className="text-[9px] font-mono bg-white border border-slate-200 px-1 py-0.2 rounded text-slate-600">
                      {b.deployment}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500">{b.customer} &bull; {b.skillRole}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-emerald-700 text-xs">
                    <MaskedValue value={b.billing} isMasked={rateMasked} />
                  </div>
                  <div className="text-[9px] font-mono text-slate-400">Ends {b.endDate}</div>
                </div>
              </div>
            ))}
            {placements.length === 0 && (
              <div className="py-6 text-center text-slate-400 text-xs">
                No active billable placements currently recorded.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Active Requisitions & Sourcing Desk Table */}
      <div className="bg-white rounded-xl border border-slate-200 card-shadow overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="font-bold text-xs text-slate-800">Active Requisitions & Direct Sourcing Desk</h3>
            <p className="text-[11px] text-slate-400">Match bench talent, draft client pitches, and progress candidate stages</p>
          </div>
          <button
            onClick={() => onNavigate('pipeline')}
            className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1"
          >
            <span>Open Kanban Board</span>
            <i className="fa-solid fa-arrow-right text-[10px]"></i>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-200">
                <th className="py-2.5 px-4">Job Order & Code</th>
                <th className="py-2.5 px-4">Client Company</th>
                <th className="py-2.5 px-4">Required Competencies</th>
                <th className="py-2.5 px-4">Linked Candidate</th>
                <th className="py-2.5 px-4">Stage</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {requirements.map((req) => {
                const assignedCandidateObj = candidates.find(
                  (c) => c.fullName.toLowerCase() === (req.resourceName || '').toLowerCase()
                );

                return (
                  <tr key={req.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4">
                      <div
                        onClick={() => onSelectReq && onSelectReq(req)}
                        className="font-bold text-slate-900 cursor-pointer hover:text-brand-600 transition-colors"
                      >
                        {req.opportunityTitle}
                      </div>
                      <div className="font-mono text-[10px] text-slate-400">
                        {req.code} &bull; {req.location}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-700">
                      {req.companyName}
                      <div className="text-[10px] text-slate-400 font-normal">
                        {typeof req.clientContact === 'object' && req.clientContact !== null
                          ? (req.clientContact as any).fullName || (req.clientContact as any).name || ''
                          : String(req.clientContact || '')}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="max-w-xs truncate text-[11px] text-slate-600 font-mono">
                        {req.skillsRequired}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {req.resourceName ? (
                        <div className="flex items-center gap-1.5">
                          <span
                            onClick={() =>
                              assignedCandidateObj && onPreviewResume && onPreviewResume(assignedCandidateObj)
                            }
                            className="font-semibold text-slate-800 flex items-center gap-1.5 cursor-pointer hover:text-brand-600 transition-colors"
                          >
                            <i className="fa-solid fa-user-check text-emerald-500 text-[10px]"></i>
                            {req.resourceName}
                          </span>
                        </div>
                      ) : (
                        <select
                          onChange={(e) => {
                            const c = candidates.find((cand) => cand.fullName === e.target.value);
                            if (c) onAssignCandidate(req, c);
                          }}
                          defaultValue=""
                          className="text-[11px] py-1 px-2 rounded-lg border border-slate-200 bg-white text-slate-600 cursor-pointer"
                        >
                          <option value="" disabled>
                            Assign Bench...
                          </option>
                          {candidates.map((c) => (
                            <option key={c.id} value={c.fullName}>
                              {c.fullName} ({c.workAuth})
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <select
                        value={req.status}
                        onChange={(e) => onStatusChange(req, e.target.value)}
                        className={`text-[10px] font-bold py-1 px-2.5 rounded-lg border ${
                          req.status === 'Submitted'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : req.status === 'Interview'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : req.status === 'Selected'
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : req.status === 'Onboarding'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-700 border-slate-300'
                        }`}
                      >
                        <option value="Requirement">Requirement</option>
                        <option value="Submitted">Submitted</option>
                        <option value="Interview">Interview</option>
                        <option value="Selected">Selected</option>
                        <option value="Onboarding">Onboarding</option>
                      </select>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onOpenMatcher(req)}
                          title="Run Bench Skill Matcher"
                          className="px-2 py-1 rounded bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-[10px] font-semibold flex items-center gap-1 transition-colors"
                        >
                          <i className="fa-solid fa-users-viewfinder"></i>
                          <span>Match</span>
                        </button>
                        <button
                          onClick={() => onOpenPitchWriter(req)}
                          title="Draft Client Presentation Pitch"
                          className="px-2 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-[10px] font-semibold flex items-center gap-1 transition-colors"
                        >
                          <i className="fa-solid fa-pen-nib"></i>
                          <span>Pitch</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
