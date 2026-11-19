import { useCallback, useMemo, useState } from 'react';
import { parseRateNumber } from './currency';

export type SortDirection = 'asc' | 'desc';

/**
 * Parse a monetary/rate display string into a numeric sort key, returning null when unrated.
 */
export function extractRateSortValue(rawRate: unknown): number | null {
  if (rawRate === null || rawRate === undefined) return null;
  if (typeof rawRate === 'number') {
    return Number.isFinite(rawRate) ? rawRate : null;
  }
  const str = String(rawRate).trim();
  if (!str || !/\d/.test(str)) return null;
  const parsed = parseRateNumber(str, NaN);
  return Number.isFinite(parsed) ? parsed : null;
}

export interface TableSortState<K extends string = string> {
  sortBy: K | null;
  sortDir: SortDirection;
}

/**
 * Cycle table sort across defaultDir -> oppositeDir -> cleared (default server order).
 */
export function getNextSortState<K extends string>(
  current: TableSortState<K>,
  column: K,
  defaultDir: SortDirection = 'asc'
): TableSortState<K> {
  if (current.sortBy !== column) {
    return { sortBy: column, sortDir: defaultDir };
  }
  if (current.sortDir === defaultDir) {
    return { sortBy: column, sortDir: defaultDir === 'asc' ? 'desc' : 'asc' };
  }
  return { sortBy: null, sortDir: defaultDir };
}

/**
 * Reusable table sort hook returning current state, click handler, and API query params.
 */
export function useTableSort<K extends string = string>(
  initialSortBy: K | null = null,
  initialSortDir: SortDirection = 'asc'
) {
  const [sort, setSort] = useState<TableSortState<K>>({
    sortBy: initialSortBy,
    sortDir: initialSortDir,
  });

  const handleSort = useCallback((column: K, defaultDir: SortDirection = 'asc') => {
    setSort((prev) => getNextSortState(prev, column, defaultDir));
  }, []);

  const resetSort = useCallback(() => {
    setSort({ sortBy: initialSortBy, sortDir: initialSortDir });
  }, [initialSortBy, initialSortDir]);

  const sortParams = useMemo(
    () =>
      sort.sortBy
        ? {
            sortBy: sort.sortBy,
            sortDir: sort.sortDir,
          }
        : {},
    [sort.sortBy, sort.sortDir]
  );

  return {
    sort,
    setSort,
    handleSort,
    resetSort,
    sortParams,
  };
}

/**
 * Compare arbitrary cell values (nulls last, numeric, Date, boolean, natural locale string).
 */
export function compareSortValues(a: unknown, b: unknown, dir: SortDirection): number {
  const aEmpty = a === null || a === undefined || (typeof a === 'string' && a.trim() === '');
  const bEmpty = b === null || b === undefined || (typeof b === 'string' && b.trim() === '');
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;

  const mult = dir === 'asc' ? 1 : -1;

  if (a instanceof Date && b instanceof Date) {
    return (a.getTime() - b.getTime()) * mult;
  }

  if (typeof a === 'number' && typeof b === 'number') {
    return (a - b) * mult;
  }

  if (typeof a === 'boolean' && typeof b === 'boolean') {
    return (Number(a) - Number(b)) * mult;
  }

  return (
    String(a).localeCompare(String(b), undefined, {
      numeric: true,
      sensitivity: 'base',
    }) * mult
  );
}

/**
 * Deterministically sort an array of items for client-side detail tables and offline fallbacks.
 */
export function sortArrayByColumn<T>(
  items: readonly T[],
  sort: TableSortState,
  accessors: Record<string, (item: T) => unknown>
): T[] {
  if (!sort.sortBy || !accessors[sort.sortBy]) return [...items];
  const getter = accessors[sort.sortBy];
  return items
    .map((item, idx) => ({ item, idx }))
    .sort((left, right) => {
      const cmp = compareSortValues(getter(left.item), getter(right.item), sort.sortDir);
      return cmp !== 0 ? cmp : left.idx - right.idx;
    })
    .map((entry) => entry.item);
}
