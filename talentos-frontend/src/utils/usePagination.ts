import { useEffect, useMemo, useState } from 'react';

/**
 * Reusable client-side pagination helper for in-memory detail tables.
 * Automatically clamps the current page when item count shrinks and resets when resetKey changes.
 */
export function useClientPagination<T>(
  items: T[],
  initialLimit = 5,
  resetKey?: string | number
) {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(initialLimit);

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, limit)));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const pagedItems = useMemo(() => {
    const start = (safePage - 1) * limit;
    return items.slice(start, start + limit);
  }, [items, safePage, limit]);

  const handleLimitChange = (nextLimit: number) => {
    setLimit(nextLimit);
    setPage(1);
  };

  return {
    page: safePage,
    limit,
    total,
    pagedItems,
    setPage,
    setLimit: handleLimitChange,
  };
}
