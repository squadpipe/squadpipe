import React from 'react';
import { LogOut } from 'lucide-react';
import { User } from '../../types';
import { AnimatedModal } from '../shared/MotionPrimitives';

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
  return (
    <AnimatedModal
      isOpen={Boolean(isOpen && currentUser)}
      onBackdropClick={onClose}
      zIndexClass="z-50"
      backdropClassName="bg-slate-900/60 backdrop-blur-[2px] flex items-center justify-center p-4 select-none"
      panelClassName="bg-white rounded-xl shadow-2xl max-w-sm w-full border border-slate-200 overflow-hidden flex flex-col"
      ariaLabel="Sign Out Confirmation"
    >
      {currentUser && (
        <>
        <div className="p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center mx-auto">
            <LogOut className="w-5 h-5" />
          </div>

          <div>
            <h3 className="text-base font-bold text-slate-900">Sign Out of SquadPipe?</h3>
            <p className="text-xs text-slate-500 mt-1">
              You will be signed out of your current session as <strong>{currentUser.name}</strong>.
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-left text-xs space-y-1">
            <div className="text-[11px] text-slate-400 uppercase font-bold tracking-wider">
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
            className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Yes, Sign Out</span>
          </button>
        </div>
        </>
      )}
    </AnimatedModal>
  );
};

