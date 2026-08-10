import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Clock, Fingerprint, Pencil, Trash2, RefreshCw, Film } from 'lucide-react';
import { performanceService } from '@/services/performance.service';
import { performanceStore } from '@/services/performanceStore';
import EditPerformanceModal from '@/components/EditPerformanceModal';
import DeleteConfirmModal from '@/components/DeleteConfirmModal';
import { useModal } from '@/hooks/useModal';
import { Button } from '@/components/ui';
import type { Performance } from '@/types';

export default function PerformanceDetailPage() {
  const { id }    = useParams<{ id: string }>();
  const navigate  = useNavigate();

  const [item, setItem]         = useState<Performance | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const editModal   = useModal();
  const deleteModal = useModal();

  const load = useCallback(async () => {
    if (!id) { setError('Noto\'g\'ri ID'); setLoading(false); return; }

    // Instant load from global cache if available
    const snapshot = performanceStore.getSnapshot();
    const cachedItem = snapshot.items.find(p => p.id === id);
    if (cachedItem) {
      setItem(cachedItem);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const data = await performanceService.get(id);
      setItem(data);
    } catch (err) {
      const msg = String(err ?? '');
      if (msg.includes('not found')) setNotFound(true);
      else setError(msg);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Optimistic edit — update local state immediately
  const handleUpdated = useCallback((updated: Performance) => {
    setItem(updated);
  }, []);

  // After delete navigate back to list
  const handleDeleted = useCallback(() => {
    navigate('/performances');
  }, [navigate]);

  const BackLink = () => (
    <Link
      to="/performances"
      className="inline-flex items-center gap-2 text-sm text-white/45 hover:text-[#F2EDE6] transition-colors mb-6"
    >
      <ArrowLeft size={15} strokeWidth={1.75} />
      Performancelarga qaytish
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

  /* ── Error ────────────────────────────────────────────────── */
  if (error) {
    return (
      <div className="max-w-2xl mx-auto">
        <BackLink />
        <div className="rounded-2xl border border-red-500/25 bg-red-500/[0.06] p-6">
          <p className="mb-2 font-medium text-red-300">Yuklab bo'lmadi</p>
          <p className="text-sm text-red-300/70 mb-5">{error}</p>
          <Button variant="ghost" onClick={load}>
            <RefreshCw size={14} />
            Qayta urinish
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
          <p className="text-[#F2EDE6] mb-1">Performance topilmadi</p>
          <p className="text-sm text-white/40">Bu ID bo'yicha hech narsa yo'q.</p>
        </div>
      </div>
    );
  }

  /* ── Detail ───────────────────────────────────────────────── */
  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Back + Actions row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
            Tahrirlash
          </Button>
          <Button variant="danger" size="sm" onClick={() => deleteModal.open(item)}>
            <Trash2 size={13} />
            O'chirish
          </Button>
        </div>
      </div>

      {/* Hero banner */}
      {item.thumbnail_url && (
        <div className="relative overflow-hidden rounded-3xl border border-white/[0.06] bg-[#181410]">
          <img
            src={item.thumbnail_url}
            alt={item.full_name}
            className="w-full max-h-72 object-cover opacity-90"
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
            Ishtirokchi
          </p>
          <h1 className="font-serif text-5xl font-medium tracking-tight text-[#F2EDE6] mb-6">
            {item.full_name}
          </h1>

          <div className="h-px bg-white/[0.08] mb-6" />

          <p className="leading-8 text-white/65">
            {item.description ?? 'Tavsif mavjud emas.'}
          </p>

          {/* Meta cards */}
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
              <div className="flex items-center gap-2 text-white/40 mb-2">
                <Fingerprint size={14} strokeWidth={1.75} />
                <p className="text-xs uppercase tracking-wide">MongoDB ID</p>
              </div>
              <p className="font-mono text-sm text-[#F2EDE6] break-all">{item.id}</p>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 text-sm">
              <div className="flex items-center gap-2 text-white/40 mb-2">
                <Clock size={14} strokeWidth={1.75} />
                <p className="text-xs uppercase tracking-wide">Vaqt belgilari</p>
              </div>
              <p className="text-white/70">
                Yaratildi: <span className="text-[#F2EDE6]">{item.created_at || 'Noma\'lum'}</span>
              </p>
              <p className="text-white/70 mt-1">
                Yangilandi: <span className="text-[#F2EDE6]">{item.updated_at || 'Noma\'lum'}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <EditPerformanceModal
        open={editModal.isOpen}
        item={editModal.target ?? item}
        onClose={editModal.close}
        onUpdated={handleUpdated}
      />

      <DeleteConfirmModal
        open={deleteModal.isOpen}
        item={deleteModal.target ?? item}
        onClose={deleteModal.close}
        onDeleted={handleDeleted}
      />
    </div>
  );
}