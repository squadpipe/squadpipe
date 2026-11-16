import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { apiClient } from '../../config/api.config';
import { BillablePlacement, Candidate } from '../../types';
import { MaskedValue } from '../../components/shared/MaskedValue';
import { TablePagination } from '../../components/shared/TablePagination';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { ModalPortal } from '../../components/shared/ModalPortal';
import { SkillTagInput } from '../../components/shared/SkillTagInput';
import { useDebounce } from '../../utils/useDebounce';
import { mapCandidateFromApi } from '../../utils/entityMappers';
import { useMasterTaxonomies } from '../../components/shared/DynamicCustomFieldsSection';
import {
  extractResumeMatchExcerpt,
  matchesCandidateQuery,
  parseCandidateHourlyRate,
} from '../../utils/candidateSearch';
import {
  ALLOWED_CV_ACCEPT,
  downloadOriginalCandidateCv,
  validateCvFileSelection,
} from '../../utils/cvFiles';

interface ConsultantsViewProps {
  candidates: Candidate[];
  placements?: BillablePlacement[];
  rateMasked: boolean;
  onOpenResumeParser: () => void;
  onPreviewResume: (candidate: Candidate) => void;
  onOpenAddConsultant?: () => void;
  onOpenCsvImport?: () => void;
  onNavigateToBillable?: () => void;
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
  onUpdateCandidate,
  onDeleteCandidate,
}) => {
  const [search, setSearch] = useState('');
  const [workAuthFilter, setWorkAuthFilter] = useState('All');
  const [stageFilter, setStageFilter] = useState('All');
  const [minRate, setMinRate] = useState('');
  const [maxRate, setMaxRate] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [tableRows, setTableRows] = useState<Candidate[]>(() => candidates.slice(0, 10));
  const [totalRows, setTotalRows] = useState(candidates.length);
  const [isLoadingRows, setIsLoadingRows] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState<Candidate | null>(null);
  const [editCvFile, setEditCvFile] = useState<File | null>(null);
  const [editCvError, setEditCvError] = useState<string>('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isDownloadingEditCv, setIsDownloadingEditCv] = useState(false);
  const [candidateToDelete, setCandidateToDelete] = useState<Candidate | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const taxonomies = useMasterTaxonomies(true);

  useEffect(() => {
    setEditCvFile(null);
    setEditCvError('');
    setIsSavingEdit(false);
    setIsDownloadingEditCv(false);
  }, [editingCandidate?.id]);

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
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Consultant Roster</h2>
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
              <span>CSV Import & Column Mapping</span>
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
        {/* Subheader Filter Bar */}
        <div className="px-5 py-3 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-xs text-slate-900 mr-1">
              {totalRows} Active Consultants
            </span>
            <select
              aria-label="Filter by work authorization"
              value={workAuthFilter}
              onChange={(e) => setWorkAuthFilter(e.target.value)}
              className="py-1 px-2.5 bg-white border border-slate-200 rounded-md text-xs font-semibold text-slate-700 cursor-pointer outline-none"
            >
              <option value="All">All Authorizations</option>
              {taxonomies.workAuth.map((auth) => (
                <option key={auth} value={auth}>
                  {auth}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter by pipeline stage"
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="py-1 px-2.5 bg-white border border-slate-200 rounded-md text-xs font-semibold text-slate-700 cursor-pointer outline-none"
            >
              <option value="All">All Stages</option>
              <option value="Available / Bench">Available / Bench</option>
              <option value="Submitted">Submitted</option>
              <option value="Interview">Interview</option>
              <option value="Selected">Selected</option>
              <option value="Onboarding">Onboarding</option>
              <option value="Billable">Billable</option>
            </select>
            {!rateMasked && (
              <div className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                <input
                  type="number"
                  min={0}
                  value={minRate}
                  onChange={(e) => setMinRate(e.target.value)}
                  placeholder="Min $/hr"
                  aria-label="Minimum hourly rate"
                  className="w-20 px-2 py-1 text-xs border border-slate-200 rounded-md bg-white text-slate-700 outline-none focus:border-brand-500"
                />
                <span>–</span>
                <input
                  type="number"
                  min={0}
                  value={maxRate}
                  onChange={(e) => setMaxRate(e.target.value)}
                  placeholder="Max $/hr"
                  aria-label="Maximum hourly rate"
                  className="w-20 px-2 py-1 text-xs border border-slate-200 rounded-md bg-white text-slate-700 outline-none focus:border-brand-500"
                />
              </div>
            )}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-[11px] font-semibold text-brand-600 hover:text-brand-700 hover:underline px-1 cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, skills, or resume text (e.g. Kubernetes AND Terraform)..."
              className="pl-8 pr-3 py-1 text-xs border border-slate-200 rounded-md bg-white w-full sm:w-80 text-slate-700 outline-none focus:border-brand-500"
            />
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
                <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                  {/* Full Name & Contacts */}
                  <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                    <div
                      className="font-semibold hover:text-brand-600 cursor-pointer"
                      onClick={() => onPreviewResume(c)}
                    >
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
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onPreviewResume(c)}
                        title="View consultant profile brief"
                        aria-label={`View profile brief for ${c.fullName}`}
                        className="p-1.5 text-slate-400 hover:text-brand-600 rounded hover:bg-brand-50 transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      {onUpdateCandidate && (
                        <button
                          type="button"
                          onClick={() => setEditingCandidate({ ...c })}
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

      {/* Edit Consultant Modal */}
      {editingCandidate && (
        <ModalPortal>
          <div
            onClick={() => setEditingCandidate(null)}
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-scale-up flex flex-col max-h-[90vh]"
            >
            <div className="shrink-0 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Edit Consultant</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">{editingCandidate.fullName}</p>
              </div>
              <button
                type="button"
                disabled={isSavingEdit}
                onClick={() => {
                  setEditCvFile(null);
                  setEditCvError('');
                  setEditingCandidate(null);
                }}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!onUpdateCandidate) {
                  setEditingCandidate(null);
                  return;
                }
                setIsSavingEdit(true);
                setEditCvError('');
                try {
                  await onUpdateCandidate(editingCandidate, editCvFile);
                  setEditCvFile(null);
                  setEditingCandidate(null);
                } catch (err: any) {
                  setEditCvError(
                    err?.response?.data?.message ||
                      err?.message ||
                      'Failed to save changes.'
                  );
                } finally {
                  setIsSavingEdit(false);
                }
              }}
              className="p-6 space-y-3.5 text-xs overflow-y-auto custom-scrollbar"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={editingCandidate.fullName}
                    onChange={(e) => setEditingCandidate({ ...editingCandidate, fullName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Current Title *</label>
                  <input
                    type="text"
                    required
                    value={editingCandidate.currentTitle}
                    onChange={(e) => setEditingCandidate({ ...editingCandidate, currentTitle: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    value={editingCandidate.email}
                    onChange={(e) => setEditingCandidate({ ...editingCandidate, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Phone</label>
                  <input
                    type="text"
                    value={editingCandidate.phone}
                    onChange={(e) => setEditingCandidate({ ...editingCandidate, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Work Auth</label>
                  <select
                    value={editingCandidate.workAuth}
                    onChange={(e) => setEditingCandidate({ ...editingCandidate, workAuth: e.target.value })}
                    className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:border-brand-600 focus:outline-none cursor-pointer"
                  >
                    <option value="US Citizen">US Citizen</option>
                    <option value="Green Card">Green Card</option>
                    <option value="H-1B">H-1B</option>
                    <option value="TN Visa">TN Visa</option>
                    <option value="OPT">OPT / CPT</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Hourly Rate</label>
                  <input
                    type="text"
                    value={editingCandidate.hourlyRate}
                    onChange={(e) => setEditingCandidate({ ...editingCandidate, hourlyRate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Relocation</label>
                  <select
                    value={editingCandidate.relocation}
                    onChange={(e) => setEditingCandidate({ ...editingCandidate, relocation: e.target.value })}
                    className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:border-brand-600 focus:outline-none cursor-pointer"
                  >
                    <option value="Yes">Open (Yes)</option>
                    <option value="No">Local Only (No)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Pipeline Stage</label>
                <select
                  value={editingCandidate.pipelineStage}
                  onChange={(e) => setEditingCandidate({ ...editingCandidate, pipelineStage: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:border-brand-600 focus:outline-none cursor-pointer"
                >
                  <option value="Available / Bench">Available / Bench</option>
                  <option value="Submitted">Submitted</option>
                  <option value="Interview">Interview</option>
                  <option value="Selected">Selected</option>
                  <option value="Onboarding">Onboarding</option>
                  <option value="Billable">Billable</option>
                  <option value="Archived">Archived</option>
                  <option value="Placed">Placed</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Key Skillset</label>
                <SkillTagInput
                  value={editingCandidate.skillset}
                  onChange={(nextCsv) => setEditingCandidate({ ...editingCandidate, skillset: nextCsv })}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-semibold text-slate-700">
                    Original CV / Resume File
                  </label>
                  {editingCandidate.resumeFileUrl && (
                    <button
                      type="button"
                      disabled={isDownloadingEditCv}
                      onClick={async () => {
                        setIsDownloadingEditCv(true);
                        setEditCvError('');
                        try {
                          await downloadOriginalCandidateCv(
                            editingCandidate.id,
                            editingCandidate.resumeName || `${editingCandidate.fullName}_CV.pdf`
                          );
                        } catch (err: any) {
                          setEditCvError(
                            err?.response?.data?.message || 'Unable to download stored CV file.'
                          );
                        } finally {
                          setIsDownloadingEditCv(false);
                        }
                      }}
                      className="text-[11px] font-semibold text-brand-600 hover:text-brand-700 inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      {isDownloadingEditCv ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Download className="w-3 h-3" />
                      )}
                      <span>Download Stored CV</span>
                    </button>
                  )}
                </div>

                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files?.[0];
                    if (!file) return;
                    const errMsg = validateCvFileSelection(file);
                    if (errMsg) {
                      setEditCvError(errMsg);
                      return;
                    }
                    setEditCvError('');
                    setEditCvFile(file);
                  }}
                  className="p-3 rounded-lg border border-dashed border-slate-300 bg-slate-50/70 space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold text-slate-800 truncate">
                          {editCvFile
                            ? editCvFile.name
                            : editingCandidate.resumeFileUrl
                              ? editingCandidate.resumeName || 'Stored Original CV'
                              : 'No original CV file uploaded yet'}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {editCvFile
                            ? `New upload ready (${(editCvFile.size / 1024).toFixed(1)} KB) — saves on update`
                            : editingCandidate.resumeFileUrl
                              ? 'Upload a new file to replace the stored CV'
                              : 'PDF, DOC, DOCX, TXT, or RTF (max 15 MB)'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {editCvFile && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditCvFile(null);
                            setEditCvError('');
                          }}
                          className="px-2 py-1 rounded border border-slate-200 bg-white text-rose-600 hover:bg-rose-50 text-[11px] font-medium cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                      <label className="px-2.5 py-1.5 rounded-md bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors">
                        <Upload className="w-3 h-3 text-brand-600" />
                        <span>
                          {editCvFile
                            ? 'Change File'
                            : editingCandidate.resumeFileUrl
                              ? 'Replace CV'
                              : 'Upload CV'}
                        </span>
                        <input
                          type="file"
                          accept={ALLOWED_CV_ACCEPT}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const errMsg = validateCvFileSelection(file);
                            if (errMsg) {
                              setEditCvError(errMsg);
                              e.target.value = '';
                              return;
                            }
                            setEditCvError('');
                            setEditCvFile(file);
                            e.target.value = '';
                          }}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                  {editCvError && (
                    <div className="text-[11px] text-rose-600 font-medium">{editCvError}</div>
                  )}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={isSavingEdit}
                  onClick={() => {
                    setEditCvFile(null);
                    setEditCvError('');
                    setEditingCandidate(null);
                  }}
                  className="px-3.5 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {isSavingEdit && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isSavingEdit ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
            </div>
          </div>
        </ModalPortal>
      )}

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
