import React from 'react';
import { CloudUpload, FileSpreadsheet, FileText } from 'lucide-react';
import { useCurrency } from '../../utils/currency';
import { getWorkspaceBrandSlug, useWorkspaceBrand } from '../../utils/workspaceBrand';
import { downloadSampleCandidatesCsv } from '../../utils/csvCandidates';

interface ImportDataViewProps {
  onOpenResumeParser?: () => void;
  onOpenCsvImport?: () => void;
  showToast: (title: string, message: string, icon?: string) => void;
}

export const ImportDataView: React.FC<ImportDataViewProps> = ({
  onOpenResumeParser,
  onOpenCsvImport,
  showToast,
}) => {
  const { symbol: currencySymbol } = useCurrency();
  const brand = useWorkspaceBrand();
  const brandName = (brand.agencyName || brand.legalEntityName || 'Workspace').trim();

  const downloadSampleCsv = () => {
    const sampleCsvFilename = downloadSampleCandidatesCsv(getWorkspaceBrandSlug(), currencySymbol);
    showToast(
      'Sample CSV Downloaded',
      `Downloaded ${sampleCsvFilename} template with 3 formatted sample candidates.`,
      'csv'
    );
  };

  return (
    <section className="max-w-7xl mx-auto space-y-6 animate-fade-in select-none">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-slate-900 tracking-tight">Import Data</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Bring in candidate spreadsheets or upload resumes directly into {brandName}.
        </p>
      </div>

      {/* 2 Streamlined Cards: Spreadsheet Import & Resume Upload */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Import from Spreadsheet */}
        <div className="bg-white rounded-xl border border-slate-200 card-shadow p-6 space-y-4">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Import from Spreadsheet</span>
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Upload a CSV or Excel spreadsheet to add multiple candidates at once and match your columns.{' '}
            <button
              type="button"
              onClick={downloadSampleCsv}
              className="font-semibold text-brand-600 hover:text-brand-700 underline cursor-pointer"
            >
              Download sample file
            </button>
          </p>
          <div
            onClick={() => {
              if (onOpenCsvImport) onOpenCsvImport();
            }}
            className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-brand-600 cursor-pointer bg-slate-50/50 hover:bg-slate-50 transition-all group"
          >
            <CloudUpload className="w-8 h-8 text-brand-600 mx-auto mb-2 group-hover:scale-110 transition-transform" />
            <div className="text-xs font-semibold text-slate-700">Open Spreadsheet Import Page</div>
            <div className="text-[11px] text-slate-400 mt-1">Preview rows, match columns &amp; import candidates</div>
          </div>
        </div>

        {/* Card 2: Add Candidate from Resume (PDF & Word) */}
        <div className="bg-white rounded-xl border border-slate-200 card-shadow p-6 space-y-4">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <FileText className="w-4 h-4 text-brand-600" />
            <span>Add Candidate from Resume</span>
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Upload a PDF or Word resume to automatically fill in the candidate&apos;s name, contact details, skills, education, and job title.
          </p>
          <div
            onClick={() => {
              if (onOpenResumeParser) onOpenResumeParser();
            }}
            className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-brand-600 cursor-pointer bg-slate-50/50 hover:bg-slate-50 transition-all group"
          >
            <FileText className="w-8 h-8 text-brand-600 mx-auto mb-2 group-hover:scale-110 transition-transform" />
            <div className="text-xs font-semibold text-slate-700">Open Resume Parser Page</div>
            <div className="text-[11px] text-slate-400 mt-1">Supports single &amp; bulk PDF / Word (.docx) resumes</div>
          </div>
        </div>
      </div>
    </section>
  );
};
