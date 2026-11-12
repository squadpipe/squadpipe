import React, { useState } from 'react';
import { Candidate } from '../../types';

interface ImportDataViewProps {
  onImportCandidates: (candidates: Candidate[]) => void;
  showToast: (title: string, message: string, icon?: string) => void;
}

export const ImportDataView: React.FC<ImportDataViewProps> = ({
  onImportCandidates,
  showToast,
}) => {
  const [activeTab, setActiveTab] = useState<'mapping' | 'preview'>('mapping');
  const [csvRows, setCsvRows] = useState<any[]>([
    {
      fullName: 'Suresh Patel',
      currentTitle: 'Lead Cloud Security Architect',
      workAuth: 'US Citizen',
      skillset: 'AWS, Terraform, Kubernetes, Helm, Python',
      hourlyRate: '$95/hr (W2)',
      relocation: 'Yes',
      recruiter: 'Marcus Brody',
    },
    {
      fullName: 'Deepika Rao',
      currentTitle: 'Senior Snowflake Data Engineer',
      workAuth: 'Green Card',
      skillset: 'Snowflake, PySpark, Databricks, dbt, SQL',
      hourlyRate: '$92/hr (W2)',
      relocation: 'No',
      recruiter: 'Sarah Jenkins',
    },
    {
      fullName: 'Amitabh Sen',
      currentTitle: 'Staff Java Microservices Architect',
      workAuth: 'H-1B',
      skillset: 'Java 17, Spring Boot, Kafka, AWS, Docker',
      hourlyRate: '$88/hr (C2C)',
      relocation: 'Yes',
      recruiter: 'Elena Rostova',
    },
  ]);

  const targetFields = [
    'Full Name',
    'Current Title',
    'Work Authorization',
    'Key Skillset',
    'Hourly Rate',
    'Relocation',
    'Assigned Recruiter',
  ];

  const handleExecuteImport = () => {
    const newCandidates: Candidate[] = csvRows.map((r, idx) => ({
      id: 'con_imp_' + (Date.now() + idx),
      fullName: r.fullName,
      phone: r.phone || '',
      email: r.email || (r.fullName ? `${r.fullName.toLowerCase().replace(/\s+/g, '.')}@candidate.com` : ''),
      workAuth: r.workAuth || '',
      education: r.education || '',
      currentTitle: r.currentTitle || '',
      skillset: r.skillset || '',
      hourlyRate: r.hourlyRate || '',
      relocation: r.relocation || '',
      resumeName: r.fullName ? r.fullName.replace(/\s+/g, '_') + '_Resume.pdf' : '',
      resumeFormat: 'PDF (CSV Import)',
      assignedRecruiter: r.recruiter || '',
      pipelineStage: 'Available / Bench',
    }));

    onImportCandidates(newCandidates);
    showToast(
      'Import Successful!',
      `Successfully ingested ${newCandidates.length} candidate profiles into the active bench!`,
      'fa-solid fa-circle-check text-emerald-400'
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 card-shadow flex items-center justify-between">
        <div>
          <h3 className="font-bold text-sm text-slate-800">Candidate CSV Import & Interactive Column Mapping</h3>
          <p className="text-xs text-slate-400">Migrate candidate benches, ATS exports, and agency rosters directly into TalentOS</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('mapping')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
              activeTab === 'mapping' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            Column Mapping
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
              activeTab === 'preview' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            Data Preview ({csvRows.length})
          </button>
        </div>
      </div>

      {activeTab === 'mapping' ? (
        <div className="bg-white p-6 rounded-xl border border-slate-200 card-shadow space-y-4">
          <div className="text-xs font-bold text-slate-800 mb-2">Automated Header Mapping Rules</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {targetFields.map((field, idx) => (
              <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-800">{field}</div>
                  <div className="text-[10px] text-emerald-600 font-mono mt-0.5">&larr; mapped to CSV column "{field}"</div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  Matched
                </span>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t flex justify-between items-center">
            <span className="text-xs text-slate-400">Sample candidate spreadsheet loaded and verified.</span>
            <button
              onClick={() => setActiveTab('preview')}
              className="px-4 py-2 bg-brand-600 text-white text-xs font-semibold rounded-lg hover:bg-brand-700 transition-colors"
            >
              Continue to Preview &rarr;
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 card-shadow overflow-hidden space-y-4 p-5">
          <div className="flex items-center justify-between pb-3 border-b">
            <div>
              <h4 className="font-bold text-xs text-slate-800">Preview Candidate Records</h4>
              <p className="text-[11px] text-slate-400">Review mapped fields before committing to PostgreSQL database</p>
            </div>
            <button
              onClick={handleExecuteImport}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm shadow-emerald-600/20 flex items-center gap-1.5 transition-all"
            >
              <i className="fa-solid fa-file-import text-xs"></i>
              <span>Execute Ingestion ({csvRows.length} Profiles)</span>
            </button>
          </div>

          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-[10px] uppercase font-bold text-slate-400 border-b">
                <th className="py-2.5 px-3">Candidate Name</th>
                <th className="py-2.5 px-3">Current Title</th>
                <th className="py-2.5 px-3">Work Auth</th>
                <th className="py-2.5 px-3">Rate</th>
                <th className="py-2.5 px-3">Key Skillset</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {csvRows.map((r, idx) => (
                <tr key={idx} className="hover:bg-slate-50/60">
                  <td className="py-3 px-3 font-bold text-slate-900">{r.fullName}</td>
                  <td className="py-3 px-3 text-slate-700">{r.currentTitle}</td>
                  <td className="py-3 px-3 font-mono text-[11px]">{r.workAuth}</td>
                  <td className="py-3 px-3 font-mono font-bold text-slate-800">{r.hourlyRate}</td>
                  <td className="py-3 px-3 font-mono text-[11px] text-slate-600">{r.skillset}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
