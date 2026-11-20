import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  Eye,
  Pencil,
} from 'lucide-react';
import { apiClient } from '../../config/api.config';
import { ApplicationFormTemplate, Requirement } from '../../types';
import {
  DEFAULT_APPLICATION_FORMS,
  summarizeFormTemplateFields,
} from '../../utils/applicationForms';
import { CustomSelect } from '../../components/shared/CustomSelect';
import { DetailBreadcrumb } from '../../components/shared/DetailPageShell';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { ApplicationFormPreview } from '../custom-fields/ApplicationFormPreview';

interface RequirementFormPreviewPageProps {
  requirement: Requirement | null;
  initialTemplateId?: string | null;
  isLoading?: boolean;
  isAdmin?: boolean;
  agencyName?: string;
  onBack: () => void;
  onEditTemplate?: (formId: string) => void;
  showToast?: (title: string, message: string, icon?: string) => void;
}

/**
 * Dedicated full-page applicant form preview launched from Requirement Details,
 * featuring an explicit Preview Header bar instead of a modal overlay.
 */
export const RequirementFormPreviewPage: React.FC<RequirementFormPreviewPageProps> = ({
  requirement,
  initialTemplateId,
  isLoading = false,
  isAdmin = false,
  agencyName,
  onBack,
  onEditTemplate,
  showToast,
}) => {
  const [forms, setForms] = useState<ApplicationFormTemplate[]>(DEFAULT_APPLICATION_FORMS);
  const [selectedFormId, setSelectedFormId] = useState<string>(initialTemplateId || '');
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    let active = true;
    apiClient
      .get('/application-forms')
      .then((res) => {
        if (!active) return;
        if (res.data?.success && Array.isArray(res.data.data) && res.data.data.length > 0) {
          setForms(res.data.data);
        }
      })
      .catch(() => {
        // Fallback to default application forms
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const reqTemplateId =
      initialTemplateId ||
      requirement?.publicFormTemplateId ||
      requirement?.customFields?._publicFormTemplateId ||
      '';
    if (reqTemplateId) {
      setSelectedFormId(reqTemplateId);
    }
  }, [initialTemplateId, requirement?.id, requirement?.publicFormTemplateId, requirement?.customFields]);

  const defaultForm = forms.find((f) => f.isDefault) || forms[0] || DEFAULT_APPLICATION_FORMS[0];
  const activeTemplate =
    (selectedFormId ? forms.find((f) => f.id === selectedFormId) : undefined) || defaultForm;
  const fieldChips = summarizeFormTemplateFields(activeTemplate);
  const requiredCount = fieldChips.filter((c) => c.required).length;

  const attachedReqFormId =
    requirement?.publicFormTemplateId || requirement?.customFields?._publicFormTemplateId || '';
  const isAttachedToReq =
    Boolean(requirement) &&
    ((!attachedReqFormId && activeTemplate.id === defaultForm.id) ||
      attachedReqFormId === activeTemplate.id);

  const publicUrl =
    requirement?.publicFormEnabled && requirement?.publicFormToken && typeof window !== 'undefined'
      ? `${window.location.origin}/apply/${requirement.publicFormToken}`
      : '';

  const handleCopyPublicUrl = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 1800);
      showToast?.('Link Copied', 'Public application link copied to clipboard.', 'success');
    } catch {
      showToast?.('Copy Failed', 'Could not copy public link automatically.', 'warning');
    }
  };

  if (isLoading && !requirement) {
    return (
      <div className="max-w-7xl mx-auto px-1 sm:px-2 lg:px-4 space-y-4 pb-8">
        <DetailBreadcrumb
          backLabel="Back to Requirement"
          onBack={onBack}
          title="Loading Application Form Preview..."
          codePill="Form Preview"
        />
        <div className="bg-white rounded-xl border border-slate-200/90 p-16 text-center text-xs text-slate-500 flex flex-col items-center gap-3 card-shadow">
          <div className="w-6 h-6 rounded-full border-2 border-brand-600 border-t-transparent animate-spin" />
          <span>Loading requirement form preview...</span>
        </div>
      </div>
    );
  }

  return (
    <section className="max-w-7xl mx-auto px-1 sm:px-2 lg:px-4 space-y-5 pb-8 animate-fade-in">
      <DetailBreadcrumb
        backLabel={requirement?.code ? `Back to ${requirement.code}` : 'Back to Requirement'}
        onBack={onBack}
        title="Application Form Preview"
        codePill={requirement?.code || 'Form Preview'}
      />

      {/* Crisp Light Editorial Preview Header Bar */}
      <div className="rounded-xl bg-white border border-slate-200/90 card-shadow px-5 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-200/80 text-slate-600 flex items-center justify-center shrink-0">
            <Eye className="w-4 h-4" />
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge tone="emerald" size="xs" label="Preview Mode" />
              <h1 className="text-sm font-semibold text-slate-900 truncate">{activeTemplate.name}</h1>
              <StatusBadge
                tone={activeTemplate.isDefault ? 'emerald' : 'brand'}
                size="xs"
                label={isAttachedToReq ? 'Attached to Requirement' : activeTemplate.isDefault ? 'Workspace Default' : 'Template'}
              />
            </div>
            <p className="text-[11px] text-slate-500 truncate">
              {requirement
                ? `${requirement.code} · ${requirement.opportunityTitle} · `
                : ''}
              {fieldChips.length} total fields ({requiredCount} required) · Internal bill rates &amp; client names stay hidden
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="w-52">
            <CustomSelect
              value={activeTemplate.id}
              onChange={setSelectedFormId}
              ariaLabel="Switch form template to preview"
              size="xs"
              options={forms.map((f) => ({
                value: f.id,
                label: `${f.name}${f.isDefault ? ' (Default)' : ''}`,
              }))}
            />
          </div>

          {publicUrl && (
            <>
              <button
                type="button"
                onClick={handleCopyPublicUrl}
                className="h-8 px-3 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[11px] font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                <span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
              </button>
              <a
                href={publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="h-8 px-3 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-[11px] font-semibold inline-flex items-center gap-1.5 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open Live Link</span>
              </a>
            </>
          )}

          {isAdmin && onEditTemplate && (
            <button
              type="button"
              onClick={() => onEditTemplate(activeTemplate.id)}
              className="h-8 px-3 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[11px] font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5 text-slate-500" />
              <span>Edit Form</span>
            </button>
          )}

          <button
            type="button"
            onClick={onBack}
            className="h-8 px-3 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[11px] font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-slate-500" />
            <span>Back</span>
          </button>
        </div>
      </div>

      {/* Centered Live Applicant Form Preview */}
      <div className="max-w-3xl mx-auto pb-8">
        <ApplicationFormPreview template={activeTemplate} agencyName={agencyName} />
      </div>
    </section>
  );
};
