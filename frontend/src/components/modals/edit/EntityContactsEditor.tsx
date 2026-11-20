import React from 'react';
import { Plus, Star, Trash2, Users } from 'lucide-react';
import { INVALID_FIELD_CLASSES } from '../../../utils/formValidation';
import { StatusBadge } from '../../shared/StatusBadge';

export interface EditableEntityContact {
  id?: string;
  fullName: string;
  designation: string;
  email: string;
  phone: string;
  isPrimary: boolean;
}

export type ContactValidationErrors = Record<
  number,
  { fullName?: boolean; email?: boolean }
>;

/**
 * Normalizes and validates multi-contact form rows, preserving IDs, trimming strings,
 * ensuring strictly one Primary Lead, and identifying incomplete or invalid rows.
 */
export function validateEditableContacts(contacts: EditableEntityContact[]): {
  cleaned: EditableEntityContact[];
  invalidIndices: ContactValidationErrors;
  errorMessage: string | null;
} {
  const invalidIndices: ContactValidationErrors = {};
  const kept: EditableEntityContact[] = [];
  let firstError: string | null = null;

  contacts.forEach((row, idx) => {
    const fullName = String(row.fullName || '').trim();
    const designation = String(row.designation || '').trim();
    const email = String(row.email || '').trim().toLowerCase();
    const phone = String(row.phone || '').trim();

    const hasAnyValue = Boolean(fullName || designation || email || phone);
    if (!hasAnyValue) {
      return;
    }

    const rowErrors: { fullName?: boolean; email?: boolean } = {};
    if (!fullName) {
      rowErrors.fullName = true;
      if (!firstError) {
        firstError = `Contact #${idx + 1} requires a full name.`;
      }
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      rowErrors.email = true;
      if (!firstError) {
        firstError = !email
          ? `Contact "${fullName || `#${idx + 1}`}" requires an email address.`
          : `Contact "${fullName || `#${idx + 1}`}" has an invalid email format.`;
      }
    }

    if (rowErrors.fullName || rowErrors.email) {
      invalidIndices[idx] = rowErrors;
      return;
    }

    kept.push({
      ...(row.id ? { id: row.id } : {}),
      fullName,
      designation,
      email,
      phone,
      isPrimary: Boolean(row.isPrimary),
    });
  });

  if (firstError) {
    return { cleaned: [], invalidIndices, errorMessage: firstError };
  }

  if (kept.length > 0) {
    const primaryIdx = kept.findIndex((c) => c.isPrimary);
    const resolvedIdx = primaryIdx >= 0 ? primaryIdx : 0;
    kept.forEach((c, idx) => {
      c.isPrimary = idx === resolvedIdx;
    });
  }

  return { cleaned: kept, invalidIndices: {}, errorMessage: null };
}

interface EntityContactsEditorProps {
  title: string;
  subtitle?: string;
  contacts: EditableEntityContact[];
  onChange: (next: EditableEntityContact[]) => void;
  invalidMap?: ContactValidationErrors;
  onClearRowError?: (idx: number, field: 'fullName' | 'email') => void;
  sectionRef?: React.Ref<HTMLDivElement>;
  namePlaceholder?: string;
  designationPlaceholder?: string;
  defaultDesignation?: string;
  allowEmpty?: boolean;
}

