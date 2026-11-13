import React, { useState } from 'react';
import { User } from '../../types';

interface UserManagementViewProps {
  users: User[];
  onToggleRateMask: (user: User) => void;
  onInviteUser: (user: Partial<User>) => void;
  onToggleUserStatus?: (user: User) => void;
  onDeleteUser?: (user: User) => void;
  showToast: (title: string, message: string, icon?: string) => void;
}

export const UserManagementView: React.FC<UserManagementViewProps> = ({
  users,
  onToggleRateMask,
  onInviteUser,
  onToggleUserStatus,
  onDeleteUser,
  showToast,
}) => {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Invited' | 'Suspended'>('All');
  const [showInviteModal, setShowInviteModal] = useState(false);
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

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'Administrator':
        return 'fa-solid fa-user-shield text-emerald-600';
      case 'Senior Recruiter':
        return 'fa-solid fa-headset text-blue-600';
      case 'Technical Recruiter':
        return 'fa-solid fa-code text-indigo-600';
      case 'Bench Sales Lead':
        return 'fa-solid fa-chart-line text-purple-600';
      default:
        return 'fa-solid fa-user text-slate-600';
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.desk.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === 'All' || u.role === roleFilter;
    const matchesStatus = statusFilter === 'All' || u.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const adminsCount = users.filter((u) => u.role === 'Administrator').length;
  const recruiterDesksCount = new Set(users.map((u) => u.desk)).size;
  const maskedCount = users.filter((u) => u.rateMasked).length;

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.name.trim() || !newUser.email.trim()) {
      showToast('Validation Error', 'Full Name and Email are required.');
      return;
    }
    onInviteUser(newUser);
    setShowInviteModal(false);
    showToast(
      'Invitation Sent',
      `Invitation dispatched to ${newUser.email} for role: ${newUser.role}!`,
      'fa-solid fa-paper-plane text-emerald-500'
    );
    setNewUser({
      name: '',
      email: '',
      role: 'Technical Recruiter',
      desk: 'US IT Contract (C2C & W2)',
      rateMasked: true,
    });
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
    a.download = `TalentOS_Team_Roster_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    showToast('Export Generated', 'Team roster exported to CSV successfully.', 'fa-solid fa-file-csv text-emerald-600');
  };

  return (
    <section className="max-w-7xl mx-auto space-y-6 animate-fade-in select-none">
      {/* Page Title & Primary Actions Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center text-xs shadow-xs">
              <i className="fa-solid fa-users-gear text-brand-400"></i>
            </span>
            <span>User Management & Team Permissions</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Manage agency recruiters, account executives, role-based access control (RBAC), and sensitive rate visibility.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={exportTeamCsv}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <i className="fa-solid fa-file-csv text-emerald-600 text-xs"></i>
            <span>Export Team (CSV)</span>
          </button>
          <button
            onClick={() => setShowInviteModal(true)}
            className="px-3.5 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <i className="fa-solid fa-user-plus text-[10px]"></i>
            <span>+ Invite New Member</span>
          </button>
        </div>
      </div>

      {/* 4 KPI Telemetry Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-base flex-shrink-0">
            <i className="fa-solid fa-users"></i>
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Registered Team</div>
            <div className="text-lg font-bold text-slate-900 font-mono">{users.length} Members</div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {users.filter((u) => u.status === 'Active').length} Active SaaS Seats
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-base flex-shrink-0">
            <i className="fa-solid fa-user-shield"></i>
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Administrators</div>
            <div className="text-lg font-bold text-emerald-700 font-mono">{adminsCount} Admins</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Full billing & platform control</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-base flex-shrink-0">
            <i className="fa-solid fa-headset"></i>
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Recruiter Desks</div>
            <div className="text-lg font-bold text-slate-900 font-mono">{recruiterDesksCount} Desks</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Handling candidate pipelines</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-base flex-shrink-0">
            <i className="fa-solid fa-shield-halved"></i>
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Rate Protection</div>
            <div className="text-lg font-bold text-amber-700 font-mono">{maskedCount} Masked</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Sensitive margins hidden</div>
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative w-72">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, or desk..."
              className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:border-brand-600 focus:outline-none transition-colors"
            />
          </div>

          {/* Role Filter Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium text-[11px]">Role:</span>
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
              <option value="Associate Recruiter">Associate Recruiter</option>
            </select>
          </div>

          {/* Status Filter Pills */}
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

        <div className="text-[11px] font-mono text-slate-500 font-medium">
          Showing <span className="font-bold text-slate-800">{filteredUsers.length}</span> of {users.length} Team Members
        </div>
      </div>

      {/* Team Members Table Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider font-mono">
                <th className="py-3 px-4">Member & Email</th>
                <th className="py-3 px-4">Role & Permissions</th>
                <th className="py-3 px-4">Practice / Desk</th>
                <th className="py-3 px-4">Rate & Margin Visibility</th>
                <th className="py-3 px-4">Active Workload</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map((u) => {
                const initials = u.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2);

                return (
                  <tr key={u.id} className="hover:bg-slate-50/80 transition-colors group">
                    {/* Member Name & Contact */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs shadow-2xs flex-shrink-0">
                          {initials}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <span>{u.name}</span>
                            {u.isCurrentUser && (
                              <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-brand-50 text-brand-700 border border-brand-200">
                                You
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">{u.email}</div>
                        </div>
                      </div>
                    </td>

                    {/* Role Badge */}
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-semibold ${getRoleBadgeClass(
                          u.role
                        )}`}
                      >
                        <i className={getRoleIcon(u.role)}></i>
                        <span>{u.role}</span>
                      </span>
                    </td>

                    {/* Desk */}
                    <td className="py-3 px-4">
                      <span className="text-xs text-slate-700 font-medium">{u.desk}</span>
                    </td>

                    {/* Rate Visibility Toggle */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {u.rateMasked ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                            <i className="fa-solid fa-shield-halved text-[9px]"></i>
                            <span>Masked (••••)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <i className="fa-solid fa-eye text-[9px]"></i>
                            <span>Visible</span>
                          </span>
                        )}

                        {/* Inline Toggle Button */}
                        <button
                          onClick={() => onToggleRateMask(u)}
                          title={u.rateMasked ? 'Click to grant full rate visibility' : 'Click to mask sensitive rates'}
                          className="text-[10px] font-semibold text-slate-500 hover:text-slate-900 underline underline-offset-2 ml-1 cursor-pointer"
                        >
                          {u.rateMasked ? 'Reveal' : 'Mask'}
                        </button>
                      </div>
                    </td>

                    {/* Workload */}
                    <td className="py-3 px-4">
                      <span className="text-xs text-slate-600 font-mono">{u.workload || 'Active Operational Desk'}</span>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4">
                      {u.status === 'Active' ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          <span>Active</span>
                        </span>
                      ) : u.status === 'Invited' ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                          <span>Invited</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                          <span>Suspended</span>
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            if (onToggleUserStatus) {
                              onToggleUserStatus(u);
                            } else {
                              showToast('Status Updated', `${u.name} status toggled.`);
                            }
                          }}
                          title={u.status === 'Active' ? 'Click to Suspend Account' : 'Click to Activate Account'}
                          className={`p-1.5 rounded transition-colors cursor-pointer ${
                            u.status === 'Active'
                              ? 'hover:bg-amber-50 text-slate-400 hover:text-amber-600'
                              : 'hover:bg-emerald-50 text-amber-500 hover:text-emerald-600'
                          }`}
                        >
                          <i className={`fa-solid ${u.status === 'Active' ? 'fa-pause' : 'fa-play'} text-xs`}></i>
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Are you sure you want to remove team member ${u.name}?`)) {
                              if (onDeleteUser) onDeleteUser(u);
                            }
                          }}
                          title="Delete Member"
                          className="p-1.5 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                        >
                          <i className="fa-solid fa-trash-can text-xs"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* RBAC Role Matrix Reference Guide */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-3">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
          <i className="fa-solid fa-shield-halved text-brand-600 text-sm"></i>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 font-mono">
            Agency Role-Based Access Control (RBAC) Matrix
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              <i className="fa-solid fa-user-shield text-emerald-600"></i>
              <span>Administrator</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Full authority: User provisioning, financial margins, SLA rule automation, master taxonomy, and database exports.
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              <i className="fa-solid fa-headset text-blue-600"></i>
              <span>Senior Recruiter</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Full pipeline & bench access. Can create requirements, submit candidates, and manage client submissions.
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              <i className="fa-solid fa-code text-indigo-600"></i>
              <span>Technical Recruiter</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Sourcing & technical matching. Client bill rates and financial margins can be masked based on governance clearance.
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              <i className="fa-solid fa-chart-line text-purple-600"></i>
              <span>Bench Sales Lead</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Focuses on candidate marketing, sub-tier vendor partners, and contract extensions for active deployments.
            </p>
          </div>
        </div>
      </div>

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-scale-up">
            <div className="px-6 py-4 bg-[#0B0F17] text-white flex items-center justify-between border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-brand-600 text-white flex items-center justify-center text-sm">
                  <i className="fa-solid fa-user-plus"></i>
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-tight">Invite Agency Team Member</h3>
                  <div className="text-[11px] text-slate-400">Provision SaaS access & assign practice desk</div>
                </div>
              </div>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            </div>

            <form onSubmit={handleInviteSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rachel Adams"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:border-brand-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Corporate Email Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. r.adams@talentos-agency.com"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:border-brand-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Assigned Role</label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:border-brand-600 focus:outline-none cursor-pointer"
                  >
                    <option value="Administrator">Administrator</option>
                    <option value="Senior Recruiter">Senior Recruiter</option>
                    <option value="Technical Recruiter">Technical Recruiter</option>
                    <option value="Bench Sales Lead">Bench Sales Lead</option>
                    <option value="Associate Recruiter">Associate Recruiter</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Assigned Practice / Desk</label>
                  <select
                    value={newUser.desk}
                    onChange={(e) => setNewUser({ ...newUser, desk: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:border-brand-600 focus:outline-none cursor-pointer"
                  >
                    <option value="Executive Operations & Billing">Executive Operations & Billing</option>
                    <option value="US IT Contract (C2C & W2)">US IT Contract (C2C & W2)</option>
                    <option value="Cloud & DevOps Practice">Cloud & DevOps Practice</option>
                    <option value="Data & AI Practice">Data & AI Practice</option>
                    <option value="Candidate Bench Marketing">Candidate Bench Marketing</option>
                  </select>
                </div>
              </div>

              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg flex items-center justify-between">
                <div>
                  <div className="font-bold text-amber-900 text-xs">Mask Billing Rate Margins</div>
                  <div className="text-[10px] text-amber-700">Enforce clearance restriction on hourly spreads</div>
                </div>
                <input
                  type="checkbox"
                  checked={newUser.rateMasked}
                  onChange={(e) => setNewUser({ ...newUser, rateMasked: e.target.checked })}
                  className="w-4 h-4 text-brand-600 rounded cursor-pointer"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-3.5 py-2 border border-slate-200 text-slate-600 hover:bg-slate-100 font-semibold rounded-lg text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg text-xs shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <i className="fa-solid fa-paper-plane text-[10px]"></i>
                  <span>Send Invitation Email</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
