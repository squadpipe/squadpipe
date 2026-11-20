import React, { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  Briefcase,
  Buildings,
  CaretDown,
  FileXls,
  Handshake,
  List,
  MagnifyingGlass,
  Plus,
  UserPlus,
} from '@phosphor-icons/react';
import { AnimatedPopover } from '../shared/MotionPrimitives';

interface TopbarProps {
  currentView: string;
  canCreatePlacement?: boolean;
  onOpenMobileMenu?: () => void;
  onOpenCommandPalette?: () => void;
  onOpenCreateModal: (type: 'consultant' | 'requirement' | 'client' | 'vendor' | 'placement') => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  currentView,
  canCreatePlacement = true,
  onOpenMobileMenu,
  onOpenCommandPalette,
  onOpenCreateModal,
}) => {
  const [showQuickAddDropdown, setShowQuickAddDropdown] = useState(false);

  const getViewTitle = (view: string) => {
    switch (view) {
      case 'dashboard':
        return 'Dashboard Overview';
      case 'pipeline':
        return 'Opportunity Pipeline';
      case 'requirement_new':
        return 'New Requirement';
      case 'requirement_edit':
        return 'Edit Requirement';
      case 'requirement_from_email':
        return 'Create Job from Email';
      case 'requirement_detail':
        return 'Requirement Details';
      case 'consultants':
        return 'Consultant Directory';
      case 'consultant_new':
        return 'New Consultant';
      case 'consultant_detail':
        return 'Consultant Profile';
      case 'clients':
        return 'Client Directory';
      case 'client_detail':
        return 'Client Details';
      case 'vendors':
        return 'Staffing Vendors';
      case 'vendor_detail':
        return 'Vendor Details';
      case 'billable':
        return 'Billable Consultants';
      case 'placement_new':
        return 'New Billable Placement';
      case 'placement_detail':
        return 'Placement Details';
      case 'user_management':
        return 'User Management & Team Permissions';
      case 'application_forms':
        return 'Application Forms';
      case 'application_form_new':
        return 'New Application Form';
      case 'application_form_edit':
        return 'Edit Application Form';
      case 'custom_fields':
        return 'Custom Form Fields';
      case 'dropdown_lists':
        return 'Master Dropdown Lists';
      case 'automation':
        return 'Smart Reminders';
      case 'import_data':
        return 'Import Candidates & Resumes';
      case 'import_resume':
        return 'Resume Parser & Import';
      case 'import_csv':
        return 'Spreadsheet Candidate Import';
      case 'team_performance':
        return 'Team Performance';
      case 'usage':
        return 'Workspace Usage & Storage';
      case 'settings_general':
        return 'General Settings';
      default:
        return 'Dashboard Overview';
    }
  };

  return (
    <header className="h-14 bg-white border-b border-slate-200/80 flex items-center justify-between px-4 sm:px-6 flex-shrink-0 z-40 select-none gap-3">
      {/* View Title + Mobile Nav Trigger */}
      <div className="flex items-center gap-2.5 min-w-0">
        {onOpenMobileMenu && (
          <button
            type="button"
            onClick={onOpenMobileMenu}
            aria-label="Open navigation menu"
            className="md:hidden p-1.5 -ml-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer flex-shrink-0"
          >
            <List className="w-4 h-4" />
          </button>
        )}
        <h1 className="text-sm font-semibold text-slate-900 tracking-tight truncate">
          {getViewTitle(currentView)}
        </h1>
      </div>

      {/* Right Utilities: Global Command Search (Cmd+K) + Quick Add */}
      <div className="flex items-center gap-2.5">
        {onOpenCommandPalette && (
          <button
            type="button"
            onClick={onOpenCommandPalette}
            title="Jump to any record or page (⌘K)"
            className="hidden sm:inline-flex items-center justify-between gap-4 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50/80 hover:bg-white hover:border-slate-300 text-xs text-slate-500 transition-colors cursor-pointer min-w-[190px]"
          >
            <span className="inline-flex items-center gap-1.5">
              <MagnifyingGlass className="w-3.5 h-3.5 text-slate-400" />
              <span>Search or jump to...</span>
            </span>
            <kbd className="px-1.5 py-0.5 rounded-md bg-white border border-slate-200 text-[11px] font-medium text-slate-500 leading-none">
              ⌘K
            </kbd>
          </button>
        )}

        {onOpenCommandPalette && (
          <button
            type="button"
            onClick={onOpenCommandPalette}
            aria-label="Open command search"
            className="sm:hidden p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 cursor-pointer"
          >
            <MagnifyingGlass className="w-4 h-4" />
          </button>
        )}

        <div className="relative">
          <button
            onClick={() => setShowQuickAddDropdown(!showQuickAddDropdown)}
            className="px-3.5 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" weight="bold" />
            <span>Quick Add</span>
            <CaretDown
              className={`w-3.5 h-3.5 opacity-80 transition-transform ${
                showQuickAddDropdown ? 'rotate-180' : ''
              }`}
            />
          </button>

          {/* Click-away backdrop overlay */}
          {showQuickAddDropdown && (
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowQuickAddDropdown(false)}
            ></div>
          )}

          {/* Dropdown Menu */}
          <AnimatePresence>
            {showQuickAddDropdown && (
              <AnimatedPopover
                key="topbar-quick-add"
                className="absolute right-0 mt-1.5 w-56 bg-white border border-slate-200 rounded-xl popover-shadow py-1.5 z-50 text-xs divide-y divide-slate-100"
              >
                <div className="px-3 py-1.5 text-[11px] font-medium text-slate-400">
                  Create new record
                </div>
                <div className="py-1">
                  <button
                    onClick={() => {
                      setShowQuickAddDropdown(false);
                      onOpenCreateModal('consultant');
                    }}
                    className="group w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2.5 text-slate-700 hover:text-brand-600 transition-colors cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4 text-slate-400 group-hover:text-brand-600 transition-colors flex-shrink-0" />
                    <span className="font-medium">New Consultant</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowQuickAddDropdown(false);
                      onOpenCreateModal('requirement');
                    }}
                    className="group w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2.5 text-slate-700 hover:text-brand-600 transition-colors cursor-pointer"
                  >
                    <Briefcase className="w-4 h-4 text-slate-400 group-hover:text-brand-600 transition-colors flex-shrink-0" />
                    <span className="font-medium">New Requirement</span>
                  </button>
                  {canCreatePlacement && (
                    <button
                      onClick={() => {
                        setShowQuickAddDropdown(false);
                        onOpenCreateModal('placement');
                      }}
                      className="group w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2.5 text-slate-700 hover:text-brand-600 transition-colors cursor-pointer"
                    >
                      <FileXls className="w-4 h-4 text-slate-400 group-hover:text-brand-600 transition-colors flex-shrink-0" />
                      <span className="font-medium">New Billable Placement</span>
                    </button>
                  )}
                </div>
                <div className="py-1">
                  <button
                    onClick={() => {
                      setShowQuickAddDropdown(false);
                      onOpenCreateModal('client');
                    }}
                    className="group w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2.5 text-slate-700 hover:text-brand-600 transition-colors cursor-pointer"
                  >
                    <Buildings className="w-4 h-4 text-slate-400 group-hover:text-brand-600 transition-colors flex-shrink-0" />
                    <span className="font-medium">New Client Account</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowQuickAddDropdown(false);
                      onOpenCreateModal('vendor');
                    }}
                    className="group w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2.5 text-slate-700 hover:text-brand-600 transition-colors cursor-pointer"
                  >
                    <Handshake className="w-4 h-4 text-slate-400 group-hover:text-brand-600 transition-colors flex-shrink-0" />
                    <span className="font-medium">New Staffing Vendor</span>
                  </button>
                </div>
              </AnimatedPopover>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
};
