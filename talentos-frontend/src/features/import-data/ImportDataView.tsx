import React, { useState } from 'react';
import { CloudUpload, FileSpreadsheet, FileText } from 'lucide-react';
import { Candidate, Requirement } from '../../types';
import { useCurrency } from '../../utils/currency';
import { getWorkspaceBrandSlug, useWorkspaceBrand } from '../../utils/workspaceBrand';
import { downloadSampleCandidatesCsv } from '../../utils/csvCandidates';
import { CsvImportModal } from '../../components/modals/CsvImportModal';

interface ImportDataViewProps {
  onImportCandidates?: (candidates: Candidate[]) => void;
  onOpenResumeParser?: () => void;
  onNavigate?: (view: string) => void;
  requirements?: Requirement[];
  onRequirementUpdated?: (req: Requirement) => void;
  onOpenRequirement?: (req: Requirement) => void;
  showToast: (title: string, message: string, icon?: string) => void;
}

export const ImportDataView: React.FC<ImportDataViewProps> = ({
  onImportCandidates,
  onOpenResumeParser,
  onNavigate,
  requirements = [],
  onRequirementUpdated,
  onOpenRequirement,
  showToast,
}) => {
  const { symbol: currencySymbol } = useCurrency();
  const brand = useWorkspaceBrand();
  const brandName = (brand.agencyName || brand.legalEntityName || 'Workspace').trim();
  const [showCsvModal, setShowCsvModal] = useState(false);

  const downloadSampleCsv = () => {
    const sampleCsvFilename = downloadSampleCandidatesCsv(getWorkspaceBrandSlug(), currencySymbol);
    showToast(
      'Sample CSV Downloaded',
      `Downloaded ${sampleCsvFilename} template with 3 formatted sample candidates.`,
      'fa-solid fa-file-csv text-emerald-500'
    );
  };

  return (
    <section className="max-w-7xl mx-auto space-y-5 animate-fade-in select-none">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 tracking-tight">Data Import &amp; Legacy Migration</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Migrate legacy Excel sheets, Google Sheets, and candidate resume folders into {brandName} CRM.
        </p>
      </div>

      {/* 2 Streamlined Cards: CSV Import & Resume Parser */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Bulk CSV Spreadsheet Import */}
        <div className="bg-white rounded-xl border border-slate-200 card-shadow p-6 space-y-4">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Bulk CSV Spreadsheet Import</span>
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Upload candidate rosters from Excel or CSV spreadsheets and map columns to CRM fields with validation.{' '}
            <button
              type="button"
              onClick={downloadSampleCsv}
              className="font-semibold text-brand-600 hover:text-brand-700 underline cursor-pointer"
            >
              Download sample CSV
            </button>
          </p>
          <div
            onClick={() => setShowCsvModal(true)}
            className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-brand-600 cursor-pointer bg-slate-50/50 hover:bg-slate-50 transition-all group"
          >
            <CloudUpload className="w-8 h-8 text-brand-600 mx-auto mb-2 group-hover:scale-110 transition-transform" />
            <div className="text-xs font-semibold text-slate-700">Launch CSV Column Mapper</div>
            <div className="text-[11px] text-slate-400 mt-1">Preview rows, map fields &amp; bulk import candidates</div>
          </div>
        </div>

        {/* Card 2: Resume Parser (PDF & Word) */}
        <div className="bg-white rounded-xl border border-slate-200 card-shadow p-6 space-y-4">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <FileText className="w-4 h-4 text-brand-600" />
            <span>Resume Parser (PDF &amp; Word)</span>
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Extract candidate name, contact details, skills, education, and current title directly from PDF or Word resumes using our offline NLP parser.
          </p>
          <div
            onClick={() => {
              if (onOpenResumeParser) onOpenResumeParser();
            }}
            className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-brand-600 cursor-pointer bg-slate-50/50 hover:bg-slate-50 transition-all group"
          >
            <FileText className="w-8 h-8 text-brand-600 mx-auto mb-2 group-hover:scale-110 transition-transform" />
            <div className="text-xs font-semibold text-slate-700">Parse Resume File</div>
            <div className="text-[11px] text-slate-400 mt-1">Offline spaCy &amp; section-aware extraction from PDF/DOCX</div>
          </div>
        </div>
      </div>

      <CsvImportModal
        isOpen={showCsvModal}
        onClose={() => setShowCsvModal(false)}
        requirements={requirements}
        onImportComplete={({ candidates: importedCands, updatedRequirement }) => {
          if (onImportCandidates) onImportCandidates(importedCands);
          if (updatedRequirement && onRequirementUpdated) onRequirementUpdated(updatedRequirement);
        }}
        onNavigate={onNavigate}
        onOpenRequirement={onOpenRequirement}
        showToast={showToast}
      />
    </section>
  );
};
