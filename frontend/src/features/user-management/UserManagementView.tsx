import React, { useState, useEffect } from 'react';
import {
  Search,
  UserPlus,
  Download,
  Eye,
  EyeOff,
  Trash2,
  Pause,
  Play,
  X,
  AlertTriangle,
  Pencil,
  Send,
  ShieldCheck,
  Loader2,
} from 'lucide-react';
import { apiClient } from '../../config/api.config';
import { ActionButton } from '../../components/shared/ActionButton';
import { SortableTableHeader } from '../../components/shared/SortableTableHeader';
import { User } from '../../types';
import { TablePagination } from '../../components/shared/TablePagination';
import { StatusBadge } from '../../components/shared/StatusBadge';
import {
  formatMissingFieldsMessage,
  getMissingFieldLabels,
  INVALID_FIELD_CLASSES,
} from '../../utils/formValidation';
import { CustomSelect } from '../../components/shared/CustomSelect';
import { SegmentedControl } from '../../components/shared/SegmentedControl';
import { useDebounce } from '../../utils/useDebounce';
import { mapUserFromApi } from '../../utils/entityMappers';
import { getWorkspaceBrandSlug } from '../../utils/workspaceBrand';
import { sortArrayByColumn, useTableSort } from '../../utils/tableSort';
import { AnimatedModal } from '../../components/shared/MotionPrimitives';

interface UserManagementViewProps {
  users: User[];
  onToggleRateMask: (user: User) => Promise<void> | void;
  onInviteUser: (user: Partial<User>) => Promise<void> | void;
  onResendInvite?: (user: User) => Promise<void> | void;
  onUpdateUser?: (user: User) => Promise<void> | void;
  onToggleUserStatus?: (user: User) => Promise<void> | void;
  onDeleteUser?: (user: User) => Promise<void> | void;
  showToast: (title: string, message: string, icon?: string) => void;
}

