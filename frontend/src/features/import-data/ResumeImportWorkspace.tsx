import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  Check,
  CheckCircle2,
  CloudUpload,
  File,
  FileSpreadsheet,
  FileText,
  Info,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import { apiClient } from '../../config/api.config';
import { Candidate, Requirement, User } from '../../types';
import { useCurrency } from '../../utils/currency';
import { useAiCapabilities } from '../../utils/workspaceBrand';
import { mapCandidateFromApi } from '../../utils/entityMappers';
import { formatMissingFieldsMessage, getMissingFieldLabels } from '../../utils/formValidation';
import {
  ALLOWED_CV_ACCEPT,
  buildCandidateFormData,
  validateCvFileSelection,
} from '../../utils/cvFiles';
import {
  buildCandidateSavePayload,
  EMPTY_RESUME_PROFILE,
  inferPersonNameFromFileName,
  mapParsedResumeToDraft,
  MAX_BULK_CV_FILES,
  ResumeProfileDraft,
} from '../../utils/resumeDraftMapper';
import { BulkResumeQueueController } from '../../hooks/useBulkResumeQueue';
import { CustomSelect } from '../../components/shared/CustomSelect';
import { SearchableSelectInput } from '../../components/shared/SearchableSelectInput';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { ActionButton } from '../../components/shared/ActionButton';

export interface ResumeApproveOptions {
  targetRequirement?: Requirement | null;
  stayOnPage?: boolean;
  skipAttach?: boolean;
}

export interface ResumeImportWorkspaceProps {
  variant?: 'page' | 'modal';
  mode?: 'single' | 'bulk';
  onModeChange?: (mode: 'single' | 'bulk') => void;
  resetTrigger?: unknown;
  lockedRequirement?: Requirement | null;
  users?: User[];
  bulkQueue: BulkResumeQueueController;
  cancelLabel?: string;
  onCancel: () => void;
  onApprove: (candidate: Candidate, options?: ResumeApproveOptions) => Promise<void> | void;
  onBulkDone?: (addedCount: number, targetRequirement?: Requirement | null) => void;
  onSwitchToCsvImport?: () => void;
  showToast: (title: string, message: string, icon?: string) => void;
}

/**
 * Shared Single & Bulk Resume Parser workspace used in both /import-data/resume and ResumeParserModal.
 * Bulk batches run in the lifted root `bulkQueue` controller so closing modals does not abort uploads.
 */
