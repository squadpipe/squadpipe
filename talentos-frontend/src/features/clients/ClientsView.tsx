import React, { useState } from 'react';
import { Client, Requirement, BillablePlacement } from '../../types';
import { ClientDetailDrawer } from '../../components/modals/ClientDetailDrawer';

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
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const filtered = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.location.toLowerCase().includes(search.toLowerCase())
  );

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
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
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
            <i className="fa-solid fa-plus text-[10px]"></i>
            <span>Add Client</span>
          </button>
        </div>
      </div>

      {/* Clients Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((client) => {
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
                    <span className="text-[11px] text-brand-600 font-mono mt-0.5 block">
                      {client.website}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {onDeleteClient && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteClient(client);
                        }}
                        title="Delete client"
                        className="w-8 h-8 rounded-lg bg-slate-50 hover:bg-rose-50 flex items-center justify-center text-slate-400 hover:text-rose-600 text-xs transition-colors cursor-pointer"
                      >
                        <i className="fa-solid fa-trash-can"></i>
                      </button>
                    )}
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 text-xs">
                      <i className="fa-solid fa-building"></i>
                    </div>
                  </div>
                </div>

                <div className="mt-3 text-xs text-slate-500 space-y-1">
                  <div>
                    <i className="fa-solid fa-location-dot w-4 text-slate-400"></i>
                    {client.location}
                  </div>
                  <div>
                    <i className="fa-solid fa-phone w-4 text-slate-400"></i>
                    {client.boardNumber || 'Direct Line'}
                  </div>
                </div>

                {/* Contacts List */}
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <div className="text-[10px] font-semibold uppercase text-slate-400 tracking-wider mb-1.5">
                    Contacts ({client.contacts.length})
                  </div>
                  <div className="space-y-1.5">
                    {client.contacts.map((contact, idx) => (
                      <div
                        key={idx}
                        className="text-xs bg-slate-50 p-2 rounded flex items-center justify-between"
                      >
                        <div className="font-medium text-slate-800">
                          {contact.name || (contact as any).fullName}
                        </div>
                        <span className="text-[10px] font-mono text-slate-400">
                          {contact.designation}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer Activity Metrics */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                <span className="font-mono text-[11px] text-slate-600">
                  <strong className="text-slate-900">{clientReqs.length}</strong> Reqs &bull;{' '}
                  <strong className="text-emerald-700 font-semibold">{clientPlacements.length}</strong> Active Placements
                </span>
                <span className="text-brand-600 text-xs font-semibold flex items-center gap-1 hover:underline">
                  <span>View Details</span>
                  <i className="fa-solid fa-chevron-right text-[9px]"></i>
                </span>
              </div>
            </div>
          );
        })}
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
    </section>
  );
};
