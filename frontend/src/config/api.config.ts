import axios from 'axios';
import {
  clearAuthSession,
  getStoredAuthToken,
  updateStoredAuthToken,
  updateStoredCurrentUser,
} from '../utils/authStorage';

const TECHNICAL_ERR_RE =
  /(?:AI JSON repair failed|Schema validation failed|Invalid JSON|Unexpected token|ZodError|\bPrisma(?:Client)?\b|ConnectorError|PostgresError|QueryEngine|Can't reach database|\bdatabase\b.*\bdoes not exist\b|postgresql:\/\/|postgres:\/\/|Invalid `[^`]+` invocation|Unique constraint failed|Foreign key constraint|\brelation "[^"]+"|\bcolumn "[^"]+"|\bpg_hba\b|\bTypeError\b|\bSyntaxError\b|\bReferenceError\b|\bECONN|\bETIMEDOUT|\bENOTFOUND|\bERR_NETWORK\b|authentication server|backend status|environment variable|\bSMTP_[A-Z0-9_]+|\bJWT_[A-Z0-9_]+|JsonWebTokenError|TokenExpiredError|Number must be (?:greater|less) than|Expected (?:string|number)|Request failed with status code|<!DOCTYPE|<html)/i;

export function cleanCustomerErrorMessage(
  rawMessage: unknown,
  fallback = 'Something went wrong while processing your request. Please try again.'
): string {
  const trimmed = typeof rawMessage === 'string' ? rawMessage.trim() : '';
  if (!trimmed || TECHNICAL_ERR_RE.test(trimmed)) {
    return fallback;
  }
  return trimmed;
}

const getCustomerFriendlyErrorMessage = (error: any): string => {
  const status = error?.response?.status;
  const serverMsg =
    typeof error?.response?.data?.message === 'string'
      ? error.response.data.message.trim()
      : '';

  if (serverMsg && !TECHNICAL_ERR_RE.test(serverMsg)) {
    return serverMsg;
  }

  if (error?.code === 'ERR_NETWORK' || error?.message === 'Network Error') {
    return 'Unable to connect right now. Please check your internet connection and try again.';
  }
  if (error?.code === 'ECONNABORTED' || /timeout of \d+ms exceeded/i.test(String(error?.message || ''))) {
    return 'The request took too long to finish. Please try again.';
  }
  if (status === 413) {
    return 'The uploaded file is too large. Please upload a smaller file.';
  }
  if (status === 429) {
    return 'Too many requests right now. Please wait a moment and try again.';
  }
  if (status === 502 || status === 503 || status === 504) {
    return 'The service is temporarily unavailable. Please try again in a moment.';
  }
  return 'Something went wrong while processing your request. Please try again.';
};

export const AUTH_EXPIRED_EVENT = 'squadpipe:auth-expired';
export const USER_SESSION_SYNC_EVENT = 'squadpipe:user-session-sync';
export const APP_TOAST_EVENT = 'squadpipe:app-toast';

export function emitAppToast(
  title: string,
  message: string,
  icon: 'success' | 'error' | 'warning' | 'info' = 'info'
) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(APP_TOAST_EVENT, {
      detail: { title, message, icon },
    })
  );
}

const isPublicAuthUrl = (url: string) =>
  url.includes('/public/') ||
  url.includes('/auth/login') ||
  url.includes('/auth/signup') ||
  url.includes('/auth/refresh') ||
  url.includes('/auth/logout') ||
  url.includes('/auth/forgot-password') ||
  url.includes('/auth/verify-reset-otp') ||
  url.includes('/auth/reset-password') ||
  url.includes('/auth/invite/') ||
  url.includes('/auth/accept-invite');

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

let activeRefreshPromise: Promise<string> | null = null;

async function withBrowserRefreshLock<T>(task: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks?.request) {
    return navigator.locks.request('squadpipe_token_refresh', () => task());
  }
  return task();
}

function dispatchAuthExpiredOnce(message: string): void {
  if (!getStoredAuthToken()) return;
  clearAuthSession();
  window.dispatchEvent(
    new CustomEvent(AUTH_EXPIRED_EVENT, {
      detail: {
        message: message || 'Your session has expired. Please sign in again.',
      },
    })
  );
}

