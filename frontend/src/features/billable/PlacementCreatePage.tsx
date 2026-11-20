import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Briefcase,
  Check,
  ChevronDown,
  DollarSign,
  Lock,
  Search,
  TrendingUp,
  UserCheck,
  X,
} from 'lucide-react';
import { BillablePlacement, Candidate, Client, Requirement, User, Vendor } from '../../types';
import { inferPlacementTypeFromRate, parseRateNumber, useCurrency } from '../../utils/currency';
import { initWorkspaceBrand, useWorkspacePolicies } from '../../utils/workspaceBrand';
import {
  formatMissingFieldsMessage,
  getMissingFieldLabels,
  INVALID_FIELD_CLASSES,
} from '../../utils/formValidation';
import { getVendorComplianceWarning } from './placementUtils';
import { SearchableSelectInput } from '../../components/shared/SearchableSelectInput';
import { CustomSelect } from '../../components/shared/CustomSelect';
import { DynamicCustomFieldsSection } from '../../components/shared/DynamicCustomFieldsSection';
import { DetailBreadcrumb } from '../../components/shared/DetailPageShell';
import { PageHeader } from '../../components/shared/PageHeader';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { ActionButton } from '../../components/shared/ActionButton';
import { UnsavedChangesModal, useFormShortcuts } from '../../hooks/useFormShortcuts';

interface PlacementCreatePageProps {
  initialRequirement?: Requirement | null;
  initialCandidate?: Candidate | null;
  requestedCandidateId?: string;
  candidates?: Candidate[];
  clients?: Client[];
  vendors?: Vendor[];
  requirements?: Requirement[];
  users?: User[];
  backLabel?: string;
  onBack: () => void;
  onCreatePlacement: (placement: BillablePlacement, reqId?: string) => Promise<void> | void;
  showToast: (title: string, message: string, icon?: string) => void;
}

const stripClientLocation = (name?: string) =>
  String(name || '')
    .replace(/\s+Location:\s*.*$/i, '')
    .trim();

const getContactStr = (c: any) =>
  typeof c === 'object' && c !== null ? c.fullName || c.name || '' : String(c || '');

const getRecruiterStr = (r: any) =>
  typeof r === 'object' && r !== null ? r.fullName || r.name || '' : String(r || '');

const getDefaultDates = () => ({
  startDate: new Date().toISOString().split('T')[0],
  endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1))
    .toISOString()
    .split('T')[0],
});

/**
 * Unified full-page commercial placement activation & SOW creation studio (/placements/new).
 */
