import React, { useEffect, useMemo, useState } from 'react';
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
      <section className="max-w-7xl mx-auto py-12 text-center space-y-3">
        <p className="text-sm font-medium text-slate-500">
          Select a placement row to view full contract and billing details.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold cursor-pointer"
        >
          {backLabel}
        </button>
      </section>
    );
  }

  const effectiveStatus = getEffectiveStatus(placement);
  const statusMeta = getPlacementStatusMeta(placement);
  const ended = placement.status === 'Completed' || placement.status === 'Terminated';
  const daysLeft = getDaysRemaining(placement.endDate);
  const timeline = getContractTimelineMetrics(placement.startDate, placement.endDate);

  const initials = placement.resourceName
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

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

  const quickLinkedEntities: Array<{
    key: string;
    role: string;
    name: string;
    meta: string;
    icon: React.ComponentType<{ className?: string }>;
    iconClass: string;
    onOpen?: () => void;
  }> = [
    {
      key: 'consultant',
      role: 'Consultant',
      name: placement.resourceName,
      meta: linkedCandidate?.currentTitle || placement.skillRole,
      icon: UserCheck,
      iconClass: 'text-emerald-600 bg-emerald-50 border-emerald-200/70',
      onOpen:
        linkedCandidate && onOpenConsultant
          ? () => onOpenConsultant(linkedCandidate)
          : undefined,
    },
    {
      key: 'client',
      role: 'Client',
      name: placement.customer,
      meta: placement.customerContact || linkedClient?.location || 'Client account',
      icon: Building2,
      iconClass: 'text-brand-600 bg-brand-50 border-brand-200/70',
      onOpen: linkedClient && onOpenClient ? () => onOpenClient(linkedClient) : undefined,
    },
    ...(linkedVendor || placement.vendorName
      ? [
          {
            key: 'vendor',
            role: 'Vendor',
            name: linkedVendor?.name || placement.vendorName || 'Partner Vendor',
            meta:
              linkedVendor?.invoicingTerms ||
              linkedVendor?.paymentTerms ||
              'Subcontractor partner',
            icon: Handshake,
            iconClass: 'text-amber-600 bg-amber-50 border-amber-200/70',
            onOpen:
              linkedVendor && onOpenVendor ? () => onOpenVendor(linkedVendor) : undefined,
          },
        ]
      : []),
    ...(linkedRequirement
      ? [
          {
            key: 'requirement',
            role: 'Job Opening',
            name: `${linkedRequirement.code} · ${linkedRequirement.opportunityTitle}`,
            meta: linkedRequirement.status,
            icon: Briefcase,
            iconClass: 'text-slate-600 bg-slate-100 border-slate-200/80',
            onOpen: onOpenRequirement ? () => onOpenRequirement(linkedRequirement) : undefined,
          },
        ]
      : []),
  ];

  const progressBarClass = ended
    ? 'bg-slate-400'
    : daysLeft !== null && daysLeft < 0
      ? 'bg-rose-500'
      : daysLeft !== null && daysLeft <= 30
        ? 'bg-amber-500'
        : 'bg-emerald-500';

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
    <section className="max-w-7xl mx-auto space-y-5 animate-fade-in">
      <DetailBreadcrumb
        backLabel={backLabel}
        onBack={onBack}
        codePill={placement.purchaseOrderNumber || undefined}
        title={placement.resourceName}
        rightSlot={
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                ended
                  ? 'bg-slate-400'
                  : daysLeft !== null && daysLeft <= 30
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
              }`}
            />
            <span>
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
          </div>
        }
      />

      {/* Unified Placement Hero + 4-Col Metadata Bar + Tabs */}
      <div className="bg-white rounded-xl border border-slate-200/80 card-shadow overflow-hidden">
        {/* Title & Action Bar */}
        <div className="px-6 py-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200/70 text-emerald-700 font-bold text-sm flex items-center justify-center flex-shrink-0">
              {initials || <Briefcase className="w-5 h-5" />}
            </div>
            <div className="min-w-0 flex-1 space-y-0.5">
              <div>
                <h1 className="text-[17px] sm:text-[18px] font-bold text-slate-900 tracking-tight leading-snug inline align-middle mr-2.5">
                  {placement.resourceName}
                </h1>
                <StatusBadge
                  label={statusMeta.label}
                  tone={statusMeta.tone}
                  size="xs"
                  className="align-middle"
                />
              </div>
              <p className="text-xs text-slate-500 truncate">
                <span className="font-medium text-slate-700">{placement.skillRole}</span>
                {placement.vendorName && (
                  <span> &middot; via {placement.vendorName}</span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
            {onUpdatePlacement && (
              <button
                type="button"
                onClick={() => setEditingPlacement({ ...placement })}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Edit Placement</span>
              </button>
            )}
            {!ended && onUpdatePlacement && (
              <button
                type="button"
                onClick={() => setEndingPlacement(placement)}
                title="End consultant placement"
                className="px-3 py-1.5 rounded-lg border border-rose-200 bg-white hover:bg-rose-50 text-rose-700 font-semibold text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <CalendarX className="w-3.5 h-3.5" />
                <span>End Placement</span>
              </button>
            )}
            {onExtendContract && (
              <button
                type="button"
                onClick={() => setExtendingPlacement(placement)}
                className="px-3.5 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs shadow-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <CalendarPlus className="w-3.5 h-3.5" />
                <span>{ended ? 'Renew SOW' : 'Extend SOW'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Structured 4-Column Metadata Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 border-t border-slate-100 bg-slate-50/45 text-xs">
          {/* 1. Client & Engagement Model */}
          <div className="px-6 py-3.5 space-y-1.5 min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Client &amp; Model
            </div>
            <div className="font-semibold text-slate-900 truncate flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              {linkedClient && onOpenClient ? (
                <button
                  type="button"
                  onClick={() => onOpenClient(linkedClient)}
                  className="truncate hover:text-brand-600 cursor-pointer text-left"
                >
                  {placement.customer}
                </button>
              ) : (
                <span className="truncate">{placement.customer}</span>
              )}
            </div>
            <div className="text-[11px] text-slate-500 truncate">
              {placement.placementType || 'C2C Subcontractor'} &middot;{' '}
              {placement.deployment || 'Onshore'}
            </div>
          </div>

          {/* 2. Commercial Rates */}
          <div className="px-6 py-3.5 space-y-1.5 min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <DollarSign className="w-3 h-3 text-emerald-600" />
              <span>Commercial Rates</span>
            </div>
            {rateMasked ? (
              <>
                <MaskedValue value="" isMasked={true} className="text-sm font-bold block" />
                <div className="text-[11px] text-slate-400">Rate protected for your role</div>
              </>
            ) : (
              <>
                <div className="font-mono font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                  <span>Bill {formatRate(placement.billing) || '—'}</span>
                  <span
                    className={`text-[11px] font-semibold ${
                      spreadNum < 0 ? 'text-rose-600' : 'text-emerald-700'
                    }`}
                  >
                    ({formatSpread(placement.hourlySpread, currencySymbol)})
                  </span>
                </div>
                <div className="text-[11px] font-mono text-slate-500">
                  Pay {formatRate(placement.payRate) || '—'} &middot; Margin{' '}
                  {placement.marginPct !== undefined && placement.marginPct !== null
                    ? `${Number(placement.marginPct).toFixed(1)}%`
                    : formatMargin(placement.marginPct)}
                </div>
              </>
            )}
          </div>

          {/* 3. Agreement & Recruiter */}
          <div className="px-6 py-3.5 space-y-1.5 min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              PO &amp; Owner
            </div>
            <div className="font-semibold text-slate-900 truncate font-mono">
              {placement.purchaseOrderNumber || 'No PO / SOW #'}
            </div>
            <div className="text-[11px] text-slate-500 truncate">
              Recruiter:{' '}
              <strong className="font-medium text-slate-700">{placement.recruiter || '—'}</strong>
            </div>
          </div>

          {/* 4. Contract Timeline Progress */}
          <div className="px-6 py-3.5 space-y-1.5 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Timeline
              </span>
              <span className="text-[11px] font-mono font-bold text-slate-800">
                {timeline ? `${ended ? 100 : timeline.progressPct}%` : '—'}
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-200/80 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${progressBarClass}`}
                style={{ width: `${timeline ? (ended ? 100 : timeline.progressPct) : 0}%` }}
              />
            </div>
            <div className="text-[11px] text-slate-500 truncate">
              {placement.startDate || '—'} &rarr; {placement.endDate || '—'}
            </div>
          </div>
        </div>

        <DetailUnderlineTabs
          ariaLabel="Placement workspace sections"
          tabs={placementTabs}
          activeTab={workspaceTab}
          onChange={setWorkspaceTab}
        />
      </div>

      {/* TAB 1: Billing & Contract */}
      {workspaceTab === 'billing' && (
        <div className="space-y-5">
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
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
              >
                <CalendarPlus className="w-3.5 h-3.5" />
                <span>Extend Contract</span>
              </button>
            </div>
          )}

          {/* Billing & Rate Breakdown */}
          <section className="bg-white rounded-xl border border-slate-200/80 card-shadow overflow-hidden text-xs">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                <h2 className="font-bold text-slate-900">Billing &amp; Rate Summary</h2>
              </div>
              <span className="text-[11px] font-medium text-slate-400">
                {rateMasked ? 'Rates hidden for your role' : 'Based on 160 hrs/month estimate'}
              </span>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
              <div className="p-6 space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Pay Rate
                </div>
                <div className="text-lg font-extrabold font-mono text-slate-800">
                  <MaskedValue value={formatRate(placement.payRate) || '—'} isMasked={rateMasked} />
                </div>
                <div className="text-[11px] text-slate-500">
                  Est. Monthly:{' '}
                  <MaskedValue value={payNum > 0 ? monthlyPay : '—'} isMasked={rateMasked} />
                </div>
              </div>

              <div className="p-6 space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Bill Rate
                </div>
                <div className="text-lg font-extrabold font-mono text-slate-900">
                  <MaskedValue value={formatRate(placement.billing) || '—'} isMasked={rateMasked} />
                </div>
                <div className="text-[11px] text-slate-500">
                  Est. Monthly:{' '}
                  <MaskedValue value={billNum > 0 ? monthlyBilling : '—'} isMasked={rateMasked} />
                </div>
              </div>

              <div className="p-6 space-y-1 bg-emerald-50/30">
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700/80">
                  Hourly Spread
                </div>
                <div
                  className={`text-lg font-extrabold font-mono ${
                    spreadNum < 0 ? 'text-rose-600' : 'text-emerald-700'
                  }`}
                >
                  <MaskedValue
                    value={formatSpread(placement.hourlySpread, currencySymbol)}
                    isMasked={rateMasked}
                  />
                </div>
                <div className="text-[11px] text-emerald-700/90 font-medium">
                  Est. Monthly Profit:{' '}
                  <MaskedValue
                    value={billNum > 0 || payNum > 0 ? monthlyProfit : '—'}
                    isMasked={rateMasked}
                  />
                </div>
              </div>

              <div className="p-6 space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Profit Margin
                </div>
                <div className="text-lg font-extrabold font-mono text-slate-900">
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
          <section className="bg-white rounded-xl border border-slate-200/80 card-shadow overflow-hidden text-xs">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CalendarClock className="w-3.5 h-3.5 text-brand-600" />
                <h2 className="font-bold text-slate-900">Contract Period &amp; Timeline</h2>
              </div>
              {ended ? (
                <span className="text-[11px] font-semibold text-slate-500">
                  Contract ended ({effectiveStatus})
                </span>
              ) : daysLeft !== null ? (
                <span
                  className={`text-[11px] font-semibold ${
                    daysLeft < 0
                      ? 'text-rose-600'
                      : daysLeft <= 30
                        ? 'text-amber-700'
                        : 'text-emerald-700'
                  }`}
                >
                  {daysLeft < 0
                    ? `Past end date by ${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? '' : 's'}`
                    : daysLeft === 0
                      ? 'Ends today'
                      : daysLeft <= 30
                        ? `Expiring in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`
                        : `${daysLeft} days remaining`}
                </span>
              ) : null}
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 rounded-xl border border-slate-200/80 bg-slate-50/40">
                <div className="p-4">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Start Date
                  </div>
                  <div className="text-sm font-bold text-slate-900 mt-1 font-mono">
                    {placement.startDate || '—'}
                  </div>
                </div>

                <div className="p-4">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    End Date
                  </div>
                  <div className="text-sm font-bold text-slate-900 mt-1 font-mono">
                    {placement.endDate || '—'}
                  </div>
                </div>

                <div className="p-4">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Contract Length
                  </div>
                  <div className="text-sm font-bold text-slate-900 mt-1 font-mono">
                    {timeline ? `${timeline.totalDays} days` : '—'}
                  </div>
                </div>
              </div>

              {timeline && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span className="font-mono">{placement.startDate}</span>
                    <span className="font-medium text-slate-700 inline-flex items-center gap-1">
                      <span>{timeline.elapsedDays} of {timeline.totalDays} days elapsed</span>
                      <span className="text-slate-400">({timeline.progressPct}%)</span>
                    </span>
                    <span className="font-mono">{placement.endDate}</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${progressBarClass}`}
                      style={{ width: `${ended ? 100 : timeline.progressPct}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {/* TAB 2: Connected Records */}
      {workspaceTab === 'records' && (
        <section className="bg-white rounded-xl border border-slate-200/80 card-shadow overflow-hidden text-xs">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
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
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 inline-flex items-center gap-1">
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
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 inline-flex items-center gap-1">
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
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 inline-flex items-center gap-1">
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
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 inline-flex items-center gap-1">
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
          <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200/80 card-shadow overflow-hidden text-xs">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between gap-2">
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
                <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  PO / SOW #
                </div>
                <div className="font-semibold font-mono text-slate-900 [overflow-wrap:anywhere]">
                  {placement.purchaseOrderNumber || '—'}
                </div>
              </div>

              <div>
                <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Placement Model
                </div>
                <div className="font-semibold text-slate-900">
                  {placement.placementType || 'C2C Subcontractor'}
                </div>
              </div>

              <div>
                <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Deployment
                </div>
                <div className="font-semibold text-slate-900">
                  {placement.deployment || 'Onshore'}
                </div>
              </div>

              <div>
                <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Contract Window
                </div>
                <div className="font-semibold font-mono text-slate-900 inline-flex items-center gap-1 flex-wrap">
                  <span>{placement.startDate || '—'}</span>
                  <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                  <span>{placement.endDate || '—'}</span>
                </div>
              </div>

              <div>
                <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Assigned Recruiter
                </div>
                <div className="font-semibold text-slate-900">
                  {placement.recruiter || '—'}
                </div>
              </div>

              <div>
                <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Client Contact
                </div>
                <div className="font-semibold text-slate-900">
                  {placement.customerContact || '—'}
                </div>
              </div>

              <div>
                <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mb-1 inline-flex items-center gap-1">
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
                <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mb-1 inline-flex items-center gap-1">
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
            <div className="bg-white rounded-xl border border-slate-200/80 card-shadow overflow-hidden text-xs">
              <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-brand-600" />
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    Agreement Readiness
                  </h3>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono border ${
                    readyCheckCount === agreementChecks.length
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}
                >
                  {readyCheckCount}/{agreementChecks.length} Verified
                </span>
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

            {/* Direct Quick-Jump Links for Connected Stakeholders & Opening */}
            <div className="bg-white rounded-xl border border-slate-200/80 card-shadow overflow-hidden text-xs">
              <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-brand-600" />
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    Connected Records
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setWorkspaceTab('records')}
                  className="text-[11px] font-semibold text-brand-600 hover:text-brand-700 hover:underline cursor-pointer"
                >
                  Full Grid &rarr;
                </button>
              </div>

              <div className="p-3 space-y-1.5">
                {quickLinkedEntities.map((entity) => {
                  const Icon = entity.icon;
                  const rowInner = (
                    <>
                      <div
                        className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${entity.iconClass}`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0 flex-1 text-left">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {entity.role}
                        </div>
                        <div className="font-semibold text-slate-900 truncate">{entity.name}</div>
                        <div className="text-[11px] text-slate-500 truncate">{entity.meta}</div>
                      </div>
                      {entity.onOpen && (
                        <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-brand-600 shrink-0 transition-colors" />
                      )}
                    </>
                  );

                  return entity.onOpen ? (
                    <button
                      key={entity.key}
                      type="button"
                      onClick={entity.onOpen}
                      className="w-full p-2.5 rounded-lg border border-transparent hover:border-slate-200 hover:bg-slate-50 flex items-center gap-2.5 transition-colors cursor-pointer group"
                    >
                      {rowInner}
                    </button>
                  ) : (
                    <div
                      key={entity.key}
                      className="w-full p-2.5 rounded-lg bg-slate-50/70 flex items-center gap-2.5"
                    >
                      {rowInner}
                    </div>
                  );
                })}
              </div>
            </div>

            {customFieldEntries.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200/80 card-shadow overflow-hidden text-xs">
                <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
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
