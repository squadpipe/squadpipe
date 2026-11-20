import React, { useState, useEffect } from 'react';
import {
  Pencil,
  X,
  Plus,
  Check,
  Trash2,
  Tags,
  Columns,
  Layers,
  GripVertical,
  ListChecks,
  DollarSign,
  Calendar,
  Type,
  ShieldCheck,
  CreditCard,
  GraduationCap,
  GitBranch,
  Search,
} from 'lucide-react';
import { apiClient } from '../../config/api.config';
import { ApplicationFormTemplate, CustomField } from '../../types';
import { ApplicationFormBuilderPage } from './ApplicationFormBuilderPage';
import { ApplicationFormsSection } from './ApplicationFormsSection';
import { invalidateSchemaCaches } from '../../components/shared/DynamicCustomFieldsSection';
import { useCurrency } from '../../utils/currency';
import { AnimatedModal } from '../../components/shared/MotionPrimitives';
import { SortableTableHeader } from '../../components/shared/SortableTableHeader';
import { TablePagination } from '../../components/shared/TablePagination';
import { ActionButton } from '../../components/shared/ActionButton';
import { CustomSelect } from '../../components/shared/CustomSelect';
import { PageHeader } from '../../components/shared/PageHeader';
import { useDebounce } from '../../utils/useDebounce';
import { sortArrayByColumn, useTableSort } from '../../utils/tableSort';
import { INVALID_FIELD_CLASSES } from '../../utils/formValidation';

interface CustomFieldsViewProps {
  pageMode?: 'forms' | 'form_create' | 'form_edit' | 'fields' | 'dropdowns';
  editingFormId?: string | null;
  onNavigateForms?: (
    target: { mode: 'list' | 'new' } | { mode: 'edit'; formId: string }
  ) => void;
  customFields?: CustomField[];
  onAddCustomField?: (field: CustomField) => void;
  showToast: (title: string, message: string, icon?: string) => void;
}

type TaxonomyKey = 'workAuth' | 'paymentTerms' | 'education' | 'stages';

const DEFAULT_TAXONOMIES: Record<TaxonomyKey, string[]> = {
  workAuth: ['US Citizen', 'Green Card (Permanent Resident)', 'H-1B Specialty Occupation', 'TN Visa (NAFTA)', 'OPT / CPT EAD'],
  paymentTerms: ['Net 30 Days', 'Net 45 Days', 'Net 60 Days', 'Net 15 Days', 'Due on Receipt'],
  education: ["Master's Degree (MS/MBA)", "Bachelor's Degree (BS/B.Tech)", 'Doctorate / Ph.D.', 'Associate Degree'],
  stages: ['Requirement', 'Submitted', 'Interview', 'Selected', 'Onboarding', 'Billable', 'Archived'],
};

const TAXONOMY_META: Array<{
  key: TaxonomyKey;
  title: string;
  usageText: string;
  placeholder: string;
  icon: React.ReactNode;
}> = [
  {
    key: 'workAuth',
    title: 'Work Authorizations',
    usageText: 'Used in Consultant form',
    placeholder: 'Add new option (e.g. L-1A Visa)...',
    icon: <ShieldCheck className="w-4 h-4 text-slate-600" />,
  },
  {
    key: 'paymentTerms',
    title: 'Payment Terms',
    usageText: 'Used in Vendor form',
    placeholder: 'Add new option (e.g. Net 90 Days)...',
    icon: <CreditCard className="w-4 h-4 text-slate-600" />,
  },
  {
    key: 'education',
    title: 'Education Degrees',
    usageText: 'Used in Consultant form',
    placeholder: 'Add new option (e.g. High School Diploma)...',
    icon: <GraduationCap className="w-4 h-4 text-slate-600" />,
  },
  {
    key: 'stages',
    title: 'Pipeline Stages',
    usageText: 'Used in Requirement form',
    placeholder: 'Add new stage (e.g. Offer Extended)...',
    icon: <GitBranch className="w-4 h-4 text-slate-600" />,
  },
];

