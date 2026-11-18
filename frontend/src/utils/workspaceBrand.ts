import { useEffect, useState } from 'react';
import { apiClient } from '../config/api.config';
import { getStoredCurrentUserRaw, updateStoredCurrentUser } from './authStorage';

export interface WorkspaceBrand {
  agencyName: string;
  legalEntityName: string;
  website: string;
  supportEmail: string;
  supportPhone: string;
  headquarters: string;
}

export interface WorkspacePolicies {
  requirePoForPlacement: boolean;
}

export interface AiFeatureFlags {
  resumeParser: boolean;
  emailIntake: boolean;
  capabilityCheck: boolean;
  pitchDraft: boolean;
  actionCenterAgent: boolean;
}

export interface AiCapabilities {
  enabled: boolean;
  provider: string;
  allowByoKey?: boolean;
  quotaExceeded?: boolean;
  features: AiFeatureFlags;
}

const STORAGE_KEY = 'squadpipe_workspace_brand';
const LEGACY_STORAGE_KEY = 'talentos_workspace_brand';
const POLICIES_STORAGE_KEY = 'squadpipe_workspace_policies';
const AI_CAPABILITIES_STORAGE_KEY = 'squadpipe_ai_capabilities';

export const DEFAULT_WORKSPACE_POLICIES: WorkspacePolicies = {
  requirePoForPlacement: false,
};

export const DEFAULT_AI_CAPABILITIES: AiCapabilities = {
  enabled: false,
  provider: 'none',
  features: {
    resumeParser: false,
    emailIntake: false,
    capabilityCheck: false,
    pitchDraft: false,
    actionCenterAgent: false,
  },
};

export const DEFAULT_WORKSPACE_BRAND: WorkspaceBrand = {
  agencyName: 'SquadPipe Staffing',
  legalEntityName: 'SquadPipe Staffing Solutions LLC',
  website: '',
  supportEmail: '',
  supportPhone: '',
  headquarters: '',
};

let currentBrand: WorkspaceBrand = (() => {
  try {
    if (typeof window !== 'undefined') {
      const raw =
        window.localStorage.getItem(STORAGE_KEY) ||
        window.localStorage.getItem(LEGACY_STORAGE_KEY);
      if (!window.localStorage.getItem(STORAGE_KEY) && raw) {
        window.localStorage.setItem(STORAGE_KEY, raw);
        window.localStorage.removeItem(LEGACY_STORAGE_KEY);
      }
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return { ...DEFAULT_WORKSPACE_BRAND, ...parsed };
        }
      }
    }
  } catch {
    // Ignore storage read errors
  }
  return { ...DEFAULT_WORKSPACE_BRAND };
})();

let brandSyncedFromApi = false;
const listeners = new Set<(brand: WorkspaceBrand) => void>();

let currentPolicies: WorkspacePolicies = (() => {
  try {
    if (typeof window !== 'undefined') {
      const raw = window.localStorage.getItem(POLICIES_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return {
            requirePoForPlacement: Boolean(parsed.requirePoForPlacement),
          };
        }
      }
    }
  } catch {
    // Ignore storage read errors
  }
  return { ...DEFAULT_WORKSPACE_POLICIES };
})();

const policyListeners = new Set<(policies: WorkspacePolicies) => void>();

function normalizeAiCapabilities(partial?: Partial<AiCapabilities> | null): AiCapabilities {
  const enabled = Boolean(partial?.enabled);
  if (!enabled) {
    return {
      enabled: false,
      provider: 'none',
      features: { ...DEFAULT_AI_CAPABILITIES.features },
    };
  }
  const f = partial?.features;
  return {
    enabled: true,
    provider: String(partial?.provider || 'none').trim().toLowerCase() || 'none',
    features: {
      resumeParser: Boolean(f?.resumeParser),
      emailIntake: Boolean(f?.emailIntake),
      capabilityCheck: Boolean(f?.capabilityCheck),
      pitchDraft: Boolean(f?.pitchDraft),
      actionCenterAgent: Boolean(f?.actionCenterAgent),
    },
  };
}

