import React, { useEffect, useRef, useState } from 'react';
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  Modifier,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Eye,
  GripVertical,
  LayoutList,
  Plus,
  RotateCcw,
  Trash2,
  X,
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
  OrderedFormFieldItem,
  resolveOrderedFormEntries,
  STANDARD_OPTIONAL_FORM_FIELDS,
  StandardOptionalFieldKey,
  summarizeFormTemplateFields,
} from '../../utils/applicationForms';
import { INVALID_FIELD_CLASSES } from '../../utils/formValidation';
import { isRichTextEmpty } from '../../utils/richText';
import { getWorkspaceBrand } from '../../utils/workspaceBrand';
import { ActionButton } from '../../components/shared/ActionButton';
import { CustomSelect } from '../../components/shared/CustomSelect';
import { DetailBreadcrumb } from '../../components/shared/DetailPageShell';
import { PageHeader } from '../../components/shared/PageHeader';
import { RichTextEditor } from '../../components/shared/RichTextEditor';
import { FieldWidthToggle, SegmentedControl } from '../../components/shared/SegmentedControl';
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
  label: string;
  name: string;
  type: CustomQuestionFieldType;
  width: ApplicationFormFieldWidth;
  required: boolean;
  options?: string[];
}> = [
  {
    label: 'Earliest start date',
    name: 'Earliest start date',
    type: 'DROPDOWN',
    width: 'half',
    required: false,
    options: ['Immediate', '2 Weeks Notice', '30 Days Notice', 'Negotiable'],
  },
  {
    label: 'Open to relocation?',
    name: 'Open to relocation?',
    type: 'BOOLEAN',
    width: 'half',
    required: false,
  },
  {
    label: 'Technical skills stack',
    name: 'Technical skills stack',
    type: 'MULTISELECT',
    width: 'full',
    required: false,
    options: ['React', 'TypeScript', 'Node.js', 'AWS', 'Kubernetes', 'Python'],
  },
  {
    label: 'Portfolio / GitHub URL',
    name: 'Portfolio / GitHub URL',
    type: 'URL',
    width: 'half',
    required: false,
  },
];

function supportsOptionsType(type: CustomQuestionFieldType): boolean {
  return type === 'DROPDOWN' || type === 'MULTISELECT';
}

function buildDraftFromForm(form: ApplicationFormTemplate): Omit<ApplicationFormTemplate, 'id'> {
  const initialCustomFields = [...(form.customFields || [])].map((cf) => ({
    ...cf,
    width: cf.width || (cf.type === 'RICH_TEXT' || cf.type === 'TEXTAREA' ? 'full' : 'half'),
  }));
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
    ...baseDraft,
    fieldOrder: resolvedOrder,
  };
}

interface SortableFieldRowProps {
  entry: OrderedFormFieldItem;
  index: number;
  totalCount: number;
  isExpanded: boolean;
  autoFocusLabel?: boolean;
  onAutoFocusHandled?: () => void;
  onToggleExpand?: () => void;
  onMoveStep: (index: number, delta: -1 | 1) => void;
  onSetWidth: (nextWidth: ApplicationFormFieldWidth) => void;
  onSetRequired: (nextRequired: boolean) => void;
  onRemove: () => void;
  onUpdateCustomField?: (patch: Partial<ApplicationFormCustomField>) => void;
}

