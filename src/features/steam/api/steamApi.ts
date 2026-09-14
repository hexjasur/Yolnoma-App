import { invoke } from '@tauri-apps/api/core';

export interface SteamUser { steamId: string; personaName: string; mostRecent: boolean; }
export interface SteamGame { appId: number; name: string; playtimeForever: number; }
export interface SteamProfile { steamId: string; personaName: string; profileUrl?: string; avatar?: string; avatarMedium?: string; avatarFull?: string; personaState: number; realName?: string; countryCode?: string; timeCreated?: number; steamLevel?: number; }
export interface AchievementData {
  achievements: Array<{ id: string; name: string; description: string; iconNormal: string; iconLocked: string; achieved: boolean; percent?: number; hidden: boolean; protectedAchievement: boolean }>;
  stats: Array<{ id: string; name: string; statType: string; value: number | string; incrementOnly: boolean; protectedStat: boolean }>;
}

export const STEAM_GAMES_CACHE_KEY = 'yolnoma_steam_games_cache';
export const STEAM_GAMES_CACHE_TTL = 5 * 60 * 1000;
export const STEAM_GAMES_CACHE_DB_NAME = 'yolnoma-steam-cache';
export const STEAM_GAMES_CACHE_DB_VERSION = 1;
export const STEAM_GAMES_CACHE_STORE = 'games';
interface SteamGamesCache { steamId: string; games: SteamGame[]; timestamp: number; }