let currentAiCapabilities: AiCapabilities = (() => {
  try {
    if (typeof window !== 'undefined') {
      const raw = window.localStorage.getItem(AI_CAPABILITIES_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return normalizeAiCapabilities(parsed);
        }
      }
    }
  } catch {
    // Ignore storage read errors
  }
  return {
    ...DEFAULT_AI_CAPABILITIES,
    features: { ...DEFAULT_AI_CAPABILITIES.features },
  };
})();

const aiListeners = new Set<(ai: AiCapabilities) => void>();

export const DEMO_PLACEHOLDER_VALUES = new Set([
  'talentos-agency.com',
  'https://talentos-agency.com',
  'desk@talentos-agency.com',
  'squadpipe-agency.com',
  'https://squadpipe-agency.com',
  'desk@squadpipe-agency.com',
  '+1 (800) 555-0199',
  'austin, tx',
]);

export function isDefaultBrandName(agencyName: string): boolean {
  const normalized = agencyName.trim().toLowerCase();
  return normalized === 'squadpipe staffing' || normalized === 'talentos staffing';
}

export function sanitizeBrandContact(value: unknown, isDefaultBrand: boolean): string {
  const str = String(value ?? '').trim();
  if (!str) return '';
  if (!isDefaultBrand && DEMO_PLACEHOLDER_VALUES.has(str.toLowerCase())) {
    return '';
  }
  return str;
}

function normalizeBrand(partial?: Partial<WorkspaceBrand> | null): WorkspaceBrand {
  const rawAgencyName = String(partial?.agencyName ?? currentBrand.agencyName).trim();
  const agencyName =
    (rawAgencyName === 'TalentOS Staffing' ? DEFAULT_WORKSPACE_BRAND.agencyName : rawAgencyName) ||
    DEFAULT_WORKSPACE_BRAND.agencyName;
  const isDefaultBrand = isDefaultBrandName(agencyName);
  const rawLegalName = String(partial?.legalEntityName ?? currentBrand.legalEntityName ?? '').trim();
  const legalEntityName =
    rawLegalName === 'TalentOS Staffing Solutions LLC'
      ? DEFAULT_WORKSPACE_BRAND.legalEntityName
      : rawLegalName;
  return {
    agencyName,
    legalEntityName,
    website: sanitizeBrandContact(partial?.website ?? currentBrand.website, isDefaultBrand),
    supportEmail: sanitizeBrandContact(partial?.supportEmail ?? currentBrand.supportEmail, isDefaultBrand),
    supportPhone: sanitizeBrandContact(partial?.supportPhone ?? currentBrand.supportPhone, isDefaultBrand),
    headquarters: sanitizeBrandContact(partial?.headquarters ?? currentBrand.headquarters, isDefaultBrand),
  };
}

export function getWorkspaceBrand(): WorkspaceBrand {
  return currentBrand;
}

export function getWorkspaceBrandSlug(): string {
  return (
    (currentBrand.agencyName || currentBrand.legalEntityName || 'Workspace')
      .trim()
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'Workspace'
  );
}

export function setWorkspaceBrand(partial?: Partial<WorkspaceBrand> | null): WorkspaceBrand {
  const next = normalizeBrand(partial);
  const unchanged =
    next.agencyName === currentBrand.agencyName &&
    next.legalEntityName === currentBrand.legalEntityName &&
    next.website === currentBrand.website &&
    next.supportEmail === currentBrand.supportEmail &&
    next.supportPhone === currentBrand.supportPhone &&
    next.headquarters === currentBrand.headquarters;

  currentBrand = next;
  brandSyncedFromApi = true;

  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
      const rawUser = getStoredCurrentUserRaw();
      if (rawUser) {
        const parsedUser = JSON.parse(rawUser);
        if (parsedUser && typeof parsedUser === 'object' && parsedUser.agencyName !== next.agencyName) {
          updateStoredCurrentUser({ ...parsedUser, agencyName: next.agencyName });
        }
      }
    }
  } catch {
    // Ignore storage write errors
  }

  if (!unchanged) {
    listeners.forEach((listener) => listener(next));
  }
  return next;
}

export function getWorkspacePolicies(): WorkspacePolicies {
  return currentPolicies;
}

