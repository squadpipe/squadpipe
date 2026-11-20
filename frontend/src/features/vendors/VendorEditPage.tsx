import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Briefcase, Calendar, Handshake, ShieldCheck, Users } from 'lucide-react';
import { BillablePlacement, Candidate, Vendor, VendorContact } from '../../types';
import { ActionButton } from '../../components/shared/ActionButton';
import { CustomSelect } from '../../components/shared/CustomSelect';
import { DetailBreadcrumb } from '../../components/shared/DetailPageShell';
import {
  DEFAULT_MASTER_TAXONOMIES,
  DynamicCustomFieldsSection,
  useMasterTaxonomies,
} from '../../components/shared/DynamicCustomFieldsSection';
import { FormField } from '../../components/shared/FormField';
import { PageHeader } from '../../components/shared/PageHeader';
import { StatusBadge } from '../../components/shared/StatusBadge';
import {
  ContactValidationErrors,
  EditableEntityContact,
  EntityContactsEditor,
  validateEditableContacts,
} from '../../components/modals/edit/EntityContactsEditor';
import { getDaysRemaining } from '../billable/placementUtils';
import { UnsavedChangesModal, useFormShortcuts } from '../../hooks/useFormShortcuts';
import { INVALID_FIELD_CLASSES } from '../../utils/formValidation';

interface VendorEditPageProps {
  vendor: Vendor | null;
  candidates?: Candidate[];
  placements?: BillablePlacement[];
  backLabel?: string;
  initialFocusSection?: 'profile' | 'contacts' | 'compliance';
  onBack: () => void;
  onUpdateVendor: (updated: Vendor) => Promise<void> | void;
  showToast: (title: string, message: string, icon?: string) => void;
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

/**
 * Dedicated full-page editor (/vendors/:id/edit) for updating a sub-tier staffing
 * partner's profile, commercial & COI compliance terms, contacts, and custom fields.
 */
export const VendorEditPage: React.FC<VendorEditPageProps> = ({
  vendor,
  candidates = [],
  placements = [],
  backLabel = 'Back to Vendor Details',
  initialFocusSection = 'profile',
  onBack,
  onUpdateVendor,
  showToast,
}) => {
  const taxonomies = useMasterTaxonomies(true);
  const [form, setForm] = useState<Vendor | null>(() => (vendor ? { ...vendor } : null));
  const [contacts, setContacts] = useState<EditableEntityContact[]>(() =>
    vendor
      ? buildInitialVendorContacts(vendor).map((c) => ({
          id: c.id,
          fullName: c.fullName || '',
          designation: c.designation || '',
          email: c.email || '',
          phone: c.phone || '',
          isPrimary: Boolean(c.isPrimary),
        }))
      : []
  );
  const [baselineSnapshot, setBaselineSnapshot] = useState(() =>
    JSON.stringify({
      form: vendor || null,
      contacts: vendor ? buildInitialVendorContacts(vendor) : [],
    })
  );
  const [isSaving, setIsSaving] = useState(false);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [contactErrors, setContactErrors] = useState<ContactValidationErrors>({});
  const contactsSectionRef = useRef<HTMLDivElement | null>(null);
  const complianceSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!vendor) return;
    const initialContacts = buildInitialVendorContacts(vendor).map((c) => ({
      id: c.id,
      fullName: c.fullName || '',
      designation: c.designation || '',
      email: c.email || '',
      phone: c.phone || '',
      isPrimary: Boolean(c.isPrimary),
    }));
    const clonedVendor = { ...vendor };
    setForm(clonedVendor);
    setContacts(initialContacts);
    setBaselineSnapshot(
      JSON.stringify({
        form: clonedVendor,
        contacts: buildInitialVendorContacts(vendor),
      })
    );
    setIsSaving(false);
    setValidationAttempted(false);
    setContactErrors({});

    if (initialFocusSection === 'contacts' || initialFocusSection === 'compliance') {
      const timer = window.setTimeout(() => {
        const target =
          initialFocusSection === 'contacts'
            ? contactsSectionRef.current
            : complianceSectionRef.current;
        target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
      return () => window.clearTimeout(timer);
    }
  }, [vendor?.id, initialFocusSection]);

  const paymentTermOptions = useMemo(
    () =>
      mergeSelectOptions(
        taxonomies.paymentTerms.length > 0
          ? taxonomies.paymentTerms
          : DEFAULT_MASTER_TAXONOMIES.paymentTerms,
        form?.paymentTerms
      ),
    [taxonomies.paymentTerms, form?.paymentTerms]
  );

  const invoicingOptions = useMemo(
    () => mergeSelectOptions(['Weekly', 'Bi-weekly', 'Monthly'], form?.invoicingTerms),
    [form?.invoicingTerms]
  );

