import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { CustomSelect } from './CustomSelect';

export interface TablePaginationProps {
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  itemLabel?: string;
  isLoading?: boolean;
  pageSizeOptions?: number[];
  alwaysShow?: boolean;
}

export const TablePagination: React.FC<TablePaginationProps> = ({
  page,
  limit,
  total,
  onPageChange,
  onLimitChange,
  itemLabel = 'results',
  isLoading = false,
  pageSizeOptions = [10, 20, 50],
  alwaysShow = false,
}) => {
  // Only show spinner if fetch actually stalls (>220ms) so quick page flips never blink.
  const [showSpinner, setShowSpinner] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setShowSpinner(false);
      return;
    }
    const timer = window.setTimeout(() => setShowSpinner(true), 220);
    return () => window.clearTimeout(timer);
  }, [isLoading]);

  const minThreshold = pageSizeOptions.length > 0 ? Math.min(...pageSizeOptions) : 10;
  if (total === 0 || (!alwaysShow && total <= minThreshold)) {
    return null;
  }

  const safeLimit = Math.max(1, limit);
  const totalPages = Math.max(1, Math.ceil(total / safeLimit));
  const currentPage = Math.min(Math.max(1, page), totalPages);

  const startItem = (currentPage - 1) * safeLimit + 1;
  const endItem = Math.min(currentPage * safeLimit, total);

  const buildPageTokens = (): Array<number | 'ellipsis-left' | 'ellipsis-right'> => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, idx) => idx + 1);
    }
    const tokens: Array<number | 'ellipsis-left' | 'ellipsis-right'> = [1];
    const windowStart = Math.max(2, currentPage - 1);
    const windowEnd = Math.min(totalPages - 1, currentPage + 1);

    if (windowStart > 2) tokens.push('ellipsis-left');
    for (let p = windowStart; p <= windowEnd; p += 1) {
      tokens.push(p);
    }
    if (windowEnd < totalPages - 1) tokens.push('ellipsis-right');
    tokens.push(totalPages);
    return tokens;
  };

  const pageTokens = buildPageTokens();

  return (
    <div className="px-5 py-2.5 border-t border-slate-100 bg-white flex flex-wrap items-center justify-between gap-2 text-[11px]">
      <div className="flex flex-wrap items-center gap-2.5 text-slate-500">
        <span className="tabular-nums">
          <strong className="font-semibold text-slate-700">
            {startItem}–{endItem}
          </strong>{' '}
          of <strong className="font-semibold text-slate-700">{total}</strong> {itemLabel}
        </span>

        {onLimitChange && (
          <div className="inline-flex items-center gap-1.5 text-[11px] text-slate-400">
            <span>&bull;</span>
            <span>Rows:</span>
            <CustomSelect
              value={String(safeLimit)}
              onChange={(val) => onLimitChange(Number(val))}
              ariaLabel="Rows per page"
              size="xs"
              fullWidth={false}
              minMenuWidth={64}
              className="!py-0.5 !px-1.5 !h-6 !text-[11px]"
              options={pageSizeOptions.map((size) => ({
                value: String(size),
                label: String(size),
              }))}
            />
          </div>
        )}

        <span
          className={`inline-flex items-center w-3.5 text-slate-400 transition-opacity duration-150 ${
            showSpinner ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          aria-hidden={!showSpinner}
        >
          <Loader2 className="w-3 h-3 animate-spin" />
        </span>
      </div>

      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          aria-label="Previous page"
          className="h-6 w-6 rounded border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-35 disabled:pointer-events-none inline-flex items-center justify-center transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        {pageTokens.map((token) =>
          typeof token === 'string' ? (
            <span key={token} className="px-1 text-slate-400 select-none">
              &hellip;
            </span>
          ) : (
            <button
              key={token}
              type="button"
              onClick={() => onPageChange(token)}
              className={`min-w-[24px] h-6 px-1.5 rounded text-[11px] font-semibold tabular-nums transition-colors cursor-pointer ${
                token === currentPage
                  ? 'bg-brand-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {token}
            </button>
          )
        )}

        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          aria-label="Next page"
          className="h-6 w-6 rounded border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-35 disabled:pointer-events-none inline-flex items-center justify-center transition-colors cursor-pointer"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

