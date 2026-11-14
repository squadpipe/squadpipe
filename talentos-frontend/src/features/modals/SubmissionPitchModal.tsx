import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AlertTriangle, Copy, PenTool, Send, Settings, X } from 'lucide-react';
import { apiClient } from '../../config/api.config';
import { Candidate, Client, Requirement } from '../../types';
import { setWorkspaceBrand, useWorkspaceBrand } from '../../utils/workspaceBrand';

interface SubmissionPitchModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidate?: Candidate | null;
  candidates?: Candidate[];
  requirement?: Requirement | null;
  clients?: Client[];
  onConfigureEmail?: () => void;
  showToast: (title: string, message: string, icon?: string) => void;
}

export const SubmissionPitchModal: React.FC<SubmissionPitchModalProps> = ({
  isOpen,
  onClose,
  candidate,
  candidates = [],
  requirement,
  clients = [],
  onConfigureEmail,
  showToast,
}) => {
  const brand = useWorkspaceBrand();
  const agencyBrandName = (brand.agencyName || brand.legalEntityName || 'Staffing Agency').trim();

  const [tone, setTone] = useState<'Professional' | 'High-Impact' | 'Technical Focus'>('Professional');
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>('');
  const [recipientEmail, setRecipientEmail] = useState<string>('');
  const [selectedContactEmail, setSelectedContactEmail] = useState<string>('__manual__');
  const [customSubject, setCustomSubject] = useState<string>('');
  const [customBody, setCustomBody] = useState<string>('');
  const [isSending, setIsSending] = useState(false);
  const [smtpConfigured, setSmtpConfigured] = useState<boolean | null>(null);
  const recipientTouchedRef = useRef(false);

  const firstAttachedCand =
    requirement?.submissions
      ?.map(
        (s) =>
          s.candidate ||
          candidates.find((c) => c.id === s.candidateId || c.fullName === s.fullName)
      )
      .find(Boolean) || null;

  const activeCand =
    candidate ||
    candidates.find((c) => c.id === selectedCandidateId) ||
    firstAttachedCand ||
    candidates.find((c) => c.fullName === requirement?.resourceName) ||
    candidates[0] ||
    null;

  const candidateName = activeCand?.fullName || '';
  const candidateTitle = activeCand?.currentTitle || 'Senior Technology Consultant';
  const candidateSkills = activeCand?.skillset || '';
  const companyName = requirement?.companyName || '';
  const jobTitle = requirement?.opportunityTitle || '';
  const rawRecruiter = requirement?.assignedRecruiter || activeCand?.assignedRecruiter;
  const recruiterName =
    typeof rawRecruiter === 'object' && rawRecruiter !== null
      ? (rawRecruiter as any).fullName || (rawRecruiter as any).name || 'Talent Acquisition Team'
      : String(rawRecruiter || 'Talent Acquisition Team');

  const clientContacts = useMemo(() => {
    const targetCompany = companyName.trim().toLowerCase();
    if (!targetCompany) return [];
    const matchedClient = clients.find(
      (cl) => cl.name.trim().toLowerCase() === targetCompany
    );
    return (matchedClient?.contacts || []).filter((ct) =>
      Boolean(ct.email && ct.email.trim())
    );
  }, [clients, companyName]);

  const generateDraft = (
    selectedTone: 'Professional' | 'High-Impact' | 'Technical Focus',
    cName: string,
    cTitle: string,
    cSkills: string,
    compName: string,
    jTitle: string,
    recName: string,
    agencyName: string
  ) => {
    if (!cName || !compName) {
      return {
        subject: cName ? `Candidate Profile: ${cName}` : 'Candidate Presentation',
        body: 'Please select a consultant and requirement to generate a tailored client submission pitch.',
      };
    }

    if (selectedTone === 'High-Impact') {
      return {
        subject: `Priority Candidate Submission: ${cName} for ${jTitle} @ ${compName}`,
        body: `Hi Team,\n\nI am writing to directly present ${cName} for your ${jTitle} opening.\n\n${cName} is an exceptional ${cTitle} with an outstanding track record delivering high-throughput production systems. Key competencies include:\n• Core Expertise: ${cSkills}\n• Deployment Status: Immediately available, verified credentials, and fully briefed on ${compName}'s technical requirements.\n\nPlease let me know your availability for an introductory technical interview this week.\n\nBest regards,\n${recName}\n${agencyName}`,
      };
    } else if (selectedTone === 'Technical Focus') {
      return {
        subject: `Technical Profile Submittal: ${cName} — ${cTitle}`,
        body: `Dear Hiring Team,\n\nPlease review the attached technical dossier for ${cName}, submitting for the ${jTitle} position with ${compName}.\n\nTechnical Assessment Highlights:\n1. Architecture & Hands-on Depth: Expert-level mastery of ${cSkills}.\n2. Problem Solving: Extensive enterprise background delivering resilient distributed systems.\n3. Availability & Authorization: Ready for technical round on 24 hours notice.\n\nAttached is the unbranded resume. Looking forward to your technical feedback.\n\nSincerely,\n${recName}\n${agencyName}`,
      };
    }
    return {
      subject: `Candidate Presentation: ${cName} - ${jTitle} - ${compName}`,
      body: `Dear Hiring Manager,\n\nI hope this email finds you well.\n\nWe are pleased to introduce ${cName} for your open ${jTitle} position at ${compName}. ${cName} currently serves as ${cTitle} and brings specialized hands-on experience in ${cSkills}.\n\nKey Candidate Qualifications:\n• Role: ${cTitle}\n• Core Skillset: ${cSkills}\n• Rate & Authorization: Fully verified and ready for client interview.\n\nPlease review the profile and let us know suitable interview windows.\n\nWarm regards,\n${recName}\n${agencyName}`,
    };
  };

  useEffect(() => {
    if (!isOpen) return;
    recipientTouchedRef.current = false;
    const matched =
      candidate ||
      firstAttachedCand ||
      candidates.find((c) => c.fullName === requirement?.resourceName) ||
      candidates[0];
    if (matched && !candidate) {
      setSelectedCandidateId(matched.id);
    }

    let active = true;
    apiClient
      .get('/settings')
      .then((res) => {
        if (!active) return;
        const data = res.data?.data;
        if (data?.general) {
          setWorkspaceBrand(data.general);
        }
        const s = data?.smtp;
        const configured =
          typeof s?.configured === 'boolean'
            ? s.configured
            : Boolean(
                s?.enabled &&
                  s?.host?.trim() &&
                  s?.username?.trim() &&
                  (s?.password || s?.hasPassword) &&
                  s?.fromEmail?.trim()
              );
        setSmtpConfigured(configured);
      })
      .catch(() => {
        if (active) setSmtpConfigured(null);
      });

    return () => {
      active = false;
    };
  }, [isOpen, candidate, requirement?.id]);

  useEffect(() => {
    if (!isOpen || recipientTouchedRef.current) return;
    if (clientContacts.length > 0) {
      const reqContactLower = (requirement?.clientContact || '').trim().toLowerCase();
      const preferred =
        clientContacts.find(
          (ct) =>
            (ct.name && ct.name.trim().toLowerCase() === reqContactLower) ||
            ct.email.trim().toLowerCase() === reqContactLower
        ) ||
        clientContacts.find((ct) => ct.isPrimary) ||
        clientContacts[0];
      const nextEmail = preferred.email.trim();
      setRecipientEmail(nextEmail);
      setSelectedContactEmail(nextEmail);
    } else {
      setRecipientEmail('');
      setSelectedContactEmail('__manual__');
    }
  }, [isOpen, requirement?.id, requirement?.clientContact, clientContacts]);

  useEffect(() => {
    if (!isOpen) return;
    const draft = generateDraft(
      tone,
      candidateName,
      candidateTitle,
      candidateSkills,
      companyName,
      jobTitle,
      recruiterName,
      agencyBrandName
    );
    setCustomSubject(draft.subject);
    setCustomBody(draft.body);
  }, [
    isOpen,
    tone,
    candidateName,
    candidateTitle,
    candidateSkills,
    companyName,
    jobTitle,
    recruiterName,
    agencyBrandName,
  ]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(`Subject: ${customSubject}\n\n${customBody}`);
    showToast('Copied to Clipboard', 'Submission pitch draft copied successfully!', 'fa-solid fa-copy text-brand-600');
  };

  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const handleSendEmail = async () => {
    if (smtpConfigured === false) {
      showToast(
        'Email Not Configured',
        'Please configure Email (SMTP) in Settings → Email Setup (SMTP) to dispatch emails.',
        'fa-solid fa-triangle-exclamation text-amber-500'
      );
      return;
    }
    if (!recipientEmail.trim()) {
      showToast(
        'Recipient Missing',
        clientContacts.length > 0
          ? 'Please select a client contact or enter a recipient email address.'
          : 'Please enter a recipient email address.',
        'fa-solid fa-circle-exclamation text-rose-500'
      );
      return;
    }
    setIsSending(true);
    try {
      const selectedContact = clientContacts.find(
        (ct) => ct.email.trim().toLowerCase() === recipientEmail.trim().toLowerCase()
      );
      const res = await apiClient.post('/smtp/send', {
        to: recipientEmail.trim(),
        recipientName: selectedContact?.name || requirement?.clientContact || 'Hiring Team',
        subject: customSubject,
        html: `<pre style="font-family: sans-serif; white-space: pre-wrap;">${escapeHtml(customBody)}</pre>`,
        candidateName,
        requirementTitle: jobTitle,
        clientName: companyName,
      });
      if (res.data?.delivered) {
        showToast(
          'Pitch Dispatched',
          res.data?.message || `Submission pitch sent to ${recipientEmail.trim()}!`,
          'fa-solid fa-paper-plane text-emerald-500'
        );
        onClose();
      } else {
        if (res.data?.configured === false) {
          setSmtpConfigured(false);
        }
        showToast(
          res.data?.configured === false ? 'Email Not Configured' : 'Dispatch Failed',
          res.data?.message ||
            'Please configure Email (SMTP) in Settings → Email Setup (SMTP) to dispatch emails.',
          'fa-solid fa-triangle-exclamation text-amber-500'
        );
      }
    } catch (err: any) {
      const errData = err.response?.data;
      const isNotConfigured =
        errData?.code === 'SMTP_NOT_CONFIGURED' || errData?.configured === false;
      if (isNotConfigured) {
        setSmtpConfigured(false);
      }
      showToast(
        isNotConfigured ? 'Email Not Configured' : 'Dispatch Failed',
        errData?.message ||
          (isNotConfigured
            ? 'Please configure Email (SMTP) in Settings → Email Setup (SMTP) to dispatch emails.'
            : 'Failed to send email.'),
        isNotConfigured
          ? 'fa-solid fa-triangle-exclamation text-amber-500'
          : 'fa-solid fa-circle-exclamation text-rose-500'
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full border border-slate-200 card-shadow overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
              <PenTool className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Automated Client Submission Pitch Writer</h3>
              <p className="text-[11px] text-slate-400">Tailors presentation emails with custom tones for hiring managers</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {smtpConfigured === false && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-900">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold">Email (SMTP) is not configured</div>
                  <div className="text-[11px] text-amber-800">
                    Configure your outbound email settings in Settings &rarr; Email Setup (SMTP) to dispatch pitch emails.
                  </div>
                </div>
              </div>
              {onConfigureEmail && (
                <button
                  type="button"
                  onClick={onConfigureEmail}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-semibold flex items-center gap-1.5 flex-shrink-0 cursor-pointer transition-colors"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>Configure Email</span>
                </button>
              )}
            </div>
          )}

          {/* Tone Selector */}
          <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
            <span className="text-xs font-bold text-slate-700">Presentation Tone:</span>
            <div className="flex gap-2">
              {(['Professional', 'High-Impact', 'Technical Focus'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTone(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                    tone === t
                      ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {!candidate && candidates.length > 0 && (() => {
              const attachedIds = new Set(
                (requirement?.submissions || []).map((s) => s.candidateId).filter(Boolean)
              );
              const attached = candidates.filter((c) => attachedIds.has(c.id));
              const others = candidates.filter((c) => !attachedIds.has(c.id));
              return (
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Select Consultant</label>
                  <select
                    value={activeCand?.id || ''}
                    onChange={(e) => setSelectedCandidateId(e.target.value)}
                    className="mt-1 w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 font-semibold"
                  >
                    {attached.length > 0 && (
                      <optgroup label={`Attached Applicants (${attached.length})`}>
                        {attached.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.fullName} — {c.currentTitle}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {others.length > 0 && (
                      <optgroup label={attached.length > 0 ? 'Other Consultants' : 'Consultants'}>
                        {others.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.fullName} — {c.currentTitle}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>
              );
            })()}

            <div className={!candidate && candidates.length > 0 ? '' : 'md:col-span-2'}>
              <label className="text-[10px] font-bold text-slate-500 uppercase">
                Recipient Email
              </label>
              {clientContacts.length > 0 && (
                <select
                  value={selectedContactEmail}
                  onChange={(e) => {
                    recipientTouchedRef.current = true;
                    const val = e.target.value;
                    setSelectedContactEmail(val);
                    if (val === '__manual__') {
                      setRecipientEmail('');
                    } else {
                      setRecipientEmail(val);
                    }
                  }}
                  aria-label="Client Contact Recipient"
                  className="mt-1 mb-2 w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 font-semibold"
                >
                  {clientContacts.map((ct, idx) => (
                    <option key={`${ct.email}-${idx}`} value={ct.email.trim()}>
                      {ct.name ? `${ct.name}${ct.designation ? ` (${ct.designation})` : ''} — ${ct.email}` : ct.email}
                    </option>
                  ))}
                  <option value="__manual__">Enter email manually...</option>
                </select>
              )}
              <input
                type="email"
                value={recipientEmail}
                onChange={(e) => {
                  recipientTouchedRef.current = true;
                  const val = e.target.value;
                  setRecipientEmail(val);
                  const matched = clientContacts.find(
                    (ct) => ct.email.trim().toLowerCase() === val.trim().toLowerCase()
                  );
                  setSelectedContactEmail(matched ? matched.email.trim() : '__manual__');
                }}
                placeholder="Enter recipient email address..."
                className="mt-1 w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800"
              />
            </div>
          </div>

          {/* Subject Line */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase">Subject</label>
            <input
              type="text"
              value={customSubject}
              onChange={(e) => setCustomSubject(e.target.value)}
              className="mt-1 w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 font-semibold"
            />
          </div>

          {/* Email Body */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase">Pitch Content</label>
            <textarea
              rows={9}
              value={customBody}
              onChange={(e) => setCustomBody(e.target.value)}
              className="mt-1 w-full p-3 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 leading-relaxed"
            ></textarea>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="text-[11px] text-slate-400">
            Outbox Target: <span className="font-semibold text-slate-700">{companyName || recipientEmail}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className="px-4 py-2 text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy Text</span>
            </button>
            <button
              onClick={handleSendEmail}
              disabled={isSending}
              className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm shadow-emerald-600/20 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSending ? 'Sending...' : 'Dispatch via SMTP'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
