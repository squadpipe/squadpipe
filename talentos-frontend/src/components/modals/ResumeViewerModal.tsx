import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  UserCheck,
  Search,
  Layers,
  Info,
} from 'lucide-react';
import { Candidate, Requirement } from '../../types';
import { useCurrency } from '../../utils/currency';
import { generateCandidateResumePdf } from '../../utils/pdfGenerator';
import { initWorkspaceBrand, useWorkspaceBrand } from '../../utils/workspaceBrand';
import {
  cleanExtractedResumeText,
  parseResumeSections,
  resolveCandidateEducation,
  ResumeSection,
} from '../../utils/resumeFormatter';
import { ModalPortal } from '../shared/ModalPortal';

interface ResumeViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidate: Candidate | null;
  requirements: Requirement[];
  rateMasked?: boolean;
  onSubmitToReq: (candidate: Candidate, req: Requirement) => void;
  showToast: (title: string, message: string, icon?: string) => void;
}

const STAGE_STYLE_MAP: Record<string, { badge: string; dot: string }> = {
  'available / bench': {
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
  },
  submitted: {
    badge: 'bg-blue-50 text-blue-700 border-blue-200',
    dot: 'bg-blue-500',
  },
  interview: {
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-500',
  },
  selected: {
    badge: 'bg-purple-50 text-purple-700 border-purple-200',
    dot: 'bg-purple-500',
  },
  billable: {
    badge: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    dot: 'bg-indigo-500',
  },
};

const SUMMARY_SECTION_TITLES = new Set([
  'summary',
  'professional summary',
  'executive summary',
  'objective',
]);

function getStageStyle(stage?: string): { badge: string; dot: string } {
  const key = (stage || '').trim().toLowerCase();
  return (
    STAGE_STYLE_MAP[key] || {
      badge: 'bg-slate-100 text-slate-700 border-slate-200',
      dot: 'bg-slate-500',
    }
  );
}

function getSectionIcon(title: string) {
  const lower = title.toLowerCase();
  if (lower.includes('education') || lower.includes('academic')) {
    return <GraduationCap className="w-3.5 h-3.5 text-brand-600" />;
  }
  if (lower.includes('skill') || lower.includes('technolog') || lower.includes('competenc')) {
    return <Code2 className="w-3.5 h-3.5 text-brand-600" />;
  }
  return <Briefcase className="w-3.5 h-3.5 text-brand-600" />;
}

/**
 * Displays a candidate's extracted resume profile with a fixed identity header,
 * independently scrollable details body, PDF export, and quick requisition submittal.
 */