export const EntityContactsEditor: React.FC<EntityContactsEditorProps> = ({
  title,
  subtitle,
  contacts,
  onChange,
  invalidMap = {},
  onClearRowError,
  sectionRef,
  namePlaceholder = 'e.g. Sarah Jenkins',
  designationPlaceholder = 'e.g. Account Executive',
  defaultDesignation = '',
  allowEmpty = true,
}) => {
  const inputBaseClass =
    'w-full h-9 px-3 bg-white border rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none transition-colors';

  const handleAddContact = () => {
    onChange([
      ...contacts,
      {
        fullName: '',
        designation: defaultDesignation,
        phone: '',
        email: '',
        isPrimary: contacts.length === 0,
      },
    ]);
  };

  const handleSetPrimary = (targetIdx: number) => {
    onChange(
      contacts.map((c, idx) => ({
        ...c,
        isPrimary: idx === targetIdx,
      }))
    );
  };

  const handleRemoveContact = (targetIdx: number) => {
    if (!allowEmpty && contacts.length <= 1) return;
    const filtered = contacts.filter((_, idx) => idx !== targetIdx);
    if (filtered.length > 0 && !filtered.some((c) => c.isPrimary)) {
      filtered[0] = { ...filtered[0], isPrimary: true };
    }
    onChange(filtered);
  };

  const handleFieldChange = (
    targetIdx: number,
    field: 'fullName' | 'designation' | 'email' | 'phone',
    value: string
  ) => {
    if (field === 'fullName' || field === 'email') {
      onClearRowError?.(targetIdx, field);
    }
    onChange(
      contacts.map((c, idx) => (idx === targetIdx ? { ...c, [field]: value } : c))
    );
  };

  return (
    <div ref={sectionRef} className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            {title} ({contacts.length})
          </h4>
          {subtitle && (
            <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>
          )}
        </div>
        <button
          type="button"
          onClick={handleAddContact}
          className="h-7 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer shrink-0"
        >
          <Plus className="w-3 h-3 text-brand-600" />
          <span>Add Contact</span>
        </button>
      </div>

      {contacts.length === 0 ? (
        <div className="py-7 px-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 text-center space-y-2">
          <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center mx-auto text-slate-400">
            <Users className="w-4 h-4" />
          </div>
          <p className="text-xs text-slate-500">
            No contacts added yet. Add a primary contact for requirements and notifications.
          </p>
          <button
            type="button"
            onClick={handleAddContact}
            className="h-7 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-brand-700 text-[11px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span>Add First Contact</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {contacts.map((cnt, idx) => {
            const rowErr = invalidMap[idx] || {};
            return (
              <div
                key={cnt.id || `contact-${idx}`}
                className={`rounded-xl border p-3.5 bg-white space-y-3 transition-colors ${
                  cnt.isPrimary ? 'border-slate-300/90' : 'border-slate-200/90'
                }`}
              >
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-semibold text-slate-800">
                      Contact #{idx + 1}
                    </span>
                    {cnt.isPrimary && (
                      <StatusBadge tone="emerald" size="xs" label="Primary Lead" />
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {!cnt.isPrimary && (
                      <button
                        type="button"
                        onClick={() => handleSetPrimary(idx)}
                        className="h-7 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-medium inline-flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Star className="w-3 h-3 text-slate-400" />
                        <span>Set Primary</span>
                      </button>
                    )}
                    {(allowEmpty || contacts.length > 1) && (
                      <button
                        type="button"
                        onClick={() => handleRemoveContact(idx)}
                        className="w-7 h-7 rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50/40 inline-flex items-center justify-center transition-colors cursor-pointer"
                        aria-label={`Remove contact ${idx + 1}`}
                        title="Remove contact"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      value={cnt.fullName}
                      onChange={(e) => handleFieldChange(idx, 'fullName', e.target.value)}
                      placeholder={namePlaceholder}
                      className={`${inputBaseClass} ${
                        rowErr.fullName
                          ? INVALID_FIELD_CLASSES
                          : 'border-slate-200 focus:border-brand-600'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Designation / Title
                    </label>
                    <input
                      type="text"
                      value={cnt.designation}
                      onChange={(e) => handleFieldChange(idx, 'designation', e.target.value)}
                      placeholder={designationPlaceholder}
                      className={`${inputBaseClass} border-slate-200 focus:border-brand-600`}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      value={cnt.email}
                      onChange={(e) => handleFieldChange(idx, 'email', e.target.value)}
                      placeholder="name@company.com"
                      className={`${inputBaseClass} ${
                        rowErr.email
                          ? INVALID_FIELD_CLASSES
                          : 'border-slate-200 focus:border-brand-600'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={cnt.phone}
                      onChange={(e) => handleFieldChange(idx, 'phone', e.target.value)}
                      placeholder="(555) 123-4567"
                      className={`${inputBaseClass} border-slate-200 focus:border-brand-600`}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
