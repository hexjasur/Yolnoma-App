import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { invoke } from '@tauri-apps/api/core';
import { ArrowRight, Lock, Mail, Loader2, Drama } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  // Get the redirect path from location state, default to "/"
  const from = (location.state as any)?.from?.pathname || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Barcha maydonlarni to\'ldiring.');
      return;
    }

    setIsLoading(true);

    try {
      const response: any = await invoke('db_login', { email, password });

      if (response && response.success) {
        login(response.user);
        navigate(from, { replace: true });
      } else {
        setError('Serverdan noto\'g\'ri javob keldi.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || String(err) || 'Kirishda xatolik yuz berdi.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden text-[#F2EDE6]"
      style={{ background: '#14110E' }}
    >
      {/* Decorative ambient glow */}
      <div
        className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-[120px] pointer-events-none opacity-[0.10]"
        style={{ background: '#D97757' }}
      />
      <div
        className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full blur-[120px] pointer-events-none opacity-[0.06]"
        style={{ background: '#D97757', animationDelay: '2s' }}
      />

      <div className="relative w-full max-w-md">
        {/* Card container */}
        <div
          className="bg-[#181410]/90 backdrop-blur-xl border border-white/[0.08] rounded-3xl p-8 shadow-2xl overflow-hidden relative"
          style={{ boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5), 0 0 40px rgba(217,119,87,0.08)' }}
        >
          {/* Subtle top border gradient */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#D97757]/50 to-transparent" />

          {/* Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.08] mb-6 shadow-inner relative overflow-hidden group">
              <div className="absolute inset-0 bg-[#D97757]/15 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <Drama
                className="w-7 h-7 text-[#D97757] group-hover:scale-110 transition-transform duration-500 relative z-10"
                strokeWidth={1.75}
              />
            </div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-[#D97757] font-semibold mb-3">
              Xush kelibsiz
            </p>
            <h1 className="font-serif text-3xl font-medium tracking-tight mb-2">
              Tizimga kirish
            </h1>
            <p className="text-white/40 text-sm">
              Boshqaruv panelingizga kirish uchun hisobingizga kiring
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300/90 text-sm flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-4">
              {/* Email */}
              <div className="group relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-4.5 w-4.5 text-white/30 group-focus-within:text-[#D97757] transition-colors duration-300" size={18} strokeWidth={1.75} />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ism@example.com"
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl py-3.5 pl-11 pr-4 text-[#F2EDE6]
                             placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-[#D97757]/40
                             focus:border-[#D97757]/50 transition-all duration-300 hover:bg-white/[0.06]"
                  required
                />
              </div>

              {/* Password */}
              <div className="group relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-4.5 w-4.5 text-white/30 group-focus-within:text-[#D97757] transition-colors duration-300" size={18} strokeWidth={1.75} />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl py-3.5 pl-11 pr-4 text-[#F2EDE6]
                             placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-[#D97757]/40
                             focus:border-[#D97757]/50 transition-all duration-300 hover:bg-white/[0.06]"
                  required
                />
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex items-center justify-center gap-2 bg-[#D97757] text-white font-medium
                         py-3.5 px-4 rounded-xl hover:bg-[#D97757]/90 focus:outline-none focus:ring-2
                         focus:ring-offset-2 focus:ring-offset-[#181410] focus:ring-[#D97757]/60
                         transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <span className="font-semibold">Kirish</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}