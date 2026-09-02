import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import {
  Trophy, BarChart3, Search, RefreshCw, Lock, Unlock,
  CheckCircle2, AlertTriangle, Shield, Wifi, WifiOff,
  ChevronRight, Loader2, Users, ArrowUpDown
} from 'lucide-react';
import { toast } from '@/shared/ui/Toast';

// ────────────────────────────────────────────────────────────────────────────
// TYPES
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

interface AchievementData {
  achievements: Achievement[];
  stats: Stat[];
}

type AchFilter = 'all' | 'unlocked' | 'locked';
type AchSort = 'rarity' | 'name' | 'status';

const CACHE_KEY = 'yolnoma_steam_games_cache';

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
  const [gameSearch, setGameSearch] = useState('');
  const [selectedGame, setSelectedGame] = useState<SteamGame | null>(null);

  // ── SAM Data for selected game
  const [activeTab, setActiveTab] = useState<'achievements' | 'stats'>('achievements');
  const [samLoading, setSamLoading] = useState(false);
  const [samError, setSamError] = useState<string | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [stats, setStats] = useState<Stat[]>([]);
  const [modifiedStats, setModifiedStats] = useState<Record<string, number | string>>({});

  // ── Achievement filters & search
  const [achFilter, setAchFilter] = useState<AchFilter>('all');
  const [achSort, setAchSort] = useState<AchSort>('rarity');
  const [achSearch, setAchSearch] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Check Steam client status
  const checkSteam = useCallback(async () => {
    try {
      const running = await invoke<boolean>('steam_is_running');
      setSteamRunning(running);
    } catch {
      setSteamRunning(false);
    }
  }, []);

  useEffect(() => {
    checkSteam();
    const interval = setInterval(checkSteam, 4000);
    return () => clearInterval(interval);
  }, [checkSteam]);

  // Load Steam accounts on mount
  useEffect(() => {
    (async () => {
      try {
        const users = await invoke<SteamUser[]>('get_steam_accounts');
        setAccounts(users);
        const recent = users.find((u) => u.mostRecent) ?? users[0];
        if (recent) setSelectedSteamId(recent.steamId);
      } catch (err: unknown) {
        console.error('Failed to load accounts', err);
      }
    })();
  }, []);

  // Load games for selected account
  const loadGames = useCallback(async () => {
    if (!selectedSteamId) return;

    // Check localStorage cache first
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const cache = JSON.parse(raw);
        if (cache.steamId === selectedSteamId && cache.games?.length > 0) {
          setGames(cache.games);
          return;
        }
      }
    } catch {
      // ignore
    }

    setGamesLoading(true);
    try {
      const list = await invoke<SteamGame[]>('get_steam_games', {
        steamId: selectedSteamId,
      });
      list.sort((a, b) => b.playtimeForever - a.playtimeForever);
      setGames(list);
    } catch (e: unknown) {
      console.error(e);
    } finally {
      setGamesLoading(false);
    }
  }, [selectedSteamId]);

  useEffect(() => {
    if (selectedSteamId) loadGames();
  }, [selectedSteamId, loadGames]);

  // Load SAM data for a specific game
  const loadSamData = useCallback(async (appId: number) => {
    setSamLoading(true);
    setSamError(null);
    try {
      const data = await invoke<AchievementData>('get_achievement_data', { appId });
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

  // Handle game selection
  const handleSelectGame = useCallback((game: SteamGame) => {
    setSelectedGame(game);
    setSearchParams({ appId: String(game.appId) });
    loadSamData(game.appId);
  }, [loadSamData, setSearchParams]);

  // Auto-select game if urlAppId exists
  useEffect(() => {
    if (urlAppId && games.length > 0) {
      const found = games.find((g) => g.appId === urlAppId);
      if (found) {
        if (!selectedGame || selectedGame.appId !== urlAppId) {
          handleSelectGame(found);
        }
      } else if (!selectedGame || selectedGame.appId !== urlAppId) {
        // If not in library list yet, create minimal object and load
        const fallbackGame: SteamGame = {
          appId: urlAppId,
          name: `App ID: ${urlAppId}`,
          playtimeForever: 0,
        };
        setSelectedGame(fallbackGame);
        loadSamData(urlAppId);
      }
    }
  }, [urlAppId, games, selectedGame, handleSelectGame, loadSamData]);

  // ── Achievement Handlers
  const handleToggleAchievement = async (ach: Achievement) => {
    if (!selectedGame) return;
    if (ach.protectedAchievement) {
      toast.warning('This achievement is server-side protected and cannot be modified.');
      return;
    }

    const nextState = !ach.achieved;
    try {
      await invoke('set_achievement', {
        appId: selectedGame.appId,
        achId: ach.id,
        unlock: nextState,
      });

      setAchievements((prev) =>
        prev.map((a) => (a.id === ach.id ? { ...a, achieved: nextState } : a))
      );
      toast.success(`${nextState ? 'Unlocked' : 'Locked'}: ${ach.name}`);
    } catch (err: unknown) {
      toast.error(String(err) || 'Failed to update achievement');
    }
  };

  const handleUnlockAll = async () => {
    if (!selectedGame) return;
    setActionLoading(true);
    try {
      await invoke('unlock_all_achievements', { appId: selectedGame.appId });
      setAchievements((prev) =>
        prev.map((a) => (a.protectedAchievement ? a : { ...a, achieved: true }))
      );
      toast.success('All unlocked achievements synchronized with Steam!');
    } catch (err: unknown) {
      toast.error(String(err) || 'Failed to unlock all achievements');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLockAll = async () => {
    if (!selectedGame) return;
    setActionLoading(true);
    try {
      await invoke('lock_all_achievements', { appId: selectedGame.appId });
      setAchievements((prev) =>
        prev.map((a) => (a.protectedAchievement ? a : { ...a, achieved: false }))
      );
      toast.success('All achievements locked!');
    } catch (err: unknown) {
      toast.error(String(err) || 'Failed to lock all achievements');
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

      await invoke('update_stats', {
        appId: selectedGame.appId,
        statsJson: JSON.stringify(payload),
      });

      toast.success('Statistics successfully updated in Steam!');
      loadSamData(selectedGame.appId);
    } catch (err: unknown) {
      toast.error(String(err) || 'Failed to update statistics');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetStats = async () => {
    if (!selectedGame) return;
    if (!window.confirm('Are you sure you want to reset all stats for this game?')) return;

    setActionLoading(true);
    try {
      await invoke('reset_all_stats', { appId: selectedGame.appId });
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
    let list = achievements.filter((a) => {
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
  const progressPercent = achievements.length > 0 ? Math.round((unlockedCount / achievements.length) * 100) : 0;

  // Filtered Game Library
  const filteredGames = games.filter((g) =>
    g.name.toLowerCase().includes(gameSearch.toLowerCase()) || String(g.appId).includes(gameSearch)
  );

  return (
    <div
      style={{
        fontFamily: '"Inter", sans-serif',
        color: '#F2EDE6',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      {/* ── HEADER ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span
              style={{
                fontSize: 11,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: '#D97757',
                fontWeight: 700,
              }}
            >
              Steam Toolkit
            </span>
            <span
              style={{
                fontSize: 10,
                fontFamily: '"JetBrains Mono", monospace',
                padding: '2px 8px',
                borderRadius: 4,
                background: 'rgba(217,119,87,0.15)',
                color: '#D97757',
                fontWeight: 700,
              }}
            >
              SAM PRO
            </span>
          </div>
          <h1
            style={{
              fontFamily: '"Georgia", serif',
              fontSize: 28,
              fontWeight: 500,
              margin: 0,
              letterSpacing: '-0.02em',
            }}
          >
            Steam Achievement Manager
          </h1>
        </div>

        {/* Steam Status Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '7px 14px',
            background: steamRunning ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
            border: `1px solid ${steamRunning ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 500,
            color: steamRunning ? '#4ade80' : '#f87171',
          }}
        >
          {steamRunning ? (
            <>
              <Wifi size={13} />
              Steam Client Connected
            </>
          ) : (
            <>
              <WifiOff size={13} />
              Steam Client Offline
            </>
          )}
        </div>
      </div>

      {/* ── MAIN WORKSPACE (SPLIT VIEW) ── */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 16 }}>
        {/* ── LEFT PANEL: GAME PICKER (280px) ── */}
        <div
          style={{
            width: 290,
            background: '#181410',
            border: '1px solid rgba(242,237,230,0.08)',
            borderRadius: 16,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Account Selector */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(242,237,230,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Users size={14} color="#D97757" />
              <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(242,237,230,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Account
              </span>
            </div>
            {accounts.length > 0 ? (
              <select
                value={selectedSteamId}
                onChange={(e) => setSelectedSteamId(e.target.value)}
                style={{
                  width: '100%',
                  background: '#1B1713',
                  border: '1px solid rgba(242,237,230,0.1)',
                  borderRadius: 8,
                  padding: '6px 10px',
                  color: '#F2EDE6',
                  fontSize: 12,
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                {accounts.map((u) => (
                  <option key={u.steamId} value={u.steamId}>
                    {u.personaName} {u.mostRecent ? '(Active)' : ''}
                  </option>
                ))}
              </select>
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {filteredGames.map((game) => {
                  const isSelected = selectedGame?.appId === game.appId;
                  return (
                    <button
                      key={game.appId}
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
                Choose a title from the library on the left to inspect achievements, unlock stats, or simulate milestones.
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
                  {/* Controls Bar: Filter, Sort, Search, Bulk Actions */}
                  <div
                    style={{
                      padding: '12px 20px',
                      borderBottom: '1px solid rgba(242,237,230,0.06)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      flexWrap: 'wrap',
                    }}
                  >
                    {/* Left: Filter Pills & Search */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {/* Filter Pills */}
                      <div style={{ display: 'flex', gap: 4, background: '#1B1713', padding: 3, borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
                        {(['all', 'unlocked', 'locked'] as AchFilter[]).map((f) => (
                          <button
                            key={f}
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
                          width: 170,
                        }}
                      />
                    </div>

                    {/* Right: Bulk Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        onClick={handleUnlockAll}
                        disabled={actionLoading}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                          padding: '6px 12px',
                          borderRadius: 8,
                          background: 'rgba(34,197,94,0.12)',
                          border: '1px solid rgba(34,197,94,0.3)',
                          color: '#4ade80',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        <Unlock size={12} />
                        Unlock All
                      </button>

                      <button
                        onClick={handleLockAll}
                        disabled={actionLoading}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
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
                        <Lock size={12} />
                        Lock All
                      </button>

                      <button
                        onClick={() => selectedGame && loadSamData(selectedGame.appId)}
                        disabled={actionLoading}
                        style={{
                          padding: '6px',
                          borderRadius: 8,
                          background: 'rgba(242,237,230,0.05)',
                          border: '1px solid rgba(242,237,230,0.1)',
                          color: 'rgba(242,237,230,0.5)',
                          cursor: 'pointer',
                        }}
                        title="Reload"
                      >
                        <RefreshCw size={13} />
                      </button>
                    </div>
                  </div>

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

                          return (
                            <div
                              key={ach.id}
                              onClick={() => handleToggleAchievement(ach)}
                              style={{
                                background: ach.achieved ? 'rgba(34,197,94,0.04)' : '#1B1713',
                                border: `1px solid ${ach.achieved ? 'rgba(34,197,94,0.25)' : 'rgba(242,237,230,0.06)'}`,
                                borderRadius: 12,
                                padding: '10px 12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
                                cursor: ach.protectedAchievement ? 'not-allowed' : 'pointer',
                                opacity: ach.protectedAchievement ? 0.6 : 1,
                                transition: 'all 0.15s ease',
                              }}
                            >
                              {/* Achievement Icon */}
                              <div style={{ position: 'relative', width: 44, height: 44, flexShrink: 0 }}>
                                <img
                                  src={ach.achieved ? ach.iconNormal : (ach.iconLocked || ach.iconNormal)}
                                  alt=""
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
                        onClick={handleResetStats}
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
    </div>
  );
}
