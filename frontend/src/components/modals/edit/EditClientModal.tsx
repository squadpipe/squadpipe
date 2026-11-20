import React, { useEffect, useRef, useState } from 'react';
import { Building2 } from 'lucide-react';
import { apiClient } from '../../../config/api.config';
import { Client } from '../../../types';
import { DynamicCustomFieldsSection } from '../../shared/DynamicCustomFieldsSection';
import { ActionButton } from '../../shared/ActionButton';
import {
  formatMissingFieldsMessage,
  getMissingFieldLabels,
  INVALID_FIELD_CLASSES,
} from '../../../utils/formValidation';
import { mapClientFromApi } from '../../../utils/entityMappers';
import { AnimatedModal, ModalHeader } from '../../shared/MotionPrimitives';
import {
  ContactValidationErrors,
  EditableEntityContact,
  EntityContactsEditor,
  validateEditableContacts,
} from './EntityContactsEditor';

interface EditClientModalProps {
  client: Client | null;
  isOpen: boolean;
  onClose: () => void;
  onClientUpdated: (updated: Client) => void;
  showToast: (title: string, message: string, icon?: string) => void;
  initialFocusSection?: 'account' | 'contacts';
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

export const EditClientModal: React.FC<EditClientModalProps> = ({
  client,
  isOpen,
  onClose,
  onClientUpdated,
  showToast,
  initialFocusSection = 'account',
}) => {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [website, setWebsite] = useState('');
  const [boardNumber, setBoardNumber] = useState('');
  const [contacts, setContacts] = useState<EditableEntityContact[]>([]);
  const [customFields, setCustomFields] = useState<Record<string, any>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [contactErrors, setContactErrors] = useState<ContactValidationErrors>({});
  const contactsSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen && client) {
      setName(client.name || '');
      setLocation(client.location || '');
      setWebsite(client.website || '');
      setBoardNumber(client.boardNumber || '');
      setContacts(buildInitialClientContacts(client));
      setCustomFields(
        client.customFields && typeof client.customFields === 'object'
          ? { ...client.customFields }
          : {}
      );
      setIsSaving(false);
      setValidationAttempted(false);
      setContactErrors({});

      if (initialFocusSection === 'contacts') {
        const timer = window.setTimeout(() => {
          contactsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 120);
        return () => window.clearTimeout(timer);
      }
    }
  }, [isOpen, client, initialFocusSection]);

  if (!client) return null;

  const isNameInvalid = validationAttempted && !name.trim();
  const isLocationInvalid = validationAttempted && !location.trim();

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
      showToast('Client Updated', `${updatedClient.name} details saved.`, 'success');
      onClose();
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

  const fieldBaseClass =
    'w-full h-9 px-3 bg-white border rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none transition-colors';

  return (
    <AnimatedModal
      isOpen={isOpen}
      onBackdropClick={() => !isSaving && onClose()}
      zIndexClass="z-50"
      panelClassName="bg-white rounded-xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
      ariaLabel={`Edit Client Account ${client.name}`}
    >
      <ModalHeader
        icon={<Building2 className="w-4 h-4" />}
        title="Edit Client Account"
        subtitle={`Update company details and hiring contacts for ${client.name}`}
        onClose={onClose}
        closeDisabled={isSaving}
      />

      <form noValidate onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Section 1: Company Profile */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Company Details
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="edit-client-name"
                  className="block text-[11px] font-medium text-slate-700 mb-1"
                >
                  Company Name *
                </label>
                <input
                  id="edit-client-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Horizon Digital Solutions Inc"
                  className={`${fieldBaseClass} ${
                    isNameInvalid
                      ? INVALID_FIELD_CLASSES
                      : 'border-slate-200 focus:border-brand-600'
                  }`}
                />
              </div>

              <div>
                <label
                  htmlFor="edit-client-location"
                  className="block text-[11px] font-medium text-slate-700 mb-1"
                >
                  HQ Location *
                </label>
                <input
                  id="edit-client-location"
                  type="text"
                  required
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Austin, TX"
                  className={`${fieldBaseClass} ${
                    isLocationInvalid
                      ? INVALID_FIELD_CLASSES
                      : 'border-slate-200 focus:border-brand-600'
                  }`}
                />
              </div>

              <div>
                <label
                  htmlFor="edit-client-website"
                  className="block text-[11px] font-medium text-slate-700 mb-1"
                >
                  Website
                </label>
                <input
                  id="edit-client-website"
                  type="text"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="e.g. www.company.com"
                  className={`${fieldBaseClass} border-slate-200 focus:border-brand-600`}
                />
              </div>

              <div>
                <label
                  htmlFor="edit-client-phone"
                  className="block text-[11px] font-medium text-slate-700 mb-1"
                >
                  Main Board Phone
                </label>
                <input
                  id="edit-client-phone"
                  type="text"
                  value={boardNumber}
                  onChange={(e) => setBoardNumber(e.target.value)}
                  placeholder="(555) 123-4567"
                  className={`${fieldBaseClass} border-slate-200 focus:border-brand-600`}
                />
              </div>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Section 2: Hiring Contacts */}
          <EntityContactsEditor
            title="Hiring Contacts"
            subtitle="Manage account leads linked to requisitions and placement approvals."
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

          <DynamicCustomFieldsSection
            entity="client"
            values={customFields}
            onChange={setCustomFields}
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
