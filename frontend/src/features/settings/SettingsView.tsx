import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Calendar,
  Check,
  Clock,
  Coins,
  FileCheck2,
  Globe,
  KeyRound,
  LocateFixed,
  Mail,
  MapPin,
  Phone,
  RotateCcw,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { apiClient } from '../../config/api.config';
import {
  getCurrencyMeta,
  getCurrencySelectOptions,
  setWorkspaceCurrency,
} from '../../utils/currency';
import { getInitials } from '../../utils/entityMappers';
import {
  detectBrowserTimezone,
  formatTimezonePreview,
  getTimezoneSelectOptions,
  normalizeTimezoneValue,
} from '../../utils/timezones';
import { setAiCapabilities, setWorkspaceBrand, setWorkspacePolicies } from '../../utils/workspaceBrand';
import { ActionButton } from '../../components/shared/ActionButton';
import { AiMark } from '../../components/shared/AiBrand';
import { CustomSelect, CustomSelectOption } from '../../components/shared/CustomSelect';
import { FormField } from '../../components/shared/FormField';
import { PageHeader } from '../../components/shared/PageHeader';
import { StatusBadge } from '../../components/shared/StatusBadge';

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
  allowByoKey: boolean;
  byo: {
    byoEnabled: boolean;
    byoProvider: string;
    hasApiKey: boolean;
    maskedKeyHint: string;
    cloudflareAccountId: string;
    customBaseUrl: string;
    modelFast: string;
    modelSmart: string;
  };
}

const DEFAULT_GENERAL: GeneralSettings = {
  agencyName: '',
  legalEntityName: '',
  website: '',
  supportEmail: '',
  supportPhone: '',
  headquarters: '',
  timezone: 'America/Chicago',
  dateFormat: 'MM/DD/YYYY',
  currency: 'USD ($)',
  defaultPaymentTerms: 'Net 30 Days',
  standardMonthlyHours: 160,
  maskRatesByDefault: true,
  requirePoForPlacement: false,
};

const DATE_FORMAT_OPTIONS: CustomSelectOption[] = [
  {
    value: 'MM/DD/YYYY',
    label: 'MM/DD/YYYY',
    description: 'US & North America (11/21/2026)',
  },
  {
    value: 'DD/MM/YYYY',
    label: 'DD/MM/YYYY',
    description: 'UK, Europe & India (21/11/2026)',
  },
  {
    value: 'YYYY-MM-DD',
    label: 'YYYY-MM-DD',
    description: 'ISO 8601 standard (2026-11-21)',
  },
];

const PAYMENT_TERMS_OPTIONS: CustomSelectOption[] = [
  { value: 'Net 15 Days', label: 'Net 15 Days', description: 'Accelerated invoice turnaround' },
  { value: 'Net 30 Days', label: 'Net 30 Days', description: 'Standard staffing agency terms' },
  { value: 'Net 45 Days', label: 'Net 45 Days', description: 'Mid-market & MSP terms' },
  { value: 'Net 60 Days', label: 'Net 60 Days', description: 'Enterprise vendor terms' },
];

const MONTHLY_HOURS_OPTIONS: CustomSelectOption[] = [
  { value: '160', label: '160 hrs / month', description: 'Standard 40 hrs/wk × 4 weeks' },
  { value: '168', label: '168 hrs / month', description: '21 working days × 8 hrs' },
  { value: '173', label: '173 hrs / month', description: '52-week annual average' },
];

function normalizeLoadedGeneral(raw?: Partial<GeneralSettings> | null): GeneralSettings {
  const merged = { ...DEFAULT_GENERAL, ...(raw || {}) };
  return {
    ...merged,
    timezone: normalizeTimezoneValue(merged.timezone),
    currency: String(merged.currency || DEFAULT_GENERAL.currency).trim() || DEFAULT_GENERAL.currency,
    standardMonthlyHours: Number(merged.standardMonthlyHours) || 160,
    maskRatesByDefault: Boolean(merged.maskRatesByDefault),
    requirePoForPlacement: Boolean(merged.requirePoForPlacement),
  };
}

