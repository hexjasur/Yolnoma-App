import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Shield } from "lucide-react";
import type { Performance } from "@/types";

function formatDate(iso: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("uz-UZ", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

interface RecentPerformancesSectionProps {
  items: Performance[];
  loading: boolean;
}

export default function RecentPerformancesSection({
  items,
  loading,
}: RecentPerformancesSectionProps) {
  const recent = useMemo(() => {
    return [...items]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 5);
  }, [items]);

  return (
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

      {loading ? (
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
                        (e.currentTarget as HTMLImageElement).style.display =
                          "none";
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

                <ArrowRight
                  size={14}
                  className="text-white/20 group-hover:text-[var(--accent)] group-hover:translate-x-1 transition-all shrink-0 ml-4"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
