import React, { useEffect, useState } from 'react';
import {
  Calendar,
  Clock,
  Coins,
  Database,
  FileText,
  FileType,
  HardDrive,
  Hash,
  Loader2,
  PlusCircle,
  RefreshCw,
  Tag,
  User,
  Wallet,
} from 'lucide-react';
import { AiMark } from '../../components/shared/AiBrand';
import { apiClient } from '../../config/api.config';
import { ActionButton } from '../../components/shared/ActionButton';
import { PageHeader } from '../../components/shared/PageHeader';
import { StatusBadge } from '../../components/shared/StatusBadge';
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

interface AiCreditHistoryEntry {
  id: string;
  feature: string;
  creditsUsed: number;
  creditSource?: string;
  userId: string | null;
  userName: string;
  userEmail: string | null;
  latencyMs: number;
  createdAt: string;
}

interface AiCreditPurchaseEntry {
  id: string;
  creditsAdded: number;
  source: string;
  referenceId: string | null;
  notes: string | null;
  createdAt: string;
}

interface SubscriptionPlanOption {
  id: string;
  code: string;
  name: string;
  description: string;
  monthlyAiCredits: number;
  allowByoKey: boolean;
  actionCenterAgentEnabled: boolean;
  isCustom: boolean;
}

interface AiUsageSummaryResponse {
  tenantId: string;
  monthStart: string;
  resetsAt: string;
  aiConfigured: boolean;
  usingByoKey: boolean;
  allowByoKey: boolean;
  planTier: string;
  plan: {
    code: string;
    name: string;
    description: string;
    isCustom: boolean;
    monthlyCredits: number;
  };
  availablePlans: SubscriptionPlanOption[];
  aiDisabledByPlan: boolean;
  creditsUsed: number;
  planCreditsUsed: number;
  purchasedCreditsUsedThisMonth: number;
  creditLimit: number;
  planCreditLimit: number;
  creditsRemaining: number | null;
  planCreditsRemaining: number | null;
  purchasedCreditsRemaining: number;
  purchasedCreditsTotal: number;
  totalCreditsRemaining: number | null;
  quotaExceeded: boolean;
  quotaReason?: string;
  byFeature: Record<string, { credits: number; actions: number }>;
  creditHistory: AiCreditHistoryEntry[];
  purchaseHistory: AiCreditPurchaseEntry[];
}

