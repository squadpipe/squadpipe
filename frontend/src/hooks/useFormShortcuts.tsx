import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Warning } from '@phosphor-icons/react';
import { AnimatedModal } from '../components/shared/MotionPrimitives';

interface UseFormShortcutsOptions {
  /** Tracks whether the current draft differs from its saved baseline. */
  isDirty: boolean;
  /** Disables submit shortcuts while a save request is already running. */
  isSubmitting?: boolean;
  /** Called on Cmd+S / Ctrl+S or Cmd+Enter / Ctrl+Enter. */
  onSubmit?: () => void;
}

/**
 * Adds Cmd+S / Cmd+Enter submit shortcuts plus browser & in-app dirty-leave protection
 * for dedicated full-page creation and edit workflows.
 */
export function useFormShortcuts({
  isDirty,
  isSubmitting = false,
  onSubmit,
}: UseFormShortcutsOptions) {
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const pendingActionRef = useRef<(() => void) | null>(null);
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const key = e.key.toLowerCase();
      if (key === 's' || e.key === 'Enter') {
        if (!onSubmitRef.current || isSubmitting) return;
        e.preventDefault();
        onSubmitRef.current();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSubmitting]);

  useEffect(() => {
    if (!isDirty || isSubmitting) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty, isSubmitting]);

  const guardNavigation = useCallback(
    (proceed: () => void) => {
      if (!isDirty || isSubmitting) {
        proceed();
        return;
      }
      pendingActionRef.current = proceed;
      setShowLeaveModal(true);
    },
    [isDirty, isSubmitting]
  );

  const confirmLeave = useCallback(() => {
    setShowLeaveModal(false);
    const next = pendingActionRef.current;
    pendingActionRef.current = null;
    next?.();
  }, []);

  const cancelLeave = useCallback(() => {
    setShowLeaveModal(false);
    pendingActionRef.current = null;
  }, []);

  return {
    showLeaveModal,
    guardNavigation,
    confirmLeave,
    cancelLeave,
  };
}

interface UnsavedChangesModalProps {
  isOpen: boolean;
  onConfirmLeave: () => void;
  onCancelLeave: () => void;
  title?: string;
  description?: string;
}

export const UnsavedChangesModal: React.FC<UnsavedChangesModalProps> = ({
  isOpen,
  onConfirmLeave,
  onCancelLeave,
  title = 'Discard unsaved changes?',
  description = 'You have unsaved edits on this form. Leaving now will discard changes you made since the last save.',
}) => (
  <AnimatedModal
    isOpen={isOpen}
    onBackdropClick={onCancelLeave}
    zIndexClass="z-[80]"
    panelClassName="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden"
    ariaLabel={title}
  >
    <div className="p-5 flex items-start gap-3.5">
      <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-200/80 text-amber-600 flex items-center justify-center shrink-0">
        <Warning className="w-4 h-4" weight="duotone" />
      </div>
      <div className="min-w-0 space-y-1">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <p className="text-xs text-slate-500 leading-relaxed">{description}</p>
      </div>
    </div>
    <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2 text-xs">
      <button
        type="button"
        onClick={onCancelLeave}
        className="px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer"
      >
        Keep Editing
      </button>
      <button
        type="button"
        onClick={onConfirmLeave}
        className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold cursor-pointer"
      >
        Discard Changes
      </button>
    </div>
  </AnimatedModal>
);
