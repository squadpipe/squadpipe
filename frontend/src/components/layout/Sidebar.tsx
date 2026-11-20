import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Icon as PhosphorIcon } from '@phosphor-icons/react';
import {
  Buildings,
  CaretDown,
  ChartBar,
  ChartPieSlice,
  Columns,
  DotsThreeVertical,
  FileText,
  FileXls,
  Handshake,
  HardDrive,
  Kanban,
  Lightning,
  Lock,
  SignOut,
  SlidersHorizontal,
  Stack,
  Tag,
  UploadSimple,
  User as UserIcon,
  UserGear,
  Users,
  X,
} from '@phosphor-icons/react';
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
  icon: PhosphorIcon;
  activeIconClass?: string;
  restricted?: boolean;
  tooltip?: string;
  badge?: React.ReactNode;
  children?: NavItemConfig[];
}

interface NavSectionConfig {
  title: string;
  items: NavItemConfig[];
}

const RestrictedBadge: React.FC = () => (
  <span className="inline-flex items-center gap-1 text-[11px] text-amber-300/80 font-medium bg-amber-500/10 border border-amber-400/15 px-1.5 py-0.5 rounded-md">
    <Lock className="w-2.5 h-2.5" weight="regular" />
    <span>Restricted</span>
  </span>
);