export const ResumeImportWorkspace: React.FC<ResumeImportWorkspaceProps> = ({
  variant = 'page',
  mode: controlledMode,
  onModeChange,
  resetTrigger,
  lockedRequirement = null,
  users = [],
  bulkQueue,
  cancelLabel = 'Cancel',
  onCancel,
  onApprove,
  onBulkDone,
  onSwitchToCsvImport,
  showToast,
}) => {
  const { symbol: currencySymbol } = useCurrency();
  const aiCapabilities = useAiCapabilities();
  const [internalMode, setInternalMode] = useState<'single' | 'bulk'>('single');
  const mode = controlledMode ?? internalMode;
  const setMode = (next: 'single' | 'bulk') => {
    setInternalMode(next);
    onModeChange?.(next);
  };

  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [parseProgress, setParseProgress] = useState<number>(0);
  const [hasParsedFile, setHasParsedFile] = useState<boolean>(false);
  const [aiUsed, setAiUsed] = useState<boolean>(false);
  const [selectedCvFile, setSelectedCvFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [validationAttempted, setValidationAttempted] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<ResumeProfileDraft>({ ...EMPTY_RESUME_PROFILE });

  const resetSingleDraft = () => {
    setProfile({ ...EMPTY_RESUME_PROFILE });
    setHasParsedFile(false);
    setAiUsed(false);
    setSelectedCvFile(null);
    setIsParsing(false);
    setIsSaving(false);
    setValidationAttempted(false);
    setParseProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Reset only single-mode form state when reopening the modal; never interrupt background bulk queue
  useEffect(() => {
    if (resetTrigger !== undefined) {
      resetSingleDraft();
      if (!bulkQueue.isRunning && bulkQueue.items.length === 0) {
        setMode('single');
      }
    }
  }, [resetTrigger]);

  const processCvFile = async (file: File) => {
    const validationError = validateCvFileSelection(file);
    if (validationError) {
      showToast(
        'Invalid CV File',
        validationError,
        'fa-solid fa-triangle-exclamation text-amber-500'
      );
      return;
    }

    setSelectedCvFile(file);
    setAiUsed(false);
    setIsParsing(true);
    setParseProgress(25);
    const timer = setTimeout(() => setParseProgress(70), 300);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await apiClient.post('/parse-resume', formData);
      clearTimeout(timer);
      setParseProgress(100);
      setIsParsing(false);
      const mapped = mapParsedResumeToDraft(res.data, file, currencySymbol);
      setProfile(mapped.profile);
      setAiUsed(mapped.aiUsed);
      setHasParsedFile(true);
      showToast(
        'Resume Parsed',
        `Extracted profile from ${file.name}!`,
        'fa-solid fa-circle-check text-emerald-500'
      );
    } catch {
      clearTimeout(timer);
      setParseProgress(100);
      setIsParsing(false);
      setAiUsed(false);
      const inferredName = inferPersonNameFromFileName(file.name);
      setProfile({
        fullName: inferredName,
        phone: '',
        email: '',
        workAuth: 'US Citizen',
        education: '',
        currentTitle: '',
        skillset: '',
        hourlyRate: '',
        relocation: 'Yes',
        recruiter: '',
        fileName: file.name,
        rawSnippet: `Resume File: ${file.name}`,
        professionalSummary: '',
      });
      setHasParsedFile(true);
      showToast(
        'Document Loaded',
        `Loaded ${file.name}. Review fields and confirm.`,
        'fa-solid fa-file-check text-brand-500'
      );
    }
  };

  const handleFileSelection = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const selected = Array.from(files);
    if (mode === 'bulk' || selected.length > 1) {
      setMode('bulk');
      void bulkQueue.startBatch(selected, lockedRequirement);
      return;
    }
    await processCvFile(selected[0]);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await handleFileSelection(e.target.files);
    e.target.value = '';
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    await handleFileSelection(e.dataTransfer.files);
  };

  const isFullNameMissing = !profile.fullName.trim();
  const isEmailMissing = !profile.email.trim();
  const showFullNameError = (hasParsedFile || validationAttempted) && isFullNameMissing;
  const showEmailError = (hasParsedFile || validationAttempted) && isEmailMissing;

  const handleApprove = async (stayOnPage = false) => {
    const missingFields = getMissingFieldLabels([
      { label: 'Full Name', valid: !isFullNameMissing },
      { label: 'Email Address', valid: !isEmailMissing },
    ]);

    if (missingFields.length > 0) {
      setValidationAttempted(true);
      showToast(
        'Validation Error',
        formatMissingFieldsMessage(missingFields, 'before saving'),
        'fa-solid fa-triangle-exclamation text-amber-500'
      );
      return;
    }

    const fallbackResumeName = selectedCvFile?.name || profile.fileName || 'Resume.pdf';
    const payload = buildCandidateSavePayload(profile, fallbackResumeName);

    setIsSaving(true);
    try {
      const requestBody = selectedCvFile
        ? buildCandidateFormData(payload, selectedCvFile)
        : payload;
      const res = await apiClient.post('/candidates', requestBody);

      const savedCandidate: Candidate = res.data?.data
        ? mapCandidateFromApi(res.data.data)
        : {
            id: 'con_' + Date.now(),
            fullName: payload.fullName,
            phone: payload.phone,
            email: payload.email,
            workAuth: payload.workAuth,
            education: payload.education,
            currentTitle: payload.currentTitle,
            skillset: payload.skillset,
            hourlyRate: payload.hourlyRateDisplay,
            relocation: payload.relocation,
            resumeName: fallbackResumeName,
            resumeFormat: payload.resumeFormat,
            assignedRecruiter: profile.recruiter || 'Assigned Recruiter',
            pipelineStage: 'Available / Bench',
            rawSnippet: payload.rawSnippet,
          };

      showToast(
        'Consultant Approved',
        selectedCvFile
          ? `${savedCandidate.fullName} and original CV saved to roster!`
          : `${savedCandidate.fullName} registered to candidate roster!`,
        'fa-solid fa-circle-check text-emerald-500'
      );

      await onApprove(savedCandidate, {
        targetRequirement: lockedRequirement,
        stayOnPage,
      });

      if (stayOnPage) {
        resetSingleDraft();
      }
    } catch (e: any) {
      const message = e?.response?.data?.message || e?.message || 'Failed to save consultant.';
      showToast('Save Failed', message, 'fa-solid fa-circle-exclamation text-rose-500');
    } finally {
      setIsSaving(false);
    }
  };

  const { items: bulkItems, isRunning: isBulkRunning } = bulkQueue;
  const bulkTotal = bulkItems.length;
  const bulkAddedCount = bulkItems.filter((i) => i.status === 'added').length;
  const bulkDuplicateCount = bulkItems.filter((i) => i.status === 'duplicate').length;
  const bulkFailedCount = bulkItems.filter((i) => i.status === 'failed').length;
  const bulkProcessedCount = bulkAddedCount + bulkDuplicateCount + bulkFailedCount;
  const bulkProgressPct = bulkTotal > 0 ? Math.round((bulkProcessedCount / bulkTotal) * 100) : 0;
  const activeBatchReq =
    mode === 'bulk' ? bulkQueue.targetRequirement || lockedRequirement : lockedRequirement;
  const isModal = variant === 'modal';

  return (
    <div className="space-y-4 text-xs">
      {activeBatchReq && (
        <div className="px-4 py-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-emerald-900 flex items-center justify-between gap-3 flex-wrap text-xs">
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>
              Consultants created here will be saved to the roster and automatically submitted to{' '}
              <strong>{activeBatchReq.code}</strong> ({activeBatchReq.opportunityTitle}).
            </span>
          </div>
          <span className="text-[11px] font-semibold text-emerald-700">+ Auto-Attach Active</span>
        </div>
      )}

      {mode === 'bulk' ? (
        <div className="space-y-4">
          {/* Bulk Dropzone & Recruiter Default */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className={`${
              isModal ? 'bg-slate-50 p-5' : 'bg-white p-7 shadow-2xs'
            } border-2 border-dashed border-slate-300 hover:border-brand-500 rounded-xl text-center space-y-3 transition-colors`}
          >
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-600">
                <CloudUpload className="w-5 h-5" />
              </div>
              <div className="text-xs font-bold text-slate-800">
                Drop up to {MAX_BULK_CV_FILES} consultant resumes here, or click to select files
              </div>
              <div className="text-[11px] text-slate-500">
                Supports .pdf, .doc, .docx, .txt, .rtf (up to 15MB each). Closing this window continues the batch in the background.
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
              <label
                className={`px-4 py-2 rounded-lg text-white text-xs font-semibold shadow-xs inline-flex items-center gap-2 transition-all ${
                  isBulkRunning
                    ? 'bg-slate-400 cursor-not-allowed'
                    : 'bg-brand-600 hover:bg-brand-700 cursor-pointer'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{isBulkRunning ? 'Processing Batch...' : 'Select Multiple CVs'}</span>
                <input
                  type="file"
                  multiple
                  disabled={isBulkRunning}
                  ref={bulkFileInputRef}
                  onChange={handleFileUpload}
                  accept={ALLOWED_CV_ACCEPT}
                  className="hidden"
                />
              </label>
              <div className="w-64 text-left">
                <SearchableSelectInput
                  value={bulkQueue.defaultRecruiter}
                  onChange={bulkQueue.setDefaultRecruiter}
                  options={users.map((u) => ({
                    id: u.id,
                    label: u.name,
                    sublabel: u.desk || u.role,
                  }))}
                  placeholder="Default assigned recruiter (optional)"
                  emptyLabel="Type custom recruiter name"
                  inputClassName="w-full pl-3 pr-7 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 focus:border-brand-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {bulkTotal > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-semibold text-slate-800 text-xs">
                  {isBulkRunning ? (
                    <Loader2 className="w-4 h-4 text-brand-600 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  )}
                  <span>
                    {isBulkRunning
                      ? `Processing ${Math.min(bulkProcessedCount + 1, bulkTotal)} of ${bulkTotal} resumes...`
                      : `Processed ${bulkProcessedCount} of ${bulkTotal} resumes`}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap text-[11px] font-semibold">
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700">
                    Added: {bulkAddedCount}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700">
                    Duplicate Email: {bulkDuplicateCount}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700">
                    Failed: {bulkFailedCount}
                  </span>
                  {!isBulkRunning && (
                    <button
                      type="button"
                      onClick={bulkQueue.clearQueue}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded border border-slate-200 text-slate-500 hover:text-rose-600 hover:border-rose-200 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Clear Queue</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-brand-600 h-full transition-all duration-300"
                  style={{ width: `${bulkProgressPct}%` }}
                />
              </div>

              <div
                className={`divide-y divide-slate-100 overflow-y-auto border border-slate-200 rounded-lg ${
                  isModal ? 'max-h-64' : 'max-h-[420px]'
                }`}
              >
                {bulkItems.map((item) => (
                  <div
                    key={item.id}
                    className="px-3.5 py-2.5 flex items-center justify-between gap-3 bg-white"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-xs text-slate-800 truncate max-w-[240px]">
                          {item.file.name}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {(item.file.size / 1024).toFixed(0)} KB
                        </span>
                        {item.aiUsed && aiCapabilities.enabled && (
                          <StatusBadge
                            tone="brand"
                            size="xs"
                            icon={<Sparkles className="w-2.5 h-2.5 text-indigo-600" />}
                            label="AI Enhanced"
                          />
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                        {item.candidateName
                          ? `${item.candidateName}${item.currentTitle ? ` • ${item.currentTitle}` : ''}${item.message ? ` — ${item.message}` : ''}`
                          : item.message}
                      </div>
                    </div>

                    <div className="shrink-0">
                      {item.status === 'queued' && (
                        <StatusBadge tone="slate" size="xs" label="Queued" />
                      )}
                      {item.status === 'processing' && (
                        <StatusBadge
                          tone="brand"
                          size="xs"
                          icon={<Loader2 className="w-3 h-3 animate-spin text-brand-600" />}
                          label="Processing"
                        />
                      )}
                      {item.status === 'added' && (
                        <StatusBadge
                          tone="emerald"
                          size="xs"
                          icon={<Check className="w-3 h-3 text-emerald-600" />}
                          label="Added"
                        />
                      )}
                      {item.status === 'duplicate' && (
                        <StatusBadge
                          tone="amber"
                          size="xs"
                          icon={<AlertTriangle className="w-3 h-3 text-amber-600" />}
                          label="Duplicate Email"
                        />
                      )}
                      {item.status === 'failed' && (
                        <StatusBadge
                          tone="rose"
                          size="xs"
                          icon={<XCircle className="w-3 h-3 text-rose-600" />}
                          label="Failed"
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div
            className={`flex items-center ${
              isModal && onSwitchToCsvImport ? 'justify-between' : 'justify-end'
            } gap-2 pt-1 flex-wrap`}
          >
            {isModal && onSwitchToCsvImport && (
              <button
                type="button"
                onClick={onSwitchToCsvImport}
                className="text-emerald-700 font-semibold hover:underline flex items-center gap-1.5 cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Switch to CSV Import</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            <div className="flex items-center gap-2">
              {isBulkRunning ? (
                <>
                  <button
                    type="button"
                    onClick={bulkQueue.stopBatch}
                    className="px-4 py-2 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Stop Batch
                  </button>
                  <button
                    type="button"
                    onClick={onCancel}
                    className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                  >
                    Run in Background
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (bulkAddedCount > 0 && onBulkDone) {
                      onBulkDone(bulkAddedCount, activeBatchReq);
                    } else {
                      onCancel();
                    }
                  }}
                  className="px-5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  {bulkTotal > 0
                    ? activeBatchReq && bulkAddedCount > 0
                      ? `Open ${activeBatchReq.code}`
                      : 'Done'
                    : cancelLabel}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Upload Bar */}
          <div
            className={`${
              isModal ? 'bg-slate-50 p-3.5' : 'bg-white p-4 shadow-2xs'
            } rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3`}
          >
            <div className="flex items-center gap-3 flex-wrap">
              <label className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white text-xs font-semibold shadow-xs flex items-center gap-2 cursor-pointer transition-all">
                <CloudUpload className="w-4 h-4" />
                <span>Upload Candidate Resume (.pdf / .docx)</span>
                <input
                  type="file"
                  multiple
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept={ALLOWED_CV_ACCEPT}
                  className="hidden"
                />
              </label>
              <span className="text-[11px] text-slate-400">
                or drag &amp; drop 1 or multiple files
              </span>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium flex-wrap">
              <span className="px-2.5 py-1 rounded-md bg-white border border-slate-200 text-[10px]">
                Supports .pdf, .doc, .docx, .txt, .rtf
              </span>
              {selectedCvFile && (
                <StatusBadge tone="emerald" size="xs" label="Original CV Will Auto-Save" />
              )}
              {hasParsedFile && !selectedCvFile && (
                <StatusBadge tone="emerald" size="xs" label="Resume Loaded" />
              )}
            </div>
          </div>

          {isParsing && (
            <div className="p-3.5 bg-brand-50 border border-brand-200 rounded-xl text-brand-900 space-y-1.5 animate-fade-in">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 text-brand-600 animate-spin" />
                  <span>Reading resume details...</span>
                </span>
                <span>{parseProgress}%</span>
              </div>
              <div className="w-full bg-brand-200 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-brand-600 h-full transition-all duration-300"
                  style={{ width: `${parseProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* 12-Column Workbench */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left: Source Document */}
            <div
              className={`lg:col-span-5 ${
                isModal ? 'bg-slate-50 p-4' : 'bg-white p-5 shadow-xs lg:sticky lg:top-4'
              } rounded-xl border border-slate-200 space-y-3`}
            >
              <div className="flex items-center justify-between border-b border-slate-200/70 pb-2">
                <div className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-500" />
                  <span className="font-bold text-slate-800 text-xs">Source Document</span>
                </div>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-medium flex items-center gap-1 ${
                    hasParsedFile && profile.fileName
                      ? 'text-brand-800 bg-brand-500/[0.08]'
                      : 'text-slate-500 bg-slate-100'
                  }`}
                >
                  {hasParsedFile && profile.fileName ? (
                    <FileText
                      className={`w-3 h-3 ${
                        profile.fileName.endsWith('.docx') ? 'text-brand-600' : 'text-rose-500'
                      }`}
                    />
                  ) : (
                    <File className="w-3 h-3 text-slate-400" />
                  )}
                  <span className="truncate max-w-[180px]">
                    {hasParsedFile && profile.fileName ? profile.fileName : 'No file selected'}
                  </span>
                </span>
              </div>

              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className="border-2 border-dashed border-slate-300 hover:border-brand-500 rounded-lg p-3 text-center bg-white cursor-pointer transition-colors group"
              >
                <div className="flex items-center justify-center gap-2 text-slate-600 group-hover:text-brand-600 transition-colors">
                  <CloudUpload className="w-4 h-4 text-brand-600" />
                  <span className="font-semibold text-xs text-slate-800 group-hover:text-brand-600">
                    Drop new resume file here or click to browse
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Word (.doc/.docx), PDF, TXT, or RTF (up to 15MB)
                </div>
              </div>

              {aiUsed && aiCapabilities.enabled && profile.professionalSummary && (
                <div className="p-3 bg-indigo-50/60 rounded-lg border border-indigo-200/80 text-[11px] text-slate-700 space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-indigo-700 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    <span>Executive Summary</span>
                  </div>
                  <div className="leading-relaxed">{profile.professionalSummary}</div>
                </div>
              )}

              <div
                className={`p-3 bg-white rounded-lg border border-slate-200 text-[11px] text-slate-600 space-y-2 overflow-y-auto leading-relaxed ${
                  isModal ? 'max-h-52' : 'max-h-[340px]'
                }`}
              >
                <div className="whitespace-pre-line">
                  {profile.rawSnippet ||
                    'Upload a resume file above to inspect extracted document text.'}
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                    {hasParsedFile ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Info className="w-3.5 h-3.5 text-slate-400" />
                    )}
                    <span>
                      {hasParsedFile ? 'Document Parsed Successfully' : 'Awaiting Resume Upload'}
                    </span>
                  </span>
                  {hasParsedFile && profile.rawSnippet.length > 4000 && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[9.5px] font-semibold text-emerald-700">
                      Full Multi-Page Text ({(profile.rawSnippet.length / 1000).toFixed(1)}k chars)
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2.5 py-1 rounded bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-medium text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Upload className="w-3 h-3" />
                  <span>Choose File</span>
                </button>
              </div>
            </div>

            {/* Right: Extracted Consultant Profile Form */}
            <div className="lg:col-span-7 bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div>
                  <span className="font-bold text-slate-900 text-xs">
                    Extracted Consultant Profile
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    Review and edit fields before saving
                  </span>
                </div>
                {hasParsedFile &&
                  (aiUsed && aiCapabilities.enabled ? (
                    <StatusBadge
                      tone="brand"
                      size="xs"
                      icon={<Sparkles className="w-3 h-3 text-indigo-600" />}
                      label="AI Enhanced"
                    />
                  ) : (
                    <StatusBadge tone="emerald" size="xs" label="Pattern Matched" />
                  ))}
              </div>

              {hasParsedFile && !profile.fullName.trim() && (
                <div className="p-2.5 rounded-lg bg-amber-50/90 border border-amber-200 text-amber-900 text-[11px] flex items-start gap-2 leading-relaxed">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">
                      Candidate name was not detected automatically.
                    </span>{' '}
                    This file may be a non-resume document or a long CV with a custom header. Enter or verify the candidate&apos;s{' '}
                    <strong>Full Name</strong> below before saving.
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <label className="block font-semibold text-slate-700 text-[10px] uppercase">
                      Full Name *
                    </label>
                    {showFullNameError && (
                      <span className="text-[10px] font-semibold text-rose-600">Required</span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={profile.fullName}
                    onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                    className={`w-full px-3 py-1.5 text-xs border rounded-lg font-medium focus:bg-white focus:outline-none ${
                      showFullNameError
                        ? 'border-rose-500 bg-rose-50/30 ring-1 ring-rose-500/25 focus:border-rose-500'
                        : 'border-slate-200 bg-white focus:border-brand-500'
                    }`}
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 text-[10px] uppercase mb-0.5">
                    Current Title
                  </label>
                  <input
                    type="text"
                    value={profile.currentTitle}
                    onChange={(e) => setProfile({ ...profile, currentTitle: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white font-medium focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 text-[10px] uppercase mb-0.5">
                    Work Authorization *
                  </label>
                  <CustomSelect
                    value={profile.workAuth}
                    onChange={(val) => setProfile({ ...profile, workAuth: val })}
                    ariaLabel="Work Authorization"
                    size="sm"
                    options={[
                      'US Citizen',
                      { value: 'Green Card', label: 'Green Card (Permanent Resident)' },
                      { value: 'H-1B', label: 'H-1B (Transfer Ready)' },
                      { value: 'TN Visa', label: 'TN Visa (NAFTA)' },
                      { value: 'OPT EAD', label: 'OPT / CPT EAD' },
                    ]}
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 text-[10px] uppercase mb-0.5">
                    Hourly Pay Rate
                  </label>
                  <input
                    type="text"
                    value={profile.hourlyRate}
                    onChange={(e) => setProfile({ ...profile, hourlyRate: e.target.value })}
                    placeholder={`${currencySymbol}85/hr`}
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <label className="block font-semibold text-slate-700 text-[10px] uppercase">
                      Email Address *
                    </label>
                    {showEmailError && (
                      <span className="text-[10px] font-semibold text-rose-600">Required</span>
                    )}
                  </div>
                  <input
                    type="email"
                    value={profile.email}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    className={`w-full px-3 py-1.5 text-xs border rounded-lg focus:bg-white focus:outline-none ${
                      showEmailError
                        ? 'border-rose-500 bg-rose-50/30 ring-1 ring-rose-500/25 focus:border-rose-500'
                        : 'border-slate-200 bg-white focus:border-brand-500'
                    }`}
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 text-[10px] uppercase mb-0.5">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={profile.phone}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 text-[10px] uppercase mb-0.5">
                    Relocation Preference
                  </label>
                  <CustomSelect
                    value={profile.relocation}
                    onChange={(val) => setProfile({ ...profile, relocation: val })}
                    ariaLabel="Relocation Preference"
                    size="sm"
                    options={[
                      { value: 'Yes', label: 'Yes (Open Anywhere in US)' },
                      { value: 'No', label: 'No (Local Only)' },
                    ]}
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 text-[10px] uppercase mb-0.5">
                    Highest Education
                  </label>
                  <input
                    type="text"
                    value={profile.education}
                    onChange={(e) => setProfile({ ...profile, education: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 text-[10px] uppercase mb-0.5">
                  Extracted Technical Skills
                </label>
                <input
                  type="text"
                  value={profile.skillset}
                  onChange={(e) => setProfile({ ...profile, skillset: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 text-[10px] uppercase mb-0.5">
                  Assigned Recruiter
                </label>
                <SearchableSelectInput
                  value={profile.recruiter}
                  onChange={(val) => setProfile({ ...profile, recruiter: val })}
                  options={users.map((u) => ({
                    id: u.id,
                    label: u.name,
                    sublabel: u.desk || u.role,
                  }))}
                  placeholder="Optional recruiter name"
                  emptyLabel="Type recruiter name"
                  inputClassName="w-full pl-3 pr-7 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                {isModal && onSwitchToCsvImport ? (
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={onSwitchToCsvImport}
                    className="text-emerald-700 font-semibold hover:underline flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Switch to CSV Import</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onCancel}
                    disabled={isSaving}
                    className="px-3.5 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {cancelLabel}
                  </button>
                )}

                <div className="flex items-center gap-2 flex-wrap">
                  {isModal && onSwitchToCsvImport && (
                    <button
                      type="button"
                      onClick={onCancel}
                      disabled={isSaving}
                      className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {cancelLabel}
                    </button>
                  )}
                  <ActionButton
                    loading={isSaving}
                    disabled={isParsing}
                    onClick={() => handleApprove(true)}
                    className="px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Save &amp; Parse Another
                  </ActionButton>
                  <ActionButton
                    loading={isSaving}
                    loadingText="Saving Consultant & CV..."
                    disabled={isParsing}
                    onClick={() => handleApprove(false)}
                    icon={<Plus className="w-3.5 h-3.5" strokeWidth={2.4} />}
                    className="px-4 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                  >
                    {lockedRequirement
                      ? `Save & Attach to ${lockedRequirement.code}`
                      : 'Add Consultant to Roster'}
                  </ActionButton>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
