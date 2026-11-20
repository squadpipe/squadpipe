import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, FileText, Trash2, Upload, UserCheck } from 'lucide-react';
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
import { SkillTagInput } from '../../components/shared/SkillTagInput';
import { DetailBreadcrumb } from '../../components/shared/DetailPageShell';
import { PageHeader } from '../../components/shared/PageHeader';
import { FormField } from '../../components/shared/FormField';
import { ActionButton } from '../../components/shared/ActionButton';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { UnsavedChangesModal, useFormShortcuts } from '../../hooks/useFormShortcuts';

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

interface ConsultantCreatePageProps {
  mode?: 'create' | 'edit';
  initialCandidate?: Candidate | null;
  users?: User[];
  vendors?: Vendor[];
  rateMasked?: boolean;
  backLabel?: string;
  onBack: () => void;
  onSave?: (candidate: Candidate, cvFile?: File | null) => Promise<Candidate | void> | void;
  onSaveEdit?: (candidate: Candidate, cvFile?: File | null) => Promise<void> | void;
  onOpenResumeParser?: () => void;
  showToast: (title: string, message: string, icon?: string) => void;
}

/**
 * Dedicated full-page workflow for registering (/consultants/new) and editing
 * (/consultants/:id/edit) consultant profiles with CV upload, skills, and custom fields.
 */
