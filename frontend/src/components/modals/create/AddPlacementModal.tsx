import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, DollarSign, X, Check, UserCheck, Briefcase, TrendingUp } from 'lucide-react';
import { BillablePlacement, Candidate, Client, Requirement, User, Vendor } from '../../../types';
import { DynamicCustomFieldsSection } from '../../shared/DynamicCustomFieldsSection';
import { inferPlacementTypeFromRate, parseRateNumber, useCurrency } from '../../../utils/currency';
import { initWorkspaceBrand, useWorkspacePolicies } from '../../../utils/workspaceBrand';
import { SearchableSelectInput } from '../../shared/SearchableSelectInput';
import { CustomSelect } from '../../shared/CustomSelect';
import { ActionButton } from '../../shared/ActionButton';
import { getVendorComplianceWarning } from '../../../features/billable/placementUtils';
import { AnimatedModal } from '../../shared/MotionPrimitives';
import {
  formatMissingFieldsMessage,
  getMissingFieldLabels,
  INVALID_FIELD_CLASSES,
} from '../../../utils/formValidation';

interface AddPlacementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (placement: BillablePlacement) => Promise<void> | void;
  clients: Client[];
  users?: User[];
  candidates?: Candidate[];
  vendors?: Vendor[];
  requirements?: Requirement[];
  showToast: (title: string, message: string, icon?: string) => void;
}

const getDefaultDates = () => ({
  startDate: new Date().toISOString().split('T')[0],
  endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
});