async function refreshAccessTokenSingleFlight(failedToken: string): Promise<string> {
  if (activeRefreshPromise) {
    return activeRefreshPromise;
  }

  activeRefreshPromise = withBrowserRefreshLock(async () => {
    const latestToken = getStoredAuthToken();
    if (latestToken && failedToken && latestToken !== failedToken) {
      return latestToken;
    }

    const baseURL = apiClient.defaults.baseURL || '/api/v1';
    const res = await axios.post(
      `${baseURL}/auth/refresh`,
      {},
      {
        withCredentials: true,
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000,
      }
    );

    const nextToken = String(res.data?.token || '').trim();
    if (!nextToken) {
      throw Object.assign(new Error('Your session has expired. Please sign in again.'), {
        response: { status: 401 },
      });
    }

    updateStoredAuthToken(nextToken);
    if (res.data?.user) {
      updateStoredCurrentUser(res.data.user);
      window.dispatchEvent(
        new CustomEvent(USER_SESSION_SYNC_EVENT, {
          detail: {
            role: res.data.user.role,
            rateMasked: res.data.user.rateMasked,
          },
        })
      );
    }

    return nextToken;
  }).finally(() => {
    activeRefreshPromise = null;
  });

  return activeRefreshPromise;
}

apiClient.interceptors.request.use((config) => {
  const url = String(config.url || '');
  const token = url.includes('/public/') ? null : getStoredAuthToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (config.data instanceof FormData && config.headers) {
    if (typeof (config.headers as any).delete === 'function') {
      (config.headers as any).delete('Content-Type');
    } else {
      delete (config.headers as any)['Content-Type'];
    }
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    const url = String(response?.config?.url || '');
    if (!isPublicAuthUrl(url) && response?.headers) {
      const roleHeader = response.headers['x-user-role'];
      const maskedHeader = response.headers['x-rate-masked'];
      if (roleHeader !== undefined || maskedHeader !== undefined) {
        window.dispatchEvent(
          new CustomEvent(USER_SESSION_SYNC_EVENT, {
            detail: {
              ...(roleHeader !== undefined ? { role: String(roleHeader) } : {}),
              ...(maskedHeader !== undefined
                ? { rateMasked: String(maskedHeader).toLowerCase() === 'true' }
                : {}),
            },
          })
        );
      }
    }
    return response;
  },
  async (error) => {
    const status = error?.response?.status;
    const originalRequest = error?.config as any;
    const url = String(originalRequest?.url || '');
    const isPublicAuthCall = isPublicAuthUrl(url);
    const hasStoredToken = Boolean(getStoredAuthToken());
    const errMsg = String(error?.response?.data?.message || '');
    const isSuspended = status === 403 && errMsg.toLowerCase().includes('account suspended');

    if (isSuspended && !isPublicAuthCall && hasStoredToken) {
      dispatchAuthExpiredOnce(errMsg);
    } else if (status === 401 && !isPublicAuthCall && hasStoredToken && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      const authHeaderRaw =
        typeof originalRequest.headers?.get === 'function'
          ? String(originalRequest.headers.get('Authorization') || '')
          : String(originalRequest.headers?.Authorization || '');
      const failedToken = authHeaderRaw.replace(/^Bearer\s+/i, '').trim() || getStoredAuthToken() || '';

      try {
        const freshToken = await refreshAccessTokenSingleFlight(failedToken);
        if (typeof originalRequest.headers?.set === 'function') {
          originalRequest.headers.set('Authorization', `Bearer ${freshToken}`);
        } else {
          originalRequest.headers = {
            ...(originalRequest.headers || {}),
            Authorization: `Bearer ${freshToken}`,
          };
        }
        return apiClient(originalRequest);
      } catch (refreshError: any) {
        const refreshStatus = refreshError?.response?.status;
        const refreshMsg = String(refreshError?.response?.data?.message || '').trim();
        // Only invalidate stored session when backend explicitly rejects the refresh token or suspends the account;
        // transient network / 5xx deploy blips keep the cookie & session intact so the user can retry safely.
        if (refreshStatus === 401 || refreshStatus === 403) {
          dispatchAuthExpiredOnce(
            refreshMsg || 'Your session has expired. Please sign in again.'
          );
          error = refreshError;
        }
      }
    } else if (status === 401 && !isPublicAuthCall && hasStoredToken) {
      dispatchAuthExpiredOnce(errMsg);
    }

    const friendlyMsg = getCustomerFriendlyErrorMessage(error);
    if (error?.response?.data && typeof error.response.data === 'object') {
      error.response.data.message = friendlyMsg;
    }
    if (error && typeof error === 'object') {
      error.message = friendlyMsg;
    }

    return Promise.reject(error);
  }
);

