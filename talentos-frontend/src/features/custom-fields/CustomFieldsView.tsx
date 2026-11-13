import React, { useState, useEffect } from 'react';
import { apiClient } from '../../config/api.config';
import { CustomField } from '../../types';

interface CustomFieldsViewProps {
  customFields?: CustomField[];
  onAddCustomField?: (field: CustomField) => void;
  showToast: (title: string, message: string, icon?: string) => void;
}

export const CustomFieldsView: React.FC<CustomFieldsViewProps> = ({
  customFields: propCustomFields,
  onAddCustomField,
  showToast,
}) => {
  const [scope, setScope] = useState<'all' | 'consultant' | 'requirement' | 'client' | 'vendor' | 'placement'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [fieldsList, setFieldsList] = useState<any[]>(propCustomFields || []);

  useEffect(() => {
    if (propCustomFields && propCustomFields.length) {
      setFieldsList(propCustomFields);
      return;
    }
    apiClient.get('/custom-fields')
      .then((res) => {
        if (res.data?.success && Array.isArray(res.data.data)) {
          const mapped = res.data.data.map((f: any) => ({
            id: f.id,
            name: f.name,
            entity: (f.entity || 'consultant').toLowerCase(),
            entityLabel: (f.entity || 'Consultant').charAt(0).toUpperCase() + (f.entity || 'Consultant').slice(1).toLowerCase(),
            type: f.type === 'NUMBER' ? 'Currency ($)' : f.type === 'DROPDOWN' ? 'Dropdown' : f.type === 'DATE' ? 'Date' : 'Text',
            options: Array.isArray(f.options) ? f.options.join(', ') : (typeof f.options === 'object' && f.options?.values ? f.options.values : (typeof f.options === 'string' ? f.options : 'Standard Format')),
            required: !!f.required,
            active: f.active ?? true,
          }));
          setFieldsList(mapped);
        }
      })
      .catch((err) => console.warn('Fetch custom fields error:', err));
  }, [propCustomFields]);

  const [masterTaxonomies, setMasterTaxonomies] = useState({
    workAuth: ['US Citizen', 'Green Card (Permanent Resident)', 'H-1B Specialty Occupation', 'TN Visa (NAFTA)', 'OPT / CPT EAD'],
    paymentTerms: ['Net 30 Days', 'Net 45 Days', 'Net 60 Days', 'Net 15 Days', 'Due on Receipt'],
    education: ["Master's Degree (MS/MBA)", "Bachelor's Degree (BS/B.Tech)", "Doctorate / Ph.D.", "Associate Degree"],
    stages: ['Requirement', 'Submitted', 'Interview', 'Selected', 'Onboarding'],
  });

  const [newField, setNewField] = useState({
    name: '',
    entity: 'consultant',
    type: 'Dropdown',
    options: '',
    required: false,
  });

  const filteredFields = fieldsList.filter(
    (f) => scope === 'all' || f.entity === scope
  );

  const handleDeleteField = async (id: string) => {
    try {
      await apiClient.delete(`/custom-fields/${id}`);
    } catch (err) {
      console.warn('Delete custom field API:', err);
    }
    setFieldsList((prev) => prev.filter((f) => f.id !== id));
    showToast('Field Removed', 'Custom field removed from registry.', 'fa-solid fa-trash-can text-slate-500');
  };

  const handleToggleFieldActive = (id: string) => {
    setFieldsList((prev) =>
      prev.map((f) => (f.id === id ? { ...f, active: !f.active } : f))
    );
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
            <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs shadow-xs">
              <i className="fa-solid fa-tags"></i>
            </span>
            <span>Custom Fields & Master Taxonomy</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Extend recruitment entity data models and maintain standardized dropdown selection lists.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg text-xs flex items-center gap-1.5 shadow-2xs transition-colors self-start sm:self-auto cursor-pointer"
        >
          <i className="fa-solid fa-plus text-[10px]"></i>
          <span>Add Custom Field</span>
        </button>
      </div>

      {/* Entity Custom Fields Registry Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <i className="fa-solid fa-table-columns text-brand-600 text-xs"></i>
              <span>Entity Custom Fields Registry</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Custom attributes configured across Candidates, Requisitions, Clients, Vendors, and Placements.
            </p>
          </div>
          <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
            {fieldsList.length} Active Fields
          </span>
        </div>

        {/* Scope Tabs Filter */}
        <div className="px-5 py-2.5 border-b border-slate-200 flex flex-wrap items-center gap-1.5 text-xs bg-white">
          <span className="text-[11px] font-semibold text-slate-400 mr-1 uppercase tracking-wider font-mono">
            Filter Entity:
          </span>
          <button
            onClick={() => setScope('all')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
              scope === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            All ({fieldsList.length})
          </button>
          <button
            onClick={() => setScope('consultant')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
              scope === 'consultant' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Consultants
          </button>
          <button
            onClick={() => setScope('requirement')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
              scope === 'requirement' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Requirements
          </button>
          <button
            onClick={() => setScope('client')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
              scope === 'client' ? 'bg-purple-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Clients
          </button>
          <button
            onClick={() => setScope('vendor')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
              scope === 'vendor' ? 'bg-amber-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Vendors
          </button>
          <button
            onClick={() => setScope('placement')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
              scope === 'placement' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Placements
          </button>
        </div>

        {/* Custom Fields Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 font-mono">
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
                  {/* Field Label with Grip Icon */}
                  <td className="py-3 px-5 font-semibold text-slate-800 flex items-center gap-2">
                    <i className="fa-solid fa-grip-vertical text-slate-300 text-[10px]"></i>
                    <span>{field.name}</span>
                  </td>

                  {/* Target Entity Badge */}
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                        field.entity === 'consultant'
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                          : field.entity === 'requirement'
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : field.entity === 'client'
                          ? 'bg-purple-50 text-purple-700 border-purple-200'
                          : field.entity === 'vendor'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}
                    >
                      {field.entityLabel}
                    </span>
                  </td>

                  {/* Data Type Badge with Icon */}
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                      {field.type === 'Dropdown' ? (
                        <i className="fa-solid fa-list-check text-slate-500 text-[10px]"></i>
                      ) : field.type === 'Currency ($)' ? (
                        <i className="fa-solid fa-dollar-sign text-emerald-500 text-[10px]"></i>
                      ) : field.type === 'Date' ? (
                        <i className="fa-solid fa-calendar text-blue-500 text-[10px]"></i>
                      ) : (
                        <i className="fa-solid fa-font text-slate-500 text-[10px]"></i>
                      )}
                      <span>{field.type}</span>
                    </span>
                  </td>

                  {/* Options / Format */}
                  <td className="py-3 px-4 text-slate-500 text-[11px] max-w-xs truncate font-mono">
                    {field.options}
                  </td>

                  {/* Mandatory vs Optional */}
                  <td className="py-3 px-4">
                    {field.required ? (
                      <span className="text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
                        Mandatory
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400">Optional</span>
                    )}
                  </td>

                  {/* Status Toggle */}
                  <td className="py-3 px-4">
                    <button
                      onClick={() => handleToggleFieldActive(field.id)}
                      className="flex items-center gap-1.5 cursor-pointer"
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          field.active ? 'bg-emerald-500' : 'bg-slate-300'
                        }`}
                      ></span>
                      <span
                        className={`text-[11px] font-medium ${
                          field.active ? 'text-emerald-700 font-semibold' : 'text-slate-400'
                        }`}
                      >
                        {field.active ? 'Active' : 'Disabled'}
                      </span>
                    </button>
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-5 text-right">
                    <button
                      onClick={() => handleDeleteField(field.id)}
                      title="Delete Custom Field"
                      className="text-slate-400 hover:text-rose-600 w-7 h-7 rounded hover:bg-rose-50 inline-flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <i className="fa-solid fa-trash-can text-xs"></i>
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
              <i className="fa-solid fa-layer-group text-indigo-600 text-xs"></i>
              <span>Configurable Master Dropdowns & Taxonomies</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Standardized selection lists used throughout intake forms, pipelines, and search filters.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {/* 1. Work Authorization */}
          <div className="p-3.5 bg-slate-50/70 rounded-xl border border-slate-200 space-y-2">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <i className="fa-solid fa-passport text-blue-600"></i>
              <span>Work Authorizations</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {masterTaxonomies.workAuth.map((item) => (
                <span
                  key={item}
                  className="px-2 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-medium text-slate-700 shadow-2xs"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          {/* 2. Payment Terms */}
          <div className="p-3.5 bg-slate-50/70 rounded-xl border border-slate-200 space-y-2">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <i className="fa-solid fa-credit-card text-emerald-600"></i>
              <span>Payment Terms</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {masterTaxonomies.paymentTerms.map((item) => (
                <span
                  key={item}
                  className="px-2 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-medium text-slate-700 shadow-2xs"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          {/* 3. Education Degrees */}
          <div className="p-3.5 bg-slate-50/70 rounded-xl border border-slate-200 space-y-2">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <i className="fa-solid fa-graduation-cap text-indigo-600"></i>
              <span>Education Degrees</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {masterTaxonomies.education.map((item) => (
                <span
                  key={item}
                  className="px-2 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-medium text-slate-700 shadow-2xs"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          {/* 4. Pipeline Stages */}
          <div className="p-3.5 bg-slate-50/70 rounded-xl border border-slate-200 space-y-2">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <i className="fa-solid fa-bars-staggered text-purple-600"></i>
              <span>Pipeline Stages</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {masterTaxonomies.stages.map((item) => (
                <span
                  key={item}
                  className="px-2 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-medium text-slate-700 shadow-2xs"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Add Custom Field Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-scale-up">
            <div className="px-6 py-4 bg-[#0B0F17] text-white flex items-center justify-between border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-sm">
                  <i className="fa-solid fa-tag"></i>
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
                <i className="fa-solid fa-xmark text-sm"></i>
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
                  <i className="fa-solid fa-plus text-[10px]"></i>
                  <span>Register Field</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
