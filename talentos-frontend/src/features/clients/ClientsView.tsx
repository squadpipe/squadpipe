import React, { useState, useEffect } from 'react';
import {
  Building2,
  ChevronRight,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { apiClient } from '../../config/api.config';
import { Client, Requirement, BillablePlacement } from '../../types';
import { ClientDetailDrawer } from '../../components/modals/ClientDetailDrawer';
import { TablePagination } from '../../components/shared/TablePagination';
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
  const [limit, setLimit] = useState(6);
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

      {/* Clients Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 ? (
          <div className="col-span-full bg-white rounded-xl border border-slate-200 card-shadow py-12 px-6 text-center text-xs text-slate-400">
            No client companies found. Click{' '}
            <button
              type="button"
              onClick={onOpenAddClient}
              className="font-semibold text-brand-600 hover:text-brand-700 hover:underline cursor-pointer"
            >
              Add Client
            </button>{' '}
            to register an enterprise account.
          </div>
        ) : (
          filtered.map((client) => {
          const clientReqs = requirements.filter(
            (r) => r.companyName.toLowerCase() === client.name.toLowerCase()
          );
          const clientPlacements = placements.filter(
            (p) => p.customer.toLowerCase() === client.name.toLowerCase()
          );

          return (
            <div
              key={client.id}
              className="bg-white p-5 rounded-xl border border-slate-200 card-shadow hover:border-brand-500 transition-colors flex flex-col justify-between cursor-pointer"
              onClick={() => setSelectedClient(client)}
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm hover:text-brand-600 transition-colors">
                      {client.name}
                    </h3>
                    <span className="text-[11px] text-brand-600 mt-0.5 block">
                      {client.website}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingClient({ ...client });
                      }}
                      title="Edit client"
                      className="w-8 h-8 rounded-lg bg-slate-50 hover:bg-brand-50 flex items-center justify-center text-slate-400 hover:text-brand-600 text-xs transition-colors cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    {onDeleteClient && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteClient(client);
                        }}
                        title="Delete client"
                        className="w-8 h-8 rounded-lg bg-slate-50 hover:bg-rose-50 flex items-center justify-center text-slate-400 hover:text-rose-600 text-xs transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                      <Building2 className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                <div className="mt-3 text-xs text-slate-500 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span>{client.location}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span>{client.boardNumber || 'Direct Line'}</span>
                  </div>
                </div>

                {/* Contacts List */}
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <div className="text-[10px] font-semibold uppercase text-slate-400 tracking-wider mb-1.5">
                    Contacts ({client.contacts.length})
                  </div>
                  <div className="space-y-1.5">
                    {client.contacts.length === 0 ? (
                      <div className="text-[11px] text-slate-400 italic py-1">No contacts added yet.</div>
                    ) : (
                      client.contacts.map((contact, idx) => (
                        <div
                          key={idx}
                          className="text-xs bg-slate-50 p-2 rounded flex items-center justify-between"
                        >
                          <div className="font-medium text-slate-800">
                            {contact.name || (contact as any).fullName}
                          </div>
                          <span className="text-[10px] text-slate-400">
                            {contact.designation}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Footer Activity Metrics */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                <span className="text-[11px] text-slate-600">
                  <strong className="text-slate-900">{clientReqs.length}</strong> Reqs &bull;{' '}
                  <strong className="text-emerald-700 font-semibold">{clientPlacements.length}</strong> Active Placements
                </span>
                <span className="text-brand-600 text-xs font-semibold flex items-center gap-1 hover:underline">
                  <span>View Details</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          );
        })
        )}
      </div>

      {/* Pagination Bar */}
      <div className="bg-white rounded-xl border border-slate-200 card-shadow overflow-hidden">
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
          pageSizeOptions={[6, 12, 24, 48]}
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

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingClient(null)}
                  className="px-3.5 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingClient}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  {isSavingClient ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
