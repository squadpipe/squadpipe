import React, { useState } from 'react';
import { Client, Requirement, BillablePlacement } from '../../types';

interface ClientsViewProps {
  clients: Client[];
  requirements: Requirement[];
  placements: BillablePlacement[];
  onOpenAddClient: () => void;
}

export const ClientsView: React.FC<ClientsViewProps> = ({
  clients,
  requirements,
  placements,
  onOpenAddClient,
}) => {
  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const filtered = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.location.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Subheader */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 card-shadow">
        <div className="relative">
          <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search enterprise clients..."
            className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs w-64 text-slate-700"
          />
        </div>

        <button
          onClick={onOpenAddClient}
          className="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm shadow-brand-600/20 transition-all"
        >
          <i className="fa-solid fa-building text-xs"></i>
          <span>Add Client Account</span>
        </button>
      </div>

      {/* Clients Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((client) => {
          const clientReqs = requirements.filter((r) => r.companyName === client.name);
          const clientPlacements = placements.filter((p) => p.customer === client.name);

          return (
            <div
              key={client.id}
              className="bg-white p-5 rounded-xl border border-slate-200 card-shadow hover:border-slate-300 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900">{client.name}</h3>
                    <a
                      href={client.website}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-brand-600 hover:underline flex items-center gap-1 mt-0.5"
                    >
                      <span>{client.website.replace('https://', '')}</span>
                      <i className="fa-solid fa-arrow-up-right-from-square text-[9px]"></i>
                    </a>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    MSA Active
                  </span>
                </div>

                <div className="mt-3 text-xs text-slate-500 flex items-center gap-2">
                  <i className="fa-solid fa-location-dot text-slate-400"></i>
                  <span>{client.location}</span>
                </div>

                {/* Contacts List */}
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <div className="text-[10px] font-bold uppercase text-slate-400 mb-2">Key Account Leads</div>
                  <div className="space-y-2">
                    {client.contacts.map((contact, idx) => (
                      <div key={idx} className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                        <div className="flex items-center justify-between font-bold text-slate-800">
                          <span>{contact.name}</span>
                          {contact.isPrimary && (
                            <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.2 rounded font-semibold">
                              Primary Lead
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium">{contact.designation}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-1">{contact.email}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer Activity Metrics */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-[11px] font-semibold text-slate-600">
                  {clientReqs.length} Open Reqs • {clientPlacements.length} Placements
                </span>
                <button
                  onClick={() => setSelectedClient(client)}
                  className="text-xs font-semibold text-brand-600 hover:text-brand-800"
                >
                  View Details &rarr;
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Client Detail Flyout Modal if clicked */}
      {selectedClient && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 border border-slate-200 card-shadow space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-extrabold text-sm text-slate-900">{selectedClient.name}</h3>
                <p className="text-xs text-slate-400">{selectedClient.location}</p>
              </div>
              <button onClick={() => setSelectedClient(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div className="space-y-2 text-xs text-slate-700">
              <p><strong>Website:</strong> {selectedClient.website}</p>
              <p><strong>Switchboard:</strong> {selectedClient.boardNumber}</p>
              <p><strong>Primary Contact:</strong> {selectedClient.contacts[0]?.name} ({selectedClient.contacts[0]?.email})</p>
            </div>
            <div className="pt-3 border-t flex justify-end">
              <button
                onClick={() => setSelectedClient(null)}
                className="px-4 py-1.5 text-xs font-semibold bg-slate-100 rounded-lg text-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
