import axios from 'axios';
import { clearAuthSession, getStoredAuthToken } from '../utils/authStorage';

const TECHNICAL_ERR_RE =
  /(?:AI JSON repair failed|Schema validation failed|Invalid JSON|Unexpected token|ZodError|\bPrisma\b|\bTypeError\b|\bSyntaxError\b|\bReferenceError\b|\bECONN|\bETIMEDOUT|\bENOTFOUND|Number must be (?:greater|less) than|Expected (?:string|number)|<!DOCTYPE|<html)/i;

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
  url.includes('/auth/forgot-password') ||
  url.includes('/auth/verify-reset-otp') ||
  url.includes('/auth/reset-password') ||
  url.includes('/auth/invite/') ||
  url.includes('/auth/accept-invite');

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

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
  (error) => {
    const status = error?.response?.status;
    const url = String(error?.config?.url || '');
    const isPublicAuthCall = isPublicAuthUrl(url);
    const hasStoredToken = Boolean(getStoredAuthToken());
    const errMsg = String(error?.response?.data?.message || '');
    const isSuspended = status === 403 && errMsg.toLowerCase().includes('account suspended');

    if ((status === 401 || isSuspended) && !isPublicAuthCall && hasStoredToken) {
      clearAuthSession();
      window.dispatchEvent(
        new CustomEvent(AUTH_EXPIRED_EVENT, {
          detail: {
            message:
              errMsg ||
              'Your session has expired. Please sign in again.',
          },
        })
      );
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