export const AddPlacementModal: React.FC<AddPlacementModalProps> = ({
  isOpen,
  onClose,
  onSave,
  clients,
  users = [],
  candidates = [],
  vendors = [],
  requirements = [],
  showToast,
}) => {
  const { symbol: currencySymbol } = useCurrency();
  const { requirePoForPlacement } = useWorkspacePolicies();
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [poError, setPoError] = useState('');
  const poInputRef = useRef<HTMLInputElement | null>(null);
  const [form, setForm] = useState({
    candidateId: '',
    requirementId: '',
    resourceName: '',
    customer: clients[0]?.name || '',
    customerContact: clients[0]?.contacts[0]?.name || '',
    skillRole: '',
    deployment: 'Onshore',
    placementType: 'C2C Subcontractor',
    vendorName: '',
    purchaseOrderNumber: '',
    billing: `${currencySymbol}115/hr`,
    payRate: `${currencySymbol}85/hr`,
    recruiter: users[0]?.name || '',
    ...getDefaultDates(),
    phone: '',
    email: '',
  });

  useEffect(() => {
    if (isOpen) {
      setForm({
        candidateId: '',
        requirementId: '',
        resourceName: '',
        customer: clients[0]?.name || '',
        customerContact: clients[0]?.contacts[0]?.name || '',
        skillRole: '',
        deployment: 'Onshore',
        placementType: 'C2C Subcontractor',
        vendorName: '',
        purchaseOrderNumber: '',
        billing: `${currencySymbol}115/hr`,
        payRate: `${currencySymbol}85/hr`,
        recruiter: users[0]?.name || '',
        ...getDefaultDates(),
        phone: '',
        email: '',
      });
      setCustomValues({});
      setPoError('');
      setValidationAttempted(false);
      void initWorkspaceBrand(true);
    } else {
      setPoError('');
      setValidationAttempted(false);
    }
  }, [isOpen, currencySymbol]);

  const parseRateNum = (val: string, fallback = 0) => parseRateNumber(val, fallback);

  const billNum = parseRateNum(form.billing, 0);
  const payNum = parseRateNum(form.payRate, 0);
  const spread = billNum - payNum;
  const marginPct = billNum > 0 ? Number(((spread / billNum) * 100).toFixed(1)) : 0;
  const monthlyGrossProfit = Math.round(spread * 160);

  const marginBadgeClass =
    marginPct >= 20
      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
      : marginPct >= 10
      ? 'bg-amber-100 text-amber-800 border-amber-200'
      : 'bg-rose-100 text-rose-800 border-rose-200';

  const handleSelectCandidate = (candidateId: string) => {
    const c = candidates.find((item) => item.id === candidateId);
    if (!c) {
      setForm((prev) => ({ ...prev, candidateId: '' }));
      return;
    }
    const parsedPay = parseRateNum(c.hourlyRate || '', 0);
    const candVendor =
      (c.vendorId ? vendors.find((v) => v.id === c.vendorId) : undefined) ||
      (c.vendorName ? { name: c.vendorName } : undefined);
    setForm((prev) => ({
      ...prev,
      candidateId: c.id,
      resourceName: c.fullName,
      skillRole: prev.skillRole || c.currentTitle || '',
      payRate: parsedPay > 0 ? `${currencySymbol}${parsedPay}/hr` : prev.payRate,
      phone: c.phone || prev.phone,
      email: c.email || prev.email,
      recruiter: c.assignedRecruiter || prev.recruiter,
      placementType: candVendor
        ? 'C2C Subcontractor'
        : inferPlacementTypeFromRate(c.hourlyRate) || prev.placementType,
      vendorName: candVendor ? candVendor.name : prev.vendorName,
    }));
  };

  const handleSelectRequirement = (requirementId: string) => {
    const r = requirements.find((item) => item.id === requirementId);
    if (!r) {
      setForm((prev) => ({ ...prev, requirementId: '' }));
      return;
    }
    const matchedClient = clients.find((c) => c.name.toLowerCase() === r.companyName.toLowerCase());
    setForm((prev) => ({
      ...prev,
      requirementId: r.id,
      customer: r.companyName || prev.customer,
      customerContact: r.clientContact || matchedClient?.contacts[0]?.name || prev.customerContact,
      skillRole: r.opportunityTitle || prev.skillRole,
      billing: r.targetBillRate ? `${currencySymbol}${r.targetBillRate}/hr` : prev.billing,
      payRate: r.targetPayRate ? `${currencySymbol}${r.targetPayRate}/hr` : prev.payRate,
      recruiter: r.assignedRecruiter || prev.recruiter,
    }));
  };

  const formatRateStr = (val: string, fallback: number) => {
    const n = parseRateNum(val, fallback);
    return `${currencySymbol}${n}/hr`;
  };

  const [validationAttempted, setValidationAttempted] = useState(false);

  const isResourceInvalid = validationAttempted && !form.resourceName.trim();
  const isCustomerInvalid = validationAttempted && !form.customer.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    const missingFields = getMissingFieldLabels([
      { label: 'Placed Consultant Resource', valid: Boolean(form.resourceName.trim()) },
      { label: 'Client Company', valid: Boolean(form.customer.trim()) },
    ]);
    if (missingFields.length > 0) {
      setValidationAttempted(true);
      showToast(
        'Validation Error',
        formatMissingFieldsMessage(missingFields),
        'fa-solid fa-triangle-exclamation text-amber-500'
      );
      return;
    }
    if (requirePoForPlacement && !form.purchaseOrderNumber.trim()) {
      setPoError('PO / SOW Number is required by workspace General Settings.');
      poInputRef.current?.focus();
      showToast(
        'PO Number Required',
        'Please enter a PO / SOW Number before activating this placement.',
        'fa-solid fa-triangle-exclamation text-amber-500'
      );
      return;
    }

    const finalBill = parseRateNum(form.billing, 115);
    const finalPay = parseRateNum(form.payRate, 85);
    const finalSpread = finalBill - finalPay;
    const finalMargin = finalBill > 0 ? Number(((finalSpread / finalBill) * 100).toFixed(2)) : 0;

    const matchedClient = clients.find((c) => c.name.toLowerCase() === form.customer.trim().toLowerCase());
    const matchedVendor = vendors.find((v) => v.name.toLowerCase() === form.vendorName.trim().toLowerCase());

    const newPlacement: BillablePlacement = {
      id: 'place_' + Date.now(),
      candidateId: form.candidateId || undefined,
      requirementId: form.requirementId || undefined,
      clientId: matchedClient?.id,
      vendorId: matchedVendor?.id,
      vendorName: form.placementType === 'C2C Subcontractor' ? form.vendorName.trim() || undefined : undefined,
      purchaseOrderNumber: form.purchaseOrderNumber.trim() || undefined,
      resourceName: form.resourceName.trim(),
      customer: form.customer.trim(),
      customerContact: form.customerContact.trim() || 'Timesheet Approver',
      skillRole: form.skillRole.trim() || 'IT Specialist',
      deployment: form.deployment,
      placementType: form.placementType,
      billing: formatRateStr(form.billing, 115),
      payRate: formatRateStr(form.payRate, 85),
      recruiter: form.recruiter,
      startDate: form.startDate,
      endDate: form.endDate,
      phone: form.phone.trim() || '',
      email: form.email.trim() || '',
      hourlySpread: finalSpread,
      marginPct: finalMargin,
      status: 'Active',
      customFields: customValues,
    };

    setIsSaving(true);
    try {
      await onSave(newPlacement);
      setCustomValues({});
      showToast(
        'Placement Activated',
        `Active deployment started for ${newPlacement.resourceName}!`,
        'fa-solid fa-circle-check text-emerald-500'
      );
      onClose();
    } catch {
      // Error toast is already displayed by the parent handler
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatedModal
      isOpen={isOpen}
      onBackdropClick={onClose}
      zIndexClass="z-50"
      backdropClassName="bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 select-none"
      panelClassName="bg-white rounded-xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
      ariaLabel="Create Billable Placement Record"
    >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-[#141615] text-white">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white flex-shrink-0">
              <DollarSign className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">
                Create Billable Placement Record
              </h2>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Link a consultant & requisition, lock bill/pay margin spread, and set contract dates.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white w-7 h-7 rounded flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body Form */}
        <form noValidate onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 overflow-y-auto space-y-4 text-xs flex-1">
            {/* Quick Auto-Fill Bar */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 mb-1">
                  <UserCheck className="w-3.5 h-3.5 text-brand-600" />
                  <span>Select Consultant from Roster</span>
                </label>
                <CustomSelect
                  value={form.candidateId}
                  onChange={handleSelectCandidate}
                  ariaLabel="Select Consultant from Roster"
                  size="sm"
                  options={[
                    { value: '', label: '-- Optional: auto-fill from roster --' },
                    ...candidates.map((c) => ({
                      value: c.id,
                      label: `${c.fullName} — ${c.currentTitle} (${c.pipelineStage})`,
                    })),
                  ]}
                />
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 mb-1">
                  <Briefcase className="w-3.5 h-3.5 text-brand-600" />
                  <span>Link Requisition (Optional)</span>
                </label>
                <CustomSelect
                  value={form.requirementId}
                  onChange={handleSelectRequirement}
                  ariaLabel="Link Requisition"
                  size="sm"
                  options={[
                    { value: '', label: '-- Optional: auto-fill from requisition --' },
                    ...requirements.map((r) => ({
                      value: r.id,
                      label: `${r.code} — ${r.opportunityTitle} (${r.companyName})`,
                    })),
                  ]}
                />
              </div>
            </div>

            {/* Live Commercial Margin & Spread Banner */}
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Hourly Margin Spread</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-base font-extrabold text-emerald-700">
                      {spread >= 0 ? `+${currencySymbol}${spread.toFixed(2)}/hr` : `-${currencySymbol}${Math.abs(spread).toFixed(2)}/hr`}
                    </span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${marginBadgeClass}`}>
                      {marginPct}% margin
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Est. Monthly Gross Profit</div>
                <div className="text-base font-extrabold text-emerald-700 mt-0.5">
                  {currencySymbol}{monthlyGrossProfit.toLocaleString()}/mo
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-slate-700">Placed Consultant Resource *</label>
                  {isResourceInvalid && <span className="text-[10px] font-semibold text-rose-600">Required</span>}
                </div>
                <input
                  value={form.resourceName}
                  onChange={(e) => setForm({ ...form, resourceName: e.target.value })}
                  placeholder="e.g. Anand Verma"
                  className={`w-full px-3 py-1.5 border rounded-lg text-xs font-bold text-slate-900 focus:outline-none ${
                    isResourceInvalid ? INVALID_FIELD_CLASSES : 'border-slate-200 bg-white focus:border-brand-600'
                  }`}
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-slate-700">Client Customer Company *</label>
                  {isCustomerInvalid && <span className="text-[10px] font-semibold text-rose-600">Required</span>}
                </div>
                <SearchableSelectInput
                  value={form.customer}
                  onChange={(val) => {
                    const selClient = clients.find(
                      (c) => c.name.trim().toLowerCase() === val.trim().toLowerCase()
                    );
                    setForm({
                      ...form,
                      customer: val,
                      customerContact: selClient?.contacts[0]?.name || form.customerContact,
                    });
                  }}
                  options={clients.map((c) => ({
                    id: c.id,
                    label: c.name.replace(/\s+Location:\s*.*$/i, '').trim(),
                    sublabel: c.location,
                  }))}
                  placeholder="Select or type client company name..."
                  wrapperClassName=""
                  inputClassName={`w-full pl-3 pr-7 py-1.5 border rounded-lg text-xs font-semibold focus:outline-none ${
                    isCustomerInvalid ? INVALID_FIELD_CLASSES : 'border-slate-200 bg-white focus:border-brand-600'
                  }`}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Customer Timesheet Approver *</label>
                <input
                  value={form.customerContact}
                  onChange={(e) => setForm({ ...form, customerContact: e.target.value })}
                  placeholder="e.g. Robert Vance (VP Global Infra)"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs font-medium focus:border-brand-600 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Skill / Placement Role Title *</label>
                <input
                  value={form.skillRole}
                  onChange={(e) => setForm({ ...form, skillRole: e.target.value })}
                  placeholder="e.g. Lead AWS Cloud Architect"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs font-medium focus:border-brand-600 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Client Bill Rate *</label>
                <input
                  value={form.billing}
                  onChange={(e) => setForm({ ...form, billing: e.target.value })}
                  placeholder={`${currencySymbol}115/hr`}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs font-bold text-emerald-700 focus:border-brand-600 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Consultant Pay Rate *</label>
                <input
                  value={form.payRate}
                  onChange={(e) => setForm({ ...form, payRate: e.target.value })}
                  placeholder={`${currencySymbol}85/hr`}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs font-bold text-slate-800 focus:border-brand-600 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Placement Model</label>
                <CustomSelect
                  value={form.placementType}
                  onChange={(val) => setForm({ ...form, placementType: val })}
                  ariaLabel="Placement Model"
                  size="sm"
                  options={['C2C Subcontractor', 'W2 Hourly', '1099', 'Full-Time']}
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Deployment Location</label>
                <CustomSelect
                  value={form.deployment}
                  onChange={(val) => setForm({ ...form, deployment: val })}
                  ariaLabel="Deployment Location"
                  size="sm"
                  options={[
                    { value: 'Onshore', label: 'Onshore (US)' },
                    { value: 'Nearshore', label: 'Nearshore' },
                    { value: 'Offshore', label: 'Offshore (Global)' },
                  ]}
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Placing Recruiter</label>
                <CustomSelect
                  value={form.recruiter}
                  onChange={(val) => setForm({ ...form, recruiter: val })}
                  ariaLabel="Placing Recruiter"
                  size="sm"
                  options={[
                    { value: '', label: 'Recruitment Desk' },
                    ...users.map((u) => ({ value: u.name, label: u.name })),
                  ]}
                />
              </div>
            </div>

            <div className={`grid grid-cols-1 ${form.placementType === 'C2C Subcontractor' ? 'sm:grid-cols-2' : ''} gap-3.5`}>
              {form.placementType === 'C2C Subcontractor' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Sub-Vendor Partner</label>
                  <SearchableSelectInput
                    value={form.vendorName}
                    onChange={(val) => setForm({ ...form, vendorName: val })}
                    options={vendors.map((v) => ({
                      id: v.id,
                      label: v.name,
                      sublabel: v.location,
                    }))}
                    placeholder="Select or type sub-vendor..."
                    wrapperClassName=""
                    inputClassName="w-full pl-3 pr-7 py-1.5 border border-slate-200 rounded-lg bg-white text-xs font-medium focus:border-brand-600 focus:outline-none"
                  />
                  {(() => {
                    const selectedVen = vendors.find(
                      (v) => v.name.trim().toLowerCase() === form.vendorName.trim().toLowerCase()
                    );
                    const warning = getVendorComplianceWarning(selectedVen);
                    return warning ? (
                      <div className="mt-1.5 flex items-start gap-1.5 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                        <span>{warning}</span>
                      </div>
                    ) : null;
                  })()}
                </div>
              )}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  PO / SOW Number{requirePoForPlacement ? ' *' : ''}
                </label>
                <input
                  ref={poInputRef}
                  value={form.purchaseOrderNumber}
                  onChange={(e) => {
                    setForm({ ...form, purchaseOrderNumber: e.target.value });
                    if (poError && e.target.value.trim()) setPoError('');
                  }}
                  placeholder={requirePoForPlacement ? 'e.g. PO-2026-8841 (Required)' : 'e.g. PO-2026-8841'}
                  className={`w-full px-3 py-1.5 border rounded-lg bg-white text-xs focus:outline-none ${
                    poError
                      ? 'border-rose-400 focus:border-rose-500 ring-1 ring-rose-200'
                      : 'border-slate-200 focus:border-brand-600'
                  }`}
                />
                {poError ? (
                  <p className="mt-1 text-[11px] font-medium text-rose-600">{poError}</p>
                ) : requirePoForPlacement ? (
                  <p className="mt-1 text-[10px] text-amber-700">Required by General Settings before activation.</p>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Assignment Start Date *</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs focus:border-brand-600"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Projected End Date *</label>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs focus:border-brand-600"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Consultant Phone</label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+1 (555) 019-2831"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs focus:border-brand-600"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Consultant Work Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="consultant@client.com"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs focus:border-brand-600"
                />
              </div>
            </div>

            <DynamicCustomFieldsSection
              entity="placement"
              values={customValues}
              onChange={setCustomValues}
              isOpen={isOpen}
            />
          </div>

          {/* Modal Footer */}
          <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
            <button
              type="button"
              disabled={isSaving}
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-white disabled:opacity-60 text-xs font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <ActionButton
              type="submit"
              loading={isSaving}
              loadingText="Activating..."
              icon={<Check className="w-3.5 h-3.5" />}
              className="px-5 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              Activate Billable Placement
            </ActionButton>
          </div>
        </form>
    </AnimatedModal>
  );
};
