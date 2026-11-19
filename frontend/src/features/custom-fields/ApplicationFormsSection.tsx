import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  FileText,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { apiClient } from '../../config/api.config';
import { ApplicationFormCustomField, ApplicationFormTemplate } from '../../types';
import {
  DEFAULT_APPLICATION_FORMS,
  summarizeFormTemplateFields,
} from '../../utils/applicationForms';
import { INVALID_FIELD_CLASSES } from '../../utils/formValidation';
import { sortArrayByColumn, useTableSort } from '../../utils/tableSort';
import { useDebounce } from '../../utils/useDebounce';
import { ActionButton } from '../../components/shared/ActionButton';
import { ConfirmDeleteModal } from '../../components/shared/ConfirmDeleteModal';
import { CustomSelect } from '../../components/shared/CustomSelect';
import { AnimatedModal } from '../../components/shared/MotionPrimitives';
import { SortableTableHeader } from '../../components/shared/SortableTableHeader';
import { TablePagination } from '../../components/shared/TablePagination';

interface ApplicationFormsSectionProps {
  customFields?: Array<{ id?: string; key?: string; name: string; entity?: string; required?: boolean }>;
  onFormsChanged?: (forms: ApplicationFormTemplate[]) => void;
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
  label: string;
}> = [
  {
    includeKey: 'includeCurrentTitle',
    requireKey: 'requireCurrentTitle',
    label: 'Current Job Title',
  },
  {
    includeKey: 'includeExpectedRate',
    requireKey: 'requireExpectedRate',
    label: 'Expected Hourly Rate',
  },
  {
    includeKey: 'includeVendorName',
    requireKey: 'requireVendorName',
    label: 'Partner / Vendor Agency Name',
  },
  {
    includeKey: 'includeNoticePeriod',
    requireKey: 'requireNoticePeriod',
    label: 'Availability / Notice Period',
  },
  {
    includeKey: 'includeLinkedinUrl',
    requireKey: 'requireLinkedinUrl',
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

export const ApplicationFormsSection: React.FC<ApplicationFormsSectionProps> = ({
  customFields,
  onFormsChanged,
  showToast,
}) => {
  const [forms, setForms] = useState<ApplicationFormTemplate[]>(DEFAULT_APPLICATION_FORMS);
  const [isLoading, setIsLoading] = useState(false);

  // List view filter, sort & pagination state
  const [filterScope, setFilterScope] = useState<'all' | 'with_custom'>('all');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 200);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const tableSort = useTableSort<'name' | 'fieldsCount' | 'customCount' | 'isDefault'>();
  const [expandedRowIds, setExpandedRowIds] = useState<Record<string, boolean>>({});

  // Add / Edit modal state
  const [editingFormId, setEditingFormId] = useState<string | null>(null);
  const [editingOriginalIsDefault, setEditingOriginalIsDefault] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [draft, setDraft] = useState<Omit<ApplicationFormTemplate, 'id'>>(EMPTY_FORM_DRAFT);
  const [customOptionsText, setCustomOptionsText] = useState<Record<string, string>>({});
  const [newCustomName, setNewCustomName] = useState('');
  const [newCustomType, setNewCustomType] = useState<CustomQuestionType>('TEXT');
  const [newCustomOptions, setNewCustomOptions] = useState('');
  const [newCustomRequired, setNewCustomRequired] = useState(false);
  const [customDraftError, setCustomDraftError] = useState('');
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Row quick actions state
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [formToDelete, setFormToDelete] = useState<ApplicationFormTemplate | null>(null);

  const formNameInputRef = useRef<HTMLInputElement>(null);

  const syncForms = (next: ApplicationFormTemplate[]) => {
    setForms(next);
    onFormsChanged?.(next);
  };

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    apiClient
      .get('/application-forms')
      .then((res) => {
        if (!active) return;
        if (res.data?.success && Array.isArray(res.data.data) && res.data.data.length > 0) {
          syncForms(res.data.data);
        }
      })
      .catch(() => {
        // Fallback to default templates
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filterScope, tableSort.sort.sortBy, tableSort.sort.sortDir]);

  useEffect(() => {
    if (isModalOpen) {
      const timer = setTimeout(() => {
        formNameInputRef.current?.focus();
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [isModalOpen]);

  const countCustomQuestions = (form: ApplicationFormTemplate) =>
    (form.customFields?.length || 0) +
    (form.customFieldKeys || []).filter(
      (k) => !(form.customFields || []).some((cf) => cf.key === k)
    ).length;

  const formsWithCustomCount = useMemo(
    () => forms.filter((f) => countCustomQuestions(f) > 0).length,
    [forms]
  );

  const processedForms = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    const filtered = forms.filter((form) => {
      if (filterScope === 'with_custom' && countCustomQuestions(form) === 0) {
        return false;
      }
      if (!q) return true;
      const chipNames = summarizeFormTemplateFields(form, customFields)
        .map((c) => c.label.toLowerCase())
        .join(' ');
      return (
        form.name.toLowerCase().includes(q) ||
        String(form.heading || '').toLowerCase().includes(q) ||
        chipNames.includes(q)
      );
    });

    return sortArrayByColumn(filtered, tableSort.sort, {
      name: (f) => f.name,
      fieldsCount: (f) => summarizeFormTemplateFields(f, customFields).length,
      customCount: (f) => countCustomQuestions(f),
      isDefault: (f) => Boolean(f.isDefault),
    });
  }, [forms, customFields, debouncedSearch, filterScope, tableSort.sort]);

  const totalForms = processedForms.length;
  const totalPages = Math.max(1, Math.ceil(totalForms / Math.max(1, limit)));
  const safePage = Math.min(page, totalPages);
  const paginatedForms = useMemo(
    () => processedForms.slice((safePage - 1) * limit, safePage * limit),
    [processedForms, safePage, limit]
  );

  const resetCustomQuestionAdder = () => {
    setNewCustomName('');
    setNewCustomType('TEXT');
    setNewCustomOptions('');
    setNewCustomRequired(false);
    setCustomDraftError('');
  };

  const openCreateModal = () => {
    setEditingFormId(null);
    setEditingOriginalIsDefault(false);
    setDraft(EMPTY_FORM_DRAFT);
    setCustomOptionsText({});
    resetCustomQuestionAdder();
    setValidationAttempted(false);
    setIsModalOpen(true);
  };

  const openEditModal = (form: ApplicationFormTemplate) => {
    setEditingFormId(form.id);
    setEditingOriginalIsDefault(Boolean(form.isDefault));
    const initialCustomFields = [...(form.customFields || [])];
    const optionsMap: Record<string, string> = {};
    for (const cf of initialCustomFields) {
      if (cf.type === 'DROPDOWN') {
        optionsMap[cf.key] = (cf.options || []).join(', ');
      }
    }
    setCustomOptionsText(optionsMap);
    setDraft({
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
      customFieldKeys: [...(form.customFieldKeys || [])],
      customFields: initialCustomFields,
    });
    resetCustomQuestionAdder();
    setValidationAttempted(false);
    setIsModalOpen(true);
  };

  const buildInlineCustomField = (): ApplicationFormCustomField | null => {
    const trimmed = newCustomName.trim();
    if (!trimmed) {
      setCustomDraftError('Enter a field label before adding.');
      return null;
    }
    const parsedOptions = newCustomOptions
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
    if (newCustomType === 'DROPDOWN' && parsedOptions.length === 0) {
      setCustomDraftError('Enter comma-separated options for this dropdown.');
      return null;
    }
    setCustomDraftError('');
    return {
      key: `cf_${trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${Date.now().toString(36)}`,
      name: trimmed,
      type: newCustomType,
      required: newCustomRequired,
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

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
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

    // Check existing dropdowns have options
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

    // If user typed a question in the bottom adder bar without clicking "+ Add", include it automatically
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
      const res = editingFormId
        ? await apiClient.put(`/application-forms/${editingFormId}`, payload)
        : await apiClient.post('/application-forms', payload);

      if (res.data?.success && Array.isArray(res.data.data)) {
        syncForms(res.data.data);
      }
      setIsModalOpen(false);
      showToast(
        editingFormId ? 'Application Form Updated' : 'Application Form Created',
        `"${payload.name}" is ready to attach to job requirements.`,
        'fa-solid fa-circle-check text-emerald-500'
      );
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

  const handleSetDefault = async (form: ApplicationFormTemplate) => {
    if (form.isDefault || settingDefaultId) return;
    setSettingDefaultId(form.id);
    try {
      const res = await apiClient.patch(`/application-forms/${form.id}/default`);
      if (res.data?.success && Array.isArray(res.data.data)) {
        syncForms(res.data.data);
      } else {
        syncForms(forms.map((f) => ({ ...f, isDefault: f.id === form.id })));
      }
      showToast(
        'Default Form Updated',
        `"${form.name}" is now the default application form.`,
        'fa-solid fa-star text-emerald-500'
      );
    } catch (err: any) {
      showToast(
        'Update Failed',
        err?.response?.data?.message || 'Could not set default application form.',
        'fa-solid fa-triangle-exclamation text-rose-500'
      );
    } finally {
      setSettingDefaultId(null);
    }
  };

  const handleDuplicate = async (form: ApplicationFormTemplate) => {
    if (duplicatingId) return;
    setDuplicatingId(form.id);
    try {
      const res = await apiClient.post('/application-forms', {
        ...form,
        name: `${form.name} (Copy)`,
        isDefault: false,
      });
      if (res.data?.success && Array.isArray(res.data.data)) {
        syncForms(res.data.data);
        showToast(
          'Form Duplicated',
          `Created "${form.name} (Copy)".`,
          'fa-solid fa-copy text-brand-500'
        );
      }
    } catch (err: any) {
      showToast(
        'Duplicate Failed',
        err?.response?.data?.message || 'Could not duplicate application form.',
        'fa-solid fa-triangle-exclamation text-rose-500'
      );
    } finally {
      setDuplicatingId(null);
    }
  };

  const isNameInvalid = validationAttempted && !draft.name.trim();
  const enabledStandardCount = STANDARD_TOGGLE_FIELDS.filter((f) =>
    Boolean(draft[f.includeKey])
  ).length;
  const totalDraftFieldCount =
    5 + enabledStandardCount + (draft.customFields?.length || 0);

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs shrink-0">
            <FileText className="w-4 h-4" />
          </span>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Application Forms
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                {forms.length} {forms.length === 1 ? 'Form' : 'Forms'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Create application forms for your job links, add custom questions directly on any form, and set one as your default.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="px-3.5 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Application Form</span>
        </button>
      </div>

      {/* List View with Filter, Sort & Pagination */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setFilterScope('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                filterScope === 'all'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-white hover:text-slate-900'
              }`}
            >
              All Forms ({forms.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterScope('with_custom')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                filterScope === 'with_custom'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-white hover:text-slate-900'
              }`}
            >
              With Custom Questions ({formsWithCustomCount})
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search forms or fields..."
              className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:border-brand-600 focus:outline-none transition-colors"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <SortableTableHeader
                  label="Form Name"
                  column="name"
                  sort={tableSort.sort}
                  onSort={tableSort.handleSort}
                  defaultDir="asc"
                  className="py-2.5 px-5 whitespace-nowrap"
                />
                <SortableTableHeader
                  label="Included Fields"
                  column="fieldsCount"
                  sort={tableSort.sort}
                  onSort={tableSort.handleSort}
                  defaultDir="desc"
                  className="py-2.5 px-4 whitespace-nowrap"
                />
                <SortableTableHeader
                  label="Custom Questions"
                  column="customCount"
                  sort={tableSort.sort}
                  onSort={tableSort.handleSort}
                  defaultDir="desc"
                  className="py-2.5 px-4 whitespace-nowrap"
                />
                <SortableTableHeader
                  label="Default"
                  column="isDefault"
                  sort={tableSort.sort}
                  onSort={tableSort.handleSort}
                  defaultDir="desc"
                  className="py-2.5 px-4 whitespace-nowrap"
                />
                <th className="py-2.5 px-5 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedForms.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-xs text-slate-400">
                    {search.trim() || filterScope !== 'all' ? (
                      <>
                        No application forms match your filter.{' '}
                        <button
                          type="button"
                          onClick={() => {
                            setSearch('');
                            setFilterScope('all');
                          }}
                          className="font-semibold text-brand-600 hover:underline cursor-pointer"
                        >
                          Reset Filters
                        </button>
                      </>
                    ) : (
                      <>
                        No application forms created yet. Click{' '}
                        <button
                          type="button"
                          onClick={openCreateModal}
                          className="font-semibold text-brand-600 hover:underline cursor-pointer"
                        >
                          New Application Form
                        </button>{' '}
                        to create one.
                      </>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedForms.map((form) => {
                  const fieldChips = summarizeFormTemplateFields(form, customFields);
                  const customChips = fieldChips.filter((c) => c.isCustom);
                  const isExpanded = Boolean(expandedRowIds[form.id]);
                  const maxVisible = 6;
                  const visibleChips = isExpanded
                    ? fieldChips
                    : fieldChips.slice(0, maxVisible);
                  const hiddenCount = Math.max(0, fieldChips.length - maxVisible);

                  return (
                    <tr
                      key={form.id}
                      onClick={() => openEditModal(form)}
                      className={`transition-colors cursor-pointer ${
                        form.isDefault
                          ? 'bg-emerald-50/20 hover:bg-emerald-50/40'
                          : 'hover:bg-slate-50/70'
                      }`}
                    >
                      <td className="py-3.5 px-5 align-top max-w-[260px]">
                        <div className="font-bold text-slate-900 leading-snug break-words">
                          {form.name}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 leading-snug break-words">
                          {form.heading || 'Submit Candidate Profile & Resume'}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 align-top">
                        <div
                          className="flex flex-wrap gap-1 items-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {visibleChips.map((chip, idx) => (
                            <span
                              key={`${chip.label}_${idx}`}
                              className={`px-2 py-0.5 rounded-md text-[10.5px] font-medium border ${
                                chip.isCustom
                                  ? 'bg-indigo-50/70 border-indigo-200 text-indigo-700'
                                  : chip.required
                                    ? 'bg-slate-100 border-slate-200 text-slate-800 font-semibold'
                                    : 'bg-white border-slate-200 text-slate-600'
                              }`}
                            >
                              {chip.label}
                              {chip.required ? ' *' : ''}
                            </span>
                          ))}
                          {hiddenCount > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedRowIds((prev) => ({
                                  ...prev,
                                  [form.id]: !isExpanded,
                                }))
                              }
                              className="ml-1 inline-flex items-center text-[11px] font-semibold text-brand-600 hover:text-brand-700 underline underline-offset-2 whitespace-nowrap cursor-pointer transition-colors"
                            >
                              {isExpanded ? 'Show less' : `+${hiddenCount} more`}
                            </button>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 align-top whitespace-nowrap">
                        {customChips.length > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10.5px] font-semibold">
                            {customChips.length}{' '}
                            {customChips.length === 1 ? 'Question' : 'Questions'}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">Standard only</span>
                        )}
                      </td>

                      <td
                        className="py-3.5 px-4 align-top whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {form.isDefault ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Default</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={settingDefaultId === form.id || isLoading}
                            onClick={() => handleSetDefault(form)}
                            className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-brand-50 hover:border-brand-200 text-slate-700 hover:text-brand-700 text-[11px] font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <Star className="w-3 h-3" />
                            <span>
                              {settingDefaultId === form.id ? 'Setting...' : 'Make Default'}
                            </span>
                          </button>
                        )}
                      </td>

                      <td
                        className="py-3.5 px-5 align-top text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditModal(form)}
                            title="Edit application form"
                            className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Pencil className="w-3 h-3" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            disabled={duplicatingId === form.id}
                            onClick={() => handleDuplicate(form)}
                            title="Duplicate application form"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          {forms.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setFormToDelete(form)}
                              title="Delete application form"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <TablePagination
          page={safePage}
          limit={limit}
          total={totalForms}
          onPageChange={setPage}
          onLimitChange={(nextLimit) => {
            setLimit(nextLimit);
            setPage(1);
          }}
          itemLabel="forms"
          isLoading={isLoading}
          pageSizeOptions={[5, 10, 20]}
          alwaysShow={true}
        />
      </div>

      {/* Add / Edit Application Form Modal */}
      <AnimatedModal
        isOpen={isModalOpen}
        onBackdropClick={() => !isSaving && setIsModalOpen(false)}
        zIndexClass="z-50"
        panelClassName="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
        ariaLabel={editingFormId ? 'Edit Application Form' : 'New Application Form'}
      >
        <div className="px-6 py-4 bg-[#141615] text-white border-b border-white/10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-brand-600 text-white flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold tracking-tight text-white">
                  {editingFormId ? 'Edit Application Form' : 'New Application Form'}
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-white/10 border border-white/15 text-[10px] font-semibold text-slate-200">
                  {totalDraftFieldCount} Fields
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Configure applicant fields and extra screening questions in one place.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => setIsModalOpen(false)}
            className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form noValidate onSubmit={handleSaveForm} className="p-6 overflow-y-auto space-y-5 text-xs">
          {/* 1. Form Identity */}
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

          {/* Core Mandatory Strip */}
          <div className="px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mr-1">
              Core Required:
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

          {/* 2. Optional / Required Standard Fields */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
                Standard Fields ({enabledStandardCount} of {STANDARD_TOGGLE_FIELDS.length} active)
              </span>
              <span className="text-[10.5px] text-slate-400">
                Click pill on right to switch Optional / Required
              </span>
            </div>
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
              {STANDARD_TOGGLE_FIELDS.map((field) => {
                const included = Boolean(draft[field.includeKey]);
                const required = Boolean(draft[field.requireKey]);
                return (
                  <div
                    key={field.includeKey}
                    className={`px-3.5 py-2.5 flex items-center justify-between gap-3 transition-colors ${
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
                        className={`font-semibold ${
                          included ? 'text-slate-800' : 'text-slate-400'
                        }`}
                      >
                        {field.label}
                      </span>
                    </label>

                    {included ? (
                      <button
                        type="button"
                        onClick={() =>
                          setDraft((prev) => ({
                            ...prev,
                            [field.requireKey]: !required,
                          }))
                        }
                        className={`px-2.5 py-1 rounded-md text-[10.5px] font-semibold border transition-colors cursor-pointer shrink-0 ${
                          required
                            ? 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {required ? 'Required *' : 'Optional'}
                      </button>
                    ) : (
                      <span className="text-[10.5px] text-slate-400 shrink-0">Hidden</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. Custom Questions Directly on This Form */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
                Custom Form Questions ({(draft.customFields || []).length})
              </span>
              <span className="text-[10.5px] text-slate-400">
                Saved directly to candidates on this form
              </span>
            </div>

            {(draft.customFields || []).length > 0 && (
              <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
                {(draft.customFields || []).map((cf, idx, arr) => (
                  <div key={cf.key} className="p-3 bg-white space-y-2">
                    <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                      <div className="flex flex-col shrink-0">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMoveCustomField(idx, -1)}
                          title="Move up"
                          className="text-slate-400 hover:text-slate-700 disabled:opacity-25 cursor-pointer"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === arr.length - 1}
                          onClick={() => handleMoveCustomField(idx, 1)}
                          title="Move down"
                          className="text-slate-400 hover:text-slate-700 disabled:opacity-25 cursor-pointer"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <input
                        type="text"
                        value={cf.name}
                        onChange={(e) => handleUpdateCustomField(cf.key, { name: e.target.value })}
                        placeholder="Question / field label..."
                        className="flex-1 min-w-[160px] px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-800 focus:border-brand-500 focus:outline-none"
                      />

                      <div className="w-28 shrink-0">
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

                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateCustomField(cf.key, { required: !cf.required })
                        }
                        className={`px-2.5 py-1 rounded-md text-[10.5px] font-semibold border transition-colors cursor-pointer shrink-0 ${
                          cf.required
                            ? 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {cf.required ? 'Required *' : 'Optional'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRemoveInlineCustomField(cf.key)}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 cursor-pointer shrink-0"
                        title="Remove question"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {cf.type === 'DROPDOWN' && (
                      <div className="pl-5">
                        <input
                          type="text"
                          value={
                            customOptionsText[cf.key] !== undefined
                              ? customOptionsText[cf.key]
                              : (cf.options || []).join(', ')
                          }
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
                          placeholder="Dropdown choices (comma separated, e.g. Immediate, 2 Weeks, 30 Days)"
                          className="w-full px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50/70 text-[11px] text-slate-700 focus:bg-white focus:border-brand-500 focus:outline-none"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Inline Question Adder */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                <input
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
                  placeholder="Add custom question (e.g. GitHub URL, Earliest Start Date)..."
                  className="flex-1 min-w-[170px] px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs focus:border-brand-500 focus:outline-none"
                />
                <div className="w-28 shrink-0">
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
                <button
                  type="button"
                  onClick={() => setNewCustomRequired((prev) => !prev)}
                  className={`px-2 py-1.5 rounded-md text-[10.5px] font-semibold border transition-colors cursor-pointer shrink-0 ${
                    newCustomRequired
                      ? 'bg-amber-50 border-amber-200 text-amber-800'
                      : 'bg-white border-slate-200 text-slate-600'
                  }`}
                >
                  {newCustomRequired ? 'Req *' : 'Opt'}
                </button>
                <button
                  type="button"
                  onClick={handleAddInlineCustomField}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add</span>
                </button>
              </div>

              {newCustomType === 'DROPDOWN' && (
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
                  placeholder="Dropdown options separated by commas (e.g. Immediate, 2 Weeks, 30 Days)"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px] focus:border-brand-500 focus:outline-none"
                />
              )}

              {customDraftError && (
                <div className="text-[11px] font-medium text-rose-600">{customDraftError}</div>
              )}
            </div>
          </div>

          {/* Footer Default Selection + Save/Cancel */}
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {editingOriginalIsDefault ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg self-start sm:self-auto">
                <Star className="w-3.5 h-3.5 fill-emerald-500 text-emerald-600" />
                <span>Currently Workspace Default Form</span>
              </span>
            ) : (
              <label className="flex items-center gap-2 cursor-pointer">
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
            )}

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <ActionButton
                type="submit"
                loading={isSaving}
                loadingText="Saving..."
                className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-semibold shadow-xs cursor-pointer"
              >
                {editingFormId ? 'Save Changes' : 'Create Form'}
              </ActionButton>
            </div>
          </div>
        </form>
      </AnimatedModal>

      <ConfirmDeleteModal
        isOpen={Boolean(formToDelete)}
        onClose={() => setFormToDelete(null)}
        title="Delete Application Form?"
        description={
          formToDelete ? (
            <>
              Permanently remove <strong className="text-slate-800">{formToDelete.name}</strong>?
              Job requirements using this form will fall back to your default form.
            </>
          ) : null
        }
        confirmLabel="Delete Form"
        onConfirm={async () => {
          if (!formToDelete) return;
          const res = await apiClient.delete(`/application-forms/${formToDelete.id}`);
          if (res.data?.success && Array.isArray(res.data.data)) {
            syncForms(res.data.data);
          }
          showToast(
            'Application Form Deleted',
            `Removed "${formToDelete.name}".`,
            'fa-solid fa-trash-can text-slate-500'
          );
        }}
      />
    </div>
  );
};
