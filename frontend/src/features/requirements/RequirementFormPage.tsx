import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Briefcase } from 'lucide-react';
import { Client, Requirement, User } from '../../types';
import { parseRateNumber, useCurrency } from '../../utils/currency';
import { buildClientSafeSummaryHtml } from '../../utils/richText';
import {
  formatMissingFieldsMessage,
  getMissingFieldLabels,
  INVALID_FIELD_CLASSES,
} from '../../utils/formValidation';
import {
  DynamicCustomFieldsSection,
  useMasterTaxonomies,
} from '../../components/shared/DynamicCustomFieldsSection';
import { SearchableSelectInput } from '../../components/shared/SearchableSelectInput';
import { CustomSelect } from '../../components/shared/CustomSelect';
import { SkillTagInput } from '../../components/shared/SkillTagInput';
import { RoleSummaryField } from '../../components/shared/RichTextEditor';
import { ActionButton } from '../../components/shared/ActionButton';
import { DetailBreadcrumb } from '../../components/shared/DetailPageShell';
import { PageHeader } from '../../components/shared/PageHeader';
import { FormField } from '../../components/shared/FormField';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { AiIcon, AiTag } from '../../components/shared/AiBrand';
import { buildRequirementStageOptions, getStageDotClass, getStageIndex } from '../../utils/stageStyles';
import { UnsavedChangesModal, useFormShortcuts } from '../../hooks/useFormShortcuts';

interface RequirementFormPageProps {
  mode: 'create' | 'edit';
  initialRequirement?: Requirement | null;
  clients: Client[];
  users?: User[];
  backLabel?: string;
  onBack: () => void;
  onSaveCreate?: (req: Requirement) => Promise<Requirement | void> | void;
  onSaveEdit?: (req: Requirement) => Promise<void> | void;
  onOpenFromEmail?: () => void;
  showToast: (title: string, message: string, icon?: string) => void;
}

const stripClientLocation = (name?: string) =>
  String(name || '')
    .replace(/\s+Location:\s*.*$/i, '')
    .trim();

/**
 * Dedicated full-page workflow for creating (/requirements/new) and editing (/requirements/:id/edit)
 * client requisitions with Cmd+S shortcuts and unsaved-changes guard.
 */
