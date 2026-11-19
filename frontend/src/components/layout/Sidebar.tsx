import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
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
  PanelLeftClose,
  PanelLeftOpen,
  PieChart,
  SlidersHorizontal,
  Tags,
  User as UserIcon,
  UserCog,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { User } from '../../types';
import { formatUserRole } from '../../utils/entityMappers';
import { BrandLogo, BrandMark } from '../shared/BrandMark';
import { AnimatedPopover, APPLE_EASE } from '../shared/MotionPrimitives';

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
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  onOpenProfile: () => void;
  onOpenSignOut: () => void;
}

interface NavItemConfig {
  view: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  activeIconClass?: string;
  restricted?: boolean;
  tooltip?: string;
  badge?: React.ReactNode;
}

interface NavSectionConfig {
  title: string;
  items: NavItemConfig[];
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
  isCollapsed = false,
  onToggleCollapse,
  isMobileOpen = false,
  onCloseMobile,
  onOpenProfile,
  onOpenSignOut,
}) => {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const displayRole = formatUserRole(currentUser?.role);
  const isAdmin = isAdminProp ?? displayRole === 'Administrator';
  const canImportData =
    canImportDataProp ??
    ['Administrator', 'Senior Recruiter', 'Account Executive', 'Bench Sales Lead'].includes(
      displayRole
    );

  const userInitials = (currentUser?.name || 'SquadPipe User')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const sections: NavSectionConfig[] = [
    {
      title: 'Core Modules',
      items: [
        {
          view: 'dashboard',
          label: 'Dashboard',
          icon: PieChart,
          activeIconClass: 'text-brand-400',
        },
        {
          view: 'pipeline',
          label: 'Pipeline',
          icon: Kanban,
          activeIconClass: 'text-brand-400',
          badge: (
            <span className="text-[10px] text-slate-400 bg-white/[0.04] px-1.5 py-0.5 rounded tabular-nums">
              {counts.requirements}
            </span>
          ),
        },
      ],
    },
    {
      title: 'Roster & Network',
      items: [
        {
          view: 'consultants',
          label: 'Consultants',
          icon: Users,
          activeIconClass: 'text-brand-400',
          badge: (
            <span className="text-[10px] text-slate-400 bg-white/[0.04] px-1.5 py-0.5 rounded tabular-nums">
              {counts.consultants}
            </span>
          ),
        },
        {
          view: 'clients',
          label: 'Clients',
          icon: Building2,
          activeIconClass: 'text-brand-400',
          badge: (
            <span className="text-[10px] text-slate-400 bg-white/[0.04] px-1.5 py-0.5 rounded tabular-nums">
              {counts.clients}
            </span>
          ),
        },
        {
          view: 'vendors',
          label: 'Vendors',
          icon: Handshake,
          activeIconClass: 'text-brand-400',
          badge: (
            <span className="text-[10px] text-slate-400 bg-white/[0.04] px-1.5 py-0.5 rounded tabular-nums">
              {counts.vendors}
            </span>
          ),
        },
        {
          view: 'billable',
          label: 'Billable Consultants',
          icon: FileSpreadsheet,
          activeIconClass: 'text-emerald-400',
          badge: (
            <span className="text-[10px] font-medium bg-white/[0.06] text-slate-300 px-1.5 py-0.5 rounded tabular-nums">
              {counts.billable}
            </span>
          ),
        },
      ],
    },
    {
      title: 'Workspace & Data',
      items: [
        {
          view: 'automation',
          label: 'Smart Reminders',
          icon: Zap,
          activeIconClass: 'text-amber-400',
          badge: (
            <span className="inline-flex items-center gap-1 text-[9px] font-medium text-slate-300 bg-white/[0.06] px-1.5 py-0.5 rounded">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>{counts.activeRules} Active</span>
            </span>
          ),
        },
        {
          view: 'custom_fields',
          label: 'Custom Fields',
          icon: Tags,
          restricted: !isAdmin,
          tooltip: !isAdmin ? 'Restricted to Administrators' : 'Manage Custom Fields & Taxonomies',
          badge: isAdmin ? (
            <span className="text-[10px] text-slate-400 bg-white/[0.04] px-1.5 py-0.5 rounded tabular-nums">
              {counts.customFields}
            </span>
          ) : (
            <RestrictedBadge />
          ),
        },
        {
          view: 'import_data',
          label: 'Import Data',
          icon: FileUp,
          restricted: !canImportData,
          tooltip: !canImportData
            ? 'Restricted to Administrators, Senior Recruiters, Account Executives, and Bench Sales Leads'
            : 'Import Candidates & Resumes',
          badge: canImportData ? (
            <span className="text-[9px] text-slate-400 font-medium bg-white/[0.04] px-1.5 py-0.5 rounded">
              CSV/Excel
            </span>
          ) : (
            <RestrictedBadge />
          ),
        },
      ],
    },
    {
      title: 'Settings & Administration',
      items: [
        {
          view: 'team_performance',
          label: 'Team Performance',
          icon: BarChart3,
          restricted: !isAdmin,
          tooltip: !isAdmin ? 'Restricted to Administrators' : 'Recruiter Team Performance & Conversion',
          badge: !isAdmin ? <RestrictedBadge /> : undefined,
        },
        {
          view: 'usage',
          label: 'Usage',
          icon: HardDrive,
          restricted: !isAdmin,
          tooltip: !isAdmin ? 'Restricted to Administrators' : 'Storage Usage & AI Quota Details',
          badge: !isAdmin ? <RestrictedBadge /> : undefined,
        },
        {
          view: 'settings_general',
          label: 'General Settings',
          icon: SlidersHorizontal,
          restricted: !isAdmin,
          tooltip: !isAdmin ? 'Restricted to Administrators' : 'Workspace General Settings',
          badge: !isAdmin ? <RestrictedBadge /> : undefined,
        },
        {
          view: 'user_management',
          label: 'User Management',
          icon: UserCog,
          restricted: !isAdmin,
          tooltip: !isAdmin ? 'Restricted to Administrators' : 'Manage Users & Permissions',
          badge: isAdmin ? (
            <span className="text-[10px] text-slate-400 bg-white/[0.04] px-1.5 py-0.5 rounded tabular-nums">
              {counts.users} Users
            </span>
          ) : (
            <RestrictedBadge />
          ),
        },
      ],
    },
  ];

  const handleSelectNav = (view: string) => {
    setShowProfileMenu(false);
    onNavigate(view);
    onCloseMobile?.();
  };

  const renderSidebarBody = (compact: boolean, mobileDrawer: boolean) => (
    <>
      {/* Header with App Logo + Collapse/Close Control */}
      <div
        className={`h-14 flex items-center border-b border-white/[0.08] bg-[#101211] flex-shrink-0 ${
          compact ? 'px-2.5 justify-between gap-1' : 'px-4 justify-between gap-2'
        }`}
      >
        <div
          className="flex items-center cursor-pointer group min-w-0 hover:opacity-90 transition-opacity"
          onClick={() => handleSelectNav('dashboard')}
          title="SquadPipe Dashboard"
        >
          {compact ? (
            <BrandMark className="w-[24px] h-[24px] flex-shrink-0" surface="dark" />
          ) : (
            <BrandLogo size="md" surface="dark" />
          )}
        </div>

        {mobileDrawer ? (
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close navigation menu"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        ) : (
          onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              title={compact ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-label={compact ? 'Expand sidebar' : 'Collapse sidebar'}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.07] transition-colors cursor-pointer flex-shrink-0"
            >
              {compact ? (
                <PanelLeftOpen className="w-4 h-4" />
              ) : (
                <PanelLeftClose className="w-4 h-4" />
              )}
            </button>
          )
        )}
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 py-3 overflow-y-auto no-scrollbar space-y-4">
        {sections.map((section) => (
          <div key={section.title}>
            {compact ? (
              <div
                className="mx-4 my-1.5 border-t border-white/[0.08]"
                title={section.title}
                aria-hidden="true"
              />
            ) : (
              <div className="px-3.5 text-[10px] font-semibold uppercase tracking-wider mb-1 text-slate-400">
                {section.title}
              </div>
            )}

            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = currentView === item.view;
                const activeIconClass = item.activeIconClass || 'text-brand-400';

                return (
                  <button
                    key={item.view}
                    type="button"
                    onClick={() => handleSelectNav(item.view)}
                    title={item.tooltip || item.label}
                    aria-label={item.label}
                    className={`w-[calc(100%-1rem)] mx-2 flex items-center cursor-pointer transition-all text-xs rounded-lg font-medium ${
                      compact ? 'justify-center px-0 py-2.5 relative' : 'justify-between px-3 py-2 text-left'
                    } ${
                      active
                        ? 'bg-[#1F2422] text-white shadow-xs font-semibold'
                        : item.restricted
                          ? 'text-slate-500 hover:bg-white/[0.03] hover:text-slate-300'
                          : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
                    }`}
                  >
                    <div className={`flex items-center min-w-0 ${compact ? 'justify-center' : 'gap-2.5'}`}>
                      <Icon
                        className={`w-4 h-4 flex-shrink-0 transition-colors ${
                          active
                            ? activeIconClass
                            : item.restricted
                              ? 'text-slate-500 group-hover:text-slate-300'
                              : 'text-slate-400 group-hover:text-slate-200'
                        }`}
                      />
                      {!compact && <span className="truncate">{item.label}</span>}
                    </div>
                    {!compact && item.badge}
                    {compact && item.restricted && (
                      <span
                        className="absolute top-1.5 right-2 w-1.5 h-1.5 rounded-full bg-amber-400/80"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <div className="h-4" />
      </div>

      {/* Profile & Account Section at the Bottom */}
      <div className={`relative mb-3 ${compact ? 'mx-2' : 'mx-3'}`}>
        {showProfileMenu && (
          <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />
        )}

        <AnimatePresence>
          {showProfileMenu && (
            <AnimatedPopover
              key="sidebar-profile-menu"
              className={`absolute bottom-full mb-2 bg-[#1A1D1B] border border-white/10 rounded-xl shadow-2xl p-2 z-50 text-xs space-y-1 ${
                compact ? 'left-0 w-60' : 'left-0 right-0'
              }`}
            >
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

              <div className="h-px bg-white/[0.08] my-1" />

              <button
                type="button"
                onClick={() => {
                  setShowProfileMenu(false);
                  onCloseMobile?.();
                  onOpenProfile();
                }}
                className="w-full text-left px-2.5 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/[0.06] flex items-center gap-2 transition-colors cursor-pointer"
              >
                <UserIcon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <span>My Profile</span>
              </button>

              <div className="h-px bg-white/[0.08] my-1" />

              <button
                type="button"
                onClick={() => {
                  setShowProfileMenu(false);
                  onCloseMobile?.();
                  onOpenSignOut();
                }}
                className="w-full text-left px-2.5 py-2 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/15 flex items-center gap-2 font-semibold transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                <span>Sign Out</span>
              </button>
            </AnimatedPopover>
          )}
        </AnimatePresence>

        <div
          onClick={() => setShowProfileMenu(!showProfileMenu)}
          className={`rounded-lg border flex items-center cursor-pointer transition-all group ${
            compact ? 'p-1.5 justify-center' : 'p-2.5 justify-between'
          } ${
            showProfileMenu
              ? 'bg-white/[0.08] border-white/20 shadow-xs'
              : 'bg-white/[0.03] hover:bg-white/[0.06] border-white/[0.06]'
          }`}
          title={`${currentUser?.name || 'Administrator'} (${displayRole})`}
        >
          <div className={`flex items-center overflow-hidden ${compact ? 'justify-center' : 'gap-2.5'}`}>
            <div className="w-7 h-7 rounded-full bg-brand-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
              {userInitials}
            </div>
            {!compact && (
              <div className="overflow-hidden">
                <div className="text-xs font-semibold text-slate-200 group-hover:text-white transition-colors truncate">
                  {currentUser?.name || 'Administrator'}
                </div>
                <div className="text-[10px] text-slate-400 font-normal truncate mt-0.5">
                  {displayRole}
                </div>
              </div>
            )}
          </div>
          {!compact &&
            (showProfileMenu ? (
              <ChevronDown className="w-3.5 h-3.5 text-white mr-1 flex-shrink-0 transition-transform" />
            ) : (
              <MoreVertical className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-200 mr-1 flex-shrink-0 transition-colors" />
            ))}
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop / Tablet Static Sidebar (Collapsible Rail <-> Full Width) */}
      <aside
        className={`hidden md:flex flex-col flex-shrink-0 z-20 bg-[#141615] text-slate-300 border-r border-white/[0.08] select-none h-screen transition-[width] duration-200 ${
          isCollapsed ? 'w-[72px]' : 'w-64'
        }`}
      >
        {renderSidebarBody(isCollapsed, false)}
      </aside>

      {/* Mobile / Narrow-Screen Slide-Over Drawer */}
      <AnimatePresence>
        {isMobileOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            <motion.div
              key="mobile-sidebar-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              onClick={onCloseMobile}
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-[1px]"
            />
            <motion.aside
              key="mobile-sidebar-drawer"
              initial={{ x: -260 }}
              animate={{ x: 0 }}
              exit={{ x: -260 }}
              transition={{ duration: 0.22, ease: APPLE_EASE }}
              className="relative z-10 w-64 flex flex-col bg-[#141615] text-slate-300 border-r border-white/[0.08] select-none h-full shadow-2xl"
              aria-label="Mobile Navigation"
            >
              {renderSidebarBody(false, true)}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
