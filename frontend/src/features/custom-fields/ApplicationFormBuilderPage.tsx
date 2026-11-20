import React, { useEffect, useRef, useState } from 'react';
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  GripVertical,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { apiClient } from '../../config/api.config';
import {
  ApplicationFormCustomField,
  ApplicationFormFieldWidth,
  ApplicationFormTemplate,
  CustomQuestionFieldType,
} from '../../types';
import {
  CUSTOM_QUESTION_TYPE_OPTIONS,
  DEFAULT_APPLICATION_FORMS,
  formatQuestionTypeLabel,
  getFieldWidthColSpanClass,
  OrderedFormFieldItem,
  resolveFormFieldWidth,
  resolveOrderedFormEntries,
  STANDARD_OPTIONAL_FORM_FIELDS,
  StandardOptionalFieldKey,
  summarizeFormTemplateFields,
} from '../../utils/applicationForms';
import { INVALID_FIELD_CLASSES } from '../../utils/formValidation';
import { ActionButton } from '../../components/shared/ActionButton';
import { CustomSelect } from '../../components/shared/CustomSelect';
import { DetailBreadcrumb } from '../../components/shared/DetailPageShell';
import { PageHeader } from '../../components/shared/PageHeader';
import {
  FieldWidthToggle,
  RequiredToggle,
  SegmentedControl,
} from '../../components/shared/SegmentedControl';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { UnsavedChangesModal, useFormShortcuts } from '../../hooks/useFormShortcuts';
import { ApplicationFormPreview } from './ApplicationFormPreview';

interface ApplicationFormBuilderPageProps {
  formId?: string | null;
  initialForms?: ApplicationFormTemplate[] | null;
  customFields?: Array<{ id?: string; key?: string; name: string; entity?: string; required?: boolean }>;
  onSaved: (forms: ApplicationFormTemplate[]) => void;
  onBack: () => void;
  showToast: (title: string, message: string, icon?: string) => void;
}

const EMPTY_FORM_DRAFT: Omit<ApplicationFormTemplate, 'id'> = {
  name: '',
  description: '',
  heading: 'Submit Candidate Profile & Resume',
  subheading:
    'Candidates applying directly or partner agencies submitting consultants can attach a resume below.',
  isDefault: false,
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
  fieldWidths: {
    vendorName: 'full',
  },
  fieldOrder: ['currentTitle', 'expectedRate', 'noticePeriod', 'vendorName'],
  customFieldKeys: [],
  customFields: [],
};

const QUICK_QUESTION_PRESETS: Array<{
  name: string;
  type: CustomQuestionFieldType;
  width: ApplicationFormFieldWidth;
  required: boolean;
  options?: string[];
}> = [
  {
    name: 'Earliest Start Date',
    type: 'DROPDOWN',
    width: 'half',
    required: true,
    options: ['Immediate', '2 Weeks Notice', '30 Days Notice', 'Negotiable'],
  },
  {
    name: 'Open to Relocation?',
    type: 'BOOLEAN',
    width: 'half',
    required: false,
  },
  {
    name: 'Technical Highlight & Fit Summary',
    type: 'RICH_TEXT',
    width: 'full',
    required: false,
  },
  {
    name: 'Technical Skills Stack',
    type: 'MULTISELECT',
    width: 'full',
    required: false,
    options: ['React', 'TypeScript', 'Node.js', 'AWS', 'Kubernetes', 'Python'],
  },
  {
    name: 'Portfolio / GitHub URL',
    type: 'URL',
    width: 'half',
    required: false,
  },
];

function supportsOptionsType(type: CustomQuestionFieldType): boolean {
  return type === 'DROPDOWN' || type === 'MULTISELECT';
}

function buildDraftFromForm(form: ApplicationFormTemplate): {
  draft: Omit<ApplicationFormTemplate, 'id'>;
  optionsText: Record<string, string>;
} {
  const initialCustomFields = [...(form.customFields || [])].map((cf) => ({
    ...cf,
    width: cf.width || (cf.type === 'RICH_TEXT' || cf.type === 'TEXTAREA' ? 'full' : 'half'),
  }));
  const optionsText: Record<string, string> = {};
  for (const cf of initialCustomFields) {
    if (supportsOptionsType(cf.type)) {
      optionsText[cf.key] = (cf.options || []).join(', ');
    }
  }
  const baseDraft: Omit<ApplicationFormTemplate, 'id'> = {
    name: form.name,
    description: form.description || '',
    heading: form.heading || 'Submit Candidate Profile & Resume',
    subheading:
      form.subheading ||
      'Candidates applying directly or partner agencies submitting consultants can attach a resume below.',
    isDefault: form.isDefault,
    includeCurrentTitle: form.includeCurrentTitle,
    requireCurrentTitle: form.requireCurrentTitle,
    includeExpectedRate: form.includeExpectedRate,
    requireExpectedRate: form.requireExpectedRate,
    includeVendorName: form.includeVendorName,
    requireVendorName: form.requireVendorName,
    includeNoticePeriod: form.includeNoticePeriod,
    requireNoticePeriod: form.requireNoticePeriod,
    includeLinkedinUrl: form.includeLinkedinUrl,
    requireLinkedinUrl: form.requireLinkedinUrl,
    fieldWidths: {
      vendorName: 'full',
      ...(form.fieldWidths || {}),
    },
    fieldOrder: Array.isArray(form.fieldOrder) ? [...form.fieldOrder] : undefined,
    customFieldKeys: [...(form.customFieldKeys || [])],
    customFields: initialCustomFields,
  };
  const resolvedOrder = resolveOrderedFormEntries(baseDraft).map((item) => item.key);
  return {
    optionsText,
    draft: {
      ...baseDraft,
      fieldOrder: resolvedOrder,
    },
  };
}

