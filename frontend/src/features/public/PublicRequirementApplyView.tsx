import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Briefcase,
  CheckCircle2,
  CloudUpload,
  FileText,
  Loader2,
  MapPin,
  ShieldCheck,
  UsersRound,
  X,
} from 'lucide-react';
import { apiClient } from '../../config/api.config';
import { CustomSelect } from '../../components/shared/CustomSelect';
import { RichTextDisplay } from '../../components/shared/RichTextDisplay';
import { buildClientSafeSummaryHtml } from '../../utils/richText';
import { ALLOWED_CV_ACCEPT, validateCvFileSelection } from '../../utils/cvFiles';
import {
  getFieldWidthColSpanClass,
  resolveFormFieldWidth,
} from '../../utils/applicationForms';
import {
  formatMissingFieldsMessage,
  getMissingFieldLabels,
  INVALID_FIELD_CLASSES,
} from '../../utils/formValidation';

interface PublicFormCustomField {
  key: string;
  name: string;
  type: 'TEXT' | 'DROPDOWN' | 'DATE' | 'NUMBER' | 'BOOLEAN';
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

  useEffect(() => {
    let active = true;
    setLoading(true);
    setUnavailableMessage('');

    apiClient
      .get(`/public/apply/${encodeURIComponent(token)}`)
      .then((res) => {
        if (!active) return;
        if (res.data?.success && res.data.data) {
          setRoleDetails(res.data.data);
          document.title = `${res.data.data.opportunityTitle} — ${res.data.data.agencyName}`;
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
  }, [token]);

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
      const res = await apiClient.post(
        `/public/apply/${encodeURIComponent(token)}/parse-cv`,
        parseBody
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
        .map((cf) => ({
          label: cf.name,
          valid: Boolean((customFieldValues[cf.key] || '').trim()),
        })),
    ]);
    if (missingFields.length > 0 || !cvFile) {
      setValidationAttempted(true);
      setFormError(formatMissingFieldsMessage(missingFields));
      return;
    }
    setValidationAttempted(false);

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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-xl card-shadow px-8 py-10 text-center space-y-3 max-w-md w-full">
          <Loader2 className="w-7 h-7 text-brand-600 animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-800">Loading position details...</p>
        </div>
      </div>
    );
  }

  if (unavailableMessage || !roleDetails) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-xl card-shadow px-8 py-10 text-center space-y-4 max-w-md w-full">
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
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-xl card-shadow p-8 max-w-lg w-full text-center space-y-5">
          <div className="w-14 h-14 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <div className="space-y-1.5">
            <span className="inline-block text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
              Application Submitted
            </span>
            <h1 className="text-xl font-bold text-slate-900 pt-1">
              Thank you, {confirmation.candidateName}
            </h1>
            <p className="text-xs text-slate-600 leading-relaxed">
              Your resume has been received by{' '}
              <span className="font-semibold text-slate-900">{confirmation.agencyName}</span> for{' '}
              <span className="font-semibold text-slate-900">
                {confirmation.opportunityTitle}
              </span>
              . Our recruiting team will review your profile and follow up shortly.
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
              <span className="font-semibold text-emerald-700">Received &amp; Under Review</span>
            </div>
          </div>
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
  const INITIAL_VISIBLE_SKILLS = 10;
  const visibleSkills = showAllSkills ? skillList : skillList.slice(0, INITIAL_VISIBLE_SKILLS);
  const hiddenSkillsCount = Math.max(0, skillList.length - INITIAL_VISIBLE_SKILLS);

