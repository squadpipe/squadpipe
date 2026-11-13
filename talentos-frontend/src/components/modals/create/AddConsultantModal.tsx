import React, { useState, useEffect } from 'react';
import { Plus, UserPlus, X } from 'lucide-react';
import { Candidate, User } from '../../../types';
import { DynamicCustomFieldsSection, useMasterTaxonomies } from '../../shared/DynamicCustomFieldsSection';
import { useCurrency } from '../../../utils/currency';

interface AddConsultantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (candidate: Candidate) => void;
  users?: User[];
  showToast: (title: string, message: string, icon?: string) => void;
}

export const AddConsultantModal: React.FC<AddConsultantModalProps> = ({
  isOpen,
  onClose,
  onSave,
  users = [],
  showToast,
}) => {
  const { symbol: currencySymbol } = useCurrency();
  const taxonomies = useMasterTaxonomies(isOpen);
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
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
  });
  const [form, setForm] = useState(getInitialForm);

  useEffect(() => {
    if (isOpen) {
      setForm(getInitialForm());
      setCustomValues({});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName.trim() || !form.email.trim()) {
      showToast('Validation Error', 'Full Name and Email Address are required.', 'fa-solid fa-triangle-exclamation text-amber-500');
      return;
    }

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
      resumeName: `${form.fullName.trim().replace(/\s+/g, '_')}_Resume.pdf`,
      resumeFormat: 'PDF',
      customFields: customValues,
    };

    onSave(newCandidate);
    setForm(getInitialForm());
    setCustomValues({});
    showToast('Consultant Added', `${newCandidate.fullName} registered to talent roster!`, 'fa-solid fa-circle-check text-emerald-500');
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col animate-fade-in max-h-[92vh]"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white">
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
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 overflow-y-auto space-y-4 text-xs flex-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Name *</label>
                <input
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  placeholder="e.g. Tarun Sengupta"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs font-medium focus:border-brand-600 focus:outline-none"
                  required
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
                <select
                  value={form.workAuth}
                  onChange={(e) => setForm({ ...form, workAuth: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs font-medium focus:border-brand-600"
                >
                  {taxonomies.workAuth.map((wa) => (
                    <option key={wa} value={wa}>
                      {wa}
                    </option>
                  ))}
                </select>
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
                <label className="block font-semibold text-slate-700 mb-1">Email Address *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="e.g. tarun.dev@gmail.com"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs font-medium focus:border-brand-600 focus:outline-none"
                  required
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
                <select
                  value={form.relocation}
                  onChange={(e) => setForm({ ...form, relocation: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs font-medium focus:border-brand-600"
                >
                  <option value="Yes">Yes (Open Anywhere in US)</option>
                  <option value="No">No (Local Only)</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Highest Education Degree</label>
                <select
                  value={form.education}
                  onChange={(e) => setForm({ ...form, education: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs font-medium focus:border-brand-600"
                >
                  <option value="">Select degree...</option>
                  {taxonomies.education.map((edu) => (
                    <option key={edu} value={edu}>
                      {edu}
                    </option>
                  ))}
                </select>
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Assigned Desk Recruiter</label>
                <select
                  value={form.recruiter}
                  onChange={(e) => setForm({ ...form, recruiter: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs font-medium focus:border-brand-600"
                >
                  <option value="">Recruitment Desk</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.name}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Initial Pipeline Status</label>
                <select
                  value={form.pipelineStage}
                  onChange={(e) => setForm({ ...form, pipelineStage: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs font-medium focus:border-brand-600"
                >
                  <option value="Available / Bench">Available / Bench</option>
                  <option value="Submitted">Submitted to Client</option>
                  <option value="Interview">Interview Scheduled</option>
                </select>
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
              className="px-5 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={2.4} />
              <span>Save & Add Consultant to Roster</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

