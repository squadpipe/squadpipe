import React from 'react';

export interface FormFieldProps {
  label: React.ReactNode;
  htmlFor?: string;
  required?: boolean;
  error?: React.ReactNode;
  hint?: React.ReactNode;
  rightSlot?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

/**
 * Shared form field label, required marker, validation message, and helper chrome.
 */
export const FormField: React.FC<FormFieldProps> = ({
  label,
  htmlFor,
  required = false,
  error,
  hint,
  rightSlot,
  className = '',
  children,
}) => (
  <div className={className}>
    <div className="flex items-center justify-between gap-2 mb-1">
      <label
        htmlFor={htmlFor}
        className="block text-xs font-medium text-slate-700"
      >
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      {rightSlot ||
        (error ? (
          <span className="text-[12px] font-medium text-rose-600">{error}</span>
        ) : null)}
    </div>
    {children}
    {hint && <p className="mt-1 text-[12px] text-slate-500 leading-normal">{hint}</p>}
  </div>
);