const inFlightGameRequests = new Map<string, Promise<SteamGame[]>>();
function normalizeGames(value: unknown): SteamGame[] | null {
  if (!Array.isArray(value)) return null;
  const games: SteamGame[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    const appId = Number(record.appId);
    const name = typeof record.name === 'string' ? record.name.trim() : '';
    const playtime = Number(record.playtimeForever);
    if (!Number.isSafeInteger(appId) || appId < 0 || !name) continue;
    games.push({ appId, name, playtimeForever: Number.isFinite(playtime) && playtime >= 0 ? Math.floor(playtime) : 0 });
  }
  return games.sort((a, b) => b.playtimeForever - a.playtimeForever);
}
function parseCache(value: unknown, steamId: string): SteamGamesCache | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Partial<SteamGamesCache>;
  if (record.steamId !== steamId || typeof record.timestamp !== 'number' || !Number.isFinite(record.timestamp)) return null;
  const games = normalizeGames(record.games);
  return games ? { steamId, games, timestamp: record.timestamp } : null;
}
function openCacheDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB unavailable'));
    const request = indexedDB.open(STEAM_GAMES_CACHE_DB_NAME, STEAM_GAMES_CACHE_DB_VERSION);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STEAM_GAMES_CACHE_STORE)) request.result.createObjectStore(STEAM_GAMES_CACHE_STORE, { keyPath: 'steamId' }); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Unable to open cache database'));
  });
}
function readIndexedDb(steamId: string): Promise<SteamGamesCache | null> {
  return openCacheDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STEAM_GAMES_CACHE_STORE, 'readonly');
    const request = tx.objectStore(STEAM_GAMES_CACHE_STORE).get(steamId);
    request.onsuccess = () => resolve(parseCache(request.result, steamId));
    request.onerror = () => reject(request.error ?? new Error('Unable to read cache'));
    tx.oncomplete = () => db.close();
    tx.onerror = () => { db.close(); reject(tx.error ?? new Error('Cache transaction failed')); };
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error('Cache transaction aborted')); };
  }));
}
function writeIndexedDb(cache: SteamGamesCache): Promise<void> {
  return openCacheDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STEAM_GAMES_CACHE_STORE, 'readwrite');
    tx.objectStore(STEAM_GAMES_CACHE_STORE).put(cache);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error ?? new Error('Cache transaction failed')); };
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error('Cache transaction aborted')); };
  }));
}
function readLegacyCache(steamId: string): SteamGamesCache | null {
  try { const raw = localStorage.getItem(STEAM_GAMES_CACHE_KEY); return raw ? parseCache(JSON.parse(raw), steamId) : null; } catch { return null; }
}
export async function readSteamGamesCache(steamId: string): Promise<{ games: SteamGame[]; age: number } | null> {
  try { const indexed = await readIndexedDb(steamId); if (indexed) return { games: indexed.games, age: Math.max(0, Date.now() - indexed.timestamp) }; } catch { /* fallback below */ }
  const legacy = readLegacyCache(steamId);
  if (!legacy) return null;
  try { await writeIndexedDb(legacy); localStorage.removeItem(STEAM_GAMES_CACHE_KEY); } catch { /* legacy fallback remains usable */ }
  return { games: legacy.games, age: Math.max(0, Date.now() - legacy.timestamp) };
}
export async function writeSteamGamesCache(steamId: string, games: SteamGame[]): Promise<void> {
  const cache: SteamGamesCache = { steamId, games: normalizeGames(games) ?? [], timestamp: Date.now() };
  try { await writeIndexedDb(cache); } catch { try { localStorage.setItem(STEAM_GAMES_CACHE_KEY, JSON.stringify(cache)); } catch { /* optimization only */ } }
}
async function fetchGamesSingleFlight(steamId: string): Promise<SteamGame[]> {
  const existing = inFlightGameRequests.get(steamId); if (existing) return existing;
  const request = invoke<SteamGame[]>('get_steam_games', { steamId }).then((games) => normalizeGames(games) ?? []).finally(() => inFlightGameRequests.delete(steamId));
  inFlightGameRequests.set(steamId, request); return request;
}
export const steamApi = {
  isRunning: () => invoke<boolean>('steam_is_running'), getAccounts: () => invoke<SteamUser[]>('get_steam_accounts'), getProfile: (steamId: string) => invoke<SteamProfile>('get_steam_profile', { steamId }), getGames: (steamId: string) => fetchGamesSingleFlight(steamId), getIdleState: () => invoke<number[]>('get_idle_state'), startIdling: (targets: SteamGame[]) => invoke<{ running: number[]; failed: number[] }>('start_idling', { targets }), stopIdling: (appId: number) => invoke('stop_idling', { appId }), stopAllIdling: () => invoke('stop_all_idling'), getAchievementData: (appId: number) => invoke<AchievementData>('get_achievement_data', { appId }), unlockAllAchievements: (appId: number) => invoke('unlock_all_achievements', { appId }), lockAllAchievements: (appId: number) => invoke('lock_all_achievements', { appId }), setAchievement: (appId: number, achId: string, unlock: boolean) => invoke('set_achievement', { appId, achId, unlock }), updateStats: (appId: number, statsJson: string) => invoke('update_stats', { appId, statsJson }), resetAllStats: (appId: number) => invoke('reset_all_stats', { appId }),
};
export interface AchievementProgress { processed: number; successCount: number; failedCount: number; }
export async function setAchievementsBounded(appId: number, achievementIds: string[], unlock: boolean, concurrency = 6, onProgress?: (progress: AchievementProgress) => void): Promise<{ successCount: number; failedCount: number; failedIds: string[] }> {
  let nextIndex = 0; let successCount = 0; let failedCount = 0; const failedIds: string[] = [];
  const workerCount = Math.min(Math.max(1, concurrency), achievementIds.length);
  const report = () => onProgress?.({ processed: successCount + failedCount, successCount, failedCount });
  const worker = async () => { while (true) { const index = nextIndex++; if (index >= achievementIds.length) return; const id = achievementIds[index]; try { await steamApi.setAchievement(appId, id, unlock); successCount += 1; } catch { failedCount += 1; failedIds.push(id); } report(); } };
  if (workerCount > 0) await Promise.all(Array.from({ length: workerCount }, worker));
  return { successCount, failedCount, failedIds };
}
