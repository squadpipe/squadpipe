import React, { useState, useEffect } from 'react';
import { User } from '../../types';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onUpdateUser: (updated: User) => void;
  onOpenSignOut: () => void;
  showToast: (title: string, message: string, icon?: string) => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUpdateUser,
  onOpenSignOut,
  showToast,
}) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: '',
    desk: '',
  });

  useEffect(() => {
    if (currentUser) {
      setFormData({
        name: currentUser.name || '',
        email: currentUser.email || '',
        role: currentUser.role || '',
        desk: currentUser.desk || '',
      });
    }
  }, [currentUser, isOpen]);

  if (!isOpen || !currentUser) return null;

  const handleSave = () => {
    onUpdateUser({
      ...currentUser,
      name: formData.name,
      email: formData.email,
      desk: formData.desk,
    });
    showToast('Profile Updated', 'Your profile details have been saved.', 'fa-solid fa-circle-check text-emerald-500');
    onClose();
  };

  const initials = (formData.name || 'User')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white text-xs font-bold">
              {initials}
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">My Profile</h3>
              <span className="text-[10px] text-slate-400">Account details & preferences</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white w-7 h-7 rounded flex items-center justify-center text-sm transition-colors"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4 text-xs">
          <div>
            <label className="block text-slate-500 font-medium mb-1">Full Legal Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 font-semibold text-xs focus:border-brand-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-500 font-medium mb-1">Email Address</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 font-semibold text-xs focus:border-brand-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-500 font-medium mb-1">System Role & Clearance</label>
            <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium text-xs flex items-center justify-between">
              <span>{currentUser.role}</span>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Active Session
              </span>
            </div>
          </div>

          <div>
            <label className="block text-slate-500 font-medium mb-1">Assigned Recruitment Desk</label>
            <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium text-xs">
              {currentUser.desk || 'General Sourcing Desk'}
            </div>
          </div>

          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1">
            <div className="flex items-center justify-between text-xs font-bold text-slate-800">
              <span className="flex items-center gap-1.5">
                <i className="fa-solid fa-shield-halved text-amber-600"></i>
                Rate Masking Status
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                currentUser.rateMasked ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
              }`}>
                {currentUser.rateMasked ? '•••• Masked' : 'Rates Visible'}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              {currentUser.rateMasked
                ? 'Sensitive client billing rates and gross margin numbers are hidden from view.'
                : 'Full commercial clearance is active on your profile.'}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={() => {
              onClose();
              onOpenSignOut();
            }}
            className="text-rose-600 hover:text-rose-700 font-semibold text-xs flex items-center gap-1.5 transition-colors"
          >
            <i className="fa-solid fa-arrow-right-from-bracket text-[11px]"></i>
            <span>Sign Out</span>
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-xs transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

