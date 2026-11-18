import React, { useEffect, useState } from 'react';
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
  Shield,
  Sparkles,
  X,
} from 'lucide-react';
import { apiClient } from '../../config/api.config';
import { Candidate } from '../../types';
import { useCurrency } from '../../utils/currency';
import { downloadOriginalCandidateCv } from '../../utils/cvFiles';
import { downloadCandidateResumePdf } from '../../utils/pdfGenerator';
import { useAiCapabilities, useWorkspaceBrand } from '../../utils/workspaceBrand';

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

const TONE_OPTIONS: Array<{ id: PitchToneOption; label: string }> = [
  { id: 'PROFESSIONAL', label: 'Professional' },
  { id: 'HIGH_IMPACT', label: 'High Impact' },
  { id: 'TECHNICAL_FOCUS', label: 'Technical Focus' },
];

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
  const [subject, setSubject] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [aiUsed, setAiUsed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [draftError, setDraftError] = useState('');
  const [copiedTarget, setCopiedTarget] = useState<'subject' | 'body' | null>(null);
  const [isBlindPdf, setIsBlindPdf] = useState(false);
  const [isDownloadingCv, setIsDownloadingCv] = useState(false);

  const loadDraft = async (nextPurpose: PitchPurposeOption, nextTone: PitchToneOption) => {
    if (!submissionId) return;
    setIsLoading(true);
    setDraftError('');
    try {
      const res = await apiClient.post(`/submissions/${submissionId}/pitch-draft`, {
        purpose: nextPurpose,
        pitchTone: nextTone,
      });
      const data = res.data?.data;
      if (data) {
        setSubject(String(data.subject || ''));
        setBodyText(String(data.bodyText || ''));
        setRecipientEmail(String(data.recipientEmail || ''));
        setAiUsed(Boolean(data.aiUsed));
      }
    } catch (err: any) {
      setDraftError(
        err?.response?.data?.message || err?.message || 'Could not generate pitch draft.'
      );
      setAiUsed(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !submissionId) return;
    const defaultPurpose: PitchPurposeOption =
      String(initialStage || '').trim().toLowerCase() === 'interview'
        ? 'interview_followup'
        : 'client_pitch';
    setPurpose(defaultPurpose);
    setPitchTone('PROFESSIONAL');
    setCopiedTarget(null);
    setDraftError('');
    setIsBlindPdf(false);
    loadDraft(defaultPurpose, 'PROFESSIONAL');
  }, [isOpen, submissionId]);

  if (!isOpen) return null;

  const candidateName = candidate?.fullName || fallbackCandidateName;
  const hasStoredOriginalCv = Boolean(candidate?.resumeFileUrl);
  const formattedRate = rateMasked || !candidate ? '' : formatRate(candidate.hourlyRate);

  const handleCopy = async (target: 'subject' | 'body') => {
    const textToCopy = target === 'subject' ? subject : bodyText;
    if (!textToCopy.trim()) return;
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
      blind: isBlindPdf,
    });
    showToast?.(
      isBlindPdf ? 'Blind Profile PDF Downloaded' : 'Profile Brief Downloaded',
      `Exported ${fileName} for attachment.`,
      'fa-solid fa-file-arrow-down text-emerald-500'
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
        'fa-solid fa-file-arrow-down text-emerald-500'
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
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 bg-[#141615] text-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white flex-shrink-0">
              <Mail className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-white truncate">
                  Prepare Email Draft — {candidateName}
                </h3>
                {aiUsed && aiCapabilities.enabled && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-indigo-500/20 text-indigo-200 border border-indigo-400/30 px-2 py-0.5 rounded-full">
                    <Sparkles className="w-2.5 h-2.5" />
                    <span>AI Drafted</span>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 truncate mt-0.5">
                {requirementCode} &bull; {requirementTitle}
                {companyName ? ` (${companyName})` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close email draft dialog"
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Purpose & Tone Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 border border-slate-200/80 rounded-xl p-3">
            <div className="flex items-center gap-1.5">
              <span className="text-[10.5px] font-semibold text-slate-500 mr-1">Type:</span>
              {(
                [
                  { id: 'client_pitch', label: 'Client Pitch' },
                  { id: 'interview_followup', label: 'Interview Follow-Up' },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={isLoading}
                  onClick={() => {
                    setPurpose(item.id);
                    loadDraft(item.id, pitchTone);
                  }}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-60 ${
                    purpose === item.id
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10.5px] font-semibold text-slate-500 mr-0.5">Tone:</span>
              {TONE_OPTIONS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  disabled={isLoading}
                  onClick={() => {
                    setPitchTone(t.id);
                    loadDraft(purpose, t.id);
                  }}
                  className={`px-2 py-1 rounded-md text-[10.5px] font-semibold transition-colors cursor-pointer disabled:opacity-60 ${
                    pitchTone === t.id
                      ? 'bg-brand-600 text-white'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {t.label}
                </button>
              ))}
              <button
                type="button"
                disabled={isLoading}
                onClick={() => loadDraft(purpose, pitchTone)}
                title="Regenerate draft"
                className="p-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {draftError && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-medium">
              {draftError}
            </div>
          )}

          {/* Subject Line */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-slate-700">Email Subject</label>
              <button
                type="button"
                onClick={() => handleCopy('subject')}
                className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-slate-500 hover:text-brand-600 cursor-pointer"
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
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={isLoading}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50/50 text-xs font-medium text-slate-900 focus:bg-white focus:border-brand-500 focus:outline-none disabled:opacity-60"
            />
          </div>

          {/* Email Message Body */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-slate-700">Email Body</label>
              {rateMasked && (
                <span className="text-[10px] font-medium text-slate-500">
                  Rate-safe copy (bill/pay rates omitted)
                </span>
              )}
            </div>
            <div className="relative">
              <textarea
                rows={9}
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                disabled={isLoading}
                className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50/50 text-xs text-slate-800 leading-relaxed focus:bg-white focus:border-brand-500 focus:outline-none disabled:opacity-60"
              />
              {isLoading && (
                <div className="absolute inset-0 bg-white/70 rounded-xl flex items-center justify-center gap-2 text-xs font-semibold text-brand-700">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Preparing email draft...</span>
                </div>
              )}
            </div>
          </div>

          {/* Attachment Shortcuts & Blind PDF Control */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-start gap-2 text-[11px] text-slate-600">
              <Info className="w-3.5 h-3.5 text-brand-600 flex-shrink-0 mt-0.5" />
              <span>
                Remember to attach this candidate&apos;s Profile PDF or Original CV in Outlook / Gmail after clicking{' '}
                <strong className="font-semibold text-slate-800">Open in Email</strong>.
              </span>
            </div>

            {candidate && (
              <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
                <label className="inline-flex items-center gap-2 text-[11px] font-semibold text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isBlindPdf}
                    onChange={(e) => setIsBlindPdf(e.target.checked)}
                    className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  <Shield className="w-3.5 h-3.5 text-slate-500" />
                  <span>Blind / Redacted PDF (hide email &amp; phone)</span>
                </label>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleDownloadProfilePdf}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-800 text-[11px] font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-brand-600" />
                    <span>{isBlindPdf ? 'Download Blind PDF' : 'Download Profile PDF'}</span>
                  </button>

                  {hasStoredOriginalCv && (
                    <button
                      type="button"
                      disabled={isDownloadingCv}
                      onClick={handleDownloadOriginalCv}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-800 text-[11px] font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
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
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 flex-wrap text-xs">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-medium cursor-pointer"
          >
            Close
          </button>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              disabled={isLoading || !bodyText.trim()}
              onClick={() => handleCopy('body')}
              className="px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-800 font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
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
                if (isLoading || !subject.trim()) e.preventDefault();
              }}
              className={`px-4 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-semibold shadow-xs inline-flex items-center gap-1.5 transition-colors ${
                isLoading ? 'opacity-60 pointer-events-none' : ''
              }`}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open in Email</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
