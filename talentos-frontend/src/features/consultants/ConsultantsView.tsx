import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  Pencil,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import { apiClient } from '../../config/api.config';
import { BillablePlacement, Candidate } from '../../types';
import { MaskedValue } from '../../components/shared/MaskedValue';
import { TablePagination } from '../../components/shared/TablePagination';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { CustomSelect } from '../../components/shared/CustomSelect';
import { ModalPortal } from '../../components/shared/ModalPortal';
import { EditConsultantModal } from '../../components/modals/edit/EditConsultantModal';
import { useDebounce } from '../../utils/useDebounce';
import { mapCandidateFromApi } from '../../utils/entityMappers';
import { useCurrency } from '../../utils/currency';
import { useMasterTaxonomies } from '../../components/shared/DynamicCustomFieldsSection';
import {
  extractResumeMatchExcerpt,
  matchesCandidateQuery,
  parseCandidateHourlyRate,
} from '../../utils/candidateSearch';

interface ConsultantsViewProps {
  candidates: Candidate[];
  placements?: BillablePlacement[];
  rateMasked: boolean;
  onOpenResumeParser: () => void;
  onPreviewResume: (candidate: Candidate, startEditing?: boolean) => void;
  onOpenAddConsultant?: () => void;
  onOpenCsvImport?: () => void;
  onNavigateToBillable?: () => void;
  canEditCandidate?: boolean;
  onUpdateCandidate?: (candidate: Candidate, cvFile?: File | null) => Promise<void> | void;
  onDeleteCandidate?: (candidate: Candidate) => Promise<void> | void;
}

