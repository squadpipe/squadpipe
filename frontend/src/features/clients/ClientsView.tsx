import React, { useState, useEffect } from 'react';
import {
  Briefcase,
  Building2,
  CheckCircle2,
  ChevronRight,
  Globe,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  User,
  Users,
} from 'lucide-react';
import { apiClient } from '../../config/api.config';
import { Client, Requirement, BillablePlacement } from '../../types';
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
import { mapClientFromApi } from '../../utils/entityMappers';
import { sortArrayByColumn, useTableSort } from '../../utils/tableSort';

interface ClientsViewProps {
  clients: Client[];
  requirements: Requirement[];
  placements: BillablePlacement[];
  onOpenAddClient: () => void;
  onSelectClient: (client: Client, startEditing?: boolean) => void;
  onEditClient?: (client: Client) => void;
  onClientUpdated?: (updatedClient: Client) => void;
  onDeleteClient?: (client: Client) => Promise<void> | void;
  showToast: (title: string, message: string, icon?: string) => void;
}

export const ClientsView: React.FC<ClientsViewProps> = ({
  clients,
  requirements,
  placements,
  onOpenAddClient,
  onSelectClient,
  onEditClient,
  onDeleteClient,
}) => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const tableSort = useTableSort<'name' | 'location' | 'requirementsCount' | 'placementsCount'>();
  const [serverClients, setServerClients] = useState<Client[]>(() => clients.slice(0, 10));
  const [totalClients, setTotalClients] = useState(clients.length);
  const [isLoadingClients, setIsLoadingClients] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);

  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, tableSort.sort.sortBy, tableSort.sort.sortDir]);

  useEffect(() => {
    let active = true;
    setIsLoadingClients(true);
    apiClient
      .get('/clients', {
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
          const mapped = res.data.data.map(mapClientFromApi);
          setServerClients(mapped);
          setTotalClients(res.data.pagination?.total ?? mapped.length);
        }
      })
      .catch(() => {
        if (!active) return;
        const q = debouncedSearch.toLowerCase();
        const filteredFallback = clients.filter(
          (c) => !q || c.name.toLowerCase().includes(q) || c.location.toLowerCase().includes(q)
        );
        const sortedFallback = sortArrayByColumn(filteredFallback, tableSort.sort, {
          name: (c) => c.name,
          location: (c) => c.location,
          requirementsCount: (c) =>
            requirements.filter((r) => r.companyName.toLowerCase() === c.name.toLowerCase()).length,
          placementsCount: (c) =>
            placements.filter(
              (p) =>
                p.customer.toLowerCase() === c.name.toLowerCase() &&
                p.status !== 'Completed' &&
                p.status !== 'Terminated'
            ).length,
        });
        setTotalClients(sortedFallback.length);
        setServerClients(sortedFallback.slice((page - 1) * limit, page * limit));
      })
      .finally(() => {
        if (active) setIsLoadingClients(false);
      });
    return () => {
      active = false;
    };
  }, [
    debouncedSearch,
    page,
    limit,
    clients,
    tableSort.sort.sortBy,
    tableSort.sort.sortDir,
    tableSort.sortParams,
  ]);

  const filtered = serverClients;

  return (
    <section className="max-w-7xl mx-auto px-1 sm:px-2 lg:px-4 space-y-5 pb-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-[19px] font-semibold text-slate-900 tracking-tight leading-snug">Clients</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage client companies, hiring contacts, and active staffing agreements.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search enterprise clients..."
              className="h-8 pl-8 pr-3 bg-white border border-slate-200 rounded-lg text-xs w-64 text-slate-700 outline-none focus:border-brand-500"
            />
          </div>
          <button
            onClick={onOpenAddClient}
            className="h-8 px-3.5 rounded-lg bg-brand-600 text-white text-[11px] font-semibold hover:bg-brand-700 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={1.75} />
            <span>Add Client</span>
          </button>
        </div>
      </div>

      {/* Clients Table List View */}
      <div className={STAFFING_GRID_FRAME_CLASS}>
        <div className="overflow-x-auto">
          <table className={STAFFING_GRID_TABLE_CLASS}>
            <thead className={STAFFING_GRID_THEAD_CLASS}>
              <tr>
                <SortableTableHeader
                  label="Client Company"
                  icon={<Building2 className="w-3 h-3" />}
                  column="name"
                  sort={tableSort.sort}
                  onSort={tableSort.handleSort}
                  defaultDir="asc"
                  uppercase={false}
                  className={`${STAFFING_GRID_TH_CLASS} ${STAFFING_GRID_STICKY_TH_CLASS}`}
                />
                <GridColumnHeader
                  icon={<User className="w-3 h-3" />}
                  label="Primary Contact"
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
                  label="Requisitions"
                  icon={<Briefcase className="w-3 h-3" />}
                  column="requirementsCount"
                  sort={tableSort.sort}
                  onSort={tableSort.handleSort}
                  defaultDir="desc"
                  uppercase={false}
                  className={STAFFING_GRID_TH_CLASS}
                />
                <SortableTableHeader
                  label="Active Placements"
                  icon={<CheckCircle2 className="w-3 h-3" />}
                  column="placementsCount"
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
                  <td colSpan={7} className="py-12 px-6 text-center text-xs text-slate-400">
                    {search.trim() ? (
                      <>
                        No client companies match your search.{' '}
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
                        No client companies found. Click{' '}
                        <button
                          type="button"
                          onClick={onOpenAddClient}
                          className="font-semibold text-brand-600 hover:text-brand-700 hover:underline cursor-pointer"
                        >
                          Add Client
                        </button>{' '}
                        to register an enterprise account.
                      </>
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map((client) => {
                  const clientReqs = requirements.filter(
                    (r) => r.companyName.toLowerCase() === client.name.toLowerCase()
                  );
                  const clientPlacements = placements.filter(
                    (p) =>
                      p.customer.toLowerCase() === client.name.toLowerCase() &&
                      p.status !== 'Completed' &&
                      p.status !== 'Terminated'
                  );
                  const primaryContact =
                    client.contacts.find((c) => c.isPrimary) || client.contacts[0];
                  const extraContactsCount = Math.max(0, client.contacts.length - 1);
                  const cleanWebsite = client.website
                    ? client.website.replace(/^https?:\/\//i, '').replace(/\/$/, '')
                    : '';

                  return (
                    <tr
                      key={client.id}
                      onClick={() => onSelectClient(client, false)}
                      className={STAFFING_GRID_ROW_CLASS}
                    >
                      <td className={`${STAFFING_GRID_CELL_CLASS} ${STAFFING_GRID_STICKY_TD_CLASS} whitespace-nowrap`}>
                        <div className="font-semibold text-slate-900 group-hover:text-brand-700 transition-colors">
                          {client.name}
                        </div>
                        {cleanWebsite && cleanWebsite !== 'https://' && (
                          <div className="text-[11px] text-brand-600 flex items-center gap-1 mt-0.5">
                            <Globe className="w-2.5 h-2.5 flex-shrink-0" />
                            <span className="truncate max-w-[200px]">{cleanWebsite}</span>
                          </div>
                        )}
                      </td>
                      <td className={`${STAFFING_GRID_CELL_CLASS} text-slate-800`}>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium">
                            {primaryContact?.name || (primaryContact as any)?.fullName || '—'}
                          </span>
                          {extraContactsCount > 0 && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white border border-slate-300 text-slate-600 text-[11px] font-semibold">
                              <Users className="w-2.5 h-2.5" />+{extraContactsCount}
                            </span>
                          )}
                        </div>
                        {primaryContact?.designation && (
                          <div className="text-[11px] text-slate-400">{primaryContact.designation}</div>
                        )}
                      </td>
                      <td className={`${STAFFING_GRID_CELL_CLASS} text-[11px] text-slate-500`}>
                        <ContactActionChips
                          phone={client.boardNumber || primaryContact?.phone}
                          email={primaryContact?.email}
                          layout="stack"
                          maxEmailWidthClass="max-w-[190px]"
                          showEmptyPlaceholder
                        />
                      </td>
                      <td className={`${STAFFING_GRID_CELL_CLASS} text-slate-600`}>
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                          <span>{client.location || '—'}</span>
                        </div>
                      </td>
                      <td className={`${STAFFING_GRID_CELL_CLASS} whitespace-nowrap`}>
                        <StatusBadge
                          tone="slate"
                          size="xs"
                          label={`${clientReqs.length} ${clientReqs.length === 1 ? 'Req' : 'Reqs'}`}
                        />
                      </td>
                      <td className={`${STAFFING_GRID_CELL_CLASS} whitespace-nowrap`}>
                        <StatusBadge
                          label={`${clientPlacements.length} Active`}
                          tone={clientPlacements.length > 0 ? 'emerald' : 'slate'}
                          size="xs"
                        />
                      </td>
                      <td className={`${STAFFING_GRID_CELL_CLASS} text-right whitespace-nowrap`}>
                        <div className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => onSelectClient(client, false)}
                            title="View client details"
                            className="h-7 px-2.5 rounded-lg border border-slate-200 bg-white text-[11px] font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <span>View</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onEditClient ? onEditClient(client) : onSelectClient(client, true)
                            }
                            title="Edit client"
                            className="p-1.5 rounded text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {onDeleteClient && (
                            <button
                              type="button"
                              onClick={() => setClientToDelete(client)}
                              title="Delete client"
                              className="p-1.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
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
          total={totalClients}
          onPageChange={setPage}
          onLimitChange={(nextLimit) => {
            setLimit(nextLimit);
            setPage(1);
          }}
          itemLabel="clients"
          isLoading={isLoadingClients}
          pageSizeOptions={[10, 20, 50]}
        />
      </div>

      {onDeleteClient && (
        <ConfirmDeleteModal
          isOpen={Boolean(clientToDelete)}
          onClose={() => setClientToDelete(null)}
          title="Delete Client?"
          description={
            clientToDelete ? (
              <>
                Permanently remove <strong className="text-slate-800">{clientToDelete.name}</strong>{' '}
                from your Client Directory?
              </>
            ) : null
          }
          warningText="This cannot be undone."
          confirmLabel="Delete Client"
          onConfirm={async () => {
            if (!clientToDelete) return;
            await onDeleteClient(clientToDelete);
          }}
        />
      )}
    </section>
  );
};
