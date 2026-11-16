import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Briefcase,
  Building2,
  CheckCircle2,
  ChevronDown,
  Code2,
  Download,
  FileText,
  GraduationCap,
  Info,
  Layers,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  UserCheck,
  X,
  Zap,
} from 'lucide-react';
import { BillablePlacement, Candidate, Requirement, RequirementSubmission } from '../../types';
import { useCurrency } from '../../utils/currency';
import { getStageDotClass } from '../../utils/stageStyles';
import { generateCandidateResumePdf } from '../../utils/pdfGenerator';
import { initWorkspaceBrand, useWorkspaceBrand } from '../../utils/workspaceBrand';
import {
  ALLOWED_CV_ACCEPT,
  downloadOriginalCandidateCv,
  validateCvFileSelection,
} from '../../utils/cvFiles';
import {
  cleanExtractedResumeText,
  parseResumeSections,
  resolveCandidateEducation,
  ResumeSection,
} from '../../utils/resumeFormatter';
import { formatDateTimeBadge } from '../../utils/entityMappers';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { SkillTagInput } from '../../components/shared/SkillTagInput';
import { ActionButton } from '../../components/shared/ActionButton';
import {
  DynamicCustomFieldsSection,
  useMasterTaxonomies,
} from '../../components/shared/DynamicCustomFieldsSection';

interface ConsultantDetailPageProps {
  candidate: Candidate | null;
  backLabel?: string;
  onBack: () => void;
  requirements: Requirement[];
  placements?: BillablePlacement[];
  rateMasked?: boolean;
  initialEditing?: boolean;
  onSubmitToReq: (candidate: Candidate, req: Requirement) => Promise<void> | void;
  onOpenRequirement?: (req: Requirement) => void;
  onUpdateCandidate?: (candidate: Candidate, cvFile?: File | null) => Promise<void> | void;
  onDeleteCandidate?: (candidate: Candidate) => Promise<void> | void;
  onNavigateToBillable?: () => void;
  showToast: (title: string, message: string, icon?: string) => void;
}

const SUMMARY_SECTION_TITLES = new Set([
  'summary',
  'professional summary',
  'executive summary',
  'objective',
]);

const PIPELINE_STAGE_OPTIONS = [
  'Available / Bench',
  'Submitted',
  'Interview',
  'Selected',
  'Onboarding',
  'Billable',
  'Archived',
  'Placed',
];

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

