import React, { useState, useEffect } from 'react';
import {
  Building2,
  Globe,
  Clock,
  KeyRound,
  Save,
  Trash2,
} from 'lucide-react';
import { apiClient } from '../../config/api.config';
import { CURRENCY_OPTIONS, setWorkspaceCurrency } from '../../utils/currency';
import { setAiCapabilities, setWorkspaceBrand, setWorkspacePolicies } from '../../utils/workspaceBrand';
import { ActionButton } from '../../components/shared/ActionButton';
import { AiMark } from '../../components/shared/AiBrand';
import { CustomSelect } from '../../components/shared/CustomSelect';
import { PageHeader } from '../../components/shared/PageHeader';

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

  const syncAiSummaryState = (usage: AiUsageSummaryResponse | null) => {
    setAiUsage(usage);
    if (!usage?.byo) return;
    setByoEnabled(Boolean(usage.byo.byoEnabled));
    setByoProvider(usage.byo.byoProvider || 'openai');
    setByoCloudflareAccountId(usage.byo.cloudflareAccountId || '');
    setByoCustomBaseUrl(usage.byo.customBaseUrl || '');
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
        byoEnabled,
        byoProvider,
        cloudflareAccountId: byoCloudflareAccountId.trim(),
        customBaseUrl: byoCustomBaseUrl.trim(),
      };
      if (options?.clearApiKey) {
        payload.clearApiKey = true;
        payload.byoEnabled = false;
      } else if (byoApiKey.trim()) {
        payload.apiKey = byoApiKey.trim();
      }

      const res = await apiClient.put('/settings/ai-config', payload);
      const data = res.data?.data;
      if (data?.summary) syncAiSummaryState(data.summary);
      if (data?.ai) setAiCapabilities(data.ai);

      showToast(
        options?.clearApiKey ? 'BYO AI Key Removed' : 'AI Provider Key Saved',
        options?.clearApiKey
          ? 'Encrypted workspace AI key was removed.'
          : 'Bring-your-own AI provider settings updated.',
        'success'
      );
    } catch (err: any) {
      showToast(
        'Save Failed',
        err?.response?.data?.message || err?.message || 'Could not update AI settings.',
        'error'
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
      showToast('Settings Saved', 'General organization settings updated.', 'success');
    } catch (err: any) {
      showToast('Save Failed', err.response?.data?.message || err.message || 'Could not update general settings.', 'error');
    } finally {
      setSavingGeneral(false);
    }
  };

  return (
    <section className="max-w-7xl mx-auto px-1 sm:px-2 lg:px-4 space-y-5 pb-8 animate-fade-in select-none">
      <PageHeader
        title="General Settings"
        subtitle="Manage agency profile, currency, localization, and billing operational defaults."
      />

      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200/90 card-shadow p-10 text-center text-xs text-slate-500">
          Loading settings...
        </div>
      ) : (
        <form onSubmit={handleSaveGeneral} className="space-y-5">
          {/* Organization Profile */}
          <div className="bg-white rounded-xl border border-slate-200/90 card-shadow overflow-hidden">
            <div className="px-6 py-3.5 border-b border-slate-100 bg-white flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-200/80 text-slate-600 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-3.5 h-3.5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Organization &amp; Agency Profile</h3>
                <p className="text-[11px] text-slate-500">Company details displayed across submittals and outbound communications.</p>
              </div>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
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
            <div className="bg-white rounded-xl border border-slate-200/90 card-shadow overflow-hidden">
              <div className="px-6 py-3.5 border-b border-slate-100 bg-white flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-200/80 text-slate-600 flex items-center justify-center flex-shrink-0">
                  <Globe className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Regional &amp; Formatting</h3>
                  <p className="text-[11px] text-slate-500">Default timezone, date display, and billing currency.</p>
                </div>
              </div>
              <div className="p-6 space-y-4 text-xs">
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

            <div className="bg-white rounded-xl border border-slate-200/90 card-shadow overflow-hidden">
              <div className="px-6 py-3.5 border-b border-slate-100 bg-white flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-200/80 text-slate-600 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Staffing &amp; Billing Policies</h3>
                  <p className="text-[11px] text-slate-500">Default contract terms, billing calculation hours, and access rules.</p>
                </div>
              </div>
              <div className="p-6 space-y-4 text-xs">
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
              className="h-8 px-4 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg text-[11px] transition-colors cursor-pointer"
            >
              Save General Settings
            </ActionButton>
          </div>
        </form>
      )}

      {/* Optional BYO AI Key Configuration (only shown when tenant BYO key is permitted) */}
      {!loading && aiUsage && aiUsage.allowByoKey && (
        <form
          onSubmit={(e) => handleSaveAiConfig(e)}
          className="bg-white rounded-xl border border-slate-200/90 card-shadow overflow-hidden text-xs"
        >
          <div className="px-6 py-3.5 border-b border-slate-100 bg-white flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <AiMark size="sm" />
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  PipeAI &middot; Bring Your Own Key (BYO Key)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Credentials are encrypted at rest before storage and override the shared platform key. View token metrics on the Usage page once active.
                </p>
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

          <div className="p-5 space-y-4">
            {byoEnabled && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/70 p-4 rounded-xl border border-slate-200">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">Provider</label>
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
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:underline cursor-pointer"
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

            <div className="flex justify-end">
              <ActionButton
                type="submit"
                loading={savingAiConfig}
                loadingText="Saving..."
                icon={<Save className="w-3.5 h-3.5" />}
                className="h-8 px-4 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg text-[11px] transition-colors cursor-pointer"
              >
                Save AI Provider Key
              </ActionButton>
            </div>
          </div>
        </form>
      )}
    </section>
  );
};

