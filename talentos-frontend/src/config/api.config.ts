import axios from 'axios';

export const AUTH_EXPIRED_EVENT = 'talentos:auth-expired';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token =
    localStorage.getItem('talentos_access_token') ||
    sessionStorage.getItem('talentos_access_token');
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
      url.includes('/auth/reset-password');
    const hasStoredToken = Boolean(
      localStorage.getItem('talentos_access_token') ||
        sessionStorage.getItem('talentos_access_token')
    );

    if (status === 401 && !isPublicAuthCall && hasStoredToken) {
      localStorage.removeItem('talentos_access_token');
      localStorage.removeItem('talentos_current_user');
      sessionStorage.removeItem('talentos_access_token');
      sessionStorage.removeItem('talentos_current_user');
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

