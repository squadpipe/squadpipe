import React, { useMemo, useState } from 'react';
import { FileText, Trash2, Upload, UserCheck } from 'lucide-react';
import { Candidate, User, Vendor } from '../../types';
import { useCurrency } from '../../utils/currency';
import { ALLOWED_CV_ACCEPT, validateCvFileSelection } from '../../utils/cvFiles';
import {
  formatMissingFieldsMessage,
  getMissingFieldLabels,
  INVALID_FIELD_CLASSES,
} from '../../utils/formValidation';
import {
  DynamicCustomFieldsSection,
  useMasterTaxonomies,
} from '../../components/shared/DynamicCustomFieldsSection';
import { CustomSelect } from '../../components/shared/CustomSelect';
import { DetailBreadcrumb } from '../../components/shared/DetailPageShell';
import { PageHeader } from '../../components/shared/PageHeader';
import { FormField } from '../../components/shared/FormField';
import { ActionButton } from '../../components/shared/ActionButton';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { UnsavedChangesModal, useFormShortcuts } from '../../hooks/useFormShortcuts';

interface ConsultantCreatePageProps {
  users?: User[];
  vendors?: Vendor[];
  backLabel?: string;
  onBack: () => void;
  onSave: (candidate: Candidate, cvFile?: File | null) => Promise<Candidate | void> | void;
  onOpenResumeParser?: () => void;
  showToast: (title: string, message: string, icon?: string) => void;
}

/**
 * Dedicated full-page workflow (/consultants/new) for adding a consultant profile
 * with original CV upload, work authorization, rates, and custom attributes.
 */
