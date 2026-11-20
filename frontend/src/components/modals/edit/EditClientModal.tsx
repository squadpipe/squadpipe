import React, { useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';
import { apiClient } from '../../../config/api.config';
import { Client } from '../../../types';
import { ActionButton } from '../../shared/ActionButton';
import { DynamicCustomFieldsSection } from '../../shared/DynamicCustomFieldsSection';
import { AnimatedModal, ModalHeader } from '../../shared/MotionPrimitives';
import {
  formatMissingFieldsMessage,
  getMissingFieldLabels,
  INVALID_FIELD_CLASSES,
} from '../../../utils/formValidation';

interface EditClientModalProps {
  client: Client | null;
  isOpen: boolean;
  onClose: () => void;
  onClientUpdated?: (updatedClient: Client) => void;
  showToast: (title: string, message: string, icon?: string) => void;
}

export const EditClientModal: React.FC<EditClientModalProps> = ({
  client,
  isOpen,
  onClose,
  onClientUpdated,
  showToast,
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [form, setForm] = useState({
    name: client?.name || '',
    website: client?.website || '',
    boardNumber: client?.boardNumber || '',
    location: client?.location || '',
    customFields: (client?.customFields || {}) as Record<string, string>,
  });

  useEffect(() => {
    if (client && isOpen) {
      setForm({
        name: client.name || '',
        website: client.website || '',
        boardNumber: client.boardNumber || '',
        location: client.location || '',
        customFields: (client.customFields || {}) as Record<string, string>,
      });
      setIsSaving(false);
      setValidationAttempted(false);
    }
  }, [client, isOpen]);

  const isNameInvalid = validationAttempted && !form.name.trim();
  const isLocationInvalid = validationAttempted && !form.location.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving || !client) return;
    const missingFields = getMissingFieldLabels([
      { label: 'Company Name', valid: Boolean(form.name.trim()) },
      { label: 'HQ Location', valid: Boolean(form.location.trim()) },
    ]);
    if (missingFields.length > 0) {
      setValidationAttempted(true);
      showToast('Validation Error', formatMissingFieldsMessage(missingFields), 'warning');
      return;
    }
    setValidationAttempted(false);
    setIsSaving(true);
    try {
      await apiClient.put(`/clients/${client.id}`, form);
      const updatedClient: Client = {
        ...client,
        name: form.name,
        website: form.website,
        boardNumber: form.boardNumber,
        location: form.location,
        customFields: form.customFields,
      };
      if (onClientUpdated) onClientUpdated(updatedClient);
      showToast('Client Updated', `${updatedClient.name} saved.`);
      onClose();
    } catch (err: any) {
      showToast('Update Failed', err?.response?.data?.message || 'Could not update client.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatedModal
      isOpen={Boolean(isOpen && client)}
      onBackdropClick={() => !isSaving && onClose()}
      zIndexClass="z-50"
      panelClassName="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
      ariaLabel="Edit Client Account"
    >
      {client && (
        <>
        <ModalHeader
          icon={<Building2 className="w-4 h-4" />}
          title="Edit Client Account"
          subtitle={client.name}
          onClose={onClose}
          closeDisabled={isSaving}
        />

        <form noValidate onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 overflow-y-auto space-y-4 text-xs flex-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-semibold text-slate-700">
                    Company Name *
                  </label>
                  {isNameInvalid && <span className="text-[11px] font-semibold text-rose-600">Required</span>}
                </div>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg text-xs focus:outline-none ${
                    isNameInvalid ? INVALID_FIELD_CLASSES : 'bg-white border-slate-200 focus:border-brand-600'
                  }`}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Website
                </label>
                <input
                  type="text"
                  value={form.website}
                  onChange={(e) => setForm({ ...form, website: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Phone
                </label>
                <input
                  type="text"
                  value={form.boardNumber}
                  onChange={(e) => setForm({ ...form, boardNumber: e.target.value })}
                  placeholder="+1 (800) 000-0000"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-semibold text-slate-700">
                    HQ Location *
                  </label>
                  {isLocationInvalid && <span className="text-[11px] font-semibold text-rose-600">Required</span>}
                </div>
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg text-xs focus:outline-none ${
                    isLocationInvalid ? INVALID_FIELD_CLASSES : 'bg-white border-slate-200 focus:border-brand-600'
                  }`}
                />
              </div>
            </div>

            <DynamicCustomFieldsSection
              entity="client"
              values={form.customFields || {}}
              onChange={(vals) => setForm({ ...form, customFields: vals })}
              isOpen={isOpen}
            />
          </div>

          <div className="px-6 py-3.5 bg-slate-50/60 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              disabled={isSaving}
              onClick={onClose}
              className="h-8 px-3.5 border border-slate-200 bg-white rounded-lg text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
            >
              Cancel
            </button>
            <ActionButton
              type="submit"
              loading={isSaving}
              loadingText="Saving..."
              className="h-8 px-4 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-[11px] font-semibold cursor-pointer inline-flex items-center"
            >
              Save Changes
            </ActionButton>
          </div>
        </form>
        </>
      )}
    </AnimatedModal>
  );
};
