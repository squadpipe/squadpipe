import React, { useEffect, useState } from 'react';
import {
  Calendar,
  Clock,
  Cpu,
  Database,
  FileText,
  FileType,
  HardDrive,
  Hash,
  Layers,
  Loader2,
  RefreshCw,
  Save,
  User,
} from 'lucide-react';
import { AiIcon, AiMark } from '../../components/shared/AiBrand';
import { apiClient } from '../../config/api.config';
import { ActionButton } from '../../components/shared/ActionButton';
import { PageHeader } from '../../components/shared/PageHeader';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { setAiCapabilities } from '../../utils/workspaceBrand';
import { TablePagination } from '../../components/shared/TablePagination';
import {
  GridColumnHeader,
  STAFFING_GRID_CELL_CLASS,
  STAFFING_GRID_FRAME_CLASS,
  STAFFING_GRID_ROW_STATIC_CLASS,
  STAFFING_GRID_STICKY_TD_CLASS,
  STAFFING_GRID_STICKY_TH_CLASS,
  STAFFING_GRID_TABLE_CLASS,
  STAFFING_GRID_THEAD_CLASS,
  STAFFING_GRID_TH_CLASS,
} from '../../components/shared/StaffingGrid';
import { useClientPagination } from '../../utils/usePagination';

interface AiModelUsageRow {
  provider: string;
  model: string;
  actions: number;
  inputTokens: number;
  outputTokens: number;
  avgLatencyMs: number;
}

interface AiUsageSummaryResponse {
  monthStart: string;
  activeProvider: string;
  aiConfigured: boolean;
  usingByoKey: boolean;
  allowByoKey: boolean;
  planTier?: string;
  aiDisabledByPlan?: boolean;
  planActionLimit?: number;
  planTokenLimit?: number;
  actionsUsed: number;
  inputTokens: number;
  outputTokens: number;
  tokensUsed: number;
  actionLimit: number;
  tokenLimit: number;
  quotaExceeded: boolean;
  quotaReason?: string;
  byFeature: Record<string, { actions: number; inputTokens: number; outputTokens: number }>;
  byModel?: AiModelUsageRow[];
  byo?: {
    selfActionLimit?: number | null;
    selfTokenLimit?: number | null;
    monthlyActionLimit: number | null;
    monthlyTokenLimit: number | null;
  };
}

interface StorageUsageSummaryResponse {
  provider: 'local' | 's3' | 'cloudflare';
  storageLimitMb: number | null;
  totalFiles: number;
  candidatesWithCv: number;
  totalCandidates: number;
  measuredBytes: number;
  measuredFileCount: number;
  byFormat: Array<{ format: string; count: number; bytes: number }>;
  recentFiles: Array<{
    candidateId: string;
    fullName: string;
    fileName: string;
    format: string;
    provider: string;
    bytes: number | null;
    updatedAt: string;
  }>;
  recordCounts: {
    candidates: number;
    requirements: number;
    submissions: number;
    clients: number;
    vendors: number;
    placements: number;
    emailLogs: number;
  };
}

interface UsageViewProps {
  showToast: (title: string, message: string, icon?: string) => void;
}

const AI_FEATURE_LABELS: Record<string, string> = {
  resume_parse: 'Resume Parse',
  email_parse: 'Email to Job',
  capability_check: 'Capability Check',
  match_rank: 'Match Rank',
  pitch_draft: 'Pitch Draft',
  agent_prep: 'Action Center',
};

function formatModelLabel(model: string, usingByoKey: boolean): string {
  if (!usingByoKey && model.startsWith('@cf/')) {
    return model.split('/').pop() || model;
  }
  return model;
}

function formatBytes(bytes: number | null | undefined): string {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const idx = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const val = bytes / Math.pow(1024, idx);
  return `${val >= 10 || idx === 0 ? val.toFixed(0) : val.toFixed(1)} ${units[idx]}`;
}

