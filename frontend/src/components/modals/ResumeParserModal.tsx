import React, { useEffect, useState } from 'react';
import { ExternalLink, FileText, Files, Sparkles, X } from 'lucide-react';
import { Candidate, Requirement, User } from '../../types';
import { useAiCapabilities } from '../../utils/workspaceBrand';
import { MAX_BULK_CV_FILES } from '../../utils/resumeDraftMapper';
import { BulkResumeQueueController } from '../../hooks/useBulkResumeQueue';
import { AnimatedModal } from '../shared/MotionPrimitives';
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
      backdropClassName="bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto select-none"
      panelClassName="bg-white rounded-2xl shadow-2xl max-w-5xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
      ariaLabel="Add Consultant from Resume"
    >
      {/* Modal Header */}
      <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between gap-3 bg-[#141615] text-white shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white shrink-0 shadow-xs">
            {mode === 'bulk' ? <Files className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-white flex items-center gap-2 flex-wrap">
              <span>
                {effectiveReq
                  ? `Parse & Attach Resumes to ${effectiveReq.code}`
                  : 'Add Consultant from Resume'}
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                {aiCapabilities.enabled && <Sparkles className="w-2.5 h-2.5" />}
                <span>{aiCapabilities.enabled ? 'AI Auto-Fill' : 'Auto-Fill'}</span>
              </span>
            </h2>
            <div className="text-[11px] text-slate-400 mt-0.5 truncate">
              {mode === 'bulk'
                ? `Drop up to ${MAX_BULK_CV_FILES} CVs — closes cleanly and keeps parsing in the background.`
                : 'Upload a PDF or Word (.docx) resume without leaving your candidate list.'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="inline-flex items-center rounded-lg bg-white/10 p-0.5 border border-white/10 text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => setMode('single')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                mode === 'single' ? 'bg-white text-slate-900' : 'text-slate-300 hover:text-white'
              }`}
            >
              Single Resume
            </button>
            <button
              type="button"
              onClick={() => setMode('bulk')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                mode === 'bulk' ? 'bg-white text-slate-900' : 'text-slate-300 hover:text-white'
              }`}
            >
              <Files className="w-3 h-3" />
              <span>Bulk Upload</span>
              {bulkQueue.isRunning && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </button>
          </div>
          {onOpenFullPage && (
            <button
              type="button"
              onClick={onOpenFullPage}
              title="Open dedicated full-page Resume Import Studio"
              className="text-slate-300 hover:text-white hover:bg-white/10 px-2 py-1 rounded text-[11px] font-medium inline-flex items-center gap-1 transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Full Page</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="text-slate-400 hover:text-white w-7 h-7 rounded flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

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
