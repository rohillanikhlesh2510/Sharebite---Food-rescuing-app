import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { AuthService, clearLegacyAuthCaches } from '../services/auth';
import type { AuthStatus, User, UserRole } from '../types';

const PROFILE_REVALIDATE_COOLDOWN_MS = 60_000;

interface AuthContextType {
  user: User | null;
  loading: boolean;
  authStatus: AuthStatus;
  authError: string | null;
  retryAuth: () => Promise<void>;
  login: (email: string, password?: string, expectedRole?: UserRole | 'acceptor') => Promise<User>;
  loginAsDemo: (role: 'donor' | 'ngo' | 'volunteer' | 'admin') => Promise<User>;
  signup: (data: {
    name: string;
    phone: string;
    email: string;
    role: UserRole | 'acceptor';
    password: string;
    organizationName?: string;
    registrationNumber?: string;
    address?: string;
    city?: string;
    dateOfBirth?: string;
  }) => Promise<{ user: User; sessionExists: boolean }>;
  signInWithGoogle: (intendedRole: 'donor' | 'acceptor' | 'rider') => Promise<void>;
  handleOAuthCallback: () => Promise<User>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  resetPasswordForEmail: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: React.ReactNode;
  onSessionReset?: () => void;
}

export function AuthProvider({ children, onSessionReset }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('initializing');
  const [authError, setAuthError] = useState<string | null>(null);

  const requestSeqRef = useRef(0);
  const activeUserIdRef = useRef<string | null>(null);
  const authenticatedUserRef = useRef<User | null>(null);
  const lastProfileSyncAtRef = useRef<number>(0);
  const mountedRef = useRef(true);
  const onSessionResetRef = useRef(onSessionReset);

  useEffect(() => {
    onSessionResetRef.current = onSessionReset;
  }, [onSessionReset]);

  const loading = authStatus === 'initializing' || authStatus === 'loading_profile';

  const setUserIfChanged = useCallback((newUser: User | null) => {
    authenticatedUserRef.current = newUser;
    setUser((prev) => {
      if (!prev && !newUser) return null;
      if (!prev || !newUser) return newUser;
      if (
        prev.id === newUser.id &&
        prev.role === newUser.role &&
        prev.isVerified === newUser.isVerified &&
        prev.verificationStatus === newUser.verificationStatus &&
        prev.name === newUser.name &&
        prev.email === newUser.email &&
        prev.isAvailable === newUser.isAvailable &&
        prev.serviceRadiusKm === newUser.serviceRadiusKm &&
        prev.updatedAt === newUser.updatedAt
      ) {
        return prev;
      }
      return newUser;
    });
  }, []);

  const loadProfileForSession = useCallback(
    async (session: Session | null, eventReason: string) => {
      const seq = ++requestSeqRef.current;

      if (!session?.user) {
        authenticatedUserRef.current = null;
        lastProfileSyncAtRef.current = 0;
        if (activeUserIdRef.current !== null) {
          clearLegacyAuthCaches();
          onSessionResetRef.current?.();
        }
        activeUserIdRef.current = null;
        if (mountedRef.current) {
          setUser(null);
          setAuthError(null);
          setAuthStatus('unauthenticated');
        }
        return;
      }

      const sessionUserId = session.user.id;
      const isSameAuthenticatedUser =
        activeUserIdRef.current === sessionUserId && authenticatedUserRef.current !== null;
      const isAccountSwitch =
        activeUserIdRef.current !== null && activeUserIdRef.current !== sessionUserId;

      // Rule A: Token refresh only rotates the access JWT; keep active dashboard completely untouched.
      if (eventReason === 'TOKEN_REFRESHED' && isSameAuthenticatedUser) {
        return;
      }

      // Rule B: Duplicate SIGNED_IN / INITIAL_SESSION on browser tab switch must NEVER unmount or thrash API.
      const isPassiveRevalidation =
        eventReason === 'SIGNED_IN' || eventReason === 'INITIAL_SESSION' || eventReason === 'SAFETY_REFRESH';

      if (isSameAuthenticatedUser && isPassiveRevalidation) {
        if (Date.now() - lastProfileSyncAtRef.current < PROFILE_REVALIDATE_COOLDOWN_MS) {
          return;
        }
        // Cooldown elapsed: silently revalidate in background without switching authStatus to loading_profile.
      } else if (isAccountSwitch) {
        // Rule C: Account switch -> wipe previous user cache/state immediately before loading new profile.
        clearLegacyAuthCaches();
        onSessionResetRef.current?.();
        authenticatedUserRef.current = null;
        lastProfileSyncAtRef.current = 0;
        if (mountedRef.current) {
          setUser(null);
          setAuthError(null);
          setAuthStatus('loading_profile');
        }
      } else if (!isSameAuthenticatedUser && eventReason !== 'TOKEN_REFRESHED') {
        // Rule D: Cold start or unauthenticated -> show profile loading indicator.
        if (mountedRef.current) {
          setAuthError(null);
          setAuthStatus('loading_profile');
        }
      }

      const result = await AuthService.fetchAuthoritativeProfile(sessionUserId);

      if (!mountedRef.current || seq !== requestSeqRef.current) {
        return;
      }

      if (result.status === 'ok') {
        activeUserIdRef.current = result.user.id;
        lastProfileSyncAtRef.current = Date.now();
        setUserIfChanged(result.user);
        setAuthError(null);
        setAuthStatus('authenticated');
        return;
      }

      // Rule E: Preserve already-authenticated session during temporary network/offline hiccups (TEST 10).
      if (result.status === 'error' && isSameAuthenticatedUser) {
        setAuthError(null);
        setAuthStatus('authenticated');
        return;
      }

      activeUserIdRef.current = sessionUserId;
      authenticatedUserRef.current = null;
      setUser(null);

      if (result.status === 'missing') {
        setAuthError(
          'Your account profile could not be found. Please retry loading or sign out and contact support.'
        );
        setAuthStatus('profile_missing');
      } else if (result.status === 'invalid_role') {
        setAuthError(
          `Your account role ("${result.rawRole || 'unset'}") is invalid. Please contact support or sign out.`
        );
        setAuthStatus('invalid_role');
      } else {
        setAuthError(result.message);
        setAuthStatus('error');
      }
    },
    [setUserIfChanged]
  );

  const refreshUserWithReason = useCallback(
    async (reason: string) => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();
        if (error) {
          if (mountedRef.current && authenticatedUserRef.current === null) {
            setAuthError(error.message);
            setAuthStatus('error');
          }
          return;
        }
        await loadProfileForSession(session, reason);
      } catch (err: any) {
        if (mountedRef.current && authenticatedUserRef.current === null) {
          setAuthError(err?.message || 'Failed to verify authentication session.');
          setAuthStatus('error');
        }
      }
    },
    [loadProfileForSession]
  );

  const refreshUser = useCallback(async () => {
    await refreshUserWithReason('USER_ACTION_REFRESH');
  }, [refreshUserWithReason]);

  const retryAuth = useCallback(async () => {
    lastProfileSyncAtRef.current = 0;
    setAuthError(null);
    setAuthStatus('loading_profile');
    await refreshUserWithReason('MANUAL_RETRY');
  }, [refreshUserWithReason]);

  useEffect(() => {
    mountedRef.current = true;
    clearLegacyAuthCaches();

    let deferredTimer: number | undefined;
    let initialResolved = false;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      initialResolved = true;

      if (event === 'SIGNED_OUT') {
        ++requestSeqRef.current;
        activeUserIdRef.current = null;
        authenticatedUserRef.current = null;
        lastProfileSyncAtRef.current = 0;
        clearLegacyAuthCaches();
        onSessionResetRef.current?.();
        if (mountedRef.current) {
          setUser(null);
          setAuthError(null);
          setAuthStatus('unauthenticated');
        }
        return;
      }

      if (event === 'SIGNED_IN' && AuthService.isLoginInFlight()) {
        return;
      }

      // Fast-path: TOKEN_REFRESHED for active user needs zero async profile query or timer.
      if (
        event === 'TOKEN_REFRESHED' &&
        session?.user?.id &&
        activeUserIdRef.current === session.user.id &&
        authenticatedUserRef.current !== null
      ) {
        return;
      }

      if (deferredTimer) window.clearTimeout(deferredTimer);
      deferredTimer = window.setTimeout(() => {
        if (mountedRef.current) {
          void loadProfileForSession(session, event);
        }
      }, 0);
    });

    const safetyTimer = window.setTimeout(() => {
      if (!initialResolved && mountedRef.current && authenticatedUserRef.current === null) {
        void refreshUserWithReason('SAFETY_REFRESH');
      }
    }, 1500);

    return () => {
      mountedRef.current = false;
      if (deferredTimer) window.clearTimeout(deferredTimer);
      window.clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, [loadProfileForSession, refreshUserWithReason]);

  const login = useCallback(
    async (
      email: string,
      password?: string,
      expectedRole?: UserRole | 'acceptor'
    ): Promise<User> => {
      const loggedInUser = await AuthService.login(email, password, expectedRole);
      ++requestSeqRef.current;

      if (activeUserIdRef.current && activeUserIdRef.current !== loggedInUser.id) {
        onSessionResetRef.current?.();
      }
      activeUserIdRef.current = loggedInUser.id;
      lastProfileSyncAtRef.current = Date.now();
      setUserIfChanged(loggedInUser);
      setAuthError(null);
      setAuthStatus('authenticated');
      return loggedInUser;
    },
    [setUserIfChanged]
  );

  const loginAsDemo = useCallback(async (role: 'donor' | 'ngo' | 'volunteer' | 'admin'): Promise<User> => {
    return AuthService.loginAsDemoRole(role);
  }, []);

  const signup = useCallback(
    async (data: {
      name: string;
      phone: string;
      email: string;
      role: UserRole | 'acceptor';
      password: string;
      organizationName?: string;
      registrationNumber?: string;
      address?: string;
      city?: string;
      dateOfBirth?: string;
    }) => {
      const result = await AuthService.signup(data);
      if (result.sessionExists) {
        ++requestSeqRef.current;
        if (activeUserIdRef.current && activeUserIdRef.current !== result.user.id) {
          onSessionResetRef.current?.();
        }
        activeUserIdRef.current = result.user.id;
        lastProfileSyncAtRef.current = Date.now();
        setUserIfChanged(result.user);
        setAuthError(null);
        setAuthStatus('authenticated');
      }
      return result;
    },
    [setUserIfChanged]
  );

  const signInWithGoogle = useCallback(async (intendedRole: 'donor' | 'acceptor' | 'rider') => {
    await AuthService.signInWithGoogle(intendedRole);
  }, []);

  const handleOAuthCallback = useCallback(async () => {
    const u = await AuthService.handleOAuthCallback();
    ++requestSeqRef.current;
    if (activeUserIdRef.current && activeUserIdRef.current !== u.id) {
      onSessionResetRef.current?.();
    }
    activeUserIdRef.current = u.id;
    lastProfileSyncAtRef.current = Date.now();
    setUserIfChanged(u);
    setAuthError(null);
    setAuthStatus('authenticated');
    return u;
  }, [setUserIfChanged]);

  const logout = useCallback(async () => {
    ++requestSeqRef.current;
    activeUserIdRef.current = null;
    authenticatedUserRef.current = null;
    lastProfileSyncAtRef.current = 0;
    await AuthService.logout();
    setUser(null);
    setAuthError(null);
    setAuthStatus('unauthenticated');
    onSessionResetRef.current?.();
  }, []);

  const updateProfile = useCallback(
    async (updates: Partial<User>) => {
      const current = authenticatedUserRef.current;
      if (!current) return;
      const updated = await AuthService.updateProfile(current.id, updates);
      lastProfileSyncAtRef.current = Date.now();
      setUserIfChanged(updated);
    },
    [setUserIfChanged]
  );

  const resetPasswordForEmail = useCallback(async (email: string) => {
    await AuthService.resetPasswordForEmail(email);
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    await AuthService.updatePassword(password);
  }, []);

  const contextValue = useMemo<AuthContextType>(
    () => ({
      user,
      loading,
      authStatus,
      authError,
      retryAuth,
      login,
      loginAsDemo,
      signup,
      signInWithGoogle,
      handleOAuthCallback,
      logout,
      updateProfile,
      resetPasswordForEmail,
      updatePassword,
      refreshUser,
    }),
    [
      user,
      loading,
      authStatus,
      authError,
      retryAuth,
      login,
      loginAsDemo,
      signup,
      signInWithGoogle,
      handleOAuthCallback,
      logout,
      updateProfile,
      resetPasswordForEmail,
      updatePassword,
      refreshUser,
    ]
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
