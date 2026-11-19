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
import { ALLOWED_CV_ACCEPT, validateCvFileSelection } from '../../utils/cvFiles';
import { formatMissingFieldsMessage, getMissingFieldLabels } from '../../utils/formValidation';

interface PublicRequirementDetails {
  agencyName: string;
  code: string;
  opportunityTitle: string;
  location: string;
  workModel: 'Remote' | 'Hybrid' | 'Onsite';
  skillsRequired: string;
  openPositions: number;
  publicDescription?: string | null;
}

interface PublicApplicationConfirmation {
  agencyName: string;
  submissionId: string;
  candidateName: string;
  requirementCode: string;
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
  const [honeypotWebsite, setHoneypotWebsite] = useState('');
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<PublicApplicationConfirmation | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleCvPick = (file: File | undefined | null) => {
    if (!file) return;
    const validationErr = validateCvFileSelection(file);
    if (validationErr) {
      setFormError(validationErr);
      return;
    }
    setFormError('');
    setCvFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const missingFields = getMissingFieldLabels([
      { label: 'Full Name', valid: Boolean(fullName.trim()) },
      { label: 'Email', valid: Boolean(email.trim()) },
      { label: 'Phone', valid: Boolean(phone.trim()) },
      { label: 'Work Authorization', valid: Boolean(workAuth.trim()) },
    ]);
    if (missingFields.length > 0) {
      setFormError(formatMissingFieldsMessage(missingFields));
      return;
    }
    if (!cvFile) {
      setFormError('Please attach a resume (.pdf, .doc, .docx, .txt, or .rtf) before submitting.');
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
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm px-8 py-10 text-center space-y-3 max-w-md w-full">
          <Loader2 className="w-7 h-7 text-brand-600 animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-800">Loading position details...</p>
        </div>
      </div>
    );
  }

  if (unavailableMessage || !roleDetails) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm px-8 py-10 text-center space-y-4 max-w-md w-full">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
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
        <div className="bg-white border border-slate-200 rounded-2xl shadow-md p-8 max-w-lg w-full text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto">
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
              </span>{' '}
              ({confirmation.requirementCode}). Our recruiting team will review your profile and follow up shortly.
            </p>
          </div>
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 text-left text-xs space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-400">Reference</span>
              <span className="font-semibold text-slate-800">{confirmation.requirementCode}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-400">Role</span>
              <span className="font-semibold text-slate-800">{confirmation.opportunityTitle}</span>
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

  const skillList = roleDetails.skillsRequired
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Dark Mineral Carbon Header */}
      <header className="bg-[#141615] text-white border-b border-white/10">
        <div className="max-w-4xl mx-auto px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center text-white flex-shrink-0">
              <Briefcase className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-white truncate">{roleDetails.agencyName}</div>
              <div className="text-[11px] text-slate-400">Candidate &amp; Partner CV Intake</div>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-md bg-white/10 border border-white/10 text-[11px] font-semibold text-slate-200 whitespace-nowrap">
            {roleDetails.code}
          </span>
        </div>
      </header>

      <main className="max-w-4xl w-full mx-auto px-5 py-8 flex-1 space-y-6">
        {/* Role Brief Card */}
        <section className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200">
                {roleDetails.workModel}
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>{roleDetails.location}</span>
              </span>
              <span className="text-slate-300">&bull;</span>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600">
                <UsersRound className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  {roleDetails.openPositions}{' '}
                  {roleDetails.openPositions === 1 ? 'opening' : 'openings'}
                </span>
              </span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              {roleDetails.opportunityTitle}
            </h1>
          </div>

          {roleDetails.publicDescription && (
            <div className="text-xs text-slate-600 leading-relaxed whitespace-pre-line bg-slate-50 border border-slate-200/70 rounded-xl p-4">
              {roleDetails.publicDescription}
            </div>
          )}

          {skillList.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Key Required Skills
              </div>
              <div className="flex flex-wrap gap-1.5">
                {skillList.map((skill, idx) => (
                  <span
                    key={idx}
                    className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Application Submission Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-5"
        >
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900">Submit Candidate Profile &amp; Resume</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Candidates applying directly or partner agencies submitting consultants can attach a resume below.
            </p>
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

          {/* Resume Upload Dropzone */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold text-slate-700">
              Resume / CV File *
            </label>
            {cvFile ? (
              <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200 text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 truncate">{cvFile.name}</div>
                    <div className="text-[10.5px] text-slate-500">
                      {(cvFile.size / 1024).toFixed(0)} KB &bull; Ready to submit
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCvFile(null);
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
                className="border-2 border-dashed border-slate-300 hover:border-brand-500 rounded-xl p-6 text-center bg-slate-50/70 hover:bg-white transition-colors cursor-pointer space-y-2"
              >
                <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-brand-600 flex items-center justify-center mx-auto shadow-2xs">
                  <CloudUpload className="w-5 h-5" />
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
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Jordan Patel"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Email Address *
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="candidate@email.com"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Phone Number *
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 234-5678"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-brand-500 focus:outline-none"
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
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Current Title / Role
              </label>
              <input
                type="text"
                value={currentTitle}
                onChange={(e) => setCurrentTitle(e.target.value)}
                placeholder="e.g. Senior Cloud Engineer"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Expected Hourly Rate (Optional)
              </label>
              <input
                type="text"
                value={submittedRate}
                onChange={(e) => setSubmittedRate(e.target.value)}
                placeholder="e.g. $90/hr (W2) or $105/hr (C2C)"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-brand-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="text-xs">
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Partner / Vendor Agency Name (Optional)
            </label>
            <input
              type="text"
              value={submittedVendorName}
              onChange={(e) => setSubmittedVendorName(e.target.value)}
              placeholder="Leave blank if applying directly as a candidate"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-brand-500 focus:outline-none"
            />
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
              className="px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-xs font-semibold shadow-xs inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{isSubmitting ? 'Submitting Application...' : 'Submit Application'}</span>
            </button>
          </div>
        </form>
      </main>
    </div>
  );
};
