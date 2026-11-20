import React from 'react';

export interface PageHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badges?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Shared bare `#FAFAFA` page header aligning creation, import, and builder pages
 * with core list/dashboard workspaces without heavy boxed hero cards.
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  badges,
  actions,
  className = '',
}) => (
  <div
    className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${className}`}
  >
    <div className="min-w-0">
      <div className="flex items-center gap-2.5 flex-wrap">
        <h1 className="text-lg sm:text-[19px] font-semibold text-slate-900 tracking-tight leading-snug truncate">
          {title}
        </h1>
        {badges}
      </div>
      {subtitle && (
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">{subtitle}</p>
      )}
    </div>
    {actions && (
      <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto text-xs flex-wrap">
        {actions}
      </div>
    )}
  </div>
);
