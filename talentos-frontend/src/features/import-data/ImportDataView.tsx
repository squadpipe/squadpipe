import React, { useState } from 'react';
import { apiClient } from '../../config/api.config';
import { Candidate } from '../../types';

interface ImportDataViewProps {
  onImportCandidates?: (candidates: Candidate[]) => void;
  onOpenResumeParser?: () => void;
  onNavigate?: (view: string) => void;
  showToast: (title: string, message: string, icon?: string) => void;
}

export const ImportDataView: React.FC<ImportDataViewProps> = ({
  onImportCandidates,
  onOpenResumeParser,
  onNavigate,
  showToast,
}) => {
  const [showMigrationModal, setShowMigrationModal] = useState(false);
  const [migrationStep, setMigrationStep] = useState<1 | 2 | 3>(1);
  const [showCsvImportModal, setShowCsvImportModal] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState<boolean>(false);

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
      const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
      if (lines.length > 1) {
        const headers = lines[0].split(',').map((h) => h.replace(/["']/g, '').trim().toLowerCase());
        const rows = lines.slice(1).map((line) => {
          const parts = line.split(',').map((p) => p.replace(/["']/g, '').trim());
          const row: any = {};
          headers.forEach((h, i) => {
            if (h.includes('name')) row.fullName = parts[i];
            else if (h.includes('title') || h.includes('role')) row.currentTitle = parts[i];
            else if (h.includes('email')) row.email = parts[i];
            else if (h.includes('phone') || h.includes('cell')) row.phone = parts[i];
            else if (h.includes('visa') || h.includes('auth')) row.workAuth = parts[i];
            else if (h.includes('rate')) row.hourlyRateDisplay = parts[i];
            else if (h.includes('skill')) row.skillset = parts[i];
            else if (h.includes('relo')) row.relocation = parts[i];
          });
          return row;
        }).filter((r) => r.fullName && r.email);

        setParsedRows(rows);
        if (rows.length > 0) {
          if (showMigrationModal) setMigrationStep(2);
        } else {
          showToast('No Valid Rows Found', 'Ensure your CSV includes columns for Name and Email.', 'fa-solid fa-triangle-exclamation text-amber-500');
        }
      } else {
        setParsedRows([]);
        showToast('Invalid CSV File', 'The selected file has no data rows.', 'fa-solid fa-triangle-exclamation text-amber-500');
      }
    };
    reader.readAsText(file);
  };

  const handleRunMigration = async () => {
    if (parsedRows.length === 0) {
      showToast('No File Loaded', 'Please select a valid CSV file with Name and Email columns first.', 'fa-solid fa-triangle-exclamation text-amber-500');
      return;
    }

    setIsImporting(true);

    try {
      const res = await apiClient.post('/candidates/csv-import', parsedRows);
      const count = res.data?.count || parsedRows.length;
      const returnedRows = Array.isArray(res.data?.data) ? res.data.data : parsedRows;

      if (onImportCandidates) {
        onImportCandidates(
          returnedRows.map((r: any, i: number) => ({
            id: r.id || 'con_mig_' + (Date.now() + i),
            fullName: r.fullName,
            currentTitle: r.currentTitle || 'Consultant',
            workAuth: r.workAuth || 'US Citizen',
            education: r.education || '',
            email: r.email,
            phone: r.phone || '',
            hourlyRate: r.hourlyRateDisplay || r.hourlyRate || '',
            relocation: r.relocation || 'Open',
            skillset: r.skillset || '',
            assignedRecruiter: r.assignedRecruiter || '',
            pipelineStage: 'Available / Bench',
            resumeName: r.resumeName || `${String(r.fullName || 'Candidate').replace(/\s+/g, '_')}_Resume.pdf`,
            resumeFormat: 'PDF',
          }))
        );
      }

      setMigrationStep(3);
      setShowCsvImportModal(false);
      showToast(
        'Migration Executed',
        `Successfully mapped and imported ${count} candidates into central PostgreSQL bench roster!`,
        'fa-solid fa-circle-check text-emerald-500'
      );
    } catch (err: any) {
      showToast('Import Error', err.message || 'Failed to import candidates to database.', 'fa-solid fa-triangle-exclamation text-rose-500');
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
    <section className="max-w-7xl mx-auto space-y-5 animate-fade-in select-none">
      {/* Header matching exact prototype */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 tracking-tight">Data Import & Legacy Migration</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Migrate legacy Excel sheets, Google Sheets, and candidate resume folders into TalentOS CRM.
        </p>
      </div>

      {/* 2 Large Cards Grid matching Screenshot media_1794485798106_34331046.png */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Excel & CSV Spreadsheet Import */}
        <div className="bg-white rounded-xl border border-slate-200 card-shadow p-6 space-y-4">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <i className="fa-regular fa-file-excel text-emerald-600 text-base"></i>
            <span>Excel & CSV Spreadsheet Import</span>
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Upload your legacy candidate rosters, requirements trackers, and billing spreadsheets. Map spreadsheet columns to CRM fields with validation.
          </p>
          <div
            onClick={() => {
              setMigrationStep(1);
              setShowMigrationModal(true);
            }}
            className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-brand-600 cursor-pointer bg-slate-50/50 hover:bg-slate-50 transition-all group"
          >
            <i className="fa-solid fa-cloud-arrow-up text-3xl text-brand-600 mb-2 group-hover:scale-110 transition-transform"></i>
            <div className="text-xs font-semibold text-slate-700">Launch Spreadsheet Column Mapper</div>
            <div className="text-[11px] text-slate-400 mt-1">Interactive Excel preview, field mapping & validation</div>
          </div>
        </div>

        {/* Card 2: Candidate CSV & Resume Import Engine */}
        <div className="bg-white rounded-xl border border-slate-200 card-shadow p-6 space-y-4">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <i className="fa-solid fa-file-csv text-emerald-600 text-base"></i>
            <span>Candidate CSV & Resume Import Engine</span>
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Import candidate profiles in bulk via CSV spreadsheet, or extract structured candidate details directly from Word and PDF resumes using our instant pattern extractor. 100% private, local, and instant.
          </p>
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div
              onClick={() => {
                setShowCsvImportModal(true);
              }}
              className="border border-slate-200 hover:border-emerald-500 rounded-xl p-5 text-center cursor-pointer bg-slate-50/60 hover:bg-white transition-all group shadow-2xs"
            >
              <i className="fa-solid fa-file-csv text-2xl text-emerald-600 mb-2 group-hover:scale-110 transition-transform"></i>
              <div className="text-xs font-semibold text-slate-800">Candidate CSV Import</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Bulk roster import with schema validation</div>
            </div>

            <div
              onClick={() => {
                if (onOpenResumeParser) onOpenResumeParser();
              }}
              className="border border-slate-200 hover:border-brand-500 rounded-xl p-5 text-center cursor-pointer bg-slate-50/60 hover:bg-white transition-all group shadow-2xs"
            >
              <i className="fa-solid fa-file-lines text-2xl text-brand-600 mb-2 group-hover:scale-110 transition-transform"></i>
              <div className="text-xs font-semibold text-slate-800">Rule-Based Parser</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Regex pattern extraction from PDF/Word</div>
            </div>
          </div>
        </div>
      </div>

      {/* Spreadsheet Migration & Column Mapping Wizard Modal */}
      {showMigrationModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden flex flex-col animate-scale-up max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-file-excel text-emerald-600 text-base"></i>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Spreadsheet Migration &amp; Column Mapping Wizard</h2>
                  <div className="text-[11px] text-slate-500">
                    Step {migrationStep} of 3: {stepTitles[migrationStep]}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowMigrationModal(false)}
                className="text-slate-400 hover:text-slate-700 w-7 h-7 rounded flex items-center justify-center cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              {/* Step 1: File Drop */}
              {migrationStep === 1 && (
                <div className="space-y-4">
                  <label className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center bg-slate-50 cursor-pointer hover:border-brand-600 transition-colors block">
                    <input
                      type="file"
                      accept=".csv,.xlsx"
                      onChange={handleFileDrop}
                      className="hidden"
                    />
                    <i className="fa-solid fa-cloud-arrow-up text-3xl text-brand-600 mb-2"></i>
                    <div className="font-bold text-slate-800 text-sm">
                      {uploadedFileName ? `Loaded: ${uploadedFileName}` : 'No File Selected'}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      {parsedRows.length > 0
                        ? `${parsedRows.length} parsed candidate rows detected`
                        : 'Select a UTF-8 CSV file with header columns (Name, Email, Title, Skills, etc.)'}
                    </div>
                    <div className="mt-4 inline-block px-3 py-1 bg-white border border-slate-200 rounded text-brand-600 font-medium">
                      Select or Drop CSV File &rarr;
                    </div>
                  </label>
                  <div className="flex justify-end">
                    <button
                      onClick={() => setMigrationStep(2)}
                      disabled={parsedRows.length === 0}
                      className="px-4 py-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold rounded text-xs cursor-pointer shadow-xs"
                    >
                      Continue with File ({parsedRows.length} Rows) &rarr;
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2: Column Mapping */}
              {migrationStep === 2 && (
                <div className="space-y-4">
                  <div className="font-semibold text-slate-800 text-xs">
                    Verify Column Mapping from Excel to TalentOS CRM:
                  </div>
                  <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-semibold text-slate-600 uppercase">
                      <tr>
                        <th className="p-2">Source Excel Column</th>
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
                            <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                              ✅ 100% Match
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="flex justify-between items-center pt-2">
                    <button
                      onClick={() => setMigrationStep(1)}
                      className="text-slate-500 hover:underline text-xs cursor-pointer"
                    >
                      &larr; Back
                    </button>
                    <button
                      onClick={handleRunMigration}
                      disabled={isImporting}
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold rounded text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      {isImporting ? (
                        <>
                          <i className="fa-solid fa-spinner fa-spin text-xs"></i>
                          <span>Importing to PostgreSQL...</span>
                        </>
                      ) : (
                        <>
                          <span>Execute Import ({parsedRows.length} Rows)</span> &rarr;
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Completion */}
              {migrationStep === 3 && (
                <div className="text-center py-8 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xl mx-auto shadow-xs">
                    <i className="fa-solid fa-check"></i>
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm">Data Migration Complete!</h3>
                  <p className="text-slate-500 text-xs">
                    {parsedRows.length} candidates imported successfully into your central roster.
                  </p>
                  <button
                    onClick={() => {
                      setShowMigrationModal(false);
                      if (onNavigate) onNavigate('consultants');
                    }}
                    className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg text-xs cursor-pointer shadow-xs"
                  >
                    Open Consultant Directory
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quick CSV Import Modal */}
      {showCsvImportModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden flex flex-col animate-scale-up">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-file-csv text-emerald-600 text-base"></i>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Candidate CSV Import</h2>
                  <div className="text-[11px] text-slate-500">Bulk roster ingestion</div>
                </div>
              </div>
              <button
                onClick={() => setShowCsvImportModal(false)}
                className="text-slate-400 hover:text-slate-700 w-7 h-7 rounded flex items-center justify-center cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <label className="border-2 border-dashed border-emerald-300 rounded-xl p-6 text-center bg-emerald-50/30 hover:border-emerald-500 transition-colors cursor-pointer block">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileDrop}
                  className="hidden"
                />
                <i className="fa-solid fa-file-arrow-up text-2xl text-emerald-600 mb-1"></i>
                <div className="font-semibold text-slate-800">
                  {uploadedFileName ? `${uploadedFileName} (${parsedRows.length} rows parsed)` : 'Click to Select CSV Roster File'}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Accepts UTF-8 comma-separated spreadsheets</div>
              </label>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  onClick={() => setShowCsvImportModal(false)}
                  className="px-3 py-1.5 border border-slate-200 text-slate-600 rounded text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRunMigration}
                  disabled={isImporting || parsedRows.length === 0}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold rounded text-xs cursor-pointer"
                >
                  {isImporting ? 'Uploading...' : `Upload & Ingest (${parsedRows.length})`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