export const UsageView: React.FC<UsageViewProps> = ({ showToast }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [storage, setStorage] = useState<StorageUsageSummaryResponse | null>(null);
  const [aiUsage, setAiUsage] = useState<AiUsageSummaryResponse | null>(null);
  const [actionLimitInput, setActionLimitInput] = useState('');
  const [tokenLimitInput, setTokenLimitInput] = useState('');
  const [savingLimits, setSavingLimits] = useState(false);

  const syncAiState = (usage: AiUsageSummaryResponse | null) => {
    setAiUsage(usage);
    if (!usage?.byo) return;
    const nextAction = usage.byo.selfActionLimit ?? usage.byo.monthlyActionLimit;
    const nextToken = usage.byo.selfTokenLimit ?? usage.byo.monthlyTokenLimit;
    setActionLimitInput(nextAction ? String(nextAction) : '');
    setTokenLimitInput(nextToken ? String(nextToken) : '');
  };

  const loadUsageData = async (manualRefresh = false) => {
    if (manualRefresh) setRefreshing(true);
    try {
      const [storageRes, aiRes] = await Promise.allSettled([
        apiClient.get('/settings/storage-usage'),
        apiClient.get('/settings/ai-usage'),
      ]);

      if (storageRes.status === 'fulfilled' && storageRes.value.data?.data) {
        setStorage(storageRes.value.data.data);
      }
      if (aiRes.status === 'fulfilled' && aiRes.value.data?.data) {
        syncAiState(aiRes.value.data.data);
      }
      if (manualRefresh) {
        showToast(
          'Usage Refreshed',
          'Workspace storage and usage metrics updated.',
          'refresh'
        );
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadUsageData(false);
  }, []);

  const handleSaveAiLimits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingLimits) return;
    setSavingLimits(true);
    try {
      const res = await apiClient.put('/settings/ai-config', {
        selfActionLimit: actionLimitInput.trim() ? Number(actionLimitInput.trim()) : null,
        selfTokenLimit: tokenLimitInput.trim() ? Number(tokenLimitInput.trim()) : null,
      });
      const data = res.data?.data;
      if (data?.summary) syncAiState(data.summary);
      if (data?.ai) setAiCapabilities(data.ai);
      showToast(
        'Quota Caps Updated',
        'Monthly AI action and token limits saved.',
        'success'
      );
    } catch (err: any) {
      showToast(
        'Update Failed',
        err?.response?.data?.message || 'Could not update AI quota limits.',
        'error'
      );
    } finally {
      setSavingLimits(false);
    }
  };

  // Show AI details ONLY when AI is actively configured and not disabled by plan
  const isAiActive = Boolean(aiUsage && aiUsage.aiConfigured && !aiUsage.aiDisabledByPlan);

  const filesPg = useClientPagination(
    storage?.recentFiles || [],
    10,
    `files|${storage?.totalFiles || 0}`
  );

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-16 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-brand-600" />
        <span>Loading workspace storage and usage metrics...</span>
      </div>
    );
  }

  const totalDbRecords = storage
    ? Object.values(storage.recordCounts).reduce((sum, n) => sum + n, 0)
    : 0;
  const cvCoveragePct =
    storage && storage.totalCandidates > 0
      ? Math.round((storage.candidatesWithCv / storage.totalCandidates) * 100)
      : 0;
  const storageLimitBytes =
    storage?.storageLimitMb && storage.storageLimitMb > 0
      ? storage.storageLimitMb * 1024 * 1024
      : null;
  const storageUsedPct =
    storageLimitBytes && storage
      ? Math.min(100, Math.round((storage.measuredBytes / storageLimitBytes) * 100))
      : null;

  return (
    <section className="max-w-7xl mx-auto px-1 sm:px-2 lg:px-4 space-y-5 pb-8 animate-fade-in">
      <PageHeader
        title="Usage & Storage"
        subtitle={
          isAiActive
            ? 'Monitor resume storage, workspace records, and active AI usage.'
            : 'Monitor uploaded resume storage, file formats, and workspace records.'
        }
        actions={
          <button
            type="button"
            disabled={refreshing}
            onClick={() => void loadUsageData(true)}
            className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 hover:text-brand-600 hover:bg-slate-50 disabled:opacity-60 inline-flex items-center gap-1.5 text-[11px] font-semibold transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        }
      />

      {/* Standalone 4-Column Storage & Footprint Summary Card */}
      <div className="bg-white rounded-xl border border-slate-200/90 card-shadow overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 text-xs">
          <div className="px-6 py-4 space-y-1.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">CV File Storage Used</div>
            <div className="text-lg font-bold font-mono text-slate-900 tabular-nums">
              {storage
                ? storage.measuredFileCount > 0 || storage.provider === 'local'
                  ? formatBytes(storage.measuredBytes)
                  : `${storage.totalFiles} Objects`
                : '—'}
              {storageLimitBytes && (
                <span className="text-xs font-semibold text-slate-400">
                  {' '}
                  / {formatBytes(storageLimitBytes)}
                </span>
              )}
            </div>
            {storageUsedPct !== null ? (
              <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className={`h-full rounded-full ${storageUsedPct >= 90 ? 'bg-amber-500' : 'bg-brand-600'
                    }`}
                  style={{ width: `${storageUsedPct}%` }}
                />
              </div>
            ) : (
              <div className="text-[11px] text-slate-500">
                Uploaded candidate CV &amp; resume documents
              </div>
            )}
          </div>

          <div className="px-6 py-4 space-y-1.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Stored CV Documents</div>
            <div className="text-lg font-bold font-mono text-slate-900 tabular-nums">
              {storage ? storage.totalFiles.toLocaleString() : '0'}
            </div>
            <div className="text-[11px] text-slate-500">
              {storage
                ? `${cvCoveragePct}% of ${storage.totalCandidates} consultants have CVs`
                : 'No CV files indexed'}
            </div>
          </div>

          <div className="px-6 py-4 space-y-1.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total CRM Records</div>
            <div className="text-lg font-bold font-mono text-slate-900 tabular-nums">
              {totalDbRecords.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-500">
              {storage
                ? `${storage.recordCounts.requirements} Reqs · ${storage.recordCounts.submissions} Subs`
                : 'Database entities'}
            </div>
          </div>

          <div className="px-6 py-4 space-y-1.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Accounts &amp; Dispatch Logs</div>
            <div className="text-lg font-bold font-mono text-slate-900 tabular-nums">
              {storage
                ? `${storage.recordCounts.clients} ${storage.recordCounts.clients === 1 ? 'Client' : 'Clients'
                } · ${storage.recordCounts.vendors} ${storage.recordCounts.vendors === 1 ? 'Vendor' : 'Vendors'
                }`
                : '0 Clients · 0 Vendors'}
            </div>
            <div className="text-[11px] text-slate-500">
              {storage
                ? `${storage.recordCounts.placements} ${storage.recordCounts.placements === 1 ? 'Placement' : 'Placements'
                } · ${storage.recordCounts.emailLogs} ${storage.recordCounts.emailLogs === 1 ? 'Email' : 'Emails'
                }`
                : 'Directory & notifications'}
            </div>
          </div>
        </div>
      </div>

      {/* Storage Breakdown Grid: CRM Record Distribution (left) + By File Format (right) */}
      {storage && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Database Record Footprint */}
          <div className="bg-white rounded-xl border border-slate-200/90 card-shadow overflow-hidden text-xs">
            <div className="px-6 py-3.5 border-b border-slate-100 bg-white flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Database className="w-3.5 h-3.5 text-brand-600" />
                <h2 className="font-semibold text-slate-900">Workspace Record Distribution</h2>
              </div>
              <span className="text-[11px] text-slate-400">
                {totalDbRecords.toLocaleString()} rows
              </span>
            </div>
            <dl className="divide-y divide-slate-100">
              {(
                [
                  ['Consultants Directory', storage.recordCounts.candidates],
                  ['Job Requirements', storage.recordCounts.requirements],
                  ['Candidate Submissions', storage.recordCounts.submissions],
                  ['Billable Placements', storage.recordCounts.placements],
                  ['Client Accounts', storage.recordCounts.clients],
                  ['Staffing Vendors', storage.recordCounts.vendors],
                  ['Outbound Email Logs', storage.recordCounts.emailLogs],
                ] as const
              ).map(([label, count]) => (
                <div key={label} className="px-6 py-2.5 flex items-center justify-between">
                  <dt className="text-slate-600 font-medium">{label}</dt>
                  <dd className="font-mono font-bold text-slate-900 tabular-nums">
                    {count.toLocaleString()}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Format Breakdown */}
          <div className="bg-white rounded-xl border border-slate-200/90 card-shadow overflow-hidden text-xs">
            <div className="px-6 py-3.5 border-b border-slate-100 bg-white flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-brand-600" />
                <h2 className="font-semibold text-slate-900">Storage by File Format</h2>
              </div>
              <span className="text-[11px] text-slate-400">
                {storage.byFormat.length} {storage.byFormat.length === 1 ? 'format' : 'formats'}
              </span>
            </div>

            {storage.byFormat.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                No uploaded CV files stored yet.
              </div>
            ) : (
              <div className="p-6 space-y-3.5">
                {storage.byFormat.map((bucket) => {
                  const pct =
                    storage.measuredBytes > 0
                      ? Math.max(4, Math.round((bucket.bytes / storage.measuredBytes) * 100))
                      : storage.totalFiles > 0
                        ? Math.round((bucket.count / storage.totalFiles) * 100)
                        : 0;
                  return (
                    <div key={bucket.format} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-white border border-slate-300 text-slate-700">
                            {bucket.format}
                          </span>
                          <span className="text-slate-600 font-medium">
                            {bucket.count} {bucket.count === 1 ? 'file' : 'files'}
                          </span>
                        </div>
                        <span className="font-mono font-semibold text-slate-900 tabular-nums">
                          {bucket.bytes > 0 ? formatBytes(bucket.bytes) : `${pct}%`}
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-brand-600"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stored CV Files List */}
      {storage && storage.recentFiles.length > 0 && (
        <div className={`${STAFFING_GRID_FRAME_CLASS} text-xs`}>
          <div className="px-5 py-3 border-b border-slate-200/80 bg-white flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">
              Stored CV Files ({storage.totalFiles})
            </h2>
            <span className="text-[11px] text-slate-400">Most recently updated candidate CVs</span>
          </div>
          <div className="overflow-x-auto">
            <table className={STAFFING_GRID_TABLE_CLASS}>
              <thead className={STAFFING_GRID_THEAD_CLASS}>
                <tr>
                  <GridColumnHeader
                    icon={<User className="w-3 h-3" />}
                    label="Consultant"
                    className={`${STAFFING_GRID_TH_CLASS} ${STAFFING_GRID_STICKY_TH_CLASS}`}
                  />
                  <GridColumnHeader
                    icon={<FileText className="w-3 h-3" />}
                    label="Document File"
                  />
                  <GridColumnHeader
                    icon={<FileType className="w-3 h-3" />}
                    label="Format"
                  />
                  <GridColumnHeader
                    icon={<Calendar className="w-3 h-3" />}
                    label="Updated"
                  />
                  <GridColumnHeader
                    icon={<HardDrive className="w-3 h-3" />}
                    label="Size"
                    align="right"
                  />
                </tr>
              </thead>
              <tbody className="text-slate-700">
                {filesPg.pagedItems.map((file) => (
                  <tr key={file.candidateId} className={STAFFING_GRID_ROW_STATIC_CLASS}>
                    <td className={`${STAFFING_GRID_CELL_CLASS} ${STAFFING_GRID_STICKY_TD_CLASS} font-semibold text-slate-900 whitespace-nowrap`}>
                      {file.fullName}
                    </td>
                    <td className={`${STAFFING_GRID_CELL_CLASS} text-slate-600 max-w-xs truncate`}>{file.fileName}</td>
                    <td className={`${STAFFING_GRID_CELL_CLASS} whitespace-nowrap`}>
                      <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-white border border-slate-300 text-slate-700">
                        {file.format}
                      </span>
                    </td>
                    <td className={`${STAFFING_GRID_CELL_CLASS} text-slate-500 whitespace-nowrap`}>
                      {file.updatedAt ? new Date(file.updatedAt).toLocaleDateString() : '—'}
                    </td>
                    <td className={`${STAFFING_GRID_CELL_CLASS} text-right font-mono font-semibold text-slate-800 whitespace-nowrap tabular-nums`}>
                      {formatBytes(file.bytes)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TablePagination
            page={filesPg.page}
            limit={filesPg.limit}
            total={filesPg.total}
            onPageChange={filesPg.setPage}
            onLimitChange={filesPg.setLimit}
            itemLabel="files"
            pageSizeOptions={[10, 20, 50]}
          />
        </div>
      )}

      {/* AI Usage Details — ONLY rendered when AI is active */}
      {isAiActive && aiUsage && (
        <form
          onSubmit={handleSaveAiLimits}
          className="bg-white rounded-xl border border-slate-200/90 card-shadow overflow-hidden text-xs"
        >
          <div className="px-6 py-3.5 border-b border-slate-100 bg-white flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <AiMark size="sm" />
              <div>
                <h2 className="text-sm font-semibold text-slate-900">SquadAI Usage &amp; Metering</h2>
                <p className="text-[11px] text-slate-500">
                  Monthly metered AI requests, token breakdown, active models, and workspace budget caps.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {aiUsage.planTier && aiUsage.planTier !== 'default' && (
                <StatusBadge
                  label={`Plan: ${aiUsage.planTier}`}
                  tone="slate"
                  size="xs"
                  className="capitalize"
                />
              )}
              <StatusBadge
                label={
                  aiUsage.quotaExceeded
                    ? 'Monthly Limit Reached'
                    : aiUsage.usingByoKey
                      ? 'Active · BYO Key'
                      : 'Active'
                }
                tone={aiUsage.quotaExceeded ? 'amber' : 'emerald'}
                size="xs"
              />
            </div>
          </div>

          <div className="p-6 space-y-5">
            {aiUsage.quotaReason && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-medium">
                {aiUsage.quotaReason}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-5 rounded-xl bg-slate-50/60 border border-slate-200/90 space-y-1.5">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Monthly Actions Used</div>
                <div className="text-lg font-bold font-mono text-slate-900 tabular-nums">
                  {aiUsage.actionsUsed.toLocaleString()}
                  {aiUsage.actionLimit > 0 && (
                    <span className="text-xs font-semibold text-slate-400">
                      {' '}
                      / {aiUsage.actionLimit.toLocaleString()}
                    </span>
                  )}
                </div>
                {aiUsage.actionLimit > 0 ? (
                  <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${aiUsage.quotaExceeded ? 'bg-amber-500' : 'bg-brand-600'
                        }`}
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round((aiUsage.actionsUsed / aiUsage.actionLimit) * 100)
                        )}%`,
                      }}
                    />
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-400">No monthly action cap set</div>
                )}
              </div>

              <div className="p-5 rounded-xl bg-slate-50/60 border border-slate-200/90 space-y-1.5">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Monthly Tokens Used</div>
                <div className="text-lg font-bold font-mono text-slate-900 tabular-nums">
                  {aiUsage.tokensUsed.toLocaleString()}
                  {aiUsage.tokenLimit > 0 && (
                    <span className="text-xs font-semibold text-slate-400">
                      {' '}
                      / {aiUsage.tokenLimit.toLocaleString()}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 tabular-nums">
                  {aiUsage.inputTokens.toLocaleString()} input &bull;{' '}
                  {aiUsage.outputTokens.toLocaleString()} output
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Activity Breakdown
                </div>
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {Object.entries(aiUsage.byFeature).map(([feature, stats]) => (
                    <span
                      key={feature}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium border ${stats.actions > 0
                        ? 'bg-white border-slate-200 text-slate-800 font-semibold'
                        : 'bg-slate-100/70 border-slate-200/60 text-slate-400'
                        }`}
                    >
                      {AI_FEATURE_LABELS[feature] || feature}: {stats.actions}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {aiUsage.byModel && aiUsage.byModel.length > 0 && (
              <div className="rounded-xl border border-slate-200/90 overflow-hidden">
                <div className="px-4 py-2.5 bg-white border-b border-slate-200/80 flex items-center gap-2 text-[11px] font-semibold text-slate-600">
                  <AiIcon className="w-3.5 h-3.5 text-brand-600" />
                  <span>Model Usage Breakdown</span>
                </div>
                <div className="overflow-x-auto">
                  <table className={STAFFING_GRID_TABLE_CLASS}>
                    <thead className={STAFFING_GRID_THEAD_CLASS}>
                      <tr>
                        {aiUsage.usingByoKey && (
                          <GridColumnHeader
                            icon={<Layers className="w-3 h-3" />}
                            label="Provider"
                            className={`${STAFFING_GRID_TH_CLASS} ${STAFFING_GRID_STICKY_TH_CLASS}`}
                          />
                        )}
                        <GridColumnHeader
                          icon={<Cpu className="w-3 h-3" />}
                          label="Model"
                          className={
                            aiUsage.usingByoKey
                              ? STAFFING_GRID_TH_CLASS
                              : `${STAFFING_GRID_TH_CLASS} ${STAFFING_GRID_STICKY_TH_CLASS}`
                          }
                        />
                        <GridColumnHeader
                          icon={<Hash className="w-3 h-3" />}
                          label="Requests"
                          align="right"
                        />
                        <GridColumnHeader
                          icon={<Database className="w-3 h-3" />}
                          label="Tokens (In / Out)"
                          align="right"
                        />
                        <GridColumnHeader
                          icon={<Clock className="w-3 h-3" />}
                          label="Avg Latency"
                          align="right"
                        />
                      </tr>
                    </thead>
                    <tbody className="text-slate-700">
                      {aiUsage.byModel.map((m) => (
                        <tr key={`${m.provider}_${m.model}`} className={STAFFING_GRID_ROW_STATIC_CLASS}>
                          {aiUsage.usingByoKey && (
                            <td className={`${STAFFING_GRID_CELL_CLASS} ${STAFFING_GRID_STICKY_TD_CLASS} font-semibold text-slate-700 uppercase whitespace-nowrap`}>
                              {m.provider}
                            </td>
                          )}
                          <td
                            className={`${STAFFING_GRID_CELL_CLASS} ${
                              aiUsage.usingByoKey ? '' : STAFFING_GRID_STICKY_TD_CLASS
                            } font-mono text-[11px] text-slate-900 whitespace-nowrap`}
                          >
                            {formatModelLabel(m.model, aiUsage.usingByoKey)}
                          </td>
                          <td className={`${STAFFING_GRID_CELL_CLASS} text-right font-semibold text-slate-800 tabular-nums whitespace-nowrap`}>
                            {m.actions.toLocaleString()}
                          </td>
                          <td className={`${STAFFING_GRID_CELL_CLASS} text-right text-slate-600 tabular-nums font-mono text-[11px] whitespace-nowrap`}>
                            {m.inputTokens.toLocaleString()} / {m.outputTokens.toLocaleString()}
                          </td>
                          <td className={`${STAFFING_GRID_CELL_CLASS} text-right text-slate-500 tabular-nums whitespace-nowrap`}>
                            {m.avgLatencyMs > 0 ? `${m.avgLatencyMs} ms` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1 border-t border-slate-100">
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">
                  Monthly Action Cap (Optional)
                </label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={actionLimitInput}
                  onChange={(e) => setActionLimitInput(e.target.value)}
                  placeholder={
                    !aiUsage.usingByoKey && (aiUsage.planActionLimit || 0) > 0
                      ? `Plan ceiling: ${aiUsage.planActionLimit?.toLocaleString()} actions/mo`
                      : 'Leave empty for plan / unlimited default'
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:border-brand-500 focus:outline-none"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  {aiUsage.usingByoKey
                    ? 'Applies to your BYO API key.'
                    : (aiUsage.planActionLimit || 0) > 0
                      ? `Plan allowance: ${aiUsage.planActionLimit?.toLocaleString()} actions/mo.`
                      : 'Optional budget guard before falling back to offline workflows.'}
                </p>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">
                  Monthly Token Cap (Optional)
                </label>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={tokenLimitInput}
                  onChange={(e) => setTokenLimitInput(e.target.value)}
                  placeholder={
                    !aiUsage.usingByoKey && (aiUsage.planTokenLimit || 0) > 0
                      ? `Plan ceiling: ${aiUsage.planTokenLimit?.toLocaleString()} tokens/mo`
                      : 'Leave empty for plan / unlimited default'
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:border-brand-500 focus:outline-none"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  {aiUsage.usingByoKey
                    ? 'Applies to your BYO API key.'
                    : (aiUsage.planTokenLimit || 0) > 0
                      ? `Plan allowance: ${aiUsage.planTokenLimit?.toLocaleString()} tokens/mo.`
                      : 'Optional monthly token budget ceiling.'}
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <ActionButton
                type="submit"
                loading={savingLimits}
                loadingText="Saving..."
                icon={<Save className="w-3.5 h-3.5" />}
                className="h-8 px-4 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg text-[11px] transition-colors cursor-pointer"
              >
                Save Quota Caps
              </ActionButton>
            </div>
          </div>
        </form>
      )}
    </section>
  );
};
