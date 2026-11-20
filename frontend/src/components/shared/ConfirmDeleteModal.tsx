import React, { useState } from 'react';
import { AlertTriangle, ArrowRight, ShieldAlert, Trash2 } from 'lucide-react';
import { ActionButton } from './ActionButton';
import { AnimatedModal } from './MotionPrimitives';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: React.ReactNode;
  warningText?: string;
  confirmLabel?: string;
  loadingText?: string;
  blockedMessage?: React.ReactNode;
  blockedActionLabel?: string;
  onBlockedAction?: () => void;
  onConfirm?: () => Promise<void> | void;
}

/**
 * Reusable confirmation popup dialog for destructive delete or detach actions.
 */
export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  warningText = 'This action cannot be undone.',
  confirmLabel = 'Confirm Delete',
  loadingText = 'Deleting...',
  blockedMessage,
  blockedActionLabel,
  onBlockedAction,
  onConfirm,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const isBlocked = Boolean(blockedMessage);

  const handleConfirm = async () => {
    if (isDeleting || isBlocked || !onConfirm) return;
    setIsDeleting(true);
    try {
      await onConfirm();
      onClose();
    } catch {
      onClose();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AnimatedModal
      isOpen={isOpen}
      onBackdropClick={() => !isDeleting && onClose()}
      zIndexClass="z-50"
      panelClassName="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden"
      ariaLabel={title}
    >
      <div className="p-6 space-y-4">
        <div className="flex items-start gap-3.5">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border ${
              isBlocked
                ? 'bg-amber-50 text-amber-600 border-amber-200'
                : 'bg-rose-50 text-rose-600 border-rose-200'
            }`}
          >
            {isBlocked ? (
              <ShieldAlert className="w-5 h-5" />
            ) : (
              <AlertTriangle className="w-5 h-5" />
            )}
          </div>
          <div className="space-y-1.5 min-w-0">
            <h3 className="text-sm font-bold text-slate-900">{title}</h3>
            {isBlocked ? (
              <p className="text-xs text-slate-600 leading-relaxed">{blockedMessage}</p>
            ) : (
              <>
                <p className="text-xs text-slate-500 leading-relaxed">{description}</p>
                {warningText && (
                  <p className="text-[11px] text-rose-600 font-medium pt-0.5">{warningText}</p>
                )}
              </>
            )}
          </div>
        </div>

        <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
          >
            {isBlocked ? 'Close' : 'Cancel'}
          </button>

          {isBlocked ? (
            blockedActionLabel &&
            onBlockedAction && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onBlockedAction();
                }}
                className="px-4 py-2 text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1.5"
              >
                <span>{blockedActionLabel}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )
          ) : (
            <ActionButton
              type="button"
              loading={isDeleting}
              loadingText={loadingText}
              icon={<Trash2 className="w-3.5 h-3.5" />}
              onClick={handleConfirm}
              className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors cursor-pointer"
            >
              {confirmLabel}
            </ActionButton>
          )}
        </div>
      </div>
    </AnimatedModal>
  );
};
