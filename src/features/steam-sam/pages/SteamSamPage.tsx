import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  steamApi,
  readSteamGamesCache,
  writeSteamGamesCache,
  STEAM_GAMES_CACHE_TTL,
  setAchievementsBounded,
  type SteamGame,
  type SteamUser,
} from '../../steam/api/steamApi';
import Pagination from '@/shared/ui/Pagination';
import Button from '@/shared/ui/Button';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import {
  Trophy, BarChart3, Search, RefreshCw, Lock, Unlock,
  CheckCircle2, AlertTriangle, Shield, Wifi, WifiOff,
  ChevronRight, Loader2, Users, ArrowUpDown,
  Sparkles, Check
} from 'lucide-react';
import { toast } from '@/shared/ui/Toast';
import { ConfirmModal } from '@/shared/ui';
import { AuditLogPanel, type AuditEntry } from '../components/AuditLogPanel';

// ────────────────────────────────────────────────────────────────────────────
// TYPES
// ────────────────────────────────────────────────────────────────────────────

interface Achievement {
  id: string;
  name: string;
  description: string;
  iconNormal: string;
  iconLocked: string;
  achieved: boolean;
  percent?: number;
  hidden: boolean;
  protectedAchievement: boolean;
}

interface Stat {
  id: string;
  name: string;
  statType: string;
  value: number | string;
  incrementOnly: boolean;
  protectedStat: boolean;
}

type AchFilter = 'all' | 'unlocked' | 'locked';
type AchSort = 'rarity' | 'name' | 'status';

const AUDIT_LOG_KEY = 'yolnoma_steam_sam_audit_log';
const MAX_AUDIT_ENTRIES = 30;

function readAuditLog(): AuditEntry[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(AUDIT_LOG_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.slice(0, MAX_AUDIT_ENTRIES) : [];
  } catch {
    return [];
  }
}

function appendAuditLog(entry: Omit<AuditEntry, 'id' | 'timestamp'>): AuditEntry[] {
  const next: AuditEntry[] = [
    { ...entry, id: crypto.randomUUID(), timestamp: Date.now() },
    ...readAuditLog(),
  ].slice(0, MAX_AUDIT_ENTRIES);
  localStorage.setItem(AUDIT_LOG_KEY, JSON.stringify(next));
  return next;
}

// ────────────────────────────────────────────────────────────────────────────
// MAIN SAM PAGE COMPONENT
// ────────────────────────────────────────────────────────────────────────────

