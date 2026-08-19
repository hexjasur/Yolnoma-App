import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, RefreshCw, Lock, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import PerformanceCard from '@/components/PerformanceCard';
import AddPerformanceModal from '@/components/AddPerformanceModal';
import EditPerformanceModal from '@/components/EditPerformanceModal';
import DeleteConfirmModal from '@/components/DeleteConfirmModal';
import { Button, CardGridSkeleton } from '@/components/ui';
import { performanceService } from '@/services/performance.service';
import { performanceStore } from '@/services/performanceStore';
import { useModal } from '@/hooks/useModal';
import { useAuth } from '@/context/AuthContext';
import type { Performance, PaginationMeta } from '@/types';

export default function PerformancePage() {
  const { user } = useAuth();
  const isOwner = user?.role === 'owner';

  const [searchParams, setSearchParams] = useSearchParams();

  // Read URL query parameters
  const pageParam = parseInt(searchParams.get('page') || '1', 10);
  const limitParam = parseInt(searchParams.get('limit') || '15', 10);
  const searchParam = searchParams.get('search') || searchParams.get('query') || '';

  const currentPage = isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;
  const currentLimit = isNaN(limitParam) || limitParam < 1 ? 15 : limitParam;

  const [items, setItems] = useState<Performance[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: currentPage,
    limit: currentLimit,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState(searchParam);

  const addModal    = useModal();
  const editModal   = useModal();
  const deleteModal = useModal();

  // Fetch paginated data
  const loadData = useCallback(async (page: number, limit: number, query: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await performanceService.list(page, limit, query);
      setItems(res.data);
      setPagination(res.pagination);
    } catch (err: any) {
      setError(err?.message || 'Ishtirokchilarni yuklashda xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  }, []);

  // Whenever URL params change, fetch data
  useEffect(() => {
    loadData(currentPage, currentLimit, searchParam);
  }, [currentPage, currentLimit, searchParam, loadData]);

  // Keep local search input in sync if URL search param changes externally
  useEffect(() => {
    setSearchInput(searchParam);
  }, [searchParam]);

  // Helper to change page
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage === currentPage) return;
    const newParams = new URLSearchParams(searchParams);
    newParams.set('page', String(newPage));
    newParams.set('limit', String(currentLimit));
    if (searchParam) newParams.set('search', searchParam);
    setSearchParams(newParams);
  };

  // Helper to change limit
  const handleLimitChange = (newLimit: number) => {
    if (newLimit === currentLimit) return;
    const newParams = new URLSearchParams(searchParams);
    newParams.set('page', '1');
    newParams.set('limit', String(newLimit));
    if (searchParam) newParams.set('search', searchParam);
    setSearchParams(newParams);
  };

  // Helper to submit search
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newParams = new URLSearchParams(searchParams);
    newParams.set('page', '1');
    newParams.set('limit', String(currentLimit));
    if (searchInput.trim()) {
      newParams.set('search', searchInput.trim());
      newParams.delete('query');
    } else {
      newParams.delete('search');
      newParams.delete('query');
    }
    setSearchParams(newParams);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    const newParams = new URLSearchParams(searchParams);
    newParams.set('page', '1');
    newParams.delete('search');
    newParams.delete('query');
    setSearchParams(newParams);
  };

  // Callbacks for CRUD actions
  const handleCreated = useCallback((item: Performance) => {
    setItems(prev => [item, ...prev]);
    performanceStore.addLocal(item);
    // Reload current page to update exact server total count
    loadData(currentPage, currentLimit, searchParam);
  }, [currentPage, currentLimit, searchParam, loadData]);

  const handleUpdated = useCallback((updated: Performance) => {
    setItems(prev => prev.map(p => p.id === updated.id ? updated : p));
    performanceStore.updateLocal(updated);
  }, []);

  const handleDeleted = useCallback((id: string) => {
    setItems(prev => prev.filter(p => p.id !== id));
    performanceStore.removeLocal(id);
    loadData(currentPage, currentLimit, searchParam);
  }, [currentPage, currentLimit, searchParam, loadData]);

  // Faqat owner rol uchun
  if (!isOwner) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          gap: 16,
          color: 'var(--text-muted)',
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'rgba(217,119,87,0.08)',
            border: '1px solid rgba(217,119,87,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Lock size={28} strokeWidth={1.5} style={{ color: '#D97757' }} />
        </div>
        <p style={{ fontSize: 16, color: 'var(--text-primary)', margin: 0 }}>
          Bu sahifaga kirish taqiqlangan
        </p>
        <p style={{ fontSize: 13, margin: 0 }}>
          Faqat <strong style={{ color: '#D97757' }}>owner</strong> roli uchun mavjud.
        </p>
      </div>
    );
  }

  const startCount = pagination.total === 0 ? 0 : (currentPage - 1) * currentLimit + 1;
  const endCount = Math.min(currentPage * currentLimit, pagination.total);

  return (
    <div
      style={{
        minHeight: '100%',
        fontFamily: 'var(--font-sans)',
        color: 'var(--text-primary)',
      }}
    >
      {/* ── Header ───────────────────────────────────────────── */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          marginBottom: 28,
          paddingBottom: 24,
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div>
          <p
            style={{
              fontSize: 11,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--accent)',
              marginBottom: 8,
              fontWeight: 600,
            }}
          >
            KATALOG
          </p>
          <h1
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 38,
              fontWeight: 500,
              letterSpacing: '-0.01em',
              margin: 0,
              lineHeight: 1.05,
            }}
          >
            Performance
          </h1>
          <p style={{ marginTop: 8, color: 'var(--text-muted)', fontSize: 14 }}>
            {loading
              ? 'Yuklanmoqda…'
              : `Jami: ${pagination.total} ta ishtirokchi · Sahifa ${currentPage} / ${pagination.totalPages}`}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <Button
            variant="ghost"
            onClick={() => loadData(currentPage, currentLimit, searchParam)}
            disabled={loading}
            title="Yangilash"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Yangilash
          </Button>
          <Button variant="primary" onClick={() => addModal.open()}>
            <Plus size={15} strokeWidth={2} />
            Qo'shish
          </Button>
        </div>
      </header>

      {/* ── Search & Filter Controls ─────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 24, flexWrap: 'wrap' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: 8, flex: 1, minWidth: 260 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-faint)',
                pointerEvents: 'none',
              }}
            />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Ism yoki kalit so'z bo'yicha qidirish…"
              className="form-input"
              style={{ paddingLeft: 36, width: '100%' }}
            />
          </div>
          <Button type="submit" variant="ghost">Qidirish</Button>
          {searchParam && (
            <Button type="button" variant="ghost" onClick={handleClearSearch}>Tozalash</Button>
          )}
        </form>

        {/* Limit Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)' }}>
          <span>Har sahifada:</span>
          {[15, 20, 40].map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => handleLimitChange(l)}
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: currentLimit === l ? 700 : 400,
                background: currentLimit === l ? 'rgba(217,119,87,0.15)' : 'rgba(255,255,255,0.03)',
                border: currentLimit === l ? '1px solid rgba(217,119,87,0.4)' : '1px solid var(--border)',
                color: currentLimit === l ? 'var(--accent)' : 'var(--text-muted)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* ── Error ────────────────────────────────────────────── */}
      {error && (
        <div
          style={{
            border: '1px solid rgba(220,80,80,0.3)',
            background: 'rgba(220,80,80,0.07)',
            color: '#F2A8A8',
            borderRadius: 12,
            padding: '14px 18px',
            marginBottom: 28,
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {/* ── Skeleton ─────────────────────────────────────────── */}
      {loading && <CardGridSkeleton count={currentLimit} />}

      {/* ── Empty state ──────────────────────────────────────── */}
      {!loading && !error && items.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: '80px 20px',
            color: 'var(--text-muted)',
            border: '1px dashed var(--border)',
            borderRadius: 16,
            marginBottom: 28,
          }}
        >
          {searchParam ? (
            <>
              <p style={{ fontSize: 16, color: 'var(--text-primary)', marginBottom: 4 }}>
                «{searchParam}» bo'yicha hech narsa topilmadi
              </p>
              <p style={{ fontSize: 13 }}>Qidiruv so'zini o'zgartirib ko'ring.</p>
              <Button variant="ghost" onClick={handleClearSearch} style={{ marginTop: 12 }}>
                Qidiruvni tozalash
              </Button>
            </>
          ) : (
            <>
              <p style={{ fontSize: 16, marginBottom: 6, color: 'var(--text-primary)' }}>
                Hozircha hech kim qo'shilmagan
              </p>
              <p style={{ fontSize: 13 }}>«Qo'shish» tugmasini bosing.</p>
            </>
          )}
        </div>
      )}

      {/* ── Grid ─────────────────────────────────────────────── */}
      {!loading && items.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 24,
            marginBottom: 36,
          }}
        >
          {items.map((item) => (
            <PerformanceCard
              key={item.id}
              item={item}
              onEdit={editModal.open}
              onDelete={deleteModal.open}
            />
          ))}
        </div>
      )}

      {/* ── Pagination Bar (Preserved in Query URL) ───────────── */}
      {!loading && pagination.total > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
            padding: '16px 20px',
            borderRadius: 12,
            border: '1px solid var(--border)',
            background: 'var(--bg-elevated)',
            marginTop: 20,
          }}
        >
          {/* Status */}
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Ko'rsatilmoqda: <strong style={{ color: 'var(--text-primary)' }}>{startCount} - {endCount}</strong> (Jami: <strong>{pagination.total}</strong> ta)
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Prev */}
            <button
              type="button"
              disabled={currentPage <= 1 || loading}
              onClick={() => handlePageChange(currentPage - 1)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 500,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--border)',
                color: currentPage <= 1 ? 'rgba(255,255,255,0.2)' : 'var(--text-primary)',
                cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <ChevronLeft size={15} />
              Oldingi
            </button>

            {/* Page buttons */}
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === pagination.totalPages || Math.abs(p - currentPage) <= 2)
              .map((p, idx, arr) => {
                const prev = arr[idx - 1];
                const showEllipsis = prev && p - prev > 1;
                return (
                  <span key={p} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {showEllipsis && <span style={{ color: 'var(--text-faint)', padding: '0 4px' }}>…</span>}
                    <button
                      type="button"
                      onClick={() => handlePageChange(p)}
                      style={{
                        minWidth: 34,
                        height: 34,
                        padding: '0 8px',
                        borderRadius: 8,
                        fontSize: 13,
                        fontWeight: p === currentPage ? 700 : 500,
                        background: p === currentPage ? 'var(--accent)' : 'rgba(255,255,255,0.03)',
                        color: p === currentPage ? '#fff' : 'var(--text-muted)',
                        border: p === currentPage ? '1px solid var(--accent)' : '1px solid var(--border)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {p}
                    </button>
                  </span>
                );
              })}

            {/* Next */}
            <button
              type="button"
              disabled={!pagination.hasNextPage || currentPage >= pagination.totalPages || loading}
              onClick={() => handlePageChange(currentPage + 1)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 500,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--border)',
                color: (!pagination.hasNextPage || currentPage >= pagination.totalPages) ? 'rgba(255,255,255,0.2)' : 'var(--text-primary)',
                cursor: (!pagination.hasNextPage || currentPage >= pagination.totalPages) ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Keyingi
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* ── Modals ───────────────────────────────────────────── */}
      <AddPerformanceModal
        open={addModal.isOpen}
        onClose={addModal.close}
        onCreated={handleCreated}
      />

      <EditPerformanceModal
        open={editModal.isOpen}
        item={editModal.target}
        onClose={editModal.close}
        onUpdated={handleUpdated}
      />

      <DeleteConfirmModal
        open={deleteModal.isOpen}
        item={deleteModal.target}
        onClose={deleteModal.close}
        onDeleted={handleDeleted}
      />
    </div>
  );
}
