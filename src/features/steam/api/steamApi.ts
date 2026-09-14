import { invoke } from '@tauri-apps/api/core';

export interface SteamUser {
  steamId: string;
  personaName: string;
  mostRecent: boolean;
}

export interface SteamGame {
  appId: number;
  name: string;
  playtimeForever: number;
}

export interface SteamProfile {
  steamId: string;
  personaName: string;
  profileUrl?: string;
  avatar?: string;
  avatarMedium?: string;
  avatarFull?: string;
  personaState: number;
  realName?: string;
  countryCode?: string;
  timeCreated?: number;
  steamLevel?: number;
}

export interface AchievementData {
  achievements: Array<{
    id: string;
    name: string;
    description: string;
    iconNormal: string;
    iconLocked: string;
    achieved: boolean;
    percent?: number;
    hidden: boolean;
    protectedAchievement: boolean;
  }>;
  stats: Array<{
    id: string;
    name: string;
    statType: string;
    value: number | string;
    incrementOnly: boolean;
    protectedStat: boolean;
  }>;
}

export const STEAM_GAMES_CACHE_KEY = 'yolnoma_steam_games_cache';
export const STEAM_GAMES_CACHE_TTL = 5 * 60 * 1000;

interface SteamGamesCache {
  steamId: string;
  games: SteamGame[];
  timestamp: number;
}

export function readSteamGamesCache(steamId: string): { games: SteamGame[]; age: number } | null {
  try {
    const raw = localStorage.getItem(STEAM_GAMES_CACHE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw) as Partial<SteamGamesCache>;
    if (cache.steamId !== steamId || !Array.isArray(cache.games) || typeof cache.timestamp !== 'number') return null;
    return { games: cache.games, age: Math.max(0, Date.now() - cache.timestamp) };
  } catch {
    return null;
  }
}

export function writeSteamGamesCache(steamId: string, games: SteamGame[]) {
  try {
    localStorage.setItem(STEAM_GAMES_CACHE_KEY, JSON.stringify({ steamId, games, timestamp: Date.now() } satisfies SteamGamesCache));
  } catch {
    // Cache is an optimization; storage failures must not block Steam actions.
  }
}

export const steamApi = {
  isRunning: () => invoke<boolean>('steam_is_running'),
  getAccounts: () => invoke<SteamUser[]>('get_steam_accounts'),
  getProfile: (steamId: string) => invoke<SteamProfile>('get_steam_profile', { steamId }),
  getGames: (steamId: string) => invoke<SteamGame[]>('get_steam_games', { steamId }),
  getIdleState: () => invoke<number[]>('get_idle_state'),
  startIdling: (targets: SteamGame[]) => invoke<{ running: number[]; failed: number[] }>('start_idling', { targets }),
  stopIdling: (appId: number) => invoke('stop_idling', { appId }),
  stopAllIdling: () => invoke('stop_all_idling'),
  getAchievementData: (appId: number) => invoke<AchievementData>('get_achievement_data', { appId }),
  unlockAllAchievements: (appId: number) => invoke('unlock_all_achievements', { appId }),
  lockAllAchievements: (appId: number) => invoke('lock_all_achievements', { appId }),
  setAchievement: (appId: number, achId: string, unlock: boolean) => invoke('set_achievement', { appId, achId, unlock }),
  updateStats: (appId: number, statsJson: string) => invoke('update_stats', { appId, statsJson }),
  resetAllStats: (appId: number) => invoke('reset_all_stats', { appId }),
};

export async function setAchievementsBounded(
  appId: number,
  achievementIds: string[],
  unlock: boolean,
  concurrency = 6,
): Promise<{ successCount: number; failedCount: number }> {
  let nextIndex = 0;
  let successCount = 0;
  let failedCount = 0;
  const workerCount = Math.min(Math.max(1, concurrency), achievementIds.length);

  const worker = async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= achievementIds.length) return;
      try {
        await steamApi.setAchievement(appId, achievementIds[index], unlock);
        successCount += 1;
      } catch {
        failedCount += 1;
      }
    }
  };

  await Promise.all(Array.from({ length: workerCount }, worker));
  return { successCount, failedCount };
}
