/**
 * accountConfigStore — account-specific configuration backed by
 * AppData\Local\Yolnoma\accounts\{userId}\config.json via Tauri.
 *
 * Shape:  { systemMonitoring: boolean; savedTools: string[] }
 *
 * Usage:
 *   const { config, updateConfig } = useAccountConfigStore();
 */

import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

// ── Types ────────────────────────────────────────────────────────────────────

export interface AccountConfig {
  /** Whether real-time system monitoring is enabled on the Dashboard. */
  systemMonitoring: boolean;
  /** Tool IDs pinned (★ favourite) on the Dashboard. */
  savedTools: string[];
  /** Last user-approved geolocation used by the Dashboard weather widget. */
  weatherLocation?: {
    latitude: number;
    longitude: number;
    label: string;
  };
}

const DEFAULT_CONFIG: AccountConfig = {
  systemMonitoring: false,
  savedTools: [],
  weatherLocation: undefined,
};

interface AccountConfigState {
  config: AccountConfig;
  userId: string | null;
  loading: boolean;

  /** Load config.json for the given user from disk (called on login/initAuth). */
  loadConfig: (userId: string) => Promise<void>;

  /** Partially update the in-memory config and persist to disk immediately. */
  updateConfig: (updates: Partial<AccountConfig>) => Promise<void>;

  /** Reset to defaults when the user logs out. */
  reset: () => void;
}

// ── Store ────────────────────────────────────────────────────────────────────

export const useAccountConfigStore = create<AccountConfigState>((set, get) => ({
  config: DEFAULT_CONFIG,
  userId: null,
  loading: false,

  loadConfig: async (userId: string) => {
    set({ loading: true, userId });
    try {
      const config = await invoke<AccountConfig>('get_account_config', { userId });
      set({ config, loading: false });
    } catch (err) {
      console.error('[accountConfigStore] Failed to load config:', err);
      set({ config: DEFAULT_CONFIG, loading: false });
    }
  },

  updateConfig: async (updates: Partial<AccountConfig>) => {
    const { config, userId } = get();
    const next: AccountConfig = { ...config, ...updates };
    // Optimistic update
    set({ config: next });
    if (!userId) return;
    try {
      await invoke('save_account_config', { userId, config: next });
    } catch (err) {
      console.error('[accountConfigStore] Failed to save config:', err);
    }
  },

  reset: () => {
    set({ config: DEFAULT_CONFIG, userId: null, loading: false });
  },
}));
