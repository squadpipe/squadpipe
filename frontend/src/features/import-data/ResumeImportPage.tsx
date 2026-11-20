import React, { useEffect, useState } from 'react';
import { ArrowRight, FileSpreadsheet, FileText, Files, Sparkles } from 'lucide-react';
import { Candidate, Requirement, User } from '../../types';
import { useAiCapabilities } from '../../utils/workspaceBrand';
import { MAX_BULK_CV_FILES } from '../../utils/resumeDraftMapper';
import { BulkResumeQueueController } from '../../hooks/useBulkResumeQueue';
import { DetailBreadcrumb } from '../../components/shared/DetailPageShell';
import { StatusBadge } from '../../components/shared/StatusBadge';
import {
  ResumeApproveOptions,
  ResumeImportWorkspace,
} from './ResumeImportWorkspace';

interface ResumeImportPageProps {
  lockedRequirement?: Requirement | null;
  users?: User[];
  bulkQueue: BulkResumeQueueController;
  backLabel?: string;
  onBack: () => void;
  onApprove: (candidate: Candidate, options?: ResumeApproveOptions) => Promise<void> | void;
  onBulkDone?: (addedCount: number, targetRequirement?: Requirement | null) => void;
  onSwitchToCsvImport?: () => void;
  showToast: (title: string, message: string, icon?: string) => void;
}

/**
 * Dedicated full-page Single & Bulk Resume Parser workspace (/import-data/resume).
 */
export const ResumeImportPage: React.FC<ResumeImportPageProps> = ({
  lockedRequirement = null,
  users = [],
  bulkQueue,
  backLabel = 'Back to Import Data',
  onBack,
  onApprove,
  onBulkDone,
  onSwitchToCsvImport,
  showToast,
}) => {
  const aiCapabilities = useAiCapabilities();
  const [mode, setMode] = useState<'single' | 'bulk'>(() =>
    bulkQueue.isRunning || bulkQueue.items.length > 0 ? 'bulk' : 'single'
  );

  useEffect(() => {
    if (bulkQueue.isRunning) {
      setMode('bulk');
    }
  }, [bulkQueue.isRunning]);

  return (
    <div className="max-w-7xl mx-auto space-y-5 animate-fade-in">
      <DetailBreadcrumb
        backLabel={backLabel}
        onBack={onBack}
        title={
          lockedRequirement
            ? `Parse Resumes for ${lockedRequirement.code}`
            : 'Resume Parser & Import'
        }
        codePill={lockedRequirement ? lockedRequirement.code : 'Resume Parser'}
        rightSlot={
          onSwitchToCsvImport ? (
            <button
              type="button"
              onClick={onSwitchToCsvImport}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 px-2.5 py-1 rounded-md border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-50 transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Switch to CSV Import</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          ) : undefined
        }
      />

      {/* Page Header Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5 min-w-0">
          <span className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs shrink-0">
            {mode === 'bulk' ? <Files className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-base font-bold text-slate-900 tracking-tight">
                {lockedRequirement
                  ? `Add Consultants from Resumes to ${lockedRequirement.code}`
                  : 'Add Consultant from Resume'}
              </h1>
              <StatusBadge
                tone="brand"
                shape="rounded"
                icon={
                  aiCapabilities.enabled ? (
                    <Sparkles className="w-3 h-3 text-indigo-600" />
                  ) : undefined
                }
                label={aiCapabilities.enabled ? 'AI Auto-Fill' : 'Auto-Fill'}
              />
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {mode === 'bulk'
                ? `Drop or select up to ${MAX_BULK_CV_FILES} CVs to parse and import into your consultant roster.`
                : 'Upload a PDF or Word (.docx) resume to inspect source text and edit extracted details side-by-side.'}
            </p>
          </div>
        </div>

        <div className="inline-flex items-center rounded-lg bg-slate-100 p-1 border border-slate-200 text-xs font-semibold shrink-0 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setMode('single')}
            className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
              mode === 'single'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Single Resume
          </button>
          <button
            type="button"
            onClick={() => setMode('bulk')}
            className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
              mode === 'bulk'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Files className="w-3.5 h-3.5" />
            <span>Bulk Upload</span>
            {bulkQueue.isRunning && (
              <span className="w-2 h-2 rounded-full bg-brand-600 animate-pulse" />
            )}
          </button>
        </div>
      </div>

      <ResumeImportWorkspace
        variant="page"
        mode={mode}
        onModeChange={setMode}
        lockedRequirement={lockedRequirement}
        users={users}
        bulkQueue={bulkQueue}
        cancelLabel={backLabel}
        onCancel={onBack}
        onApprove={onApprove}
        onBulkDone={onBulkDone}
        showToast={showToast}
      />
    </div>
  );
};
