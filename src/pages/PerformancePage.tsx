import { useCallback } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import PerformanceCard from '@/components/PerformanceCard';
import AddPerformanceModal from '@/components/AddPerformanceModal';
import EditPerformanceModal from '@/components/EditPerformanceModal';
import DeleteConfirmModal from '@/components/DeleteConfirmModal';
import SearchBar from '@/components/SearchBar';
import { Button, CardGridSkeleton } from '@/components/ui';
import { usePerformances } from '@/hooks/usePerformances';
import { useSearch } from '@/hooks/useSearch';
import { useModal } from '@/hooks/useModal';
import type { Performance } from '@/types';

export default function PerformancePage() {
  const { items, loading, error, refresh, addLocal, updateLocal, removeLocal } = usePerformances();
  const { query, sort, filtered, setQuery, setSort } = useSearch(items);

  const addModal    = useModal();
  const editModal   = useModal();
  const deleteModal = useModal();

  // Optimistic callbacks — instant UI update, no full refetch
  const handleCreated = useCallback((item: Performance) => addLocal(item), [addLocal]);
  const handleUpdated = useCallback((item: Performance) => updateLocal(item), [updateLocal]);
  const handleDeleted = useCallback((id: string) => removeLocal(id), [removeLocal]);

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
          marginBottom: 36,
          paddingBottom: 28,
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
            CATALOG
          </p>
          <h1
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 42,
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
              ? 'Loading…'
              : `${items.length} ta ishtirokchi${query ? ` · ${filtered.length} founded` : ''}`}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <Button variant="ghost" onClick={refresh} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin-slow' : ''} />
            Reflesh
          </Button>
          <Button variant="primary" onClick={() => addModal.open()}>
            <Plus size={15} strokeWidth={2} />
            Add
          </Button>
        </div>
      </header>

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

      {/* ── Search bar (only when data exists) ───────────────── */}
      {items.length > 0 && (
        <SearchBar
          query={query}
          sort={sort}
          total={items.length}
          onQueryChange={setQuery}
          onSortChange={setSort}
        />
      )}

      {/* ── Skeleton ─────────────────────────────────────────── */}
      {loading && items.length === 0 && <CardGridSkeleton count={8} />}

      {/* ── Empty state ──────────────────────────────────────── */}
      {!loading && !error && items.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: '80px 20px',
            color: 'var(--text-muted)',
            border: '1px dashed var(--border)',
            borderRadius: 16,
          }}
        >
          <p style={{ fontSize: 16, marginBottom: 6, color: 'var(--text-primary)' }}>
            There is no one here for now
          </p>
          <p style={{ fontSize: 13 }}>Click the «Add» button.</p>
        </div>
      )}

      {/* ── No search results ─────────────────────────────────── */}
      {!loading && items.length > 0 && filtered.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: '60px 20px',
            color: 'var(--text-muted)',
            border: '1px dashed var(--border)',
            borderRadius: 16,
          }}
        >
          <p style={{ fontSize: 15, color: 'var(--text-primary)', marginBottom: 4 }}>
            Nothing was found for «{query}»
          </p>
          <p style={{ fontSize: 13 }}>Search using a different word.</p>
        </div>
      )}

      {/* ── Grid ─────────────────────────────────────────────── */}
      {filtered.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 24,
          }}
        >
          {filtered.map((item) => (
            <PerformanceCard
              key={item.id}
              item={item}
              onEdit={editModal.open}
              onDelete={deleteModal.open}
            />
          ))}
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
