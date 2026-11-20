import React, { useState } from 'react';
import { Briefcase, CloudUpload, ShieldCheck } from 'lucide-react';
import { ApplicationFormTemplate } from '../../types';
import { CustomSelect } from '../../components/shared/CustomSelect';
import { CustomQuestionFieldInput } from '../../components/shared/CustomQuestionFieldInput';
import {
  getFieldWidthColSpanClass,
  resolveOrderedFormEntries,
} from '../../utils/applicationForms';

interface ApplicationFormPreviewProps {
  template: Omit<ApplicationFormTemplate, 'id'> & { id?: string };
  agencyName?: string;
  headerBadgeText?: string;
  subtitleText?: string;
}

/**
 * Live faithful preview of how an Application Form Template renders to applicants
 * on the public job application link, respecting Half / Full width layout and drag order.
 */
export const ApplicationFormPreview: React.FC<ApplicationFormPreviewProps> = ({
  template,
  agencyName = 'Your Recruiting Team',
  headerBadgeText = 'Open Position',
  subtitleText = 'Job Application & Resume Upload',
}) => {
  const [previewWorkAuth, setPreviewWorkAuth] = useState('US Citizen');
  const [previewCustomValues, setPreviewCustomValues] = useState<Record<string, string>>({});

  const orderedFields = resolveOrderedFormEntries(template);

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 card-shadow overflow-hidden text-xs">
      {/* Sleek Rounded Agency Header */}
      <div className="px-5 py-3.5 bg-[#141615] text-white flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white shrink-0">
            <Briefcase className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-white truncate">{agencyName}</div>
            <div className="text-[11px] text-slate-400">{subtitleText}</div>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/25 text-[11px] font-semibold text-emerald-300 whitespace-nowrap shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>{headerBadgeText}</span>
        </span>
      </div>

      <div className="p-5 space-y-4">
        {/* Form Heading */}
        <div className="border-b border-slate-100 pb-3">
          <h4 className="text-sm font-bold text-slate-900">
            {template.heading?.trim() || 'Submit Candidate Profile & Resume'}
          </h4>
          {template.subheading?.trim() && (
            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
              {template.subheading}
            </p>
          )}
        </div>

        {/* Resume Upload Dropzone */}
        <div className="space-y-1">
          <label className="block text-[11px] font-semibold text-slate-700">
            Resume / CV File *
          </label>
          <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 py-3.5 px-4 flex flex-col items-center justify-center text-center">
            <CloudUpload className="w-5 h-5 text-slate-400 mb-1" />
            <div className="text-[11px] font-medium text-slate-700">
              Drop your resume here, or <span className="text-brand-600 underline">browse file</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              PDF, DOCX, DOC, TXT, or RTF (max 15 MB)
            </div>
          </div>
        </div>

        {/* Responsive 2-Column Field Grid with Exact Placement Order & Width Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Full Name *
            </label>
            <input
              type="text"
              readOnly
              placeholder="e.g. Jordan Patel"
              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50/70 text-slate-500 pointer-events-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Email Address *
            </label>
            <input
              type="email"
              readOnly
              placeholder="candidate@email.com"
              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50/70 text-slate-500 pointer-events-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Phone Number *
            </label>
            <input
              type="tel"
              readOnly
              placeholder="+1 (555) 234-5678"
              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50/70 text-slate-500 pointer-events-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Work Authorization *
            </label>
            <CustomSelect
              value={previewWorkAuth}
              onChange={setPreviewWorkAuth}
              ariaLabel="Preview Work Authorization"
              size="sm"
              options={['US Citizen', 'Green Card', 'H-1B', 'OPT / CPT', 'Other']}
            />
          </div>

          {orderedFields.map((entry) => {
            if (entry.kind === 'standard') {
              return (
                <div key={entry.key} className={getFieldWidthColSpanClass(entry.width)}>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    {entry.meta.applicantLabel} {entry.required ? '*' : '(Optional)'}
                  </label>
                  <input
                    type={entry.meta.inputType}
                    readOnly
                    placeholder={entry.meta.placeholder}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50/70 text-slate-500 pointer-events-none"
                  />
                </div>
              );
            }

            const cf = entry.field;
            const val = previewCustomValues[cf.key] || '';
            return (
              <div key={cf.key} className={getFieldWidthColSpanClass(entry.width)}>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  {cf.name || 'Untitled Question'} {cf.required ? '*' : ''}
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
                />
              </div>
            );
          })}
        </div>

        {/* Footer Preview */}
        <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>Direct encrypted submission</span>
          </div>
          <span className="px-4 py-1.5 rounded-lg bg-brand-600 text-white text-[11px] font-semibold opacity-95">
            Submit Application
          </span>
        </div>
      </div>
    </div>
  );
};
