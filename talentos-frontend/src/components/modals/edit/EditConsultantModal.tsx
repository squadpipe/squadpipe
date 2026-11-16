import React, { useEffect, useState } from 'react';
import { FileText, Pencil, Upload, X } from 'lucide-react';
import { Candidate, Vendor } from '../../../types';
import { ALLOWED_CV_ACCEPT, validateCvFileSelection } from '../../../utils/cvFiles';
import { ActionButton } from '../../shared/ActionButton';
import { SkillTagInput } from '../../shared/SkillTagInput';
import { CustomSelect } from '../../shared/CustomSelect';
import {
  DynamicCustomFieldsSection,
  useMasterTaxonomies,
} from '../../shared/DynamicCustomFieldsSection';

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

interface EditConsultantModalProps {
  candidate: Candidate | null;
  isOpen: boolean;
  vendors?: Vendor[];
  rateMasked?: boolean;
  onClose: () => void;
  onUpdateCandidate: (candidate: Candidate, cvFile?: File | null) => Promise<void> | void;
}

export const EditConsultantModal: React.FC<EditConsultantModalProps> = ({
  candidate,
  isOpen,
  vendors = [],
  rateMasked = false,
  onClose,
  onUpdateCandidate,
}) => {
  const taxonomies = useMasterTaxonomies(isOpen);
  const [editForm, setEditForm] = useState<Candidate | null>(null);
  const [editCvFile, setEditCvFile] = useState<File | null>(null);
  const [editCvError, setEditCvError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (candidate && isOpen) {
      setEditForm({ ...candidate });
      setEditCvFile(null);
      setEditCvError('');
      setIsSaving(false);
    }
  }, [candidate, isOpen]);

  if (!isOpen || !candidate || !editForm) return null;

  const workAuthOptions = Array.from(
    new Set([
      ...(taxonomies.workAuth || ['US Citizen', 'Green Card', 'H-1B', 'TN Visa', 'OPT']),
      ...(editForm.workAuth ? [editForm.workAuth] : []),
    ])
  ).filter(Boolean);

  const handleClose = () => {
    if (isSaving) return;
    setEditCvFile(null);
    setEditCvError('');
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    setEditCvError('');
    try {
      await onUpdateCandidate(editForm, editCvFile);
      setEditCvFile(null);
      onClose();
    } catch (err: any) {
      setEditCvError(err?.response?.data?.message || err?.message || 'Failed to save changes.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      onClick={handleClose}
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden flex flex-col animate-fade-in max-h-[92vh]"
      >
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-[#141615] text-white shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white shrink-0">
              <Pencil className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-white truncate">
                Edit Consultant Profile &amp; CV
              </h2>
              <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                {candidate.fullName}
              </div>
            </div>
          </div>
          <button
            type="button"
            disabled={isSaving}
            onClick={handleClose}
            aria-label="Close modal"
            className="text-slate-400 hover:text-white w-7 h-7 rounded flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 overflow-y-auto space-y-4 text-xs flex-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={editForm.fullName}
                  onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Current Title *
                </label>
                <input
                  type="text"
                  required
                  value={editForm.currentTitle}
                  onChange={(e) => setEditForm({ ...editForm, currentTitle: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  required
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Phone
                </label>
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
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Work Auth
                </label>
                <CustomSelect
                  value={editForm.workAuth}
                  onChange={(val) => setEditForm({ ...editForm, workAuth: val })}
                  ariaLabel="Work Auth"
                  options={workAuthOptions}
                />
              </div>
              {!rateMasked && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Hourly Rate
                  </label>
                  <input
                    type="text"
                    value={editForm.hourlyRate}
                    onChange={(e) => setEditForm({ ...editForm, hourlyRate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                  />
                </div>
              )}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Relocation
                </label>
                <CustomSelect
                  value={editForm.relocation}
                  onChange={(val) => setEditForm({ ...editForm, relocation: val })}
                  ariaLabel="Relocation"
                  options={[
                    { value: 'Yes', label: 'Open (Yes)' },
                    { value: 'No', label: 'Local Only (No)' },
                  ]}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Pipeline Stage
                </label>
                <CustomSelect
                  value={editForm.pipelineStage}
                  onChange={(val) => setEditForm({ ...editForm, pipelineStage: val })}
                  ariaLabel="Pipeline Stage"
                  options={PIPELINE_STAGE_OPTIONS}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Education
                </label>
                <input
                  type="text"
                  value={editForm.education || ''}
                  onChange={(e) => setEditForm({ ...editForm, education: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Partner Vendor <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <CustomSelect
                  value={editForm.vendorId || ''}
                  onChange={(val) => {
                    const matched = vendors.find((v) => v.id === val);
                    setEditForm({
                      ...editForm,
                      vendorId: val || '',
                      vendorName: matched?.name || '',
                    });
                  }}
                  ariaLabel="Partner Vendor"
                  options={[
                    { value: '', label: 'Direct / Own Bench (No Vendor)' },
                    ...vendors.map((v) => ({ value: v.id, label: v.name })),
                  ]}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Key Skillset
                </label>
                <SkillTagInput
                  value={editForm.skillset}
                  onChange={(nextCsv) => setEditForm({ ...editForm, skillset: nextCsv })}
                />
              </div>
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
              isOpen={isOpen}
            />
          </div>

          <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              disabled={isSaving}
              onClick={handleClose}
              className="px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 font-medium cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <ActionButton
              type="submit"
              loading={isSaving}
              loadingText="Saving..."
              className="px-4 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-semibold shadow-xs cursor-pointer"
            >
              Save Changes
            </ActionButton>
          </div>
        </form>
      </div>
    </div>
  );
};
