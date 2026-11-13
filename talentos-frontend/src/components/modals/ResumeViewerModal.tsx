import React, { useState } from 'react';
import {
  FileText,
  Download,
  X,
  Zap,
  ChevronDown,
  Mail,
  Phone,
  ShieldCheck,
  MapPin,
  GraduationCap,
  Briefcase,
  Code2,
  CheckCircle2,
  Building2,
  Sparkles,
  BadgeCheck,
} from 'lucide-react';
import { Candidate, Requirement } from '../../types';
import { useCurrency } from '../../utils/currency';
import { generateCandidateResumePdf } from '../../utils/pdfGenerator';
import {
  cleanExtractedResumeText,
  parseResumeSections,
  resolveCandidateEducation,
} from '../../utils/resumeFormatter';

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

  const initials = (candidate.fullName || 'C')
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const structuredSections = parseResumeSections(candidate.rawSnippet, candidate.fullName);
  const resolvedEducation = resolveCandidateEducation(candidate.education, candidate.rawSnippet);

  const renderSectionIcon = (title: string) => {
    const lower = title.toLowerCase();
    if (lower.includes('education') || lower.includes('academic')) {
      return <GraduationCap className="w-3.5 h-3.5 text-brand-600" />;
    }
    if (lower.includes('skill') || lower.includes('technolog') || lower.includes('competenc')) {
      return <Code2 className="w-3.5 h-3.5 text-brand-600" />;
    }
    return <Briefcase className="w-3.5 h-3.5 text-brand-600" />;
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="px-6 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center shadow-xs">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-xs font-bold leading-tight">
                {candidate.fullName} &mdash; Extracted Resume Profile
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {candidate.workAuth} &bull; {candidate.currentTitle}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={downloadFormattedResumePdf}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-100 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-300" />
              <span>Download PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close resume preview"
              className="text-slate-400 hover:text-white w-7 h-7 rounded-lg hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Clean Formatted Resume Document Canvas */}
        <div className="p-6 sm:p-8 overflow-y-auto bg-slate-100/90 flex justify-center flex-1">
          <div className="bg-white w-full max-w-2xl rounded-xl shadow-sm border border-slate-200 overflow-hidden text-slate-800 text-xs">
            {/* Candidate Hero Banner */}
            <div className="px-7 py-6 bg-gradient-to-br from-slate-50 via-white to-brand-50/40 border-b border-slate-200/80">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-slate-900 text-white font-bold text-sm flex items-center justify-center shadow-xs flex-shrink-0">
                    {initials}
                  </div>
                  <div>
                    <h1 className="text-lg font-extrabold text-slate-900 tracking-tight leading-snug">
                      {candidate.fullName}
                    </h1>
                    <p className="text-brand-700 font-semibold text-xs mt-0.5">
                      {candidate.currentTitle}
                    </p>
                  </div>
                </div>
                {candidate.pipelineStage && (
                  <span className="self-start inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    <span>{candidate.pipelineStage}</span>
                  </span>
                )}
              </div>

              {/* Contact & Eligibility Pills with Real Icons */}
              <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                {candidate.email && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-slate-200/90">
                    <Mail className="w-3 h-3 text-slate-400" />
                    <span>{candidate.email}</span>
                  </span>
                )}
                {candidate.phone && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-slate-200/90">
                    <Phone className="w-3 h-3 text-slate-400" />
                    <span>{candidate.phone}</span>
                  </span>
                )}
                {candidate.workAuth && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-slate-200/90">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    <span>{candidate.workAuth}</span>
                  </span>
                )}
                {candidate.relocation && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-slate-200/90">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    <span>Relocation: {candidate.relocation}</span>
                  </span>
                )}
              </div>
            </div>

            <div className="p-7 space-y-6">
              {/* Executive Overview */}
              <div>
                <div className="flex items-center gap-2 pb-1.5 mb-2.5 border-b border-slate-100">
                  <Sparkles className="w-3.5 h-3.5 text-brand-600" />
                  <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-800">
                    Executive Summary
                  </h2>
                </div>
                <p className="text-slate-600 text-xs leading-relaxed pl-3 border-l-2 border-brand-500/70">
                  {candidate.currentTitle || 'Technology Consultant'} specializing in{' '}
                  {skills.length > 0 ? skills.slice(0, 6).join(', ') : 'enterprise engineering delivery'}.
                  Structured profile extracted and verified for client requisition submittal and PDF export.
                </p>
              </div>

              {/* Core Competencies Matrix */}
              {skills.length > 0 && (
                <div>
                  <div className="flex items-center justify-between pb-1.5 mb-2.5 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <Code2 className="w-3.5 h-3.5 text-brand-600" />
                      <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-800">
                        Core Competencies &amp; Technologies
                      </h2>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {skills.length} skills
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {skills.map((skill, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-md text-[11px] bg-slate-50 border border-slate-200/90 text-slate-700 font-medium hover:border-brand-300 hover:bg-brand-50/40 transition-colors"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Structured Extracted Resume Content */}
              <div>
                <div className="flex items-center gap-2 pb-1.5 mb-3 border-b border-slate-100">
                  <Briefcase className="w-3.5 h-3.5 text-brand-600" />
                  <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-800">
                    {structuredSections.length > 0
                      ? 'Extracted Resume Details & Experience'
                      : 'Professional Experience'}
                  </h2>
                </div>

                {structuredSections.length > 0 ? (
                  <div className="space-y-3">
                    {structuredSections.map((section, sIdx) => (
                      <div
                        key={`${section.title}_${sIdx}`}
                        className="rounded-lg border border-slate-200/80 bg-slate-50/60 p-3.5 space-y-2"
                      >
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-800">
                          {renderSectionIcon(section.title)}
                          <span>{section.title}</span>
                        </div>
                        <div className="space-y-1.5 text-[11px] text-slate-700 leading-relaxed">
                          {section.items.map((line, lIdx) => {
                            const isBullet = line.startsWith('•');
                            const content = isBullet ? line.slice(1).trim() : line;
                            return isBullet ? (
                              <div key={lIdx} className="flex items-start gap-2 pl-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-brand-500 mt-1.5 flex-shrink-0"></span>
                                <span>{content}</span>
                              </div>
                            ) : (
                              <div key={lIdx} className="text-slate-600 pl-1">
                                {cleanExtractedResumeText(content)}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-slate-200/80 bg-slate-50/60 p-4 space-y-1.5">
                    <div className="flex justify-between font-bold text-slate-900 text-xs">
                      <span>{candidate.currentTitle}</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600">
                        Active Profile
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Specializing in {candidate.skillset || 'enterprise technology systems'}. Structured
                      extracted resume profile ready for client submission or formatted PDF export.
                    </p>
                  </div>
                )}
              </div>

              {/* Education & Credentials */}
              <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-4 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-brand-600 flex items-center justify-center flex-shrink-0">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Education &amp; Credentials
                  </div>
                  <div className="text-xs font-bold text-slate-900 mt-0.5">
                    {resolvedEducation}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 mt-1">
                    <span className="inline-flex items-center gap-1">
                      <BadgeCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Verified Candidate Profile</span>
                    </span>
                    <span className="text-slate-300">&bull;</span>
                    <span>{candidate.workAuth || 'Authorized'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Actions Footer */}
        <div className="px-6 py-3.5 bg-white border-t border-slate-200 flex items-center justify-between text-xs">
          <div className="hidden sm:flex items-center gap-1.5 text-slate-500 text-[11px]">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Verified Consultant Record &bull; Direct Import Verified</span>
          </div>
          <div className="flex items-center gap-2.5 ml-auto">
            {/* 1-Click Submit to Open Requisition */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowQuickSubmitDropdown(!showQuickSubmitDropdown)}
                className="px-3.5 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-xs flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 text-amber-300" />
                <span>Submit to Open Requisition</span>
                <ChevronDown className="w-3.5 h-3.5 opacity-80" />
              </button>

              {showQuickSubmitDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowQuickSubmitDropdown(false)}
                  ></div>
                  <div className="absolute bottom-full right-0 mb-1.5 w-80 bg-white border border-slate-200 rounded-xl shadow-2xl py-2 z-50 text-xs animate-fade-in divide-y divide-slate-100">
                    <div className="px-3.5 py-1.5 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Select Target Job Requisition
                    </div>
                    <div className="max-h-60 overflow-y-auto py-1">
                      {openReqs.length === 0 ? (
                        <div className="px-3.5 py-4 text-slate-400 text-center text-[11px]">
                          No open requisitions available
                        </div>
                      ) : (
                        openReqs.map((req) => (
                          <button
                            type="button"
                            key={req.id}
                            onClick={() => {
                              onSubmitToReq(candidate, req);
                              setShowQuickSubmitDropdown(false);
                              onClose();
                            }}
                            className="w-full px-3.5 py-2.5 text-left hover:bg-slate-50 flex flex-col transition-colors group cursor-pointer"
                          >
                            <div className="font-semibold text-slate-900 group-hover:text-brand-600 flex items-center justify-between gap-2">
                              <span className="truncate">{req.opportunityTitle}</span>
                              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 flex-shrink-0">
                                {req.code}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-2 truncate">
                              <span className="inline-flex items-center gap-1 truncate">
                                <Building2 className="w-3 h-3 text-slate-400" />
                                {req.companyName}
                              </span>
                              <span className="text-slate-300">&bull;</span>
                              <span className="inline-flex items-center gap-1 truncate">
                                <MapPin className="w-3 h-3 text-slate-400" />
                                {req.location}
                              </span>
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
              type="button"
              onClick={() => {
                setShowQuickSubmitDropdown(false);
                onClose();
              }}
              className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium text-xs transition-colors cursor-pointer"
            >
              Close Preview
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
