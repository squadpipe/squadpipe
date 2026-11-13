import React, { useState, useEffect } from 'react';
import { apiClient } from '../../config/api.config';
import { AutomationRule, AutomationAuditLog } from '../../types';

interface AutomationsViewProps {
  rules: AutomationRule[];
  auditLogs: AutomationAuditLog[];
  tenantId?: string;
  onTestTrigger?: (rule: AutomationRule) => void;
  onToggleRule?: (ruleId: string) => void;
  onRefreshAutomations?: () => void;
  showToast?: (title: string, message: string, icon?: string) => void;
}

interface StarterTemplate {
  key: string;
  chipLabel: string;
  name: string;
  category: 'Feedback' | 'Interview' | 'Contract' | 'Compliance';
  backendCategory: string;
  triggerEvent: string;
  icon: string;
  color: string;
  whenText: string;
  threshold: string;
  thenSummary: string;
  selectedActions: string[];
  actionPills: { label: string; icon: string; color: string }[];
}

const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    key: 'feedback',
    chipLabel: 'Client Feedback Follow-Up',
    name: 'Client Feedback Follow-Up',
    category: 'Feedback',
    backendCategory: 'FEEDBACK',
    triggerEvent: 'FEEDBACK_DELAYED',
    icon: 'fa-solid fa-comments',
    color: 'amber',
    whenText: 'Candidate is awaiting client feedback for',
    threshold: '2 Days (48h)',
    thenSummary: 'Create recruiter SLA task & prepare client follow-up email draft',
    selectedActions: ['sla_task', 'email_draft'],
    actionPills: [
      { label: 'Recruiter SLA Task', icon: 'fa-solid fa-bell', color: 'blue' },
      { label: 'Draft Client Email', icon: 'fa-solid fa-envelope', color: 'emerald' },
    ],
  },
  {
    key: 'stale_req',
    chipLabel: 'Unsourced Req Alert',
    name: 'Unsourced Job Order Sentinel',
    category: 'Feedback',
    backendCategory: 'STALE_REQ',
    triggerEvent: 'STALE_REQ',
    icon: 'fa-solid fa-briefcase',
    color: 'rose',
    whenText: 'Open job requirement has 0 candidate submissions for',
    threshold: '24 Hours',
    thenSummary: 'Flag requirement in Priority Queue & launch AI Skill Matcher',
    selectedActions: ['sla_task'],
    actionPills: [
      { label: 'Priority SLA Alert', icon: 'fa-solid fa-bell', color: 'rose' },
      { label: 'Skill Matcher Cue', icon: 'fa-solid fa-wand-magic-sparkles', color: 'amber' },
    ],
  },
  {
    key: 'interview',
    chipLabel: 'Same-Day Interview Prep',
    name: 'Same-Day Interview Checklist',
    category: 'Interview',
    backendCategory: 'INTERVIEW',
    triggerEvent: 'INTERVIEW_TODAY',
    icon: 'fa-solid fa-calendar-check',
    color: 'blue',
    whenText: 'Candidate technical interview is active in stage for',
    threshold: 'Today',
    thenSummary: 'Queue candidate interview prep checklist & recruiter briefing',
    selectedActions: ['sla_task', 'account_manager'],
    actionPills: [
      { label: 'Candidate Prep Checklist', icon: 'fa-solid fa-clipboard-check', color: 'blue' },
      { label: 'Recruiter Briefing', icon: 'fa-solid fa-bell', color: 'emerald' },
    ],
  },
  {
    key: 'contract',
    chipLabel: 'Contract Renewal Notice',
    name: 'SOW Contract Expiry Sentinel',
    category: 'Contract',
    backendCategory: 'CONTRACT',
    triggerEvent: 'CONTRACT_ENDING',
    icon: 'fa-solid fa-file-contract',
    color: 'purple',
    whenText: 'Active billable placement contract is within',
    threshold: '30 Days to Expiry',
    thenSummary: 'Alert account manager & queue SOW extension review',
    selectedActions: ['sla_task', 'account_manager'],
    actionPills: [
      { label: 'Renewal Sentinel Alert', icon: 'fa-solid fa-bell', color: 'purple' },
      { label: 'SOW Extension Review', icon: 'fa-solid fa-file-lines', color: 'blue' },
    ],
  },
  {
    key: 'compliance',
    chipLabel: 'Vendor COI / MSA Check',
    name: 'Vendor COI & MSA Compliance Check',
    category: 'Compliance',
    backendCategory: 'COMPLIANCE',
    triggerEvent: 'VISA_EXPIRING',
    icon: 'fa-solid fa-shield-halved',
    color: 'emerald',
    whenText: 'Sub-tier vendor MSA is unsigned or COI expires within',
    threshold: '30 Days',
    thenSummary: 'Flag vendor compliance alert in Priority Action Queue',
    selectedActions: ['compliance_flag', 'account_manager'],
    actionPills: [
      { label: 'Compliance Queue Flag', icon: 'fa-solid fa-certificate', color: 'emerald' },
      { label: 'Account Lead Notice', icon: 'fa-solid fa-paper-plane', color: 'blue' },
    ],
  },
];

