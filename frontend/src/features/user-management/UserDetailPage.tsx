import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Briefcase,
  Building2,
  CalendarClock,
  CheckCircle2,
  DollarSign,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Pause,
  Pencil,
  Play,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  User as UserIcon,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { BillablePlacement, Candidate, Requirement, User } from '../../types';
import { ConfirmDeleteModal } from '../../components/shared/ConfirmDeleteModal';
import {
  DetailBreadcrumb,
  DetailTabItem,
  DetailUnderlineTabs,
} from '../../components/shared/DetailPageShell';
import { MaskedValue } from '../../components/shared/MaskedValue';
import { SortableTableHeader } from '../../components/shared/SortableTableHeader';
import {
  STAFFING_GRID_CELL_CLASS,
  STAFFING_GRID_ROW_CLASS,
  STAFFING_GRID_STICKY_TD_CLASS,
  STAFFING_GRID_STICKY_TH_CLASS,
  STAFFING_GRID_TABLE_CLASS,
  STAFFING_GRID_THEAD_CLASS,
  STAFFING_GRID_TH_CLASS,
} from '../../components/shared/StaffingGrid';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { TablePagination } from '../../components/shared/TablePagination';
import { getInitials } from '../../utils/entityMappers';
import { getStageDotClass } from '../../utils/stageStyles';
import { extractRateSortValue, sortArrayByColumn, useTableSort } from '../../utils/tableSort';
import { useClientPagination } from '../../utils/usePagination';
import { getWorkspaceBrand } from '../../utils/workspaceBrand';
import { getEffectiveStatus, getPlacementStatusMeta } from '../billable/placementUtils';
import {
  getUserRoleBadgeClass,
  getUserRoleCapabilities,
  getUserStatusTone,
  matchesOwnerName,
} from './userUtils';

interface UserDetailPageProps {
  user: User | null;
  backLabel?: string;
  onBack: () => void;
  requirements?: Requirement[];
  candidates?: Candidate[];
  placements?: BillablePlacement[];
  rateMasked?: boolean;
  onEditUser?: (user: User, focusSection?: 'profile' | 'access') => void;
  onToggleRateMask?: (user: User) => Promise<void> | void;
  onToggleUserStatus?: (user: User) => Promise<void> | void;
  onResendInvite?: (user: User) => Promise<void> | void;
  onDeleteUser?: (user: User) => Promise<void> | void;
  onOpenRequirement?: (req: Requirement) => void;
  onOpenConsultant?: (cand: Candidate) => void;
  onSelectPlacement?: (placement: BillablePlacement) => void;
}

/**
 * Full-page member profile (/users/:id) displaying role governance, commercial clearance,
 * assigned requisitions, bench consultants, managed placements, and account access details.
 */