export function setWorkspacePolicies(
  partial?: Partial<WorkspacePolicies> | null
): WorkspacePolicies {
  const next: WorkspacePolicies = {
    requirePoForPlacement:
      partial?.requirePoForPlacement !== undefined
        ? Boolean(partial.requirePoForPlacement)
        : currentPolicies.requirePoForPlacement,
  };
  const unchanged = next.requirePoForPlacement === currentPolicies.requirePoForPlacement;
  currentPolicies = next;

  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(POLICIES_STORAGE_KEY, JSON.stringify(next));
    }
  } catch {
    // Ignore storage write errors
  }

  if (!unchanged) {
    policyListeners.forEach((listener) => listener(next));
  }
  return next;
}

export function getAiCapabilities(): AiCapabilities {
  return currentAiCapabilities;
}

export function setAiCapabilities(partial?: Partial<AiCapabilities> | null): AiCapabilities {
  const next = normalizeAiCapabilities(partial);
  const unchanged =
    next.enabled === currentAiCapabilities.enabled &&
    next.provider === currentAiCapabilities.provider &&
    next.features.resumeParser === currentAiCapabilities.features.resumeParser &&
    next.features.emailIntake === currentAiCapabilities.features.emailIntake &&
    next.features.capabilityCheck === currentAiCapabilities.features.capabilityCheck &&
    next.features.pitchDraft === currentAiCapabilities.features.pitchDraft &&
    next.features.actionCenterAgent === currentAiCapabilities.features.actionCenterAgent;

  currentAiCapabilities = next;

  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(AI_CAPABILITIES_STORAGE_KEY, JSON.stringify(next));
    }
  } catch {
    // Ignore storage write errors
  }

  if (!unchanged) {
    aiListeners.forEach((listener) => listener(next));
  }
  return next;
}

export async function initWorkspaceBrand(forceRefresh = false): Promise<WorkspaceBrand> {
  if (brandSyncedFromApi && !forceRefresh) {
    return currentBrand;
  }
  try {
    const res = await apiClient.get('/settings');
    const data = res.data?.data;
    if (data?.ai !== undefined) {
      setAiCapabilities(data.ai);
    } else if (data?.general) {
      setAiCapabilities(null);
    }
    const general = data?.general;
    if (general) {
      setWorkspacePolicies(general);
      return setWorkspaceBrand(general);
    }
  } catch {
    // Keep existing or default brand if settings endpoint is unavailable
  }
  return currentBrand;
}

/**
 * React hook subscribed to the active organization brand configured in General Settings.
 */
export function useWorkspaceBrand() {
  const [brand, setBrandState] = useState<WorkspaceBrand>(currentBrand);

  useEffect(() => {
    const listener = (next: WorkspaceBrand) => setBrandState(next);
    listeners.add(listener);
    if (currentBrand !== brand) {
      setBrandState(currentBrand);
    }
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return brand;
}

/**
 * React hook subscribed to active placement/staffing policy flags from General Settings.
 */
export function useWorkspacePolicies(): WorkspacePolicies {
  const [policies, setPoliciesState] = useState<WorkspacePolicies>(currentPolicies);

  useEffect(() => {
    const listener = (next: WorkspacePolicies) => setPoliciesState(next);
    policyListeners.add(listener);
    if (currentPolicies.requirePoForPlacement !== policies.requirePoForPlacement) {
      setPoliciesState(currentPolicies);
    }
    if (!brandSyncedFromApi) {
      void initWorkspaceBrand();
    }
    return () => {
      policyListeners.delete(listener);
    };
  }, []);

  return policies;
}

/**
 * React hook subscribed to server-driven AI capability flags returned by GET /settings.
 */
export function useAiCapabilities(): AiCapabilities {
  const [ai, setAiState] = useState<AiCapabilities>(currentAiCapabilities);

  useEffect(() => {
    const listener = (next: AiCapabilities) => setAiState(next);
    aiListeners.add(listener);
    if (
      currentAiCapabilities.enabled !== ai.enabled ||
      currentAiCapabilities.provider !== ai.provider
    ) {
      setAiState(currentAiCapabilities);
    }
    if (!brandSyncedFromApi) {
      void initWorkspaceBrand();
    }
    return () => {
      aiListeners.delete(listener);
    };
  }, []);

  return ai;
}

