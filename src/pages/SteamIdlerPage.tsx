import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Gamepad2, Play, Square, StopCircle, RefreshCw,
  AlertTriangle, Wifi, WifiOff, Users, Star, Clock,
  ChevronRight, Loader2,
} from 'lucide-react';

// ────────────────────────────────────────────────────────────────────────────
// TYPES & INTERFACES — Data shapes
// ────────────────────────────────────────────────────────────────────────────

interface SteamUser {
  steamId: string;
  personaName: string;
  mostRecent: boolean;
}

interface SteamGame {
  appId: number;
  name: string;
  playtimeForever: number;
}

interface IdleResult {
  running: number[];
  failed: number[];
}

interface GamesCache {
  steamId: string;
  games: SteamGame[];
  timestamp: number;
}

// ────────────────────────────────────────────────────────────────────────────
// CACHE LAYER — LocalStorage management for game lists
// ────────────────────────────────────────────────────────────────────────────

const CACHE_KEY = 'yolnoma_steam_games_cache';
const FAVORITES_KEY = 'yolnoma_steam_favorites';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes before stale

function getCachedGames(steamId: string): { games: SteamGame[]; age: number } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cache: GamesCache = JSON.parse(raw);
    if (cache.steamId !== steamId) return null;
    return { games: cache.games, age: Date.now() - cache.timestamp };
  } catch {
    return null;
  }
}

function setCachedGames(steamId: string, games: SteamGame[]) {
  const cache: GamesCache = { steamId, games, timestamp: Date.now() };
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

function getFavorites(): Set<number> {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as number[]);
  } catch {
    return new Set();
  }
}

function saveFavorites(ids: Set<number>) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...ids]));
}

// ────────────────────────────────────────────────────────────────────────────
// FORMATTERS — Display helpers
// ────────────────────────────────────────────────────────────────────────────

function formatPlaytime(minutes: number): string {
  if (minutes === 0) return '—';
  if (minutes < 60) return `${minutes}d`;
  const h = Math.floor(minutes / 60);
  return `${h}h`;
}

