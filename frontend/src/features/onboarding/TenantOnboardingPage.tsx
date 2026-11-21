import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Calendar,
  Check,
  Clock,
  Coins,
  Eye,
  EyeOff,
  Globe,
  LocateFixed,
  LogOut,
  Mail,
  MapPin,
  Phone,
  Plus,
  Rocket,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
import { apiClient } from '../../config/api.config';
import { User } from '../../types';
import { ActionButton } from '../../components/shared/ActionButton';
import { BrandLogo } from '../../components/shared/BrandMark';
import { CustomSelect, CustomSelectOption } from '../../components/shared/CustomSelect';
import { FormField } from '../../components/shared/FormField';
import { getCurrencyMeta, getCurrencySelectOptions, setWorkspaceCurrency } from '../../utils/currency';
import {
  detectBrowserTimezone,
  formatTimezonePreview,
  getTimezoneSelectOptions,
  normalizeTimezoneValue,
} from '../../utils/timezones';
import { setWorkspaceBrand, setWorkspacePolicies } from '../../utils/workspaceBrand';
import {
  getDefaultRateMaskForRole,
  USER_DESK_OPTIONS,
  USER_ROLE_SELECT_OPTIONS,
} from '../user-management/userUtils';

interface TenantOnboardingPageProps {
  currentUser: User;
  onCompleteOnboarding: (updates?: { agencyName?: string }) => void;
  onSignOut: () => void;
  showToast: (title: string, message: string, icon?: string) => void;
}

interface OnboardingInviteRow {
  localId: string;
  name: string;
  email: string;
  role: string;
  desk: string;
  rateMasked: boolean;
  rateManuallySet: boolean;
}

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

