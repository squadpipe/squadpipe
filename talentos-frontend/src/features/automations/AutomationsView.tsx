import React, { useState } from 'react';
import { AutomationRule, AutomationAuditLog } from '../../types';

interface AutomationsViewProps {
  rules: AutomationRule[];
  auditLogs: AutomationAuditLog[];
  onTestTrigger: (rule: AutomationRule) => void;
  onToggleRule: (ruleId: string) => void;
  showToast?: (title: string, message: string, icon?: string) => void;
}

export const AutomationsView: React.FC<AutomationsViewProps> = ({
  rules: initialRules,
  auditLogs: initialLogs,
  onTestTrigger,
  onToggleRule,
  showToast = () => {},
}) => {
  const [categoryFilter, setCategoryFilter] = useState<'All' | 'Feedback' | 'Interview' | 'Contract' | 'Compliance'>('All');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [localLogs, setLocalLogs] = useState<AutomationAuditLog[]>(initialLogs);

  // Prototype rules matching exact screenshot media_1794485818104_71a438d4.jpg
  const defaultRules: any[] = [
    {
      id: 'rule_1',
      name: 'Client Feedback Follow-Up',
      category: 'Feedback',
      icon: 'fa-solid fa-comments',
      color: 'amber',
      active: true,
      whenText: 'Candidate is awaiting client feedback for',
      threshold: '2 Days (48h)',
      thresholdOptions: ['1 Day (24h)', '2 Days (48h)', '3 Days (72h)'],
      thenSummary: 'Notify assigned recruiter & prepare client follow-up email draft',
      actionPills: [
        { label: 'Recruiter SLA Task', icon: 'fa-solid fa-bell', color: 'blue' },
        { label: 'Draft Client Email', icon: 'fa-solid fa-envelope', color: 'emerald' },
        { label: 'Escalate if > 72h', icon: 'fa-solid fa-triangle-exclamation', color: 'amber' },
      ],
      executionsToday: 6,
      lastFired: '18 mins ago',
    },
    {
      id: 'rule_2',
      name: 'Same-Day Interview Checklist',
      category: 'Interview',
      icon: 'fa-solid fa-calendar-check',
      color: 'blue',
      active: true,
      whenText: 'Candidate technical interview is scheduled for',
      threshold: 'Today',
      thresholdOptions: ['Today', '1 Day Prior', '2 Hours Prior'],
      thenSummary: 'Send interview prep checklist to candidate and calendar reminder to recruiter',
      actionPills: [
        { label: 'Candidate SMS Prep', icon: 'fa-solid fa-mobile-screen', color: 'emerald' },
        { label: 'Recruiter Briefing', icon: 'fa-solid fa-clipboard-check', color: 'blue' },
        { label: 'Debrief Calendar Hold', icon: 'fa-solid fa-calendar-plus', color: 'purple' },
      ],
      executionsToday: 2,
      lastFired: '1 hour ago',
    },
    {
      id: 'rule_3',
      name: 'SOW Extension Protocol',
      category: 'Contract',
      icon: 'fa-solid fa-file-contract',
      color: 'purple',
      active: true,
      whenText: 'Active billable placement is within',
      threshold: '30 Days to Expiry',
      thresholdOptions: ['15 Days to Expiry', '30 Days to Expiry', '45 Days to Expiry'],
      thenSummary: 'Trigger client account manager renewal alert and prepare SOW extension addendum',
      actionPills: [
        { label: 'Renewal Sentinel Alert', icon: 'fa-solid fa-bell', color: 'purple' },
        { label: 'Draft SOW Addendum', icon: 'fa-solid fa-file-lines', color: 'blue' },
        { label: 'Margin Audit Check', icon: 'fa-solid fa-calculator', color: 'emerald' },
      ],
      executionsToday: 4,
      lastFired: '3 hours ago',
    },
    {
      id: 'rule_4',
      name: 'Sub-Tier Vendor COI Sentinel',
      category: 'Compliance',
      icon: 'fa-solid fa-shield-halved',
      color: 'emerald',
      active: true,
      whenText: 'Vendor Certificate of Insurance (COI) expires in',
      threshold: '14 Days',
      thresholdOptions: ['7 Days', '14 Days', '30 Days'],
      thenSummary: 'Auto-dispatch compliance renewal request to vendor contact and flag billing ledger',
      actionPills: [
        { label: 'Vendor Portal Ping', icon: 'fa-solid fa-paper-plane', color: 'emerald' },
        { label: 'Payment Hold Flag', icon: 'fa-solid fa-hand', color: 'rose' },
        { label: 'Compliance Audit', icon: 'fa-solid fa-certificate', color: 'blue' },
      ],
      executionsToday: 1,
      lastFired: 'Yesterday',
    },
    {
      id: 'rule_5',
      name: 'Rate Margin Clearance Enforcement',
      category: 'Compliance',
      icon: 'fa-solid fa-lock',
      color: 'rose',
      active: true,
      whenText: 'Junior recruiter views consultant margin spread',
      threshold: 'Zero Clearance',
      thresholdOptions: ['Zero Clearance', 'Restricted Mode'],
      thenSummary: 'Mask billing hourly rates with deterministic bullet obfuscation (••••)',
      actionPills: [
        { label: 'RBAC Masking Sentinel', icon: 'fa-solid fa-shield-cat', color: 'rose' },
        { label: 'Audit Log Trail', icon: 'fa-solid fa-list-check', color: 'blue' },
      ],
      executionsToday: 12,
      lastFired: 'Just now',
    },
    {
      id: 'rule_6',
      name: 'Candidate Offer Finalization Sentinel',
      category: 'Contract',
      icon: 'fa-solid fa-award',
      color: 'amber',
      active: true,
      whenText: 'Candidate moves to stage Selected for',
      threshold: '24 Hours',
      thresholdOptions: ['12 Hours', '24 Hours', '48 Hours'],
      thenSummary: 'Generate placement onboarding checklist and schedule background check verification',
      actionPills: [
        { label: 'Placement Wizard Cue', icon: 'fa-solid fa-wand-magic-sparkles', color: 'amber' },
        { label: 'Offer Letter Draft', icon: 'fa-solid fa-file-signature', color: 'emerald' },
      ],
      executionsToday: 3,
      lastFired: '4 hours ago',
    },
  ];

  const [activeRules, setActiveRules] = useState<any[]>(() => {
    if (initialRules && initialRules.length > 0) {
      return initialRules.map((r, i) => ({
        ...r,
        thresholdOptions: defaultRules[i % defaultRules.length]?.thresholdOptions || ['2 Days', '3 Days'],
      }));
    }
    return defaultRules;
  });

  const [newRuleForm, setNewRuleForm] = useState({
    name: '',
    category: 'Feedback',
    whenText: 'Candidate is awaiting client response for',
    threshold: '2 Days (48h)',
    thenSummary: 'Notify desk lead and send automated reminder',
  });

  const filteredRules = activeRules.filter(
    (r) => categoryFilter === 'All' || r.category === categoryFilter
  );

  const handleToggle = (rule: any) => {
    setActiveRules((prev) =>
      prev.map((r) => (r.id === rule.id ? { ...r, active: !r.active } : r))
    );
    if (onToggleRule) onToggleRule(rule.id);
  };

  const handleTestRun = (rule: any) => {
    setActiveRules((prev) =>
      prev.map((r) =>
        r.id === rule.id
          ? { ...r, executionsToday: (r.executionsToday || 0) + 1, lastFired: 'Just now' }
          : r
      )
    );
    const newLog: AutomationAuditLog = {
      id: 'log_' + Date.now(),
      timestamp: 'Just now',
      ruleName: rule.name,
      target: 'Manual Verification Probe',
      conditionsMet: `Threshold verified: ${rule.threshold}`,
      actionDispatched: rule.thenSummary,
      status: 'Executed',
    };
    setLocalLogs((prev) => [newLog, ...prev]);
    if (onTestTrigger) onTestTrigger(rule);
    showToast('Automation Triggered', `Rule "${rule.name}" executed successfully!`, 'fa-solid fa-bolt text-amber-500');
  };

  const handleRunEngineCheck = () => {
    showToast('Engine Scan Complete', 'Scanned 6 active requisitions & 3 placements. Zero SLA breaches detected.', 'fa-solid fa-circle-check text-emerald-500');
  };

  return (
    <section className="max-w-7xl mx-auto space-y-6 animate-fade-in select-none">
      {/* Header Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center text-lg flex-shrink-0 shadow-xs">
            <i className="fa-solid fa-bolt"></i>
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>Workflow Automations</span>
              <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Active &amp; Monitoring</span>
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Pre-built rules that automatically follow up with clients, alert recruiters, and prevent pipeline delays without manual busywork.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto flex-shrink-0">
          <button
            onClick={handleRunEngineCheck}
            className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
          >
            <i className="fa-solid fa-rotate text-slate-500 text-[11px]"></i>
            <span>Run Check Now</span>
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
          >
            <i className="fa-solid fa-plus text-[10px]"></i>
            <span>+ Create Automation</span>
          </button>
        </div>
      </div>

      {/* 4 Super Simple KPI Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 text-base flex-shrink-0">
            <i className="fa-solid fa-toggle-on"></i>
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">ACTIVE RULES</div>
            <div className="text-base font-bold text-slate-900 mt-0.5">
              {activeRules.filter((r) => r.active).length} of {activeRules.length} Running
            </div>
            <div className="text-[10px] text-emerald-600 font-medium">Automatic background sync</div>
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 text-base flex-shrink-0">
            <i className="fa-solid fa-paper-plane"></i>
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">ACTIONS TODAY</div>
            <div className="text-base font-bold text-brand-700 mt-0.5">28 Dispatched</div>
            <div className="text-[10px] text-slate-500">Tasks, drafts &amp; alerts</div>
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 text-base flex-shrink-0">
            <i className="fa-solid fa-clock"></i>
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">TIME SAVED TODAY</div>
            <div className="text-base font-bold text-emerald-700 mt-0.5">~4.5 Hours</div>
            <div className="text-[10px] text-slate-500">Manual recruiter follow-ups</div>
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600 text-base flex-shrink-0">
            <i className="fa-solid fa-shield-check"></i>
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">BREACHES PREVENTED</div>
            <div className="text-base font-bold text-purple-700 mt-0.5">14 Escalations</div>
            <div className="text-[10px] text-purple-600 font-medium">Resolved under 48 hours</div>
          </div>
        </div>
      </div>

      {/* Filter Chips Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <button
            onClick={() => setCategoryFilter('All')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
              categoryFilter === 'All'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span>All Automations</span>
            <span
              className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                categoryFilter === 'All' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {activeRules.length}
            </span>
          </button>

          <button
            onClick={() => setCategoryFilter('Feedback')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
              categoryFilter === 'Feedback'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <i className="fa-solid fa-comments text-amber-500 text-[10px]"></i>
            <span>Pipeline &amp; Feedback</span>
          </button>

          <button
            onClick={() => setCategoryFilter('Interview')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
              categoryFilter === 'Interview'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <i className="fa-solid fa-calendar-check text-blue-500 text-[10px]"></i>
            <span>Interviews</span>
          </button>

          <button
            onClick={() => setCategoryFilter('Contract')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
              categoryFilter === 'Contract'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <i className="fa-solid fa-file-contract text-purple-500 text-[10px]"></i>
            <span>Contracts &amp; Extensions</span>
          </button>

          <button
            onClick={() => setCategoryFilter('Compliance')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
              categoryFilter === 'Compliance'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <i className="fa-solid fa-shield-halved text-emerald-500 text-[10px]"></i>
            <span>Compliance</span>
          </button>
        </div>

        <div className="text-xs text-slate-500 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>All automations execute automatically</span>
        </div>
      </div>

      {/* Super Simple Automation Recipe Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredRules.map((rule) => (
          <div
            key={rule.id}
            className={`bg-white rounded-xl border p-5 shadow-xs transition-all flex flex-col justify-between space-y-4 hover:shadow-sm ${
              rule.active ? 'border-slate-200' : 'border-slate-200 bg-slate-50/50 opacity-75'
            }`}
          >
            <div className="space-y-3.5">
              {/* Top Row: Icon, Name, Category & On/Off Switch */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white shadow-2xs flex-shrink-0 ${
                      rule.color === 'blue'
                        ? 'bg-blue-600'
                        : rule.color === 'amber'
                        ? 'bg-amber-500'
                        : rule.color === 'rose'
                        ? 'bg-rose-500'
                        : rule.color === 'purple'
                        ? 'bg-purple-600'
                        : rule.color === 'emerald'
                        ? 'bg-emerald-600'
                        : 'bg-cyan-600'
                    }`}
                  >
                    <i className={rule.icon}></i>
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm tracking-tight flex items-center gap-2">
                      <span>{rule.name}</span>
                    </h3>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
                      {rule.category}
                    </span>
                  </div>
                </div>

                {/* Instant Toggle Switch */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span
                    className={`text-[11px] font-semibold transition-colors ${
                      rule.active ? 'text-emerald-700' : 'text-slate-400'
                    }`}
                  >
                    {rule.active ? 'Active' : 'Paused'}
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rule.active}
                      onChange={() => handleToggle(rule)}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>
              </div>

              {/* Natural Language Recipe Box */}
              <div className="p-3.5 rounded-xl border border-slate-200/90 bg-slate-50/70 text-xs space-y-2.5">
                {/* WHEN Block */}
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider bg-amber-100/70 px-1.5 py-0.5 rounded font-mono">
                    WHEN
                  </span>
                  <span className="text-slate-700 font-medium">{rule.whenText}</span>
                  <select
                    value={rule.threshold}
                    onChange={(e) => {
                      const val = e.target.value;
                      setActiveRules((prev) =>
                        prev.map((r) => (r.id === rule.id ? { ...r, threshold: val } : r))
                      );
                    }}
                    className="px-2 py-0.5 border border-slate-300 rounded-md bg-white text-xs font-bold text-slate-900 shadow-2xs focus:border-amber-500 focus:outline-none cursor-pointer"
                  >
                    {(rule.thresholdOptions || [rule.threshold]).map((opt: string) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="w-full h-px bg-slate-200/60"></div>

                {/* THEN Block */}
                <div className="flex items-start gap-2">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider bg-emerald-100/70 px-1.5 py-0.5 rounded font-mono mt-0.5">
                    THEN
                  </span>
                  <span className="text-slate-800 font-semibold leading-relaxed">{rule.thenSummary}</span>
                </div>
              </div>

              {/* Action Pills Badges */}
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {(rule.actionPills || []).map((pill: any) => (
                  <span
                    key={pill.label}
                    className="px-2 py-0.8 rounded-md bg-white border border-slate-200 text-slate-700 text-[10px] font-medium flex items-center gap-1.5 shadow-2xs"
                  >
                    <i
                      className={`${pill.icon} text-[10px] ${
                        pill.color === 'blue'
                          ? 'text-blue-600'
                          : pill.color === 'emerald'
                          ? 'text-emerald-600'
                          : pill.color === 'purple'
                          ? 'text-purple-600'
                          : pill.color === 'rose'
                          ? 'text-rose-600'
                          : 'text-amber-500'
                      }`}
                    ></i>
                    <span>{pill.label}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <i className="fa-solid fa-clock-rotate-left text-[10px]"></i>
                <span>
                  Ran <strong className="text-slate-700">{rule.executionsToday || 0} times</strong> today
                </span>
                <span className="text-slate-300">&bull;</span>
                <span>{rule.lastFired || 'Active'}</span>
              </div>
              <button
                onClick={() => handleTestRun(rule)}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-semibold text-[11px] flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
              >
                <i className="fa-solid fa-play text-[9px] text-amber-600"></i>
                <span>Test Run</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Automation Activity Log */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-bolt text-amber-500 text-xs"></i>
            <h3 className="font-bold text-slate-900 text-xs">Recent Automation Activity</h3>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
              {localLogs.length} recent events
            </span>
          </div>
          <button
            onClick={() => setLocalLogs([])}
            className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            Clear Activity
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {localLogs.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400 font-mono">
              No recent automated triggers recorded. Click "Test Run" on any rule to dispatch an event.
            </div>
          ) : (
            localLogs.slice(0, 8).map((log) => (
              <div
                key={log.id}
                className="p-3.5 hover:bg-slate-50/60 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                    <i className="fa-solid fa-check text-emerald-600"></i>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 text-xs">{log.target}</span>
                      <span className="px-2 py-0.2 rounded-full bg-amber-50 text-amber-800 border border-amber-200/80 text-[10px] font-semibold font-mono">
                        {log.ruleName}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5 flex items-center gap-1.5">
                      <i className="fa-solid fa-arrow-turn-down-right text-slate-400 text-[10px]"></i>
                      <span>{log.actionDispatched}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-center flex-shrink-0 text-[11px]">
                  <span className="text-slate-400 font-mono">{log.timestamp}</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold font-mono">
                    {log.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create Automation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-scale-up">
            <div className="px-6 py-4 bg-[#0B0F17] text-white flex items-center justify-between border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center text-sm">
                  <i className="fa-solid fa-bolt"></i>
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-tight">Configure New Automation Rule</h3>
                  <div className="text-[11px] text-slate-400">Deterministic event sentinel trigger</div>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newRuleForm.name.trim()) return;
                const created: any = {
                  id: 'rule_' + Date.now(),
                  name: newRuleForm.name,
                  category: newRuleForm.category,
                  icon: 'fa-solid fa-gear',
                  color: 'amber',
                  active: true,
                  whenText: newRuleForm.whenText,
                  threshold: newRuleForm.threshold,
                  thresholdOptions: [newRuleForm.threshold, '1 Day', '3 Days'],
                  thenSummary: newRuleForm.thenSummary,
                  actionPills: [{ label: 'Automated Event', icon: 'fa-solid fa-bolt', color: 'amber' }],
                  executionsToday: 0,
                  lastFired: 'Never',
                };
                setActiveRules((prev) => [created, ...prev]);
                setShowCreateModal(false);
                showToast('Rule Activated', `Automation "${created.name}" is now active & monitoring!`, 'fa-solid fa-bolt text-amber-500');
              }}
              className="p-6 space-y-4 text-xs"
            >
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Rule Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Inactivity Reminder for Pending Reqs"
                  value={newRuleForm.name}
                  onChange={(e) => setNewRuleForm({ ...newRuleForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Lifecycle Category</label>
                <select
                  value={newRuleForm.category}
                  onChange={(e) => setNewRuleForm({ ...newRuleForm, category: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:border-amber-500 focus:outline-none cursor-pointer"
                >
                  <option value="Feedback">Pipeline &amp; Feedback</option>
                  <option value="Interview">Interviews</option>
                  <option value="Contract">Contracts &amp; Extensions</option>
                  <option value="Compliance">Compliance &amp; Governance</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">WHEN Condition Event</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Requirement remains unassigned for"
                  value={newRuleForm.whenText}
                  onChange={(e) => setNewRuleForm({ ...newRuleForm, whenText: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Threshold Duration</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 48 Hours"
                  value={newRuleForm.threshold}
                  onChange={(e) => setNewRuleForm({ ...newRuleForm, threshold: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">THEN Action Dispatched</label>
                <textarea
                  required
                  rows={2}
                  placeholder="e.g. Trigger desk notification and dispatch daily digest to account lead"
                  value={newRuleForm.thenSummary}
                  onChange={(e) => setNewRuleForm({ ...newRuleForm, thenSummary: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3.5 py-2 border border-slate-200 text-slate-600 hover:bg-slate-100 font-semibold rounded-lg text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg text-xs shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <i className="fa-solid fa-bolt text-[10px]"></i>
                  <span>Deploy Automation</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
