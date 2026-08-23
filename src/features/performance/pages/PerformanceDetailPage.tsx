import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, Globe, Fingerprint, Lock, Pencil, Trash2, RefreshCw, Film, Briefcase } from 'lucide-react';
import EditPerformanceModal from '@/features/performance/components/EditPerformanceModal';
import DeleteConfirmModal from '@/features/performance/components/DeleteConfirmModal';
import { usePerformanceDetail } from '@/features/performance/hooks/usePerformanceQueries';
import { useModal } from '@/features/performance/hooks/usePerformanceModal';
import { useAuth } from '@/features/auth/AuthContext';
import { Button } from '@/shared/ui';
import { AppError, getErrorMessage } from '@/shared/lib/errors';

export default function PerformanceDetailPage() {
  const { id }    = useParams<{ id: string }>();
  const navigate  = useNavigate();
  const { user }  = useAuth();
  const isOwner   = user?.role === 'owner';

  const performanceQuery = usePerformanceDetail(id);
  const item = performanceQuery.data ?? null;
  const loading = performanceQuery.isLoading;
  const error = performanceQuery.isError ? getErrorMessage(performanceQuery.error) : null;
  const notFound = performanceQuery.error instanceof AppError && performanceQuery.error.status === 404;

  const editModal   = useModal();
  const deleteModal = useModal();

  const BackLink = () => (
    <Link
      to="/performances"
      className="inline-flex items-center gap-2 text-sm text-white/45 hover:text-[#F2EDE6] transition-colors mb-6"
    >
      <ArrowLeft size={15} strokeWidth={1.75} />
            Back to performances
    </Link>
  );

  /* ── Loading ──────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="max-w-5xl mx-auto animate-pulse">
        <div className="h-4 w-40 rounded-md bg-white/5 mb-8" />
        <div className="h-64 rounded-3xl bg-white/[0.04] border border-white/[0.06] mb-8" />
        <div className="grid gap-8 lg:grid-cols-[380px_1fr]">
          <div className="aspect-[3/4] rounded-3xl bg-white/[0.04] border border-white/[0.06]" />
          <div className="space-y-4">
            <div className="h-10 w-2/3 rounded bg-white/[0.06]" />
            <div className="h-px bg-white/[0.06] my-6" />
            <div className="h-4 w-full rounded bg-white/[0.04]" />
            <div className="h-4 w-5/6 rounded bg-white/[0.04]" />
          </div>
        </div>
      </div>
    );
  }

  /* ── Owner guard ──────────────────────────────────────────── */
  if (!isOwner) {
    return (
      <div className="max-w-2xl mx-auto">
        <BackLink />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
            padding: '60px 20px',
            border: '1px dashed rgba(217,119,87,0.3)',
            borderRadius: 16,
            color: 'var(--text-muted)',
          }}
        >
          <Lock size={32} strokeWidth={1.5} style={{ color: '#D97757' }} />
          <p style={{ fontSize: 16, color: 'var(--text-primary)', margin: 0 }}>
            Access denied
          </p>
          <p style={{ fontSize: 13, margin: 0 }}>
            Available only to the <strong style={{ color: '#D97757' }}>owner</strong> role.
          </p>
        </div>
      </div>
    );
  }

  /* ── Error ────────────────────────────────────────────────── */
  if (error) {
    return (
      <div className="max-w-2xl mx-auto">
        <BackLink />
        <div className="rounded-2xl border border-red-500/25 bg-red-500/[0.06] p-6">
          <p className="mb-2 font-medium text-red-300">Unable to load performance</p>
          <p className="text-sm text-red-300/70 mb-5">{error}</p>
          <Button variant="ghost" onClick={() => performanceQuery.refetch()}>
            <RefreshCw size={14} />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  /* ── Not Found ────────────────────────────────────────────── */
  if (notFound || !item) {
    return (
      <div className="max-w-2xl mx-auto">
        <BackLink />
        <div className="rounded-2xl border border-dashed border-white/15 p-12 text-center">
          <p className="text-[#F2EDE6] mb-1">Performance not found</p>
          <p className="text-sm text-white/40">There is no item for this ID.</p>
        </div>
      </div>
    );
  }

  const bioText = item.bio || item.description;

  /* ── Detail ───────────────────────────────────────────────── */
  return (
    <div className="relative space-y-8 max-w-5xl mx-auto">
      {/* ── Dynamic Blurred Thumbnail Background ── */}
      {(item.thumbnail_url || item.image_url) && (
        <div
          className="performance-bg"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundImage: `url(${item.thumbnail_url || item.image_url})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(40px) brightness(0.5) saturate(1.2)',
            transform: 'scale(1.15)',
            zIndex: 0,
            pointerEvents: 'none',
            opacity: 0.35,
          }}
        />
      )}

      {/* Back + Actions row */}
      <div className="relative z-10 flex items-center justify-between">
        <BackLink />
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to={`/videos?query=${encodeURIComponent(item.full_name)}`}>
            <Button variant="ghost" size="sm">
              <Film size={13} />
              Streams
            </Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={() => editModal.open(item)}>
            <Pencil size={13} />
            Edit
          </Button>
          <Button variant="danger" size="sm" onClick={() => deleteModal.open(item)}>
            <Trash2 size={13} />
            Delete
          </Button>
        </div>
      </div>

      {/* Hero banner */}
      {(item.thumbnail_url || item.image_url) && (
        <div className="relative overflow-hidden rounded-3xl border border-white/[0.06] bg-[#181410]">
          <img
            src={item.thumbnail_url || item.image_url}
            alt={item.full_name}
            className="w-full max-h-[30rem] object-cover opacity-90"
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: 'linear-gradient(to top, rgba(20,17,14,0.95) 0%, rgba(20,17,14,0.15) 55%, transparent 85%)' }}
          />
          <div
            className="pointer-events-none absolute -top-16 right-10 h-56 w-56 rounded-full opacity-[0.12] blur-3xl"
            style={{ background: '#D97757' }}
          />
        </div>
      )}

      <div className="grid gap-10 lg:grid-cols-[380px_1fr]">
        {/* Portrait */}
        <div className="relative rounded-3xl overflow-hidden border border-white/[0.06]">
          <img
            src={item.image_url}
            alt={item.full_name}
            className="w-full aspect-[3/4] object-cover"
            onError={(e) => { e.currentTarget.src = 'https://placehold.co/400x600/1B1713/F2EDE6?text=?'; }}
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: 'linear-gradient(to top, rgba(15,13,11,0.5) 0%, transparent 40%)' }}
          />
        </div>

        {/* Info */}
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-[#D97757] font-semibold mb-3">
            Performers
          </p>
          <h1 className="font-serif text-5xl font-medium tracking-tight text-[#F2EDE6] mb-2">
            {item.full_name}
          </h1>

          {/* Profession & Nationality badges */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            {item.profession && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 12,
                  padding: '4px 10px',
                  borderRadius: 8,
                  background: 'rgba(217,119,87,0.1)',
                  border: '1px solid rgba(217,119,87,0.25)',
                  color: '#D97757',
                }}
              >
                <Briefcase size={11} strokeWidth={2} />
                {item.profession}
              </span>
            )}
            {item.nationality && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 12,
                  padding: '4px 10px',
                  borderRadius: 8,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: 'rgba(242,237,230,0.6)',
                }}
              >
                <Globe size={11} strokeWidth={2} />
                {item.nationality}
              </span>
            )}
            {item.birth_date && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 12,
                  padding: '4px 10px',
                  borderRadius: 8,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: 'rgba(242,237,230,0.6)',
                }}
              >
                <Calendar size={11} strokeWidth={2} />
                {item.birth_date}
              </span>
            )}
          </div>

          <div className="h-px bg-white/[0.08] mb-6" />

          <p className="leading-8 text-white/65">
            {bioText ?? 'Bio / tavsif mavjud emas.'}
          </p>

          {/* Meta cards */}
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
              <div className="flex items-center gap-2 text-white/40 mb-2">
                <Fingerprint size={14} strokeWidth={1.75} />
                <p className="text-xs uppercase tracking-wide">P-ID</p>
              </div>
              <p className="font-mono text-[0.6rem] text-[#F2EDE6] break-all">{item.id}</p>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 text-sm">
              <div className="flex items-center gap-2 text-white/40 mb-2">
                <Clock size={14} strokeWidth={1.75} />
                <p className="text-xs uppercase tracking-wide">Added</p>
              </div>
              <p className="text-white/70">
                Created@: <span className="text-[#F2EDE6]">{formatTimestamp(item.created_at)}</span>
              </p>
              {item.updated_at && item.updated_at !== item.created_at && (
                <p className="text-white/70 mt-1">
                  Yangilandi: <span className="text-[#F2EDE6]">{formatTimestamp(item.updated_at)}</span>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <EditPerformanceModal
        open={editModal.isOpen}
        item={editModal.target ?? item}
        onClose={editModal.close}
      />

      <DeleteConfirmModal
        open={deleteModal.isOpen}
        item={deleteModal.target ?? item}
        onClose={deleteModal.close}
        onDeleted={() => navigate('/performances')}
      />
    </div>
  );
}

/**
 * Convert ISO/UTC timestamp to user-local date string.
 * Shows "2026-08-19" format — clean and readable.
 * Handles both UTC ISO (2026-08-19T09:38:55.228829+00:00) and plain date strings.
 */
function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return 'Unknown';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    // Show in local timezone: YYYY-MM-DD HH:mm
    const yyyy = d.getFullYear();
    const mm   = String(d.getMonth() + 1).padStart(2, '0');
    const dd   = String(d.getDate()).padStart(2, '0');
    const hh   = String(d.getHours()).padStart(2, '0');
    const min  = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
  } catch {
    return iso;
  }
}