export const ConsultantCreatePage: React.FC<ConsultantCreatePageProps> = ({
  users = [],
  vendors = [],
  backLabel = 'Back to Consultants',
  onBack,
  onSave,
  onOpenResumeParser,
  showToast,
}) => {
  const { symbol: currencySymbol } = useCurrency();
  const taxonomies = useMasterTaxonomies(true);

  const buildInitialForm = () => ({
    fullName: '',
    currentTitle: '',
    workAuth: 'US Citizen',
    hourlyRate: '',
    email: '',
    phone: '',
    relocation: 'Yes',
    education: '',
    skillset: '',
    recruiter: users[0]?.name || '',
    pipelineStage: 'Available / Bench',
    vendorId: '',
  });

  const [form, setForm] = useState(buildInitialForm);
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [selectedCvFile, setSelectedCvFile] = useState<File | null>(null);
  const [initialSnapshot] = useState(() =>
    JSON.stringify({ form: buildInitialForm(), customValues: {} })
  );
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const isDirty = useMemo(
    () =>
      Boolean(selectedCvFile) || JSON.stringify({ form, customValues }) !== initialSnapshot,
    [form, customValues, selectedCvFile, initialSnapshot]
  );

  const isFullNameInvalid = validationAttempted && !form.fullName.trim();
  const isEmailInvalid = validationAttempted && !form.email.trim();

  const handleCvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validationError = validateCvFileSelection(file);
    if (validationError) {
      showToast('Invalid CV File', validationError, 'warning');
      e.target.value = '';
      return;
    }
    setSelectedCvFile(file);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSaving) return;

    const missingFields = getMissingFieldLabels([
      { label: 'Full Name', valid: Boolean(form.fullName.trim()) },
      { label: 'Email Address', valid: Boolean(form.email.trim()) },
    ]);
    if (missingFields.length > 0) {
      setValidationAttempted(true);
      showToast('Validation Error', formatMissingFieldsMessage(missingFields), 'warning');
      return;
    }

    const selectedVendor = form.vendorId
      ? vendors.find((v) => v.id === form.vendorId)
      : undefined;
    const cvName =
      selectedCvFile?.name || `${form.fullName.trim().replace(/\s+/g, '_')}_Resume.pdf`;

    const newCandidate: Candidate = {
      id: 'cand_' + Date.now(),
      fullName: form.fullName.trim(),
      currentTitle: form.currentTitle.trim() || 'Software Engineer',
      workAuth: form.workAuth,
      hourlyRate: form.hourlyRate.trim() || `${currencySymbol}95/hr (W2)`,
      email: form.email.trim(),
      phone: form.phone.trim() || '+1 (555) 000-0000',
      relocation: form.relocation,
      education: form.education.trim() || "Master's Degree",
      skillset: form.skillset.trim(),
      assignedRecruiter: form.recruiter,
      pipelineStage: form.pipelineStage,
      vendorId: selectedVendor?.id || undefined,
      vendorName: selectedVendor?.name || undefined,
      resumeName: cvName,
      resumeFormat: cvName.toLowerCase().endsWith('.docx') ? 'DOCX' : 'PDF',
      customFields: customValues,
    };

    setIsSaving(true);
    try {
      await onSave(newCandidate, selectedCvFile);
      showToast(
        'Consultant Added',
        selectedCvFile
          ? `${newCandidate.fullName} and original CV saved to talent roster!`
          : `${newCandidate.fullName} registered to talent roster!`,
        'success'
      );
    } catch (err: any) {
      showToast(
        'Save Failed',
        err?.response?.data?.message || err?.message || 'Could not save consultant.',
        'error'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const { showLeaveModal, guardNavigation, confirmLeave, cancelLeave } = useFormShortcuts({
    isDirty,
    isSubmitting: isSaving,
    onSubmit: () => handleSubmit(),
  });

  return (
    <div className="max-w-7xl mx-auto space-y-5 animate-fade-in">
      <DetailBreadcrumb
        backLabel={backLabel}
        onBack={() => guardNavigation(onBack)}
        title="Add New Consultant"
        codePill="New Profile"
        rightSlot={
          onOpenResumeParser ? (
            <button
              type="button"
              onClick={() => guardNavigation(onOpenResumeParser)}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 hover:text-slate-900 px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-brand-600" />
              <span>Upload &amp; Auto-Parse Resume</span>
            </button>
          ) : undefined
        }
      />

      <PageHeader
        title="Register Consultant Profile"
        subtitle="Add candidate contact information, work authorization, rate expectations, technical skills, and original resume file."
        badges={
          <span className="hidden md:inline text-[11px] text-slate-400">
            Press ⌘S to save
          </span>
        }
        actions={
          <>
            <button
              type="button"
              disabled={isSaving}
              onClick={() => guardNavigation(onBack)}
              className="px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <ActionButton
              type="button"
              onClick={() => handleSubmit()}
              loading={isSaving}
              loadingText="Saving..."
              className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-semibold cursor-pointer"
            >
              Save Consultant
            </ActionButton>
          </>
        }
      />

      <form
        noValidate
        onSubmit={handleSubmit}
        className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start"
      >
        <div className="lg:col-span-8 space-y-5 text-xs">
          {/* Card 1: Identity & Authorization */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 card-shadow space-y-4">
            <div className="pb-2.5 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-900">Identity &amp; authorization</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Core contact details, job title, and visa/work eligibility.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                label="Full Name"
                required
                error={isFullNameInvalid ? 'Required' : undefined}
              >
                <input
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  placeholder="e.g. Tarun Sengupta"
                  className={`w-full px-3 py-2 border rounded-lg text-xs font-medium focus:outline-none ${
                    isFullNameInvalid
                      ? INVALID_FIELD_CLASSES
                      : 'border-slate-200 bg-white focus:border-brand-600'
                  }`}
                />
              </FormField>

              <FormField label="Current Job Title">
                <input
                  value={form.currentTitle}
                  onChange={(e) => setForm({ ...form, currentTitle: e.target.value })}
                  placeholder="e.g. Lead Java Cloud Architect"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs font-medium focus:border-brand-600 focus:outline-none"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                label="Email Address"
                required
                error={isEmailInvalid ? 'Required' : undefined}
              >
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="e.g. tarun.dev@gmail.com"
                  className={`w-full px-3 py-2 border rounded-lg text-xs font-medium focus:outline-none ${
                    isEmailInvalid
                      ? INVALID_FIELD_CLASSES
                      : 'border-slate-200 bg-white focus:border-brand-600'
                  }`}
                />
              </FormField>

              <FormField label="Phone Number">
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="e.g. +1 (512) 555-0199"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs focus:border-brand-600 focus:outline-none"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField label="Work Authorization" required>
                <CustomSelect
                  value={form.workAuth}
                  onChange={(val) => setForm({ ...form, workAuth: val })}
                  ariaLabel="Work Authorization"
                  size="sm"
                  options={taxonomies.workAuth}
                />
              </FormField>

              <FormField label="Relocation Preference">
                <CustomSelect
                  value={form.relocation}
                  onChange={(val) => setForm({ ...form, relocation: val })}
                  ariaLabel="Relocation Preference"
                  size="sm"
                  options={[
                    { value: 'Yes', label: 'Yes (Open Anywhere)' },
                    { value: 'No', label: 'No (Local Only)' },
                  ]}
                />
              </FormField>

              <FormField label="Highest Education">
                <CustomSelect
                  value={form.education}
                  onChange={(val) => setForm({ ...form, education: val })}
                  ariaLabel="Highest Education"
                  size="sm"
                  placeholder="Select degree..."
                  options={[
                    { value: '', label: 'Select degree...' },
                    ...taxonomies.education.map((edu) => ({ value: edu, label: edu })),
                  ]}
                />
              </FormField>
            </div>
          </div>

          {/* Card 2: Rates, Skills & Desk Ownership */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 card-shadow space-y-4">
            <div className="pb-2.5 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-900">Skills, rates &amp; ownership</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Technical competencies, expected compensation, and C2C vendor affiliation.
              </p>
            </div>

            <FormField label="Primary Technical Skills" hint="Comma-separated technologies and core frameworks.">
              <input
                value={form.skillset}
                onChange={(e) => setForm({ ...form, skillset: e.target.value })}
                placeholder="e.g. Java 17, Spring Boot, Apache Kafka, AWS, Microservices"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs focus:border-brand-600 focus:outline-none"
              />
            </FormField>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <FormField label="Target Hourly Pay Rate">
                <input
                  value={form.hourlyRate}
                  onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })}
                  placeholder={`e.g. ${currencySymbol}95/hr`}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs focus:border-brand-600 focus:outline-none"
                />
              </FormField>

              <FormField label="Assigned Recruiter">
                <CustomSelect
                  value={form.recruiter}
                  onChange={(val) => setForm({ ...form, recruiter: val })}
                  ariaLabel="Assigned Desk Recruiter"
                  size="sm"
                  options={[
                    { value: '', label: 'Recruitment Desk' },
                    ...users.map((u) => ({ value: u.name, label: u.name })),
                  ]}
                />
              </FormField>

              <FormField label="Initial Status">
                <CustomSelect
                  value={form.pipelineStage}
                  onChange={(val) => setForm({ ...form, pipelineStage: val })}
                  ariaLabel="Initial Status"
                  size="sm"
                  options={[
                    'Available / Bench',
                    'Submitted',
                    'Interview',
                    'Selected',
                    'Onboarding',
                    'Billable',
                    'Archived',
                  ]}
                />
              </FormField>

              <FormField label="Partner Vendor">
                <CustomSelect
                  value={form.vendorId}
                  onChange={(val) => setForm({ ...form, vendorId: val })}
                  ariaLabel="Partner Vendor"
                  size="sm"
                  options={[
                    { value: '', label: 'Direct / Own Bench' },
                    ...vendors.map((v) => ({ value: v.id, label: v.name })),
                  ]}
                />
              </FormField>
            </div>
          </div>
        </div>

        {/* Sticky Right Card: Resume File + Summary + Custom Attributes */}
        <div className="lg:col-span-4 space-y-5 lg:sticky lg:top-4 text-xs">
          <div className="bg-white rounded-xl border border-slate-200 p-5 card-shadow space-y-4">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <div className="flex items-center gap-2 font-semibold text-slate-900 text-sm">
                <UserCheck className="w-4 h-4 text-brand-600" />
                <span>Original resume &amp; status</span>
              </div>
              <StatusBadge stage={form.pipelineStage} size="xs" />
            </div>

            <div className="space-y-2.5">
              <div className="p-3 rounded-lg border border-dashed border-slate-300 bg-slate-50/70 space-y-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                  <span className="text-[11px] text-slate-700 truncate font-medium">
                    {selectedCvFile
                      ? `${selectedCvFile.name} (${(selectedCvFile.size / 1024).toFixed(1)} KB)`
                      : 'PDF, DOC, DOCX, TXT, or RTF'}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-[11px] font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors">
                    <Upload className="w-3.5 h-3.5 text-brand-600" />
                    <span>{selectedCvFile ? 'Replace File' : 'Attach CV'}</span>
                    <input
                      type="file"
                      accept={ALLOWED_CV_ACCEPT}
                      onChange={handleCvFileChange}
                      className="hidden"
                    />
                  </label>
                  {selectedCvFile && (
                    <button
                      type="button"
                      onClick={() => setSelectedCvFile(null)}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-rose-600 hover:bg-rose-50 text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Remove</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <DynamicCustomFieldsSection
                entity="consultant"
                values={customValues}
                onChange={setCustomValues}
                isOpen={true}
              />
            </div>
          </div>
        </div>
      </form>

      <UnsavedChangesModal
        isOpen={showLeaveModal}
        onConfirmLeave={confirmLeave}
        onCancelLeave={cancelLeave}
      />
    </div>
  );
};
