import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Briefcase,
  Building2,
  CheckCircle2,
  ExternalLink,
  FileText,
  Globe,
  Layers,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Search,
  Trash2,
  Users,
} from 'lucide-react';
import { BillablePlacement, Client, Requirement } from '../../types';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { ConfirmDeleteModal } from '../../components/shared/ConfirmDeleteModal';
import { getInitials } from '../../utils/entityMappers';
import { SortableTableHeader } from '../../components/shared/SortableTableHeader';
import { TablePagination } from '../../components/shared/TablePagination';
import { MaskedValue } from '../../components/shared/MaskedValue';
import {
  DetailBreadcrumb,
  DetailTabItem,
  DetailUnderlineTabs,
} from '../../components/shared/DetailPageShell';
import { getStageDotClass } from '../../utils/stageStyles';
import { useClientPagination } from '../../utils/usePagination';
import {
  extractRateSortValue,
  sortArrayByColumn,
  useTableSort,
} from '../../utils/tableSort';

interface ClientDetailPageProps {
  client: Client | null;
  backLabel?: string;
  onBack: () => void;
  requirements: Requirement[];
  placements: BillablePlacement[];
  rateMasked?: boolean;
  onEditClient?: (client: Client, focusSection?: 'account' | 'contacts') => void;
  onOpenRequirement?: (req: Requirement) => void;
  onSelectPlacement?: (placement: BillablePlacement) => void;
  onDeleteClient?: (client: Client) => Promise<void> | void;
}

