import React, { useEffect, useState } from 'react';
import { apiClient } from '../../config/api.config';
import { CustomField } from '../../types';

export type TaxonomyKey = 'workAuth' | 'paymentTerms' | 'education' | 'stages';

export interface MasterTaxonomies {
  workAuth: string[];
  paymentTerms: string[];
  education: string[];
  stages: string[];
}

export const DEFAULT_MASTER_TAXONOMIES: MasterTaxonomies = {
  workAuth: [
    'US Citizen',
    'Green Card (Permanent Resident)',
    'H-1B Specialty Occupation',
    'TN Visa (NAFTA)',
    'OPT / CPT EAD',
  ],
  paymentTerms: ['Net 30 Days', 'Net 45 Days', 'Net 60 Days', 'Net 15 Days', 'Due on Receipt'],
  education: ["Master's Degree (MS/MBA)", "Bachelor's Degree (BS/B.Tech)", 'Doctorate / Ph.D.', 'Associate Degree'],
  stages: ['Requirement', 'Submitted', 'Interview', 'Selected', 'Onboarding'],
};

let cachedTaxonomies: MasterTaxonomies | null = null;
let cachedCustomFields: CustomField[] | null = null;

export function invalidateSchemaCaches() {
  cachedTaxonomies = null;
  cachedCustomFields = null;
}

export function useMasterTaxonomies(isOpen = true) {
  const [taxonomies, setTaxonomies] = useState<MasterTaxonomies>(
    cachedTaxonomies || DEFAULT_MASTER_TAXONOMIES
  );

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    apiClient
      .get<Partial<MasterTaxonomies>>('/taxonomies')
      .then((res) => {
        if (!active) return;
        const data = res?.data;
        if (data && typeof data === 'object') {
          const merged: MasterTaxonomies = {
            workAuth: Array.isArray(data.workAuth) && data.workAuth.length > 0 ? data.workAuth : DEFAULT_MASTER_TAXONOMIES.workAuth,
            paymentTerms: Array.isArray(data.paymentTerms) && data.paymentTerms.length > 0 ? data.paymentTerms : DEFAULT_MASTER_TAXONOMIES.paymentTerms,
            education: Array.isArray(data.education) && data.education.length > 0 ? data.education : DEFAULT_MASTER_TAXONOMIES.education,
            stages: Array.isArray(data.stages) && data.stages.length > 0 ? data.stages : DEFAULT_MASTER_TAXONOMIES.stages,
          };
          cachedTaxonomies = merged;
          setTaxonomies(merged);
        }
      })
      .catch(() => {
        // Keep cached or default taxonomies
      });
    return () => {
      active = false;
    };
  }, [isOpen]);

  return taxonomies;
}

interface DynamicCustomFieldsSectionProps {
  entity: 'consultant' | 'requirement' | 'client' | 'vendor' | 'placement';
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
  isOpen?: boolean;
}

export const DynamicCustomFieldsSection: React.FC<DynamicCustomFieldsSectionProps> = ({
  entity,
  values,
  onChange,
  isOpen = true,
}) => {
  const [fields, setFields] = useState<CustomField[]>(() =>
    (cachedCustomFields || []).filter((f) => f.entity === entity && f.active !== false)
  );

  useEffect(() => {
    if (!isOpen) return;
    let mounted = true;
    apiClient
      .get<CustomField[]>('/custom-fields')
      .then((res) => {
        if (!mounted) return;
        if (Array.isArray(res?.data)) {
          cachedCustomFields = res.data;
          setFields(res.data.filter((f) => f.entity === entity && f.active !== false));
        }
      })
      .catch(() => {
        // Fallback to cached fields if network request fails
      });
    return () => {
      mounted = false;
    };
  }, [entity, isOpen]);

  if (fields.length === 0) return null;

  const handleFieldChange = (fieldName: string, val: string) => {
    onChange({ ...values, [fieldName]: val });
  };

  return (
    <div className="pt-3.5 border-t border-slate-100 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Custom Fields
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {fields.map((field) => {
          const val = values[field.name] ?? '';
          const fieldType = String(field.type || 'Text');

          return (
            <div key={field.id || field.name}>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                {field.name} {field.required ? '*' : ''}
              </label>
              {fieldType === 'Dropdown' ? (
                <select
                  required={!!field.required}
                  value={val}
                  onChange={(e) => handleFieldChange(field.name, e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 bg-white text-slate-800"
                >
                  <option value="">Select {field.name}...</option>
                  {(field.options || '')
                    .split(',')
                    .map((opt) => opt.trim())
                    .filter(Boolean)
                    .map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                </select>
              ) : fieldType === 'Date' ? (
                <input
                  type="date"
                  required={!!field.required}
                  value={val}
                  onChange={(e) => handleFieldChange(field.name, e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-800"
                />
              ) : (
                <input
                  type={fieldType === 'Number' ? 'number' : 'text'}
                  required={!!field.required}
                  value={val}
                  onChange={(e) => handleFieldChange(field.name, e.target.value)}
                  placeholder={`Enter ${field.name.toLowerCase()}...`}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-800 placeholder:text-slate-400"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

