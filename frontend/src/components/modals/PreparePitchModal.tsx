import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Info,
  Loader2,
  Mail,
  RefreshCw,
  Save,
  Sparkles,
  X,
} from 'lucide-react';
import { apiClient } from '../../config/api.config';
import { Candidate } from '../../types';
import { useCurrency } from '../../utils/currency';
import { downloadOriginalCandidateCv } from '../../utils/cvFiles';
import { downloadCandidateResumePdf } from '../../utils/pdfGenerator';
import { useAiCapabilities, useWorkspaceBrand } from '../../utils/workspaceBrand';
import { APPLE_EASE, AnimatedDrawer } from '../shared/MotionPrimitives';
import { MaskedPdfToggle } from '../shared/MaskedPdfControl';

export type PitchPurposeOption = 'client_pitch' | 'interview_followup';
export type PitchToneOption = 'PROFESSIONAL' | 'HIGH_IMPACT' | 'TECHNICAL_FOCUS';

export interface PreparePitchModalProps {
  isOpen: boolean;
  onClose: () => void;
  submissionId: string;
  requirementCode: string;
  requirementTitle: string;
  companyName?: string;
  candidate?: Candidate | null;
  fallbackCandidateName?: string;
  rateMasked?: boolean;
  initialStage?: string;
  showToast?: (title: string, message: string, icon?: string) => void;
}

const PURPOSE_OPTIONS: Array<{ id: PitchPurposeOption; label: string }> = [
  { id: 'client_pitch', label: 'Client Pitch' },
  { id: 'interview_followup', label: 'Interview Follow-Up' },
];

const TONE_OPTIONS: Array<{ id: PitchToneOption; label: string }> = [
  { id: 'PROFESSIONAL', label: 'Professional' },
  { id: 'HIGH_IMPACT', label: 'High Impact' },
  { id: 'TECHNICAL_FOCUS', label: 'Technical Focus' },
];

const getDraftComboKey = (purpose: PitchPurposeOption, tone: PitchToneOption) =>
  `${purpose}:${tone}`;

const getPurposeLabel = (id: PitchPurposeOption) =>
  PURPOSE_OPTIONS.find((item) => item.id === id)?.label || id;

const getToneLabel = (id: PitchToneOption) =>
  TONE_OPTIONS.find((item) => item.id === id)?.label || id;

const parseSavedComboKey = (
  key: string
): { purpose: PitchPurposeOption; tone: PitchToneOption } | null => {
  const [rawPurpose, rawTone] = String(key || '').split(':');
  if (
    PURPOSE_OPTIONS.some((item) => item.id === rawPurpose) &&
    TONE_OPTIONS.some((item) => item.id === rawTone)
  ) {
    return {
      purpose: rawPurpose as PitchPurposeOption,
      tone: rawTone as PitchToneOption,
    };
  }
  return null;
};