const SortableFieldRow: React.FC<SortableFieldRowProps> = ({
  entry,
  index,
  totalCount,
  isExpanded,
  autoFocusLabel = false,
  onAutoFocusHandled,
  onToggleExpand,
  onMoveStep,
  onSetWidth,
  onSetRequired,
  onRemove,
  onUpdateCustomField,
}) => {
  const [optionDraft, setOptionDraft] = useState('');
  const rowRef = useRef<HTMLDivElement>(null);
  const labelInputRef = useRef<HTMLInputElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: entry.key });

  const setCombinedRef = (node: HTMLDivElement | null) => {
    setNodeRef(node);
    (rowRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
  };

  useEffect(() => {
    if (autoFocusLabel) {
      rowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      const timer = setTimeout(() => {
        labelInputRef.current?.focus();
        labelInputRef.current?.select();
        onAutoFocusHandled?.();
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [autoFocusLabel, onAutoFocusHandled]);

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  const title = entry.kind === 'custom' ? entry.field.name || 'Untitled question' : entry.meta.label;
  const widthLabel = entry.width === 'full' ? 'Full width' : 'Half width';
  const reqLabel = entry.required ? 'Required' : 'Optional';
  const subtitle =
    entry.kind === 'custom'
      ? `Custom · ${formatQuestionTypeLabel(entry.field.type)} · ${widthLabel} · ${reqLabel}`
      : `Standard field · ${widthLabel} · ${reqLabel}`;

  const handleAddOption = () => {
    if (entry.kind !== 'custom') return;
    const incoming = optionDraft
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (incoming.length === 0) return;

    const current = entry.field.options || [];
    const seen = new Set(current.map((o) => o.toLowerCase()));
    const next = [...current];
    for (const item of incoming) {
      if (!seen.has(item.toLowerCase())) {
        seen.add(item.toLowerCase());
        next.push(item);
      }
    }
    onUpdateCustomField?.({ options: next });
    setOptionDraft('');
  };

  return (
    <div
      ref={setCombinedRef}
      style={style}
      className={`rounded-xl border bg-white transition-shadow ${
        isDragging
          ? 'relative z-20 border-brand-500 shadow-lg ring-2 ring-brand-500/15'
          : isExpanded
            ? 'border-slate-300 shadow-sm'
            : 'border-slate-200/90 hover:border-slate-300'
      }`}
    >
      {/* Compact Horizontal Row */}
      <div className="px-3.5 py-2.5 flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <button
            type="button"
            {...attributes}
            {...listeners}
            title="Drag vertically to reorder"
            aria-label={`Drag ${title}`}
            className="p-1 text-slate-400 hover:text-slate-700 cursor-grab active:cursor-grabbing shrink-0 touch-none"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>

          <span className="text-[11px] font-semibold text-slate-400 tabular-nums shrink-0 w-5">
            #{index + 1}
          </span>

          {entry.kind === 'custom' ? (
            <button
              type="button"
              onClick={onToggleExpand}
              className="min-w-0 flex-1 text-left group cursor-pointer"
              title="Click to configure custom question"
            >
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-900 truncate group-hover:text-brand-700 transition-colors">
                  {title}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${
                    isExpanded ? 'rotate-180 text-slate-600' : ''
                  }`}
                />
              </div>
              <div className="text-[11px] text-slate-500 truncate">{subtitle}</div>
            </button>
          ) : (
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-slate-900 truncate">{title}</div>
              <div className="text-[11px] text-slate-500 truncate">{subtitle}</div>
            </div>
          )}
        </div>

        {/* Right Action Strip: Half|Full + Optional/Required + Up/Down + Delete */}
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          <FieldWidthToggle
            value={entry.width}
            ariaLabel={`${title} width`}
            onChange={onSetWidth}
          />

          <button
            type="button"
            onClick={() => onSetRequired(!entry.required)}
            aria-pressed={entry.required}
            title={entry.required ? 'Click to make optional' : 'Click to make required'}
            className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer shrink-0 ${
              entry.required
                ? 'bg-white border-amber-300 text-amber-700 hover:bg-amber-50/40'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            {entry.required ? 'Required' : 'Optional'}
          </button>

          <button
            type="button"
            disabled={index === 0}
            onClick={() => onMoveStep(index, -1)}
            title="Move up"
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-25 cursor-pointer"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={index === totalCount - 1}
            onClick={() => onMoveStep(index, 1)}
            title="Move down"
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-25 cursor-pointer"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            title={entry.kind === 'custom' ? 'Delete question' : 'Remove field from form'}
            aria-label={entry.kind === 'custom' ? `Delete ${title}` : `Remove ${title}`}
            className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Expanded Inline Custom Question Editor */}
      {entry.kind === 'custom' && isExpanded && (
        <div className="px-4 pb-4 pt-3.5 border-t border-slate-100 space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">
                Question shown to applicant
              </label>
              <input
                ref={labelInputRef}
                type="text"
                value={entry.field.name}
                onChange={(e) => onUpdateCustomField?.({ name: e.target.value })}
                placeholder="e.g. How soon can you join?"
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-900 focus:border-brand-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">
                Answer type
              </label>
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
                      ? { options: ['Immediate', '30 days', '60 days'] }
                      : {}),
                  });
                }}
                ariaLabel="Answer type"
                size="sm"
                options={CUSTOM_QUESTION_TYPE_OPTIONS}
              />
            </div>
          </div>

          {supportsOptionsType(entry.field.type) && (
            <div className="space-y-2">
              <label className="block text-[11px] font-medium text-slate-600">
                Answer options
              </label>
              {(entry.field.options || []).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {(entry.field.options || []).map((opt, optIdx) => (
                    <span
                      key={`${entry.field.key}_opt_${optIdx}`}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-white border border-emerald-300 text-emerald-700 text-[11px] font-medium"
                    >
                      <span>{opt}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const next = (entry.field.options || []).filter((_, i) => i !== optIdx);
                          onUpdateCustomField?.({ options: next });
                        }}
                        className="text-emerald-600 hover:text-rose-600 cursor-pointer"
                        aria-label={`Remove option ${opt}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={optionDraft}
                  onChange={(e) => setOptionDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddOption();
                    }
                  }}
                  placeholder="Type an option, e.g. 15 days"
                  className="flex-1 min-w-0 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 placeholder:text-slate-400 focus:border-brand-600 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddOption}
                  disabled={!optionDraft.trim()}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 shrink-0 cursor-pointer disabled:opacity-50 transition-colors"
                >
                  Add option
                </button>
              </div>
            </div>
          )}

          {entry.field.type === 'RICH_TEXT' && (
            <div className="text-[11px] text-emerald-700 bg-white border border-emerald-300 px-2.5 py-1.5 rounded-lg font-medium inline-block">
              Formatted rich-text answer box enabled for applicants
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Dedicated Application Form Builder featuring a crisp Editor / Preview tab system,
 * strictly container-locked vertical drag reordering, and live public-form preview parity.
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
    initialMatched ? buildDraftFromForm(initialMatched) : EMPTY_FORM_DRAFT
  );
  const [expandedCustomKey, setExpandedCustomKey] = useState<string | null>(
    () => initialMatched?.customFields?.[0]?.key || null
  );
  const [autoFocusCustomKey, setAutoFocusCustomKey] = useState<string | null>(null);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');
  const [baselineSnapshot, setBaselineSnapshot] = useState(() =>
    JSON.stringify(initialMatched ? buildDraftFromForm(initialMatched) : EMPTY_FORM_DRAFT)
  );

  const formNameInputRef = useRef<HTMLInputElement>(null);
  const fieldsListRef = useRef<HTMLDivElement>(null);
  const agencyName = getWorkspaceBrand().agencyName || 'Softiox Team';

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const restrictToVerticalContainer: Modifier = ({
    transform,
    draggingNodeRect,
    containerNodeRect,
  }) => {
    const locked = { ...transform, x: 0 };
    const bounds = fieldsListRef.current?.getBoundingClientRect() || containerNodeRect;
    if (!draggingNodeRect || !bounds) return locked;

    const minY = bounds.top - draggingNodeRect.top;
    const maxY = bounds.bottom - draggingNodeRect.bottom;
    return {
      ...locked,
      y: Math.min(Math.max(locked.y, minY), maxY),
    };
  };

  useEffect(() => {
    if (!formId) {
      setIsLoadingForm(false);
      setNotFound(false);
      setEditingOriginalIsDefault(false);
      setDraft(EMPTY_FORM_DRAFT);
      setBaselineSnapshot(JSON.stringify(EMPTY_FORM_DRAFT));
      setExpandedCustomKey(null);
      setAutoFocusCustomKey(null);
      setActiveTab('editor');
      setValidationAttempted(false);
      const timer = setTimeout(() => formNameInputRef.current?.focus(), 40);
      return () => clearTimeout(timer);
    }

    const existing = initialForms?.find((f) => f.id === formId);
    if (existing) {
      const prepared = buildDraftFromForm(existing);
      setDraft(prepared);
      setBaselineSnapshot(JSON.stringify(prepared));
      setEditingOriginalIsDefault(Boolean(existing.isDefault));
      setExpandedCustomKey(prepared.customFields?.[0]?.key || null);
      setActiveTab('editor');
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
        setDraft(prepared);
        setBaselineSnapshot(JSON.stringify(prepared));
        setEditingOriginalIsDefault(Boolean(target.isDefault));
        setExpandedCustomKey(prepared.customFields?.[0]?.key || null);
      })
      .catch(() => {
        if (cancelled) return;
        const fallback = DEFAULT_APPLICATION_FORMS.find((f) => f.id === formId);
        if (fallback) {
          const prepared = buildDraftFromForm(fallback);
          setDraft(prepared);
          setBaselineSnapshot(JSON.stringify(prepared));
          setEditingOriginalIsDefault(Boolean(fallback.isDefault));
          setExpandedCustomKey(prepared.customFields?.[0]?.key || null);
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

  const handleDragEnd = (event: DragEndEvent) => {
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

  const appendCustomField = (item: ApplicationFormCustomField, focusLabel = false) => {
    setDraft((prev) => {
      const currentOrder = resolveOrderedFormEntries(prev).map((e) => e.key);
      return {
        ...prev,
        customFields: [...(prev.customFields || []), item],
        fieldOrder: [...currentOrder, item.key],
      };
    });
    setExpandedCustomKey(item.key);
    if (focusLabel) {
      setAutoFocusCustomKey(item.key);
    }
  };

  const handleAddPresetQuestion = (preset: (typeof QUICK_QUESTION_PRESETS)[number]) => {
    const existingNames = new Set(
      (draft.customFields || []).map((cf) => cf.name.trim().toLowerCase())
    );
    if (existingNames.has(preset.name.trim().toLowerCase())) return;
    appendCustomField(
      {
        key: `cf_${preset.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${Date.now().toString(36)}`,
        name: preset.name,
        type: preset.type,
        required: preset.required,
        width: preset.width,
        ...(supportsOptionsType(preset.type) && preset.options ? { options: preset.options } : {}),
      },
      true
    );
  };

  const handleAddBlankCustomField = (type: CustomQuestionFieldType) => {
    const count = (draft.customFields || []).length + 1;
    const isDropdown = type === 'DROPDOWN';
    appendCustomField(
      {
        key: `cf_question_${Date.now().toString(36)}_${count}`,
        name: isDropdown ? 'New dropdown question' : 'New screening question',
        type,
        required: false,
        width: type === 'RICH_TEXT' || type === 'TEXTAREA' ? 'full' : 'half',
        ...(supportsOptionsType(type) ? { options: ['Immediate', '30 days'] } : {}),
      },
      true
    );
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
    if (expandedCustomKey === key) {
      setExpandedCustomKey(null);
    }
  };

  const handleSaveForm = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!draft.name.trim()) {
      setValidationAttempted(true);
      setActiveTab('editor');
      setTimeout(() => formNameInputRef.current?.focus(), 40);
      showToast('Missing Required Fields', 'Please enter a Form Name.', 'warning');
      return;
    }

    const emptyNameCustom = (draft.customFields || []).find((cf) => !cf.name.trim());
    if (emptyNameCustom) {
      setActiveTab('editor');
      setExpandedCustomKey(emptyNameCustom.key);
      setAutoFocusCustomKey(emptyNameCustom.key);
      showToast('Missing Question Label', 'Every custom question needs a label.', 'warning');
      return;
    }

    const finalCustomFields = [...(draft.customFields || [])].map((cf) => ({
      ...cf,
      name: cf.name.trim(),
      ...(supportsOptionsType(cf.type)
        ? {
            options: (cf.options || []).map((o) => o.trim()).filter(Boolean),
          }
        : { options: undefined }),
    }));

    const emptyChoicesField = finalCustomFields.find(
      (cf) => supportsOptionsType(cf.type) && (!cf.options || cf.options.length === 0)
    );
    if (emptyChoicesField) {
      setActiveTab('editor');
      setExpandedCustomKey(emptyChoicesField.key);
      showToast(
        'Missing Choices',
        `Please add at least one option for "${emptyChoicesField.name}".`,
        'warning'
      );
      return;
    }

    const nextOrder = resolveOrderedFormEntries(draft).map((item) => item.key);

    setValidationAttempted(false);
    setIsSaving(true);
    try {
      const payload = {
        ...draft,
        name: draft.name.trim(),
        heading: draft.heading.trim() || 'Submit Candidate Profile & Resume',
        subheading: isRichTextEmpty(draft.subheading) ? '' : draft.subheading.trim(),
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
  const hiddenStandardFields = STANDARD_OPTIONAL_FORM_FIELDS.filter(
    (field) => !draft[field.includeKey]
  );

  const isDirty = JSON.stringify(draft) !== baselineSnapshot;
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
    <section className="max-w-6xl mx-auto space-y-5 pb-8 animate-fade-in">
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
        subtitle="Arrange fields, set their width and whether they are required. Switch to Preview anytime to inspect the live applicant form."
        badges={
          <>
            <span className="px-2.5 py-0.5 rounded-full bg-white border border-emerald-300 text-[11px] font-medium text-emerald-700 tabular-nums">
              {totalDraftFieldCount} active fields
            </span>
            {editingOriginalIsDefault && (
              <span className="px-2.5 py-0.5 rounded-full bg-white border border-slate-300 text-[11px] font-medium text-slate-600">
                Workspace default
              </span>
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
              {isEditMode ? 'Save changes' : 'Create form'}
            </ActionButton>
          </>
        }
      />

      {/* Editor / Preview Tab Switcher */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <SegmentedControl<'editor' | 'preview'>
          value={activeTab}
          onChange={setActiveTab}
          ariaLabel="Switch between Editor and Preview tabs"
          options={[
            {
              value: 'editor',
              label: (
                <span className="inline-flex items-center gap-1.5">
                  <LayoutList className="w-3.5 h-3.5" />
                  <span>Editor</span>
                </span>
              ),
            },
            {
              value: 'preview',
              label: (
                <span className="inline-flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5" />
                  <span>Preview</span>
                </span>
              ),
            },
          ]}
        />

        {activeTab === 'preview' && (
          <span className="text-[11px] text-slate-500">
            Updates automatically as you edit fields and copy in the Editor tab
          </span>
        )}
      </div>

      {activeTab === 'editor' ? (
        <form noValidate onSubmit={handleSaveForm} className="space-y-5 text-xs">
          {/* 1. Form details */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 card-shadow space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">1. Form details</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Internal name and what applicants see at the top.
                </p>
              </div>
              {!editingOriginalIsDefault && (
                <label className="inline-flex items-center gap-2 cursor-pointer px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 shrink-0">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-700">Form name *</label>
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
                    isNameInvalid ? INVALID_FIELD_CLASSES : 'border-slate-200 focus:border-brand-600'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Public title
                </label>
                <input
                  type="text"
                  value={draft.heading}
                  onChange={(e) => setDraft({ ...draft, heading: e.target.value })}
                  placeholder="Apply for this job"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-600 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Instructions <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <RichTextEditor
                value={draft.subheading}
                onChange={(nextHtml) => setDraft((prev) => ({ ...prev, subheading: nextHtml }))}
                minHeight={148}
                maxHeight={300}
                ariaLabel="Applicant instructions"
                placeholder="Optional formatted instructions shown under the form heading..."
              />
            </div>
          </div>

          {/* 2. Form fields */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 card-shadow space-y-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">2. Form fields</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Always shown at the top: Resume, Full name, Email, Phone, Work authorization.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
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
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset order</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleAddBlankCustomField('TEXT')}
                  className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-[11px] font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add field</span>
                </button>
              </div>
            </div>

            {orderedEntries.length > 0 ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                modifiers={[restrictToVerticalContainer]}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={orderedEntries.map((item) => item.key)}
                  strategy={verticalListSortingStrategy}
                >
                  <div
                    ref={fieldsListRef}
                    className="space-y-2.5 relative overflow-hidden p-0.5 -m-0.5"
                  >
                    {orderedEntries.map((entry, idx) => (
                      <SortableFieldRow
                        key={entry.key}
                        entry={entry}
                        index={idx}
                        totalCount={orderedEntries.length}
                        isExpanded={entry.kind === 'custom' && expandedCustomKey === entry.key}
                        autoFocusLabel={
                          entry.kind === 'custom' && autoFocusCustomKey === entry.key
                        }
                        onAutoFocusHandled={() => {
                          if (autoFocusCustomKey === entry.key) {
                            setAutoFocusCustomKey(null);
                          }
                        }}
                        onToggleExpand={() =>
                          setExpandedCustomKey((prev) =>
                            prev === entry.key ? null : entry.key
                          )
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
                            ? (patch) => handleUpdateCustomField(entry.key, patch)
                            : undefined
                        }
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              <div className="px-4 py-6 rounded-xl bg-slate-50/70 border border-dashed border-slate-200 text-center text-xs text-slate-500">
                No optional fields or custom questions active yet. Use quick add below to add fields.
              </div>
            )}

            {/* Quick Add Bar */}
            <div className="pt-2 space-y-2">
              <div className="text-[11px] font-medium text-slate-500">
                Quick add screening question
              </div>
              <div className="flex flex-wrap gap-2">
                {hiddenStandardFields.map((field) => (
                  <button
                    key={field.key}
                    type="button"
                    onClick={() => toggleStandardField(field.key, true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-700 text-[11px] font-medium transition-colors cursor-pointer"
                  >
                    <Plus className="w-3 h-3 text-slate-500" />
                    <span>{field.label}</span>
                  </button>
                ))}

                {availablePresets.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => handleAddPresetQuestion(preset)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-700 text-[11px] font-medium transition-colors cursor-pointer"
                  >
                    <Plus className="w-3 h-3 text-slate-500" />
                    <span>{preset.label}</span>
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => handleAddBlankCustomField('DROPDOWN')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-brand-600 hover:bg-brand-700 text-white text-[11px] font-semibold transition-colors cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Custom dropdown</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleAddBlankCustomField('TEXT')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-700 text-[11px] font-medium transition-colors cursor-pointer"
                >
                  <Plus className="w-3 h-3 text-slate-500" />
                  <span>Custom question</span>
                </button>
              </div>
            </div>
          </div>
        </form>
      ) : (
        /* Preview Tab — Displays Only the Form in the Clean Public Application Design System */
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          {/* Top White Navbar */}
          <div className="border-b border-slate-200 px-6 sm:px-8 h-14 flex items-center justify-between gap-4 bg-white">
            <span className="text-[15px] font-bold tracking-tight text-slate-900 truncate">
              {agencyName}
            </span>
            <div className="flex items-center gap-3 shrink-0">
              <span className="hidden sm:inline text-xs text-slate-500">
                Form preview &middot; Submissions aren&rsquo;t saved
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-brand-300 text-[11px] font-semibold text-brand-700">
                <Eye className="w-3 h-3 text-brand-600 shrink-0" />
                <span>Preview</span>
              </span>
            </div>
          </div>

          <div className="px-5 sm:px-8 py-8 bg-white">
            <div className="max-w-2xl mx-auto">
              <ApplicationFormPreview
                template={draft}
                agencyName={agencyName}
                isPreviewNotice={true}
              />
            </div>
          </div>

          <div className="border-t border-slate-200 px-6 sm:px-8 py-4 flex items-center justify-between gap-4 text-[11px] text-slate-400 bg-white">
            <span>&copy; {agencyName}</span>
            <span>Powered by SquadPipe</span>
          </div>
        </div>
      )}

      <UnsavedChangesModal
        isOpen={showLeaveModal}
        onConfirmLeave={confirmLeave}
        onCancelLeave={cancelLeave}
      />
    </section>
  );
};
