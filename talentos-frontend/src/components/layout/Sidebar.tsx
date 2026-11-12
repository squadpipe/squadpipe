import React from 'react';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'fa-solid fa-chart-pie' },
    { id: 'pipeline', label: 'Pipeline', icon: 'fa-solid fa-arrows-split-up-and-left' },
    { id: 'consultants', label: 'Consultants', icon: 'fa-solid fa-user-group' },
    { id: 'clients', label: 'Clients', icon: 'fa-solid fa-building' },
    { id: 'vendors', label: 'Vendors', icon: 'fa-solid fa-handshake' },
    { id: 'billable', label: 'Billables', icon: 'fa-solid fa-file-invoice-dollar' },
  ];

  const adminItems = [
    { id: 'user_management', label: 'Team Roles', icon: 'fa-solid fa-users-gear' },
    { id: 'custom_fields', label: 'Custom Fields', icon: 'fa-solid fa-sliders' },
    { id: 'automation', label: 'Automations', icon: 'fa-solid fa-bolt' },
    { id: 'import_data', label: 'Data Import', icon: 'fa-solid fa-file-arrow-up' },
  ];

  return (
    <aside className="w-64 bg-[#0B0F17] flex flex-col justify-between border-r border-white/5 select-none h-screen flex-shrink-0 z-30">
      <div>
        {/* Brand Header */}
        <div 
          onClick={() => onNavigate('dashboard')}
          className="h-16 px-6 flex items-center gap-3 border-b border-white/5 cursor-pointer hover:bg-white/[0.02] transition-colors"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-brand-600/30">
            <i className="fa-solid fa-bolt text-sm"></i>
          </div>
          <div>
            <span className="font-extrabold text-base tracking-tight text-white flex items-center gap-1.5">
              Talent<span className="text-brand-400 font-black">OS</span>
            </span>
            <div className="text-[10px] text-slate-400 font-mono tracking-wider uppercase font-semibold">
              IT CRM & Staffing
            </div>
          </div>
        </div>

        {/* Navigation Core */}
        <div className="p-3 space-y-1">
          <div className="px-3 pt-3 pb-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
            Workspaces
          </div>
          {menuItems.map((item) => {
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/20'
                    : 'text-slate-300 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <i className={`${item.icon} w-4 text-center text-sm ${isActive ? 'text-white' : 'text-slate-400'}`}></i>
                <span>{item.label}</span>
              </button>
            );
          })}

          <div className="px-3 pt-5 pb-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
            Operations & Rules
          </div>
          {adminItems.map((item) => {
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/20'
                    : 'text-slate-300 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <i className={`${item.icon} w-4 text-center text-sm ${isActive ? 'text-white' : 'text-slate-400'}`}></i>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* System Status Footer */}
      <div className="p-4 border-t border-white/5 bg-[#080C13]">
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>API Online</span>
          </div>
          <span className="font-mono text-[10px] bg-white/5 px-2 py-0.5 rounded text-slate-300">v1.0-prod</span>
        </div>
      </div>
    </aside>
  );
};