export const RequirementFormPage: React.FC<RequirementFormPageProps> = ({
  mode,
  initialRequirement = null,
  clients,
  users = [],
  backLabel = 'Back to Pipeline',
  onBack,
  onSaveCreate,
  onSaveEdit,
  onOpenFromEmail,
  showToast,
}) => {
  const isEdit = mode === 'edit';
  const { symbol: currencySymbol } = useCurrency();
  const taxonomies = useMasterTaxonomies(true);

  const buildInitialState = () => {
    if (isEdit && initialRequirement) {
      return {
        opportunityTitle: initialRequirement.opportunityTitle || '',
        openPositions: String(initialRequirement.openPositions || 1),
        companyName: initialRequirement.companyName || '',
        clientContact: initialRequirement.clientContact || '',
        clientContactTitle: initialRequirement.clientContactTitle || '',
        location: initialRequirement.location || 'Remote',
        workModel: initialRequirement.workModel || ('Remote' as 'Remote' | 'Hybrid' | 'Onsite'),
        targetBillRate: String(initialRequirement.targetBillRate || 115),
        targetPayRate: String(
          initialRequirement.targetPayRate ||
            Math.round((initialRequirement.targetBillRate || 115) * 0.75)
        ),
        skillsRequired: initialRequirement.skillsRequired || '',
        assignedRecruiter: initialRequirement.assignedRecruiter || '',
        status: initialRequirement.status || ('Requirement' as Requirement['status']),
        publicDescription: initialRequirement.publicDescription || '',
        rawEmailText: initialRequirement.rawEmailText || '',
      };
    }

    const defaultClient = clients[0];
    return {
      opportunityTitle: '',
      openPositions: '1',
      companyName: defaultClient?.name || '',
      clientContact: defaultClient?.contacts?.[0]?.name || '',
      clientContactTitle: defaultClient?.contacts?.[0]?.designation || '',
      location: 'Remote',
      workModel: 'Remote' as 'Remote' | 'Hybrid' | 'Onsite',
      targetBillRate: '115',
      targetPayRate: '86',
      skillsRequired: '',
      assignedRecruiter: users[0]?.name || '',
      status: 'Requirement' as Requirement['status'],
      publicDescription: '',
      rawEmailText: '',
    };
  };

  const [form, setForm] = useState(buildInitialState);
  const [customValues, setCustomValues] = useState<Record<string, string>>(
    () => (isEdit && initialRequirement?.customFields ? { ...initialRequirement.customFields } : {})
  );
  const [initialSnapshot, setInitialSnapshot] = useState(() =>
    JSON.stringify({ form: buildInitialState(), customValues: isEdit && initialRequirement?.customFields ? initialRequirement.customFields : {} })
  );
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isEdit && initialRequirement) {
      const next = buildInitialState();
      const nextCustom = initialRequirement.customFields ? { ...initialRequirement.customFields } : {};
      setForm(next);
      setCustomValues(nextCustom);
      setInitialSnapshot(JSON.stringify({ form: next, customValues: nextCustom }));
      setValidationAttempted(false);
    }
  }, [isEdit, initialRequirement?.id]);

  const isDirty = useMemo(
    () => JSON.stringify({ form, customValues }) !== initialSnapshot,
    [form, customValues, initialSnapshot]
  );

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

  const billRateNum = parseRateNumber(form.targetBillRate, 115) || 0;
  const payRateNum = parseRateNumber(form.targetPayRate, Math.round(billRateNum * 0.75)) || 0;
  const estSpread = billRateNum - payRateNum;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSaving) return;

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

    setIsSaving(true);
    try {
      if (isEdit && initialRequirement) {
        const updatedReq: Requirement = {
          ...initialRequirement,
          opportunityTitle: form.opportunityTitle.trim(),
          openPositions: openPosNum,
          companyName: form.companyName.trim(),
          clientContact: form.clientContact.trim() || initialRequirement.clientContact || 'Primary Hiring Lead',
          clientContactTitle: form.clientContactTitle.trim() || initialRequirement.clientContactTitle || '',
          location: form.location.trim() || 'Remote',
          workModel: form.workModel,
          targetBillRate: billRateNum || initialRequirement.targetBillRate || 115,
          targetPayRate:
            payRateNum || Math.round((billRateNum || initialRequirement.targetBillRate || 115) * 0.75),
          skillsRequired: form.skillsRequired.trim(),
          assignedRecruiter: form.assignedRecruiter,
          status: form.status,
          publicDescription: form.publicDescription.trim() || null,
          rawEmailText: form.rawEmailText.trim() || null,
          customFields: customValues,
        };
        if (onSaveEdit) {
          await onSaveEdit(updatedReq);
        }
      } else {
        const nextCode = `REQ-${1040 + Math.floor(Math.random() * 50)}`;
        const resolvedBill = billRateNum || 115;
        const resolvedPay = payRateNum || Math.round(resolvedBill * 0.75);
        const newReq: Requirement = {
          id: 'req_' + Date.now(),
          code: nextCode,
          opportunityTitle: form.opportunityTitle.trim(),
          openPositions: openPosNum,
          companyName: form.companyName.trim(),
          clientContact: form.clientContact.trim() || 'Primary Hiring Lead',
          clientContactTitle: form.clientContactTitle.trim() || 'Engineering Director',
          location: form.location.trim() || 'Remote',
          workModel: form.workModel,
          targetBillRate: resolvedBill,
          targetPayRate: resolvedPay,
          skillsRequired: form.skillsRequired.trim() || 'Java, Cloud, Microservices',
          assignedRecruiter: form.assignedRecruiter,
          status: form.status,
          publicDescription: form.publicDescription.trim() || null,
          rawEmailText: form.rawEmailText.trim() || null,
          customFields: customValues,
        };
        if (onSaveCreate) {
          await onSaveCreate(newReq);
        }
        showToast(
          'Requirement Created',
          `${newReq.opportunityTitle} (${openPosNum} open ${openPosNum === 1 ? 'position' : 'positions'}) added to pipeline!`,
          'success-brand'
        );
      }
      setInitialSnapshot(JSON.stringify({ form, customValues }));
    } catch (err: any) {
      if (!isEdit) {
        showToast(
          'Save Failed',
          err?.response?.data?.message || err?.message || 'Could not create requirement.',
          'error'
        );
      }
    } finally {
      setIsSaving(false);
    }
  };

  const { showLeaveModal, guardNavigation, confirmLeave, cancelLeave } = useFormShortcuts({
    isDirty,
    isSubmitting: isSaving,
    onSubmit: () => handleSubmit(),
  });

  const skillCount = form.skillsRequired
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean).length;

  if (isEdit && !initialRequirement) {
    return (
      <section className="max-w-3xl mx-auto py-16 text-center space-y-4">
        <div className="bg-white rounded-xl border border-slate-200 p-8 card-shadow space-y-3">
          <h2 className="text-base font-bold text-slate-900">Requirement Not Found</h2>
          <p className="text-xs text-slate-500">
            This requisition may have been deleted or could not be loaded.
          </p>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{backLabel}</span>
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-6 animate-fade-in">
      <DetailBreadcrumb
        backLabel={backLabel}
        onBack={() => guardNavigation(onBack)}
        title={
          isEdit
            ? initialRequirement?.opportunityTitle || 'Edit Requirement'
            : 'New Requirement'
        }
        codePill={isEdit ? initialRequirement?.code || 'Edit' : 'New Order'}
        rightSlot={
          !isEdit && onOpenFromEmail ? (
            <button
              type="button"
              onClick={() => guardNavigation(onOpenFromEmail)}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 hover:text-slate-900 px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <AiIcon className="w-3.5 h-3.5 text-teal-600 shrink-0" />
              <span>Parse from Email</span>
              <AiTag />
            </button>
          ) : undefined
        }
      />

      <PageHeader
        title={isEdit ? `Edit Requirement · ${initialRequirement?.code || 'Order'}` : 'New Job Requirement'}
        subtitle={
          isEdit
            ? 'Update client details, open positions, target rates, and public job summary.'
            : 'Add a new client job opening with target rates, skills, and a public job summary.'
        }
        badges={
          <>
            {estSpread > 0 && (
              <StatusBadge
                tone="emerald"
                size="xs"
                label={`Target Spread: +${currencySymbol}${estSpread}/hr`}
                className="tabular-nums"
              />
            )}
            <span className="hidden md:inline text-[11px] text-slate-400">
              Press ⌘S to save
            </span>
          </>
        }
        actions={
          <>
            <button
              type="button"
              disabled={isSaving}
              onClick={() => guardNavigation(onBack)}
              className="px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <ActionButton
              type="button"
              onClick={() => handleSubmit()}
              loading={isSaving}
              loadingText={isEdit ? 'Saving...' : 'Creating...'}
              className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-semibold cursor-pointer"
            >
              {isEdit ? 'Save Changes' : 'Create Requirement'}
            </ActionButton>
          </>
        }
      />

      <form
        noValidate
        onSubmit={handleSubmit}
        className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start"
      >
        <div className="lg:col-span-8 space-y-5 text-xs">
          {/* Card 1: Core Role & Client Context */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 card-shadow space-y-4">
            <div className="pb-2.5 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-900">Role &amp; client context</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Primary opportunity title, hiring company, hiring lead, and capacity.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                label="Requirement / Role Title"
                required
                error={isTitleInvalid ? 'Required' : undefined}
              >
                <input
                  value={form.opportunityTitle}
                  onChange={(e) => setForm({ ...form, opportunityTitle: e.target.value })}
                  placeholder="e.g. Lead AWS Cloud Architect"
                  className={`w-full px-3 py-2 border rounded-lg text-xs font-medium focus:outline-none ${
                    isTitleInvalid ? INVALID_FIELD_CLASSES : 'border-slate-200 bg-white focus:border-brand-600'
                  }`}
                />
              </FormField>

              <FormField
                label="Client Company"
                required
                error={isCompanyInvalid ? 'Required' : undefined}
              >
                <SearchableSelectInput
                  value={form.companyName}
                  onChange={(val) => {
                    const selClient = clients.find(
                      (c) => stripClientLocation(c.name).toLowerCase() === val.trim().toLowerCase()
                    );
                    setForm({
                      ...form,
                      companyName: val,
                      clientContact: selClient?.contacts?.[0]?.name || form.clientContact,
                      clientContactTitle:
                        selClient?.contacts?.[0]?.designation || form.clientContactTitle,
                    });
                  }}
                  options={clients.map((c) => ({
                    id: c.id,
                    label: stripClientLocation(c.name),
                    sublabel: c.location,
                  }))}
                  placeholder="Select or type client company..."
                  inputClassName={`w-full pl-3 pr-7 py-2 border rounded-lg text-xs font-medium focus:outline-none ${
                    isCompanyInvalid
                      ? INVALID_FIELD_CLASSES
                      : 'border-slate-200 bg-white focus:border-brand-600'
                  }`}
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Client Contact Person">
                <input
                  value={form.clientContact}
                  onChange={(e) => setForm({ ...form, clientContact: e.target.value })}
                  placeholder="e.g. Robert Vance"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs font-medium focus:border-brand-600 focus:outline-none"
                />
              </FormField>

              <FormField label="Contact Designation">
                <input
                  value={form.clientContactTitle}
                  onChange={(e) => setForm({ ...form, clientContactTitle: e.target.value })}
                  placeholder="e.g. VP Global Infrastructure"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs focus:border-brand-600 focus:outline-none"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField
                label="Open Positions"
                required
                error={isOpenPosInvalid ? 'Min 1 position' : undefined}
              >
                <input
                  type="number"
                  min={1}
                  max={1000}
                  step={1}
                  value={form.openPositions}
                  onChange={(e) => setForm({ ...form, openPositions: e.target.value })}
                  placeholder="1"
                  className={`w-full px-3 py-2 border rounded-lg text-xs font-medium focus:outline-none ${
                    isOpenPosInvalid
                      ? INVALID_FIELD_CLASSES
                      : 'border-slate-200 bg-white focus:border-brand-600'
                  }`}
                />
              </FormField>

              <FormField label="Work Location">
                <input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="e.g. Austin, TX or Remote"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs focus:border-brand-600 focus:outline-none"
                />
              </FormField>

              <FormField label="Work Model">
                <div className="grid grid-cols-3 gap-1.5">
                  {(['Remote', 'Hybrid', 'Onsite'] as const).map((wm) => (
                    <button
                      type="button"
                      key={wm}
                      onClick={() => setForm({ ...form, workModel: wm })}
                      className={`py-2 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
                        form.workModel === wm
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {wm}
                    </button>
                  ))}
                </div>
              </FormField>
            </div>
          </div>

          {/* Card 2: Compensation, Pipeline Stage & Skills */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 card-shadow space-y-4">
            <div className="pb-2.5 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-900">Rates, assignment &amp; skills</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Commercial rate envelope, desk ownership, and technical requirements.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <FormField label={`Target Bill Rate (${currencySymbol}/hr)`}>
                <input
                  type="number"
                  min={0}
                  value={form.targetBillRate}
                  onChange={(e) => setForm({ ...form, targetBillRate: e.target.value })}
                  placeholder="115"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs focus:border-brand-600 focus:outline-none"
                />
              </FormField>

              <FormField label={`Target Pay Rate (${currencySymbol}/hr)`}>
                <input
                  type="number"
                  min={0}
                  value={form.targetPayRate}
                  onChange={(e) => setForm({ ...form, targetPayRate: e.target.value })}
                  placeholder="86"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs focus:border-brand-600 focus:outline-none"
                />
              </FormField>

              <FormField label="Assigned Recruiter">
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
              </FormField>

              <FormField label="Pipeline Stage">
                <CustomSelect
                  value={form.status}
                  onChange={(val) => setForm({ ...form, status: val as Requirement['status'] })}
                  ariaLabel="Pipeline Stage"
                  size="sm"
                  options={buildRequirementStageOptions(taxonomies.stages, form.status).map(
                    (s) => ({
                      value: s,
                      label: s,
                      dotClass: getStageDotClass(s, getStageIndex(s, taxonomies.stages)),
                    })
                  )}
                />
              </FormField>
            </div>

            <FormField label="Required Technical Skills">
              <SkillTagInput
                value={form.skillsRequired}
                onChange={(nextCsv) => setForm({ ...form, skillsRequired: nextCsv })}
              />
            </FormField>
          </div>

          {/* Card 3: Public Summary & Internal Notes */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 card-shadow space-y-4">
            <div className="pb-2.5 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-900">Public description &amp; notes</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Client-safe overview shown on application links and private internal remarks.
              </p>
            </div>

            <RoleSummaryField
              label="Role Scope & Public Summary"
              value={form.publicDescription}
              onChange={(nextHtml) => setForm((prev) => ({ ...prev, publicDescription: nextHtml }))}
              onAutoFill={() =>
                setForm((prev) => ({
                  ...prev,
                  publicDescription: buildClientSafeSummaryHtml({
                    opportunityTitle: prev.opportunityTitle || 'Technical Specialist',
                    openPositions: Number(prev.openPositions) || 1,
                    workModel: prev.workModel,
                    location: prev.location,
                    skillsRequired: prev.skillsRequired,
                    companyName: prev.companyName,
                    rawEmailText: prev.rawEmailText,
                  }),
                }))
              }
              minHeight={130}
              maxHeight={280}
              placeholder="Write a client-safe role scope, key responsibilities, and engagement overview..."
            />

            <FormField label="Internal Job Spec Notes & Remarks">
              <textarea
                value={form.rawEmailText}
                onChange={(e) => setForm({ ...form, rawEmailText: e.target.value })}
                rows={7}
                placeholder="Direct client requisition details, urgency, or MSA constraints..."
                className="w-full min-h-[168px] p-3 border border-slate-200 rounded-lg bg-white text-xs leading-relaxed resize-y focus:border-brand-600 focus:outline-none"
              />
            </FormField>
          </div>
        </div>

        {/* Sticky Right Summary & Custom Attributes */}
        <div className="lg:col-span-4 space-y-5 lg:sticky lg:top-4 text-xs">
          <div className="bg-white rounded-xl border border-slate-200 p-5 card-shadow space-y-4">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <div className="flex items-center gap-2 font-semibold text-slate-900 text-sm">
                <Briefcase className="w-4 h-4 text-brand-600" />
                <span>Requisition summary</span>
              </div>
              <StatusBadge stage={form.status} size="xs" />
            </div>

            <dl className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">Client</dt>
                <dd className="font-medium text-slate-900 truncate max-w-[180px]">
                  {form.companyName.trim() || 'Not selected'}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">Headcount</dt>
                <dd className="font-medium text-slate-900 tabular-nums">
                  {openPosNum || 1} {openPosNum === 1 ? 'position' : 'positions'}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">Work Setup</dt>
                <dd className="font-medium text-slate-900 truncate max-w-[180px]">
                  {form.workModel} · {form.location.trim() || 'Remote'}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">Target Rates</dt>
                <dd className="font-medium text-slate-900 tabular-nums">
                  {currencySymbol}
                  {billRateNum}/hr bill · {currencySymbol}
                  {payRateNum}/hr pay
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">Skills Listed</dt>
                <dd className="font-medium text-slate-900 tabular-nums">{skillCount}</dd>
              </div>
            </dl>

            <div className="pt-2 border-t border-slate-100">
              <DynamicCustomFieldsSection
                entity="requirement"
                values={customValues}
                onChange={setCustomValues}
                isOpen={true}
              />
            </div>
          </div>
        </div>
      </form>

      <UnsavedChangesModal
        isOpen={showLeaveModal}
        onConfirmLeave={confirmLeave}
        onCancelLeave={cancelLeave}
      />
    </div>
  );
};
