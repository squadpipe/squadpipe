import React, { useState } from 'react';
import { AlertTriangle, Lock, Trash2 } from 'lucide-react';
import { Requirement } from '../../types';
import { AnimatedModal } from './MotionPrimitives';
import { ActionButton } from './ActionButton';
import { StatusBadge } from './StatusBadge';

interface DeleteRequirementModalProps {
  requirement: Requirement | null;
  onClose: () => void;
  onDeleteReq?: (req: Requirement) => Promise<void> | void;
  onViewPlacedConsultants?: (req: Requirement) => void;
}

/**
 * Shared delete-requirement guard modal: blocks deletion while billable consultants
 * are attached and routes directly to the Placed Candidates tab when clicked.
 */
export const DeleteRequirementModal: React.FC<DeleteRequirementModalProps> = ({
  requirement,
  onClose,
  onDeleteReq,
  onViewPlacedConsultants,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const activePlacedCount =
    requirement?.filledPositions ?? requirement?.activePlacements?.length ?? 0;
  const hasBillable = activePlacedCount > 0;
  const activePlacementList = requirement?.activePlacements || [];

  return (
    <AnimatedModal
      isOpen={Boolean(requirement)}
      onBackdropClick={() => {
        if (!isDeleting) onClose();
      }}
      zIndexClass="z-50"
      panelClassName="bg-white rounded-xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden"
      ariaLabel={hasBillable ? 'Protected Active Billable Requirement' : 'Delete Requirement'}
    >
      {requirement && (
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3.5">
            <div
              className={`w-9 h-9 rounded-full border flex items-center justify-center flex-shrink-0 ${
                hasBillable
                  ? 'bg-amber-50 border-amber-200 text-amber-600'
                  : 'bg-rose-50 border-rose-200 text-rose-600'
              }`}
            >
              {hasBillable ? (
                <Lock className="w-4 h-4" />
              ) : (
                <AlertTriangle className="w-4 h-4" />
              )}
            </div>
            <div className="space-y-1.5 min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-slate-900">
                {hasBillable ? 'Protected: Active Billable Requirement' : 'Delete Requirement?'}
              </h3>
              {hasBillable ? (
                <>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    <span className="font-bold text-slate-800">{requirement.code}</span> (
                    {requirement.opportunityTitle}) currently has{' '}
                    <span className="font-bold text-amber-700">
                      {activePlacedCount} active billable consultant
                      {activePlacedCount === 1 ? '' : 's'}
                    </span>
                    . To protect billing records and submission audit history, release all placed
                    consultant(s) before deleting this requirement.
                  </p>
                  {activePlacementList.length > 0 && (
                    <div className="pt-1 flex flex-wrap gap-1.5">
                      {activePlacementList.map((pl) => (
                        <StatusBadge
                          key={pl.id}
                          tone="emerald"
                          size="xs"
                          label={pl.resourceName}
                        />
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Are you sure you want to permanently remove{' '}
                    <span className="font-bold text-slate-800">{requirement.code}</span> —{' '}
                    <span className="font-semibold text-slate-800">
                      {requirement.opportunityTitle}
                    </span>{' '}
                    at{' '}
                    <span className="font-semibold text-slate-800">{requirement.companyName}</span>?
                  </p>
                  <p className="text-[11px] text-rose-600 font-medium pt-0.5">
                    This action cannot be undone and removes linked submission records.
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={isDeleting}
              onClick={onClose}
              className="h-8 px-3.5 text-[11px] font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
            >
              {hasBillable ? 'Close' : 'Cancel'}
            </button>
            {hasBillable && onViewPlacedConsultants ? (
              <button
                type="button"
                onClick={() => {
                  const target = requirement;
                  onClose();
                  onViewPlacedConsultants(target);
                }}
                className="h-8 px-3.5 text-[11px] font-semibold bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors cursor-pointer"
              >
                View Placed Consultants &rarr;
              </button>
            ) : !hasBillable ? (
              <ActionButton
                type="button"
                loading={isDeleting}
                loadingText="Deleting..."
                icon={<Trash2 className="w-3.5 h-3.5" />}
                onClick={async () => {
                  if (isDeleting) return;
                  setIsDeleting(true);
                  try {
                    if (onDeleteReq) await onDeleteReq(requirement);
                    onClose();
                  } catch {
                    onClose();
                  } finally {
                    setIsDeleting(false);
                  }
                }}
                className="h-8 px-4 text-[11px] font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors cursor-pointer"
              >
                Delete Requisition
              </ActionButton>
            ) : null}
          </div>
        </div>
      )}
    </AnimatedModal>
  );
};
