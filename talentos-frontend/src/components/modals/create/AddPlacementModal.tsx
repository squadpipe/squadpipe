import React, { useState } from 'react';
import { BillablePlacement, Client, User } from '../../../types';

interface AddPlacementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (placement: BillablePlacement) => void;
  clients: Client[];
  users?: User[];
  showToast: (title: string, message: string, icon?: string) => void;
}

export const AddPlacementModal: React.FC<AddPlacementModalProps> = ({
  isOpen,
  onClose,
  onSave,
  clients,
  users = [],
  showToast,
}) => {
  const [form, setForm] = useState({
    resourceName: '',
    customer: clients[0]?.name || '',
    customerContact: clients[0]?.contacts[0]?.name || '',
    skillRole: '',
    deployment: 'Onshore',
    billing: '$115/hr',
    payRate: '$85/hr',
    recruiter: 'Marcus Brody',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
    phone: '',
    email: '',
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.resourceName.trim() || !form.customer.trim()) {
      showToast('Validation Error', 'Placed Consultant Resource and Client Company are required.', 'fa-solid fa-triangle-exclamation text-amber-500');
      return;
    }

    const billNum = parseInt(form.billing.replace(/\D/g, ''), 10) || 115;
    const payNum = parseInt(form.payRate.replace(/\D/g, ''), 10) || 85;
    const spread = billNum - payNum;
    const marginPct = billNum > 0 ? Number(((spread / billNum) * 100).toFixed(1)) : 0;

    const newPlacement: BillablePlacement = {
      id: 'place_' + Date.now(),
      resourceName: form.resourceName.trim(),
      customer: form.customer.trim(),
      customerContact: form.customerContact.trim() || 'Timesheet Approver',
      skillRole: form.skillRole.trim() || 'IT Specialist',
      deployment: form.deployment,
      billing: form.billing.includes('$') ? form.billing.trim() : `$${form.billing.trim()}/hr`,
      payRate: form.payRate.includes('$') ? form.payRate.trim() : `$${form.payRate.trim()}/hr`,
      recruiter: form.recruiter,
      startDate: form.startDate,
      endDate: form.endDate,
      phone: form.phone.trim() || '+1 (555) 019-2831',
      email: form.email.trim() || 'consultant@agency.com',
      hourlySpread: spread,
      marginPct,
    };

    onSave(newPlacement);
    showToast('Placement Activated', `Active deployment started for ${newPlacement.resourceName}!`, 'fa-solid fa-circle-check text-emerald-500');
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
              <i className="fa-solid fa-file-invoice-dollar text-sm"></i>
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Create Billable Placement Record</span>
                <span className="text-[10px] font-mono font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.2 rounded">
                  Active Deployment
                </span>
              </h2>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Activate active consultant project, client billing rates, timesheet manager, and contract dates.
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white w-7 h-7 rounded flex items-center justify-center text-sm transition-colors"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Modal Body Form */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 overflow-y-auto space-y-4 text-xs flex-1">
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
                <select
                  value={form.customer}
                  onChange={(e) => {
                    const selClient = clients.find((c) => c.name === e.target.value);
                    setForm({
                      ...form,
                      customer: e.target.value,
                      customerContact: selClient?.contacts[0]?.name || '',
                    });
                  }}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs font-semibold focus:border-brand-600"
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Deployment Location</label>
                <select
                  value={form.deployment}
                  onChange={(e) => setForm({ ...form, deployment: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs font-medium focus:border-brand-600"
                >
                  <option value="Onshore">Onshore (US)</option>
                  <option value="Offshore">Offshore (Global)</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Client Billing Rate *</label>
                <input
                  value={form.billing}
                  onChange={(e) => setForm({ ...form, billing: e.target.value })}
                  placeholder="$115/hr"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs font-mono font-bold text-emerald-700 focus:border-brand-600 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Placing Recruiter</label>
                <select
                  value={form.recruiter}
                  onChange={(e) => setForm({ ...form, recruiter: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs font-medium focus:border-brand-600"
                >
                  {users.length > 0 ? (
                    users.map((u) => (
                      <option key={u.id} value={u.name}>
                        {u.name}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="Marcus Brody">Marcus Brody</option>
                      <option value="Sarah Jenkins">Sarah Jenkins</option>
                      <option value="Elena Rostova">Elena Rostova</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Assignment Start Date *</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs font-mono focus:border-brand-600"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Projected End Date *</label>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs font-mono focus:border-brand-600"
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
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs font-mono focus:border-brand-600"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Consultant Work Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="anand.verma@pfizer.com"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs focus:border-brand-600"
                />
              </div>
            </div>
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
              <i className="fa-solid fa-check text-[11px]"></i>
              <span>Activate Billable Placement</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

