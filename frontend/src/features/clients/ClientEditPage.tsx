import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Briefcase, Building2, Globe, ShieldCheck, Users } from 'lucide-react';
import { apiClient } from '../../config/api.config';
import { BillablePlacement, Client, Requirement } from '../../types';
import { ActionButton } from '../../components/shared/ActionButton';
import { DetailBreadcrumb } from '../../components/shared/DetailPageShell';
import { DynamicCustomFieldsSection } from '../../components/shared/DynamicCustomFieldsSection';
import { FormField } from '../../components/shared/FormField';
import { PageHeader } from '../../components/shared/PageHeader';
import { StatusBadge } from '../../components/shared/StatusBadge';
import {
  ContactValidationErrors,
  EditableEntityContact,
  EntityContactsEditor,
  validateEditableContacts,
} from '../../components/modals/edit/EntityContactsEditor';
import { UnsavedChangesModal, useFormShortcuts } from '../../hooks/useFormShortcuts';
import { mapClientFromApi } from '../../utils/entityMappers';
import {
  formatMissingFieldsMessage,
  getMissingFieldLabels,
  INVALID_FIELD_CLASSES,
} from '../../utils/formValidation';

interface ClientEditPageProps {
  client: Client | null;
  requirements?: Requirement[];
  placements?: BillablePlacement[];
  backLabel?: string;
  initialFocusSection?: 'account' | 'contacts';
  onBack: () => void;
  onClientUpdated: (updated: Client) => void;
  showToast: (title: string, message: string, icon?: string) => void;
}

function buildInitialClientContacts(client: Client): EditableEntityContact[] {
  const sorted = [...(client.contacts || [])].sort(
    (a, b) => Number(Boolean(b.isPrimary)) - Number(Boolean(a.isPrimary))
  );
  return sorted.map((c, idx) => ({
    id: c.id,
    fullName: c.name || (c as any).fullName || '',
    designation: c.designation || '',
    email: c.email || '',
    phone: c.phone || '',
    isPrimary: Boolean(c.isPrimary) || (idx === 0 && !sorted.some((item) => item.isPrimary)),
  }));
}

/**
 * Dedicated full-page editor (/clients/:id/edit) for updating a client account,
 * corporate details, hiring contacts, and custom attributes without modal popups.
 */
