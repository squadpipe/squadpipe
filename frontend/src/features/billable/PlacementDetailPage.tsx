import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { animate, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Briefcase,
  Building2,
  CalendarClock,
  CalendarPlus,
  CalendarX,
  CheckCircle2,
  DollarSign,
  FileText,
  Handshake,
  Layers,
  Mail,
  Pencil,
  Phone,
  ShieldCheck,
  Trash2,
  UserCheck,
} from 'lucide-react';
import {
  BillablePlacement,
  Candidate,
  Client,
  Requirement,
  Vendor,
} from '../../types';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { MaskedValue } from '../../components/shared/MaskedValue';
import {
  DetailBreadcrumb,
  DetailTabItem,
  DetailUnderlineTabs,
} from '../../components/shared/DetailPageShell';
import { useCurrency } from '../../utils/currency';
import { getInitials } from '../../utils/entityMappers';
import { PlacementModals } from './PlacementModals';
import {
  ExtensionData,
  formatMargin,
  formatSpread,
  getContractTimelineMetrics,
  getDaysRemaining,
  getEffectiveStatus,
  getPlacementStatusMeta,
  getVendorComplianceWarning,
  parseRate,
} from './placementUtils';

type ProgressTone = 'emerald' | 'amber' | 'rose';

const BAR_TONE_CLASSES: Record<ProgressTone, string> = {
  emerald: 'bg-gradient-to-r from-emerald-500 via-emerald-500 to-emerald-400',
  amber: 'bg-gradient-to-r from-amber-500 to-amber-400',
  rose: 'bg-gradient-to-r from-rose-500 to-rose-400',
};

const PROGRESS_EASE = [0.22, 1, 0.36, 1] as const;

const RING_TONE_STYLES: Record<
  ProgressTone,
  { start: string; end: string; pulseBorder: string; labelClass: string }
> = {
  emerald: {
    start: '#34d399',
    end: '#059669',
    pulseBorder: 'border-emerald-400',
    labelClass: 'text-emerald-700',
  },
  amber: {
    start: '#fbbf24',
    end: '#d97706',
    pulseBorder: 'border-amber-400',
    labelClass: 'text-slate-900',
  },
  rose: {
    start: '#fb7185',
    end: '#e11d48',
    pulseBorder: 'border-rose-400',
    labelClass: 'text-slate-900',
  },
};

interface AnimatedPercentTextProps {
  pct: number;
  hasTimeline: boolean;
  replayKey: string;
  className?: string;
}

/**
 * Animates a percentage readout directly via DOM ref so count-ups never trigger React re-renders.
 */
const AnimatedPercentText: React.FC<AnimatedPercentTextProps> = ({
  pct,
  hasTimeline,
  replayKey,
  className,
}) => {
  const spanRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const el = spanRef.current;
    if (!el) return;
    if (!hasTimeline) {
      el.textContent = '—';
      return;
    }

    const target = Math.min(100, Math.max(0, pct));
    let lastShown = 0;
    el.textContent = '0%';

    const controls = animate(0, target, {
      duration: 0.9,
      delay: 0.08,
      ease: PROGRESS_EASE,
      onUpdate: (latest) => {
        const rounded = Math.round(latest);
        if (rounded !== lastShown && spanRef.current) {
          lastShown = rounded;
          spanRef.current.textContent = `${rounded}%`;
        }
      },
      onComplete: () => {
        if (spanRef.current) {
          spanRef.current.textContent = `${target}%`;
        }
      },
    });

    return () => controls.stop();
  }, [pct, hasTimeline, replayKey]);

  return (
    <span ref={spanRef} className={className}>
      {hasTimeline ? '0%' : '—'}
    </span>
  );
};

interface ContractProgressRingProps {
  pct: number;
  hasTimeline: boolean;
  tone: ProgressTone;
  replayKey: string;
}

/**
 * Animated radial SVG progress ring with smooth GPU stroke sweep and completion pulse.
 */
