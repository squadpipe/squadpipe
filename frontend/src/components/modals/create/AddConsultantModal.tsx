import React, { useState, useEffect } from 'react';
import { FileText, Loader2, Plus, Trash2, Upload, UserPlus, X } from 'lucide-react';
import { Candidate, User, Vendor } from '../../../types';
import { DynamicCustomFieldsSection, useMasterTaxonomies } from '../../shared/DynamicCustomFieldsSection';
import { CustomSelect } from '../../shared/CustomSelect';
import { useCurrency } from '../../../utils/currency';
import { ALLOWED_CV_ACCEPT, validateCvFileSelection } from '../../../utils/cvFiles';
import { AnimatedModal } from '../../shared/MotionPrimitives';
import {
  formatMissingFieldsMessage,
  getMissingFieldLabels,
  INVALID_FIELD_CLASSES,
} from '../../../utils/formValidation';

interface AddConsultantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (candidate: Candidate, cvFile?: File | null) => Promise<void> | void;
  users?: User[];
  vendors?: Vendor[];
  showToast: (title: string, message: string, icon?: string) => void;
}

export const AddConsultantModal: React.FC<AddConsultantModalProps> = ({
  isOpen,
  onClose,
  onSave,
  users = [],
  vendors = [],
  showToast,
}) => {
  const { symbol: currencySymbol } = useCurrency();
  const taxonomies = useMasterTaxonomies(isOpen);
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [selectedCvFile, setSelectedCvFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const getInitialForm = () => ({
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
  const [form, setForm] = useState(getInitialForm);

  useEffect(() => {
    if (isOpen) {
      setForm(getInitialForm());
      setCustomValues({});
      setSelectedCvFile(null);
      setIsSaving(false);
      setValidationAttempted(false);
    }
  }, [isOpen]);

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

  const isFullNameInvalid = validationAttempted && !form.fullName.trim();
  const isEmailInvalid = validationAttempted && !form.email.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

    const cvName = selectedCvFile?.name || `${form.fullName.trim().replace(/\s+/g, '_')}_Resume.pdf`;
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
      setForm(getInitialForm());
      setCustomValues({});
      setSelectedCvFile(null);
      showToast(
        'Consultant Added',
        selectedCvFile
          ? `${newCandidate.fullName} and original CV saved to talent roster!`
          : `${newCandidate.fullName} registered to talent roster!`,
        'success'
      );
      onClose();
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

  return (
    <AnimatedModal
      isOpen={isOpen}
      onBackdropClick={onClose}
      zIndexClass="z-50"
      backdropClassName="bg-slate-900/60 backdrop-blur-[2px] flex items-center justify-center p-4 select-none"
      panelClassName="bg-white rounded-xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
      ariaLabel="Add New Consultant Profile"
    >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-[#141615] text-white">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white flex-shrink-0">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">
                Add New Consultant Profile
              </h2>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Register candidate details, work authorization, hourly rates, and technical skillsets.
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="text-slate-400 hover:text-white w-7 h-7 rounded flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body Form */}
        <form noValidate onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 overflow-y-auto space-y-4 text-xs flex-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-slate-700">Full Name *</label>
                  {isFullNameInvalid && <span className="text-[11px] font-semibold text-rose-600">Required</span>}
                </div>
                <input
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  placeholder="e.g. Tarun Sengupta"
                  className={`w-full px-3 py-1.5 border rounded-lg text-xs font-medium focus:outline-none ${
                    isFullNameInvalid ? INVALID_FIELD_CLASSES : 'border-slate-200 bg-white focus:border-brand-600'
                  }`}
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Current Job Title *</label>
                <input
                  value={form.currentTitle}
                  onChange={(e) => setForm({ ...form, currentTitle: e.target.value })}
                  placeholder="e.g. Lead Java Cloud Architect"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs font-medium focus:border-brand-600 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Work Authorization *</label>
                <CustomSelect
                  value={form.workAuth}
                  onChange={(val) => setForm({ ...form, workAuth: val })}
                  ariaLabel="Work Authorization"
                  size="sm"
                  options={taxonomies.workAuth}
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Target Hourly Pay Rate</label>
                <input
                  value={form.hourlyRate}
                  onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })}
                  placeholder={`e.g. ${currencySymbol}95/hr (W2) or ${currencySymbol}110/hr (C2C)`}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs focus:border-brand-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-slate-700">Email Address *</label>
                  {isEmailInvalid && <span className="text-[11px] font-semibold text-rose-600">Required</span>}
                </div>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="e.g. tarun.dev@gmail.com"
                  className={`w-full px-3 py-1.5 border rounded-lg text-xs font-medium focus:outline-none ${
                    isEmailInvalid ? INVALID_FIELD_CLASSES : 'border-slate-200 bg-white focus:border-brand-600'
                  }`}
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="e.g. +1 (512) 555-0199"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs focus:border-brand-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Relocation Preference</label>
                <CustomSelect
                  value={form.relocation}
                  onChange={(val) => setForm({ ...form, relocation: val })}
                  ariaLabel="Relocation Preference"
                  size="sm"
                  options={[
                    { value: 'Yes', label: 'Yes (Open Anywhere in US)' },
                    { value: 'No', label: 'No (Local Only)' },
                  ]}
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Highest Education Degree</label>
                <CustomSelect
                  value={form.education}
                  onChange={(val) => setForm({ ...form, education: val })}
                  ariaLabel="Highest Education Degree"
                  size="sm"
                  placeholder="Select degree..."
                  options={[{ value: '', label: 'Select degree...' }, ...taxonomies.education.map((edu) => ({ value: edu, label: edu }))]}
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Primary Technical Skills * (Comma-separated)
              </label>
              <input
                value={form.skillset}
                onChange={(e) => setForm({ ...form, skillset: e.target.value })}
                placeholder="e.g. Java 17, Spring Boot, Apache Kafka, AWS, Microservices"
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs text-[11px] focus:border-brand-600 focus:outline-none"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Assigned Desk Recruiter</label>
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
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Initial Pipeline Status</label>
                <CustomSelect
                  value={form.pipelineStage}
                  onChange={(val) => setForm({ ...form, pipelineStage: val })}
                  ariaLabel="Initial Pipeline Status"
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
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Partner Vendor <span className="text-slate-400 font-normal">(If C2C)</span>
                </label>
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
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Original CV / Resume File <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg border border-dashed border-slate-300 bg-slate-50/70">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-4 h-4 text-slate-500 flex-shrink-0" />
                  <span className="text-[11px] text-slate-700 truncate font-medium">
                    {selectedCvFile
                      ? `${selectedCvFile.name} (${(selectedCvFile.size / 1024).toFixed(1)} KB)`
                      : 'Attach PDF, DOC, DOCX, TXT, or RTF (auto-saved with profile)'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {selectedCvFile && (
                    <button
                      type="button"
                      onClick={() => setSelectedCvFile(null)}
                      className="px-2 py-1 rounded border border-slate-200 bg-white text-rose-600 hover:bg-rose-50 text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Remove</span>
                    </button>
                  )}
                  <label className="px-2.5 py-1 rounded bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors">
                    <Upload className="w-3 h-3 text-brand-600" />
                    <span>{selectedCvFile ? 'Change File' : 'Upload CV'}</span>
                    <input
                      type="file"
                      accept={ALLOWED_CV_ACCEPT}
                      onChange={handleCvFileChange}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>

            <DynamicCustomFieldsSection
              entity="consultant"
              values={customValues}
              onChange={setCustomValues}
              isOpen={isOpen}
            />
          </div>

          {/* Modal Footer */}
          <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-white text-xs font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 active:bg-brand-800 disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {isSaving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" strokeWidth={1.75} />
              )}
              <span>{isSaving ? 'Saving...' : 'Save & Add Consultant to Roster'}</span>
            </button>
          </div>
        </form>
    </AnimatedModal>
  );
};

