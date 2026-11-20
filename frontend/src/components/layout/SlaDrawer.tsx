import React, { useState } from 'react';
import {
  Bell,
  Check,
  CheckCheck,
  CheckCircle2,
  Circle,
  Copy,
  ExternalLink,
  RefreshCw,
  UserCheck,
  X,
  Zap,
} from 'lucide-react';
import { AiBadge, AiIcon } from '../shared/AiBrand';
import { SlaTask } from '../../types';
import { StatusBadge } from '../shared/StatusBadge';
import { getSlaDotClass } from '../../utils/stageStyles';
import { useAiCapabilities } from '../../utils/workspaceBrand';
import { AnimatedDrawer } from '../shared/MotionPrimitives';

interface SlaDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: SlaTask[];
  onTaskAction: (task: SlaTask) => void;
  onToggleTaskDone: (taskId: string) => void;
  onEvaluateSla?: () => Promise<void> | void;
}

const SLA_TABS: Array<{ id: string; label: string; categoryKey?: string }> = [
  { id: 'All', label: 'All' },
  { id: 'AWAITING_FEEDBACK', label: 'Waiting on Client', categoryKey: 'AWAITING_FEEDBACK' },
  { id: 'INTERVIEW_TODAY', label: 'Interview Prep', categoryKey: 'INTERVIEW_TODAY' },
  { id: 'STALE_REQUIREMENT', label: 'Needs Applicants', categoryKey: 'STALE_REQUIREMENT' },
  { id: 'CONTRACT_EXPIRING', label: 'Ending Soon', categoryKey: 'CONTRACT_EXPIRING' },
  { id: 'COMPLIANCE_ALERT', label: 'Compliance', categoryKey: 'COMPLIANCE_ALERT' },
  { id: 'Completed', label: 'Completed' },
];

