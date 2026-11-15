import React, { useState } from 'react';
import { Bell, CheckCheck, CheckCircle2, Circle, RefreshCw, X, Zap } from 'lucide-react';
import { SlaTask } from '../../types';
import { StatusBadge } from '../shared/StatusBadge';
import { getSlaDotClass } from '../../utils/stageStyles';

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
  { id: 'AWAITING_FEEDBACK', label: 'Awaiting Feedback', categoryKey: 'AWAITING_FEEDBACK' },
  { id: 'INTERVIEW_TODAY', label: 'Interview Today', categoryKey: 'INTERVIEW_TODAY' },
  { id: 'STALE_REQUIREMENT', label: 'Stale Requirement', categoryKey: 'STALE_REQUIREMENT' },
  { id: 'CONTRACT_EXPIRING', label: 'Contract Expiring', categoryKey: 'CONTRACT_EXPIRING' },
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
  const [activeTab, setActiveTab] = useState<string>('All');
  const [isEvaluating, setIsEvaluating] = useState(false);

  if (!isOpen) return null;

  const filteredTasks = tasks.filter((t) => {
    const normalizedCat = String(t.category || '').toUpperCase();
    if (activeTab === 'All') return !t.done;
    if (activeTab === 'Completed') return t.done;
    return !t.done && normalizedCat === activeTab;
  });

  const pendingCount = tasks.filter((t) => !t.done).length;

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
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white border-l border-slate-200 card-shadow flex flex-col">
          {/* Header */}
          <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-amber-600">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Priority Action Center (SLA)</h3>
                <p className="text-[11px] text-slate-400">
                  {pendingCount} actionable items requiring attention today
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {onEvaluateSla && (
                <button
                  onClick={handleRefresh}
                  disabled={isEvaluating}
                  title="Run SLA scan now"
                  className="p-1.5 text-slate-500 hover:text-brand-600 rounded-lg hover:bg-slate-100 disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`w-4 h-4 ${isEvaluating ? 'animate-spin' : ''}`} />
                </button>
              )}
              <button
                onClick={onClose}
                aria-label="Close drawer"
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="px-5 py-3 border-b border-slate-100 flex gap-1.5 overflow-x-auto no-scrollbar bg-white">
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
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all flex items-center gap-1 cursor-pointer ${
                    activeTab === tab.id
                      ? 'bg-slate-800 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>{tab.label}</span>
                  {count > 0 && (
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded-full ${
                        activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
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
                <p className="mt-1">No pending SLA tasks in this category.</p>
              </div>
            ) : (
              filteredTasks.map((item) => (
                <div
                  key={item.id}
                  className={`p-4 rounded-xl border transition-all ${
                    item.done
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
                      className={`transition-colors cursor-pointer ${
                        item.done ? 'text-emerald-500' : 'text-slate-300 hover:text-slate-500'
                      }`}
                    >
                      {item.done ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                    </button>
                  </div>

                  <h4
                    className={`text-xs font-bold mt-2 text-slate-800 leading-snug ${
                      item.done ? 'line-through text-slate-400' : ''
                    }`}
                  >
                    {item.title}
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{item.desc}</p>
                  <div className="text-[10px] text-slate-400 mt-2">{item.meta}</div>

                  {!item.done && (
                    <div className="mt-3 pt-3 border-t border-slate-100 flex justify-end">
                      <button
                        onClick={() => onTaskAction(item)}
                        className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Zap className="w-3 h-3 text-brand-600" />
                        <span>{item.actionLabel}</span>
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-100 bg-slate-50/80 text-[11px] text-slate-500 flex justify-between items-center">
            <span>Deterministic SLA Scanner Active</span>
            <span className="text-[10px] bg-slate-200 px-2 py-0.5 rounded text-slate-700">
              Auto-Evaluating
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

