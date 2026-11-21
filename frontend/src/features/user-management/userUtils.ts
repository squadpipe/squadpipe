import { User } from '../../types';
import { StatusTone } from '../../components/shared/StatusBadge';
import type { CustomSelectOption } from '../../components/shared/CustomSelect';

export const USER_ROLE_OPTIONS = [
  'Administrator',
  'Senior Recruiter',
  'Technical Recruiter',
  'Bench Sales Lead',
  'Account Executive',
  'Associate Recruiter',
] as const;

export const USER_DESK_OPTIONS = [
  'Executive Operations & Billing',
  'Operations & Administration',
  'US IT Contract (C2C & W2)',
  'Cloud & DevOps Practice',
  'Data & AI Practice',
  'Candidate Bench Marketing',
] as const;

export const USER_STATUS_OPTIONS: Array<User['status']> = ['Active', 'Invited', 'Suspended'];

export interface RolePermissionGuide {
  role: string;
  tierLabel: 'Workspace Admin' | 'Team Lead / Ops' | 'Standard Desk';
  tierTone: StatusTone;
  recommendedDesk: string;
  defaultRateMasked: boolean;
  shortHint: string;
  summary: string;
}

export const ROLE_PERMISSION_GUIDES: Record<string, RolePermissionGuide> = {
  Administrator: {
    role: 'Administrator',
    tierLabel: 'Workspace Admin',
    tierTone: 'brand',
    recommendedDesk: 'Executive Operations & Billing',
    defaultRateMasked: false,
    shortHint: 'Full workspace, team & billing control',
    summary:
      'Full workspace control: invite team members, configure permissions, edit settings/forms, and manage all records.',
  },
  'Senior Recruiter': {
    role: 'Senior Recruiter',
    tierLabel: 'Team Lead / Ops',
    tierTone: 'emerald',
    recommendedDesk: 'US IT Contract (C2C & W2)',
    defaultRateMasked: true,
    shortHint: 'Full recruiting, bulk imports & vendor edits',
    summary:
      'Runs full recruiting desk plus bulk CSV/resume imports, vendor edits, and requirement/consultant cleanup.',
  },
  'Bench Sales Lead': {
    role: 'Bench Sales Lead',
    tierLabel: 'Team Lead / Ops',
    tierTone: 'emerald',
    recommendedDesk: 'Candidate Bench Marketing',
    defaultRateMasked: true,
    shortHint: 'Bench marketing, C2C vendors & bulk imports',
    summary:
      'Markets bench consultants, manages C2C partner vendors, runs bulk imports, and coordinates submissions.',
  },
  'Account Executive': {
    role: 'Account Executive',
    tierLabel: 'Team Lead / Ops',
    tierTone: 'emerald',
    recommendedDesk: 'US IT Contract (C2C & W2)',
    defaultRateMasked: false,
    shortHint: 'Client accounts, jobs & commercial rates',
    summary:
      'Owns client accounts, manages requisitions & vendor partnerships, and coordinates commercial submissions.',
  },
  'Technical Recruiter': {
    role: 'Technical Recruiter',
    tierLabel: 'Standard Desk',
    tierTone: 'slate',
    recommendedDesk: 'US IT Contract (C2C & W2)',
    defaultRateMasked: true,
    shortHint: 'Sourcing, AI matching & client pitches',
    summary:
      'Sources candidates, evaluates AI fit scores, drafts client pitches, and moves applicants through pipeline stages.',
  },
  'Associate Recruiter': {
    role: 'Associate Recruiter',
    tierLabel: 'Standard Desk',
    tierTone: 'slate',
    recommendedDesk: 'US IT Contract (C2C & W2)',
    defaultRateMasked: true,
    shortHint: 'Candidate screening & pipeline support',
    summary:
      'Supports screening, adds candidate profiles, and logs pipeline submissions with optional rate masking.',
  },
};

export const USER_ROLE_SELECT_OPTIONS: CustomSelectOption[] = USER_ROLE_OPTIONS.map((role) => ({
  value: role,
  label: role,
  description: ROLE_PERMISSION_GUIDES[role]?.shortHint,
}));

export function getRolePermissionGuide(role?: string): RolePermissionGuide {
  return (
    ROLE_PERMISSION_GUIDES[role || 'Technical Recruiter'] ||
    ROLE_PERMISSION_GUIDES['Technical Recruiter']
  );
}

export function getDefaultRateMaskForRole(role?: string): boolean {
  return getRolePermissionGuide(role).defaultRateMasked;
}

export function isLeadershipRole(role?: string): boolean {
  return [
    'Administrator',
    'Senior Recruiter',
    'Bench Sales Lead',
    'Account Executive',
  ].includes(String(role || ''));
}

export function getUserStatusTone(status?: User['status'] | string): StatusTone {
  if (status === 'Active') return 'emerald';
  if (status === 'Invited') return 'amber';
  return 'rose';
}

export function getUserRoleBadgeClass(role?: string): string {
  switch (role) {
    case 'Administrator':
      return 'bg-white border border-slate-800 text-slate-900';
    default:
      return 'bg-white border border-slate-300 text-slate-700';
  }
}

export function mergeUserSelectOptions(base: readonly string[], currentValue?: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of base) {
    const clean = String(item || '').trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(clean);
    }
  }
  const cur = String(currentValue || '').trim();
  if (cur && !seen.has(cur.toLowerCase())) {
    out.push(cur);
  }
  return out;
}

export interface RoleCapability {
  label: string;
  description: string;
  allowed: boolean;
}

export function getUserRoleCapabilities(role: string, rateMasked: boolean): RoleCapability[] {
  const isAdmin = role === 'Administrator';
  const canOperateData = isLeadershipRole(role);

  return [
    {
      label: 'Pipeline, Submissions & Pitching',
      description: 'Manage jobs, evaluate AI fit scores, shortlist candidates, and submit pitches.',
      allowed: true,
    },
    {
      label: 'Bulk Imports & Record Management',
      description: 'Run bulk CSV/resume imports, edit vendor details, and delete requisitions or profiles.',
      allowed: canOperateData,
    },
    {
      label: 'Commercial Bill & Pay Rates',
      description: rateMasked
        ? 'Client bill rates, pay rates, spreads, and SOW placements are masked (••••).'
        : 'Full clearance to view client bill rates, margins, and manage active placements.',
      allowed: !rateMasked,
    },
    {
      label: 'Workspace Admin & Team Permissions',
      description: 'Invite team members, change roles, manage custom fields, forms, and settings.',
      allowed: isAdmin,
    },
  ];
}

export function matchesOwnerName(ownerField: unknown, memberName?: string): boolean {
  if (!memberName) return false;
  const rawName =
    typeof ownerField === 'object' && ownerField !== null
      ? String((ownerField as any).fullName || (ownerField as any).name || '')
      : String(ownerField || '');
  return rawName.trim().toLowerCase() === memberName.trim().toLowerCase();
}