export const CustomFieldsView: React.FC<CustomFieldsViewProps> = ({
  pageMode = 'fields',
  editingFormId,
  onNavigateForms,
  customFields: propCustomFields,
  onAddCustomField,
  showToast,
}) => {
  const { symbol: currencySymbol } = useCurrency();
  const [activeSection, setActiveSection] = useState<
    'forms' | 'form_create' | 'form_edit' | 'fields' | 'dropdowns'
  >(pageMode);
  const [localEditFormId, setLocalEditFormId] = useState<string | null>(editingFormId ?? null);
  const [cachedAppForms, setCachedAppForms] = useState<ApplicationFormTemplate[] | null>(null);

  useEffect(() => {
    setActiveSection(pageMode);
  }, [pageMode]);

  useEffect(() => {
    if (editingFormId !== undefined) {
      setLocalEditFormId(editingFormId);
    }
  }, [editingFormId]);
  const [scope, setScope] = useState<'all' | 'consultant' | 'requirement' | 'client' | 'vendor' | 'placement'>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const tableSort = useTableSort<'name' | 'entity' | 'type' | 'required' | 'active'>();
  const [tableFields, setTableFields] = useState<any[]>([]);
  const [totalFields, setTotalFields] = useState(propCustomFields?.length || 0);
  const [isLoadingFields, setIsLoadingFields] = useState(false);
  const [activeTaxonomy, setActiveTaxonomy] = useState<TaxonomyKey>('workAuth');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingField, setEditingField] = useState<any | null>(null);
  const [isCreatingField, setIsCreatingField] = useState(false);
  const [isUpdatingField, setIsUpdatingField] = useState(false);
  const [isDeletingField, setIsDeletingField] = useState(false);
  const [fieldsList, setFieldsList] = useState<any[]>(propCustomFields || []);

  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, scope, tableSort.sort.sortBy, tableSort.sort.sortDir]);

  const [masterTaxonomies, setMasterTaxonomies] = useState<Record<TaxonomyKey, string[]>>(DEFAULT_TAXONOMIES);
  const [newTaxInput, setNewTaxInput] = useState<Record<TaxonomyKey, string>>({
    workAuth: '',
    paymentTerms: '',
    education: '',
    stages: '',
  });
  const [editingTax, setEditingTax] = useState<{
    category: TaxonomyKey;
    index: number;
    value: string;
  } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<
    | { type: 'field'; id: string; label: string }
    | { type: 'taxonomy'; category: TaxonomyKey; label: string }
    | null
  >(null);

  useEffect(() => {
    apiClient
      .get('/taxonomies')
      .then((res) => {
        if (res.data?.success && res.data.data) {
          const d = res.data.data;
          setMasterTaxonomies({
            workAuth: Array.isArray(d.workAuth) && d.workAuth.length > 0 ? d.workAuth : DEFAULT_TAXONOMIES.workAuth,
            paymentTerms: Array.isArray(d.paymentTerms) && d.paymentTerms.length > 0 ? d.paymentTerms : DEFAULT_TAXONOMIES.paymentTerms,
            education: Array.isArray(d.education) && d.education.length > 0 ? d.education : DEFAULT_TAXONOMIES.education,
            stages: Array.isArray(d.stages) && d.stages.length > 0 ? d.stages : DEFAULT_TAXONOMIES.stages,
          });
        }
      })
      .catch((err) => console.warn('Fetch taxonomies error:', err));
  }, []);

  const mapCustomFieldApi = (f: any) => ({
    id: f.id,
    name: f.name,
    entity: (f.entity || 'consultant').toLowerCase(),
    entityLabel: (f.entity || 'Consultant').charAt(0).toUpperCase() + (f.entity || 'Consultant').slice(1).toLowerCase(),
    type: f.type === 'NUMBER' ? `Currency (${currencySymbol})` : f.type === 'DROPDOWN' ? 'Dropdown' : f.type === 'DATE' ? 'Date' : 'Text',
    options: Array.isArray(f.options)
      ? f.options.join(', ')
      : typeof f.options === 'object' && f.options?.values
      ? f.options.values
      : typeof f.options === 'string'
      ? f.options
      : 'Standard Format',
    required: !!f.required,
    active: f.active ?? true,
  });

  useEffect(() => {
    if (propCustomFields && propCustomFields.length) {
      setFieldsList(propCustomFields);
      return;
    }
    apiClient
      .get('/custom-fields')
      .then((res) => {
        if (res.data?.success && Array.isArray(res.data.data)) {
          setFieldsList(res.data.data.map(mapCustomFieldApi));
        }
      })
      .catch((err) => console.warn('Fetch custom fields error:', err));
  }, [propCustomFields]);

  useEffect(() => {
    let active = true;
    setIsLoadingFields(true);
    apiClient
      .get('/custom-fields', {
        params: {
          search: debouncedSearch.trim() || undefined,
          scope: scope !== 'all' ? scope : undefined,
          page,
          limit,
          ...tableSort.sortParams,
        },
      })
      .then((res) => {
        if (!active) return;
        if (res.data?.success && Array.isArray(res.data.data)) {
          const mapped = res.data.data.map(mapCustomFieldApi);
          setTableFields(mapped);
          setTotalFields(res.data.pagination?.total ?? mapped.length);
        }
      })
      .catch(() => {
        if (!active) return;
        const q = debouncedSearch.toLowerCase();
        const filteredFallback = fieldsList.filter(
          (f) => (scope === 'all' || f.entity === scope) && (!q || String(f.name || '').toLowerCase().includes(q))
        );
        const sortedFallback = sortArrayByColumn(filteredFallback, tableSort.sort, {
          name: (f) => f.name,
          entity: (f) => f.entity,
          type: (f) => f.type,
          required: (f) => Boolean(f.required),
          active: (f) => Boolean(f.active),
        });
        setTotalFields(sortedFallback.length);
        setTableFields(sortedFallback.slice((page - 1) * limit, page * limit));
      })
      .finally(() => {
        if (active) setIsLoadingFields(false);
      });
    return () => {
      active = false;
    };
  }, [
    debouncedSearch,
    scope,
    page,
    limit,
    fieldsList,
    tableSort.sort.sortBy,
    tableSort.sort.sortDir,
    tableSort.sortParams,
  ]);

  const [newField, setNewField] = useState({
    name: '',
    entity: 'consultant',
    type: 'Dropdown',
    options: '',
    required: false,
  });
  const [createValidationAttempted, setCreateValidationAttempted] = useState(false);
  const [editValidationAttempted, setEditValidationAttempted] = useState(false);

  const filteredFields = tableFields;

  const handleAddTaxonomyOption = async (category: TaxonomyKey) => {
    const val = (newTaxInput[category] || '').trim();
    if (!val) return;
    if (masterTaxonomies[category].some((item) => item.toLowerCase() === val.toLowerCase())) {
      showToast('Already Exists', `"${val}" is already in this list.`, 'warning');
      return;
    }
    try {
      await apiClient.post('/taxonomies', { category, optionValue: val });
    } catch (err) {
      console.warn('Add taxonomy API:', err);
    }
    setMasterTaxonomies((prev) => ({ ...prev, [category]: [...prev[category], val] }));
    invalidateSchemaCaches();
    setNewTaxInput((prev) => ({ ...prev, [category]: '' }));
    showToast('Option Added', `Added "${val}" to master dropdown.`, 'success');
  };

  const handleSaveEditTaxonomy = async () => {
    if (!editingTax) return;
    const { category, index, value } = editingTax;
    const trimmed = value.trim();
    const oldValue = masterTaxonomies[category][index];
    if (!trimmed) {
      setEditingTax(null);
      return;
    }
    if (trimmed === oldValue) {
      setEditingTax(null);
      return;
    }
    try {
      await apiClient.put('/taxonomies', { category, oldValue, newValue: trimmed });
    } catch (err) {
      console.warn('Update taxonomy API:', err);
    }
    setMasterTaxonomies((prev) => ({
      ...prev,
      [category]: prev[category].map((item, idx) => (idx === index ? trimmed : item)),
    }));
    invalidateSchemaCaches();
    setEditingTax(null);
    showToast('Option Updated', `Updated "${oldValue}" to "${trimmed}".`, 'success');
  };

  const handleRemoveTaxonomyOption = async (category: TaxonomyKey, optionValue: string) => {
    try {
      await apiClient.delete('/taxonomies', { data: { category, optionValue } });
    } catch (err) {
      console.warn('Delete taxonomy API:', err);
    }
    setMasterTaxonomies((prev) => ({
      ...prev,
      [category]: prev[category].filter((item) => item !== optionValue),
    }));
    invalidateSchemaCaches();
    if (editingTax && editingTax.category === category && masterTaxonomies[category][editingTax.index] === optionValue) {
      setEditingTax(null);
    }
    showToast('Option Removed', `Removed "${optionValue}" from master dropdown.`, 'delete');
  };

  const handleDeleteField = async (id: string) => {
    try {
      await apiClient.delete(`/custom-fields/${id}`);
    } catch (err) {
      console.warn('Delete custom field API:', err);
    }
    setFieldsList((prev) => prev.filter((f) => f.id !== id));
    invalidateSchemaCaches();
    showToast('Field Removed', 'Custom field removed from registry.', 'delete');
  };

  const handleToggleFieldActive = (id: string) => {
    setFieldsList((prev) => prev.map((f) => (f.id === id ? { ...f, active: !f.active } : f)));
    invalidateSchemaCaches();
  };

  const handleCreateField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreatingField) return;
    if (!newField.name.trim()) {
      setCreateValidationAttempted(true);
      showToast('Validation Error', 'Field Label is required.');
      return;
    }
    setCreateValidationAttempted(false);

    const entityLabelMap: Record<string, string> = {
      consultant: 'Consultant',
      requirement: 'Requirement',
      client: 'Client',
      vendor: 'Vendor',
      placement: 'Placement',
    };

    setIsCreatingField(true);
    try {
      const res = await apiClient.post('/custom-fields', newField);
      const createdData = res.data?.data;
      const created = {
        id: createdData?.id || 'cf_' + Date.now(),
        name: newField.name,
        entity: newField.entity,
        entityLabel: entityLabelMap[newField.entity] || 'Custom',
        type: newField.type,
        options: newField.options || 'Standard Format',
        required: newField.required,
        active: true,
      };

      setFieldsList((prev) => [...prev, created]);
      invalidateSchemaCaches();
      if (onAddCustomField) {
        onAddCustomField(created as any);
      }

      setShowAddModal(false);
      showToast('Field Registered', `Added "${created.name}" to ${created.entityLabel} registry!`, 'success-brand');
      setNewField({
        name: '',
        entity: 'consultant',
        type: 'Dropdown',
        options: '',
        required: false,
      });
    } catch (err: any) {
      showToast(
        'Failed to Save',
        err?.response?.data?.message || 'Could not save custom field. Please try again.',
        'error'
      );
    } finally {
      setIsCreatingField(false);
    }
  };

  return (
    <section className="max-w-7xl mx-auto space-y-6 animate-fade-in select-none">
      {/* Bare Canvas Page Headers per Menu View */}
      {activeSection === 'fields' && (
        <PageHeader
          title="Custom Form Fields"
          subtitle="Add custom attributes (Text, Dropdown, Date, Currency/Number, Yes/No) to Consultants, Requirements, Clients, Vendors, and Placements."
          badges={
            <span className="text-xs font-medium text-slate-500 tabular-nums">
              {fieldsList.length} {fieldsList.length === 1 ? 'field' : 'fields'}
            </span>
          }
          actions={
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Custom Field</span>
            </button>
          }
        />
      )}

      {activeSection === 'dropdowns' && (
        <PageHeader
          title="Master Dropdown Lists"
          subtitle="Customize workspace-wide dropdown choices for Work Authorizations, Payment Terms, Education Degrees, and Pipeline Stages."
          badges={
            <span className="text-xs font-medium text-slate-500 tabular-nums">
              {TAXONOMY_META.length} lists
            </span>
          }
        />
      )}

      {/* Page 1: Public Application Form Templates */}
      {activeSection === 'forms' && (
        <ApplicationFormsSection
          customFields={fieldsList}
          initialForms={cachedAppForms}
          onFormsChanged={setCachedAppForms}
          onCreateForm={() => {
            if (onNavigateForms) {
              onNavigateForms({ mode: 'new' });
            } else {
              setActiveSection('form_create');
            }
          }}
          onEditForm={(form) => {
            if (onNavigateForms) {
              onNavigateForms({ mode: 'edit', formId: form.id });
            } else {
              setLocalEditFormId(form.id);
              setActiveSection('form_edit');
            }
          }}
          showToast={showToast}
        />
      )}

      {(activeSection === 'form_create' || activeSection === 'form_edit') && (
        <ApplicationFormBuilderPage
          formId={activeSection === 'form_edit' ? editingFormId ?? localEditFormId : null}
          initialForms={cachedAppForms}
          customFields={fieldsList}
          onSaved={(nextForms) => {
            if (nextForms.length > 0) setCachedAppForms(nextForms);
            if (onNavigateForms) {
              onNavigateForms({ mode: 'list' });
            } else {
              setActiveSection('forms');
            }
          }}
          onBack={() => {
            if (onNavigateForms) {
              onNavigateForms({ mode: 'list' });
            } else {
              setActiveSection('forms');
            }
          }}
          showToast={showToast}
        />
      )}

      {/* Tab 1: Custom Form Fields */}
      {activeSection === 'fields' && (
        <div className="bg-white rounded-xl border border-slate-200 card-shadow overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {(
                [
                  { key: 'all', label: `All Forms (${fieldsList.length})` },
                  { key: 'consultant', label: 'Consultant' },
                  { key: 'requirement', label: 'Requirement' },
                  { key: 'client', label: 'Client' },
                  { key: 'vendor', label: 'Vendor' },
                  { key: 'placement', label: 'Placement' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setScope(tab.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    scope === tab.key
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-white hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2.5 self-start sm:self-auto flex-shrink-0">
              <div className="relative w-60">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search fields..."
                  className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:border-brand-600 focus:outline-none transition-colors"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <SortableTableHeader
                    label="Field Name"
                    column="name"
                    sort={tableSort.sort}
                    onSort={tableSort.handleSort}
                    defaultDir="asc"
                    className="py-2.5 px-5 whitespace-nowrap"
                  />
                  <SortableTableHeader
                    label="Form"
                    column="entity"
                    sort={tableSort.sort}
                    onSort={tableSort.handleSort}
                    defaultDir="asc"
                    className="py-2.5 px-4 whitespace-nowrap"
                  />
                  <SortableTableHeader
                    label="Input Type"
                    column="type"
                    sort={tableSort.sort}
                    onSort={tableSort.handleSort}
                    defaultDir="asc"
                    className="py-2.5 px-4 whitespace-nowrap"
                  />
                  <th className="py-2.5 px-4">Dropdown Options</th>
                  <SortableTableHeader
                    label="Required"
                    column="required"
                    sort={tableSort.sort}
                    onSort={tableSort.handleSort}
                    defaultDir="desc"
                    className="py-2.5 px-4 whitespace-nowrap"
                  />
                  <SortableTableHeader
                    label="Status"
                    column="active"
                    sort={tableSort.sort}
                    onSort={tableSort.handleSort}
                    defaultDir="desc"
                    className="py-2.5 px-4 whitespace-nowrap"
                  />
                  <th className="py-2.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredFields.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-xs text-slate-400">
                      No custom fields added for this form yet. Click{' '}
                      <button
                        type="button"
                        onClick={() => setShowAddModal(true)}
                        className="font-semibold text-brand-600 hover:text-brand-700 hover:underline cursor-pointer"
                      >
                        Add Custom Field
                      </button>{' '}
                      to create one.
                    </td>
                  </tr>
                ) : (
                  filteredFields.map((field) => (
                    <tr key={field.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-5 font-semibold text-slate-900 flex items-center gap-2">
                        <GripVertical className="w-3.5 h-3.5 text-slate-300" />
                        <span>{field.name}</span>
                      </td>

                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200/80">
                          {field.entityLabel}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-xs text-slate-700">
                        <span className="inline-flex items-center gap-1.5 font-medium">
                          {field.type === 'Dropdown' ? (
                            <ListChecks className="w-3.5 h-3.5 text-slate-400" />
                          ) : String(field.type).startsWith('Currency') ? (
                            <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                          ) : field.type === 'Date' ? (
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          ) : (
                            <Type className="w-3.5 h-3.5 text-slate-400" />
                          )}
                          <span>
                            {String(field.type).startsWith('Currency') ? `Currency (${currencySymbol})` : field.type}
                          </span>
                        </span>
                      </td>

                      <td className="py-3 px-4 text-slate-500 text-xs max-w-xs truncate">
                        {field.type === 'Dropdown' && field.options && field.options !== 'Standard Format'
                          ? field.options
                          : '—'}
                      </td>

                      <td className="py-3 px-4">
                        {field.required ? (
                          <span className="text-xs font-medium text-slate-800 bg-slate-100 border border-slate-200/80 px-2 py-0.5 rounded-md">
                            Yes
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">Optional</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => handleToggleFieldActive(field.id)}
                          className="inline-flex items-center gap-2 cursor-pointer group"
                        >
                          <span
                            className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
                              field.active ? 'bg-emerald-500' : 'bg-slate-300'
                            }`}
                          >
                            <span
                              className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                                field.active ? 'translate-x-3.5' : 'translate-x-0.5'
                              }`}
                            />
                          </span>
                          <span className={`text-xs font-medium ${field.active ? 'text-slate-700' : 'text-slate-400'}`}>
                            {field.active ? 'Active' : 'Off'}
                          </span>
                        </button>
                      </td>

                      <td className="py-3 px-5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setEditingField({ ...field })}
                          title="Edit Custom Field"
                          className="text-slate-400 hover:text-brand-600 w-7 h-7 rounded hover:bg-brand-50 inline-flex items-center justify-center transition-colors cursor-pointer mr-0.5"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete({ type: 'field', id: field.id, label: field.name })}
                          title="Delete Custom Field"
                          className="text-slate-400 hover:text-rose-600 w-7 h-7 rounded hover:bg-rose-50 inline-flex items-center justify-center transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <TablePagination
            page={page}
            limit={limit}
            total={totalFields}
            onPageChange={setPage}
            onLimitChange={(nextLimit) => {
              setLimit(nextLimit);
              setPage(1);
            }}
            itemLabel="fields"
            isLoading={isLoadingFields}
          />
        </div>
      )}

      {/* Tab 2: Master Dropdown Lists (2-Column Master-Detail) */}
      {activeSection === 'dropdowns' && (() => {
        const currentMeta = TAXONOMY_META.find((m) => m.key === activeTaxonomy) || TAXONOMY_META[0];
        const currentOptions = masterTaxonomies[activeTaxonomy] || [];

        return (
          <div className="bg-white rounded-xl border border-slate-200 card-shadow overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[420px]">
              {/* Left Sidebar: 4 Dropdown Categories */}
              <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-slate-200 bg-slate-50/50 p-4 space-y-1.5">
                <div className="px-2 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Select a Dropdown List
                </div>
                {TAXONOMY_META.map((cat) => {
                  const count = (masterTaxonomies[cat.key] || []).length;
                  const isActive = activeTaxonomy === cat.key;
                  return (
                    <button
                      key={cat.key}
                      type="button"
                      onClick={() => {
                        setActiveTaxonomy(cat.key);
                        setEditingTax(null);
                      }}
                      className={`w-full text-left px-3.5 py-3 rounded-xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                        isActive
                          ? 'bg-white border-slate-300 shadow-sm text-slate-900'
                          : 'bg-transparent border-transparent text-slate-600 hover:bg-white/70 hover:text-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            isActive ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-500'
                          }`}
                        >
                          {React.cloneElement(cat.icon as React.ReactElement<any>, {
                            className: `w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`,
                          })}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold truncate">{cat.title}</div>
                          <div className="text-[11px] text-slate-500 truncate">{cat.usageText}</div>
                        </div>
                      </div>
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-md flex-shrink-0 ${
                          isActive ? 'bg-slate-100 text-slate-800' : 'bg-slate-200/60 text-slate-600'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Right Panel: Selected List Options */}
              <div className="lg:col-span-8 p-5 flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{currentMeta.title}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{currentMeta.usageText}</p>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <input
                      type="text"
                      value={newTaxInput[activeTaxonomy]}
                      onChange={(e) => setNewTaxInput((prev) => ({ ...prev, [activeTaxonomy]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddTaxonomyOption(activeTaxonomy);
                        }
                      }}
                      placeholder={currentMeta.placeholder}
                      className="flex-1 sm:w-64 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:border-brand-600 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddTaxonomyOption(activeTaxonomy)}
                      className="px-3.5 py-2 bg-slate-900 hover:bg-black text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer flex-shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Option</span>
                    </button>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl bg-white divide-y divide-slate-100 overflow-hidden">
                  {currentOptions.length === 0 ? (
                    <div className="py-10 text-center text-xs text-slate-400">
                      No options configured for {currentMeta.title} yet. Add one above.
                    </div>
                  ) : (
                    currentOptions.map((item, idx) => {
                      const isEditing = editingTax?.category === activeTaxonomy && editingTax?.index === idx;
                      return (
                        <div
                          key={`${item}-${idx}`}
                          className="flex items-center justify-between px-4 py-3 text-xs hover:bg-slate-50/70 transition-colors gap-3"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <span className="w-5 text-[11px] font-medium text-slate-400 flex-shrink-0">
                              {idx + 1}.
                            </span>
                            {isEditing ? (
                              <div className="flex items-center gap-1.5 flex-1 max-w-md">
                                <input
                                  type="text"
                                  autoFocus
                                  value={editingTax.value}
                                  onChange={(e) => setEditingTax({ ...editingTax, value: e.target.value })}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleSaveEditTaxonomy();
                                    } else if (e.key === 'Escape') {
                                      setEditingTax(null);
                                    }
                                  }}
                                  className="flex-1 min-w-0 px-2.5 py-1.5 text-xs text-slate-900 bg-white border border-brand-500 rounded-lg focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={handleSaveEditTaxonomy}
                                  title="Save"
                                  className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>Save</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingTax(null)}
                                  title="Cancel"
                                  className="px-2.5 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-lg text-[11px] font-medium cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setEditingTax({ category: activeTaxonomy, index: idx, value: item })}
                                className="text-left font-medium text-slate-800 hover:text-brand-600 cursor-pointer"
                              >
                                {item}
                              </button>
                            )}
                          </div>

                          {!isEditing && (
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                type="button"
                                onClick={() => setEditingTax({ category: activeTaxonomy, index: idx, value: item })}
                                title="Edit option"
                                className="text-slate-400 hover:text-brand-600 w-7 h-7 rounded-lg hover:bg-slate-100 inline-flex items-center justify-center transition-colors cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setConfirmDelete({ type: 'taxonomy', category: activeTaxonomy, label: item })
                                }
                                title="Remove option"
                                className="text-slate-400 hover:text-rose-600 w-7 h-7 rounded-lg hover:bg-rose-50 inline-flex items-center justify-center transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Add Custom Field Modal */}
      <AnimatedModal
        isOpen={showAddModal}
        onBackdropClick={() => !isCreatingField && setShowAddModal(false)}
        zIndexClass="z-50"
        backdropClassName="bg-slate-900/55 backdrop-blur-[2px] flex items-center justify-center p-4"
        panelClassName="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden"
        ariaLabel="Add Custom Field"
      >
            <div className="px-6 py-4 bg-[#141615] text-white flex items-center justify-between border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-brand-600 text-white flex items-center justify-center">
                  <Tags className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-tight">Add Custom Field</h3>
                  <div className="text-[11px] text-slate-400">Create a new field for your records</div>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form noValidate onSubmit={handleCreateField} className="p-6 space-y-4 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold text-slate-700">
                    Field Label <span className="text-rose-500">*</span>
                  </label>
                  {createValidationAttempted && !newField.name.trim() && (
                    <span className="text-[11px] font-semibold text-rose-600">Required</span>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="e.g. Security Clearance Level"
                  value={newField.name}
                  onChange={(e) => setNewField({ ...newField, name: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg text-xs focus:bg-white focus:outline-none ${
                    createValidationAttempted && !newField.name.trim()
                      ? INVALID_FIELD_CLASSES
                      : 'border-slate-200 bg-slate-50 focus:border-brand-600'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Target Entity</label>
                  <CustomSelect
                    value={newField.entity}
                    onChange={(val) => setNewField({ ...newField, entity: val })}
                    ariaLabel="Target Entity"
                    options={[
                      { value: 'consultant', label: 'Consultant Profile' },
                      { value: 'requirement', label: 'Job Requirement' },
                      { value: 'client', label: 'Client Account' },
                      { value: 'vendor', label: 'Staffing Vendor' },
                      { value: 'placement', label: 'Billable Placement' },
                    ]}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Data Type</label>
                  <CustomSelect
                    value={newField.type}
                    onChange={(val) => setNewField({ ...newField, type: val })}
                    ariaLabel="Data Type"
                    options={[
                      { value: 'Dropdown', label: 'Dropdown (Select Option)' },
                      { value: 'Text', label: 'Text (Single Line)' },
                      { value: `Currency (${currencySymbol})`, label: `Currency (${currencySymbol} Amount)` },
                      { value: 'Date', label: 'Date (Calendar Picker)' },
                    ]}
                  />
                </div>
              </div>

              {newField.type === 'Dropdown' && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Dropdown Options (Comma-separated)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. None, Secret, Top Secret, TS/SCI"
                    value={newField.options}
                    onChange={(e) => setNewField({ ...newField, options: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:border-brand-600 focus:outline-none"
                  />
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="req_field"
                  checked={newField.required}
                  onChange={(e) => setNewField({ ...newField, required: e.target.checked })}
                  className="w-4 h-4 text-brand-600 rounded cursor-pointer"
                />
                <label htmlFor="req_field" className="text-xs text-slate-700 cursor-pointer">
                  Make this a required field on forms
                </label>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={isCreatingField}
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-2 border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-60 font-semibold rounded-lg text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <ActionButton
                  type="submit"
                  loading={isCreatingField}
                  loadingText="Registering..."
                  icon={<Plus className="w-3.5 h-3.5" />}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white font-semibold rounded-lg text-xs transition-colors cursor-pointer"
                >
                  Register Field
                </ActionButton>
              </div>
            </form>
      </AnimatedModal>

      {/* Edit Custom Field Modal */}
      <AnimatedModal
        isOpen={Boolean(editingField)}
        onBackdropClick={() => !isUpdatingField && setEditingField(null)}
        zIndexClass="z-50"
        backdropClassName="bg-slate-900/55 backdrop-blur-[2px] flex items-center justify-center p-4"
        panelClassName="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden"
        ariaLabel="Edit Custom Field"
      >
        {editingField && (
          <>
            <div className="px-6 py-4 bg-[#141615] text-white flex items-center justify-between border-b border-white/10">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-brand-600 text-white flex items-center justify-center shrink-0">
                  <Tags className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold tracking-tight">Edit Custom Field</h3>
                  <div className="text-[11px] text-slate-400 truncate">{editingField.name}</div>
                </div>
              </div>
              <button
                type="button"
                disabled={isUpdatingField}
                onClick={() => setEditingField(null)}
                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              noValidate
              onSubmit={async (e) => {
                e.preventDefault();
                if (isUpdatingField) return;
                if (!editingField.name.trim()) {
                  setEditValidationAttempted(true);
                  showToast('Validation Error', 'Field Label is required.');
                  return;
                }
                setEditValidationAttempted(false);
                const entityLabelMap: Record<string, string> = {
                  consultant: 'Consultant',
                  requirement: 'Requirement',
                  client: 'Client',
                  vendor: 'Vendor',
                  placement: 'Placement',
                };
                setIsUpdatingField(true);
                try {
                  try {
                    await apiClient.put(`/custom-fields/${editingField.id}`, {
                      name: editingField.name,
                      entity: editingField.entity,
                      type: editingField.type,
                      options: editingField.options,
                      required: editingField.required,
                      active: editingField.active,
                    });
                  } catch (err) {
                    console.warn('Update custom field API:', err);
                  }
                  const updatedObj = {
                    ...editingField,
                    entityLabel: entityLabelMap[editingField.entity] || 'Custom',
                  };
                  setFieldsList((prev) => prev.map((f) => (f.id === editingField.id ? updatedObj : f)));
                  invalidateSchemaCaches();
                  setEditingField(null);
                  showToast('Field Updated', `"${updatedObj.name}" updated.`);
                } finally {
                  setIsUpdatingField(false);
                }
              }}
              className="p-6 space-y-4 text-xs"
            >
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-semibold text-slate-700">Field Label *</label>
                  {editValidationAttempted && !editingField.name.trim() && (
                    <span className="text-[11px] font-semibold text-rose-600">Required</span>
                  )}
                </div>
                <input
                  type="text"
                  value={editingField.name}
                  onChange={(e) => setEditingField({ ...editingField, name: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg text-xs focus:outline-none ${
                    editValidationAttempted && !editingField.name.trim()
                      ? INVALID_FIELD_CLASSES
                      : 'border-slate-200 focus:border-brand-600'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Target Entity</label>
                  <CustomSelect
                    value={editingField.entity}
                    onChange={(val) => setEditingField({ ...editingField, entity: val })}
                    ariaLabel="Target Entity"
                    options={[
                      { value: 'consultant', label: 'Consultant Profile' },
                      { value: 'requirement', label: 'Job Requirement' },
                      { value: 'client', label: 'Client Account' },
                      { value: 'vendor', label: 'Staffing Vendor' },
                      { value: 'placement', label: 'Billable Placement' },
                    ]}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Data Type</label>
                  <CustomSelect
                    value={editingField.type}
                    onChange={(val) => setEditingField({ ...editingField, type: val })}
                    ariaLabel="Data Type"
                    options={[
                      { value: 'Dropdown', label: 'Dropdown (Select Option)' },
                      { value: 'Text', label: 'Text (Single Line)' },
                      { value: `Currency (${currencySymbol})`, label: `Currency (${currencySymbol} Amount)` },
                      { value: 'Date', label: 'Date (Calendar Picker)' },
                    ]}
                  />
                </div>
              </div>

              {editingField.type === 'Dropdown' && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Dropdown Options (Comma-separated)
                  </label>
                  <input
                    type="text"
                    value={editingField.options}
                    onChange={(e) => setEditingField({ ...editingField, options: e.target.value })}
                    placeholder="e.g. Option 1, Option 2, Option 3"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                  />
                </div>
              )}

              <label className="flex items-center gap-2 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!editingField.required}
                  onChange={(e) => setEditingField({ ...editingField, required: e.target.checked })}
                  className="w-4 h-4 text-brand-600 rounded"
                />
                <span className="text-xs text-slate-700">Required on forms</span>
              </label>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={isUpdatingField}
                  onClick={() => setEditingField(null)}
                  className="px-3.5 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-60 font-medium rounded-lg text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <ActionButton
                  type="submit"
                  loading={isUpdatingField}
                  loadingText="Saving..."
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg text-xs cursor-pointer"
                >
                  Save Changes
                </ActionButton>
              </div>
            </form>
          </>
        )}
      </AnimatedModal>

      {/* Delete Confirmation Modal */}
      <AnimatedModal
        isOpen={Boolean(confirmDelete)}
        onBackdropClick={() => !isDeletingField && setConfirmDelete(null)}
        zIndexClass="z-50"
        backdropClassName="bg-slate-900/55 backdrop-blur-[2px] flex items-center justify-center p-4"
        panelClassName="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden"
        ariaLabel="Delete Custom Field or Option"
      >
        {confirmDelete && (
            <div className="p-6 space-y-4">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-full bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center flex-shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold text-slate-900">
                    {confirmDelete.type === 'field' ? 'Delete Custom Field' : 'Remove Dropdown Option'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Are you sure you want to delete{' '}
                    <span className="font-semibold text-slate-800">&ldquo;{confirmDelete.label}&rdquo;</span>?{' '}
                    {confirmDelete.type === 'field'
                      ? 'This custom field will be removed from your forms.'
                      : 'This option will no longer appear in the dropdown list.'}
                  </p>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={isDeletingField}
                  onClick={() => setConfirmDelete(null)}
                  className="px-3.5 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-60 font-medium rounded-lg text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <ActionButton
                  type="button"
                  loading={isDeletingField}
                  loadingText="Deleting..."
                  icon={<Trash2 className="w-3.5 h-3.5" />}
                  onClick={async () => {
                    if (isDeletingField) return;
                    const pending = confirmDelete;
                    setIsDeletingField(true);
                    try {
                      if (pending.type === 'field') {
                        await handleDeleteField(pending.id);
                      } else {
                        await handleRemoveTaxonomyOption(pending.category, pending.label);
                      }
                      setConfirmDelete(null);
                    } finally {
                      setIsDeletingField(false);
                    }
                  }}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg text-xs transition-colors cursor-pointer"
                >
                  Delete
                </ActionButton>
              </div>
            </div>
        )}
      </AnimatedModal>
    </section>
  );
};
