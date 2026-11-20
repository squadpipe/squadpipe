import React from 'react';
import { Check } from 'lucide-react';
import { CustomQuestionFieldType } from '../../types';
import { CustomSelect } from './CustomSelect';
import { RichTextEditor } from './RichTextEditor';

interface CustomQuestionFieldInputProps {
  type: CustomQuestionFieldType;
  label: string;
  value: string;
  onChange: (nextVal: string) => void;
  options?: string[];
  required?: boolean;
  isInvalid?: boolean;
  placeholder?: string;
  previewMode?: boolean;
  cleanSurface?: boolean;
}

function parseMultiSelectValues(raw: string): string[] {
  return String(raw || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

/**
 * Shared input renderer for Custom Screening Questions and Custom Form Fields across
 * Public Apply forms, Application Form Previews, and CRM create/edit workflows.
 */
export const CustomQuestionFieldInput: React.FC<CustomQuestionFieldInputProps> = ({
  type,
  label,
  value,
  onChange,
  options = [],
  required = false,
  isInvalid = false,
  placeholder,
  previewMode = false,
  cleanSurface = false,
}) => {
  const cleanSelectClass = cleanSurface
    ? '!rounded-md !border-slate-300 hover:!border-slate-400 !h-[34px] text-slate-900'
    : '';
  const baseInputClass = cleanSurface
    ? `w-full px-3 py-2 rounded-md border text-xs bg-white focus:outline-none ${
        isInvalid
          ? 'border-rose-400 bg-rose-50/40 text-rose-900 focus:border-rose-500'
          : 'border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-brand-600 focus:ring-1 focus:ring-brand-600'
      }`
    : `w-full px-3 py-2 rounded-lg border text-xs focus:bg-white focus:outline-none ${
        isInvalid
          ? 'border-rose-300 bg-rose-50/40 text-rose-900 focus:border-rose-500'
          : 'border-slate-200 bg-slate-50/50 text-slate-800 placeholder:text-slate-400 focus:border-brand-500'
      } ${previewMode && !['DROPDOWN', 'MULTISELECT', 'BOOLEAN', 'RICH_TEXT'].includes(type) ? 'text-slate-500' : ''}`;

  if (type === 'DROPDOWN') {
    const cleanOptions = options.length > 0 ? options : ['Option 1', 'Option 2'];
    return (
      <CustomSelect
        value={value}
        onChange={onChange}
        ariaLabel={label}
        placeholder={placeholder || `Select ${(label || 'option').toLowerCase()}...`}
        size="sm"
        className={cleanSelectClass}
        options={[
          ...(required ? [] : [{ value: '', label: `Select ${(label || 'option').toLowerCase()}...` }]),
          ...cleanOptions.map((opt) => ({ value: opt, label: opt })),
        ]}
      />
    );
  }

  if (type === 'MULTISELECT') {
    const cleanOptions = options.length > 0 ? options : ['Option 1', 'Option 2'];
    const selected = parseMultiSelectValues(value);
    const toggleChoice = (opt: string) => {
      const exists = selected.includes(opt);
      const next = exists ? selected.filter((x) => x !== opt) : [...selected, opt];
      onChange(next.join(', '));
    };

    return (
      <div
        role="group"
        aria-label={label}
        className={`flex flex-wrap gap-1.5 p-2 ${cleanSurface ? 'rounded-md' : 'rounded-lg'} border ${
          isInvalid
            ? 'border-rose-300 bg-rose-50/40'
            : cleanSurface
              ? 'border-slate-300 bg-white'
              : 'border-slate-200 bg-slate-50/40'
        }`}
      >
        {cleanOptions.map((opt) => {
          const active = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggleChoice(opt)}
              aria-pressed={active}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors cursor-pointer ${
                active
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {active && <Check className="w-3 h-3 text-emerald-400" />}
              <span>{opt}</span>
            </button>
          );
        })}
      </div>
    );
  }

  if (type === 'BOOLEAN') {
    return (
      <CustomSelect
        value={value}
        onChange={onChange}
        ariaLabel={label}
        placeholder="Select Yes or No..."
        size="sm"
        className={cleanSelectClass}
        options={[
          ...(required ? [] : [{ value: '', label: 'Select Yes or No...' }]),
          { value: 'Yes', label: 'Yes' },
          { value: 'No', label: 'No' },
        ]}
      />
    );
  }

  if (type === 'RICH_TEXT') {
    return (
      <div className={isInvalid ? 'rounded-xl ring-1 ring-rose-400' : ''}>
        <RichTextEditor
          value={value}
          onChange={onChange}
          ariaLabel={label}
          minHeight={previewMode ? 96 : 120}
          maxHeight={previewMode ? 190 : 280}
          placeholder={
            placeholder || `Write formatted ${(label || 'response').toLowerCase()}...`
          }
        />
      </div>
    );
  }

  if (type === 'TEXTAREA') {
    return (
      <textarea
        rows={3}
        value={value}
        readOnly={previewMode}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || `Enter ${(label || 'answer').toLowerCase()}...`}
        className={`${baseInputClass} resize-y min-h-[78px] ${previewMode ? 'pointer-events-none' : ''}`}
      />
    );
  }

  const inputType =
    type === 'NUMBER'
      ? 'number'
      : type === 'DATE'
        ? 'date'
        : type === 'EMAIL'
          ? 'email'
          : type === 'PHONE'
            ? 'tel'
            : type === 'URL'
              ? 'url'
              : 'text';

  const fallbackPlaceholder =
    type === 'URL'
      ? 'https://...'
      : type === 'EMAIL'
        ? 'name@company.com'
        : type === 'PHONE'
          ? '+1 (555) 234-5678'
          : `Enter ${(label || 'answer').toLowerCase()}...`;

  return (
    <input
      type={inputType}
      value={value}
      readOnly={previewMode}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder || fallbackPlaceholder}
      className={`${baseInputClass} ${previewMode ? 'pointer-events-none' : ''}`}
    />
  );
};