  // Clean location label without duplicate "(Onsite)" if workModel is already displayed as a badge
  const cleanLocationLabel = roleDetails.location
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-center">
      <main className="max-w-6xl w-full mx-auto px-5 py-8 sm:py-10 flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT SIDE (5 cols): Clean Job Details, Rich Role Scope Summary & Key Skills */}
          <aside className="lg:col-span-5 lg:sticky lg:top-6">
            <section className="bg-white rounded-xl border border-slate-200/80 card-shadow p-6 space-y-5">
              {/* Role Badges & Title (Zero Internal Codes) */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200">
                    {roleDetails.workModel}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{cleanLocationLabel}</span>
                  </span>
                  <span className="text-slate-300">&bull;</span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600">
                    <UsersRound className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>
                      {roleDetails.openPositions}{' '}
                      {roleDetails.openPositions === 1 ? 'opening' : 'openings'}
                    </span>
                  </span>
                  {roleDetails.engagementSummary && (
                    <>
                      <span className="text-slate-300">&bull;</span>
                      <span className="text-[11px] font-medium text-slate-600">
                        {roleDetails.engagementSummary}
                      </span>
                    </>
                  )}
                </div>
                <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight leading-snug">
                  {roleDetails.opportunityTitle}
                </h1>
              </div>

              {/* Role Scope & Requirement Summary */}
              <div className="space-y-2.5 pt-4 border-t border-slate-100">
                <h2 className="text-xs font-semibold text-slate-800">
                  Role Overview &amp; Scope
                </h2>
                <div className="bg-slate-50/70 border border-slate-200/70 rounded-xl p-4">
                  <RichTextDisplay content={roleSummaryText} />
                </div>
              </div>

              {/* Sanitized Responsibilities / Highlights from JD (shown only if not already bulleted inside summary) */}
              {highlights.length > 0 && !summaryAlreadyHasBullets && (
                <div className="space-y-2.5 pt-4 border-t border-slate-100">
                  <h2 className="text-xs font-semibold text-slate-800">
                    Key Responsibilities &amp; Focus
                  </h2>
                  <ul className="space-y-2 text-xs text-slate-600">
                    {highlights.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2 leading-relaxed">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Key Required Skills (Single clean +N more / Show less toggle matching app standard) */}
              {skillList.length > 0 && (
                <div className="space-y-2.5 pt-4 border-t border-slate-100">
                  <h2 className="text-xs font-semibold text-slate-800">
                    Key Required Skills ({skillList.length})
                  </h2>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {visibleSkills.map((skill, idx) => (
                      <span
                        key={idx}
                        className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200/60"
                      >
                        {skill}
                      </span>
                    ))}
                    {hiddenSkillsCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowAllSkills((prev) => !prev)}
                        className="ml-1 inline-flex items-center text-[11px] font-semibold text-brand-600 hover:text-brand-700 underline underline-offset-2 whitespace-nowrap cursor-pointer transition-colors"
                      >
                        {showAllSkills ? 'Show less' : `+${hiddenSkillsCount} more`}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </section>
          </aside>

          {/* RIGHT SIDE (7 cols): Agency Brand Header + Application Form */}
              <div className="lg:col-span-7">
                <form
                  noValidate
                  onSubmit={handleSubmit}
                  className="bg-white rounded-xl border border-slate-200/80 card-shadow overflow-hidden"
                >
                  {/* Clean Right-Side Agency Header (Zero Internal Codes) */}
                  <div className="px-6 py-4 bg-[#141615] text-white flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center text-white flex-shrink-0">
                        <Briefcase className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-white truncate">
                          {roleDetails.agencyName}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Job Application &amp; Resume Upload
                        </div>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/25 text-[11px] font-semibold text-emerald-300 whitespace-nowrap">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span>Open Position</span>
                    </span>
                  </div>

                  <div className="p-6 space-y-5">
                    <div className="border-b border-slate-100 pb-3.5">
                      <h2 className="text-base font-bold text-slate-900">{formTemplate.heading}</h2>
                      <p className="text-xs text-slate-500 mt-0.5">{formTemplate.subheading}</p>
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

                    {/* Resume Upload Dropzone + Basic Resume Parser Auto-Fill */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <label className="block text-[11px] font-semibold text-slate-700">
                          Resume / CV File *
                        </label>
                        {isParsingCv ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>Reading resume details...</span>
                          </span>
                        ) : cvAutoFilled ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Fields auto-filled from resume</span>
                          </span>
                        ) : isCvInvalid ? (
                          <span className="text-[11px] font-semibold text-rose-600">Required</span>
                        ) : null}
                      </div>
                      {cvFile ? (
                        <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200 text-xs">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                              <FileText className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-900 truncate">{cvFile.name}</div>
                              <div className="text-[11px] text-slate-500">
                                {(cvFile.size / 1024).toFixed(0)} KB &bull;{' '}
                                {isParsingCv ? 'Extracting contact details...' : 'Ready to submit'}
                              </div>
                            </div>
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
                            className="p-1.5 text-slate-500 hover:text-rose-600 rounded-lg hover:bg-white transition-colors cursor-pointer"
                            aria-label="Remove resume file"
                          >
                            <X className="w-4 h-4" />
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
                          className={`border-2 border-dashed rounded-xl p-5 text-center transition-colors cursor-pointer space-y-1.5 ${isCvInvalid
                            ? 'border-rose-500 bg-rose-50/30 ring-1 ring-rose-500/20'
                            : 'border-slate-300 hover:border-brand-500 bg-slate-50/70 hover:bg-white'
                            }`}
                        >
                          <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 text-brand-600 flex items-center justify-center mx-auto">
                            <CloudUpload className="w-4 h-4" />
                          </div>
                          <div className="text-xs font-semibold text-slate-800">
                            Drop your resume here, or <span className="text-brand-600">browse file</span>
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Accepted formats: PDF, DOCX, DOC, TXT, or RTF (max 15 MB)
                          </div>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept={ALLOWED_CV_ACCEPT}
                            onChange={(e) => handleCvPick(e.target.files?.[0])}
                            className="hidden"
                          />
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-[11px] font-semibold text-slate-700">
                            Full Name *
                          </label>
                          {isFullNameInvalid && <span className="text-[11px] font-semibold text-rose-600">Required</span>}
                        </div>
                        <input
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="e.g. Jordan Patel"
                          className={`w-full px-3 py-2 rounded-lg border focus:bg-white focus:outline-none ${isFullNameInvalid ? INVALID_FIELD_CLASSES : 'border-slate-200 bg-slate-50/50 focus:border-brand-500'
                            }`}
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-[11px] font-semibold text-slate-700">
                            Email Address *
                          </label>
                          {isEmailInvalid && <span className="text-[11px] font-semibold text-rose-600">Required</span>}
                        </div>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="candidate@email.com"
                          className={`w-full px-3 py-2 rounded-lg border focus:bg-white focus:outline-none ${isEmailInvalid ? INVALID_FIELD_CLASSES : 'border-slate-200 bg-slate-50/50 focus:border-brand-500'
                            }`}
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-[11px] font-semibold text-slate-700">
                            Phone Number *
                          </label>
                          {isPhoneInvalid && <span className="text-[11px] font-semibold text-rose-600">Required</span>}
                        </div>
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+1 (555) 234-5678"
                          className={`w-full px-3 py-2 rounded-lg border focus:bg-white focus:outline-none ${isPhoneInvalid ? INVALID_FIELD_CLASSES : 'border-slate-200 bg-slate-50/50 focus:border-brand-500'
                            }`}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Work Authorization *
                        </label>
                        <CustomSelect
                          value={workAuth}
                          onChange={setWorkAuth}
                          ariaLabel="Work Authorization"
                          size="sm"
                          options={WORK_AUTH_OPTIONS}
                        />
                      </div>
                      {formTemplate.includeCurrentTitle && (
                        <div
                          className={getFieldWidthColSpanClass(
                            resolveFormFieldWidth(formTemplate, 'currentTitle', 'half')
                          )}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-[11px] font-semibold text-slate-700">
                              Current Title / Role {formTemplate.requireCurrentTitle ? '*' : ''}
                            </label>
                            {isCurrentTitleInvalid && (
                              <span className="text-[11px] font-semibold text-rose-600">Required</span>
                            )}
                          </div>
                          <input
                            type="text"
                            value={currentTitle}
                            onChange={(e) => setCurrentTitle(e.target.value)}
                            placeholder="e.g. Senior Cloud Engineer"
                            className={`w-full px-3 py-2 rounded-lg border focus:bg-white focus:outline-none ${isCurrentTitleInvalid
                              ? INVALID_FIELD_CLASSES
                              : 'border-slate-200 bg-slate-50/50 focus:border-brand-500'
                              }`}
                          />
                        </div>
                      )}

                      {formTemplate.includeExpectedRate && (
                        <div
                          className={getFieldWidthColSpanClass(
                            resolveFormFieldWidth(formTemplate, 'expectedRate', 'half')
                          )}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-[11px] font-semibold text-slate-700">
                              Expected Hourly Rate{' '}
                              {formTemplate.requireExpectedRate ? '*' : '(Optional)'}
                            </label>
                            {isExpectedRateInvalid && (
                              <span className="text-[11px] font-semibold text-rose-600">Required</span>
                            )}
                          </div>
                          <input
                            type="text"
                            value={submittedRate}
                            onChange={(e) => setSubmittedRate(e.target.value)}
                            placeholder="e.g. $90/hr (W2) or $105/hr (C2C)"
                            className={`w-full px-3 py-2 rounded-lg border focus:bg-white focus:outline-none ${isExpectedRateInvalid
                              ? INVALID_FIELD_CLASSES
                              : 'border-slate-200 bg-slate-50/50 focus:border-brand-500'
                              }`}
                          />
                        </div>
                      )}

                      {formTemplate.includeNoticePeriod && (
                        <div
                          className={getFieldWidthColSpanClass(
                            resolveFormFieldWidth(formTemplate, 'noticePeriod', 'half')
                          )}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-[11px] font-semibold text-slate-700">
                              Availability / Notice Period{' '}
                              {formTemplate.requireNoticePeriod ? '*' : '(Optional)'}
                            </label>
                            {isNoticePeriodInvalid && (
                              <span className="text-[11px] font-semibold text-rose-600">Required</span>
                            )}
                          </div>
                          <input
                            type="text"
                            value={noticePeriod}
                            onChange={(e) => setNoticePeriod(e.target.value)}
                            placeholder="e.g. Immediate or 2 Weeks Notice"
                            className={`w-full px-3 py-2 rounded-lg border focus:bg-white focus:outline-none ${isNoticePeriodInvalid
                              ? INVALID_FIELD_CLASSES
                              : 'border-slate-200 bg-slate-50/50 focus:border-brand-500'
                              }`}
                          />
                        </div>
                      )}

                      {formTemplate.includeLinkedinUrl && (
                        <div
                          className={getFieldWidthColSpanClass(
                            resolveFormFieldWidth(formTemplate, 'linkedinUrl', 'half')
                          )}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-[11px] font-semibold text-slate-700">
                              LinkedIn Profile URL{' '}
                              {formTemplate.requireLinkedinUrl ? '*' : '(Optional)'}
                            </label>
                            {isLinkedinUrlInvalid && (
                              <span className="text-[11px] font-semibold text-rose-600">Required</span>
                            )}
                          </div>
                          <input
                            type="url"
                            value={linkedinUrl}
                            onChange={(e) => setLinkedinUrl(e.target.value)}
                            placeholder="https://linkedin.com/in/username"
                            className={`w-full px-3 py-2 rounded-lg border focus:bg-white focus:outline-none ${isLinkedinUrlInvalid
                              ? INVALID_FIELD_CLASSES
                              : 'border-slate-200 bg-slate-50/50 focus:border-brand-500'
                              }`}
                          />
                        </div>
                      )}

                      {formTemplate.includeVendorName && (
                        <div
                          className={getFieldWidthColSpanClass(
                            resolveFormFieldWidth(formTemplate, 'vendorName', 'full')
                          )}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-[11px] font-semibold text-slate-700">
                              Partner / Vendor Agency Name{' '}
                              {formTemplate.requireVendorName ? '*' : '(Optional)'}
                            </label>
                            {isVendorNameInvalid && (
                              <span className="text-[11px] font-semibold text-rose-600">Required</span>
                            )}
                          </div>
                          <input
                            type="text"
                            value={submittedVendorName}
                            onChange={(e) => setSubmittedVendorName(e.target.value)}
                            placeholder="e.g. Direct Candidate or Partner Staffing Firm"
                            className={`w-full px-3 py-2 rounded-lg border focus:bg-white focus:outline-none ${isVendorNameInvalid
                              ? INVALID_FIELD_CLASSES
                              : 'border-slate-200 bg-slate-50/50 focus:border-brand-500'
                              }`}
                          />
                        </div>
                      )}

                      {(formTemplate.customFields || []).map((cf) => {
                        const val = customFieldValues[cf.key] || '';
                        const isCfInvalid = validationAttempted && cf.required && !val.trim();
                        return (
                          <div key={cf.key} className={getFieldWidthColSpanClass(cf.width || 'half')}>
                            <div className="flex items-center justify-between mb-1">
                              <label className="block text-[11px] font-semibold text-slate-700">
                                {cf.name} {cf.required ? '*' : ''}
                              </label>
                              {isCfInvalid && (
                                <span className="text-[11px] font-semibold text-rose-600">Required</span>
                              )}
                            </div>
                            {cf.type === 'DROPDOWN' && cf.options.length > 0 ? (
                              <CustomSelect
                                value={val}
                                onChange={(nextVal) =>
                                  setCustomFieldValues((prev) => ({ ...prev, [cf.key]: nextVal }))
                                }
                                ariaLabel={cf.name}
                                placeholder={`Select ${cf.name.toLowerCase()}...`}
                                size="sm"
                                options={cf.options}
                              />
                            ) : cf.type === 'BOOLEAN' ? (
                              <CustomSelect
                                value={val}
                                onChange={(nextVal) =>
                                  setCustomFieldValues((prev) => ({ ...prev, [cf.key]: nextVal }))
                                }
                                ariaLabel={cf.name}
                                placeholder="Select Yes or No..."
                                size="sm"
                                options={['Yes', 'No']}
                              />
                            ) : (
                              <input
                                type={cf.type === 'NUMBER' ? 'number' : cf.type === 'DATE' ? 'date' : 'text'}
                                value={val}
                                onChange={(e) =>
                                  setCustomFieldValues((prev) => ({ ...prev, [cf.key]: e.target.value }))
                                }
                                placeholder={`Enter ${cf.name.toLowerCase()}...`}
                                className={`w-full px-3 py-2 rounded-lg border focus:bg-white focus:outline-none ${isCfInvalid
                                  ? INVALID_FIELD_CLASSES
                                  : 'border-slate-200 bg-slate-50/50 focus:border-brand-500'
                                  }`}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {formError && (
                      <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span>{formError}</span>
                      </div>
                    )}

                    <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100">
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Direct encrypted submission to {roleDetails.agencyName}</span>
                      </div>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
                      >
                        {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        <span>{isSubmitting ? 'Submitting Application...' : 'Submit Application'}</span>
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </main>
        </div>
        );
};
