import React, { useState, useEffect } from 'react';
import {
  Plus,
  RefreshCw,
  Play,
  Trash2,
  Clock,
  CheckCircle2,
  X,
  ArrowRight,
  Activity,
  Bell,
  Mail,
  UserCheck,
  ShieldAlert,
  FileText,
  Calendar,
  MessageSquare,
  Briefcase,
  Pencil,
} from 'lucide-react';
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

type CategoryType = 'Feedback' | 'Interview' | 'Contract' | 'Compliance';

interface StarterTemplate {
  key: string;
  chipLabel: string;
  name: string;
  category: CategoryType;
  backendCategory: string;
  triggerEvent: string;
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
    whenText: 'Candidate is awaiting client feedback for',
    threshold: '2 Days (48h)',
    thenSummary: 'Create recruiter SLA task & prepare client follow-up email draft',
    selectedActions: ['sla_task', 'email_draft'],
    actionPills: [
      { label: 'Recruiter SLA Task', icon: 'bell', color: 'slate' },
      { label: 'Draft Client Email', icon: 'mail', color: 'slate' },
    ],
  },
  {
    key: 'stale_req',
    chipLabel: 'Unsourced Req Alert',
    name: 'Unsourced Job Order Alert',
    category: 'Feedback',
    backendCategory: 'STALE_REQ',
    triggerEvent: 'STALE_REQ',
    whenText: 'Open job requirement has 0 candidate submissions for',
    threshold: '24 Hours',
    thenSummary: 'Flag requirement in Priority Queue & launch Skill Matcher',
    selectedActions: ['sla_task'],
    actionPills: [
      { label: 'Priority SLA Alert', icon: 'bell', color: 'slate' },
      { label: 'Skill Matcher Cue', icon: 'briefcase', color: 'slate' },
    ],
  },
  {
    key: 'interview',
    chipLabel: 'Same-Day Interview Prep',
    name: 'Same-Day Interview Checklist',
    category: 'Interview',
    backendCategory: 'INTERVIEW',
    triggerEvent: 'INTERVIEW_TODAY',
    whenText: 'Candidate technical interview is active in stage for',
    threshold: 'Today',
    thenSummary: 'Queue candidate interview prep checklist & recruiter briefing',
    selectedActions: ['sla_task', 'account_manager'],
    actionPills: [
      { label: 'Candidate Prep Checklist', icon: 'calendar', color: 'slate' },
      { label: 'Recruiter Briefing', icon: 'bell', color: 'slate' },
    ],
  },
  {
    key: 'contract',
    chipLabel: 'Contract Renewal Notice',
    name: 'SOW Contract Expiry Alert',
    category: 'Contract',
    backendCategory: 'CONTRACT',
    triggerEvent: 'CONTRACT_ENDING',
    whenText: 'Active billable placement contract is within',
    threshold: '30 Days to Expiry',
    thenSummary: 'Alert account manager & queue SOW extension review',
    selectedActions: ['sla_task', 'account_manager'],
    actionPills: [
      { label: 'Renewal Alert', icon: 'bell', color: 'slate' },
      { label: 'SOW Extension Review', icon: 'file-text', color: 'slate' },
    ],
  },
  {
    key: 'compliance',
    chipLabel: 'Vendor COI / MSA Check',
    name: 'Vendor COI & MSA Compliance Check',
    category: 'Compliance',
    backendCategory: 'COMPLIANCE',
    triggerEvent: 'VISA_EXPIRING',
    whenText: 'Sub-tier vendor MSA is unsigned or COI expires within',
    threshold: '30 Days',
    thenSummary: 'Flag vendor compliance alert in Priority Action Queue',
    selectedActions: ['compliance_flag', 'account_manager'],
    actionPills: [
      { label: 'Compliance Queue Flag', icon: 'shield', color: 'slate' },
      { label: 'Account Lead Notice', icon: 'user-check', color: 'slate' },
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

const ACTION_OPTIONS = [
  {
    id: 'sla_task',
    label: 'Create Priority SLA Task',
    summaryPhrase: 'Create Priority SLA Task',
    pill: { label: 'Priority SLA Task', icon: 'bell', color: 'slate' },
    Icon: Bell,
  },
  {
    id: 'email_draft',
    label: 'Prepare Follow-Up Email Draft',
    summaryPhrase: 'Prepare Follow-Up Email Draft',
    pill: { label: 'Draft Client Email', icon: 'mail', color: 'slate' },
    Icon: Mail,
  },
  {
    id: 'account_manager',
    label: 'Notify Account Manager',
    summaryPhrase: 'Notify Account Manager',
    pill: { label: 'Account Lead Alert', icon: 'user-check', color: 'slate' },
    Icon: UserCheck,
  },
  {
    id: 'compliance_flag',
    label: 'Flag Compliance Queue',
    summaryPhrase: 'Flag Compliance Queue',
    pill: { label: 'Compliance Queue Flag', icon: 'shield', color: 'slate' },
    Icon: ShieldAlert,
  },
];

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

const renderCategoryIcon = (category: string, triggerEvent?: string) => {
  const cat = String(category || '').toLowerCase();
  const evt = String(triggerEvent || '').toUpperCase();
  if (evt === 'STALE_REQ' || cat === 'stale_req') {
    return <Briefcase className="w-4 h-4" />;
  }
  switch (cat) {
    case 'feedback':
      return <MessageSquare className="w-4 h-4" />;
    case 'interview':
      return <Calendar className="w-4 h-4" />;
    case 'contract':
      return <FileText className="w-4 h-4" />;
    case 'compliance':
      return <ShieldAlert className="w-4 h-4" />;
    default:
      return <Activity className="w-4 h-4" />;
  }
};

export const AutomationsView: React.FC<AutomationsViewProps> = ({
  rules: initialRules,
  auditLogs: initialLogs,
  tenantId = 'talentos-agency',
  onTestTrigger,
  onToggleRule,
  onRefreshAutomations,
  showToast = () => {},
}) => {
  const [categoryFilter, setCategoryFilter] = useState<'All' | CategoryType>('All');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
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
        .map((id) => ACTION_OPTIONS.find((opt) => opt.id === id)?.summaryPhrase)
        .filter(Boolean)
        .join(' & ');
      return {
        ...prev,
        selectedActions: nextActions,
        thenSummary: builtSummary || prev.thenSummary,
      };
    });
  };

  const filteredRules = activeRules.filter((r) => {
    if (categoryFilter === 'All') return true;
    const cat = String(r.category || '').toLowerCase();
    if (categoryFilter === 'Feedback' && cat === 'stale_req') return true;
    return cat === categoryFilter.toLowerCase();
  });

  const activeCount = activeRules.filter((r) => r.active).length;
  const totalRuns = activeRules.reduce((sum, r) => sum + (Number(r.executionsToday) || 0), 0);

  const handleSeedAllDefaults = async () => {
    setIsSeeding(true);
    try {
      const res = await apiClient.post('/automations/rules/seed-defaults');
      const seeded = res.data?.data || [];
      if (Array.isArray(seeded) && seeded.length > 0 && onRefreshAutomations) {
        onRefreshAutomations();
      }
      showToast(
        'Starter Pack Activated',
        `Enabled ${seeded.length || 5} agency rules for tenant "${tenantId}".`
      );
    } catch (err: any) {
      showToast(
        'Activation Failed',
        err.response?.data?.message || err.message || 'Unable to enable default rules.'
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
        icon: tpl.key,
        color: 'slate',
        whenText: tpl.whenText,
        threshold: tpl.threshold,
        thenSummary: tpl.thenSummary,
        actionPills: tpl.actionPills,
      });
      if (onRefreshAutomations) onRefreshAutomations();
      showToast('Rule Enabled', `"${tpl.name}" is now active for tenant "${tenantId}".`);
    } catch (err: any) {
      showToast('Enable Failed', err.response?.data?.message || err.message || 'Failed to enable rule.');
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
        !rule.active ? 'Automation Active' : 'Automation Paused',
        `"${rule.name}" is now ${!rule.active ? 'Active' : 'Paused'}.`
      );
    } catch (err: any) {
      showToast('Toggle Failed', err.response?.data?.message || err.message || 'Failed to update rule state.');
    }
  };

  const handleUpdateThreshold = async (rule: any, newThreshold: string) => {
    const previous = rule.threshold;
    setActiveRules((prev) =>
      prev.map((r) => (r.id === rule.id ? { ...r, threshold: newThreshold } : r))
    );
    try {
      await apiClient.patch(`/automations/rules/${rule.id}`, { threshold: newThreshold });
      showToast('Threshold Updated', `"${rule.name}" threshold set to ${newThreshold}.`);
    } catch (err: any) {
      setActiveRules((prev) =>
        prev.map((r) => (r.id === rule.id ? { ...r, threshold: previous } : r))
      );
      showToast('Update Failed', err.response?.data?.message || 'Could not update threshold.');
    }
  };

  const handleDeleteRule = async (rule: any) => {
    try {
      await apiClient.delete(`/automations/rules/${rule.id}`);
      setActiveRules((prev) => prev.filter((r) => r.id !== rule.id));
      if (onRefreshAutomations) onRefreshAutomations();
      showToast('Rule Deleted', `"${rule.name}" removed from tenant "${tenantId}".`);
    } catch (err: any) {
      showToast('Delete Failed', err.response?.data?.message || 'Could not delete rule.');
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
      if (onTestTrigger) onTestTrigger(rule);
      if (onRefreshAutomations) onRefreshAutomations();
      showToast('Rule Triggered', `"${rule.name}" executed and logged.`);
    } catch (err: any) {
      showToast('Test Run Failed', err.response?.data?.message || err.message || 'Unable to execute rule.');
    }
  };

  const handleRunEngineCheck = async () => {
    setIsRunningCheck(true);
    try {
      const res = await apiClient.post('/sla-tasks/evaluate');
      const count = res.data?.data?.createdTasksCount ?? res.data?.count ?? 0;
      if (onRefreshAutomations) onRefreshAutomations();
      showToast(
        'SLA Check Complete',
        `Scanned tenant "${tenantId}". ${count} new SLA alert(s) queued.`
      );
    } catch (err: any) {
      showToast(
        'Engine Scan Failed',
        err.response?.data?.message || 'Could not complete SLA check.'
      );
    } finally {
      setIsRunningCheck(false);
    }
  };

  const openBlankCreateModal = () => {
    setEditingRuleId(null);
    applyTemplateToForm(STARTER_TEMPLATES[0]);
    setNewRuleForm((prev) => ({ ...prev, name: '' }));
    setShowCreateModal(true);
  };

  const openEditModal = (rule: any) => {
    const rawCat = String(rule.category || '').toUpperCase();
    const uiCategory: CategoryType =
      rawCat === 'INTERVIEW'
        ? 'Interview'
        : rawCat === 'CONTRACT'
        ? 'Contract'
        : rawCat === 'COMPLIANCE'
        ? 'Compliance'
        : 'Feedback';
    const isPreset = WHEN_CONDITION_OPTIONS.includes(rule.whenText);
    const matchedActionIds = ACTION_OPTIONS.filter((opt) =>
      (rule.actionPills || []).some((p: any) =>
        String(p.label || '').toLowerCase().includes(opt.pill.label.toLowerCase()) ||
        String(rule.thenSummary || '').toLowerCase().includes(opt.summaryPhrase.toLowerCase())
      )
    ).map((opt) => opt.id);

    setEditingRuleId(rule.id);
    setNewRuleForm({
      name: rule.name || '',
      category: uiCategory,
      triggerEvent: rule.triggerEvent || 'CUSTOM',
      whenPreset: isPreset ? rule.whenText : 'Custom Condition...',
      whenText: rule.whenText || '',
      threshold: rule.threshold || 'Immediate',
      selectedActions: matchedActionIds.length > 0 ? matchedActionIds : ['sla_task'],
      thenSummary: rule.thenSummary || '',
    });
    setShowCreateModal(true);
  };

  return (
    <section className="max-w-7xl mx-auto space-y-5 animate-fade-in select-none">
      {/* Clean Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Workflow Automations</h2>
            <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[11px] font-mono text-slate-600">
              Tenant: {tenantId}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Automated SLA alerts, interview reminders, and contract expiry rules scoped to your workspace.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-shrink-0">
          <button
            onClick={handleRunEngineCheck}
            disabled={isRunningCheck}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-60 text-slate-700 font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isRunningCheck ? 'animate-spin' : ''}`} />
            <span>{isRunningCheck ? 'Scanning...' : 'Run Check'}</span>
          </button>
          <button
            onClick={openBlankCreateModal}
            className="px-3.5 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Rule</span>
          </button>
        </div>
      </div>

      {/* Compact Toolbar: Category Tabs & Inline Stats */}
      <div className="bg-white rounded-xl border border-slate-200 card-shadow px-4 py-2.5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1 overflow-x-auto">
          {(['All', 'Feedback', 'Interview', 'Contract', 'Compliance'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${
                categoryFilter === cat
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 text-[11px] font-mono text-slate-500 flex-shrink-0">
          <span>
            <strong className="text-slate-900">{activeCount}</strong> active
          </span>
          <span className="text-slate-300">&bull;</span>
          <span>
            <strong className="text-slate-900">{totalRuns}</strong> runs
          </span>
          <span className="text-slate-300">&bull;</span>
          <span>
            <strong className="text-slate-900">{localLogs.length}</strong> logs
          </span>
        </div>
      </div>

      {/* Empty State: Starter Automation Pack */}
      {activeRules.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 card-shadow p-6 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                No automation rules enabled for <span className="font-mono text-brand-600">{tenantId}</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Activate the 5 default staffing rules at once or enable individual templates below.
              </p>
            </div>
            <button
              onClick={handleSeedAllDefaults}
              disabled={isSeeding}
              className="px-3.5 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-semibold rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer flex-shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSeeding ? 'animate-spin' : ''}`} />
              <span>{isSeeding ? 'Activating...' : 'Activate Default Rules (5)'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {STARTER_TEMPLATES.map((tpl) => (
              <div
                key={tpl.key}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-white transition-colors flex flex-col justify-between gap-3"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-600 flex items-center justify-center flex-shrink-0">
                      {renderCategoryIcon(tpl.category, tpl.triggerEvent)}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900 text-xs">{tpl.name}</div>
                      <div className="text-[10px] font-mono uppercase text-slate-400">{tpl.category}</div>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    <span className="font-semibold text-slate-800">WHEN</span> {tpl.whenText}{' '}
                    <span className="font-semibold text-slate-900">{tpl.threshold}</span> &rarr; {tpl.thenSummary}
                  </p>
                </div>
                <button
                  onClick={() => handleEnableSingleTemplate(tpl)}
                  className="w-full py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-medium rounded-lg text-[11px] transition-colors cursor-pointer flex items-center justify-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Enable Rule</span>
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
              className={`bg-white rounded-xl border border-slate-200 card-shadow p-5 flex flex-col justify-between space-y-4 transition-opacity ${
                rule.active ? '' : 'opacity-70 bg-slate-50/40'
              }`}
            >
              <div className="space-y-3.5">
                {/* Card Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center flex-shrink-0">
                      {renderCategoryIcon(rule.category, rule.triggerEvent)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 text-sm tracking-tight">{rule.name}</h3>
                      <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider font-mono">
                        {rule.category}
                      </span>
                    </div>
                  </div>

                  {/* Status Switch + Edit + Delete */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                      className={`text-[11px] font-medium ${
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
                      onClick={() => openEditModal(rule)}
                      title="Edit automation rule"
                      className="text-slate-400 hover:text-brand-600 p-1 rounded-md hover:bg-brand-50 transition-colors cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteRule(rule)}
                      title="Delete automation rule"
                      className="text-slate-400 hover:text-rose-600 p-1 rounded-md hover:bg-rose-50 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* WHEN / THEN Recipe Block */}
                <div className="p-3.5 rounded-lg border border-slate-200/80 bg-slate-50/70 text-xs space-y-2.5">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider bg-slate-200/70 px-1.5 py-0.5 rounded font-mono">
                      WHEN
                    </span>
                    <span className="text-slate-700">{rule.whenText}</span>
                    <select
                      value={rule.threshold}
                      onChange={(e) => handleUpdateThreshold(rule, e.target.value)}
                      className="px-2 py-0.5 border border-slate-300 rounded-md bg-white text-xs font-semibold text-slate-900 focus:border-brand-600 focus:outline-none cursor-pointer"
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
                    <span className="text-slate-800 font-medium leading-relaxed">{rule.thenSummary}</span>
                  </div>
                </div>

                {/* Plain Text Action Pills */}
                <div className="flex flex-wrap gap-1.5">
                  {(rule.actionPills || []).map((pill: any, idx: number) => (
                    <span
                      key={`${pill.label}_${idx}`}
                      className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600 text-[11px] font-medium"
                    >
                      {pill.label}
                    </span>
                  ))}
                </div>
              </div>

              {/* Card Footer */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    Ran <strong className="text-slate-700">{rule.executionsToday || 0} times</strong>
                  </span>
                  <span className="text-slate-300">&bull;</span>
                  <span>{rule.lastFired || 'Ready'}</span>
                </div>
                <button
                  onClick={() => handleTestRun(rule)}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-medium text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Play className="w-3 h-3 text-slate-600" />
                  <span>Test Run</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recent Automation Activity Log */}
      <div className="bg-white rounded-xl border border-slate-200 card-shadow overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-slate-500" />
            <h3 className="font-semibold text-slate-900 text-xs">Recent Automation Activity</h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              {localLogs.length} events
            </span>
          </div>
          {localLogs.length > 0 && (
            <button
              onClick={() => setLocalLogs([])}
              className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            >
              Clear View
            </button>
          )}
        </div>

        <div className="divide-y divide-slate-100">
          {localLogs.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">
              No automation events recorded yet for {tenantId}. Click Test Run or Run Check above.
            </div>
          ) : (
            localLogs.slice(0, 8).map((log) => (
              <div
                key={log.id}
                className="px-5 py-3 hover:bg-slate-50/60 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200/70 text-emerald-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-900 text-xs">{log.target}</span>
                      <span className="px-2 py-0.2 rounded-md bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-mono">
                        {log.ruleName}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                      <ArrowRight className="w-3 h-3 text-slate-400 flex-shrink-0" />
                      <span>{log.actionDispatched}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 self-end sm:self-center flex-shrink-0 text-[11px]">
                  <span className="text-slate-400 font-mono">{log.timestamp}</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-medium">
                    {log.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create Automation Rule Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-scale-up max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {editingRuleId ? 'Edit Automation Rule' : 'Create Automation Rule'}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Tenant: <span className="font-mono">{tenantId}</span>
                </p>
              </div>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingRuleId(null);
                }}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newRuleForm.name.trim()) return;
                setIsSubmittingRule(true);
                try {
                  const pills = newRuleForm.selectedActions
                    .map((id) => ACTION_OPTIONS.find((opt) => opt.id === id)?.pill)
                    .filter(Boolean);

                  const backendCatMap: Record<string, string> = {
                    Feedback: newRuleForm.triggerEvent === 'STALE_REQ' ? 'STALE_REQ' : 'FEEDBACK',
                    Interview: 'INTERVIEW',
                    Contract: 'CONTRACT',
                    Compliance: 'COMPLIANCE',
                  };

                  const payload = {
                    name: newRuleForm.name,
                    category: backendCatMap[newRuleForm.category] || 'CUSTOM',
                    triggerEvent: newRuleForm.triggerEvent || 'CUSTOM',
                    whenText: newRuleForm.whenText,
                    threshold: newRuleForm.threshold,
                    thenSummary: newRuleForm.thenSummary,
                    actionPills:
                      pills.length > 0
                        ? pills
                        : [{ label: 'Automated Event', icon: 'bell', color: 'slate' }],
                  };

                  if (editingRuleId) {
                    await apiClient.patch(`/automations/rules/${editingRuleId}`, payload);
                    setActiveRules((prev) =>
                      prev.map((r) =>
                        r.id === editingRuleId ? { ...r, ...payload } : r
                      )
                    );
                    if (onRefreshAutomations) onRefreshAutomations();
                    setShowCreateModal(false);
                    setEditingRuleId(null);
                    showToast('Rule Updated', `"${newRuleForm.name}" updated.`);
                  } else {
                    await apiClient.post('/automations/rules', payload);
                    if (onRefreshAutomations) onRefreshAutomations();
                    setShowCreateModal(false);
                    showToast('Rule Created', `"${newRuleForm.name}" is now active.`);
                  }
                } catch (err: any) {
                  showToast(
                    editingRuleId ? 'Rule Update Error' : 'Rule Creation Error',
                    err.response?.data?.message || err.message || 'Failed to save automation rule.'
                  );
                } finally {
                  setIsSubmittingRule(false);
                }
              }}
              className="p-6 space-y-4 text-xs overflow-y-auto"
            >
              {/* Starter Template Quick-Fill */}
              <div className="space-y-2">
                <div className="text-[11px] font-semibold text-slate-700">Quick-Fill Template</div>
                <div className="flex flex-wrap gap-1.5">
                  {STARTER_TEMPLATES.map((tpl) => (
                    <button
                      type="button"
                      key={tpl.key}
                      onClick={() => applyTemplateToForm(tpl)}
                      className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                        newRuleForm.name === tpl.name
                          ? 'bg-slate-900 border-slate-900 text-white'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {renderCategoryIcon(tpl.category, tpl.triggerEvent)}
                      <span>{tpl.chipLabel}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Rule Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Client Feedback Follow-Up"
                    value={newRuleForm.name}
                    onChange={(e) => setNewRuleForm({ ...newRuleForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:border-brand-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={newRuleForm.category}
                    onChange={(e) => setNewRuleForm({ ...newRuleForm, category: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:border-brand-600 focus:outline-none cursor-pointer"
                  >
                    <option value="Feedback">Feedback &amp; Pipeline</option>
                    <option value="Interview">Interviews</option>
                    <option value="Contract">Contracts</option>
                    <option value="Compliance">Compliance</option>
                  </select>
                </div>
              </div>

              {/* WHEN Condition */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="text-[11px] font-semibold text-slate-800 uppercase tracking-wider">
                  When Trigger Condition
                </div>

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
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:border-brand-600 focus:outline-none cursor-pointer"
                >
                  {WHEN_CONDITION_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>

                {newRuleForm.whenPreset === 'Custom Condition...' && (
                  <input
                    type="text"
                    required
                    placeholder="e.g. Consultant remains on bench without submittal for"
                    value={newRuleForm.whenText}
                    onChange={(e) => setNewRuleForm({ ...newRuleForm, whenText: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:border-brand-600 focus:outline-none"
                  />
                )}

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium text-slate-600">Threshold</label>
                  <div className="flex flex-wrap gap-1.5">
                    {THRESHOLD_PILLS.map((pill) => (
                      <button
                        type="button"
                        key={pill}
                        onClick={() => setNewRuleForm({ ...newRuleForm, threshold: pill })}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors cursor-pointer ${
                          newRuleForm.threshold === pill
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {pill}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* THEN Actions */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="text-[11px] font-semibold text-slate-800 uppercase tracking-wider">
                  Then Actions
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {ACTION_OPTIONS.map(({ id, label, Icon }) => {
                    const checked = newRuleForm.selectedActions.includes(id);
                    return (
                      <label
                        key={id}
                        className={`p-2.5 rounded-lg border flex items-center gap-2 cursor-pointer transition-colors ${
                          checked
                            ? 'bg-white border-brand-500 text-slate-900'
                            : 'bg-white/60 border-slate-200 text-slate-600 hover:bg-white'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleActionCheckbox(id)}
                          className="rounded border-slate-300 text-brand-600 cursor-pointer"
                        />
                        <Icon className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                        <span className="text-[11px] font-medium">{label}</span>
                      </label>
                    );
                  })}
                </div>

                <textarea
                  required
                  rows={2}
                  value={newRuleForm.thenSummary}
                  onChange={(e) => setNewRuleForm({ ...newRuleForm, thenSummary: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:border-brand-600 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3.5 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium rounded-lg text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRule}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-semibold rounded-lg text-xs transition-colors cursor-pointer"
                >
                  {isSubmittingRule ? 'Saving...' : editingRuleId ? 'Save Changes' : 'Create Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
