import type { ReactNode } from "react";

interface ResourceMetricCardProps {
  icon: ReactNode;
  name: string;
  value: string;
  detail: string;
  percent: number;
  color: string;
  loading?: boolean;
}

export default function ResourceMetricCard({
  icon,
  name,
  value,
  detail,
  percent,
  color,
  loading,
}: ResourceMetricCardProps) {
  const safePercent = Math.min(100, Math.max(0, percent));

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 flex flex-col justify-between gap-3 relative overflow-hidden">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold font-mono tracking-wider text-white/50 flex items-center gap-1.5">
          <span className="text-white/60">{icon}</span>
          {name}
        </span>
        <span className="text-xs font-mono font-semibold text-white/80">
          {value}
        </span>
      </div>

      {/* Progress Bar */}
      <div>
        <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden mb-1.5">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-500`}
            style={{ width: loading ? "0%" : `${safePercent}%` }}
          />
        </div>
        <p className="text-[10px] text-white/35 font-mono truncate">{detail}</p>
      </div>
    </div>
  );
}
