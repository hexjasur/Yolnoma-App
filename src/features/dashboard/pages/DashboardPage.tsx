import { usePerformances } from "@/features/performance/hooks/usePerformances";
import { useSystemStats } from "@/features/system-monitor/hooks/useSystemStats";
import { useAuth } from "@/features/auth/AuthContext";
import { usePinnedTools } from "@/shared/hooks/usePinnedTools";
import { useAccountConfigStore } from "@/shared/stores/accountConfigStore";
import WeatherCard from "@/features/dashboard/components/WeatherCard";
import DashboardHeader from "@/features/dashboard/components/DashboardHeader";
import SystemMonitorSection from "@/features/dashboard/components/SystemMonitorSection";
import PinnedToolsSection from "@/features/dashboard/components/PinnedToolsSection";
import RecentPerformancesSection from "@/features/dashboard/components/RecentPerformancesSection";

export default function HomePage() {
  const { user } = useAuth();
  const isOwner = user?.role === "owner";
  const { pinnedTools, reorderPinnedTools } = usePinnedTools();

  // Real-time system monitoring toggle — persisted in config.json
  const monitoringEnabled = useAccountConfigStore(
    (s) => s.config.systemMonitoring,
  );
  const updateConfig = useAccountConfigStore((s) => s.updateConfig);

  const toggleMonitoring = () => {
    updateConfig({ systemMonitoring: !monitoringEnabled });
  };

  // Native local system stats with 2s visibility-aware polling (only when enabled)
  const {
    stats,
    loading: statsLoading,
    isPaused,
  } = useSystemStats(monitoringEnabled);

  // Performances only fetched for owner
  const { items, loading: perfLoading } = usePerformances(isOwner);

  const displayName =
    user?.displayName ||
    user?.display_name ||
    user?.email?.split("@")[0] ||
    "there";
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div
      className="space-y-10 max-w-5xl mx-auto pb-16"
      style={{ fontFamily: "var(--font-sans)", color: "var(--text-primary)" }}
    >
      {/* ── Welcome & Header ── */}
      <DashboardHeader
        displayName={displayName}
        greeting={greeting}
        osName={stats?.osName}
      />

      {/* ── 1. CORE FEATURE: SYSTEM OVERVIEW MONITORING ── */}
      <SystemMonitorSection
        monitoringEnabled={monitoringEnabled}
        toggleMonitoring={toggleMonitoring}
        stats={stats}
        statsLoading={statsLoading}
        isPaused={isPaused}
      />

      {/* ── 1.5. QUICK TOOLS SHORTCUTS ── */}
      <PinnedToolsSection
        pinnedTools={pinnedTools}
        reorderPinnedTools={reorderPinnedTools}
      />

      {/* ── 2. WEEKLY WEATHER ── */}
      <WeatherCard />

      {/* ── 3. OWNER ONLY: (RECENT PERFORMANCES) ── */}
      {isOwner && (
        <RecentPerformancesSection items={items} loading={perfLoading} />
      )}
    </div>
  );
}
