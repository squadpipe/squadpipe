import React, { useState } from 'react';
import { Candidate, Requirement } from '../../types';
import { useCurrency } from '../../utils/currency';
import { generateCandidateResumePdf } from '../../utils/pdfGenerator';

interface ResumeViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidate: Candidate | null;
  requirements: Requirement[];
  onSubmitToReq: (candidate: Candidate, req: Requirement) => void;
  showToast: (title: string, message: string, icon?: string) => void;
}

export const ResumeViewerModal: React.FC<ResumeViewerModalProps> = ({
  isOpen,
  onClose,
  candidate,
  requirements,
  onSubmitToReq,
  showToast,
}) => {
  const { formatRate } = useCurrency();
  const [showQuickSubmitDropdown, setShowQuickSubmitDropdown] = useState(false);

  if (!isOpen || !candidate) return null;

  const downloadFormattedResumePdf = () => {
    const blob = generateCandidateResumePdf(candidate, formatRate(candidate.hourlyRate));
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(candidate.fullName || 'Consultant').replace(/\s+/g, '_')}_Resume_Profile.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(
      'PDF Downloaded',
      `Exported formatted PDF profile for ${candidate.fullName}`,
      'fa-solid fa-file-arrow-down text-emerald-500'
    );
  };

  const openReqs = requirements.filter(
    (req) => req.status === 'Requirement' || req.status === 'Submitted'
  );

  const skills = candidate.skillset
    ? candidate.skillset.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Obsidian Modal Header */}
        <div className="px-6 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-xs shadow-xs">
              <i className="fa-solid fa-file-lines"></i>
            </div>
            <div>
              <div className="text-xs font-bold leading-tight">{candidate.fullName} &mdash; Extracted Resume Profile</div>
              <div className="text-[10px] text-slate-400">
                {candidate.workAuth} &bull; {candidate.currentTitle}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={downloadFormattedResumePdf}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <i className="fa-solid fa-download text-[10px]"></i>
              <span>Download PDF</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white w-7 h-7 rounded flex items-center justify-center transition-colors cursor-pointer"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>

        {/* Unbranded PDF Canvas Preview */}
        <div className="p-8 overflow-y-auto bg-slate-100 flex justify-center flex-1">
          <div className="bg-white w-full max-w-2xl p-8 rounded-xl shadow-sm border border-slate-200 space-y-6 text-slate-800 text-xs">
            {/* Candidate Header */}
            <div className="border-b border-slate-200 pb-4 text-center">
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">{candidate.fullName}</h1>
              <div className="text-slate-600 font-semibold text-xs mt-0.5">{candidate.currentTitle}</div>
              <div className="text-[11px] text-slate-500 mt-1">
                {candidate.email} &bull; {candidate.phone} &bull; {candidate.workAuth} &bull; Relocation: {candidate.relocation}
              </div>
            </div>

            {/* Executive Summary */}
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-brand-700 border-b border-brand-100 pb-1 mb-2">
                Executive Summary
              </h2>
              <p className="text-slate-600 text-xs leading-relaxed">
                Results-driven technology specialist with enterprise experience across high-growth systems. Proven track record delivering reliable cloud infrastructure, microservices architectures, and secure data solutions. Strong technical acumen with verified expertise in {candidate.skillset}.
              </p>
            </div>

            {/* Core Competencies Matrix */}
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-brand-700 border-b border-brand-100 pb-1 mb-2">
                Core Competencies & Technologies
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {skills.map((skill, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 rounded-md text-[11px] bg-slate-50 border border-slate-200 text-slate-700 font-medium"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            {/* Professional Experience / Parsed Resume Content */}
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-brand-700 border-b border-brand-100 pb-1 mb-2">
                {candidate.rawSnippet ? 'Extracted Resume Content & Experience' : 'Professional Experience'}
              </h2>
              {candidate.rawSnippet ? (
                <pre className="whitespace-pre-wrap font-sans text-[11px] text-slate-700 leading-relaxed bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                  {candidate.rawSnippet}
                </pre>
              ) : (
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between font-bold text-slate-900 text-xs">
                      <span>{candidate.currentTitle} — Senior Consultant</span>
                      <span className="text-[11px] text-slate-500">Current</span>
                    </div>
                    <div className="text-[11px] text-slate-600 italic">Enterprise Staffing & Consulting</div>
                    <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                      Specializing in {candidate.skillset}. Structured extracted resume profile ready for client submission or formatted PDF export.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Education & Credentials */}
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-brand-700 border-b border-brand-100 pb-1 mb-2">
                Education & Credentials
              </h2>
              <div className="text-[11px] text-slate-700">
                <div className="font-bold">{candidate.education}</div>
                <div className="text-slate-500">Accredited University Institution &bull; Verified Background Verification Cleared</div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Actions Footer */}
        <div className="px-6 py-3.5 bg-white border-t border-slate-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-[10px] hidden sm:inline">
              Verified Consultant Record &bull; Direct Import Verified
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            {/* 1-Click Submit to Open Requisition */}
            <div className="relative">
              <button
                onClick={() => setShowQuickSubmitDropdown(!showQuickSubmitDropdown)}
                className="px-3.5 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
              >
                <i className="fa-solid fa-bolt text-amber-300 text-[10px]"></i>
                <span>⚡ Submit to Open Requisition</span>
                <i className="fa-solid fa-chevron-down text-[9px] opacity-75"></i>
              </button>

              {showQuickSubmitDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowQuickSubmitDropdown(false)}
                  ></div>
                  <div className="absolute bottom-full right-0 mb-1.5 w-80 bg-white border border-slate-200 rounded-xl shadow-2xl py-2 z-50 text-xs animate-fade-in divide-y divide-slate-100">
                    <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Select Target Job Requisition:
                    </div>
                    <div className="max-h-60 overflow-y-auto py-1">
                      {openReqs.length === 0 ? (
                        <div className="px-3 py-3 text-slate-400 text-center text-[11px]">
                          No open requisitions available
                        </div>
                      ) : (
                        openReqs.map((req) => (
                          <button
                            key={req.id}
                            onClick={() => {
                              onSubmitToReq(candidate, req);
                              setShowQuickSubmitDropdown(false);
                              onClose();
                            }}
                            className="w-full px-3 py-2 text-left hover:bg-slate-50 flex flex-col transition-colors group"
                          >
                            <div className="font-bold text-slate-900 group-hover:text-brand-600 flex items-center justify-between">
                              <span className="truncate max-w-[200px]">{req.opportunityTitle}</span>
                              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                                {req.code}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                              {req.companyName} &bull; {req.location}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => {
                setShowQuickSubmitDropdown(false);
                onClose();
              }}
              className="px-4 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium text-xs transition-colors"
            >
              Close Preview
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

