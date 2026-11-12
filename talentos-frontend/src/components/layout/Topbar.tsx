import React, { useState } from 'react';
import { User } from '../../types';

interface TopbarProps {
  currentView: string;
  globalSearch: string;
  onSearchChange: (val: string) => void;
  onToggleSla: () => void;
  slaCount: number;
  rateMasked: boolean;
  onToggleRateMask: () => void;
  onOpenQuickAddTab: (tab: 'consultant' | 'requirement' | 'client' | 'vendor' | 'placement') => void;
  currentUser: User | null;
  onOpenProfile: () => void;
  onOpenSignOut: () => void;
  onSwitchPersona: (persona: { name: string; email: string; role: string; desk: string; rateMasked: boolean }) => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  currentView,
  globalSearch,
  onSearchChange,
  onToggleSla,
  slaCount,
  rateMasked,
  onToggleRateMask,
  onOpenQuickAddTab,
  currentUser,
  onOpenProfile,
  onOpenSignOut,
  onSwitchPersona,
}) => {
  const [showQuickAddMenu, setShowQuickAddMenu] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  const getViewTitle = (view: string) => {
    switch (view) {
      case 'dashboard':
        return 'Executive Dashboard & Desk Overview';
      case 'pipeline':
        return 'Opportunity Pipeline & Kanban Sourcing';
      case 'consultants':
        return 'Bench Consultants & Talent Roster';
      case 'clients':
        return 'Enterprise Accounts & Client Directory';
      case 'vendors':
        return 'Staffing Vendors & Sub-Tier Partners';
      case 'billable':
        return 'Active Billable Placements & Financial Ledger';
      case 'user_management':
        return 'Team Roles & Rate Mask Clearance';
      case 'custom_fields':
        return 'Custom Entity Fields & Schema Management';
      case 'automation':
        return 'Automation Rules & Event Triggers';
      case 'import_data':
        return 'Intake Migration & CSV Spreadsheet Import';
      default:
        return 'TalentOS Recruiting CRM';
    }
  };

  const userInitials = (currentUser?.name || 'User')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const demoPersonas = [
    {
      name: 'Johnathan Miller',
      role: 'Administrator',
      desk: 'Executive Ops & Billing',
      email: 'j.miller@talentos-agency.com',
      rateMasked: false,
    },
    {
      name: 'Marcus Brody',
      role: 'Senior Recruiter',
      desk: 'US IT Contract (C2C & W2)',
      email: 'm.brody@talentos-agency.com',
      rateMasked: false,
    },
    {
      name: 'Sarah Jenkins',
      role: 'Technical Recruiter',
      desk: 'Cloud & DevOps Practice',
      email: 's.jenkins@talentos-agency.com',
      rateMasked: true,
    },
    {
      name: 'David Kim',
      role: 'Bench Sales Lead',
      desk: 'Candidate Bench Marketing',
      email: 'd.kim@talentos-agency.com',
      rateMasked: false,
    },
  ];

  return (
    <header className="h-14 bg-white border-b border-slate-200/80 flex items-center justify-between px-6 flex-shrink-0 z-40 select-none">
      {/* Dynamic View Title */}
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-semibold text-slate-900 tracking-tight">
          {getViewTitle(currentView)}
        </h1>
      </div>

      {/* Global Search Bar with ⌘K Badge */}
      <div className="flex-1 max-w-md mx-6 relative hidden md:block">
        <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
        <input
          type="text"
          value={globalSearch}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search candidates, reqs, clients, skills..."
          className="w-full pl-9 pr-14 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all text-slate-700 outline-none"
        />
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-400 bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-2xs">
          ⌘K
        </div>
      </div>

      {/* Actions & Utilities */}
      <div className="flex items-center gap-3">
        {/* Quick Add Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowQuickAddMenu(!showQuickAddMenu)}
            className="px-3.5 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <i className="fa-solid fa-plus text-[10px]"></i>
            <span>Quick Add</span>
            <i className="fa-solid fa-chevron-down text-[9px] opacity-75 ml-0.5"></i>
          </button>

          {showQuickAddMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowQuickAddMenu(false)}
              ></div>
              <div className="absolute right-0 mt-1.5 w-56 bg-white border border-slate-200 rounded-xl shadow-2xl py-1.5 z-50 text-xs animate-fade-in divide-y divide-slate-100">
                <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Create New Record
                </div>
                <div className="py-1">
                  <button
                    onClick={() => {
                      setShowQuickAddMenu(false);
                      onOpenQuickAddTab('consultant');
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2.5 text-slate-700 hover:text-brand-600 transition-colors cursor-pointer"
                  >
                    <i className="fa-solid fa-user-plus text-brand-600 w-4 text-center"></i>
                    <span className="font-medium">New Consultant</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowQuickAddMenu(false);
                      onOpenQuickAddTab('requirement');
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2.5 text-slate-700 hover:text-brand-600 transition-colors cursor-pointer"
                  >
                    <i className="fa-solid fa-briefcase text-blue-600 w-4 text-center"></i>
                    <span className="font-medium">New Requirement</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowQuickAddMenu(false);
                      onOpenQuickAddTab('placement');
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2.5 text-slate-700 hover:text-brand-600 transition-colors cursor-pointer"
                  >
                    <i className="fa-solid fa-file-invoice-dollar text-emerald-600 w-4 text-center"></i>
                    <span className="font-medium">New Billable Placement</span>
                  </button>
                </div>
                <div className="py-1">
                  <button
                    onClick={() => {
                      setShowQuickAddMenu(false);
                      onOpenQuickAddTab('client');
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2.5 text-slate-700 hover:text-brand-600 transition-colors cursor-pointer"
                  >
                    <i className="fa-solid fa-building text-purple-600 w-4 text-center"></i>
                    <span className="font-medium">New Client Account</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowQuickAddMenu(false);
                      onOpenQuickAddTab('vendor');
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2.5 text-slate-700 hover:text-brand-600 transition-colors cursor-pointer"
                  >
                    <i className="fa-solid fa-handshake text-amber-600 w-4 text-center"></i>
                    <span className="font-medium">New Staffing Vendor</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Rate Masking Toggle Pill Button */}
        <button
          onClick={onToggleRateMask}
          title={
            rateMasked
              ? 'Click to reveal billing margin rates (Full Clearance)'
              : 'Click to mask billing rates (Compliance Mask)'
          }
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition-all cursor-pointer ${
            rateMasked
              ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
              : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
          }`}
        >
          <i className={rateMasked ? 'fa-solid fa-eye-slash text-[11px]' : 'fa-solid fa-eye text-[11px]'}></i>
          <span>{rateMasked ? '•••• Rate Masked' : 'Rates Visible'}</span>
        </button>

        {/* SLA Action Center Drawer Trigger */}
        <button
          onClick={onToggleSla}
          className="relative p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          title="Daily SLA & Reminder Queue"
        >
          <i className="fa-solid fa-bell text-sm"></i>
          {slaCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center animate-pulse">
              {slaCount}
            </span>
          )}
        </button>

        {/* User Profile Avatar with Context Dropdown */}
        <div className="relative pl-2 border-l border-slate-200">
          <div
            onClick={() => setShowUserDropdown(!showUserDropdown)}
            className="flex items-center gap-2.5 cursor-pointer p-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
              {userInitials}
            </div>
            <div className="text-left hidden lg:block">
              <div className="text-xs font-bold text-slate-800 leading-tight">
                {currentUser?.name || 'Administrator'}
              </div>
              <div className="text-[10px] text-slate-400 font-medium">
                {currentUser?.role || 'Full Clearance'}
              </div>
            </div>
            <i className="fa-solid fa-chevron-down text-[9px] text-slate-400 hidden lg:block ml-0.5"></i>
          </div>

          {showUserDropdown && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowUserDropdown(false)}
              ></div>
              <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-2xl py-2 z-50 text-xs animate-fade-in divide-y divide-slate-100">
                {/* User Info Header */}
                <div className="px-3.5 py-2">
                  <div className="font-bold text-slate-900 text-xs">{currentUser?.name}</div>
                  <div className="text-[10px] text-slate-400 font-mono truncate">{currentUser?.email}</div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-brand-50 text-brand-700 border border-brand-200">
                      {currentUser?.role}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">&bull; {currentUser?.desk}</span>
                  </div>
                </div>

                {/* Account Actions */}
                <div className="py-1">
                  <button
                    onClick={() => {
                      setShowUserDropdown(false);
                      onOpenProfile();
                    }}
                    className="w-full px-3.5 py-2 text-left hover:bg-slate-50 flex items-center gap-2 text-slate-700 hover:text-brand-600 transition-colors cursor-pointer"
                  >
                    <i className="fa-solid fa-user text-slate-400 w-4 text-center"></i>
                    <span>My Profile & Settings</span>
                  </button>
                  <button
                    onClick={() => {
                      onToggleRateMask();
                      setShowUserDropdown(false);
                    }}
                    className="w-full px-3.5 py-2 text-left hover:bg-slate-50 flex items-center gap-2 text-slate-700 hover:text-brand-600 transition-colors cursor-pointer"
                  >
                    <i className="fa-solid fa-shield-halved text-slate-400 w-4 text-center"></i>
                    <span>Toggle Rate Masking ({rateMasked ? 'Enable' : 'Mask'})</span>
                  </button>
                </div>

                {/* Quick Persona Switcher */}
                <div className="py-1">
                  <div className="px-3.5 py-1 text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                    Quick Persona Switcher
                  </div>
                  {demoPersonas.map((persona) => (
                    <button
                      key={persona.email}
                      onClick={() => {
                        setShowUserDropdown(false);
                        onSwitchPersona(persona);
                      }}
                      className={`w-full px-3.5 py-1.5 text-left hover:bg-slate-50 flex items-center justify-between text-[11px] transition-colors cursor-pointer ${
                        currentUser?.email === persona.email ? 'bg-slate-50 font-bold text-brand-600' : 'text-slate-600'
                      }`}
                    >
                      <span className="truncate">{persona.name}</span>
                      <span className="text-[9px] font-mono text-slate-400">{persona.role.split(' ')[0]}</span>
                    </button>
                  ))}
                </div>

                {/* Sign Out */}
                <div className="pt-1">
                  <button
                    onClick={() => {
                      setShowUserDropdown(false);
                      onOpenSignOut();
                    }}
                    className="w-full px-3.5 py-2 text-left hover:bg-rose-50 flex items-center gap-2 text-rose-600 font-semibold transition-colors cursor-pointer"
                  >
                    <i className="fa-solid fa-arrow-right-from-bracket text-rose-500 w-4 text-center"></i>
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
