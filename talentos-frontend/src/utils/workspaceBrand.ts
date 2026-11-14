import { useEffect, useState } from 'react';
import { apiClient } from '../config/api.config';

export interface WorkspaceBrand {
  agencyName: string;
  legalEntityName: string;
  website: string;
  supportEmail: string;
  supportPhone: string;
  headquarters: string;
}

const STORAGE_KEY = 'talentos_workspace_brand';

export const DEFAULT_WORKSPACE_BRAND: WorkspaceBrand = {
  agencyName: 'TalentOS Staffing',
  legalEntityName: 'TalentOS Staffing Solutions LLC',
  website: '',
  supportEmail: '',
  supportPhone: '',
  headquarters: '',
};

let currentBrand: WorkspaceBrand = (() => {
  try {
    if (typeof window !== 'undefined') {
      const raw = window.localStorage.getItem(STORAGE_KEY);
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

const DEMO_PLACEHOLDER_VALUES = new Set([
  'talentos-agency.com',
  'https://talentos-agency.com',
  'desk@talentos-agency.com',
  '+1 (800) 555-0199',
  'austin, tx',
]);

function normalizeBrand(partial?: Partial<WorkspaceBrand> | null): WorkspaceBrand {
  const agencyName =
    String(partial?.agencyName ?? currentBrand.agencyName).trim() ||
    DEFAULT_WORKSPACE_BRAND.agencyName;
  const isDefaultBrand = agencyName.toLowerCase() === 'talentos staffing';
  const cleanField = (val: unknown) => {
    const str = String(val ?? '').trim();
    if (!isDefaultBrand && DEMO_PLACEHOLDER_VALUES.has(str.toLowerCase())) {
      return '';
    }
    return str;
  };
  return {
    agencyName,
    legalEntityName: String(partial?.legalEntityName ?? currentBrand.legalEntityName ?? '').trim(),
    website: cleanField(partial?.website ?? currentBrand.website),
    supportEmail: cleanField(partial?.supportEmail ?? currentBrand.supportEmail),
    supportPhone: cleanField(partial?.supportPhone ?? currentBrand.supportPhone),
    headquarters: cleanField(partial?.headquarters ?? currentBrand.headquarters),
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
      (['localStorage', 'sessionStorage'] as const).forEach((storageKey) => {
        const storage = window[storageKey];
        const rawUser = storage.getItem('talentos_current_user');
        if (rawUser) {
          const parsedUser = JSON.parse(rawUser);
          if (parsedUser && typeof parsedUser === 'object' && parsedUser.agencyName !== next.agencyName) {
            storage.setItem(
              'talentos_current_user',
              JSON.stringify({ ...parsedUser, agencyName: next.agencyName })
            );
          }
        }
      });
    }
  } catch {
    // Ignore storage write errors
  }

  if (!unchanged) {
    listeners.forEach((listener) => listener(next));
  }
  return next;
}

export async function initWorkspaceBrand(forceRefresh = false): Promise<WorkspaceBrand> {
  if (brandSyncedFromApi && !forceRefresh) {
    return currentBrand;
  }
  try {
    const res = await apiClient.get('/settings');
    const general = res.data?.data?.general;
    if (general) {
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