export const UserManagementView: React.FC<UserManagementViewProps> = ({
  users,
  onToggleRateMask,
  onInviteUser,
  onResendInvite,
  onUpdateUser,
  onToggleUserStatus,
  onDeleteUser,
  showToast,
}) => {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Invited' | 'Suspended'>('All');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const tableSort = useTableSort<
    'fullName' | 'role' | 'desk' | 'workload' | 'rateMasked' | 'status'
  >();
  const [tableUsers, setTableUsers] = useState<User[]>(() => users.slice(0, 10));
  const [totalUsers, setTotalUsers] = useState(users.length);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [inviteValidationAttempted, setInviteValidationAttempted] = useState(false);
  const [editValidationAttempted, setEditValidationAttempted] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [resendingUserId, setResendingUserId] = useState<string | null>(null);

  const debouncedSearch = useDebounce(search, 150);
  const currentUserEmail = users.find((u) => u.isCurrentUser)?.email;

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, roleFilter, statusFilter, tableSort.sort.sortBy, tableSort.sort.sortDir]);

  useEffect(() => {
    let active = true;
    const q = debouncedSearch.toLowerCase();
    const localFiltered = users.filter((u) => {
      const matchesSearch =
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.desk.toLowerCase().includes(q);
      const matchesRole = roleFilter === 'All' || u.role === roleFilter;
      const matchesStatus = statusFilter === 'All' || u.status === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });

    if (users.length > 0 && !tableSort.sort.sortBy) {
      setTotalUsers(localFiltered.length);
      setTableUsers(localFiltered.slice((page - 1) * limit, page * limit));
      setIsLoadingUsers(false);
    } else {
      setIsLoadingUsers(true);
    }

    apiClient
      .get('/users', {
        params: {
          search: debouncedSearch.trim() || undefined,
          role: roleFilter !== 'All' ? roleFilter : undefined,
          status: statusFilter !== 'All' ? statusFilter : undefined,
          page,
          limit,
          ...tableSort.sortParams,
        },
      })
      .then((res) => {
        if (!active) return;
        if (res.data?.success && Array.isArray(res.data.data)) {
          const mapped = res.data.data.map((u: any) => mapUserFromApi(u, currentUserEmail));
          setTableUsers(mapped);
          setTotalUsers(res.data.pagination?.total ?? mapped.length);
        }
      })
      .catch(() => {
        if (!active) return;
        const sortedFallback = sortArrayByColumn(localFiltered, tableSort.sort, {
          fullName: (u) => u.name,
          role: (u) => u.role,
          desk: (u) => u.desk,
          workload: (u) => u.workload,
          rateMasked: (u) => u.rateMasked,
          status: (u) => u.status,
        });
        setTotalUsers(sortedFallback.length);
        setTableUsers(sortedFallback.slice((page - 1) * limit, page * limit));
      })
      .finally(() => {
        if (active) setIsLoadingUsers(false);
      });
    return () => {
      active = false;
    };
  }, [
    debouncedSearch,
    roleFilter,
    statusFilter,
    page,
    limit,
    users,
    currentUserEmail,
    tableSort.sort.sortBy,
    tableSort.sort.sortDir,
    tableSort.sortParams,
  ]);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    role: 'Technical Recruiter',
    desk: 'US IT Contract (C2C & W2)',
    rateMasked: true,
  });

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'Administrator':
        return 'bg-white border border-slate-800 text-slate-900';
      default:
        return 'bg-white border border-slate-300 text-slate-700';
    }
  };

  const filteredUsers = tableUsers;

  const isInviteNameInvalid = inviteValidationAttempted && !newUser.name.trim();
  const isInviteEmailInvalid = inviteValidationAttempted && !newUser.email.trim();
  const isEditNameInvalid = editValidationAttempted && !editingUser?.name.trim();
  const isEditEmailInvalid = editValidationAttempted && !editingUser?.email.trim();

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isInviting) return;
    const missingFields = getMissingFieldLabels([
      { label: 'Full Name', valid: Boolean(newUser.name.trim()) },
      { label: 'Email', valid: Boolean(newUser.email.trim()) },
    ]);
    if (missingFields.length > 0) {
      setInviteValidationAttempted(true);
      showToast('Validation Error', formatMissingFieldsMessage(missingFields), 'error');
      return;
    }
    setInviteValidationAttempted(false);
    setIsInviting(true);
    try {
      await onInviteUser(newUser);
      setShowInviteModal(false);
      showToast(
        'Invitation Sent',
        `Invitation sent to ${newUser.email} as ${newUser.role}.`
      );
      setNewUser({
        name: '',
        email: '',
        role: 'Technical Recruiter',
        desk: 'US IT Contract (C2C & W2)',
        rateMasked: true,
      });
    } catch {
      // Error toast is already displayed by the parent handler
    } finally {
      setIsInviting(false);
    }
  };

  const exportTeamCsv = () => {
    const headers = ['Full Name', 'Email', 'Role', 'Desk', 'Rate Masked', 'Status'];
    const rows = users.map((u) => [
      `"${u.name}"`,
      `"${u.email}"`,
      `"${u.role}"`,
      `"${u.desk}"`,
      u.rateMasked ? 'Yes' : 'No',
      `"${u.status}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${getWorkspaceBrandSlug()}_Team_Roster_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    showToast('Export Generated', 'Team roster exported to CSV.');
  };

  return (
    <section className="max-w-7xl mx-auto px-1 sm:px-2 lg:px-4 space-y-5 pb-8 animate-fade-in select-none">
      {/* Clean Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-[19px] font-semibold text-slate-900 tracking-tight leading-snug">Team Members</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage team roles, assigned desks, and rate visibility.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={exportTeamCsv}
            className="h-8 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => setShowInviteModal(true)}
            className="h-8 px-3.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Invite Member</span>
          </button>
        </div>
      </div>

      {/* Main Table Card with Consolidated Filter Subheader */}
      <div className="bg-white rounded-xl border border-slate-200/90 card-shadow overflow-hidden">
        <div className="px-6 py-3.5 border-b border-slate-100 bg-white flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, email, or desk..."
                className="w-full h-8 pl-8 pr-3 border border-slate-200 rounded-lg text-xs bg-white focus:border-brand-600 focus:outline-none transition-colors"
              />
            </div>

            <CustomSelect
              value={roleFilter}
              onChange={setRoleFilter}
              ariaLabel="Filter team members by role"
              size="sm"
              fullWidth={false}
              minMenuWidth={170}
              options={[
                { value: 'All', label: 'All Roles' },
                'Administrator',
                'Senior Recruiter',
                'Technical Recruiter',
                'Bench Sales Lead',
                'Account Executive',
                'Associate Recruiter',
              ]}
            />

            <SegmentedControl<'All' | 'Active' | 'Invited' | 'Suspended'>
              value={statusFilter}
              onChange={setStatusFilter}
              ariaLabel="Filter team members by status"
              options={[
                { value: 'All', label: 'All' },
                { value: 'Active', label: 'Active' },
                { value: 'Invited', label: 'Invited' },
                { value: 'Suspended', label: 'Suspended' },
              ]}
            />
          </div>

          <div className="text-[11px] text-slate-500">
            <span className="font-semibold text-slate-800">{totalUsers}</span> of {users.length} members
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white border-b border-slate-100">
              <tr className="text-slate-400 font-bold uppercase text-[11px] tracking-wider">
                <SortableTableHeader
                  label="Member"
                  column="fullName"
                  sort={tableSort.sort}
                  onSort={tableSort.handleSort}
                  defaultDir="asc"
                  className="py-3 px-5 whitespace-nowrap"
                />
                <SortableTableHeader
                  label="Role"
                  column="role"
                  sort={tableSort.sort}
                  onSort={tableSort.handleSort}
                  defaultDir="asc"
                  className="py-3 px-4 whitespace-nowrap"
                />
                <SortableTableHeader
                  label="Desk"
                  column="desk"
                  sort={tableSort.sort}
                  onSort={tableSort.handleSort}
                  defaultDir="asc"
                  className="py-3 px-4 whitespace-nowrap"
                />
                <SortableTableHeader
                  label="Live Workload"
                  column="workload"
                  sort={tableSort.sort}
                  onSort={tableSort.handleSort}
                  defaultDir="desc"
                  className="py-3 px-4 whitespace-nowrap"
                />
                <SortableTableHeader
                  label="Rate Access"
                  column="rateMasked"
                  sort={tableSort.sort}
                  onSort={tableSort.handleSort}
                  defaultDir="asc"
                  className="py-3 px-4 whitespace-nowrap"
                />
                <SortableTableHeader
                  label="Status"
                  column="status"
                  sort={tableSort.sort}
                  onSort={tableSort.handleSort}
                  defaultDir="asc"
                  className="py-3 px-4 whitespace-nowrap"
                />
                <th className="py-3 px-5 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-xs text-slate-400">
                    {search.trim() || roleFilter !== 'All' || statusFilter !== 'All' ? (
                      <>
                        No team members match the current filters.{' '}
                        <button
                          type="button"
                          onClick={() => {
                            setSearch('');
                            setRoleFilter('All');
                            setStatusFilter('All');
                          }}
                          className="font-semibold text-brand-600 hover:text-brand-700 hover:underline cursor-pointer"
                        >
                          Clear Filters
                        </button>
                      </>
                    ) : (
                      <>
                        No team members found. Click{' '}
                        <button
                          type="button"
                          onClick={() => setShowInviteModal(true)}
                          className="font-semibold text-brand-600 hover:text-brand-700 hover:underline cursor-pointer"
                        >
                          Invite Team Member
                        </button>{' '}
                        to add one.
                      </>
                    )}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const initials = u.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2);

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Member Name & Email */}
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200/90 text-slate-700 flex items-center justify-center font-semibold text-xs flex-shrink-0">
                            {initials}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 flex items-center gap-1.5 flex-wrap">
                              <span>{u.name}</span>
                              {u.isSuperAdmin && (
                                <span
                                  title="Protected Workspace Super Admin"
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded bg-white border border-amber-300 text-amber-700"
                                >
                                  <ShieldCheck className="w-3 h-3 text-amber-600" />
                                  <span>Super Admin</span>
                                </span>
                              )}
                              {u.isCurrentUser && (
                                <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-white border border-slate-200/90 text-slate-600">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500">{u.email}</div>
                          </div>
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-medium ${getRoleBadgeClass(
                            u.role
                          )}`}
                        >
                          {u.role}
                        </span>
                      </td>

                      {/* Desk */}
                      <td className="py-3 px-4 text-slate-700">{u.desk}</td>

                      {/* Live Workload */}
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-white border border-slate-200/90 text-[11px] font-medium text-slate-700 whitespace-nowrap">
                          {u.workload || '0 Reqs • 0 Subs • 0 Placements'}
                        </span>
                      </td>

                      {/* Rate Access Toggle */}
                      <td className="py-3 px-4">
                        <button
                          onClick={() => onToggleRateMask(u)}
                          title={u.rateMasked ? 'Click to reveal rates' : 'Click to mask rates'}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-medium transition-colors cursor-pointer ${
                            u.rateMasked
                              ? 'bg-slate-100 text-slate-600 border-slate-200/90 hover:bg-slate-200/70'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {u.rateMasked ? (
                            <>
                              <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                              <span>Masked</span>
                            </>
                          ) : (
                            <>
                              <Eye className="w-3.5 h-3.5 text-brand-600" />
                              <span>Visible</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <StatusBadge
                          label={u.status}
                          tone={
                            u.status === 'Active'
                              ? 'emerald'
                              : u.status === 'Invited'
                              ? 'amber'
                              : 'rose'
                          }
                        />
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {u.status === 'Invited' && onResendInvite && (
                            <button
                              type="button"
                              disabled={resendingUserId === u.id}
                              onClick={async () => {
                                if (resendingUserId) return;
                                setResendingUserId(u.id);
                                try {
                                  await onResendInvite(u);
                                } finally {
                                  setResendingUserId(null);
                                }
                              }}
                              title="Resend invitation link"
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-200 bg-white hover:bg-brand-50 hover:border-brand-200 text-slate-600 hover:text-brand-700 text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {resendingUserId === u.id ? (
                                <Loader2 className="w-3 h-3 animate-spin text-brand-600" />
                              ) : (
                                <Send className="w-3 h-3" />
                              )}
                              <span>{resendingUserId === u.id ? 'Sending...' : 'Resend'}</span>
                            </button>
                          )}
                          {onUpdateUser && (!u.isSuperAdmin || u.isCurrentUser) && (
                            <button
                              onClick={() => setEditingUser({ ...u })}
                              title="Edit member"
                              className="p-1.5 rounded-md text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={Boolean(u.isSuperAdmin)}
                            onClick={() => {
                              if (u.isSuperAdmin) {
                                showToast(
                                  'Protected Account',
                                  'The Super Admin account cannot be suspended.',
                                  'warning'
                                );
                                return;
                              }
                              if (onToggleUserStatus) {
                                onToggleUserStatus(u);
                              } else {
                                showToast('Status Updated', `${u.name} status toggled.`);
                              }
                            }}
                            title={
                              u.isSuperAdmin
                                ? 'Super Admin cannot be suspended'
                                : u.status === 'Active'
                                  ? 'Suspend member'
                                  : 'Activate member'
                            }
                            className={`p-1.5 rounded-md transition-colors ${
                              u.isSuperAdmin
                                ? 'text-slate-300 cursor-not-allowed'
                                : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer'
                            }`}
                          >
                            {u.status === 'Active' ? (
                              <Pause className="w-3.5 h-3.5" />
                            ) : (
                              <Play className="w-3.5 h-3.5 text-emerald-600" />
                            )}
                          </button>
                          <button
                            type="button"
                            disabled={Boolean(u.isSuperAdmin)}
                            onClick={() => {
                              if (u.isSuperAdmin) {
                                showToast(
                                  'Protected Account',
                                  'The Super Admin account cannot be deleted.',
                                  'warning'
                                );
                                return;
                              }
                              setUserToDelete(u);
                            }}
                            title={
                              u.isSuperAdmin
                                ? 'Super Admin cannot be deleted'
                                : 'Remove member'
                            }
                            className={`p-1.5 rounded-md transition-colors ${
                              u.isSuperAdmin
                                ? 'text-slate-300 cursor-not-allowed'
                                : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer'
                            }`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <TablePagination
          page={page}
          limit={limit}
          total={totalUsers}
          onPageChange={setPage}
          onLimitChange={(nextLimit) => {
            setLimit(nextLimit);
            setPage(1);
          }}
          itemLabel="members"
          isLoading={isLoadingUsers}
        />
      </div>

      {/* Delete Member Confirmation Modal */}
      <AnimatedModal
        isOpen={Boolean(userToDelete)}
        onBackdropClick={() => !isDeleting && setUserToDelete(null)}
        zIndexClass="z-50"
        backdropClassName="bg-slate-900/55 backdrop-blur-[2px] flex items-center justify-center p-4"
        panelClassName="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-sm p-6 space-y-4"
        ariaLabel="Remove Team Member"
      >
        {userToDelete && (
          <>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Remove Team Member?</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Are you sure you want to remove <span className="font-semibold text-slate-800">{userToDelete.name}</span> ({userToDelete.email}) from your workspace?
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setUserToDelete(null)}
                className="h-8 px-3.5 bg-white border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <ActionButton
                type="button"
                loading={isDeleting}
                loadingText="Removing..."
                onClick={async () => {
                  if (isDeleting) return;
                  setIsDeleting(true);
                  try {
                    if (onDeleteUser) await onDeleteUser(userToDelete);
                    setUserToDelete(null);
                  } catch {
                    setUserToDelete(null);
                  } finally {
                    setIsDeleting(false);
                  }
                }}
                className="h-8 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
              >
                Remove Member
              </ActionButton>
            </div>
          </>
        )}
      </AnimatedModal>

      {/* Invite Member Modal */}
      <AnimatedModal
        isOpen={showInviteModal}
        onBackdropClick={() => setShowInviteModal(false)}
        zIndexClass="z-50"
        backdropClassName="bg-slate-900/55 backdrop-blur-[2px] flex items-center justify-center p-4"
        panelClassName="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden"
        ariaLabel="Invite Team Member"
      >
            <div className="px-6 py-4 border-b border-slate-100 bg-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Invite Team Member</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Grant workspace access and assign a desk</p>
              </div>
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                aria-label="Close modal"
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form noValidate onSubmit={handleInviteSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-semibold text-slate-700">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  {isInviteNameInvalid && <span className="text-[11px] font-semibold text-rose-600">Required</span>}
                </div>
                <input
                  type="text"
                  placeholder="e.g. Rachel Adams"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg text-xs focus:outline-none ${
                    isInviteNameInvalid ? INVALID_FIELD_CLASSES : 'border-slate-200 bg-white focus:border-brand-600'
                  }`}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-semibold text-slate-700">
                    Corporate Email <span className="text-rose-500">*</span>
                  </label>
                  {isInviteEmailInvalid && <span className="text-[11px] font-semibold text-rose-600">Required</span>}
                </div>
                <input
                  type="email"
                  placeholder="e.g. r.adams@squadpipe.com"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg text-xs focus:outline-none ${
                    isInviteEmailInvalid ? INVALID_FIELD_CLASSES : 'border-slate-200 bg-white focus:border-brand-600'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Role</label>
                  <CustomSelect
                    value={newUser.role}
                    onChange={(val) => setNewUser({ ...newUser, role: val })}
                    ariaLabel="Role"
                    options={[
                      'Administrator',
                      'Senior Recruiter',
                      'Technical Recruiter',
                      'Bench Sales Lead',
                      'Account Executive',
                      'Associate Recruiter',
                    ]}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Desk</label>
                  <CustomSelect
                    value={newUser.desk}
                    onChange={(val) => setNewUser({ ...newUser, desk: val })}
                    ariaLabel="Desk"
                    options={[
                      'Executive Operations & Billing',
                      'US IT Contract (C2C & W2)',
                      'Cloud & DevOps Practice',
                      'Data & AI Practice',
                      'Candidate Bench Marketing',
                    ]}
                  />
                </div>
              </div>

              <label className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between cursor-pointer">
                <div>
                  <div className="font-semibold text-slate-800 text-xs">Mask Billing Rates</div>
                  <div className="text-[11px] text-slate-500">Hide hourly bill/pay margins from this member</div>
                </div>
                <input
                  type="checkbox"
                  checked={newUser.rateMasked}
                  onChange={(e) => setNewUser({ ...newUser, rateMasked: e.target.checked })}
                  className="w-4 h-4 text-brand-600 rounded border-slate-300 cursor-pointer"
                />
              </label>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={isInviting}
                  onClick={() => setShowInviteModal(false)}
                  className="h-8 px-3.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-60 font-semibold rounded-lg text-[11px] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <ActionButton
                  type="submit"
                  loading={isInviting}
                  loadingText="Sending Invitation..."
                  className="h-8 px-4 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg text-[11px] transition-colors cursor-pointer"
                >
                  Send Invitation
                </ActionButton>
              </div>
            </form>
      </AnimatedModal>

      {/* Edit Team Member Modal */}
      <AnimatedModal
        isOpen={Boolean(editingUser)}
        onBackdropClick={() => !isUpdating && setEditingUser(null)}
        zIndexClass="z-50"
        backdropClassName="bg-slate-900/55 backdrop-blur-[2px] flex items-center justify-center p-4"
        panelClassName="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden"
        ariaLabel="Edit Team Member"
      >
        {editingUser && (
          <>
            <div className="px-6 py-4 border-b border-slate-100 bg-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Edit Team Member</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">{editingUser.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                aria-label="Close modal"
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              noValidate
              onSubmit={async (e) => {
                e.preventDefault();
                if (isUpdating) return;
                const missingFields = getMissingFieldLabels([
                  { label: 'Full Name', valid: Boolean(editingUser.name.trim()) },
                  { label: 'Email', valid: Boolean(editingUser.email.trim()) },
                ]);
                if (missingFields.length > 0) {
                  setEditValidationAttempted(true);
                  showToast('Validation Error', formatMissingFieldsMessage(missingFields), 'error');
                  return;
                }
                setEditValidationAttempted(false);
                setIsUpdating(true);
                try {
                  if (onUpdateUser) await onUpdateUser(editingUser);
                  setEditingUser(null);
                } catch {
                  // Error toast is already displayed by parent handler; keep modal open
                } finally {
                  setIsUpdating(false);
                }
              }}
              className="p-6 space-y-4 text-xs"
            >
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-semibold text-slate-700">Full Name *</label>
                  {isEditNameInvalid && <span className="text-[11px] font-semibold text-rose-600">Required</span>}
                </div>
                <input
                  type="text"
                  value={editingUser.name}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg text-xs focus:outline-none ${
                    isEditNameInvalid ? INVALID_FIELD_CLASSES : 'border-slate-200 focus:border-brand-600'
                  }`}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-semibold text-slate-700">Email *</label>
                  {isEditEmailInvalid && <span className="text-[11px] font-semibold text-rose-600">Required</span>}
                </div>
                <input
                  type="email"
                  value={editingUser.email}
                  onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg text-xs focus:outline-none ${
                    isEditEmailInvalid ? INVALID_FIELD_CLASSES : 'border-slate-200 focus:border-brand-600'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Role {editingUser.isSuperAdmin ? '(Protected)' : ''}
                  </label>
                  <CustomSelect
                    value={editingUser.role}
                    disabled={Boolean(editingUser.isSuperAdmin)}
                    onChange={(val) => setEditingUser({ ...editingUser, role: val })}
                    ariaLabel="Role"
                    options={[
                      'Administrator',
                      'Senior Recruiter',
                      'Technical Recruiter',
                      'Bench Sales Lead',
                      'Account Executive',
                      'Associate Recruiter',
                    ]}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Status {editingUser.isSuperAdmin ? '(Protected)' : ''}
                  </label>
                  <CustomSelect
                    value={editingUser.status}
                    disabled={Boolean(editingUser.isSuperAdmin)}
                    onChange={(val) =>
                      setEditingUser({
                        ...editingUser,
                        status: val as User['status'],
                      })
                    }
                    ariaLabel="Status"
                    options={['Active', 'Invited', 'Suspended']}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Desk</label>
                <CustomSelect
                  value={editingUser.desk}
                  onChange={(val) => setEditingUser({ ...editingUser, desk: val })}
                  ariaLabel="Desk"
                  options={[
                    'Executive Operations & Billing',
                    'US IT Contract (C2C & W2)',
                    'Cloud & DevOps Practice',
                    'Data & AI Practice',
                    'Candidate Bench Marketing',
                  ]}
                />
              </div>

              <label className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between cursor-pointer">
                <div>
                  <div className="font-semibold text-slate-800 text-xs">Mask Billing Rates</div>
                  <div className="text-[11px] text-slate-500">Hide hourly bill/pay margins from this member</div>
                </div>
                <input
                  type="checkbox"
                  checked={editingUser.rateMasked}
                  onChange={(e) => setEditingUser({ ...editingUser, rateMasked: e.target.checked })}
                  className="w-4 h-4 text-brand-600 rounded border-slate-300 cursor-pointer"
                />
              </label>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={() => setEditingUser(null)}
                  className="h-8 px-3.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-60 font-semibold rounded-lg text-[11px] cursor-pointer"
                >
                  Cancel
                </button>
                <ActionButton
                  type="submit"
                  loading={isUpdating}
                  loadingText="Saving..."
                  className="h-8 px-4 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg text-[11px] cursor-pointer"
                >
                  Save Changes
                </ActionButton>
              </div>
            </form>
          </>
        )}
      </AnimatedModal>
    </section>
  );
};