const STEPS = [
  {
    id: 1 as const,
    title: 'Agency Profile',
    subtitle: 'Branding & contact info',
    icon: Building2,
  },
  {
    id: 2 as const,
    title: 'Localization & Currency',
    subtitle: 'Timezone, dates & rates',
    icon: Globe,
  },
  {
    id: 3 as const,
    title: 'Invite Your Team',
    subtitle: 'Optional collaborators',
    icon: Users,
  },
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function createInviteDraft(): OnboardingInviteRow {
  const role = 'Technical Recruiter';
  return {
    localId: `onb_inv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: '',
    email: '',
    role,
    desk: 'US IT Contract (C2C & W2)',
    rateMasked: getDefaultRateMaskForRole(role),
    rateManuallySet: false,
  };
}

/**
 * Dedicated resumable 3-step Tenant Account Onboarding wizard displayed after
 * email OTP verification and before first workspace entry (all steps skippable).
 */
export const TenantOnboardingPage: React.FC<TenantOnboardingPageProps> = ({
  currentUser,
  onCompleteOnboarding,
  onSignOut,
  showToast,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [hydrating, setHydrating] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Step 1: Agency Profile
  const [agencyName, setAgencyName] = useState(currentUser.agencyName || '');
  const [legalEntityName, setLegalEntityName] = useState('');
  const [website, setWebsite] = useState('');
  const [headquarters, setHeadquarters] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [supportPhone, setSupportPhone] = useState('');

  // Step 2: Regional Localization & Operational Defaults
  const [timezone, setTimezone] = useState(() => detectBrowserTimezone());
  const [dateFormat, setDateFormat] = useState('MM/DD/YYYY');
  const [currency, setCurrency] = useState('USD ($)');
  const [defaultPaymentTerms, setDefaultPaymentTerms] = useState('Net 30 Days');
  const [standardMonthlyHours, setStandardMonthlyHours] = useState(160);

  // Step 3: Optional Team Invites
  const [inviteRows, setInviteRows] = useState<OnboardingInviteRow[]>(() => [createInviteDraft()]);
  const [inviteAttempted, setInviteAttempted] = useState(false);

  useEffect(() => {
    let active = true;
    apiClient
      .get('/settings')
      .then((res) => {
        if (!active) return;
        const g = res.data?.data?.general;
        if (!g) return;
        if (g.agencyName) setAgencyName(String(g.agencyName));
        if (g.legalEntityName) setLegalEntityName(String(g.legalEntityName));
        if (g.website) setWebsite(String(g.website));
        if (g.headquarters) setHeadquarters(String(g.headquarters));
        if (g.supportEmail) setSupportEmail(String(g.supportEmail));
        if (g.supportPhone) setSupportPhone(String(g.supportPhone));
        if (g.timezone) setTimezone(normalizeTimezoneValue(g.timezone));
        if (g.dateFormat) setDateFormat(String(g.dateFormat));
        if (g.currency) setCurrency(String(g.currency));
        if (g.defaultPaymentTerms) setDefaultPaymentTerms(String(g.defaultPaymentTerms));
        if (g.standardMonthlyHours) {
          setStandardMonthlyHours(Number(g.standardMonthlyHours) || 160);
        }
      })
      .catch(() => {
        // Proceed smoothly with signup defaults if settings fetch fails
      })
      .finally(() => {
        if (active) setHydrating(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const timezoneOptions = useMemo(() => getTimezoneSelectOptions(timezone), [timezone]);
  const currencyOptions = useMemo(() => getCurrencySelectOptions(currency), [currency]);
  const tzPreview = useMemo(
    () => formatTimezonePreview(timezone, dateFormat),
    [timezone, dateFormat]
  );
  const currencyMeta = useMemo(() => getCurrencyMeta(currency), [currency]);

  const buildGeneralPayload = (completed: boolean) => ({
    agencyName: agencyName.trim() || currentUser.agencyName || 'SquadPipe Staffing',
    legalEntityName: legalEntityName.trim(),
    website: website.trim(),
    headquarters: headquarters.trim(),
    supportEmail: supportEmail.trim(),
    supportPhone: supportPhone.trim(),
    timezone: normalizeTimezoneValue(timezone),
    dateFormat,
    currency,
    defaultPaymentTerms,
    standardMonthlyHours: Number(standardMonthlyHours) || 160,
    onboardingCompleted: completed,
  });

  const persistProgress = async (completed: boolean) => {
    const payload = buildGeneralPayload(completed);
    const res = await apiClient.put('/settings/general', payload);
    const saved = res.data?.data || payload;
    setWorkspaceBrand(saved);
    setWorkspacePolicies(saved);
    setWorkspaceCurrency(saved.currency || payload.currency);
    return saved;
  };

  const handleContinueFromStep1 = async () => {
    if (submitting) return;
    if (!agencyName.trim()) {
      showToast('Agency Name Required', 'Please enter a display name for your agency.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await persistProgress(false);
      setStep(2);
    } catch (err: any) {
      showToast(
        'Save Failed',
        err?.response?.data?.message || 'Could not save agency details.',
        'error'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleContinueFromStep2 = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await persistProgress(false);
      setStep(3);
    } catch (err: any) {
      showToast(
        'Save Failed',
        err?.response?.data?.message || 'Could not save localization settings.',
        'error'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinishAndEnterWorkspace = async (options?: { skipInvites?: boolean }) => {
    if (submitting) return;

    const filledInvites = options?.skipInvites
      ? []
      : inviteRows.filter((r) => Boolean(r.name.trim() || r.email.trim()));

    if (filledInvites.length > 0) {
      const seen = new Set<string>([currentUser.email.trim().toLowerCase()]);
      for (let i = 0; i < filledInvites.length; i++) {
        const row = filledInvites[i];
        const em = row.email.trim().toLowerCase();
        if (!row.name.trim() || !EMAIL_PATTERN.test(em)) {
          setInviteAttempted(true);
          showToast(
            'Check Teammate Details',
            `Please enter both full name and a valid work email for invite #${i + 1}, or skip invites for now.`,
            'error'
          );
          return;
        }
        if (seen.has(em)) {
          setInviteAttempted(true);
          showToast(
            'Duplicate Email',
            `"${em}" appears more than once or matches your own email.`,
            'error'
          );
          return;
        }
        seen.add(em);
      }
    }

    setInviteAttempted(false);
    setSubmitting(true);
    try {
      let sentCount = 0;
      if (filledInvites.length > 0) {
        const inviteRes = await apiClient.post('/users/invite/batch', {
          members: filledInvites.map((r) => ({
            name: r.name.trim(),
            email: r.email.trim().toLowerCase(),
            role: r.role,
            desk: r.desk,
            rateMasked: r.rateMasked,
          })),
        });
        const results = Array.isArray(inviteRes.data?.data?.results)
          ? inviteRes.data.data.results
          : [];
        sentCount = results.filter((r: any) => r.ok).length;
      }

      const saved = await persistProgress(true);
      showToast(
        'Workspace Ready',
        sentCount > 0
          ? `${saved.agencyName || 'Workspace'} is configured and ${sentCount} team invite${sentCount === 1 ? '' : 's'} created.`
          : `${saved.agencyName || 'Your workspace'} is ready! You can adjust settings anytime.`,
        'success'
      );
      onCompleteOnboarding({ agencyName: saved.agencyName || agencyName.trim() });
    } catch (err: any) {
      showToast(
        'Setup Issue',
        err?.response?.data?.message || err?.message || 'Could not finish onboarding.',
        'error'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkipAllToWorkspace = async () => {
    await handleFinishAndEnterWorkspace({ skipInvites: true });
  };

  const updateInviteRow = (
    localId: string,
    updater: (prev: OnboardingInviteRow) => OnboardingInviteRow
  ) => {
    setInviteRows((prev) => prev.map((r) => (r.localId === localId ? updater(r) : r)));
  };

  const filledInviteCount = inviteRows.filter((r) => Boolean(r.name.trim() || r.email.trim())).length;

  const inputBaseClass =
    'w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 hover:border-slate-300 focus:border-brand-600 focus:ring-2 focus:ring-brand-500/10 focus:outline-none transition-colors';

  return (
    <div className="min-h-screen w-full bg-[#FAFAFA] text-slate-800 flex flex-col">
      {/* Clean Minimal Onboarding Top Bar */}
      <header className="bg-white border-b border-slate-200/80 px-4 sm:px-8 h-14 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <BrandLogo size="sm" surface="light" className="shrink-0" />
          <span className="h-4 w-px bg-slate-200 hidden sm:block" />
          <span className="text-xs font-medium text-slate-500 truncate hidden sm:inline">
            Workspace Setup &middot; {agencyName.trim() || currentUser.agencyName || 'New Agency'}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={submitting}
            onClick={() => void handleSkipAllToWorkspace()}
            className="h-8 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer disabled:opacity-50"
          >
            Skip setup &amp; go to workspace
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={onSignOut}
            title="Sign out"
            className="h-8 px-2.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 text-[11px] font-medium inline-flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer disabled:opacity-50"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      {/* Main Centered Onboarding Canvas */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
        {/* Welcome Hero */}
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-brand-50 border border-brand-200/70 text-[11px] font-semibold text-brand-700">
            <Sparkles className="w-3 h-3" />
            <span>Welcome, {currentUser.name}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold text-slate-900 tracking-tight">
            Set up your recruiting workspace
          </h1>
          <p className="text-xs text-slate-500 max-w-lg mx-auto leading-relaxed">
            Configure your agency profile, regional defaults, and optional team invites. Everything can be edited or skipped for later.
          </p>
        </div>

        {/* 3-Step Visual Stepper */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {STEPS.map((s) => {
            const Icon = s.icon;
            const isCurrent = step === s.id;
            const isPast = step > s.id;
            return (
              <button
                key={s.id}
                type="button"
                disabled={submitting || hydrating}
                onClick={() => setStep(s.id)}
                className={`p-3 rounded-xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                  isCurrent
                    ? 'bg-white border-brand-600 ring-2 ring-brand-500/10 card-shadow'
                    : isPast
                    ? 'bg-white border-emerald-200 hover:border-emerald-300'
                    : 'bg-white/70 border-slate-200/80 hover:border-slate-300'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-semibold ${
                    isCurrent
                      ? 'bg-brand-600 text-white'
                      : isPast
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {isPast ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-900 truncate">
                    {s.id}. {s.title}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">{s.subtitle}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Active Step Card */}
        {hydrating ? (
          <div className="bg-white rounded-xl border border-slate-200/90 card-shadow p-12 text-center text-xs text-slate-500">
            Preparing your workspace setup...
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200/90 card-shadow animate-fade-in">
            {/* STEP 1: AGENCY PROFILE */}
            {step === 1 && (
              <>
                <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-brand-50/80 border border-brand-200/70 text-brand-700 flex items-center justify-center shrink-0">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">
                      Agency Profile &amp; Branding
                    </h2>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Displayed across candidate portals, client submittals, and outbound communications.
                    </p>
                  </div>
                </div>

                <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <FormField label="Agency Display Name" htmlFor="onb-agency-name" required>
                    <input
                      id="onb-agency-name"
                      type="text"
                      value={agencyName}
                      onChange={(e) => setAgencyName(e.target.value)}
                      placeholder="e.g. Apex Tech Staffing"
                      className={inputBaseClass}
                    />
                  </FormField>

                  <FormField label="Legal Entity Name (Optional)" htmlFor="onb-legal-entity">
                    <input
                      id="onb-legal-entity"
                      type="text"
                      value={legalEntityName}
                      onChange={(e) => setLegalEntityName(e.target.value)}
                      placeholder="e.g. Apex Tech Staffing LLC"
                      className={inputBaseClass}
                    />
                  </FormField>

                  <FormField label="Company Website (Optional)" htmlFor="onb-website">
                    <div className="relative flex items-center">
                      <Globe className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
                      <input
                        id="onb-website"
                        type="text"
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                        placeholder="https://your-agency.com"
                        className={`${inputBaseClass} pl-8`}
                      />
                    </div>
                  </FormField>

                  <FormField label="Headquarters Location (Optional)" htmlFor="onb-hq">
                    <div className="relative flex items-center">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
                      <input
                        id="onb-hq"
                        type="text"
                        value={headquarters}
                        onChange={(e) => setHeadquarters(e.target.value)}
                        placeholder="City, State / Country"
                        className={`${inputBaseClass} pl-8`}
                      />
                    </div>
                  </FormField>

                  <FormField label="Operations Desk Email (Optional)" htmlFor="onb-support-email">
                    <div className="relative flex items-center">
                      <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
                      <input
                        id="onb-support-email"
                        type="email"
                        value={supportEmail}
                        onChange={(e) => setSupportEmail(e.target.value)}
                        placeholder={currentUser.email || 'desk@your-agency.com'}
                        className={`${inputBaseClass} pl-8`}
                      />
                    </div>
                  </FormField>

                  <FormField label="Operations Phone (Optional)" htmlFor="onb-support-phone">
                    <div className="relative flex items-center">
                      <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
                      <input
                        id="onb-support-phone"
                        type="text"
                        value={supportPhone}
                        onChange={(e) => setSupportPhone(e.target.value)}
                        placeholder="+1 (555) 010-9900"
                        className={`${inputBaseClass} pl-8`}
                      />
                    </div>
                  </FormField>
                </div>

                <div className="px-6 py-4 bg-slate-50/75 border-t border-slate-100 rounded-b-xl flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => setStep(2)}
                    className="text-[11px] font-medium text-slate-500 hover:text-slate-800 hover:underline cursor-pointer"
                  >
                    Skip this step
                  </button>
                  <ActionButton
                    type="button"
                    loading={submitting}
                    loadingText="Saving..."
                    onClick={() => void handleContinueFromStep1()}
                    className="h-9 px-4 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <span>Continue to Localization</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </ActionButton>
                </div>
              </>
            )}

            {/* STEP 2: LOCALIZATION & CURRENCY */}
            {step === 2 && (
              <>
                <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-brand-50/80 border border-brand-200/70 text-brand-700 flex items-center justify-center shrink-0">
                      <Globe className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-slate-900">
                        Regional Localization &amp; Currency
                      </h2>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Configure default timezone, date display, currency, and billing basis.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const detected = detectBrowserTimezone();
                      setTimezone(detected);
                      showToast('Timezone Detected', `Selected ${detected}`, 'success');
                    }}
                    className="h-7 px-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[11px] font-semibold text-slate-700 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
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
                        {tzPreview.liveTime} &middot; {tzPreview.offsetLabel}
                      </span>
                    }
                    hint={`${tzPreview.longName} (${tzPreview.iana})`}
                  >
                    <CustomSelect
                      value={timezone}
                      onChange={setTimezone}
                      ariaLabel="Default Workspace Timezone"
                      options={timezoneOptions}
                      searchable
                      minMenuWidth={360}
                      searchPlaceholder="Search city, country, UTC offset, or code (e.g. IST, New York, London)..."
                      emptySearchText="No matching timezone found"
                      prefixNode={<Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                    />
                  </FormField>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField label="Date Format" hint={`Formats today as ${tzPreview.formattedDate}`}>
                      <CustomSelect
                        value={dateFormat}
                        onChange={setDateFormat}
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
                        value={currency}
                        onChange={setCurrency}
                        ariaLabel="Billing Currency"
                        options={currencyOptions}
                        searchable
                        minMenuWidth={300}
                        searchPlaceholder="Search currency, symbol, or country (e.g. USD, INR, ₹, Euro)..."
                        emptySearchText="No matching currency found"
                        prefixNode={<Coins className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                      />
                    </FormField>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    <FormField label="Default Payment Terms">
                      <CustomSelect
                        value={defaultPaymentTerms}
                        onChange={setDefaultPaymentTerms}
                        ariaLabel="Default Payment Terms"
                        options={PAYMENT_TERMS_OPTIONS}
                      />
                    </FormField>

                    <FormField label="Monthly Hours Basis">
                      <CustomSelect
                        value={String(standardMonthlyHours)}
                        onChange={(val) => setStandardMonthlyHours(Number(val))}
                        ariaLabel="Monthly Hours Basis"
                        options={MONTHLY_HOURS_OPTIONS}
                      />
                    </FormField>
                  </div>
                </div>

                <div className="px-6 py-4 bg-slate-50/75 border-t border-slate-100 rounded-b-xl flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => setStep(1)}
                    className="h-9 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back</span>
                  </button>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => setStep(3)}
                      className="text-[11px] font-medium text-slate-500 hover:text-slate-800 hover:underline cursor-pointer"
                    >
                      Skip this step
                    </button>
                    <ActionButton
                      type="button"
                      loading={submitting}
                      loadingText="Saving..."
                      onClick={() => void handleContinueFromStep2()}
                      className="h-9 px-4 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <span>Continue to Team Invites</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </ActionButton>
                  </div>
                </div>
              </>
            )}

            {/* STEP 3: OPTIONAL TEAM INVITES */}
            {step === 3 && (
              <>
                <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-brand-50/80 border border-brand-200/70 text-brand-700 flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">
                      Invite Initial Teammates (Optional)
                    </h2>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Add recruiters or coordinators now, or skip and invite anyone later from Team Members.
                    </p>
                  </div>
                </div>

                <div className="divide-y divide-slate-100 text-xs">
                  {inviteRows.map((row, idx) => {
                    const rowTouched = Boolean(row.name.trim() || row.email.trim());
                    const nameErr =
                      inviteAttempted && rowTouched && !row.name.trim() ? 'Required' : undefined;
                    const emailErr =
                      inviteAttempted && rowTouched && !EMAIL_PATTERN.test(row.email.trim())
                        ? 'Valid email required'
                        : undefined;
                    return (
                      <div key={row.localId} className="p-5 sm:px-6 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-slate-800">
                            Teammate #{idx + 1}
                          </span>
                          {inviteRows.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                setInviteRows((prev) =>
                                  prev.filter((r) => r.localId !== row.localId)
                                )
                              }
                              className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                              title="Remove row"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          <FormField label="Full Name" error={nameErr}>
                            <input
                              type="text"
                              value={row.name}
                              onChange={(e) =>
                                updateInviteRow(row.localId, (p) => ({
                                  ...p,
                                  name: e.target.value,
                                }))
                              }
                              placeholder="e.g. Rachel Adams"
                              className={inputBaseClass}
                            />
                          </FormField>

                          <FormField label="Work Email" error={emailErr}>
                            <input
                              type="email"
                              value={row.email}
                              onChange={(e) =>
                                updateInviteRow(row.localId, (p) => ({
                                  ...p,
                                  email: e.target.value,
                                }))
                              }
                              placeholder="rachel@your-agency.com"
                              className={inputBaseClass}
                            />
                          </FormField>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 items-end">
                          <div className="sm:col-span-5">
                            <FormField label="Role">
                              <CustomSelect
                                value={row.role}
                                onChange={(val) =>
                                  updateInviteRow(row.localId, (p) => ({
                                    ...p,
                                    role: val,
                                    rateMasked: p.rateManuallySet
                                      ? p.rateMasked
                                      : getDefaultRateMaskForRole(val),
                                  }))
                                }
                                ariaLabel={`Role for teammate ${idx + 1}`}
                                options={USER_ROLE_SELECT_OPTIONS}
                                minMenuWidth={240}
                              />
                            </FormField>
                          </div>

                          <div className="sm:col-span-4">
                            <FormField label="Team / Desk">
                              <CustomSelect
                                value={row.desk}
                                onChange={(val) =>
                                  updateInviteRow(row.localId, (p) => ({ ...p, desk: val }))
                                }
                                ariaLabel={`Desk for teammate ${idx + 1}`}
                                options={[...USER_DESK_OPTIONS]}
                              />
                            </FormField>
                          </div>

                          <div className="sm:col-span-3">
                            <span className="block text-xs font-medium text-slate-700 mb-1">
                              Client Bill Rates
                            </span>
                            <div className="h-9 p-0.5 bg-slate-100 border border-slate-200/80 rounded-lg grid grid-cols-2 gap-0.5">
                              <button
                                type="button"
                                onClick={() =>
                                  updateInviteRow(row.localId, (p) => ({
                                    ...p,
                                    rateMasked: false,
                                    rateManuallySet: true,
                                  }))
                                }
                                className={`rounded-md text-[11px] font-semibold inline-flex items-center justify-center gap-1 cursor-pointer ${
                                  !row.rateMasked
                                    ? 'bg-white text-emerald-700 shadow-xs border border-slate-200/80'
                                    : 'text-slate-500 hover:text-slate-700'
                                }`}
                              >
                                <Eye className="w-3 h-3" />
                                <span>Visible</span>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  updateInviteRow(row.localId, (p) => ({
                                    ...p,
                                    rateMasked: true,
                                    rateManuallySet: true,
                                  }))
                                }
                                className={`rounded-md text-[11px] font-semibold inline-flex items-center justify-center gap-1 cursor-pointer ${
                                  row.rateMasked
                                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                                    : 'text-slate-500 hover:text-slate-700'
                                }`}
                              >
                                <EyeOff className="w-3 h-3" />
                                <span>Hidden</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <div className="px-6 py-3 bg-white">
                    <button
                      type="button"
                      onClick={() => setInviteRows((prev) => [...prev, createInviteDraft()])}
                      className="h-8 px-3 rounded-lg border border-dashed border-slate-300 bg-white hover:bg-slate-50 hover:border-brand-500 text-slate-700 hover:text-brand-700 text-[11px] font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add another teammate</span>
                    </button>
                  </div>
                </div>

                <div className="px-6 py-4 bg-slate-50/75 border-t border-slate-100 rounded-b-xl flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => setStep(2)}
                    className="h-9 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back</span>
                  </button>

                  <div className="flex items-center gap-2.5">
                    {filledInviteCount > 0 && (
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => void handleFinishAndEnterWorkspace({ skipInvites: true })}
                        className="h-9 px-3.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                      >
                        Skip Invites &amp; Enter
                      </button>
                    )}

                    <ActionButton
                      type="button"
                      loading={submitting}
                      loadingText="Finishing setup..."
                      icon={<Rocket className="w-3.5 h-3.5" />}
                      onClick={() => void handleFinishAndEnterWorkspace()}
                      className="h-9 px-4 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {filledInviteCount > 0
                        ? `Send ${filledInviteCount} Invite${filledInviteCount === 1 ? '' : 's'} & Enter Workspace`
                        : 'Finish Setup & Enter Workspace'}
                    </ActionButton>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
