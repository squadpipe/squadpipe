import React, { useState, useEffect } from 'react';
import { ChevronRight, Pencil, Plus, Search, Trash2, Users } from 'lucide-react';
import { apiClient } from '../../config/api.config';
import { Vendor, VendorContact } from '../../types';
import { TablePagination } from '../../components/shared/TablePagination';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { EditVendorModal } from '../../components/modals/edit/EditVendorModal';
import { useDebounce } from '../../utils/useDebounce';
import { mapVendorFromApi } from '../../utils/entityMappers';

interface VendorsViewProps {
  vendors: Vendor[];
  onOpenAddVendor: () => void;
  onSelectVendor: (vendor: Vendor, startEditing?: boolean) => void;
  canEditVendor?: boolean;
  onUpdateVendor?: (vendor: Vendor) => Promise<void> | void;
  onDeleteVendor?: (vendor: Vendor) => void;
}

export const VendorsView: React.FC<VendorsViewProps> = ({
  vendors,
  onOpenAddVendor,
  onSelectVendor,
  canEditVendor = true,
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
        <div className="max-h-[440px] overflow-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 z-10 bg-slate-50 shadow-[inset_0_-1px_0_rgb(226,232,240)] text-[11px] font-semibold text-slate-600 uppercase">
              <tr>
                <th className="px-4 py-3">Vendor Company</th>
                <th className="px-4 py-3">Contacts</th>
                <th className="px-4 py-3">Phone & Email</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Specialization</th>
                <th className="px-4 py-3">Payment Terms</th>
                <th className="px-4 py-3">Invoicing</th>
                <th className="px-4 py-3">MSA Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-10 text-center text-xs text-slate-400">
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
                  <tr
                    key={v.id}
                    onClick={() => onSelectVendor(v, false)}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                  >
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
                      <StatusBadge
                        label={isMsaExecuted ? 'MSA Executed' : 'Pending Review'}
                        tone={isMsaExecuted ? 'emerald' : 'amber'}
                        size="xs"
                      />
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div
                        className="inline-flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => onSelectVendor(v, false)}
                          title="View vendor details"
                          className="px-2 py-1 rounded text-[11px] font-semibold text-brand-600 hover:bg-brand-50 inline-flex items-center gap-0.5 transition-colors cursor-pointer"
                        >
                          <span>View</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                        {canEditVendor && onUpdateVendor && (
                          <button
                            type="button"
                            onClick={() => setEditingVendor(v)}
                            title="Edit vendor"
                            className="p-1.5 text-slate-400 hover:text-brand-600 rounded hover:bg-brand-50 transition-colors cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {onDeleteVendor && (
                          <button
                            type="button"
                            onClick={() => onDeleteVendor(v)}
                            title="Delete vendor"
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
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

      {onUpdateVendor && (
        <EditVendorModal
          vendor={editingVendor}
          isOpen={Boolean(editingVendor)}
          onClose={() => setEditingVendor(null)}
          onUpdateVendor={onUpdateVendor}
        />
      )}
    </section>
  );
};
