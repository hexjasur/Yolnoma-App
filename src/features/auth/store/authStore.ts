import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { api } from '@/shared/api/http';
import { clearAuthSession } from '@/shared/lib/authSession';
import { isUnauthorizedError, reportError } from '@/shared/lib/errors';
import { toast } from '@/shared/ui/Toast';
import { useAccountConfigStore } from '@/shared/stores/accountConfigStore';
import { getApiKey, saveApiKey } from '@/shared/hooks/useAccountStorage';

export interface UserProfile {
  id: string;
  email: string;
  role: string;
  // Canonical camelCase fields (matches backend DTO)
  displayName?: string;
  avatarUrl?: string;
  thumbnailUrl?: string;
  isPrivate?: boolean;
  // Backward compatibility fields
  display_name?: string;
  avatar_url?: string;
  thumbnail_url?: string;
  is_private?: boolean;
}

interface RawUserResponse {
  id?: string;
  _id?: string;
  email: string;
  role?: string;
  displayName?: string;
  display_name?: string;
  name?: string;
  avatarUrl?: string;
  avatar_url?: string;
  avatar?: string;
  picture?: string;
  thumbnailUrl?: string;
  thumbnail_url?: string;
  isPrivate?: boolean;
  is_private?: boolean;
}

interface AuthState {
  isAuthenticated: boolean;
  user: UserProfile | null;
  loading: boolean;
  isInitialized: boolean;

  // Actions
  initAuth: () => Promise<void>;
  login: (userData: UserProfile, accessToken: string, refreshToken: string, sessionId?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<UserProfile>) => void;
  setUser: (user: UserProfile | null) => void;
}

function parseStoredUser(): UserProfile | null {
  try {
    const stored = localStorage.getItem('yolnoma_user');
    return stored ? (JSON.parse(stored) as UserProfile) : null;
  } catch (error) {
    reportError('auth.cached-user', error);
    return null;
  }
}

async function syncAccountStorage(userId: string) {
  if (!userId) return;
  try {
    // 1. Tell backend which user is active
    await invoke('set_current_user', { userId }).catch((e) => {
      console.warn('[authStore] Failed to set_current_user:', e);
    });

    // 2. Load config.json into accountConfigStore
    await useAccountConfigStore.getState().loadConfig(userId);

    // 3. Migrate legacy localStorage items (one-time migration)
    await migrateLegacyLocalStorage(userId);
  } catch (err) {
    console.error('[authStore] syncAccountStorage error:', err);
  }
}

