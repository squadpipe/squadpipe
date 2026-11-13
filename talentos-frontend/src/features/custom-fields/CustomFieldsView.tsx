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
} from 'lucide-react';
import { apiClient } from '../../config/api.config';
import { CustomField } from '../../types';
import { invalidateSchemaCaches } from '../../components/shared/DynamicCustomFieldsSection';
import { useCurrency } from '../../utils/currency';

interface CustomFieldsViewProps {
  customFields?: CustomField[];
  onAddCustomField?: (field: CustomField) => void;
  showToast: (title: string, message: string, icon?: string) => void;
}

type TaxonomyKey = 'workAuth' | 'paymentTerms' | 'education' | 'stages';

const DEFAULT_TAXONOMIES: Record<TaxonomyKey, string[]> = {
  workAuth: ['US Citizen', 'Green Card (Permanent Resident)', 'H-1B Specialty Occupation', 'TN Visa (NAFTA)', 'OPT / CPT EAD'],
  paymentTerms: ['Net 30 Days', 'Net 45 Days', 'Net 60 Days', 'Net 15 Days', 'Due on Receipt'],
  education: ["Master's Degree (MS/MBA)", "Bachelor's Degree (BS/B.Tech)", 'Doctorate / Ph.D.', 'Associate Degree'],
  stages: ['Requirement', 'Submitted', 'Interview', 'Selected', 'Onboarding'],
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
  customFields: propCustomFields,
  onAddCustomField,
  showToast,
}) => {
  const { symbol: currencySymbol } = useCurrency();
  const [activeSection, setActiveSection] = useState<'fields' | 'dropdowns'>('fields');
  const [scope, setScope] = useState<'all' | 'consultant' | 'requirement' | 'client' | 'vendor' | 'placement'>('all');
  const [activeTaxonomy, setActiveTaxonomy] = useState<TaxonomyKey>('workAuth');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingField, setEditingField] = useState<any | null>(null);
  const [fieldsList, setFieldsList] = useState<any[]>(propCustomFields || []);

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

  useEffect(() => {
    if (propCustomFields && propCustomFields.length) {
      setFieldsList(propCustomFields);
      return;
    }
    apiClient
      .get('/custom-fields')
      .then((res) => {
        if (res.data?.success && Array.isArray(res.data.data)) {
          const mapped = res.data.data.map((f: any) => ({
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
          }));
          setFieldsList(mapped);
        }
      })
      .catch((err) => console.warn('Fetch custom fields error:', err));
  }, [propCustomFields]);

  const [newField, setNewField] = useState({
    name: '',
    entity: 'consultant',
    type: 'Dropdown',
    options: '',
    required: false,
  });

  const filteredFields = fieldsList.filter((f) => scope === 'all' || f.entity === scope);

  const handleAddTaxonomyOption = async (category: TaxonomyKey) => {
    const val = (newTaxInput[category] || '').trim();
    if (!val) return;
    if (masterTaxonomies[category].some((item) => item.toLowerCase() === val.toLowerCase())) {
      showToast('Already Exists', `"${val}" is already in this list.`, 'fa-solid fa-circle-info text-amber-500');
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
    showToast('Option Added', `Added "${val}" to master dropdown.`, 'fa-solid fa-circle-check text-emerald-500');
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
    showToast('Option Updated', `Updated "${oldValue}" to "${trimmed}".`, 'fa-solid fa-circle-check text-emerald-500');
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
    showToast('Option Removed', `Removed "${optionValue}" from master dropdown.`, 'fa-solid fa-trash-can text-slate-500');
  };

  const handleDeleteField = async (id: string) => {
    try {
      await apiClient.delete(`/custom-fields/${id}`);
    } catch (err) {
      console.warn('Delete custom field API:', err);
    }
    setFieldsList((prev) => prev.filter((f) => f.id !== id));
    invalidateSchemaCaches();
    showToast('Field Removed', 'Custom field removed from registry.', 'fa-solid fa-trash-can text-slate-500');
  };

  const handleToggleFieldActive = (id: string) => {
    setFieldsList((prev) => prev.map((f) => (f.id === id ? { ...f, active: !f.active } : f)));
    invalidateSchemaCaches();
  };

  const handleCreateField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newField.name.trim()) return;

    const entityLabelMap: Record<string, string> = {
      consultant: 'Consultant',
      requirement: 'Requirement',
      client: 'Client',
      vendor: 'Vendor',
      placement: 'Placement',
    };

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
      showToast('Field Registered', `Added "${created.name}" to ${created.entityLabel} registry!`, 'fa-solid fa-circle-check text-indigo-500');
      setNewField({
        name: '',
        entity: 'consultant',
        type: 'Dropdown',
        options: '',
        required: false,
      });
    } catch (err: any) {
      showToast('Failed to Save', err.message || 'Error saving custom field to database.', 'fa-solid fa-triangle-exclamation text-rose-500');
    }
  };

  return (
    <section className="max-w-7xl mx-auto space-y-5 animate-fade-in select-none">
      {/* Page Header with Clean 2-Tab Segmented Switcher */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shadow-xs">
              <Tags className="w-4 h-4" />
            </span>
            <span>Form Fields &amp; Dropdown Lists</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Add custom questions to intake forms or customize standard dropdown options.
          </p>
        </div>

        <div className="inline-flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 self-start md:self-auto">
          <button
            type="button"
            onClick={() => setActiveSection('fields')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              activeSection === 'fields'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Columns className="w-3.5 h-3.5" />
            <span>Custom Form Fields</span>
            <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
              {fieldsList.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('dropdowns')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              activeSection === 'dropdowns'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Master Dropdown Lists</span>
            <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
              {TAXONOMY_META.length} Lists
            </span>
          </button>
        </div>
      </div>

      {/* Tab 1: Custom Form Fields */}
      {activeSection === 'fields' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
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
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'text-slate-600 hover:bg-white hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg text-xs flex items-center gap-1.5 shadow-2xs transition-colors self-start sm:self-auto cursor-pointer flex-shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Custom Field</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <th className="py-2.5 px-5">Field Name</th>
                  <th className="py-2.5 px-4">Form</th>
                  <th className="py-2.5 px-4">Input Type</th>
                  <th className="py-2.5 px-4">Dropdown Options</th>
                  <th className="py-2.5 px-4">Required</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredFields.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-xs text-slate-400">
                      No custom fields added for this form yet. Click <span className="font-semibold text-slate-600">Add Custom Field</span> to create one.
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
        </div>
      )}

      {/* Tab 2: Master Dropdown Lists (2-Column Master-Detail) */}
      {activeSection === 'dropdowns' && (() => {
        const currentMeta = TAXONOMY_META.find((m) => m.key === activeTaxonomy) || TAXONOMY_META[0];
        const currentOptions = masterTaxonomies[activeTaxonomy] || [];

        return (
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
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
                          ? 'bg-white border-slate-300 shadow-xs text-slate-900'
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
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-scale-up">
            <div className="px-6 py-4 bg-[#0B0F17] text-white flex items-center justify-between border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                  <Tags className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-tight">Create Entity Custom Field</h3>
                  <div className="text-[11px] text-slate-400">Configure custom attribute and data schema</div>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateField} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Field Label <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Security Clearance Level"
                  value={newField.name}
                  onChange={(e) => setNewField({ ...newField, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:border-indigo-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Target Entity</label>
                  <select
                    value={newField.entity}
                    onChange={(e) => setNewField({ ...newField, entity: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:border-indigo-600 focus:outline-none cursor-pointer"
                  >
                    <option value="consultant">Consultant Profile</option>
                    <option value="requirement">Job Requirement</option>
                    <option value="client">Client Account</option>
                    <option value="vendor">Staffing Vendor</option>
                    <option value="placement">Billable Placement</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Data Type</label>
                  <select
                    value={newField.type}
                    onChange={(e) => setNewField({ ...newField, type: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:border-indigo-600 focus:outline-none cursor-pointer"
                  >
                    <option value="Dropdown">Dropdown (Select Option)</option>
                    <option value="Text">Text (Single Line)</option>
                    <option value="Currency ($)">Currency ({currencySymbol} Amount)</option>
                    <option value="Date">Date (Calendar Picker)</option>
                  </select>
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
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:border-indigo-600 focus:outline-none"
                  />
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="req_field"
                  checked={newField.required}
                  onChange={(e) => setNewField({ ...newField, required: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
                />
                <label htmlFor="req_field" className="text-xs text-slate-700 cursor-pointer">
                  Mark this field as mandatory across intake forms
                </label>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-2 border border-slate-200 text-slate-600 hover:bg-slate-100 font-semibold rounded-lg text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-xs shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Register Field</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Custom Field Modal */}
      {editingField && (
        <div
          onClick={() => setEditingField(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-scale-up"
          >
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Edit Custom Field</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">{editingField.name}</p>
              </div>
              <button
                onClick={() => setEditingField(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!editingField.name.trim()) return;
                const entityLabelMap: Record<string, string> = {
                  consultant: 'Consultant',
                  requirement: 'Requirement',
                  client: 'Client',
                  vendor: 'Vendor',
                  placement: 'Placement',
                };
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
              }}
              className="p-6 space-y-4 text-xs"
            >
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Field Label *</label>
                <input
                  type="text"
                  required
                  value={editingField.name}
                  onChange={(e) => setEditingField({ ...editingField, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Target Entity</label>
                  <select
                    value={editingField.entity}
                    onChange={(e) => setEditingField({ ...editingField, entity: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:border-brand-600 focus:outline-none cursor-pointer"
                  >
                    <option value="consultant">Consultant Profile</option>
                    <option value="requirement">Job Requirement</option>
                    <option value="client">Client Account</option>
                    <option value="vendor">Staffing Vendor</option>
                    <option value="placement">Billable Placement</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Data Type</label>
                  <select
                    value={editingField.type}
                    onChange={(e) => setEditingField({ ...editingField, type: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:border-brand-600 focus:outline-none cursor-pointer"
                  >
                    <option value="Dropdown">Dropdown (Select Option)</option>
                    <option value="Text">Text (Single Line)</option>
                    <option value="Currency ($)">Currency ({currencySymbol} Amount)</option>
                    <option value="Date">Date (Calendar Picker)</option>
                  </select>
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
                <span className="text-xs text-slate-700">Mandatory across intake forms</span>
              </label>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingField(null)}
                  className="px-3.5 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium rounded-lg text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg text-xs cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div
          onClick={() => setConfirmDelete(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-scale-up"
          >
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
                      ? 'This custom field will be removed from intake forms.'
                      : 'This option will no longer appear in the dropdown list.'}
                  </p>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(null)}
                  className="px-3.5 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium rounded-lg text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const pending = confirmDelete;
                    setConfirmDelete(null);
                    if (pending.type === 'field') {
                      await handleDeleteField(pending.id);
                    } else {
                      await handleRemoveTaxonomyOption(pending.category, pending.label);
                    }
                  }}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg text-xs shadow-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