const WHEN_CONDITION_OPTIONS = [
  'Candidate is awaiting client feedback for',
  'Open job requirement has 0 candidate submissions for',
  'Candidate technical interview is active in stage for',
  'Active billable placement contract is within',
  'Sub-tier vendor MSA is unsigned or COI expires within',
  'Custom Condition...',
];

const THRESHOLD_PILLS = [
  'Immediate',
  'Today',
  '24 Hours',
  '2 Days (48h)',
  '3 Days (72h)',
  '14 Days',
  '30 Days',
  '30 Days to Expiry',
];

const ACTION_OPTION_MAP: Record<
  string,
  { id: string; label: string; summaryPhrase: string; pill: { label: string; icon: string; color: string } }
> = {
  sla_task: {
    id: 'sla_task',
    label: 'Create Priority SLA Task',
    summaryPhrase: 'Create Priority SLA Task',
    pill: { label: 'Priority SLA Task', icon: 'fa-solid fa-bell', color: 'blue' },
  },
  email_draft: {
    id: 'email_draft',
    label: 'Prepare Follow-Up Email Draft',
    summaryPhrase: 'Prepare Follow-Up Email Draft',
    pill: { label: 'Draft Client Email', icon: 'fa-solid fa-envelope', color: 'emerald' },
  },
  account_manager: {
    id: 'account_manager',
    label: 'Notify Account Manager',
    summaryPhrase: 'Notify Account Manager',
    pill: { label: 'Account Lead Alert', icon: 'fa-solid fa-user-tie', color: 'purple' },
  },
  compliance_flag: {
    id: 'compliance_flag',
    label: 'Flag Compliance Queue',
    summaryPhrase: 'Flag Compliance Queue',
    pill: { label: 'Compliance Queue Flag', icon: 'fa-solid fa-certificate', color: 'amber' },
  },
};

const getThresholdOptionsForRule = (rule: any): string[] => {
  const cat = String(rule.category || '').toLowerCase();
  const base =
    cat === 'interview'
      ? ['Today', '24 Hours', '2 Days (48h)']
      : cat === 'contract'
      ? ['14 Days', '30 Days to Expiry', '45 Days to Expiry']
      : cat === 'compliance'
      ? ['7 Days', '14 Days', '30 Days']
      : ['Immediate', '24 Hours', '2 Days (48h)', '3 Days (72h)'];
  return Array.from(new Set([rule.threshold, ...base].filter(Boolean)));
};