export default function SteamSamPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlAppId = searchParams.get('appId') ? Number(searchParams.get('appId')) : null;

  // ── Global Steam Status & Accounts
  const [steamRunning, setSteamRunning] = useState<boolean | null>(null);
  const [accounts, setAccounts] = useState<SteamUser[]>([]);
  const [selectedSteamId, setSelectedSteamId] = useState('');

  // ── Game Library
  const [games, setGames] = useState<SteamGame[]>([]);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [gamesRefreshing, setGamesRefreshing] = useState(false);
  const [gameSearch, setGameSearch] = useState('');
  const [gamePage, setGamePage] = useState(1);
  const [gameCacheAge, setGameCacheAge] = useState<number | null>(null);
  const [gameSecondsLeft, setGameSecondsLeft] = useState(0);
  const [canRefreshGames, setCanRefreshGames] = useState(false);
  const [selectedGame, setSelectedGame] = useState<SteamGame | null>(null);

  // ── SAM Data for selected game
  const [activeTab, setActiveTab] = useState<'achievements' | 'stats'>('achievements');
  const [samLoading, setSamLoading] = useState(false);
  const [samError, setSamError] = useState<string | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [stats, setStats] = useState<Stat[]>([]);
  const [modifiedStats, setModifiedStats] = useState<Record<string, number | string>>({});

  // ── Multi-select Achievement Staging
  const [selectedAchIds, setSelectedAchIds] = useState<Set<string>>(new Set());

  // ── Confirmation Modals
  const [confirmUnlockModal, setConfirmUnlockModal] = useState<{ open: boolean; mode: 'selected' | 'all'; count: number }>({ open: false, mode: 'selected', count: 0 });
  const [confirmLockModal, setConfirmLockModal] = useState<{ open: boolean; mode: 'selected' | 'all'; count: number }>({ open: false, mode: 'selected', count: 0 });
  const [showResetStatsConfirm, setShowResetStatsConfirm] = useState(false);

  // ── Achievement filters & search
  const [achFilter, setAchFilter] = useState<AchFilter>('all');
  const [achSort, setAchSort] = useState<AchSort>('rarity');
  const [achSearch, setAchSearch] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionProgress, setActionProgress] = useState<{ action: 'unlock' | 'lock'; total: number; processed: number; success: number; failed: number } | null>(null);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>(readAuditLog);
  const [showAuditLog, setShowAuditLog] = useState(false);

  const initialLoadedRef = useRef(false);
  const activeAccount = accounts.find((account) => account.mostRecent) ?? accounts[0];
  const debouncedGameSearch = useDebouncedValue(gameSearch, 220);

  // Check Steam client status
  const checkSteam = useCallback(async () => {
    try {
      const running = await steamApi.isRunning();
      setSteamRunning(running);
    } catch {
      setSteamRunning(false);
    }
  }, []);

  useEffect(() => {
    checkSteam();
    const interval = setInterval(checkSteam, 8000);
    return () => clearInterval(interval);
  }, [checkSteam]);

  // Load Steam accounts on mount
  useEffect(() => {
    (async () => {
      try {
        const users = await steamApi.getAccounts();
        setAccounts(users);
        const recent = users.find((u) => u.mostRecent) ?? users[0];
        if (recent) setSelectedSteamId(recent.steamId);
      } catch (err: unknown) {
        console.error('Failed to load accounts', err);
      }
    })();
  }, []);

  // Load games for selected account
  const loadGames = useCallback(async (forceRefresh = false) => {
    if (!selectedSteamId) return;

    if (!forceRefresh) {
      const cached = await readSteamGamesCache(selectedSteamId);
      if (cached) {
        setGames(cached.games);
        setGameCacheAge(cached.age);
        if (cached.age < STEAM_GAMES_CACHE_TTL) {
          setCanRefreshGames(false);
          setGameSecondsLeft(Math.ceil((STEAM_GAMES_CACHE_TTL - cached.age) / 1000));
        } else {
          setCanRefreshGames(true);
          setGameSecondsLeft(0);
        }
        if (cached.age < STEAM_GAMES_CACHE_TTL) return;
        // Stale-while-revalidate: keep the current library visible.
      }
    }

    setGamesLoading(games.length === 0);
    setGamesRefreshing(true);
    setCanRefreshGames(false);
    try {
      const list = await steamApi.getGames(selectedSteamId);
      list.sort((a, b) => b.playtimeForever - a.playtimeForever);
      setGames(list);
      setGameCacheAge(0);
      await writeSteamGamesCache(selectedSteamId, list);
      setGameSecondsLeft(STEAM_GAMES_CACHE_TTL / 1000);
    } catch (e: unknown) {
      console.error(e);
      setCanRefreshGames(true);
    } finally {
      setGamesLoading(false);
      setGamesRefreshing(false);
    }
  }, [games.length, selectedSteamId]);

  useEffect(() => {
    if (selectedSteamId) loadGames();
  }, [selectedSteamId, loadGames]);

  useEffect(() => {
    if (gameSecondsLeft <= 0) return;
    const interval = setInterval(() => {
      setGameSecondsLeft((previous) => {
        if (previous <= 1) {
          setCanRefreshGames(true);
          return 0;
        }
        return previous - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [gameSecondsLeft]);

  useEffect(() => {
    setGamePage(1);
  }, [gameSearch, selectedSteamId]);

  // Load SAM data for a specific game
  const loadSamData = useCallback(async (appId: number) => {
    setSamLoading(true);
    setSamError(null);
    setSelectedAchIds(new Set());
    try {
      const data = await steamApi.getAchievementData(appId);
      setAchievements(data.achievements || []);
      setStats(data.stats || []);

      const initialStatMap: Record<string, number | string> = {};
      (data.stats || []).forEach((s) => {
        initialStatMap[s.id] = s.value;
      });
      setModifiedStats(initialStatMap);
    } catch (err: unknown) {
      const msg = String(err);
      setSamError(msg);
      toast.error(msg || 'Failed to fetch achievement data. Is Steam running?');
    } finally {
      setSamLoading(false);
    }
  }, []);

  // Direct fast game selection
  const handleSelectGame = useCallback((game: SteamGame) => {
    setSelectedGame(game);
    setSearchParams({ appId: String(game.appId) }, { replace: true });
    loadSamData(game.appId);
  }, [loadSamData, setSearchParams]);

  // Initial load from URL
  useEffect(() => {
    if (initialLoadedRef.current) return;
    if (urlAppId && games.length > 0) {
      initialLoadedRef.current = true;
      const found = games.find((g) => g.appId === urlAppId);
      if (found) {
        handleSelectGame(found);
      } else {
        const fallbackGame: SteamGame = {
          appId: urlAppId,
          name: `App ID: ${urlAppId}`,
          playtimeForever: 0,
        };
        setSelectedGame(fallbackGame);
        loadSamData(urlAppId);
      }
    }
  }, [urlAppId, games, handleSelectGame, loadSamData]);

  // ── Multi-select Achievement Handlers
  const handleToggleSelectAch = (id: string) => {
    setSelectedAchIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    const selectable = filteredAchievements.filter((a) => !a.protectedAchievement);
    setSelectedAchIds(new Set(selectable.map((a) => a.id)));
  };

  const handleSelectLockedOnly = () => {
    const locked = achievements.filter((a) => !a.achieved && !a.protectedAchievement);
    setSelectedAchIds(new Set(locked.map((a) => a.id)));
  };

  const handleSelectUnlockedOnly = () => {
    const unlocked = achievements.filter((a) => a.achieved && !a.protectedAchievement);
    setSelectedAchIds(new Set(unlocked.map((a) => a.id)));
  };

  const handleClearSelection = () => {
    setSelectedAchIds(new Set());
  };

  // ── Execution Handlers (Commit to Steam with Confirmations)
  const handleExecuteUnlock = async (mode: 'selected' | 'all') => {
    if (!selectedGame) return;
    setConfirmUnlockModal({ open: false, mode: 'selected', count: 0 });
    setActionLoading(true);

    try {
      const requestedCount = mode === 'all' ? achievements.length : selectedAchIds.size;
      setActionProgress({ action: 'unlock', total: requestedCount, processed: 0, success: 0, failed: 0 });
      if (mode === 'all') {
        await steamApi.unlockAllAchievements(selectedGame.appId);
        setActionProgress({ action: 'unlock', total: requestedCount, processed: requestedCount, success: requestedCount, failed: 0 });
        setAchievements((prev) =>
          prev.map((a) => (a.protectedAchievement ? a : { ...a, achieved: true }))
        );
        setSelectedAchIds(new Set());
        setAuditLog(appendAuditLog({ action: 'unlock', gameName: selectedGame.name, appId: selectedGame.appId, count: requestedCount, success: requestedCount, failed: 0 }));
        toast.success('All achievements unlocked in Steam!');
      } else {
        const targetIds = Array.from(selectedAchIds);
        const { successCount, failedCount, failedIds } = await setAchievementsBounded(selectedGame.appId, targetIds, true, 6, (progress) => setActionProgress({ action: 'unlock', total: targetIds.length, processed: progress.processed, success: progress.successCount, failed: progress.failedCount }));
        setAchievements((prev) =>
          prev.map((a) => (selectedAchIds.has(a.id) && !a.protectedAchievement && !failedIds.includes(a.id) ? { ...a, achieved: true } : a))
        );
        setSelectedAchIds(new Set());
        setAuditLog(appendAuditLog({ action: 'unlock', gameName: selectedGame.name, appId: selectedGame.appId, count: targetIds.length, success: successCount, failed: failedCount }));
        toast.success(`Successfully unlocked ${successCount} achievement${successCount === 1 ? '' : 's'}!`);
      }
    } catch (err: unknown) {
      toast.error(String(err) || 'Failed to unlock achievements');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExecuteLock = async (mode: 'selected' | 'all') => {
    if (!selectedGame) return;
    setConfirmLockModal({ open: false, mode: 'selected', count: 0 });
    setActionLoading(true);

    try {
      const requestedCount = mode === 'all' ? achievements.length : selectedAchIds.size;
      setActionProgress({ action: 'lock', total: requestedCount, processed: 0, success: 0, failed: 0 });
      if (mode === 'all') {
        await steamApi.lockAllAchievements(selectedGame.appId);
        setActionProgress({ action: 'lock', total: requestedCount, processed: requestedCount, success: requestedCount, failed: 0 });
        setAchievements((prev) =>
          prev.map((a) => (a.protectedAchievement ? a : { ...a, achieved: false }))
        );
        setSelectedAchIds(new Set());
        setAuditLog(appendAuditLog({ action: 'lock', gameName: selectedGame.name, appId: selectedGame.appId, count: requestedCount, success: requestedCount, failed: 0 }));
        toast.success('All achievements locked!');
      } else {
        const targetIds = Array.from(selectedAchIds);
        const { successCount, failedCount, failedIds } = await setAchievementsBounded(selectedGame.appId, targetIds, false, 6, (progress) => setActionProgress({ action: 'lock', total: targetIds.length, processed: progress.processed, success: progress.successCount, failed: progress.failedCount }));
        setAchievements((prev) =>
          prev.map((a) => (selectedAchIds.has(a.id) && !a.protectedAchievement && !failedIds.includes(a.id) ? { ...a, achieved: false } : a))
        );
        setSelectedAchIds(new Set());
        setAuditLog(appendAuditLog({ action: 'lock', gameName: selectedGame.name, appId: selectedGame.appId, count: targetIds.length, success: successCount, failed: failedCount }));
        toast.success(`Successfully locked ${successCount} achievement${successCount === 1 ? '' : 's'}!`);
      }
    } catch (err: unknown) {
      toast.error(String(err) || 'Failed to lock achievements');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Stats Handlers
  const handleSaveStats = async () => {
    if (!selectedGame) return;
    setActionLoading(true);
    try {
      const payload = Object.entries(modifiedStats).map(([id, value]) => ({
        id,
        value: typeof value === 'string' && !isNaN(Number(value)) ? Number(value) : value,
      }));

      await steamApi.updateStats(selectedGame.appId, JSON.stringify(payload));

      setAuditLog(appendAuditLog({ action: 'stats-update', gameName: selectedGame.name, appId: selectedGame.appId, count: payload.length, success: payload.length, failed: 0 }));
      toast.success('Statistics successfully updated in Steam!');
      loadSamData(selectedGame.appId);
    } catch (err: unknown) {
      toast.error(String(err) || 'Failed to update statistics');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExecuteResetStats = async () => {
    if (!selectedGame) return;
    setShowResetStatsConfirm(false);
    setActionLoading(true);
    try {
      await steamApi.resetAllStats(selectedGame.appId);
      setAuditLog(appendAuditLog({ action: 'stats-reset', gameName: selectedGame.name, appId: selectedGame.appId, count: stats.length, success: stats.length, failed: 0 }));
      toast.success('Statistics reset to zero.');
      loadSamData(selectedGame.appId);
    } catch (err: unknown) {
      toast.error(String(err) || 'Failed to reset statistics');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Filtered & Sorted Achievements
  const filteredAchievements = useMemo(() => {
    const list = achievements.filter((a) => {
      const matchSearch =
        a.name.toLowerCase().includes(achSearch.toLowerCase()) ||
        a.description.toLowerCase().includes(achSearch.toLowerCase());
      if (!matchSearch) return false;

      if (achFilter === 'unlocked') return a.achieved;
      if (achFilter === 'locked') return !a.achieved;
      return true;
    });

    if (achSort === 'rarity') {
      list.sort((a, b) => (a.percent ?? 100) - (b.percent ?? 100));
    } else if (achSort === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (achSort === 'status') {
      list.sort((a, b) => (b.achieved ? 1 : 0) - (a.achieved ? 1 : 0));
    }

    return list;
  }, [achievements, achFilter, achSort, achSearch]);

  const unlockedCount = achievements.filter((a) => a.achieved).length;
  const lockedCount = achievements.length - unlockedCount;
  const progressPercent = achievements.length > 0 ? Math.round((unlockedCount / achievements.length) * 100) : 0;

  // Filtered Game Library
  const filteredGames = games.filter((g) =>
    g.name.toLowerCase().includes(debouncedGameSearch.toLowerCase()) || String(g.appId).includes(debouncedGameSearch)
  );
  const GAMES_PER_PAGE = 24;
  const totalGamePages = Math.max(1, Math.ceil(filteredGames.length / GAMES_PER_PAGE));
  const safeGamePage = Math.min(gamePage, totalGamePages);
  const displayedGames = filteredGames.slice(
    (safeGamePage - 1) * GAMES_PER_PAGE,
    safeGamePage * GAMES_PER_PAGE,
  );
  const gameCacheAgeMin = gameCacheAge !== null ? Math.floor(gameCacheAge / 60000) : null;

  return (
    <div
      style={{
        fontFamily: '"Inter", sans-serif',
        color: '#F2EDE6',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {/* ── HEADER ── */}
      <div
        style={{
          margin: '0 16px 0',
          padding: '18px 20px',
          borderRadius: 16,
          background: 'linear-gradient(120deg, rgba(217,119,87,0.10), rgba(24,20,16,0.88) 48%)',
          border: '1px solid rgba(217,119,87,0.18)',
          boxShadow: '0 10px 30px rgba(0,0,0,0.14)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' }}>
          <div>
            <p style={{ margin: '0 0 6px', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#D97757', fontWeight: 700 }}>
              Steam Toolkit
            </p>
            <h1 style={{ margin: 0, fontFamily: '"Georgia", serif', fontSize: 28, fontWeight: 500, letterSpacing: '-0.02em' }}>
              Achievement Manager
            </h1>
            <p style={{ margin: '5px 0 0', fontSize: 13, color: 'rgba(242,237,230,0.45)' }}>
              Inspect, unlock, and manage Steam achievements safely.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 11px', borderRadius: 11, background: 'rgba(0,0,0,0.20)', border: '1px solid rgba(255,255,255,0.08)', fontSize: 11 }}>
              <Trophy size={15} color="#D97757" /> SAM Workspace
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: steamRunning === null ? 'rgba(242,237,230,0.4)' : steamRunning ? '#4ade80' : '#f87171', fontSize: 12 }}>
              {steamRunning ? <Wifi size={14} /> : <WifiOff size={14} />}
              {steamRunning === null ? 'Checking Steam...' : steamRunning ? 'Steam Connected' : 'Steam Offline'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 9, marginTop: 14, flexWrap: 'wrap' }}>
          {gameCacheAgeMin !== null && games.length > 0 && (
            <span style={{ fontSize: 11, color: 'rgba(242,237,230,0.4)' }}>
              {gameCacheAgeMin === 0 ? 'Library updated just now' : `Library updated ${gameCacheAgeMin} min ago`}
              {gameSecondsLeft > 0 && ` · refresh in ${Math.floor(gameSecondsLeft / 60)}:${String(gameSecondsLeft % 60).padStart(2, '0')}`}
            </span>
          )}
          <Button type="button" onClick={() => loadGames(true)} disabled={gamesLoading || gamesRefreshing || !selectedSteamId || gameSecondsLeft > 0} variant="secondary" size="sm" loading={gamesRefreshing} className={`gap-2 ${canRefreshGames ? 'text-[#D97757]' : ''}`}>
            {!gamesRefreshing && <RefreshCw size={14} />}
            {gamesRefreshing ? 'Refreshing Library...' : 'Refresh Library'}
          </Button>
        </div>
      </div>

      {/* ── WORKSPACE BODY ── */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, padding: 16, gap: 16 }}>
        {/* ── LEFT PANEL: GAME LIBRARY ── */}
        <div
          style={{
            width: 320,
            background: '#181410',
            border: '1px solid rgba(242,237,230,0.08)',
            borderRadius: 16,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          {/* Account Selector */}
          <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(242,237,230,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Users size={12} color="rgba(242,237,230,0.4)" />
              <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(242,237,230,0.4)', textTransform: 'uppercase' }}>
                Active Steam User
              </span>
            </div>
            {activeAccount ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(217,119,87,0.08)', border: '1px solid rgba(217,119,87,0.2)' }}>
                <span style={{ display: 'grid', placeItems: 'center', width: 28, height: 28, borderRadius: '50%', background: 'rgba(217,119,87,0.18)' }}>
                  <Users size={15} color="#D97757" />
                </span>
                <div style={{ minWidth: 0 }}>
                  <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#F2EDE6', fontSize: 12 }}>
                    {activeAccount.personaName}
                  </strong>
                  <span style={{ color: '#D97757', fontSize: 10, fontWeight: 700 }}>Active Steam account</span>
                </div>
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: 12, color: 'rgba(242,237,230,0.4)' }}>Detecting Steam...</p>
            )}
          </div>

          {/* Search Library */}
          <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(242,237,230,0.06)' }}>
            <div style={{ position: 'relative' }}>
              <Search
                size={14}
                style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'rgba(242,237,230,0.3)' }}
              />
              <input
                type="text"
                placeholder="Search games..."
                value={gameSearch}
                onChange={(e) => setGameSearch(e.target.value)}
                style={{
                  width: '100%',
                  background: '#1B1713',
                  border: '1px solid rgba(242,237,230,0.08)',
                  borderRadius: 8,
                  padding: '6px 10px 6px 30px',
                  color: '#F2EDE6',
                  fontSize: 12,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* Game List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
            {gamesLoading ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'rgba(242,237,230,0.4)', fontSize: 12 }}>
                <Loader2 size={18} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
                Loading library...
              </div>
            ) : filteredGames.length === 0 ? (
              <div style={{ padding: '30px 10px', textAlign: 'center', color: 'rgba(242,237,230,0.3)', fontSize: 12 }}>
                No games found
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {displayedGames.map((game) => {
                  const isSelected = selectedGame?.appId === game.appId;
                  return (
                    <button
                      key={game.appId}
                      type="button"
                      onClick={() => handleSelectGame(game)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '6px 8px',
                        background: isSelected ? 'rgba(217,119,87,0.18)' : 'transparent',
                        border: `1px solid ${isSelected ? 'rgba(217,119,87,0.35)' : 'transparent'}`,
                        borderRadius: 10,
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <img
                        src={`https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appId}/capsule_231x87.jpg`}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        onError={(e) => {
                          (e.currentTarget as HTMLElement).style.display = 'none';
                        }}
                        style={{
                          width: 48,
                          height: 24,
                          borderRadius: 4,
                          objectFit: 'cover',
                          background: '#111',
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p
                          style={{
                            margin: 0,
                            fontSize: 12,
                            fontWeight: isSelected ? 600 : 400,
                            color: isSelected ? '#F2EDE6' : 'rgba(242,237,230,0.7)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {game.name}
                        </p>
                        <span style={{ fontSize: 10, color: 'rgba(242,237,230,0.3)', fontFamily: '"JetBrains Mono", monospace' }}>
                          #{game.appId}
                        </span>
                      </div>
                      <ChevronRight size={14} color={isSelected ? '#D97757' : 'rgba(242,237,230,0.2)'} />
                    </button>
                  );
                })}
                </div>
                {totalGamePages > 1 && (
                  <Pagination
                    page={safeGamePage}
                    totalPages={totalGamePages}
                    total={filteredGames.length}
                    limit={GAMES_PER_PAGE}
                    onPageChange={setGamePage}
                    itemLabel="games"
                    limitOptions={[GAMES_PER_PAGE]}
                  />
                )}
              </>
            )}
          </div>
        </div>

        {/* ── RIGHT PANEL: SAM WORKSPACE ── */}
        <div
          style={{
            flex: 1,
            background: '#181410',
            border: '1px solid rgba(242,237,230,0.08)',
            borderRadius: 16,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {!selectedGame ? (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px',
                textAlign: 'center',
                color: 'rgba(242,237,230,0.4)',
              }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 20,
                  background: 'rgba(217,119,87,0.08)',
                  border: '1px solid rgba(217,119,87,0.18)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                  color: '#D97757',
                }}
              >
                <Trophy size={32} />
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 500, margin: '0 0 6px', color: '#F2EDE6' }}>
                Select a Game
              </h2>
              <p style={{ fontSize: 13, margin: 0, maxWidth: 360, lineHeight: 1.5 }}>
                Choose a title from the library on the left to inspect achievements, check the ones you want to unlock or lock, and commit changes with a single click.
              </p>
            </div>
          ) : (
            <>
              {/* Game Banner / Header */}
              <div
                style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid rgba(242,237,230,0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'linear-gradient(180deg, rgba(217,119,87,0.06) 0%, rgba(24,20,16,0.6) 100%)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <img
                    src={`https://cdn.cloudflare.steamstatic.com/steam/apps/${selectedGame.appId}/header.jpg`}
                    alt=""
                    style={{
                      width: 90,
                      height: 42,
                      borderRadius: 6,
                      objectFit: 'cover',
                      border: '1px solid rgba(255,255,255,0.1)',
                    }}
                  />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>
                        {selectedGame.name}
                      </h2>
                      <span
                        style={{
                          fontSize: 11,
                          fontFamily: '"JetBrains Mono", monospace',
                          padding: '1px 6px',
                          borderRadius: 4,
                          background: 'rgba(255,255,255,0.06)',
                          color: 'rgba(242,237,230,0.5)',
                        }}
                      >
                        #{selectedGame.appId}
                      </span>
                    </div>

                    {/* Progress details */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                      <span style={{ fontSize: 12, color: 'rgba(242,237,230,0.6)' }}>
                        {unlockedCount} / {achievements.length} Unlocked ({progressPercent}%)
                      </span>
                      <div
                        style={{
                          width: 120,
                          height: 6,
                          background: 'rgba(255,255,255,0.08)',
                          borderRadius: 3,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${progressPercent}%`,
                            height: '100%',
                            background: progressPercent === 100 ? '#4ade80' : '#D97757',
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sub-tabs: Achievements | Statistics */}
                <div style={{ display: 'flex', gap: 6, background: '#1B1713', padding: 4, borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
                  <button
                    type="button"
                    onClick={() => setActiveTab('achievements')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 14px',
                      borderRadius: 7,
                      border: 'none',
                      background: activeTab === 'achievements' ? '#D97757' : 'transparent',
                      color: activeTab === 'achievements' ? '#fff' : 'rgba(242,237,230,0.5)',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <Trophy size={13} />
                    Achievements ({achievements.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('stats')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 14px',
                      borderRadius: 7,
                      border: 'none',
                      background: activeTab === 'stats' ? '#D97757' : 'transparent',
                      color: activeTab === 'stats' ? '#fff' : 'rgba(242,237,230,0.5)',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <BarChart3 size={13} />
                    Stats ({stats.length})
                  </button>
                </div>
              </div>

              {/* Error Banner */}
              {samError && (
                <div style={{ margin: 16, padding: 12, borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertTriangle size={16} />
                  <span>{samError}</span>
                </div>
              )}

              {/* ── TAB CONTENT ── */}
              {samLoading ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'rgba(242,237,230,0.4)' }}>
                  <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
                  <span style={{ fontSize: 13 }}>Querying Steam client for achievements...</span>
                </div>
              ) : activeTab === 'achievements' ? (
                /* ── ACHIEVEMENTS TAB ── */
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                  {/* Controls Bar: Filter, Sort, Search, Selection Shortcuts */}
                  <div
                    style={{
                      padding: '10px 20px',
                      borderBottom: '1px solid rgba(242,237,230,0.06)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      flexWrap: 'wrap',
                    }}
                  >
                    {/* Left: Filter Pills, Sort & Search */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {/* Filter Pills */}
                      <div style={{ display: 'flex', gap: 4, background: '#1B1713', padding: 3, borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
                        {(['all', 'unlocked', 'locked'] as AchFilter[]).map((f) => (
                          <button
                            key={f}
                            type="button"
                            onClick={() => setAchFilter(f)}
                            style={{
                              padding: '4px 10px',
                              borderRadius: 6,
                              border: 'none',
                              background: achFilter === f ? 'rgba(217,119,87,0.2)' : 'transparent',
                              color: achFilter === f ? '#D97757' : 'rgba(242,237,230,0.5)',
                              fontSize: 11,
                              fontWeight: 600,
                              textTransform: 'capitalize',
                              cursor: 'pointer',
                            }}
                          >
                            {f}
                          </button>
                        ))}
                      </div>

                      {/* Sort Dropdown */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#1B1713', padding: '4px 8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
                        <ArrowUpDown size={12} color="rgba(242,237,230,0.4)" />
                        <select
                          value={achSort}
                          onChange={(e) => setAchSort(e.target.value as AchSort)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'rgba(242,237,230,0.7)',
                            fontSize: 11,
                            outline: 'none',
                            cursor: 'pointer',
                          }}
                        >
                          <option value="rarity" style={{ background: '#1B1713' }}>Rarity (Rarest First)</option>
                          <option value="name" style={{ background: '#1B1713' }}>Name (A-Z)</option>
                          <option value="status" style={{ background: '#1B1713' }}>Unlocked Status</option>
                        </select>
                      </div>

                      {/* Search input */}
                      <input
                        type="text"
                        placeholder="Search achievements..."
                        value={achSearch}
                        onChange={(e) => setAchSearch(e.target.value)}
                        style={{
                          background: '#1B1713',
                          border: '1px solid rgba(242,237,230,0.08)',
                          borderRadius: 8,
                          padding: '5px 10px',
                          fontSize: 12,
                          color: '#F2EDE6',
                          outline: 'none',
                          width: 160,
                        }}
                      />
                    </div>

                    {/* Right: Quick Selection Buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button
                        type="button"
                        onClick={handleSelectAllFiltered}
                        style={{
                          padding: '4px 8px',
                          borderRadius: 6,
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          color: 'rgba(242,237,230,0.7)',
                          fontSize: 11,
                          fontWeight: 500,
                          cursor: 'pointer',
                        }}
                      >
                        Select All
                      </button>

                      <button
                        type="button"
                        onClick={handleSelectLockedOnly}
                        style={{
                          padding: '4px 8px',
                          borderRadius: 6,
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          color: 'rgba(242,237,230,0.7)',
                          fontSize: 11,
                          fontWeight: 500,
                          cursor: 'pointer',
                        }}
                      >
                        Select Locked ({lockedCount})
                      </button>

                      <button
                        type="button"
                        onClick={handleSelectUnlockedOnly}
                        style={{
                          padding: '4px 8px',
                          borderRadius: 6,
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          color: 'rgba(242,237,230,0.7)',
                          fontSize: 11,
                          fontWeight: 500,
                          cursor: 'pointer',
                        }}
                      >
                        Select Unlocked ({unlockedCount})
                      </button>

                      {selectedAchIds.size > 0 && (
                        <button
                          type="button"
                          onClick={handleClearSelection}
                          style={{
                            padding: '4px 8px',
                            borderRadius: 6,
                            background: 'rgba(239,68,68,0.1)',
                            border: '1px solid rgba(239,68,68,0.2)',
                            color: '#f87171',
                            fontSize: 11,
                            fontWeight: 500,
                            cursor: 'pointer',
                          }}
                        >
                          Clear ({selectedAchIds.size})
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => selectedGame && loadSamData(selectedGame.appId)}
                        disabled={actionLoading}
                        style={{
                          padding: '5px',
                          borderRadius: 6,
                          background: 'rgba(242,237,230,0.05)',
                          border: '1px solid rgba(242,237,230,0.1)',
                          color: 'rgba(242,237,230,0.5)',
                          cursor: 'pointer',
                          marginLeft: 4,
                        }}
                        title="Reload"
                      >
                        <RefreshCw size={13} />
                      </button>
                    </div>
                  </div>

                  {/* ── STAGED ACTIONS BAR (VISIBLE WHEN USER SELECTS ACHIEVEMENTS) ── */}
                  <div
                    style={{
                      padding: '10px 20px',
                      background: selectedAchIds.size > 0 ? 'rgba(217,119,87,0.12)' : 'rgba(255,255,255,0.02)',
                      borderBottom: '1px solid rgba(242,237,230,0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'background 0.2s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Sparkles size={15} color={selectedAchIds.size > 0 ? '#D97757' : 'rgba(242,237,230,0.4)'} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: selectedAchIds.size > 0 ? '#F2EDE6' : 'rgba(242,237,230,0.5)' }}>
                        {selectedAchIds.size > 0 ? (
                          <>
                            <strong style={{ color: '#D97757' }}>{selectedAchIds.size}</strong> achievement{selectedAchIds.size === 1 ? '' : 's'} selected
                          </>
                        ) : (
                          'Select achievements using checkboxes below to unlock or lock them'
                        )}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {/* Unlock Selected Button */}
                      <button
                        type="button"
                        onClick={() => setConfirmUnlockModal({ open: true, mode: 'selected', count: selectedAchIds.size })}
                        disabled={selectedAchIds.size === 0 || actionLoading}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '6px 14px',
                          borderRadius: 8,
                          background: selectedAchIds.size > 0 ? '#22c55e' : 'rgba(255,255,255,0.05)',
                          border: 'none',
                          color: selectedAchIds.size > 0 ? '#000' : 'rgba(242,237,230,0.3)',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: selectedAchIds.size > 0 ? 'pointer' : 'not-allowed',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <Unlock size={13} strokeWidth={2.5} />
                        Unlock Selected ({selectedAchIds.size})
                      </button>

                      {/* Lock Selected Button */}
                      <button
                        type="button"
                        onClick={() => setConfirmLockModal({ open: true, mode: 'selected', count: selectedAchIds.size })}
                        disabled={selectedAchIds.size === 0 || actionLoading}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '6px 14px',
                          borderRadius: 8,
                          background: selectedAchIds.size > 0 ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.05)',
                          border: `1px solid ${selectedAchIds.size > 0 ? 'rgba(239,68,68,0.4)' : 'transparent'}`,
                          color: selectedAchIds.size > 0 ? '#f87171' : 'rgba(242,237,230,0.3)',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: selectedAchIds.size > 0 ? 'pointer' : 'not-allowed',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <Lock size={13} />
                        Lock Selected ({selectedAchIds.size})
                      </button>

                      {/* Unlock All (Global action with modal) */}
                      <button
                        type="button"
                        onClick={() => setConfirmUnlockModal({ open: true, mode: 'all', count: achievements.length })}
                        disabled={actionLoading || achievements.length === 0}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                          padding: '6px 12px',
                          borderRadius: 8,
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          color: 'rgba(242,237,230,0.7)',
                          fontSize: 12,
                          fontWeight: 500,
                          cursor: 'pointer',
                        }}
                      >
                        Unlock All
                      </button>

                      {/* Lock All (Global action with modal) */}
                      <button
                        type="button"
                        onClick={() => setConfirmLockModal({ open: true, mode: 'all', count: achievements.length })}
                        disabled={actionLoading || achievements.length === 0}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                          padding: '6px 12px',
                          borderRadius: 8,
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          color: 'rgba(242,237,230,0.7)',
                          fontSize: 12,
                          fontWeight: 500,
                          cursor: 'pointer',
                        }}
                      >
                        Lock All
                      </button>
                    </div>
                  </div>

                  {actionProgress && (
                    <div aria-live="polite" style={{ margin: '0 20px 12px', padding: '10px 12px', borderRadius: 9, background: 'rgba(217,119,87,0.08)', border: '1px solid rgba(217,119,87,0.2)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 7 }}>
                        <strong>{actionProgress.action === 'unlock' ? 'Unlocking' : 'Locking'}: {actionProgress.processed} / {actionProgress.total}</strong>
                        <span style={{ color: '#86efac' }}>Success {actionProgress.success}</span>
                        <span style={{ color: '#fca5a5' }}>Failed {actionProgress.failed}</span>
                      </div>
                      <div role="progressbar" aria-label={`${actionProgress.action} achievement progress`} aria-valuemin={0} aria-valuemax={actionProgress.total} aria-valuenow={actionProgress.processed} style={{ height: 7, borderRadius: 999, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                        <div style={{ width: `${actionProgress.total ? (actionProgress.processed / actionProgress.total) * 100 : 0}%`, height: '100%', background: actionProgress.failed ? '#f59e0b' : '#22c55e', transition: 'width 120ms ease' }} />
                      </div>
                    </div>
                  )}
                  {/* Achievements Grid / List */}
                  <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
                    {filteredAchievements.length === 0 ? (
                      <div style={{ padding: '40px', textAlign: 'center', color: 'rgba(242,237,230,0.3)', fontSize: 13 }}>
                        No achievements match the current filters.
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 10 }}>
                        {filteredAchievements.map((ach) => {
                          const percent = ach.percent !== undefined ? Math.round(ach.percent * 10) / 10 : null;
                          const isGold = percent !== null && percent < 10;
                          const isSilver = percent !== null && percent >= 10 && percent < 25;
                          const isBronze = percent !== null && percent >= 25 && percent < 50;
                          const isSelected = selectedAchIds.has(ach.id);

                          return (
                            <div
                              key={ach.id}
                              onClick={() => {
                                if (!ach.protectedAchievement) {
                                  handleToggleSelectAch(ach.id);
                                }
                              }}
                              style={{
                                background: isSelected
                                  ? 'rgba(217,119,87,0.14)'
                                  : ach.achieved
                                  ? 'rgba(34,197,94,0.04)'
                                  : '#1B1713',
                                border: `1px solid ${
                                  isSelected
                                    ? '#D97757'
                                    : ach.achieved
                                    ? 'rgba(34,197,94,0.25)'
                                    : 'rgba(242,237,230,0.06)'
                                }`,
                                borderRadius: 12,
                                padding: '10px 12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                cursor: ach.protectedAchievement ? 'not-allowed' : 'pointer',
                                opacity: ach.protectedAchievement ? 0.6 : 1,
                                transition: 'all 0.15s ease',
                                userSelect: 'none',
                                contentVisibility: 'auto',
                                contain: 'layout paint style',
                                containIntrinsicSize: '320px 68px',
                              }}
                            >
                              {/* Checkbox */}
                              <div
                                style={{
                                  width: 20,
                                  height: 20,
                                  borderRadius: 6,
                                  border: `1.5px solid ${isSelected ? '#D97757' : 'rgba(255,255,255,0.2)'}`,
                                  background: isSelected ? '#D97757' : 'rgba(255,255,255,0.04)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                {isSelected && <Check size={13} strokeWidth={3} color="#fff" />}
                              </div>

                              {/* Achievement Icon */}
                              <div style={{ position: 'relative', width: 44, height: 44, flexShrink: 0 }}>
                                <img
                                  src={ach.achieved ? ach.iconNormal : (ach.iconLocked || ach.iconNormal)}
                                  alt=""
                                  loading="lazy"
                                  decoding="async"
                                  onError={(e) => {
                                    (e.currentTarget as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" fill="%23222"><rect width="44" height="44"/></svg>';
                                  }}
                                  style={{
                                    width: 44,
                                    height: 44,
                                    borderRadius: 8,
                                    objectFit: 'cover',
                                    filter: ach.achieved ? 'none' : 'grayscale(100%) brightness(0.6)',
                                    border: `1px solid ${ach.achieved ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.08)'}`,
                                  }}
                                />
                                {ach.achieved && (
                                  <div
                                    style={{
                                      position: 'absolute',
                                      bottom: -2,
                                      right: -2,
                                      background: '#22c55e',
                                      borderRadius: '50%',
                                      width: 14,
                                      height: 14,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      color: '#000',
                                    }}
                                  >
                                    <CheckCircle2 size={12} strokeWidth={3} />
                                  </div>
                                )}
                              </div>

                              {/* Info */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                                  <p
                                    style={{
                                      margin: 0,
                                      fontSize: 13,
                                      fontWeight: 600,
                                      color: ach.achieved ? '#F2EDE6' : 'rgba(242,237,230,0.7)',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {ach.name}
                                  </p>

                                  {/* Rarity badge */}
                                  {percent !== null && (
                                    <span
                                      style={{
                                        fontSize: 10,
                                        fontWeight: 700,
                                        fontFamily: '"JetBrains Mono", monospace',
                                        padding: '1px 6px',
                                        borderRadius: 4,
                                        background: isGold
                                          ? 'rgba(234,179,8,0.15)'
                                          : isSilver
                                          ? 'rgba(148,163,184,0.15)'
                                          : isBronze
                                          ? 'rgba(217,119,87,0.15)'
                                          : 'rgba(255,255,255,0.05)',
                                        color: isGold
                                          ? '#facc15'
                                          : isSilver
                                          ? '#cbd5e1'
                                          : isBronze
                                          ? '#D97757'
                                          : 'rgba(242,237,230,0.4)',
                                      }}
                                    >
                                      {percent}%
                                    </span>
                                  )}
                                </div>

                                <p
                                  style={{
                                    margin: '2px 0 0',
                                    fontSize: 11,
                                    color: 'rgba(242,237,230,0.4)',
                                    lineHeight: 1.3,
                                    overflow: 'hidden',
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                  }}
                                >
                                  {ach.description || 'No description available'}
                                </p>

                                {ach.protectedAchievement && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                                    <Shield size={10} color="#f87171" />
                                    <span style={{ fontSize: 10, color: '#f87171', fontWeight: 600 }}>Protected</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* ── STATISTICS TAB ── */
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                  <div
                    style={{
                      padding: '12px 20px',
                      borderBottom: '1px solid rgba(242,237,230,0.06)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Game Statistics Editor</p>
                      <p style={{ margin: 0, fontSize: 11, color: 'rgba(242,237,230,0.4)' }}>
                        Directly view and adjust numeric stat counters stored in Steam.
                      </p>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => setShowResetStatsConfirm(true)}
                        disabled={actionLoading}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 8,
                          background: 'rgba(239,68,68,0.1)',
                          border: '1px solid rgba(239,68,68,0.25)',
                          color: '#f87171',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Reset All
                      </button>

                      <button
                        type="button"
                        onClick={handleSaveStats}
                        disabled={actionLoading}
                        style={{
                          padding: '6px 16px',
                          borderRadius: 8,
                          background: '#D97757',
                          border: 'none',
                          color: '#fff',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        {actionLoading && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />}
                        Save Stats
                      </button>
                    </div>
                  </div>

                  {/* Stats List */}
                  <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
                    {stats.length === 0 ? (
                      <div style={{ padding: '40px', textAlign: 'center', color: 'rgba(242,237,230,0.3)', fontSize: 13 }}>
                        This game does not expose any editable statistics.
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
                        {stats.map((s) => (
                          <div
                            key={s.id}
                            style={{
                              background: '#1B1713',
                              border: '1px solid rgba(242,237,230,0.06)',
                              borderRadius: 12,
                              padding: '12px 14px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 6,
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: 13, fontWeight: 600, color: '#F2EDE6' }}>
                                {s.name || s.id}
                              </span>
                              <span
                                style={{
                                  fontSize: 10,
                                  fontFamily: '"JetBrains Mono", monospace',
                                  padding: '1px 5px',
                                  borderRadius: 4,
                                  background: 'rgba(255,255,255,0.05)',
                                  color: 'rgba(242,237,230,0.4)',
                                }}
                              >
                                {s.statType.toUpperCase()}
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <input
                                type={s.statType === 'integer' || s.statType === 'float' ? 'number' : 'text'}
                                value={modifiedStats[s.id] ?? s.value}
                                onChange={(e) => {
                                  setModifiedStats((prev) => ({
                                    ...prev,
                                    [s.id]: e.target.value,
                                  }));
                                }}
                                style={{
                                  flex: 1,
                                  background: '#110E0B',
                                  border: '1px solid rgba(242,237,230,0.1)',
                                  borderRadius: 6,
                                  padding: '6px 10px',
                                  fontSize: 13,
                                  color: '#F2EDE6',
                                  fontFamily: '"JetBrains Mono", monospace',
                                  outline: 'none',
                                }}
                              />
                              {s.incrementOnly && (
                                <span title="Increment Only" style={{ color: '#fbbf24' }}>
                                  <Lock size={14} />
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {selectedGame && <AuditLogPanel entries={auditLog} open={showAuditLog} onToggle={() => setShowAuditLog((value) => !value)} />}

      {/* ── UNLOCK CONFIRMATION MODAL ── */}
      <ConfirmModal
        open={confirmUnlockModal.open}
        onClose={() => setConfirmUnlockModal({ open: false, mode: 'selected', count: 0 })}
        onConfirm={() => handleExecuteUnlock(confirmUnlockModal.mode)}
        title={confirmUnlockModal.mode === 'all' ? 'Unlock All Achievements' : 'Unlock Selected Achievements'}
        description={
          <>
            <span style={{ display: 'block' }}>Are you sure you want to unlock {confirmUnlockModal.mode === 'all' ? 'all' : <strong className="text-white">{confirmUnlockModal.count}</strong>} achievement{confirmUnlockModal.count === 1 ? '' : 's'} for <strong className="text-white">{selectedGame?.name}</strong> in Steam?</span>
            <span style={{ display: 'block', marginTop: 10, padding: 8, borderRadius: 7, background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.25)', color: '#facc15', fontSize: 12 }}><AlertTriangle size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} />This changes your Steam profile permanently and may affect achievement integrity.</span>
          </>
        }
        confirmText="Unlock Now"
        cancelText="Cancel"
        variant="primary"
        loading={actionLoading}
      />

      {/* ── LOCK CONFIRMATION MODAL ── */}
      <ConfirmModal
        open={confirmLockModal.open}
        onClose={() => setConfirmLockModal({ open: false, mode: 'selected', count: 0 })}
        onConfirm={() => handleExecuteLock(confirmLockModal.mode)}
        title={confirmLockModal.mode === 'all' ? 'Lock All Achievements' : 'Lock Selected Achievements'}
        description={
          <>
            <span style={{ display: 'block' }}>Are you sure you want to lock/relock {confirmLockModal.mode === 'all' ? 'all' : <strong className="text-white">{confirmLockModal.count}</strong>} achievement{confirmLockModal.count === 1 ? '' : 's'} for <strong className="text-white">{selectedGame?.name}</strong>?</span>
            <span style={{ display: 'block', marginTop: 10, padding: 8, borderRadius: 7, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', fontSize: 12 }}><AlertTriangle size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} />This is destructive and cannot be automatically undone.</span>
          </>
        }
        confirmText="Lock Achievements"
        cancelText="Cancel"
        variant="danger"
        loading={actionLoading}
      />

      {/* ── RESET STATS CONFIRMATION MODAL ── */}
      <ConfirmModal
        open={showResetStatsConfirm}
        onClose={() => setShowResetStatsConfirm(false)}
        onConfirm={handleExecuteResetStats}
        title="Reset All Statistics"
        description={
          <>
            Are you sure you want to reset all statistics for <strong className="text-white">{selectedGame?.name}</strong> to default/zero?
          </>
        }
        confirmText="Reset Stats"
        cancelText="Cancel"
        variant="danger"
        loading={actionLoading}
      />
    </div>
  );
}
