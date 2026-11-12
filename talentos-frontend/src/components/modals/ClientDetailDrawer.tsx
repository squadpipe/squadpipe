import React, { useState } from 'react';
import { Client, Requirement, BillablePlacement } from '../../types';

interface ClientDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client | null;
  requirements: Requirement[];
  placements: BillablePlacement[];
  onOpenAddContact?: () => void;
  showToast: (title: string, message: string, icon?: string) => void;
}

export const ClientDetailDrawer: React.FC<ClientDetailDrawerProps> = ({
  isOpen,
  onClose,
  client,
  requirements,
  placements,
  showToast,
}) => {
  const [activeTab, setActiveTab] = useState<'Overview' | 'Contacts' | 'Requirements' | 'Placements'>('Overview');

  if (!isOpen || !client) return null;

  const clientReqs = requirements.filter(
    (r) => r.companyName.toLowerCase() === client.name.toLowerCase()
  );

  const clientPlacements = placements.filter(
    (p) => p.customer.toLowerCase() === client.name.toLowerCase()
  );

  const getStatusBadge = (status: Requirement['status']) => {
    switch (status) {
      case 'Submitted':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Interview':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Selected':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Onboarding':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col animate-fade-in max-h-[85vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center text-sm border border-brand-100 shadow-2xs">
              <i className="fa-solid fa-building"></i>
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">{client.name}</h2>
              <div className="text-xs text-slate-500 font-mono">
                {client.location} &bull; {client.website}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 border-b border-slate-200 flex gap-6 bg-white text-xs pt-3">
          {(['Overview', 'Contacts', 'Requirements', 'Placements'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-2.5 font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
                activeTab === tab
                  ? 'border-brand-600 text-brand-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>{tab}</span>
              {tab === 'Requirements' && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 font-mono">
                  {clientReqs.length}
                </span>
              )}
              {tab === 'Placements' && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700 font-mono">
                  {clientPlacements.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs flex-1">
          {/* Tab 1: Overview */}
          {activeTab === 'Overview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                    Main Switchboard Phone
                  </span>
                  <span className="font-semibold text-slate-800 text-sm mt-0.5 block">
                    {client.boardNumber || 'Direct Corporate Line'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                    HQ Location
                  </span>
                  <span className="font-semibold text-slate-800 text-sm mt-0.5 block">
                    {client.location}
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-100 text-slate-700 space-y-1.5 leading-relaxed">
                <div className="text-[11px] font-bold text-blue-900 flex items-center gap-1.5">
                  <i className="fa-solid fa-file-contract text-blue-600"></i>
                  <span>Master Services Agreement (MSA) Terms</span>
                </div>
                <p className="text-[11px] text-slate-600">
                  Established corporate staffing account under standard US Master Services Agreement (MSA). Direct engagement for IT contract (C2C & W2), contract-to-hire, and project-based staffing solutions with net-30 terms.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Total Key Contacts</div>
                  <div className="text-base font-extrabold text-slate-800 mt-1">{client.contacts.length}</div>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Active Job Orders</div>
                  <div className="text-base font-extrabold text-blue-600 mt-1">{clientReqs.length}</div>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Live Placements</div>
                  <div className="text-base font-extrabold text-emerald-600 mt-1">{clientPlacements.length}</div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Contacts */}
          {activeTab === 'Contacts' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800">Client Contact Persons ({client.contacts.length})</span>
                <button
                  onClick={() =>
                    showToast(
                      'Contact Added',
                      'New point of contact logged to client directory.',
                      'fa-solid fa-circle-check text-emerald-500'
                    )
                  }
                  className="text-brand-600 font-semibold hover:underline text-xs flex items-center gap-1"
                >
                  <i className="fa-solid fa-plus text-[10px]"></i>
                  <span>Add Contact</span>
                </button>
              </div>

              <div className="space-y-2.5">
                {client.contacts.map((cnt, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 bg-slate-50 hover:bg-slate-100/70 rounded-xl border border-slate-200 flex items-center justify-between transition-colors"
                  >
                    <div>
                      <div className="font-bold text-slate-900 flex items-center gap-2">
                        <span>{cnt.name || (cnt as any).fullName}</span>
                        {cnt.isPrimary && (
                          <span className="text-[9px] font-mono font-bold text-amber-700 bg-amber-100 border border-amber-200 px-1.5 py-0.2 rounded">
                            Primary Lead
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                        {cnt.designation} &bull; {cnt.email}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] font-mono text-slate-600 font-semibold">{cnt.phone}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 3: Requirements */}
          {activeTab === 'Requirements' && (
            <div className="space-y-2.5">
              {clientReqs.length === 0 ? (
                <div className="py-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  No active job orders for this client.
                </div>
              ) : (
                clientReqs.map((r) => (
                  <div
                    key={r.id}
                    className="p-3.5 border border-slate-200 rounded-xl bg-white hover:bg-slate-50/70 flex items-center justify-between transition-colors shadow-2xs"
                  >
                    <div>
                      <div className="font-bold text-slate-900 text-xs">{r.opportunityTitle}</div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        {r.code} &bull; Assigned: {r.assignedRecruiter} &bull; {r.location}
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded text-[10px] font-bold border ${getStatusBadge(
                        r.status
                      )}`}
                    >
                      {r.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tab 4: Placements */}
          {activeTab === 'Placements' && (
            <div className="space-y-2.5">
              {clientPlacements.length === 0 ? (
                <div className="py-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  No active billable consultants currently placed.
                </div>
              ) : (
                clientPlacements.map((b) => (
                  <div
                    key={b.id}
                    className="p-3.5 border border-slate-200 rounded-xl bg-white hover:bg-slate-50/70 flex items-center justify-between transition-colors shadow-2xs"
                  >
                    <div>
                      <div className="font-bold text-slate-900 text-xs">{b.resourceName}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {b.skillRole} &bull; Started: {b.startDate} &bull; Ends: {b.endDate}
                      </div>
                    </div>
                    <span className="text-emerald-700 font-mono font-bold bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded text-xs">
                      {b.billing}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

