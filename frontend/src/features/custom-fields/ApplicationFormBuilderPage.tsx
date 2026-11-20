import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  FileText,
  Plus,
  Star,
  Trash2,
} from 'lucide-react';
import { apiClient } from '../../config/api.config';
import {
  ApplicationFormCustomField,
  ApplicationFormFieldWidth,
  ApplicationFormTemplate,
} from '../../types';
import {
  DEFAULT_APPLICATION_FORMS,
  resolveFormFieldWidth,
  summarizeFormTemplateFields,
} from '../../utils/applicationForms';
import { INVALID_FIELD_CLASSES } from '../../utils/formValidation';
import { ActionButton } from '../../components/shared/ActionButton';
import { CustomSelect } from '../../components/shared/CustomSelect';
import { DetailBreadcrumb } from '../../components/shared/DetailPageShell';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { ApplicationFormPreview } from './ApplicationFormPreview';

interface ApplicationFormBuilderPageProps {
  formId?: string | null;
  initialForms?: ApplicationFormTemplate[] | null;
  customFields?: Array<{ id?: string; key?: string; name: string; entity?: string; required?: boolean }>;
  onSaved: (forms: ApplicationFormTemplate[]) => void;
  onBack: () => void;
  showToast: (title: string, message: string, icon?: string) => void;
}

const EMPTY_FORM_DRAFT: Omit<ApplicationFormTemplate, 'id'> = {
  name: '',
  description: '',
  heading: 'Submit Candidate Profile & Resume',
  subheading:
    'Candidates applying directly or partner agencies submitting consultants can attach a resume below.',
  isDefault: false,
  includeCurrentTitle: true,
  requireCurrentTitle: false,
  includeExpectedRate: true,
  requireExpectedRate: false,
  includeVendorName: true,
  requireVendorName: false,
  includeNoticePeriod: true,
  requireNoticePeriod: false,
  includeLinkedinUrl: false,
  requireLinkedinUrl: false,
  fieldWidths: {
    vendorName: 'full',
  },
  customFieldKeys: [],
  customFields: [],
};

const STANDARD_TOGGLE_FIELDS: Array<{
  includeKey:
    | 'includeCurrentTitle'
    | 'includeExpectedRate'
    | 'includeVendorName'
    | 'includeNoticePeriod'
    | 'includeLinkedinUrl';
  requireKey:
    | 'requireCurrentTitle'
    | 'requireExpectedRate'
    | 'requireVendorName'
    | 'requireNoticePeriod'
    | 'requireLinkedinUrl';
  widthKey: 'currentTitle' | 'expectedRate' | 'vendorName' | 'noticePeriod' | 'linkedinUrl';
  defaultWidth: ApplicationFormFieldWidth;
  label: string;
}> = [
  {
    includeKey: 'includeCurrentTitle',
    requireKey: 'requireCurrentTitle',
    widthKey: 'currentTitle',
    defaultWidth: 'half',
    label: 'Current Job Title',
  },
  {
    includeKey: 'includeExpectedRate',
    requireKey: 'requireExpectedRate',
    widthKey: 'expectedRate',
    defaultWidth: 'half',
    label: 'Expected Hourly Rate',
  },
  {
    includeKey: 'includeVendorName',
    requireKey: 'requireVendorName',
    widthKey: 'vendorName',
    defaultWidth: 'full',
    label: 'Partner / Vendor Agency Name',
  },
  {
    includeKey: 'includeNoticePeriod',
    requireKey: 'requireNoticePeriod',
    widthKey: 'noticePeriod',
    defaultWidth: 'half',
    label: 'Availability / Notice Period',
  },
  {
    includeKey: 'includeLinkedinUrl',
    requireKey: 'requireLinkedinUrl',
    widthKey: 'linkedinUrl',
    defaultWidth: 'half',
    label: 'LinkedIn Profile URL',
  },
];

type CustomQuestionType = 'TEXT' | 'NUMBER' | 'DATE' | 'BOOLEAN' | 'DROPDOWN';

const CUSTOM_TYPE_OPTIONS: Array<{ value: CustomQuestionType; label: string }> = [
  { value: 'TEXT', label: 'Text' },
  { value: 'NUMBER', label: 'Number' },
  { value: 'DATE', label: 'Date' },
  { value: 'BOOLEAN', label: 'Yes / No' },
  { value: 'DROPDOWN', label: 'Dropdown' },
];

const QUICK_QUESTION_PRESETS: Array<{
  name: string;
  type: CustomQuestionType;
  width: ApplicationFormFieldWidth;
  required: boolean;
  options?: string[];
}> = [
  {
    name: 'Earliest Start Date',
    type: 'DROPDOWN',
    width: 'half',
    required: true,
    options: ['Immediate', '2 Weeks Notice', '30 Days Notice', 'Negotiable'],
  },
  {
    name: 'Open to Relocation?',
    type: 'BOOLEAN',
    width: 'half',
    required: false,
  },
  {
    name: 'Current Location (City, State)',
    type: 'TEXT',
    width: 'half',
    required: false,
  },
  {
    name: 'Portfolio / GitHub URL',
    type: 'TEXT',
    width: 'full',
    required: false,
  },
];

