export const ACCESS_TOKEN_KEY = 'squadpipe_access_token';
export const CURRENT_USER_KEY = 'squadpipe_current_user';

const LEGACY_ACCESS_TOKEN_KEY = 'talentos_access_token';
const LEGACY_CURRENT_USER_KEY = 'talentos_current_user';

function readAndMigrateKey(primaryKey: string, legacyKey: string): string | null {
  if (typeof window === 'undefined') return null;
  for (const storage of [window.localStorage, window.sessionStorage]) {
    const current = storage.getItem(primaryKey);
    if (current) return current;
    const legacy = storage.getItem(legacyKey);
    if (legacy) {
      try {
        storage.setItem(primaryKey, legacy);
        storage.removeItem(legacyKey);
      } catch {
        // Ignore storage write errors during migration
      }
      return legacy;
    }
  }
  return null;
}

export function getStoredAuthToken(): string | null {
  return readAndMigrateKey(ACCESS_TOKEN_KEY, LEGACY_ACCESS_TOKEN_KEY);
}

export function getStoredCurrentUserRaw(): string | null {
  return readAndMigrateKey(CURRENT_USER_KEY, LEGACY_CURRENT_USER_KEY);
}

export function setAuthSession(token: string, user: unknown, persistent: boolean = true): void {
  if (typeof window === 'undefined') return;
  const target = persistent ? window.localStorage : window.sessionStorage;
  const other = persistent ? window.sessionStorage : window.localStorage;
  const serializedUser = JSON.stringify(user);

  target.setItem(ACCESS_TOKEN_KEY, token);
  target.setItem(CURRENT_USER_KEY, serializedUser);
  target.removeItem(LEGACY_ACCESS_TOKEN_KEY);
  target.removeItem(LEGACY_CURRENT_USER_KEY);

  other.removeItem(ACCESS_TOKEN_KEY);
  other.removeItem(CURRENT_USER_KEY);
  other.removeItem(LEGACY_ACCESS_TOKEN_KEY);
  other.removeItem(LEGACY_CURRENT_USER_KEY);
}

export function updateStoredCurrentUser(user: unknown, fallbackToLocal: boolean = false): void {
  if (typeof window === 'undefined') return;
  const serialized = JSON.stringify(user);
  let updated = false;
  for (const storage of [window.localStorage, window.sessionStorage]) {
    if (storage.getItem(CURRENT_USER_KEY) || storage.getItem(LEGACY_CURRENT_USER_KEY)) {
      storage.setItem(CURRENT_USER_KEY, serialized);
      storage.removeItem(LEGACY_CURRENT_USER_KEY);
      updated = true;
    }
  }
  if (!updated && fallbackToLocal) {
    window.localStorage.setItem(CURRENT_USER_KEY, serialized);
    window.localStorage.removeItem(LEGACY_CURRENT_USER_KEY);
  }
}

export function clearAuthSession(): void {
  if (typeof window === 'undefined') return;
  for (const storage of [window.localStorage, window.sessionStorage]) {
    storage.removeItem(ACCESS_TOKEN_KEY);
    storage.removeItem(CURRENT_USER_KEY);
    storage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
    storage.removeItem(LEGACY_CURRENT_USER_KEY);
  }
}
