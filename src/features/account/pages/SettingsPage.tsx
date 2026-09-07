import { useState, useEffect, useCallback } from 'react';
import { getVersion } from '@tauri-apps/api/app';
import {
  Monitor,
  Smartphone,
  Globe,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Radio,
  LogOut,
  Info,
  Laptop,
  Sparkles,
} from 'lucide-react';
import { api } from '@/shared/api/http';
import { useAuth } from '@/features/auth/AuthContext';
import { toast } from '@/shared/ui/Toast';
import { ConfirmModal } from '@/shared/ui';
import { getErrorMessage } from '@/shared/lib/errors';
import { useUpdaterStore } from '@/shared/stores/updaterStore';

interface SessionItem {
  id?: string;
  _id?: string;
  device: string;
  ip: string;
  user_agent?: string;
  created_at?: string;
  createdAt?: string;
  last_used_at?: string;
  lastUsedAt?: string;
  isCurrent?: boolean;
}

interface SessionsApiResponse {
  success?: boolean;
  message?: string;
  data?: {
    sessions?: SessionItem[];
    currentSessionId?: string | null;
  };
  sessions?: SessionItem[];
  currentSessionId?: string | null;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const {
    status: updaterStatus,
    updateInfo,
    progress: updaterProgress,
    checkForUpdates,
    openModal: openUpdateModal,
  } = useUpdaterStore();
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [terminatingId, setTerminatingId] = useState<string | null>(null);
  const [terminatingAll, setTerminatingAll] = useState(false);
  const [appVersion, setAppVersion] = useState<string>('...');

  // Confirmation modal states
  const [sessionToTerminate, setSessionToTerminate] = useState<SessionItem | null>(null);
  const [showTerminateAllConfirm, setShowTerminateAllConfirm] = useState(false);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<SessionsApiResponse>('/api/v2/sessions');
      
      const list: SessionItem[] =
        res?.data?.sessions ||
        res?.sessions ||
        (Array.isArray(res?.data) ? (res.data as unknown as SessionItem[]) : []) ||
        (Array.isArray(res) ? (res as unknown as SessionItem[]) : []);

      const currentSid = res?.data?.currentSessionId || res?.currentSessionId || list.find((s) => s.isCurrent)?.id;
      if (currentSid) {
        localStorage.setItem('yolnoma_session_id', currentSid);
      }

      // Ensure at least 1 session is marked current if available, and sort current session first
      const hasCurrent = list.some((s) => s.isCurrent);
      if (!hasCurrent && list.length > 0) {
        list[0].isCurrent = true;
      }
      list.sort((a, b) => (b.isCurrent ? 1 : 0) - (a.isCurrent ? 1 : 0));

