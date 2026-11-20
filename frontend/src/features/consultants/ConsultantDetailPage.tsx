import React, { useEffect, useMemo, useState } from 'react';
import {
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
  Send,
  ShieldCheck,
  Trash2,
  UserCheck,
} from 'lucide-react';
import { BillablePlacement, Candidate, Requirement, RequirementSubmission, Vendor } from '../../types';
import { useCurrency } from '../../utils/currency';
import { getStageDotClass } from '../../utils/stageStyles';
import { downloadCandidateResumePdf } from '../../utils/pdfGenerator';
import { initWorkspaceBrand, useWorkspaceBrand } from '../../utils/workspaceBrand';
import { downloadOriginalCandidateCv } from '../../utils/cvFiles';
import {
  cleanExtractedResumeText,
  parseResumeSections,
  resolveCandidateEducation,
  ResumeSection,
} from '../../utils/resumeFormatter';
import { formatDateTimeBadge } from '../../utils/entityMappers';
import { useClientPagination } from '../../utils/usePagination';
import {
  extractRateSortValue,
  sortArrayByColumn,
  useTableSort,
} from '../../utils/tableSort';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { ConfirmDeleteModal } from '../../components/shared/ConfirmDeleteModal';
import { MaskedPdfToggle } from '../../components/shared/MaskedPdfControl';
import { SortableTableHeader } from '../../components/shared/SortableTableHeader';
import { TablePagination } from '../../components/shared/TablePagination';
import { PreparePitchModal } from '../../components/modals/PreparePitchModal';
import { MaskedValue } from '../../components/shared/MaskedValue';
import { EditConsultantModal } from '../../components/modals/edit/EditConsultantModal';
import {
  DetailBreadcrumb,
  DetailExpandableSkillsBar,
  DetailTabItem,
  DetailUnderlineTabs,
} from '../../components/shared/DetailPageShell';

