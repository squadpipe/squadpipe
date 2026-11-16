import React, { useEffect, useState } from 'react';
import { Building2, X } from 'lucide-react';
import { apiClient } from '../../../config/api.config';
import { Client } from '../../../types';
import { ActionButton } from '../../shared/ActionButton';
import { DynamicCustomFieldsSection } from '../../shared/DynamicCustomFieldsSection';

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
    }
  }, [client, isOpen]);

  if (!isOpen || !client) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
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
    <div
      onClick={() => !isSaving && onClose()}
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col animate-fade-in max-h-[92vh]"
      >
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-[#141615] text-white shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white shrink-0">
              <Building2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-white truncate">Edit Client Account</h2>
              <div className="text-[11px] text-slate-400 mt-0.5 truncate">{client.name}</div>
            </div>
          </div>
          <button
            type="button"
            disabled={isSaving}
            onClick={onClose}
            aria-label="Close modal"
            className="text-slate-400 hover:text-white w-7 h-7 rounded flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 overflow-y-auto space-y-4 text-xs flex-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Company Name *
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
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
                  Main Switchboard
                </label>
                <input
                  type="text"
                  value={form.boardNumber}
                  onChange={(e) => setForm({ ...form, boardNumber: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  HQ Location *
                </label>
                <input
                  type="text"
                  required
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
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

          <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              disabled={isSaving}
              onClick={onClose}
              className="px-3.5 py-1.5 border border-slate-200 bg-white rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
            >
              Cancel
            </button>
            <ActionButton
              type="submit"
              loading={isSaving}
              loadingText="Saving..."
              className="px-4 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
            >
              Save Changes
            </ActionButton>
          </div>
        </form>
      </div>
    </div>
  );
};
