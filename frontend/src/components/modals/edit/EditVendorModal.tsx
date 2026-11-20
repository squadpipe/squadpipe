import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, Handshake } from 'lucide-react';
import { emitAppToast } from '../../../config/api.config';
import { Vendor, VendorContact } from '../../../types';
import {
  DEFAULT_MASTER_TAXONOMIES,
  DynamicCustomFieldsSection,
  useMasterTaxonomies,
} from '../../shared/DynamicCustomFieldsSection';
import { ActionButton } from '../../shared/ActionButton';
import { CustomSelect } from '../../shared/CustomSelect';
import { StatusBadge } from '../../shared/StatusBadge';
import { INVALID_FIELD_CLASSES } from '../../../utils/formValidation';
import { getDaysRemaining } from '../../../features/billable/placementUtils';
import { AnimatedModal, ModalHeader } from '../../shared/MotionPrimitives';
import {
  ContactValidationErrors,
  EditableEntityContact,
  EntityContactsEditor,
  validateEditableContacts,
} from './EntityContactsEditor';

interface EditVendorModalProps {
  vendor: Vendor | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateVendor: (updated: Vendor) => Promise<void> | void;
  showToast?: (title: string, message: string, icon?: string) => void;
}

export function buildInitialVendorContacts(vendor: Vendor): VendorContact[] {
  if (vendor.contacts && vendor.contacts.length > 0) {
    const sorted = [...vendor.contacts].sort(
      (a, b) => Number(Boolean(b.isPrimary)) - Number(Boolean(a.isPrimary))
    );
    const hasPrimary = sorted.some((c) => c.isPrimary);
    return sorted.map((c, idx) => ({
      id: c.id,
      fullName: c.fullName || '',
      designation: c.designation || '',
      phone: c.phone || '',
      email: c.email || '',
      isPrimary: Boolean(c.isPrimary) || (!hasPrimary && idx === 0),
    }));
  }
  return [
    {
      fullName: vendor.contactName || '',
      designation: 'Account Executive',
      phone: vendor.phone || '',
      email: vendor.email || '',
      isPrimary: true,
    },
  ];
}

function mergeSelectOptions(base: string[], currentValue?: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of base) {
    const clean = String(item || '').trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(clean);
    }
  }
  const cur = String(currentValue || '').trim();
  if (cur && !seen.has(cur.toLowerCase())) {
    out.push(cur);
  }
  return out;
}

