import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Cpu,
  HardDrive,
  Activity,
  Layers,
  Sparkles,
  Gamepad2,
  Coins,
  Shield,
  Monitor,
} from 'lucide-react';
import { usePerformances } from '@/features/performance/hooks/usePerformances';
import { useSystemStats } from '@/features/system-monitor/hooks/useSystemStats';
import { useAuth } from '@/features/auth/AuthContext';

export default function HomePage() {
  const { user } = useAuth();
  const isOwner = user?.role === 'owner';

  // Real-time system monitoring toggle (default: false / OFF)
  const [monitoringEnabled, setMonitoringEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('yolnoma_system_monitoring_enabled');
      return saved === 'true';
    } catch {
      return false;
    }
  });

  const toggleMonitoring = () => {
    setMonitoringEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('yolnoma_system_monitoring_enabled', String(next));
      } catch {}
      return next;
    });
  };

  // Native local system stats with 2s visibility-aware polling (only when enabled)
  const { stats, loading: statsLoading, isPaused } = useSystemStats(monitoringEnabled);

  // Performances only fetched for owner
  const { items, loading: perfLoading } = usePerformances();

  const recent = useMemo(() => {
    if (!isOwner) return [];
    return [...items]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 5);
  }, [items, isOwner]);

  return (
    <div className="space-y-10 max-w-5xl mx-auto pb-16" style={{ fontFamily: 'var(--font-sans)', color: 'var(--text-primary)' }}>
      {/* ── Welcome & Header ── */}
      <div>
        <p className="text-[11px] tracking-[0.18em] uppercase text-[var(--accent)] mb-2 font-semibold flex items-center gap-2">
          <span>CONTROL PANEL</span>
          {stats?.osName && (
            <span className="text-white/30 lowercase">• {stats.osName}</span>
          )}
        </p>
        <h1 className="font-serif text-4xl md:text-5xl font-medium tracking-tight text-white m-0 leading-tight">
          Yolnoma Dashboard
        </h1>
        <p className="mt-2 text-sm text-white/40 max-w-2xl">
          Computer system resource monitoring and a set of essential tools
        </p>
      </div>

      {/* ── 1. CORE FEATURE: SYSTEM OVERVIEW MONITORING ── */}
      <section className="rounded-3xl border border-white/[0.08] bg-[#111109] p-7 md:p-8 shadow-2xl relative overflow-hidden">
        {/* Glow ambient background */}
        <div
          className="pointer-events-none absolute -top-16 -left-16 w-56 h-56 rounded-full opacity-15 blur-3xl"
          style={{ background: 'var(--accent)' }}
        />

        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-5 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--accent-glow)] flex items-center justify-center text-[var(--accent)] border border-[var(--accent-border)]">
              <Activity size={18} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">System Resources (Local System)</h2>
              <p className="text-xs text-white/40 truncate max-w-md">
                {monitoringEnabled
                  ? stats?.cpuModel || 'Protsessor va operativ xotira holati'
                  : 'Monitoring o\'chirilgan (yoqish uchun o\'ngdagi tugmani bosing)'}
              </p>
            </div>
          </div>

          {/* Live Polling Status Indicator & Toggle Switch */}
          <div className="flex items-center gap-4 self-start sm:self-auto">
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className={`w-2 h-2 rounded-full ${
                !monitoringEnabled
                  ? 'bg-zinc-500/60'
                  : isPaused
                  ? 'bg-amber-400 opacity-60'
                  : 'bg-emerald-400 animate-ping'
              }`} />
              <span className={
                !monitoringEnabled
                  ? 'text-zinc-400'
                  : isPaused
                  ? 'text-amber-300/70'
                  : 'text-emerald-400'
              }>
                {!monitoringEnabled
                  ? "O'chirilgan"
                  : isPaused
                  ? 'To\'xtatildi (fon)'
                  : 'Real-time (2s)'}
              </span>
            </div>

            {/* Toggle Switch */}
            <button
              type="button"
              role="switch"
              aria-checked={monitoringEnabled}
              onClick={toggleMonitoring}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                monitoringEnabled ? 'bg-[var(--accent)]' : 'bg-white/10 hover:bg-white/15'
              }`}
              title={monitoringEnabled ? "Monitoringni to'xtatish" : "Monitoringni yoqish"}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  monitoringEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* 4 System Metric Cards (CPU, RAM, DISK, GPU) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* CPU Card */}
          <ResourceMetricCard
            icon={<Cpu size={18} />}
            name="CPU"
            value={statsLoading ? '—' : stats ? `${stats.cpuPercent}%` : '—'}
            detail={stats?.cpuCores ? `${stats.cpuCores} ta yadro` : monitoringEnabled ? 'Usage' : 'Nofaol'}
            percent={stats?.cpuPercent ?? 0}
            color="from-amber-500 to-orange-500"
            loading={statsLoading}
          />

          {/* RAM Card */}
          <ResourceMetricCard
            icon={<Layers size={18} />}
            name="RAM"
            value={statsLoading ? '—' : stats ? `${stats.ramUsedGb} GB` : '—'}
            detail={stats?.ramTotalGb ? `${stats.ramUsedGb} / ${stats.ramTotalGb} GB` : monitoringEnabled ? 'Memory' : 'Nofaol'}
            percent={stats ? Math.round((stats.ramUsedGb / (stats.ramTotalGb || 1)) * 100) : 0}
            color="from-blue-500 to-cyan-500"
            loading={statsLoading}
          />

          {/* DISK Card */}
          <ResourceMetricCard
            icon={<HardDrive size={18} />}
            name="DISK"
            value={statsLoading ? '—' : stats ? `${stats.diskUsedGb} GB` : '—'}
            detail={stats?.diskTotalGb ? `${stats.diskUsedGb} / ${stats.diskTotalGb} GB` : monitoringEnabled ? 'Storage' : 'Nofaol'}
            percent={stats ? Math.round((stats.diskUsedGb / (stats.diskTotalGb || 1)) * 100) : 0}
            color="from-violet-500 to-indigo-500"
            loading={statsLoading}
          />

          {/* GPU / Plugin Card */}
          <ResourceMetricCard
            icon={<Monitor size={18} />}
            name="GPU"
            value={statsLoading ? '—' : stats?.gpuPercent != null ? `${stats.gpuPercent}%` : monitoringEnabled ? 'N/A' : '—'}
            detail={stats?.gpuPercent != null ? 'Active' : monitoringEnabled ? 'Integrated / Standby' : 'Nofaol'}
            percent={stats?.gpuPercent ?? 0}
            color="from-emerald-500 to-teal-500"
            loading={statsLoading}
          />
        </div>
      </section>

      {/* ── 2. QUICK TOOLS SHORTCUTS ── */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-white/40">
          Tools
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            to="/tools/currency"
            className="group rounded-2xl border border-white/[0.08] bg-[#111109] p-5 hover:border-[var(--accent-border)] hover:bg-white/[0.02] transition-all flex items-center justify-between shadow-lg"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Coins size={20} />
              </div>
              <div>
                <p className="text-sm font-semibold text-white group-hover:text-[var(--accent)] transition-colors">
                  Currency Converter
                </p>
                <p className="text-xs text-white/40">160+ currencies & charts</p>
              </div>
            </div>
            <ArrowRight size={15} className="text-white/30 group-hover:text-[var(--accent)] group-hover:translate-x-1 transition-all" />
          </Link>

          <Link
            to="/tools/bg-remover"
            className="group rounded-2xl border border-white/[0.08] bg-[#111109] p-5 hover:border-[var(--accent-border)] hover:bg-white/[0.02] transition-all flex items-center justify-between shadow-lg"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Sparkles size={20} />
              </div>
              <div>
                <p className="text-sm font-semibold text-white group-hover:text-[var(--accent)] transition-colors">
                  Remove background
                </p>
                <p className="text-xs text-white/40">Through ai</p>
              </div>
            </div>
            <ArrowRight size={15} className="text-white/30 group-hover:text-[var(--accent)] group-hover:translate-x-1 transition-all" />
          </Link>

          <Link
            to="/tools/steam-idler"
            className="group rounded-2xl border border-white/[0.08] bg-[#111109] p-5 hover:border-[var(--accent-border)] hover:bg-white/[0.02] transition-all flex items-center justify-between shadow-lg"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Gamepad2 size={20} />
              </div>
              <div>
                <p className="text-sm font-semibold text-white group-hover:text-[var(--accent)] transition-colors">
                  Steam Idler
                </p>
                <p className="text-xs text-white/40">Automated idling</p>
              </div>
            </div>
            <ArrowRight size={15} className="text-white/30 group-hover:text-[var(--accent)] group-hover:translate-x-1 transition-all" />
          </Link>
        </div>
      </section>

      {/* ── 3. OWNER ONLY: "SO'NGGI QO'SHILGANLAR" (RECENT PERFORMANCES) ── */}
      {isOwner && (
        <section className="rounded-3xl border border-white/[0.08] bg-[#111109] overflow-hidden shadow-xl">
          <div className="px-6 py-5 border-b border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md bg-[var(--accent-glow)] text-[var(--accent)] font-semibold border border-[var(--accent-border)]">
                <Shield size={10} /> Owner
              </span>
              <h2 className="font-serif text-lg font-medium text-white m-0">
                Recently added performance
              </h2>
            </div>
            <Link
              to="/performances"
              className="flex items-center gap-1.5 text-xs font-semibold text-[var(--accent)] hover:underline"
            >
              View all <ArrowRight size={13} />
            </Link>
          </div>

          {perfLoading ? (
            <div className="p-6 space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-white/5 animate-pulse shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-1/3 bg-white/5 animate-pulse rounded" />
                    <div className="h-2.5 w-1/5 bg-white/5 animate-pulse rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : recent.length === 0 ? (
            <div className="p-10 text-center text-white/40 text-xs">
              No performance have joined yet.
            </div>
          ) : (
            <ul className="divide-y divide-white/[0.04] m-0 p-0 list-none">
              {recent.map((p) => (
                <li key={p.id}>
                  <Link
                    to={`/performances/${p.id}`}
                    className="flex items-center justify-between px-6 py-3.5 hover:bg-white/[0.02] transition-colors group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl overflow-hidden bg-white/5 border border-white/10 shrink-0">
                        <img
                          src={p.thumbnail_url || p.image_url}
                          alt={p.full_name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white/90 group-hover:text-white truncate">
                          {p.full_name}
                        </p>
                        <p className="text-[11px] text-white/35 font-mono">
                          {formatDate(p.created_at)}
                        </p>
                      </div>
                    </div>

                    <ArrowRight size={14} className="text-white/20 group-hover:text-[var(--accent)] group-hover:translate-x-1 transition-all shrink-0 ml-4" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

/* ── Metric Card Subcomponent ── */
function ResourceMetricCard({
  icon,
  name,
  value,
  detail,
  percent,
  color,
  loading,
}: {
  icon: React.ReactNode;
  name: string;
  value: string;
  detail: string;
  percent: number;
  color: string;
  loading?: boolean;
}) {
  const safePercent = Math.min(100, Math.max(0, percent));

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 flex flex-col justify-between gap-3 relative overflow-hidden">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold font-mono tracking-wider text-white/50 flex items-center gap-1.5">
          <span className="text-white/60">{icon}</span>
          {name}
        </span>
        <span className="text-xs font-mono font-semibold text-white/80">{value}</span>
      </div>

      {/* Progress Bar */}
      <div>
        <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden mb-1.5">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-500`}
            style={{ width: loading ? '0%' : `${safePercent}%` }}
          />
        </div>
        <p className="text-[10px] text-white/35 font-mono truncate">{detail}</p>
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('uz-UZ', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}
