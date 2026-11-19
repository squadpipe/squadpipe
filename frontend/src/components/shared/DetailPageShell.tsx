import React, { useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronUp, Pencil } from 'lucide-react';
import { SkillTag } from './SkillTag';

export interface DetailBreadcrumbProps {
  backLabel: string;
  onBack: () => void;
  title: string;
  codePill?: string;
  rightSlot?: React.ReactNode;
}

/**
 * Shared breadcrumb bar matching RequirementDetailPage top chrome.
 */
export const DetailBreadcrumb: React.FC<DetailBreadcrumbProps> = ({
  backLabel,
  onBack,
  title,
  codePill,
  rightSlot,
}) => (
  <div className="flex items-center justify-between gap-3 flex-wrap text-xs mb-2">
    <div className="flex items-center gap-2 min-w-0">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-semibold shadow-2xs transition-colors cursor-pointer shrink-0"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>{backLabel}</span>
      </button>
      <span className="text-slate-300">/</span>
      {codePill && (
        <>
          <span className="text-[11px] font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded shrink-0">
            {codePill}
          </span>
          <span className="text-slate-300">/</span>
        </>
      )}
      <span className="text-[11px] font-semibold text-slate-800 truncate">{title}</span>
    </div>
    {rightSlot && <div className="hidden sm:flex items-center gap-2 shrink-0">{rightSlot}</div>}
  </div>
);

export interface DetailTabItem<T extends string = string> {
  id: T;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
  badgeTone?: 'neutral' | 'emerald' | 'brand';
}

interface DetailUnderlineTabsProps<T extends string> {
  ariaLabel: string;
  tabs: Array<DetailTabItem<T>>;
  activeTab: T;
  onChange: (id: T) => void;
}

/**
 * Shared horizontal underline tab strip anchored to the bottom of detail hero cards.
 */
export function DetailUnderlineTabs<T extends string>({
  ariaLabel,
  tabs,
  activeTab,
  onChange,
}: DetailUnderlineTabsProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="px-6 border-t border-slate-100 bg-white flex items-center gap-7 overflow-x-auto no-scrollbar"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = activeTab === tab.id;
        const tone = tab.badgeTone;
        const badgeClass =
          tone === 'emerald'
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : active || tone === 'brand'
              ? 'bg-brand-50 text-brand-700'
              : 'bg-slate-100 text-slate-600';

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={`py-3 text-xs font-semibold inline-flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
              active
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Icon className={`w-3.5 h-3.5 ${active ? 'text-brand-600' : 'text-slate-400'}`} />
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold leading-none ${badgeClass}`}>
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

interface DetailExpandableSkillsBarProps {
  label?: string;
  skills: string[];
  initialVisibleCount?: number;
  editLabel?: string;
  onEdit?: () => void;
}

/**
 * Expandable skill tags bar with subtle non-red expand/collapse control and top-right edit trigger.
 */
export const DetailExpandableSkillsBar: React.FC<DetailExpandableSkillsBarProps> = ({
  label = 'Skills:',
  skills,
  initialVisibleCount = 10,
  editLabel = 'Edit skills',
  onEdit,
}) => {
  const [expanded, setExpanded] = useState(false);

  if (skills.length === 0 && !onEdit) return null;

  const visible = expanded ? skills : skills.slice(0, initialVisibleCount);
  const hiddenCount = skills.length - initialVisibleCount;

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 card-shadow px-6 py-3.5 flex items-start justify-between gap-4 text-xs">
      <div className="flex items-start gap-2.5 flex-wrap sm:flex-nowrap flex-1 min-w-0">
        <span className="h-6 inline-flex items-center text-[10.5px] font-bold uppercase tracking-wider text-slate-400 shrink-0 whitespace-nowrap">
          {label}
        </span>
        {skills.length === 0 ? (
          <span className="h-6 inline-flex items-center text-[11px] text-slate-400">
            No skills listed yet
          </span>
        ) : (
          <div className="flex items-center flex-wrap gap-1.5 flex-1 min-w-0">
            {visible.map((skill, idx) => (
              <SkillTag key={`${skill}_${idx}`} skill={skill} className="!mr-0 !mb-0" />
            ))}
            {hiddenCount > 0 && (
              <button
                type="button"
                onClick={() => setExpanded((prev) => !prev)}
                className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200/80 text-slate-600 border border-slate-200/80 font-medium whitespace-nowrap cursor-pointer transition-colors"
              >
                {expanded ? (
                  <>
                    <ChevronUp className="w-2.5 h-2.5 shrink-0" />
                    <span>Show less</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-2.5 h-2.5 shrink-0" />
                    <span>+{hiddenCount} more</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>

      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="h-6 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 hover:text-brand-700 hover:underline cursor-pointer shrink-0 whitespace-nowrap"
        >
          <Pencil className="w-3 h-3" />
          <span>{editLabel}</span>
        </button>
      )}
    </div>
  );
};
