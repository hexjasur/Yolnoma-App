import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { listen } from '@tauri-apps/api/event';
import { openUrl } from '@tauri-apps/plugin-opener';
import { useAuth, UserProfile } from '../context/AuthContext';
import { api } from '../services/api';
import { BACKEND_ENVIRONMENTS, getBackendUrl, setBackendUrl } from '../config/apiConfig';
import {
  Drama,
  Server,
  Loader2,
  ExternalLink,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Sparkles
} from 'lucide-react';

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isWaitingForBrowser, setIsWaitingForBrowser] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [selectedBackend, setSelectedBackend] = useState(getBackendUrl());
  const [showEnvPicker, setShowEnvPicker] = useState(false);
  const [showManualCode, setShowManualCode] = useState(false);
  const [manualCode, setManualCode] = useState('');

  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const from = (location.state as any)?.from?.pathname || '/';

  const handleBackendChange = (url: string) => {
    setSelectedBackend(url);
    setBackendUrl(url);
    setShowEnvPicker(false);
  };

  // Exchange one-time code for access & refresh tokens
  const handleExchangeCode = async (code: string) => {
    let cleanCode = code.trim();
    if (!cleanCode) return;

    // Extract code if user or deep link passed full URL (e.g. yolnoma://auth?code=XXXX)
    if (cleanCode.includes('code=')) {
      const match = cleanCode.match(/[?&]code=([^&#]+)/);
      if (match && match[1]) {
        cleanCode = decodeURIComponent(match[1]);
      }
    }

    setIsLoading(true);
    setError('');
    setSuccessMsg('Avtorizatsiya tasdiqlanmoqda...');

    try {
      const response = await api.post(
        '/api/v2/auth/desktop/exchange',
        { code: cleanCode },
        { skipAuth: true }
      );

      const accessToken = response?.data?.accessToken || response?.accessToken;
      const refreshToken = response?.data?.refreshToken || response?.refreshToken;

      if (!accessToken || !refreshToken) {
        throw new Error('Serverdan tokenlar olinmadi.');
      }

      // Temporarily store token so get /me works
      localStorage.setItem('yolnoma_access_token', accessToken);
      localStorage.setItem('yolnoma_refresh_token', refreshToken);

      // Fetch user details
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

      setSuccessMsg('Muvaffaqiyatli kirdingiz!');
      login(formattedUser, accessToken, refreshToken);
      navigate(from, { replace: true });
    } catch (err: any) {
      console.error('Desktop auth exchange error:', err);
      localStorage.removeItem('yolnoma_access_token');
      localStorage.removeItem('yolnoma_refresh_token');
      setError(
        err?.message ||
        'Avtorizatsiya kodi eskirgan yoki noto\'g\'ri. Iltimos qaytadan urinib ko\'ring.'
      );
      setSuccessMsg('');
    } finally {
      setIsLoading(false);
      setIsWaitingForBrowser(false);
    }
  };

  // Listen for deep link event from Tauri ("yolnoma://auth?code=XXXX")
  useEffect(() => {
    let unlisten: (() => void) | null = null;

    listen<string>('auth-code-received', (event) => {
      if (event.payload) {
        handleExchangeCode(event.payload);
      }
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  const handleStartGoogleSignIn = async () => {
    setError('');
    setIsWaitingForBrowser(true);

    try {
      const backendUrl = getBackendUrl();
      const authUrl = `${backendUrl}/api/v2/auth/desktop/google`;

      // Open in default browser using Tauri Opener plugin
      await openUrl(authUrl);
    } catch (err: any) {
      console.error('Failed to open browser:', err);
      setError('Brauzerni ochishda xatolik yuz berdi. Kodni qo\'lda kiriting.');
      setIsWaitingForBrowser(false);
    }
  };

  const handleManualCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) {
      setError('Iltimos, kodni kiriting.');
      return;
    }
    handleExchangeCode(manualCode);
  };

  const currentEnv = BACKEND_ENVIRONMENTS.find((e) => e.url === selectedBackend);

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden text-[#F2EDE6]"
      style={{ background: '#14110E' }}
    >
      {/* Decorative ambient glow */}
      <div
        className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-[140px] pointer-events-none opacity-[0.12]"
        style={{ background: '#D97757' }}
      />
      <div
        className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full blur-[140px] pointer-events-none opacity-[0.08]"
        style={{ background: '#D97757', animationDelay: '2s' }}
      />

      <div className="relative w-full max-w-md">
        {/* Card container */}
        <div
          className="bg-[#181410]/95 backdrop-blur-2xl border border-white/[0.08] rounded-3xl p-8 shadow-2xl overflow-hidden relative"
          style={{ boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6), 0 0 50px rgba(217,119,87,0.08)' }}
        >
          {/* Subtle top border gradient */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#D97757]/60 to-transparent" />

          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.08] mb-6 shadow-inner relative overflow-hidden group">
              <div className="absolute inset-0 bg-[#D97757]/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <Drama
                className="w-7 h-7 text-[#D97757] group-hover:scale-110 transition-transform duration-500 relative z-10"
                strokeWidth={1.75}
              />
            </div>
            <div className="flex items-center justify-center gap-1.5 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-[#D97757]" />
              <span className="text-[11px] uppercase tracking-[0.2em] text-[#D97757] font-semibold">
                Yolnoma Desktop
              </span>
            </div>
            <h1 className="font-serif text-3xl font-medium tracking-tight mb-2 text-[#F2EDE6]">
              Tizimga kirish
            </h1>
            <p className="text-white/45 text-xs leading-relaxed max-w-xs mx-auto">
              Barcha imkoniyatlardan foydalanish uchun Google hisobingiz bilan kiring
            </p>
          </div>

          {/* Status / Error Messages */}
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{successMsg}</span>
            </div>
          )}

          {/* Main Action Area */}
          <div className="space-y-4">
            {/* Continue with Google button */}
            <button
              type="button"
              onClick={handleStartGoogleSignIn}
              disabled={isLoading}
              className="group relative w-full flex items-center justify-center gap-3 bg-white text-zinc-900 font-medium
                         py-3.5 px-4 rounded-xl hover:bg-white/90 active:scale-[0.99] focus:outline-none focus:ring-2
                         focus:ring-offset-2 focus:ring-offset-[#181410] focus:ring-[#D97757]/60
                         transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-black/20"
            >
              {/* Google G Logo SVG */}
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              <span className="font-semibold text-sm">Google orqali davom etish</span>
              <ExternalLink className="w-3.5 h-3.5 text-zinc-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </button>

            {/* Waiting for browser indicator */}
            {isWaitingForBrowser && (
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-center space-y-2 animate-pulse">
                <div className="flex items-center justify-center gap-2 text-[#D97757] text-xs font-medium">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Brauzerda hisobingizni tasdiqlang...</span>
                </div>
                <p className="text-[11px] text-white/35">
                  Kirish yakunlangach, dastur avtomatik ochiladi.
                </p>
              </div>
            )}

            {/* Manual Code Fallback toggle */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowManualCode((v) => !v)}
                className="w-full text-center text-xs text-white/40 hover:text-[#D97757] transition-colors py-1.5 flex items-center justify-center gap-1.5"
              >
                <KeyRound size={13} />
                <span>{showManualCode ? "Kodni yashirish" : "Avtomatik ochilmadimi? Kodni qo'lda kiritish"}</span>
              </button>

              {showManualCode && (
                <form onSubmit={handleManualCodeSubmit} className="mt-3 space-y-2.5 animate-in fade-in duration-200">
                  <div className="relative">
                    <input
                      type="text"
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                      placeholder="yolnoma://auth?code=... dagi kodni kiriting"
                      className="w-full bg-white/[0.04] border border-white/10 rounded-xl py-2.5 px-3.5 text-xs text-[#F2EDE6]
                                 placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-[#D97757]/40
                                 focus:border-[#D97757]/50 transition-all font-mono"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading || !manualCode.trim()}
                    className="w-full flex items-center justify-center gap-2 bg-[#D97757] text-white font-medium
                               py-2.5 px-4 rounded-xl hover:bg-[#D97757]/90 active:scale-[0.99] text-xs
                               transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <span>Tasdiqlash</span>
                        <ArrowRight size={13} />
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Backend Environment Switcher */}
          <div className="mt-6 pt-5 border-t border-white/[0.06] relative">
            <button
              type="button"
              onClick={() => setShowEnvPicker((v) => !v)}
              className="w-full flex items-center justify-between gap-2 px-3.5 py-2 rounded-xl
                         bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.05]
                         text-white/35 hover:text-white/55 text-xs transition-all duration-200"
            >
              <div className="flex items-center gap-2">
                <Server size={12} className="text-[#D97757]" />
                <span className="truncate">Server: {currentEnv?.name || selectedBackend}</span>
              </div>
              <span className="text-white/20 text-[10px]">{showEnvPicker ? '▲' : '▼'}</span>
            </button>

            {showEnvPicker && (
              <div className="absolute bottom-full mb-2 left-0 right-0 bg-[#1E1A16] border border-white/[0.08] rounded-xl overflow-hidden shadow-2xl z-20">
                {BACKEND_ENVIRONMENTS.map((env) => (
                  <button
                    key={env.url}
                    type="button"
                    onClick={() => handleBackendChange(env.url)}
                    className={`w-full text-left px-4 py-3 text-xs transition-colors hover:bg-white/[0.05]
                      ${selectedBackend === env.url ? 'text-[#D97757] bg-[#D97757]/10' : 'text-white/60'}`}
                  >
                    <div className="font-medium">{env.name}</div>
                    <div className="text-white/30 font-mono text-[10px] mt-0.5">{env.url}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}