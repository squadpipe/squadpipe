import { ApplicationFormTemplate } from '../types';

export const DEFAULT_APPLICATION_FORMS: ApplicationFormTemplate[] = [
  {
    id: 'form-standard-default',
    name: 'Standard Candidate & Partner Form',
    description: 'Balanced application form for both direct candidates and partner staffing vendors.',
    heading: 'Submit Candidate Profile & Resume',
    subheading:
      'Candidates applying directly or partner agencies submitting consultants can attach a resume below.',
    isDefault: true,
    includeCurrentTitle: true,
    requireCurrentTitle: false,
    includeExpectedRate: true,
    requireExpectedRate: false,
    includeVendorName: true,
    requireVendorName: false,
    includeNoticePeriod: true,
    requireNoticePeriod: false,
    includeLinkedinUrl: false,
    requireLinkedinUrl: false,
    customFieldKeys: [],
  },
  {
    id: 'form-direct-candidate',
    name: 'Direct Candidate Quick Apply',
    description: 'Streamlined candidate-only form (hides vendor agency & C2C fields).',
    heading: 'Apply Directly for This Position',
    subheading:
      'Upload your resume and share your contact information, work authorization, and availability.',
    isDefault: false,
    includeCurrentTitle: true,
    requireCurrentTitle: true,
    includeExpectedRate: true,
    requireExpectedRate: false,
    includeVendorName: false,
    requireVendorName: false,
    includeNoticePeriod: true,
    requireNoticePeriod: true,
    includeLinkedinUrl: true,
    requireLinkedinUrl: false,
    customFieldKeys: [],
  },
  {
    id: 'form-c2c-partner',
    name: 'Partner / C2C Vendor Submittal',
    description: 'Dedicated submittal form for partner agencies with required vendor & rate fields.',
    heading: 'Partner Vendor Consultant Submittal',
    subheading:
      'Submit your bench consultant with C2C hourly rate, work authorization, availability, and resume.',
    isDefault: false,
    includeCurrentTitle: true,
    requireCurrentTitle: true,
    includeExpectedRate: true,
    requireExpectedRate: true,
    includeVendorName: true,
    requireVendorName: true,
    includeNoticePeriod: true,
    requireNoticePeriod: true,
    includeLinkedinUrl: false,
    requireLinkedinUrl: false,
    customFieldKeys: [],
  },
];

export interface FormFieldSummaryChip {
  label: string;
  required: boolean;
  isCustom?: boolean;
}

export function summarizeFormTemplateFields(
  template: ApplicationFormTemplate,
  customFieldsLookup?: Array<{ key?: string; name: string; required?: boolean }>
): FormFieldSummaryChip[] {
  const chips: FormFieldSummaryChip[] = [
    { label: 'Resume / CV', required: true },
    { label: 'Full Name', required: true },
    { label: 'Email', required: true },
    { label: 'Phone', required: true },
    { label: 'Work Auth', required: true },
  ];

  if (template.includeCurrentTitle) {
    chips.push({ label: 'Current Title', required: Boolean(template.requireCurrentTitle) });
  }
  if (template.includeExpectedRate) {
    chips.push({ label: 'Expected Rate', required: Boolean(template.requireExpectedRate) });
  }
  if (template.includeVendorName) {
    chips.push({ label: 'Vendor Agency', required: Boolean(template.requireVendorName) });
  }
  if (template.includeNoticePeriod) {
    chips.push({ label: 'Availability / Notice', required: Boolean(template.requireNoticePeriod) });
  }
  if (template.includeLinkedinUrl) {
    chips.push({ label: 'LinkedIn URL', required: Boolean(template.requireLinkedinUrl) });
  }

  for (const cf of template.customFields || []) {
    chips.push({
      label: cf.name,
      required: Boolean(cf.required),
      isCustom: true,
    });
  }

  for (const key of template.customFieldKeys || []) {
    if ((template.customFields || []).some((cf) => cf.key === key)) continue;
    const matched = customFieldsLookup?.find((f) => f.key === key || f.name === key);
    chips.push({
      label: matched?.name || key.replace(/_\d+$/, '').replace(/_/g, ' '),
      required: Boolean(matched?.required),
      isCustom: true,
    });
  }

  return chips;
}