interface SettingToggleRowProps {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  icon: React.ReactNode;
  activeLabel: string;
  inactiveLabel: string;
}

const SettingToggleRow: React.FC<SettingToggleRowProps> = ({
  title,
  description,
  checked,
  onChange,
  icon,
  activeLabel,
  inactiveLabel,
}) => (
  <label
    className={`p-3.5 rounded-xl border flex items-center justify-between gap-4 cursor-pointer transition-colors ${
      checked
        ? 'bg-brand-50/35 border-brand-200/80 hover:bg-brand-50/55'
        : 'bg-slate-50/70 border-slate-200/90 hover:bg-slate-100/60'
    }`}
  >
    <div className="flex items-start gap-3 min-w-0">
      <div
        className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
          checked
            ? 'bg-white border-brand-200 text-brand-700'
            : 'bg-white border-slate-200 text-slate-500'
        }`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-slate-900">{title}</span>
          <span
            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md border ${
              checked
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                : 'bg-slate-100 text-slate-500 border-slate-200/80'
            }`}
          >
            {checked ? activeLabel : inactiveLabel}
          </span>
        </div>
        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{description}</p>
      </div>
    </div>

    <span className="relative inline-flex items-center shrink-0">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only peer"
      />
      <span
        className={`w-9 h-5 rounded-full transition-colors duration-150 flex items-center px-0.5 ${
          checked ? 'bg-brand-600' : 'bg-slate-300'
        } peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500/30`}
      >
        <span
          className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-150 ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </span>
    </span>
  </label>
);