export const ResumeViewerModal: React.FC<ResumeViewerModalProps> = ({
  isOpen,
  onClose,
  candidate,
  requirements,
  rateMasked = false,
  onSubmitToReq,
  showToast,
}) => {
  const { formatRate } = useCurrency();
  const brand = useWorkspaceBrand();
  const brandName = (brand.agencyName || brand.legalEntityName || 'TalentOS Staffing').trim();
  const [showQuickSubmitDropdown, setShowQuickSubmitDropdown] = useState(false);
  const [reqFilterQuery, setReqFilterQuery] = useState('');
  const detailsScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setShowQuickSubmitDropdown(false);
    setReqFilterQuery('');
    if (detailsScrollRef.current) {
      detailsScrollRef.current.scrollTop = 0;
    }
    if (isOpen) {
      initWorkspaceBrand(true);
    }
  }, [isOpen, candidate?.id]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (showQuickSubmitDropdown) {
        setShowQuickSubmitDropdown(false);
        return;
      }
      onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, showQuickSubmitDropdown, onClose]);

  const parsedSections = useMemo(
    () => parseResumeSections(candidate?.rawSnippet, candidate?.fullName),
    [candidate?.rawSnippet, candidate?.fullName]
  );

  if (!isOpen || !candidate) return null;

  const formattedRate = rateMasked ? '' : formatRate(candidate.hourlyRate);
  const stageStyle = getStageStyle(candidate.pipelineStage);

  const openReqs = requirements.filter(
    (req) => req.status === 'Requirement' || req.status === 'Submitted'
  );
  const filteredOpenReqs = reqFilterQuery.trim()
    ? openReqs.filter((req) => {
        const q = reqFilterQuery.toLowerCase();
        return (
          req.opportunityTitle.toLowerCase().includes(q) ||
          req.companyName.toLowerCase().includes(q) ||
          req.code.toLowerCase().includes(q) ||
          (req.location || '').toLowerCase().includes(q)
        );
      })
    : openReqs;

  const skills = candidate.skillset
    ? candidate.skillset
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const initials = (candidate.fullName || 'C')
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const summarySection = parsedSections.find((s) =>
    SUMMARY_SECTION_TITLES.has(s.title.toLowerCase())
  );
  const educationSection = parsedSections.find((s) =>
    s.title.toLowerCase().includes('education')
  );
  const detailSections: ResumeSection[] = parsedSections.filter(
    (s) =>
      !SUMMARY_SECTION_TITLES.has(s.title.toLowerCase()) &&
      !s.title.toLowerCase().includes('education')
  );

  const resolvedEducation = resolveCandidateEducation(candidate.education, candidate.rawSnippet);

  const customFieldEntries = Object.entries(candidate.customFields || {}).filter(
    ([, value]) => value !== null && value !== undefined && String(value).trim() !== ''
  );

  const fallbackSummary = [
    `${candidate.currentTitle || 'Technology Consultant'}${
      skills.length > 0 ? ` specializing in ${skills.slice(0, 6).join(', ')}` : ''
    }.`,
    candidate.workAuth || candidate.relocation
      ? `Currently holding ${candidate.workAuth || 'work authorization'}${
          candidate.relocation ? ` with relocation preference set to ${candidate.relocation}` : ''
        }.`
      : null,
  ]
    .filter(Boolean)
    .join(' ');

  const downloadProfileBriefPdf = () => {
    const blob = generateCandidateResumePdf(candidate, formattedRate, brand);
    const url = URL.createObjectURL(blob);
    const safeName = (candidate.fullName || 'Consultant').replace(/\s+/g, '_');
    const link = document.createElement('a');
    link.href = url;
    link.download = `${safeName}_Profile_Brief.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(
      'Profile Brief Downloaded',
      `Exported ${brandName} consultant brief for ${candidate.fullName} (CRM summary — not original CV).`,
      'fa-solid fa-file-arrow-down text-emerald-500'
    );
  };

  return (
    <ModalPortal>
      <div
        onClick={() => {
          setShowQuickSubmitDropdown(false);
          onClose();
        }}
        role="dialog"
        aria-modal="true"
        aria-label={`${candidate.fullName} Resume Profile`}
        className="fixed inset-0 z-[70] bg-slate-900/55 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 select-none"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200/90 flex flex-col max-h-[88vh]"
        >
          {/* Fixed Top Header + Candidate Identity Bar */}
          <div className="shrink-0 rounded-t-2xl bg-white border-b border-slate-200">
            {/* Compact Utility Header */}
            <div className="px-6 py-2.5 bg-slate-50/90 border-b border-slate-200/80 rounded-t-2xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-md bg-brand-50 border border-brand-200/80 text-brand-600 flex items-center justify-center shrink-0">
                  <FileText className="w-3.5 h-3.5" />
                </div>
                <span className="text-[11px] font-bold text-slate-800 shrink-0">
                  Consultant Profile Brief
                </span>
                <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200/80 text-[10px] font-semibold text-amber-800 shrink-0">
                  Summary Only &bull; Not Original CV
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={downloadProfileBriefPdf}
                  title={`Export branded ${brandName} consultant brief PDF (summary only — not the original CV)`}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold inline-flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-slate-300" />
                  <span>Download Profile PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowQuickSubmitDropdown(false);
                    onClose();
                  }}
                  aria-label="Close profile brief preview"
                  className="text-slate-400 hover:text-slate-700 w-7 h-7 rounded-lg hover:bg-slate-200/70 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Pinned Candidate Summary Strip */}
            <div className="px-6 py-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-slate-900 to-slate-700 text-white font-bold text-sm flex items-center justify-center shadow-sm shrink-0">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight truncate">
                      {candidate.fullName}
                    </h2>
                    <p className="text-xs font-semibold text-brand-600 mt-0.5 truncate">
                      {candidate.currentTitle || 'Technology Consultant'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  {formattedRate && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200/80">
                      {formattedRate}
                    </span>
                  )}
                  {candidate.pipelineStage && (
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${stageStyle.badge}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${stageStyle.dot}`} />
                      <span>{candidate.pipelineStage}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Quick Contact & Eligibility Pills */}
              <div className="mt-3.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-600 select-text">
                {candidate.email && (
                  <a
                    href={`mailto:${candidate.email}`}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 hover:bg-slate-100 border border-slate-200/80 text-slate-700 transition-colors"
                  >
                    <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>{candidate.email}</span>
                  </a>
                )}
                {candidate.phone && (
                  <a
                    href={`tel:${candidate.phone}`}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 hover:bg-slate-100 border border-slate-200/80 text-slate-700 transition-colors"
                  >
                    <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>{candidate.phone}</span>
                  </a>
                )}
                {candidate.workAuth && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50/70 border border-emerald-200/80 text-emerald-800 font-medium">
                    <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
                    <span>{candidate.workAuth}</span>
                  </span>
                )}
                {candidate.relocation && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200/80 text-slate-700">
                    <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>Relocation: {candidate.relocation}</span>
                  </span>
                )}
                {candidate.assignedRecruiter && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200/80 text-slate-700">
                    <UserCheck className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>Recruiter: {candidate.assignedRecruiter}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Independently Scrollable Details Body Under Header */}
          <div
            ref={detailsScrollRef}
            className="flex-1 min-h-0 overflow-y-auto custom-scrollbar bg-slate-50/75 px-6 py-5 space-y-4 text-xs select-text"
          >
            {/* Honest Summary Notice */}
            <div className="flex items-start gap-2.5 rounded-xl bg-brand-50/60 border border-brand-200/70 px-3.5 py-2.5 text-[11px] text-slate-700">
              <Info className="w-3.5 h-3.5 text-brand-600 mt-0.5 shrink-0" />
              <span>
                This is a <strong className="font-semibold text-slate-900">{brandName}</strong>{' '}
                summary profile brief generated from CRM records — <strong className="font-semibold text-slate-900">not the candidate&apos;s original CV</strong>. Downloading exports a branded client brief.
              </span>
            </div>

            {/* Executive Summary Card */}
            <section className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-sm space-y-2.5">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-800">
                  Executive Summary
                </h3>
              </div>
              {summarySection && summarySection.items.length > 0 ? (
                <div className="space-y-1.5 pl-3 border-l-2 border-brand-500/70 text-slate-600 leading-relaxed">
                  {summarySection.items.map((line, idx) => (
                    <p key={idx}>{cleanExtractedResumeText(line.replace(/^[•\-\s]+/, ''))}</p>
                  ))}
                </div>
              ) : (
                <p className="text-slate-600 leading-relaxed pl-3 border-l-2 border-brand-500/70">
                  {fallbackSummary}
                </p>
              )}
            </section>

            {/* Core Competencies & Technologies Card */}
            {skills.length > 0 && (
              <section className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Code2 className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-800">
                      Core Competencies &amp; Technologies
                    </h3>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200/70">
                    {skills.length} {skills.length === 1 ? 'skill' : 'skills'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {skills.map((skill, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-lg text-[11px] bg-slate-50 border border-slate-200/90 text-slate-700 font-medium hover:border-brand-300 hover:bg-brand-50/40 transition-colors"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Extracted Experience / Structured Sections OR Profile Snapshot */}
            {detailSections.length > 0 ? (
              <section className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-sm space-y-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-800">
                      Extracted Resume Details &amp; Experience
                    </h3>
                  </div>
                  <span className="text-[10px] font-medium text-slate-400">
                    {detailSections.length} {detailSections.length === 1 ? 'section' : 'sections'}
                  </span>
                </div>

                <div className="space-y-3">
                  {detailSections.map((section, sIdx) => (
                    <div
                      key={`${section.title}_${sIdx}`}
                      className="rounded-lg border border-slate-200/80 bg-slate-50/60 p-3.5 space-y-2"
                    >
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-800">
                        {getSectionIcon(section.title)}
                        <span>{section.title}</span>
                      </div>
                      <div className="space-y-1.5 text-[11px] text-slate-700 leading-relaxed">
                        {section.items.map((line, lIdx) => {
                          const isBullet = line.startsWith('•');
                          const cleanedContent = cleanExtractedResumeText(
                            isBullet ? line.slice(1).trim() : line
                          );
                          return isBullet ? (
                            <div key={lIdx} className="flex items-start gap-2 pl-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-brand-500 mt-1.5 shrink-0" />
                              <span>{cleanedContent}</span>
                            </div>
                          ) : (
                            <div key={lIdx} className="text-slate-700 pl-1 font-medium">
                              {cleanedContent}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : (
              <section className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-800">
                      Consultant Readiness &amp; Profile Details
                    </h3>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200/70">
                    Active Profile
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50/70 rounded-lg border border-slate-200/80 p-3.5">
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Primary Role
                    </span>
                    <span className="block text-xs font-semibold text-slate-800 mt-0.5">
                      {candidate.currentTitle || 'Technology Consultant'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Availability Stage
                    </span>
                    <span className="block text-xs font-semibold text-slate-800 mt-0.5">
                      {candidate.pipelineStage || 'Available / Bench'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Target Rate
                    </span>
                    <span className="block text-xs font-semibold text-slate-800 mt-0.5">
                      {rateMasked ? '•••• (Restricted)' : formattedRate || 'Rate on request'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Assigned Recruiter
                    </span>
                    <span className="block text-xs font-semibold text-slate-800 mt-0.5">
                      {candidate.assignedRecruiter || 'Unassigned'}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2 rounded-lg bg-slate-50 border border-dashed border-slate-200 px-3 py-2 text-[11px] text-slate-500">
                  <Info className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                  <span>
                    Detailed work history text is not attached to this directory entry. Exporting
                    creates a branded <strong className="font-semibold text-slate-700">{brandName}</strong>{' '}
                    profile brief PDF (summary only, not an original CV).
                  </span>
                </div>
              </section>
            )}

            {/* Education & Credentials Card */}
            <section className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-sm flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-brand-50/70 border border-brand-200/70 text-brand-600 flex items-center justify-center shrink-0">
                <GraduationCap className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Education &amp; Credentials
                </div>
                <div className="text-xs font-bold text-slate-900">{resolvedEducation}</div>

                {educationSection && educationSection.items.length > 0 && (
                  <div className="space-y-1 pt-0.5 text-[11px] text-slate-600 leading-relaxed">
                    {educationSection.items.map((line, idx) => (
                      <div key={idx}>
                        {cleanExtractedResumeText(line.replace(/^[•\-\s]+/, ''))}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 pt-0.5">
                  <span className="inline-flex items-center gap-1">
                    <BadgeCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>CRM Profile Record</span>
                  </span>
                  <span className="text-slate-300">&bull;</span>
                  <span>{candidate.workAuth || 'Authorized'}</span>
                </div>
              </div>
            </section>

            {/* Optional Custom Fields Card */}
            {customFieldEntries.length > 0 && (
              <section className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-sm space-y-3">
                <div className="flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-800">
                    Additional Profile Attributes
                  </h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {customFieldEntries.map(([fieldName, value]) => (
                    <div
                      key={fieldName}
                      className="rounded-lg bg-slate-50/80 border border-slate-200/70 px-3 py-2"
                    >
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {fieldName}
                      </span>
                      <span className="block text-xs font-semibold text-slate-800 mt-0.5 break-words">
                        {String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Fixed Modal Actions Footer */}
          <div className="shrink-0 rounded-b-2xl px-6 py-3.5 bg-white border-t border-slate-200 flex items-center justify-between gap-3 text-xs">
            <div className="hidden sm:flex items-center gap-1.5 text-slate-500 text-[11px] truncate">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="truncate">
                {brandName} Brief &bull; Summary Only (Not Original CV)
              </span>
            </div>

            <div className="flex items-center gap-2.5 ml-auto">
              {/* 1-Click Submit to Open Requisition */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowQuickSubmitDropdown((prev) => !prev)}
                  className="px-3.5 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-sm inline-flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-300" />
                  <span>Submit to Open Requisition</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 opacity-80 transition-transform ${
                      showQuickSubmitDropdown ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {showQuickSubmitDropdown && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowQuickSubmitDropdown(false)}
                    />
                    <div className="absolute bottom-full right-0 mb-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-xl shadow-2xl py-2 z-50 text-xs divide-y divide-slate-100">
                      <div className="px-3.5 py-2 space-y-2">
                        <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                          <span>Select Target Job Requisition</span>
                          <span>{openReqs.length} open</span>
                        </div>
                        {openReqs.length > 4 && (
                          <div className="relative">
                            <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                              type="text"
                              value={reqFilterQuery}
                              onChange={(e) => setReqFilterQuery(e.target.value)}
                              placeholder="Search title, client, code..."
                              className="w-full pl-7 pr-2.5 py-1.5 text-[11px] bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500"
                            />
                          </div>
                        )}
                      </div>
                      <div className="max-h-60 overflow-y-auto custom-scrollbar py-1">
                        {filteredOpenReqs.length === 0 ? (
                          <div className="px-3.5 py-5 text-slate-400 text-center text-[11px]">
                            {openReqs.length === 0
                              ? 'No open requisitions available'
                              : 'No matching open requisitions'}
                          </div>
                        ) : (
                          filteredOpenReqs.map((req) => (
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
                                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">
                                  {req.code}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-2 truncate">
                                <span className="inline-flex items-center gap-1 truncate">
                                  <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                                  {req.companyName}
                                </span>
                                {req.location && (
                                  <>
                                    <span className="text-slate-300">&bull;</span>
                                    <span className="inline-flex items-center gap-1 truncate">
                                      <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                      {req.location}
                                    </span>
                                  </>
                                )}
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
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};
