import { Activity, Cpu, HardDrive, Layers, Monitor } from "lucide-react";
import type { SystemStats } from "@/features/system-monitor/hooks/useSystemStats";
import ResourceMetricCard from "@/features/dashboard/components/ResourceMetricCard";

interface SystemMonitorSectionProps {
  monitoringEnabled: boolean;
  toggleMonitoring: () => void;
  stats: SystemStats | null;
  statsLoading: boolean;
  isPaused: boolean;
}

export default function SystemMonitorSection({
  monitoringEnabled,
  toggleMonitoring,
  stats,
  statsLoading,
  isPaused,
}: SystemMonitorSectionProps) {
  return (
    <section className="rounded-3xl border border-white/[0.08] bg-[#111109] p-7 md:p-8 shadow-2xl relative overflow-hidden">
      {/* Glow ambient background */}
      <div
        className="pointer-events-none absolute -top-16 -left-16 w-56 h-56 rounded-full opacity-15 blur-3xl"
        style={{ background: "var(--accent)" }}
      />

      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-5 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[var(--accent-glow)] flex items-center justify-center text-[var(--accent)] border border-[var(--accent-border)]">
            <Activity size={18} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">
              System Resources (Local System)
            </h2>
            <p className="text-xs text-white/40 truncate max-w-md">
              {monitoringEnabled
                ? stats?.cpuModel || "Protsessor va operativ xotira holati"
                : "Monitoring disabled (press the button on the right to enable)"}
            </p>
          </div>
        </div>

        {/* Live Polling Status Indicator & Toggle Switch */}
        <div className="flex items-center gap-4 self-start sm:self-auto">
          <div className="flex items-center gap-2 text-xs font-mono">
            <span
              className={`w-2 h-2 rounded-full ${
                !monitoringEnabled
                  ? "bg-zinc-500/60"
                  : isPaused
                    ? "bg-amber-400 opacity-60"
                    : "bg-emerald-400 animate-ping"
              }`}
            />
            <span
              className={
                !monitoringEnabled
                  ? "text-zinc-400"
                  : isPaused
                    ? "text-amber-300/70"
                    : "text-emerald-400"
              }
            >
              {!monitoringEnabled
                ? "Disabled"
                : isPaused
                  ? "To'xtatildi (fon)"
                  : "Real-time (2s)"}
            </span>
          </div>

          {/* Toggle Switch */}
          <button
            type="button"
            role="switch"
            aria-checked={monitoringEnabled}
            onClick={toggleMonitoring}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              monitoringEnabled
                ? "bg-[var(--accent)]"
                : "bg-white/10 hover:bg-white/15"
            }`}
            title={
              monitoringEnabled
                ? "Monitoringni to'xtatish"
                : "Monitoringni yoqish"
            }
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                monitoringEnabled ? "translate-x-5" : "translate-x-0"
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
          value={statsLoading ? "—" : stats ? `${stats.cpuPercent}%` : "—"}
          detail={
            stats?.cpuCores
              ? `${stats.cpuCores} cores`
              : monitoringEnabled
                ? "Usage"
                : "inactive"
          }
          percent={stats?.cpuPercent ?? 0}
          color="from-amber-500 to-orange-500"
          loading={statsLoading}
        />

        {/* RAM Card */}
        <ResourceMetricCard
          icon={<Layers size={18} />}
          name="RAM"
          value={statsLoading ? "—" : stats ? `${stats.ramUsedGb} GB` : "—"}
          detail={
            stats?.ramTotalGb
              ? `${stats.ramUsedGb} / ${stats.ramTotalGb} GB`
              : monitoringEnabled
                ? "Memory"
                : "inactive"
          }
          percent={
            stats
              ? Math.round((stats.ramUsedGb / (stats.ramTotalGb || 1)) * 100)
              : 0
          }
          color="from-blue-500 to-cyan-500"
          loading={statsLoading}
        />

        {/* DISK Card */}
        <ResourceMetricCard
          icon={<HardDrive size={18} />}
          name="DISK"
          value={statsLoading ? "—" : stats ? `${stats.diskUsedGb} GB` : "—"}
          detail={
            stats?.diskTotalGb
              ? `${stats.diskUsedGb} / ${stats.diskTotalGb} GB`
              : monitoringEnabled
                ? "Storage"
                : "inactive"
          }
          percent={
            stats
              ? Math.round((stats.diskUsedGb / (stats.diskTotalGb || 1)) * 100)
              : 0
          }
          color="from-violet-500 to-indigo-500"
          loading={statsLoading}
        />

        {/* GPU / Plugin Card */}
        <ResourceMetricCard
          icon={<Monitor size={18} />}
          name="GPU"
          value={
            statsLoading
              ? "—"
              : stats?.gpuPercent != null
                ? `${stats.gpuPercent}%`
                : monitoringEnabled
                  ? "N/A"
                  : "—"
          }
          detail={
            stats?.gpuPercent != null
              ? "Active"
              : monitoringEnabled
                ? "Integrated / Standby"
                : "inactive"
          }
          percent={stats?.gpuPercent ?? 0}
          color="from-emerald-500 to-teal-500"
          loading={statsLoading}
        />
      </div>
    </section>
  );
}
