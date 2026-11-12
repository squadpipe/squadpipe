import React, { useState } from 'react';
import { CustomField } from '../../types';

interface CustomFieldsViewProps {
  customFields: CustomField[];
  onAddCustomField: (field: CustomField) => void;
  showToast: (title: string, message: string, icon?: string) => void;
}

export const CustomFieldsView: React.FC<CustomFieldsViewProps> = ({
  customFields,
  onAddCustomField,
  showToast,
}) => {
  const [scope, setScope] = useState('all');
  const [masterDropdowns, setMasterDropdowns] = useState({
    workAuth: ['US Citizen', 'Green Card (Permanent Resident)', 'H-1B Specialty Occupation', 'TN Visa (NAFTA)', 'OPT / CPT EAD'],
    paymentTerms: ['Net 30 Days', 'Net 45 Days', 'Net 60 Days', 'Net 15 Days', 'Due on Receipt'],
    education: ["Master's Degree (MS/MBA)", "Bachelor's Degree (BS/B.Tech)", "Doctorate / Ph.D.", "Associate Degree"],
    stages: ['Requirement', 'Submitted', 'Interview', 'Selected', 'Onboarding'],
  });

  const [newOption, setNewOption] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<keyof typeof masterDropdowns>('workAuth');

  const filteredFields = customFields.filter(
    (f) => scope === 'all' || f.entity === scope
  );

  const handleAddOption = () => {
    if (!newOption.trim()) return;
    if (masterDropdowns[selectedCategory].includes(newOption.trim())) {
      showToast('Duplicate', `"${newOption}" already exists.`);
      return;
    }
    setMasterDropdowns({
      ...masterDropdowns,
      [selectedCategory]: [...masterDropdowns[selectedCategory], newOption.trim()],
    });
    setNewOption('');
    showToast('Taxonomy Updated', `Added "${newOption}" to master dropdown options!`, 'fa-solid fa-circle-check text-emerald-400');
  };

  const handleRemoveOption = (idx: number) => {
    const list = [...masterDropdowns[selectedCategory]];
    const removed = list.splice(idx, 1);
    setMasterDropdowns({
      ...masterDropdowns,
      [selectedCategory]: list,
    });
    showToast('Removed', `Removed "${removed[0]}".`);
  };

  return (
    <div className="space-y-6">
      {/* Master Configurable Dropdowns Editor */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 card-shadow space-y-4">
        <div>
          <h3 className="font-bold text-sm text-slate-800">Master Configurable Dropdown Taxonomy</h3>
          <p className="text-xs text-slate-400">Controls universal options populated in candidate work auth, payment terms, and education fields</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {(['workAuth', 'paymentTerms', 'education', 'stages'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                selectedCategory === cat
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat === 'workAuth'
                ? 'Work Authorization'
                : cat === 'paymentTerms'
                ? 'Payment Terms'
                : cat === 'education'
                ? 'Education'
                : 'Pipeline Stages'}
            </button>
          ))}
        </div>

        {/* Selected Category Options */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
          <div className="flex flex-wrap gap-2">
            {masterDropdowns[selectedCategory].map((opt, idx) => (
              <span
                key={idx}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-white text-slate-700 border border-slate-200 flex items-center gap-1.5 shadow-sm"
              >
                <span>{opt}</span>
                <button
                  onClick={() => handleRemoveOption(idx)}
                  className="text-slate-400 hover:text-rose-500 text-[10px]"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </span>
            ))}
          </div>

          <div className="flex gap-2 max-w-md pt-2">
            <input
              type="text"
              value={newOption}
              onChange={(e) => setNewOption(e.target.value)}
              placeholder="Add new option value..."
              className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg flex-1 text-slate-800"
            />
            <button
              onClick={handleAddOption}
              className="px-3 py-1.5 bg-brand-600 text-white text-xs font-semibold rounded-lg hover:bg-brand-700 transition-colors"
            >
              Add Option
            </button>
          </div>
        </div>
      </div>

      {/* Dynamic Custom Fields List */}
      <div className="bg-white rounded-xl border border-slate-200 card-shadow overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="font-bold text-xs text-slate-800">Dynamic Entity Custom Fields</h3>
            <p className="text-[11px] text-slate-400">Custom data schemas attached to candidates, requirements, clients & vendors</p>
          </div>
          <div className="flex gap-1">
            {(['all', 'consultant', 'requirement', 'client', 'vendor', 'placement'] as const).map((sc) => (
              <button
                key={sc}
                onClick={() => setScope(sc)}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold capitalize ${
                  scope === sc ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {sc}
              </button>
            ))}
          </div>
        </div>

        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-200">
              <th className="py-2.5 px-4">Field Name</th>
              <th className="py-2.5 px-4">Target Entity</th>
              <th className="py-2.5 px-4">Data Type</th>
              <th className="py-2.5 px-4">Configured Options</th>
              <th className="py-2.5 px-4">Required</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredFields.map((field) => (
              <tr key={field.id} className="hover:bg-slate-50/60">
                <td className="py-3 px-4 font-bold text-slate-900">{field.name}</td>
                <td className="py-3 px-4 font-semibold text-brand-600 capitalize">{field.entityLabel}</td>
                <td className="py-3 px-4 font-mono text-[11px] text-slate-600">{field.type}</td>
                <td className="py-3 px-4 text-slate-500 text-[11px] font-mono">{field.options}</td>
                <td className="py-3 px-4">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      field.required
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {field.required ? 'Mandatory' : 'Optional'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
