import React, { useState, useEffect } from 'react';
import { DollarSign, X, Check, UserCheck, Briefcase, TrendingUp } from 'lucide-react';
import { BillablePlacement, Candidate, Client, Requirement, User, Vendor } from '../../../types';
import { DynamicCustomFieldsSection } from '../../shared/DynamicCustomFieldsSection';

interface AddPlacementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (placement: BillablePlacement) => void;
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
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
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
    billing: '$115/hr',
    payRate: '$85/hr',
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
        billing: '$115/hr',
        payRate: '$85/hr',
        recruiter: users[0]?.name || '',
        ...getDefaultDates(),
        phone: '',
        email: '',
      });
      setCustomValues({});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const parseRateNum = (val: string, fallback = 0) => {
    const n = parseFloat(String(val || '').replace(/[^0-9.]/g, ''));
    return isNaN(n) ? fallback : n;
  };

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
    setForm((prev) => ({
      ...prev,
      candidateId: c.id,
      resourceName: c.fullName,
      skillRole: prev.skillRole || c.currentTitle || '',
      payRate: parsedPay > 0 ? `$${parsedPay}/hr` : prev.payRate,
      phone: c.phone || prev.phone,
      email: c.email || prev.email,
      recruiter: c.assignedRecruiter || prev.recruiter,
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
      billing: r.targetBillRate ? `$${r.targetBillRate}/hr` : prev.billing,
      payRate: r.targetPayRate ? `$${r.targetPayRate}/hr` : prev.payRate,
      recruiter: r.assignedRecruiter || prev.recruiter,
    }));
  };

  const formatRateStr = (val: string, fallback: number) => {
    const n = parseRateNum(val, fallback);
    return `$${n}/hr`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.resourceName.trim() || !form.customer.trim()) {
      showToast(
        'Validation Error',
        'Placed Consultant Resource and Client Company are required.',
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

    onSave(newPlacement);
    setCustomValues({});
    showToast(
      'Placement Activated',
      `Active deployment started for ${newPlacement.resourceName}!`,
      'fa-solid fa-circle-check text-emerald-500'
    );
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col animate-fade-in max-h-[92vh]"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white flex-shrink-0">
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
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 overflow-y-auto space-y-4 text-xs flex-1">
            {/* Quick Auto-Fill Bar */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 mb-1">
                  <UserCheck className="w-3.5 h-3.5 text-brand-600" />
                  <span>Select Consultant from Roster</span>
                </label>
                <select
                  value={form.candidateId}
                  onChange={(e) => handleSelectCandidate(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-xs text-slate-700 focus:border-brand-600 focus:outline-none cursor-pointer"
                >
                  <option value="">-- Optional: auto-fill from roster --</option>
                  {candidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName} — {c.currentTitle} ({c.pipelineStage})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 mb-1">
                  <Briefcase className="w-3.5 h-3.5 text-brand-600" />
                  <span>Link Requisition (Optional)</span>
                </label>
                <select
                  value={form.requirementId}
                  onChange={(e) => handleSelectRequirement(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-xs text-slate-700 focus:border-brand-600 focus:outline-none cursor-pointer"
                >
                  <option value="">-- Optional: auto-fill from requisition --</option>
                  {requirements.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.code} — {r.opportunityTitle} ({r.companyName})
                    </option>
                  ))}
                </select>
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
                      {spread >= 0 ? `+$${spread.toFixed(2)}/hr` : `-$${Math.abs(spread).toFixed(2)}/hr`}
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
                  ${monthlyGrossProfit.toLocaleString()}/mo
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Placed Consultant Resource *</label>
                <input
                  value={form.resourceName}
                  onChange={(e) => setForm({ ...form, resourceName: e.target.value })}
                  placeholder="e.g. Anand Verma"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs font-bold text-slate-900 focus:border-brand-600 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Client Customer Company *</label>
                <input
                  list="placement-clients-list"
                  value={form.customer}
                  onChange={(e) => {
                    const val = e.target.value;
                    const selClient = clients.find((c) => c.name === val);
                    setForm({
                      ...form,
                      customer: val,
                      customerContact: selClient?.contacts[0]?.name || form.customerContact,
                    });
                  }}
                  placeholder="Select or type client company name..."
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs font-semibold focus:border-brand-600 focus:outline-none"
                  required
                />
                <datalist id="placement-clients-list">
                  {clients.map((c) => (
                    <option key={c.id} value={c.name} />
                  ))}
                </datalist>
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
                  placeholder="$115/hr"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs font-bold text-emerald-700 focus:border-brand-600 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Consultant Pay Rate *</label>
                <input
                  value={form.payRate}
                  onChange={(e) => setForm({ ...form, payRate: e.target.value })}
                  placeholder="$85/hr"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs font-bold text-slate-800 focus:border-brand-600 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Placement Model</label>
                <select
                  value={form.placementType}
                  onChange={(e) => setForm({ ...form, placementType: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs font-medium focus:border-brand-600 cursor-pointer"
                >
                  <option value="C2C Subcontractor">C2C Subcontractor</option>
                  <option value="W2 Hourly">W2 Hourly</option>
                  <option value="1099">1099</option>
                  <option value="Full-Time">Full-Time</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Deployment Location</label>
                <select
                  value={form.deployment}
                  onChange={(e) => setForm({ ...form, deployment: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs font-medium focus:border-brand-600 cursor-pointer"
                >
                  <option value="Onshore">Onshore (US)</option>
                  <option value="Nearshore">Nearshore</option>
                  <option value="Offshore">Offshore (Global)</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Placing Recruiter</label>
                <select
                  value={form.recruiter}
                  onChange={(e) => setForm({ ...form, recruiter: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs font-medium focus:border-brand-600 cursor-pointer"
                >
                  <option value="">Recruitment Desk</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.name}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className={`grid grid-cols-1 ${form.placementType === 'C2C Subcontractor' ? 'sm:grid-cols-2' : ''} gap-3.5`}>
              {form.placementType === 'C2C Subcontractor' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Sub-Vendor Partner</label>
                  <input
                    list="placement-vendors-list"
                    value={form.vendorName}
                    onChange={(e) => setForm({ ...form, vendorName: e.target.value })}
                    placeholder="Select or type sub-vendor..."
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs font-medium focus:border-brand-600 focus:outline-none"
                  />
                  <datalist id="placement-vendors-list">
                    {vendors.map((v) => (
                      <option key={v.id} value={v.name} />
                    ))}
                  </datalist>
                </div>
              )}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">PO / SOW Number</label>
                <input
                  value={form.purchaseOrderNumber}
                  onChange={(e) => setForm({ ...form, purchaseOrderNumber: e.target.value })}
                  placeholder="e.g. PO-2026-8841"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs focus:border-brand-600 focus:outline-none"
                />
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
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-white text-xs font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Activate Billable Placement</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
