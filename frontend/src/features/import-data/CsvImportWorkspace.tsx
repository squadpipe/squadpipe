import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Check,
  CloudUpload,
  FileDown,
  FileText,
} from 'lucide-react';
import { apiClient } from '../../config/api.config';
import { Candidate, Requirement } from '../../types';
import { useCurrency } from '../../utils/currency';
import { getWorkspaceBrandSlug, useWorkspaceBrand } from '../../utils/workspaceBrand';
import { downloadSampleCandidatesCsv, parseCandidateCsvText } from '../../utils/csvCandidates';
import { mapCandidateFromApi, mapRequirementFromApi } from '../../utils/entityMappers';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { ActionButton } from '../../components/shared/ActionButton';

export interface CsvImportResult {
  candidates: Candidate[];
  count: number;
  attachedCount: number;
  skippedCount: number;
  updatedRequirement: Requirement | null;
}

export interface CsvImportWorkspaceProps {
  variant?: 'page' | 'modal';
  resetTrigger?: unknown;
  step?: 1 | 2 | 3;
  onStepChange?: (step: 1 | 2 | 3) => void;
  lockedRequirement?: Requirement | null;
  cancelLabel?: string;
  doneLabel?: string;
  onCancel: () => void;
  onImportComplete?: (result: CsvImportResult) => Promise<void> | void;
  onSwitchToResumeParser?: () => void;
  onNavigate?: (view: string) => void;
  onImportingChange?: (isImporting: boolean) => void;
  showToast: (title: string, message: string, icon?: string) => void;
}

/**
 * Shared 3-step CSV / Excel candidate import wizard used in both /import-data/csv and CsvImportModal.
 */
