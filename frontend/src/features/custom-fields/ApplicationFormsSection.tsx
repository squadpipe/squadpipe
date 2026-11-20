import React, { useEffect, useMemo, useState } from 'react';
import {
  Copy,
  Eye,
  FileText,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { apiClient } from '../../config/api.config';
import { ApplicationFormTemplate } from '../../types';
import {
  DEFAULT_APPLICATION_FORMS,
  summarizeFormTemplateFields,
} from '../../utils/applicationForms';
import { sortArrayByColumn, useTableSort } from '../../utils/tableSort';
import { useDebounce } from '../../utils/useDebounce';
import { ConfirmDeleteModal } from '../../components/shared/ConfirmDeleteModal';
import { AnimatedModal } from '../../components/shared/MotionPrimitives';
import { SortableTableHeader } from '../../components/shared/SortableTableHeader';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { TablePagination } from '../../components/shared/TablePagination';
import { ApplicationFormPreview } from './ApplicationFormPreview';

interface ApplicationFormsSectionProps {
  customFields?: Array<{ id?: string; key?: string; name: string; entity?: string; required?: boolean }>;
  initialForms?: ApplicationFormTemplate[] | null;
  onFormsChanged?: (forms: ApplicationFormTemplate[]) => void;
  onCreateForm: () => void;
  onEditForm: (form: ApplicationFormTemplate) => void;
  showToast: (title: string, message: string, icon?: string) => void;
}

export const ApplicationFormsSection: React.FC<ApplicationFormsSectionProps> = ({
  customFields,
  initialForms,
  onFormsChanged,
  onCreateForm,
  onEditForm,
  showToast,
}) => {
  const [forms, setForms] = useState<ApplicationFormTemplate[]>(
    initialForms && initialForms.length > 0 ? initialForms : DEFAULT_APPLICATION_FORMS
  );
  const [isLoading, setIsLoading] = useState(false);

  // List view filter, sort & pagination state
  const [filterScope, setFilterScope] = useState<'all' | 'with_custom'>('all');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 200);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const tableSort = useTableSort<'name' | 'fieldsCount' | 'customCount' | 'isDefault'>();
  const [expandedRowIds, setExpandedRowIds] = useState<Record<string, boolean>>({});

  // Row quick actions & preview modal state
  const [previewForm, setPreviewForm] = useState<ApplicationFormTemplate | null>(null);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [formToDelete, setFormToDelete] = useState<ApplicationFormTemplate | null>(null);

  const syncForms = (next: ApplicationFormTemplate[]) => {
    setForms(next);
    onFormsChanged?.(next);
  };

  useEffect(() => {
    if (initialForms && initialForms.length > 0) {
      setForms(initialForms);
    }
  }, [initialForms]);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    apiClient
      .get('/application-forms')
      .then((res) => {
        if (!active) return;
        if (res.data?.success && Array.isArray(res.data.data) && res.data.data.length > 0) {
          syncForms(res.data.data);
        }
      })
      .catch(() => {
        // Fallback to default templates
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filterScope, tableSort.sort.sortBy, tableSort.sort.sortDir]);

  const countCustomQuestions = (form: ApplicationFormTemplate) =>
    (form.customFields?.length || 0) +
    (form.customFieldKeys || []).filter(
      (k) => !(form.customFields || []).some((cf) => cf.key === k)
    ).length;

  const formsWithCustomCount = useMemo(
    () => forms.filter((f) => countCustomQuestions(f) > 0).length,
    [forms]
  );

  const processedForms = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    const filtered = forms.filter((form) => {
      if (filterScope === 'with_custom' && countCustomQuestions(form) === 0) {
        return false;
      }
      if (!q) return true;
      const chipNames = summarizeFormTemplateFields(form, customFields)
        .map((c) => c.label.toLowerCase())
        .join(' ');
      return (
        form.name.toLowerCase().includes(q) ||
        String(form.heading || '').toLowerCase().includes(q) ||
        chipNames.includes(q)
      );
    });

    return sortArrayByColumn(filtered, tableSort.sort, {
      name: (f) => f.name,
      fieldsCount: (f) => summarizeFormTemplateFields(f, customFields).length,
      customCount: (f) => countCustomQuestions(f),
      isDefault: (f) => Boolean(f.isDefault),
    });
  }, [forms, customFields, debouncedSearch, filterScope, tableSort.sort]);

  const totalForms = processedForms.length;
  const totalPages = Math.max(1, Math.ceil(totalForms / Math.max(1, limit)));
  const safePage = Math.min(page, totalPages);
  const paginatedForms = useMemo(
    () => processedForms.slice((safePage - 1) * limit, safePage * limit),
    [processedForms, safePage, limit]
  );

  const handleSetDefault = async (form: ApplicationFormTemplate) => {
    if (form.isDefault || settingDefaultId) return;
    setSettingDefaultId(form.id);
    try {
      const res = await apiClient.patch(`/application-forms/${form.id}/default`);
      if (res.data?.success && Array.isArray(res.data.data)) {
        syncForms(res.data.data);
      } else {
        syncForms(forms.map((f) => ({ ...f, isDefault: f.id === form.id })));
      }
      showToast(
        'Default Form Updated',
        `"${form.name}" is now the default application form.`,
        'fa-solid fa-star text-emerald-500'
      );
    } catch (err: any) {
      showToast(
        'Update Failed',
        err?.response?.data?.message || 'Could not set default application form.',
        'fa-solid fa-triangle-exclamation text-rose-500'
      );
    } finally {
      setSettingDefaultId(null);
    }
  };

  const handleDuplicate = async (form: ApplicationFormTemplate) => {
    if (duplicatingId) return;
    setDuplicatingId(form.id);
    try {
      const res = await apiClient.post('/application-forms', {
        ...form,
        name: `${form.name} (Copy)`,
        isDefault: false,
      });
      if (res.data?.success && Array.isArray(res.data.data)) {
        syncForms(res.data.data);
        showToast(
          'Form Duplicated',
          `Created "${form.name} (Copy)".`,
          'fa-solid fa-copy text-brand-500'
        );
      }
    } catch (err: any) {
      showToast(
        'Duplicate Failed',
        err?.response?.data?.message || 'Could not duplicate application form.',
        'fa-solid fa-triangle-exclamation text-rose-500'
      );
    } finally {
      setDuplicatingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs shrink-0">
            <FileText className="w-4 h-4" />
          </span>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Application Forms
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                {forms.length} {forms.length === 1 ? 'Form' : 'Forms'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Create application forms for your job links, add custom questions directly on any form, and set one as your default.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onCreateForm}
          className="px-3.5 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Application Form</span>
        </button>
      </div>

      {/* List View with Filter, Sort & Pagination */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setFilterScope('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                filterScope === 'all'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-white hover:text-slate-900'
              }`}
            >
              All Forms ({forms.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterScope('with_custom')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                filterScope === 'with_custom'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-white hover:text-slate-900'
              }`}
            >
              With Custom Questions ({formsWithCustomCount})
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search forms or fields..."
              className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:border-brand-600 focus:outline-none transition-colors"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <SortableTableHeader
                  label="Form Name"
                  column="name"
                  sort={tableSort.sort}
                  onSort={tableSort.handleSort}
                  defaultDir="asc"
                  className="py-2.5 px-5 whitespace-nowrap"
                />
                <SortableTableHeader
                  label="Included Fields"
                  column="fieldsCount"
                  sort={tableSort.sort}
                  onSort={tableSort.handleSort}
                  defaultDir="desc"
                  className="py-2.5 px-4 whitespace-nowrap"
                />
                <SortableTableHeader
                  label="Custom Questions"
                  column="customCount"
                  sort={tableSort.sort}
                  onSort={tableSort.handleSort}
                  defaultDir="desc"
                  className="py-2.5 px-4 whitespace-nowrap"
                />
                <SortableTableHeader
                  label="Default"
                  column="isDefault"
                  sort={tableSort.sort}
                  onSort={tableSort.handleSort}
                  defaultDir="desc"
                  className="py-2.5 px-4 whitespace-nowrap"
                />
                <th className="py-2.5 px-5 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedForms.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-xs text-slate-400">
                    {search.trim() || filterScope !== 'all' ? (
                      <>
                        No application forms match your filter.{' '}
                        <button
                          type="button"
                          onClick={() => {
                            setSearch('');
                            setFilterScope('all');
                          }}
                          className="font-semibold text-brand-600 hover:underline cursor-pointer"
                        >
                          Reset Filters
                        </button>
                      </>
                    ) : (
                      <>
                        No application forms created yet. Click{' '}
                        <button
                          type="button"
                          onClick={onCreateForm}
                          className="font-semibold text-brand-600 hover:underline cursor-pointer"
                        >
                          New Application Form
                        </button>{' '}
                        to create one.
                      </>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedForms.map((form) => {
                  const fieldChips = summarizeFormTemplateFields(form, customFields);
                  const customChips = fieldChips.filter((c) => c.isCustom);
                  const isExpanded = Boolean(expandedRowIds[form.id]);
                  const maxVisible = 6;
                  const visibleChips = isExpanded
                    ? fieldChips
                    : fieldChips.slice(0, maxVisible);
                  const hiddenCount = Math.max(0, fieldChips.length - maxVisible);

                  return (
                    <tr
                      key={form.id}
                      onClick={() => onEditForm(form)}
                      className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                    >
                      <td className="py-3.5 px-5 align-top max-w-[260px]">
                        <div className="font-bold text-slate-900 leading-snug break-words">
                          {form.name}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 leading-snug break-words">
                          {form.heading || 'Submit Candidate Profile & Resume'}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 align-top">
                        <div
                          className="flex flex-wrap gap-1 items-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {visibleChips.map((chip, idx) => (
                            <span
                              key={`${chip.label}_${idx}`}
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10.5px] font-medium border ${
                                chip.isCustom
                                  ? 'bg-white border-slate-300/90 text-slate-800'
                                  : chip.required
                                    ? 'bg-slate-100/80 border-slate-200/90 text-slate-800 font-semibold'
                                    : 'bg-white border-slate-200/80 text-slate-600'
                              }`}
                            >
                              {chip.isCustom && (
                                <span className="w-1.5 h-1.5 rounded-full bg-brand-600 shrink-0" />
                              )}
                              <span>
                                {chip.label}
                                {chip.required ? ' *' : ''}
                              </span>
                            </span>
                          ))}
                          {hiddenCount > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedRowIds((prev) => ({
                                  ...prev,
                                  [form.id]: !isExpanded,
                                }))
                              }
                              className="ml-1 inline-flex items-center text-[11px] font-semibold text-brand-600 hover:text-brand-700 underline underline-offset-2 whitespace-nowrap cursor-pointer transition-colors"
                            >
                              {isExpanded ? 'Show less' : `+${hiddenCount} more`}
                            </button>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 align-top whitespace-nowrap">
                        {customChips.length > 0 ? (
                          <StatusBadge
                            tone="brand"
                            shape="rounded"
                            label={`${customChips.length} ${
                              customChips.length === 1 ? 'Question' : 'Questions'
                            }`}
                            className="py-1 tabular-nums"
                          />
                        ) : (
                          <span className="text-[11px] text-slate-400">Standard only</span>
                        )}
                      </td>

                      <td
                        className="py-3.5 px-4 align-top whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {form.isDefault ? (
                          <StatusBadge
                            tone="emerald"
                            shape="rounded"
                            label="Default"
                            className="py-1 font-semibold"
                          />
                        ) : (
                          <button
                            type="button"
                            disabled={settingDefaultId === form.id || isLoading}
                            onClick={() => handleSetDefault(form)}
                            className="px-2.5 py-1 rounded-md border border-slate-200/90 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-600 hover:text-slate-900 text-[11px] font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <Star className="w-3 h-3 text-slate-400" />
                            <span>
                              {settingDefaultId === form.id ? 'Setting...' : 'Make Default'}
                            </span>
                          </button>
                        )}
                      </td>

                      <td
                        className="py-3.5 px-5 align-top text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setPreviewForm(form)}
                            title="Preview application form"
                            className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-brand-50 hover:border-brand-200 text-slate-700 hover:text-brand-700 text-[11px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Preview</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onEditForm(form)}
                            title="Edit application form"
                            className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Pencil className="w-3 h-3" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            disabled={duplicatingId === form.id}
                            onClick={() => handleDuplicate(form)}
                            title="Duplicate application form"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          {forms.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setFormToDelete(form)}
                              title="Delete application form"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <TablePagination
          page={safePage}
          limit={limit}
          total={totalForms}
          onPageChange={setPage}
          onLimitChange={(nextLimit) => {
            setLimit(nextLimit);
            setPage(1);
          }}
          itemLabel="forms"
          isLoading={isLoading}
          pageSizeOptions={[5, 10, 20]}
          alwaysShow={true}
        />
      </div>

      {/* Template Preview Modal */}
      <AnimatedModal
        isOpen={Boolean(previewForm)}
        onBackdropClick={() => setPreviewForm(null)}
        zIndexClass="z-50"
        panelClassName="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
        ariaLabel={previewForm ? `Preview ${previewForm.name}` : 'Preview Application Form'}
      >
        {previewForm && (
          <>
            <div className="px-5 py-3.5 bg-[#141615] text-white border-b border-white/10 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-brand-600 text-white flex items-center justify-center shrink-0">
                  <Eye className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-white truncate">{previewForm.name}</h3>
                    {previewForm.isDefault && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-[10px] font-semibold text-emerald-300">
                        Default
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Public applicant view preview (
                    {summarizeFormTemplateFields(previewForm, customFields).length} fields)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewForm(null)}
                className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 bg-slate-50/80 overflow-y-auto flex-1">
              <ApplicationFormPreview template={previewForm} />
            </div>

            <div className="px-5 py-3 bg-white border-t border-slate-100 flex items-center justify-end gap-2 shrink-0 text-xs">
              <button
                type="button"
                onClick={() => setPreviewForm(null)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = previewForm;
                  setPreviewForm(null);
                  onEditForm(target);
                }}
                className="px-3.5 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Pencil className="w-3 h-3" />
                <span>Edit Form</span>
              </button>
            </div>
          </>
        )}
      </AnimatedModal>

      <ConfirmDeleteModal
        isOpen={Boolean(formToDelete)}
        onClose={() => setFormToDelete(null)}
        title="Delete Application Form?"
        description={
          formToDelete ? (
            <>
              Permanently remove <strong className="text-slate-800">{formToDelete.name}</strong>?
              Job requirements using this form will fall back to your default form.
            </>
          ) : null
        }
        confirmLabel="Delete Form"
        onConfirm={async () => {
          if (!formToDelete) return;
          const res = await apiClient.delete(`/application-forms/${formToDelete.id}`);
          if (res.data?.success && Array.isArray(res.data.data)) {
            syncForms(res.data.data);
          }
          showToast(
            'Application Form Deleted',
            `Removed "${formToDelete.name}".`,
            'fa-solid fa-trash-can text-slate-500'
          );
        }}
      />
    </div>
  );
};
