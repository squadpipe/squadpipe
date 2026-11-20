import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { ApplicationFormTemplate } from '../../types';
import { CustomSelect } from '../../components/shared/CustomSelect';
import { CustomQuestionFieldInput } from '../../components/shared/CustomQuestionFieldInput';
import { RichTextDisplay } from '../../components/shared/RichTextDisplay';
import {
  getFieldWidthColSpanClass,
  resolveOrderedFormEntries,
} from '../../utils/applicationForms';
import { isRichTextEmpty } from '../../utils/richText';

interface ApplicationFormPreviewProps {
  template: Omit<ApplicationFormTemplate, 'id'> & { id?: string };
  agencyName?: string;
  headerBadgeText?: string;
  subtitleText?: string;
  isPreviewNotice?: boolean;
}

/**
 * Renders the application form card using the exact clean white surface, compact
 * resume picker, and editorial typography of the live public application page.
 */
export const ApplicationFormPreview: React.FC<ApplicationFormPreviewProps> = ({
  template,
  agencyName = 'Your Recruiting Team',
  isPreviewNotice = true,
}) => {
  const [previewWorkAuth, setPreviewWorkAuth] = useState('US Citizen');
  const [previewCustomValues, setPreviewCustomValues] = useState<Record<string, string>>({});

  const orderedFields = resolveOrderedFormEntries(template);
  const heading = template.heading?.trim() || 'Apply for this job';

  const inputBaseClass =
    'w-full px-3 py-2 rounded-md border border-slate-300 text-xs text-slate-900 bg-white placeholder:text-slate-400 pointer-events-none';

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-7 space-y-4">
      <div>
        <h2 className="text-base font-bold text-slate-900">{heading}</h2>
        {isRichTextEmpty(template.subheading) ? (
          <p className="text-xs text-slate-500 mt-0.5">Fields marked * are required.</p>
        ) : (
          <RichTextDisplay
            content={template.subheading}
            className="mt-1 text-xs text-slate-500 [&_p]:!text-xs [&_p]:!leading-relaxed [&_p]:!mb-1 [&_li]:!text-xs [&_ul]:!my-1"
          />
        )}
      </div>

      {/* Compact Resume Picker matching Live Public Form */}
      <div className="space-y-1">
        <label className="block text-xs font-medium text-slate-900">Resume / CV *</label>
        <div className="px-2.5 py-1.5 rounded-md border border-slate-300 flex items-center gap-3 bg-white">
          <span className="px-2.5 py-1 rounded border border-slate-300 bg-slate-100 text-xs font-medium text-slate-800 shrink-0">
            Browse...
          </span>
          <span className="text-xs text-slate-500 truncate">No file selected.</span>
        </div>
        <p className="text-[11px] text-slate-500">
          PDF, DOCX, DOC, TXT or RTF. Up to 15 MB.
        </p>
      </div>

      {/* Responsive 2-Column Field Grid with Exact Placement Order & Width Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3.5 gap-y-3.5 text-xs">
        <div>
          <label className="block text-xs font-medium text-slate-900 mb-1">Full name *</label>
          <input
            type="text"
            readOnly
            placeholder="e.g. Jordan Patel"
            className={inputBaseClass}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-900 mb-1">Email *</label>
          <input
            type="email"
            readOnly
            placeholder="candidate@email.com"
            className={inputBaseClass}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-900 mb-1">Phone *</label>
          <input
            type="tel"
            readOnly
            placeholder="+1 (555) 234-5678"
            className={inputBaseClass}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-900 mb-1">
            Work authorization *
          </label>
          <CustomSelect
            value={previewWorkAuth}
            onChange={setPreviewWorkAuth}
            ariaLabel="Preview Work Authorization"
            size="sm"
            className="!rounded-md !border-slate-300 hover:!border-slate-400 !h-[34px] text-slate-900"
            options={[
              'US Citizen',
              { value: 'Green Card', label: 'Green Card (Permanent Resident)' },
              { value: 'H-1B', label: 'H-1B (Transfer Ready)' },
              { value: 'TN Visa', label: 'TN Visa' },
              { value: 'OPT EAD', label: 'OPT / CPT EAD' },
              'Authorized to Work',
            ]}
          />
        </div>

        {orderedFields.map((entry) => {
          if (entry.kind === 'standard') {
            return (
              <div key={entry.key} className={getFieldWidthColSpanClass(entry.width)}>
                <label className="block text-xs font-medium text-slate-900 mb-1">
                  {entry.meta.applicantLabel}{' '}
                  {entry.required ? (
                    '*'
                  ) : (
                    <span className="text-slate-400 font-normal">(optional)</span>
                  )}
                </label>
                <input
                  type={entry.meta.inputType}
                  readOnly
                  placeholder={entry.meta.placeholder}
                  className={inputBaseClass}
                />
              </div>
            );
          }

          const cf = entry.field;
          const val = previewCustomValues[cf.key] || '';
          return (
            <div key={cf.key} className={getFieldWidthColSpanClass(entry.width)}>
              <label className="block text-xs font-medium text-slate-900 mb-1">
                {cf.name || 'Untitled question'}{' '}
                {cf.required ? (
                  '*'
                ) : (
                  <span className="text-slate-400 font-normal">(optional)</span>
                )}
              </label>
              <CustomQuestionFieldInput
                type={cf.type}
                label={cf.name || 'Question'}
                value={val}
                onChange={(next) =>
                  setPreviewCustomValues((prev) => ({ ...prev, [cf.key]: next }))
                }
                options={cf.options}
                required={Boolean(cf.required)}
                previewMode={true}
                cleanSurface={true}
              />
            </div>
          );
        })}
      </div>

      <div className="pt-1 space-y-3">
        {!isPreviewNotice && (
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>Your details will be shared directly with {agencyName}.</span>
          </div>
        )}

        <button
          type="button"
          className="w-full py-2.5 px-4 rounded-md bg-brand-600 text-white text-xs font-semibold inline-flex items-center justify-center cursor-default"
        >
          Submit application
        </button>
      </div>
    </div>
  );
};
