import {
  ApplicationFormCustomField,
  ApplicationFormFieldWidth,
  ApplicationFormTemplate,
  CustomQuestionFieldType,
} from '../types';

export type StandardOptionalFieldKey =
  | 'currentTitle'
  | 'expectedRate'
  | 'vendorName'
  | 'noticePeriod'
  | 'linkedinUrl';

export interface StandardOptionalFieldMeta {
  key: StandardOptionalFieldKey;
  includeKey:
    | 'includeCurrentTitle'
    | 'includeExpectedRate'
    | 'includeVendorName'
    | 'includeNoticePeriod'
    | 'includeLinkedinUrl';
  requireKey:
    | 'requireCurrentTitle'
    | 'requireExpectedRate'
    | 'requireVendorName'
    | 'requireNoticePeriod'
    | 'requireLinkedinUrl';
  defaultWidth: ApplicationFormFieldWidth;
  label: string;
  applicantLabel: string;
  inputType: 'text' | 'url';
  placeholder: string;
}

export const STANDARD_OPTIONAL_FORM_FIELDS: StandardOptionalFieldMeta[] = [
  {
    key: 'currentTitle',
    includeKey: 'includeCurrentTitle',
    requireKey: 'requireCurrentTitle',
    defaultWidth: 'half',
    label: 'Current Job Title',
    applicantLabel: 'Current Title / Role',
    inputType: 'text',
    placeholder: 'e.g. Senior Cloud Engineer',
  },
  {
    key: 'expectedRate',
    includeKey: 'includeExpectedRate',
    requireKey: 'requireExpectedRate',
    defaultWidth: 'half',
    label: 'Expected Hourly Rate',
    applicantLabel: 'Expected Hourly Rate',
    inputType: 'text',
    placeholder: 'e.g. $90/hr (W2) or $105/hr (C2C)',
  },
  {
    key: 'noticePeriod',
    includeKey: 'includeNoticePeriod',
    requireKey: 'requireNoticePeriod',
    defaultWidth: 'half',
    label: 'Availability / Notice Period',
    applicantLabel: 'Availability / Notice Period',
    inputType: 'text',
    placeholder: 'e.g. Immediate or 2 Weeks Notice',
  },
  {
    key: 'linkedinUrl',
    includeKey: 'includeLinkedinUrl',
    requireKey: 'requireLinkedinUrl',
    defaultWidth: 'half',
    label: 'LinkedIn Profile URL',
    applicantLabel: 'LinkedIn Profile URL',
    inputType: 'url',
    placeholder: 'https://linkedin.com/in/username',
  },
  {
    key: 'vendorName',
    includeKey: 'includeVendorName',
    requireKey: 'requireVendorName',
    defaultWidth: 'full',
    label: 'Partner / Vendor Agency Name',
    applicantLabel: 'Partner / Vendor Agency Name',
    inputType: 'text',
    placeholder: 'e.g. Direct Candidate or Partner Staffing Firm',
  },
];

export const CUSTOM_QUESTION_TYPE_OPTIONS: Array<{
  value: CustomQuestionFieldType;
  label: string;
}> = [
  { value: 'TEXT', label: 'Short Text' },
  { value: 'TEXTAREA', label: 'Long Text (Paragraph)' },
  { value: 'RICH_TEXT', label: 'Rich Text (Formatted)' },
  { value: 'DROPDOWN', label: 'Dropdown (Single Select)' },
  { value: 'MULTISELECT', label: 'Multi-Select (Choices)' },
  { value: 'NUMBER', label: 'Number' },
  { value: 'DATE', label: 'Date' },
  { value: 'BOOLEAN', label: 'Yes / No' },
  { value: 'EMAIL', label: 'Email Address' },
  { value: 'PHONE', label: 'Phone Number' },
  { value: 'URL', label: 'URL / Link' },
];

export function formatQuestionTypeLabel(type?: CustomQuestionFieldType | string): string {
  const matched = CUSTOM_QUESTION_TYPE_OPTIONS.find((opt) => opt.value === type);
  return matched?.label || 'Short Text';
}

export function resolveFormFieldWidth(
  template: Pick<ApplicationFormTemplate, 'fieldWidths'>,
  fieldKey: string,
  fallback: ApplicationFormFieldWidth = 'half'
): ApplicationFormFieldWidth {
  return template.fieldWidths?.[fieldKey] || fallback;
}

export function getFieldWidthColSpanClass(width?: ApplicationFormFieldWidth): string {
  return width === 'full' ? 'sm:col-span-2' : 'sm:col-span-1';
}

export type OrderedFormFieldItem =
  | {
      kind: 'standard';
      key: StandardOptionalFieldKey;
      meta: StandardOptionalFieldMeta;
      required: boolean;
      width: ApplicationFormFieldWidth;
    }
  | {
      kind: 'custom';
      key: string;
      field: ApplicationFormCustomField;
      required: boolean;
      width: ApplicationFormFieldWidth;
    };

/**
 * Returns active optional standard fields + custom screening questions sorted
 * deterministically according to `template.fieldOrder`, appending newly enabled items at the end.
 */
export function resolveOrderedFormEntries(
  template: Partial<ApplicationFormTemplate>
): OrderedFormFieldItem[] {
  const byKey = new Map<string, OrderedFormFieldItem>();
  const defaultKeys: string[] = [];

  for (const meta of STANDARD_OPTIONAL_FORM_FIELDS) {
    if (!template[meta.includeKey]) continue;
    defaultKeys.push(meta.key);
    byKey.set(meta.key, {
      kind: 'standard',
      key: meta.key,
      meta,
      required: Boolean(template[meta.requireKey]),
      width: resolveFormFieldWidth(
        { fieldWidths: template.fieldWidths },
        meta.key,
        meta.defaultWidth
      ),
    });
  }

  for (const cf of template.customFields || []) {
    if (!cf?.key || byKey.has(cf.key)) continue;
    defaultKeys.push(cf.key);
    byKey.set(cf.key, {
      kind: 'custom',
      key: cf.key,
      field: cf,
      required: Boolean(cf.required),
      width: cf.width || (cf.type === 'RICH_TEXT' || cf.type === 'TEXTAREA' ? 'full' : 'half'),
    });
  }

  const ordered: OrderedFormFieldItem[] = [];
  const seen = new Set<string>();

  for (const rawKey of template.fieldOrder || []) {
    const item = byKey.get(rawKey);
    if (!item || seen.has(rawKey)) continue;
    seen.add(rawKey);
    ordered.push(item);
  }

  for (const key of defaultKeys) {
    if (seen.has(key)) continue;
    const item = byKey.get(key);
    if (item) {
      seen.add(key);
      ordered.push(item);
    }
  }

  return ordered;
}

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

  const orderedEntries = resolveOrderedFormEntries(template);
  for (const entry of orderedEntries) {
    if (entry.kind === 'standard') {
      const shortLabels: Record<StandardOptionalFieldKey, string> = {
        currentTitle: 'Current Title',
        expectedRate: 'Expected Rate',
        vendorName: 'Vendor Agency',
        noticePeriod: 'Availability / Notice',
        linkedinUrl: 'LinkedIn URL',
      };
      chips.push({
        label: shortLabels[entry.key],
        required: entry.required,
      });
    } else {
      chips.push({
        label: entry.field.name,
        required: entry.required,
        isCustom: true,
      });
    }
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