async function migrateLegacyLocalStorage(userId: string) {
  if (!userId) return;

  try {
    const configStore = useAccountConfigStore.getState();

    // ── 1. Pinned tools migration ──
    const legacyPinned = localStorage.getItem('yolnoma_pinned_tools');
    if (legacyPinned) {
      try {
        const parsed = JSON.parse(legacyPinned);
        if (Array.isArray(parsed) && parsed.length > 0) {
          if (!configStore.config.savedTools || configStore.config.savedTools.length === 0) {
            await configStore.updateConfig({ savedTools: parsed });
          }
        }
      } catch (e) {
        console.error('[migration] Failed to parse legacy pinned tools:', e);
      }
      localStorage.removeItem('yolnoma_pinned_tools');
    }

    // ── 2. System monitoring setting migration ──
    const legacyMonitoring = localStorage.getItem('yolnoma_system_monitoring_enabled');
    if (legacyMonitoring !== null) {
      const isEnabled = legacyMonitoring === 'true';
      await configStore.updateConfig({ systemMonitoring: isEnabled });
      localStorage.removeItem('yolnoma_system_monitoring_enabled');
    }

    // ── 3. OpenRouter API key migration ──
    const legacyKey =
      localStorage.getItem('yolnoma.openrouter.api-key') ||
      localStorage.getItem(`yolnoma.ai-chat.${encodeURIComponent(userId.trim().toLowerCase())}.api-key`) ||
      localStorage.getItem('yolnoma.ai-chat.guest.api-key');

    if (legacyKey && legacyKey.trim()) {
      const existingKey = await getApiKey(userId);
      if (!existingKey) {
        await saveApiKey(userId, legacyKey.trim());
      }
      localStorage.removeItem('yolnoma.openrouter.api-key');
      localStorage.removeItem(`yolnoma.ai-chat.${encodeURIComponent(userId.trim().toLowerCase())}.api-key`);
      localStorage.removeItem('yolnoma.ai-chat.guest.api-key');
    }
  } catch (err) {
    console.error('[migration] Migration error:', err);
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: Boolean(localStorage.getItem('yolnoma_access_token') && localStorage.getItem('yolnoma_user')),
  user: parseStoredUser(),
  loading: true,
  isInitialized: false,

  initAuth: async () => {
    const accessToken = localStorage.getItem('yolnoma_access_token');
    const refreshToken = localStorage.getItem('yolnoma_refresh_token');
    const cachedUser = parseStoredUser();

    if (cachedUser) {
      set({ user: cachedUser, isAuthenticated: true });
      void syncAccountStorage(cachedUser.id);
    }

    if (accessToken && refreshToken) {
      try {
        const res = await api.get<{ data?: { user?: RawUserResponse }; user?: RawUserResponse }>('/api/v2/auth/me');
        const rawUser = res?.data?.user || res?.user || (res as unknown as RawUserResponse);
        if (rawUser && (rawUser.id || rawUser._id)) {
          const displayName = rawUser.displayName || rawUser.display_name || rawUser.name || undefined;
          const avatarUrl = rawUser.avatarUrl || rawUser.avatar_url || rawUser.avatar || rawUser.picture || undefined;
          const thumbnailUrl = rawUser.thumbnailUrl || rawUser.thumbnail_url || undefined;
          const isPrivate = rawUser.isPrivate ?? rawUser.is_private ?? false;

          const formattedUser: UserProfile = {
            id: rawUser.id || rawUser._id || '',
            email: rawUser.email,
            role: rawUser.role || 'user',
            displayName,
            avatarUrl,
            thumbnailUrl,
            isPrivate,
            display_name: displayName,
            avatar_url: avatarUrl,
            thumbnail_url: thumbnailUrl,
            is_private: isPrivate,
          };

          set({ user: formattedUser, isAuthenticated: true });
          localStorage.setItem('yolnoma_user', JSON.stringify(formattedUser));
          void syncAccountStorage(formattedUser.id);
        }
      } catch (error) {
        reportError('auth.session-check', error);
        if (isUnauthorizedError(error)) {
          clearAuthSession();
          set({ isAuthenticated: false, user: null });
          useAccountConfigStore.getState().reset();
          void invoke('set_current_user', { userId: '' }).catch(() => {});
        }
      }
    } else if (!cachedUser) {
      set({ isAuthenticated: false, user: null });
    }

    set({ loading: false, isInitialized: true });
  },

  login: async (userData: UserProfile, accessToken: string, refreshToken: string, sessionId?: string) => {
    set({ user: userData, isAuthenticated: true });
    localStorage.setItem('yolnoma_access_token', accessToken);
    localStorage.setItem('yolnoma_refresh_token', refreshToken);
    if (sessionId) {
      localStorage.setItem('yolnoma_session_id', sessionId);
    }
    localStorage.setItem('yolnoma_user', JSON.stringify(userData));
    await syncAccountStorage(userData.id);
  },

  logout: async () => {
    try {
      await api.post('/api/v2/auth/sign-out', {}).catch(() => {});
    } catch {
      // Ignore network errors during sign-out
    }
    set({ user: null, isAuthenticated: false });
    clearAuthSession();
    useAccountConfigStore.getState().reset();
    void invoke('set_current_user', { userId: '' }).catch(() => {});
    toast.success('Signed out successfully.');
  },

  updateUser: (updates: Partial<UserProfile>) => {
    const currentUser = get().user;
    if (!currentUser) return;
    const updated = { ...currentUser, ...updates };
    set({ user: updated });
    localStorage.setItem('yolnoma_user', JSON.stringify(updated));
  },

  setUser: (user: UserProfile | null) => {
    set({ user, isAuthenticated: Boolean(user) });
    if (user) {
      localStorage.setItem('yolnoma_user', JSON.stringify(user));
      void syncAccountStorage(user.id);
    } else {
      localStorage.removeItem('yolnoma_user');
      useAccountConfigStore.getState().reset();
      void invoke('set_current_user', { userId: '' }).catch(() => {});
    }
  },
}));