function SegmentedToggle<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  fullWidth = false,
}: {
  value: T;
  options: Array<{ value: T; label: React.ReactNode; title?: string }>;
  onChange: (next: T) => void;
  ariaLabel: string;
  fullWidth?: boolean;
}) {
  return (
    <div
      className={`inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 shrink-0 ${
        fullWidth ? 'w-full' : ''
      }`}
      role="group"
      aria-label={ariaLabel}
    >
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            title={opt.title}
            className={`${
              fullWidth ? 'flex-1 justify-center' : ''
            } inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10.5px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              active
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

const FieldWidthToggle: React.FC<{
  value: ApplicationFormFieldWidth;
  onChange: (next: ApplicationFormFieldWidth) => void;
  ariaLabel?: string;
  fullWidth?: boolean;
}> = ({ value, onChange, ariaLabel = 'Field width', fullWidth = false }) => (
  <SegmentedToggle
    value={value}
    onChange={onChange}
    ariaLabel={ariaLabel}
    fullWidth={fullWidth}
    options={[
      { value: 'half', label: 'Half', title: 'Half width (50%)' },
      { value: 'full', label: 'Full', title: 'Full width (100%)' },
    ]}
  />
);

const RequiredToggle: React.FC<{
  required: boolean;
  onChange: (next: boolean) => void;
  ariaLabel?: string;
  fullWidth?: boolean;
}> = ({ required, onChange, ariaLabel = 'Requirement setting', fullWidth = false }) => (
  <SegmentedToggle<'optional' | 'required'>
    value={required ? 'required' : 'optional'}
    onChange={(next) => onChange(next === 'required')}
    ariaLabel={ariaLabel}
    fullWidth={fullWidth}
    options={[
      { value: 'optional', label: 'Optional', title: 'Applicant may skip this field' },
      {
        value: 'required',
        label: (
          <span className="inline-flex items-center gap-1">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                required ? 'bg-amber-400' : 'bg-amber-500/70'
              }`}
            />
            <span>Required</span>
          </span>
        ),
        title: 'Applicant must complete this field',
      },
    ]}
  />
);

function buildDraftFromForm(form: ApplicationFormTemplate): {
  draft: Omit<ApplicationFormTemplate, 'id'>;
  optionsText: Record<string, string>;
} {
  const initialCustomFields = [...(form.customFields || [])].map((cf) => ({
    ...cf,
    width: cf.width || ('half' as ApplicationFormFieldWidth),
  }));
  const optionsText: Record<string, string> = {};
  for (const cf of initialCustomFields) {
    if (cf.type === 'DROPDOWN') {
      optionsText[cf.key] = (cf.options || []).join(', ');
    }
  }
  return {
    optionsText,
    draft: {
      name: form.name,
      description: form.description || '',
      heading: form.heading || 'Submit Candidate Profile & Resume',
      subheading:
        form.subheading ||
        'Candidates applying directly or partner agencies submitting consultants can attach a resume below.',
      isDefault: form.isDefault,
      includeCurrentTitle: form.includeCurrentTitle,
      requireCurrentTitle: form.requireCurrentTitle,
      includeExpectedRate: form.includeExpectedRate,
      requireExpectedRate: form.requireExpectedRate,
      includeVendorName: form.includeVendorName,
      requireVendorName: form.requireVendorName,
      includeNoticePeriod: form.includeNoticePeriod,
      requireNoticePeriod: form.requireNoticePeriod,
      includeLinkedinUrl: form.includeLinkedinUrl,
      requireLinkedinUrl: form.requireLinkedinUrl,
      fieldWidths: {
        vendorName: 'full',
        ...(form.fieldWidths || {}),
      },
      customFieldKeys: [...(form.customFieldKeys || [])],
      customFields: initialCustomFields,
    },
  };
}

/**
 * Dedicated full-page Application Form builder supporting Half / Full field width
 * selection, custom question ordering, and live side-by-side preview.
 */
