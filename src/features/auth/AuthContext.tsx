import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { useAuthStore, type UserProfile } from './store/authStore';

export type { UserProfile };

interface AuthContextType {
  isAuthenticated: boolean;
  user: UserProfile | null;
  loading: boolean;
  login: (userData: UserProfile, accessToken: string, refreshToken: string, sessionId?: string) => void;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<UserProfile>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const login = useAuthStore((s) => s.login);
  const logout = useAuthStore((s) => s.logout);
  const updateUser = useAuthStore((s) => s.updateUser);
  const initAuth = useAuthStore((s) => s.initAuth);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  const value = useMemo<AuthContextType>(
    () => ({
      isAuthenticated,
      user,
      loading,
      login,
      logout,
      updateUser,
    }),
    [isAuthenticated, user, loading, login, logout, updateUser]
  );

  if (loading && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#14110E' }}>
        <div
          className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: '#D97757', borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    // If used outside provider, fallback directly to Zustand store values
    const state = useAuthStore.getState();
    return {
      isAuthenticated: state.isAuthenticated,
      user: state.user,
      loading: state.loading,
      login: state.login,
      logout: state.logout,
      updateUser: state.updateUser,
    };
  }
  return context;
}
