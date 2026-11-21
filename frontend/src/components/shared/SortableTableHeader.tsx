import React from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { SortDirection, TableSortState } from '../../utils/tableSort';

interface SortableTableHeaderProps<K extends string = string> {
  label: React.ReactNode;
  icon?: React.ReactNode;
  column: K;
  sort: TableSortState<K>;
  onSort: (column: K, defaultDir?: SortDirection) => void;
  defaultDir?: SortDirection;
  align?: 'left' | 'right' | 'center';
  disabled?: boolean;
  uppercase?: boolean;
  className?: string;
}

/**
 * Clickable table header cell with clear ascending/descending/neutral sort indicator.
 */
export function SortableTableHeader<K extends string = string>({
  label,
  icon,
  column,
  sort,
  onSort,
  defaultDir = 'asc',
  align = 'left',
  disabled = false,
  uppercase = false,
  className = '',
}: SortableTableHeaderProps<K>) {
  const isActive = !disabled && sort.sortBy === column;
  const ariaSort = isActive
    ? sort.sortDir === 'asc'
      ? 'ascending'
      : 'descending'
    : 'none';

  const alignClass =
    align === 'right'
      ? 'text-right'
      : align === 'center'
        ? 'text-center'
        : 'text-left';

  const caseClass = uppercase ? 'uppercase tracking-wider' : '';

  if (disabled) {
    return (
      <th scope="col" className={`${alignClass} ${className}`}>
        <span className={`inline-flex items-center gap-1.5 ${caseClass}`}>
          {icon && <span className="text-slate-400 shrink-0 inline-flex items-center">{icon}</span>}
          <span>{label}</span>
        </span>
      </th>
    );
  }

  const nextActionLabel = !isActive
    ? `Sort by ${typeof label === 'string' ? label : column} (${defaultDir === 'asc' ? 'ascending' : 'descending'})`
    : sort.sortDir === defaultDir
      ? `Sort ${defaultDir === 'asc' ? 'descending' : 'ascending'}`
      : 'Clear column sort';

  return (
    <th scope="col" aria-sort={ariaSort} className={`${alignClass} ${className}`}>
      <button
        type="button"
        onClick={() => onSort(column, defaultDir)}
        title={nextActionLabel}
        className={`group inline-flex items-center gap-1.5 ${caseClass} select-none cursor-pointer transition-colors ${
          align === 'right'
            ? 'justify-end ml-auto'
            : align === 'center'
              ? 'justify-center mx-auto'
              : ''
        } ${
          isActive
            ? uppercase
              ? 'text-slate-800'
              : 'text-slate-900'
            : uppercase
              ? 'text-inherit hover:text-slate-700'
              : 'text-inherit hover:text-slate-900'
        }`}
      >
        {icon && <span className="text-slate-400 shrink-0 inline-flex items-center">{icon}</span>}
        <span>{label}</span>
        {isActive ? (
          sort.sortDir === 'asc' ? (
            <ArrowUp className="w-3 h-3 text-brand-600 shrink-0" />
          ) : (
            <ArrowDown className="w-3 h-3 text-brand-600 shrink-0" />
          )
        ) : (
          <ArrowUpDown className="w-3 h-3 text-slate-300 group-hover:text-slate-500 shrink-0 transition-colors" />
        )}
      </button>
    </th>
  );
}