export const SettingsView: React.FC<SettingsViewProps> = ({
  showToast,
}) => {
  const [general, setGeneral] = useState<GeneralSettings>(DEFAULT_GENERAL);
  const [savedGeneral, setSavedGeneral] = useState<GeneralSettings>(DEFAULT_GENERAL);
  const [loading, setLoading] = useState(true);
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [previewNow, setPreviewNow] = useState<Date>(() => new Date());

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
    const timer = window.setInterval(() => setPreviewNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

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
            const normalized = normalizeLoadedGeneral(data.general);
            setGeneral(normalized);
            setSavedGeneral(normalized);
            setWorkspaceBrand(data.general);
            setWorkspacePolicies(data.general);
            if (normalized.currency) setWorkspaceCurrency(normalized.currency);
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

  const isDirty = useMemo(
    () => JSON.stringify(general) !== JSON.stringify(savedGeneral),
    [general, savedGeneral]
  );

  const persistGeneralSettings = useCallback(async () => {
    if (loading || savingGeneral) return;
    setSavingGeneral(true);
    try {
      const res = await apiClient.put('/settings/general', general);
      if (res.data?.data) {
        const normalized = normalizeLoadedGeneral(res.data.data);
        setGeneral(normalized);
        setSavedGeneral(normalized);
        setWorkspaceBrand(res.data.data);
        setWorkspacePolicies(res.data.data);
        setWorkspaceCurrency(normalized.currency);
      } else {
        setSavedGeneral(general);
        setWorkspaceBrand(general);
        setWorkspacePolicies(general);
        setWorkspaceCurrency(general.currency);
      }
      showToast('Settings Saved', 'General organization settings updated.', 'success');
    } catch (err: any) {
      showToast(
        'Save Failed',
        err.response?.data?.message || err.message || 'Could not update general settings.',
        'error'
      );
    } finally {
      setSavingGeneral(false);
    }
  }, [general, loading, savingGeneral, showToast]);

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    await persistGeneralSettings();
  };

  useEffect(() => {
    const handleShortcut = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (!loading && !savingGeneral) {
          void persistGeneralSettings();
        }
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [loading, savingGeneral, persistGeneralSettings]);

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

  const timezoneOptions = useMemo(
    () => getTimezoneSelectOptions(general.timezone),
    [general.timezone]
  );

  const currencyOptions = useMemo(
    () => getCurrencySelectOptions(general.currency),
    [general.currency]
  );

  const paymentTermsOptions = useMemo(() => {
    const exists = PAYMENT_TERMS_OPTIONS.some((o) => o.value === general.defaultPaymentTerms);
    if (exists || !general.defaultPaymentTerms) return PAYMENT_TERMS_OPTIONS;
    return [
      { value: general.defaultPaymentTerms, label: general.defaultPaymentTerms },
      ...PAYMENT_TERMS_OPTIONS,
    ];
  }, [general.defaultPaymentTerms]);

  const tzPreview = useMemo(
    () => formatTimezonePreview(general.timezone, general.dateFormat, previewNow),
    [general.timezone, general.dateFormat, previewNow]
  );

  const currencyMeta = useMemo(() => getCurrencyMeta(general.currency), [general.currency]);

  const profileCompletionCount = [
    general.agencyName,
    general.legalEntityName,
    general.website,
    general.headquarters,
    general.supportEmail,
    general.supportPhone,
  ].filter((v) => String(v || '').trim().length > 0).length;

  const inputBaseClass =
    'w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 hover:border-slate-300 focus:border-brand-600 focus:ring-2 focus:ring-brand-500/10 focus:outline-none transition-colors';

  const handleDetectTimezone = () => {
    const detected = detectBrowserTimezone();
    setGeneral((prev) => ({ ...prev, timezone: detected }));
    showToast('Timezone Detected', `Selected ${detected} from your browser.`, 'success');
  };

  return (
    <section className="max-w-7xl mx-auto px-1 sm:px-2 lg:px-4 space-y-5 pb-10 animate-fade-in">
      <PageHeader
        title="General Settings"
        subtitle="Manage agency identity, global timezone & currency localization, and staffing operational defaults."
        badges={
          !loading && (
            <div className="flex items-center gap-2">
              {isDirty ? (
                <StatusBadge tone="amber" size="xs" label="Unsaved changes" />
              ) : (
                <StatusBadge tone="emerald" size="xs" label="All changes saved" />
              )}
              <span className="hidden md:inline text-[11px] text-slate-400">
                ⌘S to save
              </span>
            </div>
          )
        }
        actions={
          !loading && (
            <div className="flex items-center gap-2">
              {isDirty && (
                <button
                  type="button"
                  disabled={savingGeneral}
                  onClick={() => setGeneral(savedGeneral)}
                  className="h-8 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                  <span>Discard</span>
                </button>
              )}
              <ActionButton
                type="button"
                onClick={() => void persistGeneralSettings()}
                loading={savingGeneral}
                loadingText="Saving..."
                icon={<Save className="w-3.5 h-3.5" />}
                className="h-8 px-4 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg text-[11px] whitespace-nowrap shrink-0 transition-colors cursor-pointer"
              >
                Save General Settings
              </ActionButton>
            </div>
          )
        }
      />

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-8 space-y-5">
            <div className="bg-white rounded-xl border border-slate-200/90 card-shadow p-6 h-56 animate-pulse" />
            <div className="bg-white rounded-xl border border-slate-200/90 card-shadow p-6 h-48 animate-pulse" />
          </div>
          <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200/90 card-shadow p-6 h-72 animate-pulse" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Main Configuration Column */}
          <div className="lg:col-span-8 space-y-5">
            <form id="general-settings-form" onSubmit={handleSaveGeneral} className="space-y-5">
              {/* Card 1: Organization & Agency Profile */}
              <div className="bg-white rounded-xl border border-slate-200/90 card-shadow">
                <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-brand-50/80 border border-brand-200/70 text-brand-700 flex items-center justify-center shrink-0">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-slate-900">
                        Organization &amp; Agency Profile
                      </h2>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Agency branding and contact info displayed across submittals, portals, and outbound emails.
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-medium text-slate-500 bg-slate-50 border border-slate-200/80 px-2.5 py-1 rounded-md">
                    {profileCompletionCount} of 6 filled
                  </span>
                </div>

                <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <FormField
                    label="Agency Display Name"
                    htmlFor="settings-agency-name"
                    hint="Shown in workspace header and candidate communications"
                  >
                    <input
                      id="settings-agency-name"
                      type="text"
                      value={general.agencyName}
                      onChange={(e) => setGeneral({ ...general, agencyName: e.target.value })}
                      placeholder="e.g. SquadPipe Staffing"
                      className={inputBaseClass}
                    />
                  </FormField>

                  <FormField
                    label="Legal Entity Name"
                    htmlFor="settings-legal-entity"
                    hint="Used on SOWs, MSAs, and vendor onboarding agreements"
                  >
                    <input
                      id="settings-legal-entity"
                      type="text"
                      value={general.legalEntityName}
                      onChange={(e) => setGeneral({ ...general, legalEntityName: e.target.value })}
                      placeholder="e.g. SquadPipe Solutions LLC"
                      className={inputBaseClass}
                    />
                  </FormField>

                  <FormField label="Company Website" htmlFor="settings-website">
                    <div className="relative flex items-center">
                      <Globe className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
                      <input
                        id="settings-website"
                        type="text"
                        value={general.website}
                        onChange={(e) => setGeneral({ ...general, website: e.target.value })}
                        placeholder="https://your-agency.com"
                        className={`${inputBaseClass} pl-8`}
                      />
                    </div>
                  </FormField>

                  <FormField label="Headquarters Location" htmlFor="settings-headquarters">
                    <div className="relative flex items-center">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
                      <input
                        id="settings-headquarters"
                        type="text"
                        value={general.headquarters}
                        onChange={(e) => setGeneral({ ...general, headquarters: e.target.value })}
                        placeholder="City, State / Country"
                        className={`${inputBaseClass} pl-8`}
                      />
                    </div>
                  </FormField>

                  <FormField label="Operations Desk Email" htmlFor="settings-support-email">
                    <div className="relative flex items-center">
                      <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
                      <input
                        id="settings-support-email"
                        type="email"
                        value={general.supportEmail}
                        onChange={(e) => setGeneral({ ...general, supportEmail: e.target.value })}
                        placeholder="desk@your-agency.com"
                        className={`${inputBaseClass} pl-8`}
                      />
                    </div>
                  </FormField>

                  <FormField label="Operations Phone" htmlFor="settings-support-phone">
                    <div className="relative flex items-center">
                      <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
                      <input
                        id="settings-support-phone"
                        type="text"
                        value={general.supportPhone}
                        onChange={(e) => setGeneral({ ...general, supportPhone: e.target.value })}
                        placeholder="+1 (555) 010-9900"
                        className={`${inputBaseClass} pl-8`}
                      />
                    </div>
                  </FormField>
                </div>
              </div>

              {/* Card 2: Regional Localization & Currency */}
              <div className="bg-white rounded-xl border border-slate-200/90 card-shadow">
                <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200/80 text-slate-700 flex items-center justify-center shrink-0">
                      <Globe className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-slate-900">
                        Regional Localization &amp; Currency
                      </h2>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Searchable global timezone, workspace date notation, and rate formatting currency.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleDetectTimezone}
                    className="h-7 px-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[11px] font-semibold text-slate-700 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                  >
                    <LocateFixed className="w-3 h-3 text-brand-600" />
                    <span>Detect My Timezone</span>
                  </button>
                </div>

                <div className="p-6 space-y-4 text-xs">
                  <FormField
                    label="Default Workspace Timezone"
                    rightSlot={
                      <span className="text-[11px] font-medium text-brand-700 bg-brand-50 border border-brand-200/70 px-2 py-0.5 rounded-md font-mono">
                        {tzPreview.liveTime} · {tzPreview.offsetLabel}
                      </span>
                    }
                    hint={`${tzPreview.longName} (${tzPreview.iana})`}
                  >
                    <CustomSelect
                      value={general.timezone}
                      onChange={(val) => setGeneral({ ...general, timezone: val })}
                      ariaLabel="Default Workspace Timezone"
                      options={timezoneOptions}
                      searchable
                      minMenuWidth={360}
                      searchPlaceholder="Search city, country, offset, or code (e.g. IST, New York, London, +5:30)..."
                      emptySearchText="No matching timezone found"
                      prefixNode={<Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                    />
                  </FormField>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      label="Date Format"
                      hint={`Today formats as ${tzPreview.formattedDate}`}
                    >
                      <CustomSelect
                        value={general.dateFormat}
                        onChange={(val) => setGeneral({ ...general, dateFormat: val })}
                        ariaLabel="Date Format"
                        options={DATE_FORMAT_OPTIONS}
                        prefixNode={<Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                      />
                    </FormField>

                    <FormField
                      label="Billing Currency"
                      hint={`${currencyMeta.name} (${currencyMeta.symbol})`}
                    >
                      <CustomSelect
                        value={general.currency}
                        onChange={(val) => setGeneral({ ...general, currency: val })}
                        ariaLabel="Billing Currency"
                        options={currencyOptions}
                        searchable
                        minMenuWidth={300}
                        searchPlaceholder="Search currency, symbol, or country (e.g. USD, INR, ₹, Euro, Dubai)..."
                        emptySearchText="No matching currency found"
                        prefixNode={<Coins className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                      />
                    </FormField>
                  </div>
                </div>
              </div>

              {/* Card 3: Staffing & Billing Policies */}
              <div className="bg-white rounded-xl border border-slate-200/90 card-shadow">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200/80 text-slate-700 flex items-center justify-center shrink-0">
                    <SlidersHorizontal className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">
                      Staffing &amp; Billing Policies
                    </h2>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Default invoice payment terms, monthly billing hours basis, and placement compliance rules.
                    </p>
                  </div>
                </div>

                <div className="p-6 space-y-5 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      label="Default Payment Terms"
                      hint="Pre-selected when creating new client placements"
                    >
                      <CustomSelect
                        value={general.defaultPaymentTerms}
                        onChange={(val) => setGeneral({ ...general, defaultPaymentTerms: val })}
                        ariaLabel="Default Payment Terms"
                        options={paymentTermsOptions}
                      />
                    </FormField>

                    <FormField
                      label="Monthly Hours Basis"
                      hint={`Used for monthly revenue estimates (${general.standardMonthlyHours} hrs/mo)`}
                    >
                      <CustomSelect
                        value={String(general.standardMonthlyHours)}
                        onChange={(val) =>
                          setGeneral({ ...general, standardMonthlyHours: Number(val) })
                        }
                        ariaLabel="Monthly Hours Basis"
                        options={MONTHLY_HOURS_OPTIONS}
                      />
                    </FormField>
                  </div>

                  <div className="pt-1 border-t border-slate-100 space-y-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Placement Compliance
                    </div>

                    <SettingToggleRow
                      title="Require PO Number on Placements"
                      description="Prompt ops managers to enter a client Purchase Order or SOW reference before activating a placement."
                      checked={general.requirePoForPlacement}
                      onChange={(checked) =>
                        setGeneral({ ...general, requirePoForPlacement: checked })
                      }
                      icon={<FileCheck2 className="w-4 h-4" />}
                      activeLabel="Required"
                      inactiveLabel="Optional"
                    />
                  </div>
                </div>

                {/* Inline bottom form footer bar */}
                <div className="px-6 py-3.5 bg-slate-50/70 border-t border-slate-100 rounded-b-xl flex flex-wrap items-center justify-between gap-3">
                  <span className="text-[11px] text-slate-500">
                    {isDirty
                      ? 'You have unsaved changes ready to publish to your workspace.'
                      : 'Settings are up to date for this agency tenant.'}
                  </span>
                  <div className="flex items-center gap-2">
                    {isDirty && (
                      <button
                        type="button"
                        disabled={savingGeneral}
                        onClick={() => setGeneral(savedGeneral)}
                        className="h-8 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        Reset
                      </button>
                    )}
                    <ActionButton
                      type="submit"
                      loading={savingGeneral}
                      loadingText="Saving..."
                      icon={<Save className="w-3.5 h-3.5" />}
                      className="h-8 px-4 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg text-[11px] whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                    >
                      Save General Settings
                    </ActionButton>
                  </div>
                </div>
              </div>
            </form>

            {/* Optional BYO AI Key Configuration (separate form when tenant BYO key is permitted) */}
            {aiUsage && aiUsage.allowByoKey && (
              <form
                onSubmit={(e) => handleSaveAiConfig(e)}
                className="bg-white rounded-xl border border-slate-200/90 card-shadow text-xs"
              >
                <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <AiMark size="sm" />
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-semibold text-slate-900">
                          SquadAI &middot; Bring Your Own Key
                        </h2>
                        <StatusBadge
                          tone={byoEnabled ? 'emerald' : 'slate'}
                          size="xs"
                          label={byoEnabled ? 'BYO Active' : 'Platform Default'}
                        />
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Credentials are encrypted at rest before storage and override the shared platform key.
                      </p>
                    </div>
                  </div>
                  <label className="inline-flex items-center gap-2.5 font-semibold text-slate-700 cursor-pointer">
                    <span className="relative inline-flex items-center">
                      <input
                        type="checkbox"
                        checked={byoEnabled}
                        onChange={(e) => setByoEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <span
                        className={`w-9 h-5 rounded-full transition-colors duration-150 flex items-center px-0.5 ${
                          byoEnabled ? 'bg-brand-600' : 'bg-slate-300'
                        }`}
                      >
                        <span
                          className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-150 ${
                            byoEnabled ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </span>
                    </span>
                    <span>Enable BYO Key</span>
                  </label>
                </div>

                <div className="p-6 space-y-4">
                  {byoEnabled ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/70 p-4 rounded-xl border border-slate-200/90">
                      <FormField label="AI Provider">
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
                      </FormField>

                      <FormField
                        label="API Key / Token"
                        rightSlot={
                          aiUsage.byo.hasApiKey ? (
                            <button
                              type="button"
                              disabled={savingAiConfig}
                              onClick={(e) => handleSaveAiConfig(e, { clearApiKey: true })}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:underline cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Clear ({aiUsage.byo.maskedKeyHint})</span>
                            </button>
                          ) : undefined
                        }
                      >
                        <div className="relative flex items-center">
                          <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
                          <input
                            type="password"
                            value={byoApiKey}
                            onChange={(e) => setByoApiKey(e.target.value)}
                            placeholder={
                              aiUsage.byo.hasApiKey
                                ? `Saved (${aiUsage.byo.maskedKeyHint}) — enter to replace`
                                : 'Paste provider API key'
                            }
                            className={`${inputBaseClass} pl-8`}
                          />
                        </div>
                      </FormField>

                      {byoProvider === 'cloudflare' && (
                        <div className="md:col-span-2">
                          <FormField label="Cloudflare Account ID">
                            <input
                              type="text"
                              value={byoCloudflareAccountId}
                              onChange={(e) => setByoCloudflareAccountId(e.target.value)}
                              placeholder="32-character Cloudflare Account ID"
                              className={inputBaseClass}
                            />
                          </FormField>
                        </div>
                      )}

                      {(byoProvider === 'ollama' || byoProvider === 'custom') && (
                        <div className="md:col-span-2">
                          <FormField label="Endpoint Base URL">
                            <input
                              type="url"
                              value={byoCustomBaseUrl}
                              onChange={(e) => setByoCustomBaseUrl(e.target.value)}
                              placeholder="https://your-gateway.example/v1"
                              className={inputBaseClass}
                            />
                          </FormField>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80 text-[11px] text-slate-600">
                      Turn on <strong>Enable BYO Key</strong> above to connect your agency&apos;s own OpenAI, Anthropic, Gemini, Cloudflare Workers AI, or self-hosted endpoint credentials.
                    </div>
                  )}

                  <div className="flex justify-end">
                    <ActionButton
                      type="submit"
                      loading={savingAiConfig}
                      loadingText="Saving..."
                      icon={<Save className="w-3.5 h-3.5" />}
                      className="h-8 px-4 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg text-[11px] whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                    >
                      Save AI Provider Key
                    </ActionButton>
                  </div>
                </div>
              </form>
            )}
          </div>

          {/* Right Sticky Preview Sidebar */}
          <aside className="lg:col-span-4 space-y-5 lg:sticky lg:top-6 text-xs">
            <div className="bg-white rounded-xl border border-slate-200/90 card-shadow p-5 space-y-4">
              <div className="pb-3.5 border-b border-slate-100 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-brand-600 shrink-0" />
                  <h3 className="text-sm font-semibold text-slate-900">Workspace Preview</h3>
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Live
                </span>
              </div>

              {/* Agency Brand Preview */}
              <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-brand-600 text-white font-semibold text-xs flex items-center justify-center shrink-0 shadow-sm">
                  {getInitials(general.agencyName || 'SquadPipe Staffing', 'SP')}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-900 truncate">
                    {general.agencyName.trim() || 'Your Staffing Agency'}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate mt-0.5">
                    {general.legalEntityName.trim() || 'Legal entity not set'}
                  </div>
                  {(general.headquarters.trim() || general.website.trim()) && (
                    <div className="text-[10px] text-slate-400 truncate mt-0.5">
                      {[general.headquarters.trim(), general.website.trim()]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  )}
                </div>
              </div>

              {/* Regional Format Live Readout */}
              <div className="space-y-2">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Localization &amp; Rate Formatting
                </div>

                <div className="p-3 rounded-lg bg-slate-50/70 border border-slate-200/80 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500">Local Time</span>
                    <span className="font-semibold font-mono text-slate-900">
                      {tzPreview.liveTime}{' '}
                      <span className="text-[11px] font-medium text-brand-700">
                        ({tzPreview.offsetLabel})
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500">Timezone ID</span>
                    <span className="font-medium text-slate-700 truncate max-w-[180px]" title={tzPreview.iana}>
                      {tzPreview.iana}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500">Sample Date</span>
                    <span className="font-semibold font-mono text-slate-900">
                      {tzPreview.formattedDate}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50/70 border border-slate-200/80 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500">Currency</span>
                    <span className="font-semibold text-slate-900">
                      {currencyMeta.code} ({currencyMeta.symbol}) · {currencyMeta.name}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500">Monthly Hours Basis</span>
                    <span className="font-semibold font-mono text-slate-900">
                      {general.standardMonthlyHours} hrs/mo
                    </span>
                  </div>
                </div>
              </div>

              {/* Active Policy Summary */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Active Workspace Defaults
                </div>
                <div className="flex items-center justify-between gap-2 py-1">
                  <span className="text-slate-600">Payment Terms</span>
                  <span className="font-semibold text-slate-900">{general.defaultPaymentTerms}</span>
                </div>
                <div className="flex items-center justify-between gap-2 py-1">
                  <span className="text-slate-600">Placement PO Check</span>
                  <span
                    className={`inline-flex items-center gap-1 font-semibold ${
                      general.requirePoForPlacement ? 'text-brand-700' : 'text-slate-500'
                    }`}
                  >
                    {general.requirePoForPlacement ? (
                      <>
                        <Check className="w-3 h-3 text-brand-600" />
                        <span>Required</span>
                      </>
                    ) : (
                      <span>Optional</span>
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50/90 border border-slate-200/80 flex items-start gap-2.5 text-[11px] text-slate-600 leading-relaxed">
              <ShieldCheck className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-slate-800">Tenant-Scoped Configuration</div>
                <p className="mt-0.5 text-slate-500">
                  All timezone, currency, branding, and billing defaults saved here apply exclusively to this workspace tenant.
                </p>
              </div>
            </div>
          </aside>
        </div>
      )}
    </section>
  );
};
