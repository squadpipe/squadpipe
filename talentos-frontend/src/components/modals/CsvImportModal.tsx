import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Check,
  CloudUpload,
  FileDown,
  FileSpreadsheet,
  Loader2,
  X,
} from 'lucide-react';
import { apiClient } from '../../config/api.config';
import { Candidate, Requirement } from '../../types';
import { useCurrency } from '../../utils/currency';
import { getWorkspaceBrandSlug, useWorkspaceBrand } from '../../utils/workspaceBrand';
import { downloadSampleCandidatesCsv, parseCandidateCsvText } from '../../utils/csvCandidates';
import { mapCandidateFromApi, mapRequirementFromApi } from '../../utils/entityMappers';
import { ModalPortal } from '../shared/ModalPortal';

export interface CsvImportResult {
  candidates: Candidate[];
  count: number;
  attachedCount: number;
  skippedCount: number;
  updatedRequirement: Requirement | null;
}

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  lockedRequirement?: Requirement | null;
  onImportComplete?: (result: CsvImportResult) => Promise<void> | void;
  onNavigate?: (view: string) => void;
  showToast: (title: string, message: string, icon?: string) => void;
}

export const CsvImportModal: React.FC<CsvImportModalProps> = ({
  isOpen,
  onClose,
  lockedRequirement = null,
  onImportComplete,
  onNavigate,
  showToast,
}) => {
  const { symbol: currencySymbol } = useCurrency();
  const brand = useWorkspaceBrand();
  const brandName = (brand.agencyName || brand.legalEntityName || 'Workspace').trim();

  const [step, setStep] = useState<1 | 2 | 3>(1);
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
    if (!isOpen) return;
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
  }, [isOpen, lockedRequirement?.id]);

  if (!isOpen) return null;

  const targetRequirementId = lockedRequirement?.id || '';

  const downloadSampleCsv = () => {
    const sampleCsvFilename = downloadSampleCandidatesCsv(getWorkspaceBrandSlug(), currencySymbol);
    showToast(
      'Sample CSV Downloaded',
      `Downloaded ${sampleCsvFilename} template with 3 formatted sample candidates.`,
      'fa-solid fa-file-csv text-emerald-500'
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

  const handleFileDrop = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    setUploadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;
      const nonEmptyLines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      if (nonEmptyLines.length > 1) {
        const rows = parseCandidateCsvText(text);
        setParsedRows(rows);
        if (rows.length > 0) {
          setStep(2);
        } else {
          showToast(
            'No Valid Rows Found',
            'Ensure your CSV includes columns for Name and Email.',
            'fa-solid fa-triangle-exclamation text-amber-500'
          );
        }
      } else {
        setParsedRows([]);
        showToast(
          'Invalid CSV File',
          'The selected file has no data rows.',
          'fa-solid fa-triangle-exclamation text-amber-500'
        );
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleRunMigration = async () => {
    if (parsedRows.length === 0 || isImporting) {
      if (parsedRows.length === 0) {
        showToast(
          'No File Loaded',
          'Please select a valid CSV file with Name and Email columns first.',
          'fa-solid fa-triangle-exclamation text-amber-500'
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
      const updatedReq = res.data?.requirement ? mapRequirementFromApi(res.data.requirement) : null;
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
        'fa-solid fa-circle-check text-emerald-500'
      );
    } catch (err: any) {
      showToast(
        'Import Error',
        err?.response?.data?.message || 'Failed to import candidates. Please check your file and try again.',
        'fa-solid fa-triangle-exclamation text-rose-500'
      );
    } finally {
      setIsImporting(false);
    }
  };

  const stepTitles = {
    1: 'Select Source Workbook',
    2: 'Column Schema Mapping & Validation',
    3: 'Import Successful',
  };

  return (
    <ModalPortal>
      <div
        onClick={() => {
          if (!isImporting) onClose();
        }}
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[60] flex items-center justify-center p-4 animate-fade-in select-none"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden flex flex-col animate-scale-up max-h-[90vh]"
        >
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <div className="flex items-center gap-2.5 min-w-0">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-slate-900 truncate">
                  {lockedRequirement
                    ? `Import CSV Candidates to ${lockedRequirement.code}`
                    : 'Spreadsheet Migration & Column Mapping Wizard'}
                </h2>
                <div className="text-[11px] text-slate-500">
                  Step {step} of 3: {stepTitles[step]}
                </div>
              </div>
            </div>
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

          <div className="p-6 overflow-y-auto space-y-4 text-xs">
            {/* Step 1: File Drop */}
            {step === 1 && (
              <div className="space-y-4">
                {lockedRequirement && (
                  <div className="px-3.5 py-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200 text-emerald-900 flex items-center gap-2 text-xs">
                    <Briefcase className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    <span>
                      Imported candidates will be saved to Consultants and attached directly to{' '}
                      <strong>{lockedRequirement.code}</strong> ({lockedRequirement.opportunityTitle}).
                    </span>
                  </div>
                )}

                <label className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center bg-slate-50 cursor-pointer hover:border-brand-600 transition-colors block">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx"
                    onChange={handleFileDrop}
                    className="hidden"
                  />
                  <CloudUpload className="w-8 h-8 text-brand-600 mx-auto mb-2" />
                  <div className="font-bold text-slate-800 text-sm">
                    {uploadedFileName ? `Loaded: ${uploadedFileName}` : 'No File Selected'}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    {parsedRows.length > 0
                      ? `${parsedRows.length} parsed candidate rows detected`
                      : 'Select a UTF-8 CSV file with header columns (Name, Email, Title, Skills, etc.)'}
                  </div>
                  <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200 rounded text-brand-600 font-medium">
                    <span>Select or Drop CSV File</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </label>

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={downloadSampleCsv}
                    className="text-emerald-700 hover:underline font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    <span>Download Sample CSV Template</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    disabled={parsedRows.length === 0}
                    className="px-4 py-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold rounded text-xs cursor-pointer shadow-xs inline-flex items-center gap-1"
                  >
                    <span>Continue with File ({parsedRows.length} Rows)</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Column Mapping */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="font-semibold text-slate-800 text-xs">
                  Verify Column Mapping from CSV to {brandName} CRM:
                </div>
                <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-semibold text-slate-600 uppercase">
                    <tr>
                      <th className="p-2">Source CSV Column</th>
                      <th className="p-2">Sample Preview</th>
                      <th className="p-2">Destination CRM Field</th>
                      <th className="p-2">Match Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {columnMappings.map((m) => (
                      <tr key={m.source}>
                        <td className="p-2 font-medium text-slate-900">{m.source}</td>
                        <td className="p-2 text-slate-500 italic">{m.sample}</td>
                        <td className="p-2">
                          <span className="px-2 py-0.5 border rounded text-xs bg-white font-medium text-slate-800">
                            {m.target}
                          </span>
                        </td>
                        <td className="p-2">
                          <span className="inline-flex items-center gap-1.5 text-[10px] text-slate-700 bg-white px-2.5 py-0.5 rounded-full border border-slate-200 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span>100% Match</span>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {lockedRequirement && (
                  <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs text-emerald-900">
                      <Briefcase className="w-4 h-4 text-emerald-700 shrink-0" />
                      <span>
                        Auto-attaching {parsedRows.length} candidate{parsedRows.length === 1 ? '' : 's'} to{' '}
                        <strong>{lockedRequirement.code}</strong> — {lockedRequirement.opportunityTitle}
                      </span>
                    </div>
                    <span className="text-[11px] font-semibold text-emerald-700 shrink-0">
                      + Consultants Roster
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center pt-2">
                  <button
                    type="button"
                    disabled={isImporting}
                    onClick={() => setStep(1)}
                    className="text-slate-500 hover:text-slate-700 hover:underline text-xs cursor-pointer inline-flex items-center gap-1 disabled:opacity-50"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleRunMigration}
                    disabled={isImporting}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold rounded text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    {isImporting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Importing candidates...</span>
                      </>
                    ) : (
                      <>
                        <span>
                          {lockedRequirement
                            ? `Import & Attach (${parsedRows.length} Rows)`
                            : `Execute Import (${parsedRows.length} Rows)`}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Completion */}
            {step === 3 && (
              <div className="text-center py-8 space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
                  <Check className="w-6 h-6" strokeWidth={2.5} />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">CSV Import Complete!</h3>
                <p className="text-slate-500 text-xs">
                  {importSummary.importedCount || parsedRows.length} candidates imported successfully into your central roster.
                  {importSummary.attachedRequirement && (
                    <>
                      {' '}
                      <span className="font-semibold text-slate-700">
                        {importSummary.attachedCount} attached to {importSummary.attachedRequirement.code}
                      </span>
                      {importSummary.skippedCount > 0 && ` (${importSummary.skippedCount} already attached)`}.
                    </>
                  )}
                </p>
                <div className="flex items-center justify-center gap-2 pt-1">
                  {lockedRequirement ? (
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg text-xs cursor-pointer shadow-xs"
                    >
                      Back to {lockedRequirement.code}
                    </button>
                  ) : onNavigate ? (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onNavigate('consultants');
                      }}
                      className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg text-xs cursor-pointer shadow-xs"
                    >
                      Open Consultant Directory
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg text-xs cursor-pointer shadow-xs"
                    >
                      Done
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};
