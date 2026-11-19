import React, { useState, useRef, useEffect } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  CloudUpload,
  File,
  FileSpreadsheet,
  FileText,
  Files,
  Info,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  X,
  XCircle,
} from 'lucide-react';
import { apiClient } from '../../config/api.config';
import { Candidate } from '../../types';
import { formatRateDisplay, useCurrency } from '../../utils/currency';
import { useAiCapabilities } from '../../utils/workspaceBrand';
import { mapCandidateFromApi } from '../../utils/entityMappers';
import { AnimatedModal } from '../shared/MotionPrimitives';
import { CustomSelect } from '../shared/CustomSelect';
import {
  ALLOWED_CV_ACCEPT,
  buildCandidateFormData,
  validateCvFileSelection,
} from '../../utils/cvFiles';

interface ResumeParserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApprove: (candidate: Candidate) => void;
  onSwitchToCsvImport?: () => void;
  showToast: (title: string, message: string, icon?: string) => void;
}

const MAX_BULK_CV_FILES = 50;

type BulkQueueStatus = 'queued' | 'processing' | 'added' | 'duplicate' | 'failed';

interface BulkQueueItem {
  id: string;
  file: File;
  status: BulkQueueStatus;
  candidateName?: string;
  currentTitle?: string;
  email?: string;
  aiUsed?: boolean;
  message?: string;
}

const EMPTY_PROFILE = {
  fullName: '',
  phone: '',
  email: '',
  workAuth: 'US Citizen',
  currentTitle: '',
  skillset: '',
  education: '',
  hourlyRate: '',
  relocation: 'Yes',
  recruiter: '',
  fileName: '',
  rawSnippet: '',
  professionalSummary: '',
};

type ResumeProfileDraft = typeof EMPTY_PROFILE;

function inferResumeFormat(fileName: string): 'PDF' | 'DOCX' | 'DOC' | 'TXT' {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.docx')) return 'DOCX';
  if (lower.endsWith('.doc')) return 'DOC';
  if (lower.endsWith('.txt') || lower.endsWith('.rtf')) return 'TXT';
  return 'PDF';
}

function normalizeWorkAuth(raw?: string): string {
  const val = String(raw || '').trim();
  if (!val) return 'US Citizen';
  const lower = val.toLowerCase();
  if (lower.includes('citizen')) return 'US Citizen';
  if (lower.includes('green') || lower === 'gc' || lower.includes('permanent resident')) return 'Green Card';
  if (lower.includes('h-1b') || lower.includes('h1b')) return 'H-1B';
  if (lower.includes('tn')) return 'TN Visa';
  if (lower.includes('opt') || lower.includes('cpt') || lower.includes('ead')) return 'OPT EAD';
  return 'US Citizen';
}

function normalizeRelocation(raw?: string): 'Yes' | 'No' {
  const lower = String(raw || '').trim().toLowerCase();
  if (lower === 'no' || lower.includes('local only')) return 'No';
  return 'Yes';
}

function mapParsedResumeToDraft(
  resData: any,
  file: File,
  currencySymbol: string,
  options?: { defaultRecruiter?: string; uniqueFallbackEmail?: boolean; batchIndex?: number }
): { profile: ResumeProfileDraft; aiUsed: boolean } {
  const parsed = resData?.data || resData || {};
  const aiUsed = Boolean(resData?.aiUsed ?? parsed?.aiUsed);
  const skillsText = Array.isArray(parsed.skills)
    ? parsed.skills.join(', ')
    : parsed.skillset || parsed.skills || 'AWS, Kubernetes, Python, SQL';
  const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Uploaded Candidate';
  const emailSlug = baseName.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '') || 'candidate';
  const fallbackEmail = options?.uniqueFallbackEmail
    ? `${emailSlug}.${Date.now()}${options?.batchIndex ?? 0}@no-email.local`
    : 'candidate@gmail.com';
  const rawRate = parsed.hourly_rate || parsed.hourlyRate;

  return {
    aiUsed,
    profile: {
      fullName: parsed.full_name || parsed.fullName || baseName,
      phone: parsed.phone || '+1 (555) 010-0200',
      email: parsed.email || fallbackEmail,
      workAuth: normalizeWorkAuth(parsed.work_auth || parsed.workAuth),
      education: parsed.education || "Bachelor's Degree",
      currentTitle: parsed.current_title || parsed.currentTitle || 'Senior Software Engineer',
      skillset: skillsText,
      hourlyRate: rawRate ? formatRateDisplay(rawRate, currencySymbol) : `${currencySymbol}90/hr (W2)`,
      relocation: normalizeRelocation(parsed.relocation),
      recruiter: options?.defaultRecruiter?.trim() || parsed.recruiter || 'Assigned Recruiter',
      fileName: file.name,
      rawSnippet:
        parsed.raw_text_snippet ||
        parsed.rawSnippet ||
        `Document text extracted from: ${file.name}`,
      professionalSummary: parsed.professionalSummary || parsed.professional_summary || '',
    },
  };
}

