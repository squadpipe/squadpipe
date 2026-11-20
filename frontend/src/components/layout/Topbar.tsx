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
  currentView?: string;
  canCreatePlacement?: boolean;
  onOpenMobileMenu?: () => void;
  onOpenCommandPalette?: () => void;
  onOpenCreateModal: (type: 'consultant' | 'requirement' | 'client' | 'vendor' | 'placement') => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  canCreatePlacement = true,
  onOpenMobileMenu,
  onOpenCommandPalette,
  onOpenCreateModal,
}) => {
  const [showQuickAddDropdown, setShowQuickAddDropdown] = useState(false);

  return (
    <header className="h-14 bg-white border-b border-slate-200/80 flex items-center justify-between px-4 sm:px-6 flex-shrink-0 z-40 select-none gap-3">
      {/* Left Utility: Mobile Menu Trigger + Global Command Search (⌘K) */}
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
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
        {onOpenCommandPalette && (
          <button
            type="button"
            onClick={onOpenCommandPalette}
            aria-label="Master Search (⌘K)"
            title="Master Search — find requirements, consultants, clients, vendors, or jump to any page (⌘K)"
            className="w-full max-w-md h-8 inline-flex items-center justify-between gap-3 px-3 rounded-lg border border-slate-200 bg-slate-50/90 hover:bg-white hover:border-slate-300 hover:shadow-sm text-xs text-slate-600 transition-all cursor-pointer"
          >
            <span className="inline-flex items-center gap-2 min-w-0">
              <MagnifyingGlass className="w-3.5 h-3.5 text-brand-600 shrink-0" />
              <span className="font-medium text-slate-700 shrink-0">Master Search</span>
              <span className="hidden md:inline text-slate-400 truncate">
                &middot; Requirements, consultants, clients...
              </span>
            </span>
            <kbd className="inline-flex px-1.5 py-0.5 rounded-md bg-white border border-slate-200 text-[11px] font-medium text-slate-500 leading-none shrink-0">
              ⌘K
            </kbd>
          </button>
        )}
      </div>

      {/* Right Utility: Global Quick Add */}
      <div className="flex items-center gap-2.5 shrink-0">

        <div className="relative">
          <button
            onClick={() => setShowQuickAddDropdown(!showQuickAddDropdown)}
            className="h-8 px-3.5 rounded-lg bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white text-[11px] font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
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