export const SlaDrawer: React.FC<SlaDrawerProps> = ({
  isOpen,
  onClose,
  tasks,
  onTaskAction,
  onToggleTaskDone,
  onEvaluateSla,
}) => {
  const aiCapabilities = useAiCapabilities();
  const [activeTab, setActiveTab] = useState<string>('All');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [copiedTaskId, setCopiedTaskId] = useState<string | null>(null);
  const [expandedDraftIds, setExpandedDraftIds] = useState<Record<string, boolean>>({});

  const filteredTasks = tasks.filter((t) => {
    const normalizedCat = String(t.category || '').toUpperCase();
    if (activeTab === 'All') return !t.done;
    if (activeTab === 'Completed') return t.done;
    return !t.done && normalizedCat === activeTab;
  });

  const pendingCount = tasks.filter((t) => !t.done).length;

  const handleCopyDraftMessage = async (task: SlaTask) => {
    const payload = task.agentPayload;
    if (!payload?.draftBody) return;
    const text = payload.draftSubject
      ? `Subject: ${payload.draftSubject}\n\n${payload.draftBody}`
      : payload.draftBody;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedTaskId(task.id);
      setTimeout(() => setCopiedTaskId(null), 2000);
    } catch {
      // Clipboard blocked in restricted iframe/browser context
    }
  };

  const handleRefresh = async () => {
    if (!onEvaluateSla || isEvaluating) return;
    setIsEvaluating(true);
    try {
      await onEvaluateSla();
    } finally {
      setIsEvaluating(false);
    }
  };

  return (
    <AnimatedDrawer
      isOpen={isOpen}
      onBackdropClick={onClose}
      zIndexClass="z-50"
      backdropClassName="bg-slate-900/40 backdrop-blur-sm flex justify-end pl-10"
      panelClassName="w-screen max-w-md bg-white h-full border-l border-slate-200 card-shadow flex flex-col overflow-hidden"
      ariaLabel="Action Center"
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-center text-slate-600">
            <Bell className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 text-sm">Action Center</h3>
            <p className="text-[11px] text-slate-500">
              {pendingCount} {pendingCount === 1 ? 'reminder' : 'reminders'} needing your attention
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {onEvaluateSla && (
            <button
              onClick={handleRefresh}
              disabled={isEvaluating}
              title="Check reminders now"
              className="w-7 h-7 inline-flex items-center justify-center text-slate-500 hover:text-brand-600 rounded-lg hover:bg-slate-100 disabled:opacity-50 cursor-pointer transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isEvaluating ? 'animate-spin' : ''}`} />
            </button>
          )}
          <button
            onClick={onClose}
            aria-label="Close drawer"
            className="w-7 h-7 inline-flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter Pills */}
      <div className="px-6 py-3 border-b border-slate-100 flex gap-1.5 overflow-x-auto no-scrollbar bg-white">
        {SLA_TABS.map((tab) => {
          const count =
            tab.id === 'All'
              ? pendingCount
              : tab.id === 'Completed'
                ? tasks.filter((t) => t.done).length
                : tasks.filter((t) => !t.done && String(t.category || '').toUpperCase() === tab.id).length;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer border ${activeTab === tab.id
                  ? 'bg-white text-slate-900 border-slate-300'
                  : 'bg-slate-50/90 text-slate-600 border-transparent hover:text-slate-900 hover:bg-slate-100/80'
                }`}
            >
              <span>{tab.label}</span>
              {count > 0 && (
                <span
                  className={`text-[11px] tabular-nums ${activeTab === tab.id ? 'text-brand-600 font-bold' : 'text-slate-400 font-medium'
                    }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto p-5 space-y-3">
        {filteredTasks.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs">
            <CheckCheck className="w-7 h-7 mx-auto mb-2 text-emerald-400" />
            <p className="font-semibold text-slate-600">All clear!</p>
            <p className="mt-1">No pending reminders in this category.</p>
          </div>
        ) : (
          filteredTasks.map((item) => (
            <div
              key={item.id}
              className={`p-4 rounded-xl border transition-all ${item.done
                  ? 'bg-slate-50/60 border-slate-200 opacity-60'
                  : 'bg-white border-slate-200 card-shadow hover:border-slate-300'
                }`}
            >
              <div className="flex items-start justify-between gap-3">
                <StatusBadge
                  label={item.slaRuleTag}
                  dotClass={getSlaDotClass(item.badgeClass)}
                  size="xs"
                />
                <button
                  onClick={() => onToggleTaskDone(item.id)}
                  title={item.done ? 'Mark as pending' : 'Mark as completed'}
                  className={`transition-colors cursor-pointer ${item.done ? 'text-emerald-500' : 'text-slate-300 hover:text-slate-500'
                    }`}
                >
                  {item.done ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                </button>
              </div>

              <h4
                className={`text-xs font-bold mt-2 text-slate-800 leading-snug ${item.done ? 'line-through text-slate-400' : ''
                  }`}
              >
                {item.title}
              </h4>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{item.desc}</p>
              <div className="text-[11px] text-slate-400 mt-2">{item.meta}</div>

              {!item.done &&
                item.agentPayload?.kind === 'candidate_shortlist' &&
                Array.isArray(item.agentPayload.suggestions) &&
                item.agentPayload.suggestions.length > 0 && (
                  <div className="mt-3 p-3 rounded-xl bg-teal-50/40 border border-teal-200/70 space-y-2">
                    <div className="flex items-center justify-between gap-2 text-[11px] font-bold text-teal-900">
                      <span className="inline-flex items-center gap-1.5">
                        {aiCapabilities.enabled && item.agentPayload.evaluatedWithAi ? (
                          <AiIcon className="w-3 h-3 text-teal-600" />
                        ) : (
                          <UserCheck className="w-3 h-3 text-teal-600" />
                        )}
                        <span>Top Bench Matches ({item.agentPayload.suggestions.length})</span>
                      </span>
                      <span className="text-[11px] font-semibold text-teal-700">
                        Human Review
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {item.agentPayload.suggestions.map((sug) => (
                        <div
                          key={sug.candidateId}
                          className="p-2 rounded-lg bg-white border border-teal-100 text-[11px] space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-800 truncate">
                              {sug.fullName}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-white border border-emerald-300 text-emerald-700 text-[11px] font-bold tabular-nums flex-shrink-0">
                              {sug.fitScore}% Fit
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {sug.currentTitle}
                            {sug.workAuth ? ` • ${sug.workAuth}` : ''}
                          </div>
                          {sug.oneLineSummary && (
                            <div className="text-[11px] text-slate-600 leading-snug">
                              {sug.oneLineSummary}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {!item.done &&
                (item.agentPayload?.kind === 'followup_draft' ||
                  item.agentPayload?.kind === 'renewal_draft') &&
                item.agentPayload.draftBody && (
                  <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 text-[11px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 font-bold text-slate-700 text-[11px]">
                        {aiCapabilities.enabled && item.agentPayload.evaluatedWithAi && (
                          <AiBadge label="PipeAI Draft" size="xs" />
                        )}
                        {(!aiCapabilities.enabled || !item.agentPayload.evaluatedWithAi) && (
                          <span>Pre-Drafted Follow-Up</span>
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedDraftIds((prev) => ({
                            ...prev,
                            [item.id]: !prev[item.id],
                          }))
                        }
                        className="text-[11px] font-semibold text-brand-600 hover:underline cursor-pointer"
                      >
                        {expandedDraftIds[item.id] ? 'Collapse' : 'Preview'}
                      </button>
                    </div>
                    {item.agentPayload.draftSubject && (
                      <div className="text-[11px] font-semibold text-slate-800 truncate">
                        {item.agentPayload.draftSubject}
                      </div>
                    )}
                    <div
                      className={`text-[11px] text-slate-600 whitespace-pre-line leading-relaxed ${expandedDraftIds[item.id] ? '' : 'line-clamp-3'
                        }`}
                    >
                      {item.agentPayload.draftBody}
                    </div>
                  </div>
                )}

              {!item.done && (
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-end gap-2 flex-wrap">
                  {(item.agentPayload?.kind === 'followup_draft' ||
                    item.agentPayload?.kind === 'renewal_draft') &&
                    item.agentPayload.draftBody && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleCopyDraftMessage(item)}
                          className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          {copiedTaskId === item.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span className="text-emerald-700">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy Message</span>
                            </>
                          )}
                        </button>
                        <a
                          href={`mailto:${encodeURIComponent(
                            item.agentPayload.recipientEmail || ''
                          )}?subject=${encodeURIComponent(
                            item.agentPayload.draftSubject || ''
                          )}&body=${encodeURIComponent(item.agentPayload.draftBody)}`}
                          title="Open draft in email app"
                          className="p-1.5 rounded-lg text-slate-600 hover:text-brand-600 border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </>
                    )}

                  <button
                    onClick={() => onTaskAction(item)}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Zap className="w-3 h-3 text-brand-600" />
                    <span>
                      {item.agentPayload?.kind === 'candidate_shortlist'
                        ? 'Review & Attach'
                        : item.actionLabel}
                    </span>
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-3.5 border-t border-slate-100 bg-white text-[11px] text-slate-500 flex justify-between items-center">
        <span>Automatic Reminders Active</span>
        <span className="text-[11px] bg-white border border-slate-200/90 px-2 py-0.5 rounded-full font-medium text-slate-600">
          Auto-Checking
        </span>
      </div>
    </AnimatedDrawer>
  );
};

