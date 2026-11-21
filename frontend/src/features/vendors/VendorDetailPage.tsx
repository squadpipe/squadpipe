import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Briefcase,
  Building2,
  CalendarClock,
  CheckCircle2,
  DollarSign,
  Handshake,
  Layers,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Search,
  ShieldCheck,
  Trash2,
  User,
  UserCheck,
  Users,
} from 'lucide-react';
import { BillablePlacement, Candidate, SlaTask, Vendor } from '../../types';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { ConfirmDeleteModal } from '../../components/shared/ConfirmDeleteModal';
import { getInitials } from '../../utils/entityMappers';
import { SortableTableHeader } from '../../components/shared/SortableTableHeader';
import {
  ContactActionChips,
  GridColumnHeader,
  STAFFING_GRID_CELL_CLASS,
  STAFFING_GRID_ROW_CLASS,
  STAFFING_GRID_ROW_STATIC_CLASS,
  STAFFING_GRID_STICKY_TD_CLASS,
  STAFFING_GRID_STICKY_TH_CLASS,
  STAFFING_GRID_TABLE_CLASS,
  STAFFING_GRID_THEAD_CLASS,
  STAFFING_GRID_TH_CLASS,
} from '../../components/shared/StaffingGrid';
import { TablePagination } from '../../components/shared/TablePagination';
import { MaskedValue } from '../../components/shared/MaskedValue';
import {
  DetailBreadcrumb,
  DetailExpandableSkillsBar,
  DetailTabItem,
  DetailUnderlineTabs,
} from '../../components/shared/DetailPageShell';
import { buildInitialVendorContacts } from './VendorEditPage';
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
  initialTab?: 'consultants' | 'contacts' | 'placements' | 'terms';
  initialAuditTask?: SlaTask | null;
  onClearAuditTask?: () => void;
  onSelectCandidate?: (candidate: Candidate) => void;
  onSelectPlacement?: (placement: BillablePlacement) => void;
  onEditVendor?: (vendor: Vendor, focusSection?: 'profile' | 'contacts' | 'compliance') => void;
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
  initialTab = 'consultants',
  initialAuditTask = null,
  onClearAuditTask,
  onSelectCandidate,
  onSelectPlacement,
  onEditVendor,
  onUpdateVendor,
  onDeleteVendor,
}) => {
  const { symbol: currencySymbol } = useCurrency();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [workspaceTab, setWorkspaceTab] = useState<'consultants' | 'contacts' | 'placements' | 'terms'>(
    initialAuditTask ? 'terms' : initialTab
  );
  const [candidateSearch, setCandidateSearch] = useState('');
  const contactsSort = useTableSort<'fullName' | 'designation' | 'isPrimary'>();
  const candidatesSort = useTableSort<'fullName' | 'currentTitle' | 'workAuth' | 'hourlyRate' | 'pipelineStage'>();
  const placementsSort = useTableSort<'resourceName' | 'customer' | 'skillRole' | 'startDate' | 'payRate' | 'status'>();

  useEffect(() => {
    setShowDeleteModal(false);
    setWorkspaceTab(initialAuditTask ? 'terms' : initialTab);
    setCandidateSearch('');
    contactsSort.resetSort();
    candidatesSort.resetSort();
    placementsSort.resetSort();
  }, [vendor?.id, initialTab, initialAuditTask]);

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

  const navigateToEdit = (section: 'profile' | 'contacts' | 'compliance' = 'profile') => {
    if (!vendor || !onEditVendor) return;
    onClearAuditTask?.();
    onEditVendor(vendor, section);
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

  const primaryContactName =
    primaryContact?.fullName || vendor.contactName || 'No primary contact';
  const contactInitials = getInitials(primaryContactName, 'VC');

  return (
    <section className="max-w-7xl mx-auto px-1 sm:px-2 lg:px-4 space-y-5 pb-8 animate-fade-in">
      <DetailBreadcrumb
        backLabel={backLabel}
        onBack={onBack}
        title={vendor.name}
      />

      {/* Bare Canvas Entity Title & Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-lg sm:text-[19px] font-semibold text-slate-900 tracking-tight leading-snug">
              {vendor.name}
            </h1>
            <StatusBadge
              label={isMsaExecuted ? 'MSA Executed' : 'Pending Review'}
              tone={isMsaExecuted ? 'emerald' : 'amber'}
              size="xs"
            />
          </div>
          <div className="flex items-center flex-wrap gap-x-2.5 gap-y-1 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{vendor.location || 'Sub-Tier Staffing Partner'}</span>
            </span>
            {primaryContact?.fullName && (
              <span className="inline-flex items-center gap-1.5">
                <span className="text-slate-300" aria-hidden="true">&middot;</span>
                <span>Contact: {primaryContact.fullName}</span>
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
          {onEditVendor && (
            <>
              <button
                type="button"
                onClick={() => navigateToEdit('contacts')}
                className="h-8 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Users className="w-3.5 h-3.5 text-slate-500" />
                <span>Manage Contacts</span>
              </button>
              <button
                type="button"
                onClick={() => navigateToEdit('profile')}
                className="h-8 px-3.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-[11px] font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Pencil className="w-3 h-3" />
                <span>Edit Vendor</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Standalone 4-Column Summary Card + Embedded Specializations */}
      <div className="bg-white rounded-xl border border-slate-200/90 card-shadow overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 text-xs">
          {/* 1. Location & Primary Contact */}
          <div className="px-6 py-4 space-y-2.5 min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Primary contact
            </div>
            <div className="flex items-start gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-700 font-semibold text-[11px] flex items-center justify-center shrink-0">
                {contactInitials}
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-slate-900 leading-snug break-words">
                  {primaryContactName}
                </div>
                <div className="text-[11px] text-slate-500 leading-snug break-words mt-0.5">
                  {primaryContact?.email ? (
                    <a href={`mailto:${primaryContact.email}`} className="hover:text-brand-600 break-all">
                      {primaryContact.email}
                    </a>
                  ) : (
                    vendor.location || 'Email not listed'
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 2. Agreement & Compliance */}
          <div className="px-6 py-4 space-y-2 min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Compliance &amp; COI
            </div>
            <div className="font-semibold text-slate-900 flex items-center gap-1.5 leading-snug">
              <ShieldCheck
                className={`w-3.5 h-3.5 shrink-0 ${
                  isMsaExecuted ? 'text-emerald-600' : 'text-amber-600'
                }`}
              />
              <span>{isMsaExecuted ? 'MSA Executed' : 'Pending Review'}</span>
            </div>
            <div
              className={`text-[11px] leading-snug break-words ${
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
          <div className="px-6 py-4 space-y-2 min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Payment terms
            </div>
            <div className="font-semibold text-slate-900 leading-snug break-words">
              {vendor.paymentTerms || 'Not specified'}
            </div>
            <div className="text-[11px] text-slate-500 leading-snug break-words">
              Invoicing:{' '}
              <strong className="font-medium text-slate-700">
                {vendor.invoicingTerms || '—'}
              </strong>
            </div>
          </div>

          {/* 4. Bench & Est. Monthly Payout */}
          <div className="px-6 py-4 space-y-2 min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Bench &amp; active C2C
            </div>
            <div className="flex items-baseline gap-1.5 flex-wrap leading-none">
              <span className="text-lg font-bold font-mono text-slate-900 tabular-nums">
                {vendorCandidates.length}
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                bench &middot;{' '}
                <strong className="font-semibold text-emerald-700">
                  {activeVendorPlacements.length} active
                </strong>
              </span>
            </div>
            <div className="text-[11px] text-slate-500 leading-snug">
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

        <DetailExpandableSkillsBar
          embedded
          label="SPECIALIZATIONS"
          skills={specializations}
          initialVisibleCount={4}
          editLabel="Edit skills"
          onEdit={onEditVendor ? () => navigateToEdit('profile') : undefined}
        />
      </div>

      {/* Floating Underline Workspace Tabs */}
      <DetailUnderlineTabs
        ariaLabel="Vendor workspace sections"
        tabs={vendorTabs}
        activeTab={workspaceTab}
        onChange={setWorkspaceTab}
      />

      {/* TAB 1: Consultants & Specializations */}
      {workspaceTab === 'consultants' && (
        <div className="space-y-6">

          <section className="bg-white rounded-xl border border-slate-200/90 card-shadow overflow-hidden text-xs">
            <div className="px-6 py-4 border-b border-slate-100 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <UserCheck className="w-3.5 h-3.5 text-brand-600" />
                <h2 className="font-bold text-slate-900">
                  Supplied Consultants ({vendorCandidates.length})
                </h2>
              </div>
              {vendorCandidates.length > 0 && (
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={candidateSearch}
                    onChange={(e) => setCandidateSearch(e.target.value)}
                    placeholder="Filter consultants or skills..."
                    className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white w-full sm:w-56 text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-brand-600"
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
                  <table className={STAFFING_GRID_TABLE_CLASS}>
                    <thead className={STAFFING_GRID_THEAD_CLASS}>
                      <tr>
                        <SortableTableHeader
                          label="Consultant"
                          icon={<User className="w-3 h-3" />}
                          column="fullName"
                          sort={candidatesSort.sort}
                          onSort={candidatesSort.handleSort}
                          defaultDir="asc"
                          className={`${STAFFING_GRID_TH_CLASS} ${STAFFING_GRID_STICKY_TH_CLASS}`}
                        />
                        <SortableTableHeader
                          label="Title"
                          icon={<Briefcase className="w-3 h-3" />}
                          column="currentTitle"
                          sort={candidatesSort.sort}
                          onSort={candidatesSort.handleSort}
                          defaultDir="asc"
                          className={STAFFING_GRID_TH_CLASS}
                        />
                        <SortableTableHeader
                          label="Work Auth"
                          icon={<ShieldCheck className="w-3 h-3" />}
                          column="workAuth"
                          sort={candidatesSort.sort}
                          onSort={candidatesSort.handleSort}
                          defaultDir="asc"
                          className={STAFFING_GRID_TH_CLASS}
                        />
                        <SortableTableHeader
                          label="Target Rate"
                          icon={<DollarSign className="w-3 h-3" />}
                          column="hourlyRate"
                          sort={candidatesSort.sort}
                          onSort={candidatesSort.handleSort}
                          defaultDir="desc"
                          disabled={rateMasked}
                          className={STAFFING_GRID_TH_CLASS}
                        />
                        <SortableTableHeader
                          label="Stage"
                          icon={<Layers className="w-3 h-3" />}
                          column="pipelineStage"
                          sort={candidatesSort.sort}
                          onSort={candidatesSort.handleSort}
                          defaultDir="asc"
                          align="right"
                          className={STAFFING_GRID_TH_CLASS}
                        />
                      </tr>
                    </thead>
                    <tbody className="text-slate-700">
                      {candidatesPg.pagedItems.map((c) => (
                        <tr
                          key={c.id}
                          onClick={onSelectCandidate ? () => onSelectCandidate(c) : undefined}
                          className={onSelectCandidate ? STAFFING_GRID_ROW_CLASS : STAFFING_GRID_ROW_STATIC_CLASS}
                        >
                          <td
                            className={`${STAFFING_GRID_CELL_CLASS} ${STAFFING_GRID_STICKY_TD_CLASS} font-semibold text-slate-900 whitespace-nowrap ${
                              onSelectCandidate ? 'group-hover:text-brand-700 transition-colors' : ''
                            }`}
                          >
                            {c.fullName}
                          </td>
                          <td className={`${STAFFING_GRID_CELL_CLASS} text-slate-600`}>{c.currentTitle || '—'}</td>
                          <td className={`${STAFFING_GRID_CELL_CLASS} text-slate-600 whitespace-nowrap`}>
                            {c.workAuth || '—'}
                          </td>
                          <td className={`${STAFFING_GRID_CELL_CLASS} whitespace-nowrap tabular-nums`}>
                            <MaskedValue value={c.hourlyRate || '—'} isMasked={rateMasked} />
                          </td>
                          <td className={`${STAFFING_GRID_CELL_CLASS} text-right whitespace-nowrap`}>
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
        <section className="bg-white rounded-xl border border-slate-200/90 card-shadow overflow-hidden text-xs">
          <div className="px-6 py-4 border-b border-slate-100 bg-white flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-brand-600" />
              <h2 className="font-bold text-slate-900">Vendor Contacts ({contactList.length})</h2>
            </div>
            {onEditVendor && (
              <button
                type="button"
                onClick={() => navigateToEdit('contacts')}
                className="h-7 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Pencil className="w-3 h-3 text-slate-400" />
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
                <table className={STAFFING_GRID_TABLE_CLASS}>
                  <thead className={STAFFING_GRID_THEAD_CLASS}>
                    <tr>
                      <SortableTableHeader
                        label="Contact"
                        icon={<User className="w-3 h-3" />}
                        column="fullName"
                        sort={contactsSort.sort}
                        onSort={contactsSort.handleSort}
                        defaultDir="asc"
                        className={`${STAFFING_GRID_TH_CLASS} ${STAFFING_GRID_STICKY_TH_CLASS}`}
                      />
                      <SortableTableHeader
                        label="Designation"
                        icon={<Briefcase className="w-3 h-3" />}
                        column="designation"
                        sort={contactsSort.sort}
                        onSort={contactsSort.handleSort}
                        defaultDir="asc"
                        className={STAFFING_GRID_TH_CLASS}
                      />
                      <GridColumnHeader
                        icon={<Mail className="w-3 h-3" />}
                        label="Email"
                      />
                      <GridColumnHeader
                        icon={<Phone className="w-3 h-3" />}
                        label="Phone"
                      />
                      <SortableTableHeader
                        label="Role"
                        icon={<ShieldCheck className="w-3 h-3" />}
                        column="isPrimary"
                        sort={contactsSort.sort}
                        onSort={contactsSort.handleSort}
                        defaultDir="desc"
                        align="right"
                        className={STAFFING_GRID_TH_CLASS}
                      />
                    </tr>
                  </thead>
                  <tbody className="text-slate-700">
                    {contactsPg.pagedItems.map((cnt, idx) => (
                      <tr key={cnt.id || idx} className={STAFFING_GRID_ROW_STATIC_CLASS}>
                        <td className={`${STAFFING_GRID_CELL_CLASS} ${STAFFING_GRID_STICKY_TD_CLASS} font-semibold text-slate-900 whitespace-nowrap`}>
                          {cnt.fullName || 'Unnamed Contact'}
                        </td>
                        <td className={`${STAFFING_GRID_CELL_CLASS} text-slate-600 whitespace-nowrap`}>
                          {cnt.designation || '—'}
                        </td>
                        <td className={STAFFING_GRID_CELL_CLASS}>
                          <ContactActionChips
                            email={cnt.email}
                            layout="stack"
                            maxEmailWidthClass="max-w-[210px]"
                            showEmptyPlaceholder
                          />
                        </td>
                        <td className={`${STAFFING_GRID_CELL_CLASS} whitespace-nowrap`}>
                          <ContactActionChips
                            phone={cnt.phone}
                            layout="stack"
                            showEmptyPlaceholder
                          />
                        </td>
                        <td className={`${STAFFING_GRID_CELL_CLASS} text-right whitespace-nowrap`}>
                          {cnt.isPrimary ? (
                            <StatusBadge tone="emerald" size="xs" label="Primary" />
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
        <section className="bg-white rounded-xl border border-slate-200/90 card-shadow overflow-hidden text-xs">
          <div className="px-6 py-4 border-b border-slate-100 bg-white flex items-center justify-between">
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
                <table className={STAFFING_GRID_TABLE_CLASS}>
                  <thead className={STAFFING_GRID_THEAD_CLASS}>
                    <tr>
                      <SortableTableHeader
                        label="Consultant"
                        icon={<User className="w-3 h-3" />}
                        column="resourceName"
                        sort={placementsSort.sort}
                        onSort={placementsSort.handleSort}
                        defaultDir="asc"
                        className={`${STAFFING_GRID_TH_CLASS} ${STAFFING_GRID_STICKY_TH_CLASS}`}
                      />
                      <SortableTableHeader
                        label="Client"
                        icon={<Building2 className="w-3 h-3" />}
                        column="customer"
                        sort={placementsSort.sort}
                        onSort={placementsSort.handleSort}
                        defaultDir="asc"
                        className={STAFFING_GRID_TH_CLASS}
                      />
                      <SortableTableHeader
                        label="Role / Skill"
                        icon={<Briefcase className="w-3 h-3" />}
                        column="skillRole"
                        sort={placementsSort.sort}
                        onSort={placementsSort.handleSort}
                        defaultDir="asc"
                        className={STAFFING_GRID_TH_CLASS}
                      />
                      <SortableTableHeader
                        label="Contract Period"
                        icon={<CalendarClock className="w-3 h-3" />}
                        column="startDate"
                        sort={placementsSort.sort}
                        onSort={placementsSort.handleSort}
                        defaultDir="desc"
                        className={STAFFING_GRID_TH_CLASS}
                      />
                      <SortableTableHeader
                        label="Pay Rate"
                        icon={<DollarSign className="w-3 h-3" />}
                        column="payRate"
                        sort={placementsSort.sort}
                        onSort={placementsSort.handleSort}
                        defaultDir="desc"
                        disabled={rateMasked}
                        className={STAFFING_GRID_TH_CLASS}
                      />
                      <SortableTableHeader
                        label="Status"
                        icon={<CheckCircle2 className="w-3 h-3" />}
                        column="status"
                        sort={placementsSort.sort}
                        onSort={placementsSort.handleSort}
                        defaultDir="asc"
                        align="right"
                        className={STAFFING_GRID_TH_CLASS}
                      />
                    </tr>
                  </thead>
                  <tbody className="text-slate-700">
                    {placementsPg.pagedItems.map((p) => (
                      <tr
                        key={p.id}
                        onClick={onSelectPlacement ? () => onSelectPlacement(p) : undefined}
                        className={onSelectPlacement ? STAFFING_GRID_ROW_CLASS : STAFFING_GRID_ROW_STATIC_CLASS}
                      >
                        <td
                          className={`${STAFFING_GRID_CELL_CLASS} ${STAFFING_GRID_STICKY_TD_CLASS} font-semibold text-slate-900 whitespace-nowrap ${
                            onSelectPlacement ? 'group-hover:text-brand-700 transition-colors' : ''
                          }`}
                        >
                          {p.resourceName}
                        </td>
                        <td className={`${STAFFING_GRID_CELL_CLASS} text-slate-700 whitespace-nowrap`}>
                          {p.customer}
                        </td>
                        <td className={`${STAFFING_GRID_CELL_CLASS} text-slate-600`}>{p.skillRole}</td>
                        <td className={`${STAFFING_GRID_CELL_CLASS} text-slate-500 whitespace-nowrap font-mono tabular-nums text-[11px]`}>
                          {p.startDate} &rarr; {p.endDate}
                        </td>
                        <td className={`${STAFFING_GRID_CELL_CLASS} whitespace-nowrap tabular-nums`}>
                          <MaskedValue value={p.payRate || '—'} isMasked={rateMasked} />
                        </td>
                        <td className={`${STAFFING_GRID_CELL_CLASS} text-right whitespace-nowrap`}>
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
          <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200/90 card-shadow overflow-hidden text-xs">
            <div className="px-6 py-4 border-b border-slate-100 bg-white flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <div>
                  <h3 className="font-bold text-slate-900">Agreement &amp; Commercial Terms</h3>
                  <p className="text-[11px] text-slate-400">
                    Vendor compliance, certificate of insurance, and payment schedule.
                  </p>
                </div>
              </div>
              {onEditVendor && (
                <button
                  type="button"
                  onClick={() => navigateToEdit('compliance')}
                  className="h-7 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                >
                  <Pencil className="w-3 h-3 text-slate-400" />
                  <span>Edit Terms &amp; Compliance</span>
                </button>
              )}
            </div>

            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-5">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  MSA Status
                </div>
                <div className="font-semibold text-slate-900">
                  {isMsaExecuted ? 'MSA Executed' : 'Pending Review'}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
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
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Payment Terms
                </div>
                <div className="font-semibold text-slate-900">
                  {vendor.paymentTerms || '—'}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Invoicing Schedule
                </div>
                <div className="font-semibold text-slate-900">
                  {vendor.invoicingTerms || '—'}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Location
                </div>
                <div className="font-semibold text-slate-900">
                  {vendor.location || '—'}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
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
              <div className="bg-white rounded-xl border border-slate-200/90 card-shadow overflow-hidden text-xs">
                <div className="px-5 py-3.5 border-b border-slate-100 bg-white flex items-center gap-2">
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
                  <button
                    type="button"
                    onClick={() => setShowDeleteModal(true)}
                    className="px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 font-semibold text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            )}
          </aside>
        </div>
      )}

      {onDeleteVendor && (
        <ConfirmDeleteModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          title="Delete Vendor?"
          description={
            <>
              Permanently remove <strong className="text-slate-800">{vendor.name}</strong> from
              Staffing Vendors?
            </>
          }
          warningText="This cannot be undone."
          confirmLabel="Delete Vendor"
          onConfirm={async () => {
            await onDeleteVendor(vendor);
            onBack();
          }}
        />
      )}
    </section>
  );
};