function formatElapsed(startMs: number): string {
  const elapsed = Math.floor((Date.now() - startMs) / 1000);
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ────────────────────────────────────────────────────────────────────────────
// GAME CARD COMPONENT — Beautiful game tile with idling state
// ────────────────────────────────────────────────────────────────────────────

interface GameCardProps {
  game: SteamGame;
  isIdling: boolean;
  isFavorite: boolean;
  idleStartTime?: number;
  tick: number;
  onToggleFavorite: (id: number) => void;
  onStop: (id: number) => void;
}

function GameCard({
  game,
  isIdling,
  isFavorite,
  idleStartTime,
  tick,
  onToggleFavorite,
  onStop,
}: GameCardProps) {
  const [imgError, setImgError] = useState(false);
  void tick; // Suppress linter warning — used for re-render trigger

  return (
    <div
      style={{
        background: isIdling
          ? 'linear-gradient(135deg, rgba(34,197,94,0.06) 0%, #1B1713 100%)'
          : '#1B1713',
        border: `1px solid ${
          isIdling
            ? 'rgba(34,197,94,0.25)'
            : isFavorite
            ? 'rgba(217,119,87,0.3)'
            : 'rgba(242,237,230,0.08)'
        }`,
        borderRadius: 14,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        transition: 'all 0.2s ease',
        position: 'relative',
        boxShadow: isIdling ? '0 4px 16px rgba(34,197,94,0.1)' : 'none',
        cursor: 'default',
      }}
    >
      {/* ── Idling Badge with Timer ── */}
      {isIdling && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            zIndex: 2,
            background: 'rgba(34,197,94,0.12)',
            border: '1px solid rgba(34,197,94,0.3)',
            borderRadius: 12,
            padding: '6px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            backdropFilter: 'blur(8px)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#4ade80',
                display: 'inline-block',
                animation: 'idlePulse 1.5s infinite',
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#4ade80',
                fontFamily: '"Inter", sans-serif',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Idling
            </span>
          </div>
          {idleStartTime && (
            <span
              style={{
                fontSize: 10,
                color: 'rgba(74,222,128,0.8)',
                fontFamily: '"JetBrains Mono", monospace',
                letterSpacing: '0.05em',
                paddingLeft: 11,
              }}
            >
              {formatElapsed(idleStartTime)}
            </span>
          )}
        </div>
      )}

      {/* ── Favorite Toggle Button ── */}
      <button
        onClick={() => onToggleFavorite(game.appId)}
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          zIndex: 2,
          background: isFavorite ? 'rgba(217,119,87,0.2)' : 'rgba(0,0,0,0.35)',
          border: `1px solid ${
            isFavorite ? 'rgba(217,119,87,0.4)' : 'rgba(255,255,255,0.1)'
          }`,
          borderRadius: 8,
          width: 34,
          height: 34,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          backdropFilter: 'blur(8px)',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.18)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
        }}
        title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      >
        <Star
          size={15}
          fill={isFavorite ? '#D97757' : 'none'}
          color={isFavorite ? '#D97757' : 'rgba(242,237,230,0.45)'}
        />
      </button>

      {/* ── Game Cover Image ── */}
      <div
        style={{
          height: 100,
          background: 'linear-gradient(135deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.2) 100%)',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {!imgError ? (
          <img
            src={`https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appId}/header.jpg`}
            alt={game.name}
            onError={() => setImgError(true)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transition: 'transform 0.3s ease',
            }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'radial-gradient(circle, rgba(217,119,87,0.08) 0%, transparent 100%)',
            }}
          >
            <Gamepad2 size={32} color="rgba(217,119,87,0.25)" />
          </div>
        )}
      </div>

      {/* ── Game Info Section ── */}
      <div
        style={{
          padding: '12px 14px',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 600,
            color: '#F2EDE6',
            fontFamily: '"Inter", sans-serif',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            lineHeight: 1.4,
          }}
        >
          {game.name}
        </p>

        {/* ── Playtime + App ID ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 11,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={10} color="rgba(242,237,230,0.35)" />
            <span
              style={{
                color: 'rgba(242,237,230,0.4)',
                fontFamily: '"Inter", sans-serif',
              }}
            >
              {formatPlaytime(game.playtimeForever)}
            </span>
          </div>
          <span
            style={{
              color: 'rgba(242,237,230,0.2)',
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 10,
              letterSpacing: '0.02em',
            }}
          >
            #{game.appId}
          </span>
        </div>

        {/* ── Stop Button (visible when idling) ── */}
        {isIdling && (
          <button
            onClick={() => onStop(game.appId)}
            style={{
              marginTop: 6,
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 8,
              padding: '6px 10px',
              color: '#f87171',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              fontFamily: '"Inter", sans-serif',
              transition: 'all 0.15s ease',
              width: '100%',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                'rgba(239,68,68,0.15)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                'rgba(239,68,68,0.08)';
            }}
          >
            <Square size={11} fill="#f87171" />
            Stop
          </button>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// MAIN PAGE COMPONENT — Full application state & UI
// ────────────────────────────────────────────────────────────────────────────

type Tab = 'all' | 'favorites';

export default function SteamIdlerPage() {
  // ── UI State
  const [steamRunning, setSteamRunning] = useState<boolean | null>(null);
  const [accounts, setAccounts] = useState<SteamUser[]>([]);
  const [selectedSteamId, setSelectedSteamId] = useState('');
  const [games, setGames] = useState<SteamGame[]>([]);
  const [idlingIds, setIdlingIds] = useState<Set<number>>(new Set());
  const [favorites, setFavorites] = useState<Set<number>>(getFavorites);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [error, setError] = useState<string | null>(null);

  // ── Loading States
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // ── Cache & Cooldown
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [cacheAge, setCacheAge] = useState<number | null>(null);
  const [canRefresh, setCanRefresh] = useState(false);

  // ── Timers (for UI updates)
  const [tick, setTick] = useState(0);
  const idleStartTimesRef = useRef<Map<number, number>>(new Map());

  // ────────────────────────────────────────────────────────────────────────
  // EFFECT: Render ticker (updates every 1s for elapsed time display)
  // ────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // ────────────────────────────────────────────────────────────────────────
  // EFFECT: Polling Steam status & idling state (3s interval)
  // ────────────────────────────────────────────────────────────────────────
  const checkSteam = useCallback(async () => {
    try {
      const running = await invoke<boolean>('steam_is_running');
      setSteamRunning(running);
    } catch {
      setSteamRunning(false);
    }
  }, []);

  const refreshIdleState = useCallback(async () => {
    try {
      const ids = await invoke<number[]>('get_idle_state');
      const idSet = new Set(ids);
      const now = Date.now();

      // Track start times for newly idling games
      ids.forEach((id) => {
        if (!idleStartTimesRef.current.has(id)) {
          idleStartTimesRef.current.set(id, now);
        }
      });

      // Clean up games that stopped idling
      for (const id of idleStartTimesRef.current.keys()) {
        if (!idSet.has(id)) {
          idleStartTimesRef.current.delete(id);
        }
      }

      setIdlingIds(idSet);
    } catch {
      /* Silently fail on polling error */
    }
  }, []);

  useEffect(() => {
    checkSteam();
    refreshIdleState();
    const interval = setInterval(() => {
      checkSteam();
      refreshIdleState();
    }, 3000);
    return () => clearInterval(interval);
  }, [checkSteam, refreshIdleState]);

  // ────────────────────────────────────────────────────────────────────────
  // EFFECT: Cache refresh cooldown (5 minutes between API calls)
  // ────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setCanRefresh(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [secondsLeft]);

  // ────────────────────────────────────────────────────────────────────────
  // EFFECT: Load Steam accounts on mount
  // ────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setAccountsLoading(true);
      try {
        const users = await invoke<SteamUser[]>('get_steam_accounts');
        setAccounts(users);
        const recent = users.find((u) => u.mostRecent) ?? users[0];
        if (recent) setSelectedSteamId(recent.steamId);
      } catch (e: unknown) {
        setError(String(e));
      } finally {
        setAccountsLoading(false);
      }
    })();
  }, []);

  // ────────────────────────────────────────────────────────────────────────
  // HANDLER: Load games (from cache or API)
  // ────────────────────────────────────────────────────────────────────────
  const loadGames = useCallback(
    async (forceRefresh = false) => {
      if (!selectedSteamId) return;

      // Try cache first (if not forcing refresh)
      if (!forceRefresh) {
        const cached = getCachedGames(selectedSteamId);
        if (cached) {
          setGames(cached.games);
          setCacheAge(cached.age);

          const ageMs = cached.age;
          if (ageMs < CACHE_TTL) {
            setCanRefresh(false);
            setSecondsLeft(Math.ceil((CACHE_TTL - ageMs) / 1000));
          } else {
            setCanRefresh(true);
            setSecondsLeft(0);
          }
          return;
        }
      }

      // Fetch from backend
      setGamesLoading(true);
      setError(null);
      setCanRefresh(false);
      try {
        const list = await invoke<SteamGame[]>('get_steam_games', {
          steamId: selectedSteamId,
        });
        list.sort((a, b) => b.playtimeForever - a.playtimeForever);
        setGames(list);
        setCacheAge(0);
        setCachedGames(selectedSteamId, list);
        setSecondsLeft(300); // 5 min cooldown
      } catch (e: unknown) {
        setError(String(e));
        setCanRefresh(true);
      } finally {
        setGamesLoading(false);
      }
    },
    [selectedSteamId]
  );

  useEffect(() => {
    if (selectedSteamId) loadGames(false);
  }, [selectedSteamId, loadGames]);

  // ────────────────────────────────────────────────────────────────────────
  // HANDLER: Toggle favorite status
  // ────────────────────────────────────────────────────────────────────────
  const toggleFavorite = (id: number) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      saveFavorites(next);
      return next;
    });
  };

  // ────────────────────────────────────────────────────────────────────────
  // HANDLER: Start idling all favorited games
  // ────────────────────────────────────────────────────────────────────────
  const startIdling = async () => {
    const targets = games.filter((g) => favorites.has(g.appId));
    if (targets.length === 0) return;

    setActionLoading(true);
    setError(null);
    try {
      const result = await invoke<IdleResult>('start_idling', { targets });
      setIdlingIds(new Set(result.running));
      await refreshIdleState();
      if (result.failed.length > 0) {
        setError(
          `${result.failed.length} games failed to start idling. Is Steam running?`
        );
      }
    } catch (e: unknown) {
      setError(String(e));
    } finally {
      setActionLoading(false);
    }
  };

  // ────────────────────────────────────────────────────────────────────────
  // HANDLER: Stop idling a single game
  // ────────────────────────────────────────────────────────────────────────
  const stopOne = async (appId: number) => {
    try {
      await invoke('stop_idling', { appId });
      await refreshIdleState();
      setIdlingIds((prev) => {
        const n = new Set(prev);
        n.delete(appId);
        return n;
      });
    } catch (e: unknown) {
      setError(String(e));
    }
  };

  // ────────────────────────────────────────────────────────────────────────
  // HANDLER: Stop all idling
  // ────────────────────────────────────────────────────────────────────────
  const stopAll = async () => {
    try {
      await invoke('stop_all_idling');
      await refreshIdleState();
      setIdlingIds(new Set());
    } catch (e: unknown) {
      setError(String(e));
    }
  };

  // ────────────────────────────────────────────────────────────────────────
  // COMPUTED: Filtered game list based on tab & search
  // ────────────────────────────────────────────────────────────────────────
  const filteredGames = games.filter((g) => {
    const matchSearch = g.name.toLowerCase().includes(search.toLowerCase());
    if (tab === 'favorites') return matchSearch && favorites.has(g.appId);
    return matchSearch;
  });

  const cacheAgeMin = cacheAge !== null ? Math.floor(cacheAge / 60000) : null;

  // ════════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════════
  return (
    <div
      style={{
        fontFamily: '"Inter", sans-serif',
        color: '#F2EDE6',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
      }}
    >
      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* HEADER */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <div style={{ marginBottom: 24 }}>
        <p
          style={{
            fontSize: 11,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: '#D97757',
            fontWeight: 700,
            marginBottom: 8,
          }}
        >
          Tools
        </p>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h1
            style={{
              fontFamily: '"Georgia", serif',
              fontSize: 36,
              fontWeight: 500,
              margin: 0,
              letterSpacing: '-0.02em',
            }}
          >
            Steam Idler
          </h1>

          {/* Steam Status Badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              background: steamRunning
                ? 'rgba(34,197,94,0.08)'
                : 'rgba(239,68,68,0.08)',
              border: `1px solid ${
                steamRunning
                  ? 'rgba(34,197,94,0.2)'
                  : 'rgba(239,68,68,0.2)'
              }`,
              borderRadius: 24,
              fontSize: 13,
              fontWeight: 500,
              color: steamRunning ? '#4ade80' : '#f87171',
              backdropFilter: 'blur(8px)',
            }}
          >
            {steamRunning ? (
              <>
                <Wifi size={13} />
                Steam Running
              </>
            ) : (
              <>
                <WifiOff size={13} />
                Steam Offline
              </>
            )}
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ERROR BANNER */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            background: 'rgba(239,68,68,0.07)',
            border: '1px solid rgba(239,68,68,0.18)',
            borderRadius: 12,
            padding: '12px 16px',
            marginBottom: 16,
            fontSize: 13,
            color: '#f87171',
            backdropFilter: 'blur(8px)',
          }}
        >
          <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ flex: 1 }}>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{
              background: 'none',
              border: 'none',
              color: '#f87171',
              cursor: 'pointer',
              fontSize: 15,
              padding: 0,
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ACCOUNT SELECTOR & REFRESH CONTROLS */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <div
        style={{
          background: '#181410',
          border: '1px solid rgba(242,237,230,0.08)',
          borderRadius: 14,
          padding: '16px 20px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          flexWrap: 'wrap',
        }}
      >
        <Users size={17} color="#D97757" style={{ flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 160 }}>
          <p
            style={{
              margin: '0 0 6px',
              fontSize: 10,
              color: 'rgba(242,237,230,0.3)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              fontWeight: 600,
            }}
          >
            Steam Account
          </p>
          {accountsLoading ? (
            <p style={{ margin: 0, fontSize: 13, color: 'rgba(242,237,230,0.4)' }}>
              Loading...
            </p>
          ) : accounts.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: 'rgba(242,237,230,0.4)' }}>
              No accounts found
            </p>
          ) : (
            <select
              value={selectedSteamId}
              onChange={(e) => setSelectedSteamId(e.target.value)}
              style={{
                background: '#1B1713',
                border: '1px solid rgba(242,237,230,0.1)',
                borderRadius: 8,
                padding: '8px 10px',
                color: '#F2EDE6',
                fontSize: 13,
                cursor: 'pointer',
                outline: 'none',
                fontFamily: '"Inter", sans-serif',
              }}
            >
              {accounts.map((u) => (
                <option key={u.steamId} value={u.steamId}>
                  {u.personaName} {u.mostRecent ? '✓' : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Cache Status Info */}
        {cacheAgeMin !== null && games.length > 0 && (
          <div
            style={{
              fontSize: 12,
              color: 'rgba(242,237,230,0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Clock size={12} />
            {cacheAgeMin === 0
              ? 'Just updated'
              : `Updated ${cacheAgeMin} min ago`}
            {secondsLeft > 0 && (
              <span
                style={{
                  background: 'rgba(217,119,87,0.06)',
                  border: '1px solid rgba(217,119,87,0.15)',
                  borderRadius: 20,
                  padding: '2px 10px',
                  color: 'rgba(217,119,87,0.6)',
                  fontSize: 11,
                }}
              >
                Cooldown ({Math.floor(secondsLeft / 60)}:
                {(secondsLeft % 60) < 10 ? '0' : ''}
                {secondsLeft % 60})
              </span>
            )}
            {canRefresh && secondsLeft === 0 && (
              <span
                style={{
                  background: 'rgba(217,119,87,0.12)',
                  border: '1px solid rgba(217,119,87,0.25)',
                  borderRadius: 20,
                  padding: '2px 10px',
                  color: '#D97757',
                  fontSize: 11,
                  animation: 'refreshPulse 2s ease-in-out infinite',
                }}
              >
                Ready to refresh
              </span>
            )}
          </div>
        )}

        {/* Refresh Button */}
        <button
          onClick={() => loadGames(true)}
          disabled={
            gamesLoading || !selectedSteamId || secondsLeft > 0
          }
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            background:
              canRefresh && secondsLeft === 0
                ? 'rgba(217,119,87,0.12)'
                : 'rgba(242,237,230,0.04)',
            border: `1px solid ${
              canRefresh && secondsLeft === 0
                ? 'rgba(217,119,87,0.3)'
                : 'rgba(242,237,230,0.1)'
            }`,
            borderRadius: 10,
            padding: '8px 16px',
            color:
              canRefresh && secondsLeft === 0
                ? '#D97757'
                : 'rgba(242,237,230,0.4)',
            fontSize: 13,
            fontWeight: 500,
            cursor:
              gamesLoading || !selectedSteamId || secondsLeft > 0
                ? 'not-allowed'
                : 'pointer',
            opacity:
              gamesLoading || !selectedSteamId || secondsLeft > 0 ? 0.5 : 1,
            transition: 'all 0.15s ease',
          }}
        >
          {gamesLoading ? (
            <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
          ) : (
            <RefreshCw size={14} />
          )}
          {gamesLoading
            ? 'Loading...'
            : secondsLeft > 0
            ? `Locked (${Math.floor(secondsLeft / 60)}:${(secondsLeft % 60) < 10 ? '0' : ''}${secondsLeft % 60})`
            : 'Refresh'}
        </button>
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* TABS & CONTROLS */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          borderBottom: '1px solid rgba(242,237,230,0.08)',
          marginBottom: 16,
          alignItems: 'center',
        }}
      >
        {(
          [
            { key: 'all', label: 'All Games', count: games.length },
            { key: 'favorites', label: 'Favorites & Idling', count: favorites.size },
          ] as const
        ).map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              padding: '10px 16px',
              background: 'none',
              border: 'none',
              borderBottom: `2px solid ${
                tab === key ? '#D97757' : 'transparent'
              }`,
              color: tab === key ? '#F2EDE6' : 'rgba(242,237,230,0.4)',
              fontFamily: '"Inter", sans-serif',
              fontSize: 13,
              fontWeight: tab === key ? 600 : 400,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.15s ease',
              marginBottom: -1,
            }}
          >
            {key === 'favorites' && (
              <Star
                size={13}
                fill={favorites.size > 0 ? '#D97757' : 'none'}
                color="#D97757"
              />
            )}
            {label}
            {count > 0 && (
              <span
                style={{
                  background:
                    tab === key
                      ? 'rgba(217,119,87,0.15)'
                      : 'rgba(242,237,230,0.07)',
                  border: `1px solid ${
                    tab === key
                      ? 'rgba(217,119,87,0.25)'
                      : 'rgba(242,237,230,0.1)'
                  }`,
                  borderRadius: 20,
                  padding: '2px 10px',
                  fontSize: 11,
                  color: tab === key ? '#D97757' : 'rgba(242,237,230,0.4)',
                  fontWeight: 500,
                }}
              >
                {count}
              </span>
            )}
          </button>
        ))}

        {/* Active Idle Status (Right side) */}
        {idlingIds.size > 0 && (
          <div
            style={{
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              paddingBottom: 8,
            }}
          >
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 12,
                color: '#4ade80',
                background: 'rgba(34,197,94,0.08)',
                border: '1px solid rgba(34,197,94,0.2)',
                borderRadius: 20,
                padding: '4px 12px',
                fontWeight: 500,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#4ade80',
                  animation: 'idlePulse 1.5s infinite',
                  display: 'inline-block',
                }}
              />
              {idlingIds.size} idling
            </span>
            <button
              onClick={stopAll}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                background: 'rgba(239,68,68,0.07)',
                border: '1px solid rgba(239,68,68,0.18)',
                borderRadius: 20,
                padding: '4px 12px',
                color: '#f87171',
                fontSize: 12,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                fontWeight: 500,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  'rgba(239,68,68,0.15)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  'rgba(239,68,68,0.07)';
              }}
            >
              <StopCircle size={12} />
              Stop All
            </button>
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* FAVORITES TAB — IDLING CONTROL PANEL */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {tab === 'favorites' && (
        <div
          style={{
            background: '#181410',
            border: '1px solid rgba(242,237,230,0.08)',
            borderRadius: 14,
            padding: '16px 20px',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: 1 }}>
            <p
              style={{
                margin: '0 0 4px',
                fontSize: 13,
                fontWeight: 700,
                color: '#F2EDE6',
              }}
            >
              Idling Control
            </p>
            <p
              style={{
                margin: 0,
                fontSize: 12,
                color: 'rgba(242,237,230,0.4)',
              }}
            >
              {favorites.size === 0
                ? 'Add games to favorites (⭐) to start idling'
                : `${favorites.size} game(s) selected — all will idle`}
            </p>
          </div>

          {/* Start Idle Button */}
          <button
            onClick={startIdling}
            disabled={favorites.size === 0 || !steamRunning || actionLoading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background:
                favorites.size > 0 && steamRunning && !actionLoading
                  ? '#D97757'
                  : 'rgba(242,237,230,0.05)',
              border: `1px solid ${
                favorites.size > 0 && steamRunning && !actionLoading
                  ? '#D97757'
                  : 'rgba(242,237,230,0.1)'
              }`,
              borderRadius: 12,
              padding: '10px 20px',
              color:
                favorites.size > 0 && steamRunning && !actionLoading
                  ? '#fff'
                  : 'rgba(242,237,230,0.3)',
              fontSize: 13,
              fontWeight: 600,
              cursor:
                favorites.size > 0 && steamRunning && !actionLoading
                  ? 'pointer'
                  : 'not-allowed',
              transition: 'all 0.15s ease',
              opacity: actionLoading ? 0.7 : 1,
            }}
            onMouseEnter={(e) => {
              if (
                favorites.size > 0 &&
                steamRunning &&
                !actionLoading
              ) {
                (e.currentTarget as HTMLButtonElement).style.transform =
                  'translateY(-2px)';
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform =
                'translateY(0)';
            }}
          >
            {actionLoading ? (
              <Loader2
                size={15}
                style={{ animation: 'spin 1s linear infinite' }}
              />
            ) : (
              <Play
                size={15}
                fill={
                  favorites.size > 0 && steamRunning ? '#fff' : 'transparent'
                }
              />
            )}
            {idlingIds.size > 0 ? 'Restart Idling' : 'Start Idling'}
          </button>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* SEARCH BAR */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {games.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <input
            type="text"
            placeholder="Search game titles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              background: '#181410',
              border: '1px solid rgba(242,237,230,0.08)',
              borderRadius: 10,
              padding: '10px 16px',
              color: '#F2EDE6',
              fontSize: 13,
              fontFamily: '"Inter", sans-serif',
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'border-color 0.15s ease',
            }}
            onFocus={(e) => {
              (e.currentTarget as HTMLInputElement).style.borderColor =
                'rgba(217,119,87,0.25)';
            }}
            onBlur={(e) => {
              (e.currentTarget as HTMLInputElement).style.borderColor =
                'rgba(242,237,230,0.08)';
            }}
          />
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* GAMES GRID */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {gamesLoading ? (
          // Skeleton Loader
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: 12,
            }}
          >
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                style={{
                  background: '#1B1713',
                  border: '1px solid rgba(242,237,230,0.06)',
                  borderRadius: 14,
                  overflow: 'hidden',
                }}
              >
                <div className="skeleton" style={{ height: 100 }} />
                <div
                  style={{
                    padding: '10px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div
                    className="skeleton"
                    style={{ height: 13, width: '75%', borderRadius: 6 }}
                  />
                  <div
                    className="skeleton"
                    style={{ height: 11, width: '40%', borderRadius: 6 }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : filteredGames.length === 0 ? (
          // Empty State
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '60px 20px',
              textAlign: 'center',
              color: 'rgba(242,237,230,0.3)',
            }}
          >
            {tab === 'favorites' ? (
              <>
                <Star size={40} style={{ marginBottom: 16, opacity: 0.3 }} />
                <p
                  style={{
                    fontSize: 15,
                    margin: '0 0 8px',
                    color: 'rgba(242,237,230,0.5)',
                  }}
                >
                  No Favorites
                </p>
                <p style={{ fontSize: 13, margin: 0, marginBottom: 16 }}>
                  Go to "All Games" tab and click ⭐ to add favorites
                </p>
                <button
                  onClick={() => setTab('all')}
                  style={{
                    background: 'rgba(217,119,87,0.1)',
                    border: '1px solid rgba(217,119,87,0.25)',
                    borderRadius: 10,
                    padding: '8px 16px',
                    color: '#D97757',
                    fontSize: 13,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontFamily: '"Inter", sans-serif',
                    fontWeight: 500,
                  }}
                >
                  View All Games <ChevronRight size={14} />
                </button>
              </>
            ) : games.length === 0 ? (
              <>
                <Gamepad2 size={40} style={{ marginBottom: 16, opacity: 0.3 }} />
                <p
                  style={{
                    fontSize: 15,
                    margin: '0 0 8px',
                    color: 'rgba(242,237,230,0.5)',
                  }}
                >
                  No Games Loaded
                </p>
                <p style={{ fontSize: 13, margin: 0 }}>
                  Select account & click "Refresh" to load your game library
                </p>
              </>
            ) : (
              <>
                <p style={{ fontSize: 15, margin: 0 }}>
                  No games match your search
                </p>
              </>
            )}
          </div>
        ) : (
          // Game Cards Grid
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: 12,
              paddingBottom: 16,
            }}
          >
            {filteredGames.map((game) => (
              <GameCard
                key={game.appId}
                game={game}
                isIdling={idlingIds.has(game.appId)}
                isFavorite={favorites.has(game.appId)}
                idleStartTime={idleStartTimesRef.current.get(game.appId)}
                tick={tick}
                onToggleFavorite={toggleFavorite}
                onStop={stopOne}
              />
            ))}
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* KEYFRAME ANIMATIONS */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes idlePulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 6px #4ade80; }
          50% { opacity: 0.4; box-shadow: 0 0 2px #4ade80; }
        }
        @keyframes refreshPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.65; }
        }
        .skeleton {
          background: linear-gradient(
            90deg,
            rgba(242,237,230,0.04) 25%,
            rgba(242,237,230,0.08) 50%,
            rgba(242,237,230,0.04) 75%
          );
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}