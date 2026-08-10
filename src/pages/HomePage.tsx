import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Drama, Clock, TrendingUp, ArrowRight } from 'lucide-react';
import { usePerformances } from '@/hooks/usePerformances';
import type { Performance } from '@/types';

export default function HomePage() {
  const { items, loading } = usePerformances();

  const recent = useMemo(() => {
    return [...items]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 5);
  }, [items]);

  return (
    <div style={{ fontFamily: 'var(--font-sans)', color: 'var(--text-primary)', maxWidth: 900 }}>
      {/* Title */}
      <p style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--accent)', fontWeight: 600, marginBottom: 8 }}>
        Boshqaruv paneli
      </p>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 40, fontWeight: 500, letterSpacing: '-0.01em', margin: '0 0 32px', lineHeight: 1.1 }}>
        Dashboard
      </h1>

      {/* ── Stat cards ─────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 40 }}>
        <StatCard
          icon={<Drama size={20} strokeWidth={1.5} />}
          label="Jami ishtirokchilar"
          value={loading ? '—' : String(items.length)}
          accent
        />
        <StatCard
          icon={<TrendingUp size={20} strokeWidth={1.5} />}
          label="So'nggi 30 kun"
          value={loading ? '—' : String(recentCount(items, 30))}
        />
        <StatCard
          icon={<Clock size={20} strokeWidth={1.5} />}
          label="Bugun qo'shilgan"
          value={loading ? '—' : String(recentCount(items, 1))}
        />
      </div>

      {/* ── Recent performers ──────────────────────────────── */}
      <div
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 18,
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 500, margin: 0 }}>
            So'nggi qo'shilganlar
          </h2>
          <Link
            to="/performances"
            style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--accent)', textDecoration: 'none' }}
          >
            Barchasini ko'rish <ArrowRight size={13} />
          </Link>
        </div>

        {loading ? (
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div className="skeleton" style={{ width: 42, height: 42, borderRadius: 10, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton" style={{ height: 13, width: '55%', marginBottom: 7, borderRadius: 6 }} />
                  <div className="skeleton" style={{ height: 11, width: '35%', borderRadius: 6 }} />
                </div>
              </div>
            ))}
          </div>
        ) : recent.length === 0 ? (
          <p style={{ padding: '32px 24px', textAlign: 'center', color: 'var(--text-faint)', fontSize: 13 }}>
            Hali hech narsa yo'q
          </p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {recent.map((p, i) => (
              <li key={p.id}>
                <Link
                  to={`/performances/${p.id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '14px 24px',
                    textDecoration: 'none',
                    borderBottom: i < recent.length - 1 ? '1px solid var(--border)' : 'none',
                    transition: 'background var(--transition-fast)',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(242,237,230,0.03)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  {/* Thumbnail */}
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 10,
                      overflow: 'hidden',
                      flexShrink: 0,
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <img
                      src={p.image_url}
                      alt={p.full_name}
                      loading="lazy"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.full_name}
                    </p>
                    <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
                      {formatDate(p.created_at)}
                    </p>
                  </div>

                  <ArrowRight size={14} strokeWidth={1.75} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ── Helpers ───────────────────────────────────────────────── */
function recentCount(items: Performance[], days: number): number {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return items.filter(p => new Date(p.created_at) >= cutoff).length;
}

function formatDate(iso: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('uz-UZ', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

function StatCard({ icon, label, value, accent = false }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        background: accent
          ? 'linear-gradient(135deg, rgba(217,119,87,0.12), rgba(217,119,87,0.04))'
          : 'var(--bg-elevated)',
        border: `1px solid ${accent ? 'rgba(217,119,87,0.25)' : 'var(--border)'}`,
        borderRadius: 16,
        padding: '20px 22px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ color: accent ? 'var(--accent)' : 'var(--text-muted)' }}>{icon}</div>
      <div>
        <p style={{ fontSize: 30, fontWeight: 700, margin: 0, color: 'var(--text-primary)', lineHeight: 1 }}>{value}</p>
        <p style={{ fontSize: 12, margin: '6px 0 0', color: 'var(--text-faint)' }}>{label}</p>
      </div>
    </div>
  );
}