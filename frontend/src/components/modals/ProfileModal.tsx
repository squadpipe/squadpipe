import React, { useState, useEffect } from 'react';
import { LogOut, ShieldCheck, X } from 'lucide-react';
import { User } from '../../types';
import { ActionButton } from '../shared/ActionButton';
import { AnimatedModal } from '../shared/MotionPrimitives';
import { formatMissingFieldsMessage, getMissingFieldLabels } from '../../utils/formValidation';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onUpdateUser: (updated: User) => Promise<void> | void;
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
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setFormData({
        name: currentUser.name || '',
        email: currentUser.email || '',
        role: currentUser.role || '',
        desk: currentUser.desk || '',
      });
    }
    setIsSaving(false);
  }, [currentUser, isOpen]);

  const handleSave = async () => {
    if (isSaving || !currentUser) return;
    const missingFields = getMissingFieldLabels([
      { label: 'Full Name', valid: Boolean(formData.name.trim()) },
      { label: 'Email Address', valid: Boolean(formData.email.trim()) },
    ]);
    if (missingFields.length > 0) {
      showToast('Validation Error', formatMissingFieldsMessage(missingFields), 'error');
      return;
    }
    setIsSaving(true);
    try {
      await onUpdateUser({
        ...currentUser,
        name: formData.name.trim(),
        email: formData.email.trim(),
        desk: formData.desk,
      });
      showToast('Profile Updated', 'Your profile details have been saved.', 'success');
      onClose();
    } catch {
      // Error toast is displayed by parent handler; keep modal open
    } finally {
      setIsSaving(false);
    }
  };

  const initials = (formData.name || 'User')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <AnimatedModal
      isOpen={Boolean(isOpen && currentUser)}
      onBackdropClick={onClose}
      zIndexClass="z-50"
      backdropClassName="bg-slate-900/60 backdrop-blur-[2px] flex items-center justify-center p-4 select-none"
      panelClassName="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden flex flex-col"
      ariaLabel="My Profile"
    >
      {currentUser && (
        <>
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-[#141615] text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white text-xs font-bold">
              {initials}
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">My Profile</h3>
              <span className="text-[11px] text-slate-400">Account details & preferences</span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="text-slate-400 hover:text-white w-7 h-7 rounded flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
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
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-700 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Active Session</span>
              </span>
            </div>
          </div>

          <div>
            <label className="block text-slate-500 font-medium mb-1">Assigned Recruitment Desk</label>
            <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium text-xs">
              {currentUser.desk || 'General Sourcing Desk'}
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <div className="flex items-center justify-between text-xs font-bold text-slate-800">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-brand-600" />
                Rate Masking Status
              </span>
              <span
                className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full font-medium ${
                  currentUser.rateMasked
                    ? 'bg-slate-200/80 text-slate-700'
                    : 'bg-white text-slate-700 border border-slate-200'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    currentUser.rateMasked ? 'bg-slate-500' : 'bg-emerald-500'
                  }`}
                />
                <span>{currentUser.rateMasked ? '•••• Masked' : 'Rates Visible'}</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
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
            className="text-rose-600 hover:text-rose-700 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
          <ActionButton
            type="button"
            loading={isSaving}
            loadingText="Saving..."
            onClick={handleSave}
            className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            Save Changes
          </ActionButton>
        </div>
        </>
      )}
    </AnimatedModal>
  );
};

