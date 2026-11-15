import React, { useState, useEffect } from 'react';
import {
  Activity,
  Bell,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Play,
  RefreshCw,
  Search,
  UserCheck,
} from 'lucide-react';
import { apiClient } from '../../config/api.config';
import { AutomationRule, AutomationAuditLog } from '../../types';
import { TablePagination } from '../../components/shared/TablePagination';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { useDebounce } from '../../utils/useDebounce';

interface AutomationsViewProps {
  rules: AutomationRule[];
  auditLogs: AutomationAuditLog[];
  tenantId?: string;
  onTestTrigger?: (rule: AutomationRule) => void;
  onToggleRule?: (ruleId: string) => void;
  onRefreshAutomations?: () => void;
  showToast?: (title: string, message: string, icon?: string) => void;
}

interface ReminderPreset {
  key: string;
  title: string;
  description: string;
  backendCategory: string;
  triggerEvent: string;
  whenText: string;
  defaultThreshold: string;
  thresholdOptions: string[];
  thenSummary: string;
  Icon: React.FC<{ className?: string }>;
  iconBg: string;
}

const REMINDER_PRESETS: ReminderPreset[] = [
  {
    key: 'feedback',
    title: 'Stale Submission Follow-Up',
    description: 'Creates an SLA reminder when a submitted consultant has had no client feedback.',
    backendCategory: 'FEEDBACK',
    triggerEvent: 'FEEDBACK_DELAYED',
    whenText: 'Candidate is awaiting client feedback for',
    defaultThreshold: '2 Days (48h)',
    thresholdOptions: ['24 Hours', '2 Days (48h)', '3 Days (72h)', '5 Days'],
    thenSummary: 'Create SLA Reminder Task & notify Account Lead',
    Icon: Clock,
    iconBg: 'bg-amber-50 text-amber-600 border-amber-200',
  },
  {
    key: 'stale_req',
    title: 'Unsourced Requirement Alert',
    description: 'Flags open job requirements that still have zero attached applicants.',
    backendCategory: 'STALE_REQ',
    triggerEvent: 'STALE_REQ',
    whenText: 'Open job requirement has 0 candidate submissions for',
    defaultThreshold: '24 Hours',
    thresholdOptions: ['24 Hours', '2 Days (48h)', '3 Days (72h)'],
    thenSummary: 'Create Priority SLA Reminder Task',
    Icon: Bell,
    iconBg: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  {
    key: 'interview',
    title: 'Interview Prep Reminder',
    description: 'Queues an interview checklist and feedback reminder when moved to Interview.',
    backendCategory: 'INTERVIEW',
    triggerEvent: 'INTERVIEW_TODAY',
    whenText: 'Candidate technical interview is active in stage for',
    defaultThreshold: 'Today',
    thresholdOptions: ['Immediate', 'Today'],
    thenSummary: 'Create Interview Prep Task in SLA Center',
    Icon: Calendar,
    iconBg: 'bg-brand-50 text-brand-700 border-brand-200',
  },
  {
    key: 'contract',
    title: 'Contract Expiry Alert',
    description: 'Flags active billable placements nearing their end date for renewal review.',
    backendCategory: 'CONTRACT',
    triggerEvent: 'CONTRACT_ENDING',
    whenText: 'Active billable placement contract is within',
    defaultThreshold: '30 Days to Expiry',
    thresholdOptions: ['14 Days', '30 Days to Expiry', '45 Days'],
    thenSummary: 'Create Renewal Alert & notify Account Lead',
    Icon: FileText,
    iconBg: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  },
];

export const AutomationsView: React.FC<AutomationsViewProps> = ({
  rules,
  auditLogs,
  onToggleRule,
  onRefreshAutomations,
  showToast = () => {},
}) => {
  const [activeRules, setActiveRules] = useState<any[]>(rules);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);

  // Paginated Activity Log state
  const [logSearch, setLogSearch] = useState('');
  const debouncedLogSearch = useDebounce(logSearch, 300);
  const [logsPage, setLogsPage] = useState(1);
  const [logsLimit, setLogsLimit] = useState(10);
  const [logRows, setLogRows] = useState<AutomationAuditLog[]>(auditLogs);
  const [totalLogs, setTotalLogs] = useState(auditLogs.length);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [logsRefreshKey, setLogsRefreshKey] = useState(0);

  useEffect(() => {
    setActiveRules(rules);
  }, [rules]);

  useEffect(() => {
    setLogsPage(1);
  }, [debouncedLogSearch]);

  useEffect(() => {
    let active = true;
    setIsLoadingLogs(true);
    apiClient
      .get('/automations/logs', {
        params: {
          search: debouncedLogSearch.trim() || undefined,
          page: logsPage,
          limit: logsLimit,
        },
      })
      .then((res) => {
        if (!active) return;
        if (res.data?.success && Array.isArray(res.data.data)) {
          const mapped: AutomationAuditLog[] = res.data.data.map((lg: any) => ({
            id: lg.id,
            timestamp: lg.createdAt
              ? new Date(lg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : 'Now',
            ruleName: lg.ruleName || 'Smart Reminder',
            target: lg.target || '',
            conditionsMet: lg.conditionsMet || '',
            actionDispatched: lg.actionDispatched || lg.actionTaken || '',
            status: lg.status || 'Executed',
          }));
          setLogRows(mapped);
          setTotalLogs(res.data.pagination?.total ?? mapped.length);
        }
      })
      .catch(() => {
        if (!active) return;
        const q = debouncedLogSearch.toLowerCase();
        const fallback = auditLogs.filter(
          (l) => !q || l.ruleName.toLowerCase().includes(q) || l.actionDispatched.toLowerCase().includes(q)
        );
        setTotalLogs(fallback.length);
        setLogRows(fallback.slice((logsPage - 1) * logsLimit, logsPage * logsLimit));
      })
      .finally(() => {
        if (active) setIsLoadingLogs(false);
      });
    return () => {
      active = false;
    };
  }, [debouncedLogSearch, logsPage, logsLimit, logsRefreshKey, auditLogs]);

  const findRuleForPreset = (preset: ReminderPreset) =>
    activeRules.find(
      (r) =>
        r.triggerEvent === preset.triggerEvent ||
        String(r.category || '').toUpperCase() === preset.backendCategory
    );

  const handleTogglePreset = async (preset: ReminderPreset) => {
    const existing = findRuleForPreset(preset);
    setBusyKey(preset.key);
    try {
      if (existing) {
        await apiClient.patch(`/automations/rules/${existing.id}/toggle`);
        setActiveRules((prev) =>
          prev.map((r) => (r.id === existing.id ? { ...r, active: !r.active } : r))
        );
        if (onToggleRule) onToggleRule(existing.id);
        if (onRefreshAutomations) onRefreshAutomations();
        showToast(
          !existing.active ? 'Reminder Enabled' : 'Reminder Paused',
          `${preset.title} is now ${!existing.active ? 'On' : 'Off'}.`
        );
      } else {
        const res = await apiClient.post('/automations/rules', {
          name: preset.title,
          category: preset.backendCategory,
          triggerEvent: preset.triggerEvent,
          icon: preset.key,
          color: 'slate',
          whenText: preset.whenText,
          threshold: preset.defaultThreshold,
          thenSummary: preset.thenSummary,
          actionPills: [{ label: 'SLA Reminder Task', icon: 'bell', color: 'slate' }],
        });
        if (res.data?.data) {
          setActiveRules((prev) => [...prev, res.data.data]);
        }
        if (onRefreshAutomations) onRefreshAutomations();
        showToast('Reminder Enabled', `${preset.title} is now On.`);
      }
    } catch (err: any) {
      showToast('Update Failed', err?.response?.data?.message || 'Could not update reminder.');
    } finally {
      setBusyKey(null);
    }
  };

  const handleThresholdChange = async (rule: any, nextThreshold: string) => {
    const prevThreshold = rule.threshold;
    setActiveRules((prev) =>
      prev.map((r) => (r.id === rule.id ? { ...r, threshold: nextThreshold } : r))
    );
    try {
      await apiClient.patch(`/automations/rules/${rule.id}`, { threshold: nextThreshold });
      if (onRefreshAutomations) onRefreshAutomations();
      showToast('Timing Updated', `Reminder timing updated to ${nextThreshold}.`);
    } catch (err: any) {
      setActiveRules((prev) =>
        prev.map((r) => (r.id === rule.id ? { ...r, threshold: prevThreshold } : r))
      );
      showToast('Update Failed', err?.response?.data?.message || 'Could not update timing.');
    }
  };

  const handleRunCheck = async (preset: ReminderPreset, rule: any) => {
    setBusyKey(preset.key);
    try {
      await apiClient.post(`/automations/rules/${rule.id}/test`);
      setLogsRefreshKey((k) => k + 1);
      if (onRefreshAutomations) onRefreshAutomations();
      showToast('Check Completed', `${preset.title} check logged to SLA & Activity.`);
    } catch (err: any) {
      showToast('Check Failed', err?.response?.data?.message || 'Could not run check.');
    } finally {
      setBusyKey(null);
    }
  };

  const handleEvaluateAll = async () => {
    setIsEvaluating(true);
    try {
      await apiClient.post('/automations/evaluate');
      setLogsRefreshKey((k) => k + 1);
      if (onRefreshAutomations) onRefreshAutomations();
      showToast('Reminders Checked', 'Evaluated all active reminders against current pipeline.');
    } catch (err: any) {
      showToast('Check Failed', err?.response?.data?.message || 'Could not evaluate reminders.');
    } finally {
      setIsEvaluating(false);
    }
  };

  const activeCount = REMINDER_PRESETS.filter((p) => findRuleForPreset(p)?.active).length;

  return (
    <section className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Smart Reminders</h2>
            <StatusBadge
              label={`${activeCount} of ${REMINDER_PRESETS.length} Active`}
              tone="emerald"
              size="xs"
            />
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Turn daily in-app reminders on or off. All alerts appear in your SLA Action Center — no email setup needed.
          </p>
        </div>

        <button
          type="button"
          onClick={handleEvaluateAll}
          disabled={isEvaluating}
          className="px-3.5 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isEvaluating ? 'animate-spin' : ''}`} />
          <span>{isEvaluating ? 'Checking...' : 'Run All Checks'}</span>
        </button>
      </div>

      {/* 4 Simple On/Off Smart Reminder Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {REMINDER_PRESETS.map((preset) => {
          const rule = findRuleForPreset(preset);
          const isActive = Boolean(rule?.active);
          const isBusy = busyKey === preset.key;
          const Icon = preset.Icon;
          const thresholdValue = rule?.threshold || preset.defaultThreshold;
          const thresholdOptions = Array.from(
            new Set([thresholdValue, ...preset.thresholdOptions])
          );

          return (
            <div
              key={preset.key}
              className={`bg-white rounded-xl border p-5 transition-all card-shadow flex flex-col justify-between gap-4 ${
                isActive ? 'border-slate-200' : 'border-slate-200/75 opacity-85'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-lg border flex items-center justify-center flex-shrink-0 ${preset.iconBg}`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-900">{preset.title}</h3>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      {preset.description}
                    </p>
                  </div>
                </div>

                {/* Clean On/Off Switch */}
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => handleTogglePreset(preset)}
                  aria-label={`Toggle ${preset.title}`}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                    isActive ? 'bg-emerald-500' : 'bg-slate-200'
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs transition-transform ${
                      isActive ? 'translate-x-4' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="text-slate-400 font-medium">Trigger after:</span>
                  {rule ? (
                    <select
                      value={thresholdValue}
                      onChange={(e) => handleThresholdChange(rule, e.target.value)}
                      className="px-2 py-1 rounded-md border border-slate-200 bg-slate-50 text-slate-700 font-semibold text-[11px] outline-none focus:border-brand-500 cursor-pointer"
                    >
                      {thresholdOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">
                      {preset.defaultThreshold}
                    </span>
                  )}
                </div>

                {rule && isActive && (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleRunCheck(preset, rule)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-semibold transition-colors cursor-pointer"
                  >
                    <Play className="w-3 h-3 text-brand-600" />
                    <span>Run Check</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Automatic Onboarding -> Billable Sync Info Strip */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap text-xs">
        <div className="flex items-center gap-2.5">
          <UserCheck className="w-4 h-4 text-brand-600 flex-shrink-0" />
          <div>
            <span className="font-semibold text-slate-900">Onboarding → Billable Auto-Sync is Always On:</span>{' '}
            <span className="text-slate-600">
              Moving a requirement with a consultant to <strong>Onboarding</strong> automatically creates their Billable placement.
            </span>
          </div>
        </div>
        <StatusBadge label="Built-In" tone="emerald" size="xs" />
      </div>

      {/* Recent Activity Log */}
      <div className="bg-white rounded-xl border border-slate-200 card-shadow overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-2 flex-wrap">
            <Activity className="w-4 h-4 text-slate-500" />
            <h3 className="font-bold text-xs text-slate-900">Recent Reminder Activity</h3>
            <span className="text-[11px] text-slate-400">({totalLogs})</span>
            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-500 text-[10px] font-medium">
              Logs retained for 30 days
            </span>
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={logSearch}
              onChange={(e) => setLogSearch(e.target.value)}
              placeholder="Search activity..."
              className="pl-8 pr-3 py-1 text-xs border border-slate-200 rounded-md bg-white w-60 text-slate-700 outline-none focus:border-brand-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-[10.5px] font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-2.5">Time</th>
                <th className="px-4 py-2.5">Reminder</th>
                <th className="px-4 py-2.5">Action Taken</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {logRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-xs text-slate-400">
                    No reminder activity logged yet. Click <strong>Run All Checks</strong> above to test.
                  </td>
                </tr>
              ) : (
                logRows.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-2.5 text-[11px] text-slate-400 tabular-nums whitespace-nowrap">
                      {log.timestamp}
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-slate-800 whitespace-nowrap">
                      {log.ruleName}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{log.actionDispatched}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <StatusBadge label={log.status} tone="emerald" size="xs" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <TablePagination
          page={logsPage}
          limit={logsLimit}
          total={totalLogs}
          onPageChange={setLogsPage}
          onLimitChange={(nextLimit) => {
            setLogsLimit(nextLimit);
            setLogsPage(1);
          }}
          itemLabel="activity logs"
          isLoading={isLoadingLogs}
        />
      </div>
    </section>
  );
};
