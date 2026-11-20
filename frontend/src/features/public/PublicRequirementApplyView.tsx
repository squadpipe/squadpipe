import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Briefcase,
  CheckCircle2,
  Eye,
  FileText,
  Loader2,
  RotateCcw,
  ShieldCheck,
  X,
} from 'lucide-react';
import { apiClient } from '../../config/api.config';
import { CustomSelect } from '../../components/shared/CustomSelect';
import { CustomQuestionFieldInput } from '../../components/shared/CustomQuestionFieldInput';
import { RichTextDisplay } from '../../components/shared/RichTextDisplay';
import { buildClientSafeSummaryHtml, isRichTextEmpty } from '../../utils/richText';
import { ALLOWED_CV_ACCEPT, validateCvFileSelection } from '../../utils/cvFiles';
import {
  CustomQuestionFieldType,
} from '../../types';
import {
  getFieldWidthColSpanClass,
  resolveOrderedFormEntries,
} from '../../utils/applicationForms';
import {
  formatMissingFieldsMessage,
  getMissingFieldLabels,
  INVALID_FIELD_CLASSES,
} from '../../utils/formValidation';

interface PublicFormCustomField {
  key: string;
  name: string;
  type: CustomQuestionFieldType;
  required: boolean;
  width?: 'half' | 'full';
  options: string[];
}

interface PublicFormTemplateConfig {
  id: string;
  name: string;
  heading: string;
  subheading: string;
  includeCurrentTitle: boolean;
  requireCurrentTitle: boolean;
  includeExpectedRate: boolean;
  requireExpectedRate: boolean;
  includeVendorName: boolean;
  requireVendorName: boolean;
  includeNoticePeriod: boolean;
  requireNoticePeriod: boolean;
  includeLinkedinUrl: boolean;
  requireLinkedinUrl: boolean;
  fieldWidths?: Record<string, 'half' | 'full'>;
  fieldOrder?: string[];
  customFields: PublicFormCustomField[];
}

interface PublicRequirementDetails {
  agencyName: string;
  opportunityTitle: string;
  location: string;
  workModel: 'Remote' | 'Hybrid' | 'Onsite';
  skillsRequired: string;
  openPositions: number;
  publicDescription?: string | null;
  highlights?: string[];
  engagementSummary?: string | null;
  formTemplate?: PublicFormTemplateConfig;
  isPreview?: boolean;
  publicLinkEnabled?: boolean;
}

interface PublicApplicationConfirmation {
  agencyName: string;
  submissionId: string;
  candidateName: string;
  opportunityTitle: string;
}

interface PublicRequirementApplyViewProps {
  token: string;
}

const WORK_AUTH_OPTIONS = [
  'US Citizen',
  { value: 'Green Card', label: 'Green Card (Permanent Resident)' },
  { value: 'H-1B', label: 'H-1B (Transfer Ready)' },
  { value: 'TN Visa', label: 'TN Visa' },
  { value: 'OPT EAD', label: 'OPT / CPT EAD' },
  'Authorized to Work',
];