export const ConsultantsView: React.FC<ConsultantsViewProps> = ({
  candidates,
  placements = [],
  rateMasked,
  onOpenResumeParser,
  onPreviewResume,
  onOpenAddConsultant,
  onOpenCsvImport,
  onNavigateToBillable,
  canEditCandidate = true,
  onUpdateCandidate,
  onDeleteCandidate,
}) => {
  const [search, setSearch] = useState('');
  const [workAuthFilter, setWorkAuthFilter] = useState('All');
  const [stageFilter, setStageFilter] = useState('All');
  const [minRate, setMinRate] = useState('');
  const [maxRate, setMaxRate] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(5);
  const [tableRows, setTableRows] = useState<Candidate[]>(() => candidates.slice(0, 5));
  const [totalRows, setTotalRows] = useState(candidates.length);
  const [isLoadingRows, setIsLoadingRows] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState<Candidate | null>(null);
  const [candidateToDelete, setCandidateToDelete] = useState<Candidate | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { symbol: currencySymbol } = useCurrency();
  const taxonomies = useMasterTaxonomies(true);

  const getLinkedPlacements = (cand: Candidate): BillablePlacement[] => {
    const nameKey = cand.fullName.trim().toLowerCase();
    return placements.filter(
      (p) =>
        p.status !== 'Completed' &&
        p.status !== 'Terminated' &&
        ((p.candidateId && p.candidateId === cand.id) ||
          p.resourceName.trim().toLowerCase() === nameKey)
    );
  };

  const isConsultantBillable = (cand: Candidate): boolean =>
    cand.pipelineStage === 'Billable' || getLinkedPlacements(cand).length > 0;

  const debouncedSearch = useDebounce(search, 150);
  const debouncedMinRate = useDebounce(minRate, 200);
  const debouncedMaxRate = useDebounce(maxRate, 200);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, workAuthFilter, stageFilter, debouncedMinRate, debouncedMaxRate]);

  useEffect(() => {
    let active = true;
    const minNum = !rateMasked && debouncedMinRate.trim() !== '' ? Number(debouncedMinRate) : NaN;
    const maxNum = !rateMasked && debouncedMaxRate.trim() !== '' ? Number(debouncedMaxRate) : NaN;

    const localFiltered = candidates.filter((c) => {
      const matchesSearch = matchesCandidateQuery(c, debouncedSearch);
      const matchesAuth =
        workAuthFilter === 'All' ||
        (c.workAuth || '').toLowerCase().includes(workAuthFilter.toLowerCase());
      const matchesStage =
        stageFilter === 'All' ||
        (c.pipelineStage || '').toLowerCase() === stageFilter.toLowerCase();

      let matchesRate = true;
      if (!rateMasked && (Number.isFinite(minNum) || Number.isFinite(maxNum))) {
        const numericRate = parseCandidateHourlyRate(c.hourlyRate);
        if (numericRate === null) {
          matchesRate = false;
        } else {
          if (Number.isFinite(minNum) && numericRate < minNum) matchesRate = false;
          if (Number.isFinite(maxNum) && numericRate > maxNum) matchesRate = false;
        }
      }

      return matchesSearch && matchesAuth && matchesStage && matchesRate;
    });

    if (candidates.length > 0) {
      setTotalRows(localFiltered.length);
      setTableRows(localFiltered.slice((page - 1) * limit, page * limit));
      setIsLoadingRows(false);
    } else {
      setIsLoadingRows(true);
    }

    apiClient
      .get('/candidates', {
        params: {
          search: debouncedSearch.trim() || undefined,
          workAuth: workAuthFilter !== 'All' ? workAuthFilter : undefined,
          stage: stageFilter !== 'All' ? stageFilter : undefined,
          minRate: !rateMasked && Number.isFinite(minNum) ? minNum : undefined,
          maxRate: !rateMasked && Number.isFinite(maxNum) ? maxNum : undefined,
          page,
          limit,
        },
      })
      .then((res) => {
        if (!active) return;
        if (res.data?.success && Array.isArray(res.data.data)) {
          const mapped = res.data.data.map(mapCandidateFromApi);
          setTableRows(mapped);
          setTotalRows(res.data.pagination?.total ?? mapped.length);
        }
      })
      .catch(() => {
        if (!active) return;
        setTotalRows(localFiltered.length);
        setTableRows(localFiltered.slice((page - 1) * limit, page * limit));
      })
      .finally(() => {
        if (active) setIsLoadingRows(false);
      });
    return () => {
      active = false;
    };
  }, [
    debouncedSearch,
    workAuthFilter,
    stageFilter,
    debouncedMinRate,
    debouncedMaxRate,
    rateMasked,
    page,
    limit,
    candidates,
  ]);

  const filtered = tableRows;
  const hasActiveFilters =
    Boolean(search.trim()) ||
    workAuthFilter !== 'All' ||
    stageFilter !== 'All' ||
    (!rateMasked && (Boolean(minRate.trim()) || Boolean(maxRate.trim())));

  const clearAllFilters = () => {
    setSearch('');
    setWorkAuthFilter('All');
    setStageFilter('All');
    setMinRate('');
    setMaxRate('');
  };

  return (
    <section className="max-w-7xl mx-auto space-y-5 animate-fade-in">
      {/* Header with Title & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Consultant Roster</h2>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200/80 text-[11px] font-semibold text-slate-600">
              {totalRows} Active
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Candidate profiles, work authorizations, verified technical skills, and readiness status.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onOpenCsvImport && (
            <button
              onClick={onOpenCsvImport}
              className="px-3 py-1.5 rounded-md border border-slate-200 bg-white text-slate-700 text-xs font-medium hover:bg-slate-50 flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Import CSV</span>
            </button>
          )}
          <button
            onClick={onOpenResumeParser}
            className="px-3 py-1.5 rounded-md border border-slate-200 bg-white text-slate-700 text-xs font-medium hover:bg-slate-50 flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-brand-600" />
            <span>Resume Parser</span>
          </button>
          {onOpenAddConsultant && (
            <button
              onClick={onOpenAddConsultant}
              className="px-3.5 py-1.5 rounded-md bg-brand-600 text-white text-xs font-medium hover:bg-brand-700 shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={2.4} />
              <span>Add Consultant</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Roster Table Card */}
      <div className="bg-white rounded-xl border border-slate-200/80 card-shadow overflow-hidden">
        {/* Subheader Search & Filter Toolbar */}
        <div className="px-4 py-3 border-b border-slate-100 flex flex-col xl:flex-row xl:items-center gap-2.5 bg-slate-50/50">
          <div className="relative flex-1 min-w-[230px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, skills, boolean (AND / OR), or resume text..."
              className="w-full h-8 pl-8 pr-7 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 placeholder:text-slate-400 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-500/10 transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap xl:flex-nowrap shrink-0">
            <CustomSelect
              ariaLabel="Filter by work authorization"
              value={workAuthFilter}
              onChange={setWorkAuthFilter}
              size="sm"
              fullWidth={false}
              minMenuWidth={165}
              options={[
                { value: 'All', label: 'All Authorizations' },
                ...taxonomies.workAuth.map((auth) => ({ value: auth, label: auth })),
              ]}
            />
            <CustomSelect
              ariaLabel="Filter by pipeline stage"
              value={stageFilter}
              onChange={setStageFilter}
              size="sm"
              fullWidth={false}
              minMenuWidth={155}
              options={[
                { value: 'All', label: 'All Stages' },
                'Available / Bench',
                'Submitted',
                'Interview',
                'Selected',
                'Onboarding',
                'Billable',
              ]}
            />
            {!rateMasked && (
              <div className="inline-flex items-center h-8 bg-white border border-slate-200 rounded-lg px-2 gap-1 focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-500/10 transition-all">
                <span className="text-[11px] font-semibold text-slate-400 pr-1.5 border-r border-slate-100 select-none whitespace-nowrap">
                  {currencySymbol}/hr
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={minRate}
                  onChange={(e) => setMinRate(e.target.value.replace(/[^\d]/g, ''))}
                  placeholder="Min"
                  aria-label="Minimum hourly rate"
                  className="w-10 text-center text-xs text-slate-700 placeholder:text-slate-400 bg-transparent outline-none"
                />
                <span className="text-slate-300 text-xs select-none">–</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={maxRate}
                  onChange={(e) => setMaxRate(e.target.value.replace(/[^\d]/g, ''))}
                  placeholder="Max"
                  aria-label="Maximum hourly rate"
                  className="w-10 text-center text-xs text-slate-700 placeholder:text-slate-400 bg-transparent outline-none"
                />
              </div>
            )}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="h-8 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200/80 text-slate-600 hover:text-slate-900 text-xs font-medium inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
              >
                <X className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase">
              <tr>
                <th className="px-4 py-3">Full Name</th>
                <th className="px-4 py-3">Work Auth</th>
                <th className="px-4 py-3">Current Title</th>
                <th className="px-4 py-3">Key Skillset</th>
                <th className="px-4 py-3">Hourly Rate</th>
                <th className="px-4 py-3">Relocation</th>
                <th className="px-4 py-3">Stage</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-6 py-10 text-center text-xs text-slate-400"
                  >
                    {hasActiveFilters ? (
                      <>
                        No consultants match your current filters.{' '}
                        <button
                          type="button"
                          onClick={clearAllFilters}
                          className="font-semibold text-brand-600 hover:text-brand-700 hover:underline cursor-pointer"
                        >
                          Clear Filters
                        </button>
                      </>
                    ) : (
                      <>
                        No consultants found in the roster. Click{' '}
                        {onOpenAddConsultant && (
                          <>
                            <button
                              type="button"
                              onClick={onOpenAddConsultant}
                              className="font-semibold text-brand-600 hover:text-brand-700 hover:underline cursor-pointer"
                            >
                              Add Consultant
                            </button>{' '}
                            or{' '}
                          </>
                        )}
                        <button
                          type="button"
                          onClick={onOpenResumeParser}
                          className="font-semibold text-brand-600 hover:text-brand-700 hover:underline cursor-pointer"
                        >
                          Upload Resume
                        </button>{' '}
                        to add talent.
                      </>
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => onPreviewResume(c, false)}
                  className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                >
                  {/* Full Name & Contacts */}
                  <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                    <div className="font-semibold text-slate-900">
                      {c.fullName}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {c.email} &bull; {c.phone}
                    </div>
                  </td>

                  {/* Work Auth */}
                  <td className="px-4 py-3 whitespace-nowrap text-[10px]">
                    <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200">
                      {c.workAuth}
                    </span>
                  </td>

                  {/* Current Title */}
                  <td className="px-4 py-3 text-slate-800 font-medium">
                    <div>{c.currentTitle}</div>
                    {search.trim() && (() => {
                      const excerpt = extractResumeMatchExcerpt(c.rawSnippet, search);
                      return excerpt ? (
                        <div className="text-[10px] font-normal text-brand-700 bg-brand-50/70 border border-brand-200/70 rounded px-1.5 py-0.5 mt-1 max-w-xs truncate" title={excerpt}>
                          CV match: {excerpt}
                        </div>
                      ) : null;
                    })()}
                  </td>

                  {/* Key Skillset */}
                  <td className="px-4 py-3 max-w-xs">
                    <div className="flex flex-wrap gap-1">
                      {c.skillset
                        .split(',')
                        .slice(0, 3)
                        .map((sk) => (
                          <span
                            key={sk}
                            className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-medium"
                          >
                            {sk.trim()}
                          </span>
                        ))}
                    </div>
                  </td>

                  {/* Hourly Rate */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <MaskedValue value={c.hourlyRate} isMasked={rateMasked} />
                  </td>

                  {/* Relocation */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                        c.relocation === 'Yes'
                          ? 'bg-emerald-500/[0.08] text-emerald-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {c.relocation === 'Yes' ? 'Open' : 'Local Only'}
                    </span>
                  </td>

                  {/* Pipeline Stage */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <StatusBadge stage={c.pipelineStage} size="xs" />
                  </td>

                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <div
                      className="inline-flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => onPreviewResume(c, false)}
                        title="View consultant profile"
                        aria-label={`View profile for ${c.fullName}`}
                        className="px-2 py-1 rounded text-[11px] font-semibold text-brand-600 hover:bg-brand-50 inline-flex items-center gap-0.5 transition-colors cursor-pointer"
                      >
                        <span>View</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                      {canEditCandidate && (
                        <button
                          type="button"
                          onClick={() => onPreviewResume(c, true)}
                          title="Edit consultant"
                          className="p-1.5 text-slate-400 hover:text-brand-600 rounded hover:bg-brand-50 transition-colors cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {onDeleteCandidate && (
                        <button
                          type="button"
                          onClick={() => setCandidateToDelete(c)}
                          title={
                            isConsultantBillable(c)
                              ? 'Billable consultant — remove from Billable Consultants before deleting'
                              : 'Delete consultant'
                          }
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
              )}
            </tbody>
          </table>
        </div>
        <TablePagination
          page={page}
          limit={limit}
          total={totalRows}
          onPageChange={setPage}
          onLimitChange={(nextLimit) => {
            setLimit(nextLimit);
            setPage(1);
          }}
          itemLabel="consultants"
          isLoading={isLoadingRows}
        />
      </div>

      {/* Delete Consultant Confirmation / Billable Block Modal */}
      {candidateToDelete && (
        <ModalPortal>
          {(() => {
            const linkedPlacements = getLinkedPlacements(candidateToDelete);
            const isBillable = isConsultantBillable(candidateToDelete);
            return (
              <div
                onClick={() => {
                  if (!isDeleting) setCandidateToDelete(null);
                }}
                className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-scale-up"
                >
                  <div className="p-6 space-y-4">
                    <div className="flex items-start gap-3.5">
                      <div
                        className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${
                          isBillable
                            ? 'bg-amber-50 border-amber-200 text-amber-600'
                            : 'bg-rose-50 border-rose-200 text-rose-600'
                        }`}
                      >
                        {isBillable ? (
                          <ShieldAlert className="w-5 h-5" />
                        ) : (
                          <AlertTriangle className="w-4 h-4" />
                        )}
                      </div>
                      <div className="space-y-1.5 min-w-0">
                        <h3 className="text-sm font-bold text-slate-900">
                          {isBillable ? 'Cannot Delete Billable Consultant' : 'Delete Consultant?'}
                        </h3>
                        {isBillable ? (
                          <>
                            <p className="text-xs text-slate-600 leading-relaxed">
                              <span className="font-semibold text-slate-900">
                                {candidateToDelete.fullName}
                              </span>{' '}
                              is currently listed under{' '}
                              <span className="font-semibold text-slate-800">Billable Consultants</span>
                              {linkedPlacements.length > 0
                                ? ` (${linkedPlacements.map((p) => p.customer).join(', ')})`
                                : ''}
                              .
                            </p>
                            <p className="text-[11px] text-amber-700 bg-amber-50/80 border border-amber-200/80 rounded-lg px-2.5 py-2 leading-relaxed font-medium">
                              You cannot delete a billable consultant directly. Please remove their record from Billable Consultants first.
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-xs text-slate-500 leading-relaxed">
                              Are you sure you want to permanently delete{' '}
                              <span className="font-semibold text-slate-900">
                                {candidateToDelete.fullName}
                              </span>{' '}
                              ({candidateToDelete.currentTitle}) from your consultant roster?
                            </p>
                            <p className="text-[11px] text-rose-600 font-medium pt-0.5">
                              This action cannot be undone and removes associated candidate submission records.
                            </p>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={() => setCandidateToDelete(null)}
                        className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
                      >
                        {isBillable ? 'Close' : 'Cancel'}
                      </button>

                      {isBillable ? (
                        onNavigateToBillable && (
                          <button
                            type="button"
                            onClick={() => {
                              setCandidateToDelete(null);
                              onNavigateToBillable();
                            }}
                            className="px-4 py-2 text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white rounded-lg shadow-xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
                          >
                            <span>Go to Billable Consultants</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )
                      ) : (
                        <button
                          type="button"
                          disabled={isDeleting}
                          onClick={async () => {
                            if (!onDeleteCandidate) return;
                            setIsDeleting(true);
                            try {
                              await onDeleteCandidate(candidateToDelete);
                              setCandidateToDelete(null);
                            } catch {
                              // Error toast handled by parent; keep modal open cleanly or close if blocked
                            } finally {
                              setIsDeleting(false);
                            }
                          }}
                          className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg shadow-xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>{isDeleting ? 'Deleting...' : 'Delete Consultant'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </ModalPortal>
      )}
    </section>
  );
};
