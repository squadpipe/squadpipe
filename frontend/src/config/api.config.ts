import axios from 'axios';
import { clearAuthSession, getStoredAuthToken } from '../utils/authStorage';

export const AUTH_EXPIRED_EVENT = 'squadpipe:auth-expired';

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
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const url = String(error?.config?.url || '');
    const isPublicAuthCall =
      url.includes('/auth/login') ||
      url.includes('/auth/signup') ||
      url.includes('/auth/forgot-password') ||
      url.includes('/auth/verify-reset-otp') ||
      url.includes('/auth/reset-password') ||
      url.includes('/auth/invite/') ||
      url.includes('/auth/accept-invite');
    const hasStoredToken = Boolean(getStoredAuthToken());

    if (status === 401 && !isPublicAuthCall && hasStoredToken) {
      clearAuthSession();
      window.dispatchEvent(
        new CustomEvent(AUTH_EXPIRED_EVENT, {
          detail: {
            message:
              error?.response?.data?.message ||
              'Your session has expired. Please sign in again.',
          },
        })
      );
    }

    return Promise.reject(error);
  }
);

