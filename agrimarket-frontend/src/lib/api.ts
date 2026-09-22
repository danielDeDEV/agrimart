import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

/**
 * Two separate token stores.
 *
 * The admin console at /admin is a different surface with its own login, so it
 * keeps its own token. A farmer signed in on the public site and an
 * administrator signed in to the console can coexist in one browser without
 * either session standing in for the other.
 */
export const TOKEN_KEYS = {
  user: 'agrimarket_token',
  admin: 'agrimarket_admin_token',
} as const;

export type Realm = keyof typeof TOKEN_KEYS;

const isBrowser = () => typeof window !== 'undefined';

export const tokenStore = {
  get(realm: Realm) {
    if (!isBrowser()) return null;
    try {
      return window.localStorage.getItem(TOKEN_KEYS[realm]);
    } catch {
      return null;
    }
  },
  set(realm: Realm, token: string) {
    if (!isBrowser()) return;
    try {
      window.localStorage.setItem(TOKEN_KEYS[realm], token);
    } catch {
      /* private browsing — the session simply will not persist */
    }
  },
  clear(realm: Realm) {
    if (!isBrowser()) return;
    try {
      window.localStorage.removeItem(TOKEN_KEYS[realm]);
      window.localStorage.removeItem(`${TOKEN_KEYS[realm]}_refresh`);
    } catch {
      /* ignore */
    }
  },
  setRefresh(realm: Realm, token: string) {
    if (!isBrowser()) return;
    try {
      window.localStorage.setItem(`${TOKEN_KEYS[realm]}_refresh`, token);
    } catch {
      /* ignore */
    }
  },
  getRefresh(realm: Realm) {
    if (!isBrowser()) return null;
    try {
      return window.localStorage.getItem(`${TOKEN_KEYS[realm]}_refresh`);
    } catch {
      return null;
    }
  },
};

/** Which realm a request belongs to, decided by the path in the browser. */
function currentRealm(): Realm {
  if (!isBrowser()) return 'user';
  return window.location.pathname.startsWith('/admin') ? 'admin' : 'user';
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T;
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  errors?: { field: string; message: string }[];
}

export class ApiError extends Error {
  status: number;
  errors?: { field: string; message: string }[];

  constructor(message: string, status: number, errors?: { field: string; message: string }[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
  }
}

function createClient(): AxiosInstance {
  const instance = axios.create({
    baseURL: API_URL,
    timeout: 30000,
    headers: { Accept: 'application/json' },
  });

  instance.interceptors.request.use((config) => {
    const realm = (config.headers?.['X-Realm'] as Realm) || currentRealm();
    delete config.headers?.['X-Realm'];

    const token = tokenStore.get(realm);
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  instance.interceptors.response.use(
    (response) => response,
    (error: AxiosError<ApiResponse>) => {
      if (error.code === 'ECONNABORTED') {
        return Promise.reject(new ApiError('The request timed out. Please try again.', 408));
      }

      if (!error.response) {
        return Promise.reject(
          new ApiError(
            'Cannot reach the AgriMart API. Make sure the backend is running on port 5000.',
            0
          )
        );
      }

      const { status, data } = error.response;

      // A rejected token means the session is over — send the person to the
      // right sign-in page for the surface they are actually on.
      if (status === 401 && isBrowser()) {
        const realm = currentRealm();
        tokenStore.clear(realm);
        const loginPath = realm === 'admin' ? '/admin/login' : '/login';
        if (!window.location.pathname.startsWith(loginPath)) {
          const next = encodeURIComponent(window.location.pathname + window.location.search);
          window.location.href = `${loginPath}?next=${next}`;
        }
      }

      return Promise.reject(
        new ApiError(data?.message || 'Something went wrong. Please try again.', status, data?.errors)
      );
    }
  );

  return instance;
}

export const client = createClient();

/* ── Typed helpers ────────────────────────────────────────────────────── */

async function request<T>(config: AxiosRequestConfig): Promise<ApiResponse<T>> {
  const response = await client.request<ApiResponse<T>>(config);
  return response.data;
}

export const api = {
  get: <T = unknown>(url: string, params?: Record<string, unknown>, config?: AxiosRequestConfig) =>
    request<T>({ ...config, method: 'GET', url, params }),

  post: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    request<T>({ ...config, method: 'POST', url, data }),

  patch: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    request<T>({ ...config, method: 'PATCH', url, data }),

  put: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    request<T>({ ...config, method: 'PUT', url, data }),

  delete: <T = unknown>(url: string, config?: AxiosRequestConfig) =>
    request<T>({ ...config, method: 'DELETE', url }),

  /** Multipart upload used for listing images and avatars. */
  upload: <T = unknown>(url: string, formData: FormData, method: 'POST' | 'PATCH' = 'POST') =>
    request<T>({ method, url, data: formData, headers: { 'Content-Type': 'multipart/form-data' } }),

  /** Explicitly target the admin realm regardless of the current path. */
  admin: {
    get: <T = unknown>(url: string, params?: Record<string, unknown>) =>
      request<T>({ method: 'GET', url, params, headers: { 'X-Realm': 'admin' } }),
    post: <T = unknown>(url: string, data?: unknown) =>
      request<T>({ method: 'POST', url, data, headers: { 'X-Realm': 'admin' } }),
    patch: <T = unknown>(url: string, data?: unknown) =>
      request<T>({ method: 'PATCH', url, data, headers: { 'X-Realm': 'admin' } }),
    delete: <T = unknown>(url: string) =>
      request<T>({ method: 'DELETE', url, headers: { 'X-Realm': 'admin' } }),
  },
};

export function errorMessage(error: unknown, fallback = 'Something went wrong') {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}
