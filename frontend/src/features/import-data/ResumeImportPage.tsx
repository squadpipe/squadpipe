import React, { useEffect, useState } from 'react';
import { ArrowRight, FileSpreadsheet, Files } from 'lucide-react';
import { Candidate, Requirement, User } from '../../types';
import { MAX_BULK_CV_FILES } from '../../utils/resumeDraftMapper';
import { BulkResumeQueueController } from '../../hooks/useBulkResumeQueue';
import { DetailBreadcrumb } from '../../components/shared/DetailPageShell';
import { PageHeader } from '../../components/shared/PageHeader';
import { SegmentedControl } from '../../components/shared/SegmentedControl';
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
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 hover:text-slate-900 px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Switch to CSV Import</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          ) : undefined
        }
      />

      <PageHeader
        title={
          lockedRequirement
            ? `Upload Resumes to ${lockedRequirement.code}`
            : 'Upload Resumes'
        }
        subtitle={
          mode === 'bulk'
            ? `Drop or select up to ${MAX_BULK_CV_FILES} CVs to parse and import into your consultant roster.`
            : 'Upload a PDF or Word (.docx) resume to inspect source text and edit extracted details side-by-side.'
        }
        actions={
          <SegmentedControl<'single' | 'bulk'>
            value={mode}
            onChange={setMode}
            ariaLabel="Resume upload mode"
            options={[
              { value: 'single', label: 'Single Resume' },
              {
                value: 'bulk',
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    <Files className="w-3.5 h-3.5" />
                    <span>Bulk Upload</span>
                    {bulkQueue.isRunning && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    )}
                  </span>
                ),
              },
            ]}
          />
        }
      />

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
