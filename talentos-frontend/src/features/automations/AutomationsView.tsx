import React, { useState } from 'react';
import { AutomationRule, AutomationAuditLog } from '../../types';

interface AutomationsViewProps {
  rules: AutomationRule[];
  auditLogs: AutomationAuditLog[];
  onTestTrigger: (rule: AutomationRule) => void;
  onToggleRule: (ruleId: string) => void;
}

export const AutomationsView: React.FC<AutomationsViewProps> = ({
  rules,
  auditLogs,
  onTestTrigger,
  onToggleRule,
}) => {
  const [categoryFilter, setCategoryFilter] = useState('All');

  const filteredRules = rules.filter(
    (r) => categoryFilter === 'All' || r.category === categoryFilter
  );

  return (
    <div className="space-y-6">
      {/* Category Pills Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 card-shadow">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {['All', 'Feedback', 'Interview', 'Contract', 'Compliance'].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                categoryFilter === cat
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="text-xs text-slate-400 font-mono">
          <span>Active Rules: </span>
          <strong className="text-emerald-600">{rules.filter((r) => r.active).length} / {rules.length}</strong>
        </div>
      </div>

      {/* Rules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredRules.map((rule) => (
          <div
            key={rule.id}
            className={`p-5 rounded-xl border card-shadow transition-all bg-white flex flex-col justify-between ${
              rule.active ? 'border-slate-200 hover:border-slate-300' : 'border-slate-200 opacity-60'
            }`}
          >
            <div>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
                    <i className={`${rule.icon} text-sm`}></i>
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-900 leading-tight">{rule.name}</h4>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold font-mono">
                      Category: {rule.category}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onToggleRule(rule.id)}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      rule.active ? 'bg-brand-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                        rule.active ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Trigger & Condition Sentence */}
              <div className="mt-4 p-3 bg-slate-50/80 rounded-xl border border-slate-100 text-xs text-slate-700 leading-relaxed">
                <span>WHEN </span>
                <span className="font-semibold text-slate-900">{rule.whenText}</span>
                <span className="ml-1 px-2 py-0.5 rounded bg-white border border-slate-200 font-mono font-bold text-slate-800 text-[11px]">
                  {rule.threshold}
                </span>
              </div>

              {/* Action summary */}
              <div className="mt-3 text-xs text-slate-600">
                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Dispatched Actions</span>
                <p className="text-slate-800 font-medium">{rule.thenSummary}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {rule.actionPills.map((pill, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1"
                    >
                      <i className={`${pill.icon} text-[9px]`}></i>
                      <span>{pill.label}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Rule Footer */}
            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-[10px] text-slate-400 font-mono">
                Fired: {rule.executionsToday} times today
              </span>
              <button
                onClick={() => onTestTrigger(rule)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200 flex items-center gap-1.5 transition-colors"
              >
                <i className="fa-solid fa-play text-[10px]"></i>
                <span>Test Trigger</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Real-Time Automation Audit Log Ledger */}
      <div className="bg-white rounded-xl border border-slate-200 card-shadow overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="font-bold text-xs text-slate-800">Deterministic Automation Audit Ledger</h3>
            <p className="text-[11px] text-slate-400">Verifiable trace of condition checks, dispatched actions, and SLA notifications</p>
          </div>
          <span className="text-[10px] font-bold text-slate-500 font-mono uppercase bg-white px-2 py-1 rounded border border-slate-200">
            Live Stream
          </span>
        </div>

        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-200">
              <th className="py-2.5 px-4">Timestamp</th>
              <th className="py-2.5 px-4">Triggered Rule</th>
              <th className="py-2.5 px-4">Target Entity</th>
              <th className="py-2.5 px-4">Dispatched Action</th>
              <th className="py-2.5 px-4 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {auditLogs.map((log) => (
              <tr key={log.id} className="hover:bg-slate-50/60 font-mono text-[11px]">
                <td className="py-3 px-4 text-slate-400">{log.timestamp}</td>
                <td className="py-3 px-4 font-bold text-slate-800 font-sans">{log.ruleName}</td>
                <td className="py-3 px-4 text-slate-600 font-sans">{log.target}</td>
                <td className="py-3 px-4 text-slate-700 font-sans max-w-sm truncate">{log.actionDispatched}</td>
                <td className="py-3 px-4 text-right">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 font-sans">
                    {log.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
