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
  Laptop
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

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

export default function SettingsPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [terminatingId, setTerminatingId] = useState<string | null>(null);
  const [terminatingAll, setTerminatingAll] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [appVersion, setAppVersion] = useState<string>('...');

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/v2/sessions');
      const list: SessionItem[] = res.data?.sessions || [];
      
      // Ensure at least 1 session is marked current if available, and sort current session first
      let hasCurrent = list.some(s => s.isCurrent);
      if (!hasCurrent && list.length > 0) {
        list[0].isCurrent = true;
      }
      list.sort((a, b) => (b.isCurrent ? 1 : 0) - (a.isCurrent ? 1 : 0));

      setSessions(list);
    } catch (e: any) {
      showToast(e?.message || 'Error loading sessions', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
    getVersion().then(setAppVersion).catch(() => setAppVersion('2.2.5'));
  }, [loadSessions]);

  const terminateSession = async (sessionId: string) => {
    setTerminatingId(sessionId);
    try {
      await api.delete(`/api/v2/sessions/${sessionId}`);
      setSessions(prev => prev.filter(s => (s.id || s._id) !== sessionId));
      showToast('The session concluded successfully.', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Error ending the session', 'error');
    } finally {
      setTerminatingId(null);
    }
  };

  const terminateAllOther = async () => {
    setTerminatingAll(true);
    try {
      await api.delete('/api/v2/sessions?keepCurrent=true');
      setSessions(prev => prev.filter(s => s.isCurrent));
      showToast('All other sessions have terminated.', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Error while terminating sessions', 'error');
    } finally {
      setTerminatingAll(false);
    }
  };

  const formatTimestamp = (iso?: string) => {
    if (!iso) return 'Noma\'lum';
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
      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl text-sm font-medium transition-all ${
            toast.type === 'success'
              ? 'bg-emerald-500/15 border border-emerald-500/25 text-emerald-300'
              : 'bg-red-500/15 border border-red-500/25 text-red-300'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.18em] text-[#D97757] font-semibold mb-1">
          Boshqaruv
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
                All computers and browsers used to access your account
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadSessions}
              disabled={loading}
              className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/60 hover:text-white hover:bg-white/[0.08] disabled:opacity-50 transition-colors"
              title="Sessiyalarni yangilash"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>

            {sessions.filter(s => !s.isCurrent).length > 0 && (
              <button
                onClick={terminateAllOther}
                disabled={terminatingAll}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 disabled:opacity-50 transition-colors"
              >
                {terminatingAll ? <Loader2 size={13} className="animate-spin" /> : <LogOut size={13} />}
                Terminate all
              </button>
            )}
          </div>
        </div>

        {/* Sessions List */}
        <div className="space-y-3">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 w-full bg-white/[0.02] animate-pulse rounded-xl border border-white/[0.04]" />
            ))
          ) : sessions.length === 0 ? (
            <div className="text-center py-10 text-white/30 text-sm">
              <Globe size={28} className="mx-auto mb-2 opacity-30" />
              There are no active sessions.
            </div>
          ) : (
            sessions.map(session => {
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
                            CURRENT (CURRENT SESSION)
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
                            `Oxirgi faollik: ${formatTimestamp(session.last_used_at || session.created_at || session.createdAt)}`
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
                      onClick={() => terminateSession(sid)}
                      disabled={terminatingId === sid}
                      className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                                bg-red-500/10 text-red-400 border border-red-500/20
                                hover:bg-red-500/20 hover:text-red-300 disabled:opacity-50 transition-colors"
                      title="End the session"
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
            <h2 className="text-base font-semibold text-[#F2EDE6]">About the Program</h2>
            <p className="text-xs text-white/45">Client system information</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
            <p className="text-[11px] text-white/40 uppercase tracking-wider font-semibold">Version</p>
            <p className="text-sm font-mono text-[#F2EDE6] mt-1">v{appVersion}</p>
          </div>

          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
            <p className="text-[11px] text-white/40 uppercase tracking-wider font-semibold">Foydalanuvchi Roli</p>
            <p className="text-sm font-mono text-[#D97757] font-bold mt-1 uppercase">
              {user?.role || 'user'}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
            <p className="text-[11px] text-white/40 uppercase tracking-wider font-semibold">Tizim</p>
            <p className="text-sm font-mono text-emerald-400 mt-1">Tauri 2.0 Desktop</p>
          </div>
        </div>
      </div>
    </div>
  );
}
