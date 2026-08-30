import React, { useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Monitor,
  Smartphone,
  Laptop,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  LogIn,
  Trash2,
  Clock,
  MapPin,
  RefreshCw,
} from 'lucide-react';
import { useAuth, UserProfile } from '@/features/auth/AuthContext';
import { sessionLimitApi, SessionEntry } from '@/features/auth/api/sessionLimitApi';
import { api } from '@/shared/api/http';
import { toast } from '@/shared/ui/Toast';
import { images } from '@/shared/assets/images';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function deviceIcon(deviceStr: string) {
  const lower = deviceStr.toLowerCase();
  if (lower.includes('android') || lower.includes('ios') || lower.includes('mobile')) {
    return <Smartphone size={18} className="text-[#D97757]" />;
  }
  if (lower.includes('desktop') || lower.includes('windows') || lower.includes('mac') || lower.includes('linux')) {
    return <Monitor size={18} className="text-[#D97757]" />;
  }
  return <Laptop size={18} className="text-[#D97757]" />;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SessionManagementPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const queryClient = useQueryClient();

  // tempCode is passed via React Router state — never in the URL
  const tempCode: string | undefined = (location.state as any)?.tempCode;

  const [terminating, setTerminating] = useState<Record<string, boolean>>({});
  const [isContinuing, setIsContinuing] = useState(false);

  // Redirect immediately if there is no tempCode
  React.useEffect(() => {
    if (!tempCode) {
      toast.error('Session expired or link invalid. Please sign in again.');
      navigate('/login', { replace: true });
    }
  }, [tempCode, navigate]);

  // ── Fetch sessions ─────────────────────────────────────────────────────────
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['session-limit-sessions', tempCode],
    queryFn: () => sessionLimitApi.getSessions(tempCode!),
    enabled: Boolean(tempCode),
    staleTime: 0,           // always refetch
    refetchInterval: 15_000, // keep the list fresh
    retry: 1,
  });

  const sessions = data?.sessions ?? [];
  const newDevice = data?.newDevice;
  const maxSessions = data?.maxSessions ?? 0;

  // Continue is enabled when the session count is strictly below the limit
  const canContinue = sessions.length < maxSessions;

  // ── Terminate a session ────────────────────────────────────────────────────
  const handleTerminate = useCallback(
    async (session: SessionEntry) => {
      if (!tempCode || terminating[session.id]) return;

      setTerminating((prev) => ({ ...prev, [session.id]: true }));
      try {
        await sessionLimitApi.terminateSession(tempCode, session.id);
        toast.success(`Session terminated: ${session.device}`);
        // Invalidate so the list and count refresh immediately
        await queryClient.invalidateQueries({ queryKey: ['session-limit-sessions', tempCode] });
      } catch (err: any) {
        toast.error(err?.message || 'Could not terminate session. Please try again.');
      } finally {
        setTerminating((prev) => ({ ...prev, [session.id]: false }));
      }
    },
    [tempCode, terminating, queryClient],
  );

  // ── Continue auth ──────────────────────────────────────────────────────────
  const handleContinue = useCallback(async () => {
    if (!tempCode || isContinuing || !canContinue) return;

    setIsContinuing(true);
    try {
      // 1. Ask backend to finalise auth — returns a final one-time code
      const { code: finalCode } = await sessionLimitApi.continueAuth(tempCode);

      // 2. Exchange the final code for tokens (existing endpoint)
      const exchangeRes = await api.post<{
        success: boolean;
        data: { accessToken: string; refreshToken: string; sessionId: string | null };
      }>('/api/v2/auth/desktop/exchange', { code: finalCode }, { skipAuth: true });

      const { accessToken, refreshToken, sessionId } = exchangeRes.data;

      if (!accessToken || !refreshToken) {
        throw new Error('Tokens were not returned from the server.');
      }

      // 3. Store tokens and fetch user profile
      localStorage.setItem('yolnoma_access_token', accessToken);
      localStorage.setItem('yolnoma_refresh_token', refreshToken);
      if (sessionId) localStorage.setItem('yolnoma_session_id', sessionId);

      const userRes = await api.get('/api/v2/auth/me');
      const rawUser = userRes?.data?.user || userRes?.user || userRes;
      const formattedUser: UserProfile = {
        id: rawUser.id || rawUser._id,
        email: rawUser.email,
        role: rawUser.role || 'user',
        display_name: rawUser.name || rawUser.display_name || rawUser.displayName,
        avatar_url: rawUser.avatar || rawUser.avatar_url || rawUser.picture,
        thumbnail_url: rawUser.thumbnail_url,
        is_private: rawUser.is_private ?? false,
      };

      login(formattedUser, accessToken, refreshToken, sessionId ?? undefined);
      navigate('/', { replace: true });
    } catch (err: any) {
      const msg = err?.message || 'Could not continue authentication. Please try again.';
      // If the backend says limit is still reached, refresh the list
      if (err?.status === 409 || msg.toLowerCase().includes('limit')) {
        toast.error('Session limit still reached. Please terminate another session first.');
        await queryClient.invalidateQueries({ queryKey: ['session-limit-sessions', tempCode] });
      } else {
        toast.error(msg);
      }
      setIsContinuing(false);
    }
  }, [tempCode, isContinuing, canContinue, login, navigate, queryClient]);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!tempCode) return null; // redirecting

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden text-[#F2EDE6]"
      style={{ background: '#14110E' }}
    >
      {/* Background glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-[140px] pointer-events-none opacity-[0.10]" style={{ background: '#D97757' }} />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full blur-[140px] pointer-events-none opacity-[0.06]" style={{ background: '#D97757' }} />

      <div className="relative w-full max-w-lg">
        <div
          className="bg-[#181410]/95 backdrop-blur-2xl border border-white/[0.08] rounded-3xl overflow-hidden shadow-2xl"
          style={{ boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6), 0 0 50px rgba(217,119,87,0.08)' }}
        >
          {/* Top sheen */}
          <div className="h-px bg-gradient-to-r from-transparent via-[#D97757]/60 to-transparent" />

          {/* Header */}
          <div className="px-8 pt-8 pb-6 border-b border-white/[0.06]">
            <div className="flex items-center gap-3.5 mb-4">
              <div className="flex-shrink-0 w-11 h-11 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center overflow-hidden p-2">
                <img src={images.brands.logo_png} alt="Yolnoma Logo" className="w-full h-full object-contain" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <AlertTriangle size={14} className="text-amber-400" />
                  <h1 className="text-base font-semibold text-[#F2EDE6] leading-tight">Session limit reached</h1>
                </div>
                <p className="text-xs text-white/45 mt-0.5">Terminate an existing session to continue</p>
              </div>
            </div>

            {/* Current device card */}
            {newDevice && (
              <div className="rounded-xl bg-white/[0.03] border border-[#D97757]/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="mt-0.5 flex-shrink-0">{deviceIcon(newDevice.device)}</div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#D97757] uppercase tracking-wider mb-1">Current Device</p>
                      <p className="text-sm font-medium text-[#F2EDE6] truncate">{newDevice.device}</p>
                      {newDevice.ip && newDevice.ip !== 'Unknown' && (
                        <p className="text-xs text-white/35 mt-0.5 flex items-center gap-1">
                          <MapPin size={10} />
                          {newDevice.ip}
                        </p>
                      )}
                      <p className="text-xs text-white/35 mt-0.5 flex items-center gap-1">
                        <Clock size={10} />
                        Last active: Now
                      </p>
                    </div>
                  </div>
                  <span className="flex-shrink-0 text-[10px] font-bold tracking-widest px-2.5 py-1 rounded-full bg-[#D97757]/15 text-[#D97757] border border-[#D97757]/30 uppercase">
                    Current
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Session list */}
          <div className="px-8 py-4 space-y-2 max-h-72 overflow-y-auto">
            {isLoading && (
              <>
                {[1, 2].map((i) => (
                  <div key={i} className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 animate-pulse">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-white/[0.06]" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 bg-white/[0.06] rounded w-2/3" />
                        <div className="h-2.5 bg-white/[0.04] rounded w-1/2" />
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}

            {isError && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-center">
                <p className="text-sm text-red-300 mb-3">
                  {(error as any)?.message || 'Could not load sessions. The code may have expired.'}
                </p>
                <button
                  type="button"
                  onClick={() => refetch()}
                  className="inline-flex items-center gap-1.5 text-xs text-red-300 hover:text-red-200 transition-colors"
                >
                  <RefreshCw size={12} />
                  Retry
                </button>
              </div>
            )}

            {!isLoading && !isError && sessions.length === 0 && (
              <p className="text-sm text-white/40 text-center py-4">No sessions found.</p>
            )}

            {!isLoading && !isError && sessions.map((session) => {
              const isTerminating = Boolean(terminating[session.id]);
              return (
                <div
                  key={session.id}
                  className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 hover:border-white/10 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center">
                        {deviceIcon(session.device)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#F2EDE6] truncate">{session.device}</p>
                        {session.ip && session.ip !== 'Unknown' && (
                          <p className="text-xs text-white/35 mt-0.5 flex items-center gap-1">
                            <MapPin size={10} />
                            {session.ip}
                          </p>
                        )}
                        <p className="text-xs text-white/35 mt-0.5 flex items-center gap-1">
                          <Clock size={10} />
                          Last active: {formatRelativeTime(session.last_used_at)}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleTerminate(session)}
                      disabled={isTerminating || isContinuing}
                      className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                                 bg-red-500/10 border border-red-500/20 text-red-300 text-xs font-medium
                                 hover:bg-red-500/20 hover:border-red-500/30 hover:text-red-200
                                 active:scale-[0.97] transition-all duration-150
                                 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none"
                    >
                      {isTerminating ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Trash2 size={12} />
                      )}
                      {isTerminating ? 'Terminating…' : 'Terminate'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="px-8 py-6 border-t border-white/[0.06] flex items-center justify-between gap-4">
            {/* Session count */}
            <div className="text-sm text-white/40">
              {isLoading ? (
                <span className="inline-block w-16 h-4 bg-white/[0.06] rounded animate-pulse" />
              ) : (
                <span>
                  <span className={canContinue ? 'text-emerald-400' : 'text-amber-400'}>
                    {sessions.length}
                  </span>
                  <span className="text-white/25"> / {maxSessions}</span>
                  <span className="text-white/40"> active sessions</span>
                </span>
              )}
            </div>

            {/* Continue button */}
            <button
              type="button"
              onClick={handleContinue}
              disabled={!canContinue || isContinuing || isLoading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold
                         bg-[#D97757] text-white shadow-lg shadow-[#D97757]/20
                         hover:bg-[#D97757]/90 active:scale-[0.98] transition-all duration-200
                         disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none"
            >
              {isContinuing ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Signing in…
                </>
              ) : canContinue ? (
                <>
                  <CheckCircle2 size={15} />
                  Continue
                </>
              ) : (
                <>
                  <LogIn size={15} />
                  Continue
                </>
              )}
            </button>
          </div>
        </div>

        {/* Hint */}
        {!canContinue && !isLoading && (
          <p className="text-center text-xs text-white/25 mt-4">
            Terminate at least one session above to enable Continue
          </p>
        )}
      </div>
    </div>
  );
}
