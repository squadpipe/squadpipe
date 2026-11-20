import React, { useEffect, useState } from 'react';
import { apiClient } from '../../config/api.config';
import { CustomField, CustomQuestionFieldType } from '../../types';
import { CustomQuestionFieldInput } from './CustomQuestionFieldInput';

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
  stages: ['Requirement', 'Submitted', 'Interview', 'Selected', 'Onboarding', 'Billable', 'Archived'],
};

let cachedTaxonomies: MasterTaxonomies | null = null;
let cachedCustomFields: CustomField[] | null = null;

export function invalidateSchemaCaches() {
  cachedTaxonomies = null;
  cachedCustomFields = null;
}

function mapRawTypeToUiLabel(rawType: string): string {
  const upper = String(rawType || 'TEXT').toUpperCase().trim();
  switch (upper) {
    case 'DROPDOWN':
      return 'Dropdown';
    case 'MULTISELECT':
    case 'MULTI_SELECT':
      return 'Multi-Select';
    case 'TEXTAREA':
    case 'LONG_TEXT':
    case 'LONG TEXT':
      return 'Long Text';
    case 'RICH_TEXT':
    case 'RICH TEXT':
      return 'Rich Text';
    case 'BOOLEAN':
    case 'YES_NO':
    case 'YES / NO':
      return 'Yes / No';
    case 'DATE':
      return 'Date';
    case 'NUMBER':
      return 'Number';
    case 'EMAIL':
      return 'Email';
    case 'PHONE':
      return 'Phone';
    case 'URL':
      return 'URL';
    case 'CURRENCY ($)':
      return 'Currency ($)';
    default:
      return upper === 'TEXT' ? 'Text' : rawType;
  }
}

function toQuestionInputType(uiType: string): CustomQuestionFieldType {
  const upper = String(uiType || 'Text').toUpperCase().trim();
  if (upper.startsWith('CURRENCY') || upper === 'NUMBER') return 'NUMBER';
  if (upper === 'DROPDOWN') return 'DROPDOWN';
  if (upper === 'MULTI-SELECT' || upper === 'MULTISELECT') return 'MULTISELECT';
  if (upper === 'LONG TEXT' || upper === 'TEXTAREA') return 'TEXTAREA';
  if (upper === 'RICH TEXT' || upper === 'RICH_TEXT') return 'RICH_TEXT';
  if (upper === 'YES / NO' || upper === 'BOOLEAN') return 'BOOLEAN';
  if (upper === 'DATE') return 'DATE';
  if (upper === 'EMAIL') return 'EMAIL';
  if (upper === 'PHONE') return 'PHONE';
  if (upper === 'URL') return 'URL';
  return 'TEXT';
}

function normalizeCustomField(f: any): CustomField {
  const entity = String(f.entity || 'consultant').toLowerCase() as CustomField['entity'];
  const rawType = String(f.type || 'Text');
  const type = mapRawTypeToUiLabel(rawType) as CustomField['type'];
  const options = Array.isArray(f.options)
    ? f.options.join(', ')
    : typeof f.options === 'object' && f.options?.values
    ? String(f.options.values)
    : typeof f.options === 'string'
    ? f.options
    : '';
  return {
    id: f.id,
    name: f.name,
    entity,
    entityLabel: f.entityLabel || entity.charAt(0).toUpperCase() + entity.slice(1),
    type,
    options,
    required: !!f.required,
    active: f.active ?? true,
  };
}

export function useMasterTaxonomies(isOpen = true) {
  const [taxonomies, setTaxonomies] = useState<MasterTaxonomies>(
    cachedTaxonomies || DEFAULT_MASTER_TAXONOMIES
  );

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    apiClient
      .get<any>('/taxonomies')
      .then((res) => {
        if (!active) return;
        const raw = res?.data?.data || res?.data;
        if (raw && typeof raw === 'object') {
          const merged: MasterTaxonomies = {
            workAuth: Array.isArray(raw.workAuth) && raw.workAuth.length > 0 ? raw.workAuth : DEFAULT_MASTER_TAXONOMIES.workAuth,
            paymentTerms: Array.isArray(raw.paymentTerms) && raw.paymentTerms.length > 0 ? raw.paymentTerms : DEFAULT_MASTER_TAXONOMIES.paymentTerms,
            education: Array.isArray(raw.education) && raw.education.length > 0 ? raw.education : DEFAULT_MASTER_TAXONOMIES.education,
            stages: Array.isArray(raw.stages) && raw.stages.length > 0 ? raw.stages : DEFAULT_MASTER_TAXONOMIES.stages,
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

function isWideCustomField(field: CustomField): boolean {
  const qType = toQuestionInputType(String(field.type || 'Text'));
  if (qType === 'RICH_TEXT' || qType === 'TEXTAREA' || qType === 'MULTISELECT' || qType === 'URL') {
    return true;
  }
  if (qType === 'NUMBER' || qType === 'DATE' || qType === 'BOOLEAN') {
    return false;
  }
  const nameLower = String(field.name || '').toLowerCase();
  return /(url|link|linkedin|website|portfolio|github|note|remark|comment|summary|description|address|skill)/.test(
    nameLower
  );
}

/**
 * Computes responsive grid spans for a 2-column form grid so single fields,
 * wide fields (URLs, notes, addresses), and trailing unpaired fields take full width.
 */
function computeCustomFieldSpans(fields: CustomField[]): string[] {
  const spans = fields.map(() => '');
  let col = 0;

  for (let i = 0; i < fields.length; i++) {
    if (isWideCustomField(fields[i])) {
      if (col === 1) {
        spans[i - 1] = 'sm:col-span-2';
      }
      spans[i] = 'sm:col-span-2';
      col = 0;
    } else if (col === 0) {
      if (i === fields.length - 1) {
        spans[i] = 'sm:col-span-2';
      } else {
        col = 1;
      }
    } else {
      col = 0;
    }
  }

  return spans;
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
      .get<any>('/custom-fields')
      .then((res) => {
        if (!mounted) return;
        const rawList = Array.isArray(res?.data?.data)
          ? res.data.data
          : Array.isArray(res?.data)
          ? res.data
          : null;
        if (rawList) {
          const normalized: CustomField[] = (rawList as any[]).map(normalizeCustomField);
          cachedCustomFields = normalized;
          setFields(normalized.filter((f) => f.entity === entity && f.active !== false));
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

  const fieldSpans = computeCustomFieldSpans(fields);

  return (
    <div className="pt-3.5 border-t border-slate-100 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Custom Fields
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {fields.map((field, index) => {
          const val = values[field.name] ?? '';
          const questionType = toQuestionInputType(String(field.type || 'Text'));
          const optionList = (field.options || '')
            .split(',')
            .map((opt) => opt.trim())
            .filter(Boolean);

          return (
            <div key={field.id || field.name} className={fieldSpans[index]}>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                {field.name} {field.required ? '*' : ''}
              </label>
              <CustomQuestionFieldInput
                type={questionType}
                label={field.name}
                value={val}
                onChange={(nextVal) => handleFieldChange(field.name, nextVal)}
                options={optionList}
                required={!!field.required}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

