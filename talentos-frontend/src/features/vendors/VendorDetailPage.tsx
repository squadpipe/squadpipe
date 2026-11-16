import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Handshake,
  Layers,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  ShieldCheck,
  Star,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { BillablePlacement, Vendor, VendorContact } from '../../types';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { ActionButton } from '../../components/shared/ActionButton';
import { TablePagination } from '../../components/shared/TablePagination';
import { MaskedValue } from '../../components/shared/MaskedValue';
import { CustomSelect } from '../../components/shared/CustomSelect';
import { DynamicCustomFieldsSection } from '../../components/shared/DynamicCustomFieldsSection';
import { useClientPagination } from '../../utils/usePagination';

interface VendorDetailPageProps {
  vendor: Vendor | null;
  backLabel?: string;
  onBack: () => void;
  placements?: BillablePlacement[];
  rateMasked?: boolean;
  initialEditing?: boolean;
  onUpdateVendor?: (vendor: Vendor) => Promise<void> | void;
  onDeleteVendor?: (vendor: Vendor) => Promise<void> | void;
}

const buildInitialVendorContacts = (v: Vendor): VendorContact[] =>
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

export const VendorDetailPage: React.FC<VendorDetailPageProps> = ({
  vendor,
  backLabel = 'Back to Vendors',
  onBack,
  placements = [],
  rateMasked = false,
  initialEditing = false,
  onUpdateVendor,
  onDeleteVendor,
}) => {
  const [isEditing, setIsEditing] = useState(initialEditing);
  const [editForm, setEditForm] = useState<Vendor | null>(
    vendor ? { ...vendor, contacts: buildInitialVendorContacts(vendor) } : null
  );
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setEditForm(
      vendor ? { ...vendor, contacts: buildInitialVendorContacts(vendor) } : null
    );
    setIsEditing(Boolean(initialEditing));
    setIsSaving(false);
    setShowDeleteConfirm(false);
    setIsDeleting(false);
  }, [vendor?.id, initialEditing]);

  useEffect(() => {
    if (vendor && !isEditing) {
      setEditForm({ ...vendor, contacts: buildInitialVendorContacts(vendor) });
    }
  }, [vendor, isEditing]);

  const vendorPlacements = vendor
    ? placements.filter(
        (p) =>
          (p.vendorId && p.vendorId === vendor.id) ||
          (p.vendorName && p.vendorName.trim().toLowerCase() === vendor.name.trim().toLowerCase())
      )
    : [];
  const contactList = vendor ? buildInitialVendorContacts(vendor) : [];
  const contactsPg = useClientPagination(contactList, 10, vendor?.id);
  const placementsPg = useClientPagination(vendorPlacements, 10, vendor?.id);

  if (!vendor) {
    return (
      <section className="max-w-7xl mx-auto py-16 text-center space-y-3 animate-fade-in">
        <p className="text-sm font-semibold text-slate-700">Vendor record not found.</p>
        <button
          type="button"
          onClick={onBack}
          className="px-3.5 py-2 rounded-lg bg-brand-600 text-white text-xs font-semibold hover:bg-brand-700 inline-flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{backLabel}</span>
        </button>
      </section>
    );
  }

  const isMsaExecuted = vendor.msa === 'Yes' || vendor.msa === 'Active';
  const primaryContact = contactList.find((c) => c.isPrimary) || contactList[0];

  const specializations = vendor.skillSpecialization
    ? vendor.skillSpecialization
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const customFieldEntries = Object.entries(vendor.customFields || {}).filter(
    ([, v]) => v !== null && v !== undefined && String(v).trim() !== ''
  );

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm || !onUpdateVendor || isSaving) return;

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
      setIsEditing(false);
    } catch {
      // Error toast handled by parent caller
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="max-w-7xl mx-auto space-y-4 animate-fade-in">
      {/* Slim Breadcrumb */}
      <div className="flex items-center gap-2 text-xs">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-semibold shadow-2xs transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{backLabel}</span>
        </button>
        <span className="text-slate-300">/</span>
        <span className="text-[11px] font-semibold text-slate-800 truncate">{vendor.name}</span>
      </div>

      {/* Main Header Card */}
      <div className="bg-white rounded-xl border border-slate-200/80 card-shadow px-5 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100 shadow-2xs shrink-0">
            <Handshake className="w-5 h-5" />
          </div>
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-lg font-bold text-slate-900 tracking-tight truncate">
                {vendor.name}
              </h1>
              <StatusBadge
                label={isMsaExecuted ? 'MSA Executed' : 'Pending Review'}
                tone={isMsaExecuted ? 'emerald' : 'amber'}
                size="xs"
              />
            </div>
            <div className="flex items-center gap-2.5 text-xs text-slate-500 flex-wrap">
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3 h-3 text-slate-400" />
                <span>{vendor.location || 'Location not specified'}</span>
              </span>
              {vendor.paymentTerms && (
                <>
                  <span className="text-slate-300">&bull;</span>
                  <span className="font-semibold text-slate-700">{vendor.paymentTerms}</span>
                </>
              )}
              {primaryContact?.email && (
                <>
                  <span className="text-slate-300">&bull;</span>
                  <span>{primaryContact.email}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
          {onUpdateVendor && (
            <button
              type="button"
              onClick={() => {
                setEditForm({
                  ...vendor,
                  contacts:
                    contactList.length > 0
                      ? contactList
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
                setIsEditing((prev) => !prev);
              }}
              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                isEditing
                  ? 'bg-slate-900 border-slate-900 text-white'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>{isEditing ? 'Close Editor' : 'Edit Vendor'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Inline Full-Width Edit Vendor Panel */}
      {isEditing && editForm && (
        <form
          onSubmit={handleSaveEdit}
          className="bg-white rounded-xl border border-slate-200/80 card-shadow p-5 space-y-4 text-xs"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Edit Vendor Details &amp; Contacts
            </h2>
            <button
              type="button"
              disabled={isSaving}
              onClick={() => setIsEditing(false)}
              className="text-slate-400 hover:text-slate-700 p-1 rounded cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Vendor Company *
              </label>
              <input
                type="text"
                required
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Location</label>
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Invoicing</label>
              <input
                type="text"
                value={editForm.invoicingTerms}
                onChange={(e) => setEditForm({ ...editForm, invoicingTerms: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                MSA Status
              </label>
              <CustomSelect
                value={editForm.msa === 'Yes' || editForm.msa === 'Active' ? 'Yes' : 'Pending'}
                onChange={(val) => setEditForm({ ...editForm, msa: val })}
                ariaLabel="MSA Status"
                options={[
                  { value: 'Yes', label: 'MSA Executed' },
                  { value: 'Pending', label: 'Pending Review' },
                ]}
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
                      className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded border cursor-pointer transition-colors ${
                        contact.isPrimary
                          ? 'bg-[#141615] text-white border-[#141615]'
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
            isOpen={isEditing}
          />

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => setIsEditing(false)}
              className="px-3.5 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
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
      )}

      {/* Main 2-Column Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        {/* Left Column: Vendor Contacts + Linked Billable Placements */}
        <div className="lg:col-span-2 space-y-4">
          {/* Contacts Card */}
          <section className="bg-white rounded-xl border border-slate-200/80 card-shadow overflow-hidden text-xs">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-brand-600" />
                <h2 className="font-bold text-slate-900">
                  Vendor Contacts ({contactList.length})
                </h2>
              </div>
              {onUpdateVendor && !isEditing && (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="text-brand-600 font-semibold hover:underline text-xs inline-flex items-center gap-1 cursor-pointer"
                >
                  <Pencil className="w-3 h-3" />
                  <span>Manage Contacts</span>
                </button>
              )}
            </div>
            {contactList.length === 0 ? (
              <div className="py-10 text-center text-slate-400">
                No contacts recorded for this vendor yet.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase">
                      <tr>
                        <th className="px-4 py-2.5">Contact</th>
                        <th className="px-4 py-2.5">Designation</th>
                        <th className="px-4 py-2.5">Email</th>
                        <th className="px-4 py-2.5">Phone</th>
                        <th className="px-4 py-2.5 text-right">Role</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {contactsPg.pagedItems.map((cnt, idx) => (
                        <tr key={cnt.id || idx} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">
                            {cnt.fullName || 'Unnamed Contact'}
                          </td>
                          <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                            {cnt.designation || '—'}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {cnt.email ? (
                              <a
                                href={`mailto:${cnt.email}`}
                                className="inline-flex items-center gap-1 hover:text-brand-600"
                              >
                                <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                                <span>{cnt.email}</span>
                              </a>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                            {cnt.phone ? (
                              <a
                                href={`tel:${cnt.phone}`}
                                className="inline-flex items-center gap-1 font-medium hover:text-brand-600"
                              >
                                <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                                <span>{cnt.phone}</span>
                              </a>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            {cnt.isPrimary ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-[#141615] text-white">
                                <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                                <span>Primary</span>
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400">Contact</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <TablePagination
                  page={contactsPg.page}
                  limit={contactsPg.limit}
                  total={contactsPg.total}
                  onPageChange={contactsPg.setPage}
                  onLimitChange={contactsPg.setLimit}
                  itemLabel="contacts"
                  pageSizeOptions={[10, 20, 50]}
                />
              </>
            )}
          </section>

          {/* Vendor Placements */}
          <section className="bg-white rounded-xl border border-slate-200/80 card-shadow overflow-hidden text-xs">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-bold text-slate-900">
                Associated C2C Placements ({vendorPlacements.length})
              </h2>
            </div>
            {vendorPlacements.length === 0 ? (
              <div className="py-10 text-center text-slate-400">
                No active or historical placements linked to this vendor yet.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase">
                      <tr>
                        <th className="px-4 py-2.5">Consultant</th>
                        <th className="px-4 py-2.5">Client</th>
                        <th className="px-4 py-2.5">Role / Skill</th>
                        <th className="px-4 py-2.5">Contract Period</th>
                        <th className="px-4 py-2.5">Pay Rate</th>
                        <th className="px-4 py-2.5 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {placementsPg.pagedItems.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">
                            {p.resourceName}
                          </td>
                          <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                            {p.customer}
                          </td>
                          <td className="px-4 py-3 text-slate-600">{p.skillRole}</td>
                          <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                            {p.startDate} &rarr; {p.endDate}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <MaskedValue value={p.payRate || '—'} isMasked={rateMasked} />
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <StatusBadge stage={p.status} size="xs" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <TablePagination
                  page={placementsPg.page}
                  limit={placementsPg.limit}
                  total={placementsPg.total}
                  onPageChange={placementsPg.setPage}
                  onLimitChange={placementsPg.setLimit}
                  itemLabel="placements"
                  pageSizeOptions={[10, 20, 50]}
                />
              </>
            )}
          </section>
        </div>

        {/* Right Sidebar: Commercial Terms, Specializations, Custom Attributes & Delete */}
        <aside className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200/80 card-shadow p-4 space-y-3 text-xs">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Commercial &amp; Compliance
              </h3>
            </div>
            <dl className="space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <dt className="text-slate-400 font-medium">MSA Status</dt>
                <dd className="text-slate-800 font-semibold text-right">
                  {isMsaExecuted ? 'MSA Executed' : 'Pending Review'}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-2">
                <dt className="text-slate-400 font-medium">Payment Terms</dt>
                <dd className="text-slate-800 font-medium text-right">
                  {vendor.paymentTerms || '—'}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-2">
                <dt className="text-slate-400 font-medium">Invoicing Schedule</dt>
                <dd className="text-slate-800 font-medium text-right">
                  {vendor.invoicingTerms || '—'}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-2">
                <dt className="text-slate-400 font-medium">Location</dt>
                <dd className="text-slate-800 font-medium text-right">
                  {vendor.location || '—'}
                </dd>
              </div>
            </dl>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/80 card-shadow p-4 space-y-2.5 text-xs">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Skill Specializations
            </h3>
            {specializations.length === 0 ? (
              <p className="text-[11px] text-slate-400">No specializations listed.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {specializations.map((sk, idx) => (
                  <span
                    key={idx}
                    className="text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-medium"
                  >
                    {sk}
                  </span>
                ))}
              </div>
            )}
          </div>

          {customFieldEntries.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200/80 card-shadow p-4 space-y-2.5 text-xs">
              <div className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-brand-600" />
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Custom Attributes
                </h3>
              </div>
              <dl className="space-y-1.5">
                {customFieldEntries.map(([k, v]) => (
                  <div key={k} className="flex items-start justify-between gap-2">
                    <dt className="text-slate-400 font-medium capitalize">
                      {k.replace(/_/g, ' ')}
                    </dt>
                    <dd className="text-slate-800 font-medium text-right break-words">
                      {String(v)}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {onDeleteVendor && (
            <div className="bg-white rounded-xl border border-slate-200/80 card-shadow p-4 space-y-2.5 text-xs">
              {!showDeleteConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full px-3 py-2 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 font-semibold text-xs inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Vendor</span>
                </button>
              ) : (
                <div className="space-y-2.5">
                  <div className="flex items-start gap-2 text-rose-700 text-[11px]">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      Permanently remove <strong>{vendor.name}</strong> from Staffing Vendors?
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-[11px] font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <ActionButton
                      type="button"
                      loading={isDeleting}
                      loadingText="Deleting..."
                      onClick={async () => {
                        setIsDeleting(true);
                        try {
                          await onDeleteVendor(vendor);
                          onBack();
                        } catch {
                          // Error toast displayed by parent caller
                        } finally {
                          setIsDeleting(false);
                        }
                      }}
                      className="flex-1 px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-semibold cursor-pointer"
                    >
                      Confirm Delete
                    </ActionButton>
                  </div>
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </section>
  );
};
