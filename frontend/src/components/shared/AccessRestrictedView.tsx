import React from 'react';
import { ArrowLeft, Lock, ShieldAlert } from 'lucide-react';
import { StatusBadge } from './StatusBadge';

export interface AccessRestrictedAction {
  label: string;
  onClick: () => void;
}

interface AccessRestrictedViewProps {
  moduleName: string;
  description: string;
  currentRole: string;
  requiredRoles: readonly string[];
  onBackToDashboard: () => void;
  secondaryAction?: AccessRestrictedAction;
}

/**
 * Displays a clear role-restriction notice when a user accesses a module
 * outside their assigned workspace role, instead of silently redirecting.
 */
export const AccessRestrictedView: React.FC<AccessRestrictedViewProps> = ({
  moduleName,
  description,
  currentRole,
  requiredRoles,
  onBackToDashboard,
  secondaryAction,
}) => {
  return (
    <section className="max-w-2xl mx-auto py-10 animate-fade-in">
      <div className="bg-white rounded-xl border border-slate-200 card-shadow overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/70 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-600 flex items-center justify-center flex-shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                Access Restricted
              </h2>
              <StatusBadge label="Role Permission Required" tone="amber" size="xs" />
            </div>
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              {moduleName}
            </p>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <p className="text-xs text-slate-600 leading-relaxed">{description}</p>

          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Your Current Role
              </span>
              <StatusBadge
                label={currentRole || 'Technical Recruiter'}
                tone="amber"
                size="sm"
              />
            </div>

            <div className="h-px bg-slate-200/80" />

            <div className="flex items-start justify-between gap-3 flex-wrap">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider pt-0.5">
                Required Role
              </span>
              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                {requiredRoles.map((role) => (
                  <StatusBadge key={role} label={role} tone="slate" size="sm" />
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2 text-[11px] text-slate-500 bg-white border border-slate-200/80 rounded-lg px-3.5 py-2.5">
            <ShieldAlert className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
            <span>
              Ask your workspace <strong>Administrator</strong> in User Management if your role needs access to this module.
            </span>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap pt-1">
            <button
              type="button"
              onClick={onBackToDashboard}
              className="px-4 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Dashboard</span>
            </button>
            {secondaryAction && (
              <button
                type="button"
                onClick={secondaryAction.onClick}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors cursor-pointer"
              >
                {secondaryAction.label}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
