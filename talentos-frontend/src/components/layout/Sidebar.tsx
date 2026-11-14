import React, { useState } from 'react';
import {
  Building2,
  ChevronDown,
  FileSpreadsheet,
  FileUp,
  Handshake,
  Kanban,
  LogOut,
  MailCheck,
  MoreVertical,
  PieChart,
  SlidersHorizontal,
  Tags,
  User as UserIcon,
  UserCog,
  Users,
  Zap,
} from 'lucide-react';
import { User } from '../../types';
import { useWorkspaceBrand } from '../../utils/workspaceBrand';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  counts: {
    requirements: number;
    consultants: number;
    clients: number;
    vendors: number;
    billable: number;
    users: number;
    customFields: number;
    activeRules: number;
  };
  currentUser: User | null;
  onOpenProfile: () => void;
  onOpenSignOut: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  counts,
  currentUser,
  onOpenProfile,
  onOpenSignOut,
}) => {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const brand = useWorkspaceBrand();
  const brandName = (brand.agencyName || currentUser?.agencyName || 'TalentOS').trim();

  const userInitials = (currentUser?.name || `${brandName} User`)
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <aside className="w-64 flex flex-col flex-shrink-0 z-20 bg-[#0B0F17] text-slate-300 border-r border-white/10 select-none h-screen">
      {/* Header with Organization Logo, CRM Badge & Live Sync Pulse */}
      <div className="h-14 flex items-center px-4 border-b border-white/10 bg-[#080C13] justify-between flex-shrink-0">
        <div
          className="flex items-center gap-2.5 cursor-pointer group min-w-0"
          onClick={() => onNavigate('dashboard')}
          title={`${brandName} Dashboard`}
        >
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform flex-shrink-0">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z" />
            </svg>
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-bold text-white text-[14px] tracking-tight truncate max-w-[115px]">{brandName}</span>
            <span className="text-[9px] font-bold bg-brand-500/20 text-brand-300 border border-brand-500/30 px-1.5 py-0.5 rounded tracking-wider flex-shrink-0">
              CRM
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="text-[9px]">Live Sync</span>
        </div>
      </div>

      {/* Navigation Menu Items with 3 Structured Categorized Sections */}
      <div className="flex-1 py-3 overflow-y-auto no-scrollbar space-y-4">
        {/* Section 1: Core Modules */}
        <div>
          <div className="px-3.5 text-[10px] font-semibold uppercase tracking-wider mb-1 text-slate-400">
            Core Modules
          </div>

          <div
            onClick={() => onNavigate('dashboard')}
            className={`group flex items-center gap-2.5 px-3 py-2 mx-2 cursor-pointer transition-all text-xs rounded-lg font-medium ${
              currentView === 'dashboard'
                ? 'bg-white/[0.09] text-white shadow-xs font-semibold'
                : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
            }`}
          >
            <PieChart
              className={`w-4 h-4 flex-shrink-0 transition-colors ${
                currentView === 'dashboard' ? 'text-brand-400' : 'text-slate-400 group-hover:text-slate-200'
              }`}
            />
            <span>Dashboard</span>
          </div>

          <div
            onClick={() => onNavigate('pipeline')}
            className={`group flex items-center justify-between px-3 py-2 mx-2 cursor-pointer transition-all text-xs rounded-lg font-medium ${
              currentView === 'pipeline'
                ? 'bg-white/[0.09] text-white shadow-xs font-semibold'
                : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Kanban
                className={`w-4 h-4 flex-shrink-0 transition-colors ${
                  currentView === 'pipeline' ? 'text-brand-400' : 'text-slate-400 group-hover:text-slate-200'
                }`}
              />
              <span>Pipeline</span>
            </div>
            <span className="text-[10px] text-slate-400 bg-white/[0.04] px-1.5 py-0.5 rounded">
              {counts.requirements}
            </span>
          </div>
        </div>

        {/* Section 2: Roster & Network */}
        <div>
          <div className="px-3.5 text-[10px] font-semibold uppercase tracking-wider mb-1 text-slate-400">
            Roster & Network
          </div>

          <div
            onClick={() => onNavigate('consultants')}
            className={`group flex items-center justify-between px-3 py-2 mx-2 cursor-pointer transition-all text-xs rounded-lg font-medium ${
              currentView === 'consultants'
                ? 'bg-white/[0.09] text-white shadow-xs font-semibold'
                : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Users
                className={`w-4 h-4 flex-shrink-0 transition-colors ${
                  currentView === 'consultants' ? 'text-brand-400' : 'text-slate-400 group-hover:text-slate-200'
                }`}
              />
              <span>Consultants</span>
            </div>
            <span className="text-[10px] text-slate-400 bg-white/[0.04] px-1.5 py-0.5 rounded">
              {counts.consultants}
            </span>
          </div>

          <div
            onClick={() => onNavigate('clients')}
            className={`group flex items-center justify-between px-3 py-2 mx-2 cursor-pointer transition-all text-xs rounded-lg font-medium ${
              currentView === 'clients'
                ? 'bg-white/[0.09] text-white shadow-xs font-semibold'
                : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Building2
                className={`w-4 h-4 flex-shrink-0 transition-colors ${
                  currentView === 'clients' ? 'text-brand-400' : 'text-slate-400 group-hover:text-slate-200'
                }`}
              />
              <span>Clients</span>
            </div>
            <span className="text-[10px] text-slate-400 bg-white/[0.04] px-1.5 py-0.5 rounded">
              {counts.clients}
            </span>
          </div>

          <div
            onClick={() => onNavigate('vendors')}
            className={`group flex items-center justify-between px-3 py-2 mx-2 cursor-pointer transition-all text-xs rounded-lg font-medium ${
              currentView === 'vendors'
                ? 'bg-white/[0.09] text-white shadow-xs font-semibold'
                : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Handshake
                className={`w-4 h-4 flex-shrink-0 transition-colors ${
                  currentView === 'vendors' ? 'text-brand-400' : 'text-slate-400 group-hover:text-slate-200'
                }`}
              />
              <span>Vendors</span>
            </div>
            <span className="text-[10px] text-slate-400 bg-white/[0.04] px-1.5 py-0.5 rounded">
              {counts.vendors}
            </span>
          </div>

          <div
            onClick={() => onNavigate('billable')}
            className={`group flex items-center justify-between px-3 py-2 mx-2 cursor-pointer transition-all text-xs rounded-lg font-medium ${
              currentView === 'billable'
                ? 'bg-emerald-500/15 text-emerald-300 shadow-xs font-semibold border border-emerald-500/30'
                : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <FileSpreadsheet
                className={`w-4 h-4 flex-shrink-0 transition-colors ${
                  currentView === 'billable' ? 'text-emerald-400' : 'text-slate-400 group-hover:text-slate-200'
                }`}
              />
              <span>Billable Consultants</span>
            </div>
            <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/30">
              {counts.billable}
            </span>
          </div>
        </div>

        {/* Section 3: Workspace & Data */}
        <div>
          <div className="px-3.5 text-[10px] font-semibold uppercase tracking-wider mb-1 text-slate-400">
            Workspace &amp; Data
          </div>

          <div
            onClick={() => onNavigate('automation')}
            className={`group flex items-center justify-between px-3 py-2 mx-2 cursor-pointer transition-all text-xs rounded-lg font-medium ${
              currentView === 'automation'
                ? 'bg-amber-500/15 text-amber-300 shadow-xs font-semibold border border-amber-500/30'
                : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Zap
                className={`w-4 h-4 flex-shrink-0 transition-colors ${
                  currentView === 'automation' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'
                }`}
              />
              <span>Automations</span>
            </div>
            <span className="text-[9px] font-bold text-amber-300 bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-500/30">
              {counts.activeRules} Active
            </span>
          </div>

          <div
            onClick={() => onNavigate('custom_fields')}
            className={`group flex items-center justify-between px-3 py-2 mx-2 cursor-pointer transition-all text-xs rounded-lg font-medium ${
              currentView === 'custom_fields'
                ? 'bg-white/[0.09] text-white shadow-xs font-semibold'
                : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Tags
                className={`w-4 h-4 flex-shrink-0 transition-colors ${
                  currentView === 'custom_fields' ? 'text-indigo-400' : 'text-slate-400 group-hover:text-slate-200'
                }`}
              />
              <span>Custom Fields</span>
            </div>
            <span className="text-[10px] text-slate-400 bg-white/[0.04] px-1.5 py-0.5 rounded">
              {counts.customFields}
            </span>
          </div>

          <div
            onClick={() => onNavigate('import_data')}
            className={`group flex items-center justify-between px-3 py-2 mx-2 cursor-pointer transition-all text-xs rounded-lg font-medium ${
              currentView === 'import_data'
                ? 'bg-white/[0.09] text-white shadow-xs font-semibold'
                : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <FileUp
                className={`w-4 h-4 flex-shrink-0 transition-colors ${
                  currentView === 'import_data' ? 'text-brand-400' : 'text-slate-400 group-hover:text-slate-200'
                }`}
              />
              <span>Import & Migration</span>
            </div>
            <span className="text-[9px] text-emerald-400 font-medium bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
              CSV/Excel
            </span>
          </div>
        </div>

        {/* Section 4: Settings & Administration */}
        <div>
          <div className="px-3.5 text-[10px] font-semibold uppercase tracking-wider mb-1 text-slate-400">
            Settings &amp; Administration
          </div>

          <div
            onClick={() => onNavigate('settings_general')}
            className={`group flex items-center justify-between px-3 py-2 mx-2 cursor-pointer transition-all text-xs rounded-lg font-medium ${
              currentView === 'settings_general'
                ? 'bg-white/[0.09] text-white shadow-xs font-semibold'
                : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <SlidersHorizontal
                className={`w-4 h-4 flex-shrink-0 transition-colors ${
                  currentView === 'settings_general' ? 'text-brand-400' : 'text-slate-400 group-hover:text-slate-200'
                }`}
              />
              <span>General Settings</span>
            </div>
          </div>

          <div
            onClick={() => onNavigate('settings_smtp')}
            className={`group flex items-center justify-between px-3 py-2 mx-2 cursor-pointer transition-all text-xs rounded-lg font-medium ${
              currentView === 'settings_smtp'
                ? 'bg-white/[0.09] text-white shadow-xs font-semibold'
                : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <MailCheck
                className={`w-4 h-4 flex-shrink-0 transition-colors ${
                  currentView === 'settings_smtp' ? 'text-brand-400' : 'text-slate-400 group-hover:text-slate-200'
                }`}
              />
              <span>Email Setup (SMTP)</span>
            </div>
            <span className="text-[9px] text-slate-400 bg-white/[0.04] px-1.5 py-0.5 rounded">
              SMTP
            </span>
          </div>

          <div
            onClick={() => onNavigate('user_management')}
            className={`group flex items-center justify-between px-3 py-2 mx-2 cursor-pointer transition-all text-xs rounded-lg font-medium ${
              currentView === 'user_management'
                ? 'bg-white/[0.09] text-white shadow-xs font-semibold'
                : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <UserCog
                className={`w-4 h-4 flex-shrink-0 transition-colors ${
                  currentView === 'user_management' ? 'text-brand-400' : 'text-slate-400 group-hover:text-slate-200'
                }`}
              />
              <span>User Management</span>
            </div>
            <span className="text-[10px] text-slate-400 bg-white/[0.04] px-1.5 py-0.5 rounded">
              {counts.users} Users
            </span>
          </div>
        </div>

        <div className="h-4"></div>
      </div>

      {/* Profile & Account Section at the Bottom */}
      <div className="relative mx-3 mb-3">
        {/* Click outside backdrop to close popover */}
        {showProfileMenu && (
          <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)}></div>
        )}

        {/* Popover Menu above the profile trigger card */}
        {showProfileMenu && (
          <div className="absolute bottom-full left-0 right-0 mb-2 bg-[#121824] border border-white/10 rounded-xl shadow-2xl p-2 z-50 animate-fade-in text-xs space-y-1">
            {/* User Info Header */}
            <div className="p-2.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
              <div className="font-bold text-white text-xs truncate">
                {currentUser?.name || 'Administrator'}
              </div>
              <div className="text-[10px] text-slate-400 truncate">
                {currentUser?.email || 'admin@talentos-agency.com'}
              </div>
              <div className="mt-1.5 flex items-center gap-1.5">
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {currentUser?.role || 'Administrator'}
                </span>
                <span className="text-[10px] text-slate-400">&bull; Active Session</span>
              </div>
            </div>

            <div className="h-px bg-white/[0.08] my-1"></div>

            {/* My Profile Option */}
            <button
              onClick={() => {
                setShowProfileMenu(false);
                onOpenProfile();
              }}
              className="w-full text-left px-2.5 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/[0.06] flex items-center gap-2 transition-colors cursor-pointer"
            >
              <UserIcon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <span>My Profile</span>
            </button>

            <div className="h-px bg-white/[0.08] my-1"></div>

            {/* Primary Sign Out Option */}
            <button
              onClick={() => {
                setShowProfileMenu(false);
                onOpenSignOut();
              }}
              className="w-full text-left px-2.5 py-2 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/15 flex items-center gap-2 font-semibold transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
              <span>Sign Out</span>
            </button>
          </div>
        )}

        {/* Trigger Card */}
        <div
          onClick={() => setShowProfileMenu(!showProfileMenu)}
          className={`p-2.5 rounded-lg border flex items-center justify-between cursor-pointer transition-all group ${
            showProfileMenu
              ? 'bg-white/[0.08] border-white/20 shadow-xs'
              : 'bg-white/[0.03] hover:bg-white/[0.06] border-white/[0.06]'
          }`}
          title="Account & Sign Out"
        >
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-brand-600 to-indigo-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
              {userInitials}
            </div>
            <div className="overflow-hidden">
              <div className="text-xs font-semibold text-slate-200 group-hover:text-white transition-colors truncate">
                {currentUser?.name || 'Administrator'}
              </div>
              <div className="text-[10px] text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>{currentUser?.role || 'Administrator'}</span>
              </div>
            </div>
          </div>
          {showProfileMenu ? (
            <ChevronDown className="w-3.5 h-3.5 text-white mr-1 flex-shrink-0 transition-transform" />
          ) : (
            <MoreVertical className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-200 mr-1 flex-shrink-0 transition-colors" />
          )}
        </div>
      </div>
    </aside>
  );
};
