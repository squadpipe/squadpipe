import React from 'react';
import { getStageDotClass } from '../../utils/stageStyles';

export type StatusTone = 'emerald' | 'amber' | 'rose' | 'brand' | 'zinc' | 'slate';

const TONE_DOT_CLASS: Record<StatusTone, string> = {
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  brand: 'bg-brand-600',
  zinc: 'bg-zinc-600',
  slate: 'bg-slate-400',
};

interface StatusBadgeProps {
  /** Text shown inside the pill. Falls back to `stage` when omitted. */
  label?: React.ReactNode;
  /** Pipeline stage name resolved via `getStageDotClass`. */
  stage?: string;
  /** Explicit semantic color for the leading status dot. */
  tone?: StatusTone;
  /** Direct Tailwind background class for the leading status dot. */
  dotClass?: string;
  /** Optional custom icon replacing the 6px status dot. */
  icon?: React.ReactNode;
  size?: 'xs' | 'sm';
  shape?: 'pill' | 'rounded';
  title?: string;
  className?: string;
}

/**
 * Quiet enterprise status pill (`bg-white border-slate-200 text-slate-700`) with a
 * subtle colored dot indicator, avoiding loud pastel fills and borders.
 */
export const StatusBadge: React.FC<StatusBadgeProps> = ({
  label,
  stage,
  tone,
  dotClass,
  icon,
  size = 'sm',
  shape = 'pill',
  title,
  className = '',
}) => {
  const resolvedLabel = label ?? stage ?? '';
  const resolvedDot =
    dotClass ||
    (tone ? TONE_DOT_CLASS[tone] : stage ? getStageDotClass(stage) : TONE_DOT_CLASS.slate);

  const sizeClass =
    size === 'xs' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-0.5 text-[11px]';
  const shapeClass = shape === 'rounded' ? 'rounded-md' : 'rounded-full';

  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 font-medium bg-white text-slate-700 border border-slate-200/90 whitespace-nowrap leading-none ${sizeClass} ${shapeClass} ${className}`}
    >
      {icon ? (
        <span className="inline-flex items-center flex-shrink-0">{icon}</span>
      ) : (
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${resolvedDot}`} />
      )}
      <span>{resolvedLabel}</span>
    </span>
  );
};