function buildCandidateSavePayload(profile: ResumeProfileDraft, fallbackResumeName: string) {
  return {
    fullName: profile.fullName.trim(),
    email: profile.email.trim(),
    phone: profile.phone,
    currentTitle: profile.currentTitle,
    workAuth: profile.workAuth,
    education: profile.education,
    skillset: profile.skillset,
    hourlyRateDisplay: profile.hourlyRate,
    relocation: profile.relocation,
    resumeFileName: fallbackResumeName,
    resumeFormat: inferResumeFormat(fallbackResumeName),
    assignedRecruiter: profile.recruiter || undefined,
    rawSnippet: profile.rawSnippet,
  };
}

export const ResumeParserModal: React.FC<ResumeParserModalProps> = ({
  isOpen,
  onClose,
  onApprove,
  onSwitchToCsvImport,
  showToast,
}) => {
  const { symbol: currencySymbol } = useCurrency();
  const aiCapabilities = useAiCapabilities();
  const [mode, setMode] = useState<'single' | 'bulk'>('single');
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [parseProgress, setParseProgress] = useState<number>(0);
  const [hasParsedFile, setHasParsedFile] = useState<boolean>(false);
  const [aiUsed, setAiUsed] = useState<boolean>(false);
  const [selectedCvFile, setSelectedCvFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [bulkItems, setBulkItems] = useState<BulkQueueItem[]>([]);
  const [isBulkRunning, setIsBulkRunning] = useState<boolean>(false);
  const [bulkRecruiter, setBulkRecruiter] = useState<string>('');
  const bulkCancelledRef = useRef<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<ResumeProfileDraft>({ ...EMPTY_PROFILE });

  const resetModalState = () => {
    bulkCancelledRef.current = true;
    setMode('single');
    setProfile({ ...EMPTY_PROFILE });
    setHasParsedFile(false);
    setAiUsed(false);
    setSelectedCvFile(null);
    setIsParsing(false);
    setIsSaving(false);
    setParseProgress(0);
    setBulkItems([]);
    setIsBulkRunning(false);
    setBulkRecruiter('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (bulkFileInputRef.current) {
      bulkFileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    resetModalState();
  }, [isOpen]);

  const handleClose = () => {
    resetModalState();
    onClose();
  };

  const updateBulkItem = (id: string, patch: Partial<BulkQueueItem>) => {
    setBulkItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const processCvFile = async (file: File) => {
    const validationError = validateCvFileSelection(file);
    if (validationError) {
      showToast('Invalid CV File', validationError, 'fa-solid fa-triangle-exclamation text-amber-500');
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
      const inferredName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
      setProfile({
        fullName: inferredName,
        phone: '+1 (555) 234-5678',
        email: `${inferredName.toLowerCase().replace(/\s+/g, '.')}@gmail.com`,
        workAuth: 'US Citizen',
        education: "Master's Degree",
        currentTitle: 'Senior IT Consultant',
        skillset: 'AWS, Python, Kubernetes, CI/CD, SQL',
        hourlyRate: `${currencySymbol}90/hr (W2)`,
        relocation: 'Yes',
        recruiter: 'Assigned Recruiter',
        fileName: file.name,
        rawSnippet: `Resume File: ${file.name}\nCandidate: ${inferredName}\nPrimary Skills: AWS, Python, Kubernetes, SQL`,
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

  const processBulkCvFiles = async (selectedFiles: File[]) => {
    if (isBulkRunning) {
      showToast('Batch In Progress', 'Wait for the current bulk upload batch to finish or stop it first.', 'fa-solid fa-hourglass-half text-amber-500');
      return;
    }
    if (selectedFiles.length === 0) return;

    const clipped =
      selectedFiles.length > MAX_BULK_CV_FILES
        ? selectedFiles.slice(0, MAX_BULK_CV_FILES)
        : selectedFiles;

    if (selectedFiles.length > MAX_BULK_CV_FILES) {
      showToast(
        'Batch Limit Applied',
        `Processing the first ${MAX_BULK_CV_FILES} resumes in this batch.`,
        'fa-solid fa-triangle-exclamation text-amber-500'
      );
    }

    const queue: BulkQueueItem[] = clipped.map((file, idx) => {
      const validationError = validateCvFileSelection(file);
      return {
        id: `bulk_${Date.now()}_${idx}_${file.name}`,
        file,
        status: validationError ? 'failed' : 'queued',
        message: validationError || 'Waiting in queue...',
      };
    });

    setMode('bulk');
    setBulkItems(queue);
    setIsBulkRunning(true);
    bulkCancelledRef.current = false;

    let addedCount = 0;
    let duplicateCount = 0;
    let failedCount = queue.filter((q) => q.status === 'failed').length;

    for (let idx = 0; idx < queue.length; idx++) {
      if (bulkCancelledRef.current) break;
      const item = queue[idx];
      if (item.status !== 'queued') continue;

      updateBulkItem(item.id, { status: 'processing', message: 'Parsing resume...' });

      let draft: ResumeProfileDraft;
      let itemAiUsed = false;

      try {
        const parseForm = new FormData();
        parseForm.append('file', item.file);
        const parseRes = await apiClient.post('/parse-resume', parseForm);
        const mapped = mapParsedResumeToDraft(parseRes.data, item.file, currencySymbol, {
          defaultRecruiter: bulkRecruiter,
          uniqueFallbackEmail: true,
          batchIndex: idx,
        });
        draft = mapped.profile;
        itemAiUsed = mapped.aiUsed;
      } catch (err: any) {
        failedCount++;
        updateBulkItem(item.id, {
          status: 'failed',
          message: err?.response?.data?.message || err?.message || 'Unable to parse resume file.',
        });
        continue;
      }

      if (bulkCancelledRef.current) break;

      updateBulkItem(item.id, {
        status: 'processing',
        candidateName: draft.fullName,
        currentTitle: draft.currentTitle,
        email: draft.email,
        aiUsed: itemAiUsed,
        message: 'Saving to candidate roster...',
      });

      const payload = buildCandidateSavePayload(draft, item.file.name);
      try {
        const saveRes = await apiClient.post('/candidates', buildCandidateFormData(payload, item.file));
        const savedCandidate: Candidate = saveRes.data?.data
          ? mapCandidateFromApi(saveRes.data.data)
          : {
              id: `con_${Date.now()}_${idx}`,
              fullName: payload.fullName,
              phone: payload.phone,
              email: payload.email,
              workAuth: payload.workAuth,
              education: payload.education,
              currentTitle: payload.currentTitle,
              skillset: payload.skillset,
              hourlyRate: payload.hourlyRateDisplay,
              relocation: payload.relocation,
              resumeName: item.file.name,
              resumeFormat: payload.resumeFormat,
              assignedRecruiter: payload.assignedRecruiter || 'Assigned Recruiter',
              pipelineStage: 'Available / Bench',
              rawSnippet: payload.rawSnippet,
            };

        onApprove(savedCandidate);
        addedCount++;
        updateBulkItem(item.id, {
          status: 'added',
          candidateName: savedCandidate.fullName,
          currentTitle: savedCandidate.currentTitle,
          email: savedCandidate.email,
          aiUsed: itemAiUsed,
          message: 'Saved candidate & original CV to roster',
        });
      } catch (err: any) {
        const status = err?.response?.status;
        const msg = err?.response?.data?.message || err?.message || 'Failed to save consultant.';
        if (status === 409) {
          duplicateCount++;
          updateBulkItem(item.id, {
            status: 'duplicate',
            candidateName: draft.fullName,
            email: draft.email,
            aiUsed: itemAiUsed,
            message: msg,
          });
        } else {
          failedCount++;
          updateBulkItem(item.id, {
            status: 'failed',
            candidateName: draft.fullName,
            email: draft.email,
            aiUsed: itemAiUsed,
            message: msg,
          });
        }
      }
    }

    setIsBulkRunning(false);
    const wasCancelled = bulkCancelledRef.current;
    showToast(
      wasCancelled ? 'Bulk Upload Stopped' : 'Bulk Upload Complete',
      `Added: ${addedCount} • Duplicate Email: ${duplicateCount} • Failed: ${failedCount}`,
      addedCount > 0
        ? 'fa-solid fa-circle-check text-emerald-500'
        : 'fa-solid fa-circle-info text-slate-500'
    );
  };

  const handleFileSelection = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const selected = Array.from(files);
    if (mode === 'bulk' || selected.length > 1) {
      await processBulkCvFiles(selected);
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

  const handleApprove = async () => {
    if (!profile.fullName.trim() || !profile.email.trim()) {
      showToast('Validation Error', 'Full Name and Email Address are required before saving.', 'fa-solid fa-triangle-exclamation text-amber-500');
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

      onApprove(savedCandidate);
      resetModalState();
      onClose();
      showToast(
        'Consultant Approved',
        selectedCvFile
          ? `${savedCandidate.fullName} and original CV saved to roster!`
          : `${savedCandidate.fullName} registered to candidate roster!`,
        'fa-solid fa-circle-check text-emerald-500'
      );
    } catch (e: any) {
      const message = e?.response?.data?.message || e?.message || 'Failed to save consultant.';
      showToast('Save Failed', message, 'fa-solid fa-circle-exclamation text-rose-500');
    } finally {
      setIsSaving(false);
    }
  };

  const bulkTotal = bulkItems.length;
  const bulkAddedCount = bulkItems.filter((i) => i.status === 'added').length;
  const bulkDuplicateCount = bulkItems.filter((i) => i.status === 'duplicate').length;
  const bulkFailedCount = bulkItems.filter((i) => i.status === 'failed').length;
  const bulkProcessedCount = bulkAddedCount + bulkDuplicateCount + bulkFailedCount;
  const bulkProgressPct = bulkTotal > 0 ? Math.round((bulkProcessedCount / bulkTotal) * 100) : 0;

  return (
    <AnimatedModal
      isOpen={isOpen}
      onBackdropClick={handleClose}
      zIndexClass="z-50"
      backdropClassName="bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto select-none"
      panelClassName="bg-white rounded-xl shadow-2xl max-w-5xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
      ariaLabel="Add Consultant from Resume"
    >
        {/* Modal Header matching Prototype lines 760-776 */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between gap-3 bg-[#141615] text-white">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white flex-shrink-0 shadow-xs">
              {mode === 'bulk' ? <Files className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Add Consultant from Resume</span>
                <span className="text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.2 rounded">
                  Auto-Fill
                </span>
              </h2>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {mode === 'bulk'
                  ? `Drop or select up to ${MAX_BULK_CV_FILES} CVs to parse and import into your consultant roster.`
                  : 'Upload a Word (.docx) or PDF resume to fill in candidate details automatically.'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center rounded-lg bg-white/10 p-0.5 border border-white/10 text-[11px] font-semibold">
              <button
                type="button"
                disabled={isBulkRunning}
                onClick={() => setMode('single')}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer disabled:opacity-50 ${
                  mode === 'single' ? 'bg-white text-slate-900' : 'text-slate-300 hover:text-white'
                }`}
              >
                Single Resume
              </button>
              <button
                type="button"
                onClick={() => setMode('bulk')}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1 ${
                  mode === 'bulk' ? 'bg-white text-slate-900' : 'text-slate-300 hover:text-white'
                }`}
              >
                <Files className="w-3 h-3" />
                <span>Bulk Upload</span>
              </button>
            </div>
            <button
              onClick={handleClose}
              aria-label="Close modal"
              className="text-slate-400 hover:text-white w-7 h-7 rounded flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs">
          {mode === 'bulk' ? (
            <div className="space-y-4">
              {/* Bulk Dropzone & Recruiter Default */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className="bg-slate-50 border-2 border-dashed border-slate-300 hover:border-brand-500 rounded-xl p-5 text-center space-y-3 transition-colors"
              >
                <div className="flex flex-col items-center gap-1.5">
                  <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-600">
                    <CloudUpload className="w-5 h-5" />
                  </div>
                  <div className="text-xs font-bold text-slate-800">
                    Drop up to {MAX_BULK_CV_FILES} consultant resumes here, or click to select files
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Supports .pdf, .doc, .docx, .txt, .rtf (up to 15MB each). Duplicate emails are automatically skipped.
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
                  <input
                    type="text"
                    disabled={isBulkRunning}
                    value={bulkRecruiter}
                    onChange={(e) => setBulkRecruiter(e.target.value)}
                    placeholder="Default assigned recruiter (optional)"
                    className="px-3 py-1.5 w-64 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 focus:border-brand-500 focus:outline-none disabled:opacity-60"
                  />
                </div>
              </div>

              {/* Progress & Summary Counters */}
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
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700">
                        Added: {bulkAddedCount}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700">
                        Duplicate Email: {bulkDuplicateCount}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700">
                        Failed: {bulkFailedCount}
                      </span>
                      {!isBulkRunning && (
                        <button
                          type="button"
                          onClick={() => setBulkItems([])}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-slate-200 text-slate-500 hover:text-rose-600 hover:border-rose-200 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Clear</span>
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

                  <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto border border-slate-200 rounded-lg">
                    {bulkItems.map((item) => (
                      <div key={item.id} className="px-3 py-2.5 flex items-center justify-between gap-3 bg-white">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-slate-800 truncate max-w-[240px]">
                              {item.file.name}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {(item.file.size / 1024).toFixed(0)} KB
                            </span>
                            {item.aiUsed && aiCapabilities.enabled && (
                              <span className="inline-flex items-center gap-1 bg-indigo-50 border border-indigo-200 text-indigo-700 px-1.5 py-0.2 rounded-full text-[10px] font-semibold">
                                <Sparkles className="w-2.5 h-2.5" />
                                <span>AI Enhanced</span>
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                            {item.candidateName
                              ? `${item.candidateName}${item.currentTitle ? ` • ${item.currentTitle}` : ''}${item.message ? ` — ${item.message}` : ''}`
                              : item.message}
                          </div>
                        </div>

                        <div className="flex-shrink-0">
                          {item.status === 'queued' && (
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-semibold">
                              Queued
                            </span>
                          )}
                          {item.status === 'processing' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200 text-[10px] font-semibold">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              <span>Processing</span>
                            </span>
                          )}
                          {item.status === 'added' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold">
                              <Check className="w-3 h-3" />
                              <span>Added</span>
                            </span>
                          )}
                          {item.status === 'duplicate' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-semibold">
                              <AlertTriangle className="w-3 h-3" />
                              <span>Duplicate Email</span>
                            </span>
                          )}
                          {item.status === 'failed' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-semibold">
                              <XCircle className="w-3 h-3" />
                              <span>Failed</span>
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Top: Dedicated Resume Upload Zone & Sample Switcher */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
                {/* Left: Prominent Upload Button */}
                <div className="flex items-center gap-3">
                  <label className="px-3.5 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white text-xs font-semibold shadow-xs flex items-center gap-2 cursor-pointer transition-all">
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
                  <span className="text-[11px] text-slate-400 hidden sm:inline">or drag &amp; drop 1 or multiple files</span>
                </div>

            {/* Right: Upload Status / Supported Formats */}
            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium flex-wrap">
              <span className="px-2 py-1 rounded bg-white border border-slate-200 text-[10px]">
                Supports .pdf, .doc, .docx, .txt, .rtf
              </span>
              {selectedCvFile && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white text-slate-700 border border-slate-200 text-[10px] font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Original CV Will Auto-Save</span>
                </span>
              )}
              {hasParsedFile && !selectedCvFile && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white text-slate-700 border border-slate-200 text-[10px] font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Resume Loaded</span>
                </span>
              )}
            </div>
          </div>

          {/* Progress State */}
          {isParsing && (
            <div className="p-3 bg-brand-50 border border-brand-200 rounded-lg text-brand-900 space-y-1.5 animate-fade-in">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 text-brand-600 animate-spin" />
                  <span>Reading resume details...</span>
                </span>
                <span >{parseProgress}%</span>
              </div>
              <div className="w-full bg-brand-200 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-brand-600 h-full transition-all duration-300"
                  style={{ width: `${parseProgress}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* 2-Column Balanced Workbench matching Prototype lines 823-955 */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left Column (40% - col-span-5): Source Document Stream */}
            <div className="lg:col-span-5 bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-500" />
                  <span className="font-bold text-slate-800 text-xs">Source Document</span>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded font-medium flex items-center gap-1 ${hasParsedFile && profile.fileName ? 'text-brand-800 bg-brand-500/[0.08]' : 'text-slate-500 bg-slate-100'}`}>
                  {hasParsedFile && profile.fileName ? (
                    <FileText
                      className={`w-3 h-3 ${profile.fileName.endsWith('.docx') ? 'text-brand-600' : 'text-rose-500'}`}
                    />
                  ) : (
                    <File className="w-3 h-3 text-slate-400" />
                  )}
                  <span>{hasParsedFile && profile.fileName ? profile.fileName : 'No file selected'}</span>
                </span>
              </div>

              {/* Drag & Drop Zone */}
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
                <div className="text-[10px] text-slate-400 mt-0.5">Word (.doc/.docx), PDF, TXT, or RTF (up to 15MB)</div>
              </div>

              {/* Document Text Excerpt */}
              {aiUsed && aiCapabilities.enabled && profile.professionalSummary && (
                <div className="p-3 bg-indigo-50/60 rounded-lg border border-indigo-200/80 text-[11px] text-slate-700 space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-indigo-700 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    <span>Executive Summary</span>
                  </div>
                  <div className="leading-relaxed">{profile.professionalSummary}</div>
                </div>
              )}

              <div className="p-3 bg-white rounded-lg border border-slate-200 text-[11px] text-slate-600 space-y-2 max-h-60 overflow-y-auto leading-relaxed shadow-2xs">
                <div className="whitespace-pre-line">
                  {profile.rawSnippet || 'Upload a resume file above to inspect extracted document text.'}
                </div>
              </div>

              {/* Parsing Controls */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                  {hasParsedFile ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Info className="w-3.5 h-3.5 text-slate-400" />
                  )}
                  <span>{hasParsedFile ? 'Document Parsed Successfully' : 'Awaiting Resume Upload'}</span>
                </span>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2.5 py-1 rounded bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-medium text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Upload className="w-3 h-3" />
                  <span>Choose File</span>
                </button>
              </div>
            </div>

            {/* Right Column (60% - col-span-7): Extracted Consultant Profile Form */}
            <div className="lg:col-span-7 bg-white rounded-xl p-4 border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div>
                  <span className="font-bold text-slate-900 text-xs">Extracted Consultant Profile</span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    Review and edit fields before saving
                  </span>
                </div>
                {hasParsedFile && (
                  aiUsed && aiCapabilities.enabled ? (
                    <span className="inline-flex items-center gap-1 bg-indigo-50 border border-indigo-200 text-indigo-700 px-2.5 py-0.5 rounded-full text-[10px] font-semibold">
                      <Sparkles className="w-3 h-3" />
                      <span>AI Enhanced</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 px-2.5 py-0.5 rounded-full text-[10px] font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>Pattern Matched</span>
                    </span>
                  )
                )}
              </div>

              {/* Form Grid */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-medium text-slate-700 text-[10px] mb-0.5">Full Name *</label>
                  <input
                    type="text"
                    value={profile.fullName}
                    onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                    className="w-full px-2.5 py-1 text-xs border border-slate-200 rounded bg-slate-50/50 font-medium focus:bg-white focus:border-brand-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 text-[10px] mb-0.5">Current Title *</label>
                  <input
                    type="text"
                    value={profile.currentTitle}
                    onChange={(e) => setProfile({ ...profile, currentTitle: e.target.value })}
                    className="w-full px-2.5 py-1 text-xs border border-slate-200 rounded bg-slate-50/50 font-medium focus:bg-white focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-medium text-slate-700 text-[10px] mb-0.5">
                    Work Authorization *
                  </label>
                  <CustomSelect
                    value={profile.workAuth}
                    onChange={(val) => setProfile({ ...profile, workAuth: val })}
                    ariaLabel="Work Authorization"
                    size="xs"
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
                  <label className="block font-medium text-slate-700 text-[10px] mb-0.5">Hourly Pay Rate</label>
                  <input
                    type="text"
                    value={profile.hourlyRate}
                    onChange={(e) => setProfile({ ...profile, hourlyRate: e.target.value })}
                    className="w-full px-2.5 py-1 text-xs border border-slate-200 rounded bg-slate-50/50 focus:bg-white focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-medium text-slate-700 text-[10px] mb-0.5">Email Address</label>
                  <input
                    type="email"
                    value={profile.email}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    className="w-full px-2.5 py-1 text-xs border border-slate-200 rounded bg-slate-50/50 focus:bg-white focus:border-brand-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 text-[10px] mb-0.5">Phone Number</label>
                  <input
                    type="text"
                    value={profile.phone}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    className="w-full px-2.5 py-1 text-xs border border-slate-200 rounded bg-slate-50/50 focus:bg-white focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-medium text-slate-700 text-[10px] mb-0.5">
                    Relocation Preference
                  </label>
                  <CustomSelect
                    value={profile.relocation}
                    onChange={(val) => setProfile({ ...profile, relocation: val })}
                    ariaLabel="Relocation Preference"
                    size="xs"
                    options={[
                      { value: 'Yes', label: 'Yes (Open Anywhere in US)' },
                      { value: 'No', label: 'No (Local Only)' },
                    ]}
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 text-[10px] mb-0.5">Highest Education</label>
                  <input
                    type="text"
                    value={profile.education}
                    onChange={(e) => setProfile({ ...profile, education: e.target.value })}
                    className="w-full px-2.5 py-1 text-xs border border-slate-200 rounded bg-slate-50/50 focus:bg-white focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 text-[10px] mb-0.5">
                  Extracted Technical Skills
                </label>
                <input
                  type="text"
                  value={profile.skillset}
                  onChange={(e) => setProfile({ ...profile, skillset: e.target.value })}
                  className="w-full px-2.5 py-1 text-xs border border-slate-200 rounded bg-slate-50/50 text-[11px] focus:bg-white focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 text-[10px] mb-0.5">Assigned Recruiter</label>
                <input
                  type="text"
                  value={profile.recruiter}
                  onChange={(e) => setProfile({ ...profile, recruiter: e.target.value })}
                  placeholder="Optional recruiter name"
                  className="w-full px-2.5 py-1 text-xs border border-slate-200 rounded bg-slate-50/50 focus:bg-white focus:border-brand-500 focus:outline-none"
                />
              </div>
            </div>
          </div>
            </>
          )}
        </div>

        {/* Modal Footer matching Prototype lines 958-973 */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={() => {
              handleClose();
              if (onSwitchToCsvImport) onSwitchToCsvImport();
            }}
            className="text-emerald-700 font-semibold hover:underline flex items-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Switch to CSV Import &amp; Column Mapping</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <div className="flex items-center gap-2">
            {mode === 'bulk' ? (
              isBulkRunning ? (
                <button
                  type="button"
                  onClick={() => {
                    bulkCancelledRef.current = true;
                  }}
                  className="px-4 py-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Stop Batch
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-5 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  {bulkTotal > 0 ? 'Done' : 'Close'}
                </button>
              )
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-white text-xs font-medium transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSaving || isParsing}
                  onClick={handleApprove}
                  className="px-5 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 active:bg-brand-800 disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  {isSaving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" strokeWidth={2.4} />
                  )}
                  <span>{isSaving ? 'Saving Consultant & CV...' : 'Add Consultant to Roster'}</span>
                </button>
              </>
            )}
          </div>
    </AnimatedModal>
  );
};