const CREDIT_SOURCE_META: Record<string, { label: string; badgeClass: string }> = {
  plan: {
    label: 'Plan',
    badgeClass: 'bg-slate-100 border-slate-200 text-slate-700',
  },
  purchased: {
    label: 'Add-on',
    badgeClass: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  },
  unlimited: {
    label: 'Unlimited',
    badgeClass: 'bg-brand-50 border-brand-100 text-brand-700',
  },
  byo: {
    label: 'BYO Key',
    badgeClass: 'bg-indigo-50 border-indigo-200 text-indigo-700',
  },
};

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
        setAiUsage(aiRes.value.data.data);
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

  // Show AI credits details when AI is active (or historical credits exist) and not disabled by plan
  const isAiActive = Boolean(
    aiUsage &&
      !aiUsage.aiDisabledByPlan &&
      (aiUsage.aiConfigured || aiUsage.creditsUsed > 0 || aiUsage.creditLimit > 0)
  );

  const filesPg = useClientPagination(
    storage?.recentFiles || [],
    10,
    `files|${storage?.totalFiles || 0}`
  );
  const historyPg = useClientPagination(
    aiUsage?.creditHistory || [],
    10,
    `ai-history|${aiUsage?.creditHistory?.length || 0}`
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

      {/* SquadAI Plan, Add-on Credits & Usage History */}
      {aiUsage && aiUsage.aiDisabledByPlan && (
        <div className="bg-white rounded-xl border border-slate-200/90 card-shadow overflow-hidden text-xs">
          <div className="px-6 py-3.5 border-b border-slate-100 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <AiMark size="sm" />
              <div>
                <h2 className="text-sm font-semibold text-slate-900">SquadAI Plan &amp; Credits</h2>
                <p className="text-[11px] text-slate-500">
                  Workspace subscription plan and monthly AI credit allowance.
                </p>
              </div>
            </div>
            <StatusBadge
              label={`Plan: ${aiUsage.plan?.name || aiUsage.planTier}`}
              tone="slate"
              size="xs"
            />
          </div>
          <div className="p-5 text-[11px] text-slate-600 bg-slate-50/60">
            SquadAI actions are disabled on your current workspace plan. Upgrade your plan or contact your platform administrator to enable AI credits.
          </div>
        </div>
      )}

      {isAiActive && aiUsage && (
        <div className="bg-white rounded-xl border border-slate-200/90 card-shadow overflow-hidden text-xs">
          <div className="px-6 py-3.5 border-b border-slate-100 bg-white flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <AiMark size="sm" />
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  SquadAI Plan, Credits &amp; Usage History
                </h2>
                <p className="text-[11px] text-slate-500">
                  Subscription plan allowance, non-expiring purchased AI credits, per-feature consumption, and activity history (1 credit per AI action).
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge
                label={`Plan: ${aiUsage.plan?.name || aiUsage.planTier}`}
                tone="slate"
                size="xs"
              />
              {aiUsage.plan?.isCustom && (
                <StatusBadge label="Custom Plan" tone="brand" size="xs" />
              )}
              <StatusBadge
                label={
                  aiUsage.quotaExceeded
                    ? 'Credits Exhausted'
                    : aiUsage.usingByoKey
                      ? 'Active · BYO Key'
                      : aiUsage.planCreditsRemaining === 0 && aiUsage.purchasedCreditsRemaining > 0
                        ? 'Using Add-on Credits'
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

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="p-5 rounded-xl bg-slate-50/60 border border-slate-200/90 space-y-1.5">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Monthly Plan Credits Used
                </div>
                <div className="text-lg font-bold font-mono text-slate-900 tabular-nums">
                  {aiUsage.creditLimit > 0
                    ? aiUsage.planCreditsUsed.toLocaleString()
                    : aiUsage.creditsUsed.toLocaleString()}
                  {aiUsage.creditLimit > 0 && (
                    <span className="text-xs font-semibold text-slate-400">
                      {' '}
                      / {aiUsage.creditLimit.toLocaleString()}
                    </span>
                  )}
                </div>
                {aiUsage.creditLimit > 0 ? (
                  <div className="space-y-1">
                    <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          aiUsage.planCreditsRemaining === 0 && aiUsage.purchasedCreditsRemaining === 0
                            ? 'bg-amber-500'
                            : 'bg-brand-600'
                        }`}
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round((aiUsage.planCreditsUsed / aiUsage.creditLimit) * 100)
                          )}%`,
                        }}
                      />
                    </div>
                    <div className="text-[11px] text-slate-500 tabular-nums">
                      {Math.min(
                        100,
                        Math.round((aiUsage.planCreditsUsed / aiUsage.creditLimit) * 100)
                      )}
                      % of {aiUsage.plan?.name || 'plan'} quota
                      {aiUsage.creditsUsed > aiUsage.planCreditsUsed && (
                        <span> · {aiUsage.creditsUsed.toLocaleString()} total actions/mo</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-500">
                    {aiUsage.usingByoKey
                      ? 'Unlimited on your BYO key'
                      : `Unlimited on ${aiUsage.plan?.name || 'current'} plan`}
                  </div>
                )}
              </div>

              <div className="p-5 rounded-xl bg-slate-50/60 border border-slate-200/90 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <span>Add-on Credits Wallet</span>
                  <Wallet className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <div className="text-lg font-bold font-mono text-slate-900 tabular-nums">
                  {aiUsage.purchasedCreditsRemaining.toLocaleString()}
                </div>
                <div className="text-[11px] text-slate-500 tabular-nums">
                  {aiUsage.purchasedCreditsTotal.toLocaleString()} purchased total &bull; Never resets
                  {aiUsage.purchasedCreditsUsedThisMonth > 0 && (
                    <span> &bull; {aiUsage.purchasedCreditsUsedThisMonth} used this mo</span>
                  )}
                </div>
              </div>

              <div className="p-5 rounded-xl bg-slate-50/60 border border-slate-200/90 space-y-1.5">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Total Credits Remaining
                </div>
                <div className="text-lg font-bold font-mono text-slate-900 tabular-nums">
                  {aiUsage.totalCreditsRemaining !== null
                    ? aiUsage.totalCreditsRemaining.toLocaleString()
                    : 'Unlimited'}
                </div>
                <div className="text-[11px] text-slate-500">
                  {aiUsage.planCreditsRemaining !== null && (
                    <span className="tabular-nums">
                      Plan: {aiUsage.planCreditsRemaining.toLocaleString()} + Add-on:{' '}
                      {aiUsage.purchasedCreditsRemaining.toLocaleString()} &bull;{' '}
                    </span>
                  )}
                  Resets{' '}
                  {new Date(aiUsage.resetsAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    timeZone: 'UTC',
                  })}{' '}
                  (UTC)
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Credits by Feature
                </div>
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {Object.entries(aiUsage.byFeature).map(([feature, stats]) => (
                    <span
                      key={feature}
                      className={`px-2 py-0.5 rounded text-[11px] border ${
                        stats.credits > 0
                          ? 'bg-white border-slate-200 text-slate-800 font-semibold'
                          : 'bg-slate-100/70 border-slate-200/60 text-slate-400 font-medium'
                      }`}
                    >
                      {AI_FEATURE_LABELS[feature] || feature}: {stats.credits}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {aiUsage.availablePlans && aiUsage.availablePlans.length > 0 && (
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/40 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-700">
                    <Tag className="w-3.5 h-3.5 text-brand-600" />
                    <span>Workspace Plans &amp; Custom AI Credit Top-Ups</span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Workspace ID: <code className="font-mono text-slate-700">{aiUsage.tenantId}</code>
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {aiUsage.availablePlans.map((p) => {
                    const isCurrent = p.code === aiUsage.plan?.code;
                    return (
                      <div
                        key={p.code}
                        className={`p-3 rounded-lg border bg-white space-y-1 ${
                          isCurrent
                            ? 'border-brand-300 ring-1 ring-brand-200'
                            : 'border-slate-200/90'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-900">
                            {isCurrent ? aiUsage.plan.name : p.name}
                          </span>
                          {isCurrent && (
                            <span className="px-1.5 py-0.5 rounded bg-brand-50 text-brand-700 text-[10px] font-semibold">
                              Current
                            </span>
                          )}
                        </div>
                        <div className="text-sm font-bold font-mono text-slate-800 tabular-nums">
                          {isCurrent && aiUsage.plan?.isCustom
                            ? aiUsage.creditLimit > 0
                              ? `${aiUsage.creditLimit.toLocaleString()} credits/mo`
                              : 'Unlimited credits'
                            : p.monthlyAiCredits > 0
                              ? `${p.monthlyAiCredits.toLocaleString()} credits/mo`
                              : 'Unlimited credits'}
                        </div>
                        {p.description && (
                          <p className="text-[11px] text-slate-500 leading-snug">{p.description}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-200/70">
                  Monthly plan credits reset on the 1st of each month (UTC). Purchased add-on credit packs activate automatically whenever monthly plan credits reach 0 and stay in your wallet until consumed.
                </div>
              </div>
            )}

            {aiUsage.purchaseHistory && aiUsage.purchaseHistory.length > 0 && (
              <div className={STAFFING_GRID_FRAME_CLASS}>
                <div className="px-4 py-2.5 bg-white border-b border-slate-200/80 flex items-center justify-between gap-2 text-[11px] font-semibold text-slate-600">
                  <div className="flex items-center gap-2">
                    <PlusCircle className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Purchased &amp; Granted Add-on Credits</span>
                  </div>
                  <span className="text-slate-400 font-normal">
                    {aiUsage.purchaseHistory.length} top-up{' '}
                    {aiUsage.purchaseHistory.length === 1 ? 'record' : 'records'}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className={STAFFING_GRID_TABLE_CLASS}>
                    <thead className={STAFFING_GRID_THEAD_CLASS}>
                      <tr>
                        <GridColumnHeader
                          icon={<PlusCircle className="w-3 h-3" />}
                          label="Credits Added"
                          className={`${STAFFING_GRID_TH_CLASS} ${STAFFING_GRID_STICKY_TH_CLASS}`}
                        />
                        <GridColumnHeader icon={<Tag className="w-3 h-3" />} label="Source" />
                        <GridColumnHeader icon={<FileText className="w-3 h-3" />} label="Reference / Notes" />
                        <GridColumnHeader
                          icon={<Calendar className="w-3 h-3" />}
                          label="Added On"
                          align="right"
                        />
                      </tr>
                    </thead>
                    <tbody className="text-slate-700">
                      {aiUsage.purchaseHistory.map((p) => (
                        <tr key={p.id} className={STAFFING_GRID_ROW_STATIC_CLASS}>
                          <td
                            className={`${STAFFING_GRID_CELL_CLASS} ${STAFFING_GRID_STICKY_TD_CLASS} font-mono font-semibold text-emerald-700 tabular-nums whitespace-nowrap`}
                          >
                            +{p.creditsAdded.toLocaleString()} credits
                          </td>
                          <td className={`${STAFFING_GRID_CELL_CLASS} whitespace-nowrap`}>
                            <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 font-medium text-[11px]">
                              {p.source}
                            </span>
                          </td>
                          <td className={`${STAFFING_GRID_CELL_CLASS} text-slate-600`}>
                            {p.notes || p.referenceId || '—'}
                          </td>
                          <td
                            className={`${STAFFING_GRID_CELL_CLASS} text-right text-slate-500 tabular-nums whitespace-nowrap`}
                          >
                            {new Date(p.createdAt).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className={STAFFING_GRID_FRAME_CLASS}>
              <div className="px-4 py-2.5 bg-white border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold text-slate-600">
                <div className="flex items-center gap-2">
                  <Coins className="w-3.5 h-3.5 text-brand-600" />
                  <span>AI Credits Usage History</span>
                </div>
                <span className="text-slate-400 font-normal">
                  Showing {aiUsage.creditHistory.length} recent{' '}
                  {aiUsage.creditHistory.length === 1 ? 'action' : 'actions'} this billing month
                </span>
              </div>
              {historyPg.total === 0 ? (
                <div className="px-4 py-6 text-center text-[11px] text-slate-500">
                  No AI credits have been used yet in the current billing cycle.
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className={STAFFING_GRID_TABLE_CLASS}>
                      <thead className={STAFFING_GRID_THEAD_CLASS}>
                        <tr>
                          <GridColumnHeader
                            icon={<Coins className="w-3 h-3" />}
                            label="Feature"
                            className={`${STAFFING_GRID_TH_CLASS} ${STAFFING_GRID_STICKY_TH_CLASS}`}
                          />
                          <GridColumnHeader
                            icon={<User className="w-3 h-3" />}
                            label="Triggered By"
                          />
                          <GridColumnHeader
                            icon={<Wallet className="w-3 h-3" />}
                            label="Credit Pool"
                          />
                          <GridColumnHeader
                            icon={<Hash className="w-3 h-3" />}
                            label="Credits"
                            align="right"
                          />
                          <GridColumnHeader
                            icon={<Clock className="w-3 h-3" />}
                            label="Response Time"
                            align="right"
                          />
                          <GridColumnHeader
                            icon={<Calendar className="w-3 h-3" />}
                            label="Timestamp"
                            align="right"
                          />
                        </tr>
                      </thead>
                      <tbody className="text-slate-700">
                        {historyPg.pagedItems.map((entry) => {
                          const srcMeta =
                            CREDIT_SOURCE_META[entry.creditSource || 'plan'] ||
                            CREDIT_SOURCE_META.plan;
                          return (
                            <tr key={entry.id} className={STAFFING_GRID_ROW_STATIC_CLASS}>
                              <td
                                className={`${STAFFING_GRID_CELL_CLASS} ${STAFFING_GRID_STICKY_TD_CLASS} whitespace-nowrap`}
                              >
                                <span className="inline-flex items-center px-2 py-0.5 rounded bg-brand-50 border border-brand-100 text-brand-700 font-semibold text-[11px]">
                                  {AI_FEATURE_LABELS[entry.feature] || entry.feature}
                                </span>
                              </td>
                              <td className={`${STAFFING_GRID_CELL_CLASS} whitespace-nowrap`}>
                                <span className="font-medium text-slate-800">{entry.userName}</span>
                                {entry.userEmail && (
                                  <span className="ml-1.5 text-[11px] text-slate-400">
                                    ({entry.userEmail})
                                  </span>
                                )}
                              </td>
                              <td className={`${STAFFING_GRID_CELL_CLASS} whitespace-nowrap`}>
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded border font-semibold text-[11px] ${srcMeta.badgeClass}`}
                                >
                                  {srcMeta.label}
                                </span>
                              </td>
                              <td
                                className={`${STAFFING_GRID_CELL_CLASS} text-right font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap`}
                              >
                                {entry.creditsUsed}{' '}
                                {entry.creditsUsed === 1 ? 'credit' : 'credits'}
                              </td>
                              <td
                                className={`${STAFFING_GRID_CELL_CLASS} text-right text-slate-500 tabular-nums whitespace-nowrap`}
                              >
                                {entry.latencyMs > 0 ? `${entry.latencyMs} ms` : '—'}
                              </td>
                              <td
                                className={`${STAFFING_GRID_CELL_CLASS} text-right text-slate-500 tabular-nums whitespace-nowrap`}
                              >
                                {new Date(entry.createdAt).toLocaleString()}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <TablePagination
                    page={historyPg.page}
                    limit={historyPg.limit}
                    total={historyPg.total}
                    onPageChange={historyPg.setPage}
                    onLimitChange={historyPg.setLimit}
                    itemLabel="credit entries"
                    pageSizeOptions={[10, 25, 50]}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
