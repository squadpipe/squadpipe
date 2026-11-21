import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
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
  FileText,
  Globe,
  Info,
  LocateFixed,
  LogOut,
  Plus,
  Send,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react';
import { apiClient } from '../../config/api.config';
import { User } from '../../types';
import { ActionButton } from '../../components/shared/ActionButton';
import { BrandLogo } from '../../components/shared/BrandMark';
import { CustomSelect, CustomSelectOption } from '../../components/shared/CustomSelect';
import { FormField } from '../../components/shared/FormField';
import { APPLE_EASE } from '../../components/shared/MotionPrimitives';
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
    title: 'Create your agency workspace',
    description: 'Brand identity, desk email, and office contact details.',
    icon: Building2,
  },
  {
    id: 2 as const,
    title: 'Localization & billing setup',
    description: 'Timezone, date format, currency, and payment terms.',
    icon: Globe,
  },
  {
    id: 3 as const,
    title: 'Invite your recruiting team',
    description: 'Add recruiters with assigned desks, roles, and rate access.',
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
 * Framed split-rail SaaS tenant onboarding workspace displayed after email OTP verification.
 * Styled directly around SquadPipe's Spruce Pine (#0F5C56) palette and sharp surface tokens.
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
        // Proceed with signup defaults when settings fetch fails
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
      showToast('Agency Name Required', 'Please enter your agency display name.', 'error');
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
            `Please enter both full name and a valid work email for invite #${i + 1}, or skip invites.`,
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

  const updateInviteRow = (
    localId: string,
    updater: (prev: OnboardingInviteRow) => OnboardingInviteRow
  ) => {
    setInviteRows((prev) => prev.map((r) => (r.localId === localId ? updater(r) : r)));
  };

  const filledInviteCount = inviteRows.filter((r) => Boolean(r.name.trim() || r.email.trim())).length;

  const inputClass =
    'w-full h-10 px-3.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 hover:border-slate-300 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/10 focus:outline-none transition-colors';

  return (
    <div className="min-h-screen lg:h-screen lg:overflow-hidden w-full bg-white text-slate-800 flex flex-col">
      {/* Minimal Full-Width Top Bar */}
      <header className="w-full border-b border-slate-100 bg-white sticky top-0 z-20 shrink-0">
        <div className="w-full px-6 sm:px-10 lg:px-12 h-14 flex items-center justify-between gap-4">
          <BrandLogo size="sm" surface="light" className="shrink-0" />

          <div className="flex items-center gap-4 sm:gap-6 text-xs shrink-0">
            <span className="hidden md:inline text-[11px] text-slate-500">
              Logged in as{' '}
              <strong className="font-semibold text-slate-800">{currentUser.email}</strong>
            </span>

            <button
              type="button"
              disabled={submitting}
              onClick={() => void handleFinishAndEnterWorkspace({ skipInvites: true })}
              className="text-slate-600 hover:text-brand-700 text-[11px] font-medium inline-flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer disabled:opacity-50"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
              <span>Skip to workspace</span>
            </button>

            <button
              type="button"
              disabled={submitting}
              onClick={onSignOut}
              className="text-slate-600 hover:text-slate-900 text-[11px] font-medium inline-flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer disabled:opacity-50"
            >
              <LogOut className="w-3.5 h-3.5 text-slate-400" />
              <span>Log out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Full-Width Split Body — Wider Solid Left Rail & Scrollable Right Stage with Sticky Action Footer */}
      <div className="flex-1 min-h-0 w-full flex flex-col lg:flex-row">
        {/* Left Vertical Timeline Rail (Full-Bleed Solid Brand Surface with Architectural SVG Backdrop) */}
        <aside
          className="w-full lg:w-[42%] lg:min-w-[480px] shrink-0 bg-brand-700 text-white relative overflow-hidden lg:h-full lg:overflow-y-auto px-6 sm:px-10 lg:px-12 py-8 sm:py-10 flex flex-col"
          style={{
            backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.07) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        >
          {/* Upper-Right Architectural Pipeline Rings & Geometric Lines */}
          <svg
            aria-hidden="true"
            className="absolute -top-12 -right-12 w-80 h-80 text-white pointer-events-none select-none"
            viewBox="0 0 320 320"
            fill="none"
          >
            <circle cx="240" cy="80" r="110" stroke="currentColor" strokeOpacity="0.09" strokeWidth="1" />
            <circle cx="240" cy="80" r="74" stroke="currentColor" strokeOpacity="0.12" strokeWidth="1" strokeDasharray="4 6" />
            <circle cx="240" cy="80" r="38" fill="currentColor" fillOpacity="0.04" stroke="currentColor" strokeOpacity="0.14" strokeWidth="1" />
            <path d="M130 80 H202 M240 42 V0" stroke="currentColor" strokeOpacity="0.1" strokeWidth="1" />
            <circle cx="166" cy="80" r="3" fill="#4DA89C" fillOpacity="0.6" />
            <circle cx="240" cy="154" r="2.5" fill="currentColor" fillOpacity="0.35" />
          </svg>

          {/* Bottom Isometric Architectural Cube & Pipeline Landscape */}
          <svg
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 w-full h-72 text-white pointer-events-none select-none"
            viewBox="0 0 540 280"
            preserveAspectRatio="xMidYMax slice"
            fill="none"
          >
            <defs>
              <linearGradient id="onb-cube-glow" x1="0" y1="1" x2="0.8" y2="0">
                <stop offset="0%" stopColor="#4DA89C" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Ambient bottom radial sheen */}
            <ellipse cx="180" cy="270" rx="260" ry="120" fill="url(#onb-cube-glow)" />

            {/* Background isometric grid lines */}
            <g stroke="currentColor" strokeOpacity="0.07" strokeWidth="1">
              <path d="M-20 230 L120 150 L260 230 L400 150 L540 230" />
              <path d="M-20 270 L120 190 L260 270 L400 190 L540 270" />
              <path d="M50 280 V190 M190 280 V190 M330 280 V190 M470 280 V190" />
            </g>

            {/* Primary Isometric Cube Cluster (Left) */}
            <g transform="translate(26, 130)">
              {/* Top face */}
              <path d="M74 0 L148 42 L74 84 L0 42 Z" fill="currentColor" fillOpacity="0.08" stroke="currentColor" strokeOpacity="0.18" strokeWidth="1.2" />
              {/* Left face */}
              <path d="M0 42 L74 84 V168 L0 126 Z" fill="currentColor" fillOpacity="0.03" stroke="currentColor" strokeOpacity="0.15" strokeWidth="1.2" />
              {/* Right face */}
              <path d="M74 84 L148 42 V126 L74 168 Z" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1.2" />
            </g>

            {/* Secondary Stacked Cube (Center-Left) */}
            <g transform="translate(148, 176)">
              <path d="M58 0 L116 33 L58 66 L0 33 Z" fill="#4DA89C" fillOpacity="0.16" stroke="currentColor" strokeOpacity="0.22" strokeWidth="1.15" />
              <path d="M0 33 L58 66 V132 L0 99 Z" fill="currentColor" fillOpacity="0.04" stroke="currentColor" strokeOpacity="0.16" strokeWidth="1.15" />
              <path d="M58 66 L116 33 V99 L58 132 Z" fill="currentColor" fillOpacity="0.1" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1.15" />
            </g>

            {/* Floating Pipeline Node Block (Right) */}
            <g transform="translate(340, 186)">
              <path d="M48 0 L96 28 L48 56 L0 28 Z" fill="currentColor" fillOpacity="0.07" stroke="currentColor" strokeOpacity="0.16" strokeWidth="1.1" />
              <path d="M0 28 L48 56 V112 L0 84 Z" fill="currentColor" fillOpacity="0.025" stroke="currentColor" strokeOpacity="0.13" strokeWidth="1.1" />
              <path d="M48 56 L96 28 V84 L48 112 Z" fill="currentColor" fillOpacity="0.09" stroke="currentColor" strokeOpacity="0.16" strokeWidth="1.1" />
            </g>

            {/* Connecting pipeline trace & vertex accents */}
            <path d="M100 130 L174 88 L250 132 L388 186" stroke="#4DA89C" strokeOpacity="0.35" strokeWidth="1.25" strokeDasharray="3 5" />
            <circle cx="174" cy="88" r="3" fill="#4DA89C" fillOpacity="0.65" />
            <circle cx="250" cy="132" r="2.5" fill="currentColor" fillOpacity="0.45" />
            <circle cx="388" cy="186" r="3" fill="#4DA89C" fillOpacity="0.55" />
          </svg>

          <div className="relative z-10 w-full max-w-[440px] my-auto mx-auto">
            <div className="space-y-9">
              <div className="flex items-start gap-3 text-sm text-brand-100/95 leading-relaxed">
                <Info className="w-4 h-4 text-brand-200 shrink-0 mt-1" />
                <span>Get started by setting up your agency workspace and regional billing defaults.</span>
              </div>

              {/* Clean Open Circular Timeline Stepper */}
              <div className="relative">
                {STEPS.map((s, idx) => {
                  const Icon = s.icon;
                  const isCompleted = step > s.id;
                  const isCurrent = step === s.id;
                  const isLast = idx === STEPS.length - 1;

                  return (
                    <div key={s.id} className="relative flex items-start gap-4 pb-9 last:pb-0">
                      {!isLast && (
                        <span
                          className={`absolute left-[19.5px] top-11 bottom-1 w-px ${
                            isCompleted ? 'bg-white/55' : 'bg-white/25'
                          }`}
                        />
                      )}

                      <button
                        type="button"
                        disabled={submitting || hydrating}
                        onClick={() => setStep(s.id)}
                        aria-label={`Go to step ${s.id}: ${s.title}`}
                        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all cursor-pointer relative z-10 ${
                          isCompleted
                            ? 'bg-brand-500 border border-white/35 text-white shadow-xs'
                            : isCurrent
                            ? 'bg-white text-brand-700 ring-4 ring-white/20 shadow-sm'
                            : 'bg-white/10 border border-white/25 text-brand-100/80 hover:bg-white/15'
                        }`}
                      >
                        {isCompleted ? (
                          <Check className="w-4 h-4 stroke-[2.5]" />
                        ) : (
                          <Icon className="w-[18px] h-[18px]" />
                        )}
                      </button>

                      <button
                        type="button"
                        disabled={submitting || hydrating}
                        onClick={() => setStep(s.id)}
                        className="text-left min-w-0 pt-1 cursor-pointer group"
                      >
                        <span
                          className={`block text-[15px] font-semibold leading-snug transition-colors ${
                            isCurrent || isCompleted
                              ? 'text-white'
                              : 'text-white/85 group-hover:text-white'
                          }`}
                        >
                          {s.title}
                        </span>
                        <span
                          className={`block text-xs leading-relaxed mt-1 ${
                            isCurrent ? 'text-brand-50/90' : 'text-brand-100/75'
                          }`}
                        >
                          {s.description}
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </aside>

        {/* Right Editorial Configuration Stage (Scrollable Body + Sticky Action Footer) */}
        <main className="flex-1 min-w-0 min-h-0 bg-white flex flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-6 sm:px-10 lg:px-14 py-7 sm:py-10">
            {hydrating ? (
              <div className="max-w-[680px] w-full mx-auto py-12 text-xs text-slate-500">
                Loading your workspace configuration...
              </div>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.16, ease: APPLE_EASE }}
                  className="max-w-[680px] w-full mx-auto space-y-5"
                >
                  {/* STEP 1: AGENCY PROFILE */}
                  {step === 1 && (
                    <>
                      <div className="space-y-1.5">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-600">
                          Step 1 of 3
                        </div>
                        <h1 className="text-[24px] font-semibold text-slate-900 tracking-tight leading-tight">
                          Create your agency workspace
                        </h1>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          Set up your agency identity and operations desk email used across client submittals, job portals, and team invitations.
                        </p>
                      </div>

                      <div className="space-y-4 text-xs">
                        <FormField label="Agency Display Name" htmlFor="onb-agency-name" required>
                          <input
                            id="onb-agency-name"
                            type="text"
                            value={agencyName}
                            onChange={(e) => setAgencyName(e.target.value)}
                            placeholder="e.g. Apex Staffing Solutions"
                            className={inputClass}
                          />
                        </FormField>

                        <FormField
                          label="Operations Desk Email"
                          htmlFor="onb-support-email"
                          hint={`Outbound submittals & invites display as ${agencyName.trim() || 'your agency'} (e.g. ${currentUser.name || 'Team'} via SquadPipe).`}
                        >
                          <input
                            id="onb-support-email"
                            type="email"
                            value={supportEmail}
                            onChange={(e) => setSupportEmail(e.target.value)}
                            placeholder="e.g. desk@your-agency.com"
                            className={inputClass}
                          />
                        </FormField>

                        <div className="pt-3 border-t border-slate-100 space-y-3">
                          <div className="text-[11px] font-semibold text-slate-700">
                            Company &amp; Office Details{' '}
                            <span className="font-normal text-slate-400">(optional)</span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <FormField label="Legal Entity Name" htmlFor="onb-legal-entity">
                              <input
                                id="onb-legal-entity"
                                type="text"
                                value={legalEntityName}
                                onChange={(e) => setLegalEntityName(e.target.value)}
                                placeholder="e.g. Apex Staffing LLC"
                                className={inputClass}
                              />
                            </FormField>

                            <FormField label="Headquarters" htmlFor="onb-hq">
                              <input
                                id="onb-hq"
                                type="text"
                                value={headquarters}
                                onChange={(e) => setHeadquarters(e.target.value)}
                                placeholder="Austin, TX"
                                className={inputClass}
                              />
                            </FormField>

                            <FormField label="Company Website" htmlFor="onb-website">
                              <input
                                id="onb-website"
                                type="text"
                                value={website}
                                onChange={(e) => setWebsite(e.target.value)}
                                placeholder="https://your-agency.com"
                                className={inputClass}
                              />
                            </FormField>

                            <FormField label="Operations Phone" htmlFor="onb-support-phone">
                              <input
                                id="onb-support-phone"
                                type="text"
                                value={supportPhone}
                                onChange={(e) => setSupportPhone(e.target.value)}
                                placeholder="+1 (555) 010-9900"
                                className={inputClass}
                              />
                            </FormField>
                          </div>
                        </div>
                      </div>

                      <div className="pt-1 space-y-2">
                        <div className="text-[11px] font-semibold text-slate-700">
                          Workspace Profile Surfaces
                        </div>
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="px-3 py-1.5 rounded-lg border border-slate-200/90 bg-white text-[11px] font-medium text-slate-700 inline-flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-slate-400" />
                            <span>Apply Portals</span>
                          </span>
                          <span className="px-3 py-1.5 rounded-lg border border-slate-200/90 bg-white text-[11px] font-medium text-slate-700 inline-flex items-center gap-1.5">
                            <Send className="w-3.5 h-3.5 text-slate-400" />
                            <span>Client Submittals</span>
                          </span>
                          <span className="px-3 py-1.5 rounded-lg border border-slate-200/90 bg-white text-[11px] font-medium text-slate-700 inline-flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-slate-400" />
                            <span>Team Invitations</span>
                          </span>
                        </div>
                      </div>
                    </>
                  )}

                  {/* STEP 2: LOCALIZATION & BILLING */}
                  {step === 2 && (
                    <>
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-600">
                            Step 2 of 3
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const detected = detectBrowserTimezone();
                              setTimezone(detected);
                              showToast('Timezone Detected', `Selected ${detected}`, 'success');
                            }}
                            className="h-7 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-semibold text-slate-700 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                          >
                            <LocateFixed className="w-3 h-3 text-brand-600" />
                            <span>Detect My Timezone</span>
                          </button>
                        </div>
                        <h1 className="text-[24px] font-semibold text-slate-900 tracking-tight leading-tight">
                          Set up localization &amp; billing
                        </h1>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          Configure your workspace timezone, date display, billing currency, and standard payment terms.
                        </p>
                      </div>

                      <div className="space-y-4 text-xs">
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
                          <FormField label="Date Format" hint={`Today: ${tzPreview.formattedDate}`}>
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

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                      {/* 3-Card Guidance Summary mirroring Step 2 bottom section */}
                      <div className="pt-2 space-y-2.5">
                        <div className="text-[11px] font-semibold text-slate-700">
                          Guidance
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="p-3.5 rounded-xl border border-slate-200/90 bg-white space-y-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <div className="text-[11px] font-semibold text-slate-800 pt-0.5">
                              Regional Time
                            </div>
                            <p className="text-[11px] text-slate-500">
                              {tzPreview.liveTime} ({tzPreview.offsetLabel})
                            </p>
                          </div>
                          <div className="p-3.5 rounded-xl border border-slate-200/90 bg-white space-y-1">
                            <Coins className="w-3.5 h-3.5 text-slate-400" />
                            <div className="text-[11px] font-semibold text-slate-800 pt-0.5">
                              Rate Currency
                            </div>
                            <p className="text-[11px] text-slate-500">
                              {currencyMeta.code} ({currencyMeta.symbol})
                            </p>
                          </div>
                          <div className="p-3.5 rounded-xl border border-slate-200/90 bg-white space-y-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <div className="text-[11px] font-semibold text-slate-800 pt-0.5">
                              Billing Terms
                            </div>
                            <p className="text-[11px] text-slate-500">
                              {defaultPaymentTerms} &middot; {standardMonthlyHours}h/mo
                            </p>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* STEP 3: OPTIONAL TEAM INVITES */}
                  {step === 3 && (
                    <>
                      <div className="space-y-1.5">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-600">
                          Step 3 of 3
                        </div>
                        <h1 className="text-[24px] font-semibold text-slate-900 tracking-tight leading-tight">
                          Invite your recruiting team
                        </h1>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          Add teammates now with the right workspace role and client rate visibility, or skip and invite members later from Team Members.
                        </p>
                      </div>

                      <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 bg-white overflow-hidden text-xs">
                        {inviteRows.map((row, idx) => {
                          const rowTouched = Boolean(row.name.trim() || row.email.trim());
                          const nameErr =
                            inviteAttempted && rowTouched && !row.name.trim() ? 'Required' : undefined;
                          const emailErr =
                            inviteAttempted && rowTouched && !EMAIL_PATTERN.test(row.email.trim())
                              ? 'Valid email required'
                              : undefined;

                          return (
                            <div key={row.localId} className="p-4 sm:p-5 space-y-3.5">
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
                                    className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors"
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
                                    className={inputClass}
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
                                    className={inputClass}
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
                                  <div className="h-9 p-0.5 rounded-lg bg-slate-100 border border-slate-200/80 grid grid-cols-2 gap-0.5">
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

                        <div className="px-4 sm:px-5 py-3 bg-slate-50/60 flex flex-wrap items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => setInviteRows((prev) => [...prev, createInviteDraft()])}
                            className="h-8 px-3 rounded-lg border border-dashed border-slate-300 bg-white hover:bg-slate-50 hover:border-brand-500 text-slate-700 hover:text-brand-700 text-[11px] font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add another teammate</span>
                          </button>
                          <span className="text-[11px] text-slate-400">
                            Invite links stay valid for 7 days
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </motion.div>
              </AnimatePresence>
            )}
          </div>

          {/* Sticky Bottom Navigation / Primary Action Bar */}
          {!hydrating && (
            <div className="sticky bottom-0 z-10 shrink-0 border-t border-slate-100 bg-white/95 backdrop-blur-xs px-6 sm:px-10 lg:px-14 py-4">
              <div className="max-w-[680px] w-full mx-auto flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-wrap">
                  {step > 1 && (
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => setStep(step === 3 ? 2 : 1)}
                      className="h-10 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Back</span>
                    </button>
                  )}

                  {(() => {
                    const primaryCta =
                      step === 1
                        ? {
                            label: 'Save and continue',
                            loadingText: 'Saving...',
                            onClick: () => void handleContinueFromStep1(),
                          }
                        : step === 2
                        ? {
                            label: 'Save and continue',
                            loadingText: 'Saving...',
                            onClick: () => void handleContinueFromStep2(),
                          }
                        : {
                            label:
                              filledInviteCount > 0
                                ? `Send ${filledInviteCount} invite${filledInviteCount === 1 ? '' : 's'} & enter workspace`
                                : 'Save and enter workspace',
                            loadingText: 'Finishing...',
                            onClick: () => void handleFinishAndEnterWorkspace(),
                          };

                    return (
                      <ActionButton
                        type="button"
                        loading={submitting}
                        loadingText={primaryCta.loadingText}
                        onClick={primaryCta.onClick}
                        className="h-10 px-5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-xs whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <span>{primaryCta.label}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </span>
                      </ActionButton>
                    );
                  })()}
                </div>

                {step < 3 ? (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => setStep(step === 1 ? 2 : 3)}
                    className="text-xs font-medium text-slate-500 hover:text-slate-800 hover:underline cursor-pointer"
                  >
                    Skip this step
                  </button>
                ) : filledInviteCount > 0 ? (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => void handleFinishAndEnterWorkspace({ skipInvites: true })}
                    className="text-xs font-medium text-slate-500 hover:text-slate-800 hover:underline cursor-pointer"
                  >
                    Skip invites
                  </button>
                ) : null}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
