import React, { useState, useEffect, useRef } from 'react';
import {
  Check,
  CheckCircle2,
  Eraser,
  Info,
  Loader2,
  MailOpen,
  Plus,
  X,
} from 'lucide-react';
import { apiClient } from '../../config/api.config';
import { Requirement, Client, User } from '../../types';
import { useCurrency } from '../../utils/currency';
import { mapRequirementFromApi } from '../../utils/entityMappers';
import { SearchableSelectInput } from '../../components/shared/SearchableSelectInput';
import { MULTI_INDUSTRY_SKILLS_TAXONOMY } from '../../utils/skillsTaxonomy';

const cleanField = (val?: any) =>
  String(val || '')
    .replace(/\*+/g, '')
    .replace(/[_`~]+/g, '')
    .replace(/^[\s:•\-–—]+|[\s*]+$/g, '')
    .trim();

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
  openPositions: '1' as string,
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
  const { symbol: currencySymbol } = useCurrency();
  const [isParsing, setIsParsing] = useState(false);
  const [hasParsed, setHasParsed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [rawEmailText, setRawEmailText] = useState<string>('');
  const [skillInput, setSkillInput] = useState<string>('');
  const [showSkillSuggestions, setShowSkillSuggestions] = useState(false);
  const [highlightedSkillIdx, setHighlightedSkillIdx] = useState<number>(-1);
  const [extractedReq, setExtractedReq] = useState(EMPTY_FORM);
  const lastParsedTextRef = useRef<string>('');

  const parseEmailText = async (textToParse: string) => {
    const cleanInput = textToParse.trim();
    if (!cleanInput) {
      return;
    }
    if (cleanInput === lastParsedTextRef.current) return;
    lastParsedTextRef.current = cleanInput;
    setIsParsing(true);
    try {
      const res = await apiClient.post('/parse-email', { rawEmailText: cleanInput });
      const d = res.data?.data?.data || res.data?.data;
      if (d) {
        const parsedSkills = cleanField(d.skillsRequired || (Array.isArray(d.skills) ? d.skills.join(', ') : d.skills));
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
          companyName: cleanField(d.companyName || d.clientName) || prev.companyName,
          opportunityTitle: cleanField(d.opportunityTitle || d.jobTitle) || prev.opportunityTitle,
          openPositions: d.openPositions ? String(d.openPositions) : prev.openPositions || '1',
          location: cleanField(d.location) || prev.location || 'Remote',
          workModel: detectedWorkModel,
          clientContact: cleanField(d.clientContact || d.contactName) || prev.clientContact,
          clientContactTitle: cleanField(d.clientContactTitle || d.contactTitle) || prev.clientContactTitle,
          clientContactEmail: cleanField(d.clientContactEmail) || prev.clientContactEmail,
          skillsRequired: parsedSkills || prev.skillsRequired,
          assignedRecruiter: cleanField(d.assignedRecruiter) || prev.assignedRecruiter || users[0]?.name || '',
          targetBillRate: parsedBillRate || prev.targetBillRate,
          targetPayRate: parsedPayRate || prev.targetPayRate,
          missingNotes: Array.isArray(d.missingFields)
            ? d.missingFields.join(', ')
            : cleanField(d.missingNotes) || 'Extraction complete.',
        }));
        setHasParsed(true);
      }
    } catch (err: any) {
      showToast('Parse Failed', err.response?.data?.message || err.message || 'Could not parse email right now.', 'fa-solid fa-triangle-exclamation text-rose-500');
    } finally {
      setIsParsing(false);
    }
  };

  useEffect(() => {
    setRawEmailText('');
    setSkillInput('');
    setHasParsed(false);
    setIsParsing(false);
    lastParsedTextRef.current = '';
    setExtractedReq(EMPTY_FORM);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const trimmed = rawEmailText.trim();
    if (trimmed.length <= 20) {
      setHasParsed(false);
      return;
    }
    const timer = setTimeout(() => {
      parseEmailText(trimmed);
    }, 350);
    return () => clearTimeout(timer);
  }, [rawEmailText, isOpen]);

  const handleClearAll = () => {
    setRawEmailText('');
    setSkillInput('');
    setHasParsed(false);
    setIsParsing(false);
    lastParsedTextRef.current = '';
    setExtractedReq(EMPTY_FORM);
  };

  const handleClose = () => {
    handleClearAll();
    onClose();
  };

  const skillTags = extractedReq.skillsRequired
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const selectedSkillSet = new Set(skillTags.map((t) => t.toLowerCase()));
  const skillQuery = skillInput.trim().toLowerCase();
  const skillSuggestions = React.useMemo(() => {
    const available = MULTI_INDUSTRY_SKILLS_TAXONOMY.filter(
      (s) => !selectedSkillSet.has(s.toLowerCase())
    );
    if (!skillQuery) return available.slice(0, 12);
    const startsWith: string[] = [];
    const contains: string[] = [];
    for (const s of available) {
      const lower = s.toLowerCase();
      if (lower.startsWith(skillQuery)) startsWith.push(s);
      else if (lower.includes(skillQuery)) contains.push(s);
    }
    return [...startsWith, ...contains].slice(0, 12);
  }, [skillQuery, extractedReq.skillsRequired]);

  if (!isOpen) return null;

  const mergeSkillTags = (existingCsv: string, rawToAdd: string): string => {
    const existing = existingCsv
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const additions = rawToAdd
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (additions.length === 0) return existing.join(', ');
    const seen = new Set(existing.map((t) => t.toLowerCase()));
    const merged = [...existing];
    for (const item of additions) {
      if (!seen.has(item.toLowerCase())) {
        seen.add(item.toLowerCase());
        merged.push(item);
      }
    }
    return merged.join(', ');
  };

  const handleAddSkillTag = (raw: string) => {
    if (!raw.trim()) return;
    setExtractedReq((prev) => ({
      ...prev,
      skillsRequired: mergeSkillTags(prev.skillsRequired, raw),
    }));
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

    const openPosStr = String(extractedReq.openPositions || '').trim();
    const openPosNum = Number(openPosStr);
    if (!openPosStr || !/^\d+$/.test(openPosStr) || !Number.isInteger(openPosNum) || openPosNum < 1 || openPosNum > 1000) {
      showToast(
        'Open Positions Required',
        'Please enter at least 1 open position.',
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

    const finalSkillsRequired = mergeSkillTags(extractedReq.skillsRequired, skillInput);

    let newReq: Requirement = {
      id: 'req_' + Date.now(),
      code: 'REQ-' + Math.floor(1004 + Math.random() * 50),
      companyName: extractedReq.companyName.trim(),
      opportunityTitle: extractedReq.opportunityTitle.trim(),
      openPositions: openPosNum,
      location: formattedLocation,
      clientContact: extractedReq.clientContact.trim(),
      clientContactTitle: extractedReq.clientContactTitle.trim(),
      skillsRequired: finalSkillsRequired,
      status: extractedReq.initialStage,
      assignedRecruiter: extractedReq.assignedRecruiter.trim(),
      targetBillRate: Number(extractedReq.targetBillRate) || 115,
      targetPayRate: Number(extractedReq.targetPayRate) || 85,
    };

    try {
      const res = await apiClient.post('/requirements', {
        companyName: newReq.companyName,
        opportunityTitle: newReq.opportunityTitle,
        openPositions: openPosNum,
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
        newReq = mapRequirementFromApi(res.data.data);
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
        err.response?.data?.message || 'Could not save requisition. Please try again.',
        'fa-solid fa-triangle-exclamation text-rose-500'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      onClick={handleClose}
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
              <MailOpen className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">
                <span>Client Email Job Order Intake Parser</span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Paste any client email — automatically extracts company, role, hiring lead, skills, work model &amp; rates.
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            aria-label="Close modal"
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 cursor-pointer"
          >
            <X className="w-4 h-4" />
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
                <div className="flex items-center gap-2.5">
                  {(rawEmailText || extractedReq.companyName) && (
                    <button
                      type="button"
                      onClick={handleClearAll}
                      className="text-[11px] font-semibold text-slate-400 hover:text-rose-600 cursor-pointer inline-flex items-center gap-1"
                    >
                      <Eraser className="w-3 h-3" />
                      <span>Clear</span>
                    </button>
                  )}
                  {isParsing ? (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-brand-600">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Extracting...</span>
                    </span>
                  ) : hasParsed ? (
                    <span
                      title="Email parsed"
                      className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600"
                    >
                      <Check className="w-3.5 h-3.5" strokeWidth={2.4} />
                    </span>
                  ) : null}
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
              <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Tip: Pasting an email automatically triggers extraction.</span>
              </div>
            </div>

            {/* Right: Complete Extracted Requirement Form */}
            <div className="lg:col-span-7 bg-slate-50/70 p-4 rounded-xl border border-slate-200 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>2. Review &amp; Complete Extracted Fields</span>
                </div>
                {marginSpread > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
                    Est. Spread: +{currencySymbol}{marginSpread}/hr
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Target Company *</label>
                    {extractedReq.companyName.trim() &&
                      !clients.some(
                        (c) =>
                          c.name.replace(/\s+Location:\s*.*$/i, '').trim().toLowerCase() ===
                          extractedReq.companyName.trim().toLowerCase()
                      ) && (
                        <span className="text-[9px] font-semibold text-brand-600 bg-brand-50 border border-brand-200 px-1.5 py-0.5 rounded">
                          New client (auto-saved)
                        </span>
                      )}
                  </div>
                  <SearchableSelectInput
                    value={extractedReq.companyName}
                    onChange={(val) => {
                      const selClient = clients.find(
                        (c) => c.name.trim().toLowerCase() === val.trim().toLowerCase()
                      );
                      setExtractedReq((prev) => ({
                        ...prev,
                        companyName: val,
                        clientContact:
                          prev.clientContact || selClient?.contacts?.[0]?.name || '',
                        clientContactTitle:
                          prev.clientContactTitle || selClient?.contacts?.[0]?.designation || '',
                        location:
                          (!prev.location || prev.location === 'Remote') && selClient?.location
                            ? selClient.location
                            : prev.location,
                      }));
                    }}
                    options={clients.map((c) => ({
                      id: c.id,
                      label: c.name.replace(/\s+Location:\s*.*$/i, '').trim(),
                      sublabel: c.location,
                    }))}
                    placeholder="Select or type client company..."
                    emptyLabel="No saved clients — type company name"
                    inputClassName="w-full pl-2.5 pr-7 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 font-bold focus:border-brand-600 focus:outline-none"
                  />
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

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">No. of Open Positions *</label>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    step={1}
                    required
                    value={extractedReq.openPositions}
                    onChange={(e) => setExtractedReq({ ...extractedReq, openPositions: e.target.value })}
                    placeholder="e.g. 2"
                    className={`mt-0.5 w-full px-2.5 py-1.5 text-xs bg-white border rounded-lg text-slate-800 font-semibold focus:border-brand-600 focus:outline-none ${
                      !extractedReq.openPositions ? 'border-amber-300 bg-amber-50/30' : 'border-slate-200'
                    }`}
                  />
                </div>
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
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Bill Rate ({currencySymbol}/hr)</label>
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
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Pay Rate ({currencySymbol}/hr)</label>
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
                  <SearchableSelectInput
                    value={extractedReq.assignedRecruiter}
                    onChange={(val) => setExtractedReq({ ...extractedReq, assignedRecruiter: val })}
                    options={users.map((u) => ({
                      id: u.id,
                      label: u.name,
                      sublabel: u.desk || u.role,
                    }))}
                    placeholder="Desk Owner"
                    emptyLabel="No recruiters found"
                    inputClassName="w-full pl-2.5 pr-7 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:border-brand-600 focus:outline-none"
                  />
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
                          aria-label={`Remove ${tag}`}
                          className="text-blue-400 hover:text-rose-600 cursor-pointer inline-flex items-center"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="relative flex gap-1.5">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={skillInput}
                      onFocus={() => setShowSkillSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowSkillSuggestions(false), 120)}
                      onChange={(e) => {
                        setSkillInput(e.target.value);
                        setShowSkillSuggestions(true);
                        setHighlightedSkillIdx(-1);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowDown' && skillSuggestions.length > 0) {
                          e.preventDefault();
                          setShowSkillSuggestions(true);
                          setHighlightedSkillIdx((prev) => (prev + 1) % skillSuggestions.length);
                        } else if (e.key === 'ArrowUp' && skillSuggestions.length > 0) {
                          e.preventDefault();
                          setHighlightedSkillIdx((prev) =>
                            prev <= 0 ? skillSuggestions.length - 1 : prev - 1
                          );
                        } else if (e.key === 'Escape') {
                          setShowSkillSuggestions(false);
                          setHighlightedSkillIdx(-1);
                        } else if (e.key === 'Enter' || e.key === ',') {
                          e.preventDefault();
                          if (
                            e.key === 'Enter' &&
                            showSkillSuggestions &&
                            highlightedSkillIdx >= 0 &&
                            skillSuggestions[highlightedSkillIdx]
                          ) {
                            handleAddSkillTag(skillSuggestions[highlightedSkillIdx]);
                            setHighlightedSkillIdx(-1);
                          } else {
                            handleAddSkillTag(skillInput);
                          }
                        }
                      }}
                      placeholder="Type skill & press Enter (or pick from suggestions)..."
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:border-brand-600 focus:outline-none"
                    />
                    {showSkillSuggestions && skillSuggestions.length > 0 && (
                      <div className="absolute left-0 right-0 mt-1 z-30 bg-white border border-slate-200 rounded-xl shadow-xl p-2 max-h-48 overflow-y-auto">
                        <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 px-1 pb-1.5">
                          Suggested Skills ({skillSuggestions.length})
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {skillSuggestions.map((suggestion, idx) => (
                            <button
                              key={suggestion}
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                handleAddSkillTag(suggestion);
                                setHighlightedSkillIdx(-1);
                              }}
                              className={`px-2 py-1 rounded-md text-[11px] font-medium border transition-colors cursor-pointer ${
                                idx === highlightedSkillIdx
                                  ? 'bg-brand-600 text-white border-brand-600'
                                  : 'bg-slate-50 hover:bg-brand-50 text-slate-700 hover:text-brand-700 border-slate-200 hover:border-brand-200'
                              }`}
                            >
                              + {suggestion}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
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
              onClick={handleClose}
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
              {isSaving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" strokeWidth={2.4} />
              )}
              <span>{isSaving ? 'Creating Requisition...' : 'Approve & Create Requisition'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
