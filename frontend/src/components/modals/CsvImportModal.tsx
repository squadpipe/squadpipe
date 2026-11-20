import React, { useState } from 'react';
import { ExternalLink, FileSpreadsheet, X } from 'lucide-react';
import { Requirement } from '../../types';
import { AnimatedModal } from '../shared/MotionPrimitives';
import { CsvImportResult, CsvImportWorkspace } from '../../features/import-data/CsvImportPage';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  lockedRequirement?: Requirement | null;
  onImportComplete?: (result: CsvImportResult) => Promise<void> | void;
  onSwitchToResumeParser?: () => void;
  onOpenFullPage?: () => void;
  onNavigate?: (view: string) => void;
  showToast: (title: string, message: string, icon?: string) => void;
}

const STEP_TITLES: Record<1 | 2 | 3, string> = {
  1: 'Choose Spreadsheet File',
  2: 'Match Columns & Preview',
  3: 'Import Complete',
};

/**
 * Inline CSV Import popup used inside contextual workflows like Attach Candidates.
 */
export const CsvImportModal: React.FC<CsvImportModalProps> = ({
  isOpen,
  onClose,
  lockedRequirement = null,
  onImportComplete,
  onSwitchToResumeParser,
  onOpenFullPage,
  onNavigate,
  showToast,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isImporting, setIsImporting] = useState(false);

  return (
    <AnimatedModal
      isOpen={isOpen}
      onBackdropClick={() => {
        if (!isImporting) onClose();
      }}
      zIndexClass="z-[70]"
      backdropClassName="bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 select-none"
      panelClassName="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
      ariaLabel="Import Candidates from Spreadsheet"
    >
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-3 bg-slate-50 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900 truncate">
              {lockedRequirement
                ? `Import Spreadsheet Candidates to ${lockedRequirement.code}`
                : 'Import Candidates from Spreadsheet'}
            </h2>
            <div className="text-[11px] text-slate-500">
              Step {step} of 3: {STEP_TITLES[step]}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {onOpenFullPage && (
            <button
              type="button"
              disabled={isImporting}
              onClick={onOpenFullPage}
              title="Open dedicated full-page Spreadsheet Import"
              className="text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 px-2 py-1 rounded text-[11px] font-medium inline-flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Full Page</span>
            </button>
          )}
          <button
            type="button"
            disabled={isImporting}
            onClick={onClose}
            aria-label="Close modal"
            className="text-slate-400 hover:text-slate-700 w-7 h-7 rounded flex items-center justify-center cursor-pointer disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-6 overflow-y-auto flex-1">
        <CsvImportWorkspace
          variant="modal"
          resetTrigger={isOpen}
          step={step}
          onStepChange={setStep}
          lockedRequirement={lockedRequirement}
          cancelLabel="Cancel"
          doneLabel={lockedRequirement ? 'Back to Attach Candidates' : 'Done'}
          onCancel={onClose}
          onImportComplete={onImportComplete}
          onSwitchToResumeParser={onSwitchToResumeParser}
          onNavigate={onNavigate}
          onImportingChange={setIsImporting}
          showToast={showToast}
        />
      </div>
    </AnimatedModal>
  );
};