export const ClientEditPage: React.FC<ClientEditPageProps> = ({
  client,
  requirements = [],
  placements = [],
  backLabel = 'Back to Client Details',
  initialFocusSection = 'account',
  onBack,
  onClientUpdated,
  showToast,
}) => {
  const [name, setName] = useState(client?.name || '');
  const [location, setLocation] = useState(client?.location || '');
  const [website, setWebsite] = useState(client?.website || '');
  const [boardNumber, setBoardNumber] = useState(client?.boardNumber || '');
  const [contacts, setContacts] = useState<EditableEntityContact[]>(() =>
    client ? buildInitialClientContacts(client) : []
  );
  const [customFields, setCustomFields] = useState<Record<string, any>>(() =>
    client?.customFields && typeof client.customFields === 'object'
      ? { ...client.customFields }
      : {}
  );
  const [baselineSnapshot, setBaselineSnapshot] = useState(() =>
    JSON.stringify({
      name: client?.name || '',
      location: client?.location || '',
      website: client?.website || '',
      boardNumber: client?.boardNumber || '',
      contacts: client ? buildInitialClientContacts(client) : [],
      customFields:
        client?.customFields && typeof client.customFields === 'object'
          ? client.customFields
          : {},
    })
  );
  const [isSaving, setIsSaving] = useState(false);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [contactErrors, setContactErrors] = useState<ContactValidationErrors>({});
  const contactsSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!client) return;
    const nextContacts = buildInitialClientContacts(client);
    const nextCf =
      client.customFields && typeof client.customFields === 'object'
        ? { ...client.customFields }
        : {};
    setName(client.name || '');
    setLocation(client.location || '');
    setWebsite(client.website || '');
    setBoardNumber(client.boardNumber || '');
    setContacts(nextContacts);
    setCustomFields(nextCf);
    setBaselineSnapshot(
      JSON.stringify({
        name: client.name || '',
        location: client.location || '',
        website: client.website || '',
        boardNumber: client.boardNumber || '',
        contacts: nextContacts,
        customFields: nextCf,
      })
    );
    setValidationAttempted(false);
    setContactErrors({});
    setIsSaving(false);

    if (initialFocusSection === 'contacts') {
      const timer = window.setTimeout(() => {
        contactsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
      return () => window.clearTimeout(timer);
    }
  }, [client?.id, initialFocusSection]);

  const currentSnapshot = useMemo(
    () => JSON.stringify({ name, location, website, boardNumber, contacts, customFields }),
    [name, location, website, boardNumber, contacts, customFields]
  );
  const isDirty = Boolean(client) && currentSnapshot !== baselineSnapshot;

  const clientReqsCount = useMemo(
    () =>
      client
        ? requirements.filter(
            (r) => r.companyName.trim().toLowerCase() === client.name.trim().toLowerCase()
          ).length
        : 0,
    [requirements, client]
  );

  const activePlacementsCount = useMemo(
    () =>
      client
        ? placements.filter(
            (p) =>
              p.customer.trim().toLowerCase() === client.name.trim().toLowerCase() &&
              p.status !== 'Completed' &&
              p.status !== 'Terminated'
          ).length
        : 0,
    [placements, client]
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
    if (!client || isSaving) return;

    const missingFields = getMissingFieldLabels([
      { label: 'Company Name', valid: Boolean(name.trim()) },
      { label: 'HQ Location', valid: Boolean(location.trim()) },
    ]);
    if (missingFields.length > 0) {
      setValidationAttempted(true);
      showToast('Required Fields Missing', formatMissingFieldsMessage(missingFields), 'error');
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
    setIsSaving(true);
    try {
      const payload = {
        name: name.trim(),
        location: location.trim(),
        website: website.trim(),
        boardNumber: boardNumber.trim(),
        contacts: contactCheck.cleaned.map((c) => ({
          ...(c.id ? { id: c.id } : {}),
          fullName: c.fullName,
          designation: c.designation || 'Hiring Manager',
          email: c.email,
          phone: c.phone,
          isPrimary: c.isPrimary,
        })),
        customFields,
      };
      const res = await apiClient.put(`/clients/${client.id}`, payload);
      const updatedClient: Client = res.data?.data
        ? mapClientFromApi(res.data.data)
        : {
            ...client,
            name: payload.name,
            location: payload.location,
            website: payload.website,
            boardNumber: payload.boardNumber,
            contacts: contactCheck.cleaned.map((c) => ({
              id: c.id,
              name: c.fullName,
              designation: c.designation || 'Hiring Manager',
              email: c.email,
              phone: c.phone,
              isPrimary: c.isPrimary,
            })),
            customFields: payload.customFields,
          };
      onClientUpdated(updatedClient);
      setBaselineSnapshot(currentSnapshot);
      showToast('Client Updated', `${updatedClient.name} details saved.`, 'success');
      onBack();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        `Could not update ${client.name}.`;
      showToast('Update Failed', msg, 'error');
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

  if (!client) {
    return (
      <section className="max-w-7xl mx-auto px-1 sm:px-2 lg:px-4 py-16 text-center space-y-3 animate-fade-in">
        <p className="text-sm font-semibold text-slate-700">Client record not found.</p>
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

  const isNameInvalid = validationAttempted && !name.trim();
  const isLocationInvalid = validationAttempted && !location.trim();
  const primaryLead = contacts.find((c) => c.isPrimary) || contacts[0];
  const inputBaseClass =
    'w-full h-9 px-3 bg-white border rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none transition-colors';

  return (
    <div className="max-w-7xl mx-auto px-1 sm:px-2 lg:px-4 space-y-5 pb-8 animate-fade-in">
      <DetailBreadcrumb
        backLabel={backLabel}
        onBack={() => guardNavigation(onBack)}
        title={client.name}
        codePill="Edit Client"
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
        title={`Edit Client · ${client.name}`}
        subtitle="Update corporate account details, website, hiring leads, and custom metadata."
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
          {/* Card 1: Company Profile */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-5 card-shadow space-y-4">
            <div className="pb-3 border-b border-slate-100 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-brand-600 shrink-0" />
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Company &amp; HQ Profile</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Core corporate account identity, website, and main phone channel.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Company Name" htmlFor="page-edit-client-name" required>
                <input
                  id="page-edit-client-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Horizon Digital Solutions Inc"
                  className={`${inputBaseClass} ${
                    isNameInvalid
                      ? INVALID_FIELD_CLASSES
                      : 'border-slate-200 focus:border-brand-600'
                  }`}
                />
              </FormField>

              <FormField label="HQ Location" htmlFor="page-edit-client-location" required>
                <input
                  id="page-edit-client-location"
                  type="text"
                  required
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Austin, TX"
                  className={`${inputBaseClass} ${
                    isLocationInvalid
                      ? INVALID_FIELD_CLASSES
                      : 'border-slate-200 focus:border-brand-600'
                  }`}
                />
              </FormField>

              <FormField label="Website" htmlFor="page-edit-client-website">
                <input
                  id="page-edit-client-website"
                  type="text"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="e.g. www.company.com"
                  className={`${inputBaseClass} border-slate-200 focus:border-brand-600`}
                />
              </FormField>

              <FormField label="Main Board Phone" htmlFor="page-edit-client-phone">
                <input
                  id="page-edit-client-phone"
                  type="text"
                  value={boardNumber}
                  onChange={(e) => setBoardNumber(e.target.value)}
                  placeholder="(555) 123-4567"
                  className={`${inputBaseClass} border-slate-200 focus:border-brand-600`}
                />
              </FormField>
            </div>

            <DynamicCustomFieldsSection
              entity="client"
              values={customFields}
              onChange={setCustomFields}
              isOpen={true}
            />
          </div>

          {/* Card 2: Hiring Contacts */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-5 card-shadow">
            <EntityContactsEditor
              title="Hiring Contacts"
              subtitle="Add, edit, or designate the Primary Lead linked to job requisitions and approvals."
              contacts={contacts}
              onChange={setContacts}
              invalidMap={contactErrors}
              onClearRowError={handleClearContactError}
              sectionRef={contactsSectionRef}
              namePlaceholder="e.g. Michael Anderson"
              designationPlaceholder="e.g. Senior Hiring Manager"
              defaultDesignation="Hiring Manager"
              allowEmpty={true}
            />
          </div>
        </div>

        {/* Right Sidebar */}
        <aside className="lg:col-span-4 space-y-5 text-xs">
          <div className="bg-white rounded-xl border border-slate-200/90 p-5 card-shadow space-y-4">
            <div className="pb-3 border-b border-slate-100 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-brand-600 shrink-0" />
                <h2 className="text-sm font-semibold text-slate-900">Account Snapshot</h2>
              </div>
              {activePlacementsCount > 0 && (
                <StatusBadge
                  tone="emerald"
                  size="xs"
                  label={`${activePlacementsCount} Active`}
                />
              )}
            </div>

            <div className="space-y-2.5">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                <span className="text-slate-600 inline-flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                  <span>Job Requisitions</span>
                </span>
                <span className="font-bold font-mono text-slate-900">{clientReqsCount}</span>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                <span className="text-slate-600 inline-flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  <span>Hiring Contacts</span>
                </span>
                <span className="font-bold font-mono text-slate-900">{contacts.length}</span>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2">
                <span className="text-slate-600 inline-flex items-center gap-1.5 shrink-0">
                  <Globe className="w-3.5 h-3.5 text-slate-400" />
                  <span>Primary Lead</span>
                </span>
                <span className="font-semibold text-slate-900 truncate">
                  {primaryLead?.fullName?.trim() || 'Not assigned'}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed pt-1 border-t border-slate-100">
              Existing requisition links are preserved when updating kept contacts in place.
            </p>
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
