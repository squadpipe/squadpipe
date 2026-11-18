import React, { useState, useEffect } from 'react';
import {
  Building2,
  Globe,
  Clock,
  KeyRound,
  Save,
  SlidersHorizontal,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { apiClient } from '../../config/api.config';
import { CURRENCY_OPTIONS, setWorkspaceCurrency } from '../../utils/currency';
import { setAiCapabilities, setWorkspaceBrand, setWorkspacePolicies } from '../../utils/workspaceBrand';
import { ActionButton } from '../../components/shared/ActionButton';
import { CustomSelect } from '../../components/shared/CustomSelect';

interface GeneralSettings {
  agencyName: string;
  legalEntityName: string;
  website: string;
  supportEmail: string;
  supportPhone: string;
  headquarters: string;
  timezone: string;
  dateFormat: string;
  currency: string;
  defaultPaymentTerms: string;
  standardMonthlyHours: number;
  maskRatesByDefault: boolean;
  requirePoForPlacement: boolean;
}

interface SettingsViewProps {
  activeTab?: 'general';
  onTabChange?: (tab: 'general') => void;
  showToast: (title: string, message: string, icon?: string) => void;
}

interface AiUsageSummaryResponse {
  monthStart: string;
  activeProvider: string;
  aiConfigured: boolean;
  usingByoKey: boolean;
  allowByoKey: boolean;
  planTier?: string;
  aiDisabledByPlan?: boolean;
  planActionLimit?: number;
  planTokenLimit?: number;
  actionsUsed: number;
  inputTokens: number;
  outputTokens: number;
  tokensUsed: number;
  actionLimit: number;
  tokenLimit: number;
  quotaExceeded: boolean;
  quotaReason?: string;
  byFeature: Record<string, { actions: number; inputTokens: number; outputTokens: number }>;
  byo: {
    byoEnabled: boolean;
    byoProvider: string;
    hasApiKey: boolean;
    maskedKeyHint: string;
    cloudflareAccountId: string;
    customBaseUrl: string;
    modelFast: string;
    modelSmart: string;
    selfActionLimit?: number | null;
    selfTokenLimit?: number | null;
    monthlyActionLimit: number | null;
    monthlyTokenLimit: number | null;
  };
}

const AI_FEATURE_LABELS: Record<string, string> = {
  resume_parse: 'Resume Parse',
  email_parse: 'Email Intake',
  capability_check: 'Capability Check',
  match_rank: 'Match Rank',
  pitch_draft: 'Pitch Draft',
  agent_prep: 'Action Center',
};

const DEFAULT_GENERAL: GeneralSettings = {
  agencyName: '',
  legalEntityName: '',
  website: '',
  supportEmail: '',
  supportPhone: '',
  headquarters: '',
  timezone: 'America/Chicago (CST/CDT)',
  dateFormat: 'MM/DD/YYYY',
  currency: 'USD ($)',
  defaultPaymentTerms: 'Net 30 Days',
  standardMonthlyHours: 160,
  maskRatesByDefault: true,
  requirePoForPlacement: false,
};

export const SettingsView: React.FC<SettingsViewProps> = ({
  showToast,
}) => {
  const [general, setGeneral] = useState<GeneralSettings>(DEFAULT_GENERAL);
  const [loading, setLoading] = useState(true);
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [aiUsage, setAiUsage] = useState<AiUsageSummaryResponse | null>(null);
  const [savingAiConfig, setSavingAiConfig] = useState(false);
  const [byoEnabled, setByoEnabled] = useState(false);
  const [byoProvider, setByoProvider] = useState('openai');
  const [byoApiKey, setByoApiKey] = useState('');
  const [byoCloudflareAccountId, setByoCloudflareAccountId] = useState('');
  const [byoCustomBaseUrl, setByoCustomBaseUrl] = useState('');
  const [actionLimitInput, setActionLimitInput] = useState('');
  const [tokenLimitInput, setTokenLimitInput] = useState('');

  const syncAiSummaryState = (usage: AiUsageSummaryResponse | null) => {
    setAiUsage(usage);
    if (!usage?.byo) return;
    setByoEnabled(Boolean(usage.byo.byoEnabled));
    setByoProvider(usage.byo.byoProvider || 'openai');
    setByoCloudflareAccountId(usage.byo.cloudflareAccountId || '');
    setByoCustomBaseUrl(usage.byo.customBaseUrl || '');
    const nextSelfAction = usage.byo.selfActionLimit ?? usage.byo.monthlyActionLimit;
    const nextSelfToken = usage.byo.selfTokenLimit ?? usage.byo.monthlyTokenLimit;
    setActionLimitInput(nextSelfAction ? String(nextSelfAction) : '');
    setTokenLimitInput(nextSelfToken ? String(nextSelfToken) : '');
    setByoApiKey('');
  };

  useEffect(() => {
    let active = true;
    Promise.allSettled([apiClient.get('/settings'), apiClient.get('/settings/ai-usage')])
      .then(([settingsRes, usageRes]) => {
        if (!active) return;
        if (settingsRes.status === 'fulfilled') {
          const data = settingsRes.value.data?.data;
          if (data?.ai !== undefined) {
            setAiCapabilities(data.ai);
          }
          if (data?.general) {
            setGeneral({ ...DEFAULT_GENERAL, ...data.general });
            setWorkspaceBrand(data.general);
            setWorkspacePolicies(data.general);
            if (data.general.currency) setWorkspaceCurrency(data.general.currency);
          }
        } else {
          console.warn('Failed to fetch settings:', settingsRes.reason);
        }
        if (usageRes.status === 'fulfilled' && usageRes.value.data?.data) {
          syncAiSummaryState(usageRes.value.data.data);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSaveAiConfig = async (
    e: React.FormEvent,
    options?: { clearApiKey?: boolean }
  ) => {
    e.preventDefault();
    if (savingAiConfig) return;
    setSavingAiConfig(true);
    try {
      const payload: Record<string, any> = {
        selfActionLimit: actionLimitInput.trim() ? Number(actionLimitInput.trim()) : null,
        selfTokenLimit: tokenLimitInput.trim() ? Number(tokenLimitInput.trim()) : null,
      };
      if (aiUsage?.allowByoKey) {
        payload.byoEnabled = byoEnabled;
        payload.byoProvider = byoProvider;
        payload.cloudflareAccountId = byoCloudflareAccountId.trim();
        payload.customBaseUrl = byoCustomBaseUrl.trim();
        if (options?.clearApiKey) {
          payload.clearApiKey = true;
          payload.byoEnabled = false;
        } else if (byoApiKey.trim()) {
          payload.apiKey = byoApiKey.trim();
        }
      }

      const res = await apiClient.put('/settings/ai-config', payload);
      const data = res.data?.data;
      if (data?.summary) syncAiSummaryState(data.summary);
      if (data?.ai) setAiCapabilities(data.ai);

      showToast(
        options?.clearApiKey ? 'BYO AI Key Removed' : 'AI Settings Saved',
        options?.clearApiKey
          ? 'Encrypted workspace AI key was removed.'
          : 'Monthly limits and AI configuration updated.',
        'fa-solid fa-circle-check text-emerald-500'
      );
    } catch (err: any) {
      showToast(
        'Save Failed',
        err?.response?.data?.message || err?.message || 'Could not update AI settings.',
        'fa-solid fa-triangle-exclamation text-rose-500'
      );
    } finally {
      setSavingAiConfig(false);
    }
  };

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingGeneral(true);
    try {
      const res = await apiClient.put('/settings/general', general);
      if (res.data?.data) {
        setGeneral(res.data.data);
        setWorkspaceBrand(res.data.data);
        setWorkspacePolicies(res.data.data);
        setWorkspaceCurrency(res.data.data.currency || general.currency);
      } else {
        setWorkspaceBrand(general);
        setWorkspacePolicies(general);
        setWorkspaceCurrency(general.currency);
      }
      showToast('Settings Saved', 'General organization settings updated.', 'fa-solid fa-circle-check text-emerald-500');
    } catch (err: any) {
      showToast('Save Failed', err.response?.data?.message || err.message || 'Could not update general settings.', 'fa-solid fa-triangle-exclamation text-rose-500');
    } finally {
      setSavingGeneral(false);
    }
  };

  return (
    <section className="max-w-6xl mx-auto space-y-5 animate-fade-in select-none">
      {/* Standalone Page Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shadow-xs">
              <SlidersHorizontal className="w-4 h-4" />
            </span>
            <span>General Settings</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Manage agency profile, currency, localization, and billing operational defaults.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-xs text-slate-500">
          Loading settings...
        </div>
      ) : (
        <form onSubmit={handleSaveGeneral} className="space-y-5">
          {/* Organization Profile */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2.5">
              <Building2 className="w-4 h-4 text-slate-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">Organization &amp; Agency Profile</h3>
                <p className="text-[11px] text-slate-500">Company details displayed across submittals and outbound communications.</p>
              </div>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">Agency Display Name</label>
                <input
                  type="text"
                  value={general.agencyName}
                  onChange={(e) => setGeneral({ ...general, agencyName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 focus:border-brand-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">Legal Entity Name</label>
                <input
                  type="text"
                  value={general.legalEntityName}
                  onChange={(e) => setGeneral({ ...general, legalEntityName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 focus:border-brand-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">Company Website</label>
                <input
                  type="text"
                  value={general.website}
                  onChange={(e) => setGeneral({ ...general, website: e.target.value })}
                  placeholder="https://your-agency.com"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 focus:border-brand-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">Headquarters Location</label>
                <input
                  type="text"
                  value={general.headquarters}
                  onChange={(e) => setGeneral({ ...general, headquarters: e.target.value })}
                  placeholder="City, State / Country"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 focus:border-brand-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">Operations Desk Email</label>
                <input
                  type="email"
                  value={general.supportEmail}
                  onChange={(e) => setGeneral({ ...general, supportEmail: e.target.value })}
                  placeholder="desk@your-agency.com"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 focus:border-brand-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">Operations Phone</label>
                <input
                  type="text"
                  value={general.supportPhone}
                  onChange={(e) => setGeneral({ ...general, supportPhone: e.target.value })}
                  placeholder="+1 (555) 010-9900"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 focus:border-brand-600 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Regional & Staffing Policies */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2.5">
                <Globe className="w-4 h-4 text-slate-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Regional &amp; Formatting</h3>
                  <p className="text-[11px] text-slate-500">Default timezone, date display, and billing currency.</p>
                </div>
              </div>
              <div className="p-5 space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">Default Timezone</label>
                  <CustomSelect
                    value={general.timezone}
                    onChange={(val) => setGeneral({ ...general, timezone: val })}
                    ariaLabel="Default Timezone"
                    options={[
                      'America/New_York (EST/EDT)',
                      'America/Chicago (CST/CDT)',
                      'America/Denver (MST/MDT)',
                      'America/Los_Angeles (PST/PDT)',
                      'UTC',
                    ]}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1.5">Date Format</label>
                    <CustomSelect
                      value={general.dateFormat}
                      onChange={(val) => setGeneral({ ...general, dateFormat: val })}
                      ariaLabel="Date Format"
                      options={['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD']}
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1.5">Currency</label>
                    <CustomSelect
                      value={general.currency}
                      onChange={(val) => setGeneral({ ...general, currency: val })}
                      ariaLabel="Currency"
                      options={CURRENCY_OPTIONS}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-slate-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Staffing &amp; Billing Policies</h3>
                  <p className="text-[11px] text-slate-500">Default contract terms, billing calculation hours, and access rules.</p>
                </div>
              </div>
              <div className="p-5 space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1.5">Default Payment Terms</label>
                    <CustomSelect
                      value={general.defaultPaymentTerms}
                      onChange={(val) => setGeneral({ ...general, defaultPaymentTerms: val })}
                      ariaLabel="Default Payment Terms"
                      options={['Net 15 Days', 'Net 30 Days', 'Net 45 Days', 'Net 60 Days']}
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1.5">Monthly Hours Basis</label>
                    <CustomSelect
                      value={String(general.standardMonthlyHours)}
                      onChange={(val) =>
                        setGeneral({ ...general, standardMonthlyHours: Number(val) })
                      }
                      ariaLabel="Monthly Hours Basis"
                      options={[
                        { value: '160', label: '160 hrs / month' },
                        { value: '168', label: '168 hrs / month' },
                        { value: '173', label: '173 hrs / month' },
                      ]}
                    />
                  </div>
                </div>

                <div className="space-y-2.5 pt-1">
                  <label className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50/70 cursor-pointer">
                    <div>
                      <div className="font-semibold text-slate-800">Mask Client Bill Rates for Recruiters</div>
                      <div className="text-[11px] text-slate-500">Hide billing margin unless explicitly granted</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={general.maskRatesByDefault}
                      onChange={(e) => setGeneral({ ...general, maskRatesByDefault: e.target.checked })}
                      className="w-4 h-4 text-brand-600 rounded cursor-pointer"
                    />
                  </label>
                  <label className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50/70 cursor-pointer">
                    <div>
                      <div className="font-semibold text-slate-800">Require PO Number on Placements</div>
                      <div className="text-[11px] text-slate-500">Prompt for SOW / Purchase Order ID on activation</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={general.requirePoForPlacement}
                      onChange={(e) => setGeneral({ ...general, requirePoForPlacement: e.target.checked })}
                      className="w-4 h-4 text-brand-600 rounded cursor-pointer"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <ActionButton
              type="submit"
              loading={savingGeneral}
              loadingText="Saving..."
              icon={<Save className="w-3.5 h-3.5" />}
              className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg text-xs shadow-xs transition-colors cursor-pointer"
            >
              Save General Settings
            </ActionButton>
          </div>
        </form>
      )}

      {/* AI Metering, Monthly Quotas & Optional BYO Key Controls */}
      {!loading && aiUsage && (
        <form
          onSubmit={(e) => handleSaveAiConfig(e)}
          className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden text-xs"
        >
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-brand-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  AI Usage &amp; Monthly Quota Controls
                </h3>
                <p className="text-[11px] text-slate-500">
                  Track monthly metered AI calls, enforce caps, and fall back safely to offline workflows when limits are reached.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {aiUsage.planTier && aiUsage.planTier !== 'default' && (
                <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold border bg-indigo-50 text-indigo-700 border-indigo-200 capitalize">
                  Plan: {aiUsage.planTier}
                </span>
              )}
              <span
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                  aiUsage.aiConfigured && !aiUsage.quotaExceeded
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : aiUsage.quotaExceeded
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}
              >
                {aiUsage.aiDisabledByPlan
                  ? 'Disabled on Current Plan'
                  : aiUsage.quotaExceeded
                    ? 'Monthly Limit Reached (Offline Mode Active)'
                    : aiUsage.aiConfigured
                      ? `Active (${aiUsage.activeProvider.toUpperCase()}${aiUsage.usingByoKey ? ' • BYO Key' : ''})`
                      : 'Standard Offline Mode (AI Disabled)'}
              </span>
            </div>
          </div>

          <div className="p-5 space-y-5">
            {aiUsage.quotaReason && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-medium">
                {aiUsage.quotaReason}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                <div className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">
                  Monthly Actions Used
                </div>
                <div className="text-lg font-bold text-slate-900 tabular-nums">
                  {aiUsage.actionsUsed.toLocaleString()}
                  {aiUsage.actionLimit > 0 && (
                    <span className="text-xs font-semibold text-slate-400">
                      {' '}
                      / {aiUsage.actionLimit.toLocaleString()}
                    </span>
                  )}
                </div>
                {aiUsage.actionLimit > 0 ? (
                  <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        aiUsage.quotaExceeded ? 'bg-amber-500' : 'bg-brand-600'
                      }`}
                      style={{
                        width: `${Math.min(100, Math.round((aiUsage.actionsUsed / aiUsage.actionLimit) * 100))}%`,
                      }}
                    />
                  </div>
                ) : (
                  <div className="text-[10.5px] text-slate-400">No monthly action cap configured</div>
                )}
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                <div className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">
                  Monthly Tokens Used
                </div>
                <div className="text-lg font-bold text-slate-900 tabular-nums">
                  {aiUsage.tokensUsed.toLocaleString()}
                  {aiUsage.tokenLimit > 0 && (
                    <span className="text-xs font-semibold text-slate-400">
                      {' '}
                      / {aiUsage.tokenLimit.toLocaleString()}
                    </span>
                  )}
                </div>
                <div className="text-[10.5px] text-slate-500 tabular-nums">
                  {aiUsage.inputTokens.toLocaleString()} input &bull;{' '}
                  {aiUsage.outputTokens.toLocaleString()} output
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                <div className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">
                  Activity Breakdown
                </div>
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {Object.entries(aiUsage.byFeature).map(([feature, stats]) => (
                    <span
                      key={feature}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-medium border ${
                        stats.actions > 0
                          ? 'bg-white border-slate-200 text-slate-800 font-semibold'
                          : 'bg-slate-100/70 border-slate-200/60 text-slate-400'
                      }`}
                    >
                      {AI_FEATURE_LABELS[feature] || feature}: {stats.actions}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">
                  Self-Imposed Monthly Action Cap (Optional)
                </label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={actionLimitInput}
                  onChange={(e) => setActionLimitInput(e.target.value)}
                  placeholder={
                    !aiUsage.usingByoKey && (aiUsage.planActionLimit || 0) > 0
                      ? `Plan ceiling: ${aiUsage.planActionLimit?.toLocaleString()} actions/mo`
                      : 'Leave empty for plan / unlimited default'
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:border-brand-500 focus:outline-none"
                />
                <p className="text-[10.5px] text-slate-400 mt-1">
                  {aiUsage.usingByoKey
                    ? 'Applies to your own BYO API key.'
                    : (aiUsage.planActionLimit || 0) > 0
                      ? `Plan allowance: ${aiUsage.planActionLimit?.toLocaleString()} actions/mo (can lower below plan cap, cannot exceed it).`
                      : 'Plan allowance: Unlimited (optional workspace budget guard).'}
                </p>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">
                  Self-Imposed Monthly Token Cap (Optional)
                </label>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={tokenLimitInput}
                  onChange={(e) => setTokenLimitInput(e.target.value)}
                  placeholder={
                    !aiUsage.usingByoKey && (aiUsage.planTokenLimit || 0) > 0
                      ? `Plan ceiling: ${aiUsage.planTokenLimit?.toLocaleString()} tokens/mo`
                      : 'Leave empty for plan / unlimited default'
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:border-brand-500 focus:outline-none"
                />
                <p className="text-[10.5px] text-slate-400 mt-1">
                  {aiUsage.usingByoKey
                    ? 'Applies to your own BYO API key.'
                    : (aiUsage.planTokenLimit || 0) > 0
                      ? `Plan allowance: ${aiUsage.planTokenLimit?.toLocaleString()} tokens/mo (can lower below plan cap, cannot exceed it).`
                      : 'Plan allowance: Unlimited (optional token budget guard).'}
                </p>
              </div>
            </div>

            {/* Optional BYO AI Key Section (SaaS / Enterprise Plan Flagged Only) */}
            {aiUsage.allowByoKey && (
              <div className="pt-4 border-t border-slate-200 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-brand-600" />
                    <div>
                      <div className="font-bold text-slate-900">Bring Your Own AI Key (BYO Key)</div>
                      <div className="text-[11px] text-slate-500">
                        Credentials are encrypted at rest before storage and override the shared platform key.
                      </div>
                    </div>
                  </div>
                  <label className="inline-flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={byoEnabled}
                      onChange={(e) => setByoEnabled(e.target.checked)}
                      className="w-4 h-4 text-brand-600 rounded cursor-pointer"
                    />
                    <span>Enable BYO Key</span>
                  </label>
                </div>

                {byoEnabled && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/70 p-4 rounded-xl border border-slate-200">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1.5">
                        Provider
                      </label>
                      <CustomSelect
                        value={byoProvider}
                        onChange={setByoProvider}
                        ariaLabel="BYO AI Provider"
                        options={[
                          { value: 'openai', label: 'OpenAI' },
                          { value: 'anthropic', label: 'Anthropic Claude' },
                          { value: 'gemini', label: 'Google Gemini' },
                          { value: 'cloudflare', label: 'Cloudflare Workers AI' },
                          { value: 'ollama', label: 'Self-Hosted Ollama' },
                          { value: 'custom', label: 'Custom OpenAI-Compatible Endpoint' },
                        ]}
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="font-semibold text-slate-700">API Key / Token</label>
                        {aiUsage.byo.hasApiKey && (
                          <button
                            type="button"
                            disabled={savingAiConfig}
                            onClick={(e) => handleSaveAiConfig(e, { clearApiKey: true })}
                            className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-rose-600 hover:underline cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Clear ({aiUsage.byo.maskedKeyHint})</span>
                          </button>
                        )}
                      </div>
                      <input
                        type="password"
                        value={byoApiKey}
                        onChange={(e) => setByoApiKey(e.target.value)}
                        placeholder={
                          aiUsage.byo.hasApiKey
                            ? `Saved (${aiUsage.byo.maskedKeyHint}) — enter to replace`
                            : 'Paste provider API key'
                        }
                        className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg focus:border-brand-500 focus:outline-none"
                      />
                    </div>

                    {byoProvider === 'cloudflare' && (
                      <div className="md:col-span-2">
                        <label className="block font-semibold text-slate-700 mb-1.5">
                          Cloudflare Account ID
                        </label>
                        <input
                          type="text"
                          value={byoCloudflareAccountId}
                          onChange={(e) => setByoCloudflareAccountId(e.target.value)}
                          placeholder="32-character Cloudflare Account ID"
                          className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg focus:border-brand-500 focus:outline-none"
                        />
                      </div>
                    )}

                    {(byoProvider === 'ollama' || byoProvider === 'custom') && (
                      <div className="md:col-span-2">
                        <label className="block font-semibold text-slate-700 mb-1.5">
                          Endpoint Base URL
                        </label>
                        <input
                          type="url"
                          value={byoCustomBaseUrl}
                          onChange={(e) => setByoCustomBaseUrl(e.target.value)}
                          placeholder="https://your-gateway.example/v1"
                          className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg focus:border-brand-500 focus:outline-none"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end">
              <ActionButton
                type="submit"
                loading={savingAiConfig}
                loadingText="Saving..."
                icon={<Save className="w-3.5 h-3.5" />}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg text-xs shadow-xs transition-colors cursor-pointer"
              >
                Save AI Controls
              </ActionButton>
            </div>
          </div>
        </form>
      )}
    </section>
  );
};