const SidebarToggleIcon: React.FC<{ collapsed?: boolean; className?: string }> = ({
  collapsed = false,
  className = 'w-4 h-4',
}) => (
  <svg
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <rect
      x="2.25"
      y="3.25"
      width="15.5"
      height="13.5"
      rx="2.75"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <rect
      x="3.75"
      y="4.75"
      width="3.75"
      height="10.5"
      rx="1.25"
      fill="currentColor"
      fillOpacity="0.32"
    />
    <line
      x1="8.75"
      y1="3.75"
      x2="8.75"
      y2="16.25"
      stroke="currentColor"
      strokeWidth="1.4"
    />
    {collapsed ? (
      <path
        d="M11.75 7.75L14 10L11.75 12.25"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ) : (
      <path
        d="M14 7.75L11.75 10L14 12.25"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    )}
  </svg>
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
  const [formsMenuOpen, setFormsMenuOpen] = useState(true);
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
          icon: ChartPieSlice,
          activeIconClass: 'text-brand-400',
        },
        {
          view: 'pipeline',
          label: 'Pipeline',
          icon: Kanban,
          activeIconClass: 'text-brand-400',
          badge: (
            <span className="text-[11px] text-slate-400 bg-white/[0.04] px-1.5 py-0.5 rounded-md tabular-nums">
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
            <span className="text-[11px] text-slate-400 bg-white/[0.04] px-1.5 py-0.5 rounded-md tabular-nums">
              {counts.consultants}
            </span>
          ),
        },
        {
          view: 'clients',
          label: 'Clients',
          icon: Buildings,
          activeIconClass: 'text-brand-400',
          badge: (
            <span className="text-[11px] text-slate-400 bg-white/[0.04] px-1.5 py-0.5 rounded-md tabular-nums">
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
            <span className="text-[11px] text-slate-400 bg-white/[0.04] px-1.5 py-0.5 rounded-md tabular-nums">
              {counts.vendors}
            </span>
          ),
        },
        {
          view: 'billable',
          label: 'Billable Consultants',
          icon: FileXls,
          activeIconClass: 'text-emerald-400',
          badge: (
            <span className="text-[11px] font-medium bg-white/[0.06] text-slate-300 px-1.5 py-0.5 rounded-md tabular-nums">
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
          icon: Lightning,
          activeIconClass: 'text-amber-400',
          badge: (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-300 bg-white/[0.06] px-1.5 py-0.5 rounded-md">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>{counts.activeRules} Active</span>
            </span>
          ),
        },
        {
          view: 'forms_and_fields',
          label: 'Forms & Fields',
          icon: Tag,
          restricted: !isAdmin,
          tooltip: !isAdmin ? 'Restricted to Administrators' : 'Application Forms, Custom Fields & Dropdowns',
          badge: !isAdmin ? <RestrictedBadge /> : undefined,
          children: [
            {
              view: 'application_forms',
              label: 'Application Forms',
              icon: FileText,
              restricted: !isAdmin,
              tooltip: !isAdmin ? 'Restricted to Administrators' : 'Public Job Application Form Templates',
            },
            {
              view: 'custom_fields',
              label: 'Custom Form Fields',
              icon: Columns,
              restricted: !isAdmin,
              tooltip: !isAdmin ? 'Restricted to Administrators' : 'Manage Custom Entity Form Attributes',
              badge: isAdmin ? (
                <span className="text-[11px] text-slate-400 bg-white/[0.04] px-1.5 py-0.5 rounded-md tabular-nums">
                  {counts.customFields}
                </span>
              ) : undefined,
            },
            {
              view: 'dropdown_lists',
              label: 'Master Dropdown Lists',
              icon: Stack,
              restricted: !isAdmin,
              tooltip: !isAdmin ? 'Restricted to Administrators' : 'Manage Work Auth, Stages, Degrees & Terms',
              badge: isAdmin ? (
                <span className="text-[11px] text-slate-400 bg-white/[0.04] px-1.5 py-0.5 rounded-md tabular-nums">
                  4 Lists
                </span>
              ) : undefined,
            },
          ],
        },
        {
          view: 'import_data',
          label: 'Import Data',
          icon: UploadSimple,
          restricted: !canImportData,
          tooltip: !canImportData
            ? 'Restricted to Administrators, Senior Recruiters, Account Executives, and Bench Sales Leads'
            : 'Import Candidates & Resumes',
          badge: canImportData ? (
            <span className="text-[11px] text-slate-400 font-medium bg-white/[0.04] px-1.5 py-0.5 rounded-md">
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
          icon: ChartBar,
          restricted: !isAdmin,
          tooltip: !isAdmin ? 'Restricted to Administrators' : 'Recruiter Team Performance & Conversion',
          badge: !isAdmin ? <RestrictedBadge /> : undefined,
        },
        {
          view: 'usage',
          label: 'Usage & Storage',
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
          label: 'Team Members',
          icon: UserGear,
          restricted: !isAdmin,
          tooltip: !isAdmin ? 'Restricted to Administrators' : 'Manage Team Members & Permissions',
          badge: isAdmin ? (
            <span className="text-[11px] text-slate-400 bg-white/[0.04] px-1.5 py-0.5 rounded-md tabular-nums">
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
        className={`h-14 flex items-center border-b border-white/[0.08] bg-gradient-to-b from-[#191C1A] to-[#121514] flex-shrink-0 ${
          compact ? 'px-2 justify-center' : 'px-4 justify-between gap-2'
        }`}
      >
        <div
          className="flex items-center cursor-pointer group min-w-0 hover:opacity-95 transition-opacity"
          onClick={() => handleSelectNav('dashboard')}
          title="SquadPipe Dashboard"
        >
          {compact ? (
            <div className="p-1 rounded-lg bg-white/[0.04] border border-white/[0.08]">
              <BrandMark className="w-[22px] h-[22px] flex-shrink-0" surface="dark" />
            </div>
          ) : (
            <BrandLogo size="md" surface="dark" />
          )}
        </div>

        {mobileDrawer ? (
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close navigation menu"
            className="h-7 w-7 rounded-lg bg-white/[0.06] border border-white/[0.12] text-slate-300 hover:text-white hover:bg-white/[0.12] inline-flex items-center justify-center transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        ) : (
          !compact &&
          onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
              className="relative w-7 h-7 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.12] hover:border-white/[0.22] text-slate-300 hover:text-white inline-flex items-center justify-center transition-all cursor-pointer flex-shrink-0 group/toggle"
            >
              <SidebarToggleIcon collapsed={false} className="w-4 h-4 transition-transform group-hover/toggle:scale-105" />
              <span className="pointer-events-none opacity-0 group-hover/toggle:opacity-100 transition-opacity duration-150 absolute right-0 top-full mt-1.5 px-2 py-1 rounded-md bg-[#1F2422] border border-white/15 text-[11px] font-medium text-slate-200 whitespace-nowrap shadow-lg z-50">
                Collapse sidebar
              </span>
            </button>
          )
        )}
      </div>

      {/* Prominent Expand Trigger in Collapsed Icon-Rail Mode */}
      {compact && !mobileDrawer && onToggleCollapse && (
        <div className="px-2.5 pt-2.5 flex justify-center">
          <button
            type="button"
            onClick={onToggleCollapse}
            title="Expand sidebar"
            aria-label="Expand sidebar"
            className="w-9 h-8 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.12] hover:border-white/[0.22] text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer group/toggle"
          >
            <SidebarToggleIcon collapsed={true} className="w-4 h-4 transition-transform group-hover/toggle:scale-105" />
          </button>
        </div>
      )}

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
              <div className="px-3.5 text-[11px] font-semibold uppercase tracking-wider mb-1 text-slate-400">
                {section.title}
              </div>
            )}

            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const hasChildren = Boolean(item.children && item.children.length > 0);
                const matchesNavView = (navView: string) =>
                  currentView === navView ||
                  (navView === 'pipeline' && currentView === 'requirement_from_email') ||
                  (navView === 'billable' && currentView === 'placement_new') ||
                  (navView === 'import_data' &&
                    (currentView === 'import_resume' || currentView === 'import_csv')) ||
                  (navView === 'application_forms' &&
                    (currentView === 'application_form_new' ||
                      currentView === 'application_form_edit'));
                const childActive = hasChildren
                  ? item.children!.some((child) => matchesNavView(child.view))
                  : false;
                const active = matchesNavView(item.view) || childActive;
                const activeIconClass = item.activeIconClass || 'text-brand-400';

                if (hasChildren && compact) {
                  return (
                    <React.Fragment key={item.view}>
                      {item.children!.map((child) => {
                        const ChildIcon = child.icon;
                        const isChildActive = matchesNavView(child.view);
                        return (
                          <button
                            key={child.view}
                            type="button"
                            onClick={() => handleSelectNav(child.view)}
                            title={child.tooltip || child.label}
                            aria-label={child.label}
                            className={`w-[calc(100%-1rem)] mx-2 flex items-center justify-center px-0 py-2.5 relative cursor-pointer transition-all text-xs rounded-lg font-medium ${
                              isChildActive
                                ? 'bg-[#1F2422] text-white font-semibold'
                                : child.restricted
                                  ? 'text-slate-500 hover:bg-white/[0.03] hover:text-slate-300'
                                  : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
                            }`}
                          >
                            <ChildIcon
                              weight={isChildActive ? 'duotone' : 'regular'}
                              className={`w-4 h-4 flex-shrink-0 transition-colors ${
                                isChildActive
                                  ? activeIconClass
                                  : child.restricted
                                    ? 'text-slate-500'
                                    : 'text-slate-400'
                              }`}
                            />
                            {child.restricted && (
                              <span
                                className="absolute top-1.5 right-2 w-1.5 h-1.5 rounded-full bg-amber-400/80"
                                aria-hidden="true"
                              />
                            )}
                          </button>
                        );
                      })}
                    </React.Fragment>
                  );
                }

                if (hasChildren) {
                  const isSubmenuExpanded = formsMenuOpen || childActive;
                  return (
                    <div key={item.view} className="space-y-0.5">
                      <button
                        type="button"
                        onClick={() => setFormsMenuOpen((prev) => !prev)}
                        title={item.tooltip || item.label}
                        aria-label={item.label}
                        aria-expanded={isSubmenuExpanded}
                        className={`w-[calc(100%-1rem)] mx-2 flex items-center justify-between px-3 py-2 text-left cursor-pointer transition-all text-xs rounded-lg font-medium ${
                          childActive
                            ? 'bg-white/[0.05] text-white font-semibold'
                            : item.restricted
                              ? 'text-slate-500 hover:bg-white/[0.03] hover:text-slate-300'
                              : 'text-slate-300 hover:bg-white/[0.04] hover:text-white'
                        }`}
                      >
                        <div className="flex items-center min-w-0 gap-2.5">
                          <Icon
                            weight={childActive ? 'duotone' : 'regular'}
                            className={`w-4 h-4 flex-shrink-0 transition-colors ${
                              childActive
                                ? activeIconClass
                                : item.restricted
                                  ? 'text-slate-500'
                                  : 'text-slate-400'
                            }`}
                          />
                          <span className="truncate">{item.label}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {item.badge}
                          <CaretDown
                            className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${
                              isSubmenuExpanded ? 'rotate-180' : ''
                            }`}
                          />
                        </div>
                      </button>

                      {isSubmenuExpanded && (
                        <div className="ml-6 mr-2 pl-2.5 border-l border-white/[0.1] space-y-0.5 py-0.5">
                          {item.children!.map((child) => {
                            const ChildIcon = child.icon;
                            const isChildActive = matchesNavView(child.view);
                            return (
                              <button
                                key={child.view}
                                type="button"
                                onClick={() => handleSelectNav(child.view)}
                                title={child.tooltip || child.label}
                                aria-label={child.label}
                                className={`w-full flex items-center justify-between px-2.5 py-1.5 text-left cursor-pointer transition-all text-[12px] rounded-md font-medium ${
                                  isChildActive
                                    ? 'bg-[#1F2422] text-white font-semibold'
                                    : child.restricted
                                      ? 'text-slate-500 hover:bg-white/[0.03] hover:text-slate-300'
                                      : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
                                }`}
                              >
                                <div className="flex items-center min-w-0 gap-2">
                                  <ChildIcon
                                    weight={isChildActive ? 'duotone' : 'regular'}
                                    className={`w-3.5 h-3.5 flex-shrink-0 transition-colors ${
                                      isChildActive
                                        ? activeIconClass
                                        : child.restricted
                                          ? 'text-slate-500'
                                          : 'text-slate-400'
                                    }`}
                                  />
                                  <span className="truncate">{child.label}</span>
                                </div>
                                {child.badge}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }

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
                        ? 'bg-[#1F2422] text-white font-semibold'
                        : item.restricted
                          ? 'text-slate-500 hover:bg-white/[0.03] hover:text-slate-300'
                          : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
                    }`}
                  >
                    <div className={`flex items-center min-w-0 ${compact ? 'justify-center' : 'gap-2.5'}`}>
                      <Icon
                        weight={active ? 'duotone' : 'regular'}
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
                <div className="text-[11px] text-slate-400 truncate">
                  {currentUser?.email || 'admin@squadpipe.com'}
                </div>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-white/[0.06] text-slate-300 border border-white/10">
                    {displayRole}
                  </span>
                  <span className="text-[11px] text-slate-400">&bull; Active Session</span>
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
                <SignOut className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
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
              ? 'bg-white/[0.08] border-white/20 shadow-sm'
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
                <div className="text-[11px] text-slate-400 font-normal truncate mt-0.5">
                  {displayRole}
                </div>
              </div>
            )}
          </div>
          {!compact &&
            (showProfileMenu ? (
              <CaretDown className="w-3.5 h-3.5 text-white mr-1 flex-shrink-0 transition-transform" />
            ) : (
              <DotsThreeVertical className="w-4 h-4 text-slate-400 group-hover:text-slate-200 mr-0.5 flex-shrink-0 transition-colors" />
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
