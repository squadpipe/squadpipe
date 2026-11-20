import React, { useState } from 'react';
import { ExternalLink, FileSpreadsheet } from 'lucide-react';
import { Requirement } from '../../types';
import { AnimatedModal, ModalHeader } from '../shared/MotionPrimitives';
import { CsvImportResult, CsvImportWorkspace } from '../../features/import-data/CsvImportWorkspace';

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
      backdropClassName="bg-slate-900/60 backdrop-blur-[2px] flex items-center justify-center p-4 select-none"
      panelClassName="bg-white rounded-xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
      ariaLabel="Import Candidates from Spreadsheet"
    >
      <ModalHeader
        icon={<FileSpreadsheet className="w-4 h-4 text-emerald-600" />}
        title={
          lockedRequirement
            ? `Import Spreadsheet Candidates to ${lockedRequirement.code}`
            : 'Import Candidates from Spreadsheet'
        }
        subtitle={`Step ${step} of 3: ${STEP_TITLES[step]}`}
        onClose={onClose}
        closeDisabled={isImporting}
        actions={
          onOpenFullPage ? (
            <button
              type="button"
              disabled={isImporting}
              onClick={onOpenFullPage}
              title="Open dedicated full-page Spreadsheet Import"
              className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 text-[11px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Full Page</span>
            </button>
          ) : undefined
        }
      />

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
