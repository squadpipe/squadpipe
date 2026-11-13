import React, { useState } from 'react';
import { Vendor } from '../../../types';

interface AddVendorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (vendor: Vendor) => void;
  showToast: (title: string, message: string, icon?: string) => void;
}

export const AddVendorModal: React.FC<AddVendorModalProps> = ({
  isOpen,
  onClose,
  onSave,
  showToast,
}) => {
  const [form, setForm] = useState({
    name: '',
    location: '',
    contactName: '',
    phone: '',
    email: '',
    skillSpecialization: '',
    paymentTerms: 'Net 30',
    msa: 'Yes',
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.contactName.trim() || !form.email.trim()) {
      showToast('Validation Error', 'Vendor Agency Name, Contact Person, and Email are required.', 'fa-solid fa-triangle-exclamation text-amber-500');
      return;
    }

    const newVendor: Vendor = {
      id: 'ven_' + Date.now(),
      name: form.name.trim(),
      location: form.location.trim() || 'US Nationwide',
      contactName: form.contactName.trim(),
      phone: form.phone.trim() || '+1 (555) 000-0000',
      email: form.email.trim(),
      skillSpecialization: form.skillSpecialization.trim() || 'IT & Cloud Staffing',
      paymentTerms: form.paymentTerms,
      invoicingTerms: 'Bi-weekly',
      msa: form.msa === 'Yes' ? 'Active' : 'Pending',
    };

    onSave(newVendor);
    showToast('Vendor Onboarded', `${newVendor.name} added to vendor network!`, 'fa-solid fa-circle-check text-amber-500');
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
            <div className="w-8 h-8 rounded-lg bg-amber-600 flex items-center justify-center text-white flex-shrink-0">
              <i className="fa-solid fa-handshake text-sm"></i>
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Register Staffing Vendor Partner</span>
                <span className="text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.2 rounded">
                  Sub-Tier Partner
                </span>
              </h2>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Onboard external staffing agency, partner contact, candidate specializations, and payment terms.
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
                <label className="block font-semibold text-slate-700 mb-1">Vendor Agency Name *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. CloudSync Global Corp"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs font-medium focus:border-brand-600 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Headquarters Location *</label>
                <input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="e.g. Dallas, TX"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs focus:border-brand-600 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Partner Contact Person *</label>
                <input
                  value={form.contactName}
                  onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                  placeholder="e.g. Sandeep Reddy"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs font-medium focus:border-brand-600 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Contact Phone</label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+1 (469) 555-9011"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs focus:border-brand-600 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Contact Email Address *</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="sandeep@cloudsync.com"
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs focus:border-brand-600 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Candidate Specialization Niche *</label>
              <input
                value={form.skillSpecialization}
                onChange={(e) => setForm({ ...form, skillSpecialization: e.target.value })}
                placeholder="e.g. AWS Cloud Architects, Java Microservices, Data Science"
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs font-medium focus:border-brand-600 focus:outline-none"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Payment Terms</label>
                <select
                  value={form.paymentTerms}
                  onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs font-medium focus:border-brand-600"
                >
                  <option value="Net 30">Net 30 Days</option>
                  <option value="Net 45">Net 45 Days</option>
                  <option value="Net 15">Net 15 Days</option>
                  <option value="Net 60">Net 60 Days</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Subcontractor MSA Agreement</label>
                <select
                  value={form.msa}
                  onChange={(e) => setForm({ ...form, msa: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs font-medium focus:border-brand-600"
                >
                  <option value="Yes">Yes (Executed & Active)</option>
                  <option value="No">No (Pending Legal Review)</option>
                </select>
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
              className="px-5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <i className="fa-solid fa-plus text-[10px]"></i>
              <span>Save & Register Vendor Partner</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