export const PreparePitchModal: React.FC<PreparePitchModalProps> = ({
  isOpen,
  onClose,
  submissionId,
  requirementCode,
  requirementTitle,
  companyName,
  candidate,
  fallbackCandidateName = 'Consultant',
  rateMasked = false,
  initialStage,
  showToast,
}) => {
  const { formatRate } = useCurrency();
  const brand = useWorkspaceBrand();
  const aiCapabilities = useAiCapabilities();

  const [purpose, setPurpose] = useState<PitchPurposeOption>('client_pitch');
  const [pitchTone, setPitchTone] = useState<PitchToneOption>('PROFESSIONAL');
  const [activeConfig, setActiveConfig] = useState<{
    purpose: PitchPurposeOption;
    tone: PitchToneOption;
  } | null>(null);
  const [savedDraftKeys, setSavedDraftKeys] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [aiUsed, setAiUsed] = useState(false);
  const [isCached, setIsCached] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSaved, setIsLoadingSaved] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatusText, setSaveStatusText] = useState<'Saved' | ''>('');
  const [draftError, setDraftError] = useState('');
  const [copiedTarget, setCopiedTarget] = useState<'subject' | 'body' | null>(null);
  const [isMaskedPdf, setIsMaskedPdf] = useState(false);
  const [isDownloadingCv, setIsDownloadingCv] = useState(false);
  const latestRequestIdRef = useRef(0);

  const loadDraft = async (
    nextPurpose: PitchPurposeOption,
    nextTone: PitchToneOption,
    options: { forceRegenerate?: boolean; cacheOnly?: boolean } = {}
  ): Promise<{ hasDraft: boolean; savedDraftKeys: string[] } | null> => {
    if (!submissionId) return null;
    const { forceRegenerate = false, cacheOnly = false } = options;
    const requestId = ++latestRequestIdRef.current;

    if (!cacheOnly) {
      setIsLoading(true);
      setIsRegenerating(forceRegenerate);
      setDraftError('');
      setSaveStatusText('');
    }

    try {
      const res = await apiClient.post(`/submissions/${submissionId}/pitch-draft`, {
        purpose: nextPurpose,
        pitchTone: nextTone,
        ...(forceRegenerate ? { regenerate: true } : {}),
        ...(cacheOnly ? { cacheOnly: true } : {}),
      });
      if (requestId !== latestRequestIdRef.current) return null;

      const data = res.data?.data;
      if (data) {
        const nextSavedKeys = Array.isArray(data.savedDraftKeys)
          ? data.savedDraftKeys.map((k: unknown) => String(k))
          : [];
        if (Array.isArray(data.savedDraftKeys)) {
          setSavedDraftKeys(nextSavedKeys);
        }
        if (cacheOnly && data.hasDraft === false) {
          if (data.recipientEmail) {
            setRecipientEmail((prev) => prev || String(data.recipientEmail));
          }
          return { hasDraft: false, savedDraftKeys: nextSavedKeys };
        }
        setSubject(String(data.subject || ''));
        setBodyText(String(data.bodyText || ''));
        setRecipientEmail(String(data.recipientEmail || ''));
        setAiUsed(Boolean(data.aiUsed));
        setIsCached(Boolean(data.cached));
        setActiveConfig({ purpose: nextPurpose, tone: nextTone });
        setIsDirty(false);
        setDraftError('');
        return { hasDraft: true, savedDraftKeys: nextSavedKeys };
      }
      return null;
    } catch (err: any) {
      if (requestId === latestRequestIdRef.current && !cacheOnly) {
        setDraftError(
          err?.response?.data?.message || err?.message || 'Could not generate pitch draft.'
        );
        setAiUsed(false);
        setIsCached(false);
      }
      return null;
    } finally {
      if (requestId === latestRequestIdRef.current && !cacheOnly) {
        setIsLoading(false);
        setIsRegenerating(false);
      }
    }
  };

  const persistEditsIfDirty = async (
    targetPurpose: PitchPurposeOption = activeConfig?.purpose ?? purpose,
    targetTone: PitchToneOption = activeConfig?.tone ?? pitchTone
  ) => {
    if (!submissionId || !isDirty || (!subject.trim() && !bodyText.trim())) return;
    setIsSaving(true);
    try {
      const res = await apiClient.put(`/submissions/${submissionId}/pitch-draft`, {
        purpose: targetPurpose,
        pitchTone: targetTone,
        subject,
        bodyText,
      });
      const saved = res.data?.data;
      if (saved) {
        setSubject(String(saved.subject || ''));
        setBodyText(String(saved.bodyText || ''));
      }
      const comboKey = getDraftComboKey(targetPurpose, targetTone);
      setSavedDraftKeys((prev) => (prev.includes(comboKey) ? prev : [...prev, comboKey]));
      setIsDirty(false);
      setIsCached(true);
      setSaveStatusText('Saved');
      setTimeout(() => setSaveStatusText(''), 2000);
    } catch (err: any) {
      setDraftError(
        err?.response?.data?.message || err?.message || 'Could not save draft edits.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !submissionId) return;
    let cancelled = false;
    const defaultPurpose: PitchPurposeOption =
      String(initialStage || '').trim().toLowerCase() === 'interview'
        ? 'interview_followup'
        : 'client_pitch';
    setPurpose(defaultPurpose);
    setPitchTone('PROFESSIONAL');
    setActiveConfig(null);
    setSavedDraftKeys([]);
    setSubject('');
    setBodyText('');
    setRecipientEmail('');
    setCopiedTarget(null);
    setDraftError('');
    setIsMaskedPdf(false);
    setAiUsed(false);
    setIsCached(false);
    setIsDirty(false);
    setSaveStatusText('');

    const initialize = async () => {
      setIsInitializing(true);
      try {
        const probe = await loadDraft(defaultPurpose, 'PROFESSIONAL', { cacheOnly: true });
        if (cancelled || !probe || probe.hasDraft) return;
        if (probe.savedDraftKeys.length > 0) {
          const fallbackCombo = parseSavedComboKey(probe.savedDraftKeys[0]);
          if (fallbackCombo) {
            setPurpose(fallbackCombo.purpose);
            setPitchTone(fallbackCombo.tone);
            await loadDraft(fallbackCombo.purpose, fallbackCombo.tone, { cacheOnly: true });
          }
        }
      } finally {
        if (!cancelled) {
          setIsInitializing(false);
        }
      }
    };

    void initialize();
    return () => {
      cancelled = true;
    };
  }, [isOpen, submissionId]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        void persistEditsIfDirty();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, purpose, pitchTone, activeConfig, isDirty, subject, bodyText, submissionId]);

  const rawCandidateName = candidate?.fullName || fallbackCandidateName;
  const candidateName =
    String(rawCandidateName || '')
      .replace(/_+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || 'Consultant';
  const hasStoredOriginalCv = Boolean(candidate?.resumeFileUrl);
  const formattedRate = rateMasked || !candidate ? '' : formatRate(candidate.hourlyRate);
  const controlsDisabled = isLoading || isInitializing || isLoadingSaved;
  const hasActiveDraft = Boolean(
    activeConfig && activeConfig.purpose === purpose && activeConfig.tone === pitchTone
  );
  const savedCombos = savedDraftKeys
    .map((key) => ({ key, parsed: parseSavedComboKey(key) }))
    .filter(
      (item): item is { key: string; parsed: { purpose: PitchPurposeOption; tone: PitchToneOption } } =>
        Boolean(item.parsed)
    );

  const handleClose = () => {
    void persistEditsIfDirty();
    onClose();
  };

  const switchSelection = async (nextPurpose: PitchPurposeOption, nextTone: PitchToneOption) => {
    if (controlsDisabled) return;
    if (nextPurpose === purpose && nextTone === pitchTone && hasActiveDraft) return;
    await persistEditsIfDirty(activeConfig?.purpose ?? purpose, activeConfig?.tone ?? pitchTone);
    setPurpose(nextPurpose);
    setPitchTone(nextTone);
    setDraftError('');

    const comboKey = getDraftComboKey(nextPurpose, nextTone);
    if (!savedDraftKeys.includes(comboKey)) {
      setActiveConfig(null);
      setSubject('');
      setBodyText('');
      setAiUsed(false);
      setIsCached(false);
      setIsDirty(false);
      setSaveStatusText('');
      return;
    }

    setIsLoadingSaved(true);
    try {
      const probe = await loadDraft(nextPurpose, nextTone, { cacheOnly: true });
      if (probe && !probe.hasDraft) {
        setActiveConfig(null);
        setSubject('');
        setBodyText('');
      }
    } finally {
      setIsLoadingSaved(false);
    }
  };

  const handleTypeSelect = (nextPurpose: PitchPurposeOption) => {
    if (nextPurpose === purpose) return;
    void switchSelection(nextPurpose, pitchTone);
  };

  const handleToneSelect = (nextTone: PitchToneOption) => {
    if (nextTone === pitchTone) return;
    void switchSelection(purpose, nextTone);
  };

  const handleCopy = async (target: 'subject' | 'body') => {
    const textToCopy = target === 'subject' ? subject : bodyText;
    if (!textToCopy.trim()) return;
    void persistEditsIfDirty();
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedTarget(target);
      setTimeout(() => setCopiedTarget(null), 2000);
    } catch {
      setDraftError('Clipboard access blocked. Select and copy text manually.');
    }
  };

  const handleDownloadProfilePdf = () => {
    if (!candidate) return;
    const fileName = downloadCandidateResumePdf(candidate, formattedRate, brand, {
      masked: isMaskedPdf,
    });
    showToast?.(
      isMaskedPdf ? 'Masked PDF Downloaded' : 'Profile PDF Downloaded',
      `Saved ${fileName} so you can attach it to your email.`,
      'download'
    );
  };

  const handleDownloadOriginalCv = async () => {
    if (!candidate?.id || !hasStoredOriginalCv || isDownloadingCv) return;
    setIsDownloadingCv(true);
    try {
      const fileName = await downloadOriginalCandidateCv(
        candidate.id,
        candidate.resumeName || `${candidateName.replace(/\s+/g, '_')}_CV.pdf`
      );
      showToast?.(
        'Original CV Downloaded',
        `Downloaded ${fileName} for email attachment.`,
        'download'
      );
    } catch (err: any) {
      setDraftError(err?.response?.data?.message || err?.message || 'Failed to download original CV.');
    } finally {
      setIsDownloadingCv(false);
    }
  };

  const mailtoHref = `mailto:${encodeURIComponent(recipientEmail)}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(bodyText)}`;

  return (
    <AnimatedDrawer
      isOpen={isOpen}
      onBackdropClick={handleClose}
      zIndexClass="z-50"
      backdropClassName="bg-slate-900/50 backdrop-blur-[1px] flex justify-end"
      panelClassName="bg-white h-full w-full max-w-2xl border-l border-slate-200 shadow-2xl overflow-hidden flex flex-col"
      ariaLabel={`Prepare Email Draft for ${candidateName}`}
    >
        {/* Clean Header */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-white border border-slate-200 text-brand-700 flex items-center justify-center flex-shrink-0">
              <Mail className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-slate-900 truncate">
                  Prepare Email Draft &mdash; {candidateName}
                </h3>
                {hasActiveDraft && !controlsDisabled && aiUsed && aiCapabilities.enabled && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-0.5 rounded-full">
                    <Sparkles className="w-2.5 h-2.5 shrink-0" />
                    <span>AI Drafted</span>
                  </span>
                )}
                {hasActiveDraft && !controlsDisabled && isCached && (
                  <span
                    title="Loaded from saved draft (no extra AI tokens used)"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full"
                  >
                    <Check className="w-2.5 h-2.5 shrink-0" />
                    <span>Saved Draft</span>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 truncate mt-0.5">
                <span className="font-mono font-semibold text-slate-600">{requirementCode}</span> &bull;{' '}
                {requirementTitle}
                {companyName ? ` • ${companyName}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close email draft drawer"
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Selector Bar — only shows Regenerate when a draft is currently open */}
        <div className="flex-shrink-0 px-6 py-3 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-[11px] font-semibold text-slate-500 w-9 shrink-0">Type</span>
              <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-200/70 border border-slate-200/80">
                {PURPOSE_OPTIONS.map((item) => {
                  const isSelected = purpose === item.id;
                  const isSavedCombo = savedDraftKeys.includes(
                    getDraftComboKey(item.id, pitchTone)
                  );
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={controlsDisabled}
                      onClick={() => handleTypeSelect(item.id)}
                      className={`px-3 py-1 rounded-md text-[11px] font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-60 ${
                        isSelected
                          ? 'bg-slate-900 text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span>{item.label}</span>
                      {!isSelected && isSavedCombo && (
                        <Check
                          aria-label="Saved draft ready"
                          className="w-2.5 h-2.5 text-emerald-600 shrink-0"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-[11px] font-semibold text-slate-500 w-9 shrink-0">Tone</span>
              <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-200/70 border border-slate-200/80">
                {TONE_OPTIONS.map((t) => {
                  const isSelected = pitchTone === t.id;
                  const isSavedCombo = savedDraftKeys.includes(getDraftComboKey(purpose, t.id));
                  return (
                    <button
                      key={t.id}
                      type="button"
                      disabled={controlsDisabled}
                      onClick={() => handleToneSelect(t.id)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-60 ${
                        isSelected
                          ? 'bg-brand-600 text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span>{t.label}</span>
                      {!isSelected && isSavedCombo && (
                        <Check
                          aria-label="Saved draft ready"
                          className="w-2.5 h-2.5 text-emerald-600 shrink-0"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {hasActiveDraft && (
            <div className="flex-shrink-0 flex items-center">
              <button
                type="button"
                disabled={controlsDisabled}
                onClick={() => void loadDraft(purpose, pitchTone, { forceRegenerate: true })}
                title="Generate a fresh variation for this Type and Tone"
                className="h-8 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
                <span>{isRegenerating ? 'Regenerating...' : 'Regenerate'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="p-6 flex-1 min-h-0 overflow-y-auto flex flex-col text-xs bg-white">
          <AnimatePresence mode="wait">
            {isInitializing || isLoadingSaved ? (
              <motion.div
                key="pitch-loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.14 }}
                className="flex-1 flex flex-col items-center justify-center py-16 gap-2 text-xs font-medium text-slate-500"
              >
                <Loader2 className="w-5 h-5 animate-spin text-brand-600" />
                <span>{isInitializing ? 'Checking saved drafts...' : 'Loading saved draft...'}</span>
              </motion.div>
            ) : !hasActiveDraft ? (
              <motion.div
                key="pitch-configure"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18, ease: APPLE_EASE }}
                className="flex-1 flex flex-col justify-center space-y-4 my-auto py-4"
              >
                {draftError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-medium">
                    {draftError}
                  </div>
                )}

                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-6 py-10 text-center space-y-4">
                  <div className="w-11 h-11 rounded-full bg-brand-50 border border-brand-200 text-brand-700 flex items-center justify-center mx-auto">
                    {aiCapabilities.enabled ? (
                      <Sparkles className="w-5 h-5" />
                    ) : (
                      <Mail className="w-5 h-5" />
                    )}
                  </div>

                  <div className="space-y-1.5 max-w-md mx-auto">
                    <h4 className="text-sm font-bold text-slate-900">
                      Prepare {getPurposeLabel(purpose)}
                    </h4>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      <strong className="font-semibold text-slate-800">
                        {getToneLabel(pitchTone)}
                      </strong>{' '}
                      tone
                      {recipientEmail ? (
                        <>
                          {' '}
                          &bull; To <span className="font-medium text-slate-700">{recipientEmail}</span>
                        </>
                      ) : null}
                    </p>
                    {rateMasked && (
                      <p className="text-[11px] text-slate-400">
                        Rate-safe mode enabled: bill &amp; pay rates are automatically omitted.
                      </p>
                    )}
                  </div>

                  <div>
                    <button
                      type="button"
                      disabled={controlsDisabled}
                      onClick={() => void loadDraft(purpose, pitchTone)}
                      className="h-9 px-5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold inline-flex items-center gap-2  cursor-pointer transition-colors disabled:opacity-60"
                    >
                      {isLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {isLoading ? 'Generating Draft...' : `Generate ${getPurposeLabel(purpose)}`}
                      </span>
                      {!isLoading && aiCapabilities.enabled && (
                        <span className="px-1.5 py-0.5 rounded bg-white/15 text-[11px] font-bold uppercase tracking-wide leading-none">
                          AI
                        </span>
                      )}
                    </button>
                  </div>

                  {savedCombos.length > 0 && (
                    <div className="pt-3 border-t border-slate-200/80 flex flex-col items-center gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Saved Drafts Ready
                      </span>
                      <div className="flex flex-wrap items-center justify-center gap-1.5">
                        {savedCombos.map(({ key, parsed }) => (
                          <button
                            key={key}
                            type="button"
                            disabled={controlsDisabled}
                            onClick={() => void switchSelection(parsed.purpose, parsed.tone)}
                            className="px-2.5 py-1 rounded-full bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-[11px] font-medium text-slate-700 hover:text-emerald-800 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span>
                              {getPurposeLabel(parsed.purpose)} &middot; {getToneLabel(parsed.tone)}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key={`pitch-editor-${activeConfig?.purpose}-${activeConfig?.tone}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18, ease: APPLE_EASE }}
                className="space-y-4"
              >
                {draftError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-medium">
                    {draftError}
                  </div>
                )}

                {/* Unified Email Composer Sheet */}
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden card-shadow focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/10 transition-all">
                  {/* Recipient Row */}
                  <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/40 flex items-center gap-2.5">
                    <label
                      htmlFor="pitch-recipient-input"
                      className="text-[11px] font-semibold text-slate-400 w-12 shrink-0"
                    >
                      To
                    </label>
                    <input
                      id="pitch-recipient-input"
                      type="email"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      placeholder="Hiring manager email (optional — filled in mail app)"
                      disabled={isLoading}
                      className="flex-1 min-w-0 bg-transparent text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none disabled:opacity-60"
                    />
                  </div>

                  {/* Subject Row */}
                  <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2.5">
                    <label
                      htmlFor="pitch-subject-input"
                      className="text-[11px] font-semibold text-slate-400 w-12 shrink-0"
                    >
                      Subject
                    </label>
                    <input
                      id="pitch-subject-input"
                      type="text"
                      value={subject}
                      onChange={(e) => {
                        setSubject(e.target.value);
                        setIsDirty(true);
                        setSaveStatusText('');
                      }}
                      onBlur={() => void persistEditsIfDirty()}
                      disabled={isLoading}
                      className="flex-1 min-w-0 bg-transparent text-xs font-semibold text-slate-900 focus:outline-none disabled:opacity-60"
                    />
                    <button
                      type="button"
                      onClick={() => void handleCopy('subject')}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-brand-600 cursor-pointer shrink-0 px-2 py-0.5 rounded-md hover:bg-slate-100 transition-colors"
                    >
                      {copiedTarget === 'subject' ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span className="text-emerald-700">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy Subject</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Body Status Sub-header */}
                  <div className="px-4 py-1.5 border-b border-slate-100 bg-slate-50/40 flex items-center justify-between gap-2 min-h-[28px]">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Message
                      </span>
                      {isSaving && (
                        <span className="text-[11px] font-medium text-slate-400 inline-flex items-center gap-1">
                          <Loader2 className="w-2.5 h-2.5 animate-spin" />
                          <span>Saving...</span>
                        </span>
                      )}
                      {!isSaving && saveStatusText === 'Saved' && (
                        <span className="text-[11px] font-medium text-emerald-600 inline-flex items-center gap-1">
                          <Check className="w-2.5 h-2.5" />
                          <span>Edits saved</span>
                        </span>
                      )}
                      {!isSaving && isDirty && (
                        <button
                          type="button"
                          onClick={() => void persistEditsIfDirty()}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 px-2 py-0.5 rounded-full cursor-pointer"
                        >
                          <Save className="w-2.5 h-2.5" />
                          <span>Save Edits</span>
                        </button>
                      )}
                    </div>
                    {rateMasked && (
                      <span className="text-[11px] font-medium text-slate-500">
                        Rate-safe copy (bill/pay rates omitted)
                      </span>
                    )}
                  </div>

                  {/* Message Textarea */}
                  <div className="relative">
                    <textarea
                      rows={15}
                      aria-label="Email Body"
                      value={bodyText}
                      onChange={(e) => {
                        setBodyText(e.target.value);
                        setIsDirty(true);
                        setSaveStatusText('');
                      }}
                      onBlur={() => void persistEditsIfDirty()}
                      disabled={isLoading}
                      className="w-full min-h-[290px] p-4 bg-white text-sm text-slate-800 leading-relaxed focus:outline-none disabled:opacity-60 resize-y"
                    />
                    {isLoading && (
                      <div className="absolute inset-0 bg-white/80 backdrop-blur-[1px] flex items-center justify-center gap-2 text-xs font-semibold text-brand-700">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>
                          {isRegenerating
                            ? 'Regenerating fresh email draft...'
                            : 'Generating tailored email draft...'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Attachment Shortcuts & Masked PDF Control */}
                <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-4 space-y-3">
                  <div className="flex items-start gap-2 text-[11px] text-slate-600">
                    <Info className="w-3.5 h-3.5 text-brand-600 flex-shrink-0 mt-0.5" />
                    <span>
                      Remember to attach this candidate&apos;s Profile PDF or Original CV in Outlook / Gmail after clicking{' '}
                      <strong className="font-semibold text-slate-800">Open in Email</strong>.
                    </span>
                  </div>

                  {candidate && (
                    <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1 border-t border-slate-200/60">
                      <div className="pt-1">
                        <MaskedPdfToggle
                          checked={isMaskedPdf}
                          onChange={setIsMaskedPdf}
                          popoverPlacement="top"
                          popoverAlign="left"
                        />
                      </div>

                      <div className="flex items-center gap-2 flex-wrap pt-1">
                        <button
                          type="button"
                          onClick={handleDownloadProfilePdf}
                          className="h-7 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-800 text-[11px] font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5 text-brand-600" />
                          <span>{isMaskedPdf ? 'Download Masked PDF' : 'Download Profile PDF'}</span>
                        </button>

                        {hasStoredOriginalCv && (
                          <button
                            type="button"
                            disabled={isDownloadingCv}
                            onClick={handleDownloadOriginalCv}
                            className="h-7 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-800 text-[11px] font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-60"
                          >
                            {isDownloadingCv ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                            ) : (
                              <Download className="w-3.5 h-3.5 text-emerald-600" />
                            )}
                            <span>Original CV</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer Actions */}
        <div className="flex-shrink-0 px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 flex-wrap text-xs">
          <button
            type="button"
            onClick={handleClose}
            className="h-8 px-3.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-semibold cursor-pointer transition-colors"
          >
            Close
          </button>

          {hasActiveDraft ? (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                disabled={controlsDisabled || !bodyText.trim()}
                onClick={() => void handleCopy('body')}
                className="h-8 px-3.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-800 font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
              >
                {copiedTarget === 'body' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700">Copied Text</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Text</span>
                  </>
                )}
              </button>

              <a
                href={mailtoHref}
                onClick={(e) => {
                  if (controlsDisabled || !subject.trim()) {
                    e.preventDefault();
                    return;
                  }
                  void persistEditsIfDirty();
                }}
                className={`h-8 px-4 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-semibold inline-flex items-center gap-1.5 transition-colors ${
                  controlsDisabled ? 'opacity-60 pointer-events-none' : ''
                }`}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in Email</span>
              </a>
            </div>
          ) : (
            <span className="text-[11px] text-slate-400">
              Select Type &amp; Tone above, then click Generate {getPurposeLabel(purpose)}.
            </span>
          )}
        </div>
    </AnimatedDrawer>
  );
};
