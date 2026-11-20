import React from 'react';
import { ApplicationFormFieldWidth } from '../../types';

export interface SegmentedOption<T extends string> {
  value: T;
  label: React.ReactNode;
  title?: string;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  options: Array<SegmentedOption<T>>;
  onChange: (next: T) => void;
  ariaLabel: string;
  fullWidth?: boolean;
  className?: string;
}

/**
 * Shared segmented toggle control using standardized `rounded-lg` track and `rounded-md` active thumb.
 */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  fullWidth = false,
  className = '',
}: SegmentedControlProps<T>) {
  return (
    <div
      className={`inline-flex items-center rounded-lg border border-slate-200 bg-slate-50/90 p-0.5 shrink-0 ${
        fullWidth ? 'w-full' : ''
      } ${className}`}
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
            } inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              active
                ? 'bg-white text-slate-900 border border-slate-200/90'
                : 'text-slate-500 hover:text-slate-800 border border-transparent'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Form builder Half (50%) / Full (100%) width selector built on SegmentedControl.
 */
export const FieldWidthToggle: React.FC<{
  value: ApplicationFormFieldWidth;
  onChange: (next: ApplicationFormFieldWidth) => void;
  ariaLabel?: string;
  fullWidth?: boolean;
}> = ({ value, onChange, ariaLabel = 'Field width', fullWidth = false }) => (
  <SegmentedControl
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

/**
 * Form builder Optional / Required field requirement toggle built on SegmentedControl.
 */
export const RequiredToggle: React.FC<{
  required: boolean;
  onChange: (next: boolean) => void;
  ariaLabel?: string;
  fullWidth?: boolean;
}> = ({ required, onChange, ariaLabel = 'Requirement setting', fullWidth = false }) => (
  <SegmentedControl<'optional' | 'required'>
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
                required ? 'bg-amber-500' : 'bg-amber-500/60'
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