export const UserDetailPage: React.FC<UserDetailPageProps> = ({
  user,
  backLabel = 'Back to Team Members',
  onBack,
  requirements = [],
  candidates = [],
  placements = [],
  rateMasked = false,
  onEditUser,
  onToggleRateMask,
  onToggleUserStatus,
  onResendInvite,
  onDeleteUser,
  onOpenRequirement,
  onOpenConsultant,
  onSelectPlacement,
}) => {
  const [workspaceTab, setWorkspaceTab] = useState<
    'requisitions' | 'consultants' | 'placements' | 'access'
  >('requisitions');
  const [reqFilter, setReqFilter] = useState<'All' | 'Open' | 'Closed'>('All');
  const [reqSearch, setReqSearch] = useState('');
  const [candSearch, setCandSearch] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isTogglingMask, setIsTogglingMask] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const reqsSort = useTableSort<'code' | 'companyName' | 'opportunityTitle' | 'location' | 'status'>();
  const candsSort = useTableSort<'fullName' | 'currentTitle' | 'workAuth' | 'pipelineStage'>();
  const placementsSort = useTableSort<'resourceName' | 'customer' | 'skillRole' | 'endDate' | 'billing' | 'status'>();

  useEffect(() => {
    setWorkspaceTab('requisitions');
    setReqFilter('All');
    setReqSearch('');
    setCandSearch('');
    setShowDeleteModal(false);
    reqsSort.resetSort();
    candsSort.resetSort();
    placementsSort.resetSort();
  }, [user?.id]);

  const userReqs = useMemo(
    () => (user ? requirements.filter((r) => matchesOwnerName(r.assignedRecruiter, user.name)) : []),
    [requirements, user]
  );

  const filteredReqs = useMemo(() => {
    return userReqs.filter((r) => {
      const isClosed = r.status === 'Closed' || r.status === 'Archived';
      if (reqFilter === 'Open' && isClosed) return false;
      if (reqFilter === 'Closed' && !isClosed) return false;
      if (reqSearch.trim()) {
        const q = reqSearch.toLowerCase();
        return (
          r.code.toLowerCase().includes(q) ||
          r.companyName.toLowerCase().includes(q) ||
          r.opportunityTitle.toLowerCase().includes(q) ||
          (r.location || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [userReqs, reqFilter, reqSearch]);

  const userCandidates = useMemo(
    () => (user ? candidates.filter((c) => matchesOwnerName(c.assignedRecruiter, user.name)) : []),
    [candidates, user]
  );

  const filteredCandidates = useMemo(() => {
    if (!candSearch.trim()) return userCandidates;
    const q = candSearch.toLowerCase();
    return userCandidates.filter(
      (c) =>
        c.fullName.toLowerCase().includes(q) ||
        (c.currentTitle || '').toLowerCase().includes(q) ||
        (c.workAuth || '').toLowerCase().includes(q) ||
        (c.skillset || '').toLowerCase().includes(q)
    );
  }, [userCandidates, candSearch]);

  const userPlacements = useMemo(
    () => (user ? placements.filter((p) => matchesOwnerName(p.recruiter, user.name)) : []),
    [placements, user]
  );

  const sortedReqs = sortArrayByColumn(filteredReqs, reqsSort.sort, {
    code: (r) => r.code,
    companyName: (r) => r.companyName,
    opportunityTitle: (r) => r.opportunityTitle,
    location: (r) => r.location,
    status: (r) => r.status,
  });

  const sortedCands = sortArrayByColumn(filteredCandidates, candsSort.sort, {
    fullName: (c) => c.fullName,
    currentTitle: (c) => c.currentTitle,
    workAuth: (c) => c.workAuth,
    pipelineStage: (c) => c.pipelineStage,
  });

  const sortedPlacements = sortArrayByColumn(userPlacements, placementsSort.sort, {
    resourceName: (p) => p.resourceName,
    customer: (p) => p.customer,
    skillRole: (p) => p.skillRole,
    endDate: (p) => (p.endDate ? new Date(p.endDate) : null),
    billing: (p) => (rateMasked ? null : extractRateSortValue(p.billing)),
    status: (p) => getEffectiveStatus(p),
  });

  const reqsPg = useClientPagination(
    sortedReqs,
    10,
    `${user?.id || ''}|reqs|${reqFilter}|${reqSearch}|${reqsSort.sort.sortBy || ''}|${reqsSort.sort.sortDir}`
  );
  const candsPg = useClientPagination(
    sortedCands,
    10,
    `${user?.id || ''}|cands|${candSearch}|${candsSort.sort.sortBy || ''}|${candsSort.sort.sortDir}`
  );
  const placementsPg = useClientPagination(
    sortedPlacements,
    10,
    `${user?.id || ''}|placements|${placementsSort.sort.sortBy || ''}|${placementsSort.sort.sortDir}`
  );

  if (!user) {
    return (
      <section className="max-w-7xl mx-auto py-16 text-center space-y-3 animate-fade-in">
        <p className="text-sm font-semibold text-slate-700">Team member record not found.</p>
        <button
          type="button"
          onClick={onBack}
          className="px-3.5 py-2 rounded-lg bg-brand-600 text-white text-xs font-semibold hover:bg-brand-700 inline-flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{backLabel}</span>
        </button>
      </section>
    );
  }

  const initials = getInitials(user.name, 'TM');
  const openReqCount = user.metrics?.openReqs ?? userReqs.filter((r) => r.status !== 'Closed').length;
  const submissionsCount = user.metrics?.submissions ?? 0;
  const activePlacementCount =
    user.metrics?.placements ??
    userPlacements.filter((p) => p.status !== 'Completed' && p.status !== 'Terminated').length;
  const canEdit = Boolean(onEditUser && (!user.isSuperAdmin || user.isCurrentUser));
  const canManageProtection = !user.isSuperAdmin && !user.isCurrentUser;
  const workspaceAgencyName = user.agencyName || getWorkspaceBrand().agencyName || 'SquadPipe Staffing';
  const roleCapabilities = getUserRoleCapabilities(user.role, user.rateMasked);

  const userTabs: Array<
    DetailTabItem<'requisitions' | 'consultants' | 'placements' | 'access'>
  > = [
    {
      id: 'requisitions',
      label: 'Assigned Requisitions',
      icon: Briefcase,
      badge: userReqs.length,
    },
    {
      id: 'consultants',
      label: 'Assigned Consultants',
      icon: UserCheck,
      badge: userCandidates.length,
    },
    {
      id: 'placements',
      label: 'Managed Placements',
      icon: DollarSign,
      badge: userPlacements.length,
    },
    {
      id: 'access',
      label: 'Access & Account',
      icon: ShieldCheck,
    },
  ];

  return (
    <section className="max-w-7xl mx-auto px-1 sm:px-2 lg:px-4 space-y-5 pb-8 animate-fade-in">
      <DetailBreadcrumb
        backLabel={backLabel}
        onBack={onBack}
        codePill={user.role}
        title={user.name}
      />

      {/* Bare Canvas Entity Title & Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5 min-w-0 flex-1">
          <div className="w-11 h-11 rounded-full bg-white border border-slate-200 text-slate-700 font-semibold text-sm flex items-center justify-center shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-[19px] font-semibold text-slate-900 tracking-tight leading-snug">
                {user.name}
              </h1>
              <StatusBadge label={user.status} tone={getUserStatusTone(user.status)} size="xs" />
              {user.isSuperAdmin && (
                <StatusBadge
                  tone="amber"
                  size="xs"
                  title="Protected Workspace Super Admin"
                  label="Super Admin"
                />
              )}
              {user.isCurrentUser && <StatusBadge tone="slate" size="xs" label="You" />}
            </div>
            <div className="flex items-center flex-wrap gap-x-2.5 gap-y-1 text-xs text-slate-500">
              <a
                href={`mailto:${user.email}`}
                className="inline-flex items-center gap-1.5 font-medium text-slate-700 hover:text-brand-600"
              >
                <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{user.email}</span>
              </a>
              <span className="text-slate-300" aria-hidden="true">
                &middot;
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{user.desk || 'Unassigned Desk'}</span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
          {user.status === 'Invited' && onResendInvite && (
            <button
              type="button"
              disabled={isResending}
              onClick={async () => {
                if (isResending) return;
                setIsResending(true);
                try {
                  await onResendInvite(user);
                } finally {
                  setIsResending(false);
                }
              }}
              className="h-8 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
            >
              {isResending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-600" />
              ) : (
                <Send className="w-3.5 h-3.5 text-slate-500" />
              )}
              <span>{isResending ? 'Sending...' : 'Resend Invite'}</span>
            </button>
          )}
          {onToggleUserStatus && canManageProtection && (
            <button
              type="button"
              disabled={isTogglingStatus}
              onClick={async () => {
                if (isTogglingStatus) return;
                setIsTogglingStatus(true);
                try {
                  await onToggleUserStatus(user);
                } finally {
                  setIsTogglingStatus(false);
                }
              }}
              className="h-8 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
            >
              {user.status === 'Active' ? (
                <>
                  <Pause className="w-3.5 h-3.5 text-slate-500" />
                  <span>Suspend</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Activate</span>
                </>
              )}
            </button>
          )}
          {onDeleteUser && canManageProtection && (
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="h-8 px-3 rounded-lg border border-rose-200 bg-white hover:bg-rose-50 text-rose-600 text-[11px] font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Remove</span>
            </button>
          )}
          {canEdit && onEditUser && (
            <button
              type="button"
              onClick={() => onEditUser(user, 'profile')}
              className="h-8 px-3.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-[11px] font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Pencil className="w-3 h-3" />
              <span>Edit Member</span>
            </button>
          )}
        </div>
      </div>

      {/* Standalone 4-Column Summary Card */}
      <div className="bg-white rounded-xl border border-slate-200/90 card-shadow overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 text-xs">
          {/* 1. Role & Governance */}
          <div className="px-6 py-4 space-y-2 min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Role &amp; governance
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-semibold ${getUserRoleBadgeClass(
                  user.role
                )}`}
              >
                {user.role}
              </span>
            </div>
            <div className="text-[11px] text-slate-500 leading-snug">
              {user.isSuperAdmin
                ? 'Protected founding workspace owner'
                : user.role === 'Administrator'
                  ? 'Full team & workspace admin rights'
                  : 'Standard operational desk permissions'}
            </div>
          </div>

          {/* 2. Desk & Workspace */}
          <div className="px-6 py-4 space-y-2 min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Assigned desk
            </div>
            <div className="font-semibold text-slate-900 leading-snug break-words flex items-start gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
              <span>{user.desk || 'Unassigned'}</span>
            </div>
            <div className="text-[11px] text-slate-500 leading-snug break-words">
              {workspaceAgencyName}
            </div>
          </div>

          {/* 3. Commercial Rate Access */}
          <div className="px-6 py-4 space-y-2 min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Rate visibility
            </div>
            <div className="flex items-center justify-between gap-2">
              <span
                className={`inline-flex items-center gap-1.5 font-semibold ${
                  user.rateMasked ? 'text-slate-700' : 'text-emerald-700'
                }`}
              >
                {user.rateMasked ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                    <span>Masked (••••)</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Visible</span>
                  </>
                )}
              </span>
              {onToggleRateMask && (
                <button
                  type="button"
                  disabled={isTogglingMask}
                  onClick={async () => {
                    if (isTogglingMask) return;
                    setIsTogglingMask(true);
                    try {
                      await onToggleRateMask(user);
                    } finally {
                      setIsTogglingMask(false);
                    }
                  }}
                  className="h-6 px-2 rounded border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-semibold text-slate-600 cursor-pointer disabled:opacity-50"
                >
                  {isTogglingMask ? '...' : user.rateMasked ? 'Reveal' : 'Mask'}
                </button>
              )}
            </div>
            <div className="text-[11px] text-slate-500 leading-snug">
              {user.rateMasked
                ? 'Bill/pay margins hidden across workspace'
                : 'Cleared to view client rates & margins'}
            </div>
          </div>

          {/* 4. Live Workload */}
          <div className="px-6 py-4 space-y-2 min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Live workload
            </div>
            <div className="flex items-baseline gap-2 flex-wrap leading-none">
              <span className="text-lg font-bold font-mono text-slate-900 tabular-nums">
                {openReqCount}
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                open reqs &middot;{' '}
                <strong className="font-semibold text-emerald-700">
                  {activePlacementCount} placed
                </strong>
              </span>
            </div>
            <div className="text-[11px] text-slate-500 tabular-nums">
              {submissionsCount} total submissions &middot; Last active {user.lastActive || 'Active Now'}
            </div>
          </div>
        </div>
      </div>

      {/* Floating Underline Workspace Tabs */}
      <DetailUnderlineTabs
        ariaLabel="Team member sections"
        tabs={userTabs}
        activeTab={workspaceTab}
        onChange={setWorkspaceTab}
      />

      {/* TAB 1: Assigned Requisitions */}
      {workspaceTab === 'requisitions' && (
        <section className="bg-white rounded-xl border border-slate-200/90 card-shadow overflow-hidden text-xs">
          <div className="px-6 py-4 border-b border-slate-100 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Briefcase className="w-3.5 h-3.5 text-brand-600" />
              <h2 className="font-bold text-slate-900">
                Assigned Requisitions ({userReqs.length})
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {userReqs.length > 0 && (
                <>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={reqSearch}
                      onChange={(e) => setReqSearch(e.target.value)}
                      placeholder="Filter req code or client..."
                      className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white w-48 text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-brand-600"
                    />
                  </div>
                  <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-[11px]">
                    {(['All', 'Open', 'Closed'] as const).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setReqFilter(tab)}
                        className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                          reqFilter === tab
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {userReqs.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              No job requisitions currently assigned to {user.name}.
            </div>
          ) : filteredReqs.length === 0 ? (
            <div className="py-10 text-center text-slate-400">
              No requisitions match the active filter.{' '}
              <button
                type="button"
                onClick={() => {
                  setReqFilter('All');
                  setReqSearch('');
                }}
                className="font-semibold text-brand-600 hover:underline cursor-pointer"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className={STAFFING_GRID_TABLE_CLASS}>
                  <thead className={STAFFING_GRID_THEAD_CLASS}>
                    <tr>
                      <SortableTableHeader
                        label="Req Code"
                        column="code"
                        sort={reqsSort.sort}
                        onSort={reqsSort.handleSort}
                        defaultDir="asc"
                        className={`${STAFFING_GRID_TH_CLASS} ${STAFFING_GRID_STICKY_TH_CLASS}`}
                      />
                      <SortableTableHeader
                        label="Client"
                        column="companyName"
                        sort={reqsSort.sort}
                        onSort={reqsSort.handleSort}
                        defaultDir="asc"
                        className={STAFFING_GRID_TH_CLASS}
                      />
                      <SortableTableHeader
                        label="Role Title"
                        column="opportunityTitle"
                        sort={reqsSort.sort}
                        onSort={reqsSort.handleSort}
                        defaultDir="asc"
                        className={STAFFING_GRID_TH_CLASS}
                      />
                      <SortableTableHeader
                        label="Location"
                        column="location"
                        sort={reqsSort.sort}
                        onSort={reqsSort.handleSort}
                        defaultDir="asc"
                        className={STAFFING_GRID_TH_CLASS}
                      />
                      <SortableTableHeader
                        label="Stage"
                        column="status"
                        sort={reqsSort.sort}
                        onSort={reqsSort.handleSort}
                        defaultDir="asc"
                        className={STAFFING_GRID_TH_CLASS}
                      />
                    </tr>
                  </thead>
                  <tbody className="text-slate-700">
                    {reqsPg.pagedItems.map((req) => (
                      <tr
                        key={req.id}
                        onClick={() => onOpenRequirement?.(req)}
                        className={onOpenRequirement ? STAFFING_GRID_ROW_CLASS : undefined}
                      >
                        <td
                          className={`${STAFFING_GRID_CELL_CLASS} ${STAFFING_GRID_STICKY_TD_CLASS} font-mono font-semibold text-brand-700 whitespace-nowrap`}
                        >
                          {req.code}
                        </td>
                        <td className={`${STAFFING_GRID_CELL_CLASS} font-medium text-slate-900`}>
                          {req.companyName}
                        </td>
                        <td className={`${STAFFING_GRID_CELL_CLASS} font-semibold text-slate-900`}>
                          {req.opportunityTitle}
                        </td>
                        <td className={`${STAFFING_GRID_CELL_CLASS} text-slate-600`}>
                          {req.location || '—'}
                        </td>
                        <td className={`${STAFFING_GRID_CELL_CLASS} whitespace-nowrap`}>
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white border border-slate-200 text-[11px] font-semibold text-slate-700">
                            <span className={`w-1.5 h-1.5 rounded-full ${getStageDotClass(req.status)}`} />
                            <span>{req.status}</span>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <TablePagination
                page={reqsPg.page}
                limit={reqsPg.limit}
                total={reqsPg.total}
                onPageChange={reqsPg.setPage}
                onLimitChange={reqsPg.setLimit}
                itemLabel="requisitions"
              />
            </>
          )}
        </section>
      )}

      {/* TAB 2: Assigned Consultants */}
      {workspaceTab === 'consultants' && (
        <section className="bg-white rounded-xl border border-slate-200/90 card-shadow overflow-hidden text-xs">
          <div className="px-6 py-4 border-b border-slate-100 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <UserCheck className="w-3.5 h-3.5 text-brand-600" />
              <h2 className="font-bold text-slate-900">
                Assigned Consultants ({userCandidates.length})
              </h2>
            </div>
            {userCandidates.length > 0 && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={candSearch}
                  onChange={(e) => setCandSearch(e.target.value)}
                  placeholder="Filter consultants or skills..."
                  className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white w-56 text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-brand-600"
                />
              </div>
            )}
          </div>

          {userCandidates.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              No bench or pipeline consultants assigned to {user.name}.
            </div>
          ) : filteredCandidates.length === 0 ? (
            <div className="py-10 text-center text-slate-400">
              No consultants match "{candSearch}".{' '}
              <button
                type="button"
                onClick={() => setCandSearch('')}
                className="font-semibold text-brand-600 hover:underline cursor-pointer"
              >
                Clear filter
              </button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className={STAFFING_GRID_TABLE_CLASS}>
                  <thead className={STAFFING_GRID_THEAD_CLASS}>
                    <tr>
                      <SortableTableHeader
                        label="Consultant"
                        icon={<UserIcon className="w-3 h-3" />}
                        column="fullName"
                        sort={candsSort.sort}
                        onSort={candsSort.handleSort}
                        defaultDir="asc"
                        className={`${STAFFING_GRID_TH_CLASS} ${STAFFING_GRID_STICKY_TH_CLASS}`}
                      />
                      <SortableTableHeader
                        label="Title"
                        icon={<Briefcase className="w-3 h-3" />}
                        column="currentTitle"
                        sort={candsSort.sort}
                        onSort={candsSort.handleSort}
                        defaultDir="asc"
                        className={STAFFING_GRID_TH_CLASS}
                      />
                      <SortableTableHeader
                        label="Work Auth"
                        icon={<ShieldCheck className="w-3 h-3" />}
                        column="workAuth"
                        sort={candsSort.sort}
                        onSort={candsSort.handleSort}
                        defaultDir="asc"
                        className={STAFFING_GRID_TH_CLASS}
                      />
                      <SortableTableHeader
                        label="Stage"
                        column="pipelineStage"
                        sort={candsSort.sort}
                        onSort={candsSort.handleSort}
                        defaultDir="asc"
                        className={STAFFING_GRID_TH_CLASS}
                      />
                    </tr>
                  </thead>
                  <tbody className="text-slate-700">
                    {candsPg.pagedItems.map((cand) => (
                      <tr
                        key={cand.id}
                        onClick={() => onOpenConsultant?.(cand)}
                        className={onOpenConsultant ? STAFFING_GRID_ROW_CLASS : undefined}
                      >
                        <td
                          className={`${STAFFING_GRID_CELL_CLASS} ${STAFFING_GRID_STICKY_TD_CLASS} font-semibold text-slate-900 whitespace-nowrap`}
                        >
                          {cand.fullName}
                        </td>
                        <td className={`${STAFFING_GRID_CELL_CLASS} text-slate-700`}>
                          {cand.currentTitle || '—'}
                        </td>
                        <td className={`${STAFFING_GRID_CELL_CLASS} text-slate-600 whitespace-nowrap`}>
                          {cand.workAuth || '—'}
                        </td>
                        <td className={`${STAFFING_GRID_CELL_CLASS} whitespace-nowrap`}>
                          <StatusBadge
                            label={cand.pipelineStage || 'Available Bench'}
                            tone={cand.pipelineStage === 'On Project' ? 'emerald' : 'slate'}
                            size="xs"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <TablePagination
                page={candsPg.page}
                limit={candsPg.limit}
                total={candsPg.total}
                onPageChange={candsPg.setPage}
                onLimitChange={candsPg.setLimit}
                itemLabel="consultants"
              />
            </>
          )}
        </section>
      )}

      {/* TAB 3: Managed Placements */}
      {workspaceTab === 'placements' && (
        <section className="bg-white rounded-xl border border-slate-200/90 card-shadow overflow-hidden text-xs">
          <div className="px-6 py-4 border-b border-slate-100 bg-white flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
              <h2 className="font-bold text-slate-900">
                Managed Placements ({userPlacements.length})
              </h2>
            </div>
          </div>

          {userPlacements.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              No billable placements owned by {user.name}.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className={STAFFING_GRID_TABLE_CLASS}>
                  <thead className={STAFFING_GRID_THEAD_CLASS}>
                    <tr>
                      <SortableTableHeader
                        label="Consultant"
                        column="resourceName"
                        sort={placementsSort.sort}
                        onSort={placementsSort.handleSort}
                        defaultDir="asc"
                        className={`${STAFFING_GRID_TH_CLASS} ${STAFFING_GRID_STICKY_TH_CLASS}`}
                      />
                      <SortableTableHeader
                        label="Client"
                        column="customer"
                        sort={placementsSort.sort}
                        onSort={placementsSort.handleSort}
                        defaultDir="asc"
                        className={STAFFING_GRID_TH_CLASS}
                      />
                      <SortableTableHeader
                        label="Role"
                        column="skillRole"
                        sort={placementsSort.sort}
                        onSort={placementsSort.handleSort}
                        defaultDir="asc"
                        className={STAFFING_GRID_TH_CLASS}
                      />
                      <SortableTableHeader
                        label="End Date"
                        column="endDate"
                        sort={placementsSort.sort}
                        onSort={placementsSort.handleSort}
                        defaultDir="asc"
                        className={STAFFING_GRID_TH_CLASS}
                      />
                      <SortableTableHeader
                        label="Bill Rate"
                        column="billing"
                        sort={placementsSort.sort}
                        onSort={placementsSort.handleSort}
                        defaultDir="desc"
                        disabled={rateMasked}
                        className={STAFFING_GRID_TH_CLASS}
                      />
                      <SortableTableHeader
                        label="Status"
                        column="status"
                        sort={placementsSort.sort}
                        onSort={placementsSort.handleSort}
                        defaultDir="asc"
                        className={STAFFING_GRID_TH_CLASS}
                      />
                    </tr>
                  </thead>
                  <tbody className="text-slate-700">
                    {placementsPg.pagedItems.map((p) => {
                      const pMeta = getPlacementStatusMeta(p);
                      return (
                        <tr
                          key={p.id}
                          onClick={() => onSelectPlacement?.(p)}
                          className={onSelectPlacement ? STAFFING_GRID_ROW_CLASS : undefined}
                        >
                          <td
                            className={`${STAFFING_GRID_CELL_CLASS} ${STAFFING_GRID_STICKY_TD_CLASS} font-semibold text-slate-900 whitespace-nowrap`}
                          >
                            {p.resourceName}
                          </td>
                          <td className={`${STAFFING_GRID_CELL_CLASS} font-medium text-slate-800`}>
                            {p.customer}
                          </td>
                          <td className={`${STAFFING_GRID_CELL_CLASS} text-slate-600`}>
                            {p.skillRole || '—'}
                          </td>
                          <td className={`${STAFFING_GRID_CELL_CLASS} font-mono text-slate-600 whitespace-nowrap`}>
                            {p.endDate || '—'}
                          </td>
                          <td className={`${STAFFING_GRID_CELL_CLASS} font-mono font-semibold text-slate-900 whitespace-nowrap`}>
                            <MaskedValue value={p.billing || '—'} isMasked={rateMasked} />
                          </td>
                          <td className={`${STAFFING_GRID_CELL_CLASS} whitespace-nowrap`}>
                            <StatusBadge label={pMeta.label} tone={pMeta.tone} size="xs" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <TablePagination
                page={placementsPg.page}
                limit={placementsPg.limit}
                total={placementsPg.total}
                onPageChange={placementsPg.setPage}
                onLimitChange={placementsPg.setLimit}
                itemLabel="placements"
              />
            </>
          )}
        </section>
      )}

      {/* TAB 4: Access & Account */}
      {workspaceTab === 'access' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 text-xs">
          <section className="lg:col-span-5 bg-white rounded-xl border border-slate-200/90 card-shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-white flex items-center gap-2">
              <CalendarClock className="w-3.5 h-3.5 text-brand-600" />
              <h2 className="font-bold text-slate-900">Account Metadata</h2>
            </div>
            <div className="divide-y divide-slate-100">
              <div className="px-6 py-3.5 flex items-center justify-between gap-4">
                <span className="text-slate-500">Full Name</span>
                <span className="font-semibold text-slate-900 text-right">{user.name}</span>
              </div>
              <div className="px-6 py-3.5 flex items-center justify-between gap-4">
                <span className="text-slate-500">Corporate Email</span>
                <a
                  href={`mailto:${user.email}`}
                  className="font-mono font-medium text-brand-700 hover:underline text-right break-all"
                >
                  {user.email}
                </a>
              </div>
              <div className="px-6 py-3.5 flex items-center justify-between gap-4">
                <span className="text-slate-500">Assigned Desk</span>
                <span className="font-medium text-slate-900 text-right">{user.desk || '—'}</span>
              </div>
              <div className="px-6 py-3.5 flex items-center justify-between gap-4">
                <span className="text-slate-500">Account Status</span>
                <StatusBadge label={user.status} tone={getUserStatusTone(user.status)} size="xs" />
              </div>
              <div className="px-6 py-3.5 flex items-center justify-between gap-4">
                <span className="text-slate-500">Member Since</span>
                <span className="font-mono text-slate-700">{user.createdAt || '—'}</span>
              </div>
              <div className="px-6 py-3.5 flex items-center justify-between gap-4">
                <span className="text-slate-500">Last Activity</span>
                <span className="font-medium text-slate-700">{user.lastActive || 'Active Now'}</span>
              </div>
            </div>
          </section>

          <section className="lg:col-span-7 bg-white rounded-xl border border-slate-200/90 card-shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-white flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-brand-600" />
                <h2 className="font-bold text-slate-900">Role Permissions &amp; Safeguards</h2>
              </div>
              {canEdit && onEditUser && (
                <button
                  type="button"
                  onClick={() => onEditUser(user, 'access')}
                  className="text-[11px] font-semibold text-brand-600 hover:text-brand-700 hover:underline cursor-pointer"
                >
                  Configure Access
                </button>
              )}
            </div>

            <div className="divide-y divide-slate-100">
              {roleCapabilities.map((cap) => (
                <div key={cap.label} className="px-6 py-4 flex items-start gap-3">
                  {cap.allowed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0 space-y-0.5">
                    <div className="font-semibold text-slate-900">{cap.label}</div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">{cap.description}</p>
                  </div>
                </div>
              ))}
            </div>

            {user.isSuperAdmin && (
              <div className="mx-6 mb-5 mt-2 p-3.5 rounded-lg bg-amber-50/70 border border-amber-200/90 flex items-start gap-2.5 text-[11px] text-amber-900">
                <Lock className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                <span>
                  This account is the workspace&apos;s protected Super Admin. Its administrator role
                  cannot be downgraded, and it cannot be suspended or removed.
                </span>
              </div>
            )}
          </section>
        </div>
      )}

      <ConfirmDeleteModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Remove Team Member?"
        description={
          <>
            Are you sure you want to remove{' '}
            <span className="font-semibold text-slate-800">{user.name}</span> ({user.email}) from{' '}
            {workspaceAgencyName}?
          </>
        }
        warningText="Assigned requisitions and candidates will remain in the workspace."
        confirmLabel="Remove Member"
        loadingText="Removing..."
        onConfirm={async () => {
          if (!onDeleteUser) return;
          await onDeleteUser(user);
          onBack();
        }}
      />
    </section>
  );
};