      setSessions(list);
    } catch (e: unknown) {
      console.error('Failed to load sessions:', e);
      const msg = getErrorMessage(e, 'Failed to load active sessions.');
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
    getVersion().then(setAppVersion).catch(() => setAppVersion('2.2.5'));
  }, [loadSessions]);

  const handleExecuteTerminate = async () => {
    if (!sessionToTerminate) return;
    const sid = sessionToTerminate.id || sessionToTerminate._id || '';
    setTerminatingId(sid);
    setSessionToTerminate(null);

    try {
      await api.delete(`/api/v2/sessions/${sid}`);
      setSessions((prev) => prev.filter((s) => (s.id || s._id) !== sid));
      toast.success('The session concluded successfully.');
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, 'Error ending the session.'));
    } finally {
      setTerminatingId(null);
    }
  };

  const handleExecuteTerminateAll = async () => {
    setShowTerminateAllConfirm(false);
    setTerminatingAll(true);
    try {
      await api.delete('/api/v2/sessions?keepCurrent=true');
      setSessions((prev) => prev.filter((s) => s.isCurrent));
      toast.success('All other sessions have been terminated.');
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, 'Error while terminating sessions.'));
    } finally {
      setTerminatingAll(false);
    }
  };

  const formatTimestamp = (iso?: string) => {
    if (!iso) return 'Unknown';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
    } catch {
      return iso;
    }
  };

  const getDeviceIcon = (deviceStr: string) => {
    const lower = (deviceStr || '').toLowerCase();
    if (lower.includes('phone') || lower.includes('ios') || lower.includes('android')) {
      return Smartphone;
    }
    if (lower.includes('laptop') || lower.includes('macbook')) {
      return Laptop;
    }
    return Monitor;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20 select-none">
      {/* Header */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.18em] text-[#D97757] font-semibold mb-1">
          MANAGEMENT
        </p>
        <h1 className="font-serif text-3xl font-medium tracking-tight text-[#F2EDE6]">
          Settings & Sessions
        </h1>
        <p className="text-sm text-white/50 mt-1">
          Active devices, security, and software configuration.
        </p>
      </div>

      {/* Sessions Management Card */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#181410] p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4 border-b border-white/[0.06] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
              <Radio size={18} className="text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#F2EDE6]">Active Sessions</h2>
              <p className="text-xs text-white/45">
                All computers and browsers currently authorized to access your account
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadSessions}
              disabled={loading}
              className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/60 hover:text-white hover:bg-white/[0.08] disabled:opacity-50 transition-colors cursor-pointer"
              title="Refresh sessions"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>

            {sessions.filter((s) => !s.isCurrent).length > 0 && (
              <button
                onClick={() => setShowTerminateAllConfirm(true)}
                disabled={terminatingAll}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {terminatingAll ? <Loader2 size={13} className="animate-spin" /> : <LogOut size={13} />}
                Terminate All Others
              </button>
            )}
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <AlertCircle size={16} className="text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={loadSessions}
              className="px-3 py-1 rounded-lg text-xs font-medium bg-red-500/20 hover:bg-red-500/30 text-red-200 transition-colors shrink-0 cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* Sessions List */}
        <div className="space-y-3">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 w-full bg-white/[0.02] animate-pulse rounded-xl border border-white/[0.04]" />
            ))
          ) : sessions.length === 0 ? (
            <div className="text-center py-10 text-white/30 text-sm">
              <Globe size={28} className="mx-auto mb-2 opacity-30" />
              There are no active sessions recorded.
            </div>
          ) : (
            sessions.map((session) => {
              const DeviceIcon = getDeviceIcon(session.device);
              const sid = session.id || session._id || '';
              return (
                <div
                  key={sid}
                  className={`flex items-center justify-between gap-4 p-4 rounded-xl transition-all duration-200 border ${
                    session.isCurrent
                      ? 'bg-emerald-950/25 border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.08)]'
                      : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center border ${
                        session.isCurrent
                          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                          : 'bg-white/[0.04] border-white/[0.08] text-white/40'
                      }`}
                    >
                      <DeviceIcon size={16} />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <p className="text-sm font-semibold text-[#F2EDE6] truncate">
                          {session.device || 'Unknown device'}
                        </p>
                        {session.isCurrent && (
                          <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold tracking-wide border border-emerald-500/40 uppercase shadow-sm">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
                            CURRENT SESSION
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 mt-1.5 text-xs text-white/45 font-mono">
                        <span className="flex items-center gap-1">
                          <Globe size={11} className={session.isCurrent ? 'text-emerald-400' : 'text-white/40'} />
                          {session.ip}
                        </span>
                        <span>·</span>
                        <span className="text-white/40 font-sans">
                          {session.isCurrent ? (
                            <span className="text-emerald-400/90 font-medium">Currently in use</span>
                          ) : (
                            `Last active: ${formatTimestamp(session.last_used_at || session.created_at || session.createdAt)}`
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {session.isCurrent ? (
                    <div className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-xs font-semibold select-none">
                      <CheckCircle2 size={13} className="text-emerald-400" />
                      <span>This Device</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => setSessionToTerminate(session)}
                      disabled={terminatingId === sid}
                      className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                                bg-red-500/10 text-red-400 border border-red-500/20
                                hover:bg-red-500/20 hover:text-red-300 disabled:opacity-50 transition-colors cursor-pointer"
                      title="End this session"
                    >
                      {terminatingId === sid ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Trash2 size={12} />
                      )}
                      <span>Terminate</span>
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* App & System Information */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#181410] p-6 space-y-4">
        <div className="flex items-center gap-3 border-b border-white/[0.06] pb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
            <Info size={18} className="text-blue-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[#F2EDE6]">About the Application</h2>
            <p className="text-xs text-white/45">Client system & role information</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
            <p className="text-[11px] text-white/40 uppercase tracking-wider font-semibold">Version</p>
            <p className="text-sm font-mono text-[#F2EDE6] mt-1">v{appVersion}</p>
          </div>

          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
            <p className="text-[11px] text-white/40 uppercase tracking-wider font-semibold">ROLE</p>
            <p className="text-sm font-mono text-[#D97757] font-bold mt-1 uppercase">
              {user?.role || 'user'}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
            <p className="text-[11px] text-white/40 uppercase tracking-wider font-semibold">SYSTEM</p>
            <p className="text-sm font-mono text-emerald-400 mt-1">Tauri 2.0 Desktop</p>
          </div>
        </div>

        {/* Software Updates Row */}
        <div className="pt-4 border-t border-white/[0.06] flex items-center justify-between flex-wrap gap-3">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-[#F2EDE6]">Software Updates</p>
            <p className="text-xs text-white/45">
              {updaterStatus === 'checking' && (
                <span className="text-amber-400/90 flex items-center gap-1.5">
                  <Loader2 size={12} className="animate-spin" />
                  Checking for new updates...
                </span>
              )}
              {updaterStatus === 'update-available' && (
                <span className="text-amber-400 font-medium flex items-center gap-1.5">
                  <Sparkles size={12} />
                  New version v{updateInfo?.version} is available!
                </span>
              )}
              {updaterStatus === 'downloading' && (
                <span className="text-[#D97757] font-medium flex items-center gap-1.5">
                  <RefreshCw size={12} className="animate-spin" />
                  Downloading update ({updaterProgress}%)...
                </span>
              )}
              {updaterStatus === 'installing' && (
                <span className="text-emerald-400 font-medium flex items-center gap-1.5">
                  <Loader2 size={12} className="animate-spin" />
                  Installing update and relaunching...
                </span>
              )}
              {updaterStatus === 'up-to-date' && (
                <span className="text-emerald-400 font-medium flex items-center gap-1.5">
                  <CheckCircle2 size={12} />
                  You are on the latest version
                </span>
              )}
              {updaterStatus === 'error' && (
                <span className="text-red-400 flex items-center gap-1.5">
                  <AlertCircle size={12} />
                  Failed to check for updates
                </span>
              )}
              {updaterStatus === 'idle' && 'Check for new releases and security updates.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {updaterStatus === 'update-available' ? (
              <button
                onClick={openUpdateModal}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-[#D97757] to-amber-500 text-white shadow-md hover:brightness-110 transition-all cursor-pointer"
              >
                <Sparkles size={13} />
                <span>Update to v{updateInfo?.version}</span>
              </button>
            ) : (
              <button
                onClick={() => checkForUpdates({ silent: false })}
                disabled={updaterStatus === 'checking' || updaterStatus === 'downloading' || updaterStatus === 'installing'}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/[0.04] border border-white/[0.08] text-white/80 hover:text-white hover:bg-white/[0.08] disabled:opacity-50 transition-all cursor-pointer"
              >
                <RefreshCw size={13} className={updaterStatus === 'checking' ? 'animate-spin text-[#D97757]' : ''} />
                <span>{updaterStatus === 'checking' ? 'Checking...' : 'Check for updates'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Terminate Single Session Confirm Modal */}
      <ConfirmModal
        open={Boolean(sessionToTerminate)}
        onClose={() => setSessionToTerminate(null)}
        onConfirm={handleExecuteTerminate}
        title="Terminate Session"
        description={
          <>
            Are you sure you want to terminate session on <strong className="text-white font-semibold">"{sessionToTerminate?.device || 'this device'}"</strong> ({sessionToTerminate?.ip})? This device will be logged out immediately.
          </>
        }
        confirmText="Terminate Session"
        cancelText="Cancel"
        variant="danger"
        loading={Boolean(terminatingId)}
      />

      {/* Terminate All Other Sessions Confirm Modal */}
      <ConfirmModal
        open={showTerminateAllConfirm}
        onClose={() => setShowTerminateAllConfirm(false)}
        onConfirm={handleExecuteTerminateAll}
        title="Terminate All Other Sessions"
        description="Are you sure you want to log out of all other devices except this current session? All other active sessions will be terminated immediately."
        confirmText="Terminate All Others"
        cancelText="Cancel"
        variant="danger"
        loading={terminatingAll}
      />
    </div>
  );
}
