import type { FormEvent } from 'react';
import type { SetURLSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import AvPerformanceCard from '@/features/performance/components/AvPerformanceCard';
import AddPerformanceModal from '@/features/performance/components/AddPerformanceModal';
import { Button, CardGridSkeleton, Pagination, SearchInput } from '@/shared/ui';
import type { AvPerformance, PaginationMeta } from '@/types';

interface Props {
  setSearchParams: SetURLSearchParams;
  searchParam: string;
  currentPage: number;
  currentLimit: number;
  items: AvPerformance[];
  pagination: PaginationMeta;
  loading: boolean;
  error: unknown;
  searchInput: string;
  setSearchInput: (value: string) => void;
  onSearchSubmit: (event: FormEvent) => void;
  onClearSearch: () => void;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  onRefresh: () => void;
  onAdd: () => void;
  addModalOpen: boolean;
  onAddClose: () => void;
}

export default function AvPerformanceCatalog({
  setSearchParams,
  searchParam,
  currentPage,
  currentLimit,
  items,
  pagination,
  loading,
  error,
  searchInput,
  setSearchInput,
  onSearchSubmit,
  onClearSearch,
  onPageChange,
  onLimitChange,
  onRefresh,
  onAdd,
  addModalOpen,
  onAddClose,
}: Props) {
  return (
    <div style={{ minHeight: '100%', fontFamily: 'var(--font-sans)', color: 'var(--text-primary)' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28, paddingBottom: 24, borderBottom: '1px solid var(--border)' }}>
        <div>
          <p style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 8, fontWeight: 600 }}>JAPAN · AV CATALOG</p>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 38, fontWeight: 500, letterSpacing: '-0.01em', margin: 0, lineHeight: 1.05 }}>AV Performances</h1>
          <p style={{ marginTop: 8, color: 'var(--text-muted)', fontSize: 14 }}>
            {loading ? 'Loading…' : `Total: ${pagination.total} AV performance · Page ${currentPage} / ${pagination.totalPages}`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button variant="ghost" onClick={() => setSearchParams({ type: 'regular', page: '1', limit: String(currentLimit) })}>
            <ArrowLeft size={14} /> Performances
          </Button>
          <Button variant="ghost" onClick={onRefresh} disabled={loading} title="Refresh">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </Button>
          <Button variant="primary" onClick={onAdd}>New</Button>
        </div>
      </header>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 24, flexWrap: 'wrap' }}>
        <form onSubmit={onSearchSubmit} style={{ display: 'flex', gap: 8, flex: 1, minWidth: 260 }}>
          <SearchInput size="md" width="wide" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} onClear={onClearSearch} placeholder="Search by title or code…" />
          <Button type="submit" variant="ghost">Search</Button>
          {searchParam && <Button type="button" variant="ghost" onClick={onClearSearch}>Clear</Button>}
        </form>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)' }}>
          <span>On every page:</span>
          {[15, 20, 40].map((limit) => (
            <button key={limit} type="button" onClick={() => onLimitChange(limit)} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: currentLimit === limit ? 700 : 400, background: currentLimit === limit ? 'rgba(217,119,87,0.15)' : 'rgba(255,255,255,0.03)', border: currentLimit === limit ? '1px solid rgba(217,119,87,0.4)' : '1px solid var(--border)', color: currentLimit === limit ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer' }}>{limit}</button>
          ))}
        </div>
      </div>

      {Boolean(error) && (
        <div style={{ border: '1px solid rgba(220,80,80,0.3)', background: 'rgba(220,80,80,0.07)', color: '#F2A8A8', borderRadius: 12, padding: '14px 18px', marginBottom: 28, fontSize: 13, display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertCircle size={18} /> <span>Unable to load AV performances. Check that the backend table migration has been applied.</span>
        </div>
      )}

      {!loading && pagination.total > 0 && <Pagination page={currentPage} totalPages={pagination.totalPages} total={pagination.total} limit={currentLimit} onPageChange={onPageChange} onLimitChange={onLimitChange} limitOptions={[15, 20, 40]} loading={loading} itemLabel="AV performances" />}
      {loading && <CardGridSkeleton count={currentLimit} />}
      {!loading && !error && items.length === 0 && <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: 16, marginBottom: 28 }}><p style={{ fontSize: 16, color: 'var(--text-primary)' }}>{searchParam ? `Nothing was found for… «${searchParam}»` : 'No AV performances have been added yet.'}</p></div>}
      {!loading && items.length > 0 && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 24, marginTop: 28, marginBottom: 36 }}>{items.map((item) => <AvPerformanceCard key={item.id} item={item} />)}</div>}
      {!loading && pagination.total > 0 && <div style={{ marginTop: 20 }}><Pagination page={currentPage} totalPages={pagination.totalPages} total={pagination.total} limit={currentLimit} onPageChange={onPageChange} onLimitChange={onLimitChange} limitOptions={[15, 20, 40]} loading={loading} itemLabel="AV performances" /></div>}
      <AddPerformanceModal open={addModalOpen} onClose={onAddClose} defaultType="av_performance" />
    </div>
  );
}