const ContractProgressRing: React.FC<ContractProgressRingProps> = ({
  pct,
  hasTimeline,
  tone,
  replayKey,
}) => {
  const gradientId = useId();
  const clampedPct = hasTimeline ? Math.min(100, Math.max(0, pct)) : 0;

  const sizePx = 56;
  const strokeWidth = 5;
  const radius = (sizePx - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clampedPct / 100) * circumference;
  const toneStyle = RING_TONE_STYLES[tone];

  return (
    <div
      className="relative inline-flex items-center justify-center shrink-0"
      style={{ width: sizePx, height: sizePx }}
      aria-label={hasTimeline ? `${clampedPct}% of contract timeline elapsed` : 'Timeline unavailable'}
    >
      {hasTimeline && clampedPct === 100 && (
        <motion.span
          key={`pulse-${replayKey}`}
          aria-hidden="true"
          initial={{ scale: 0.94, opacity: 0.55 }}
          animate={{ scale: 1.24, opacity: 0 }}
          transition={{ duration: 0.75, delay: 0.92, ease: [0.16, 1, 0.3, 1] }}
          style={{ willChange: 'transform, opacity' }}
          className={`absolute inset-0 rounded-full border-2 pointer-events-none ${toneStyle.pulseBorder}`}
        />
      )}
      <svg
        width={sizePx}
        height={sizePx}
        viewBox={`0 0 ${sizePx} ${sizePx}`}
        shapeRendering="geometricPrecision"
        className="-rotate-90"
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={toneStyle.start} />
            <stop offset="100%" stopColor={toneStyle.end} />
          </linearGradient>
        </defs>
        <circle
          cx={sizePx / 2}
          cy={sizePx / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-slate-200/80"
        />
        {hasTimeline && clampedPct > 0 && (
          <motion.circle
            key={`stroke-${replayKey}`}
            cx={sizePx / 2}
            cy={sizePx / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 0.9, delay: 0.08, ease: PROGRESS_EASE }}
            strokeLinecap="round"
            stroke={`url(#${gradientId})`}
            style={{ willChange: 'stroke-dashoffset' }}
          />
        )}
      </svg>
      <AnimatedPercentText
        pct={clampedPct}
        hasTimeline={hasTimeline}
        replayKey={replayKey}
        className={`absolute inset-0 flex items-center justify-center text-[11px] font-bold font-mono tabular-nums ${
          clampedPct === 100 ? toneStyle.labelClass : 'text-slate-900'
        }`}
      />
    </div>
  );
};

interface PlacementDetailPageProps {
  placement: BillablePlacement | null;
  backLabel?: string;
  onBack: () => void;
  candidates?: Candidate[];
  clients?: Client[];
  vendors?: Vendor[];
  requirements?: Requirement[];
  rateMasked: boolean;
  onExtendContract?: (
    placement: BillablePlacement,
    extensionData?: ExtensionData
  ) => Promise<void> | void;
  onUpdatePlacement?: (placement: BillablePlacement) => Promise<void> | void;
  onDeletePlacement?: (placement: BillablePlacement) => Promise<void> | void;
  onOpenConsultant?: (candidate: Candidate) => void;
  onOpenClient?: (client: Client) => void;
  onOpenVendor?: (vendor: Vendor) => void;
  onOpenRequirement?: (requirement: Requirement) => void;
}

