import React, { useState, useEffect } from 'react';
import { Briefcase, Plus } from 'lucide-react';
import { Requirement, Client, User } from '../../../types';
import { DynamicCustomFieldsSection, useMasterTaxonomies } from '../../shared/DynamicCustomFieldsSection';
import { formatRateDisplay, parseRateNumber, useCurrency } from '../../../utils/currency';
import { buildClientSafeSummaryHtml } from '../../../utils/richText';
import { SearchableSelectInput } from '../../shared/SearchableSelectInput';
import { CustomSelect } from '../../shared/CustomSelect';
import { RoleSummaryField } from '../../shared/RichTextEditor';
import { ActionButton } from '../../shared/ActionButton';
import { AnimatedModal, ModalHeader } from '../../shared/MotionPrimitives';
import {
  formatMissingFieldsMessage,
  getMissingFieldLabels,
  INVALID_FIELD_CLASSES,
} from '../../../utils/formValidation';

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
    publicDescription: '',
    remarks: '',
  });
  const [form, setForm] = useState(getInitialForm);
  const [validationAttempted, setValidationAttempted] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForm(getInitialForm());
      setCustomValues({});
      setIsSaving(false);
      setValidationAttempted(false);
    }
  }, [currencySymbol, isOpen]);

  const openPosStr = String(form.openPositions || '').trim();
  const openPosNum = Number(openPosStr);
  const isOpenPosValid =
    Boolean(openPosStr) &&
    /^\d+$/.test(openPosStr) &&
    Number.isInteger(openPosNum) &&
    openPosNum >= 1 &&
    openPosNum <= 1000;
  const isTitleInvalid = validationAttempted && !form.opportunityTitle.trim();
  const isCompanyInvalid = validationAttempted && !form.companyName.trim();
  const isOpenPosInvalid = validationAttempted && !isOpenPosValid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const missingFields = getMissingFieldLabels([
      { label: 'Role Title', valid: Boolean(form.opportunityTitle.trim()) },
      { label: 'Client Company', valid: Boolean(form.companyName.trim()) },
      { label: 'Open Positions (at least 1)', valid: isOpenPosValid },
    ]);
    if (missingFields.length > 0) {
      setValidationAttempted(true);
      showToast('Validation Error', formatMissingFieldsMessage(missingFields), 'warning');
      return;
    }

    const nextCode = `REQ-${1040 + Math.floor(Math.random() * 50)}`;
    const billRateNum = parseRateNumber(form.targetRate, 115) || 115;

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
      publicDescription: form.publicDescription.trim() || null,
      customFields: customValues,
    };

    setIsSaving(true);
    try {
      await onSave(newReq);
      setForm(getInitialForm());
      setCustomValues({});
      showToast('Requirement Created', `${newReq.opportunityTitle} (${openPosNum} open ${openPosNum === 1 ? 'position' : 'positions'}) added to pipeline!`, 'success-brand');
      onClose();
    } catch (err: any) {
      showToast(
        'Save Failed',
        err?.response?.data?.message || err?.message || 'Could not create requirement.',
        'error'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatedModal
      isOpen={isOpen}
      onBackdropClick={onClose}
      zIndexClass="z-50"
      backdropClassName="bg-slate-900/60 backdrop-blur-[2px] flex items-center justify-center p-4 select-none"
      panelClassName="bg-white rounded-xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
      ariaLabel="Create New Job Requirement"
    >
        <ModalHeader
          icon={<Briefcase className="w-4 h-4" />}
          title="Create New Job Requirement"
          subtitle="Add a new job opening with client details, rates, location, and required skills."
          onClose={onClose}
          closeDisabled={isSaving}
        />

        {/* Modal Body Form */}
        <form noValidate onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 overflow-y-auto space-y-4 text-xs flex-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-slate-700">Requirement / Role Title *</label>
                  {isTitleInvalid && <span className="text-[11px] font-semibold text-rose-600">Required</span>}
                </div>
                <input
                  value={form.opportunityTitle}
                  onChange={(e) => setForm({ ...form, opportunityTitle: e.target.value })}
                  placeholder="e.g. Lead AWS Cloud Architect"
                  className={`w-full px-3 py-1.5 border rounded-lg text-xs font-medium focus:outline-none ${
                    isTitleInvalid ? INVALID_FIELD_CLASSES : 'border-slate-200 bg-white focus:border-brand-600'
                  }`}
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-slate-700">Client Company *</label>
                  {isCompanyInvalid && <span className="text-[11px] font-semibold text-rose-600">Required</span>}
                </div>
                <SearchableSelectInput
                  value={form.companyName}
                  onChange={(val) => {
                    const selClient = clients.find(
                      (c) =>
                        c.name.replace(/\s+Location:\s*.*$/i, '').trim().toLowerCase() ===
                        val.trim().toLowerCase()
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
                  wrapperClassName=""
                  inputClassName={`w-full pl-3 pr-7 py-1.5 border rounded-lg text-xs font-medium focus:outline-none ${
                    isCompanyInvalid ? INVALID_FIELD_CLASSES : 'border-slate-200 bg-white focus:border-brand-600'
                  }`}
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
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-slate-700">No. of Open Positions *</label>
                  {isOpenPosInvalid && <span className="text-[11px] font-semibold text-rose-600">Required</span>}
                </div>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  step={1}
                  value={form.openPositions}
                  onChange={(e) => setForm({ ...form, openPositions: e.target.value })}
                  placeholder="e.g. 2"
                  className={`w-full px-3 py-1.5 border rounded-lg text-xs font-medium focus:outline-none ${
                    isOpenPosInvalid ? INVALID_FIELD_CLASSES : 'border-slate-200 bg-white focus:border-brand-600'
                  }`}
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

            <RoleSummaryField
              labelClassName="block font-semibold text-slate-700"
              value={form.publicDescription}
              onChange={(nextHtml) => setForm((prev) => ({ ...prev, publicDescription: nextHtml }))}
              onAutoFill={() =>
                setForm((prev) => ({
                  ...prev,
                  publicDescription: buildClientSafeSummaryHtml({
                    opportunityTitle: prev.opportunityTitle || 'Technical Specialist',
                    openPositions: Number(prev.openPositions) || 1,
                    workModel: prev.location.toLowerCase().includes('hybrid')
                      ? 'Hybrid'
                      : prev.location.toLowerCase().includes('onsite')
                      ? 'Onsite'
                      : 'Remote',
                    location: prev.location,
                    skillsRequired: prev.skillsRequired,
                    companyName: prev.companyName,
                    rawEmailText: prev.remarks,
                  }),
                }))
              }
              minHeight={105}
              maxHeight={240}
              placeholder="Write a client-safe role scope, responsibilities checklist, and engagement overview..."
            />

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Internal Job Spec Notes &amp; Remarks</label>
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
          <div className="px-6 py-3.5 bg-slate-50/60 border-t border-slate-100 flex items-center justify-between text-xs shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="h-8 px-3.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-[11px] font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <ActionButton
              type="submit"
              loading={isSaving}
              loadingText="Creating..."
              icon={<Plus className="w-3.5 h-3.5" strokeWidth={1.75} />}
              className="h-8 px-4 rounded-lg bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white text-[11px] font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              Create Requirement &amp; Add to Pipeline
            </ActionButton>
          </div>
        </form>
    </AnimatedModal>
  );
};