export const ConsultantCreatePage: React.FC<ConsultantCreatePageProps> = ({
  mode = 'create',
  initialCandidate = null,
  users = [],
  vendors = [],
  rateMasked = false,
  backLabel = 'Back to Consultants',
  onBack,
  onSave,
  onSaveEdit,
  onOpenResumeParser,
  showToast,
}) => {
  const isEdit = mode === 'edit';
  const { symbol: currencySymbol } = useCurrency();
  const taxonomies = useMasterTaxonomies(true);

  const buildInitialForm = () => {
    if (isEdit && initialCandidate) {
      return {
        fullName: initialCandidate.fullName || '',
        currentTitle: initialCandidate.currentTitle || '',
        workAuth: initialCandidate.workAuth || 'US Citizen',
        hourlyRate: initialCandidate.hourlyRate || '',
        email: initialCandidate.email || '',
        phone: initialCandidate.phone || '',
        relocation: initialCandidate.relocation || 'Yes',
        education: initialCandidate.education || '',
        skillset: initialCandidate.skillset || '',
        recruiter: initialCandidate.assignedRecruiter || '',
        pipelineStage: initialCandidate.pipelineStage || 'Available / Bench',
        vendorId: initialCandidate.vendorId || '',
      };
    }

    return {
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
    };
  };

  const [form, setForm] = useState(buildInitialForm);
  const [customValues, setCustomValues] = useState<Record<string, string>>(
    () => (isEdit && initialCandidate?.customFields ? { ...initialCandidate.customFields } : {})
  );
  const [selectedCvFile, setSelectedCvFile] = useState<File | null>(null);
  const [initialSnapshot, setInitialSnapshot] = useState(() =>
    JSON.stringify({
      form: buildInitialForm(),
      customValues: isEdit && initialCandidate?.customFields ? initialCandidate.customFields : {},
    })
  );
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isEdit && initialCandidate) {
      const nextForm = buildInitialForm();
      const nextCustom = initialCandidate.customFields
        ? { ...initialCandidate.customFields }
        : {};
      setForm(nextForm);
      setCustomValues(nextCustom);
      setSelectedCvFile(null);
      setInitialSnapshot(JSON.stringify({ form: nextForm, customValues: nextCustom }));
      setValidationAttempted(false);
    }
  }, [isEdit, initialCandidate?.id]);

  const isDirty = useMemo(
    () =>
      Boolean(selectedCvFile) || JSON.stringify({ form, customValues }) !== initialSnapshot,
    [form, customValues, selectedCvFile, initialSnapshot]
  );

  const isFullNameInvalid = validationAttempted && !form.fullName.trim();
  const isTitleInvalid = isEdit && validationAttempted && !form.currentTitle.trim();
  const isEmailInvalid = validationAttempted && !form.email.trim();

  const workAuthOptions = Array.from(
    new Set([
      ...(taxonomies.workAuth || ['US Citizen', 'Green Card', 'H-1B', 'TN Visa', 'OPT']),
      ...(form.workAuth ? [form.workAuth] : []),
    ])
  ).filter(Boolean);

  const educationOptions = Array.from(
    new Set([
      ...(taxonomies.education || []),
      ...(form.education ? [form.education] : []),
    ])
  ).filter(Boolean);

  const stageOptions = Array.from(
    new Set([...PIPELINE_STAGE_OPTIONS, ...(form.pipelineStage ? [form.pipelineStage] : [])])
  ).filter(Boolean);

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
      ...(isEdit ? [{ label: 'Current Job Title', valid: Boolean(form.currentTitle.trim()) }] : []),
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

    setIsSaving(true);
    try {
      if (isEdit && initialCandidate) {
        const updatedCandidate: Candidate = {
          ...initialCandidate,
          fullName: form.fullName.trim(),
          currentTitle: form.currentTitle.trim(),
          workAuth: form.workAuth,
          hourlyRate: rateMasked ? initialCandidate.hourlyRate : form.hourlyRate.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          relocation: form.relocation,
          education: form.education.trim(),
          skillset: form.skillset.trim(),
          assignedRecruiter: form.recruiter,
          pipelineStage: form.pipelineStage,
          vendorId: selectedVendor?.id || '',
          vendorName: selectedVendor?.name || '',
          resumeName: selectedCvFile?.name || initialCandidate.resumeName,
          resumeFormat: selectedCvFile
            ? selectedCvFile.name.toLowerCase().endsWith('.docx')
              ? 'DOCX'
              : 'PDF'
            : initialCandidate.resumeFormat,
          customFields: customValues,
        };
        if (onSaveEdit) {
          await onSaveEdit(updatedCandidate, selectedCvFile);
        } else if (onSave) {
          await onSave(updatedCandidate, selectedCvFile);
        }
        return;
      }

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

      if (onSave) {
        await onSave(newCandidate, selectedCvFile);
      }
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

  if (isEdit && !initialCandidate) {
    return (
      <section className="max-w-3xl mx-auto py-16 text-center space-y-4">
        <div className="bg-white rounded-xl border border-slate-200 p-8 card-shadow space-y-3">
          <h2 className="text-base font-bold text-slate-900">Consultant Not Found</h2>
          <p className="text-xs text-slate-500">
            This consultant profile may have been deleted or could not be loaded.
          </p>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{backLabel}</span>
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-6 animate-fade-in">
      <DetailBreadcrumb
        backLabel={backLabel}
        onBack={() => guardNavigation(onBack)}
        title={isEdit ? initialCandidate?.fullName || 'Edit Profile' : 'Add New Consultant'}
        codePill={isEdit ? 'Edit Profile' : 'New Profile'}
        rightSlot={
          !isEdit && onOpenResumeParser ? (
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
        title={
          isEdit
            ? `Edit Profile · ${initialCandidate?.fullName || 'Consultant'}`
            : 'Add Consultant'
        }
        subtitle={
          isEdit
            ? 'Update contact details, work authorization, target rate, technical skills, and resume file.'
            : 'Add contact details, work authorization, target rate, technical skills, and resume file.'
        }
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
              {isEdit ? 'Save Changes' : 'Save Consultant'}
            </ActionButton>
          </>
        }
      />

      <form
        noValidate
        onSubmit={handleSubmit}
        className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
      >
        <div className="lg:col-span-8 space-y-6 text-xs">
          {/* Card 1: Identity & Authorization */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 card-shadow space-y-4">
            <div className="pb-3 border-b border-slate-100">
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

              <FormField
                label="Current Job Title"
                required={isEdit}
                error={isTitleInvalid ? 'Required' : undefined}
              >
                <input
                  value={form.currentTitle}
                  onChange={(e) => setForm({ ...form, currentTitle: e.target.value })}
                  placeholder="e.g. Lead Java Cloud Architect"
                  className={`w-full px-3 py-2 border rounded-lg text-xs font-medium focus:outline-none ${
                    isTitleInvalid
                      ? INVALID_FIELD_CLASSES
                      : 'border-slate-200 bg-white focus:border-brand-600'
                  }`}
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
                  options={workAuthOptions}
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
                    ...educationOptions.map((edu) => ({ value: edu, label: edu })),
                  ]}
                />
              </FormField>
            </div>
          </div>

          {/* Card 2: Rates, Skills & Desk Ownership */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 card-shadow space-y-4">
            <div className="pb-3 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-900">Skills, rates &amp; ownership</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Technical competencies, expected compensation, and C2C vendor affiliation.
              </p>
            </div>

            <FormField
              label="Primary Technical Skills"
              hint="Press Enter or comma to add skills cleanly as tags."
            >
              <SkillTagInput
                value={form.skillset}
                onChange={(nextCsv) => setForm({ ...form, skillset: nextCsv })}
              />
            </FormField>

            <div
              className={`grid grid-cols-1 sm:grid-cols-2 ${
                !(isEdit && rateMasked) ? 'lg:grid-cols-4' : 'lg:grid-cols-3'
              } gap-4`}
            >
              {!(isEdit && rateMasked) && (
                <FormField label="Target Hourly Pay Rate">
                  <input
                    value={form.hourlyRate}
                    onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })}
                    placeholder={`e.g. ${currencySymbol}95/hr`}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs focus:border-brand-600 focus:outline-none"
                  />
                </FormField>
              )}

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

              <FormField label={isEdit ? 'Pipeline Stage' : 'Initial Status'}>
                <CustomSelect
                  value={form.pipelineStage}
                  onChange={(val) => setForm({ ...form, pipelineStage: val })}
                  ariaLabel="Pipeline Stage"
                  size="sm"
                  options={stageOptions}
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
        <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-4 text-xs">
          <div className="bg-white rounded-xl border border-slate-200 p-6 card-shadow space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 font-semibold text-slate-900 text-sm">
                <UserCheck className="w-4 h-4 text-brand-600" />
                <span>Original resume &amp; status</span>
              </div>
              <StatusBadge stage={form.pipelineStage} size="xs" />
            </div>

            <div className="space-y-2.5">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files?.[0];
                  if (!file) return;
                  const validationError = validateCvFileSelection(file);
                  if (validationError) {
                    showToast('Invalid CV File', validationError, 'warning');
                    return;
                  }
                  setSelectedCvFile(file);
                }}
                className="p-3.5 rounded-lg border border-dashed border-slate-300 bg-slate-50/70 space-y-2.5"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                  <span className="text-[12px] text-slate-700 truncate font-medium">
                    {selectedCvFile
                      ? `${selectedCvFile.name} (${(selectedCvFile.size / 1024).toFixed(1)} KB)`
                      : isEdit && initialCandidate?.resumeFileUrl
                        ? initialCandidate.resumeName || 'Stored Original CV'
                        : 'PDF, DOC, DOCX, TXT, or RTF'}
                  </span>
                </div>
                {isEdit && initialCandidate?.resumeFileUrl && !selectedCvFile && (
                  <p className="text-[11px] text-slate-500">
                    Upload a new file below to replace the stored original CV.
                  </p>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-[11px] font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors">
                    <Upload className="w-3.5 h-3.5 text-brand-600" />
                    <span>
                      {selectedCvFile
                        ? 'Replace File'
                        : isEdit && initialCandidate?.resumeFileUrl
                          ? 'Replace Stored CV'
                          : 'Attach CV'}
                    </span>
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
