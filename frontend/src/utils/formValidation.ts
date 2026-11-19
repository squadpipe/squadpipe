export interface RequiredFieldCheck {
  label: string;
  valid: boolean;
}

/**
 * Returns only the labels of fields that failed validation, preserving field order.
 */
export function getMissingFieldLabels(fields: RequiredFieldCheck[]): string[] {
  return fields.filter((field) => !field.valid).map((field) => field.label);
}

export const INVALID_FIELD_CLASSES =
  'border-rose-500 ring-1 ring-rose-500/25 bg-rose-50/25 focus:border-rose-500 focus:ring-rose-500/25';

export function validationInputClass(
  baseClass: string,
  invalid: boolean,
  validBorderClass = 'border-slate-200 focus:border-brand-600'
): string {
  return `${baseClass} ${invalid ? INVALID_FIELD_CLASSES : validBorderClass}`;
}

/**
 * Formats an exact validation error message naming only the missing fields.
 */
export function formatMissingFieldsMessage(
  missingLabels: string[],
  suffix = ''
): string {
  if (missingLabels.length === 0) return '';
  const tail = suffix ? ` ${suffix}` : '';

  if (missingLabels.length === 1) {
    return `${missingLabels[0]} is required${tail}.`;
  }
  if (missingLabels.length === 2) {
    return `${missingLabels[0]} and ${missingLabels[1]} are required${tail}.`;
  }

  const head = missingLabels.slice(0, -1).join(', ');
  const last = missingLabels[missingLabels.length - 1];
  return `${head}, and ${last} are required${tail}.`;
}
