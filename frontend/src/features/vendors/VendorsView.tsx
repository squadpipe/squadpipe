import React, { useState, useEffect } from 'react';
import {
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock,
  Cpu,
  FileText,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  Users,
} from 'lucide-react';
import { apiClient } from '../../config/api.config';
import { Vendor, VendorContact } from '../../types';
import { SortableTableHeader } from '../../components/shared/SortableTableHeader';
import {
  ContactActionChips,
  GridColumnHeader,
  STAFFING_GRID_CELL_CLASS,
  STAFFING_GRID_FRAME_CLASS,
  STAFFING_GRID_ROW_CLASS,
  STAFFING_GRID_STICKY_TD_CLASS,
  STAFFING_GRID_STICKY_TH_CLASS,
  STAFFING_GRID_TABLE_CLASS,
  STAFFING_GRID_THEAD_CLASS,
  STAFFING_GRID_TH_CLASS,
} from '../../components/shared/StaffingGrid';
import { TablePagination } from '../../components/shared/TablePagination';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { ConfirmDeleteModal } from '../../components/shared/ConfirmDeleteModal';
import { useDebounce } from '../../utils/useDebounce';
import { mapVendorFromApi } from '../../utils/entityMappers';
import { sortArrayByColumn, useTableSort } from '../../utils/tableSort';

interface VendorsViewProps {
  vendors: Vendor[];
  onOpenAddVendor: () => void;
  onSelectVendor: (vendor: Vendor, startEditing?: boolean) => void;
  canEditVendor?: boolean;
  onEditVendor?: (vendor: Vendor) => void;
  onUpdateVendor?: (vendor: Vendor) => Promise<void> | void;
  onDeleteVendor?: (vendor: Vendor) => Promise<void> | void;
}