export const CsvImportWorkspace: React.FC<CsvImportWorkspaceProps> = ({
  variant = 'page',
  resetTrigger,
  step: controlledStep,
  onStepChange,
  lockedRequirement = null,
  cancelLabel = 'Cancel',
  doneLabel,
  onCancel,
  onImportComplete,
  onSwitchToResumeParser,
  onNavigate,
  onImportingChange,
  showToast,
}) => {
  const { symbol: currencySymbol } = useCurrency();
  const brand = useWorkspaceBrand();
  const brandName = (brand.agencyName || brand.legalEntityName || 'Workspace').trim();

  const [internalStep, setInternalStep] = useState<1 | 2 | 3>(1);
  const step = controlledStep ?? internalStep;
  const setStep = (next: 1 | 2 | 3) => {
    setInternalStep(next);
    onStepChange?.(next);
  };

  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importSummary, setImportSummary] = useState<{
    importedCount: number;
    attachedCount: number;
    skippedCount: number;
    attachedRequirement: Requirement | null;
  }>({
    importedCount: 0,
    attachedCount: 0,
    skippedCount: 0,
    attachedRequirement: null,
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    onImportingChange?.(isImporting);
  }, [isImporting, onImportingChange]);

  const handleResetWizard = () => {
    setStep(1);
    setUploadedFileName('');
    setParsedRows([]);
    setIsImporting(false);
    setImportSummary({
      importedCount: 0,
      attachedCount: 0,
      skippedCount: 0,
      attachedRequirement: null,
    });
  };

  useEffect(() => {
    handleResetWizard();
  }, [lockedRequirement?.id, resetTrigger]);

  const targetRequirementId = lockedRequirement?.id || '';

  const downloadSampleCsv = () => {
    const sampleCsvFilename = downloadSampleCandidatesCsv(
      getWorkspaceBrandSlug(),
      currencySymbol
    );
    showToast(
      'Sample CSV Downloaded',
      `Downloaded ${sampleCsvFilename} template with 3 formatted sample candidates.`,
      'csv'
    );
  };

  const sampleRow = parsedRows[0] || {};
  const columnMappings = [
    { source: 'Candidate_Name', sample: sampleRow.fullName || '—', target: 'fullName' },
    { source: 'Designation_Title', sample: sampleRow.currentTitle || '—', target: 'currentTitle' },
    { source: 'Visa_Status', sample: sampleRow.workAuth || '—', target: 'workAuth' },
    { source: 'Email_Address', sample: sampleRow.email || '—', target: 'email' },
    { source: 'Phone_Cell', sample: sampleRow.phone || '—', target: 'phone' },
    { source: 'Rate_Expectation', sample: sampleRow.hourlyRateDisplay || '—', target: 'hourlyRate' },
    { source: 'Relocation_Pref', sample: sampleRow.relocation || '—', target: 'relocation' },
    { source: 'Primary_Skillset', sample: sampleRow.skillset || '—', target: 'skillset' },
    { source: 'Education', sample: sampleRow.education || '—', target: 'education' },
    { source: 'Desk_Owner', sample: sampleRow.assignedRecruiter || '—', target: 'assignedRecruiter' },
  ];

  const loadCsvFile = (file?: File | null) => {
    if (!file) return;
    setUploadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;
      const nonEmptyLines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      if (nonEmptyLines.length > 1) {
        const rows = parseCandidateCsvText(text);
        setParsedRows(rows);
        if (rows.length > 0) {
          setStep(2);
        } else {
          showToast(
            'No Valid Rows Found',
            'Ensure your CSV includes columns for Name and Email.',
            'warning'
          );
        }
      } else {
        setParsedRows([]);
        showToast(
          'Invalid CSV File',
          'The selected file has no data rows.',
          'warning'
        );
      }
    };
    reader.readAsText(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    loadCsvFile(file);
    e.target.value = '';
  };

  const handleFileDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    loadCsvFile(file);
  };

  const handleRunMigration = async () => {
    if (parsedRows.length === 0 || isImporting) {
      if (parsedRows.length === 0) {
        showToast(
          'No File Loaded',
          'Please select a valid CSV file with Name and Email columns first.',
          'warning'
        );
      }
      return;
    }

    setIsImporting(true);
    try {
      const payload = targetRequirementId
        ? { rows: parsedRows, requirementId: targetRequirementId }
        : { rows: parsedRows };
      const res = await apiClient.post('/candidates/csv-import', payload);
      const count = res.data?.count || parsedRows.length;
      const returnedRows = Array.isArray(res.data?.data) ? res.data.data : parsedRows;
      const mappedCandidates = returnedRows.map((r: any) => mapCandidateFromApi(r));
      const updatedReq = res.data?.requirement
        ? mapRequirementFromApi(res.data.requirement)
        : null;
      const attachedCount = Number(res.data?.attachedCount || 0);
      const skippedCount = Number(res.data?.skippedDuplicatesCount || 0);

      if (onImportComplete) {
        await onImportComplete({
          candidates: mappedCandidates,
          count,
          attachedCount,
          skippedCount,
          updatedRequirement: updatedReq,
        });
      }

      setImportSummary({
        importedCount: count,
        attachedCount,
        skippedCount,
        attachedRequirement: updatedReq,
      });
      setStep(3);

      showToast(
        updatedReq ? 'CSV Imported & Attached' : 'CSV Import Complete',
        updatedReq
          ? `Imported ${count} candidates and attached ${attachedCount} to ${updatedReq.code}${skippedCount > 0 ? ` (${skippedCount} already attached)` : ''}.`
          : `Successfully mapped and imported ${count} candidates into central bench roster.`,
        'success'
      );
    } catch (err: any) {
      showToast(
        'Import Error',
        err?.response?.data?.message ||
        'Failed to import candidates. Please check your file and try again.',
        'error'
      );
    } finally {
      setIsImporting(false);
    }
  };

  const isModal = variant === 'modal';

  return (
    <div className="space-y-4 text-xs">
      {lockedRequirement && (
        <div className="px-4 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 flex items-center gap-2.5 text-xs">
          <Briefcase className="w-4 h-4 text-brand-600 shrink-0" />
          <span>
            Imported candidates will be saved to Consultants and attached directly to{' '}
            <strong className="text-slate-900">{lockedRequirement.code}</strong> ({lockedRequirement.opportunityTitle}).
          </span>
        </div>
      )}

      <div
        className={
          isModal
            ? 'space-y-4'
            : 'bg-white rounded-xl border border-slate-200 p-6 card-shadow space-y-5'
        }
      >
        {step === 1 && (
          <div className="space-y-4">
            <label
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
              className={`border-2 border-dashed border-slate-300 rounded-xl ${isModal ? 'p-8' : 'p-12'
                } text-center bg-slate-50/60 cursor-pointer hover:border-brand-600 hover:bg-slate-50 transition-colors block`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx"
                onChange={handleFileInputChange}
                className="hidden"
              />
              <CloudUpload className="w-9 h-9 text-brand-600 mx-auto mb-2.5" />
              <div className="font-bold text-slate-800 text-sm">
                {uploadedFileName
                  ? `Loaded: ${uploadedFileName}`
                  : 'Choose or Drop Spreadsheet File'}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {parsedRows.length > 0
                  ? `${parsedRows.length} parsed candidate rows detected`
                  : 'Select a UTF-8 CSV file with header columns (Name, Email, Title, Skills, Rate, etc.)'}
              </div>
              <div className="mt-4 inline-flex items-center gap-1.5 px-4 py-1.5 bg-white border border-slate-200 rounded-lg text-brand-600 font-semibold">
                <span>Browse CSV File</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </label>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-4 flex-wrap">
                <button
                  type="button"
                  onClick={downloadSampleCsv}
                  className="text-brand-600 hover:underline font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <FileDown className="w-4 h-4" />
                  <span>Download Sample CSV Template</span>
                </button>
                {isModal && onSwitchToResumeParser && (
                  <button
                    type="button"
                    onClick={onSwitchToResumeParser}
                    className="text-slate-600 hover:text-slate-900 hover:underline font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Switch to Resume Parser</span>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
                >
                  {cancelLabel}
                </button>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={parsedRows.length === 0}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold rounded-lg text-xs cursor-pointer inline-flex items-center gap-1.5"
                >
                  <span>Continue ({parsedRows.length} Rows)</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-semibold text-slate-900 text-xs">
                  Verify Column Mapping to {brandName} CRM
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Loaded <span className="font-semibold text-slate-700">{uploadedFileName}</span> (
                  {parsedRows.length} rows ready to import)
                </p>
              </div>
              <button
                type="button"
                onClick={downloadSampleCsv}
                className="text-brand-600 hover:underline font-semibold text-[11px] flex items-center gap-1 cursor-pointer"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>Download Sample Template</span>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              <div className="lg:col-span-6 overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                    <tr>
                      <th className="p-2.5">Source CSV Column</th>
                      <th className="p-2.5">First Row Preview</th>
                      <th className="p-2.5">CRM Field</th>
                      <th className="p-2.5">Match</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {columnMappings.map((m) => (
                      <tr key={m.source}>
                        <td className="p-2.5 font-medium text-slate-900">{m.source}</td>
                        <td className="p-2.5 text-slate-500 italic truncate max-w-[120px]">
                          {m.sample}
                        </td>
                        <td className="p-2.5">
                          <span className="px-2 py-0.5 rounded-md text-[11px] bg-slate-100 font-medium text-slate-800">
                            {m.target}
                          </span>
                        </td>
                        <td className="p-2.5">
                          <StatusBadge tone="emerald" size="xs" label="Matched" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="lg:col-span-6 space-y-2">
                <div className="text-xs font-semibold text-slate-800">
                  Candidate Data Preview (First {Math.min(5, parsedRows.length)} of{' '}
                  {parsedRows.length})
                </div>
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                      <tr>
                        <th className="p-2.5">Name</th>
                        <th className="p-2.5">Title / Work Auth</th>
                        <th className="p-2.5">Email</th>
                        <th className="p-2.5">Skills</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {parsedRows.slice(0, 5).map((row, idx) => (
                        <tr key={idx}>
                          <td className="p-2.5 font-semibold text-slate-900 whitespace-nowrap">
                            {row.fullName || '—'}
                          </td>
                          <td className="p-2.5 text-slate-600">
                            <div>{row.currentTitle || '—'}</div>
                            {row.workAuth && (
                              <div className="text-[11px] text-slate-400">{row.workAuth}</div>
                            )}
                          </td>
                          <td className="p-2.5 text-slate-600">{row.email || '—'}</td>
                          <td className="p-2.5 text-slate-500 max-w-[160px] truncate">
                            {row.skillset || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {lockedRequirement && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs text-slate-700">
                  <Briefcase className="w-4 h-4 text-brand-600 shrink-0" />
                  <span>
                    Auto-attaching {parsedRows.length} candidate
                    {parsedRows.length === 1 ? '' : 's'} to{' '}
                    <strong className="text-slate-900">{lockedRequirement.code}</strong> — {lockedRequirement.opportunityTitle}
                  </span>
                </div>
                <span className="text-[11px] font-semibold text-brand-700 shrink-0">
                  + Consultants Roster
                </span>
              </div>
            )}

            <div className="flex justify-between items-center pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={isImporting}
                onClick={() => setStep(1)}
                className="text-slate-600 hover:text-slate-900 font-semibold text-xs cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Choose Different File</span>
              </button>
              <ActionButton
                loading={isImporting}
                loadingText="Importing candidates..."
                onClick={handleRunMigration}
                icon={undefined}
                className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg text-xs cursor-pointer"
              >
                <span className="inline-flex items-center gap-1.5">
                  <span>
                    {lockedRequirement
                      ? `Import & Attach (${parsedRows.length} Rows)`
                      : `Execute Import (${parsedRows.length} Rows)`}
                  </span>
                  {!isImporting && <ArrowRight className="w-3.5 h-3.5" />}
                </span>
              </ActionButton>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="text-center py-8 space-y-4">
            <div className="w-11 h-11 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto">
              <Check className="w-5 h-5" strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">CSV Import Complete</h3>
              <p className="text-slate-500 text-xs mt-1">
                {importSummary.importedCount || parsedRows.length} candidates imported successfully
                into your central roster.
                {importSummary.attachedRequirement && (
                  <>
                    {' '}
                    <span className="font-semibold text-slate-700">
                      {importSummary.attachedCount} attached to{' '}
                      {importSummary.attachedRequirement.code}
                    </span>
                    {importSummary.skippedCount > 0 &&
                      ` (${importSummary.skippedCount} already attached)`}
                    .
                  </>
                )}
              </p>
            </div>

            <div className="flex items-center justify-center gap-2.5 pt-1 flex-wrap">
              <button
                type="button"
                onClick={handleResetWizard}
                className="px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs cursor-pointer"
              >
                Import Another CSV
              </button>
              {lockedRequirement ? (
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg text-xs cursor-pointer"
                >
                  {doneLabel || `Back to ${lockedRequirement.code}`}
                </button>
              ) : onNavigate ? (
                <button
                  type="button"
                  onClick={() => onNavigate('consultants')}
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg text-xs cursor-pointer"
                >
                  Open Consultant Directory
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg text-xs cursor-pointer"
                >
                  {doneLabel || 'Done'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
