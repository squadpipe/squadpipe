import React, { useEffect, useState } from 'react';
import { Handshake, Plus, Star, Trash2 } from 'lucide-react';
import { Vendor, VendorContact } from '../../../types';
import { ActionButton } from '../../shared/ActionButton';
import { CustomSelect } from '../../shared/CustomSelect';
import { DynamicCustomFieldsSection } from '../../shared/DynamicCustomFieldsSection';
import { AnimatedModal, ModalHeader } from '../../shared/MotionPrimitives';
import { INVALID_FIELD_CLASSES } from '../../../utils/formValidation';

export const buildInitialVendorContacts = (v: Vendor): VendorContact[] =>
  v.contacts && v.contacts.length > 0
    ? v.contacts.map((c) => ({ ...c }))
    : v.contactName || v.email || v.phone
    ? [
        {
          fullName: v.contactName || '',
          designation: '',
          phone: v.phone || '',
          email: v.email || '',
          isPrimary: true,
        },
      ]
    : [];

interface EditVendorModalProps {
  vendor: Vendor | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateVendor: (vendor: Vendor) => Promise<void> | void;
}

export const EditVendorModal: React.FC<EditVendorModalProps> = ({
  vendor,
  isOpen,
  onClose,
  onUpdateVendor,
}) => {
  const [editForm, setEditForm] = useState<Vendor | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [validationAttempted, setValidationAttempted] = useState(false);

  useEffect(() => {
    if (vendor && isOpen) {
      const contacts = buildInitialVendorContacts(vendor);
      setEditForm({
        ...vendor,
        contacts:
          contacts.length > 0
            ? contacts
            : [
                {
                  fullName: '',
                  designation: '',
                  phone: '',
                  email: '',
                  isPrimary: true,
                },
              ],
      });
      setIsSaving(false);
      setValidationAttempted(false);
    }
  }, [vendor, isOpen]);

  const isVendorNameInvalid = validationAttempted && !editForm?.name.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving || !editForm) return;
    if (!editForm.name.trim()) {
      setValidationAttempted(true);
      return;
    }
    setValidationAttempted(false);

    const contacts = (editForm.contacts || []).filter(
      (c) => c.fullName.trim() || c.email.trim()
    );
    const primary = contacts.find((c) => c.isPrimary) || contacts[0];
    const payload: Vendor = {
      ...editForm,
      contactName: primary?.fullName || editForm.contactName,
      email: primary?.email || editForm.email,
      phone: primary?.phone || editForm.phone,
      contacts,
    };

    setIsSaving(true);
    try {
      await onUpdateVendor(payload);
      onClose();
    } catch {
      // Error toast handled by caller
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatedModal
      isOpen={Boolean(isOpen && vendor && editForm)}
      onBackdropClick={() => !isSaving && onClose()}
      zIndexClass="z-50"
      panelClassName="bg-white rounded-xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
      ariaLabel="Edit Vendor Partner"
    >
      {vendor && editForm && (
        <>
        <ModalHeader
          icon={<Handshake className="w-4 h-4" />}
          title="Edit Vendor Details & Contacts"
          subtitle={vendor.name}
          onClose={onClose}
          closeDisabled={isSaving}
        />

        <form noValidate onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 overflow-y-auto space-y-4 text-xs flex-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-semibold text-slate-700">
                    Vendor Company *
                  </label>
                  {isVendorNameInvalid && <span className="text-[11px] font-semibold text-rose-600">Required</span>}
                </div>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg text-xs focus:outline-none ${
                    isVendorNameInvalid ? INVALID_FIELD_CLASSES : 'border-slate-200 focus:border-brand-600'
                  }`}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Location
                </label>
                <input
                  type="text"
                  value={editForm.location}
                  onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Specialization
                </label>
                <input
                  type="text"
                  value={editForm.skillSpecialization}
                  onChange={(e) =>
                    setEditForm({ ...editForm, skillSpecialization: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Payment Terms
                </label>
                <CustomSelect
                  value={editForm.paymentTerms}
                  onChange={(val) => setEditForm({ ...editForm, paymentTerms: val })}
                  ariaLabel="Payment Terms"
                  options={['Net 15', 'Net 30', 'Net 45', 'Net 60']}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Invoicing
                </label>
                <input
                  type="text"
                  value={editForm.invoicingTerms}
                  onChange={(e) => setEditForm({ ...editForm, invoicingTerms: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Agreement Status
                </label>
                <CustomSelect
                  value={editForm.msa === 'Yes' || editForm.msa === 'Active' ? 'Yes' : 'Pending'}
                  onChange={(val) => setEditForm({ ...editForm, msa: val })}
                  ariaLabel="Agreement Status"
                  options={[
                    { value: 'Yes', label: 'MSA Executed' },
                    { value: 'Pending', label: 'Pending Review' },
                  ]}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Insurance Expiry Date
                </label>
                <input
                  type="date"
                  value={editForm.coiExpiryDate || ''}
                  onChange={(e) => setEditForm({ ...editForm, coiExpiryDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                />
              </div>
            </div>

            {/* Multi-Contact Editor */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Vendor Contacts ({(editForm.contacts || []).length})
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setEditForm({
                      ...editForm,
                      contacts: [
                        ...(editForm.contacts || []),
                        {
                          fullName: '',
                          designation: '',
                          phone: '',
                          email: '',
                          isPrimary: (editForm.contacts || []).length === 0,
                        },
                      ],
                    })
                  }
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-slate-200 text-brand-600 hover:bg-brand-50 text-[11px] font-semibold cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Contact</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(editForm.contacts || []).map((contact, idx) => (
                  <div
                    key={contact.id || idx}
                    className="p-3 rounded-lg bg-white border border-slate-200 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setEditForm({
                            ...editForm,
                            contacts: (editForm.contacts || []).map((c, cIdx) => ({
                              ...c,
                              isPrimary: cIdx === idx,
                            })),
                          })
                        }
                        className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded border cursor-pointer transition-colors ${
                          contact.isPrimary
                            ? 'bg-white text-amber-700 border-amber-300'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <Star
                          className={`w-2.5 h-2.5 ${
                            contact.isPrimary ? 'fill-amber-400 text-amber-400' : 'text-slate-400'
                          }`}
                        />
                        <span>{contact.isPrimary ? 'Primary Contact' : 'Set Primary'}</span>
                      </button>
                      {(editForm.contacts || []).length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const next = (editForm.contacts || []).filter(
                              (_, cIdx) => cIdx !== idx
                            );
                            if (next.length > 0 && !next.some((c) => c.isPrimary)) {
                              next[0].isPrimary = true;
                            }
                            setEditForm({ ...editForm, contacts: next });
                          }}
                          title="Remove contact"
                          className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        required
                        placeholder="Full name *"
                        value={contact.fullName}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            contacts: (editForm.contacts || []).map((c, cIdx) =>
                              cIdx === idx ? { ...c, fullName: e.target.value } : c
                            ),
                          })
                        }
                        className="px-2.5 py-1.5 border border-slate-200 rounded-md text-xs focus:border-brand-600 focus:outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Designation / Role"
                        value={contact.designation || ''}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            contacts: (editForm.contacts || []).map((c, cIdx) =>
                              cIdx === idx ? { ...c, designation: e.target.value } : c
                            ),
                          })
                        }
                        className="px-2.5 py-1.5 border border-slate-200 rounded-md text-xs focus:border-brand-600 focus:outline-none"
                      />
                      <input
                        type="email"
                        required
                        placeholder="Email *"
                        value={contact.email}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            contacts: (editForm.contacts || []).map((c, cIdx) =>
                              cIdx === idx ? { ...c, email: e.target.value } : c
                            ),
                          })
                        }
                        className="px-2.5 py-1.5 border border-slate-200 rounded-md text-xs focus:border-brand-600 focus:outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Phone"
                        value={contact.phone || ''}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            contacts: (editForm.contacts || []).map((c, cIdx) =>
                              cIdx === idx ? { ...c, phone: e.target.value } : c
                            ),
                          })
                        }
                        className="px-2.5 py-1.5 border border-slate-200 rounded-md text-xs focus:border-brand-600 focus:outline-none"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <DynamicCustomFieldsSection
              entity="vendor"
              values={(editForm.customFields as Record<string, string>) || {}}
              onChange={(vals) => setEditForm({ ...editForm, customFields: vals })}
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
