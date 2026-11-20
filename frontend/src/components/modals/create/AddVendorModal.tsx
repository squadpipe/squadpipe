import React, { useState, useEffect } from 'react';
import { Handshake, Plus, X } from 'lucide-react';
import { Vendor } from '../../../types';
import { DynamicCustomFieldsSection, useMasterTaxonomies } from '../../shared/DynamicCustomFieldsSection';
import { CustomSelect } from '../../shared/CustomSelect';
import { ActionButton } from '../../shared/ActionButton';
import { AnimatedModal } from '../../shared/MotionPrimitives';
import {
  formatMissingFieldsMessage,
  getMissingFieldLabels,
  INVALID_FIELD_CLASSES,
} from '../../../utils/formValidation';

interface AddVendorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (vendor: Vendor) => Promise<void> | void;
  showToast: (title: string, message: string, icon?: string) => void;
}

const INITIAL_VENDOR_FORM = {
  name: '',
  location: '',
  contactName: '',
  phone: '',
  email: '',
  skillSpecialization: '',
  paymentTerms: 'Net 30',
  msa: 'Yes',
  coiExpiryDate: '',
};

export const AddVendorModal: React.FC<AddVendorModalProps> = ({
  isOpen,
  onClose,
  onSave,
  showToast,
}) => {
  const taxonomies = useMasterTaxonomies(isOpen);
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [form, setForm] = useState({ ...INITIAL_VENDOR_FORM });

  useEffect(() => {
    if (isOpen) {
      setForm({ ...INITIAL_VENDOR_FORM });
      setCustomValues({});
      setValidationAttempted(false);
    }
  }, [isOpen]);

  const isNameInvalid = validationAttempted && !form.name.trim();
  const isContactInvalid = validationAttempted && !form.contactName.trim();
  const isEmailInvalid = validationAttempted && !form.email.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    const missingFields = getMissingFieldLabels([
      { label: 'Vendor Agency Name', valid: Boolean(form.name.trim()) },
      { label: 'Contact Person', valid: Boolean(form.contactName.trim()) },
      { label: 'Email', valid: Boolean(form.email.trim()) },
    ]);
    if (missingFields.length > 0) {
      setValidationAttempted(true);
      showToast('Validation Error', formatMissingFieldsMessage(missingFields), 'warning');
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
      coiExpiryDate: form.coiExpiryDate || undefined,
      customFields: customValues,
    };

    setIsSaving(true);
    try {
      await onSave(newVendor);
      setForm({ ...INITIAL_VENDOR_FORM });
      setCustomValues({});
      showToast('Vendor Onboarded', `${newVendor.name} added to vendor network!`, 'success-brand');
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
      ariaLabel="Register Staffing Vendor Partner"
    >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-[#141615] text-white">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white flex-shrink-0">
              <Handshake className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">
                Register Staffing Vendor Partner
              </h2>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Onboard external staffing agency, partner contact, candidate specializations, and payment terms.
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
        <form noValidate onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 overflow-y-auto space-y-4 text-xs flex-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-slate-700">Vendor Agency Name *</label>
                  {isNameInvalid && <span className="text-[11px] font-semibold text-rose-600">Required</span>}
                </div>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. CloudSync Global Corp"
                  className={`w-full px-3 py-1.5 border rounded-lg text-xs font-medium focus:outline-none ${
                    isNameInvalid ? INVALID_FIELD_CLASSES : 'border-slate-200 bg-white focus:border-brand-600'
                  }`}
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Headquarters Location</label>
                <input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="e.g. Dallas, TX"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs focus:border-brand-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-slate-700">Partner Contact Person *</label>
                  {isContactInvalid && <span className="text-[11px] font-semibold text-rose-600">Required</span>}
                </div>
                <input
                  value={form.contactName}
                  onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                  placeholder="e.g. Sandeep Reddy"
                  className={`w-full px-3 py-1.5 border rounded-lg text-xs font-medium focus:outline-none ${
                    isContactInvalid ? INVALID_FIELD_CLASSES : 'border-slate-200 bg-white focus:border-brand-600'
                  }`}
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
              <div className="flex items-center justify-between mb-1">
                <label className="block font-semibold text-slate-700">Contact Email Address *</label>
                {isEmailInvalid && <span className="text-[11px] font-semibold text-rose-600">Required</span>}
              </div>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="sandeep@cloudsync.com"
                className={`w-full px-3 py-1.5 border rounded-lg text-xs focus:outline-none ${
                  isEmailInvalid ? INVALID_FIELD_CLASSES : 'border-slate-200 bg-white focus:border-brand-600'
                }`}
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Payment Terms</label>
                <CustomSelect
                  value={form.paymentTerms}
                  onChange={(val) => setForm({ ...form, paymentTerms: val })}
                  ariaLabel="Payment Terms"
                  size="sm"
                  options={taxonomies.paymentTerms}
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Vendor Agreement Status</label>
                <CustomSelect
                  value={form.msa}
                  onChange={(val) => setForm({ ...form, msa: val })}
                  ariaLabel="Vendor Agreement Status"
                  size="sm"
                  options={[
                    { value: 'Yes', label: 'Yes (Executed & Active)' },
                    { value: 'No', label: 'No (Pending Review)' },
                  ]}
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Insurance Expiry Date <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="date"
                  value={form.coiExpiryDate}
                  onChange={(e) => setForm({ ...form, coiExpiryDate: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs focus:border-brand-600 focus:outline-none"
                />
              </div>
            </div>

            <DynamicCustomFieldsSection
              entity="vendor"
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
              loadingText="Saving Vendor..."
              icon={<Plus className="w-3.5 h-3.5" strokeWidth={1.75} />}
              className="px-5 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              Save & Register Vendor Partner
            </ActionButton>
          </div>
        </form>
    </AnimatedModal>
  );
};