export const ConsultantDetailPage: React.FC<ConsultantDetailPageProps> = ({
  candidate,
  backLabel = 'Back to Consultants',
  onBack,
  requirements,
  placements = [],
  rateMasked = false,
  initialEditing = false,
  onSubmitToReq,
  onOpenRequirement,
  onUpdateCandidate,
  onDeleteCandidate,
  onNavigateToBillable,
  showToast,
}) => {
  const { formatRate } = useCurrency();
  const brand = useWorkspaceBrand();
  const brandName = (brand.agencyName || brand.legalEntityName || 'SquadPipe Staffing').trim();
  const taxonomies = useMasterTaxonomies(true);

  const [isEditing, setIsEditing] = useState(initialEditing);
  const [editForm, setEditForm] = useState<Candidate | null>(candidate);
  const [editCvFile, setEditCvFile] = useState<File | null>(null);
  const [editCvError, setEditCvError] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [isDownloadingCv, setIsDownloadingCv] = useState(false);
  const [showQuickSubmitDropdown, setShowQuickSubmitDropdown] = useState(false);
  const [reqFilterQuery, setReqFilterQuery] = useState('');
  const [submittingReqId, setSubmittingReqId] = useState<string | null>(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setEditForm(candidate ? { ...candidate } : null);
    setEditCvFile(null);
    setEditCvError('');
    setIsSavingEdit(false);
    setIsDownloadingCv(false);
    setShowQuickSubmitDropdown(false);
    setReqFilterQuery('');
    setSubmittingReqId(null);
    setShowDeleteConfirm(false);
    setIsDeleting(false);
    setIsEditing(Boolean(initialEditing));
  }, [candidate?.id, initialEditing]);

  useEffect(() => {
    if (candidate) {
      setEditForm((prev) => (!isEditing ? { ...candidate } : prev));
    }
  }, [candidate, isEditing]);

  useEffect(() => {
    initWorkspaceBrand(true);
  }, []);

  const parsedSections = useMemo(
    () => parseResumeSections(candidate?.rawSnippet, candidate?.fullName),
    [candidate?.rawSnippet, candidate?.fullName]
  );

  const linkedSubmissions = useMemo(() => {
    if (!candidate) return [] as Array<{ requirement: Requirement; submission: RequirementSubmission }>;
    const nameKey = candidate.fullName.trim().toLowerCase();
    const list: Array<{ requirement: Requirement; submission: RequirementSubmission }> = [];
    for (const req of requirements) {
      for (const sub of req.submissions || []) {
        if (
          (sub.candidateId && sub.candidateId === candidate.id) ||
          sub.fullName.trim().toLowerCase() === nameKey
        ) {
          list.push({ requirement: req, submission: sub });
        }
      }
    }
    return list;
  }, [candidate, requirements]);

  const linkedPlacements = useMemo(() => {
    if (!candidate) return [] as BillablePlacement[];
    const nameKey = candidate.fullName.trim().toLowerCase();
    return placements.filter(
      (p) =>
        (p.candidateId && p.candidateId === candidate.id) ||
        p.resourceName.trim().toLowerCase() === nameKey
    );
  }, [candidate, placements]);

  const activeLinkedPlacements = useMemo(
    () =>
      linkedPlacements.filter(
        (p) => p.status !== 'Completed' && p.status !== 'Terminated'
      ),
    [linkedPlacements]
  );

  if (!candidate) {
    return (
      <section className="max-w-7xl mx-auto py-16 text-center space-y-3 animate-fade-in">
        <p className="text-sm font-semibold text-slate-700">Consultant profile not found.</p>
        <button
          type="button"
          onClick={onBack}
          className="px-3.5 py-2 rounded-lg bg-brand-600 text-white text-xs font-semibold hover:bg-brand-700 inline-flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{backLabel}</span>
        </button>
      </section>
    );
  }

  const formattedRate = rateMasked ? '' : formatRate(candidate.hourlyRate);
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

  const hasStoredOriginalCv = Boolean(candidate.resumeFileUrl);
  const isBillable =
    candidate.pipelineStage === 'Billable' || activeLinkedPlacements.length > 0;

  const workAuthOptions = Array.from(
    new Set([
      ...(taxonomies.workAuth || ['US Citizen', 'Green Card', 'H-1B', 'TN Visa', 'OPT']),
      ...(editForm?.workAuth ? [editForm.workAuth] : []),
    ])
  ).filter(Boolean);

  const handleDownloadOriginalCv = async () => {
    if (!hasStoredOriginalCv || isDownloadingCv) return;
    setIsDownloadingCv(true);
    try {
      const downloadedName = await downloadOriginalCandidateCv(
        candidate.id,
        candidate.resumeName || `${(candidate.fullName || 'Consultant').replace(/\s+/g, '_')}_CV.pdf`
      );
      showToast(
        'Original CV Downloaded',
        `Downloaded stored original CV (${downloadedName}) for ${candidate.fullName}.`,
        'fa-solid fa-file-arrow-down text-emerald-500'
      );
    } catch (err: any) {
      showToast(
        'CV Download Failed',
        err?.response?.data?.message || err?.message || 'Unable to download original CV.',
        'fa-solid fa-circle-exclamation text-rose-500'
      );
    } finally {
      setIsDownloadingCv(false);
    }
  };

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

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm || !onUpdateCandidate || isSavingEdit) return;
    setIsSavingEdit(true);
    setEditCvError('');
    try {
      await onUpdateCandidate(editForm, editCvFile);
      setEditCvFile(null);
      setIsEditing(false);
    } catch (err: any) {
      setEditCvError(
        err?.response?.data?.message || err?.message || 'Failed to save changes.'
      );
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <section className="max-w-7xl mx-auto space-y-4 animate-fade-in">
      {/* Slim Breadcrumb */}
      <div className="flex items-center justify-between gap-3 flex-wrap text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-semibold shadow-2xs transition-colors cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{backLabel}</span>
          </button>
          <span className="text-slate-300">/</span>
          <span className="text-[11px] font-semibold text-slate-800 truncate">
            {candidate.fullName}
          </span>
        </div>

        <div className="text-[11px] text-slate-500 hidden sm:flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>
            {hasStoredOriginalCv
              ? `Original CV Stored (${candidate.resumeName || 'Attached'})`
              : 'CRM Profile Brief'}
          </span>
        </div>
      </div>

      {/* Main Header Card */}
      <div className="bg-white rounded-xl border border-slate-200/80 card-shadow px-5 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5 min-w-0">
          <div className="w-12 h-12 rounded-xl bg-[#141615] text-white font-bold text-sm flex items-center justify-center shadow-xs shrink-0">
            {initials}
          </div>
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold text-slate-900 tracking-tight truncate">
                {candidate.fullName}
              </h1>
              {candidate.pipelineStage && (
                <StatusBadge
                  label={candidate.pipelineStage}
                  dotClass={getStageDotClass(candidate.pipelineStage)}
                  size="xs"
                />
              )}
              {formattedRate && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200/80">
                  {formattedRate}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2.5 text-xs text-slate-500 flex-wrap">
              <span className="font-semibold text-brand-600">
                {candidate.currentTitle || 'Technology Consultant'}
              </span>
              {candidate.workAuth && (
                <>
                  <span className="text-slate-300">&bull;</span>
                  <span className="inline-flex items-center gap-1 text-slate-700 font-medium">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{candidate.workAuth}</span>
                  </span>
                </>
              )}
              {candidate.relocation && (
                <>
                  <span className="text-slate-300">&bull;</span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    <span>Relocation: {candidate.relocation}</span>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
          {onUpdateCandidate && (
            <button
              type="button"
              onClick={() => {
                setEditForm({ ...candidate });
                setEditCvFile(null);
                setEditCvError('');
                setIsEditing((prev) => !prev);
              }}
              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                isEditing
                  ? 'bg-slate-900 border-slate-900 text-white'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>{isEditing ? 'Close Editor' : 'Edit Profile'}</span>
            </button>
          )}

          {hasStoredOriginalCv && (
            <button
              type="button"
              disabled={isDownloadingCv}
              onClick={handleDownloadOriginalCv}
              title={`Download original stored CV${candidate.resumeName ? ` (${candidate.resumeName})` : ''}`}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
            >
              {isDownloadingCv ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-600" />
              ) : (
                <Download className="w-3.5 h-3.5 text-brand-600" />
              )}
              <span>{isDownloadingCv ? 'Downloading...' : 'Original CV'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={downloadProfileBriefPdf}
            title={`Export branded ${brandName} consultant brief PDF (summary only — not the original CV)`}
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-300" />
            <span>Profile PDF</span>
          </button>

          {/* 1-Click Submit to Open Requisition */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowQuickSubmitDropdown((prev) => !prev)}
              className="px-3.5 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              <span>Submit to Req</span>
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
                <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-xl shadow-2xl py-2 z-50 text-xs divide-y divide-slate-100">
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
                          autoFocus
                          value={reqFilterQuery}
                          onChange={(e) => setReqFilterQuery(e.target.value)}
                          placeholder="Search title, client, code..."
                          className="w-full pl-7 pr-2.5 py-1.5 text-[11px] bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500"
                        />
                      </div>
                    )}
                  </div>
                  <div className="max-h-64 overflow-y-auto custom-scrollbar py-1">
                    {filteredOpenReqs.length === 0 ? (
                      <div className="px-3.5 py-5 text-slate-400 text-center text-[11px]">
                        {openReqs.length === 0
                          ? 'No open requisitions available'
                          : 'No matching open requisitions'}
                      </div>
                    ) : (
                      filteredOpenReqs.map((req) => {
                        const alreadyAttached = linkedSubmissions.some(
                          (item) => item.requirement.id === req.id
                        );
                        return (
                          <button
                            type="button"
                            key={req.id}
                            disabled={submittingReqId === req.id}
                            onClick={async () => {
                              setSubmittingReqId(req.id);
                              try {
                                await onSubmitToReq(candidate, req);
                                setShowQuickSubmitDropdown(false);
                              } finally {
                                setSubmittingReqId(null);
                              }
                            }}
                            className="w-full px-3.5 py-2.5 text-left hover:bg-slate-50 flex flex-col transition-colors group cursor-pointer disabled:opacity-60"
                          >
                            <div className="font-semibold text-slate-900 group-hover:text-brand-600 flex items-center justify-between gap-2">
                              <span className="truncate">{req.opportunityTitle}</span>
                              <div className="flex items-center gap-1 shrink-0">
                                {alreadyAttached && (
                                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    Submitted
                                  </span>
                                )}
                                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                                  {req.code}
                                </span>
                              </div>
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
                        );
                      })
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Inline Full-Width Edit Profile Panel */}
      {isEditing && editForm && (
        <form
          onSubmit={handleSaveEdit}
          className="bg-white rounded-xl border border-slate-200/80 card-shadow p-5 space-y-4 text-xs"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Edit Consultant Profile &amp; CV
            </h2>
            <button
              type="button"
              disabled={isSavingEdit}
              onClick={() => {
                setEditCvFile(null);
                setEditCvError('');
                setIsEditing(false);
              }}
              className="text-slate-400 hover:text-slate-700 p-1 rounded cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Full Name *</label>
              <input
                type="text"
                required
                value={editForm.fullName}
                onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Current Title *</label>
              <input
                type="text"
                required
                value={editForm.currentTitle}
                onChange={(e) => setEditForm({ ...editForm, currentTitle: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Email *</label>
              <input
                type="email"
                required
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Phone</label>
              <input
                type="text"
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Work Auth</label>
              <select
                value={editForm.workAuth}
                onChange={(e) => setEditForm({ ...editForm, workAuth: e.target.value })}
                className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:border-brand-600 focus:outline-none cursor-pointer"
              >
                {workAuthOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
            {!rateMasked && (
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Hourly Rate</label>
                <input
                  type="text"
                  value={editForm.hourlyRate}
                  onChange={(e) => setEditForm({ ...editForm, hourlyRate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                />
              </div>
            )}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Relocation</label>
              <select
                value={editForm.relocation}
                onChange={(e) => setEditForm({ ...editForm, relocation: e.target.value })}
                className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:border-brand-600 focus:outline-none cursor-pointer"
              >
                <option value="Yes">Open (Yes)</option>
                <option value="No">Local Only (No)</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Pipeline Stage</label>
              <select
                value={editForm.pipelineStage}
                onChange={(e) => setEditForm({ ...editForm, pipelineStage: e.target.value })}
                className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:border-brand-600 focus:outline-none cursor-pointer"
              >
                {PIPELINE_STAGE_OPTIONS.map((stage) => (
                  <option key={stage} value={stage}>
                    {stage}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Education</label>
              <input
                type="text"
                value={editForm.education || ''}
                onChange={(e) => setEditForm({ ...editForm, education: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">Key Skillset</label>
            <SkillTagInput
              value={editForm.skillset}
              onChange={(nextCsv) => setEditForm({ ...editForm, skillset: nextCsv })}
            />
          </div>

          {/* Original CV Upload / Replace Dropzone */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Original CV / Resume File
            </label>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (!file) return;
                const errMsg = validateCvFileSelection(file);
                if (errMsg) {
                  setEditCvError(errMsg);
                  return;
                }
                setEditCvError('');
                setEditCvFile(file);
              }}
              className="p-3 rounded-lg border border-dashed border-slate-300 bg-slate-50/70 space-y-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold text-slate-800 truncate">
                      {editCvFile
                        ? editCvFile.name
                        : editForm.resumeFileUrl
                          ? editForm.resumeName || 'Stored Original CV'
                          : 'No original CV file uploaded yet'}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {editCvFile
                        ? `New upload ready (${(editCvFile.size / 1024).toFixed(1)} KB) — saves on update`
                        : editForm.resumeFileUrl
                          ? 'Upload a new file to replace the stored CV'
                          : 'PDF, DOC, DOCX, TXT, or RTF (max 15 MB)'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {editCvFile && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditCvFile(null);
                        setEditCvError('');
                      }}
                      className="px-2 py-1 rounded border border-slate-200 bg-white text-rose-600 hover:bg-rose-50 text-[11px] font-medium cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                  <label className="px-2.5 py-1.5 rounded-md bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors">
                    <Upload className="w-3 h-3 text-brand-600" />
                    <span>
                      {editCvFile
                        ? 'Change File'
                        : editForm.resumeFileUrl
                          ? 'Replace CV'
                          : 'Upload CV'}
                    </span>
                    <input
                      type="file"
                      accept={ALLOWED_CV_ACCEPT}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const errMsg = validateCvFileSelection(file);
                        if (errMsg) {
                          setEditCvError(errMsg);
                          e.target.value = '';
                          return;
                        }
                        setEditCvError('');
                        setEditCvFile(file);
                        e.target.value = '';
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
              {editCvError && (
                <div className="text-[11px] text-rose-600 font-medium">{editCvError}</div>
              )}
            </div>
          </div>

          <DynamicCustomFieldsSection
            entity="consultant"
            values={(editForm.customFields as Record<string, string>) || {}}
            onChange={(vals) => setEditForm({ ...editForm, customFields: vals })}
            isOpen={isEditing}
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              disabled={isSavingEdit}
              onClick={() => {
                setEditCvFile(null);
                setEditCvError('');
                setIsEditing(false);
              }}
              className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <ActionButton
              type="submit"
              loading={isSavingEdit}
              loadingText="Saving..."
              className="px-4 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-semibold shadow-xs cursor-pointer"
            >
              Save Changes
            </ActionButton>
          </div>
        </form>
      )}

      {/* Main 2-Column Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        {/* Left Main Content: Summary, Resume Sections, Linked Requisitions & Placements */}
        <div className="lg:col-span-2 space-y-4">
          {/* Honest Summary Notice */}
          <div className="flex items-start gap-2.5 rounded-xl bg-white border border-slate-200/80 px-4 py-3 text-[11px] text-slate-600 card-shadow">
            <Info className="w-3.5 h-3.5 text-brand-600 mt-0.5 shrink-0" />
            <span>
              This is a <strong className="font-semibold text-slate-900">{brandName}</strong>{' '}
              summary profile brief generated from CRM records
              {hasStoredOriginalCv
                ? ' — use Original CV above to download the stored file.'
                : ' — not an original attached CV. Exporting downloads a branded client brief.'}
            </span>
          </div>

          {/* Executive Summary Card */}
          <section className="bg-white rounded-xl border border-slate-200/80 card-shadow p-5 space-y-2.5 text-xs">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-brand-600 shrink-0" />
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                Executive Summary
              </h2>
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

          {/* Extracted Experience OR Readiness Snapshot */}
          {detailSections.length > 0 ? (
            <section className="bg-white rounded-xl border border-slate-200/80 card-shadow p-5 space-y-3.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Briefcase className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                  <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                    Extracted Resume Details &amp; Experience
                  </h2>
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
            <section className="bg-white rounded-xl border border-slate-200/80 card-shadow p-5 space-y-3 text-xs">
              <div className="flex items-center gap-2">
                <Briefcase className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                  Consultant Readiness Overview
                </h2>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Detailed work history text is not attached to this directory entry. Use{' '}
                <strong className="font-semibold text-slate-700">Edit Profile</strong> to upload an
                original CV file or update profile attributes.
              </p>
            </section>
          )}

          {/* Requisition Submissions */}
          <section className="bg-white rounded-xl border border-slate-200/80 card-shadow overflow-hidden text-xs">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Briefcase className="w-3.5 h-3.5 text-brand-600" />
                <h2 className="font-bold text-slate-900">
                  Requisition Submissions ({linkedSubmissions.length})
                </h2>
              </div>
            </div>
            {linkedSubmissions.length === 0 ? (
              <div className="px-5 py-8 text-center text-[11px] text-slate-400">
                Not submitted to any requisitions yet. Use <strong>Submit to Req</strong> above to submit.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {linkedSubmissions.map(({ requirement: req, submission: sub }) => (
                  <div
                    key={sub.id}
                    onClick={() => onOpenRequirement && onOpenRequirement(req)}
                    className={`px-5 py-3.5 flex items-center justify-between gap-3 ${
                      onOpenRequirement ? 'hover:bg-slate-50 cursor-pointer transition-colors' : ''
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                          {req.code}
                        </span>
                        <span className="font-semibold text-slate-900 truncate">
                          {req.opportunityTitle}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                        <span>{req.companyName}</span>
                        {sub.interviewDateTime || sub.interviewDate ? (
                          <>
                            <span className="text-slate-300">&bull;</span>
                            <span className="text-brand-700 font-medium">
                              Interview:{' '}
                              {formatDateTimeBadge(sub.interviewDateTime || sub.interviewDate) ||
                                sub.interviewDate}
                            </span>
                          </>
                        ) : null}
                      </div>
                    </div>
                    <StatusBadge
                      stage={sub.stage}
                      dotClass={getStageDotClass(sub.stage)}
                      size="xs"
                    />
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Billable Placements */}
          {linkedPlacements.length > 0 && (
            <section className="bg-white rounded-xl border border-slate-200/80 card-shadow overflow-hidden text-xs">
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-bold text-slate-900">
                  Billable Placements ({linkedPlacements.length})
                </h2>
                {onNavigateToBillable && (
                  <button
                    type="button"
                    onClick={onNavigateToBillable}
                    className="text-[11px] font-semibold text-brand-600 hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>View Billable Consultants</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
              <div className="divide-y divide-slate-100">
                {linkedPlacements.map((p) => (
                  <div key={p.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 truncate">
                        {p.customer} — {p.skillRole}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {p.startDate} &rarr; {p.endDate} &bull; {p.placementType}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {!rateMasked && (
                        <span className="text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[11px]">
                          {p.billing}
                        </span>
                      )}
                      <StatusBadge stage={p.status} size="xs" />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Right Metadata Sidebar */}
        <aside className="space-y-4">
          {/* Contact & Readiness Card */}
          <div className="bg-white rounded-xl border border-slate-200/80 card-shadow p-4 space-y-3 text-xs">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Profile Summary
            </h3>
            <dl className="space-y-2.5 text-xs">
              <div className="flex items-start justify-between gap-2">
                <dt className="text-slate-400 font-medium inline-flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  <span>Email</span>
                </dt>
                <dd className="text-slate-800 font-medium text-right break-all">
                  {candidate.email ? (
                    <a href={`mailto:${candidate.email}`} className="hover:text-brand-600">
                      {candidate.email}
                    </a>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-2">
                <dt className="text-slate-400 font-medium inline-flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  <span>Phone</span>
                </dt>
                <dd className="text-slate-800 font-medium text-right">
                  {candidate.phone ? (
                    <a href={`tel:${candidate.phone}`} className="hover:text-brand-600">
                      {candidate.phone}
                    </a>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-2">
                <dt className="text-slate-400 font-medium">Work Auth</dt>
                <dd className="text-slate-800 font-medium text-right">{candidate.workAuth || '—'}</dd>
              </div>
              <div className="flex items-start justify-between gap-2">
                <dt className="text-slate-400 font-medium">Target Rate</dt>
                <dd className="text-slate-800 font-semibold text-right">
                  {rateMasked ? '•••• (Restricted)' : formattedRate || 'Rate on request'}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-2">
                <dt className="text-slate-400 font-medium">Relocation</dt>
                <dd className="text-slate-800 font-medium text-right">
                  {candidate.relocation === 'Yes' ? 'Open (Yes)' : candidate.relocation || '—'}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-2">
                <dt className="text-slate-400 font-medium inline-flex items-center gap-1">
                  <UserCheck className="w-3 h-3" />
                  <span>Recruiter</span>
                </dt>
                <dd className="text-slate-800 font-medium text-right">
                  {candidate.assignedRecruiter || 'Unassigned'}
                </dd>
              </div>
            </dl>
          </div>

          {/* Core Competencies */}
          <div className="bg-white rounded-xl border border-slate-200/80 card-shadow p-4 space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Core Competencies
              </h3>
              {skills.length > 0 && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {skills.length}
                </span>
              )}
            </div>
            {skills.length === 0 ? (
              <p className="text-slate-400 text-[11px]">No skills listed yet.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {skills.map((skill, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded-md text-[11px] bg-slate-100 text-slate-700 font-medium"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Education & Credentials */}
          <div className="bg-white rounded-xl border border-slate-200/80 card-shadow p-4 space-y-2 text-xs">
            <div className="flex items-center gap-1.5">
              <GraduationCap className="w-3.5 h-3.5 text-brand-600" />
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Education &amp; Credentials
              </h3>
            </div>
            <div className="text-xs font-semibold text-slate-900">{resolvedEducation}</div>
            {educationSection && educationSection.items.length > 0 && (
              <div className="space-y-1 text-[11px] text-slate-600 leading-relaxed">
                {educationSection.items.map((line, idx) => (
                  <div key={idx}>{cleanExtractedResumeText(line.replace(/^[•\-\s]+/, ''))}</div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 pt-1">
              <BadgeCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Verified CRM Record</span>
            </div>
          </div>

          {/* Custom Attributes */}
          {customFieldEntries.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200/80 card-shadow p-4 space-y-2.5 text-xs">
              <div className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-brand-600" />
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Additional Attributes
                </h3>
              </div>
              <dl className="space-y-1.5">
                {customFieldEntries.map(([fieldName, value]) => (
                  <div key={fieldName} className="flex items-start justify-between gap-2">
                    <dt className="text-slate-400 font-medium capitalize">
                      {fieldName.replace(/_/g, ' ')}
                    </dt>
                    <dd className="text-slate-800 font-medium text-right break-words">
                      {String(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {/* Delete Consultant Control */}
          {onDeleteCandidate && (
            <div className="bg-white rounded-xl border border-slate-200/80 card-shadow p-4 space-y-2.5 text-xs">
              {!showDeleteConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full px-3 py-2 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 font-semibold text-xs inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Consultant</span>
                </button>
              ) : isBillable ? (
                <div className="space-y-2.5">
                  <div className="flex items-start gap-2 text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-[11px]">
                    <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                    <span>
                      Cannot delete a billable consultant. Remove their active placement under Billable Consultants first.
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-[11px] font-semibold cursor-pointer"
                    >
                      Close
                    </button>
                    {onNavigateToBillable && (
                      <button
                        type="button"
                        onClick={onNavigateToBillable}
                        className="flex-1 px-2.5 py-1.5 rounded-lg bg-brand-600 text-white text-[11px] font-semibold cursor-pointer"
                      >
                        Go to Billable
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="flex items-start gap-2 text-rose-700 text-[11px]">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      Permanently delete <strong>{candidate.fullName}</strong>? This removes associated submission records.
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-[11px] font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <ActionButton
                      type="button"
                      loading={isDeleting}
                      loadingText="Deleting..."
                      onClick={async () => {
                        setIsDeleting(true);
                        try {
                          await onDeleteCandidate(candidate);
                          onBack();
                        } catch {
                          // Error toast displayed by parent caller
                        } finally {
                          setIsDeleting(false);
                        }
                      }}
                      className="flex-1 px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-semibold cursor-pointer"
                    >
                      Confirm Delete
                    </ActionButton>
                  </div>
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </section>
  );
};
