import React from 'react';
import { User } from '../../types';

interface SignOutModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onConfirm: () => void;
}

export const SignOutModal: React.FC<SignOutModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onConfirm,
}) => {
  if (!isOpen || !currentUser) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl max-w-sm w-full border border-slate-200 overflow-hidden flex flex-col"
      >
        <div className="p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center text-lg mx-auto shadow-xs">
            <i className="fa-solid fa-arrow-right-from-bracket"></i>
          </div>

          <div>
            <h3 className="text-base font-bold text-slate-900">Sign Out of TalentOS?</h3>
            <p className="text-xs text-slate-500 mt-1">
              You will be signed out of your current session as <strong>{currentUser.name}</strong>.
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-left text-xs space-y-1">
            <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
              Active Account
            </div>
            <div className="font-semibold text-slate-800">{currentUser.name}</div>
            <div className="text-[11px] text-slate-500">
              {currentUser.email} &bull; {currentUser.role}
            </div>
          </div>
        </div>

        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
          >
            <i className="fa-solid fa-arrow-right-from-bracket text-[10px]"></i>
            <span>Yes, Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};

