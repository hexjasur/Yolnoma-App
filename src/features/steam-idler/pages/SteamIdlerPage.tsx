import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { SteamStatusBadge } from '../components/SteamStatusBadge';
import { invoke } from '@tauri-apps/api/core';
import {
  Gamepad2,
  Play,
  Square,
  StopCircle,
  RefreshCw,
  AlertTriangle,
  Users,
  Star,
  Clock,
  ChevronRight,
  Loader2,
  Trophy,
  Flame,
} from 'lucide-react';

// ────────────────────────────────────────────────────────────────────────────
// TYPES & INTERFACES
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

type Tab = 'favorites' | 'idling' | 'all';

// ────────────────────────────────────────────────────────────────────────────
// CACHE & STORAGE
// ────────────────────────────────────────────────────────────────────────────

const CACHE_KEY = 'yolnoma_steam_games_cache';
const FAVORITES_KEY = 'yolnoma_steam_favorites';
const CACHE_TTL = 5 * 60 * 1000; // 5m

function getCachedGames(
  steamId: string,
): { games: SteamGame[]; age: number } | null {
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
// FORMATTERS
// ────────────────────────────────────────────────────────────────────────────

function formatPlaytime(minutes: number): string {
  if (minutes === 0) return '—';
  if (minutes < 60) return `${minutes}m`;
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
// GAME CARD COMPONENT
// ────────────────────────────────────────────────────────────────────────────

interface GameCardProps {
  game: SteamGame;
  isIdling: boolean;
  isFavorite: boolean;
  idleStartTime?: number;
  tick: number;
  onToggleFavorite: (id: number) => void;
  onStop: (id: number) => void;
  onOpenSam: (id: number) => void;
}

function GameCard({
  game,
  isIdling,
  isFavorite,
  idleStartTime,
  tick,
  onToggleFavorite,
  onStop,
  onOpenSam,
}: GameCardProps) {
  const [imgError, setImgError] = useState(false);
  void tick;

  return (
    <div
      style={{
        background: isIdling
          ? 'linear-gradient(135deg, rgba(217,119,87,0.08) 0%, #1B1713 100%)'
          : '#1B1713',
        border: `1px solid ${
          isIdling
            ? 'rgba(217,119,87,0.35)'
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
        boxShadow: isIdling ? '0 4px 16px rgba(217,119,87,0.14)' : 'none',
      }}
    >
      {/* Idling Badge with Timer */}
      {isIdling && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            zIndex: 2,
            background: 'rgba(10,9,7,0.82)',
            border: '1px solid rgba(217,119,87,0.5)',
            borderRadius: 12,
            padding: '7px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            backdropFilter: 'blur(8px)',
            minWidth: 82,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: '#D97757',
                display: 'inline-block',
                animation: 'idlePulse 1.5s infinite',
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#D97757',
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
                fontSize: 12,
                fontWeight: 700,
                color: 'rgba(217,119,87,0.95)',
                fontFamily: '"JetBrains Mono", monospace',
                paddingLeft: 11,
              }}
            >
              {formatElapsed(idleStartTime)}
            </span>
          )}
        </div>
      )}

      {/* Top Actions: SAM & Favorite */}
      <div
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          zIndex: 2,
          display: 'flex',
          gap: 6,
        }}
      >
        <button
          onClick={() => onOpenSam(game.appId)}
          style={{
            background: 'rgba(10,9,7,0.75)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 8,
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            backdropFilter: 'blur(8px)',
            color: '#fbbf24',
          }}
          title="Open Achievement Manager (SAM)"
        >
          <Trophy size={14} />
        </button>

        <button
          onClick={() => onToggleFavorite(game.appId)}
          style={{
            background: isFavorite
              ? 'rgba(217,119,87,0.25)'
              : 'rgba(0,0,0,0.45)',
            border: `1px solid ${
              isFavorite ? 'rgba(217,119,87,0.5)' : 'rgba(255,255,255,0.12)'
            }`,
            borderRadius: 8,
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            backdropFilter: 'blur(8px)',
          }}
          title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Star
            size={14}
            fill={isFavorite ? '#D97757' : 'none'}
            color={isFavorite ? '#D97757' : 'rgba(242,237,230,0.5)'}
          />
        </button>
      </div>

      {/* Cover Image */}
      <div
        style={{
          height: 132,
          background:
            'linear-gradient(135deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.2) 100%)',
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
              background:
                'radial-gradient(circle, rgba(217,119,87,0.08) 0%, transparent 100%)',
            }}
          >
            <Gamepad2 size={32} color="rgba(217,119,87,0.25)" />
          </div>
        )}
      </div>

      {/* Info Section */}
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
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            lineHeight: 1.4,
          }}
          title={game.name}
        >
          {game.name}
        </p>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 11,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={11} color="rgba(242,237,230,0.35)" />
            <span style={{ color: 'rgba(242,237,230,0.5)' }}>
              {formatPlaytime(game.playtimeForever)}
            </span>
          </div>
          <span
            style={{
              color: 'rgba(242,237,230,0.25)',
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 10,
            }}
          >
            #{game.appId}
          </span>
        </div>

        {/* Action Button: Stop if Idling */}
        {isIdling && (
          <button
            onClick={() => onStop(game.appId)}
            style={{
              marginTop: 4,
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.25)',
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
              transition: 'all 0.15s ease',
              width: '100%',
            }}
          >
            <Square size={11} fill="#f87171" />
            Stop Idling
          </button>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ────────────────────────────────────────────────────────────────────────────

export default function SteamIdlerPage() {
  const navigate = useNavigate();

  // ── State
  const [steamRunning, setSteamRunning] = useState<boolean | null>(null);
  const [accounts, setAccounts] = useState<SteamUser[]>([]);
  const [selectedSteamId, setSelectedSteamId] = useState('');
  const [games, setGames] = useState<SteamGame[]>([]);
  const [idlingIds, setIdlingIds] = useState<Set<number>>(new Set());
  const [favorites, setFavorites] = useState<Set<number>>(getFavorites);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // ── Loading
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // ── Cache & Cooldown
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [cacheAge, setCacheAge] = useState<number | null>(null);
  const [canRefresh, setCanRefresh] = useState(false);

  // ── Timers
  const [tick, setTick] = useState(0);
  const idleStartTimesRef = useRef<Map<number, number>>(new Map());

  // Timer ticker
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Polling Steam status & idling processes
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

      ids.forEach((id) => {
        if (!idleStartTimesRef.current.has(id)) {
          idleStartTimesRef.current.set(id, now);
        }
      });

      for (const id of idleStartTimesRef.current.keys()) {
        if (!idSet.has(id)) {
          idleStartTimesRef.current.delete(id);
        }
      }

      setIdlingIds(idSet);
    } catch {
      // ignore
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

  // Cooldown countdown
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

  // Load Steam accounts on mount
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

  // Load games from cache or backend
  const loadGames = useCallback(
    async (forceRefresh = false) => {
      if (!selectedSteamId) return;

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
        setSecondsLeft(300);
      } catch (e: unknown) {
        setError(String(e));
        setCanRefresh(true);
      } finally {
        setGamesLoading(false);
      }
    },
    [selectedSteamId],
  );

  useEffect(() => {
    if (selectedSteamId) loadGames(false);
  }, [selectedSteamId, loadGames]);

  // Favorites toggle
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

  // Start idling favorites
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
          `${result.failed.length} games failed to start idling. Please make sure Steam is running.`,
        );
      }
    } catch (e: unknown) {
      setError(String(e));
    } finally {
      setActionLoading(false);
    }
  };

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

  const stopAll = async () => {
    try {
      await invoke('stop_all_idling');
      await refreshIdleState();
      setIdlingIds(new Set());
    } catch (e: unknown) {
      setError(String(e));
    }
  };

  const handleOpenSam = (appId: number) => {
    navigate(`/tools/steam/sam?appId=${appId}`);
  };

  // Filter games based on current active tab & search query
  const filteredGames = games.filter((g) => {
    const matchSearch = g.name.toLowerCase().includes(search.toLowerCase());
    if (tab === 'favorites') return matchSearch && favorites.has(g.appId);
    if (tab === 'idling') return matchSearch && idlingIds.has(g.appId);
    return matchSearch;
  });

  // Pagination for "All Games" tab without search
  const GAMES_PER_PAGE = 60;
  const isPaginated = tab === 'all' && search.trim() === '';
  const totalPages = isPaginated
    ? Math.ceil(filteredGames.length / GAMES_PER_PAGE)
    : 1;
  const safePage = Math.max(1, Math.min(currentPage, totalPages || 1));
  const displayedGames = isPaginated
    ? filteredGames.slice(
        (safePage - 1) * GAMES_PER_PAGE,
        safePage * GAMES_PER_PAGE,
      )
    : filteredGames;

  const cacheAgeMin =
    cacheAge !== null && Number.isFinite(cacheAge)
      ? Math.floor(cacheAge / 60000)
      : null;

  return (
    <div
      style={{
        fontFamily: '"Inter", sans-serif',
        color: '#F2EDE6',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ── HEADER ── */}
      <div style={{ marginBottom: 20 }}>
        <p
          style={{
            fontSize: 11,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: '#D97757',
            fontWeight: 700,
            margin: '0 0 6px 0',
          }}
        >
          Steam Toolkit
        </p>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h1
              style={{
                fontFamily: '"Georgia", serif',
                fontSize: 32,
                fontWeight: 500,
                margin: 0,
                letterSpacing: '-0.02em',
              }}
            >
              Steam Game Idler
            </h1>
            <p
              style={{
                margin: '4px 0 0',
                fontSize: 13,
                color: 'rgba(242,237,230,0.45)',
              }}
            >
              Simulate game hours and manage achievement unlocking seamlessly.
            </p>
          </div>

          {/* Steam Status Badge */}
          <SteamStatusBadge running={steamRunning} />
        </div>
      </div>

      {/* ── ERROR BANNER ── */}
      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.22)',
            borderRadius: 12,
            padding: '12px 16px',
            marginBottom: 16,
            fontSize: 13,
            color: '#f87171',
          }}
        >
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ flex: 1 }}>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{
              background: 'none',
              border: 'none',
              color: '#f87171',
              cursor: 'pointer',
              fontSize: 16,
              padding: 0,
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ── ACCOUNT SELECTOR & REFRESH BAR ── */}
      <div
        style={{
          background: '#181410',
          border: '1px solid rgba(242,237,230,0.08)',
          borderRadius: 14,
          padding: '14px 18px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          flexWrap: 'wrap',
        }}
      >
        <Users size={18} color="#D97757" style={{ flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 160 }}>
          <p
            style={{
              margin: '0 0 4px',
              fontSize: 10,
              color: 'rgba(242,237,230,0.3)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              fontWeight: 600,
            }}
          >
            Active Steam Account
          </p>
          {accountsLoading ? (
            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: 'rgba(242,237,230,0.4)',
              }}
            >
              Detecting accounts...
            </p>
          ) : accounts.length === 0 ? (
            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: 'rgba(242,237,230,0.4)',
              }}
            >
              No Steam accounts detected on this PC
            </p>
          ) : (
            <select
              value={selectedSteamId}
              onChange={(e) => setSelectedSteamId(e.target.value)}
              style={{
                background: '#1B1713',
                border: '1px solid rgba(242,237,230,0.12)',
                borderRadius: 8,
                padding: '6px 12px',
                color: '#F2EDE6',
                fontSize: 13,
                cursor: 'pointer',
                outline: 'none',
                fontFamily: '"Inter", sans-serif',
              }}
            >
              {accounts.map((u) => (
                <option key={u.steamId} value={u.steamId}>
                  {u.personaName} {u.mostRecent ? '(Active)' : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Cache status info */}
        {cacheAgeMin !== null && games.length > 0 && (
          <div
            style={{
              fontSize: 12,
              color: 'rgba(242,237,230,0.35)',
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
                  background: 'rgba(217,119,87,0.08)',
                  border: '1px solid rgba(217,119,87,0.18)',
                  borderRadius: 20,
                  padding: '2px 8px',
                  color: 'rgba(217,119,87,0.7)',
                  fontSize: 11,
                }}
              >
                Cooldown ({Math.floor(secondsLeft / 60)}:
                {secondsLeft % 60 < 10 ? '0' : ''}
                {secondsLeft % 60})
              </span>
            )}
          </div>
        )}

        {/* Refresh button */}
        <button
          onClick={() => loadGames(true)}
          disabled={gamesLoading || !selectedSteamId || secondsLeft > 0}
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
            padding: '7px 15px',
            color:
              canRefresh && secondsLeft === 0
                ? '#D97757'
                : 'rgba(242,237,230,0.45)',
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
            <Loader2
              size={14}
              style={{ animation: 'spin 1s linear infinite' }}
            />
          ) : (
            <RefreshCw size={14} />
          )}
          {gamesLoading ? 'Loading Library...' : 'Refresh'}
        </button>
      </div>

      {/* ── 3 TABS: Favorites | Now Idling | All Games ── */}
      <div
        style={{
          display: 'flex',
          gap: 6,
          borderBottom: '1px solid rgba(242,237,230,0.08)',
          marginBottom: 16,
          alignItems: 'center',
        }}
      >
        {[
          {
            key: 'favorites',
            label: 'Favorite Games',
            count: favorites.size,
            icon: Star,
          },
          {
            key: 'idling',
            label: 'Now Idling',
            count: idlingIds.size,
            icon: Flame,
          },
          {
            key: 'all',
            label: 'All Games',
            count: games.length,
            icon: Gamepad2,
          },
        ].map(({ key, label, count, icon: TabIcon }) => (
          <button
            key={key}
            onClick={() => {
              setTab(key as Tab);
              setCurrentPage(1);
            }}
            style={{
              padding: '10px 16px',
              background: 'none',
              border: 'none',
              borderBottom: `2px solid ${tab === key ? '#D97757' : 'transparent'}`,
              color: tab === key ? '#F2EDE6' : 'rgba(242,237,230,0.4)',
              fontFamily: '"Inter", sans-serif',
              fontSize: 13,
              fontWeight: tab === key ? 600 : 400,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              transition: 'all 0.15s ease',
              marginBottom: -1,
            }}
          >
            <TabIcon
              size={14}
              color={tab === key ? '#D97757' : 'rgba(242,237,230,0.4)'}
              fill={
                key === 'favorites' && favorites.size > 0 ? '#D97757' : 'none'
              }
            />
            {label}
            {count > 0 && (
              <span
                style={{
                  background:
                    tab === key
                      ? 'rgba(217,119,87,0.15)'
                      : 'rgba(242,237,230,0.07)',
                  border: `1px solid ${tab === key ? 'rgba(217,119,87,0.3)' : 'rgba(242,237,230,0.1)'}`,
                  borderRadius: 20,
                  padding: '2px 8px',
                  fontSize: 11,
                  color: tab === key ? '#D97757' : 'rgba(242,237,230,0.5)',
                  fontWeight: 500,
                }}
              >
                {count}
              </span>
            )}
          </button>
        ))}

        {/* Global Stop All Button */}
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
                color: '#D97757',
                background: 'rgba(217,119,87,0.08)',
                border: '1px solid rgba(217,119,87,0.25)',
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
                  background: '#D97757',
                  animation: 'idlePulse 1.5s infinite',
                  display: 'inline-block',
                }}
              />
              {idlingIds.size} Idling
            </span>
            <button
              onClick={stopAll}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 20,
                padding: '4px 12px',
                color: '#f87171',
                fontSize: 12,
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              <StopCircle size={13} />
              Stop All
            </button>
          </div>
        )}
      </div>

      {/* ── FAVORITES TAB: BATCH IDLING BAR ── */}
      {tab === 'favorites' && (
        <div
          style={{
            background: '#181410',
            border: '1px solid rgba(242,237,230,0.08)',
            borderRadius: 14,
            padding: '14px 20px',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 14,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <p
              style={{
                margin: '0 0 2px',
                fontSize: 13,
                fontWeight: 700,
                color: '#F2EDE6',
              }}
            >
              Batch Idling Control
            </p>
            <p
              style={{
                margin: 0,
                fontSize: 12,
                color: 'rgba(242,237,230,0.45)',
              }}
            >
              {favorites.size === 0
                ? 'Mark games with ⭐ to queue them for idling (up to 32 concurrent games)'
                : `${favorites.size} favorite game(s) queued for idling`}
            </p>
          </div>

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
              padding: '9px 20px',
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
            {idlingIds.size > 0
              ? 'Restart Favorites Idling'
              : 'Start Idling Favorites'}
          </button>
        </div>
      )}

      {/* ── SEARCH BAR ── */}
      {games.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <input
            type="text"
            placeholder="Search game titles or App ID..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
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
            }}
          />
        </div>
      )}

      {/* ── GAMES GRID ── */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {gamesLoading ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 280px))',
              justifyContent: 'start',
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
                    margin: '0 0 6px',
                    color: 'rgba(242,237,230,0.6)',
                  }}
                >
                  No Favorite Games
                </p>
                <p style={{ fontSize: 13, margin: '0 0 16px' }}>
                  Switch to "All Games" and click the ⭐ icon to add favorites.
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
                    fontWeight: 500,
                  }}
                >
                  Browse All Games <ChevronRight size={14} />
                </button>
              </>
            ) : tab === 'idling' ? (
              <>
                <Flame size={40} style={{ marginBottom: 16, opacity: 0.3 }} />
                <p
                  style={{
                    fontSize: 15,
                    margin: '0 0 6px',
                    color: 'rgba(242,237,230,0.6)',
                  }}
                >
                  No Games Currently Idling
                </p>
                <p style={{ fontSize: 13, margin: 0 }}>
                  Start idling from the "Favorite Games" tab.
                </p>
              </>
            ) : (
              <>
                <Gamepad2
                  size={40}
                  style={{ marginBottom: 16, opacity: 0.3 }}
                />
                <p
                  style={{
                    fontSize: 15,
                    margin: '0 0 6px',
                    color: 'rgba(242,237,230,0.6)',
                  }}
                >
                  {games.length === 0
                    ? 'No Games Loaded'
                    : 'No matching games found'}
                </p>
                <p style={{ fontSize: 13, margin: 0 }}>
                  {games.length === 0
                    ? 'Select a Steam account and click Refresh.'
                    : 'Try adjusting your search query.'}
                </p>
              </>
            )}
          </div>
        ) : (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 280px))',
                justifyContent: 'start',
                gap: 12,
                paddingBottom: 16,
              }}
            >
              {displayedGames.map((game) => (
                <GameCard
                  key={game.appId}
                  game={game}
                  isIdling={idlingIds.has(game.appId)}
                  isFavorite={favorites.has(game.appId)}
                  idleStartTime={idleStartTimesRef.current.get(game.appId)}
                  tick={tick}
                  onToggleFavorite={toggleFavorite}
                  onStop={stopOne}
                  onOpenSam={handleOpenSam}
                />
              ))}
            </div>

            {/* Pagination Controls (All Games tab) */}
            {isPaginated && totalPages > 1 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  paddingTop: 8,
                  paddingBottom: 20,
                  flexWrap: 'wrap',
                }}
              >
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 10,
                    background:
                      safePage <= 1
                        ? 'rgba(242,237,230,0.04)'
                        : 'rgba(217,119,87,0.1)',
                    border: `1px solid ${safePage <= 1 ? 'rgba(242,237,230,0.08)' : 'rgba(217,119,87,0.25)'}`,
                    color: safePage <= 1 ? 'rgba(242,237,230,0.3)' : '#D97757',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: safePage <= 1 ? 'not-allowed' : 'pointer',
                  }}
                >
                  ← Previous
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(
                    (p) =>
                      p === 1 ||
                      p === totalPages ||
                      Math.abs(p - safePage) <= 2,
                  )
                  .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                    if (idx > 0 && p - (arr[idx - 1] as number) > 1)
                      acc.push('...');
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, idx) =>
                    p === '...' ? (
                      <span
                        key={`ellipsis-${idx}`}
                        style={{
                          color: 'rgba(242,237,230,0.3)',
                          fontSize: 13,
                          padding: '0 4px',
                        }}
                      >
                        …
                      </span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setCurrentPage(p as number)}
                        style={{
                          minWidth: 36,
                          padding: '6px 10px',
                          borderRadius: 10,
                          background:
                            safePage === p
                              ? '#D97757'
                              : 'rgba(242,237,230,0.04)',
                          border: `1px solid ${safePage === p ? '#D97757' : 'rgba(242,237,230,0.08)'}`,
                          color:
                            safePage === p ? '#fff' : 'rgba(242,237,230,0.6)',
                          fontSize: 13,
                          fontWeight: safePage === p ? 700 : 400,
                          cursor: 'pointer',
                        }}
                      >
                        {p}
                      </button>
                    ),
                  )}

                <button
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={safePage >= totalPages}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 10,
                    background:
                      safePage >= totalPages
                        ? 'rgba(242,237,230,0.04)'
                        : 'rgba(217,119,87,0.1)',
                    border: `1px solid ${safePage >= totalPages ? 'rgba(242,237,230,0.08)' : 'rgba(217,119,87,0.25)'}`,
                    color:
                      safePage >= totalPages
                        ? 'rgba(242,237,230,0.3)'
                        : '#D97757',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: safePage >= totalPages ? 'not-allowed' : 'pointer',
                  }}
                >
                  Next →
                </button>

                <span
                  style={{
                    fontSize: 12,
                    color: 'rgba(242,237,230,0.4)',
                    marginLeft: 8,
                  }}
                >
                  Page {safePage} of {totalPages} · {filteredGames.length} games
                </span>
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes idlePulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 6px #D97757; }
          50% { opacity: 0.4; box-shadow: 0 0 2px #D97757; }
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
