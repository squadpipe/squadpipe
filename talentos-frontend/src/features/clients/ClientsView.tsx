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
  X,
} from 'lucide-react';
import { apiClient } from '../../config/api.config';
import { Client, Requirement, BillablePlacement } from '../../types';
import { ClientDetailDrawer } from '../../components/modals/ClientDetailDrawer';
import { TablePagination } from '../../components/shared/TablePagination';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { ActionButton } from '../../components/shared/ActionButton';
import { DynamicCustomFieldsSection } from '../../components/shared/DynamicCustomFieldsSection';
import { useDebounce } from '../../utils/useDebounce';
import { mapClientFromApi } from '../../utils/entityMappers';

interface ClientsViewProps {
  clients: Client[];
  requirements: Requirement[];
  placements: BillablePlacement[];
  onOpenAddClient: () => void;
  onDeleteClient?: (client: Client) => void;
  onClientUpdated?: (updatedClient: Client) => void;
  showToast?: (title: string, message: string, icon?: string) => void;
}

export const ClientsView: React.FC<ClientsViewProps> = ({
  clients,
  requirements,
  placements,
  onOpenAddClient,
  onDeleteClient,
  onClientUpdated,
  showToast = () => {},
}) => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [serverClients, setServerClients] = useState<Client[]>([]);
  const [totalClients, setTotalClients] = useState(clients.length);
  const [isLoadingClients, setIsLoadingClients] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isSavingClient, setIsSavingClient] = useState(false);

  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    let active = true;
    setIsLoadingClients(true);
    apiClient
      .get('/clients', {
        params: {
          search: debouncedSearch.trim() || undefined,
          page,
          limit,
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
        const fallback = clients.filter(
          (c) => !q || c.name.toLowerCase().includes(q) || c.location.toLowerCase().includes(q)
        );
        setTotalClients(fallback.length);
        setServerClients(fallback.slice((page - 1) * limit, page * limit));
      })
      .finally(() => {
        if (active) setIsLoadingClients(false);
      });
    return () => {
      active = false;
    };
  }, [debouncedSearch, page, limit, clients]);

  const filtered = serverClients;

  const handleSaveClientEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;
    setIsSavingClient(true);
    try {
      await apiClient.put(`/clients/${editingClient.id}`, {
        name: editingClient.name,
        website: editingClient.website,
        boardNumber: editingClient.boardNumber,
        location: editingClient.location,
        customFields: editingClient.customFields || {},
      });
      if (onClientUpdated) onClientUpdated(editingClient);
      showToast('Client Updated', `${editingClient.name} details updated.`);
      setEditingClient(null);
    } catch (err: any) {
      showToast('Update Failed', err.response?.data?.message || 'Could not update client.');
    } finally {
      setIsSavingClient(false);
    }
  };

  return (
    <section className="max-w-7xl mx-auto space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Client Companies</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Enterprise accounts, hiring managers, and active staffing agreements.
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
              className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-md text-xs w-64 text-slate-700 outline-none focus:border-brand-500"
            />
          </div>
          <button
            onClick={onOpenAddClient}
            className="px-3.5 py-1.5 rounded-md bg-brand-600 text-white text-xs font-medium hover:bg-brand-700 shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2.4} />
            <span>Add Client</span>
          </button>
        </div>
      </div>

      {/* Clients Table List View */}
      <div className="bg-white rounded-xl border border-slate-200 card-shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                <th className="px-4 py-3">Client Company</th>
                <th className="px-4 py-3">Primary Contact</th>
                <th className="px-4 py-3">Phone &amp; Email</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Requisitions</th>
                <th className="px-4 py-3">Active Placements</th>
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
                      onClick={() => setSelectedClient(client)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{client.name}</div>
                        {cleanWebsite && cleanWebsite !== 'https://' && (
                          <div className="text-[10px] text-brand-600 flex items-center gap-1 mt-0.5">
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
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-semibold">
                              <Users className="w-2.5 h-2.5" />+{extraContactsCount}
                            </span>
                          )}
                        </div>
                        {primaryContact?.designation && (
                          <div className="text-[10px] text-slate-400">{primaryContact.designation}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-slate-500">
                        <div className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400 flex-shrink-0" />
                          <span>{client.boardNumber || primaryContact?.phone || '—'}</span>
                        </div>
                        {primaryContact?.email && (
                          <div className="text-[10px] text-slate-400 truncate max-w-[200px]">
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
                        <span className="text-[11px] px-2 py-0.5 rounded font-medium bg-slate-100 text-slate-700">
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
                          <span className="text-[11px] px-2 py-0.5 rounded font-medium bg-slate-100 text-slate-400">
                            0 Active
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => setSelectedClient(client)}
                            title="View client details"
                            className="px-2 py-1 rounded text-[11px] font-semibold text-brand-600 hover:bg-brand-50 inline-flex items-center gap-0.5 transition-colors cursor-pointer"
                          >
                            <span>View</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingClient({ ...client })}
                            title="Edit client"
                            className="p-1.5 rounded text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {onDeleteClient && (
                            <button
                              type="button"
                              onClick={() => onDeleteClient(client)}
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

      {/* Client Detail Flyout Drawer */}
      <ClientDetailDrawer
        isOpen={Boolean(selectedClient)}
        onClose={() => setSelectedClient(null)}
        client={selectedClient}
        requirements={requirements}
        placements={placements}
        onClientUpdated={(updated) => {
          setSelectedClient(updated);
          if (onClientUpdated) onClientUpdated(updated);
        }}
        showToast={showToast}
      />

      {/* Edit Client Modal */}
      {editingClient && (
        <div
          onClick={() => setEditingClient(null)}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-scale-up"
          >
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Edit Client Account</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">{editingClient.name}</p>
              </div>
              <button
                onClick={() => setEditingClient(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveClientEdit} className="p-6 space-y-3.5 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Company Name *</label>
                <input
                  type="text"
                  required
                  value={editingClient.name}
                  onChange={(e) => setEditingClient({ ...editingClient, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Website</label>
                <input
                  type="text"
                  value={editingClient.website}
                  onChange={(e) => setEditingClient({ ...editingClient, website: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Switchboard Phone</label>
                  <input
                    type="text"
                    value={editingClient.boardNumber}
                    onChange={(e) => setEditingClient({ ...editingClient, boardNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Location *</label>
                  <input
                    type="text"
                    required
                    value={editingClient.location}
                    onChange={(e) => setEditingClient({ ...editingClient, location: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                  />
                </div>
              </div>

              <DynamicCustomFieldsSection
                entity="client"
                values={(editingClient.customFields as Record<string, string>) || {}}
                onChange={(vals) => setEditingClient({ ...editingClient, customFields: vals })}
                isOpen={Boolean(editingClient)}
              />

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={isSavingClient}
                  onClick={() => setEditingClient(null)}
                  className="px-3.5 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
                >
                  Cancel
                </button>
                <ActionButton
                  type="submit"
                  loading={isSavingClient}
                  loadingText="Saving..."
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Save Changes
                </ActionButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
