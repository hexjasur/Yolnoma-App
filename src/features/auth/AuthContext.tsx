import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '@/shared/api/http';
import { clearAuthSession } from '@/shared/lib/authSession';
import { isUnauthorizedError, reportError } from '@/shared/lib/errors';
import { toast } from '@/shared/ui/Toast';

export interface UserProfile {
  id: string;
  email: string;
  role: string;
  display_name?: string;
  avatar_url?: string;
  thumbnail_url?: string;
  is_private?: boolean;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: UserProfile | null;
  login: (userData: UserProfile, accessToken: string, refreshToken: string, sessionId?: string) => void;
  logout: () => void;
  updateUser: (updates: Partial<UserProfile>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const accessToken = localStorage.getItem('yolnoma_access_token');
      const refreshToken = localStorage.getItem('yolnoma_refresh_token');
      const storedUser = localStorage.getItem('yolnoma_user');

      // Hydrate cached user data immediately so an offline launch is still useful.
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);
          setIsAuthenticated(true);
        } catch (error) {
          reportError('auth.cached-user', error);
        }
      }

      if (accessToken && refreshToken) {
        try {
          const res = await api.get('/api/v2/auth/me');
          const rawUser = res?.data?.user || res?.user || res;
          if (rawUser && (rawUser.id || rawUser._id)) {
            const formattedUser: UserProfile = {
              id: rawUser.id || rawUser._id,
              email: rawUser.email,
              role: rawUser.role || 'user',
              display_name: rawUser.name || rawUser.display_name || rawUser.displayName,
              avatar_url: rawUser.avatar || rawUser.avatar_url || rawUser.picture,
              thumbnail_url: rawUser.thumbnail_url,
              is_private: rawUser.is_private ?? false,
            };
            setUser(formattedUser);
            setIsAuthenticated(true);
            localStorage.setItem('yolnoma_user', JSON.stringify(formattedUser));
          }
        } catch (error) {
          reportError('auth.session-check', error);
          if (isUnauthorizedError(error)) {
            clearAuthSession();
            setIsAuthenticated(false);
            setUser(null);
          }
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = (userData: UserProfile, accessToken: string, refreshToken: string, sessionId?: string) => {
    setUser(userData);
    setIsAuthenticated(true);
    localStorage.setItem('yolnoma_access_token', accessToken);
    localStorage.setItem('yolnoma_refresh_token', refreshToken);
    if (sessionId) {
      localStorage.setItem('yolnoma_session_id', sessionId);
    }
    localStorage.setItem('yolnoma_user', JSON.stringify(userData));
  };

  const logout = async () => {
    try {
      await api.post('/api/v2/auth/sign-out', {}).catch(() => {});
    } catch {
      // ignore
    }
    setUser(null);
    setIsAuthenticated(false);
    clearAuthSession();
    toast.success('Signed out successfully.');
  };

  const updateUser = (updates: Partial<UserProfile>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates };
      localStorage.setItem('yolnoma_user', JSON.stringify(updated));
      return updated;
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#14110E' }}>
        <div
          className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: '#D97757', borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
