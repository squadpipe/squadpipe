import React, { useState } from 'react';
import { apiClient } from '../../config/api.config';
import { Requirement, Client, User } from '../../types';

interface EmailParserModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients?: Client[];
  users?: User[];
  onApprove: (req: Requirement) => void;
  showToast: (title: string, message: string, icon?: string) => void;
}

const EMPTY_FORM = {
  companyName: '',
  opportunityTitle: '',
  location: '',
  workModel: 'Remote' as 'Remote' | 'Hybrid' | 'Onsite',
  clientContact: '',
  clientContactTitle: '',
  clientContactEmail: '',
  skillsRequired: '',
  assignedRecruiter: '',
  initialStage: 'Requirement' as 'Requirement' | 'Submitted' | 'Interview',
  targetBillRate: 0,
  targetPayRate: 0,
  missingNotes: '',
};

export const EmailParserModal: React.FC<EmailParserModalProps> = ({
  isOpen,
  onClose,
  clients = [],
  users = [],
  onApprove,
  showToast,
}) => {
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [rawEmailText, setRawEmailText] = useState<string>('');
  const [skillInput, setSkillInput] = useState<string>('');
  const [extractedReq, setExtractedReq] = useState(EMPTY_FORM);

  if (!isOpen) return null;

  const parseEmailText = async (textToParse: string) => {
    if (!textToParse.trim()) {
      showToast('Email Required', 'Please paste an email body first before parsing.', 'fa-solid fa-triangle-exclamation text-amber-500');
      return;
    }
    setIsParsing(true);
    try {
      const res = await apiClient.post('/parse-email', { rawEmailText: textToParse });
      const d = res.data?.data?.data || res.data?.data;
      if (d) {
        const parsedSkills = d.skillsRequired || (Array.isArray(d.skills) ? d.skills.join(', ') : d.skills);
        const parsedBillRate = Number(d.billRate || d.targetBillRate || 0);
        const parsedPayRate = Number(
          d.payRate || d.targetPayRate || (parsedBillRate > 0 ? Math.round(parsedBillRate * 0.75) : 0)
        );
        const rawWorkModel = String(d.workModel || d.location || '').toLowerCase();
        const detectedWorkModel: 'Remote' | 'Hybrid' | 'Onsite' = rawWorkModel.includes('hybrid')
          ? 'Hybrid'
          : rawWorkModel.includes('onsite')
          ? 'Onsite'
          : 'Remote';

        setExtractedReq((prev) => ({
          ...prev,
          companyName: d.companyName || d.clientName || prev.companyName,
          opportunityTitle: d.opportunityTitle || d.jobTitle || prev.opportunityTitle,
          location: d.location || prev.location || 'Remote',
          workModel: detectedWorkModel,
          clientContact: d.clientContact || d.contactName || prev.clientContact,
          clientContactTitle: d.clientContactTitle || d.contactTitle || prev.clientContactTitle,
          clientContactEmail: d.clientContactEmail || prev.clientContactEmail,
          skillsRequired: parsedSkills || prev.skillsRequired,
          assignedRecruiter: d.assignedRecruiter || prev.assignedRecruiter || users[0]?.name || '',
          targetBillRate: parsedBillRate || prev.targetBillRate,
          targetPayRate: parsedPayRate || prev.targetPayRate,
          missingNotes: Array.isArray(d.missingFields)
            ? d.missingFields.join(', ')
            : d.missingNotes || 'NLP extraction complete.',
        }));
        showToast('Email Parsed Successfully', 'Extracted requisition, contact, skills, and rate details!', 'fa-solid fa-bolt text-amber-500');
      }
    } catch (err: any) {
      showToast('Parse Failed', err.response?.data?.message || err.message || 'Could not parse email right now.', 'fa-solid fa-triangle-exclamation text-rose-500');
    } finally {
      setIsParsing(false);
    }
  };

  const handleClearAll = () => {
    setRawEmailText('');
    setSkillInput('');
    setExtractedReq(EMPTY_FORM);
  };

  const skillTags = extractedReq.skillsRequired
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const handleAddSkillTag = (raw: string) => {
    const clean = raw.trim();
    if (!clean) return;
    if (!skillTags.some((t) => t.toLowerCase() === clean.toLowerCase())) {
      setExtractedReq((prev) => ({
        ...prev,
        skillsRequired: [...skillTags, clean].join(', '),
      }));
    }
    setSkillInput('');
  };

  const handleRemoveSkillTag = (tagToRemove: string) => {
    const remaining = skillTags.filter((t) => t !== tagToRemove);
    setExtractedReq((prev) => ({ ...prev, skillsRequired: remaining.join(', ') }));
  };

  const marginSpread = Math.max(
    0,
    (Number(extractedReq.targetBillRate) || 0) - (Number(extractedReq.targetPayRate) || 0)
  );

  const handleApprove = async () => {
    if (!extractedReq.companyName.trim() || !extractedReq.opportunityTitle.trim()) {
      showToast(
        'Validation Required',
        'Please enter or parse a Target Company and Job Title before creating the requisition.',
        'fa-solid fa-triangle-exclamation text-amber-500'
      );
      return;
    }

    setIsSaving(true);
    const resolvedLocation =
      extractedReq.location.trim() || extractedReq.workModel;
    const formattedLocation = resolvedLocation.toLowerCase().includes(extractedReq.workModel.toLowerCase())
      ? resolvedLocation
      : `${resolvedLocation} (${extractedReq.workModel})`;

    const newReq: Requirement = {
      id: 'req_' + Date.now(),
      code: 'REQ-' + Math.floor(1004 + Math.random() * 50),
      companyName: extractedReq.companyName.trim(),
      opportunityTitle: extractedReq.opportunityTitle.trim(),
      location: formattedLocation,
      clientContact: extractedReq.clientContact.trim(),
      clientContactTitle: extractedReq.clientContactTitle.trim(),
      skillsRequired: extractedReq.skillsRequired.trim(),
      status: extractedReq.initialStage,
      assignedRecruiter: extractedReq.assignedRecruiter.trim(),
      targetBillRate: Number(extractedReq.targetBillRate) || 115,
      targetPayRate: Number(extractedReq.targetPayRate) || 85,
    };

    try {
      const res = await apiClient.post('/requirements', {
        companyName: newReq.companyName,
        opportunityTitle: newReq.opportunityTitle,
        location: newReq.location,
        workModel: extractedReq.workModel.toUpperCase(),
        skillsRequired: newReq.skillsRequired,
        clientContact: newReq.clientContact,
        clientContactTitle: newReq.clientContactTitle,
        clientContactEmail: extractedReq.clientContactEmail.trim(),
        assignedRecruiter: newReq.assignedRecruiter,
        targetBillRate: newReq.targetBillRate,
        targetPayRate: newReq.targetPayRate,
        status: newReq.status,
        rawEmailText,
        missingNotes: extractedReq.missingNotes,
      });
      if (res.data?.data) {
        newReq.id = res.data.data.id || newReq.id;
        newReq.code = res.data.data.code || newReq.code;
      }
      onApprove(newReq);
      handleClearAll();
      onClose();
      showToast(
        'Requirement Created',
        `${newReq.code} (${newReq.opportunityTitle}) saved to pipeline!`,
        'fa-solid fa-circle-check text-emerald-500'
      );
    } catch (err: any) {
      showToast(
        'Save Failed',
        err.response?.data?.message || err.message || 'Could not save requisition to database.',
        'fa-solid fa-triangle-exclamation text-rose-500'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl max-w-5xl w-full border border-slate-200 card-shadow overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-[#0B0F17] text-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <i className="fa-solid fa-envelope-open-text text-sm"></i>
            </div>
            <div>
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <span>Client Email Job Order Intake Parser</span>
                <span className="text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  Auto-Extract &amp; Create
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Paste any client email or try a 1-click sample — auto-extracts company, hiring lead, skills, work model &amp; rates.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 cursor-pointer">
            <i className="fa-solid fa-xmark text-sm"></i>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left: Raw Email Snippet */}
            <div className="lg:col-span-5 flex flex-col space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  1. Paste Raw Client Email
                </label>
                <div className="flex items-center gap-2">
                  {(rawEmailText || extractedReq.companyName) && (
                    <button
                      type="button"
                      onClick={handleClearAll}
                      className="text-[11px] font-semibold text-slate-400 hover:text-rose-600 cursor-pointer"
                    >
                      <i className="fa-solid fa-eraser mr-1"></i>Clear
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => parseEmailText(rawEmailText)}
                    disabled={isParsing}
                    className="px-3 py-1 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-md text-[11px] font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                  >
                    <i className={`fa-solid ${isParsing ? 'fa-spinner fa-spin' : 'fa-brain'} text-[10px]`}></i>
                    <span>{isParsing ? 'Extracting...' : 'Parse Email (FastAPI NLP)'}</span>
                  </button>
                </div>
              </div>
              <textarea
                rows={15}
                value={rawEmailText}
                onChange={(e) => setRawEmailText(e.target.value)}
                onPaste={(e) => {
                  const pasted = e.clipboardData?.getData('text');
                  if (pasted && pasted.trim().length > 20) {
                    setTimeout(() => parseEmailText(pasted), 50);
                  }
                }}
                placeholder="Paste any hiring manager email here — parsing runs automatically on paste..."
                className="w-full flex-1 p-3.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 leading-relaxed focus:bg-white focus:border-brand-600 focus:outline-none"
              ></textarea>
              <div className="text-[10px] text-slate-400 flex items-center gap-1">
                <i className="fa-solid fa-circle-info"></i>
                <span>Tip: Pasting an email automatically triggers extraction.</span>
              </div>
            </div>

            {/* Right: Complete Extracted Requirement Form */}
            <div className="lg:col-span-7 bg-slate-50/70 p-4 rounded-xl border border-slate-200 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <i className="fa-solid fa-circle-check text-emerald-500"></i>
                  <span>2. Review &amp; Complete Extracted Fields</span>
                </div>
                {marginSpread > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
                    Est. Spread: +${marginSpread}/hr
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Target Company *</label>
                  <input
                    type="text"
                    list="email-parser-clients"
                    value={extractedReq.companyName}
                    onChange={(e) => setExtractedReq({ ...extractedReq, companyName: e.target.value })}
                    placeholder="Select or type client company..."
                    className="mt-0.5 w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 font-bold focus:border-brand-600 focus:outline-none"
                  />
                  <datalist id="email-parser-clients">
                    {clients.map((c) => (
                      <option key={c.id} value={c.name} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Job / Opportunity Title *</label>
                  <input
                    type="text"
                    value={extractedReq.opportunityTitle}
                    onChange={(e) => setExtractedReq({ ...extractedReq, opportunityTitle: e.target.value })}
                    placeholder="e.g. Senior Java Architect"
                    className="mt-0.5 w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 font-semibold focus:border-brand-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Client Contact Name</label>
                  <input
                    type="text"
                    value={extractedReq.clientContact}
                    onChange={(e) => setExtractedReq({ ...extractedReq, clientContact: e.target.value })}
                    placeholder="e.g. Rachel Adams"
                    className="mt-0.5 w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:border-brand-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Contact Title / Designation</label>
                  <input
                    type="text"
                    value={extractedReq.clientContactTitle}
                    onChange={(e) => setExtractedReq({ ...extractedReq, clientContactTitle: e.target.value })}
                    placeholder="e.g. VP of Engineering"
                    className="mt-0.5 w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:border-brand-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Location</label>
                  <input
                    type="text"
                    value={extractedReq.location}
                    onChange={(e) => setExtractedReq({ ...extractedReq, location: e.target.value })}
                    placeholder="e.g. Austin, TX or Remote"
                    className="mt-0.5 w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:border-brand-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Work Model</label>
                  <div className="mt-0.5 grid grid-cols-3 gap-1.5">
                    {(['Remote', 'Hybrid', 'Onsite'] as const).map((wm) => (
                      <button
                        type="button"
                        key={wm}
                        onClick={() => setExtractedReq({ ...extractedReq, workModel: wm })}
                        className={`py-1.5 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                          extractedReq.workModel === wm
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {wm}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Bill Rate ($/hr)</label>
                  <input
                    type="number"
                    min={0}
                    value={extractedReq.targetBillRate || ''}
                    onChange={(e) => {
                      const bill = Number(e.target.value) || 0;
                      setExtractedReq((prev) => ({
                        ...prev,
                        targetBillRate: bill,
                        targetPayRate: prev.targetPayRate || (bill > 0 ? Math.round(bill * 0.75) : 0),
                      }));
                    }}
                    placeholder="120"
                    className="mt-0.5 w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:border-brand-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Pay Rate ($/hr)</label>
                  <input
                    type="number"
                    min={0}
                    value={extractedReq.targetPayRate || ''}
                    onChange={(e) => setExtractedReq({ ...extractedReq, targetPayRate: Number(e.target.value) || 0 })}
                    placeholder="90"
                    className="mt-0.5 w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:border-brand-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Assigned Recruiter</label>
                  <input
                    type="text"
                    list="email-parser-recruiters"
                    value={extractedReq.assignedRecruiter}
                    onChange={(e) => setExtractedReq({ ...extractedReq, assignedRecruiter: e.target.value })}
                    placeholder="Desk Owner"
                    className="mt-0.5 w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:border-brand-600 focus:outline-none"
                  />
                  <datalist id="email-parser-recruiters">
                    {users.map((u) => (
                      <option key={u.id} value={u.name} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Initial Stage</label>
                  <select
                    value={extractedReq.initialStage}
                    onChange={(e) => setExtractedReq({ ...extractedReq, initialStage: e.target.value as any })}
                    className="mt-0.5 w-full px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:border-brand-600 focus:outline-none cursor-pointer"
                  >
                    <option value="Requirement">Requirement</option>
                    <option value="Submitted">Submitted</option>
                    <option value="Interview">Interview</option>
                  </select>
                </div>
              </div>

              {/* Required Skillset with Interactive Chips */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Required Skillset</label>
                {skillTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1 mb-1.5">
                    {skillTags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-semibold"
                      >
                        <span>{tag}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveSkillTag(tag)}
                          className="text-blue-400 hover:text-rose-600 cursor-pointer"
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        handleAddSkillTag(skillInput);
                      }
                    }}
                    placeholder="Type skill & press Enter (or edit comma list below)..."
                    className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:border-brand-600 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddSkillTag(skillInput)}
                    className="px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-700 cursor-pointer"
                  >
                    + Add
                  </button>
                </div>
                <input
                  type="text"
                  value={extractedReq.skillsRequired}
                  onChange={(e) => setExtractedReq({ ...extractedReq, skillsRequired: e.target.value })}
                  placeholder="Java, Spring Boot, Kafka, AWS..."
                  className="mt-1.5 w-full px-2.5 py-1 text-[11px] bg-white/80 border border-slate-200 rounded-lg text-slate-600 focus:border-brand-600 focus:outline-none"
                />
              </div>

              {/* Missing Info / AI Extraction Notes */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">AI Extraction Notes / Missing Info</label>
                <input
                  type="text"
                  value={extractedReq.missingNotes}
                  onChange={(e) => setExtractedReq({ ...extractedReq, missingNotes: e.target.value })}
                  placeholder="Missing follow-up notes or client SLA instructions..."
                  className="mt-0.5 w-full px-2.5 py-1.5 text-xs bg-amber-50/50 border border-amber-200/80 rounded-lg text-slate-700 focus:bg-white focus:border-amber-400 focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="text-[11px] text-slate-500">
            Initial Stage:{' '}
            <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              {extractedReq.initialStage}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApprove}
              disabled={isSaving}
              className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg shadow-sm shadow-blue-600/20 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <i className={`fa-solid ${isSaving ? 'fa-spinner fa-spin' : 'fa-plus'} text-xs`}></i>
              <span>{isSaving ? 'Creating Requisition...' : 'Approve & Create Requisition'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