export const ClientDetailPage: React.FC<ClientDetailPageProps> = ({
  client,
  backLabel = 'Back to Clients',
  onBack,
  requirements,
  placements,
  rateMasked = false,
  onEditClient,
  onOpenRequirement,
  onSelectPlacement,
  onDeleteClient,
}) => {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [workspaceTab, setWorkspaceTab] = useState<'requisitions' | 'contacts' | 'placements' | 'account'>('requisitions');
  const [reqFilter, setReqFilter] = useState<'All' | 'Open' | 'Closed'>('All');
  const [reqSearch, setReqSearch] = useState('');
  const contactsSort = useTableSort<'name' | 'designation' | 'isPrimary'>();
  const reqsSort = useTableSort<'code' | 'opportunityTitle' | 'assignedRecruiter' | 'location' | 'status'>();
  const placementsSort = useTableSort<'resourceName' | 'skillRole' | 'startDate' | 'billing' | 'status'>();

  useEffect(() => {
    setShowDeleteModal(false);
    setWorkspaceTab('requisitions');
    setReqFilter('All');
    setReqSearch('');
    contactsSort.resetSort();
    reqsSort.resetSort();
    placementsSort.resetSort();
  }, [client?.id]);

  const clientReqs = client
    ? requirements.filter((r) => r.companyName.toLowerCase() === client.name.toLowerCase())
    : [];
  const filteredClientReqs = clientReqs.filter((r) => {
    const isClosed = r.status === 'Closed';
    if (reqFilter === 'Open' && isClosed) return false;
    if (reqFilter === 'Closed' && !isClosed) return false;
    if (reqSearch.trim()) {
      const q = reqSearch.toLowerCase();
      const rec =
        typeof r.assignedRecruiter === 'object' && r.assignedRecruiter !== null
          ? (r.assignedRecruiter as any).fullName || ''
          : r.assignedRecruiter || '';
      return (
        r.code.toLowerCase().includes(q) ||
        r.opportunityTitle.toLowerCase().includes(q) ||
        (r.location || '').toLowerCase().includes(q) ||
        rec.toLowerCase().includes(q)
      );
    }
    return true;
  });
  const clientPlacements = client
    ? placements.filter((p) => p.customer.toLowerCase() === client.name.toLowerCase())
    : [];

  const sortedContacts = sortArrayByColumn(client?.contacts || [], contactsSort.sort, {
    name: (c) => c.name || (c as any).fullName || '',
    designation: (c) => c.designation || '',
    isPrimary: (c) => Boolean(c.isPrimary),
  });
  const sortedReqs = sortArrayByColumn(filteredClientReqs, reqsSort.sort, {
    code: (r) => r.code,
    opportunityTitle: (r) => r.opportunityTitle,
    assignedRecruiter: (r) =>
      typeof r.assignedRecruiter === 'object' && r.assignedRecruiter !== null
        ? (r.assignedRecruiter as any).fullName || ''
        : r.assignedRecruiter || '',
    location: (r) => r.location,
    status: (r) => r.status,
  });
  const sortedPlacements = sortArrayByColumn(clientPlacements, placementsSort.sort, {
    resourceName: (p) => p.resourceName,
    skillRole: (p) => p.skillRole,
    startDate: (p) => (p.startDate ? new Date(p.startDate) : null),
    billing: (p) => (rateMasked ? null : extractRateSortValue(p.billing)),
    status: (p) => p.status,
  });

  const contactsPg = useClientPagination(
    sortedContacts,
    10,
    `${client?.id || ''}|contacts|${contactsSort.sort.sortBy || ''}|${contactsSort.sort.sortDir}`
  );
  const reqsPg = useClientPagination(
    sortedReqs,
    10,
    `${client?.id || ''}|reqs|${reqFilter}|${reqSearch}|${reqsSort.sort.sortBy || ''}|${reqsSort.sort.sortDir}`
  );
  const placementsPg = useClientPagination(
    sortedPlacements,
    10,
    `${client?.id || ''}|placements|${placementsSort.sort.sortBy || ''}|${placementsSort.sort.sortDir}`
  );

  if (!client) {
    return (
      <section className="max-w-7xl mx-auto py-16 text-center space-y-3 animate-fade-in">
        <p className="text-sm font-semibold text-slate-700">Client account not found.</p>
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

  const activeClientPlacements = clientPlacements.filter(
    (p) => p.status !== 'Completed' && p.status !== 'Terminated'
  );

  const cleanWebsite = client.website
    ? client.website.replace(/^https?:\/\//i, '').replace(/\/$/, '')
    : '';
  const websiteHref = client.website
    ? /^https?:\/\//i.test(client.website)
      ? client.website
      : `https://${client.website}`
    : '';

  const customFieldEntries = Object.entries(client.customFields || {}).filter(
    ([, v]) => v !== null && v !== undefined && String(v).trim() !== ''
  );

  const primaryContact =
    client.contacts.find((c) => c.isPrimary) || client.contacts[0];
  const primaryContactName =
    primaryContact?.name || (primaryContact as any)?.fullName || '';
  const openClientReqsCount = clientReqs.filter((r) => r.status !== 'Closed').length;
  const closedClientReqsCount = clientReqs.filter((r) => r.status === 'Closed').length;

  const clientTabs: Array<DetailTabItem<'requisitions' | 'contacts' | 'placements' | 'account'>> = [
    {
      id: 'requisitions',
      label: 'Job Requisitions',
      icon: Briefcase,
      badge: clientReqs.length,
    },
    {
      id: 'contacts',
      label: 'Contact Persons',
      icon: Users,
      badge: client.contacts.length,
    },
    {
      id: 'placements',
      label: 'Billable Placements',
      icon: CheckCircle2,
      badge: clientPlacements.length,
    },
    {
      id: 'account',
      label: 'Account & MSA',
      icon: FileText,
      badge: customFieldEntries.length > 0 ? customFieldEntries.length : undefined,
    },
  ];

  const primaryContactInitials = getInitials(primaryContactName || 'NA');

  return (
    <section className="max-w-7xl mx-auto px-1 sm:px-2 lg:px-4 space-y-5 pb-8 animate-fade-in">
      <DetailBreadcrumb
        backLabel={backLabel}
        onBack={onBack}
        title={client.name}
      />

      {/* Bare Canvas Entity Title & Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-lg sm:text-[19px] font-semibold text-slate-900 tracking-tight leading-snug">
              {client.name}
            </h1>
            {activeClientPlacements.length > 0 && (
              <StatusBadge
                label={`${activeClientPlacements.length} Active Placement${activeClientPlacements.length === 1 ? '' : 's'
                  }`}
                tone="emerald"
                size="xs"
              />
            )}
          </div>
          <div className="flex items-center flex-wrap gap-x-2.5 gap-y-1 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{client.location || 'Enterprise Client Account'}</span>
            </span>
            {primaryContactName && (
              <span className="inline-flex items-center gap-1.5">
                <span className="text-slate-300" aria-hidden="true">&middot;</span>
                <span>Primary: {primaryContactName}</span>
              </span>
            )}
          </div>
        </div>

        {onEditClient && (
          <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
            <button
              type="button"
              onClick={() => onEditClient(client, 'contacts')}
              className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-[11px] font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Users className="w-3.5 h-3.5 text-slate-500" />
              <span>Manage Contacts</span>
            </button>

            <button
              type="button"
              onClick={() => onEditClient(client, 'account')}
              className="h-8 px-3.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-[11px] font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Pencil className="w-3 h-3" />
              <span>Edit Client</span>
            </button>
          </div>
        )}
      </div>

      {/* Standalone 4-Column Summary Card */}
      <div className="bg-white rounded-xl border border-slate-200/90 card-shadow overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 text-xs">
          {/* 1. HQ & Channels */}
          <div className="px-6 py-4 space-y-2 min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              HQ &amp; website
            </div>
            <div className="font-semibold text-slate-900 flex items-start gap-1.5 leading-snug">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
              <span className="break-words">{client.location || 'Location not set'}</span>
            </div>
            <div className="text-[11px] text-slate-500 leading-snug break-words">
              {cleanWebsite && cleanWebsite !== 'https://' ? (
                <a
                  href={websiteHref}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-brand-600 hover:underline font-medium break-all"
                >
                  <Globe className="w-3 h-3 shrink-0" />
                  <span>{cleanWebsite}</span>
                  <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                </a>
              ) : client.boardNumber ? (
                <span>Phone: {client.boardNumber}</span>
              ) : (
                'Website not listed'
              )}
            </div>
          </div>

          {/* 2. Primary Contact */}
          <div className="px-6 py-4 space-y-2.5 min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Primary contact
            </div>
            <div className="flex items-start gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-700 font-semibold text-[11px] flex items-center justify-center shrink-0">
                {primaryContactInitials}
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-slate-900 leading-snug break-words">
                  {primaryContactName || 'No primary contact'}
                </div>
                <div className="text-[11px] text-slate-500 leading-snug break-words mt-0.5">
                  {primaryContact?.email ? (
                    <a href={`mailto:${primaryContact.email}`} className="hover:text-brand-600 break-all">
                      {primaryContact.email}
                    </a>
                  ) : client.boardNumber ? (
                    <span>Board: {client.boardNumber}</span>
                  ) : (
                    `${client.contacts.length} contact${client.contacts.length === 1 ? '' : 's'} on file`
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 3. Job Requisitions */}
          <div className="px-6 py-4 space-y-2 min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Job requisitions
            </div>
            <div className="flex items-baseline gap-1.5 flex-wrap leading-none">
              <span className="text-lg font-bold font-mono text-slate-900 tabular-nums">
                {openClientReqsCount}
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                open &middot; {clientReqs.length} total
              </span>
            </div>
            <div className="text-[11px] text-slate-500 leading-snug">
              {closedClientReqsCount > 0
                ? `${closedClientReqsCount} closed / fulfilled`
                : 'Active client pipeline'}
            </div>
          </div>

          {/* 4. Billable & MSA */}
          <div className="px-6 py-4 space-y-2 min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Billable &amp; MSA
            </div>
            <div className="flex items-baseline gap-1.5 flex-wrap leading-none">
              <span className="text-lg font-bold font-mono text-emerald-700 tabular-nums">
                {activeClientPlacements.length}
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                active &middot; {clientPlacements.length} placements
              </span>
            </div>
            <div className="text-[11px] text-slate-500 leading-snug">
              Standard Corporate MSA (C2C / W2)
            </div>
          </div>
        </div>
      </div>

      {/* Floating Underline Workspace Tabs */}
      <DetailUnderlineTabs
        ariaLabel="Client workspace sections"
        tabs={clientTabs}
        activeTab={workspaceTab}
        onChange={setWorkspaceTab}
      />

      {/* TAB 1: Job Requisitions */}
      {workspaceTab === 'requisitions' && (
        <section className="bg-white rounded-xl border border-slate-200/90 card-shadow overflow-hidden text-xs">
          <div className="px-6 py-4 border-b border-slate-100 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="font-bold text-slate-900">
                Job requisitions
              </h2>
              {clientReqs.length > 0 && (
                <div className="flex items-center gap-1 bg-slate-50/90 p-0.5 rounded-lg border border-slate-200 flex-wrap">
                  {(
                    [
                      { id: 'All' as const, count: clientReqs.length },
                      { id: 'Open' as const, count: openClientReqsCount },
                      ...(closedClientReqsCount > 0
                        ? [{ id: 'Closed' as const, count: closedClientReqsCount }]
                        : []),
                    ]
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setReqFilter(f.id)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${reqFilter === f.id
                        ? 'bg-white text-slate-900 border border-slate-200/90 font-semibold'
                        : 'text-slate-500 hover:text-slate-800 border border-transparent'
                        }`}
                    >
                      {f.id} {f.count}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {clientReqs.length > 0 && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={reqSearch}
                  onChange={(e) => setReqSearch(e.target.value)}
                  placeholder="Filter requisitions..."
                  className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white w-full sm:w-52 text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-brand-600"
                />
              </div>
            )}
          </div>
          {clientReqs.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              No active job orders for this client.
            </div>
          ) : filteredClientReqs.length === 0 ? (
            <div className="py-10 text-center text-slate-400">
              No requisitions match your current filter.{' '}
              <button
                type="button"
                onClick={() => {
                  setReqFilter('All');
                  setReqSearch('');
                }}
                className="font-semibold text-brand-600 hover:underline cursor-pointer"
              >
                Show all requisitions
              </button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <tr>
                      <SortableTableHeader
                        label="Req ID"
                        column="code"
                        sort={reqsSort.sort}
                        onSort={reqsSort.handleSort}
                        defaultDir="asc"
                        className="pl-6 pr-4 py-3 whitespace-nowrap"
                      />
                      <SortableTableHeader
                        label="Opportunity"
                        column="opportunityTitle"
                        sort={reqsSort.sort}
                        onSort={reqsSort.handleSort}
                        defaultDir="asc"
                        className="px-4 py-3 whitespace-nowrap"
                      />
                      <SortableTableHeader
                        label="Recruiter"
                        column="assignedRecruiter"
                        sort={reqsSort.sort}
                        onSort={reqsSort.handleSort}
                        defaultDir="asc"
                        className="px-4 py-3 whitespace-nowrap"
                      />
                      <SortableTableHeader
                        label="Location"
                        column="location"
                        sort={reqsSort.sort}
                        onSort={reqsSort.handleSort}
                        defaultDir="asc"
                        className="px-4 py-3 whitespace-nowrap"
                      />
                      <SortableTableHeader
                        label="Stage"
                        column="status"
                        sort={reqsSort.sort}
                        onSort={reqsSort.handleSort}
                        defaultDir="asc"
                        align="right"
                        className="pl-4 pr-6 py-3 whitespace-nowrap"
                      />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reqsPg.pagedItems.map((r) => (
                      <tr
                        key={r.id}
                        onClick={() => onOpenRequirement && onOpenRequirement(r)}
                        className={
                          onOpenRequirement
                            ? 'hover:bg-slate-50/80 cursor-pointer transition-colors group'
                            : undefined
                        }
                      >
                        <td className="pl-6 pr-4 py-3.5 whitespace-nowrap">
                          <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-white border border-slate-300 text-slate-700">
                            {r.code}
                          </span>
                        </td>
                        <td
                          className={`px-4 py-3.5 font-semibold text-slate-900 ${onOpenRequirement ? 'group-hover:text-brand-700 transition-colors' : ''
                            }`}
                        >
                          {r.opportunityTitle}
                        </td>
                        <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap">
                          {typeof r.assignedRecruiter === 'object' && r.assignedRecruiter !== null
                            ? (r.assignedRecruiter as any).fullName || 'Unassigned'
                            : r.assignedRecruiter || 'Unassigned'}
                        </td>
                        <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap">
                          {r.location || '—'}
                        </td>
                        <td className="pl-4 pr-6 py-3.5 text-right whitespace-nowrap">
                          <StatusBadge
                            stage={r.status}
                            dotClass={getStageDotClass(r.status)}
                            size="xs"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <TablePagination
                page={reqsPg.page}
                limit={reqsPg.limit}
                total={reqsPg.total}
                onPageChange={reqsPg.setPage}
                onLimitChange={reqsPg.setLimit}
                itemLabel="requisitions"
                pageSizeOptions={[10, 20, 50]}
              />
            </>
          )}
        </section>
      )}

      {/* TAB 2: Contact Persons */}
      {workspaceTab === 'contacts' && (
        <section className="bg-white rounded-xl border border-slate-200/90 card-shadow overflow-hidden text-xs">
          <div className="px-6 py-4 border-b border-slate-100 bg-white flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-brand-600" />
              <h2 className="font-bold text-slate-900">
                Client Contact Persons ({client.contacts.length})
              </h2>
            </div>
            {onEditClient && (
              <button
                type="button"
                onClick={() => onEditClient(client, 'contacts')}
                className="h-7 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Pencil className="w-3 h-3 text-slate-400" />
                <span>Manage Contacts</span>
              </button>
            )}
          </div>

          {client.contacts.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              No contact persons added for this client yet.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <tr>
                      <SortableTableHeader
                        label="Contact"
                        column="name"
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
                      <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                        <td className="pl-6 pr-4 py-3.5 font-semibold text-slate-900 whitespace-nowrap">
                          {cnt.name || (cnt as any).fullName}
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
                            <StatusBadge tone="brand" size="xs" label="Primary Lead" />
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

      {/* TAB 3: Billable Placements */}
      {workspaceTab === 'placements' && (
        <section className="bg-white rounded-xl border border-slate-200/90 card-shadow overflow-hidden text-xs">
          <div className="px-6 py-4 border-b border-slate-100 bg-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <h2 className="font-bold text-slate-900">
                Billable Placements ({clientPlacements.length})
              </h2>
            </div>
          </div>
          {clientPlacements.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              No billable consultants placed for this account yet.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
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
                        label="Bill Rate"
                        column="billing"
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
                    {placementsPg.pagedItems.map((b) => (
                      <tr
                        key={b.id}
                        onClick={onSelectPlacement ? () => onSelectPlacement(b) : undefined}
                        className={`group transition-colors ${onSelectPlacement ? 'hover:bg-slate-50/90 cursor-pointer' : 'hover:bg-slate-50/70'
                          }`}
                      >
                        <td
                          className={`pl-6 pr-4 py-3.5 font-semibold text-slate-900 whitespace-nowrap ${onSelectPlacement ? 'group-hover:text-brand-700 transition-colors' : ''
                            }`}
                        >
                          {b.resourceName}
                        </td>
                        <td className="px-4 py-3.5 text-slate-600">{b.skillRole}</td>
                        <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap font-mono text-[11px]">
                          {b.startDate} &rarr; {b.endDate}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <MaskedValue value={b.billing} isMasked={rateMasked} />
                        </td>
                        <td className="pl-4 pr-6 py-3.5 text-right whitespace-nowrap">
                          <StatusBadge stage={b.status} size="xs" />
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

      {/* TAB 4: Account & MSA */}
      {workspaceTab === 'account' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200/90 card-shadow overflow-hidden text-xs">
            <div className="px-6 py-4 border-b border-slate-100 bg-white flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-brand-600" />
                <div>
                  <h3 className="font-bold text-slate-900">Account Profile &amp; MSA</h3>
                  <p className="text-[11px] text-slate-400">
                    Corporate account headquarters, primary hiring lead, and engagement agreement.
                  </p>
                </div>
              </div>
              {onEditClient && (
                <button
                  type="button"
                  onClick={() => onEditClient(client, 'account')}
                  className="h-7 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Pencil className="w-3 h-3 text-slate-400" />
                  <span>Edit Account</span>
                </button>
              )}
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-5">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    HQ Location
                  </div>
                  <div className="font-semibold text-slate-900">{client.location || '—'}</div>
                </div>

                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Board Phone
                  </div>
                  <div className="font-semibold text-slate-900">{client.boardNumber || '—'}</div>
                </div>

                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Website
                  </div>
                  <div className="font-semibold text-slate-900 truncate">
                    {cleanWebsite && cleanWebsite !== 'https://' ? (
                      <a
                        href={websiteHref}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand-600 hover:underline inline-flex items-center gap-1"
                      >
                        <span className="truncate">{cleanWebsite}</span>
                        <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                      </a>
                    ) : (
                      '—'
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Primary Contact
                  </div>
                  <div className="font-semibold text-slate-900 truncate">
                    {primaryContactName || '—'}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Contact Email
                  </div>
                  <div className="font-semibold text-slate-900 truncate">
                    {primaryContact?.email ? (
                      <a href={`mailto:${primaryContact.email}`} className="text-brand-600 hover:underline">
                        {primaryContact.email}
                      </a>
                    ) : (
                      '—'
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Master Services Agreement
                </div>
                <p className="text-xs text-slate-600 leading-relaxed bg-slate-50/70 border border-slate-200/70 rounded-xl p-4">
                  Corporate staffing account under standard Master Services Agreement (MSA). Direct
                  engagement for C2C, W2, contract-to-hire, and project-based staffing requirements.
                </p>
              </div>
            </div>
          </div>

          <aside className="lg:col-span-4 space-y-4">
            <div className="bg-white rounded-xl border border-slate-200/80 card-shadow p-5 space-y-3 text-xs">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Account Overview
              </h3>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2">
                <span className="text-slate-600 font-medium">Open Requisitions</span>
                <span className="font-bold font-mono text-slate-900">{openClientReqsCount}</span>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2">
                <span className="text-slate-600 font-medium">Active Placements</span>
                <span className="font-bold font-mono text-emerald-700">
                  {activeClientPlacements.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setWorkspaceTab('requisitions')}
                className="w-full py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs cursor-pointer transition-colors"
              >
                View Job Requisitions &rarr;
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

            {onDeleteClient && (
              <div className="bg-white rounded-xl border border-slate-200/80 card-shadow p-5 space-y-3 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-slate-900">Client Account</h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Remove from Client Directory.
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

      {onDeleteClient && (
        <ConfirmDeleteModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          title="Delete Client?"
          description={
            <>
              Permanently remove <strong className="text-slate-800">{client.name}</strong> from your
              Client Directory?
            </>
          }
          warningText="This cannot be undone."
          confirmLabel="Delete Client"
          onConfirm={async () => {
            await onDeleteClient(client);
            onBack();
          }}
        />
      )}
    </section>
  );
};