export const EditVendorModal: React.FC<EditVendorModalProps> = ({
  vendor,
  isOpen,
  onClose,
  onUpdateVendor,
  showToast,
}) => {
  const taxonomies = useMasterTaxonomies(isOpen);
  const [editForm, setEditForm] = useState<Vendor | null>(vendor);
  const [contacts, setContacts] = useState<EditableEntityContact[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [contactErrors, setContactErrors] = useState<ContactValidationErrors>({});
  const contactsSectionRef = useRef<HTMLDivElement | null>(null);

  const notifyError = (title: string, message: string) => {
    if (showToast) {
      showToast(title, message, 'error');
    } else {
      emitAppToast(title, message, 'error');
    }
  };

  useEffect(() => {
    if (isOpen && vendor) {
      setEditForm({ ...vendor });
      setContacts(
        buildInitialVendorContacts(vendor).map((c) => ({
          id: c.id,
          fullName: c.fullName || '',
          designation: c.designation || '',
          email: c.email || '',
          phone: c.phone || '',
          isPrimary: Boolean(c.isPrimary),
        }))
      );
      setIsSaving(false);
      setValidationAttempted(false);
      setContactErrors({});
    }
  }, [isOpen, vendor]);

  const paymentTermOptions = useMemo(
    () =>
      mergeSelectOptions(
        taxonomies.paymentTerms.length > 0
          ? taxonomies.paymentTerms
          : DEFAULT_MASTER_TAXONOMIES.paymentTerms,
        editForm?.paymentTerms
      ),
    [taxonomies.paymentTerms, editForm?.paymentTerms]
  );

  const invoicingOptions = useMemo(
    () => mergeSelectOptions(['Weekly', 'Bi-weekly', 'Monthly'], editForm?.invoicingTerms),
    [editForm?.invoicingTerms]
  );

  if (!editForm) return null;

  const isVendorNameInvalid = validationAttempted && !editForm.name.trim();
  const coiDaysRemaining = editForm.coiExpiryDate
    ? getDaysRemaining(editForm.coiExpiryDate)
    : null;
  const isMsaExecuted = editForm.msa === 'Yes' || editForm.msa === 'Active';

  const handleClearContactError = (idx: number, field: 'fullName' | 'email') => {
    setContactErrors((prev) => {
      if (!prev[idx]?.[field]) return prev;
      const nextRow = { ...prev[idx] };
      delete nextRow[field];
      const next = { ...prev };
      if (!nextRow.fullName && !nextRow.email) {
        delete next[idx];
      } else {
        next[idx] = nextRow;
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    if (!editForm.name.trim()) {
      setValidationAttempted(true);
      notifyError('Required Field Missing', 'Vendor Company Name is required.');
      return;
    }

    const contactCheck = validateEditableContacts(contacts);
    if (contactCheck.errorMessage) {
      setValidationAttempted(true);
      setContactErrors(contactCheck.invalidIndices);
      contactsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      notifyError('Invalid Contact Details', contactCheck.errorMessage);
      return;
    }

    setValidationAttempted(false);
    setContactErrors({});

    const normalizedContacts: VendorContact[] =
      contactCheck.cleaned.length > 0
        ? contactCheck.cleaned.map((c) => ({
            id: c.id,
            fullName: c.fullName,
            designation: c.designation || 'Account Executive',
            phone: c.phone,
            email: c.email,
            isPrimary: c.isPrimary,
          }))
        : [
            {
              fullName: editForm.contactName || 'Account Executive',
              designation: 'Account Executive',
              phone: editForm.phone || '',
              email: editForm.email || '',
              isPrimary: true,
            },
          ];

    const primaryContact =
      normalizedContacts.find((c) => c.isPrimary) || normalizedContacts[0];

    setIsSaving(true);
    try {
      await onUpdateVendor({
        ...editForm,
        name: editForm.name.trim(),
        location: editForm.location.trim(),
        skillSpecialization: editForm.skillSpecialization.trim(),
        contactName: primaryContact?.fullName || editForm.contactName,
        phone: primaryContact?.phone ?? editForm.phone,
        email: primaryContact?.email || editForm.email,
        contacts: normalizedContacts,
      });
      onClose();
    } catch {
      // Parent handler surfaces API error toast
    } finally {
      setIsSaving(false);
    }
  };

  const fieldBaseClass =
    'w-full h-9 px-3 bg-white border rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none transition-colors';

  return (
    <AnimatedModal
      isOpen={isOpen}
      onBackdropClick={() => !isSaving && onClose()}
      zIndexClass="z-50"
      panelClassName="bg-white rounded-xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
      ariaLabel={`Edit Partner Vendor ${editForm.name}`}
    >
      <ModalHeader
        icon={<Handshake className="w-4 h-4" />}
        title="Edit Partner Vendor"
        subtitle={`Update partner agency details, commercial terms, and contacts for ${editForm.name}`}
        onClose={onClose}
        closeDisabled={isSaving}
      />

      <form noValidate onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Section 1: Agency Profile */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Agency Profile
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="edit-vendor-name"
                  className="block text-[11px] font-medium text-slate-700 mb-1"
                >
                  Vendor Company *
                </label>
                <input
                  id="edit-vendor-name"
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  placeholder="e.g. Apex Staffing Solutions"
                  className={`${fieldBaseClass} ${
                    isVendorNameInvalid
                      ? INVALID_FIELD_CLASSES
                      : 'border-slate-200 focus:border-brand-600'
                  }`}
                />
              </div>

              <div>
                <label
                  htmlFor="edit-vendor-location"
                  className="block text-[11px] font-medium text-slate-700 mb-1"
                >
                  HQ Location
                </label>
                <input
                  id="edit-vendor-location"
                  type="text"
                  value={editForm.location}
                  onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                  placeholder="e.g. Chicago, IL"
                  className={`${fieldBaseClass} border-slate-200 focus:border-brand-600`}
                />
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="edit-vendor-specialization"
                  className="block text-[11px] font-medium text-slate-700 mb-1"
                >
                  Technical Specialization
                </label>
                <input
                  id="edit-vendor-specialization"
                  type="text"
                  value={editForm.skillSpecialization}
                  onChange={(e) =>
                    setEditForm({ ...editForm, skillSpecialization: e.target.value })
                  }
                  placeholder="e.g. Cloud Engineering, Data Platform, ERP"
                  className={`${fieldBaseClass} border-slate-200 focus:border-brand-600`}
                />
              </div>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Section 2: Commercial & Compliance */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Commercial &amp; Compliance
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">
                  Payment Terms
                </label>
                <CustomSelect
                  value={editForm.paymentTerms || paymentTermOptions[0] || 'Net 30'}
                  onChange={(val) => setEditForm({ ...editForm, paymentTerms: val })}
                  ariaLabel="Payment Terms"
                  size="sm"
                  options={paymentTermOptions}
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">
                  Invoicing Cycle
                </label>
                <CustomSelect
                  value={editForm.invoicingTerms || 'Bi-weekly'}
                  onChange={(val) => setEditForm({ ...editForm, invoicingTerms: val })}
                  ariaLabel="Invoicing Cycle"
                  size="sm"
                  options={invoicingOptions}
                />
              </div>

              <div>
                <span className="block text-[11px] font-medium text-slate-700 mb-1">
                  Agreement (MSA) Status
                </span>
                <div className="h-[34px] p-0.5 bg-slate-100/90 border border-slate-200/80 rounded-lg grid grid-cols-2 gap-0.5">
                  <button
                    type="button"
                    onClick={() => setEditForm({ ...editForm, msa: 'Active' })}
                    className={`rounded-md text-[11px] font-semibold inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      isMsaExecuted
                        ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isMsaExecuted ? 'bg-emerald-500' : 'bg-slate-300'
                      }`}
                    />
                    <span>MSA Executed</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditForm({ ...editForm, msa: 'Pending' })}
                    className={`rounded-md text-[11px] font-semibold inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      !isMsaExecuted
                        ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        !isMsaExecuted ? 'bg-amber-500' : 'bg-slate-300'
                      }`}
                    />
                    <span>Pending Review</span>
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label
                    htmlFor="edit-vendor-coi-date"
                    className="text-[11px] font-medium text-slate-700 inline-flex items-center gap-1"
                  >
                    <Calendar className="w-3 h-3 text-slate-400" />
                    <span>Insurance (COI) Expiry</span>
                  </label>
                  {coiDaysRemaining !== null && (
                    <StatusBadge
                      tone={
                        coiDaysRemaining < 0
                          ? 'rose'
                          : coiDaysRemaining <= 30
                            ? 'amber'
                            : 'emerald'
                      }
                      size="xs"
                      label={
                        coiDaysRemaining < 0
                          ? `Expired ${Math.abs(coiDaysRemaining)}d`
                          : coiDaysRemaining <= 30
                            ? `Expiring in ${coiDaysRemaining}d`
                            : `${coiDaysRemaining}d left`
                      }
                    />
                  )}
                </div>
                <input
                  id="edit-vendor-coi-date"
                  type="date"
                  value={editForm.coiExpiryDate || ''}
                  onChange={(e) =>
                    setEditForm({ ...editForm, coiExpiryDate: e.target.value })
                  }
                  className="w-full h-[34px] px-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:border-brand-600 focus:outline-none transition-colors"
                />
              </div>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Section 3: Vendor Contacts */}
          <EntityContactsEditor
            title="Vendor Contacts"
            subtitle="Designate a primary account executive for partner submissions and billing notices."
            contacts={contacts}
            onChange={setContacts}
            invalidMap={contactErrors}
            onClearRowError={handleClearContactError}
            sectionRef={contactsSectionRef}
            namePlaceholder="e.g. Sarah Jenkins"
            designationPlaceholder="e.g. Account Executive"
            defaultDesignation="Account Executive"
            allowEmpty={false}
          />

          <DynamicCustomFieldsSection
            entity="vendor"
            values={editForm.customFields || {}}
            onChange={(nextCf) => setEditForm({ ...editForm, customFields: nextCf })}
            isOpen={isOpen}
          />
        </div>

        <div className="px-6 py-3.5 bg-slate-50/60 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            disabled={isSaving}
            onClick={onClose}
            className="h-8 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <ActionButton
            type="submit"
            loading={isSaving}
            loadingText="Saving..."
            className="h-8 px-4 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
          >
            Save Changes
          </ActionButton>
        </div>
      </form>
    </AnimatedModal>
  );
};
