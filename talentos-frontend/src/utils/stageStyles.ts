export interface StageStyle {
  badge: string;
  dot: string;
}

const DEFAULT_STAGE_STYLE: StageStyle = {
  badge: 'bg-slate-100 text-slate-700 border-transparent',
  dot: 'bg-slate-400',
};

const STAGE_STYLE_MAP: Record<string, StageStyle> = {
  requirement: {
    badge: 'bg-slate-100 text-slate-700 border-transparent',
    dot: 'bg-slate-400',
  },
  'available / bench': {
    badge: 'bg-emerald-500/[0.08] text-emerald-800 border-transparent',
    dot: 'bg-emerald-500',
  },
  submitted: {
    badge: 'bg-amber-500/[0.08] text-amber-800 border-transparent',
    dot: 'bg-amber-500',
  },
  interview: {
    badge: 'bg-brand-500/[0.08] text-brand-800 border-transparent',
    dot: 'bg-brand-600',
  },
  selected: {
    badge: 'bg-zinc-100 text-zinc-800 border-transparent',
    dot: 'bg-zinc-700',
  },
  onboarding: {
    badge: 'bg-emerald-500/[0.08] text-emerald-800 border-transparent',
    dot: 'bg-emerald-500',
  },
  placed: {
    badge: 'bg-emerald-500/[0.1] text-emerald-800 border-transparent',
    dot: 'bg-emerald-600',
  },
  billable: {
    badge: 'bg-emerald-500/[0.1] text-emerald-800 border-transparent',
    dot: 'bg-emerald-600',
  },
  closed: {
    badge: 'bg-rose-500/[0.08] text-rose-700 border-transparent',
    dot: 'bg-rose-500',
  },
  archived: {
    badge: 'bg-zinc-100 text-zinc-600 border-transparent',
    dot: 'bg-zinc-400',
  },
};

const STAGE_FALLBACK_PALETTES: StageStyle[] = [
  {
    badge: 'bg-brand-500/[0.08] text-brand-800 border-transparent',
    dot: 'bg-brand-600',
  },
  {
    badge: 'bg-amber-500/[0.08] text-amber-800 border-transparent',
    dot: 'bg-amber-500',
  },
  {
    badge: 'bg-slate-100 text-slate-700 border-transparent',
    dot: 'bg-slate-500',
  },
  {
    badge: 'bg-rose-500/[0.08] text-rose-700 border-transparent',
    dot: 'bg-rose-500',
  },
];

/**
 * Returns unified badge and dot classes for recruitment pipeline and candidate stages.
 */
export function getStageStyle(stage?: string, customIndex = 0): StageStyle {
  const key = (stage || '').trim().toLowerCase();
  if (STAGE_STYLE_MAP[key]) {
    return STAGE_STYLE_MAP[key];
  }
  if (customIndex > 0) {
    return STAGE_FALLBACK_PALETTES[customIndex % STAGE_FALLBACK_PALETTES.length];
  }
  return DEFAULT_STAGE_STYLE;
}

/**
 * Returns only the quiet badge classes for a pipeline or submission stage.
 */
export function getStageBadgeClass(stage?: string, customIndex = 0): string {
  return getStageStyle(stage, customIndex).badge;
}

/**
 * Returns only the status dot background class for a pipeline or submission stage.
 */
export function getStageDotClass(stage?: string, customIndex = 0): string {
  return getStageStyle(stage, customIndex).dot;
}

/**
 * Maps an SLA task's urgency or persisted badge token to a crisp indicator dot class.
 */
export function getSlaDotClass(badgeClass?: string, urgency?: string): string {
  const u = (urgency || '').trim().toLowerCase();
  if (u === 'critical') return 'bg-rose-500';
  if (u === 'high') return 'bg-amber-500';

  const raw = (badgeClass || '').trim();
  if (raw.includes('rose-') || raw.includes('red-')) return 'bg-rose-500';
  if (raw.includes('amber-') || raw.includes('orange-') || raw.includes('purple-') || raw.includes('violet-')) {
    return 'bg-amber-500';
  }
  if (raw.includes('emerald-')) return 'bg-emerald-500';
  if (raw.includes('brand-') || raw.includes('blue-') || raw.includes('indigo-')) return 'bg-brand-600';
  return 'bg-slate-400';
}

/**
 * Normalizes SLA task badge classes into quiet Option A neutral pill styling.
 */
export function normalizeSlaBadgeClass(badgeClass?: string): string {
  const raw = (badgeClass || '').trim();
  if (!raw || raw.includes('-50') || raw.includes('-100') || raw.includes('border-')) {
    return 'bg-white text-slate-700 border-slate-200';
  }
  return raw;
}
