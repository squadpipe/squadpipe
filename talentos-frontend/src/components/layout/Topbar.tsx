import React, { useState } from 'react';
import {
  Briefcase,
  Building2,
  ChevronDown,
  FileSpreadsheet,
  Handshake,
  Plus,
  UserPlus,
} from 'lucide-react';

interface TopbarProps {
  currentView: string;
  onOpenCreateModal: (type: 'consultant' | 'requirement' | 'client' | 'vendor' | 'placement') => void;
}

export const Topbar: React.FC<TopbarProps> = ({ currentView, onOpenCreateModal }) => {
  const [showQuickAddDropdown, setShowQuickAddDropdown] = useState(false);

  const getViewTitle = (view: string) => {
    switch (view) {
      case 'dashboard':
        return 'Dashboard Overview';
      case 'pipeline':
        return 'Opportunity Pipeline';
      case 'consultants':
        return 'Consultant Directory';
      case 'clients':
        return 'Client Directory';
      case 'vendors':
        return 'Staffing Vendors';
      case 'billable':
        return 'Billable Consultants';
      case 'user_management':
        return 'User Management & Team Permissions';
      case 'custom_fields':
        return 'Custom Fields & Master Taxonomy';
      case 'automation':
        return 'Workflow Automations';
      case 'import_data':
        return 'Data Import & Migration';
      case 'settings_general':
        return 'General Settings';
      default:
        return 'Dashboard Overview';
    }
  };

  return (
    <header className="h-14 bg-white border-b border-slate-200/80 flex items-center justify-between px-6 flex-shrink-0 z-40 select-none">
      {/* View Title */}
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-semibold text-slate-900 tracking-tight">
          {getViewTitle(currentView)}
        </h1>
      </div>

      {/* Quick Add Dropdown - Matches Prototype Lines 1919-1958 Exactly */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <button
            onClick={() => setShowQuickAddDropdown(!showQuickAddDropdown)}
            className="px-3.5 py-1.5 rounded-md bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white text-xs font-medium shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2.4} />
            <span>Quick Add</span>
            <ChevronDown className={`w-3.5 h-3.5 opacity-75 transition-transform ${showQuickAddDropdown ? 'rotate-180' : ''}`} />
          </button>

          {/* Click-away backdrop overlay */}
          {showQuickAddDropdown && (
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowQuickAddDropdown(false)}
            ></div>
          )}

          {/* Dropdown Menu */}
          {showQuickAddDropdown && (
            <div className="absolute right-0 mt-1.5 w-56 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 z-50 text-xs animate-fade-in divide-y divide-slate-100">
              <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Create New Record
              </div>
              <div className="py-1">
                <button
                  onClick={() => {
                    setShowQuickAddDropdown(false);
                    onOpenCreateModal('consultant');
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2.5 text-slate-700 hover:text-brand-600 transition-colors cursor-pointer"
                >
                  <UserPlus className="w-4 h-4 text-brand-600 flex-shrink-0" />
                  <span className="font-medium">New Consultant</span>
                </button>
                <button
                  onClick={() => {
                    setShowQuickAddDropdown(false);
                    onOpenCreateModal('requirement');
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2.5 text-slate-700 hover:text-brand-600 transition-colors cursor-pointer"
                >
                  <Briefcase className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  <span className="font-medium">New Requirement</span>
                </button>
                <button
                  onClick={() => {
                    setShowQuickAddDropdown(false);
                    onOpenCreateModal('placement');
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2.5 text-slate-700 hover:text-brand-600 transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span className="font-medium">New Billable Placement</span>
                </button>
              </div>
              <div className="py-1">
                <button
                  onClick={() => {
                    setShowQuickAddDropdown(false);
                    onOpenCreateModal('client');
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2.5 text-slate-700 hover:text-brand-600 transition-colors cursor-pointer"
                >
                  <Building2 className="w-4 h-4 text-purple-600 flex-shrink-0" />
                  <span className="font-medium">New Client Account</span>
                </button>
                <button
                  onClick={() => {
                    setShowQuickAddDropdown(false);
                    onOpenCreateModal('vendor');
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2.5 text-slate-700 hover:text-brand-600 transition-colors cursor-pointer"
                >
                  <Handshake className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span className="font-medium">New Staffing Vendor</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
