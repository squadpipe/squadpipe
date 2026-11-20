import React, { useState, useEffect } from 'react';
import { Building2, Plus } from 'lucide-react';
import { Client } from '../../../types';
import { DynamicCustomFieldsSection } from '../../shared/DynamicCustomFieldsSection';

import { ActionButton } from '../../shared/ActionButton';
import { AnimatedModal, ModalHeader } from '../../shared/MotionPrimitives';
import {
  formatMissingFieldsMessage,
  getMissingFieldLabels,
  INVALID_FIELD_CLASSES,
} from '../../../utils/formValidation';

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
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [form, setForm] = useState({ ...INITIAL_CLIENT_FORM });

  useEffect(() => {
    if (isOpen) {
      setForm({ ...INITIAL_CLIENT_FORM });
      setCustomValues({});
      setValidationAttempted(false);
    }
  }, [isOpen]);

  const isNameInvalid = validationAttempted && !form.name.trim();
  const isLocationInvalid = validationAttempted && !form.location.trim();
  const isContactInvalid = validationAttempted && !form.contactName.trim();
  const isEmailInvalid = validationAttempted && !form.email.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    const missingFields = getMissingFieldLabels([
      { label: 'Company Name', valid: Boolean(form.name.trim()) },
      { label: 'HQ Location', valid: Boolean(form.location.trim()) },
      { label: 'Contact Name', valid: Boolean(form.contactName.trim()) },
      { label: 'Email', valid: Boolean(form.email.trim()) },
    ]);
    if (missingFields.length > 0) {
      setValidationAttempted(true);
      showToast('Validation Error', formatMissingFieldsMessage(missingFields), 'warning');
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
      showToast('Client Registered', `${newClient.name} account registered under active MSA!`, 'success-brand');
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
      backdropClassName="bg-slate-900/60 backdrop-blur-[2px] flex items-center justify-center p-4 select-none"
      panelClassName="bg-white rounded-xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
      ariaLabel="Register Client Account"
    >
        <ModalHeader
          icon={<Building2 className="w-4 h-4" />}
          title="Register New Client Account"
          subtitle="Add enterprise client account, headquarters location, and primary hiring manager."
          onClose={onClose}
          closeDisabled={isSaving}
        />

        {/* Modal Body Form */}
        <form noValidate onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 overflow-y-auto space-y-4 text-xs flex-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-slate-700">Company Legal Name *</label>
                  {isNameInvalid && <span className="text-[11px] font-semibold text-rose-600">Required</span>}
                </div>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Morgan Stanley Tech"
                  className={`w-full px-3 py-1.5 border rounded-lg text-xs font-medium focus:outline-none ${
                    isNameInvalid ? INVALID_FIELD_CLASSES : 'border-slate-200 bg-white focus:border-brand-600'
                  }`}
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
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-slate-700">Headquarters Location *</label>
                  {isLocationInvalid && <span className="text-[11px] font-semibold text-rose-600">Required</span>}
                </div>
                <input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="e.g. New York, NY"
                  className={`w-full px-3 py-1.5 border rounded-lg text-xs focus:outline-none ${
                    isLocationInvalid ? INVALID_FIELD_CLASSES : 'border-slate-200 bg-white focus:border-brand-600'
                  }`}
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Phone</label>
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
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-slate-700">Contact Person Name *</label>
                    {isContactInvalid && <span className="text-[11px] font-semibold text-rose-600">Required</span>}
                  </div>
                  <input
                    value={form.contactName}
                    onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                    placeholder="e.g. Brian O'Connor"
                    className={`w-full px-3 py-1.5 border rounded-lg text-xs font-medium focus:outline-none ${
                      isContactInvalid ? INVALID_FIELD_CLASSES : 'border-slate-200 bg-white focus:border-brand-600'
                    }`}
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
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-slate-700">Contact Email *</label>
                    {isEmailInvalid && <span className="text-[11px] font-semibold text-rose-600">Required</span>}
                  </div>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="brian.oc@morganstanley.com"
                    className={`w-full px-3 py-1.5 border rounded-lg text-xs focus:outline-none ${
                      isEmailInvalid ? INVALID_FIELD_CLASSES : 'border-slate-200 bg-white focus:border-brand-600'
                    }`}
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
          <div className="px-6 py-3.5 bg-slate-50/60 border-t border-slate-100 flex items-center justify-between text-xs shrink-0">
            <button
              type="button"
              disabled={isSaving}
              onClick={onClose}
              className="h-8 px-3.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-60 text-[11px] font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <ActionButton
              type="submit"
              loading={isSaving}
              loadingText="Saving Client..."
              icon={<Plus className="w-3.5 h-3.5" strokeWidth={1.75} />}
              className="h-8 px-4 rounded-lg bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white text-[11px] font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              Save &amp; Register Client Account
            </ActionButton>
          </div>
        </form>
    </AnimatedModal>
  );
};

