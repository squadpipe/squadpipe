import React, { useState } from 'react';
import {
  BarChart3,
  Building2,
  ChevronDown,
  FileSpreadsheet,
  FileUp,
  Handshake,
  HardDrive,
  Kanban,
  Lock,
  LogOut,
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
import { formatUserRole } from '../../utils/entityMappers';
import { BrandLogo } from '../shared/BrandMark';

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
  isAdmin?: boolean;
  canImportData?: boolean;
  onOpenProfile: () => void;
  onOpenSignOut: () => void;
}

const RestrictedBadge: React.FC = () => (
  <span className="inline-flex items-center gap-1 text-[9px] text-amber-300/80 font-medium bg-amber-500/10 border border-amber-400/15 px-1.5 py-0.5 rounded">
    <Lock className="w-2.5 h-2.5" />
    <span>Restricted</span>
  </span>
);

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  counts,
  currentUser,
  isAdmin: isAdminProp,
  canImportData: canImportDataProp,
  onOpenProfile,
  onOpenSignOut,
}) => {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const displayRole = formatUserRole(currentUser?.role);
  const isAdmin = isAdminProp ?? displayRole === 'Administrator';
  const canImportData =
    canImportDataProp ??
    ['Administrator', 'Senior Recruiter', 'Account Executive', 'Bench Sales Lead'].includes(displayRole);

  const userInitials = (currentUser?.name || 'SquadPipe User')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <aside className="w-64 flex flex-col flex-shrink-0 z-20 bg-[#141615] text-slate-300 border-r border-white/[0.08] select-none h-screen">
      {/* Header with App Logo */}
      <div className="h-14 flex items-center px-4 border-b border-white/[0.08] bg-[#101211] justify-between flex-shrink-0">
        <div
          className="flex items-center cursor-pointer group min-w-0 hover:opacity-90 transition-opacity"
          onClick={() => onNavigate('dashboard')}
          title="SquadPipe Dashboard"
        >
          <BrandLogo size="md" surface="dark" />
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
                ? 'bg-[#1F2422] text-white shadow-xs font-semibold'
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
                ? 'bg-[#1F2422] text-white shadow-xs font-semibold'
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
                ? 'bg-[#1F2422] text-white shadow-xs font-semibold'
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
                ? 'bg-[#1F2422] text-white shadow-xs font-semibold'
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
                ? 'bg-[#1F2422] text-white shadow-xs font-semibold'
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
                ? 'bg-[#1F2422] text-white shadow-xs font-semibold'
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
            <span className="text-[10px] font-medium bg-white/[0.06] text-slate-300 px-1.5 py-0.5 rounded tabular-nums">
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
                ? 'bg-[#1F2422] text-white shadow-xs font-semibold'
                : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Zap
                className={`w-4 h-4 flex-shrink-0 transition-colors ${
                  currentView === 'automation' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'
                }`}
              />
              <span>Smart Reminders</span>
            </div>
            <span className="inline-flex items-center gap-1 text-[9px] font-medium text-slate-300 bg-white/[0.06] px-1.5 py-0.5 rounded">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>{counts.activeRules} Active</span>
            </span>
          </div>

          <div
            onClick={() => onNavigate('custom_fields')}
            title={!isAdmin ? 'Restricted to Administrators' : 'Manage Custom Fields & Taxonomies'}
            className={`group flex items-center justify-between px-3 py-2 mx-2 cursor-pointer transition-all text-xs rounded-lg font-medium ${
              currentView === 'custom_fields'
                ? 'bg-[#1F2422] text-white shadow-xs font-semibold'
                : isAdmin
                  ? 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
                  : 'text-slate-500 hover:bg-white/[0.03] hover:text-slate-300'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Tags
                className={`w-4 h-4 flex-shrink-0 transition-colors ${
                  currentView === 'custom_fields'
                    ? 'text-brand-400'
                    : isAdmin
                      ? 'text-slate-400 group-hover:text-slate-200'
                      : 'text-slate-500 group-hover:text-slate-300'
                }`}
              />
              <span>Custom Fields</span>
            </div>
            {isAdmin ? (
              <span className="text-[10px] text-slate-400 bg-white/[0.04] px-1.5 py-0.5 rounded">
                {counts.customFields}
              </span>
            ) : (
              <RestrictedBadge />
            )}
          </div>

          <div
            onClick={() => onNavigate('import_data')}
            title={
              !canImportData
                ? 'Restricted to Administrators, Senior Recruiters, Account Executives, and Bench Sales Leads'
                : 'Import Candidates & Resumes'
            }
            className={`group flex items-center justify-between px-3 py-2 mx-2 cursor-pointer transition-all text-xs rounded-lg font-medium ${
              currentView === 'import_data'
                ? 'bg-[#1F2422] text-white shadow-xs font-semibold'
                : canImportData
                  ? 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
                  : 'text-slate-500 hover:bg-white/[0.03] hover:text-slate-300'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <FileUp
                className={`w-4 h-4 flex-shrink-0 transition-colors ${
                  currentView === 'import_data'
                    ? 'text-brand-400'
                    : canImportData
                      ? 'text-slate-400 group-hover:text-slate-200'
                      : 'text-slate-500 group-hover:text-slate-300'
                }`}
              />
              <span>Import Data</span>
            </div>
            {canImportData ? (
              <span className="text-[9px] text-slate-400 font-medium bg-white/[0.04] px-1.5 py-0.5 rounded">
                CSV/Excel
              </span>
            ) : (
              <RestrictedBadge />
            )}
          </div>
        </div>

        {/* Section 4: Settings & Administration */}
        <div>
          <div className="px-3.5 text-[10px] font-semibold uppercase tracking-wider mb-1 text-slate-400">
            Settings &amp; Administration
          </div>

          <div
            onClick={() => onNavigate('team_performance')}
            title={!isAdmin ? 'Restricted to Administrators' : 'Recruiter Team Performance & Conversion'}
            className={`group flex items-center justify-between px-3 py-2 mx-2 cursor-pointer transition-all text-xs rounded-lg font-medium ${
              currentView === 'team_performance'
                ? 'bg-[#1F2422] text-white shadow-xs font-semibold'
                : isAdmin
                  ? 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
                  : 'text-slate-500 hover:bg-white/[0.03] hover:text-slate-300'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <BarChart3
                className={`w-4 h-4 flex-shrink-0 transition-colors ${
                  currentView === 'team_performance'
                    ? 'text-brand-400'
                    : isAdmin
                      ? 'text-slate-400 group-hover:text-slate-200'
                      : 'text-slate-500 group-hover:text-slate-300'
                }`}
              />
              <span>Team Performance</span>
            </div>
            {!isAdmin && <RestrictedBadge />}
          </div>

          <div
            onClick={() => onNavigate('usage')}
            title={!isAdmin ? 'Restricted to Administrators' : 'Storage Usage & AI Quota Details'}
            className={`group flex items-center justify-between px-3 py-2 mx-2 cursor-pointer transition-all text-xs rounded-lg font-medium ${
              currentView === 'usage'
                ? 'bg-[#1F2422] text-white shadow-xs font-semibold'
                : isAdmin
                  ? 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
                  : 'text-slate-500 hover:bg-white/[0.03] hover:text-slate-300'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <HardDrive
                className={`w-4 h-4 flex-shrink-0 transition-colors ${
                  currentView === 'usage'
                    ? 'text-brand-400'
                    : isAdmin
                      ? 'text-slate-400 group-hover:text-slate-200'
                      : 'text-slate-500 group-hover:text-slate-300'
                }`}
              />
              <span>Usage</span>
            </div>
            {!isAdmin && <RestrictedBadge />}
          </div>

          <div
            onClick={() => onNavigate('settings_general')}
            title={!isAdmin ? 'Restricted to Administrators' : 'Workspace General Settings'}
            className={`group flex items-center justify-between px-3 py-2 mx-2 cursor-pointer transition-all text-xs rounded-lg font-medium ${
              currentView === 'settings_general'
                ? 'bg-[#1F2422] text-white shadow-xs font-semibold'
                : isAdmin
                  ? 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
                  : 'text-slate-500 hover:bg-white/[0.03] hover:text-slate-300'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <SlidersHorizontal
                className={`w-4 h-4 flex-shrink-0 transition-colors ${
                  currentView === 'settings_general'
                    ? 'text-brand-400'
                    : isAdmin
                      ? 'text-slate-400 group-hover:text-slate-200'
                      : 'text-slate-500 group-hover:text-slate-300'
                }`}
              />
              <span>General Settings</span>
            </div>
            {!isAdmin && (
              <RestrictedBadge />
            )}
          </div>

          <div
            onClick={() => onNavigate('user_management')}
            title={!isAdmin ? 'Restricted to Administrators' : 'Manage Users & Permissions'}
            className={`group flex items-center justify-between px-3 py-2 mx-2 cursor-pointer transition-all text-xs rounded-lg font-medium ${
              currentView === 'user_management'
                ? 'bg-[#1F2422] text-white shadow-xs font-semibold'
                : isAdmin
                  ? 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
                  : 'text-slate-500 hover:bg-white/[0.03] hover:text-slate-300'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <UserCog
                className={`w-4 h-4 flex-shrink-0 transition-colors ${
                  currentView === 'user_management'
                    ? 'text-brand-400'
                    : isAdmin
                      ? 'text-slate-400 group-hover:text-slate-200'
                      : 'text-slate-500 group-hover:text-slate-300'
                }`}
              />
              <span>User Management</span>
            </div>
            {isAdmin ? (
              <span className="text-[10px] text-slate-400 bg-white/[0.04] px-1.5 py-0.5 rounded">
                {counts.users} Users
              </span>
            ) : (
              <RestrictedBadge />
            )}
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
          <div className="absolute bottom-full left-0 right-0 mb-2 bg-[#1A1D1B] border border-white/10 rounded-xl shadow-2xl p-2 z-50 animate-fade-in text-xs space-y-1">
            {/* User Info Header */}
            <div className="p-2.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
              <div className="font-bold text-white text-xs truncate">
                {currentUser?.name || 'Administrator'}
              </div>
              <div className="text-[10px] text-slate-400 truncate">
                {currentUser?.email || 'admin@squadpipe.com'}
              </div>
              <div className="mt-1.5 flex items-center gap-1.5">
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/[0.06] text-slate-300 border border-white/10">
                  {displayRole}
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
            <div className="w-7 h-7 rounded-full bg-brand-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
              {userInitials}
            </div>
            <div className="overflow-hidden">
              <div className="text-xs font-semibold text-slate-200 group-hover:text-white transition-colors truncate">
                {currentUser?.name || 'Administrator'}
              </div>
              <div className="text-[10px] text-slate-400 font-normal truncate mt-0.5">
                {displayRole}
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
