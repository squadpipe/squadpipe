import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Briefcase,
  Calendar,
  Check,
  CheckCircle2,
  Handshake,
  Layers,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Search,
  ShieldAlert,
  ShieldCheck,
  Star,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { BillablePlacement, Candidate, SlaTask, Vendor } from '../../types';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { ActionButton } from '../../components/shared/ActionButton';
import { CustomSelect } from '../../components/shared/CustomSelect';
import { AnimatedModal } from '../../components/shared/MotionPrimitives';
import { SortableTableHeader } from '../../components/shared/SortableTableHeader';
import { TablePagination } from '../../components/shared/TablePagination';
import { MaskedValue } from '../../components/shared/MaskedValue';
import {
  DetailBreadcrumb,
  DetailExpandableSkillsBar,
  DetailTabItem,
  DetailUnderlineTabs,
} from '../../components/shared/DetailPageShell';
import {
  EditVendorModal,
  buildInitialVendorContacts,
} from '../../components/modals/edit/EditVendorModal';
import { useClientPagination } from '../../utils/usePagination';
import { useCurrency } from '../../utils/currency';
import {
  extractRateSortValue,
  sortArrayByColumn,
  useTableSort,
} from '../../utils/tableSort';
import { getDaysRemaining, parseRate } from '../billable/placementUtils';

interface VendorDetailPageProps {
  vendor: Vendor | null;
  backLabel?: string;
  onBack: () => void;
  candidates?: Candidate[];
  placements?: BillablePlacement[];
  rateMasked?: boolean;
  initialEditing?: boolean;
  initialTab?: 'consultants' | 'contacts' | 'placements' | 'terms';
  initialAuditTask?: SlaTask | null;
  onClearAuditTask?: () => void;
  onSelectCandidate?: (candidate: Candidate) => void;
  onSelectPlacement?: (placement: BillablePlacement) => void;
  onUpdateVendor?: (vendor: Vendor) => Promise<void> | void;
  onDeleteVendor?: (vendor: Vendor) => Promise<void> | void;
}

