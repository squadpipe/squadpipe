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
  placeholder: string;
  icon: React.ReactNode;
}> = [
  {
    key: 'workAuth',
    title: 'Work Authorizations',
    placeholder: 'Add visa / work auth...',
    icon: <ShieldCheck className="w-4 h-4 text-blue-600" />,
  },
  {
    key: 'paymentTerms',
    title: 'Payment Terms',
    placeholder: 'Add payment term...',
    icon: <CreditCard className="w-4 h-4 text-emerald-600" />,
  },
  {
    key: 'education',
    title: 'Education Degrees',
    placeholder: 'Add degree level...',
    icon: <GraduationCap className="w-4 h-4 text-indigo-600" />,
  },
  {
    key: 'stages',
    title: 'Pipeline Stages',
    placeholder: 'Add stage label...',
    icon: <GitBranch className="w-4 h-4 text-purple-600" />,
  },
];

export const CustomFieldsView: React.FC<CustomFieldsViewProps> = ({
  customFields: propCustomFields,
  onAddCustomField,
  showToast,
}) => {
  const [scope, setScope] = useState<'all' | 'consultant' | 'requirement' | 'client' | 'vendor' | 'placement'>('all');
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

  useEffect(() => {
    apiClient
      .get('/taxonomies')
      .then((res) => {
        if (res.data?.success && res.data.data) {
          setMasterTaxonomies({
            workAuth: Array.isArray(res.data.data.workAuth) ? res.data.data.workAuth : DEFAULT_TAXONOMIES.workAuth,
            paymentTerms: Array.isArray(res.data.data.paymentTerms) ? res.data.data.paymentTerms : DEFAULT_TAXONOMIES.paymentTerms,
            education: Array.isArray(res.data.data.education) ? res.data.data.education : DEFAULT_TAXONOMIES.education,
            stages: Array.isArray(res.data.data.stages) ? res.data.data.stages : DEFAULT_TAXONOMIES.stages,
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
            type: f.type === 'NUMBER' ? 'Currency ($)' : f.type === 'DROPDOWN' ? 'Dropdown' : f.type === 'DATE' ? 'Date' : 'Text',
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
    <section className="max-w-7xl mx-auto space-y-6 animate-fade-in select-none">
      {/* Page Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Tags className="w-3.5 h-3.5" />
            </span>
            <span>Custom Fields &amp; Master Taxonomy</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Extend recruitment entity data models and manage standardized dropdown selection lists.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg text-xs flex items-center gap-1.5 shadow-2xs transition-colors self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Custom Field</span>
        </button>
      </div>

      {/* Entity Custom Fields Registry Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Columns className="w-4 h-4 text-brand-600" />
              <span>Entity Custom Fields Registry</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Custom attributes configured across Candidates, Requisitions, Clients, Vendors, and Placements.
            </p>
          </div>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
            {fieldsList.length} Active Fields
          </span>
        </div>

        {/* Scope Tabs Filter */}
        <div className="px-5 py-2.5 border-b border-slate-200 flex flex-wrap items-center gap-1.5 text-xs bg-white">
          <span className="text-[11px] font-semibold text-slate-400 mr-1 uppercase tracking-wider">
            Filter Entity:
          </span>
          {(
            [
              { key: 'all', label: `All (${fieldsList.length})` },
              { key: 'consultant', label: 'Consultants' },
              { key: 'requirement', label: 'Requirements' },
              { key: 'client', label: 'Clients' },
              { key: 'vendor', label: 'Vendors' },
              { key: 'placement', label: 'Placements' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setScope(tab.key)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                scope === tab.key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Custom Fields Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <th className="py-2.5 px-5">Field Label</th>
                <th className="py-2.5 px-4">Target Entity</th>
                <th className="py-2.5 px-4">Data Type</th>
                <th className="py-2.5 px-4">Options / Format</th>
                <th className="py-2.5 px-4">Requirement</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredFields.map((field) => (
                <tr key={field.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-3 px-5 font-semibold text-slate-800 flex items-center gap-2">
                    <GripVertical className="w-3.5 h-3.5 text-slate-300" />
                    <span>{field.name}</span>
                  </td>

                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200/80">
                      {field.entityLabel}
                    </span>
                  </td>

                  <td className="py-3 px-4 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200/80 font-medium">
                      {field.type === 'Dropdown' ? (
                        <ListChecks className="w-3 h-3 text-slate-500" />
                      ) : field.type === 'Currency ($)' ? (
                        <DollarSign className="w-3 h-3 text-slate-500" />
                      ) : field.type === 'Date' ? (
                        <Calendar className="w-3 h-3 text-slate-500" />
                      ) : (
                        <Type className="w-3 h-3 text-slate-500" />
                      )}
                      <span>{field.type}</span>
                    </span>
                  </td>

                  <td className="py-3 px-4 text-slate-500 text-[11px] max-w-xs truncate">{field.options}</td>

                  <td className="py-3 px-4">
                    {field.required ? (
                      <span className="text-xs font-medium text-slate-800 bg-slate-100 border border-slate-200/80 px-2 py-0.5 rounded-md">
                        Mandatory
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">Optional</span>
                    )}
                  </td>

                  <td className="py-3 px-4">
                    <button onClick={() => handleToggleFieldActive(field.id)} className="flex items-center gap-1.5 cursor-pointer">
                      <span className={`w-2 h-2 rounded-full ${field.active ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                      <span className={`text-[11px] font-medium ${field.active ? 'text-emerald-700 font-semibold' : 'text-slate-400'}`}>
                        {field.active ? 'Active' : 'Disabled'}
                      </span>
                    </button>
                  </td>

                  <td className="py-3 px-5 text-right whitespace-nowrap">
                    <button
                      onClick={() => setEditingField({ ...field })}
                      title="Edit Custom Field"
                      className="text-slate-400 hover:text-brand-600 w-7 h-7 rounded hover:bg-brand-50 inline-flex items-center justify-center transition-colors cursor-pointer mr-0.5"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteField(field.id)}
                      title="Delete Custom Field"
                      className="text-slate-400 hover:text-rose-600 w-7 h-7 rounded hover:bg-rose-50 inline-flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Configurable Master Dropdowns & Taxonomies */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              <span>Configurable Master Dropdowns &amp; Taxonomies</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Click any option to rename it, remove items with X, or add new dropdown values below each list.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {TAXONOMY_META.map((cat) => (
            <div key={cat.key} className="p-3.5 bg-slate-50/70 rounded-xl border border-slate-200 flex flex-col justify-between gap-3">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    {cat.icon}
                    <span>{cat.title}</span>
                  </div>
                  <span className="text-[10px] font-medium text-slate-400">{masterTaxonomies[cat.key].length}</span>
                </div>

                <div className="divide-y divide-slate-100 bg-white rounded-lg border border-slate-200 max-h-52 overflow-y-auto">
                  {masterTaxonomies[cat.key].map((item, idx) => {
                    const isEditing = editingTax?.category === cat.key && editingTax?.index === idx;
                    if (isEditing) {
                      return (
                        <div key={`${item}-${idx}`} className="flex items-center gap-1.5 bg-brand-50/40 px-3 py-2">
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
                            className="flex-1 min-w-0 text-xs text-slate-800 bg-white border border-brand-400 rounded px-2 py-1 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={handleSaveEditTaxonomy}
                            title="Save"
                            className="p-1 text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingTax(null)}
                            title="Cancel"
                            className="p-1 text-slate-400 hover:bg-slate-100 rounded cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={`${item}-${idx}`}
                        className="group flex items-center justify-between px-3 py-2 text-xs text-slate-700 hover:bg-slate-50/80 transition-colors gap-2"
                      >
                        <button
                          type="button"
                          onClick={() => setEditingTax({ category: cat.key, index: idx, value: item })}
                          title="Click to rename"
                          className="flex-1 min-w-0 truncate text-left font-medium text-slate-700 hover:text-slate-900 cursor-pointer"
                        >
                          {item}
                        </button>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => setEditingTax({ category: cat.key, index: idx, value: item })}
                            title="Rename option"
                            className="p-1 text-slate-400 hover:text-brand-600 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveTaxonomyOption(cat.key, item)}
                            title="Remove option"
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-1.5 pt-2 border-t border-slate-200/80">
                <input
                  type="text"
                  value={newTaxInput[cat.key]}
                  onChange={(e) => setNewTaxInput((prev) => ({ ...prev, [cat.key]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTaxonomyOption(cat.key);
                    }
                  }}
                  placeholder={cat.placeholder}
                  className="flex-1 min-w-0 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] text-slate-700 placeholder-slate-400 focus:border-brand-600 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleAddTaxonomyOption(cat.key)}
                  className="px-2.5 py-1.5 bg-slate-900 hover:bg-black text-white rounded-lg text-[11px] font-medium inline-flex items-center gap-1 transition-colors cursor-pointer flex-shrink-0"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

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
                    <option value="Currency ($)">Currency ($ Amount)</option>
                    <option value="Date">Date (Calendar Picker)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Options / Placeholder Format (Comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. None, Secret, Top Secret, TS/SCI"
                  value={newField.options}
                  onChange={(e) => setNewField({ ...newField, options: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:border-indigo-600 focus:outline-none"
                />
              </div>

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
                    <option value="Currency ($)">Currency ($ Amount)</option>
                    <option value="Date">Date (Calendar Picker)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Options / Placeholder Format</label>
                <input
                  type="text"
                  value={editingField.options}
                  onChange={(e) => setEditingField({ ...editingField, options: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                />
              </div>

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
    </section>
  );
};