export const PlacementCreatePage: React.FC<PlacementCreatePageProps> = ({
  initialRequirement = null,
  initialCandidate = null,
  requestedCandidateId,
  candidates = [],
  clients = [],
  vendors = [],
  requirements = [],
  users = [],
  backLabel = 'Back to Billable Consultants',
  onBack,
  onCreatePlacement,
  showToast,
}) => {
  const { symbol: currencySymbol } = useCurrency();
  const { requirePoForPlacement } = useWorkspacePolicies();

  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [poError, setPoError] = useState('');
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [consultantMenuOpen, setConsultantMenuOpen] = useState(false);
  const [consultantSearch, setConsultantSearch] = useState('');
  const [consultantSource, setConsultantSource] = useState<'submitted' | 'roster'>('submitted');

  const consultantMenuRef = useRef<HTMLDivElement | null>(null);
  const poInputRef = useRef<HTMLInputElement | null>(null);
  const userEditedRef = useRef(false);
  const hydratedContextKeyRef = useRef<string>('');

  const [form, setForm] = useState(() => ({
    candidateId: initialCandidate?.id || requestedCandidateId || '',
    requirementId: initialRequirement?.id || '',
    resourceName: initialCandidate?.fullName || '',
    customer: stripClientLocation(initialRequirement?.companyName) || clients[0]?.name || '',
    customerContact:
      getContactStr(initialRequirement?.clientContact) || clients[0]?.contacts?.[0]?.name || '',
    phone: initialCandidate?.phone || '',
    email: initialCandidate?.email || '',
    skillRole: initialRequirement?.opportunityTitle || initialCandidate?.currentTitle || '',
    deployment: 'Onshore',
    startDate: getDefaultDates().startDate,
    endDate: getDefaultDates().endDate,
    billRate: initialRequirement ? String(initialRequirement.targetBillRate || 0) : '115',
    payRate: initialCandidate?.hourlyRate
      ? String(parseRateNumber(initialCandidate.hourlyRate, 0) || (initialRequirement?.targetPayRate || 85))
      : initialRequirement
        ? String(initialRequirement.targetPayRate || 0)
        : '85',
    placementType: initialRequirement ? 'W2 Hourly' : 'C2C Subcontractor',
    vendorName: initialCandidate?.vendorName || '',
    purchaseOrderNumber: '',
    recruiter:
      getRecruiterStr(initialRequirement?.assignedRecruiter || initialCandidate?.assignedRecruiter) ||
      users[0]?.name ||
      '',
  }));

  useEffect(() => {
    void initWorkspaceBrand(true);
  }, []);

  // Re-hydrate initial context once async entities load on direct URL visit or param changes
  const incomingKey = `${initialRequirement?.id || ''}:${requestedCandidateId || ''}:${initialCandidate?.id || ''}:${clients.length > 0 ? 'c' : ''}:${users.length > 0 ? 'u' : ''}:${candidates.length > 0 ? 'k' : ''}`;
  useEffect(() => {
    if (userEditedRef.current) return;
    if (hydratedContextKeyRef.current === incomingKey) return;
    hydratedContextKeyRef.current = incomingKey;

    const req = initialRequirement;
    const reqSubmissions = req?.submissions || [];
    const reqSubCandIds = new Set(
      reqSubmissions.map((s) => s.candidateId).filter(Boolean)
    );

    const findSubForCandidate = (targetId: string) =>
      reqSubmissions.find(
        (s) =>
          s.candidateId === targetId ||
          s.candidate?.id === targetId ||
          s.id === targetId
      );

    const buildCandFromSub = (s: NonNullable<typeof reqSubmissions[number]>): Candidate => ({
      id: s.candidateId || s.id,
      fullName: s.fullName,
      email: s.email || '',
      phone: s.phone || '',
      currentTitle: s.currentTitle || '',
      workAuth: s.workAuth || '',
      education: '',
      skillset: s.skillset || '',
      hourlyRate: s.submittedRate || s.hourlyRate || '',
      relocation: '',
      resumeName: s.resumeName || '',
      resumeFormat: s.resumeFormat || 'PDF',
      resumeFileUrl: s.resumeFileUrl,
      assignedRecruiter: s.recruiterName || '',
      pipelineStage: s.stage,
      vendorName: s.submittedVendorName || undefined,
    });

    const explicitSub = requestedCandidateId ? findSubForCandidate(requestedCandidateId) : undefined;
    const explicitCand =
      initialCandidate ||
      (requestedCandidateId
        ? candidates.find((c) => c.id === requestedCandidateId) ||
        explicitSub?.candidate ||
        (explicitSub ? buildCandFromSub(explicitSub) : null)
        : null);

    // Only auto-pick a "Selected" / first applicant when no specific candidate was requested
    const preferredSub = requestedCandidateId
      ? explicitSub
      : reqSubmissions.find((s) => s.stage === 'Selected') ||
      reqSubmissions.find((s) => s.stage !== 'Closed') ||
      reqSubmissions[0];

    const matchedCandidate =
      explicitCand ||
      (!requestedCandidateId
        ? (preferredSub?.candidateId
          ? candidates.find((c) => c.id === preferredSub.candidateId)
          : undefined) ||
        preferredSub?.candidate ||
        (preferredSub ? buildCandFromSub(preferredSub) : null) ||
        candidates.find(
          (c) =>
            req?.resourceName &&
            c.fullName.trim().toLowerCase() === req.resourceName.trim().toLowerCase()
        ) ||
        null
        : null);

    const matchedSubmission =
      explicitSub ||
      (matchedCandidate
        ? findSubForCandidate(matchedCandidate.id) ||
        reqSubmissions.find(
          (s) =>
            s.fullName.trim().toLowerCase() === matchedCandidate.fullName.trim().toLowerCase()
        )
        : preferredSub);

    const effectiveHourlyRate =
      matchedSubmission?.submittedRate ||
      matchedCandidate?.hourlyRate ||
      matchedSubmission?.hourlyRate ||
      '';
    const effectiveVendorName =
      matchedSubmission?.submittedVendorName || matchedCandidate?.vendorName || '';

    const candPay = effectiveHourlyRate ? parseRateNumber(effectiveHourlyRate, 0) : 0;
    const resolvedPay =
      candPay > 0 ? candPay : req ? req.targetPayRate || 0 : 85;
    const resolvedBill = req ? req.targetBillRate || 0 : 115;

    const candVendor =
      (matchedCandidate?.vendorId
        ? vendors.find((v) => v.id === matchedCandidate.vendorId)
        : undefined) ||
      (effectiveVendorName ? { name: effectiveVendorName } : undefined);

    const inferredType = candVendor
      ? 'C2C Subcontractor'
      : inferPlacementTypeFromRate(effectiveHourlyRate) ||
      (req ? 'W2 Hourly' : 'C2C Subcontractor');

    const matchedClient = req?.companyName
      ? clients.find(
        (c) =>
          stripClientLocation(c.name).toLowerCase() ===
          stripClientLocation(req.companyName).toLowerCase()
      )
      : clients[0];

    const dates = getDefaultDates();

    // Ensure the consultant picker opens on Roster if an explicitly chosen candidate isn't in Submitted
    if (matchedCandidate && reqSubmissions.length > 0) {
      const inSubmitted = reqSubmissions.some(
        (s) =>
          s.stage !== 'Closed' &&
          (s.candidateId === matchedCandidate.id ||
            s.candidate?.id === matchedCandidate.id ||
            s.id === matchedCandidate.id ||
            s.fullName.trim().toLowerCase() === matchedCandidate.fullName.trim().toLowerCase())
      );
      if (!inSubmitted) {
        setConsultantSource('roster');
      }
    }

    setForm((prev) => ({
      ...prev,
      candidateId:
        matchedCandidate?.id ||
        requestedCandidateId ||
        (!requestedCandidateId && reqSubCandIds.size === 1
          ? Array.from(reqSubCandIds)[0] || ''
          : prev.candidateId),
      requirementId: req?.id || prev.requirementId,
      resourceName:
        matchedCandidate?.fullName ||
        matchedSubmission?.fullName ||
        (!requestedCandidateId ? req?.resourceName || prev.resourceName : prev.resourceName),
      customer:
        stripClientLocation(req?.companyName) ||
        stripClientLocation(matchedClient?.name) ||
        prev.customer,
      customerContact:
        getContactStr(req?.clientContact) ||
        matchedClient?.contacts?.[0]?.name ||
        prev.customerContact,
      phone: matchedCandidate?.phone || matchedSubmission?.phone || prev.phone,
      email: matchedCandidate?.email || matchedSubmission?.email || prev.email,
      skillRole:
        req?.opportunityTitle || matchedCandidate?.currentTitle || prev.skillRole,
      startDate: dates.startDate,
      endDate: dates.endDate,
      billRate: String(resolvedBill),
      payRate: String(resolvedPay),
      placementType: inferredType,
      vendorName: candVendor?.name || prev.vendorName,
      recruiter:
        getRecruiterStr(req?.assignedRecruiter || matchedCandidate?.assignedRecruiter) ||
        users[0]?.name ||
        prev.recruiter,
    }));
  }, [incomingKey, initialRequirement, initialCandidate, requestedCandidateId, candidates, clients, vendors, users]);

  useEffect(() => {
    if (!consultantMenuOpen) return;
    const onOutside = (e: MouseEvent) => {
      if (consultantMenuRef.current && !consultantMenuRef.current.contains(e.target as Node)) {
        setConsultantMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [consultantMenuOpen]);

  const isRequirementLocked = Boolean(initialRequirement);
  const selectableRequirements =
    initialRequirement && !requirements.some((r) => r.id === initialRequirement.id)
      ? [initialRequirement, ...requirements]
      : requirements;

  const activeRequirement =
    selectableRequirements.find((r) => r.id === form.requirementId) ||
    (initialRequirement?.id === form.requirementId ? initialRequirement : null) ||
    null;

  const openPositions = activeRequirement?.openPositions || 1;
  const filledPositions = activeRequirement
    ? activeRequirement.filledPositions ?? activeRequirement.activePlacements?.length ?? 0
    : 0;
  const isPositionsFull = Boolean(activeRequirement && filledPositions >= openPositions);

  const billNum = Math.max(0, Number(form.billRate) || 0);
  const payNum = Math.max(0, Number(form.payRate) || 0);
  const spread = billNum - payNum;
  const marginPct = billNum > 0 ? Number(((spread / billNum) * 100).toFixed(1)) : 0;
  const monthlyGrossProfit = Math.round(spread * 160);

  const marginBadgeClass =
    marginPct >= 20
      ? 'bg-white text-emerald-700 border-emerald-300'
      : marginPct >= 10
        ? 'bg-white text-amber-700 border-amber-300'
        : 'bg-white text-rose-700 border-rose-300';

  const contractWeeks = (() => {
    if (!form.startDate || !form.endDate) return 0;
    const start = new Date(form.startDate).getTime();
    const end = new Date(form.endDate).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
    return Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24 * 7)));
  })();

  const updateForm = (patch: Partial<typeof form>) => {
    userEditedRef.current = true;
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const handleSelectCandidate = (candidateId: string, fallbackCandidate?: Candidate | null) => {
    userEditedRef.current = true;
    const sel = candidates.find((c) => c.id === candidateId) || fallbackCandidate || null;
    if (!sel) {
      setForm((prev) => ({ ...prev, candidateId: '' }));
      return;
    }
    const candPay = sel.hourlyRate ? parseRateNumber(sel.hourlyRate, 0) : 0;
    const candVendor =
      (sel.vendorId ? vendors.find((v) => v.id === sel.vendorId) : undefined) ||
      (sel.vendorName ? { name: sel.vendorName } : undefined);
    const inferredType = candVendor
      ? 'C2C Subcontractor'
      : inferPlacementTypeFromRate(sel.hourlyRate);

    setForm((prev) => ({
      ...prev,
      candidateId: sel.id,
      resourceName: sel.fullName,
      phone: sel.phone || prev.phone,
      email: sel.email || prev.email,
      skillRole: prev.skillRole || sel.currentTitle || '',
      payRate: candPay > 0 ? String(candPay) : prev.payRate,
      recruiter: prev.recruiter || getRecruiterStr(sel.assignedRecruiter),
      placementType: inferredType || prev.placementType,
      vendorName: candVendor ? candVendor.name : prev.vendorName,
    }));
  };

  const handleSelectRequirement = (requirementId: string) => {
    if (isRequirementLocked) return;
    userEditedRef.current = true;
    const r = selectableRequirements.find((item) => item.id === requirementId);
    if (!r) {
      setForm((prev) => ({ ...prev, requirementId: '' }));
      setConsultantSource('roster');
      return;
    }
    const matchedClient = clients.find(
      (c) => stripClientLocation(c.name).toLowerCase() === stripClientLocation(r.companyName).toLowerCase()
    );
    setConsultantSource('submitted');
    setForm((prev) => ({
      ...prev,
      requirementId: r.id,
      customer: stripClientLocation(r.companyName) || prev.customer,
      customerContact:
        getContactStr(r.clientContact) || matchedClient?.contacts?.[0]?.name || prev.customerContact,
      skillRole: r.opportunityTitle || prev.skillRole,
      billRate: r.targetBillRate ? String(r.targetBillRate) : prev.billRate,
      payRate: r.targetPayRate ? String(r.targetPayRate) : prev.payRate,
      recruiter: getRecruiterStr(r.assignedRecruiter) || prev.recruiter,
    }));
  };

  const isResourceInvalid = validationAttempted && !form.resourceName.trim();
  const isCustomerInvalid = validationAttempted && !form.customer.trim();

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isSubmitting) return;

    if (isPositionsFull) {
      showToast(
        'Positions Filled',
        `All ${openPositions} open position(s) for this requirement are already placed (${filledPositions}/${openPositions}).`,
        'warning'
      );
      return;
    }

    const missingFields = getMissingFieldLabels([
      { label: 'Placed Consultant Resource', valid: Boolean(form.resourceName.trim()) },
      { label: 'Client Company', valid: Boolean(form.customer.trim()) },
    ]);
    if (missingFields.length > 0) {
      setValidationAttempted(true);
      showToast(
        'Validation Error',
        formatMissingFieldsMessage(missingFields),
        'warning'
      );
      return;
    }

    if (requirePoForPlacement && !form.purchaseOrderNumber.trim()) {
      setPoError('PO / SOW Number is required by workspace General Settings.');
      poInputRef.current?.focus();
      showToast(
        'PO Number Required',
        'Please enter a PO / SOW Number before activating this placement.',
        'warning'
      );
      return;
    }

    const matchedClient = clients.find(
      (c) => stripClientLocation(c.name).toLowerCase() === form.customer.trim().toLowerCase()
    );
    const matchedVendor = vendors.find(
      (v) => v.name.trim().toLowerCase() === form.vendorName.trim().toLowerCase()
    );

    const newPlacement: BillablePlacement = {
      id: 'place_' + Date.now(),
      candidateId: form.candidateId || undefined,
      requirementId: activeRequirement?.id || form.requirementId || undefined,
      clientId: matchedClient?.id,
      vendorId: matchedVendor?.id,
      vendorName:
        form.placementType === 'C2C Subcontractor'
          ? form.vendorName.trim() || undefined
          : undefined,
      purchaseOrderNumber: form.purchaseOrderNumber.trim() || undefined,
      recruiter: form.recruiter,
      deployment: form.deployment,
      customer: form.customer.trim(),
      customerContact: form.customerContact.trim() || 'Timesheet Approver',
      resourceName: form.resourceName.trim(),
      phone: form.phone.trim() || '',
      email: form.email.trim() || '',
      skillRole: form.skillRole.trim() || 'IT Specialist',
      startDate: form.startDate,
      endDate: form.endDate,
      billing: `${currencySymbol}${billNum}/hr`,
      payRate: `${currencySymbol}${payNum}/hr`,
      placementType: form.placementType,
      hourlySpread: spread,
      marginPct,
      status: 'Active',
      customFields: customValues,
    };

    setIsSubmitting(true);
    try {
      await onCreatePlacement(newPlacement, activeRequirement?.id || form.requirementId || undefined);
    } catch {
      // Error toast is handled by parent handler
    } finally {
      setIsSubmitting(false);
    }
  };

  // Build candidate picker list
  const placedIds = new Set(
    (activeRequirement?.activePlacements || []).map((p) => p.candidateId).filter(Boolean)
  );
  const placedNames = new Set(
    (activeRequirement?.activePlacements || []).map((p) => p.resourceName.trim().toLowerCase())
  );

  const submittedList: Array<{ candidate: Candidate; stage: string }> = activeRequirement
    ? (activeRequirement.submissions || [])
      .filter((s) => s.stage !== 'Closed')
      .map((s) => {
        const candObj =
          s.candidate ||
          candidates.find(
            (c) =>
              (s.candidateId && c.id === s.candidateId) ||
              c.fullName.trim().toLowerCase() === s.fullName.trim().toLowerCase()
          ) ||
          ({
            id: s.candidateId || s.id,
            fullName: s.fullName,
            email: s.email || '',
            phone: s.phone || '',
            currentTitle: s.currentTitle || '',
            workAuth: s.workAuth || '',
            education: '',
            skillset: s.skillset || '',
            hourlyRate: s.hourlyRate || '',
            relocation: '',
            assignedRecruiter: '',
            pipelineStage: s.stage,
          } as Candidate);
        return { candidate: candObj, stage: s.stage };
      })
      .filter(
        ({ candidate: c }) =>
          !placedIds.has(c.id) && !placedNames.has(c.fullName.trim().toLowerCase())
      )
    : [];

  const rosterList = candidates.map((c) => ({ candidate: c, stage: c.pipelineStage }));
  const effectiveSource =
    activeRequirement && submittedList.length > 0 && consultantSource === 'submitted'
      ? submittedList
      : rosterList;

  const q = consultantSearch.trim().toLowerCase();
  const filteredConsultants = effectiveSource.filter(
    ({ candidate: c, stage }) =>
      !q ||
      c.fullName.toLowerCase().includes(q) ||
      (c.currentTitle || '').toLowerCase().includes(q) ||
      stage.toLowerCase().includes(q)
  );

  const selectedEntry =
    submittedList.find(({ candidate: c }) => c.id === form.candidateId) ||
    rosterList.find(({ candidate: c }) => c.id === form.candidateId) ||
    (initialCandidate && initialCandidate.id === form.candidateId
      ? {
        candidate: initialCandidate,
        stage: initialCandidate.pipelineStage || 'Submitted',
      }
      : form.candidateId && form.resourceName.trim()
        ? {
          candidate: {
            id: form.candidateId,
            fullName: form.resourceName.trim(),
            currentTitle: form.skillRole || '',
            email: form.email || '',
            phone: form.phone || '',
            workAuth: '',
            education: '',
            skillset: '',
            hourlyRate: form.payRate || '',
            relocation: '',
            assignedRecruiter: form.recruiter || '',
            pipelineStage: 'Submitted',
            vendorName: form.vendorName || undefined,
          } as Candidate,
          stage: 'Submitted',
        }
        : undefined);

  const selectedVendor = vendors.find(
    (v) => v.name.trim().toLowerCase() === form.vendorName.trim().toLowerCase()
  );
  const vendorComplianceWarning =
    form.placementType === 'C2C Subcontractor'
      ? getVendorComplianceWarning(selectedVendor)
      : null;

  const isDirty = Boolean(
    userEditedRef.current ||
    Object.values(customValues).some((v) => String(v || '').trim().length > 0)
  );
  const { showLeaveModal, guardNavigation, confirmLeave, cancelLeave } = useFormShortcuts({
    isDirty,
    isSubmitting,
    onSubmit: () => {
      if (!isPositionsFull) {
        void handleSubmit();
      }
    },
  });

  return (
    <div className="max-w-7xl mx-auto space-y-5 animate-fade-in">
      <DetailBreadcrumb
        backLabel={backLabel}
        onBack={() => guardNavigation(onBack)}
        title={
          activeRequirement
            ? `Activate Placement · ${activeRequirement.code}`
            : 'New Billable Placement'
        }
        codePill={activeRequirement ? activeRequirement.code : 'Placement & SOW'}
      />

      <PageHeader
        title="New Billable Placement"
        subtitle="Connect a consultant and job, set bill and pay rates, check vendor terms, and start the contract."
        badges={
          <>
            {activeRequirement && (
              <StatusBadge
                tone={isPositionsFull ? 'amber' : 'emerald'}
                size="xs"
                label={`Positions: ${filledPositions} / ${openPositions} Filled`}
                className="tabular-nums"
              />
            )}
            {requirePoForPlacement && (
              <StatusBadge tone="amber" size="xs" label="PO / SOW Required" />
            )}
          </>
        }
      />

      {isPositionsFull && activeRequirement && (
        <div className="px-4 py-3 rounded-lg bg-amber-50/70 border border-amber-200 text-slate-700 flex items-center gap-2.5 text-xs">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            All <strong className="text-slate-900">{openPositions}</strong> open position(s) on{' '}
            <strong className="text-slate-900">{activeRequirement.code}</strong> are already placed.{' '}
            {isRequirementLocked
              ? 'Return to the requirement to increase open positions, or start a standalone placement from Billable Consultants.'
              : 'Switch to another requisition or unlink the requisition below to create a standalone placement.'}
          </span>
        </div>
      )}

      {/* 12-Column Layout */}
      <form noValidate onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left: Placement Configuration Cards */}
        <div className="lg:col-span-8 space-y-5 text-xs">
          {/* Card 1: Requisition & Consultant Linking */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 card-shadow space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap border-b border-slate-100 pb-3">
              <div className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-brand-600" />
                <span>Requisition &amp; consultant selection</span>
              </div>
              {activeRequirement && (
                <div className="inline-flex items-center rounded-lg bg-slate-100 p-0.5 border border-slate-200 text-[11px] font-semibold">
                  <button
                    type="button"
                    onClick={() => setConsultantSource('submitted')}
                    className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${consultantSource === 'submitted'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                      }`}
                  >
                    Submitted ({submittedList.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setConsultantSource('roster')}
                    className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${consultantSource === 'roster'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                      }`}
                  >
                    Full Roster ({rosterList.length})
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="flex items-center justify-between gap-2 text-xs font-medium text-slate-700 mb-1">
                  <span className="inline-flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-brand-600" />
                    <span>{isRequirementLocked ? 'Linked Requisition' : 'Link Requisition (Optional)'}</span>
                  </span>
                  {isRequirementLocked && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white border border-slate-300 text-slate-600 text-[11px] font-semibold">
                      <Lock className="w-2.5 h-2.5 text-slate-500" />
                      <span>Locked</span>
                    </span>
                  )}
                </label>
                <CustomSelect
                  value={form.requirementId}
                  onChange={handleSelectRequirement}
                  disabled={isRequirementLocked}
                  ariaLabel={isRequirementLocked ? 'Linked Requisition (Locked)' : 'Link Requisition'}
                  title={
                    isRequirementLocked
                      ? `Placement locked to ${activeRequirement?.code || initialRequirement?.code || 'this requirement'}`
                      : undefined
                  }
                  size="sm"
                  className={isRequirementLocked ? '!bg-slate-50/90' : ''}
                  options={[
                    { value: '', label: '-- Standalone / No Requisition Link --' },
                    ...selectableRequirements.map((r) => ({
                      value: r.id,
                      label: `${r.code} — ${r.opportunityTitle} (${stripClientLocation(r.companyName)})`,
                    })),
                  ]}
                />
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 mb-1">
                  <UserCheck className="w-3.5 h-3.5 text-brand-600" />
                  <span>Select / Switch Placed Consultant</span>
                </label>
                <div ref={consultantMenuRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setConsultantMenuOpen((prev) => !prev)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 hover:border-brand-300 rounded-lg text-left flex items-center justify-between gap-2 transition-colors cursor-pointer focus:outline-none focus:border-brand-500"
                  >
                    {selectedEntry ? (
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-bold text-[11px] flex items-center justify-center shrink-0">
                          {selectedEntry.candidate.fullName.charAt(0).toUpperCase()}
                        </span>
                        <span className="font-semibold text-slate-900 truncate">
                          {selectedEntry.candidate.fullName}
                        </span>
                        <StatusBadge stage={selectedEntry.stage} size="xs" />
                      </div>
                    ) : (
                      <span className="text-slate-400 truncate">
                        {activeRequirement && consultantSource === 'submitted'
                          ? `Select from ${submittedList.length} submitted applicant(s)...`
                          : 'Select consultant from roster...'}
                      </span>
                    )}
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${consultantMenuOpen ? 'rotate-180' : ''
                        }`}
                    />
                  </button>

                  {consultantMenuOpen && (
                    <div className="absolute left-0 right-0 mt-1.5 z-30 bg-white border border-slate-200 rounded-xl popover-shadow overflow-hidden">
                      <div className="p-2 border-b border-slate-100 bg-slate-50/70">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            type="text"
                            value={consultantSearch}
                            onChange={(e) => setConsultantSearch(e.target.value)}
                            placeholder="Search name, title, or stage..."
                            autoFocus
                            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-brand-500"
                          />
                        </div>
                      </div>
                      <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
                        {form.candidateId && (
                          <button
                            type="button"
                            onClick={() => {
                              handleSelectCandidate('');
                              setConsultantMenuOpen(false);
                              setConsultantSearch('');
                            }}
                            className="w-full px-3.5 py-2 text-left text-[11px] font-semibold text-slate-500 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                            <span>Clear linked consultant (enter manually)</span>
                          </button>
                        )}
                        {filteredConsultants.length === 0 ? (
                          <div className="py-5 px-4 text-center text-[11px] text-slate-400">
                            {activeRequirement && consultantSource === 'submitted'
                              ? 'No unplaced submitted applicants. Switch to Full Roster above or enter manually.'
                              : 'No matching consultants found.'}
                          </div>
                        ) : (
                          filteredConsultants.map(({ candidate: c, stage }) => {
                            const isSelected = c.id === form.candidateId;
                            return (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => {
                                  handleSelectCandidate(c.id, c);
                                  setConsultantMenuOpen(false);
                                  setConsultantSearch('');
                                }}
                                className={`w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-2 transition-colors cursor-pointer ${isSelected ? 'bg-brand-50/70' : 'hover:bg-slate-50'
                                  }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <span className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-bold text-[11px] flex items-center justify-center shrink-0">
                                    {c.fullName.charAt(0).toUpperCase()}
                                  </span>
                                  <div className="min-w-0">
                                    <div className="text-xs font-semibold text-slate-900 truncate">
                                      {c.fullName}
                                    </div>
                                    {c.currentTitle && (
                                      <div className="text-[11px] text-slate-500 truncate">
                                        {c.currentTitle}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <StatusBadge stage={stage} size="xs" />
                                  {isSelected && <Check className="w-3.5 h-3.5 text-brand-600" />}
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-700">
                    Placed Consultant Name *
                  </label>
                  {isResourceInvalid && (
                    <span className="text-[11px] font-semibold text-rose-600">Required</span>
                  )}
                </div>
                <input
                  value={form.resourceName}
                  onChange={(e) => updateForm({ resourceName: e.target.value })}
                  placeholder="e.g. Anand Verma"
                  className={`w-full px-3 py-2 border rounded-lg text-xs font-bold text-slate-900 focus:outline-none ${isResourceInvalid
                    ? INVALID_FIELD_CLASSES
                    : 'border-slate-200 bg-white focus:border-brand-600'
                    }`}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Skill / Placement Role Title *
                </label>
                <input
                  value={form.skillRole}
                  onChange={(e) => updateForm({ skillRole: e.target.value })}
                  placeholder="e.g. Lead AWS Cloud Architect"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs font-medium text-slate-800 focus:border-brand-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Consultant Phone
                </label>
                <input
                  value={form.phone}
                  onChange={(e) => updateForm({ phone: e.target.value })}
                  placeholder="+1 (555) 019-2831"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs focus:border-brand-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Consultant Work Email
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => updateForm({ email: e.target.value })}
                  placeholder="consultant@client.com"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs focus:border-brand-600 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Client, Commercial Rates & Contract Terms */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 card-shadow space-y-4">
            <div className="font-semibold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-100 pb-3">
              <DollarSign className="w-4 h-4 text-brand-600" />
              <span>Client, rates &amp; SOW contract terms</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-700">
                    Client Customer Company *
                  </label>
                  {isCustomerInvalid && (
                    <span className="text-[11px] font-semibold text-rose-600">Required</span>
                  )}
                </div>
                <SearchableSelectInput
                  value={form.customer}
                  onChange={(val) => {
                    const selClient = clients.find(
                      (c) => stripClientLocation(c.name).toLowerCase() === val.trim().toLowerCase()
                    );
                    updateForm({
                      customer: val,
                      customerContact: selClient?.contacts?.[0]?.name || form.customerContact,
                    });
                  }}
                  options={clients.map((c) => ({
                    id: c.id,
                    label: stripClientLocation(c.name),
                    sublabel: c.location,
                  }))}
                  placeholder="Select or type client company..."
                  wrapperClassName=""
                  inputClassName={`w-full pl-3 pr-7 py-2 border rounded-lg text-xs font-semibold focus:outline-none ${isCustomerInvalid
                    ? INVALID_FIELD_CLASSES
                    : 'border-slate-200 bg-white focus:border-brand-600'
                    }`}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Customer Approver / Timesheet Contact
                </label>
                <input
                  value={form.customerContact}
                  onChange={(e) => updateForm({ customerContact: e.target.value })}
                  placeholder="e.g. Robert Vance (VP Global Infra)"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs font-medium focus:border-brand-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Client Bill Rate ({currencySymbol}/hr) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold">
                    {currencySymbol}
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.billRate}
                    onChange={(e) => updateForm({ billRate: e.target.value })}
                    placeholder="115"
                    className="w-full pl-7 pr-10 py-2 border border-slate-200 rounded-lg bg-white text-xs font-bold text-emerald-700 focus:border-brand-600 focus:outline-none"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400">
                    /hr
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Consultant Pay Rate ({currencySymbol}/hr) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold">
                    {currencySymbol}
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.payRate}
                    onChange={(e) => updateForm({ payRate: e.target.value })}
                    placeholder="85"
                    className="w-full pl-7 pr-10 py-2 border border-slate-200 rounded-lg bg-white text-xs font-bold text-slate-800 focus:border-brand-600 focus:outline-none"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400">
                    /hr
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Placement Model
                </label>
                <CustomSelect
                  value={form.placementType}
                  onChange={(val) => updateForm({ placementType: val })}
                  ariaLabel="Placement Contract Type"
                  size="sm"
                  options={['W2 Hourly', 'C2C Subcontractor', '1099', 'Full-Time']}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Deployment Model
                </label>
                <CustomSelect
                  value={form.deployment}
                  onChange={(val) => updateForm({ deployment: val })}
                  ariaLabel="Deployment Model"
                  size="sm"
                  options={[
                    { value: 'Onshore', label: 'Onshore (US Domestic)' },
                    { value: 'Nearshore', label: 'Nearshore' },
                    { value: 'Offshore', label: 'Offshore (Global)' },
                  ]}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Placing Recruiter
                </label>
                <CustomSelect
                  value={form.recruiter}
                  onChange={(val) => updateForm({ recruiter: val })}
                  ariaLabel="Placing Recruiter"
                  size="sm"
                  options={[
                    { value: '', label: 'Recruitment Desk' },
                    ...users.map((u) => ({ value: u.name, label: u.name })),
                  ]}
                />
              </div>
            </div>

            <div
              className={`grid grid-cols-1 ${form.placementType === 'C2C Subcontractor' ? 'sm:grid-cols-2' : ''
                } gap-4`}
            >
              {form.placementType === 'C2C Subcontractor' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Sub-Vendor Partner
                  </label>
                  <SearchableSelectInput
                    value={form.vendorName}
                    onChange={(val) => updateForm({ vendorName: val })}
                    options={vendors.map((v) => ({
                      id: v.id,
                      label: v.name,
                      sublabel: v.location,
                    }))}
                    placeholder="Select or type sub-vendor..."
                    wrapperClassName=""
                    inputClassName="w-full pl-3 pr-7 py-2 border border-slate-200 rounded-lg bg-white text-xs font-medium focus:border-brand-600 focus:outline-none"
                  />
                  {vendorComplianceWarning && (
                    <div className="mt-1.5 flex items-start gap-1.5 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <span>{vendorComplianceWarning}</span>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  PO / SOW Number{requirePoForPlacement ? ' *' : ''}
                </label>
                <input
                  ref={poInputRef}
                  type="text"
                  required={requirePoForPlacement}
                  value={form.purchaseOrderNumber}
                  onChange={(e) => {
                    updateForm({ purchaseOrderNumber: e.target.value });
                    if (poError && e.target.value.trim()) setPoError('');
                  }}
                  placeholder={
                    requirePoForPlacement ? 'e.g. PO-2026-8841 (Required)' : 'e.g. PO-2026-8841'
                  }
                  className={`w-full px-3 py-2 border rounded-lg bg-white text-xs focus:outline-none ${poError
                    ? 'border-rose-400 focus:border-rose-500 ring-1 ring-rose-200'
                    : 'border-slate-200 focus:border-brand-600'
                    }`}
                />
                {poError ? (
                  <p className="mt-1 text-[11px] font-medium text-rose-600">{poError}</p>
                ) : requirePoForPlacement ? (
                  <p className="mt-1 text-[11px] text-amber-700">
                    Required by workspace General Settings before activation.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Contract Start Date *
                </label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => updateForm({ startDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs focus:border-brand-600 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Projected End Date *
                </label>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => updateForm({ endDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs focus:border-brand-600 focus:outline-none"
                  required
                />
              </div>
            </div>

            <DynamicCustomFieldsSection
              entity="placement"
              values={customValues}
              onChange={setCustomValues}
              isOpen={true}
            />
          </div>
        </div>

        {/* Right: Sticky Commercial Summary Panel */}
        <div className="lg:col-span-4 space-y-4 lg:sticky lg:top-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 card-shadow space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 font-bold text-slate-900">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span>Commercial Margin Lock</span>
              </div>
              <span
                className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${marginBadgeClass}`}
              >
                {marginPct}% margin
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200/90 rounded-lg p-4 space-y-3">
              <div>
                <div className="text-[11px] font-medium text-slate-500">
                  Hourly Margin Spread
                </div>
                <div className="text-2xl font-extrabold text-emerald-700 mt-0.5 tabular-nums">
                  {spread >= 0
                    ? `+${currencySymbol}${spread.toFixed(2)}/hr`
                    : `-${currencySymbol}${Math.abs(spread).toFixed(2)}/hr`}
                </div>
              </div>
              <div className="pt-2.5 border-t border-slate-200 flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-600">
                  Est. Monthly Gross Profit (160h)
                </span>
                <span className="text-sm font-bold text-slate-900 tabular-nums">
                  {currencySymbol}
                  {monthlyGrossProfit.toLocaleString()}/mo
                </span>
              </div>
            </div>

            <dl className="space-y-2.5 text-xs pt-1">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">Consultant</dt>
                <dd className="font-semibold text-slate-900 truncate max-w-[190px]">
                  {form.resourceName.trim() || 'Not specified'}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">Client Account</dt>
                <dd className="font-semibold text-slate-900 truncate max-w-[190px]">
                  {form.customer.trim() || 'Not specified'}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">Contract Model</dt>
                <dd className="font-semibold text-slate-800">
                  {form.placementType} · {form.deployment}
                </dd>
              </div>
              {contractWeeks > 0 && (
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-slate-500">Term Duration</dt>
                  <dd className="font-semibold text-slate-800 tabular-nums">
                    ~{contractWeeks} weeks
                  </dd>
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">Assigned Recruiter</dt>
                <dd className="font-semibold text-slate-800">
                  {form.recruiter || 'Recruitment Desk'}
                </dd>
              </div>
            </dl>

            <div className="pt-3 border-t border-slate-100 space-y-2">
              <ActionButton
                type="submit"
                loading={isSubmitting}
                loadingText="Activating Placement..."
                disabled={isPositionsFull}
                icon={<Lock className="w-3.5 h-3.5" />}
                className="w-full py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold cursor-pointer"
              >
                {isPositionsFull
                  ? `All ${openPositions} Positions Filled`
                  : 'Confirm & Activate Placement'}
              </ActionButton>
              <button
                type="button"
                onClick={() => guardNavigation(onBack)}
                disabled={isSubmitting}
                className="w-full py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </form>

      <UnsavedChangesModal
        isOpen={showLeaveModal}
        onConfirmLeave={confirmLeave}
        onCancelLeave={cancelLeave}
      />
    </div>
  );
};
