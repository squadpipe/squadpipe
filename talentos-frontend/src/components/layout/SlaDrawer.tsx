import React, { useState } from 'react';
import { SlaTask } from '../../types';

interface SlaDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: SlaTask[];
  onTaskAction: (task: SlaTask) => void;
  onToggleTaskDone: (taskId: string) => void;
}

export const SlaDrawer: React.FC<SlaDrawerProps> = ({
  isOpen,
  onClose,
  tasks,
  onTaskAction,
  onToggleTaskDone,
}) => {
  const [activeTab, setActiveTab] = useState<string>('All');

  if (!isOpen) return null;

  const filteredTasks = tasks.filter((t) => {
    if (activeTab === 'All') return true;
    if (activeTab === 'Completed') return t.done;
    return t.category === activeTab;
  });

  const pendingCount = tasks.filter((t) => !t.done).length;

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
              <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                <i className="fa-solid fa-bell text-sm"></i>
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Priority Action Center (SLA)</h3>
                <p className="text-[11px] text-slate-400">
                  {pendingCount} actionable items requiring attention today
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
            >
              <i className="fa-solid fa-xmark text-sm"></i>
            </button>
          </div>

          {/* Filter Pills */}
          <div className="px-5 py-3 border-b border-slate-100 flex gap-1.5 overflow-x-auto no-scrollbar bg-white">
            {['All', 'Awaiting Feedback', 'Interview Today', 'Stale Requirement', 'Contract Expiring'].map(
              (tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all ${
                    activeTab === tab
                      ? 'bg-slate-800 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab}
                </button>
              )
            )}
          </div>

          {/* Task List */}
          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            {filteredTasks.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                <i className="fa-solid fa-check-double text-2xl mb-2 text-emerald-400"></i>
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
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${item.badgeClass}`}
                    >
                      {item.slaRuleTag}
                    </span>
                    <button
                      onClick={() => onToggleTaskDone(item.id)}
                      title={item.done ? 'Mark as pending' : 'Mark as completed'}
                      className={`text-sm ${
                        item.done ? 'text-emerald-500' : 'text-slate-300 hover:text-slate-500'
                      }`}
                    >
                      <i className={item.done ? 'fa-solid fa-circle-check' : 'fa-regular fa-circle'}></i>
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
                  <div className="text-[10px] text-slate-400 font-mono mt-2">{item.meta}</div>

                  {!item.done && (
                    <div className="mt-3 pt-3 border-t border-slate-100 flex justify-end">
                      <button
                        onClick={() => onTaskAction(item)}
                        className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200 flex items-center gap-1.5 transition-colors"
                      >
                        <i className="fa-solid fa-bolt text-[10px]"></i>
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
            <span className="font-mono text-[10px] bg-slate-200 px-2 py-0.5 rounded text-slate-700">
              Auto-Evaluating
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

