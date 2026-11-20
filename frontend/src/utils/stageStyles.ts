export interface StageStyle {
  badge: string;
  dot: string;
}

const DEFAULT_STAGE_STYLE: StageStyle = {
  badge: 'bg-white text-slate-700 border-slate-200/90',
  dot: 'bg-slate-400',
};

const STAGE_STYLE_MAP: Record<string, StageStyle> = {
  requirement: {
    badge: 'bg-white text-slate-700 border-slate-200/90',
    dot: 'bg-slate-400',
  },
  'available / bench': {
    badge: 'bg-white text-slate-700 border-slate-200/90',
    dot: 'bg-emerald-500',
  },
  submitted: {
    badge: 'bg-white text-slate-700 border-slate-200/90',
    dot: 'bg-amber-500',
  },
  interview: {
    badge: 'bg-white text-slate-700 border-slate-200/90',
    dot: 'bg-brand-600',
  },
  selected: {
    badge: 'bg-white text-slate-700 border-slate-200/90',
    dot: 'bg-zinc-700',
  },
  onboarding: {
    badge: 'bg-white text-slate-700 border-slate-200/90',
    dot: 'bg-emerald-500',
  },
  placed: {
    badge: 'bg-white text-slate-700 border-slate-200/90',
    dot: 'bg-emerald-500',
  },
  billable: {
    badge: 'bg-white text-slate-700 border-slate-200/90',
    dot: 'bg-emerald-500',
  },
  closed: {
    badge: 'bg-white text-slate-700 border-slate-200/90',
    dot: 'bg-rose-500',
  },
  archived: {
    badge: 'bg-white text-slate-700 border-slate-200/90',
    dot: 'bg-zinc-400',
  },
};

const STAGE_FALLBACK_PALETTES: StageStyle[] = [
  {
    badge: 'bg-white text-slate-700 border-slate-200/90',
    dot: 'bg-brand-600',
  },
  {
    badge: 'bg-white text-slate-700 border-slate-200/90',
    dot: 'bg-amber-500',
  },
  {
    badge: 'bg-white text-slate-700 border-slate-200/90',
    dot: 'bg-slate-500',
  },
  {
    badge: 'bg-white text-slate-700 border-slate-200/90',
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

const EXCLUDED_REQUIREMENT_STAGES = new Set(['billable', 'archived']);
const EXCLUDED_APPLICANT_STAGES = new Set(['requirement', 'billable', 'archived']);

function collectStageOptions(
  source: string[],
  excluded: Set<string>,
  trailingStages: string[],
  currentStage?: string
): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const raw of source) {
    const clean = String(raw || '').trim();
    if (!clean) continue;
    const lower = clean.toLowerCase();
    if (excluded.has(lower) || seen.has(lower)) continue;
    seen.add(lower);
    result.push(clean);
  }

  for (const trailing of trailingStages) {
    const lower = trailing.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      result.push(trailing);
    }
  }

  const current = String(currentStage || '').trim();
  if (current && !seen.has(current.toLowerCase())) {
    result.push(current);
  }

  return result;
}

/**
 * Returns the case-insensitive index of a stage within the workspace stage list (or 0).
 */
export function getStageIndex(stage?: string, stages?: string[]): number {
  if (!stage || !Array.isArray(stages) || stages.length === 0) return 0;
  const target = stage.trim().toLowerCase();
  const idx = stages.findIndex((s) => s.trim().toLowerCase() === target);
  return idx >= 0 ? idx : 0;
}

/**
 * Derives requirement pipeline stage options from workspace MasterTaxonomy STAGES,
 * excluding Billable/Archived unless already assigned on the requirement.
 */
export function buildRequirementStageOptions(stages?: string[], currentStage?: string): string[] {
  const source =
    Array.isArray(stages) && stages.length > 0
      ? stages
      : ['Requirement', 'Submitted', 'Interview', 'Selected', 'Onboarding'];
  return collectStageOptions(source, EXCLUDED_REQUIREMENT_STAGES, [], currentStage);
}

/**
 * Derives applicant submission stage options from workspace MasterTaxonomy STAGES,
 * excluding Requirement/Billable/Archived and ensuring Closed and the current stage are present.
 */
export function buildApplicantStageOptions(stages?: string[], currentStage?: string): string[] {
  const source =
    Array.isArray(stages) && stages.length > 0
      ? stages
      : ['Submitted', 'Interview', 'Selected', 'Onboarding'];
  return collectStageOptions(source, EXCLUDED_APPLICANT_STAGES, ['Closed'], currentStage);
}
