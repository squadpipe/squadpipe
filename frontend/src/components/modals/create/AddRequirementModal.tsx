import React, { useState, useEffect } from 'react';
import { Briefcase, Plus, X } from 'lucide-react';
import { Requirement, Client, User } from '../../../types';
import { DynamicCustomFieldsSection, useMasterTaxonomies } from '../../shared/DynamicCustomFieldsSection';
import { formatRateDisplay, useCurrency } from '../../../utils/currency';
import { SearchableSelectInput } from '../../shared/SearchableSelectInput';
import { CustomSelect } from '../../shared/CustomSelect';
import { ActionButton } from '../../shared/ActionButton';

interface AddRequirementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (req: Requirement) => Promise<void> | void;
  clients: Client[];
  users?: User[];
  showToast: (title: string, message: string, icon?: string) => void;
}

export const AddRequirementModal: React.FC<AddRequirementModalProps> = ({
  isOpen,
  onClose,
  onSave,
  clients,
  users = [],
  showToast,
}) => {
  const { symbol: currencySymbol } = useCurrency();
  const taxonomies = useMasterTaxonomies(isOpen);
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const getInitialForm = () => ({
    opportunityTitle: '',
    openPositions: '1' as string,
    companyName: clients[0]?.name || '',
    clientContact: clients[0]?.contacts[0]?.name || '',
    clientContactTitle: clients[0]?.contacts[0]?.designation || '',
    location: 'Remote',
    targetRate: `${currencySymbol}115/hr`,
    skillsRequired: '',
    assignedRecruiter: users[0]?.name || '',
    status: 'Requirement' as Requirement['status'],
    remarks: '',
  });
  const [form, setForm] = useState(getInitialForm);

  useEffect(() => {
    if (isOpen) {
      setForm(getInitialForm());
      setCustomValues({});
      setIsSaving(false);
    }
  }, [currencySymbol, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.opportunityTitle.trim() || !form.companyName.trim()) {
      showToast('Validation Error', 'Role Title and Client Company are required.', 'fa-solid fa-triangle-exclamation text-amber-500');
      return;
    }

    const openPosStr = String(form.openPositions || '').trim();
    const openPosNum = Number(openPosStr);
    if (!openPosStr || !/^\d+$/.test(openPosStr) || !Number.isInteger(openPosNum) || openPosNum < 1 || openPosNum > 1000) {
      showToast('Required Field', 'Please enter at least 1 open position.', 'fa-solid fa-triangle-exclamation text-amber-500');
      return;
    }

    const nextCode = `REQ-${1040 + Math.floor(Math.random() * 50)}`;
    const billRateNum = parseInt(form.targetRate.replace(/\D/g, ''), 10) || 115;

    const newReq: Requirement = {
      id: 'req_' + Date.now(),
      code: nextCode,
      opportunityTitle: form.opportunityTitle.trim(),
      openPositions: openPosNum,
      companyName: form.companyName.trim(),
      clientContact: form.clientContact.trim() || 'Primary Hiring Lead',
      clientContactTitle: form.clientContactTitle.trim() || 'Engineering Director',
      location: form.location.trim() || 'Remote',
      targetBillRate: billRateNum,
      targetPayRate: Math.round(billRateNum * 0.75),
      skillsRequired: form.skillsRequired.trim() || 'Java, Cloud, Microservices',
      assignedRecruiter: form.assignedRecruiter,
      status: form.status,
      customFields: customValues,
    };

    setIsSaving(true);
    try {
      await onSave(newReq);
      setForm(getInitialForm());
      setCustomValues({});
      showToast('Requirement Created', `${newReq.opportunityTitle} (${openPosNum} open ${openPosNum === 1 ? 'position' : 'positions'}) added to pipeline!`, 'fa-solid fa-circle-check text-brand-600');
      onClose();
    } catch (err: any) {
      showToast(
        'Save Failed',
        err?.response?.data?.message || err?.message || 'Could not create requirement.',
        'fa-solid fa-triangle-exclamation text-rose-500'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden flex flex-col animate-fade-in max-h-[92vh]"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-[#141615] text-white">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white flex-shrink-0">
              <Briefcase className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">
                Create New Job Requirement
              </h2>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Intake new client requisition, bill rate, location, and required technical skills.
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
                <label className="block font-semibold text-slate-700 mb-1">Requirement / Role Title *</label>
                <input
                  value={form.opportunityTitle}
                  onChange={(e) => setForm({ ...form, opportunityTitle: e.target.value })}
                  placeholder="e.g. Lead AWS Cloud Architect"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs font-medium focus:border-brand-600 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Client Company *</label>
                <SearchableSelectInput
                  value={form.companyName}
                  onChange={(val) => {
                    const selClient = clients.find(
                      (c) => c.name.trim().toLowerCase() === val.trim().toLowerCase()
                    );
                    setForm({
                      ...form,
                      companyName: val,
                      clientContact: selClient?.contacts[0]?.name || form.clientContact,
                      clientContactTitle: selClient?.contacts[0]?.designation || form.clientContactTitle,
                    });
                  }}
                  options={clients.map((c) => ({
                    id: c.id,
                    label: c.name.replace(/\s+Location:\s*.*$/i, '').trim(),
                    sublabel: c.location,
                  }))}
                  placeholder="Select or type client company name..."
                  required
                  wrapperClassName=""
                  inputClassName="w-full pl-3 pr-7 py-1.5 border border-slate-200 rounded-lg bg-white text-xs font-medium focus:border-brand-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Client Contact Person *</label>
                <input
                  value={form.clientContact}
                  onChange={(e) => setForm({ ...form, clientContact: e.target.value })}
                  placeholder="e.g. Robert Vance"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs font-medium focus:border-brand-600 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Client Contact Designation</label>
                <input
                  value={form.clientContactTitle}
                  onChange={(e) => setForm({ ...form, clientContactTitle: e.target.value })}
                  placeholder="e.g. VP Global Infrastructure"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs focus:border-brand-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">No. of Open Positions *</label>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  step={1}
                  value={form.openPositions}
                  onChange={(e) => setForm({ ...form, openPositions: e.target.value })}
                  placeholder="e.g. 2"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs font-medium focus:border-brand-600 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Work Location & Mode *</label>
                <input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="e.g. New York, NY (Hybrid 3 Days)"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs focus:border-brand-600 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Target Client Bill Rate *</label>
                <input
                  value={form.targetRate}
                  onChange={(e) => setForm({ ...form, targetRate: e.target.value })}
                  placeholder={`e.g. ${currencySymbol}115/hr`}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs focus:border-brand-600 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Key Required Technical Skills *</label>
              <input
                value={form.skillsRequired}
                onChange={(e) => setForm({ ...form, skillsRequired: e.target.value })}
                placeholder="e.g. AWS, Terraform, Kubernetes, Python, Helm"
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs text-[11px] focus:border-brand-600 focus:outline-none"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Assigned Recruiter</label>
                <CustomSelect
                  value={form.assignedRecruiter}
                  onChange={(val) => setForm({ ...form, assignedRecruiter: val })}
                  ariaLabel="Assigned Recruiter"
                  size="sm"
                  options={[
                    { value: '', label: 'Unassigned / Desk Queue' },
                    ...users.map((u) => ({ value: u.name, label: u.name })),
                  ]}
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Initial Pipeline Stage</label>
                <CustomSelect
                  value={form.status}
                  onChange={(val) => setForm({ ...form, status: val as Requirement['status'] })}
                  ariaLabel="Initial Pipeline Stage"
                  size="sm"
                  options={taxonomies.stages}
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Job Spec Notes & Remarks</label>
              <textarea
                value={form.remarks}
                onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                rows={2}
                placeholder="e.g. Direct client requisition via master agreement. Requires immediate interview coordination."
                className="w-full p-2.5 border border-slate-200 rounded-lg bg-white text-xs focus:border-brand-600 focus:outline-none"
              ></textarea>
            </div>

            <DynamicCustomFieldsSection
              entity="requirement"
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
            <ActionButton
              type="submit"
              loading={isSaving}
              loadingText="Creating..."
              icon={<Plus className="w-3.5 h-3.5" strokeWidth={2.4} />}
              className="px-5 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              Create Requirement & Add to Pipeline
            </ActionButton>
          </div>
        </form>
      </div>
    </div>
  );
};

