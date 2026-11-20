import React, { useState, useEffect } from 'react';
import {
  ChevronRight,
  Globe,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  Users,
} from 'lucide-react';
import { apiClient } from '../../config/api.config';
import { Client, Requirement, BillablePlacement } from '../../types';
import { SortableTableHeader } from '../../components/shared/SortableTableHeader';
import { TablePagination } from '../../components/shared/TablePagination';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { ConfirmDeleteModal } from '../../components/shared/ConfirmDeleteModal';
import { EditClientModal } from '../../components/modals/edit/EditClientModal';
import { useDebounce } from '../../utils/useDebounce';
import { mapClientFromApi } from '../../utils/entityMappers';
import { sortArrayByColumn, useTableSort } from '../../utils/tableSort';

interface ClientsViewProps {
  clients: Client[];
  requirements: Requirement[];
  placements: BillablePlacement[];
  onOpenAddClient: () => void;
  onSelectClient: (client: Client, startEditing?: boolean) => void;
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
  onClientUpdated,
  onDeleteClient,
  showToast,
}) => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const tableSort = useTableSort<'name' | 'location' | 'requirementsCount' | 'placementsCount'>();
  const [serverClients, setServerClients] = useState<Client[]>([]);
  const [totalClients, setTotalClients] = useState(clients.length);
  const [isLoadingClients, setIsLoadingClients] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
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
    <section className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">Clients</h1>
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
              className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs w-64 text-slate-700 outline-none focus:border-brand-500"
            />
          </div>
          <button
            onClick={onOpenAddClient}
            className="px-3.5 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-medium hover:bg-brand-700 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={1.75} />
            <span>Add Client</span>
          </button>
        </div>
      </div>

      {/* Clients Table List View */}
      <div className="bg-white rounded-xl border border-slate-200 card-shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">
                <SortableTableHeader
                  label="Client Company"
                  column="name"
                  sort={tableSort.sort}
                  onSort={tableSort.handleSort}
                  defaultDir="asc"
                  className="px-4 py-3"
                />
                <th className="px-4 py-3">Primary Contact</th>
                <th className="px-4 py-3">Phone &amp; Email</th>
                <SortableTableHeader
                  label="Location"
                  column="location"
                  sort={tableSort.sort}
                  onSort={tableSort.handleSort}
                  defaultDir="asc"
                  className="px-4 py-3"
                />
                <SortableTableHeader
                  label="Requisitions"
                  column="requirementsCount"
                  sort={tableSort.sort}
                  onSort={tableSort.handleSort}
                  defaultDir="desc"
                  className="px-4 py-3"
                />
                <SortableTableHeader
                  label="Active Placements"
                  column="placementsCount"
                  sort={tableSort.sort}
                  onSort={tableSort.handleSort}
                  defaultDir="desc"
                  className="px-4 py-3"
                />
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
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
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{client.name}</div>
                        {cleanWebsite && cleanWebsite !== 'https://' && (
                          <div className="text-[11px] text-brand-600 flex items-center gap-1 mt-0.5">
                            <Globe className="w-2.5 h-2.5 flex-shrink-0" />
                            <span className="truncate max-w-[200px]">{cleanWebsite}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-800">
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
                      <td className="px-4 py-3 text-[11px] text-slate-500">
                        <div className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400 flex-shrink-0" />
                          <span>{client.boardNumber || primaryContact?.phone || '—'}</span>
                        </div>
                        {primaryContact?.email && (
                          <div className="text-[11px] text-slate-400 truncate max-w-[200px]">
                            {primaryContact.email}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                          <span>{client.location || '—'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-[11px] px-2 py-0.5 rounded font-medium bg-white border border-slate-300 text-slate-700">
                          {clientReqs.length} {clientReqs.length === 1 ? 'Req' : 'Reqs'}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {clientPlacements.length > 0 ? (
                          <StatusBadge
                            label={`${clientPlacements.length} Active`}
                            tone="emerald"
                            size="xs"
                          />
                        ) : (
                          <span className="text-[11px] px-2 py-0.5 rounded font-medium bg-white border border-slate-200 text-slate-500">
                            0 Active
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => onSelectClient(client, false)}
                            title="View client details"
                            className="px-2 py-1 rounded text-[11px] font-semibold text-brand-600 hover:bg-brand-50 inline-flex items-center gap-0.5 transition-colors cursor-pointer"
                          >
                            <span>View</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingClient(client)}
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

      <EditClientModal
        client={editingClient}
        isOpen={Boolean(editingClient)}
        onClose={() => setEditingClient(null)}
        onClientUpdated={(updated) => {
          setServerClients((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
          if (onClientUpdated) onClientUpdated(updated);
        }}
        showToast={showToast}
      />

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
