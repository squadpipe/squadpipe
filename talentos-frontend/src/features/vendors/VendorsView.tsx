import React, { useState, useEffect } from 'react';
import { Pencil, Plus, Search, Star, Trash2, Users, X } from 'lucide-react';
import { apiClient } from '../../config/api.config';
import { Vendor, VendorContact } from '../../types';
import { TablePagination } from '../../components/shared/TablePagination';
import { useDebounce } from '../../utils/useDebounce';
import { mapVendorFromApi } from '../../utils/entityMappers';

interface VendorsViewProps {
  vendors: Vendor[];
  onOpenAddVendor: () => void;
  onUpdateVendor?: (vendor: Vendor) => void;
  onDeleteVendor?: (vendor: Vendor) => void;
}

export const VendorsView: React.FC<VendorsViewProps> = ({
  vendors,
  onOpenAddVendor,
  onUpdateVendor,
  onDeleteVendor,
}) => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [tableRows, setTableRows] = useState<Vendor[]>(() => vendors.slice(0, 10));
  const [totalRows, setTotalRows] = useState(vendors.length);
  const [isLoadingRows, setIsLoadingRows] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);

  const debouncedSearch = useDebounce(search, 150);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    let active = true;
    const q = debouncedSearch.toLowerCase();
    const localFiltered = vendors.filter(
      (v) =>
        !q ||
        v.name.toLowerCase().includes(q) ||
        v.skillSpecialization.toLowerCase().includes(q) ||
        v.contactName.toLowerCase().includes(q) ||
        v.location.toLowerCase().includes(q)
    );

    if (vendors.length > 0) {
      setTotalRows(localFiltered.length);
      setTableRows(localFiltered.slice((page - 1) * limit, page * limit));
      setIsLoadingRows(false);
    } else {
      setIsLoadingRows(true);
    }

    apiClient
      .get('/vendors', {
        params: {
          search: debouncedSearch.trim() || undefined,
          page,
          limit,
        },
      })
      .then((res) => {
        if (!active) return;
        if (res.data?.success && Array.isArray(res.data.data)) {
          const mapped = res.data.data.map(mapVendorFromApi);
          setTableRows(mapped);
          setTotalRows(res.data.pagination?.total ?? mapped.length);
        }
      })
      .catch(() => {
        if (!active) return;
        setTotalRows(localFiltered.length);
        setTableRows(localFiltered.slice((page - 1) * limit, page * limit));
      })
      .finally(() => {
        if (active) setIsLoadingRows(false);
      });
    return () => {
      active = false;
    };
  }, [debouncedSearch, page, limit, vendors]);

  const filtered = tableRows;

  return (
    <section className="max-w-7xl mx-auto space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Staffing Vendors & Partners</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Sub-tier staffing agencies, C2C vendors, payment terms, and MSA contract tracking.
          </p>
        </div>
        <button
          onClick={onOpenAddVendor}
          className="px-3.5 py-1.5 rounded-md bg-brand-600 text-white text-xs font-medium hover:bg-brand-700 shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={2.4} />
          <span>Add Vendor</span>
        </button>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-xl border border-slate-200 card-shadow overflow-hidden">
        {/* Search Bar */}
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <span className="font-semibold text-xs text-slate-900">
            {totalRows} Registered Vendors
          </span>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search staffing vendors, terms..."
              className="pl-8 pr-3 py-1 text-xs border border-slate-200 rounded-md bg-white w-64 text-slate-700 outline-none focus:border-brand-500"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase">
              <tr>
                <th className="px-4 py-3">Vendor Company</th>
                <th className="px-4 py-3">Contacts</th>
                <th className="px-4 py-3">Phone & Email</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Specialization</th>
                <th className="px-4 py-3">Payment Terms</th>
                <th className="px-4 py-3">Invoicing</th>
                <th className="px-4 py-3">MSA Status</th>
                {(onUpdateVendor || onDeleteVendor) && <th className="px-4 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={onUpdateVendor || onDeleteVendor ? 9 : 8}
                    className="px-6 py-10 text-center text-xs text-slate-400"
                  >
                    {search.trim() ? (
                      <>
                        No staffing vendors match your search.{' '}
                        <button
                          type="button"
                          onClick={() => setSearch('')}
                          className="font-semibold text-brand-600 hover:text-brand-700 hover:underline cursor-pointer"
                        >
                          Clear Search
                        </button>
                      </>
                    ) : (
                      <>
                        No staffing vendors found. Click{' '}
                        <button
                          type="button"
                          onClick={onOpenAddVendor}
                          className="font-semibold text-brand-600 hover:text-brand-700 hover:underline cursor-pointer"
                        >
                          Add Vendor
                        </button>{' '}
                        to register a sub-tier partner.
                      </>
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map((v) => {
                const isMsaExecuted = v.msa === 'Yes' || v.msa === 'Active';
                const contactList: VendorContact[] =
                  v.contacts && v.contacts.length > 0
                    ? v.contacts
                    : v.contactName || v.email
                    ? [{ fullName: v.contactName, phone: v.phone, email: v.email, isPrimary: true }]
                    : [];
                const primaryContact = contactList.find((c) => c.isPrimary) || contactList[0];
                const extraCount = Math.max(0, contactList.length - 1);
                return (
                  <tr key={v.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-900">{v.name}</td>
                    <td className="px-4 py-3 text-slate-800">
                      <div
                        className="flex items-center gap-1.5"
                        title={contactList.map((c) => `${c.fullName}${c.email ? ` (${c.email})` : ''}`).join(', ')}
                      >
                        <span className="font-medium">{primaryContact?.fullName || v.contactName || '—'}</span>
                        {extraCount > 0 && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-semibold">
                            <Users className="w-2.5 h-2.5" />+{extraCount}
                          </span>
                        )}
                      </div>
                      {primaryContact?.designation && (
                        <div className="text-[10px] text-slate-400">{primaryContact.designation}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-slate-500">
                      {primaryContact?.phone || v.phone || '—'} <br />
                      {primaryContact?.email || v.email || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{v.location}</td>
                    <td className="px-4 py-3 text-[10px]">{v.skillSpecialization}</td>
                    <td className="px-4 py-3 font-medium">{v.paymentTerms}</td>
                    <td className="px-4 py-3 text-slate-600">{v.invoicingTerms}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-semibold border ${
                          isMsaExecuted
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {isMsaExecuted ? 'MSA Executed' : 'Pending Review'}
                      </span>
                    </td>
                    {(onUpdateVendor || onDeleteVendor) && (
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          {onUpdateVendor && (
                            <button
                              onClick={() => {
                                const initialContacts: VendorContact[] =
                                  v.contacts && v.contacts.length > 0
                                    ? v.contacts.map((c) => ({ ...c }))
                                    : [
                                        {
                                          fullName: v.contactName || '',
                                          designation: '',
                                          phone: v.phone || '',
                                          email: v.email || '',
                                          isPrimary: true,
                                        },
                                      ];
                                setEditingVendor({ ...v, contacts: initialContacts });
                              }}
                              title="Edit vendor"
                              className="p-1.5 text-slate-400 hover:text-brand-600 rounded hover:bg-brand-50 transition-colors cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {onDeleteVendor && (
                            <button
                              onClick={() => onDeleteVendor(v)}
                              title="Delete vendor"
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
              )}
            </tbody>
          </table>
        </div>
        <TablePagination
          page={page}
          limit={limit}
          total={totalRows}
          onPageChange={setPage}
          onLimitChange={(nextLimit) => {
            setLimit(nextLimit);
            setPage(1);
          }}
          itemLabel="vendors"
          isLoading={isLoadingRows}
        />
      </div>

      {/* Edit Vendor Modal */}
      {editingVendor && (
        <div
          onClick={() => setEditingVendor(null)}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-scale-up max-h-[90vh] flex flex-col"
          >
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Edit Vendor</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">{editingVendor.name}</p>
              </div>
              <button
                onClick={() => setEditingVendor(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const contacts = (editingVendor.contacts || []).filter(
                  (c) => c.fullName.trim() || c.email.trim()
                );
                const primary = contacts.find((c) => c.isPrimary) || contacts[0];
                const payload: Vendor = {
                  ...editingVendor,
                  contactName: primary?.fullName || editingVendor.contactName,
                  email: primary?.email || editingVendor.email,
                  phone: primary?.phone || editingVendor.phone,
                  contacts,
                };
                if (onUpdateVendor) onUpdateVendor(payload);
                setEditingVendor(null);
              }}
              className="p-6 space-y-4 text-xs overflow-y-auto"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Vendor Company *</label>
                  <input
                    type="text"
                    required
                    value={editingVendor.name}
                    onChange={(e) => setEditingVendor({ ...editingVendor, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Location</label>
                  <input
                    type="text"
                    value={editingVendor.location}
                    onChange={(e) => setEditingVendor({ ...editingVendor, location: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* Multi-Contact List */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Vendor Contacts ({(editingVendor.contacts || []).length})
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setEditingVendor({
                        ...editingVendor,
                        contacts: [
                          ...(editingVendor.contacts || []),
                          {
                            fullName: '',
                            designation: '',
                            phone: '',
                            email: '',
                            isPrimary: (editingVendor.contacts || []).length === 0,
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

                <div className="space-y-2.5">
                  {(editingVendor.contacts || []).map((contact, idx) => (
                    <div
                      key={contact.id || idx}
                      className="p-3 rounded-lg bg-white border border-slate-200 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setEditingVendor({
                              ...editingVendor,
                              contacts: (editingVendor.contacts || []).map((c, cIdx) => ({
                                ...c,
                                isPrimary: cIdx === idx,
                              })),
                            })
                          }
                          className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded border cursor-pointer ${
                            contact.isPrimary
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-slate-50 text-slate-500 border-slate-200 hover:text-slate-700'
                          }`}
                        >
                          <Star className={`w-2.5 h-2.5 ${contact.isPrimary ? 'fill-amber-500 text-amber-500' : ''}`} />
                          <span>{contact.isPrimary ? 'Primary Contact' : 'Set Primary'}</span>
                        </button>
                        {(editingVendor.contacts || []).length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const next = (editingVendor.contacts || []).filter((_, cIdx) => cIdx !== idx);
                              if (next.length > 0 && !next.some((c) => c.isPrimary)) {
                                next[0].isPrimary = true;
                              }
                              setEditingVendor({ ...editingVendor, contacts: next });
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
                            setEditingVendor({
                              ...editingVendor,
                              contacts: (editingVendor.contacts || []).map((c, cIdx) =>
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
                            setEditingVendor({
                              ...editingVendor,
                              contacts: (editingVendor.contacts || []).map((c, cIdx) =>
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
                            setEditingVendor({
                              ...editingVendor,
                              contacts: (editingVendor.contacts || []).map((c, cIdx) =>
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
                            setEditingVendor({
                              ...editingVendor,
                              contacts: (editingVendor.contacts || []).map((c, cIdx) =>
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

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Specialization</label>
                <input
                  type="text"
                  value={editingVendor.skillSpecialization}
                  onChange={(e) => setEditingVendor({ ...editingVendor, skillSpecialization: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Payment Terms</label>
                  <select
                    value={editingVendor.paymentTerms}
                    onChange={(e) => setEditingVendor({ ...editingVendor, paymentTerms: e.target.value })}
                    className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:border-brand-600 focus:outline-none cursor-pointer"
                  >
                    <option value="Net 15">Net 15</option>
                    <option value="Net 30">Net 30</option>
                    <option value="Net 45">Net 45</option>
                    <option value="Net 60">Net 60</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Invoicing</label>
                  <input
                    type="text"
                    value={editingVendor.invoicingTerms}
                    onChange={(e) => setEditingVendor({ ...editingVendor, invoicingTerms: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">MSA Status</label>
                  <select
                    value={editingVendor.msa === 'Yes' || editingVendor.msa === 'Active' ? 'Yes' : 'Pending'}
                    onChange={(e) => setEditingVendor({ ...editingVendor, msa: e.target.value })}
                    className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:border-brand-600 focus:outline-none cursor-pointer"
                  >
                    <option value="Yes">MSA Executed</option>
                    <option value="Pending">Pending Review</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingVendor(null)}
                  className="px-3.5 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
