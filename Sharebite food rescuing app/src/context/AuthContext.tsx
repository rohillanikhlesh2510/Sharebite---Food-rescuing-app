import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { AuthService } from '../services/auth';
import type { User, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Preserve referential identity if user data has not meaningfully changed
  const setUserIfChanged = useCallback((newUser: User | null) => {
    setUser(prev => {
      if (!prev && !newUser) return null;
      if (!prev || !newUser) return newUser;
      if (
        prev.id === newUser.id &&
        prev.role === newUser.role &&
        prev.isVerified === newUser.isVerified &&
        prev.verificationStatus === newUser.verificationStatus &&
        prev.name === newUser.name &&
        prev.email === newUser.email &&
        prev.updatedAt === newUser.updatedAt
      ) {
        return prev;
      }
      return newUser;
    });
  }, []);

  const refreshUser = useCallback(async () => {
    const currentUser = await AuthService.getCurrentUser();
    setUserIfChanged(currentUser);
  }, [setUserIfChanged]);

  useEffect(() => {
    refreshUser().finally(() => setLoading(false));

    const { data: { subscription } } = AuthService.onAuthStateChange((newUser) => {
      setUserIfChanged(newUser);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [refreshUser, setUserIfChanged]);

  const login = useCallback(async (email: string, password?: string, expectedRole?: UserRole | 'acceptor'): Promise<User> => {
    const loggedInUser = await AuthService.login(email, password, expectedRole);
    setUserIfChanged(loggedInUser);
    return loggedInUser;
  }, [setUserIfChanged]);

  const loginAsDemo = useCallback(async (role: 'donor' | 'ngo' | 'volunteer' | 'admin'): Promise<User> => {
    const loggedInUser = AuthService.loginAsDemoRole(role);
    setUserIfChanged(loggedInUser);
    return loggedInUser;
  }, [setUserIfChanged]);

  const signup = useCallback(async (data: {
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
    if (result.sessionExists) setUserIfChanged(result.user);
    return result;
  }, [setUserIfChanged]);

  const signInWithGoogle = useCallback(async (intendedRole: 'donor' | 'acceptor' | 'rider') => {
    await AuthService.signInWithGoogle(intendedRole);
    await refreshUser();
  }, [refreshUser]);

  const handleOAuthCallback = useCallback(async () => {
    const u = await AuthService.handleOAuthCallback();
    setUserIfChanged(u);
    return u;
  }, [setUserIfChanged]);

  const logout = useCallback(async () => {
    await AuthService.logout();
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (updates: Partial<User>) => {
    if (!user) return;
    const updated = await AuthService.updateProfile(user.id, updates);
    setUserIfChanged(updated);
  }, [user, setUserIfChanged]);

  const resetPasswordForEmail = useCallback(async (email: string) => {
    await AuthService.resetPasswordForEmail(email);
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    await AuthService.updatePassword(password);
  }, []);

  const contextValue = useMemo<AuthContextType>(() => ({
    user,
    loading,
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
  }), [
    user,
    loading,
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
  ]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
