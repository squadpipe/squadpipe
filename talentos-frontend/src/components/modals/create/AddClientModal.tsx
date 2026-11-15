import React, { useState, useEffect } from 'react';
import { Building2, Plus, X } from 'lucide-react';
import { Client } from '../../../types';
import { DynamicCustomFieldsSection } from '../../shared/DynamicCustomFieldsSection';

import { ActionButton } from '../../shared/ActionButton';

interface AddClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (client: Client) => Promise<void> | void;
  showToast: (title: string, message: string, icon?: string) => void;
}

const INITIAL_CLIENT_FORM = {
  name: '',
  website: 'https://',
  location: '',
  phone: '',
  contactName: '',
  designation: '',
  email: '',
  directPhone: '',
};

export const AddClientModal: React.FC<AddClientModalProps> = ({
  isOpen,
  onClose,
  onSave,
  showToast,
}) => {
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({ ...INITIAL_CLIENT_FORM });

  useEffect(() => {
    if (isOpen) {
      setForm({ ...INITIAL_CLIENT_FORM });
      setCustomValues({});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    if (!form.name.trim() || !form.location.trim() || !form.contactName.trim() || !form.email.trim()) {
      showToast('Validation Error', 'Company Name, HQ Location, Contact Name, and Email are required.', 'fa-solid fa-triangle-exclamation text-amber-500');
      return;
    }

    const newClient: Client = {
      id: 'cli_' + Date.now(),
      name: form.name.trim(),
      website: form.website.trim() || 'https://company.com',
      boardNumber: form.phone.trim() || '+1 (800) 000-0000',
      location: form.location.trim(),
      contacts: [
        {
          name: form.contactName.trim(),
          designation: form.designation.trim() || 'Hiring Lead',
          email: form.email.trim(),
          phone: form.directPhone.trim() || form.phone.trim() || '+1 (800) 000-0000',
          isPrimary: true,
        },
      ],
      customFields: customValues,
    };

    setIsSaving(true);
    try {
      await onSave(newClient);
      setForm({ ...INITIAL_CLIENT_FORM });
      setCustomValues({});
      showToast('Client Registered', `${newClient.name} account registered under active MSA!`, 'fa-solid fa-circle-check text-brand-600');
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden flex flex-col animate-fade-in max-h-[92vh]"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-[#141615] text-white">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white flex-shrink-0">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">
                Register New Client Account
              </h2>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Add enterprise client account, headquarters location, and primary hiring manager.
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="text-slate-400 hover:text-white w-7 h-7 rounded flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body Form */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 overflow-y-auto space-y-4 text-xs flex-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Company Legal Name *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Morgan Stanley Tech"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs font-medium focus:border-brand-600 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Company Website</label>
                <input
                  value={form.website}
                  onChange={(e) => setForm({ ...form, website: e.target.value })}
                  placeholder="https://morganstanley.com"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs focus:border-brand-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Headquarters Location *</label>
                <input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="e.g. New York, NY"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs focus:border-brand-600 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Main Board Phone</label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+1 (212) 761-4000"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs focus:border-brand-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <div className="text-[11px] font-bold text-slate-800 uppercase tracking-wider mb-2">
                Primary Hiring Contact
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Contact Person Name *</label>
                  <input
                    value={form.contactName}
                    onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                    placeholder="e.g. Brian O'Connor"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs font-medium focus:border-brand-600 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Official Designation</label>
                  <input
                    value={form.designation}
                    onChange={(e) => setForm({ ...form, designation: e.target.value })}
                    placeholder="e.g. Director of Engineering"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs focus:border-brand-600 focus:outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Contact Email *</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="brian.oc@morganstanley.com"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs focus:border-brand-600 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Direct Extension / Phone</label>
                  <input
                    value={form.directPhone}
                    onChange={(e) => setForm({ ...form, directPhone: e.target.value })}
                    placeholder="+1 (212) 761-4120"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs focus:border-brand-600 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <DynamicCustomFieldsSection
              entity="client"
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
              loadingText="Saving Client..."
              icon={<Plus className="w-3.5 h-3.5" strokeWidth={2.4} />}
              className="px-5 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              Save & Register Client Account
            </ActionButton>
          </div>
        </form>
      </div>
    </div>
  );
};

