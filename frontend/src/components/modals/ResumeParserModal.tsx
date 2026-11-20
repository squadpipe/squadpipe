import React, { useEffect, useState } from 'react';
import { ExternalLink, FileText, Files } from 'lucide-react';
import { Candidate, Requirement, User } from '../../types';
import { useAiCapabilities } from '../../utils/workspaceBrand';
import { MAX_BULK_CV_FILES } from '../../utils/resumeDraftMapper';
import { BulkResumeQueueController } from '../../hooks/useBulkResumeQueue';
import { AnimatedModal, ModalHeader } from '../shared/MotionPrimitives';
import { AiBadge } from '../shared/AiBrand';
import {
  ResumeApproveOptions,
  ResumeImportWorkspace,
} from '../../features/import-data/ResumeImportWorkspace';

interface ResumeParserModalProps {
  isOpen: boolean;
  onClose: () => void;
  lockedRequirement?: Requirement | null;
  users?: User[];
  bulkQueue: BulkResumeQueueController;
  onApprove: (candidate: Candidate, options?: ResumeApproveOptions) => Promise<void> | void;
  onBulkDone?: (addedCount: number, targetRequirement?: Requirement | null) => void;
  onSwitchToCsvImport?: () => void;
  onOpenFullPage?: () => void;
  showToast: (title: string, message: string, icon?: string) => void;
}

/**
 * Inline Resume Parser popup used inside contextual workflows like Attach Candidates.
 * Closing this modal does not interrupt an active bulk resume batch.
 */
export const ResumeParserModal: React.FC<ResumeParserModalProps> = ({
  isOpen,
  onClose,
  lockedRequirement = null,
  users = [],
  bulkQueue,
  onApprove,
  onBulkDone,
  onSwitchToCsvImport,
  onOpenFullPage,
  showToast,
}) => {
  const aiCapabilities = useAiCapabilities();
  const [mode, setMode] = useState<'single' | 'bulk'>('single');

  useEffect(() => {
    if (isOpen && (bulkQueue.isRunning || bulkQueue.items.length > 0)) {
      setMode('bulk');
    }
  }, [isOpen, bulkQueue.isRunning, bulkQueue.items.length]);

  const effectiveReq = mode === 'bulk' ? bulkQueue.targetRequirement || lockedRequirement : lockedRequirement;

  return (
    <AnimatedModal
      isOpen={isOpen}
      onBackdropClick={onClose}
      zIndexClass="z-[70]"
      backdropClassName="bg-slate-900/60 backdrop-blur-[2px] flex items-center justify-center p-4 overflow-y-auto select-none"
      panelClassName="bg-white rounded-xl shadow-2xl max-w-5xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
      ariaLabel="Add Consultant from Resume"
    >
      <ModalHeader
        icon={mode === 'bulk' ? <Files className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
        title={
          effectiveReq
            ? `Parse & Attach Resumes to ${effectiveReq.code}`
            : 'Add Consultant from Resume'
        }
        badges={
          aiCapabilities.enabled ? (
            <AiBadge label="PipeAI" size="xs" />
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-white text-emerald-700 border border-emerald-300 px-2 py-0.5 rounded-full">
              Auto-Fill
            </span>
          )
        }
        subtitle={
          mode === 'bulk'
            ? `Drop up to ${MAX_BULK_CV_FILES} CVs — closes cleanly and keeps parsing in the background.`
            : 'Upload a PDF or Word (.docx) resume without leaving your candidate list.'
        }
        onClose={onClose}
        actions={
          <div className="flex items-center gap-2 shrink-0">
            <div className="inline-flex items-center rounded-lg bg-slate-50/90 p-0.5 border border-slate-200 text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => setMode('single')}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer border ${mode === 'single'
                    ? 'bg-white text-slate-900 border-slate-200/90'
                    : 'text-slate-500 hover:text-slate-800 border-transparent'
                  }`}
              >
                Single Resume
              </button>
              <button
                type="button"
                onClick={() => setMode('bulk')}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 border ${mode === 'bulk'
                    ? 'bg-white text-slate-900 border-slate-200/90'
                    : 'text-slate-500 hover:text-slate-800 border-transparent'
                  }`}
              >
                <Files className="w-3 h-3" />
                <span>Bulk Upload</span>
                {bulkQueue.isRunning && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                )}
              </button>
            </div>
            {onOpenFullPage && (
              <button
                type="button"
                onClick={onOpenFullPage}
                title="Open dedicated full-page Resume Import Studio"
                className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 text-[11px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Full Page</span>
              </button>
            )}
          </div>
        }
      />

      {/* Modal Body */}
      <div className="p-6 overflow-y-auto flex-1">
        <ResumeImportWorkspace
          variant="modal"
          mode={mode}
          onModeChange={setMode}
          resetTrigger={isOpen}
          lockedRequirement={lockedRequirement}
          users={users}
          bulkQueue={bulkQueue}
          cancelLabel="Close"
          onCancel={onClose}
          onApprove={onApprove}
          onBulkDone={onBulkDone}
          onSwitchToCsvImport={onSwitchToCsvImport}
          showToast={showToast}
        />
      </div>
    </AnimatedModal>
  );
};
