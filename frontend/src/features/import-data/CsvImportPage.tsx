import React, { useState } from 'react';
import { ArrowRight, Check, FileText } from 'lucide-react';
import { Requirement } from '../../types';
import { useWorkspaceBrand } from '../../utils/workspaceBrand';
import { DetailBreadcrumb } from '../../components/shared/DetailPageShell';
import { PageHeader } from '../../components/shared/PageHeader';
import { CsvImportResult, CsvImportWorkspace } from './CsvImportWorkspace';

export type { CsvImportResult };

interface CsvImportPageProps {
  lockedRequirement?: Requirement | null;
  backLabel?: string;
  onBack: () => void;
  onImportComplete?: (result: CsvImportResult) => Promise<void> | void;
  onSwitchToResumeParser?: () => void;
  onNavigate?: (view: string) => void;
  showToast: (title: string, message: string, icon?: string) => void;
}

/**
 * Dedicated full-page 3-step CSV / Excel candidate import wizard (/import-data/csv).
 */
export const CsvImportPage: React.FC<CsvImportPageProps> = ({
  lockedRequirement = null,
  backLabel = 'Back to Import Data',
  onBack,
  onImportComplete,
  onSwitchToResumeParser,
  onNavigate,
  showToast,
}) => {
  const brand = useWorkspaceBrand();
  const brandName = (brand.agencyName || brand.legalEntityName || 'Workspace').trim();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isImporting, setIsImporting] = useState(false);

  const stepLabels = [
    { num: 1 as const, label: 'Choose File' },
    { num: 2 as const, label: 'Match Columns & Preview' },
    { num: 3 as const, label: 'Import Complete' },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-5 animate-fade-in">
      <DetailBreadcrumb
        backLabel={backLabel}
        onBack={() => {
          if (!isImporting) onBack();
        }}
        title={
          lockedRequirement
            ? `Import Spreadsheet Candidates to ${lockedRequirement.code}`
            : 'Import Candidates from Spreadsheet'
        }
        codePill={lockedRequirement ? lockedRequirement.code : 'CSV / Excel'}
        rightSlot={
          onSwitchToResumeParser ? (
            <button
              type="button"
              disabled={isImporting}
              onClick={onSwitchToResumeParser}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 hover:text-slate-900 px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
            >
              <FileText className="w-3.5 h-3.5 text-brand-600" />
              <span>Switch to Resume Parser</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          ) : undefined
        }
      />

      <PageHeader
        title={
          lockedRequirement
            ? `Import Spreadsheet to ${lockedRequirement.code}`
            : 'Import from Spreadsheet'
        }
        subtitle={`Upload a CSV or Excel export, inspect mapped ${brandName} CRM columns and sample rows, and import directly.`}
        actions={
          <div className="flex items-center gap-1.5 flex-wrap text-xs">
            {stepLabels.map((item, idx) => {
              const isCurrent = step === item.num;
              const isDone = step > item.num;
              return (
                <React.Fragment key={item.num}>
                  <div
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-semibold ${
                      isCurrent
                        ? 'bg-slate-900 text-white border-slate-900'
                        : isDone
                        ? 'bg-white text-emerald-700 border-emerald-200'
                        : 'bg-white text-slate-400 border-slate-200'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-full inline-flex items-center justify-center text-[11px] ${
                        isCurrent
                          ? 'bg-white/15 text-white'
                          : isDone
                          ? 'bg-emerald-50 text-emerald-600'
                          : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {isDone ? <Check className="w-3 h-3" /> : item.num}
                    </span>
                    <span>{item.label}</span>
                  </div>
                  {idx < stepLabels.length - 1 && (
                    <span className="text-slate-300 hidden sm:inline">→</span>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        }
      />

      <CsvImportWorkspace
        variant="page"
        step={step}
        onStepChange={setStep}
        lockedRequirement={lockedRequirement}
        cancelLabel="Cancel"
        onCancel={onBack}
        onImportComplete={onImportComplete}
        onNavigate={onNavigate}
        onImportingChange={setIsImporting}
        showToast={showToast}
      />
    </div>
  );
};
