import { memo, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { SteamStatusBadge } from '../components/SteamStatusBadge';
import Pagination from '@/shared/ui/Pagination';
import Button from '@/shared/ui/Button';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import {
  steamApi,
  readSteamGamesCache,
  writeSteamGamesCache,
  STEAM_GAMES_CACHE_TTL,
  type SteamGame,
  type SteamProfile,
  type SteamUser,
} from '../../steam/api/steamApi';
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
  X,
  ExternalLink,
} from 'lucide-react';

// ────────────────────────────────────────────────────────────────────────────
// TYPES & INTERFACES
// ────────────────────────────────────────────────────────────────────────────

type Tab = 'favorites' | 'idling' | 'all';

// ────────────────────────────────────────────────────────────────────────────
// CACHE & STORAGE
// ────────────────────────────────────────────────────────────────────────────

const FAVORITES_KEY = 'yolnoma_steam_favorites';

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

const GameCard = memo(function GameCard({
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
        contentVisibility: 'auto',
        contain: 'layout paint style',
        containIntrinsicSize: '220px 190px',
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
          height: 112,
          background:
            'linear-gradient(135deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.2) 100%)',
          overflow: 'hidden',
        position: 'relative',
        contentVisibility: 'auto',
        contain: 'layout paint style',
        containIntrinsicSize: '220px 190px',
      }}
      >
        {!imgError ? (
          <img
            src={`https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appId}/header.jpg`}
            alt={game.name}
            loading="lazy"
            decoding="async"
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
          padding: '10px 12px',
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
          <Button
            type="button"
            onClick={() => onStop(game.appId)}
            variant="danger"
            size="sm"
            className="mt-1 w-full justify-center gap-2"
          >
            <Square size={13} fill="currentColor" />
            Stop Idling
          </Button>
        )}
      </div>
    </div>
  );
});

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
  const [profile, setProfile] = useState<SteamProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  // ── Cache & Cooldown
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [cacheAge, setCacheAge] = useState<number | null>(null);
  const [canRefresh, setCanRefresh] = useState(false);

  // ── Timers
  const [tick, setTick] = useState(0);
  const idleStartTimesRef = useRef<Map<number, number>>(new Map());
  const debouncedSearch = useDebouncedValue(search, 220);

  const activeAccount = accounts.find((account) => account.mostRecent) ?? accounts[0];
  const openActiveProfile = async () => {
    if (!activeAccount) return;
    setProfileOpen(true);
    setProfileLoading(true);
    try {
      const data = await steamApi.getProfile(activeAccount.steamId);
      setProfile(data);
    } catch (e: unknown) {
      setError(String(e));
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    if (!activeAccount) return;
    let cancelled = false;
    steamApi.getProfile(activeAccount.steamId)
      .then((data) => {
        if (!cancelled) setProfile(data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [activeAccount?.steamId]);

  // Timer ticker
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Polling Steam status & idling processes
  const checkSteam = useCallback(async () => {
    try {
      const running = await steamApi.isRunning();
      setSteamRunning(running);
    } catch {
      setSteamRunning(false);
    }
  }, []);

  const refreshIdleState = useCallback(async () => {
    try {
      const ids = await steamApi.getIdleState();
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
        const users = await steamApi.getAccounts();
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
        const cached = readSteamGamesCache(selectedSteamId);
        if (cached) {
          setGames(cached.games);
          setCacheAge(cached.age);
          const ageMs = cached.age;
          if (ageMs < STEAM_GAMES_CACHE_TTL) {
            setCanRefresh(false);
            setSecondsLeft(Math.ceil((STEAM_GAMES_CACHE_TTL - ageMs) / 1000));
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
        const list = await steamApi.getGames(selectedSteamId);
        list.sort((a, b) => b.playtimeForever - a.playtimeForever);
        setGames(list);
        setCacheAge(0);
        writeSteamGamesCache(selectedSteamId, list);
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
      const result = await steamApi.startIdling(targets);
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
      await steamApi.stopIdling(appId);
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
      await steamApi.stopAllIdling();
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
    const matchSearch = g.name.toLowerCase().includes(debouncedSearch.toLowerCase());
    if (tab === 'favorites') return matchSearch && favorites.has(g.appId);
    if (tab === 'idling') return matchSearch && idlingIds.has(g.appId);
    return matchSearch;
  });

  // Pagination for "All Games" tab without search
  const GAMES_PER_PAGE = 60;
  const isPaginated = tab === 'all' && debouncedSearch.trim() === '';
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
        minHeight: '100%',
      }}
    >
      {/* ── HEADER ── */}
      <div
        style={{
          marginBottom: 16,
          padding: '18px 20px',
          borderRadius: 16,
          background: 'linear-gradient(120deg, rgba(217,119,87,0.10), rgba(24,20,16,0.88) 48%)',
          border: '1px solid rgba(217,119,87,0.18)',
          boxShadow: '0 10px 30px rgba(0,0,0,0.14)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 18,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ minWidth: 220 }}>
            <p style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#D97757', fontWeight: 700, margin: '0 0 6px' }}>
              Steam Toolkit
            </p>
            <h1
              style={{
                fontFamily: '"Georgia", serif', fontSize: 28, fontWeight: 500,
                margin: 0,
                letterSpacing: '-0.02em',
              }}
            >
              Steam Game Idler
            </h1>
            <p
              style={{
                margin: '5px 0 0',
                fontSize: 13,
                color: 'rgba(242,237,230,0.45)',
              }}
            >
              Simulate game hours and manage achievement unlocking seamlessly.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 11px', borderRadius: 11, background: 'rgba(0,0,0,0.20)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <Users size={16} color="#D97757" />
              <span style={{ fontSize: 11, color: 'rgba(242,237,230,0.55)' }}>Account tools</span>
            </div>
            <SteamStatusBadge running={steamRunning} />
          </div>
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
          ) : activeAccount ? (
            <button
              type="button"
              onClick={openActiveProfile}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                background: 'rgba(217,119,87,0.08)',
                border: '1px solid rgba(217,119,87,0.24)',
                borderRadius: 10,
                padding: '7px 11px',
                color: '#F2EDE6',
                fontSize: 13,
                cursor: 'pointer',
                outline: 'none',
                fontFamily: '"Inter", sans-serif',
              }}
            >
              {profile?.avatar ? <img src={profile.avatar} alt="" style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover' }} /> : <span style={{ display: 'grid', placeItems: 'center', width: 26, height: 26, borderRadius: '50%', background: 'rgba(217,119,87,0.18)' }}><Users size={15} color="#D97757" /></span>}
              <span>{profile?.personaName ?? activeAccount.personaName}</span>
              <span style={{ color: '#D97757', fontSize: 11, fontWeight: 700 }}>Active</span>
            </button>
          ) : null}
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
        <Button
          type="button"
          onClick={() => loadGames(true)}
          disabled={gamesLoading || !selectedSteamId || secondsLeft > 0}
          variant="secondary"
          size="sm"
          className={`gap-2 ${canRefresh && secondsLeft === 0 ? 'text-[#D97757]' : ''}`}
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
        </Button>
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

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {idlingIds.size > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 11px', borderRadius: 10, background: 'rgba(217,119,87,0.08)', border: '1px solid rgba(217,119,87,0.2)', color: '#D97757', fontSize: 12, fontWeight: 700 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#D97757', animation: 'idlePulse 1.5s infinite' }} />
                {idlingIds.size} idling
              </span>
            )}
            <Button
              type="button"
              onClick={startIdling}
              disabled={favorites.size === 0 || !steamRunning || actionLoading}
              variant="primary"
              size="md"
              loading={actionLoading}
              className="min-w-[210px] justify-center gap-2"
            >
              <Play size={16} fill="currentColor" />
              {idlingIds.size > 0 ? 'Restart Favorites Idling' : 'Start Idling Favorites'}
            </Button>
            {idlingIds.size > 0 && (
              <Button type="button" onClick={stopAll} variant="danger" size="md" className="min-w-[150px] justify-center gap-2 font-bold">
                <StopCircle size={17} />
                Stop Idling
              </Button>
            )}
          </div>
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
      <div style={{ minHeight: 0 }}>
        {gamesLoading ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
              gap: 10,
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
                gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
                gap: 10,
                alignItems: 'start',
                gridAutoRows: 'max-content',
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

            {isPaginated && totalPages > 1 && (
              <Pagination
                page={safePage}
                totalPages={totalPages}
                total={filteredGames.length}
                limit={GAMES_PER_PAGE}
                onPageChange={setCurrentPage}
                itemLabel="games"
                limitOptions={[GAMES_PER_PAGE]}
              />
            )}
          </>
        )}
      </div>

      {profileOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Active Steam account profile"
          onClick={() => setProfileOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
        >
          <div onClick={(event) => event.stopPropagation()} style={{ width: 'min(460px, 100%)', borderRadius: 16, overflow: 'hidden', background: '#1B1713', border: '1px solid rgba(242,237,230,0.15)', boxShadow: '0 24px 80px rgba(0,0,0,0.5)' }}>
            <div style={{ height: 110, background: 'linear-gradient(135deg, rgba(217,119,87,0.35), rgba(24,20,16,0.9))', position: 'relative' }}>
              <button type="button" onClick={() => setProfileOpen(false)} aria-label="Close profile" style={{ position: 'absolute', right: 12, top: 12, width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(255,255,255,0.16)', background: 'rgba(0,0,0,0.35)', color: '#fff', cursor: 'pointer' }}><X size={16} /></button>
              {profile?.avatarFull && <img src={profile.avatarFull} alt="" style={{ position: 'absolute', left: 24, bottom: -38, width: 84, height: 84, borderRadius: 14, objectFit: 'cover', border: '4px solid #1B1713' }} />}
            </div>
            <div style={{ padding: '48px 24px 24px' }}>
              {profileLoading ? <div style={{ color: 'rgba(242,237,230,0.55)', fontSize: 13 }}>Loading Steam profile…</div> : profile ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: 12 }}>
                    <div><h2 style={{ margin: 0, color: '#F2EDE6', fontSize: 22 }}>{profile.personaName}</h2><p style={{ margin: '5px 0 0', color: profile.personaState > 0 ? '#86efac' : 'rgba(242,237,230,0.45)', fontSize: 12 }}>{profile.personaState > 0 ? 'Online' : 'Offline'}</p></div>
                    {profile.profileUrl && <a href={profile.profileUrl} target="_blank" rel="noreferrer" aria-label="Open Steam profile" style={{ color: '#D97757' }}><ExternalLink size={18} /></a>}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginTop: 20 }}>
                    {[['Steam ID', profile.steamId], ['Steam Level', profile.steamLevel ?? 'Unavailable'], ['Real name', profile.realName ?? 'Not public'], ['Country', profile.countryCode ?? 'Not public']].map(([label, value]) => <div key={label} style={{ padding: '10px 12px', borderRadius: 9, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}><span style={{ display: 'block', color: 'rgba(242,237,230,0.4)', fontSize: 10 }}>{label}</span><strong style={{ display: 'block', marginTop: 4, color: '#F2EDE6', fontSize: 12, wordBreak: 'break-all' }}>{value}</strong></div>)}
                  </div>
                  {profile.timeCreated && <p style={{ margin: '16px 0 0', color: 'rgba(242,237,230,0.45)', fontSize: 11 }}>Account created {new Date(profile.timeCreated * 1000).toLocaleDateString()}</p>}
                </>
              ) : <p style={{ color: '#f87171', fontSize: 13 }}>Steam profile information could not be loaded.</p>}
            </div>
          </div>
        </div>
      )}
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