interface SortableFieldTileProps {
  entry: OrderedFormFieldItem;
  index: number;
  totalCount: number;
  rawChoices?: string;
  onMoveStep: (index: number, delta: -1 | 1) => void;
  onSetWidth: (nextWidth: ApplicationFormFieldWidth) => void;
  onSetRequired: (nextRequired: boolean) => void;
  onRemove: () => void;
  onUpdateCustomField?: (patch: Partial<ApplicationFormCustomField>, rawChoiceText?: string) => void;
}

const SortableFieldTile: React.FC<SortableFieldTileProps> = ({
  entry,
  index,
  totalCount,
  rawChoices = '',
  onMoveStep,
  onSetWidth,
  onSetRequired,
  onRemove,
  onUpdateCustomField,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: entry.key });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const parsedChoices = rawChoices
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${getFieldWidthColSpanClass(entry.width)} rounded-xl border bg-white p-4 transition-shadow flex flex-col justify-between gap-3.5 ${
        isDragging
          ? 'opacity-40 border-brand-400 shadow-lg ring-2 ring-brand-500/20 z-10'
          : 'border-slate-200/90 hover:border-slate-300 shadow-xs'
      }`}
    >
      {/* Top Bar: Drag Handle + Placement Order + Remove */}
      <div className="flex items-start gap-2.5">
        <button
          type="button"
          {...attributes}
          {...listeners}
          title="Drag to change field placement"
          aria-label={`Drag ${entry.kind === 'custom' ? entry.field.name : entry.meta.label}`}
          className="mt-0.5 p-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-grab active:cursor-grabbing shrink-0 transition-colors touch-none"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>

        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[11px] font-semibold tabular-nums">
                #{index + 1}
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                  entry.kind === 'custom'
                    ? 'bg-brand-50 text-brand-700 border border-brand-200/70'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {entry.kind === 'custom'
                  ? formatQuestionTypeLabel(entry.field.type)
                  : 'Standard Field'}
              </span>
            </div>

            <div className="flex items-center gap-0.5 shrink-0">
              <button
                type="button"
                disabled={index === 0}
                onClick={() => onMoveStep(index, -1)}
                title="Move earlier"
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-25 cursor-pointer"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={index === totalCount - 1}
                onClick={() => onMoveStep(index, 1)}
                title="Move later"
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-25 cursor-pointer"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={onRemove}
                title={entry.kind === 'custom' ? 'Remove question' : 'Hide field from form'}
                className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {entry.kind === 'custom' ? (
            <div className="space-y-2">
              <input
                type="text"
                value={entry.field.name}
                onChange={(e) => onUpdateCustomField?.({ name: e.target.value })}
                placeholder="Question label..."
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-800 focus:border-brand-500 focus:outline-none"
              />
              <div className="flex items-center gap-2 flex-wrap">
                <div className="w-44 shrink-0">
                  <CustomSelect
                    value={entry.field.type}
                    onChange={(val) => {
                      const nextType = val as CustomQuestionFieldType;
                      onUpdateCustomField?.({
                        type: nextType,
                        ...(nextType === 'RICH_TEXT' || nextType === 'TEXTAREA'
                          ? { width: 'full' }
                          : {}),
                        ...(supportsOptionsType(nextType) &&
                        (!entry.field.options || entry.field.options.length === 0)
                          ? { options: ['Option 1', 'Option 2'] }
                          : {}),
                      });
                    }}
                    ariaLabel="Question type"
                    size="xs"
                    options={CUSTOM_QUESTION_TYPE_OPTIONS}
                  />
                </div>
                {entry.field.type === 'RICH_TEXT' && (
                  <span className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-md font-medium">
                    Rich formatting editor enabled
                  </span>
                )}
              </div>

              {supportsOptionsType(entry.field.type) && (
                <div className="space-y-1.5 pt-1">
                  <input
                    type="text"
                    value={rawChoices}
                    onChange={(e) => {
                      const raw = e.target.value;
                      onUpdateCustomField?.(
                        {
                          options: raw
                            .split(',')
                            .map((o) => o.trim())
                            .filter(Boolean),
                        },
                        raw
                      );
                    }}
                    placeholder="Choices (comma separated)..."
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50/70 text-[11px] text-slate-700 focus:bg-white focus:border-brand-500 focus:outline-none"
                  />
                  {parsedChoices.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {parsedChoices.map((choice, cIdx) => (
                        <span
                          key={`${entry.field.key}_opt_${cIdx}`}
                          className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-medium"
                        >
                          {choice}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="text-xs font-semibold text-slate-800">{entry.meta.label}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {entry.meta.placeholder}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Placement Controls: Width + Requirement */}
      <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
        <FieldWidthToggle
          value={entry.width}
          ariaLabel={`${entry.kind === 'custom' ? entry.field.name : entry.meta.label} width`}
          onChange={onSetWidth}
        />
        <RequiredToggle
          required={entry.required}
          ariaLabel={`${entry.kind === 'custom' ? entry.field.name : entry.meta.label} requirement`}
          onChange={onSetRequired}
        />
      </div>
    </div>
  );
};

/**
 * Dedicated Application Form Builder supporting 2-column drag-and-drop field placement,
 * Half/Full width controls, 11 custom screening field data types (including Rich Text),
 * and live side-by-side applicant preview.
 */
export const ApplicationFormBuilderPage: React.FC<ApplicationFormBuilderPageProps> = ({
  formId,
  initialForms,
  customFields,
  onSaved,
  onBack,
  showToast,
}) => {
  const isEditMode = Boolean(formId);
  const initialMatched = formId
    ? initialForms?.find((f) => f.id === formId) || null
    : null;

  const [isLoadingForm, setIsLoadingForm] = useState<boolean>(
    Boolean(isEditMode && !initialMatched)
  );
  const [notFound, setNotFound] = useState(false);
  const [editingOriginalIsDefault, setEditingOriginalIsDefault] = useState<boolean>(
    Boolean(initialMatched?.isDefault)
  );
  const [draft, setDraft] = useState<Omit<ApplicationFormTemplate, 'id'>>(() =>
    initialMatched ? buildDraftFromForm(initialMatched).draft : EMPTY_FORM_DRAFT
  );
  const [customOptionsText, setCustomOptionsText] = useState<Record<string, string>>(() =>
    initialMatched ? buildDraftFromForm(initialMatched).optionsText : {}
  );
  const [newCustomName, setNewCustomName] = useState('');
  const [newCustomType, setNewCustomType] = useState<CustomQuestionFieldType>('TEXT');
  const [newCustomOptions, setNewCustomOptions] = useState('');
  const [newCustomRequired, setNewCustomRequired] = useState(false);
  const [newCustomWidth, setNewCustomWidth] = useState<ApplicationFormFieldWidth>('half');
  const [customDraftError, setCustomDraftError] = useState('');
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [mobileTab, setMobileTab] = useState<'edit' | 'preview'>('edit');
  const [activeDragKey, setActiveDragKey] = useState<string | null>(null);
  const [baselineSnapshot, setBaselineSnapshot] = useState(() =>
    JSON.stringify(initialMatched ? buildDraftFromForm(initialMatched).draft : EMPTY_FORM_DRAFT)
  );

  const formNameInputRef = useRef<HTMLInputElement>(null);
  const newCustomNameRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    if (!formId) {
      setIsLoadingForm(false);
      setNotFound(false);
      setEditingOriginalIsDefault(false);
      setDraft(EMPTY_FORM_DRAFT);
      setBaselineSnapshot(JSON.stringify(EMPTY_FORM_DRAFT));
      setCustomOptionsText({});
      setValidationAttempted(false);
      const timer = setTimeout(() => formNameInputRef.current?.focus(), 40);
      return () => clearTimeout(timer);
    }

    const existing = initialForms?.find((f) => f.id === formId);
    if (existing) {
      const prepared = buildDraftFromForm(existing);
      setDraft(prepared.draft);
      setBaselineSnapshot(JSON.stringify(prepared.draft));
      setCustomOptionsText(prepared.optionsText);
      setEditingOriginalIsDefault(Boolean(existing.isDefault));
      setNotFound(false);
      setIsLoadingForm(false);
      return;
    }

    let cancelled = false;
    setIsLoadingForm(true);
    setNotFound(false);
    apiClient
      .get('/application-forms')
      .then((res) => {
        if (cancelled) return;
        const list: ApplicationFormTemplate[] =
          res.data?.success && Array.isArray(res.data.data) && res.data.data.length > 0
            ? res.data.data
            : DEFAULT_APPLICATION_FORMS;
        const target = list.find((f) => f.id === formId);
        if (!target) {
          setNotFound(true);
          return;
        }
        const prepared = buildDraftFromForm(target);
        setDraft(prepared.draft);
        setBaselineSnapshot(JSON.stringify(prepared.draft));
        setCustomOptionsText(prepared.optionsText);
        setEditingOriginalIsDefault(Boolean(target.isDefault));
      })
      .catch(() => {
        if (cancelled) return;
        const fallback = DEFAULT_APPLICATION_FORMS.find((f) => f.id === formId);
        if (fallback) {
          const prepared = buildDraftFromForm(fallback);
          setDraft(prepared.draft);
          setBaselineSnapshot(JSON.stringify(prepared.draft));
          setCustomOptionsText(prepared.optionsText);
          setEditingOriginalIsDefault(Boolean(fallback.isDefault));
        } else {
          setNotFound(true);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingForm(false);
      });

    return () => {
      cancelled = true;
    };
  }, [formId]);

  const orderedEntries = resolveOrderedFormEntries(draft);

  const applyFieldOrder = (nextOrderKeys: string[]) => {
    setDraft((prev) => {
      const cfMap = new Map((prev.customFields || []).map((cf) => [cf.key, cf]));
      const orderedCustomFields: ApplicationFormCustomField[] = [];
      for (const k of nextOrderKeys) {
        const cf = cfMap.get(k);
        if (cf) {
          orderedCustomFields.push(cf);
          cfMap.delete(k);
        }
      }
      cfMap.forEach((remaining) => orderedCustomFields.push(remaining));
      return {
        ...prev,
        fieldOrder: nextOrderKeys,
        customFields: orderedCustomFields,
      };
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragKey(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragKey(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const keys = orderedEntries.map((item) => item.key);
    const oldIdx = keys.indexOf(String(active.id));
    const newIdx = keys.indexOf(String(over.id));
    if (oldIdx < 0 || newIdx < 0) return;
    applyFieldOrder(arrayMove(keys, oldIdx, newIdx));
  };

  const handleMoveOrderedStep = (idx: number, direction: -1 | 1) => {
    const keys = orderedEntries.map((item) => item.key);
    const target = idx + direction;
    if (target < 0 || target >= keys.length) return;
    applyFieldOrder(arrayMove(keys, idx, target));
  };

  const toggleStandardField = (fieldKey: StandardOptionalFieldKey, enabled: boolean) => {
    const meta = STANDARD_OPTIONAL_FORM_FIELDS.find((f) => f.key === fieldKey);
    if (!meta) return;
    setDraft((prev) => {
      const currentOrder = resolveOrderedFormEntries(prev).map((e) => e.key);
      const nextOrder = enabled
        ? currentOrder.includes(fieldKey)
          ? currentOrder
          : [...currentOrder, fieldKey]
        : currentOrder.filter((k) => k !== fieldKey);
      return {
        ...prev,
        [meta.includeKey]: enabled,
        ...(enabled ? {} : { [meta.requireKey]: false }),
        fieldOrder: nextOrder,
      };
    });
  };

  const resetCustomQuestionAdder = () => {
    setNewCustomName('');
    setNewCustomType('TEXT');
    setNewCustomOptions('');
    setNewCustomRequired(false);
    setNewCustomWidth('half');
    setCustomDraftError('');
  };

  const buildInlineCustomField = (): ApplicationFormCustomField | null => {
    const trimmed = newCustomName.trim();
    if (!trimmed) {
      setCustomDraftError('Please enter a question label first.');
      newCustomNameRef.current?.focus();
      return null;
    }
    const parsedOptions = newCustomOptions
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
    if (supportsOptionsType(newCustomType) && parsedOptions.length === 0) {
      setCustomDraftError('Add at least one comma-separated option below.');
      return null;
    }
    setCustomDraftError('');
    return {
      key: `cf_${trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${Date.now().toString(36)}`,
      name: trimmed,
      type: newCustomType,
      required: newCustomRequired,
      width: newCustomWidth,
      ...(supportsOptionsType(newCustomType) ? { options: parsedOptions } : {}),
    };
  };

  const appendCustomField = (item: ApplicationFormCustomField) => {
    setDraft((prev) => {
      const currentOrder = resolveOrderedFormEntries(prev).map((e) => e.key);
      return {
        ...prev,
        customFields: [...(prev.customFields || []), item],
        fieldOrder: [...currentOrder, item.key],
      };
    });
    if (supportsOptionsType(item.type)) {
      setCustomOptionsText((prev) => ({
        ...prev,
        [item.key]: (item.options || []).join(', '),
      }));
    }
  };

  const handleAddInlineCustomField = () => {
    const item = buildInlineCustomField();
    if (!item) return;
    appendCustomField(item);
    resetCustomQuestionAdder();
  };

  const handleAddPresetQuestion = (preset: (typeof QUICK_QUESTION_PRESETS)[number]) => {
    const existingNames = new Set(
      (draft.customFields || []).map((cf) => cf.name.trim().toLowerCase())
    );
    if (existingNames.has(preset.name.trim().toLowerCase())) return;
    appendCustomField({
      key: `cf_${preset.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${Date.now().toString(36)}`,
      name: preset.name,
      type: preset.type,
      required: preset.required,
      width: preset.width,
      ...(supportsOptionsType(preset.type) && preset.options ? { options: preset.options } : {}),
    });
  };

  const handleUpdateCustomField = (
    key: string,
    patch: Partial<ApplicationFormCustomField>
  ) => {
    setDraft((prev) => ({
      ...prev,
      customFields: (prev.customFields || []).map((cf) =>
        cf.key === key ? { ...cf, ...patch } : cf
      ),
    }));
  };

  const handleRemoveInlineCustomField = (key: string) => {
    setDraft((prev) => ({
      ...prev,
      customFields: (prev.customFields || []).filter((cf) => cf.key !== key),
      fieldOrder: (prev.fieldOrder || []).filter((k) => k !== key),
    }));
  };

  const handleSaveForm = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!draft.name.trim()) {
      setValidationAttempted(true);
      formNameInputRef.current?.focus();
      showToast('Missing Required Fields', 'Please enter a Form Name.', 'warning');
      return;
    }

    const finalCustomFields = [...(draft.customFields || [])]
      .map((cf) => ({
        ...cf,
        name: cf.name.trim(),
        ...(supportsOptionsType(cf.type)
          ? {
              options: (cf.options || []).map((o) => o.trim()).filter(Boolean),
            }
          : { options: undefined }),
      }))
      .filter((cf) => cf.name.length > 0);

    const emptyChoicesField = finalCustomFields.find(
      (cf) => supportsOptionsType(cf.type) && (!cf.options || cf.options.length === 0)
    );
    if (emptyChoicesField) {
      showToast(
        'Missing Choices',
        `Please add at least one option for "${emptyChoicesField.name}".`,
        'warning'
      );
      return;
    }

    let nextOrder = resolveOrderedFormEntries(draft).map((item) => item.key);
    if (newCustomName.trim()) {
      const extra = buildInlineCustomField();
      if (!extra) return;
      finalCustomFields.push(extra);
      nextOrder = [...nextOrder, extra.key];
    }

    setValidationAttempted(false);
    setIsSaving(true);
    try {
      const payload = {
        ...draft,
        name: draft.name.trim(),
        heading: draft.heading.trim() || 'Submit Candidate Profile & Resume',
        subheading: draft.subheading.trim(),
        fieldOrder: nextOrder,
        customFields: finalCustomFields,
      };
      const res = formId
        ? await apiClient.put(`/application-forms/${formId}`, payload)
        : await apiClient.post('/application-forms', payload);

      const savedList: ApplicationFormTemplate[] =
        res.data?.success && Array.isArray(res.data.data) ? res.data.data : [];

      showToast(
        formId ? 'Application Form Updated' : 'Application Form Created',
        `"${payload.name}" is ready to attach to job requirements.`,
        'success'
      );
      setBaselineSnapshot(JSON.stringify(draft));
      onSaved(savedList);
    } catch (err: any) {
      showToast(
        'Save Failed',
        err?.response?.data?.message || 'Could not save application form.',
        'error'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const isNameInvalid = validationAttempted && !draft.name.trim();
  const parsedComposerOptions = newCustomOptions
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const draftCustomWithGhost: ApplicationFormCustomField[] = newCustomName.trim()
    ? [
        ...(draft.customFields || []),
        {
          key: '__draft_preview__',
          name: newCustomName.trim(),
          type: newCustomType,
          required: newCustomRequired,
          width: newCustomWidth,
          ...(supportsOptionsType(newCustomType)
            ? {
                options:
                  parsedComposerOptions.length > 0
                    ? parsedComposerOptions
                    : ['Option 1', 'Option 2'],
              }
            : {}),
        },
      ]
    : [...(draft.customFields || [])];
  const previewDraft: Omit<ApplicationFormTemplate, 'id'> = {
    ...draft,
    customFields: draftCustomWithGhost,
    ...(newCustomName.trim()
      ? {
          fieldOrder: [
            ...orderedEntries.map((item) => item.key),
            '__draft_preview__',
          ],
        }
      : {}),
  };
  const totalDraftFieldCount = summarizeFormTemplateFields(
    { ...draft, id: formId || 'draft' },
    customFields
  ).length;
  const availablePresets = QUICK_QUESTION_PRESETS.filter(
    (p) =>
      !(draft.customFields || []).some(
        (cf) => cf.name.trim().toLowerCase() === p.name.toLowerCase()
      )
  );
  const totalHalfFieldsCount =
    orderedEntries.filter((e) => e.width === 'half').length +
    (newCustomName.trim() && newCustomWidth === 'half' ? 1 : 0);

  const activeDragEntry = activeDragKey
    ? orderedEntries.find((item) => item.key === activeDragKey) || null
    : null;

  const isDirty = Boolean(newCustomName.trim()) || JSON.stringify(draft) !== baselineSnapshot;
  const { showLeaveModal, guardNavigation, confirmLeave, cancelLeave } = useFormShortcuts({
    isDirty,
    isSubmitting: isSaving,
    onSubmit: () => handleSaveForm(),
  });

  if (isLoadingForm) {
    return (
      <div className="space-y-4">
        <DetailBreadcrumb
          backLabel="Back to Application Forms"
          onBack={onBack}
          title="Loading Application Form..."
          codePill="Edit Form"
        />
        <div className="bg-white rounded-xl border border-slate-200 p-16 text-center text-xs text-slate-500 flex flex-col items-center gap-3">
          <div className="w-6 h-6 rounded-full border-2 border-brand-600 border-t-transparent animate-spin" />
          <span>Loading application form template...</span>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="space-y-4">
        <DetailBreadcrumb
          backLabel="Back to Application Forms"
          onBack={onBack}
          title="Form Not Found"
        />
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-3 text-xs">
          <div className="text-sm font-bold text-slate-900">
            Application form could not be found
          </div>
          <p className="text-slate-500">
            This template may have been deleted or is unavailable in the workspace.
          </p>
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold cursor-pointer"
          >
            Back to Application Forms
          </button>
        </div>
      </div>
    );
  }

  return (
    <section className="max-w-7xl mx-auto space-y-6 pb-8 animate-fade-in">
      <DetailBreadcrumb
        backLabel="Back to Application Forms"
        onBack={() => guardNavigation(onBack)}
        title={isEditMode ? draft.name.trim() || 'Edit Application Form' : 'New Application Form'}
        codePill={isEditMode ? 'Edit Template' : 'New Template'}
      />

      <PageHeader
        title={
          isEditMode
            ? draft.name.trim() || 'Edit Application Form'
            : 'Create Application Form'
        }
        subtitle="Configure template copy, drag fields into 2-column Half or Full width placement, and customize screening questions."
        badges={
          <>
            <StatusBadge
              tone="brand"
              size="xs"
              label={`${totalDraftFieldCount} Active Fields`}
              className="tabular-nums"
            />
            {editingOriginalIsDefault && (
              <StatusBadge tone="emerald" size="xs" label="Workspace Default" />
            )}
          </>
        }
        actions={
          <>
            <button
              type="button"
              disabled={isSaving}
              onClick={() => guardNavigation(onBack)}
              className="px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <ActionButton
              type="button"
              onClick={() => handleSaveForm()}
              loading={isSaving}
              loadingText="Saving..."
              className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-semibold cursor-pointer"
            >
              {isEditMode ? 'Save Changes' : 'Create Form'}
            </ActionButton>
          </>
        }
      />

      {/* Tablet / Mobile Builder vs Preview Switcher */}
      <div className="xl:hidden">
        <SegmentedControl<'edit' | 'preview'>
          value={mobileTab}
          onChange={setMobileTab}
          ariaLabel="Switch between form builder and live preview"
          fullWidth
          options={[
            { value: 'edit', label: 'Form Builder' },
            {
              value: 'preview',
              label: (
                <span className="inline-flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5" />
                  <span>Live Preview</span>
                </span>
              ),
            },
          ]}
        />
      </div>

      {/* Main Dedicated 12-Column Builder + Right-Sided Rounded Preview */}
      <form
        noValidate
        onSubmit={handleSaveForm}
        className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start"
      >
        {/* Left Builder Column */}
        <div
          className={`xl:col-span-7 space-y-6 text-xs ${
            mobileTab === 'preview' ? 'hidden xl:block' : 'block'
          }`}
        >
          {/* Step 1: Form Identity & Copy */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 card-shadow space-y-5">
            <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  1. Form identity &amp; header copy
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Internal template name and public candidate instructions.
                </p>
              </div>
              {!editingOriginalIsDefault && (
                <label className="inline-flex items-center gap-2 cursor-pointer px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200">
                  <input
                    type="checkbox"
                    checked={draft.isDefault}
                    onChange={(e) => setDraft({ ...draft, isDefault: e.target.checked })}
                    className="w-3.5 h-3.5 rounded text-brand-600 cursor-pointer"
                  />
                  <span className="font-medium text-slate-700 text-[11px]">
                    Set as default
                  </span>
                </label>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-700">Form Name *</label>
                  {isNameInvalid && (
                    <span className="text-[11px] font-semibold text-rose-600">Required</span>
                  )}
                </div>
                <input
                  ref={formNameInputRef}
                  type="text"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="e.g. Direct Candidate Quick Apply"
                  className={`w-full px-3 py-2 rounded-lg border focus:outline-none ${
                    isNameInvalid ? INVALID_FIELD_CLASSES : 'border-slate-200 focus:border-brand-500'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Public Form Title
                </label>
                <input
                  type="text"
                  value={draft.heading}
                  onChange={(e) => setDraft({ ...draft, heading: e.target.value })}
                  placeholder="Submit Candidate Profile & Resume"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Applicant Instructions (Optional)
              </label>
              <input
                type="text"
                value={draft.subheading}
                onChange={(e) => setDraft({ ...draft, subheading: e.target.value })}
                placeholder="Short instruction shown under the form heading..."
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Step 2: Interactive Draggable Field Placement & Custom Screening Questions */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 card-shadow space-y-5">
            <div className="flex items-start justify-between gap-3 flex-wrap pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  2. Drag &amp; arrange form fields ({orderedEntries.length} placed)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Toggle standard fields on/off, drag tiles via the grip handle to reorder placement, and pick Half (50%) or Full (100%) width.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {totalHalfFieldsCount % 2 === 1 && (
                  <span className="px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200 text-[11px] font-medium text-slate-600">
                    {totalHalfFieldsCount} Half fields active
                  </span>
                )}
                {orderedEntries.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const defaultOrder = resolveOrderedFormEntries({
                        ...draft,
                        fieldOrder: undefined,
                      }).map((i) => i.key);
                      applyFieldOrder(defaultOrder);
                    }}
                    title="Reset field placement to default order"
                    className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset Order</span>
                  </button>
                )}
              </div>
            </div>

            {/* Always-Required Core Fields */}
            <div className="px-3.5 py-2.5 rounded-lg bg-slate-50 border border-slate-200/80 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-medium text-slate-500 mr-1">
                Pinned top fields:
              </span>
              {['Resume / CV', 'Full Name', 'Email', 'Phone', 'Work Auth'].map((label) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[11px] font-medium text-slate-700"
                >
                  <Check className="w-3 h-3 text-emerald-600" />
                  <span>{label}</span>
                </span>
              ))}
            </div>

            {/* Standard Optional Field Toggles */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-medium text-slate-500">
                Include standard profile fields
              </div>
              <div className="flex flex-wrap gap-2">
                {STANDARD_OPTIONAL_FORM_FIELDS.map((field) => {
                  const enabled = Boolean(draft[field.includeKey]);
                  return (
                    <button
                      key={field.key}
                      type="button"
                      onClick={() => toggleStandardField(field.key, !enabled)}
                      aria-pressed={enabled}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer ${
                        enabled
                          ? 'bg-slate-900 border-slate-900 text-white'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      {enabled ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Plus className="w-3 h-3 text-slate-400" />
                      )}
                      <span>{field.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Draggable 2-Column Placement Canvas */}
            {orderedEntries.length > 0 ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={orderedEntries.map((item) => item.key)}
                  strategy={rectSortingStrategy}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-4 rounded-xl bg-slate-50/70 border border-slate-200/80">
                    {orderedEntries.map((entry, idx) => (
                      <SortableFieldTile
                        key={entry.key}
                        entry={entry}
                        index={idx}
                        totalCount={orderedEntries.length}
                        rawChoices={
                          entry.kind === 'custom'
                            ? customOptionsText[entry.key] !== undefined
                              ? customOptionsText[entry.key]
                              : (entry.field.options || []).join(', ')
                            : ''
                        }
                        onMoveStep={handleMoveOrderedStep}
                        onSetWidth={(nextWidth) => {
                          if (entry.kind === 'standard') {
                            setDraft((prev) => ({
                              ...prev,
                              fieldWidths: {
                                ...(prev.fieldWidths || {}),
                                [entry.key]: nextWidth,
                              },
                            }));
                          } else {
                            handleUpdateCustomField(entry.key, { width: nextWidth });
                          }
                        }}
                        onSetRequired={(nextReq) => {
                          if (entry.kind === 'standard') {
                            setDraft((prev) => ({
                              ...prev,
                              [entry.meta.requireKey]: nextReq,
                            }));
                          } else {
                            handleUpdateCustomField(entry.key, { required: nextReq });
                          }
                        }}
                        onRemove={() => {
                          if (entry.kind === 'standard') {
                            toggleStandardField(entry.key, false);
                          } else {
                            handleRemoveInlineCustomField(entry.key);
                          }
                        }}
                        onUpdateCustomField={
                          entry.kind === 'custom'
                            ? (patch, rawChoiceText) => {
                                if (rawChoiceText !== undefined) {
                                  setCustomOptionsText((prev) => ({
                                    ...prev,
                                    [entry.key]: rawChoiceText,
                                  }));
                                }
                                handleUpdateCustomField(entry.key, patch);
                              }
                            : undefined
                        }
                      />
                    ))}
                  </div>
                </SortableContext>

                <DragOverlay>
                  {activeDragEntry ? (
                    <div className="rounded-xl border border-brand-500 bg-white p-3.5 shadow-2xl text-xs font-semibold text-slate-900 flex items-center gap-2 opacity-95">
                      <GripVertical className="w-4 h-4 text-brand-600" />
                      <span>
                        {activeDragEntry.kind === 'custom'
                          ? activeDragEntry.field.name || 'Custom Question'
                          : activeDragEntry.meta.label}
                      </span>
                      <span className="ml-auto px-2 py-0.5 rounded bg-slate-100 text-[11px] font-medium text-slate-600">
                        {activeDragEntry.width === 'full' ? 'Full' : 'Half'}
                      </span>
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            ) : (
              <div className="px-4 py-6 rounded-xl bg-slate-50/70 border border-dashed border-slate-200 text-center text-xs text-slate-500">
                No optional fields or custom questions active yet. Enable a standard field above or add a screening question below.
              </div>
            )}

            {/* Quick Add Common Presets */}
            {availablePresets.length > 0 && (
              <div className="space-y-2 pt-1">
                <div className="text-[11px] font-medium text-slate-500">
                  Quick add screening questions
                </div>
                <div className="flex flex-wrap gap-2">
                  {availablePresets.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => handleAddPresetQuestion(preset)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-700 text-[11px] font-medium transition-colors cursor-pointer"
                    >
                      <Plus className="w-3 h-3 text-brand-600" />
                      <span>{preset.name}</span>
                      <span className="text-[11px] text-slate-400">
                        · {preset.type === 'RICH_TEXT' ? 'Rich Text' : preset.width === 'full' ? 'Full' : 'Half'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Add New Custom Question Composer */}
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-semibold text-slate-800">
                  Add a new custom screening question
                </span>
                <span className="text-[11px] text-slate-400">
                  {newCustomName.trim()
                    ? 'Previewing live on the right'
                    : 'Supports Short Text, Rich Text, Multi-Select, Dropdown, Date & more'}
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="text-xs font-medium text-slate-700">
                    Question Label *
                  </label>
                  {customDraftError && !newCustomName.trim() && (
                    <span className="text-[11px] font-semibold text-rose-600">
                      {customDraftError}
                    </span>
                  )}
                </div>
                <input
                  ref={newCustomNameRef}
                  type="text"
                  value={newCustomName}
                  onChange={(e) => {
                    setNewCustomName(e.target.value);
                    if (customDraftError) setCustomDraftError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddInlineCustomField();
                    }
                  }}
                  placeholder="e.g. Describe your relevant cloud architecture experience"
                  className={`w-full px-3 py-2 rounded-lg border bg-white text-xs focus:outline-none ${
                    customDraftError && !newCustomName.trim()
                      ? INVALID_FIELD_CLASSES
                      : 'border-slate-200 focus:border-brand-500'
                  }`}
                />
              </div>

              <div className="flex flex-wrap items-end justify-between gap-2.5 pt-0.5">
                <div className="flex flex-wrap items-end gap-2.5">
                  <div className="w-48">
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Answer Type
                    </label>
                    <CustomSelect
                      value={newCustomType}
                      onChange={(val) => {
                        const nextType = val as CustomQuestionFieldType;
                        setNewCustomType(nextType);
                        if (nextType === 'RICH_TEXT' || nextType === 'TEXTAREA') {
                          setNewCustomWidth('full');
                        }
                        if (customDraftError) setCustomDraftError('');
                      }}
                      ariaLabel="New question type"
                      size="xs"
                      options={CUSTOM_QUESTION_TYPE_OPTIONS}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Width
                    </label>
                    <FieldWidthToggle
                      value={newCustomWidth}
                      ariaLabel="New question width"
                      onChange={setNewCustomWidth}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Requirement
                    </label>
                    <RequiredToggle
                      required={newCustomRequired}
                      ariaLabel="New question requirement"
                      onChange={setNewCustomRequired}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddInlineCustomField}
                  className="h-[30px] px-3.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add to Form</span>
                </button>
              </div>

              {supportsOptionsType(newCustomType) && (
                <div className="pt-2 border-t border-slate-100 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label className="block text-xs font-medium text-slate-700">
                      Choices (comma separated) *
                    </label>
                    {customDraftError && parsedComposerOptions.length === 0 && (
                      <span className="text-[11px] font-semibold text-rose-600">
                        {customDraftError}
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={newCustomOptions}
                    onChange={(e) => {
                      setNewCustomOptions(e.target.value);
                      if (customDraftError) setCustomDraftError('');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddInlineCustomField();
                      }
                    }}
                    placeholder="e.g. Immediate, 2 Weeks Notice, 30 Days Notice"
                    className={`w-full px-3 py-2 rounded-lg border bg-white text-xs focus:outline-none ${
                      customDraftError &&
                      supportsOptionsType(newCustomType) &&
                      parsedComposerOptions.length === 0
                        ? INVALID_FIELD_CLASSES
                        : 'border-slate-200 focus:border-brand-500'
                    }`}
                  />
                  {parsedComposerOptions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {parsedComposerOptions.map((opt, idx) => (
                        <span
                          key={`new_opt_${idx}`}
                          className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-medium"
                        >
                          {opt}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Live Preview Column (Clean Single Rounded Card with Rounded Dark Header) */}
        <div
          className={`xl:col-span-5 xl:sticky xl:top-4 ${
            mobileTab === 'edit' ? 'hidden xl:block' : 'block'
          }`}
        >
          <ApplicationFormPreview
            template={previewDraft}
            headerBadgeText="Live Preview"
            subtitleText="Updates live as you drag & edit"
          />
        </div>
      </form>

      <UnsavedChangesModal
        isOpen={showLeaveModal}
        onConfirmLeave={confirmLeave}
        onCancelLeave={cancelLeave}
      />
    </section>
  );
};