export const PlacementDetailPage: React.FC<PlacementDetailPageProps> = ({
  placement,
  backLabel = 'Back to Billable Consultants',
  onBack,
  candidates = [],
  clients = [],
  vendors = [],
  requirements = [],
  rateMasked,
  onExtendContract,
  onUpdatePlacement,
  onDeletePlacement,
  onOpenConsultant,
  onOpenClient,
  onOpenVendor,
  onOpenRequirement,
}) => {
  const { symbol: currencySymbol, formatRate } = useCurrency();

  const [extendingPlacement, setExtendingPlacement] = useState<BillablePlacement | null>(null);
  const [editingPlacement, setEditingPlacement] = useState<BillablePlacement | null>(null);
  const [endingPlacement, setEndingPlacement] = useState<BillablePlacement | null>(null);
  const [deletingPlacement, setDeletingPlacement] = useState<BillablePlacement | null>(null);
  const [workspaceTab, setWorkspaceTab] = useState<'billing' | 'records' | 'details'>('billing');

  const isCompleted = placement?.status === 'Completed';
  const isTerminated = placement?.status === 'Terminated';
  const ended = Boolean(isCompleted || isTerminated);
  const daysLeft = placement ? getDaysRemaining(placement.endDate) : null;
  const timeline = placement
    ? getContractTimelineMetrics(placement.startDate, placement.endDate)
    : null;
  const timelinePct = timeline ? (ended ? 100 : timeline.progressPct) : 0;

  useEffect(() => {
    setWorkspaceTab('billing');
  }, [placement?.id]);

  const linkedCandidate = useMemo(() => {
    if (!placement) return undefined;
    if (placement.candidateId) {
      const byId = candidates.find((c) => c.id === placement.candidateId);
      if (byId) return byId;
    }
    const targetName = placement.resourceName.trim().toLowerCase();
    return targetName
      ? candidates.find((c) => c.fullName.trim().toLowerCase() === targetName)
      : undefined;
  }, [candidates, placement]);

  const linkedClient = useMemo(() => {
    if (!placement) return undefined;
    if (placement.clientId) {
      const byId = clients.find((cl) => cl.id === placement.clientId);
      if (byId) return byId;
    }
    const targetCustomer = placement.customer.trim().toLowerCase();
    return targetCustomer
      ? clients.find((cl) => cl.name.trim().toLowerCase() === targetCustomer)
      : undefined;
  }, [clients, placement]);

  const linkedVendor = useMemo(() => {
    if (!placement) return undefined;
    if (placement.vendorId) {
      const byId = vendors.find((v) => v.id === placement.vendorId);
      if (byId) return byId;
    }
    const targetVendor = (placement.vendorName || '').trim().toLowerCase();
    return targetVendor
      ? vendors.find((v) => v.name.trim().toLowerCase() === targetVendor)
      : undefined;
  }, [placement, vendors]);

  const linkedRequirement = useMemo(() => {
    if (!placement?.requirementId) return undefined;
    return requirements.find((r) => r.id === placement.requirementId);
  }, [placement, requirements]);

  if (!placement) {
    return (
      <section className="max-w-7xl mx-auto px-1 sm:px-2 lg:px-4 py-12 text-center space-y-3">
        <p className="text-sm font-medium text-slate-500">
          Select a placement row to view full contract and billing details.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="h-8 px-4 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold cursor-pointer"
        >
          {backLabel}
        </button>
      </section>
    );
  }

  const effectiveStatus = getEffectiveStatus(placement);
  const statusMeta = getPlacementStatusMeta(placement);

  const recruiterInitials = getInitials(placement.recruiter || '—');

  const billNum = parseRate(placement.billing, 0);
  const payNum = parseRate(placement.payRate, 0);
  const spreadNum =
    placement.hourlySpread !== undefined && placement.hourlySpread !== null
      ? Number(placement.hourlySpread)
      : billNum - payNum;

  const monthlyBilling = `${currencySymbol}${Math.round(billNum * 160).toLocaleString()}/mo`;
  const monthlyPay = `${currencySymbol}${Math.round(payNum * 160).toLocaleString()}/mo`;
  const monthlyProfit = `${spreadNum >= 0 ? '+' : '-'}${currencySymbol}${Math.round(
    Math.abs(spreadNum) * 160
  ).toLocaleString()}/mo`;

  const customFieldEntries = Object.entries(placement.customFields || {}).filter(
    ([, v]) => v !== null && v !== undefined && String(v).trim() !== ''
  );

  const contactEmail = placement.email || linkedCandidate?.email || '';
  const contactPhone = placement.phone || linkedCandidate?.phone || '';
  const vendorComplianceWarning = getVendorComplianceWarning(linkedVendor);
  const coiDaysLeft = linkedVendor?.coiExpiryDate
    ? getDaysRemaining(linkedVendor.coiExpiryDate)
    : null;
  const connectedRecordsCount = [
    linkedCandidate,
    linkedClient,
    linkedVendor,
    linkedRequirement,
  ].filter(Boolean).length;

  const agreementChecks: Array<{
    key: string;
    label: string;
    detail: string;
    status: 'ok' | 'warn' | 'danger';
    actionLabel?: string;
    onAction?: () => void;
  }> = [
    {
      key: 'po',
      label: 'PO / SOW Reference',
      detail: placement.purchaseOrderNumber?.trim()
        ? `${placement.purchaseOrderNumber.trim()} on file`
        : 'Add PO or SOW reference for invoicing',
      status: placement.purchaseOrderNumber?.trim() ? 'ok' : 'warn',
      actionLabel:
        !placement.purchaseOrderNumber?.trim() && onUpdatePlacement ? 'Add PO #' : undefined,
      onAction: !placement.purchaseOrderNumber?.trim()
        ? () => setEditingPlacement({ ...placement })
        : undefined,
    },
    {
      key: 'window',
      label: 'Contract Window',
      detail: ended
        ? `Ended (${effectiveStatus})`
        : daysLeft === null
          ? 'Confirm contract start & end dates'
          : daysLeft < 0
            ? `Past end date by ${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? '' : 's'}`
            : daysLeft <= 30
              ? `Expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`
              : `${daysLeft} days remaining through ${placement.endDate}`,
      status: ended
        ? 'ok'
        : daysLeft === null
          ? 'warn'
          : daysLeft < 0
            ? 'danger'
            : daysLeft <= 30
              ? 'warn'
              : 'ok',
      actionLabel:
        !ended && daysLeft !== null && daysLeft <= 30 && onExtendContract
          ? 'Extend'
          : undefined,
      onAction:
        !ended && daysLeft !== null && daysLeft <= 30 && onExtendContract
          ? () => setExtendingPlacement(placement)
          : undefined,
    },
    {
      key: 'vendor',
      label: linkedVendor || placement.vendorName ? 'Vendor MSA & COI' : 'Engagement Model',
      detail: linkedVendor
        ? `${linkedVendor.msa === 'Yes' || linkedVendor.msa === 'Active' ? 'MSA Signed' : 'MSA Pending Review'}${
            linkedVendor.paymentTerms ? ` · ${linkedVendor.paymentTerms}` : ''
          }${
            linkedVendor.coiExpiryDate
              ? coiDaysLeft !== null && coiDaysLeft < 0
                ? ` · COI expired ${linkedVendor.coiExpiryDate}`
                : ` · COI ${linkedVendor.coiExpiryDate}`
              : ' · COI not set'
          }`
        : placement.vendorName
          ? `${placement.vendorName} — link vendor record for MSA/COI`
          : `${placement.placementType || 'Direct W2'} — no vendor MSA needed`,
      status: linkedVendor
        ? vendorComplianceWarning
          ? coiDaysLeft !== null && coiDaysLeft < 0
            ? 'danger'
            : 'warn'
          : 'ok'
        : placement.vendorName
          ? 'warn'
          : 'ok',
      actionLabel: linkedVendor && onOpenVendor ? 'Review' : undefined,
      onAction: linkedVendor && onOpenVendor ? () => onOpenVendor(linkedVendor) : undefined,
    },
    {
      key: 'contact',
      label: 'Stakeholder Contacts',
      detail:
        contactEmail || contactPhone
          ? [contactEmail, contactPhone].filter(Boolean).join(' · ')
          : 'Missing consultant email and phone',
      status: contactEmail || contactPhone ? 'ok' : 'warn',
      actionLabel:
        !(contactEmail || contactPhone) && onUpdatePlacement ? 'Edit' : undefined,
      onAction: !(contactEmail || contactPhone)
        ? () => setEditingPlacement({ ...placement })
        : undefined,
    },
  ];

  const readyCheckCount = agreementChecks.filter((item) => item.status === 'ok').length;

  const timelineTone: ProgressTone = ended
    ? 'emerald'
    : daysLeft !== null && daysLeft < 0
      ? 'rose'
      : daysLeft !== null && daysLeft <= 30
        ? 'amber'
        : 'emerald';

  const progressBarClass = BAR_TONE_CLASSES[timelineTone];

  const formatDayCount = (count: number) => `${count} ${count === 1 ? 'day' : 'days'}`;

  const effectiveElapsedDays = timeline ? (ended ? timeline.totalDays : timeline.elapsedDays) : 0;

  const placementTabs: Array<DetailTabItem<'billing' | 'records' | 'details'>> = [
    { id: 'billing', label: 'Billing & Contract', icon: DollarSign },
    {
      id: 'records',
      label: 'Connected Records',
      icon: Layers,
      badge: connectedRecordsCount,
    },
    { id: 'details', label: 'Agreement & Details', icon: ShieldCheck },
  ];

  return (
    <section className="max-w-7xl mx-auto px-1 sm:px-2 lg:px-4 space-y-5 pb-8 animate-fade-in">
      <DetailBreadcrumb
        backLabel={backLabel}
        onBack={onBack}
        codePill={placement.purchaseOrderNumber || placement.resourceName}
        title={placement.resourceName}
      />

      {/* Bare Canvas Entity Title & Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-lg sm:text-[19px] font-semibold text-slate-900 tracking-tight leading-snug">
              {placement.resourceName}
            </h1>
            <StatusBadge
              label={statusMeta.label}
              tone={statusMeta.tone}
              size="xs"
            />
          </div>
          <div className="flex items-center flex-wrap gap-x-2.5 gap-y-1 text-xs text-slate-500">
            <span className="font-medium text-slate-700">{placement.skillRole}</span>
            {placement.vendorName && (
              <span className="inline-flex items-center gap-1.5">
                <span className="text-slate-300" aria-hidden="true">&middot;</span>
                <span>via {placement.vendorName}</span>
              </span>
            )}
            {(ended || daysLeft !== null) && (
              <span className="inline-flex items-center gap-1.5 text-[11px]">
                <span className="text-slate-300" aria-hidden="true">&middot;</span>
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isCompleted
                      ? 'bg-emerald-500'
                      : isTerminated
                        ? 'bg-rose-500'
                        : daysLeft !== null && daysLeft < 0
                          ? 'bg-rose-500'
                          : daysLeft !== null && daysLeft <= 30
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                  }`}
                />
                <span
                  className={
                    !ended && daysLeft !== null && daysLeft <= 30
                      ? 'font-medium text-amber-700'
                      : ''
                  }
                >
                  {ended
                    ? `Contract Ended (${effectiveStatus})`
                    : daysLeft !== null
                      ? daysLeft < 0
                        ? `Past end date by ${Math.abs(daysLeft)}d`
                        : daysLeft === 0
                          ? 'Contract ends today'
                          : `${daysLeft} days remaining`
                      : placement.deployment || 'Active Contract'}
                </span>
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
          {onUpdatePlacement && (
            <button
              type="button"
              onClick={() => setEditingPlacement({ ...placement })}
              className="h-8 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-[11px] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Pencil className="w-3 h-3" />
              <span>Edit Placement</span>
            </button>
          )}
          {!ended && onUpdatePlacement && (
            <button
              type="button"
              onClick={() => setEndingPlacement(placement)}
              title="End consultant placement"
              className="h-8 px-3 rounded-lg border border-rose-200 bg-white hover:bg-rose-50 text-rose-700 font-semibold text-[11px] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <CalendarX className="w-3 h-3" />
              <span>End Placement</span>
            </button>
          )}
          {onExtendContract && (
            <button
              type="button"
              onClick={() => setExtendingPlacement(placement)}
              className="h-8 px-3.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-semibold text-[11px] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <CalendarPlus className="w-3.5 h-3.5" />
              <span>{ended ? 'Renew SOW' : 'Extend SOW'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Standalone 4-Column Summary Card */}
      <div className="bg-white rounded-xl border border-slate-200/90 card-shadow overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 text-xs">
          {/* 1. Client & Engagement Model */}
          <div className="px-6 py-4 space-y-2 min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Client &amp; model
            </div>
            <div className="font-semibold text-slate-900 leading-snug flex items-start gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
              {linkedClient && onOpenClient ? (
                <button
                  type="button"
                  onClick={() => onOpenClient(linkedClient)}
                  className="break-words hover:text-brand-600 cursor-pointer text-left"
                >
                  {placement.customer}
                </button>
              ) : (
                <span className="break-words">{placement.customer}</span>
              )}
            </div>
            <div className="text-[11px] text-slate-500 leading-snug break-words">
              {placement.placementType || 'C2C Subcontractor'} &middot;{' '}
              {placement.deployment || 'Onshore'}
            </div>
          </div>

          {/* 2. Owner & PO Reference */}
          <div className="px-6 py-4 space-y-2.5 min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Owner &amp; PO
            </div>
            <div className="flex items-start gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-700 font-semibold text-[11px] flex items-center justify-center shrink-0">
                {recruiterInitials}
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-slate-900 leading-snug break-words">
                  {placement.recruiter || 'Unassigned'}
                </div>
                <div className="text-[11px] text-slate-500 font-mono truncate mt-0.5">
                  {placement.purchaseOrderNumber || 'No PO / SOW #'}
                </div>
              </div>
            </div>
          </div>

          {/* 3. Commercial Rates */}
          <div className="px-6 py-4 space-y-2 min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Commercial rates
            </div>
            {rateMasked ? (
              <>
                <MaskedValue value="" isMasked={true} className="text-base font-bold block" />
                <div className="text-[11px] text-slate-400">Rate protected for your role</div>
              </>
            ) : (
              <>
                <div className="flex items-baseline gap-1.5 flex-wrap leading-none">
                  <span className="text-lg font-bold font-mono text-slate-900 tabular-nums">
                    {formatRate(placement.billing) || '—'}
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">/hr billed</span>
                </div>
                <div className="text-[11px] text-slate-500 flex items-center gap-3 flex-wrap">
                  <span>
                    Pay{' '}
                    <strong className="font-semibold text-slate-700 font-mono">
                      {formatRate(placement.payRate) || '—'}
                    </strong>
                  </span>
                  <span>
                    Spread{' '}
                    <strong
                      className={`font-semibold font-mono ${
                        spreadNum < 0 ? 'text-rose-600' : 'text-emerald-700'
                      }`}
                    >
                      {formatSpread(placement.hourlySpread, currencySymbol)}
                    </strong>
                  </span>
                </div>
              </>
            )}
          </div>

          {/* 4. Contract Timeline Progress */}
          <div className="px-6 py-4 space-y-2.5 min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Timeline
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <div className="leading-none">
                <AnimatedPercentText
                  pct={timelinePct}
                  hasTimeline={Boolean(timeline)}
                  replayKey={`${placement.id}-${timelinePct}`}
                  className="text-lg font-bold font-mono text-slate-900 tabular-nums"
                />
                <span className="text-[11px] text-slate-500 ml-1.5">elapsed</span>
              </div>
              <span className="text-[11px] font-mono text-slate-500 truncate tabular-nums">
                {placement.endDate || '—'}
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden relative">
              {timeline && timelinePct > 0 && (
                <div
                  className="relative h-full overflow-hidden rounded-full"
                  style={{ width: `${Math.min(100, Math.max(0, timelinePct))}%` }}
                >
                  <motion.div
                    key={`hero-bar-${placement.id}-${timelinePct}`}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.9, delay: 0.08, ease: PROGRESS_EASE }}
                    style={{ transformOrigin: 'left center', willChange: 'transform' }}
                    className={`h-full w-full rounded-full ${progressBarClass}`}
                  />
                  <motion.span
                    key={`hero-sheen-${placement.id}-${timelinePct}`}
                    aria-hidden="true"
                    initial={{ x: '-120%', opacity: 0 }}
                    animate={{ x: '240%', opacity: [0, 0.85, 0.85, 0] }}
                    transition={{
                      duration: 1.5,
                      delay: 1.05,
                      ease: 'easeInOut',
                      repeat: Infinity,
                      repeatDelay: 2.8,
                    }}
                    style={{ willChange: 'transform, opacity' }}
                    className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/45 to-transparent pointer-events-none"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Floating Underline Workspace Tabs */}
      <DetailUnderlineTabs
        ariaLabel="Placement workspace sections"
        tabs={placementTabs}
        activeTab={workspaceTab}
        onChange={setWorkspaceTab}
      />

      {/* TAB 1: Billing & Contract */}
      {workspaceTab === 'billing' && (
        <div className="space-y-6">
          {!ended && daysLeft !== null && daysLeft <= 30 && onExtendContract && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-amber-900">
                  {daysLeft < 0 ? 'Contract end date has passed' : 'Contract renewal review due soon'}
                </div>
                <p className="text-[11px] text-amber-800/90 mt-0.5">
                  Extend the end date and confirm billing or pay rates before closing out.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setExtendingPlacement(placement)}
                className="h-8 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-semibold inline-flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
              >
                <CalendarPlus className="w-3.5 h-3.5" />
                <span>Extend Contract</span>
              </button>
            </div>
          )}

          {/* Billing & Rate Breakdown */}
          <section className="bg-white rounded-xl border border-slate-200/90 card-shadow overflow-hidden text-xs">
            <div className="px-6 py-4 border-b border-slate-100 bg-white flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                <h2 className="font-bold text-slate-900">Billing &amp; Rate Summary</h2>
              </div>
              <span className="text-[11px] font-medium text-slate-400">
                {rateMasked ? 'Rates hidden for your role' : 'Based on 160 hrs/month estimate'}
              </span>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
              <div className="p-6 space-y-1.5">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Pay Rate</div>
                <div className="text-lg font-bold font-mono text-slate-900">
                  <MaskedValue value={formatRate(placement.payRate) || '—'} isMasked={rateMasked} />
                </div>
                <div className="text-[11px] text-slate-500">
                  Est. Monthly:{' '}
                  <MaskedValue value={payNum > 0 ? monthlyPay : '—'} isMasked={rateMasked} />
                </div>
              </div>

              <div className="p-6 space-y-1.5">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Bill Rate</div>
                <div className="text-lg font-bold font-mono text-slate-900">
                  <MaskedValue value={formatRate(placement.billing) || '—'} isMasked={rateMasked} />
                </div>
                <div className="text-[11px] text-slate-500">
                  Est. Monthly:{' '}
                  <MaskedValue value={billNum > 0 ? monthlyBilling : '—'} isMasked={rateMasked} />
                </div>
              </div>

              <div className="p-6 space-y-1.5">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Hourly Spread</div>
                <div
                  className={`text-lg font-bold font-mono ${
                    spreadNum < 0 ? 'text-rose-600' : 'text-emerald-700'
                  }`}
                >
                  <MaskedValue
                    value={formatSpread(placement.hourlySpread, currencySymbol)}
                    isMasked={rateMasked}
                  />
                </div>
                <div className="text-[11px] text-slate-500 font-medium">
                  Est. Monthly Profit:{' '}
                  <span className="text-emerald-700 font-semibold">
                    <MaskedValue
                      value={billNum > 0 || payNum > 0 ? monthlyProfit : '—'}
                      isMasked={rateMasked}
                    />
                  </span>
                </div>
              </div>

              <div className="p-6 space-y-1.5">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Profit Margin</div>
                <div className="text-lg font-bold font-mono text-slate-900">
                  <MaskedValue
                    value={
                      placement.marginPct !== undefined && placement.marginPct !== null
                        ? `${Number(placement.marginPct).toFixed(1)}%`
                        : formatMargin(placement.marginPct)
                    }
                    isMasked={rateMasked}
                  />
                </div>
                <div className="text-[11px] text-slate-500">Gross margin on billing</div>
              </div>
            </div>
          </section>

          {/* Contract Timeline */}
          <section className="bg-white rounded-xl border border-slate-200/90 card-shadow overflow-hidden text-xs">
            <div className="px-6 py-4 border-b border-slate-100 bg-white flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CalendarClock className="w-3.5 h-3.5 text-brand-600" />
                <h2 className="font-bold text-slate-900">Contract Period &amp; Timeline</h2>
              </div>
              {ended ? (
                <StatusBadge
                  label={`Ended · ${effectiveStatus}`}
                  tone={isCompleted ? 'emerald' : 'rose'}
                  size="xs"
                />
              ) : daysLeft !== null ? (
                <StatusBadge
                  tone={daysLeft < 0 ? 'rose' : daysLeft <= 30 ? 'amber' : 'emerald'}
                  size="xs"
                  label={
                    daysLeft < 0
                      ? `Past end date by ${formatDayCount(Math.abs(daysLeft))}`
                      : daysLeft === 0
                        ? 'Ends today'
                        : daysLeft <= 30
                          ? `Expiring in ${formatDayCount(daysLeft)}`
                          : `${formatDayCount(daysLeft)} remaining`
                  }
                />
              ) : null}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100">
              <div className="px-6 py-5 space-y-1">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Start Date
                </div>
                <div className="text-sm font-bold text-slate-900 font-mono tabular-nums">
                  {placement.startDate || '—'}
                </div>
                <div className="text-[11px] text-slate-500">Contract effective date</div>
              </div>

              <div className="px-6 py-5 space-y-1">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  End Date
                </div>
                <div className="text-sm font-bold text-slate-900 font-mono tabular-nums">
                  {placement.endDate || '—'}
                </div>
                <div className="text-[11px] text-slate-500">
                  {ended ? `Closed (${effectiveStatus})` : 'Scheduled completion'}
                </div>
              </div>

              <div className="px-6 py-5 flex items-center gap-4">
                <ContractProgressRing
                  pct={timelinePct}
                  hasTimeline={Boolean(timeline)}
                  tone={timelineTone}
                  replayKey={`${placement.id}-${timelinePct}-${workspaceTab}`}
                />
                <div className="min-w-0 space-y-0.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Contract Progress
                  </div>
                  <div className="text-sm font-bold text-slate-900 font-mono tabular-nums">
                    {timeline ? formatDayCount(timeline.totalDays) : '—'}
                  </div>
                  <div className="text-[11px] text-slate-500 tabular-nums">
                    {timeline
                      ? ended
                        ? `${formatDayCount(effectiveElapsedDays)} of ${formatDayCount(timeline.totalDays)} (${effectiveStatus})`
                        : `${formatDayCount(effectiveElapsedDays)} of ${formatDayCount(timeline.totalDays)} elapsed`
                      : 'Add start and end dates'}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* TAB 2: Connected Records */}
      {workspaceTab === 'records' && (
        <section className="bg-white rounded-xl border border-slate-200/90 card-shadow overflow-hidden text-xs">
          <div className="px-6 py-4 border-b border-slate-100 bg-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-brand-600" />
              <h2 className="font-bold text-slate-900">Connected Records</h2>
            </div>
            <span className="text-[11px] text-slate-400">
              {connectedRecordsCount} linked entity record{connectedRecordsCount === 1 ? '' : 's'}
            </span>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/40 flex flex-col justify-between gap-3">
              <div className="space-y-1">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 inline-flex items-center gap-1">
                  <UserCheck className="w-3 h-3 text-emerald-600" />
                  <span>Consultant</span>
                </div>
                <div className="text-sm font-bold text-slate-900">{placement.resourceName}</div>
                <div className="text-[11px] text-slate-500">{placement.skillRole}</div>
              </div>
              {linkedCandidate && onOpenConsultant ? (
                <button
                  type="button"
                  onClick={() => onOpenConsultant(linkedCandidate)}
                  className="self-start inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:text-brand-800 hover:underline cursor-pointer"
                >
                  <span>Open Consultant Profile</span>
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              ) : (
                <span className="text-[11px] text-slate-400">Recorded on placement sheet</span>
              )}
            </div>

            <div className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/40 flex flex-col justify-between gap-3">
              <div className="space-y-1">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 inline-flex items-center gap-1">
                  <Building2 className="w-3 h-3 text-brand-600" />
                  <span>Client Account</span>
                </div>
                <div className="text-sm font-bold text-slate-900">{placement.customer}</div>
                <div className="text-[11px] text-slate-500">
                  Contact: {placement.customerContact || 'Hiring Manager'}
                </div>
              </div>
              {linkedClient && onOpenClient ? (
                <button
                  type="button"
                  onClick={() => onOpenClient(linkedClient)}
                  className="self-start inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:text-brand-800 hover:underline cursor-pointer"
                >
                  <span>Open Client Details</span>
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              ) : (
                <span className="text-[11px] text-slate-400">No matching client record</span>
              )}
            </div>

            <div className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/40 flex flex-col justify-between gap-3">
              <div className="space-y-1">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 inline-flex items-center gap-1">
                  <Handshake className="w-3 h-3 text-amber-600" />
                  <span>Staffing Vendor</span>
                </div>
                <div className="text-sm font-bold text-slate-900">
                  {placement.vendorName || 'Direct Placement'}
                </div>
                <div className="text-[11px] text-slate-500">
                  {placement.vendorName
                    ? 'Subcontractor / partner agency'
                    : 'No third-party vendor attached'}
                </div>
              </div>
              {linkedVendor && onOpenVendor ? (
                <button
                  type="button"
                  onClick={() => onOpenVendor(linkedVendor)}
                  className="self-start inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:text-brand-800 hover:underline cursor-pointer"
                >
                  <span>Open Vendor Details</span>
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              ) : (
                <span className="text-[11px] text-slate-400">
                  {placement.vendorName ? 'Partner vendor' : 'Direct engagement'}
                </span>
              )}
            </div>

            <div className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/40 flex flex-col justify-between gap-3">
              <div className="space-y-1">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 inline-flex items-center gap-1">
                  <Briefcase className="w-3 h-3 text-slate-500" />
                  <span>Job Opening</span>
                </div>
                {linkedRequirement ? (
                  <>
                    <div className="text-sm font-bold text-slate-900 truncate">
                      {linkedRequirement.code} &bull; {linkedRequirement.opportunityTitle}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {linkedRequirement.skillsRequired
                        ? `${linkedRequirement.skillsRequired} (${linkedRequirement.status})`
                        : linkedRequirement.status}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-sm font-bold text-slate-900">Direct Entry</div>
                    <div className="text-[11px] text-slate-500">
                      Not linked to a pipeline opening
                    </div>
                  </>
                )}
              </div>
              {linkedRequirement && onOpenRequirement ? (
                <button
                  type="button"
                  onClick={() => onOpenRequirement(linkedRequirement)}
                  className="self-start inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:text-brand-800 hover:underline cursor-pointer"
                >
                  <span>Open Job Opening</span>
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              ) : (
                <span className="text-[11px] text-slate-400">Standalone placement record</span>
              )}
            </div>
          </div>
        </section>
      )}

      {/* TAB 3: Agreement & Details */}
      {workspaceTab === 'details' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200/90 card-shadow overflow-hidden text-xs">
            <div className="px-6 py-4 border-b border-slate-100 bg-white flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <div>
                  <h3 className="font-bold text-slate-900">Agreement &amp; Contact Info</h3>
                  <p className="text-[11px] text-slate-400">
                    SOW purchase order reference, engagement model, and stakeholder contacts.
                  </p>
                </div>
              </div>
              {onUpdatePlacement && (
                <button
                  type="button"
                  onClick={() => setEditingPlacement({ ...placement })}
                  className="text-brand-600 font-semibold hover:underline text-xs inline-flex items-center gap-1 cursor-pointer"
                >
                  <Pencil className="w-3 h-3" />
                  <span>Edit Details</span>
                </button>
              )}
            </div>

            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-5">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  PO / SOW #
                </div>
                <div className="font-semibold font-mono text-slate-900 [overflow-wrap:anywhere]">
                  {placement.purchaseOrderNumber || '—'}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Placement Model
                </div>
                <div className="font-semibold text-slate-900">
                  {placement.placementType || 'C2C Subcontractor'}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Deployment
                </div>
                <div className="font-semibold text-slate-900">
                  {placement.deployment || 'Onshore'}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Contract Window
                </div>
                <div className="font-semibold font-mono text-slate-900 inline-flex items-center gap-1 flex-wrap">
                  <span>{placement.startDate || '—'}</span>
                  <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                  <span>{placement.endDate || '—'}</span>
                </div>
              </div>

              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Assigned Recruiter
                </div>
                <div className="font-semibold text-slate-900">
                  {placement.recruiter || '—'}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Client Contact
                </div>
                <div className="font-semibold text-slate-900">
                  {placement.customerContact || '—'}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1 inline-flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  <span>Work Email</span>
                </div>
                <div className="font-semibold text-slate-900 [overflow-wrap:anywhere]">
                  {contactEmail ? (
                    <a href={`mailto:${contactEmail}`} className="text-brand-700 hover:underline">
                      {contactEmail}
                    </a>
                  ) : (
                    '—'
                  )}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1 inline-flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  <span>Phone</span>
                </div>
                <div className="font-semibold text-slate-900 whitespace-nowrap">
                  {contactPhone ? (
                    <a href={`tel:${contactPhone}`} className="text-brand-700 hover:underline">
                      {contactPhone}
                    </a>
                  ) : (
                    '—'
                  )}
                </div>
              </div>
            </div>
          </div>

          <aside className="lg:col-span-4 space-y-4">
            {/* Agreement Readiness & Compliance Summary */}
            <div className="bg-white rounded-xl border border-slate-200/90 card-shadow overflow-hidden text-xs">
              <div className="px-5 py-3.5 border-b border-slate-100 bg-white flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-brand-600" />
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    Agreement Readiness
                  </h3>
                </div>
                <StatusBadge
                  tone={readyCheckCount === agreementChecks.length ? 'emerald' : 'amber'}
                  size="xs"
                  label={`${readyCheckCount}/${agreementChecks.length} Verified`}
                />
              </div>

              <div className="divide-y divide-slate-100">
                {agreementChecks.map((item) => (
                  <div key={item.key} className="px-5 py-3 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      {item.status === 'ok' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle
                          className={`w-4 h-4 shrink-0 mt-0.5 ${
                            item.status === 'danger' ? 'text-rose-500' : 'text-amber-500'
                          }`}
                        />
                      )}
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900">{item.label}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5 [overflow-wrap:anywhere]">
                          {item.detail}
                        </div>
                      </div>
                    </div>
                    {item.actionLabel && item.onAction && (
                      <button
                        type="button"
                        onClick={item.onAction}
                        className="text-[11px] font-semibold text-brand-600 hover:text-brand-700 hover:underline shrink-0 cursor-pointer"
                      >
                        {item.actionLabel}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {customFieldEntries.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200/90 card-shadow overflow-hidden text-xs">
                <div className="px-5 py-3.5 border-b border-slate-100 bg-white flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-brand-600" />
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Custom Attributes
                  </h3>
                </div>
                <dl className="p-5 space-y-2.5">
                  {customFieldEntries.map(([k, v]) => (
                    <div key={k} className="flex items-start justify-between gap-2">
                      <dt className="text-slate-400 font-medium capitalize shrink-0">
                        {k.replace(/_/g, ' ')}
                      </dt>
                      <dd className="text-slate-800 font-medium text-right min-w-0 [overflow-wrap:anywhere]">
                        {String(v)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {onDeletePlacement && (
              <div className="bg-white rounded-xl border border-slate-200/80 card-shadow p-5 space-y-3 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-slate-900">Placement Lifecycle</h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {ended
                        ? 'Ended placement ready for cleanup.'
                        : 'End contract before deleting.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={!ended}
                    onClick={() => ended && setDeletingPlacement(placement)}
                    className={`px-3 py-1.5 rounded-lg border font-semibold text-xs inline-flex items-center gap-1.5 transition-colors shrink-0 ${
                      ended
                        ? 'border-rose-200 text-rose-600 hover:bg-rose-50 cursor-pointer'
                        : 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed opacity-75'
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove</span>
                  </button>
                </div>
              </div>
            )}
          </aside>
        </div>
      )}

      <PlacementModals
        vendors={vendors}
        extendingPlacement={extendingPlacement}
        onCloseExtend={() => setExtendingPlacement(null)}
        onExtendContract={onExtendContract}
        editingPlacement={editingPlacement}
        onCloseEdit={() => setEditingPlacement(null)}
        onUpdatePlacement={onUpdatePlacement}
        endingPlacement={endingPlacement}
        onCloseEnd={() => setEndingPlacement(null)}
        deletingPlacement={deletingPlacement}
        onCloseDelete={() => setDeletingPlacement(null)}
        onDeletePlacement={onDeletePlacement}
        onAfterDelete={() => onBack()}
      />
    </section>
  );
};
