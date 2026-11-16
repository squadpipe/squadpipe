import axios from 'axios';
import { clearAuthSession, getStoredAuthToken } from '../utils/authStorage';

export const AUTH_EXPIRED_EVENT = 'squadpipe:auth-expired';
export const USER_SESSION_SYNC_EVENT = 'squadpipe:user-session-sync';

const isPublicAuthUrl = (url: string) =>
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
  const token = getStoredAuthToken();
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

    return Promise.reject(error);
  }
);

