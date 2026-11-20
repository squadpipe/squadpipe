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
          <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 border border-rose-200/80 flex items-center justify-center mx-auto">
            <LogOut className="w-4 h-4" />
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-900">Sign Out of SquadPipe?</h3>
            <p className="text-xs text-slate-500 mt-1">
              You will be signed out of your current session as <strong>{currentUser.name}</strong>.
            </p>
          </div>

          <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-200/90 text-left text-xs space-y-1">
            <div className="text-[11px] text-slate-400 uppercase font-semibold tracking-wider">
              Active Account
            </div>
            <div className="font-semibold text-slate-800">{currentUser.name}</div>
            <div className="text-[11px] text-slate-500">
              {currentUser.email} &bull; {currentUser.role}
            </div>
          </div>
        </div>

        <div className="px-6 py-3.5 bg-slate-50/60 border-t border-slate-100 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="h-8 px-3.5 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-semibold transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="h-8 px-4 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
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