export const VendorDetailPage: React.FC<VendorDetailPageProps> = ({
  vendor,
  backLabel = 'Back to Vendors',
  onBack,
  candidates = [],
  placements = [],
  rateMasked = false,
  initialEditing = false,
  initialTab = 'consultants',
  initialAuditTask = null,
  onClearAuditTask,
  onSelectCandidate,
  onSelectPlacement,
  onUpdateVendor,
  onDeleteVendor,
}) => {
  const { symbol: currencySymbol } = useCurrency();
  const [isEditing, setIsEditing] = useState(initialEditing);
  const [showAuditModal, setShowAuditModal] = useState(Boolean(initialAuditTask));
  const [isSavingAudit, setIsSavingAudit] = useState(false);
  const [auditForm, setAuditForm] = useState<{
    msa: 'Active' | 'Pending';
    coiExpiryDate: string;
    paymentTerms: string;
    invoicingTerms: string;
  }>({
    msa: vendor?.msa === 'Yes' || vendor?.msa === 'Active' ? 'Active' : 'Pending',
    coiExpiryDate: vendor?.coiExpiryDate || '',
    paymentTerms: vendor?.paymentTerms || 'Net 30',
    invoicingTerms: vendor?.invoicingTerms || 'Bi-weekly',
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [workspaceTab, setWorkspaceTab] = useState<'consultants' | 'contacts' | 'placements' | 'terms'>(
    initialAuditTask ? 'terms' : initialTab
  );
  const [candidateSearch, setCandidateSearch] = useState('');
  const contactsSort = useTableSort<'fullName' | 'designation' | 'isPrimary'>();
  const candidatesSort = useTableSort<'fullName' | 'currentTitle' | 'workAuth' | 'hourlyRate' | 'pipelineStage'>();
  const placementsSort = useTableSort<'resourceName' | 'customer' | 'skillRole' | 'startDate' | 'payRate' | 'status'>();

  useEffect(() => {
    setIsEditing(Boolean(initialEditing));
    setShowAuditModal(Boolean(initialAuditTask));
    setShowDeleteConfirm(false);
    setIsDeleting(false);
    setWorkspaceTab(initialAuditTask ? 'terms' : initialTab);
    setCandidateSearch('');
    contactsSort.resetSort();
    candidatesSort.resetSort();
    placementsSort.resetSort();
  }, [vendor?.id, initialEditing, initialTab, initialAuditTask]);

  useEffect(() => {
    if (!vendor) return;
    setAuditForm({
      msa: vendor.msa === 'Yes' || vendor.msa === 'Active' ? 'Active' : 'Pending',
      coiExpiryDate: vendor.coiExpiryDate || '',
      paymentTerms: vendor.paymentTerms || 'Net 30',
      invoicingTerms: vendor.invoicingTerms || 'Bi-weekly',
    });
  }, [vendor, showAuditModal]);

  const vendorPlacements = vendor
    ? placements.filter(
        (p) =>
          (p.vendorId && p.vendorId === vendor.id) ||
          (p.vendorName && p.vendorName.trim().toLowerCase() === vendor.name.trim().toLowerCase())
      )
    : [];
  const vendorCandidates = vendor
    ? candidates.filter(
        (c) =>
          (c.vendorId && c.vendorId === vendor.id) ||
          (c.vendorName && c.vendorName.trim().toLowerCase() === vendor.name.trim().toLowerCase())
      )
    : [];
  const filteredVendorCandidates = candidateSearch.trim()
    ? vendorCandidates.filter((c) => {
        const q = candidateSearch.toLowerCase();
        return (
          c.fullName.toLowerCase().includes(q) ||
          (c.currentTitle || '').toLowerCase().includes(q) ||
          (c.skillset || '').toLowerCase().includes(q) ||
          (c.workAuth || '').toLowerCase().includes(q)
        );
      })
    : vendorCandidates;
  const contactList = vendor ? buildInitialVendorContacts(vendor) : [];

  const sortedContacts = sortArrayByColumn(contactList, contactsSort.sort, {
    fullName: (c) => c.fullName || '',
    designation: (c) => c.designation || '',
    isPrimary: (c) => Boolean(c.isPrimary),
  });
  const sortedCandidates = sortArrayByColumn(filteredVendorCandidates, candidatesSort.sort, {
    fullName: (c) => c.fullName,
    currentTitle: (c) => c.currentTitle,
    workAuth: (c) => c.workAuth,
    hourlyRate: (c) => (rateMasked ? null : extractRateSortValue(c.hourlyRate)),
    pipelineStage: (c) => c.pipelineStage,
  });
  const sortedPlacements = sortArrayByColumn(vendorPlacements, placementsSort.sort, {
    resourceName: (p) => p.resourceName,
    customer: (p) => p.customer,
    skillRole: (p) => p.skillRole,
    startDate: (p) => (p.startDate ? new Date(p.startDate) : null),
    payRate: (p) => (rateMasked ? null : extractRateSortValue(p.payRate)),
    status: (p) => p.status,
  });

  const contactsPg = useClientPagination(
    sortedContacts,
    10,
    `${vendor?.id || ''}|contacts|${contactsSort.sort.sortBy || ''}|${contactsSort.sort.sortDir}`
  );
  const candidatesPg = useClientPagination(
    sortedCandidates,
    10,
    `${vendor?.id || ''}|cands|${candidateSearch}|${candidatesSort.sort.sortBy || ''}|${candidatesSort.sort.sortDir}`
  );
  const placementsPg = useClientPagination(
    sortedPlacements,
    10,
    `${vendor?.id || ''}|placements|${placementsSort.sort.sortBy || ''}|${placementsSort.sort.sortDir}`
  );

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
  const activeVendorPlacements = vendorPlacements.filter(
    (p) => p.status !== 'Completed' && p.status !== 'Terminated'
  );
  const monthlyVendorPayout = Math.round(
    activeVendorPlacements.reduce((sum, p) => sum + parseRate(p.payRate, 0) * 160, 0)
  );
  const coiDaysRemaining = vendor.coiExpiryDate ? getDaysRemaining(vendor.coiExpiryDate) : null;

  const specializations = vendor.skillSpecialization
    ? vendor.skillSpecialization
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const customFieldEntries = Object.entries(vendor.customFields || {}).filter(
    ([, v]) => v !== null && v !== undefined && String(v).trim() !== ''
  );

  const openEditModal = () => {
    setIsEditing(true);
  };

  const vendorTabs: Array<DetailTabItem<'consultants' | 'contacts' | 'placements' | 'terms'>> = [
    {
      id: 'consultants',
      label: 'Consultants & Bench',
      icon: UserCheck,
      badge: vendorCandidates.length,
    },
    {
      id: 'contacts',
      label: 'Vendor Contacts',
      icon: Users,
      badge: contactList.length,
    },
    {
      id: 'placements',
      label: 'C2C Placements',
      icon: Briefcase,
      badge: vendorPlacements.length,
    },
    {
      id: 'terms',
      label: 'Agreement & Terms',
      icon: ShieldCheck,
      badge: customFieldEntries.length > 0 ? customFieldEntries.length : undefined,
    },
  ];

  return (
    <section className="max-w-7xl mx-auto space-y-5 animate-fade-in">
      <DetailBreadcrumb
        backLabel={backLabel}
        onBack={onBack}
        title={vendor.name}
        rightSlot={
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isMsaExecuted ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
            <span>{isMsaExecuted ? 'MSA Executed' : 'MSA Pending Review'}</span>
          </div>
        }
      />

      {/* Unified Vendor Hero + 4-Col Metadata Bar + Tabs */}
      <div className="bg-white rounded-xl border border-slate-200/80 card-shadow overflow-hidden">
        {/* Title & Action Bar */}
        <div className="px-6 py-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200/70 text-emerald-700 flex items-center justify-center flex-shrink-0">
              <Handshake className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-[17px] sm:text-[18px] font-bold text-slate-900 tracking-tight leading-snug inline align-middle mr-2.5">
                {vendor.name}
              </h1>
              <StatusBadge
                label={isMsaExecuted ? 'MSA Executed' : 'Pending Review'}
                tone={isMsaExecuted ? 'emerald' : 'amber'}
                size="xs"
                className="align-middle"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
            {onUpdateVendor && (
              <button
                type="button"
                onClick={openEditModal}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Edit Vendor</span>
              </button>
            )}
          </div>
        </div>

        {/* Structured 4-Column Metadata Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 border-t border-slate-100 bg-slate-50/45 text-xs">
          {/* 1. Location & Primary Contact */}
          <div className="px-6 py-3.5 space-y-1.5 min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Location &amp; Contact
            </div>
            <div className="font-semibold text-slate-900 truncate flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{vendor.location || 'Location not specified'}</span>
            </div>
            <div className="text-[11px] text-slate-500 truncate">
              {primaryContact?.email ? (
                <a href={`mailto:${primaryContact.email}`} className="hover:text-brand-600">
                  {primaryContact.fullName ? `${primaryContact.fullName} · ` : ''}
                  {primaryContact.email}
                </a>
              ) : (
                primaryContact?.fullName || 'No primary contact listed'
              )}
            </div>
          </div>

          {/* 2. Agreement & Compliance */}
          <div className="px-6 py-3.5 space-y-1.5 min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Compliance &amp; COI
            </div>
            <div className="font-semibold text-slate-900 truncate flex items-center gap-1.5">
              <ShieldCheck
                className={`w-3.5 h-3.5 shrink-0 ${
                  isMsaExecuted ? 'text-emerald-600' : 'text-amber-600'
                }`}
              />
              <span>{isMsaExecuted ? 'MSA Executed' : 'Pending Review'}</span>
            </div>
            <div
              className={`text-[11px] truncate ${
                coiDaysRemaining !== null && coiDaysRemaining < 0
                  ? 'text-rose-600 font-semibold'
                  : coiDaysRemaining !== null && coiDaysRemaining <= 30
                    ? 'text-amber-700 font-semibold'
                    : 'text-slate-500'
              }`}
            >
              {vendor.coiExpiryDate
                ? coiDaysRemaining !== null && coiDaysRemaining < 0
                  ? `COI Expired (${vendor.coiExpiryDate})`
                  : coiDaysRemaining !== null && coiDaysRemaining <= 30
                    ? `COI Expires ${vendor.coiExpiryDate} (${coiDaysRemaining}d)`
                    : `COI Valid through ${vendor.coiExpiryDate}`
                : 'COI date not recorded'}
            </div>
          </div>

          {/* 3. Payment & Invoicing */}
          <div className="px-6 py-3.5 space-y-1.5 min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Payment Terms
            </div>
            <div className="font-semibold text-slate-900 truncate">
              {vendor.paymentTerms || 'Not specified'}
            </div>
            <div className="text-[11px] text-slate-500 truncate">
              Invoicing:{' '}
              <strong className="font-medium text-slate-700">
                {vendor.invoicingTerms || '—'}
              </strong>
            </div>
          </div>

          {/* 4. Bench & Est. Monthly Payout */}
          <div className="px-6 py-3.5 space-y-1.5 min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Bench &amp; Active C2C
            </div>
            <div className="font-semibold text-slate-900 truncate">
              {vendorCandidates.length} Consultants &middot;{' '}
              <span className="text-emerald-700">{activeVendorPlacements.length} Active C2C</span>
            </div>
            <div className="text-[11px] text-slate-500 truncate">
              Est. Payout:{' '}
              <span className="font-mono font-semibold text-slate-700">
                <MaskedValue
                  value={
                    monthlyVendorPayout > 0
                      ? `${currencySymbol}${monthlyVendorPayout.toLocaleString()}/mo`
                      : '—'
                  }
                  isMasked={rateMasked}
                />
              </span>
            </div>
          </div>
        </div>

        <DetailUnderlineTabs
          ariaLabel="Vendor workspace sections"
          tabs={vendorTabs}
          activeTab={workspaceTab}
          onChange={setWorkspaceTab}
        />
      </div>

      {/* TAB 1: Consultants & Specializations */}
      {workspaceTab === 'consultants' && (
        <div className="space-y-5">
          <DetailExpandableSkillsBar
            label="Specializations:"
            skills={specializations}
            editLabel="Edit skills"
            onEdit={onUpdateVendor ? openEditModal : undefined}
          />

          <section className="bg-white rounded-xl border border-slate-200/80 card-shadow overflow-hidden text-xs">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <UserCheck className="w-3.5 h-3.5 text-brand-600" />
                <h2 className="font-bold text-slate-900">
                  Supplied Consultants ({vendorCandidates.length})
                </h2>
              </div>
              {vendorCandidates.length > 0 && (
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={candidateSearch}
                    onChange={(e) => setCandidateSearch(e.target.value)}
                    placeholder="Filter consultants or skills..."
                    className="pl-8 pr-3 py-1 text-xs border border-slate-200 rounded-lg bg-white w-full sm:w-56 text-slate-700 focus:outline-none focus:border-brand-600"
                  />
                </div>
              )}
            </div>
            {vendorCandidates.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                No bench or pipeline consultants linked to this vendor yet.
              </div>
            ) : filteredVendorCandidates.length === 0 ? (
              <div className="py-10 text-center text-slate-400">
                No consultants match "{candidateSearch}".{' '}
                <button
                  type="button"
                  onClick={() => setCandidateSearch('')}
                  className="font-semibold text-brand-600 hover:underline cursor-pointer"
                >
                  Clear filter
                </button>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/80 border-b border-slate-100 text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                      <tr>
                        <SortableTableHeader
                          label="Consultant"
                          column="fullName"
                          sort={candidatesSort.sort}
                          onSort={candidatesSort.handleSort}
                          defaultDir="asc"
                          className="pl-6 pr-4 py-3 whitespace-nowrap"
                        />
                        <SortableTableHeader
                          label="Title"
                          column="currentTitle"
                          sort={candidatesSort.sort}
                          onSort={candidatesSort.handleSort}
                          defaultDir="asc"
                          className="px-4 py-3 whitespace-nowrap"
                        />
                        <SortableTableHeader
                          label="Work Auth"
                          column="workAuth"
                          sort={candidatesSort.sort}
                          onSort={candidatesSort.handleSort}
                          defaultDir="asc"
                          className="px-4 py-3 whitespace-nowrap"
                        />
                        <SortableTableHeader
                          label="Target Rate"
                          column="hourlyRate"
                          sort={candidatesSort.sort}
                          onSort={candidatesSort.handleSort}
                          defaultDir="desc"
                          disabled={rateMasked}
                          className="px-4 py-3 whitespace-nowrap"
                        />
                        <SortableTableHeader
                          label="Stage"
                          column="pipelineStage"
                          sort={candidatesSort.sort}
                          onSort={candidatesSort.handleSort}
                          defaultDir="asc"
                          align="right"
                          className="pl-4 pr-6 py-3 whitespace-nowrap"
                        />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {candidatesPg.pagedItems.map((c) => (
                        <tr
                          key={c.id}
                          onClick={onSelectCandidate ? () => onSelectCandidate(c) : undefined}
                          className={`group transition-colors ${
                            onSelectCandidate ? 'hover:bg-slate-50/90 cursor-pointer' : 'hover:bg-slate-50/70'
                          }`}
                        >
                          <td
                            className={`pl-6 pr-4 py-3.5 font-semibold text-slate-900 whitespace-nowrap ${
                              onSelectCandidate ? 'group-hover:text-brand-700 transition-colors' : ''
                            }`}
                          >
                            {c.fullName}
                          </td>
                          <td className="px-4 py-3.5 text-slate-600">{c.currentTitle || '—'}</td>
                          <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap">
                            {c.workAuth || '—'}
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <MaskedValue value={c.hourlyRate || '—'} isMasked={rateMasked} />
                          </td>
                          <td className="pl-4 pr-6 py-3.5 text-right whitespace-nowrap">
                            <StatusBadge stage={c.pipelineStage} size="xs" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <TablePagination
                  page={candidatesPg.page}
                  limit={candidatesPg.limit}
                  total={candidatesPg.total}
                  onPageChange={candidatesPg.setPage}
                  onLimitChange={candidatesPg.setLimit}
                  itemLabel="consultants"
                  pageSizeOptions={[10, 20, 50]}
                />
              </>
            )}
          </section>
        </div>
      )}

      {/* TAB 2: Vendor Contacts */}
      {workspaceTab === 'contacts' && (
        <section className="bg-white rounded-xl border border-slate-200/80 card-shadow overflow-hidden text-xs">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-brand-600" />
              <h2 className="font-bold text-slate-900">Vendor Contacts ({contactList.length})</h2>
            </div>
            {onUpdateVendor && (
              <button
                type="button"
                onClick={openEditModal}
                className="text-brand-600 font-semibold hover:underline text-xs inline-flex items-center gap-1 cursor-pointer"
              >
                <Pencil className="w-3 h-3" />
                <span>Manage Contacts</span>
              </button>
            )}
          </div>
          {contactList.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              No contacts recorded for this vendor yet.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 border-b border-slate-100 text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                    <tr>
                      <SortableTableHeader
                        label="Contact"
                        column="fullName"
                        sort={contactsSort.sort}
                        onSort={contactsSort.handleSort}
                        defaultDir="asc"
                        className="pl-6 pr-4 py-3 whitespace-nowrap"
                      />
                      <SortableTableHeader
                        label="Designation"
                        column="designation"
                        sort={contactsSort.sort}
                        onSort={contactsSort.handleSort}
                        defaultDir="asc"
                        className="px-4 py-3 whitespace-nowrap"
                      />
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Phone</th>
                      <SortableTableHeader
                        label="Role"
                        column="isPrimary"
                        sort={contactsSort.sort}
                        onSort={contactsSort.handleSort}
                        defaultDir="desc"
                        align="right"
                        className="pl-4 pr-6 py-3 whitespace-nowrap"
                      />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {contactsPg.pagedItems.map((cnt, idx) => (
                      <tr key={cnt.id || idx} className="hover:bg-slate-50/70 transition-colors">
                        <td className="pl-6 pr-4 py-3.5 font-semibold text-slate-900 whitespace-nowrap">
                          {cnt.fullName || 'Unnamed Contact'}
                        </td>
                        <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap">
                          {cnt.designation || '—'}
                        </td>
                        <td className="px-4 py-3.5 text-slate-600">
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
                        <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap">
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
                        <td className="pl-4 pr-6 py-3.5 text-right whitespace-nowrap">
                          {cnt.isPrimary ? (
                            <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                              <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
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
      )}

      {/* TAB 3: Associated C2C Placements */}
      {workspaceTab === 'placements' && (
        <section className="bg-white rounded-xl border border-slate-200/80 card-shadow overflow-hidden text-xs">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Briefcase className="w-3.5 h-3.5 text-brand-600" />
              <h2 className="font-bold text-slate-900">
                Associated C2C Placements ({vendorPlacements.length})
              </h2>
            </div>
          </div>
          {vendorPlacements.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              No active or historical placements linked to this vendor yet.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 border-b border-slate-100 text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                    <tr>
                      <SortableTableHeader
                        label="Consultant"
                        column="resourceName"
                        sort={placementsSort.sort}
                        onSort={placementsSort.handleSort}
                        defaultDir="asc"
                        className="pl-6 pr-4 py-3 whitespace-nowrap"
                      />
                      <SortableTableHeader
                        label="Client"
                        column="customer"
                        sort={placementsSort.sort}
                        onSort={placementsSort.handleSort}
                        defaultDir="asc"
                        className="px-4 py-3 whitespace-nowrap"
                      />
                      <SortableTableHeader
                        label="Role / Skill"
                        column="skillRole"
                        sort={placementsSort.sort}
                        onSort={placementsSort.handleSort}
                        defaultDir="asc"
                        className="px-4 py-3 whitespace-nowrap"
                      />
                      <SortableTableHeader
                        label="Contract Period"
                        column="startDate"
                        sort={placementsSort.sort}
                        onSort={placementsSort.handleSort}
                        defaultDir="desc"
                        className="px-4 py-3 whitespace-nowrap"
                      />
                      <SortableTableHeader
                        label="Pay Rate"
                        column="payRate"
                        sort={placementsSort.sort}
                        onSort={placementsSort.handleSort}
                        defaultDir="desc"
                        disabled={rateMasked}
                        className="px-4 py-3 whitespace-nowrap"
                      />
                      <SortableTableHeader
                        label="Status"
                        column="status"
                        sort={placementsSort.sort}
                        onSort={placementsSort.handleSort}
                        defaultDir="asc"
                        align="right"
                        className="pl-4 pr-6 py-3 whitespace-nowrap"
                      />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {placementsPg.pagedItems.map((p) => (
                      <tr
                        key={p.id}
                        onClick={onSelectPlacement ? () => onSelectPlacement(p) : undefined}
                        className={`group transition-colors ${
                          onSelectPlacement ? 'hover:bg-slate-50/90 cursor-pointer' : 'hover:bg-slate-50/70'
                        }`}
                      >
                        <td
                          className={`pl-6 pr-4 py-3.5 font-semibold text-slate-900 whitespace-nowrap ${
                            onSelectPlacement ? 'group-hover:text-brand-700 transition-colors' : ''
                          }`}
                        >
                          {p.resourceName}
                        </td>
                        <td className="px-4 py-3.5 text-slate-700 whitespace-nowrap">
                          {p.customer}
                        </td>
                        <td className="px-4 py-3.5 text-slate-600">{p.skillRole}</td>
                        <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap font-mono text-[11px]">
                          {p.startDate} &rarr; {p.endDate}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <MaskedValue value={p.payRate || '—'} isMasked={rateMasked} />
                        </td>
                        <td className="pl-4 pr-6 py-3.5 text-right whitespace-nowrap">
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
      )}

      {/* TAB 4: Agreement & Terms */}
      {workspaceTab === 'terms' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200/80 card-shadow overflow-hidden text-xs">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <div>
                  <h3 className="font-bold text-slate-900">Agreement &amp; Commercial Terms</h3>
                  <p className="text-[11px] text-slate-400">
                    Vendor compliance, certificate of insurance, and payment schedule.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAuditModal(true)}
                  className="px-2.5 py-1 rounded-lg border border-amber-200 bg-amber-50/80 hover:bg-amber-100/80 text-amber-800 text-[11px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <ShieldAlert className="w-3 h-3" />
                  <span>Audit Compliance</span>
                </button>
                {onUpdateVendor && (
                  <button
                    type="button"
                    onClick={openEditModal}
                    className="text-brand-600 font-semibold hover:underline text-xs inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Pencil className="w-3 h-3" />
                    <span>Edit Terms</span>
                  </button>
                )}
              </div>
            </div>

            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-5">
              <div>
                <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  MSA Status
                </div>
                <div className="font-semibold text-slate-900">
                  {isMsaExecuted ? 'MSA Executed' : 'Pending Review'}
                </div>
              </div>

              <div>
                <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Insurance Expiry
                </div>
                <div
                  className={`font-semibold ${
                    coiDaysRemaining !== null && coiDaysRemaining < 0
                      ? 'text-rose-600'
                      : coiDaysRemaining !== null && coiDaysRemaining <= 30
                        ? 'text-amber-700'
                        : 'text-slate-900'
                  }`}
                >
                  {vendor.coiExpiryDate
                    ? coiDaysRemaining !== null && coiDaysRemaining < 0
                      ? `${vendor.coiExpiryDate} (Expired)`
                      : coiDaysRemaining !== null && coiDaysRemaining <= 30
                        ? `${vendor.coiExpiryDate} (${coiDaysRemaining}d)`
                        : vendor.coiExpiryDate
                    : 'Not recorded'}
                </div>
              </div>

              <div>
                <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Payment Terms
                </div>
                <div className="font-semibold text-slate-900">
                  {vendor.paymentTerms || '—'}
                </div>
              </div>

              <div>
                <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Invoicing Schedule
                </div>
                <div className="font-semibold text-slate-900">
                  {vendor.invoicingTerms || '—'}
                </div>
              </div>

              <div>
                <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Location
                </div>
                <div className="font-semibold text-slate-900">
                  {vendor.location || '—'}
                </div>
              </div>

              <div>
                <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Primary Contact
                </div>
                <div className="font-semibold text-slate-900 truncate">
                  {primaryContact?.fullName || primaryContact?.email || '—'}
                </div>
              </div>
            </div>
          </div>

          <aside className="lg:col-span-4 space-y-4">
            <div className="bg-white rounded-xl border border-slate-200/80 card-shadow p-5 space-y-3 text-xs">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Vendor Overview
              </h3>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2">
                <span className="text-slate-600 font-medium">Supplied Consultants</span>
                <span className="font-bold font-mono text-slate-900">{vendorCandidates.length}</span>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2">
                <span className="text-slate-600 font-medium">Active C2C Placements</span>
                <span className="font-bold font-mono text-emerald-700">
                  {activeVendorPlacements.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setWorkspaceTab('consultants')}
                className="w-full py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs cursor-pointer transition-colors"
              >
                View Consultants &amp; Bench &rarr;
              </button>
            </div>

            {customFieldEntries.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200/80 card-shadow overflow-hidden text-xs">
                <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-brand-600" />
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Custom Attributes
                  </h3>
                </div>
                <dl className="p-5 space-y-2.5">
                  {customFieldEntries.map(([k, v]) => (
                    <div key={k} className="flex items-start justify-between gap-2">
                      <dt className="text-slate-400 font-medium capitalize shrink-0">
                        {k.replace(/_/g, ' ')}
                      </dt>
                      <dd className="text-slate-800 font-medium text-right min-w-0 [overflow-wrap:anywhere]">
                        {String(v)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {onDeleteVendor && (
              <div className="bg-white rounded-xl border border-slate-200/80 card-shadow p-5 space-y-3 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-slate-900">Vendor Record</h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Remove from Staffing Vendors.
                    </p>
                  </div>
                  {!showDeleteConfirm && (
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 font-semibold text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  )}
                </div>
                {showDeleteConfirm && (
                  <div className="space-y-2.5 pt-2 border-t border-slate-100">
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
                        className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-[11px] font-semibold cursor-pointer"
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
                        className="flex-1 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-semibold cursor-pointer"
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
      )}

      {onUpdateVendor && (
        <EditVendorModal
          vendor={vendor}
          isOpen={isEditing}
          onClose={() => setIsEditing(false)}
          onUpdateVendor={onUpdateVendor}
        />
      )}

      {/* Vendor Compliance Audit Modal */}
      <AnimatedModal
        isOpen={showAuditModal}
        onBackdropClick={() => {
          if (!isSavingAudit) {
            setShowAuditModal(false);
            onClearAuditTask?.();
          }
        }}
        zIndexClass="z-50"
        panelClassName="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
        ariaLabel={`Vendor Compliance Audit for ${vendor.name}`}
      >
        {(() => {
          const auditCoiDays = auditForm.coiExpiryDate
            ? getDaysRemaining(auditForm.coiExpiryDate)
            : null;
          const isFormCompliant =
            auditForm.msa === 'Active' &&
            (auditCoiDays === null || auditCoiDays > 30);

          const closeAudit = () => {
            if (isSavingAudit) return;
            setShowAuditModal(false);
            onClearAuditTask?.();
          };

          const handleSaveAudit = async (e: React.FormEvent) => {
            e.preventDefault();
            if (isSavingAudit || !onUpdateVendor) {
              closeAudit();
              return;
            }
            setIsSavingAudit(true);
            try {
              await onUpdateVendor({
                ...vendor,
                msa: auditForm.msa,
                coiExpiryDate: auditForm.coiExpiryDate || undefined,
                paymentTerms: auditForm.paymentTerms,
                invoicingTerms: auditForm.invoicingTerms,
              });
              setShowAuditModal(false);
              onClearAuditTask?.();
            } catch {
              // Error toast handled by parent caller
            } finally {
              setIsSavingAudit(false);
            }
          };

          return (
            <>
              <div className="px-6 py-4 bg-[#141615] text-white flex items-center justify-between gap-3 border-b border-white/10 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isFormCompliant
                        ? 'bg-emerald-600 text-white'
                        : 'bg-amber-500 text-slate-950'
                    }`}
                  >
                    {isFormCompliant ? (
                      <ShieldCheck className="w-4 h-4" />
                    ) : (
                      <ShieldAlert className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-sm font-bold text-white">Vendor Compliance Audit</h2>
                      {auditCoiDays !== null && auditCoiDays <= 30 && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            auditCoiDays < 0
                              ? 'bg-rose-500/20 text-rose-200 border border-rose-400/30'
                              : 'bg-amber-500/20 text-amber-200 border border-amber-400/30'
                          }`}
                        >
                          {auditCoiDays < 0
                            ? 'Insurance Expired'
                            : `Insurance Expiring (${auditCoiDays}d)`}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">{vendor.name}</p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isSavingAudit}
                  onClick={closeAudit}
                  aria-label="Close audit modal"
                  className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveAudit} className="flex flex-col flex-1 overflow-hidden">
                <div className="p-6 overflow-y-auto space-y-4 text-xs flex-1">
                  {/* Alert / Compliance Summary Box */}
                  <div
                    className={`rounded-xl border p-3.5 flex items-start gap-2.5 ${
                      initialAuditTask ||
                      !isMsaExecuted ||
                      (coiDaysRemaining !== null && coiDaysRemaining <= 30)
                        ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                        : 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                    }`}
                  >
                    {isFormCompliant ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    )}
                    <div className="space-y-0.5 min-w-0">
                      <div className="font-bold text-xs">
                        {initialAuditTask?.slaRuleTag ||
                          (coiDaysRemaining !== null && coiDaysRemaining < 0
                            ? 'Certificate of Insurance Expired'
                            : coiDaysRemaining !== null && coiDaysRemaining <= 30
                              ? `Insurance Expiring in ${coiDaysRemaining} Days`
                              : !isMsaExecuted
                                ? 'MSA Agreement Verification Required'
                                : 'All Compliance Checks Verified')}
                      </div>
                      <p className="text-[11px] opacity-90 leading-relaxed">
                        {initialAuditTask?.desc ||
                          `Partner vendor ${vendor.name} agreement & insurance status check. Update executed MSA or renewed COI expiry below to resolve this audit alert.`}
                      </p>
                    </div>
                  </div>

                  {/* MSA Agreement Toggle */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1.5">
                      Master Service Agreement (MSA) Status
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {(
                        [
                          { id: 'Active', label: 'MSA Executed (Active)' },
                          { id: 'Pending', label: 'Pending Review' },
                        ] as const
                      ).map((opt) => {
                        const selected = auditForm.msa === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            disabled={!onUpdateVendor}
                            onClick={() => setAuditForm({ ...auditForm, msa: opt.id })}
                            className={`px-3 py-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-60 ${
                              selected
                                ? opt.id === 'Active'
                                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-2xs'
                                  : 'bg-amber-50 border-amber-300 text-amber-800 shadow-2xs'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            {selected && <Check className="w-3.5 h-3.5" />}
                            <span>{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Insurance / COI Expiry Date */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label
                        htmlFor="vendor-audit-coi-date"
                        className="text-[11px] font-semibold text-slate-700 inline-flex items-center gap-1.5"
                      >
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>Insurance (COI) Expiry Date</span>
                      </label>
                      {auditCoiDays !== null && (
                        <span
                          className={`text-[10.5px] font-semibold ${
                            auditCoiDays < 0
                              ? 'text-rose-600'
                              : auditCoiDays <= 30
                                ? 'text-amber-700'
                                : 'text-emerald-700'
                          }`}
                        >
                          {auditCoiDays < 0
                            ? `${Math.abs(auditCoiDays)}d overdue`
                            : `${auditCoiDays}d remaining`}
                        </span>
                      )}
                    </div>
                    <input
                      id="vendor-audit-coi-date"
                      type="date"
                      disabled={!onUpdateVendor}
                      value={auditForm.coiExpiryDate}
                      onChange={(e) =>
                        setAuditForm({ ...auditForm, coiExpiryDate: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none disabled:bg-slate-50"
                    />
                  </div>

                  {/* Commercial Terms */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Payment Terms
                      </label>
                      <CustomSelect
                        value={auditForm.paymentTerms}
                        disabled={!onUpdateVendor}
                        onChange={(val) => setAuditForm({ ...auditForm, paymentTerms: val })}
                        ariaLabel="Payment Terms"
                        options={['Net 15', 'Net 30', 'Net 45', 'Net 60']}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Invoicing Schedule
                      </label>
                      <CustomSelect
                        value={auditForm.invoicingTerms}
                        disabled={!onUpdateVendor}
                        onChange={(val) => setAuditForm({ ...auditForm, invoicingTerms: val })}
                        ariaLabel="Invoicing Schedule"
                        options={['Weekly', 'Bi-weekly', 'Monthly']}
                      />
                    </div>
                  </div>

                  {/* Vendor Primary Contact for Renewal Outreach */}
                  {primaryContact && (
                    <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Compliance Contact
                        </div>
                        <div className="text-xs font-semibold text-slate-900 mt-0.5 truncate">
                          {primaryContact.fullName || vendor.contactName}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {primaryContact.email || vendor.email}
                          {primaryContact.phone ? ` · ${primaryContact.phone}` : ''}
                        </div>
                      </div>
                      {(primaryContact.email || vendor.email) && (
                        <a
                          href={`mailto:${primaryContact.email || vendor.email}?subject=${encodeURIComponent(
                            `Compliance Verification & COI Update — ${vendor.name}`
                          )}`}
                          className="shrink-0 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-semibold inline-flex items-center gap-1.5 transition-colors"
                        >
                          <Mail className="w-3 h-3 text-brand-600" />
                          <span>Request COI</span>
                        </a>
                      )}
                    </div>
                  )}
                </div>

                <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
                  {onUpdateVendor ? (
                    <button
                      type="button"
                      disabled={isSavingAudit}
                      onClick={() => {
                        setShowAuditModal(false);
                        onClearAuditTask?.();
                        openEditModal();
                      }}
                      className="text-xs font-semibold text-brand-600 hover:text-brand-700 hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Pencil className="w-3 h-3" />
                      <span>Edit Full Profile</span>
                    </button>
                  ) : (
                    <span />
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isSavingAudit}
                      onClick={closeAudit}
                      className="px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold cursor-pointer disabled:opacity-60"
                    >
                      Close
                    </button>
                    {onUpdateVendor && (
                      <ActionButton
                        type="submit"
                        loading={isSavingAudit}
                        loadingText="Saving Audit..."
                        icon={<Check className="w-3.5 h-3.5" />}
                        className="px-4 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
                      >
                        Save Audit &amp; Update Terms
                      </ActionButton>
                    )}
                  </div>
                </div>
              </form>
            </>
          );
        })()}
      </AnimatedModal>
    </section>
  );
};