interface ConsultantDetailPageProps {
  candidate: Candidate | null;
  backLabel?: string;
  onBack: () => void;
  requirements: Requirement[];
  placements?: BillablePlacement[];
  vendors?: Vendor[];
  rateMasked?: boolean;
  initialEditing?: boolean;
  onSubmitToReq: (candidate: Candidate, req: Requirement) => Promise<void> | void;
  onOpenRequirement?: (req: Requirement) => void;
  onSelectPlacement?: (placement: BillablePlacement) => void;
  onOpenVendor?: (vendor: Vendor) => void;
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
  vendors = [],
  rateMasked = false,
  initialEditing = false,
  onSubmitToReq,
  onOpenRequirement,
  onSelectPlacement,
  onOpenVendor,
  onUpdateCandidate,
  onDeleteCandidate,
  onNavigateToBillable,
  showToast,
}) => {
  const { formatRate } = useCurrency();
  const brand = useWorkspaceBrand();
  const brandName = (brand.agencyName || brand.legalEntityName || 'SquadPipe Staffing').trim();
  const [isEditing, setIsEditing] = useState(initialEditing);
  const [isDownloadingCv, setIsDownloadingCv] = useState(false);
  const [showQuickSubmitDropdown, setShowQuickSubmitDropdown] = useState(false);
  const [reqFilterQuery, setReqFilterQuery] = useState('');
  const [submittingReqId, setSubmittingReqId] = useState<string | null>(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isMaskedPdf, setIsMaskedPdf] = useState(false);
  const [pitchTarget, setPitchTarget] = useState<{
    requirement: Requirement;
    submission: RequirementSubmission;
  } | null>(null);
  const [workspaceTab, setWorkspaceTab] = useState<'resume' | 'submissions' | 'placements' | 'details'>('resume');
  const [subSearch, setSubSearch] = useState('');
  const subsSort = useTableSort<'code' | 'opportunityTitle' | 'companyName' | 'interviewDate' | 'stage'>();
  const placementsSort = useTableSort<'customer' | 'skillRole' | 'startDate' | 'billing' | 'status'>();

  useEffect(() => {
    setIsDownloadingCv(false);
    setShowQuickSubmitDropdown(false);
    setReqFilterQuery('');
    setSubmittingReqId(null);
    setShowDeleteModal(false);
    setIsMaskedPdf(false);
    setPitchTarget(null);
    setWorkspaceTab('resume');
    setSubSearch('');
    setIsEditing(Boolean(initialEditing));
    subsSort.resetSort();
    placementsSort.resetSort();
  }, [candidate?.id, initialEditing]);

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

  const filteredSubmissions = subSearch.trim()
    ? linkedSubmissions.filter(({ requirement: req, submission: sub }) => {
        const q = subSearch.toLowerCase();
        return (
          req.code.toLowerCase().includes(q) ||
          req.opportunityTitle.toLowerCase().includes(q) ||
          req.companyName.toLowerCase().includes(q) ||
          sub.stage.toLowerCase().includes(q)
        );
      })
    : linkedSubmissions;

  const sortedSubmissions = sortArrayByColumn(filteredSubmissions, subsSort.sort, {
    code: (item) => item.requirement.code,
    opportunityTitle: (item) => item.requirement.opportunityTitle,
    companyName: (item) => item.requirement.companyName,
    interviewDate: (item) => {
      const raw = item.submission.interviewDateTime || item.submission.interviewDate;
      return raw ? new Date(raw) : null;
    },
    stage: (item) => item.submission.stage,
  });
  const sortedPlacements = sortArrayByColumn(linkedPlacements, placementsSort.sort, {
    customer: (p) => p.customer,
    skillRole: (p) => p.skillRole,
    startDate: (p) => (p.startDate ? new Date(p.startDate) : null),
    billing: (p) => (rateMasked ? null : extractRateSortValue(p.billing)),
    status: (p) => p.status,
  });

  const submissionsPg = useClientPagination(
    sortedSubmissions,
    10,
    `${candidate?.id || ''}|subs|${subSearch}|${subsSort.sort.sortBy || ''}|${subsSort.sort.sortDir}`
  );
  const placementsPg = useClientPagination(
    sortedPlacements,
    10,
    `${candidate?.id || ''}|placements|${placementsSort.sort.sortBy || ''}|${placementsSort.sort.sortDir}`
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
        'download'
      );
    } catch (err: any) {
      showToast(
        'CV Download Failed',
        err?.response?.data?.message || err?.message || 'Unable to download original CV.',
        'error'
      );
    } finally {
      setIsDownloadingCv(false);
    }
  };

  const downloadProfileBriefPdf = () => {
    const fileName = downloadCandidateResumePdf(candidate, formattedRate, brand, {
      masked: isMaskedPdf,
    });

    showToast(
      isMaskedPdf ? 'Masked Profile PDF Downloaded' : 'Candidate Profile Downloaded',
      `Downloaded ${candidate.fullName}'s ${
        isMaskedPdf
          ? 'masked profile sheet (personal email and phone hidden)'
          : 'summary profile sheet'
      } (${fileName}).`,
      'download'
    );
  };

  const matchedVendor =
    (candidate.vendorId ? vendors.find((v) => v.id === candidate.vendorId) : undefined) ||
    (candidate.vendorName
      ? vendors.find(
          (v) => v.name.trim().toLowerCase() === candidate.vendorName!.trim().toLowerCase()
        )
      : undefined);
  const vendorLabel = matchedVendor?.name || candidate.vendorName;

  const consultantTabs: Array<
    DetailTabItem<'resume' | 'submissions' | 'placements' | 'details'>
  > = [
    { id: 'resume', label: 'Overview & Resume', icon: FileText },
    {
      id: 'submissions',
      label: 'Requisition Submissions',
      icon: Briefcase,
      badge: linkedSubmissions.length,
    },
    {
      id: 'placements',
      label: 'Billable Placements',
      icon: CheckCircle2,
      badge: linkedPlacements.length,
    },
    {
      id: 'details',
      label: 'Profile Details',
      icon: Layers,
      badge: customFieldEntries.length > 0 ? customFieldEntries.length : undefined,
    },
  ];

  return (
    <section className="max-w-7xl mx-auto space-y-6 pb-6 animate-fade-in">
      <DetailBreadcrumb
        backLabel={backLabel}
        onBack={onBack}
        title={candidate.fullName}
        rightSlot={
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                hasStoredOriginalCv ? 'bg-emerald-500' : 'bg-slate-400'
              }`}
            />
            <span>
              {hasStoredOriginalCv ? 'Original CV Stored' : 'Profile Summary'}
            </span>
          </div>
        }
      />

      {/* Bare Canvas Entity Title & Actions */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          <div className="w-10 h-10 rounded-full bg-[#141615] text-white font-bold text-xs flex items-center justify-center flex-shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight leading-snug">
                {candidate.fullName}
              </h1>
              {candidate.pipelineStage && (
                <StatusBadge
                  label={candidate.pipelineStage}
                  dotClass={getStageDotClass(candidate.pipelineStage)}
                  size="xs"
                />
              )}
            </div>
            <p className="text-xs text-slate-500 truncate">
              <span className="font-medium text-brand-600">
                {candidate.currentTitle || 'Technology Consultant'}
              </span>
              {candidate.workAuth && <span> &middot; {candidate.workAuth}</span>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
            {onUpdateCandidate && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Edit Profile</span>
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

            <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white">
              <MaskedPdfToggle
                checked={isMaskedPdf}
                onChange={setIsMaskedPdf}
                compact
                popoverPlacement="bottom"
                popoverAlign="left"
              />
              <button
                type="button"
                onClick={downloadProfileBriefPdf}
                title={`Download formatted ${brandName} candidate summary PDF for client sharing`}
                className="px-3 py-1.5 rounded-r-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-slate-300" />
                <span>{isMaskedPdf ? 'Masked Profile PDF' : 'Profile PDF'}</span>
              </button>
            </div>

            {/* 1-Click Submit to Open Requisition */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowQuickSubmitDropdown((prev) => !prev)}
                className="px-3.5 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
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
                  <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-xl popover-shadow py-2 z-50 text-xs divide-y divide-slate-100">
                    <div className="px-3.5 py-2 space-y-2">
                      <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                        <span>Select Target Job Requisition</span>
                        <span className="tabular-nums">{openReqs.length} open</span>
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
                                    <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      Submitted
                                    </span>
                                  )}
                                  <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                                    {req.code}
                                  </span>
                                </div>
                              </div>
                              <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2 truncate">
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

      {/* Standalone 4-Column Summary Card */}
      <div className="bg-white rounded-xl border border-slate-200/80 card-shadow overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 text-xs">
          {/* 1. Contact & Relocation */}
          <div className="px-6 py-4 space-y-1.5 min-w-0">
            <div className="text-xs font-medium text-slate-500">Contact &amp; Relocation</div>
            <div className="font-semibold text-slate-900 leading-snug break-all">
              {candidate.email ? (
                <a href={`mailto:${candidate.email}`} className="hover:text-brand-600">
                  {candidate.email}
                </a>
              ) : (
                'Email not recorded'
              )}
            </div>
            <div className="text-[11px] text-slate-500 leading-snug break-words">
              {candidate.phone ? (
                <a href={`tel:${candidate.phone}`} className="hover:text-brand-600">
                  {candidate.phone}
                </a>
              ) : (
                'No phone'
              )}
              {candidate.relocation
                ? ` · Relocation: ${
                    candidate.relocation === 'Yes' ? 'Open (Yes)' : candidate.relocation
                  }`
                : ''}
            </div>
          </div>

          {/* 2. Work Auth & Partner Vendor */}
          <div className="px-6 py-4 space-y-1.5 min-w-0">
            <div className="text-xs font-medium text-slate-500">Work Auth &amp; Sourcing</div>
            <div className="font-semibold text-slate-900 leading-snug flex items-start gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
              <span className="break-words">{candidate.workAuth || 'Work auth not specified'}</span>
            </div>
            <div className="text-[11px] text-slate-500 leading-snug break-words">
              {vendorLabel ? (
                matchedVendor && onOpenVendor ? (
                  <button
                    type="button"
                    onClick={() => onOpenVendor(matchedVendor)}
                    className="text-brand-700 font-semibold hover:underline cursor-pointer text-left"
                  >
                    via {vendorLabel}
                  </button>
                ) : (
                  <span className="text-amber-700 font-medium">via {vendorLabel}</span>
                )
              ) : (
                'Direct / Own Bench'
              )}
            </div>
          </div>

          {/* 3. Target Rate & Credentials */}
          <div className="px-6 py-4 space-y-1.5 min-w-0">
            <div className="text-xs font-medium text-slate-500">Target Rate</div>
            {rateMasked ? (
              <>
                <MaskedValue value="" isMasked={true} className="text-sm font-bold block" />
                <div className="text-[11px] text-slate-400">Rate protected for your role</div>
              </>
            ) : (
              <>
                <div className="font-mono font-bold text-slate-900 leading-snug break-words">
                  {formattedRate || 'Rate on request'}
                </div>
                <div className="text-[11px] text-slate-500 leading-snug break-words">
                  {resolvedEducation}
                </div>
              </>
            )}
          </div>

          {/* 4. Pipeline Activity & Owner */}
          <div className="px-6 py-4 space-y-1.5 min-w-0">
            <div className="text-xs font-medium text-slate-500">Pipeline &amp; Owner</div>
            <div className="font-semibold text-slate-900 leading-snug">
              {linkedSubmissions.length} Submissions &middot;{' '}
              <span className="text-emerald-700">{activeLinkedPlacements.length} Active</span>
            </div>
            <div className="text-[11px] text-slate-500 leading-snug break-words">
              Owner:{' '}
              <strong className="font-medium text-slate-700">
                {candidate.assignedRecruiter || 'Unassigned'}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Underline Workspace Tabs */}
      <DetailUnderlineTabs
        ariaLabel="Consultant workspace sections"
        tabs={consultantTabs}
        activeTab={workspaceTab}
        onChange={setWorkspaceTab}
      />

      {/* TAB 1: Overview & Resume */}
      {workspaceTab === 'resume' && (
        <div className="space-y-6">
          <section className="bg-white rounded-xl border border-slate-200/80 card-shadow overflow-hidden text-xs">
            <DetailExpandableSkillsBar
              embedded
              label="Core Skills:"
              skills={skills}
              editLabel="Edit skills"
              onEdit={onUpdateCandidate ? () => setIsEditing(true) : undefined}
            />

            <div className="p-6 space-y-3 border-t border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-brand-600 shrink-0" />
                  <h2 className="text-sm font-semibold text-slate-900">Executive Summary</h2>
                </div>
                <span className="text-[11px] text-slate-400 inline-flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                  <span>
                    {hasStoredOriginalCv
                      ? 'Use Original CV above to download the uploaded resume file'
                      : 'Use Profile PDF above to share a client-ready summary'}
                  </span>
                </span>
              </div>
              {summarySection && summarySection.items.length > 0 ? (
                <div className="space-y-2 text-sm text-slate-600 leading-relaxed">
                  {summarySection.items.map((line, idx) => (
                    <p key={idx}>{cleanExtractedResumeText(line.replace(/^[•\-\s]+/, ''))}</p>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-600 leading-relaxed">{fallbackSummary}</p>
              )}
            </div>
          </section>

          {detailSections.length > 0 ? (
            <section className="bg-white rounded-xl border border-slate-200/80 card-shadow p-6 space-y-4 text-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-brand-600 shrink-0" />
                  <h2 className="text-sm font-semibold text-slate-900">
                    Extracted Resume Details &amp; Experience
                  </h2>
                </div>
                <span className="text-xs font-medium text-slate-400 tabular-nums">
                  {detailSections.length} {detailSections.length === 1 ? 'section' : 'sections'}
                </span>
              </div>

              <div className="space-y-3">
                {detailSections.map((section, sIdx) => (
                  <div
                    key={`${section.title}_${sIdx}`}
                    className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 space-y-2"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                      {getSectionIcon(section.title)}
                      <span>{section.title}</span>
                    </div>
                    <div className="space-y-2 text-sm text-slate-700 leading-relaxed">
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
            <section className="bg-white rounded-xl border border-slate-200/80 card-shadow p-6 space-y-2.5 text-xs">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-brand-600 shrink-0" />
                <h2 className="text-sm font-semibold text-slate-900">
                  Consultant Readiness Overview
                </h2>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Detailed work history text is not attached to this directory entry. Use{' '}
                <strong className="font-semibold text-slate-700">Edit Profile</strong> to upload an
                original CV file or update profile attributes.
              </p>
            </section>
          )}
        </div>
      )}

      {/* TAB 2: Requisition Submissions */}
      {workspaceTab === 'submissions' && (
        <section className="bg-white rounded-xl border border-slate-200/80 card-shadow overflow-hidden text-xs">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Briefcase className="w-3.5 h-3.5 text-brand-600" />
              <h2 className="font-bold text-slate-900">
                Requisition Submissions ({linkedSubmissions.length})
              </h2>
            </div>
            {linkedSubmissions.length > 0 && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={subSearch}
                  onChange={(e) => setSubSearch(e.target.value)}
                  placeholder="Filter submissions..."
                  className="pl-8 pr-3 py-1 text-xs border border-slate-200 rounded-lg bg-white w-full sm:w-52 text-slate-700 focus:outline-none focus:border-brand-600"
                />
              </div>
            )}
          </div>
          {linkedSubmissions.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              Not submitted to any requisitions yet. Use <strong>Submit to Req</strong> above to submit.
            </div>
          ) : filteredSubmissions.length === 0 ? (
            <div className="py-10 text-center text-slate-400">
              No submissions match "{subSearch}".{' '}
              <button
                type="button"
                onClick={() => setSubSearch('')}
                className="font-semibold text-brand-600 hover:underline cursor-pointer"
              >
                Show all
              </button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <tr>
                      <SortableTableHeader
                        label="Req ID"
                        column="code"
                        sort={subsSort.sort}
                        onSort={subsSort.handleSort}
                        defaultDir="asc"
                        className="pl-6 pr-4 py-3 whitespace-nowrap"
                      />
                      <SortableTableHeader
                        label="Opportunity"
                        column="opportunityTitle"
                        sort={subsSort.sort}
                        onSort={subsSort.handleSort}
                        defaultDir="asc"
                        className="px-4 py-3 whitespace-nowrap"
                      />
                      <SortableTableHeader
                        label="Client"
                        column="companyName"
                        sort={subsSort.sort}
                        onSort={subsSort.handleSort}
                        defaultDir="asc"
                        className="px-4 py-3 whitespace-nowrap"
                      />
                      <SortableTableHeader
                        label="Interview"
                        column="interviewDate"
                        sort={subsSort.sort}
                        onSort={subsSort.handleSort}
                        defaultDir="desc"
                        className="px-4 py-3 whitespace-nowrap"
                      />
                      <SortableTableHeader
                        label="Stage"
                        column="stage"
                        sort={subsSort.sort}
                        onSort={subsSort.handleSort}
                        defaultDir="asc"
                        className="px-4 py-3 whitespace-nowrap"
                      />
                      <th className="pl-4 pr-6 py-3 text-right whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {submissionsPg.pagedItems.map(({ requirement: req, submission: sub }) => (
                      <tr
                        key={sub.id}
                        onClick={() => onOpenRequirement && onOpenRequirement(req)}
                        className={
                          onOpenRequirement
                            ? 'hover:bg-slate-50/80 cursor-pointer transition-colors group'
                            : undefined
                        }
                      >
                        <td className="pl-6 pr-4 py-3.5 whitespace-nowrap">
                          <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                            {req.code}
                          </span>
                        </td>
                        <td
                          className={`px-4 py-3.5 font-semibold text-slate-900 ${
                            onOpenRequirement ? 'group-hover:text-brand-700 transition-colors' : ''
                          }`}
                        >
                          {req.opportunityTitle}
                        </td>
                        <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap">
                          {req.companyName}
                        </td>
                        <td className="px-4 py-3.5 text-[11px] text-brand-700 font-medium whitespace-nowrap">
                          {sub.interviewDateTime || sub.interviewDate
                            ? formatDateTimeBadge(sub.interviewDateTime || sub.interviewDate) ||
                              sub.interviewDate
                            : '—'}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <StatusBadge
                            stage={sub.stage}
                            dotClass={getStageDotClass(sub.stage)}
                            size="xs"
                          />
                        </td>
                        <td className="pl-4 pr-6 py-3.5 text-right whitespace-nowrap">
                          {!sub.id.startsWith('legacy_') ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPitchTarget({ requirement: req, submission: sub });
                              }}
                              className="h-7 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-brand-50/70 hover:border-brand-200 text-slate-700 hover:text-brand-700 text-[11px] font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                            >
                              <Mail className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                              <span>Prepare Pitch</span>
                            </button>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <TablePagination
                page={submissionsPg.page}
                limit={submissionsPg.limit}
                total={submissionsPg.total}
                onPageChange={submissionsPg.setPage}
                onLimitChange={submissionsPg.setLimit}
                itemLabel="submissions"
                pageSizeOptions={[10, 20, 50]}
              />
            </>
          )}
        </section>
      )}

      {/* TAB 3: Billable Placements */}
      {workspaceTab === 'placements' && (
        <section className="bg-white rounded-xl border border-slate-200/80 card-shadow overflow-hidden text-xs">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <h2 className="font-bold text-slate-900">
                Billable Placements ({linkedPlacements.length})
              </h2>
            </div>
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
          {linkedPlacements.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              No billable placements recorded for this consultant yet.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <tr>
                      <SortableTableHeader
                        label="Client"
                        column="customer"
                        sort={placementsSort.sort}
                        onSort={placementsSort.handleSort}
                        defaultDir="asc"
                        className="pl-6 pr-4 py-3 whitespace-nowrap"
                      />
                      <SortableTableHeader
                        label="Role / Skill"
                        column="skillRole"
                        sort={placementsSort.sort}
                        onSort={placementsSort.handleSort}
                        defaultDir="asc"
                        className="px-4 py-3 whitespace-nowrap"
                      />
                      <SortableTableHeader
                        label="Contract Period"
                        column="startDate"
                        sort={placementsSort.sort}
                        onSort={placementsSort.handleSort}
                        defaultDir="desc"
                        className="px-4 py-3 whitespace-nowrap"
                      />
                      <SortableTableHeader
                        label="Bill Rate"
                        column="billing"
                        sort={placementsSort.sort}
                        onSort={placementsSort.handleSort}
                        defaultDir="desc"
                        disabled={rateMasked}
                        className="px-4 py-3 whitespace-nowrap"
                      />
                      <SortableTableHeader
                        label="Status"
                        column="status"
                        sort={placementsSort.sort}
                        onSort={placementsSort.handleSort}
                        defaultDir="asc"
                        align="right"
                        className="pl-4 pr-6 py-3 whitespace-nowrap"
                      />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {placementsPg.pagedItems.map((p) => (
                      <tr
                        key={p.id}
                        onClick={onSelectPlacement ? () => onSelectPlacement(p) : undefined}
                        className={`group transition-colors ${
                          onSelectPlacement ? 'hover:bg-slate-50/90 cursor-pointer' : 'hover:bg-slate-50/70'
                        }`}
                      >
                        <td
                          className={`pl-6 pr-4 py-3.5 font-semibold text-slate-900 whitespace-nowrap ${
                            onSelectPlacement ? 'group-hover:text-brand-700 transition-colors' : ''
                          }`}
                        >
                          {p.customer}
                        </td>
                        <td className="px-4 py-3.5 text-slate-600">
                          {p.skillRole}{' '}
                          <span className="text-[11px] text-slate-400">
                            &middot; {p.placementType}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap font-mono text-[11px]">
                          {p.startDate} &rarr; {p.endDate}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <MaskedValue value={p.billing} isMasked={rateMasked} />
                        </td>
                        <td className="pl-4 pr-6 py-3.5 text-right whitespace-nowrap">
                          <StatusBadge stage={p.status} size="xs" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <TablePagination
                page={placementsPg.page}
                limit={placementsPg.limit}
                total={placementsPg.total}
                onPageChange={placementsPg.setPage}
                onLimitChange={placementsPg.setLimit}
                itemLabel="placements"
                pageSizeOptions={[10, 20, 50]}
              />
            </>
          )}
        </section>
      )}

      {/* TAB 4: Profile Details & Attributes */}
      {workspaceTab === 'details' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-8 space-y-5">
            <div className="bg-white rounded-xl border border-slate-200/80 card-shadow overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-3.5 h-3.5 text-brand-600" />
                  <h3 className="text-xs font-bold text-slate-900">Profile &amp; Contact Summary</h3>
                </div>
                {onUpdateCandidate && (
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="text-xs font-semibold text-brand-600 hover:text-brand-700 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Pencil className="w-3 h-3" />
                    <span>Edit Profile</span>
                  </button>
                )}
              </div>
              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-5">
                <div>
                  <div className="text-[11px] font-medium text-slate-400">Email</div>
                  <div className="mt-1 text-xs font-medium text-slate-800 break-all">
                    {candidate.email ? (
                      <a
                        href={`mailto:${candidate.email}`}
                        className="inline-flex items-center gap-1.5 text-brand-700 hover:underline"
                      >
                        <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{candidate.email}</span>
                      </a>
                    ) : (
                      '—'
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-medium text-slate-400">Phone</div>
                  <div className="mt-1 text-xs font-medium text-slate-800">
                    {candidate.phone ? (
                      <a
                        href={`tel:${candidate.phone}`}
                        className="inline-flex items-center gap-1.5 hover:text-brand-600"
                      >
                        <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{candidate.phone}</span>
                      </a>
                    ) : (
                      '—'
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-medium text-slate-400">Work Auth</div>
                  <div className="mt-1 text-xs font-medium text-slate-800">
                    {candidate.workAuth || '—'}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-medium text-slate-400">Target Rate</div>
                  <div className="mt-1 text-xs font-semibold text-slate-900">
                    {rateMasked ? '•••• (Restricted)' : formattedRate || 'Rate on request'}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-medium text-slate-400">Relocation</div>
                  <div className="mt-1 text-xs font-medium text-slate-800">
                    {candidate.relocation === 'Yes' ? 'Open (Yes)' : candidate.relocation || '—'}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-medium text-slate-400">Recruiter</div>
                  <div className="mt-1 text-xs font-medium text-slate-800">
                    {candidate.assignedRecruiter || 'Unassigned'}
                  </div>
                </div>
                <div className="sm:col-span-2 lg:col-span-3 pt-4 border-t border-slate-100">
                  <div className="text-[11px] font-medium text-slate-400">Partner Vendor</div>
                  <div className="mt-1 text-xs font-medium text-slate-800 [overflow-wrap:anywhere]">
                    {!vendorLabel ? (
                      <span className="text-slate-500">Direct / Own Bench</span>
                    ) : matchedVendor && onOpenVendor ? (
                      <button
                        type="button"
                        onClick={() => onOpenVendor(matchedVendor)}
                        className="text-brand-700 font-semibold hover:underline cursor-pointer"
                      >
                        {vendorLabel}
                      </button>
                    ) : (
                      <span className="text-amber-700 font-semibold">{vendorLabel}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200/80 card-shadow overflow-hidden text-xs">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-3.5 h-3.5 text-brand-600" />
                  <h3 className="font-bold text-slate-900">Education &amp; Credentials</h3>
                </div>
                <div className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                  <BadgeCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Verified CRM Record</span>
                </div>
              </div>
              <div className="p-6 space-y-2.5">
                <div className="text-xs font-semibold text-slate-900">{resolvedEducation}</div>
                {educationSection && educationSection.items.length > 0 && (
                  <div className="space-y-1 text-[11px] text-slate-600 leading-relaxed">
                    {educationSection.items.map((line, idx) => (
                      <div key={idx}>{cleanExtractedResumeText(line.replace(/^[•\-\s]+/, ''))}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white rounded-xl border border-slate-200/80 card-shadow overflow-hidden text-xs">
              <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/50">
                <h3 className="font-bold text-slate-900">Activity Summary</h3>
              </div>
              <div className="p-5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500 font-medium">Submissions</span>
                  <span className="font-semibold text-slate-900">{linkedSubmissions.length}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500 font-medium">Active Placements</span>
                  <span
                    className={`font-semibold ${
                      activeLinkedPlacements.length > 0 ? 'text-emerald-700' : 'text-slate-800'
                    }`}
                  >
                    {activeLinkedPlacements.length}
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setWorkspaceTab('submissions')}
                    className="w-full py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold text-xs inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>View Submissions</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>

            {customFieldEntries.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200/80 card-shadow overflow-hidden text-xs">
                <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-brand-600" />
                  <h3 className="font-bold text-slate-900">Additional Attributes</h3>
                </div>
                <dl className="p-5 space-y-2.5">
                  {customFieldEntries.map(([fieldName, value]) => (
                    <div key={fieldName} className="flex items-start justify-between gap-2">
                      <dt className="text-slate-400 font-medium capitalize shrink-0">
                        {fieldName.replace(/_/g, ' ')}
                      </dt>
                      <dd className="text-slate-800 font-medium text-right min-w-0 [overflow-wrap:anywhere]">
                        {String(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {onDeleteCandidate && (
              <div className="bg-white rounded-xl border border-slate-200/80 card-shadow p-5 space-y-3 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-bold text-slate-900">Profile Lifecycle</h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Remove profile and submission records.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDeleteModal(true)}
                    className="shrink-0 px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 font-semibold text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {onDeleteCandidate && (
        <ConfirmDeleteModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          title={isBillable ? 'Active Placement Protected' : 'Delete Consultant?'}
          description={
            <>
              Permanently remove <strong className="text-slate-800">{candidate.fullName}</strong> from
              your roster?
            </>
          }
          warningText="This cannot be undone and removes associated job submissions."
          confirmLabel="Delete Consultant"
          blockedMessage={
            isBillable
              ? 'This consultant currently has a placement record. End or remove their placement under Billable Consultants before deleting this profile.'
              : undefined
          }
          blockedActionLabel="Go to Billable Consultants"
          onBlockedAction={onNavigateToBillable}
          onConfirm={async () => {
            await onDeleteCandidate(candidate);
            onBack();
          }}
        />
      )}

      {onUpdateCandidate && (
        <EditConsultantModal
          candidate={candidate}
          isOpen={isEditing}
          vendors={vendors}
          rateMasked={rateMasked}
          onClose={() => setIsEditing(false)}
          onUpdateCandidate={onUpdateCandidate}
        />
      )}

      <PreparePitchModal
        isOpen={Boolean(pitchTarget)}
        onClose={() => setPitchTarget(null)}
        submissionId={pitchTarget?.submission.id || ''}
        requirementCode={pitchTarget?.requirement.code || ''}
        requirementTitle={pitchTarget?.requirement.opportunityTitle || ''}
        companyName={pitchTarget?.requirement.companyName}
        candidate={candidate}
        fallbackCandidateName={candidate.fullName}
        rateMasked={rateMasked}
        initialStage={pitchTarget?.submission.stage}
        showToast={showToast}
      />
    </section>
  );
};
