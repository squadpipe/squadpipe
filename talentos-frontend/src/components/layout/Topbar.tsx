import React from 'react';

interface TopbarProps {
  viewTitle: string;
  globalSearch: string;
  onSearchChange: (val: string) => void;
  onToggleSla: () => void;
  slaCount: number;
  rateMasked: boolean;
  onToggleRateMask: () => void;
  onOpenQuickAdd: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  viewTitle,
  globalSearch,
  onSearchChange,
  onToggleSla,
  slaCount,
  rateMasked,
  onToggleRateMask,
  onOpenQuickAdd
}) => {
  return (
    <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6 flex-shrink-0 z-20">
      {/* Title */}
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-bold text-slate-800 tracking-tight">{viewTitle}</h1>
      </div>

      {/* Global Search Bar */}
      <div className="flex-1 max-w-md mx-6 relative">
        <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
        <input
          type="text"
          value={globalSearch}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search candidates, reqs, clients, skills..."
          className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white transition-all text-slate-700"
        />
      </div>

      {/* Actions & User Desk */}
      <div className="flex items-center gap-3">
        {/* Quick Add Button */}
        <button
          onClick={onOpenQuickAdd}
          className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm shadow-brand-600/20 transition-all"
        >
          <i className="fa-solid fa-plus text-[10px]"></i>
          <span>Quick Add</span>
        </button>

        {/* Rate Masking Indicator / Toggle */}
        <button
          onClick={onToggleRateMask}
          title={rateMasked ? "Billing rates masked for privacy" : "Billing rates fully visible"}
          className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-all ${
            rateMasked
              ? 'bg-amber-50 text-amber-700 border-amber-200'
              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
          }`}
        >
          <i className={rateMasked ? "fa-solid fa-eye-slash" : "fa-solid fa-eye"}></i>
          <span>{rateMasked ? "Rates Masked" : "Rates Visible"}</span>
        </button>

        {/* SLA Bell Drawer Trigger */}
        <button
          onClick={onToggleSla}
          className="relative p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
          title="Daily SLA Reminders"
        >
          <i className="fa-solid fa-bell text-sm"></i>
          {slaCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center animate-pulse">
              {slaCount}
            </span>
          )}
        </button>

        {/* User Pill */}
        <div className="flex items-center gap-2.5 pl-3 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs">
            JM
          </div>
          <div className="text-left hidden sm:block">
            <div className="text-xs font-bold text-slate-800 leading-tight">Johnathan Miller</div>
            <div className="text-[10px] text-slate-400 font-medium">Administrator</div>
          </div>
        </div>
      </div>
    </header>
  );
};