export const ApplicationFormBuilderPage: React.FC<ApplicationFormBuilderPageProps> = ({
  formId,
  initialForms,
  customFields,
  onSaved,
  onBack,
  showToast,
}) => {
  const isEditMode = Boolean(formId);
  const initialMatched = formId
    ? initialForms?.find((f) => f.id === formId) || null
    : null;

  const [isLoadingForm, setIsLoadingForm] = useState<boolean>(
    Boolean(isEditMode && !initialMatched)
  );
  const [notFound, setNotFound] = useState(false);
  const [editingOriginalIsDefault, setEditingOriginalIsDefault] = useState<boolean>(
    Boolean(initialMatched?.isDefault)
  );
  const [draft, setDraft] = useState<Omit<ApplicationFormTemplate, 'id'>>(() =>
    initialMatched ? buildDraftFromForm(initialMatched).draft : EMPTY_FORM_DRAFT
  );
  const [customOptionsText, setCustomOptionsText] = useState<Record<string, string>>(() =>
    initialMatched ? buildDraftFromForm(initialMatched).optionsText : {}
  );
  const [newCustomName, setNewCustomName] = useState('');
  const [newCustomType, setNewCustomType] = useState<CustomQuestionType>('TEXT');
  const [newCustomOptions, setNewCustomOptions] = useState('');
  const [newCustomRequired, setNewCustomRequired] = useState(false);
  const [newCustomWidth, setNewCustomWidth] = useState<ApplicationFormFieldWidth>('half');
  const [customDraftError, setCustomDraftError] = useState('');
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [mobileTab, setMobileTab] = useState<'edit' | 'preview'>('edit');

  const formNameInputRef = useRef<HTMLInputElement>(null);
  const newCustomNameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!formId) {
      setIsLoadingForm(false);
      setNotFound(false);
      setEditingOriginalIsDefault(false);
      setDraft(EMPTY_FORM_DRAFT);
      setCustomOptionsText({});
      setValidationAttempted(false);
      const timer = setTimeout(() => formNameInputRef.current?.focus(), 40);
      return () => clearTimeout(timer);
    }

    const existing = initialForms?.find((f) => f.id === formId);
    if (existing) {
      const prepared = buildDraftFromForm(existing);
      setDraft(prepared.draft);
      setCustomOptionsText(prepared.optionsText);
      setEditingOriginalIsDefault(Boolean(existing.isDefault));
      setNotFound(false);
      setIsLoadingForm(false);
      return;
    }

    let cancelled = false;
    setIsLoadingForm(true);
    setNotFound(false);
    apiClient
      .get('/application-forms')
      .then((res) => {
        if (cancelled) return;
        const list: ApplicationFormTemplate[] =
          res.data?.success && Array.isArray(res.data.data) && res.data.data.length > 0
            ? res.data.data
            : DEFAULT_APPLICATION_FORMS;
        const target = list.find((f) => f.id === formId);
        if (!target) {
          setNotFound(true);
          return;
        }
        const prepared = buildDraftFromForm(target);
        setDraft(prepared.draft);
        setCustomOptionsText(prepared.optionsText);
        setEditingOriginalIsDefault(Boolean(target.isDefault));
      })
      .catch(() => {
        if (cancelled) return;
        const fallback = DEFAULT_APPLICATION_FORMS.find((f) => f.id === formId);
        if (fallback) {
          const prepared = buildDraftFromForm(fallback);
          setDraft(prepared.draft);
          setCustomOptionsText(prepared.optionsText);
          setEditingOriginalIsDefault(Boolean(fallback.isDefault));
        } else {
          setNotFound(true);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingForm(false);
      });

    return () => {
      cancelled = true;
    };
  }, [formId]);

  const resetCustomQuestionAdder = () => {
    setNewCustomName('');
    setNewCustomType('TEXT');
    setNewCustomOptions('');
    setNewCustomRequired(false);
    setNewCustomWidth('half');
    setCustomDraftError('');
  };

  const buildInlineCustomField = (): ApplicationFormCustomField | null => {
    const trimmed = newCustomName.trim();
    if (!trimmed) {
      setCustomDraftError('Please enter a question label first.');
      newCustomNameRef.current?.focus();
      return null;
    }
    const parsedOptions = newCustomOptions
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
    if (newCustomType === 'DROPDOWN' && parsedOptions.length === 0) {
      setCustomDraftError('Add at least one comma-separated option below.');
      return null;
    }
    setCustomDraftError('');
    return {
      key: `cf_${trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${Date.now().toString(36)}`,
      name: trimmed,
      type: newCustomType,
      required: newCustomRequired,
      width: newCustomWidth,
      ...(newCustomType === 'DROPDOWN' ? { options: parsedOptions } : {}),
    };
  };

  const handleAddInlineCustomField = () => {
    const item = buildInlineCustomField();
    if (!item) return;
    setDraft((prev) => ({
      ...prev,
      customFields: [...(prev.customFields || []), item],
    }));
    if (item.type === 'DROPDOWN') {
      setCustomOptionsText((prev) => ({
        ...prev,
        [item.key]: (item.options || []).join(', '),
      }));
    }
    resetCustomQuestionAdder();
  };

  const handleAddPresetQuestion = (preset: (typeof QUICK_QUESTION_PRESETS)[number]) => {
    const existingNames = new Set(
      (draft.customFields || []).map((cf) => cf.name.trim().toLowerCase())
    );
    if (existingNames.has(preset.name.trim().toLowerCase())) return;
    const item: ApplicationFormCustomField = {
      key: `cf_${preset.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${Date.now().toString(36)}`,
      name: preset.name,
      type: preset.type,
      required: preset.required,
      width: preset.width,
      ...(preset.type === 'DROPDOWN' && preset.options ? { options: preset.options } : {}),
    };
    setDraft((prev) => ({
      ...prev,
      customFields: [...(prev.customFields || []), item],
    }));
    if (item.type === 'DROPDOWN' && item.options) {
      setCustomOptionsText((prev) => ({
        ...prev,
        [item.key]: item.options!.join(', '),
      }));
    }
  };

  const handleUpdateCustomField = (
    key: string,
    patch: Partial<ApplicationFormCustomField>
  ) => {
    setDraft((prev) => ({
      ...prev,
      customFields: (prev.customFields || []).map((cf) =>
        cf.key === key ? { ...cf, ...patch } : cf
      ),
    }));
  };

  const handleMoveCustomField = (idx: number, direction: -1 | 1) => {
    setDraft((prev) => {
      const list = [...(prev.customFields || [])];
      const target = idx + direction;
      if (target < 0 || target >= list.length) return prev;
      const [moved] = list.splice(idx, 1);
      list.splice(target, 0, moved);
      return { ...prev, customFields: list };
    });
  };

  const handleRemoveInlineCustomField = (key: string) => {
    setDraft((prev) => ({
      ...prev,
      customFields: (prev.customFields || []).filter((cf) => cf.key !== key),
    }));
  };

  const handleSaveForm = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!draft.name.trim()) {
      setValidationAttempted(true);
      formNameInputRef.current?.focus();
      showToast(
        'Missing Required Fields',
        'Please enter a Form Name.',
        'fa-solid fa-circle-exclamation text-amber-500'
      );
      return;
    }

    const finalCustomFields = [...(draft.customFields || [])]
      .map((cf) => ({
        ...cf,
        name: cf.name.trim(),
        ...(cf.type === 'DROPDOWN'
          ? {
              options: (cf.options || []).map((o) => o.trim()).filter(Boolean),
            }
          : { options: undefined }),
      }))
      .filter((cf) => cf.name.length > 0);

    const emptyDropdown = finalCustomFields.find(
      (cf) => cf.type === 'DROPDOWN' && (!cf.options || cf.options.length === 0)
    );
    if (emptyDropdown) {
      showToast(
        'Missing Dropdown Options',
        `Please add at least one option for "${emptyDropdown.name}".`,
        'fa-solid fa-circle-exclamation text-amber-500'
      );
      return;
    }

    if (newCustomName.trim()) {
      const extra = buildInlineCustomField();
      if (!extra) return;
      finalCustomFields.push(extra);
    }

    setValidationAttempted(false);
    setIsSaving(true);
    try {
      const payload = {
        ...draft,
        name: draft.name.trim(),
        heading: draft.heading.trim() || 'Submit Candidate Profile & Resume',
        subheading: draft.subheading.trim(),
        customFields: finalCustomFields,
      };
      const res = formId
        ? await apiClient.put(`/application-forms/${formId}`, payload)
        : await apiClient.post('/application-forms', payload);

      const savedList: ApplicationFormTemplate[] =
        res.data?.success && Array.isArray(res.data.data) ? res.data.data : [];

      showToast(
        formId ? 'Application Form Updated' : 'Application Form Created',
        `"${payload.name}" is ready to attach to job requirements.`,
        'fa-solid fa-circle-check text-emerald-500'
      );
      onSaved(savedList);
    } catch (err: any) {
      showToast(
        'Save Failed',
        err?.response?.data?.message || 'Could not save application form.',
        'fa-solid fa-triangle-exclamation text-rose-500'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const isNameInvalid = validationAttempted && !draft.name.trim();
  const enabledStandardCount = STANDARD_TOGGLE_FIELDS.filter((f) =>
    Boolean(draft[f.includeKey])
  ).length;
  const parsedComposerOptions = newCustomOptions
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const draftCustomWithGhost: ApplicationFormCustomField[] = newCustomName.trim()
    ? [
        ...(draft.customFields || []),
        {
          key: '__draft_preview__',
          name: newCustomName.trim(),
          type: newCustomType,
          required: newCustomRequired,
          width: newCustomWidth,
          ...(newCustomType === 'DROPDOWN'
            ? {
                options:
                  parsedComposerOptions.length > 0
                    ? parsedComposerOptions
                    : ['Option 1', 'Option 2'],
              }
            : {}),
        },
      ]
    : [...(draft.customFields || [])];
  const previewDraft: Omit<ApplicationFormTemplate, 'id'> = {
    ...draft,
    customFields: draftCustomWithGhost,
  };
  const totalDraftFieldCount = summarizeFormTemplateFields(
    { ...draft, id: formId || 'draft' },
    customFields
  ).length;
  const availablePresets = QUICK_QUESTION_PRESETS.filter(
    (p) =>
      !(draft.customFields || []).some(
        (cf) => cf.name.trim().toLowerCase() === p.name.toLowerCase()
      )
  );
  const totalHalfFieldsCount =
    STANDARD_TOGGLE_FIELDS.filter(
      (f) =>
        Boolean(draft[f.includeKey]) &&
        resolveFormFieldWidth(draft, f.widthKey, f.defaultWidth) === 'half'
    ).length +
    draftCustomWithGhost.filter((cf) => (cf.width || 'half') === 'half').length;

  if (isLoadingForm) {
    return (
      <div className="space-y-4">
        <DetailBreadcrumb
          backLabel="Back to Application Forms"
          onBack={onBack}
          title="Loading Application Form..."
          codePill="Edit Form"
        />
        <div className="bg-white rounded-xl border border-slate-200 p-16 text-center text-xs text-slate-500 flex flex-col items-center gap-3">
          <div className="w-6 h-6 rounded-full border-2 border-brand-600 border-t-transparent animate-spin" />
          <span>Loading application form template...</span>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="space-y-4">
        <DetailBreadcrumb
          backLabel="Back to Application Forms"
          onBack={onBack}
          title="Form Not Found"
        />
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-3 text-xs">
          <div className="text-sm font-bold text-slate-900">
            Application form could not be found
          </div>
          <p className="text-slate-500">
            This template may have been deleted or is unavailable in the workspace.
          </p>
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold cursor-pointer"
          >
            Back to Application Forms
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <DetailBreadcrumb
        backLabel="Back to Application Forms"
        onBack={onBack}
        title={isEditMode ? draft.name.trim() || 'Edit Application Form' : 'New Application Form'}
        codePill={isEditMode ? 'Edit Template' : 'New Template'}
      />

      {/* Top Action Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5 min-w-0">
          <span className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs shrink-0">
            <FileText className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-base font-bold text-slate-900 tracking-tight truncate">
                {isEditMode
                  ? draft.name.trim() || 'Edit Application Form'
                  : 'Create New Application Form'}
              </h1>
              <StatusBadge
                tone="brand"
                shape="rounded"
                label={`${totalDraftFieldCount} Active Fields`}
                className="tabular-nums"
              />
              {editingOriginalIsDefault && (
                <StatusBadge
                  tone="emerald"
                  shape="rounded"
                  label="Workspace Default"
                />
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Configure form identity, Half / Full field widths, and custom screening questions with a live applicant preview.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-auto text-xs">
          <button
            type="button"
            disabled={isSaving}
            onClick={onBack}
            className="px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-semibold cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <ActionButton
            type="button"
            onClick={() => handleSaveForm()}
            loading={isSaving}
            loadingText="Saving..."
            className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-semibold shadow-xs cursor-pointer"
          >
            {isEditMode ? 'Save Changes' : 'Create Form'}
          </ActionButton>
        </div>
      </div>

      {/* Tablet / Mobile Builder vs Preview Switcher */}
      <div className="xl:hidden bg-white rounded-xl border border-slate-200 p-1.5 flex items-center gap-1.5 text-xs">
        <button
          type="button"
          onClick={() => setMobileTab('edit')}
          className={`flex-1 py-2 rounded-lg font-semibold transition-colors cursor-pointer ${
            mobileTab === 'edit'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          Form Builder
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('preview')}
          className={`flex-1 py-2 rounded-lg font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
            mobileTab === 'preview'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
          <span>Live Preview</span>
        </button>
      </div>

      {/* Main Dedicated 12-Column Builder + Live Preview Workspace */}
      <form
        noValidate
        onSubmit={handleSaveForm}
        className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start"
      >
        {/* Left Builder Column */}
        <div
          className={`xl:col-span-7 space-y-5 text-xs ${
            mobileTab === 'preview' ? 'hidden xl:block' : 'block'
          }`}
        >
          {/* Card 1: Form Identity */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
              <div>
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  1. Form Identity &amp; Copy
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Name shown to recruiters and heading shown to candidates on the application page.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-700">Form Name *</label>
                  {isNameInvalid && (
                    <span className="text-[10px] font-semibold text-rose-600">Required</span>
                  )}
                </div>
                <input
                  ref={formNameInputRef}
                  type="text"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="e.g. Direct Candidate Quick Apply"
                  className={`w-full px-3 py-2 rounded-lg border focus:outline-none ${
                    isNameInvalid ? INVALID_FIELD_CLASSES : 'border-slate-200 focus:border-brand-500'
                  }`}
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Public Form Title
                </label>
                <input
                  type="text"
                  value={draft.heading}
                  onChange={(e) => setDraft({ ...draft, heading: e.target.value })}
                  placeholder="Submit Candidate Profile & Resume"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Applicant Instructions (Optional)
              </label>
              <input
                type="text"
                value={draft.subheading}
                onChange={(e) => setDraft({ ...draft, subheading: e.target.value })}
                placeholder="Short instruction shown under the form heading..."
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-500 focus:outline-none"
              />
            </div>

            {!editingOriginalIsDefault && (
              <div className="pt-1">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.isDefault}
                    onChange={(e) => setDraft({ ...draft, isDefault: e.target.checked })}
                    className="w-4 h-4 rounded text-brand-600 cursor-pointer"
                  />
                  <span className="font-semibold text-slate-700">
                    Set as default form for job links
                  </span>
                </label>
              </div>
            )}
          </div>

          {/* Card 2: Core & Standard Fields */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-start justify-between gap-2 flex-wrap pb-2.5 border-b border-slate-100">
              <div>
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  2. Core &amp; Standard Fields
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Toggle optional fields ({enabledStandardCount} of {STANDARD_TOGGLE_FIELDS.length}{' '}
                  active) and choose Half (50%) or Full (100%) row width.
                </p>
              </div>
              {totalHalfFieldsCount % 2 === 1 && (
                <span className="px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200 text-[10.5px] font-medium text-slate-600">
                  Tip: {totalHalfFieldsCount} Half-width fields active — pair in twos or use Full to avoid row gaps
                </span>
              )}
            </div>

            {/* Core Mandatory Strip */}
            <div className="px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mr-1">
                Always Required:
              </span>
              {['Resume / CV *', 'Full Name *', 'Email *', 'Phone *', 'Work Auth *'].map((label) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[10.5px] font-semibold text-slate-700"
                >
                  <Check className="w-2.5 h-2.5 text-emerald-600" />
                  <span>{label}</span>
                </span>
              ))}
            </div>

            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
              {STANDARD_TOGGLE_FIELDS.map((field) => {
                const included = Boolean(draft[field.includeKey]);
                const required = Boolean(draft[field.requireKey]);
                const fieldWidth = resolveFormFieldWidth(
                  draft,
                  field.widthKey,
                  field.defaultWidth
                );
                return (
                  <div
                    key={field.includeKey}
                    className={`px-3.5 py-3 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 transition-colors ${
                      included ? 'bg-white' : 'bg-slate-50/50'
                    }`}
                  >
                    <label className="flex items-center gap-2.5 cursor-pointer min-w-0 flex-1">
                      <input
                        type="checkbox"
                        checked={included}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            [field.includeKey]: e.target.checked,
                            ...(e.target.checked ? {} : { [field.requireKey]: false }),
                          }))
                        }
                        className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 cursor-pointer"
                      />
                      <span
                        className={`font-semibold truncate ${
                          included ? 'text-slate-800' : 'text-slate-400'
                        }`}
                      >
                        {field.label}
                      </span>
                    </label>

                    {included ? (
                      <div className="flex items-center gap-2 shrink-0">
                        <FieldWidthToggle
                          value={fieldWidth}
                          ariaLabel={`${field.label} width`}
                          onChange={(nextWidth) =>
                            setDraft((prev) => ({
                              ...prev,
                              fieldWidths: {
                                ...(prev.fieldWidths || {}),
                                [field.widthKey]: nextWidth,
                              },
                            }))
                          }
                        />
                        <RequiredToggle
                          required={required}
                          ariaLabel={`${field.label} requirement`}
                          onChange={(nextReq) =>
                            setDraft((prev) => ({
                              ...prev,
                              [field.requireKey]: nextReq,
                            }))
                          }
                        />
                      </div>
                    ) : (
                      <span className="text-[10.5px] text-slate-400 shrink-0">Hidden</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Card 3: Custom Questions */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap pb-2.5 border-b border-slate-100">
              <div>
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  3. Custom Screening Questions ({(draft.customFields || []).length})
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Add extra questions saved directly to candidates on this form. Reorder, resize (Half/Full), or pick from common presets.
                </p>
              </div>
            </div>

            {/* Added Questions List */}
            {(draft.customFields || []).length > 0 ? (
              <div className="space-y-2.5">
                {(draft.customFields || []).map((cf, idx, arr) => {
                  const rawChoices =
                    customOptionsText[cf.key] !== undefined
                      ? customOptionsText[cf.key]
                      : (cf.options || []).join(', ');
                  const parsedChoices = rawChoices
                    .split(',')
                    .map((o) => o.trim())
                    .filter(Boolean);

                  return (
                    <div
                      key={cf.key}
                      className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors flex items-start gap-3"
                    >
                      {/* Left Rail: Index Badge + Move Controls */}
                      <div className="w-11 shrink-0 flex flex-col items-center gap-1 pt-0.5">
                        <span className="w-full h-6 rounded-md bg-slate-100 border border-slate-200/80 text-slate-700 font-bold text-[10px] inline-flex items-center justify-center tabular-nums">
                          Q{idx + 1}
                        </span>
                        <div className="inline-flex items-center gap-0.5">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveCustomField(idx, -1)}
                            title="Move question up"
                            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-25 cursor-pointer"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === arr.length - 1}
                            onClick={() => handleMoveCustomField(idx, 1)}
                            title="Move question down"
                            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-25 cursor-pointer"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Right Aligned Body */}
                      <div className="flex-1 min-w-0 space-y-2.5">
                        {/* Row 1: Label Input + Remove */}
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={cf.name}
                            onChange={(e) => handleUpdateCustomField(cf.key, { name: e.target.value })}
                            placeholder="Question label..."
                            className="flex-1 min-w-0 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-800 focus:border-brand-500 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveInlineCustomField(cf.key)}
                            className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 cursor-pointer shrink-0 transition-colors"
                            title="Remove question"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Row 2: Type + Width & Requirement Toggles */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="w-36 shrink-0">
                            <CustomSelect
                              value={cf.type}
                              onChange={(val) =>
                                handleUpdateCustomField(cf.key, {
                                  type: val as CustomQuestionType,
                                  ...(val === 'DROPDOWN' && (!cf.options || cf.options.length === 0)
                                    ? { options: ['Option 1', 'Option 2'] }
                                    : {}),
                                })
                              }
                              ariaLabel="Question type"
                              size="xs"
                              options={CUSTOM_TYPE_OPTIONS}
                            />
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <FieldWidthToggle
                              value={cf.width || 'half'}
                              ariaLabel={`${cf.name || 'Question'} width`}
                              onChange={(nextWidth) =>
                                handleUpdateCustomField(cf.key, { width: nextWidth })
                              }
                            />
                            <RequiredToggle
                              required={Boolean(cf.required)}
                              ariaLabel={`${cf.name || 'Question'} requirement`}
                              onChange={(nextReq) =>
                                handleUpdateCustomField(cf.key, { required: nextReq })
                              }
                            />
                          </div>
                        </div>

                        {/* Row 3: Dropdown Options */}
                        {cf.type === 'DROPDOWN' && (
                          <div className="pt-1 border-t border-slate-100 space-y-1.5">
                            <label className="block text-[10.5px] font-semibold text-slate-500">
                              Dropdown Options (comma separated)
                            </label>
                            <input
                              type="text"
                              value={rawChoices}
                              onChange={(e) => {
                                const raw = e.target.value;
                                setCustomOptionsText((prev) => ({ ...prev, [cf.key]: raw }));
                                handleUpdateCustomField(cf.key, {
                                  options: raw
                                    .split(',')
                                    .map((o) => o.trim())
                                    .filter(Boolean),
                                });
                              }}
                              placeholder="e.g. Immediate, 2 Weeks, 30 Days"
                              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50/70 text-[11px] text-slate-700 focus:bg-white focus:border-brand-500 focus:outline-none"
                            />
                            {parsedChoices.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {parsedChoices.map((choice, cIdx) => (
                                  <span
                                    key={`${cf.key}_opt_${cIdx}`}
                                    className="px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200/80 text-slate-600 text-[10px] font-medium"
                                  >
                                    {choice}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="px-4 py-3 rounded-xl bg-slate-50/70 border border-dashed border-slate-200 text-[11px] text-slate-500">
                No custom questions added yet. Pick a quick preset or compose a new question below.
              </div>
            )}

            {/* Quick Add Common Presets */}
            {availablePresets.length > 0 && (
              <div className="space-y-2">
                <div className="text-[10.5px] font-semibold text-slate-500 uppercase tracking-wider">
                  Quick Add Common Questions
                </div>
                <div className="flex flex-wrap gap-2">
                  {availablePresets.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => handleAddPresetQuestion(preset)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-700 text-[11px] font-medium transition-colors cursor-pointer shadow-2xs"
                    >
                      <Plus className="w-3 h-3 text-brand-600" />
                      <span>{preset.name}</span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[9.5px] font-semibold text-slate-500">
                        {preset.width === 'full' ? 'Full' : 'Half'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Compact Question Composer */}
            <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[11px] font-bold text-slate-800">
                  Add a New Custom Question
                </span>
                <span className="text-[10.5px] text-slate-400">
                  {newCustomName.trim()
                    ? 'Showing live preview on the right'
                    : 'Press Enter or click Add Question'}
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="text-[11px] font-semibold text-slate-700">
                    Question Label *
                  </label>
                  {customDraftError && !newCustomName.trim() && (
                    <span className="text-[10.5px] font-semibold text-rose-600">
                      {customDraftError}
                    </span>
                  )}
                </div>
                <input
                  ref={newCustomNameRef}
                  type="text"
                  value={newCustomName}
                  onChange={(e) => {
                    setNewCustomName(e.target.value);
                    if (customDraftError) setCustomDraftError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddInlineCustomField();
                    }
                  }}
                  placeholder="e.g. Earliest Start Date, Security Clearance Level, GitHub URL"
                  className={`w-full px-3 py-2 rounded-lg border bg-white text-xs focus:outline-none ${
                    customDraftError && !newCustomName.trim()
                      ? INVALID_FIELD_CLASSES
                      : 'border-slate-200 focus:border-brand-500'
                  }`}
                />
              </div>

              <div className="flex flex-wrap items-end justify-between gap-2.5 pt-0.5">
                <div className="flex flex-wrap items-end gap-2.5">
                  <div className="w-32">
                    <label className="block text-[10.5px] font-semibold text-slate-600 mb-1">
                      Answer Type
                    </label>
                    <CustomSelect
                      value={newCustomType}
                      onChange={(val) => {
                        setNewCustomType(val as CustomQuestionType);
                        if (customDraftError) setCustomDraftError('');
                      }}
                      ariaLabel="New question type"
                      size="xs"
                      options={CUSTOM_TYPE_OPTIONS}
                    />
                  </div>

                  <div>
                    <label className="block text-[10.5px] font-semibold text-slate-600 mb-1">
                      Width
                    </label>
                    <FieldWidthToggle
                      value={newCustomWidth}
                      ariaLabel="New question width"
                      onChange={setNewCustomWidth}
                    />
                  </div>

                  <div>
                    <label className="block text-[10.5px] font-semibold text-slate-600 mb-1">
                      Requirement
                    </label>
                    <RequiredToggle
                      required={newCustomRequired}
                      ariaLabel="New question requirement"
                      onChange={setNewCustomRequired}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddInlineCustomField}
                  className="h-[30px] px-3.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer shrink-0 shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Question</span>
                </button>
              </div>

              {newCustomType === 'DROPDOWN' && (
                <div className="pt-1 border-t border-slate-200/70 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label className="block text-[11px] font-semibold text-slate-700">
                      Dropdown Choices (comma separated) *
                    </label>
                    {customDraftError && parsedComposerOptions.length === 0 && (
                      <span className="text-[10.5px] font-semibold text-rose-600">
                        {customDraftError}
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={newCustomOptions}
                    onChange={(e) => {
                      setNewCustomOptions(e.target.value);
                      if (customDraftError) setCustomDraftError('');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddInlineCustomField();
                      }
                    }}
                    placeholder="e.g. Immediate, 2 Weeks Notice, 30 Days Notice"
                    className={`w-full px-3 py-2 rounded-lg border bg-white text-xs focus:outline-none ${
                      customDraftError && newCustomType === 'DROPDOWN' && parsedComposerOptions.length === 0
                        ? INVALID_FIELD_CLASSES
                        : 'border-slate-200 focus:border-brand-500'
                    }`}
                  />
                  {parsedComposerOptions.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {parsedComposerOptions.map((opt, idx) => (
                        <span
                          key={`new_opt_${idx}`}
                          className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600 text-[10px] font-medium"
                        >
                          {opt}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Bottom Save Strip */}
          <div className="bg-white rounded-xl border border-slate-200 px-5 py-3.5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {editingOriginalIsDefault ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg self-start sm:self-auto">
                <Star className="w-3.5 h-3.5 fill-emerald-500 text-emerald-600" />
                <span>Currently Workspace Default Form</span>
              </span>
            ) : (
              <span className="text-[11px] text-slate-500">
                Changes apply immediately to job links using this template.
              </span>
            )}
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isSaving}
                onClick={onBack}
                className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <ActionButton
                type="submit"
                loading={isSaving}
                loadingText="Saving..."
                className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-semibold shadow-xs cursor-pointer"
              >
                {isEditMode ? 'Save Changes' : 'Create Form'}
              </ActionButton>
            </div>
          </div>
        </div>

        {/* Right Live Preview Column */}
        <div
          className={`xl:col-span-5 xl:sticky xl:top-2 ${
            mobileTab === 'edit' ? 'hidden xl:block' : 'block'
          }`}
        >
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden xl:max-h-[calc(100vh-7rem)] xl:flex xl:flex-col">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                <Eye className="w-3.5 h-3.5 text-brand-600" />
                <span>Live Form Preview</span>
              </div>
              <span className="text-[10.5px] text-slate-400">
                Updates live as you edit
              </span>
            </div>
            <div className="p-4 bg-slate-50/50 xl:overflow-y-auto">
              <ApplicationFormPreview template={previewDraft} />
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
