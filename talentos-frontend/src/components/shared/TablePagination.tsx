import React from 'react';
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
}

export const TablePagination: React.FC<TablePaginationProps> = ({
  page,
  limit,
  total,
  onPageChange,
  onLimitChange,
  itemLabel = 'results',
  isLoading = false,
  pageSizeOptions = [5, 10, 20, 50],
}) => {
  const safeLimit = Math.max(1, limit);
  const totalPages = Math.max(1, Math.ceil(total / safeLimit));
  const currentPage = Math.min(Math.max(1, page), totalPages);

  const startItem = total === 0 ? 0 : (currentPage - 1) * safeLimit + 1;
  const endItem = total === 0 ? 0 : Math.min(currentPage * safeLimit, total);

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
    <div className="px-5 py-3 border-t border-slate-200/80 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
      <div className="flex flex-wrap items-center gap-3 text-slate-500">
        <span>
          Showing <strong className="font-semibold text-slate-800">{startItem}–{endItem}</strong> of{' '}
          <strong className="font-semibold text-slate-800">{total}</strong> {itemLabel}
        </span>

        {onLimitChange && (
          <div className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
            <span>Rows:</span>
            <CustomSelect
              value={String(safeLimit)}
              onChange={(val) => onLimitChange(Number(val))}
              ariaLabel="Rows per page"
              size="xs"
              fullWidth={false}
              minMenuWidth={72}
              options={pageSizeOptions.map((size) => ({
                value: String(size),
                label: String(size),
              }))}
            />
          </div>
        )}

        {isLoading && (
          <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Syncing...</span>
          </span>
        )}
      </div>

      <div className="flex items-center gap-1 self-end sm:self-auto">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1 || isLoading}
          className="px-2.5 py-1 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:pointer-events-none font-medium inline-flex items-center gap-1 transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>Prev</span>
        </button>

        {pageTokens.map((token) =>
          typeof token === 'string' ? (
            <span key={token} className="px-1.5 text-slate-400 select-none">
              ...
            </span>
          ) : (
            <button
              key={token}
              type="button"
              onClick={() => onPageChange(token)}
              disabled={isLoading}
              className={`min-w-[28px] h-7 px-2 rounded-md border text-[11px] font-semibold transition-colors cursor-pointer ${
                token === currentPage
                  ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              {token}
            </button>
          )
        )}

        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages || isLoading}
          className="px-2.5 py-1 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:pointer-events-none font-medium inline-flex items-center gap-1 transition-colors cursor-pointer"
        >
          <span>Next</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

