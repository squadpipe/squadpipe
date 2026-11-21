import React, { useEffect, useRef, useState } from 'react';
import { AtSign, Check, Phone } from 'lucide-react';

/**
 * Shared visual tokens for Spott-inspired Staffing Grid data tables:
 * soft `#F8FAFC` header surface, hairline vertical + horizontal gridlines,
 * compact uniform padding, and opaque sticky first identity columns.
 */
export const STAFFING_GRID_FRAME_CLASS =
  'bg-white rounded-xl border border-slate-200/90 card-shadow overflow-hidden';

export const STAFFING_GRID_TABLE_CLASS =
  'w-full text-left text-xs border-separate border-spacing-0 ' +
  '[&_thead_th]:bg-slate-50 [&_thead_th]:border-b [&_thead_th]:border-slate-200/90 ' +
  '[&_thead_th:not(:last-child)]:border-r [&_thead_th:not(:last-child)]:border-slate-200/70 ' +
  '[&_tbody_tr:not(:last-child)_td]:border-b [&_tbody_tr:not(:last-child)_td]:border-slate-100 ' +
  '[&_tbody_td:not(:last-child)]:border-r [&_tbody_td:not(:last-child)]:border-slate-100 ' +
  '[&_tfoot_td]:bg-slate-50 [&_tfoot_td]:border-t [&_tfoot_td]:border-slate-200/90 ' +
  '[&_tfoot_td:not(:last-child)]:border-r [&_tfoot_td:not(:last-child)]:border-slate-200/70';

export const STAFFING_GRID_THEAD_CLASS = 'text-[11px] font-semibold text-slate-600';

export const STAFFING_GRID_ROW_CLASS =
  'group bg-white hover:bg-slate-50 transition-colors cursor-pointer';

export const STAFFING_GRID_ROW_STATIC_CLASS =
  'group bg-white hover:bg-slate-50 transition-colors';

export const STAFFING_GRID_STICKY_TH_CLASS =
  'sticky left-0 z-20 bg-slate-50 shadow-[2px_0_6px_-4px_rgba(15,23,42,0.08)]';

export const STAFFING_GRID_STICKY_TD_CLASS =
  'sticky left-0 z-10 bg-white group-hover:bg-slate-50 transition-colors shadow-[2px_0_6px_-4px_rgba(15,23,42,0.06)]';

export const STAFFING_GRID_TH_CLASS = 'px-3.5 py-2.5 whitespace-nowrap';

export const STAFFING_GRID_CELL_CLASS = 'px-3.5 py-2.5';

interface GridColumnHeaderProps {
  icon?: React.ReactNode;
  label: React.ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
}

/**
 * Quiet sentence-case non-sortable column header matching `SortableTableHeader` icons and weight.
 */
export const GridColumnHeader: React.FC<GridColumnHeaderProps> = ({
  icon,
  label,
  align = 'left',
  className = STAFFING_GRID_TH_CLASS,
}) => {
  const alignText =
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  const alignFlex =
    align === 'right'
      ? 'justify-end ml-auto'
      : align === 'center'
        ? 'justify-center mx-auto'
        : '';

  return (
    <th scope="col" className={`${alignText} ${className}`}>
      <span
        className={`inline-flex items-center gap-1.5 font-semibold text-slate-600 whitespace-nowrap ${alignFlex}`}
      >
        {icon && <span className="text-slate-400 shrink-0 inline-flex items-center">{icon}</span>}
        <span>{label}</span>
      </span>
    </th>
  );
};

async function copyTextSafe(value: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // Fallback below when clipboard API is blocked in non-HTTPS contexts.
    }
  }
  if (typeof document === 'undefined') return false;
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  document.body.removeChild(textarea);
  return ok;
}

interface ContactPillChipProps {
  type: 'email' | 'phone';
  value: string;
  maxWidthClass?: string;
}

const ContactPillChip: React.FC<ContactPillChipProps> = ({
  type,
  value,
  maxWidthClass = 'max-w-[175px]',
}) => {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleCopy = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const ok = await copyTextSafe(value);
    if (!ok) return;
    setCopied(true);
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      setCopied(false);
      timerRef.current = null;
    }, 1400);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? 'Copied to clipboard' : `Click to copy ${value}`}
      aria-label={`Copy ${type} ${value}`}
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-tight transition-colors cursor-pointer whitespace-nowrap ${
        copied
          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
          : 'bg-sky-50/75 hover:bg-sky-100/80 border-sky-200/80 text-sky-700'
      }`}
    >
      {copied ? (
        <Check className="w-3 h-3 text-emerald-600 shrink-0" />
      ) : type === 'email' ? (
        <AtSign className="w-3 h-3 text-sky-600 shrink-0" />
      ) : (
        <Phone className="w-3 h-3 text-sky-600 shrink-0" />
      )}
      <span className={`truncate ${maxWidthClass}`}>
        {copied ? 'Copied' : value}
      </span>
    </button>
  );
};

interface ContactActionChipsProps {
  email?: string | null;
  phone?: string | null;
  layout?: 'row' | 'stack';
  maxEmailWidthClass?: string;
  showEmptyPlaceholder?: boolean;
}

/**
 * Interactive email and phone micro-chips that copy on click without triggering row navigation.
 */
export const ContactActionChips: React.FC<ContactActionChipsProps> = ({
  email,
  phone,
  layout = 'row',
  maxEmailWidthClass = 'max-w-[175px]',
  showEmptyPlaceholder = false,
}) => {
  const cleanEmail = email?.trim() || '';
  const cleanPhone = phone?.trim() || '';

  if (!cleanEmail && !cleanPhone) {
    return showEmptyPlaceholder ? <span className="text-[11px] text-slate-400">—</span> : null;
  }

  return (
    <div
      className={
        layout === 'stack'
          ? 'flex flex-col items-start gap-1'
          : 'flex flex-wrap items-center gap-1.5 mt-1'
      }
    >
      {cleanEmail && (
        <ContactPillChip
          type="email"
          value={cleanEmail}
          maxWidthClass={maxEmailWidthClass}
        />
      )}
      {cleanPhone && (
        <ContactPillChip type="phone" value={cleanPhone} maxWidthClass="max-w-[150px]" />
      )}
    </div>
  );
};