  const currentSnapshot = useMemo(
    () =>
      JSON.stringify({
        form,
        contacts: contacts.map((c) => ({
          id: c.id,
          fullName: c.fullName,
          designation: c.designation,
          phone: c.phone,
          email: c.email,
          isPrimary: c.isPrimary,
        })),
      }),
    [form, contacts]
  );
  const isDirty = Boolean(vendor && form) && currentSnapshot !== baselineSnapshot;

  const vendorCandidatesCount = useMemo(
    () =>
      vendor
        ? candidates.filter(
            (c) =>
              (c.vendorId && c.vendorId === vendor.id) ||
              (c.vendorName && c.vendorName.trim().toLowerCase() === vendor.name.trim().toLowerCase())
          ).length
        : 0,
    [candidates, vendor]
  );

  const activeVendorPlacementsCount = useMemo(
    () =>
      vendor
        ? placements.filter(
            (p) =>
              ((p.vendorId && p.vendorId === vendor.id) ||
                (p.vendorName && p.vendorName.trim().toLowerCase() === vendor.name.trim().toLowerCase())) &&
              p.status !== 'Completed' &&
              p.status !== 'Terminated'
          ).length
        : 0,
    [placements, vendor]
  );

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

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!form || isSaving) return;

    if (!form.name.trim()) {
      setValidationAttempted(true);
      showToast('Required Field Missing', 'Vendor Company Name is required.', 'error');
      return;
    }

    const contactCheck = validateEditableContacts(contacts);
    if (contactCheck.errorMessage) {
      setValidationAttempted(true);
      setContactErrors(contactCheck.invalidIndices);
      contactsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      showToast('Invalid Contact Details', contactCheck.errorMessage, 'error');
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
              fullName: form.contactName || 'Account Executive',
              designation: 'Account Executive',
              phone: form.phone || '',
              email: form.email || '',
              isPrimary: true,
            },
          ];

    const primaryContact =
      normalizedContacts.find((c) => c.isPrimary) || normalizedContacts[0];

    setIsSaving(true);
    try {
      await onUpdateVendor({
        ...form,
        name: form.name.trim(),
        location: form.location.trim(),
        skillSpecialization: form.skillSpecialization.trim(),
        contactName: primaryContact?.fullName || form.contactName,
        phone: primaryContact?.phone ?? form.phone,
        email: primaryContact?.email || form.email,
        contacts: normalizedContacts,
      });
      setBaselineSnapshot(currentSnapshot);
      onBack();
    } catch {
      // Parent handler surfaces API error toast
    } finally {
      setIsSaving(false);
    }
  };

  const { showLeaveModal, guardNavigation, confirmLeave, cancelLeave } = useFormShortcuts({
    isDirty,
    isSubmitting: isSaving,
    onSubmit: () => {
      void handleSubmit();
    },
  });

  if (!vendor || !form) {
    return (
      <section className="max-w-7xl mx-auto px-1 sm:px-2 lg:px-4 py-16 text-center space-y-3 animate-fade-in">
        <p className="text-sm font-semibold text-slate-700">Vendor record not found.</p>
        <button
          type="button"
          onClick={onBack}
          className="h-8 px-4 rounded-lg bg-brand-600 text-white text-xs font-semibold hover:bg-brand-700 inline-flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{backLabel}</span>
        </button>
      </section>
    );
  }

  const isVendorNameInvalid = validationAttempted && !form.name.trim();
  const isMsaExecuted = form.msa === 'Yes' || form.msa === 'Active';
  const coiDaysRemaining = form.coiExpiryDate ? getDaysRemaining(form.coiExpiryDate) : null;
  const inputBaseClass =
    'w-full h-9 px-3 bg-white border rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none transition-colors';

  return (
    <div className="max-w-7xl mx-auto px-1 sm:px-2 lg:px-4 space-y-5 pb-8 animate-fade-in">
      <DetailBreadcrumb
        backLabel={backLabel}
        onBack={() => guardNavigation(onBack)}
        title={vendor.name}
        codePill="Edit Vendor"
        rightSlot={
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => guardNavigation(onBack)}
              className="h-8 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <ActionButton
              type="button"
              onClick={() => void handleSubmit()}
              loading={isSaving}
              loadingText="Saving..."
              className="h-8 px-3.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-[11px] font-semibold transition-colors cursor-pointer"
            >
              Save Changes
            </ActionButton>
          </div>
        }
      />

      <PageHeader
        title={`Edit Vendor · ${vendor.name}`}
        subtitle="Update partner agency details, MSA & COI compliance status, payment terms, and contacts."
        badges={
          <span className="hidden md:inline text-[11px] text-slate-400">
            Press ⌘S to save
          </span>
        }
      />

      <form
        noValidate
        onSubmit={handleSubmit}
        className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start"
      >
        {/* Left Main Form */}
        <div className="lg:col-span-8 space-y-5 text-xs">
          {/* Card 1: Agency Profile */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-5 card-shadow space-y-4">
            <div className="pb-3 border-b border-slate-100 flex items-center gap-2">
              <Handshake className="w-4 h-4 text-brand-600 shrink-0" />
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Agency Profile</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Staffing partner company identity, HQ location, and technical core capabilities.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Vendor Company" htmlFor="page-edit-vendor-name" required>
                <input
                  id="page-edit-vendor-name"
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Apex Staffing Solutions"
                  className={`${inputBaseClass} ${
                    isVendorNameInvalid
                      ? INVALID_FIELD_CLASSES
                      : 'border-slate-200 focus:border-brand-600'
                  }`}
                />
              </FormField>

              <FormField label="HQ Location" htmlFor="page-edit-vendor-location">
                <input
                  id="page-edit-vendor-location"
                  type="text"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="e.g. Chicago, IL"
                  className={`${inputBaseClass} border-slate-200 focus:border-brand-600`}
                />
              </FormField>

              <div className="sm:col-span-2">
                <FormField
                  label="Technical Specialization"
                  htmlFor="page-edit-vendor-specialization"
                >
                  <input
                    id="page-edit-vendor-specialization"
                    type="text"
                    value={form.skillSpecialization}
                    onChange={(e) => setForm({ ...form, skillSpecialization: e.target.value })}
                    placeholder="e.g. Cloud Engineering, Data Platform, ERP"
                    className={`${inputBaseClass} border-slate-200 focus:border-brand-600`}
                  />
                </FormField>
              </div>
            </div>

            <DynamicCustomFieldsSection
              entity="vendor"
              values={form.customFields || {}}
              onChange={(nextCf) => setForm({ ...form, customFields: nextCf })}
              isOpen={true}
            />
          </div>

          {/* Card 2: Vendor Contacts */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-5 card-shadow">
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
          </div>
        </div>

        {/* Right Sidebar: Commercial & Compliance */}
        <aside className="lg:col-span-4 space-y-5 text-xs">
          <div
            ref={complianceSectionRef}
            className="bg-white rounded-xl border border-slate-200/90 p-5 card-shadow space-y-4"
          >
            <div className="pb-3 border-b border-slate-100 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-brand-600 shrink-0" />
                <h2 className="text-sm font-semibold text-slate-900">Commercial &amp; Compliance</h2>
              </div>
              <StatusBadge
                tone={isMsaExecuted ? 'emerald' : 'amber'}
                size="xs"
                label={isMsaExecuted ? 'MSA Executed' : 'Pending Review'}
              />
            </div>

            <div className="space-y-4">
              <div>
                <span className="block text-[11px] font-semibold text-slate-700 mb-1.5">
                  Agreement (MSA) Status
                </span>
                <div className="h-[34px] p-0.5 bg-slate-100/90 border border-slate-200/80 rounded-lg grid grid-cols-2 gap-0.5">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, msa: 'Active' })}
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
                    onClick={() => setForm({ ...form, msa: 'Pending' })}
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
                    htmlFor="page-edit-vendor-coi-date"
                    className="text-[11px] font-semibold text-slate-700 inline-flex items-center gap-1"
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
                            ? `${coiDaysRemaining}d left`
                            : 'Valid'
                      }
                    />
                  )}
                </div>
                <input
                  id="page-edit-vendor-coi-date"
                  type="date"
                  value={form.coiExpiryDate || ''}
                  onChange={(e) => setForm({ ...form, coiExpiryDate: e.target.value })}
                  className="w-full h-[34px] px-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:border-brand-600 focus:outline-none transition-colors"
                />
              </div>

              <FormField label="Payment Terms">
                <CustomSelect
                  value={form.paymentTerms || paymentTermOptions[0] || 'Net 30'}
                  onChange={(val) => setForm({ ...form, paymentTerms: val })}
                  ariaLabel="Payment Terms"
                  size="sm"
                  options={paymentTermOptions}
                />
              </FormField>

              <FormField label="Invoicing Cycle">
                <CustomSelect
                  value={form.invoicingTerms || 'Bi-weekly'}
                  onChange={(val) => setForm({ ...form, invoicingTerms: val })}
                  ariaLabel="Invoicing Cycle"
                  size="sm"
                  options={invoicingOptions}
                />
              </FormField>
            </div>

            <div className="pt-3 border-t border-slate-100 space-y-2">
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                <span className="text-slate-600 inline-flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  <span>Supplied Consultants</span>
                </span>
                <span className="font-bold font-mono text-slate-900">{vendorCandidatesCount}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                <span className="text-slate-600 inline-flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                  <span>Active Placements</span>
                </span>
                <span className="font-bold font-mono text-emerald-700">
                  {activeVendorPlacementsCount}
                </span>
              </div>
            </div>
          </div>
        </aside>
      </form>

      <UnsavedChangesModal
        isOpen={showLeaveModal}
        onConfirmLeave={confirmLeave}
        onCancelLeave={cancelLeave}
      />
    </div>
  );
};
