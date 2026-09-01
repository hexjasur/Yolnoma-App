import { Gamepad, Sparkles, Wrench } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';

export default function SteamSamPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-8" style={{ fontFamily: 'var(--font-sans)', color: 'var(--text-primary)' }}>
      {/* Header */}
      <header className="pb-6 border-b border-white/[0.06] flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] tracking-[0.18em] uppercase text-[var(--accent)] font-semibold">
              STEAM TOOLKIT
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold uppercase">
              UNDER DEVELOPMENT
            </span>
          </div>
          <h1 className="font-serif text-3xl md:text-4xl font-medium tracking-tight text-white m-0">
            Steam Achievement Manager (SAM)
          </h1>
          <p className="mt-2 text-sm text-white/40">
            Unlock, manage, and inspect game achievements and statistics.
          </p>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
          <Gamepad size={24} />
        </div>
      </header>

      {/* Dev Mode Banner */}
      <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-4">
        <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
          <Wrench size={18} />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-amber-300">Feature in Active Development</h2>
          <p className="text-xs text-white/60 mt-1 leading-relaxed">
            You are viewing this page because you have the <span className="text-white font-semibold capitalize font-mono">[{user?.role || 'authorized'}]</span> role. Regular users are blocked from accessing this page until release.
          </p>
        </div>
      </div>

      {/* Placeholder content */}
      <div className="rounded-3xl border border-white/[0.08] bg-[#111109] p-10 text-center space-y-4">
        <div className="w-16 h-16 rounded-3xl bg-white/5 border border-white/10 text-white/40 flex items-center justify-center mx-auto">
          <Sparkles size={28} className="text-[var(--accent)]" />
        </div>
        <h2 className="text-lg font-medium text-white">SAM Module is Under Construction</h2>
        <p className="text-xs text-white/40 max-w-md mx-auto leading-relaxed">
          Achievement synchronization and automated unlocking features are being built. Stay tuned for future updates.
        </p>
      </div>
    </div>
  );
}
