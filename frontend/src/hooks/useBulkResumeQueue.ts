import { useRef, useState } from 'react';
import { apiClient } from '../config/api.config';
import { Candidate, Requirement } from '../types';
import { useCurrency } from '../utils/currency';
import { mapCandidateFromApi } from '../utils/entityMappers';
import { buildCandidateFormData, validateCvFileSelection } from '../utils/cvFiles';
import {
  buildCandidateSavePayload,
  BulkQueueItem,
  mapParsedResumeToDraft,
  MAX_BULK_CV_FILES,
  ResumeProfileDraft,
} from '../utils/resumeDraftMapper';

export interface BulkResumeQueueController {
  items: BulkQueueItem[];
  isRunning: boolean;
  defaultRecruiter: string;
  setDefaultRecruiter: (name: string) => void;
  targetRequirement: Requirement | null;
  dismissedBanner: boolean;
  dismissBanner: () => void;
  startBatch: (files: File[], targetRequirement?: Requirement | null) => Promise<void>;
  stopBatch: () => void;
  clearQueue: () => void;
}

interface UseBulkResumeQueueOptions {
  onCandidateSaved: (
    candidate: Candidate,
    targetRequirement?: Requirement | null
  ) => Promise<void> | void;
  onBulkAttachToRequirement?: (req: Requirement, candidateIds: string[]) => Promise<void> | void;
  showToast: (title: string, message: string, icon?: string) => void;
}

/**
 * Root-level bulk resume parsing queue so closing modals or navigating away does not interrupt active uploads.
 */
