export type SortDirection = 'asc' | 'desc';

export interface ParsedSortParams {
  sortBy?: string;
  sortDir: SortDirection;
}

/**
 * Normalize query sort direction to 'asc' or 'desc'.
 */
export function normalizeSortDirection(
  raw?: unknown,
  fallback: SortDirection = 'desc'
): SortDirection {
  const clean = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (clean === 'asc' || clean === 'ascending') return 'asc';
  if (clean === 'desc' || clean === 'descending') return 'desc';
  return fallback;
}

/**
 * Extract and whitelist `sortBy` and `sortDir` query parameters, rejecting blocked fields
 * (such as rate columns for rate-masked users).
 */
export function parseSortParams(
  query: Record<string, any> | undefined,
  allowedFields: readonly string[],
  blockedFields: readonly string[] = []
): ParsedSortParams {
  const rawField = query?.sortBy ?? query?.sort;
  const field = typeof rawField === 'string' ? rawField.trim() : '';
  const sortDir = normalizeSortDirection(query?.sortDir ?? query?.sortOrder ?? query?.order, 'asc');

  if (!field || !allowedFields.includes(field) || blockedFields.includes(field)) {
    return { sortBy: undefined, sortDir };
  }
  return { sortBy: field, sortDir };
}

/**
 * Build a Prisma-compatible `orderBy` expression from a validated column map with deterministic default.
 */
export function buildPrismaOrderBy<T>(
  sortBy: string | undefined,
  sortDir: SortDirection,
  columnMap: Record<string, (dir: SortDirection) => T | T[]>,
  defaultOrderBy: T | T[]
): T | T[] {
  if (!sortBy) return defaultOrderBy;
  const builder = columnMap[sortBy];
  if (!builder) return defaultOrderBy;
  return builder(sortDir);
}

/**
 * Compare arbitrary column values (nulls last, numeric, Date, boolean, case-insensitive string).
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
 * Deterministically sort an array of computed/enriched records on the server when
 * SQL `orderBy` cannot express the derived field directly.
 */
export function sortRecordsByColumn<T>(
  items: readonly T[],
  sortBy: string | undefined,
  sortDir: SortDirection,
  accessors: Record<string, (item: T) => unknown>
): T[] {
  if (!sortBy || !accessors[sortBy]) return [...items];
  const getter = accessors[sortBy];
  return items
    .map((item, idx) => ({ item, idx }))
    .sort((left, right) => {
      const cmp = compareSortValues(getter(left.item), getter(right.item), sortDir);
      return cmp !== 0 ? cmp : left.idx - right.idx;
    })
    .map((entry) => entry.item);
}