export const PublicRequirementApplyView: React.FC<PublicRequirementApplyViewProps> = ({
  token,
}) => {
  const [loading, setLoading] = useState(true);
  const [unavailableMessage, setUnavailableMessage] = useState<string>('');
  const [roleDetails, setRoleDetails] = useState<PublicRequirementDetails | null>(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [workAuth, setWorkAuth] = useState('US Citizen');
  const [currentTitle, setCurrentTitle] = useState('');
  const [submittedRate, setSubmittedRate] = useState('');
  const [submittedVendorName, setSubmittedVendorName] = useState('');
  const [noticePeriod, setNoticePeriod] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});
  const [honeypotWebsite, setHoneypotWebsite] = useState('');
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [isParsingCv, setIsParsingCv] = useState(false);
  const [cvAutoFilled, setCvAutoFilled] = useState(false);
  const [formError, setFormError] = useState('');
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAllSkills, setShowAllSkills] = useState(false);
  const [confirmation, setConfirmation] = useState<PublicApplicationConfirmation | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const parseRequestIdRef = useRef(0);

  const previewSearchParams = React.useMemo(() => {
    if (typeof window === 'undefined') return { preview: '', templateId: '' };
    const sp = new URLSearchParams(window.location.search);
    return {
      preview: sp.get('preview')?.trim() || '',
      templateId: sp.get('templateId')?.trim() || '',
    };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setUnavailableMessage('');

    const params: Record<string, string> = {};
    if (previewSearchParams.preview) params.preview = previewSearchParams.preview;
    if (previewSearchParams.templateId) params.templateId = previewSearchParams.templateId;

    apiClient
      .get(`/public/apply/${encodeURIComponent(token)}`, { params })
      .then((res) => {
        if (!active) return;
        if (res.data?.success && res.data.data) {
          setRoleDetails(res.data.data);
          document.title = `${res.data.data.isPreview ? 'Preview: ' : ''}${res.data.data.opportunityTitle} — ${res.data.data.agencyName}`;
        } else {
          setUnavailableMessage('This position is no longer accepting applications.');
        }
      })
      .catch((err: any) => {
        if (!active) return;
        setUnavailableMessage(
          err?.response?.data?.message || 'This position is no longer accepting applications.'
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token, previewSearchParams]);

  const isPreviewMode = Boolean(roleDetails?.isPreview);

  const handleCvPick = async (file: File | undefined | null) => {
    if (!file) return;
    const validationErr = validateCvFileSelection(file);
    if (validationErr) {
      setFormError(validationErr);
      return;
    }
    setFormError('');
    setCvFile(file);
    setCvAutoFilled(false);

    const requestId = ++parseRequestIdRef.current;
    setIsParsingCv(true);
    try {
      const parseBody = new FormData();
      parseBody.append('file', file, file.name);
      const parseParams: Record<string, string> = {};
      if (previewSearchParams.preview) parseParams.preview = previewSearchParams.preview;
      if (previewSearchParams.templateId) parseParams.templateId = previewSearchParams.templateId;
      const res = await apiClient.post(
        `/public/apply/${encodeURIComponent(token)}/parse-cv`,
        parseBody,
        { params: parseParams }
      );
      if (requestId !== parseRequestIdRef.current) return;
      const extracted = res.data?.data;
      if (extracted && typeof extracted === 'object') {
        let filledAny = false;
        if (extracted.fullName && !fullName.trim()) {
          setFullName(String(extracted.fullName));
          filledAny = true;
        }
        if (extracted.email && !email.trim()) {
          setEmail(String(extracted.email));
          filledAny = true;
        }
        if (extracted.phone && !phone.trim()) {
          setPhone(String(extracted.phone));
          filledAny = true;
        }
        if (extracted.workAuth && workAuth === 'US Citizen') {
          setWorkAuth(String(extracted.workAuth));
          filledAny = true;
        }
        if (extracted.currentTitle && !currentTitle.trim()) {
          setCurrentTitle(String(extracted.currentTitle));
          filledAny = true;
        }
        if (filledAny) setCvAutoFilled(true);
      }
    } catch {
      // Non-blocking basic pre-fill fallback: applicant can still fill fields manually
    } finally {
      if (requestId === parseRequestIdRef.current) {
        setIsParsingCv(false);
      }
    }
  };

  const formTemplate: PublicFormTemplateConfig = roleDetails?.formTemplate || {
    id: 'form-standard-default',
    name: 'Standard Candidate & Partner Form',
    heading: 'Submit Candidate Profile & Resume',
    subheading:
      'Candidates applying directly or partner agencies submitting consultants can attach a resume below.',
    includeCurrentTitle: true,
    requireCurrentTitle: false,
    includeExpectedRate: true,
    requireExpectedRate: false,
    includeVendorName: true,
    requireVendorName: false,
    includeNoticePeriod: true,
    requireNoticePeriod: false,
    includeLinkedinUrl: false,
    requireLinkedinUrl: false,
    customFields: [],
  };

  const isFullNameInvalid = validationAttempted && !fullName.trim();
  const isEmailInvalid = validationAttempted && !email.trim();
  const isPhoneInvalid = validationAttempted && !phone.trim();
  const isCvInvalid = validationAttempted && !cvFile;
  const isCurrentTitleInvalid =
    validationAttempted &&
    formTemplate.includeCurrentTitle &&
    formTemplate.requireCurrentTitle &&
    !currentTitle.trim();
  const isExpectedRateInvalid =
    validationAttempted &&
    formTemplate.includeExpectedRate &&
    formTemplate.requireExpectedRate &&
    !submittedRate.trim();
  const isVendorNameInvalid =
    validationAttempted &&
    formTemplate.includeVendorName &&
    formTemplate.requireVendorName &&
    !submittedVendorName.trim();
  const isNoticePeriodInvalid =
    validationAttempted &&
    formTemplate.includeNoticePeriod &&
    formTemplate.requireNoticePeriod &&
    !noticePeriod.trim();
  const isLinkedinUrlInvalid =
    validationAttempted &&
    formTemplate.includeLinkedinUrl &&
    formTemplate.requireLinkedinUrl &&
    !linkedinUrl.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const missingFields = getMissingFieldLabels([
      { label: 'Resume / CV File', valid: Boolean(cvFile) },
      { label: 'Full Name', valid: Boolean(fullName.trim()) },
      { label: 'Email', valid: Boolean(email.trim()) },
      { label: 'Phone', valid: Boolean(phone.trim()) },
      { label: 'Work Authorization', valid: Boolean(workAuth.trim()) },
      ...(formTemplate.includeCurrentTitle && formTemplate.requireCurrentTitle
        ? [{ label: 'Current Title / Role', valid: Boolean(currentTitle.trim()) }]
        : []),
      ...(formTemplate.includeExpectedRate && formTemplate.requireExpectedRate
        ? [{ label: 'Expected Hourly Rate', valid: Boolean(submittedRate.trim()) }]
        : []),
      ...(formTemplate.includeVendorName && formTemplate.requireVendorName
        ? [{ label: 'Partner / Vendor Agency Name', valid: Boolean(submittedVendorName.trim()) }]
        : []),
      ...(formTemplate.includeNoticePeriod && formTemplate.requireNoticePeriod
        ? [{ label: 'Availability / Notice Period', valid: Boolean(noticePeriod.trim()) }]
        : []),
      ...(formTemplate.includeLinkedinUrl && formTemplate.requireLinkedinUrl
        ? [{ label: 'LinkedIn Profile URL', valid: Boolean(linkedinUrl.trim()) }]
        : []),
      ...(formTemplate.customFields || [])
        .filter((cf) => cf.required)
        .map((cf) => {
          const val = customFieldValues[cf.key] || '';
          return {
            label: cf.name,
            valid: cf.type === 'RICH_TEXT' ? !isRichTextEmpty(val) : Boolean(val.trim()),
          };
        }),
    ]);
    if (missingFields.length > 0 || !cvFile) {
      setValidationAttempted(true);
      setFormError(formatMissingFieldsMessage(missingFields));
      return;
    }
    setValidationAttempted(false);

    if (isPreviewMode && roleDetails) {
      setConfirmation({
        agencyName: roleDetails.agencyName,
        submissionId: 'preview-only',
        candidateName: fullName.trim(),
        opportunityTitle: roleDetails.opportunityTitle,
      });
      return;
    }

    const formData = new FormData();
    formData.append('fullName', fullName.trim());
    formData.append('email', email.trim());
    formData.append('phone', phone.trim());
    formData.append('workAuth', workAuth.trim());
    if (currentTitle.trim()) formData.append('currentTitle', currentTitle.trim());
    if (submittedRate.trim()) formData.append('submittedRate', submittedRate.trim());
    if (submittedVendorName.trim()) formData.append('submittedVendorName', submittedVendorName.trim());
    if (noticePeriod.trim()) formData.append('noticePeriod', noticePeriod.trim());
    if (linkedinUrl.trim()) formData.append('linkedinUrl', linkedinUrl.trim());
    if (Object.keys(customFieldValues).length > 0) {
      formData.append('customFields', JSON.stringify(customFieldValues));
    }
    if (honeypotWebsite.trim()) formData.append('_hpWebsite', honeypotWebsite.trim());
    formData.append('file', cvFile, cvFile.name);

    setIsSubmitting(true);
    try {
      const res = await apiClient.post(`/public/apply/${encodeURIComponent(token)}`, formData);
      if (res.data?.success && res.data.data) {
        setConfirmation(res.data.data);
      } else {
        setFormError('Unable to submit application. Please try again.');
      }
    } catch (err: any) {
      setFormError(
        err?.response?.data?.message ||
        err?.message ||
        'Unable to submit application right now.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-xl px-8 py-10 text-center space-y-3 max-w-md w-full">
          <Loader2 className="w-7 h-7 text-brand-600 animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-800">Loading position details...</p>
        </div>
      </div>
    );
  }

  if (unavailableMessage || !roleDetails) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-xl px-8 py-10 text-center space-y-4 max-w-md w-full">
          <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
            <Briefcase className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-base font-bold text-slate-900">Application Link Unavailable</h1>
            <p className="text-xs text-slate-500 leading-relaxed">
              {unavailableMessage || 'This position is no longer accepting applications.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (confirmation) {
    const isPreviewSubmission = confirmation.submissionId === 'preview-only' || isPreviewMode;
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-xl p-8 max-w-lg w-full text-center space-y-5">
          <div className="w-14 h-14 rounded-xl border bg-emerald-50 border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto">
            {isPreviewSubmission ? (
              <Eye className="w-7 h-7" />
            ) : (
              <CheckCircle2 className="w-7 h-7" />
            )}
          </div>
          <div className="space-y-1.5">
            <span className="inline-block text-[11px] font-semibold border px-2.5 py-0.5 rounded-full text-emerald-700 bg-white border-emerald-300">
              {isPreviewSubmission ? 'Preview Complete' : 'Application Submitted'}
            </span>
            <h1 className="text-xl font-bold text-slate-900 pt-1">
              {isPreviewSubmission
                ? `Everything looks good, ${confirmation.candidateName}`
                : `Thank you, ${confirmation.candidateName}`}
            </h1>
            <p className="text-xs text-slate-600 leading-relaxed">
              {isPreviewSubmission ? (
                <>
                  Your test entry on{' '}
                  <span className="font-semibold text-slate-900">{formTemplate.name}</span> for{' '}
                  <span className="font-semibold text-slate-900">
                    {confirmation.opportunityTitle}
                  </span>{' '}
                  is ready. Since this is a preview, no application was saved.
                </>
              ) : (
                <>
                  Your resume has been received by{' '}
                  <span className="font-semibold text-slate-900">{confirmation.agencyName}</span>{' '}
                  for{' '}
                  <span className="font-semibold text-slate-900">
                    {confirmation.opportunityTitle}
                  </span>
                  . Our recruiting team will review your profile and follow up shortly.
                </>
              )}
            </p>
          </div>
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 text-left text-xs space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-400">Position</span>
              <span className="font-semibold text-slate-800">{confirmation.opportunityTitle}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-400">Submitted To</span>
              <span className="font-semibold text-slate-800">{confirmation.agencyName}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-400">Status</span>
              <span
                className={`font-semibold ${isPreviewSubmission ? 'text-slate-600' : 'text-emerald-700'
                  }`}
              >
                {isPreviewSubmission ? 'Preview Only' : 'Received & Under Review'}
              </span>
            </div>
          </div>
          {isPreviewSubmission && (
            <button
              type="button"
              onClick={() => setConfirmation(null)}
              className="px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Back to Form</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  const skillList = Array.from(
    new Map(
      roleDetails.skillsRequired
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => [s.toLowerCase(), s])
    ).values()
  );
  const INITIAL_VISIBLE_SKILLS = 18;
  const visibleSkills = showAllSkills ? skillList : skillList.slice(0, INITIAL_VISIBLE_SKILLS);
  const hiddenSkillsCount = Math.max(0, skillList.length - INITIAL_VISIBLE_SKILLS);

  // Clean location label without redundant "(Onsite)" suffix
  const cleanLocationLabel =
    roleDetails.location
      .replace(/\s*\((?:Onsite|On-Site|Remote|Hybrid)\)\s*$/i, '')
      .trim() || roleDetails.location;

  const autoGeneratedSummary = buildClientSafeSummaryHtml({
    opportunityTitle: roleDetails.opportunityTitle,
    openPositions: roleDetails.openPositions,
    workModel: roleDetails.workModel,
    location: cleanLocationLabel,
    skillsRequired: skillList.join(', '),
  });

  const roleSummaryText =
    (roleDetails.publicDescription && roleDetails.publicDescription.trim()) ||
    autoGeneratedSummary;
  const highlights = Array.isArray(roleDetails.highlights) ? roleDetails.highlights : [];
  const summaryAlreadyHasBullets = /<(?:ul|ol)\b/i.test(roleSummaryText);

  const formHeading =
    formTemplate.heading && formTemplate.heading !== 'Submit Candidate Profile & Resume'
      ? formTemplate.heading
      : 'Apply for this job';
  const defaultFormSubheadingPlain =
    'Candidates applying directly or partner agencies submitting consultants can attach a resume below.';
  const plainSubheading = String(formTemplate.subheading || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const hasCustomSubheading =
    Boolean(plainSubheading) && plainSubheading !== defaultFormSubheadingPlain;

  const inputBaseClass =
    'w-full px-3 py-2 rounded-md border text-xs text-slate-900 bg-white placeholder:text-slate-400 focus:outline-none focus:border-brand-600 focus:ring-1 focus:ring-brand-600';

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col">
      {/* Minimal Pure-White Top Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-6xl w-full mx-auto px-6 sm:px-8 h-14 flex items-center justify-between gap-4">
          <span className="text-[15px] font-bold tracking-tight text-slate-900 truncate">
            {roleDetails.agencyName}
          </span>

          {isPreviewMode && (
            <div className="flex items-center gap-3 shrink-0">
              <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-slate-500">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${roleDetails.publicLinkEnabled ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                />
                <span>
                  {roleDetails.publicLinkEnabled ? 'Live link active' : 'Draft mode'} &middot; Submissions aren&rsquo;t saved
                </span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-brand-300 text-[11px] font-semibold text-brand-700 tracking-tight">
                <Eye className="w-3 h-3 text-brand-600 shrink-0" />
                <span>Preview</span>
              </span>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-6xl w-full mx-auto px-6 sm:px-8 py-8 sm:py-10 flex-1">
        {/* Clean Editorial Job Title & Metadata */}
        <div className="max-w-3xl">
          <h1 className="text-2xl sm:text-[28px] font-bold text-slate-900 tracking-tight leading-tight">
            {roleDetails.opportunityTitle}
          </h1>
          <div className="mt-2 text-xs sm:text-sm text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{roleDetails.workModel}</span>
            {cleanLocationLabel &&
              !cleanLocationLabel.toLowerCase().includes(roleDetails.workModel.toLowerCase()) && (
                <>
                  <span className="text-slate-400">&middot;</span>
                  <span>{cleanLocationLabel}</span>
                </>
              )}
            {roleDetails.engagementSummary && (
              <>
                <span className="text-slate-400">&middot;</span>
                <span>{roleDetails.engagementSummary}</span>
              </>
            )}
            <span className="text-slate-400">&middot;</span>
            <span>
              {roleDetails.openPositions}{' '}
              {roleDetails.openPositions === 1 ? 'opening' : 'openings'}
            </span>
          </div>
        </div>

        {/* Two-Column Content Grid */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* LEFT COLUMN (5 cols): Open Editorial Role Overview & Skills */}
          <div className="lg:col-span-5 space-y-6">
            <section>
              <h2 className="text-sm font-semibold text-slate-900 mb-2">About the role</h2>
              <RichTextDisplay content={roleSummaryText} />
            </section>

            {highlights.length > 0 && !summaryAlreadyHasBullets && (
              <section>
                <h2 className="text-sm font-semibold text-slate-900 mb-2">What you will do</h2>
                <ul className="list-disc pl-5 space-y-1.5 text-sm text-slate-700 leading-relaxed">
                  {highlights.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </section>
            )}

            {skillList.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-slate-900 mb-1.5">
                  Skills we are looking for
                </h2>
                <p className="text-sm text-slate-700 leading-relaxed">
                  {visibleSkills.join(', ')}
                  {hiddenSkillsCount > 0 && (
                    <>
                      {' '}
                      <button
                        type="button"
                        onClick={() => setShowAllSkills((prev) => !prev)}
                        className="text-xs font-semibold text-brand-600 hover:text-brand-700 underline underline-offset-2 cursor-pointer"
                      >
                        {showAllSkills ? 'Show less' : `+${hiddenSkillsCount} more`}
                      </button>
                    </>
                  )}
                </p>
              </section>
            )}
          </div>

          {/* RIGHT COLUMN (7 cols): Wide Crisp Bordered Application Form */}
          <div className="lg:col-span-7">
            <form
              noValidate
              onSubmit={handleSubmit}
              className="bg-white rounded-xl border border-slate-200 p-6 sm:p-7 space-y-4"
            >
              <div>
                <h2 className="text-base font-bold text-slate-900">{formHeading}</h2>
                {hasCustomSubheading ? (
                  <RichTextDisplay
                    content={formTemplate.subheading}
                    className="mt-1 text-xs text-slate-500 [&_p]:!text-xs [&_p]:!leading-relaxed [&_p]:!mb-1 [&_li]:!text-xs [&_ul]:!my-1"
                  />
                ) : (
                  <p className="text-xs text-slate-500 mt-0.5">
                    Fields marked * are required.
                  </p>
                )}
              </div>

              {/* Anti-spam honeypot (hidden from human visitors) */}
              <div className="sr-only" aria-hidden="true">
                <label htmlFor="hp_website">Website</label>
                <input
                  id="hp_website"
                  name="_hpWebsite"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypotWebsite}
                  onChange={(e) => setHoneypotWebsite(e.target.value)}
                />
              </div>

              {/* Compact File Browser Bar + Drag-and-Drop Support */}
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <label className="block text-xs font-medium text-slate-900">
                    Resume / CV *
                  </label>
                  {isParsingCv ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-600">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Reading resume...</span>
                    </span>
                  ) : cvAutoFilled ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Auto-filled</span>
                    </span>
                  ) : isCvInvalid ? (
                    <span className="text-[11px] font-medium text-rose-600">Required</span>
                  ) : null}
                </div>

                {cvFile ? (
                  <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-md border border-slate-300 bg-slate-50/70 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                      <span className="font-medium text-slate-900 truncate">{cvFile.name}</span>
                      <span className="text-[11px] text-slate-400 shrink-0">
                        ({(cvFile.size / 1024).toFixed(0)} KB)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        parseRequestIdRef.current += 1;
                        setCvFile(null);
                        setIsParsingCv(false);
                        setCvAutoFilled(false);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer shrink-0"
                      aria-label="Remove resume file"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleCvPick(e.dataTransfer.files?.[0]);
                    }}
                    className={`px-2.5 py-1.5 rounded-md border flex items-center gap-3 cursor-pointer bg-white transition-colors ${isCvInvalid
                      ? 'border-rose-400 bg-rose-50/30'
                      : 'border-slate-300 hover:border-slate-400'
                      }`}
                  >
                    <span className="px-2.5 py-1 rounded border border-slate-300 bg-slate-100 text-xs font-medium text-slate-800 shrink-0">
                      Browse...
                    </span>
                    <span className="text-xs text-slate-500 truncate">No file selected.</span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={ALLOWED_CV_ACCEPT}
                      onChange={(e) => handleCvPick(e.target.files?.[0])}
                      className="hidden"
                    />
                  </div>
                )}

                <p className="text-[11px] text-slate-500">
                  PDF, DOCX, DOC, TXT or RTF. Up to 15 MB.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3.5 gap-y-3.5 text-xs">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-slate-900">
                      Full name *
                    </label>
                    {isFullNameInvalid && (
                      <span className="text-[11px] font-medium text-rose-600">Required</span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Jordan Patel"
                    className={`${inputBaseClass} ${isFullNameInvalid ? INVALID_FIELD_CLASSES : 'border-slate-300'
                      }`}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-slate-900">Email *</label>
                    {isEmailInvalid && (
                      <span className="text-[11px] font-medium text-rose-600">Required</span>
                    )}
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="candidate@email.com"
                    className={`${inputBaseClass} ${isEmailInvalid ? INVALID_FIELD_CLASSES : 'border-slate-300'
                      }`}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-slate-900">Phone *</label>
                    {isPhoneInvalid && (
                      <span className="text-[11px] font-medium text-rose-600">Required</span>
                    )}
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (555) 234-5678"
                    className={`${inputBaseClass} ${isPhoneInvalid ? INVALID_FIELD_CLASSES : 'border-slate-300'
                      }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-900 mb-1">
                    Work authorization *
                  </label>
                  <CustomSelect
                    value={workAuth}
                    onChange={setWorkAuth}
                    ariaLabel="Work Authorization"
                    size="sm"
                    className="!rounded-md !border-slate-300 hover:!border-slate-400 !h-[34px] text-slate-900"
                    options={WORK_AUTH_OPTIONS}
                  />
                </div>

                {(() => {
                  const standardBindings = {
                    currentTitle: {
                      value: currentTitle,
                      onChange: setCurrentTitle,
                      invalid: isCurrentTitleInvalid,
                    },
                    expectedRate: {
                      value: submittedRate,
                      onChange: setSubmittedRate,
                      invalid: isExpectedRateInvalid,
                    },
                    noticePeriod: {
                      value: noticePeriod,
                      onChange: setNoticePeriod,
                      invalid: isNoticePeriodInvalid,
                    },
                    linkedinUrl: {
                      value: linkedinUrl,
                      onChange: setLinkedinUrl,
                      invalid: isLinkedinUrlInvalid,
                    },
                    vendorName: {
                      value: submittedVendorName,
                      onChange: setSubmittedVendorName,
                      invalid: isVendorNameInvalid,
                    },
                  };

                  return resolveOrderedFormEntries(formTemplate).map((entry) => {
                    if (entry.kind === 'standard') {
                      const binding = standardBindings[entry.key];
                      return (
                        <div
                          key={entry.key}
                          className={getFieldWidthColSpanClass(entry.width)}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-xs font-medium text-slate-900">
                              {entry.meta.applicantLabel}{' '}
                              {entry.required ? (
                                '*'
                              ) : (
                                <span className="text-slate-400 font-normal">(optional)</span>
                              )}
                            </label>
                            {binding.invalid && (
                              <span className="text-[11px] font-medium text-rose-600">
                                Required
                              </span>
                            )}
                          </div>
                          <input
                            type={entry.meta.inputType}
                            value={binding.value}
                            onChange={(e) => binding.onChange(e.target.value)}
                            placeholder={entry.meta.placeholder}
                            className={`${inputBaseClass} ${binding.invalid ? INVALID_FIELD_CLASSES : 'border-slate-300'
                              }`}
                          />
                        </div>
                      );
                    }

                    const cf = entry.field;
                    const val = customFieldValues[cf.key] || '';
                    const isCfInvalid =
                      validationAttempted &&
                      cf.required &&
                      (cf.type === 'RICH_TEXT' ? isRichTextEmpty(val) : !val.trim());

                    return (
                      <div key={cf.key} className={getFieldWidthColSpanClass(entry.width)}>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-medium text-slate-900">
                            {cf.name}{' '}
                            {cf.required ? (
                              '*'
                            ) : (
                              <span className="text-slate-400 font-normal">(optional)</span>
                            )}
                          </label>
                          {isCfInvalid && (
                            <span className="text-[11px] font-medium text-rose-600">Required</span>
                          )}
                        </div>
                        <CustomQuestionFieldInput
                          type={cf.type}
                          label={cf.name}
                          value={val}
                          onChange={(nextVal) =>
                            setCustomFieldValues((prev) => ({
                              ...prev,
                              [cf.key]: nextVal,
                            }))
                          }
                          options={cf.options}
                          required={Boolean(cf.required)}
                          isInvalid={isCfInvalid}
                          cleanSurface={true}
                        />
                      </div>
                    );
                  });
                })()}
              </div>

              {formError && (
                <div className="flex items-start gap-2 p-2.5 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="pt-1 space-y-3">
                {!isPreviewMode && (
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                    <ShieldCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>
                      Your details will be shared directly with {roleDetails.agencyName}.
                    </span>
                  </div>
                )}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 px-4 rounded-md bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isSubmitting ? 'Submitting application...' : 'Submit application'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>

      {/* Minimal Footer */}
      <footer className="border-t border-slate-200 bg-white mt-auto">
        <div className="max-w-6xl w-full mx-auto px-6 sm:px-8 py-4 flex items-center justify-between gap-4 text-[11px] text-slate-400">
          <span>&copy; {roleDetails.agencyName}</span>
          <span>Powered by SquadPipe</span>
        </div>
      </footer>
    </div>
  );
};