export function useBulkResumeQueue({
  onCandidateSaved,
  onBulkAttachToRequirement,
  showToast,
}: UseBulkResumeQueueOptions): BulkResumeQueueController {
  const { symbol: currencySymbol } = useCurrency();
  const [items, setItems] = useState<BulkQueueItem[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [defaultRecruiter, setDefaultRecruiter] = useState('');
  const [targetRequirement, setTargetRequirement] = useState<Requirement | null>(null);
  const [dismissedBanner, setDismissedBanner] = useState(false);

  const cancelledRef = useRef(false);
  const runningRef = useRef(false);
  const defaultRecruiterRef = useRef(defaultRecruiter);
  defaultRecruiterRef.current = defaultRecruiter;

  const currencySymbolRef = useRef(currencySymbol);
  currencySymbolRef.current = currencySymbol;
  const onCandidateSavedRef = useRef(onCandidateSaved);
  onCandidateSavedRef.current = onCandidateSaved;
  const onBulkAttachRef = useRef(onBulkAttachToRequirement);
  onBulkAttachRef.current = onBulkAttachToRequirement;
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;

  const updateItem = (id: string, patch: Partial<BulkQueueItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const stopBatch = () => {
    cancelledRef.current = true;
  };

  const clearQueue = () => {
    if (runningRef.current) return;
    setItems([]);
    setTargetRequirement(null);
    setDismissedBanner(false);
  };

  const dismissBanner = () => {
    setDismissedBanner(true);
  };

  const startBatch = async (selectedFiles: File[], batchReq?: Requirement | null) => {
    if (runningRef.current) {
      showToastRef.current(
        'Batch In Progress',
        'Wait for the current bulk upload batch to finish or stop it first.',
        'hourglass'
      );
      return;
    }
    if (!selectedFiles || selectedFiles.length === 0) return;

    const clipped =
      selectedFiles.length > MAX_BULK_CV_FILES
        ? selectedFiles.slice(0, MAX_BULK_CV_FILES)
        : selectedFiles;

    if (selectedFiles.length > MAX_BULK_CV_FILES) {
      showToastRef.current(
        'Batch Limit Applied',
        `Processing the first ${MAX_BULK_CV_FILES} resumes in this batch.`,
        'warning'
      );
    }

    const activeReq = batchReq || null;
    const queue: BulkQueueItem[] = clipped.map((file, idx) => {
      const validationError = validateCvFileSelection(file);
      return {
        id: `bulk_${Date.now()}_${idx}_${file.name}`,
        file,
        status: validationError ? 'failed' : 'queued',
        message: validationError || 'Waiting in queue...',
      };
    });

    runningRef.current = true;
    cancelledRef.current = false;
    setTargetRequirement(activeReq);
    setDismissedBanner(false);
    setItems(queue);
    setIsRunning(true);

    let addedCount = 0;
    let duplicateCount = 0;
    let failedCount = queue.filter((q) => q.status === 'failed').length;
    const addedIds: string[] = [];

    for (let idx = 0; idx < queue.length; idx++) {
      if (cancelledRef.current) break;
      const item = queue[idx];
      if (item.status !== 'queued') continue;

      updateItem(item.id, { status: 'processing', message: 'Parsing resume...' });

      let draft: ResumeProfileDraft;
      let itemAiUsed = false;

      try {
        const parseForm = new FormData();
        parseForm.append('file', item.file);
        const parseRes = await apiClient.post('/parse-resume', parseForm);
        const mapped = mapParsedResumeToDraft(parseRes.data, item.file, currencySymbolRef.current, {
          defaultRecruiter: defaultRecruiterRef.current,
          uniqueFallbackEmail: true,
          batchIndex: idx,
        });
        draft = mapped.profile;
        itemAiUsed = mapped.aiUsed;
      } catch (err: any) {
        failedCount++;
        updateItem(item.id, {
          status: 'failed',
          message: err?.response?.data?.message || err?.message || 'Unable to parse resume file.',
        });
        continue;
      }

      if (cancelledRef.current) break;

      updateItem(item.id, {
        status: 'processing',
        candidateName: draft.fullName,
        currentTitle: draft.currentTitle,
        email: draft.email,
        aiUsed: itemAiUsed,
        message: 'Saving to candidate roster...',
      });

      const payload = buildCandidateSavePayload(draft, item.file.name);
      try {
        const saveRes = await apiClient.post(
          '/candidates',
          buildCandidateFormData(payload, item.file)
        );
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

        await onCandidateSavedRef.current(savedCandidate, activeReq);
        addedIds.push(savedCandidate.id);
        addedCount++;
        updateItem(item.id, {
          status: 'added',
          candidateName: savedCandidate.fullName,
          currentTitle: savedCandidate.currentTitle,
          email: savedCandidate.email,
          aiUsed: itemAiUsed,
          message: activeReq
            ? `Saved & queued for ${activeReq.code}`
            : 'Saved candidate & original CV to roster',
        });
      } catch (err: any) {
        const status = err?.response?.status;
        const msg = err?.response?.data?.message || err?.message || 'Failed to save consultant.';
        if (status === 409) {
          duplicateCount++;
          updateItem(item.id, {
            status: 'duplicate',
            candidateName: draft.fullName,
            email: draft.email,
            aiUsed: itemAiUsed,
            message: msg,
          });
        } else {
          failedCount++;
          updateItem(item.id, {
            status: 'failed',
            candidateName: draft.fullName,
            email: draft.email,
            aiUsed: itemAiUsed,
            message: msg,
          });
        }
      }
    }

    if (activeReq && addedIds.length > 0 && onBulkAttachRef.current) {
      try {
        await onBulkAttachRef.current(activeReq, addedIds);
      } catch {
        // Handler displays feedback if attachment fails
      }
    }

    runningRef.current = false;
    setIsRunning(false);
    const wasCancelled = cancelledRef.current;
    showToastRef.current(
      wasCancelled ? 'Bulk Upload Stopped' : 'Bulk Upload Complete',
      `Added: ${addedCount} • Duplicate Email: ${duplicateCount} • Failed: ${failedCount}`,
      addedCount > 0
        ? 'success'
        : 'info-muted'
    );
  };

  return {
    items,
    isRunning,
    defaultRecruiter,
    setDefaultRecruiter,
    targetRequirement,
    dismissedBanner,
    dismissBanner,
    startBatch,
    stopBatch,
    clearQueue,
  };
}