export const AutomationsView: React.FC<AutomationsViewProps> = ({
  rules: initialRules,
  auditLogs: initialLogs,
  tenantId = 'talentos-agency',
  onToggleRule,
  onRefreshAutomations,
  showToast = () => {},
}) => {
  const [categoryFilter, setCategoryFilter] = useState<'All' | 'Feedback' | 'Interview' | 'Contract' | 'Compliance'>('All');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isRunningCheck, setIsRunningCheck] = useState(false);
  const [isSubmittingRule, setIsSubmittingRule] = useState(false);
  const [activeRules, setActiveRules] = useState<any[]>(initialRules || []);
  const [localLogs, setLocalLogs] = useState<AutomationAuditLog[]>(initialLogs || []);

  useEffect(() => {
    setActiveRules(initialRules || []);
  }, [initialRules]);

  useEffect(() => {
    setLocalLogs(initialLogs || []);
  }, [initialLogs]);

  const [newRuleForm, setNewRuleForm] = useState({
    name: '',
    category: 'Feedback',
    triggerEvent: 'FEEDBACK_DELAYED',
    whenPreset: WHEN_CONDITION_OPTIONS[0],
    whenText: WHEN_CONDITION_OPTIONS[0],
    threshold: '2 Days (48h)',
    selectedActions: ['sla_task', 'email_draft'] as string[],
    thenSummary: 'Create Priority SLA Task & Prepare Follow-Up Email Draft',
  });

  const applyTemplateToForm = (tpl: StarterTemplate) => {
    const isPreset = WHEN_CONDITION_OPTIONS.includes(tpl.whenText);
    setNewRuleForm({
      name: tpl.name,
      category: tpl.category,
      triggerEvent: tpl.triggerEvent,
      whenPreset: isPreset ? tpl.whenText : 'Custom Condition...',
      whenText: tpl.whenText,
      threshold: tpl.threshold,
      selectedActions: tpl.selectedActions,
      thenSummary: tpl.thenSummary,
    });
  };

  const toggleActionCheckbox = (actionId: string) => {
    setNewRuleForm((prev) => {
      const exists = prev.selectedActions.includes(actionId);
      const nextActions = exists
        ? prev.selectedActions.filter((id) => id !== actionId)
        : [...prev.selectedActions, actionId];
      const builtSummary = nextActions
        .map((id) => ACTION_OPTION_MAP[id]?.summaryPhrase)
        .filter(Boolean)
        .join(' & ');
      return {
        ...prev,
        selectedActions: nextActions,
        thenSummary: builtSummary || prev.thenSummary,
      };
    });
  };

  const filteredRules = activeRules.filter(
    (r) =>
      categoryFilter === 'All' ||
      String(r.category || '').toLowerCase() === categoryFilter.toLowerCase()
  );

  const handleSeedAllDefaults = async () => {
    setIsSeeding(true);
    try {
      const res = await apiClient.post('/automations/rules/seed-defaults');
      const seeded = res.data?.data || [];
      if (Array.isArray(seeded) && seeded.length > 0) {
        if (onRefreshAutomations) onRefreshAutomations();
      }
      showToast(
        'Starter Pack Activated',
        `Enabled ${seeded.length || 5} recommended agency rules for tenant "${tenantId}".`,
        'fa-solid fa-bolt text-amber-500'
      );
    } catch (err: any) {
      showToast(
        'Activation Failed',
        err.response?.data?.message || err.message || 'Unable to enable default rules.',
        'fa-solid fa-triangle-exclamation text-rose-500'
      );
    } finally {
      setIsSeeding(false);
    }
  };

  const handleEnableSingleTemplate = async (tpl: StarterTemplate) => {
    try {
      await apiClient.post('/automations/rules', {
        name: tpl.name,
        category: tpl.backendCategory,
        triggerEvent: tpl.triggerEvent,
        icon: tpl.icon,
        color: tpl.color,
        whenText: tpl.whenText,
        threshold: tpl.threshold,
        thenSummary: tpl.thenSummary,
        actionPills: tpl.actionPills,
      });
      if (onRefreshAutomations) onRefreshAutomations();
      showToast('Rule Enabled', `"${tpl.name}" is now active for tenant "${tenantId}".`, 'fa-solid fa-circle-check text-emerald-500');
    } catch (err: any) {
      showToast('Enable Failed', err.response?.data?.message || err.message || 'Failed to enable rule.', 'fa-solid fa-triangle-exclamation text-rose-500');
    }
  };

  const handleToggle = async (rule: any) => {
    try {
      await apiClient.patch(`/automations/rules/${rule.id}/toggle`);
      setActiveRules((prev) =>
        prev.map((r) => (r.id === rule.id ? { ...r, active: !r.active } : r))
      );
      if (onToggleRule) onToggleRule(rule.id);
      if (onRefreshAutomations) onRefreshAutomations();
      showToast(
        !rule.active ? 'Automation Resumed' : 'Automation Paused',
        `"${rule.name}" is now ${!rule.active ? 'Active' : 'Paused'}.`,
        'fa-solid fa-toggle-on text-emerald-500'
      );
    } catch (err: any) {
      showToast('Toggle Failed', err.response?.data?.message || err.message || 'Failed to update rule state.', 'fa-solid fa-triangle-exclamation text-rose-500');
    }
  };

  const handleUpdateThreshold = async (rule: any, newThreshold: string) => {
    const previous = rule.threshold;
    setActiveRules((prev) =>
      prev.map((r) => (r.id === rule.id ? { ...r, threshold: newThreshold } : r))
    );
    try {
      await apiClient.patch(`/automations/rules/${rule.id}`, { threshold: newThreshold });
      showToast('Threshold Saved', `Updated "${rule.name}" threshold to "${newThreshold}".`, 'fa-solid fa-clock text-brand-600');
    } catch (err: any) {
      setActiveRules((prev) =>
        prev.map((r) => (r.id === rule.id ? { ...r, threshold: previous } : r))
      );
      showToast('Update Failed', err.response?.data?.message || 'Could not persist threshold.', 'fa-solid fa-triangle-exclamation text-rose-500');
    }
  };

  const handleDeleteRule = async (rule: any) => {
    try {
      await apiClient.delete(`/automations/rules/${rule.id}`);
      setActiveRules((prev) => prev.filter((r) => r.id !== rule.id));
      if (onRefreshAutomations) onRefreshAutomations();
      showToast('Rule Deleted', `"${rule.name}" was removed from tenant "${tenantId}".`, 'fa-solid fa-trash-can text-slate-500');
    } catch (err: any) {
      showToast('Delete Failed', err.response?.data?.message || 'Could not delete rule.', 'fa-solid fa-triangle-exclamation text-rose-500');
    }
  };

  const handleTestRun = async (rule: any) => {
    try {
      const res = await apiClient.post(`/automations/rules/${rule.id}/test`);
      const logEntry = res.data?.data?.auditLog || res.data?.data;
      setActiveRules((prev) =>
        prev.map((r) =>
          r.id === rule.id
            ? { ...r, executionsToday: (r.executionsToday || 0) + 1, lastFired: 'Just now' }
            : r
        )
      );
      if (logEntry) {
        const newLog: AutomationAuditLog = {
          id: logEntry.id || 'log_' + Date.now(),
          timestamp: 'Just now',
          ruleName: logEntry.ruleName || rule.name,
          target: logEntry.target || 'Manual Test Execution',
          conditionsMet: logEntry.conditionsMet || `Threshold: ${rule.threshold}`,
          actionDispatched: logEntry.actionDispatched || rule.thenSummary,
          status: 'Executed',
        };
        setLocalLogs((prev) => [newLog, ...prev]);
      }
      if (onRefreshAutomations) onRefreshAutomations();
      showToast('Automation Triggered', `Rule "${rule.name}" executed & logged!`, 'fa-solid fa-bolt text-amber-500');
    } catch (err: any) {
      showToast('Test Run Failed', err.response?.data?.message || err.message || 'Unable to execute rule.', 'fa-solid fa-triangle-exclamation text-rose-500');
    }
  };

  const handleRunEngineCheck = async () => {
    setIsRunningCheck(true);
    try {
      const res = await apiClient.post('/sla-tasks/evaluate');
      const count = res.data?.data?.createdTasksCount ?? res.data?.count ?? 0;
      if (onRefreshAutomations) onRefreshAutomations();
      showToast(
        'SLA Radar Check Complete',
        `Scanned tenant "${tenantId}" pipeline, placements & vendors. ${count} new SLA alert(s) queued.`,
        'fa-solid fa-circle-check text-emerald-500'
      );
    } catch (err: any) {
      showToast(
        'Engine Scan Failed',
        err.response?.data?.message || 'Could not complete SLA radar scan.',
        'fa-solid fa-triangle-exclamation text-rose-500'
      );
    } finally {
      setIsRunningCheck(false);
    }
  };

  const openBlankCreateModal = () => {
    applyTemplateToForm(STARTER_TEMPLATES[0]);
    setNewRuleForm((prev) => ({ ...prev, name: '' }));
    setShowCreateModal(true);
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
            <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2 flex-wrap">
              <span>Workflow Automations</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-mono font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Live Engine
              </span>
              <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-[10px] font-mono font-semibold text-slate-600">
                Tenant: {tenantId}
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Tenant-isolated rules that scan your requisitions, interviews, SOW contracts, and vendor compliance in PostgreSQL.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto flex-shrink-0">
          <button
            onClick={handleRunEngineCheck}
            disabled={isRunningCheck}
            className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-60 text-slate-700 font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
          >
            <i className={`fa-solid ${isRunningCheck ? 'fa-spinner fa-spin' : 'fa-rotate'} text-slate-500 text-[11px]`}></i>
            <span>{isRunningCheck ? 'Scanning...' : 'Run Check Now'}</span>
          </button>
          <button
            onClick={openBlankCreateModal}
            className="px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
          >
            <i className="fa-solid fa-plus text-[10px]"></i>
            <span>Create Automation</span>
          </button>
        </div>
      </div>

      {/* 4 KPI Metrics Cards */}
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
            <div className="text-[10px] text-emerald-600 font-medium">Scoped to {tenantId}</div>
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 text-base flex-shrink-0">
            <i className="fa-solid fa-paper-plane"></i>
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">ACTIONS DISPATCHED</div>
            <div className="text-base font-bold text-brand-700 mt-0.5">
              {activeRules.reduce((sum, r) => sum + (Number(r.executionsToday) || 0), 0)} Total
            </div>
            <div className="text-[10px] text-slate-500">SLA alerts &amp; test runs</div>
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 text-base flex-shrink-0">
            <i className="fa-solid fa-clock"></i>
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">EST. TIME SAVED</div>
            <div className="text-base font-bold text-emerald-700 mt-0.5">
              ~{(activeRules.reduce((sum, r) => sum + (Number(r.executionsToday) || 0), 0) * 0.15).toFixed(1)} Hours
            </div>
            <div className="text-[10px] text-slate-500">Manual recruiter follow-ups</div>
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600 text-base flex-shrink-0">
            <i className="fa-solid fa-shield-check"></i>
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">AUDIT HISTORY</div>
            <div className="text-base font-bold text-purple-700 mt-0.5">{localLogs.length} Logged</div>
            <div className="text-[10px] text-purple-600 font-medium">Automation triggers recorded</div>
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
          <span>Persisted per agency tenant</span>
        </div>
      </div>

      {/* Empty State: 1-Click Starter Automation Pack */}
      {activeRules.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold uppercase tracking-wider mb-2">
                <i className="fa-solid fa-wand-magic-sparkles"></i>
                <span>1-Click Starter Pack</span>
              </div>
              <h3 className="text-base font-bold text-slate-900">
                No automations enabled yet for <span className="font-mono text-brand-600">{tenantId}</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Turn on all 5 recommended IT staffing rules in one click, or pick individual recipes below.
              </p>
            </div>
            <button
              onClick={handleSeedAllDefaults}
              disabled={isSeeding}
              className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white font-semibold rounded-xl text-xs shadow-sm flex items-center gap-2 transition-colors cursor-pointer flex-shrink-0"
            >
              <i className={`fa-solid ${isSeeding ? 'fa-spinner fa-spin' : 'fa-bolt'}`}></i>
              <span>{isSeeding ? 'Activating Rules...' : 'Enable All 5 Recommended Agency Rules (1-Click)'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {STARTER_TEMPLATES.map((tpl) => (
              <div
                key={tpl.key}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white hover:border-amber-300 transition-all flex flex-col justify-between gap-3"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs ${
                          tpl.color === 'blue'
                            ? 'bg-blue-600'
                            : tpl.color === 'rose'
                            ? 'bg-rose-500'
                            : tpl.color === 'purple'
                            ? 'bg-purple-600'
                            : tpl.color === 'emerald'
                            ? 'bg-emerald-600'
                            : 'bg-amber-500'
                        }`}
                      >
                        <i className={tpl.icon}></i>
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 text-xs">{tpl.name}</div>
                        <div className="text-[10px] font-mono uppercase text-slate-400">{tpl.category}</div>
                      </div>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    <span className="font-semibold text-amber-700">WHEN</span> {tpl.whenText}{' '}
                    <span className="font-bold text-slate-800">{tpl.threshold}</span> &rarr; {tpl.thenSummary}
                  </p>
                </div>
                <button
                  onClick={() => handleEnableSingleTemplate(tpl)}
                  className="w-full py-1.5 bg-white hover:bg-amber-50 border border-slate-200 hover:border-amber-300 text-slate-800 font-semibold rounded-lg text-[11px] transition-colors cursor-pointer"
                >
                  + Enable This Rule
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Active Persisted Automation Cards Grid */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredRules.map((rule) => (
            <div
              key={rule.id}
              className={`bg-white rounded-xl border p-5 shadow-xs transition-all flex flex-col justify-between space-y-4 hover:shadow-sm ${
                rule.active ? 'border-slate-200' : 'border-slate-200 bg-slate-50/50 opacity-75'
              }`}
            >
              <div className="space-y-3.5">
                {/* Top Row: Icon, Name, Category & Controls */}
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
                      <i className={rule.icon || 'fa-solid fa-bolt'}></i>
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

                  {/* Toggle Switch + Delete */}
                  <div className="flex items-center gap-2.5 flex-shrink-0">
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
                    <button
                      onClick={() => handleDeleteRule(rule)}
                      title="Delete automation rule"
                      className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors cursor-pointer"
                    >
                      <i className="fa-solid fa-trash-can text-xs"></i>
                    </button>
                  </div>
                </div>

                {/* Natural Language Recipe Box */}
                <div className="p-3.5 rounded-xl border border-slate-200/90 bg-slate-50/70 text-xs space-y-2.5">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider bg-amber-100/70 px-1.5 py-0.5 rounded font-mono">
                      WHEN
                    </span>
                    <span className="text-slate-700 font-medium">{rule.whenText}</span>
                    <select
                      value={rule.threshold}
                      onChange={(e) => handleUpdateThreshold(rule, e.target.value)}
                      className="px-2 py-0.5 border border-slate-300 rounded-md bg-white text-xs font-bold text-slate-900 shadow-2xs focus:border-amber-500 focus:outline-none cursor-pointer"
                    >
                      {getThresholdOptionsForRule(rule).map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="w-full h-px bg-slate-200/60"></div>

                  <div className="flex items-start gap-2">
                    <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider bg-emerald-100/70 px-1.5 py-0.5 rounded font-mono mt-0.5">
                      THEN
                    </span>
                    <span className="text-slate-800 font-semibold leading-relaxed">{rule.thenSummary}</span>
                  </div>
                </div>

                {/* Action Pills Badges */}
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {(rule.actionPills || []).map((pill: any, idx: number) => (
                    <span
                      key={`${pill.label}_${idx}`}
                      className="px-2 py-0.8 rounded-md bg-white border border-slate-200 text-slate-700 text-[10px] font-medium flex items-center gap-1.5 shadow-2xs"
                    >
                      <i
                        className={`${pill.icon || 'fa-solid fa-bolt'} text-[10px] ${
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
                    Ran <strong className="text-slate-700">{rule.executionsToday || 0} times</strong>
                  </span>
                  <span className="text-slate-300">&bull;</span>
                  <span>{rule.lastFired || 'Ready'}</span>
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
      )}

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
            Clear View
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {localLogs.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400 font-mono">
              No automated triggers recorded yet for {tenantId}. Click "Test Run" or "Run Check Now" above.
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

      {/* Redesigned 3-Step Guided Automation Builder Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-scale-up max-h-[92vh] flex flex-col">
            <div className="px-6 py-4 bg-[#0B0F17] text-white flex items-center justify-between border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center text-sm">
                  <i className="fa-solid fa-bolt"></i>
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-tight">Easy Automation Builder</h3>
                  <div className="text-[11px] text-slate-400">
                    Pick a 1-click template or customize WHEN &rarr; THEN for tenant <span className="font-mono text-slate-300">{tenantId}</span>
                  </div>
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
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newRuleForm.name.trim()) return;
                setIsSubmittingRule(true);
                try {
                  const pills = newRuleForm.selectedActions
                    .map((id) => ACTION_OPTION_MAP[id]?.pill)
                    .filter(Boolean);

                  const backendCatMap: Record<string, string> = {
                    Feedback: newRuleForm.triggerEvent === 'STALE_REQ' ? 'STALE_REQ' : 'FEEDBACK',
                    Interview: 'INTERVIEW',
                    Contract: 'CONTRACT',
                    Compliance: 'COMPLIANCE',
                  };

                  await apiClient.post('/automations/rules', {
                    name: newRuleForm.name,
                    category: backendCatMap[newRuleForm.category] || 'CUSTOM',
                    triggerEvent: newRuleForm.triggerEvent || 'CUSTOM',
                    whenText: newRuleForm.whenText,
                    threshold: newRuleForm.threshold,
                    thenSummary: newRuleForm.thenSummary,
                    actionPills:
                      pills.length > 0
                        ? pills
                        : [{ label: 'Automated Event', icon: 'fa-solid fa-bolt', color: 'amber' }],
                  });
                  if (onRefreshAutomations) onRefreshAutomations();
                  setShowCreateModal(false);
                  showToast(
                    'Automation Deployed',
                    `"${newRuleForm.name}" is now active for tenant "${tenantId}"!`,
                    'fa-solid fa-bolt text-amber-500'
                  );
                } catch (err: any) {
                  showToast(
                    'Rule Creation Error',
                    err.response?.data?.message || err.message || 'Failed to save automation rule.',
                    'fa-solid fa-triangle-exclamation text-rose-500'
                  );
                } finally {
                  setIsSubmittingRule(false);
                }
              }}
              className="p-6 space-y-5 text-xs overflow-y-auto"
            >
              {/* Step 1: 1-Click Quick Templates */}
              <div className="space-y-2">
                <div className="text-[11px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 inline-flex items-center justify-center text-[10px] font-bold">1</span>
                  <span>Quick-Fill from a 1-Click Template (Optional)</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {STARTER_TEMPLATES.map((tpl) => (
                    <button
                      type="button"
                      key={tpl.key}
                      onClick={() => applyTemplateToForm(tpl)}
                      className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                        newRuleForm.name === tpl.name
                          ? 'bg-amber-50 border-amber-400 text-amber-800 shadow-2xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <i className={`${tpl.icon} text-[10px]`}></i>
                      <span>{tpl.chipLabel}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Rule Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Client Feedback Follow-Up"
                    value={newRuleForm.name}
                    onChange={(e) => setNewRuleForm({ ...newRuleForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Category</label>
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
              </div>

              {/* Step 2: Simple IF / WHEN Builder */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="text-[11px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 inline-flex items-center justify-center text-[10px] font-bold">2</span>
                  <span>WHEN Should This Trigger?</span>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Choose Event</label>
                  <select
                    value={newRuleForm.whenPreset}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewRuleForm((prev) => ({
                        ...prev,
                        whenPreset: val,
                        whenText: val === 'Custom Condition...' ? '' : val,
                      }));
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:border-amber-500 focus:outline-none cursor-pointer"
                  >
                    {WHEN_CONDITION_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                {newRuleForm.whenPreset === 'Custom Condition...' && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Custom Condition Text</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Consultant remains on bench without submittal for"
                      value={newRuleForm.whenText}
                      onChange={(e) => setNewRuleForm({ ...newRuleForm, whenText: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase">Wait Duration / Threshold</label>
                  <div className="flex flex-wrap gap-1.5">
                    {THRESHOLD_PILLS.map((pill) => (
                      <button
                        type="button"
                        key={pill}
                        onClick={() => setNewRuleForm({ ...newRuleForm, threshold: pill })}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-all cursor-pointer ${
                          newRuleForm.threshold === pill
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {pill}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    required
                    value={newRuleForm.threshold}
                    onChange={(e) => setNewRuleForm({ ...newRuleForm, threshold: e.target.value })}
                    placeholder="Or type custom duration..."
                    className="mt-1.5 w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Step 3: Simple THEN Actions */}
              <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200/80 space-y-3">
                <div className="text-[11px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 inline-flex items-center justify-center text-[10px] font-bold">3</span>
                  <span>THEN What Actions Should Run?</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {Object.values(ACTION_OPTION_MAP).map((opt) => {
                    const checked = newRuleForm.selectedActions.includes(opt.id);
                    return (
                      <label
                        key={opt.id}
                        className={`p-2.5 rounded-lg border flex items-center gap-2 cursor-pointer transition-all ${
                          checked
                            ? 'bg-white border-emerald-400 shadow-2xs text-slate-900'
                            : 'bg-white/60 border-slate-200 text-slate-600 hover:bg-white'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleActionCheckbox(opt.id)}
                          className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                        <i className={`${opt.pill.icon} text-xs text-emerald-600`}></i>
                        <span className="text-[11px] font-semibold">{opt.label}</span>
                      </label>
                    );
                  })}
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Action Summary</label>
                  <textarea
                    required
                    rows={2}
                    value={newRuleForm.thenSummary}
                    onChange={(e) => setNewRuleForm({ ...newRuleForm, thenSummary: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
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
                  disabled={isSubmittingRule}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white font-semibold rounded-lg text-xs shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <i className={`fa-solid ${isSubmittingRule ? 'fa-spinner fa-spin' : 'fa-bolt'} text-[10px]`}></i>
                  <span>{isSubmittingRule ? 'Deploying...' : 'Deploy Automation'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