export const VendorsView: React.FC<VendorsViewProps> = ({
  vendors,
  onOpenAddVendor,
  onSelectVendor,
  canEditVendor = true,
  onEditVendor,
  onDeleteVendor,
}) => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const tableSort = useTableSort<
    | 'name'
    | 'contactName'
    | 'location'
    | 'skillSpecialization'
    | 'paymentTerms'
    | 'invoicingTerms'
    | 'msaSigned'
  >();
  const [tableRows, setTableRows] = useState<Vendor[]>(() => vendors.slice(0, 10));
  const [totalRows, setTotalRows] = useState(vendors.length);
  const [isLoadingRows, setIsLoadingRows] = useState(false);
  const hasServerSyncRef = React.useRef(false);
  const [vendorToDelete, setVendorToDelete] = useState<Vendor | null>(null);

  const debouncedSearch = useDebounce(search, 150);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, tableSort.sort.sortBy, tableSort.sort.sortDir]);

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

    if (!hasServerSyncRef.current && vendors.length > 0 && !tableSort.sort.sortBy) {
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
          ...tableSort.sortParams,
        },
      })
      .then((res) => {
        if (!active) return;
        if (res.data?.success && Array.isArray(res.data.data)) {
          hasServerSyncRef.current = true;
          const mapped = res.data.data.map(mapVendorFromApi);
          setTableRows(mapped);
          setTotalRows(res.data.pagination?.total ?? mapped.length);
        }
      })
      .catch(() => {
        if (!active) return;
        const sortedFallback = sortArrayByColumn(localFiltered, tableSort.sort, {
          name: (v) => v.name,
          contactName: (v) => v.contactName,
          location: (v) => v.location,
          skillSpecialization: (v) => v.skillSpecialization,
          paymentTerms: (v) => v.paymentTerms,
          invoicingTerms: (v) => v.invoicingTerms,
          msaSigned: (v) => v.msa === 'Yes' || v.msa === 'Active',
        });
        setTotalRows(sortedFallback.length);
        setTableRows(sortedFallback.slice((page - 1) * limit, page * limit));
      })
      .finally(() => {
        if (active) setIsLoadingRows(false);
      });
    return () => {
      active = false;
    };
  }, [
    debouncedSearch,
    page,
    limit,
    vendors,
    tableSort.sort.sortBy,
    tableSort.sort.sortDir,
    tableSort.sortParams,
  ]);

  const filtered = tableRows;

  return (
    <section className="max-w-7xl mx-auto px-1 sm:px-2 lg:px-4 space-y-5 pb-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-[19px] font-semibold text-slate-900 tracking-tight leading-snug">Vendors</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage staffing partners, C2C payment terms, and MSA agreements.
          </p>
        </div>
        <button
          onClick={onOpenAddVendor}
          className="h-8 px-3.5 rounded-lg bg-brand-600 text-white text-[11px] font-semibold hover:bg-brand-700 flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={1.75} />
          <span>Add Vendor</span>
        </button>
      </div>

      {/* Main Table Card */}
      <div className={STAFFING_GRID_FRAME_CLASS}>
        {/* Search Bar */}
        <div className="px-5 py-3 border-b border-slate-200/80 flex items-center justify-between bg-white">
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
              className="h-8 pl-8 pr-3 text-xs border border-slate-200 rounded-lg bg-white w-64 text-slate-700 outline-none focus:border-brand-500"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className={STAFFING_GRID_TABLE_CLASS}>
            <thead className={STAFFING_GRID_THEAD_CLASS}>
              <tr>
                <SortableTableHeader
                  label="Vendor Company"
                  icon={<Building2 className="w-3 h-3" />}
                  column="name"
                  sort={tableSort.sort}
                  onSort={tableSort.handleSort}
                  defaultDir="asc"
                  uppercase={false}
                  className={`${STAFFING_GRID_TH_CLASS} ${STAFFING_GRID_STICKY_TH_CLASS}`}
                />
                <SortableTableHeader
                  label="Contacts"
                  icon={<Users className="w-3 h-3" />}
                  column="contactName"
                  sort={tableSort.sort}
                  onSort={tableSort.handleSort}
                  defaultDir="asc"
                  uppercase={false}
                  className={STAFFING_GRID_TH_CLASS}
                />
                <GridColumnHeader
                  icon={<Phone className="w-3 h-3" />}
                  label="Phone & Email"
                />
                <SortableTableHeader
                  label="Location"
                  icon={<MapPin className="w-3 h-3" />}
                  column="location"
                  sort={tableSort.sort}
                  onSort={tableSort.handleSort}
                  defaultDir="asc"
                  uppercase={false}
                  className={STAFFING_GRID_TH_CLASS}
                />
                <SortableTableHeader
                  label="Specialization"
                  icon={<Cpu className="w-3 h-3" />}
                  column="skillSpecialization"
                  sort={tableSort.sort}
                  onSort={tableSort.handleSort}
                  defaultDir="asc"
                  uppercase={false}
                  className={STAFFING_GRID_TH_CLASS}
                />
                <SortableTableHeader
                  label="Payment Terms"
                  icon={<FileText className="w-3 h-3" />}
                  column="paymentTerms"
                  sort={tableSort.sort}
                  onSort={tableSort.handleSort}
                  defaultDir="asc"
                  uppercase={false}
                  className={STAFFING_GRID_TH_CLASS}
                />
                <SortableTableHeader
                  label="Invoicing"
                  icon={<Clock className="w-3 h-3" />}
                  column="invoicingTerms"
                  sort={tableSort.sort}
                  onSort={tableSort.handleSort}
                  defaultDir="asc"
                  uppercase={false}
                  className={STAFFING_GRID_TH_CLASS}
                />
                <SortableTableHeader
                  label="MSA Status"
                  icon={<CheckCircle2 className="w-3 h-3" />}
                  column="msaSigned"
                  sort={tableSort.sort}
                  onSort={tableSort.handleSort}
                  defaultDir="desc"
                  uppercase={false}
                  className={STAFFING_GRID_TH_CLASS}
                />
                <GridColumnHeader
                  icon={<SlidersHorizontal className="w-3 h-3" />}
                  label="Actions"
                  align="right"
                />
              </tr>
            </thead>
            <tbody className="text-slate-700">
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
                      className={STAFFING_GRID_ROW_CLASS}
                    >
                      <td className={`${STAFFING_GRID_CELL_CLASS} ${STAFFING_GRID_STICKY_TD_CLASS} font-semibold text-slate-900 whitespace-nowrap group-hover:text-brand-700`}>
                        {v.name}
                      </td>
                      <td className={`${STAFFING_GRID_CELL_CLASS} text-slate-800`}>
                        <div
                          className="flex items-center gap-1.5"
                          title={contactList.map((c) => `${c.fullName}${c.email ? ` (${c.email})` : ''}`).join(', ')}
                        >
                          <span className="font-medium">{primaryContact?.fullName || v.contactName || '—'}</span>
                          {extraCount > 0 && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white border border-slate-200/90 text-slate-600 text-[11px] font-semibold">
                              <Users className="w-2.5 h-2.5" />+{extraCount}
                            </span>
                          )}
                        </div>
                        {primaryContact?.designation && (
                          <div className="text-[11px] text-slate-400">{primaryContact.designation}</div>
                        )}
                      </td>
                      <td className={`${STAFFING_GRID_CELL_CLASS} text-[11px] text-slate-500`}>
                        <ContactActionChips
                          phone={primaryContact?.phone || v.phone}
                          email={primaryContact?.email || v.email}
                          layout="stack"
                          maxEmailWidthClass="max-w-[190px]"
                          showEmptyPlaceholder
                        />
                      </td>
                      <td className={`${STAFFING_GRID_CELL_CLASS} text-slate-600`}>{v.location}</td>
                      <td className={`${STAFFING_GRID_CELL_CLASS} text-[11px]`}>{v.skillSpecialization}</td>
                      <td className={`${STAFFING_GRID_CELL_CLASS} font-medium whitespace-nowrap`}>{v.paymentTerms}</td>
                      <td className={`${STAFFING_GRID_CELL_CLASS} text-slate-600 whitespace-nowrap`}>{v.invoicingTerms}</td>
                      <td className={`${STAFFING_GRID_CELL_CLASS} whitespace-nowrap`}>
                        <StatusBadge
                          label={isMsaExecuted ? 'MSA Executed' : 'Pending Review'}
                          tone={isMsaExecuted ? 'emerald' : 'amber'}
                          size="xs"
                        />
                      </td>
                      <td className={`${STAFFING_GRID_CELL_CLASS} text-right whitespace-nowrap`}>
                        <div
                          className="inline-flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => onSelectVendor(v, false)}
                            title="View vendor details"
                            className="h-7 px-2.5 rounded-lg border border-slate-200 bg-white text-[11px] font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <span>View</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                          {canEditVendor && (
                            <button
                              type="button"
                              onClick={() =>
                                onEditVendor ? onEditVendor(v) : onSelectVendor(v, true)
                              }
                              title="Edit vendor"
                              className="p-1.5 text-slate-400 hover:text-brand-600 rounded hover:bg-brand-50 transition-colors cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {onDeleteVendor && (
                            <button
                              type="button"
                              onClick={() => setVendorToDelete(v)}
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

      {onDeleteVendor && (
        <ConfirmDeleteModal
          isOpen={Boolean(vendorToDelete)}
          onClose={() => setVendorToDelete(null)}
          title="Delete Vendor?"
          description={
            vendorToDelete ? (
              <>
                Permanently remove <strong className="text-slate-800">{vendorToDelete.name}</strong>{' '}
                from Staffing Vendors?
              </>
            ) : null
          }
          warningText="This cannot be undone."
          confirmLabel="Delete Vendor"
          onConfirm={async () => {
            if (!vendorToDelete) return;
            await onDeleteVendor(vendorToDelete);
          }}
        />
      )}
    </section>
  );
};
