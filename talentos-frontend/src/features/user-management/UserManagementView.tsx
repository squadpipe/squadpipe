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
} from 'lucide-react';
import { apiClient } from '../../config/api.config';
import { User } from '../../types';
import { TablePagination } from '../../components/shared/TablePagination';
import { useDebounce } from '../../utils/useDebounce';
import { mapUserFromApi } from '../../utils/entityMappers';
import { getWorkspaceBrandSlug } from '../../utils/workspaceBrand';

interface UserManagementViewProps {
  users: User[];
  onToggleRateMask: (user: User) => Promise<void> | void;
  onInviteUser: (user: Partial<User>) => Promise<void> | void;
  onUpdateUser?: (user: User) => Promise<void> | void;
  onToggleUserStatus?: (user: User) => Promise<void> | void;
  onDeleteUser?: (user: User) => Promise<void> | void;
  showToast: (title: string, message: string, icon?: string) => void;
}

export const UserManagementView: React.FC<UserManagementViewProps> = ({
  users,
  onToggleRateMask,
  onInviteUser,
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
  const [tableUsers, setTableUsers] = useState<User[]>(() => users.slice(0, 10));
  const [totalUsers, setTotalUsers] = useState(users.length);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  const debouncedSearch = useDebounce(search, 150);
  const currentUserEmail = users.find((u) => u.isCurrentUser)?.email;

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, roleFilter, statusFilter]);

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

    if (users.length > 0) {
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
        setTotalUsers(localFiltered.length);
        setTableUsers(localFiltered.slice((page - 1) * limit, page * limit));
      })
      .finally(() => {
        if (active) setIsLoadingUsers(false);
      });
    return () => {
      active = false;
    };
  }, [debouncedSearch, roleFilter, statusFilter, page, limit, users, currentUserEmail]);
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
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Senior Recruiter':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Technical Recruiter':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'Bench Sales Lead':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Account Executive':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const filteredUsers = tableUsers;

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.name.trim() || !newUser.email.trim()) {
      showToast('Validation Error', 'Full Name and Email are required.', 'fa-solid fa-circle-exclamation text-rose-500');
      return;
    }
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
    <section className="max-w-7xl mx-auto space-y-5 animate-fade-in select-none">
      {/* Clean Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Team Members</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage team roles, assigned desks, and rate visibility.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={exportTeamCsv}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => setShowInviteModal(true)}
            className="px-3.5 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Invite Member</span>
          </button>
        </div>
      </div>

      {/* Main Table Card with Consolidated Filter Subheader */}
      <div className="bg-white rounded-xl border border-slate-200 card-shadow overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, email, or desk..."
                className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:border-brand-600 focus:outline-none transition-colors"
              />
            </div>

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-xs font-medium text-slate-700 focus:border-brand-600 focus:outline-none cursor-pointer"
            >
              <option value="All">All Roles</option>
              <option value="Administrator">Administrator</option>
              <option value="Senior Recruiter">Senior Recruiter</option>
              <option value="Technical Recruiter">Technical Recruiter</option>
              <option value="Bench Sales Lead">Bench Sales Lead</option>
              <option value="Account Executive">Account Executive</option>
              <option value="Associate Recruiter">Associate Recruiter</option>
            </select>

            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              {(['All', 'Active', 'Invited', 'Suspended'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                    statusFilter === st
                      ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div className="text-[11px] text-slate-500">
            <span className="font-semibold text-slate-800">{totalUsers}</span> of {users.length} members
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-5">Member</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Desk</th>
                <th className="py-3 px-4">Rate Access</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-xs text-slate-400">
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
                          <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-semibold text-xs flex-shrink-0">
                            {initials}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                              <span>{u.name}</span>
                              {u.isCurrentUser && (
                                <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-brand-50 text-brand-700 border border-brand-200">
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
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-md border text-[11px] font-medium ${getRoleBadgeClass(
                            u.role
                          )}`}
                        >
                          {u.role}
                        </span>
                      </td>

                      {/* Desk */}
                      <td className="py-3 px-4 text-slate-700">{u.desk}</td>

                      {/* Rate Access Toggle */}
                      <td className="py-3 px-4">
                        <button
                          onClick={() => onToggleRateMask(u)}
                          title={u.rateMasked ? 'Click to reveal rates' : 'Click to mask rates'}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-medium transition-colors cursor-pointer ${
                            u.rateMasked
                              ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100/70'
                              : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100/70'
                          }`}
                        >
                          {u.rateMasked ? (
                            <>
                              <EyeOff className="w-3 h-3" />
                              <span>Masked</span>
                            </>
                          ) : (
                            <>
                              <Eye className="w-3 h-3" />
                              <span>Visible</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        {u.status === 'Active' ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            <span>Active</span>
                          </span>
                        ) : u.status === 'Invited' ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                            <span>Invited</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                            <span>Suspended</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {onUpdateUser && (
                            <button
                              onClick={() => setEditingUser({ ...u })}
                              title="Edit member"
                              className="p-1.5 rounded-md text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => {
                              if (onToggleUserStatus) {
                                onToggleUserStatus(u);
                              } else {
                                showToast('Status Updated', `${u.name} status toggled.`);
                              }
                            }}
                            title={u.status === 'Active' ? 'Suspend member' : 'Activate member'}
                            className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                          >
                            {u.status === 'Active' ? (
                              <Pause className="w-3.5 h-3.5" />
                            ) : (
                              <Play className="w-3.5 h-3.5 text-emerald-600" />
                            )}
                          </button>
                          <button
                            onClick={() => setUserToDelete(u)}
                            title="Remove member"
                            className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
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
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-sm p-6 space-y-4 animate-scale-up">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Remove Team Member?</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Are you sure you want to remove <span className="font-semibold text-slate-800">{userToDelete.name}</span> ({userToDelete.email}) from your workspace?
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="px-3.5 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    if (onDeleteUser) await onDeleteUser(userToDelete);
                    setUserToDelete(null);
                  } catch {
                    setUserToDelete(null);
                  }
                }}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                Remove Member
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-scale-up">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Invite Team Member</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Grant workspace access and assign a desk</p>
              </div>
              <button
                onClick={() => setShowInviteModal(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleInviteSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rachel Adams"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:border-brand-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Corporate Email <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. r.adams@squadpipe.com"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:border-brand-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Role</label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:border-brand-600 focus:outline-none cursor-pointer"
                  >
                    <option value="Administrator">Administrator</option>
                    <option value="Senior Recruiter">Senior Recruiter</option>
                    <option value="Technical Recruiter">Technical Recruiter</option>
                    <option value="Bench Sales Lead">Bench Sales Lead</option>
                    <option value="Account Executive">Account Executive</option>
                    <option value="Associate Recruiter">Associate Recruiter</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Desk</label>
                  <select
                    value={newUser.desk}
                    onChange={(e) => setNewUser({ ...newUser, desk: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:border-brand-600 focus:outline-none cursor-pointer"
                  >
                    <option value="Executive Operations & Billing">Executive Operations &amp; Billing</option>
                    <option value="US IT Contract (C2C & W2)">US IT Contract (C2C &amp; W2)</option>
                    <option value="Cloud & DevOps Practice">Cloud &amp; DevOps Practice</option>
                    <option value="Data & AI Practice">Data &amp; AI Practice</option>
                    <option value="Candidate Bench Marketing">Candidate Bench Marketing</option>
                  </select>
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

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-3.5 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium rounded-lg text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg text-xs transition-colors cursor-pointer"
                >
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Team Member Modal */}
      {editingUser && (
        <div
          onClick={() => setEditingUser(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-scale-up"
          >
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Edit Team Member</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">{editingUser.email}</p>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  if (onUpdateUser) await onUpdateUser(editingUser);
                  setEditingUser(null);
                } catch {
                  // Error toast is already displayed by parent handler; keep modal open
                }
              }}
              className="p-6 space-y-4 text-xs"
            >
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={editingUser.name}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={editingUser.email}
                  onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Role</label>
                  <select
                    value={editingUser.role}
                    onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:border-brand-600 focus:outline-none cursor-pointer"
                  >
                    <option value="Administrator">Administrator</option>
                    <option value="Senior Recruiter">Senior Recruiter</option>
                    <option value="Technical Recruiter">Technical Recruiter</option>
                    <option value="Bench Sales Lead">Bench Sales Lead</option>
                    <option value="Account Executive">Account Executive</option>
                    <option value="Associate Recruiter">Associate Recruiter</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={editingUser.status}
                    onChange={(e) =>
                      setEditingUser({
                        ...editingUser,
                        status: e.target.value as User['status'],
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:border-brand-600 focus:outline-none cursor-pointer"
                  >
                    <option value="Active">Active</option>
                    <option value="Invited">Invited</option>
                    <option value="Suspended">Suspended</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Desk</label>
                <select
                  value={editingUser.desk}
                  onChange={(e) => setEditingUser({ ...editingUser, desk: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:border-brand-600 focus:outline-none cursor-pointer"
                >
                  <option value="Executive Operations & Billing">Executive Operations &amp; Billing</option>
                  <option value="US IT Contract (C2C & W2)">US IT Contract (C2C &amp; W2)</option>
                  <option value="Cloud & DevOps Practice">Cloud &amp; DevOps Practice</option>
                  <option value="Data & AI Practice">Data &amp; AI Practice</option>
                  <option value="Candidate Bench Marketing">Candidate Bench Marketing</option>
                </select>
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

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-3.5 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium rounded-lg text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg text-xs cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
