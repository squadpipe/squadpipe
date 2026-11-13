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

function normalizeBrand(partial?: Partial<WorkspaceBrand> | null): WorkspaceBrand {
  return {
    agencyName:
      String(partial?.agencyName ?? currentBrand.agencyName).trim() ||
      DEFAULT_WORKSPACE_BRAND.agencyName,
    legalEntityName: String(partial?.legalEntityName ?? currentBrand.legalEntityName ?? '').trim(),
    website: String(partial?.website ?? currentBrand.website ?? '').trim(),
    supportEmail: String(partial?.supportEmail ?? currentBrand.supportEmail ?? '').trim(),
    supportPhone: String(partial?.supportPhone ?? currentBrand.supportPhone ?? '').trim(),
    headquarters: String(partial?.headquarters ?? currentBrand.headquarters ?? '').trim(),
  };
}

export function getWorkspaceBrand(): WorkspaceBrand {
  return currentBrand;
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

