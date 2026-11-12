import React, { useState } from 'react';
import { User } from '../../types';

interface UserManagementViewProps {
  users: User[];
  onToggleRateMask: (user: User) => void;
  onInviteUser: (user: Partial<User>) => void;
  showToast: (title: string, message: string, icon?: string) => void;
}

export const UserManagementView: React.FC<UserManagementViewProps> = ({
  users,
  onToggleRateMask,
  onInviteUser,
  showToast,
}) => {
  const [search, setSearch] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    role: 'Technical Recruiter',
    desk: 'US IT Contract (C2C & W2)',
    rateMasked: true,
  });

  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.desk.toLowerCase().includes(search.toLowerCase())
  );

  const handleInvite = () => {
    if (!newUser.name || !newUser.email) {
      showToast('Validation Error', 'Full Name and Email are required.');
      return;
    }
    onInviteUser(newUser);
    setShowInviteModal(false);
    showToast('Member Provisioned', `${newUser.name} added as ${newUser.role}!`, 'fa-solid fa-circle-check text-emerald-400');
  };

  return (
    <div className="space-y-4">
      {/* Subheader */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 card-shadow">
        <div className="relative">
          <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search team members by name, desk..."
            className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs w-64 text-slate-700"
          />
        </div>

        <button
          onClick={() => setShowInviteModal(true)}
          className="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm shadow-brand-600/20 transition-all"
        >
          <i className="fa-solid fa-user-plus text-xs"></i>
          <span>Invite Team Member</span>
        </button>
      </div>

      {/* Users Roster Table */}
      <div className="bg-white rounded-xl border border-slate-200 card-shadow overflow-hidden">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-200">
              <th className="py-2.5 px-4">Member Name & Email</th>
              <th className="py-2.5 px-4">Role Permission</th>
              <th className="py-2.5 px-4">Assigned Desk</th>
              <th className="py-2.5 px-4">Billing Rate Clearance</th>
              <th className="py-2.5 px-4">Workload Status</th>
              <th className="py-2.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((user) => (
              <tr key={user.id} className="hover:bg-slate-50/60 transition-colors">
                <td className="py-3 px-4">
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    {user.name}
                    {user.isCurrentUser && (
                      <span className="text-[9px] bg-brand-100 text-brand-700 font-semibold px-1.5 py-0.2 rounded">
                        You
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">{user.email}</div>
                </td>
                <td className="py-3 px-4">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                      user.role === 'Administrator'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : user.role === 'Senior Recruiter'
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : user.role === 'Bench Sales Lead'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-purple-50 text-purple-700 border-purple-200'
                    }`}
                  >
                    {user.role}
                  </span>
                </td>
                <td className="py-3 px-4 text-slate-700 font-medium">{user.desk}</td>
                <td className="py-3 px-4">
                  <button
                    onClick={() => onToggleRateMask(user)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border flex items-center gap-1.5 transition-colors ${
                      user.rateMasked
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}
                  >
                    <i className={user.rateMasked ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'}></i>
                    <span>{user.rateMasked ? 'Masked (••••)' : 'Visible'}</span>
                  </button>
                </td>
                <td className="py-3 px-4 text-[11px] text-slate-500 font-mono">{user.workload}</td>
                <td className="py-3 px-4 text-right">
                  <span className="text-[10px] font-semibold text-slate-400">{user.lastActive}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-slate-200 card-shadow space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-sm text-slate-900">Invite Team Member</h3>
              <button onClick={() => setShowInviteModal(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Full Name *</label>
                <input
                  type="text"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Corporate Email *</label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Permission Role</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                >
                  <option value="Administrator">Administrator</option>
                  <option value="Senior Recruiter">Senior Recruiter</option>
                  <option value="Technical Recruiter">Technical Recruiter</option>
                  <option value="Bench Sales Lead">Bench Sales Lead</option>
                  <option value="Account Executive">Account Executive</option>
                  <option value="Associate Recruiter">Associate Recruiter</option>
                </select>
              </div>
            </div>
            <div className="pt-3 border-t flex justify-end gap-2">
              <button
                onClick={() => setShowInviteModal(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleInvite}
                className="px-4 py-1.5 text-xs font-semibold bg-brand-600 text-white rounded-lg"
              >
                Send Invite
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
