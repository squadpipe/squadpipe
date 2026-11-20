import React from 'react';

interface PageSkeletonProps {
  variant?: 'detail' | 'workspace';
}

/**
 * Quiet surface skeleton shown while lazy route bundles or deep-linked detail records resolve.
 */
export const PageSkeleton: React.FC<PageSkeletonProps> = ({ variant = 'workspace' }) => {
  if (variant === 'detail') {
    return (
      <div className="max-w-7xl mx-auto space-y-5 animate-pulse" aria-busy="true" aria-label="Loading record details">
        <div className="flex items-center gap-2">
          <div className="h-7 w-28 rounded-md bg-slate-200/80" />
          <div className="h-5 w-16 rounded-md bg-slate-200/60" />
          <div className="h-4 w-44 rounded bg-slate-200/60" />
        </div>
        <div className="bg-white rounded-xl border border-slate-200 card-shadow p-6 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2.5 flex-1">
              <div className="h-5 w-64 rounded-md bg-slate-200/80" />
              <div className="h-3.5 w-96 max-w-full rounded bg-slate-100" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-8 w-20 rounded-lg bg-slate-100" />
              <div className="h-8 w-28 rounded-lg bg-slate-200/80" />
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-slate-100">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 w-20 rounded bg-slate-100" />
                <div className="h-4 w-32 rounded bg-slate-200/70" />
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 card-shadow p-5 space-y-3">
          <div className="h-4 w-40 rounded bg-slate-200/80" />
          <div className="h-10 w-full rounded-lg bg-slate-100" />
          <div className="h-10 w-full rounded-lg bg-slate-100" />
          <div className="h-10 w-full rounded-lg bg-slate-100" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-5 animate-pulse" aria-busy="true" aria-label="Loading workspace module">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="h-6 w-52 rounded-md bg-slate-200/80" />
          <div className="h-3.5 w-80 max-w-full rounded bg-slate-200/60" />
        </div>
        <div className="h-8 w-32 rounded-lg bg-slate-200/80" />
      </div>
      <div className="bg-white rounded-xl border border-slate-200 card-shadow p-5 space-y-3">
        {[0, 1, 2, 3, 4].map((row) => (
          <div key={row} className="h-11 rounded-lg bg-slate-100" />
        ))}
      </div>
    </div>
  );
};
