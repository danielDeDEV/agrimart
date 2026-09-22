'use client';

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { api, tokenStore, errorMessage, type Realm } from './api';
import type { User } from './types';

interface AuthState {
  user: User | null;
  loading: boolean;
  ready: boolean;
}

interface AuthContextValue extends AuthState {
  realm: Realm;
  login: (identifier: string, password: string) => Promise<User>;
  register: (payload: RegisterPayload) => Promise<User>;
  logout: (redirectTo?: string) => void;
  refresh: () => Promise<void>;
  updateUser: (patch: Partial<User>) => void;
  isAuthenticated: boolean;
}

export interface RegisterPayload {
  fullName: string;
  phone: string;
  email?: string;
  password: string;
  role: 'farmer' | 'buyer';
  regionId?: number;
  districtId?: number;
  community?: string;
  businessName?: string;
  businessType?: string;
  pin?: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * One provider, two realms.
 *
 * The public site mounts it with realm="user" and the admin console mounts a
 * separate instance with realm="admin". Each reads its own token and calls its
 * own login endpoint, so the two sessions never collide.
 */
export function AuthProvider({ children, realm = 'user' }: { children: ReactNode; realm?: Realm }) {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({ user: null, loading: false, ready: false });

  const loadSession = useCallback(async () => {
    const token = tokenStore.get(realm);
    if (!token) {
      setState({ user: null, loading: false, ready: true });
      return;
    }

    try {
      const res = await api.get<User>('/auth/me', undefined, { headers: { 'X-Realm': realm } });
      const user = res.data;

      // A farmer token must never unlock the admin console, and vice versa
      const isAdminAccount = user.role === 'admin' || user.role === 'superadmin';
      if ((realm === 'admin') !== isAdminAccount) {
        tokenStore.clear(realm);
        setState({ user: null, loading: false, ready: true });
        return;
      }

      setState({ user, loading: false, ready: true });
    } catch {
      tokenStore.clear(realm);
      setState({ user: null, loading: false, ready: true });
    }
  }, [realm]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  const login = useCallback(
    async (identifier: string, password: string) => {
      setState((s) => ({ ...s, loading: true }));
      try {
        const endpoint = realm === 'admin' ? '/auth/admin/login' : '/auth/login';
        const res = await api.post<{ user: User; token: string; refreshToken: string }>(endpoint, {
          identifier,
          password,
        });

        tokenStore.set(realm, res.data.token);
        tokenStore.setRefresh(realm, res.data.refreshToken);
        setState({ user: res.data.user, loading: false, ready: true });
        return res.data.user;
      } catch (error) {
        setState((s) => ({ ...s, loading: false }));
        throw new Error(errorMessage(error, 'Sign-in failed'));
      }
    },
    [realm]
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      setState((s) => ({ ...s, loading: true }));
      try {
        const res = await api.post<{ user: User; token: string; refreshToken: string }>(
          '/auth/register',
          payload
        );
        tokenStore.set('user', res.data.token);
        tokenStore.setRefresh('user', res.data.refreshToken);
        setState({ user: res.data.user, loading: false, ready: true });
        return res.data.user;
      } catch (error) {
        setState((s) => ({ ...s, loading: false }));
        throw new Error(errorMessage(error, 'Registration failed'));
      }
    },
    []
  );

  const logout = useCallback(
    (redirectTo?: string) => {
      api.post('/auth/logout', undefined, { headers: { 'X-Realm': realm } }).catch(() => {});
      tokenStore.clear(realm);
      setState({ user: null, loading: false, ready: true });
      router.push(redirectTo ?? (realm === 'admin' ? '/admin/login' : '/'));
    },
    [realm, router]
  );

  const updateUser = useCallback((patch: Partial<User>) => {
    setState((s) => (s.user ? { ...s, user: { ...s.user, ...patch } } : s));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      realm,
      login,
      register,
      logout,
      refresh: loadSession,
      updateUser,
      isAuthenticated: !!state.user,
    }),
    [state, realm, login, register, logout, loadSession, updateUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside an AuthProvider');
  return ctx;
}

/** Redirects to the realm's sign-in page once the session check has finished. */
export function useRequireAuth(options?: { roles?: string[]; redirectTo?: string }) {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!auth.ready) return;

    if (!auth.user) {
      const loginPath = auth.realm === 'admin' ? '/admin/login' : '/login';
      const next = typeof window !== 'undefined' ? window.location.pathname : '';
      router.replace(`${options?.redirectTo ?? loginPath}?next=${encodeURIComponent(next)}`);
      return;
    }

    if (options?.roles?.length && !options.roles.includes(auth.user.role)) {
      router.replace(auth.realm === 'admin' ? '/admin' : '/dashboard');
    }
  }, [auth.ready, auth.user, auth.realm, options?.roles, options?.redirectTo, router]);

  return auth;
}
