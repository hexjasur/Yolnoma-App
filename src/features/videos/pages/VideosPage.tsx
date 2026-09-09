import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Film, Bookmark, ChevronLeft, ChevronRight, AlertCircle, RefreshCw, ArrowUpDown } from 'lucide-react';
import { usePerformanceList } from '@/features/performance/hooks/usePerformanceQueries';
import { useSavedVideos } from '@/features/videos/hooks/useSavedVideos';
import { useVideoSearch } from '@/features/videos/hooks/useVideoQueries';
import { useAuth } from '@/features/auth/AuthContext';
import VideoCard from '@/features/videos/components/VideoCard';
import { Button } from '@/shared/ui';
import type { EPVideo, VideoOrder } from '@/features/videos/types/video';
import { getErrorMessage } from '@/shared/lib/errors';

const VALID_ORDERS: VideoOrder[] = [
  'latest',
  'longest',
  'shortest',
  'most-popular',
  'top-rated',
  'top-weekly',
  'top-monthly',
];

export default function VideosPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Read URL query parameters as the source of truth
  const queryParam = searchParams.get('query') || '';
  const pageParam = parseInt(searchParams.get('page') || '1', 10);
  const currentPage = isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;

  const orderParamRaw = searchParams.get('order');
  const currentOrder: VideoOrder = VALID_ORDERS.includes(orderParamRaw as VideoOrder)
    ? (orderParamRaw as VideoOrder)
    : 'latest';

  const { user } = useAuth();
  const isOwner = user?.role === 'owner';
  const topPerformersQuery = usePerformanceList(1, 10, '', isOwner);
  const topPerformers = topPerformersQuery.data?.data ?? [];

  const [activeTab, setActiveTab] = useState<'search' | 'saved'>('search');
  const [queryInput, setQueryInput] = useState(queryParam);
  const videoSearchQuery = useVideoSearch(queryParam, currentPage, currentOrder, activeTab === 'search');
  const videos: EPVideo[] = videoSearchQuery.data?.videos ?? [];
  const totalVideos = Number(videoSearchQuery.data?.total_count ?? 0);
  const loading = videoSearchQuery.isLoading;
  const error = videoSearchQuery.error;

  // Cached Saved Videos Hook (no unnecessary refetch on navigation)
  const { savedVideos, savedLoading, refresh: loadSaved } = useSavedVideos(activeTab === 'saved');

  // Synchronize local search input when URL query changes
  useEffect(() => {
    setQueryInput(queryParam);
    if (queryParam.trim()) {
      sessionStorage.setItem('last_video_search_query', queryParam.trim());
    }
  }, [queryParam]);

  const handleOrderChange = (newOrder: VideoOrder) => {
    if (newOrder === currentOrder) return;
    const nextParams = new URLSearchParams(searchParams);
    if (queryParam) nextParams.set('query', queryParam);
    if (newOrder === 'latest') {
      nextParams.delete('order');
    } else {
      nextParams.set('order', newOrder);
    }
    nextParams.set('page', '1');
    setSearchParams(nextParams);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nextParams = new URLSearchParams();
    if (queryInput.trim()) {
      nextParams.set('query', queryInput.trim());
      if (currentOrder !== 'latest') {
        nextParams.set('order', currentOrder);
      }
      nextParams.set('page', '1');
      sessionStorage.setItem('last_video_search_query', queryInput.trim());
    }
    setSearchParams(nextParams);
  };

  const handlePerformerSelect = (name: string) => {
    setQueryInput(name);
    const nextParams = new URLSearchParams();
    nextParams.set('query', name);
    if (currentOrder !== 'latest') {
      nextParams.set('order', currentOrder);
    }
    nextParams.set('page', '1');
    sessionStorage.setItem('last_video_search_query', name);
    setSearchParams(nextParams);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage === currentPage) return;
    const nextParams = new URLSearchParams(searchParams);
    if (queryParam) nextParams.set('query', queryParam);
    if (currentOrder !== 'latest') nextParams.set('order', currentOrder);
    nextParams.set('page', String(newPage));
    setSearchParams(nextParams);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const totalPages = useMemo(() => Math.ceil(totalVideos / 20) || 1, [totalVideos]);

  return (
    <div style={{ fontFamily: 'var(--font-sans)', color: 'var(--text-primary)' }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <p className="text-[11px] letter-spacing-[0.18em] uppercase text-[var(--accent)] font-semibold mb-1">
            Module
          </p>
          <h1 className="font-serif text-4xl font-medium tracking-tight text-[var(--text-primary)]">
            Streams
          </h1>
        </div>

        {/* Search / Saved Tabs */}
        <div className="flex rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] p-1">
          <button
            onClick={() => setActiveTab('search')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              activeTab === 'search'
                ? 'bg-[var(--accent-glow)] text-[var(--accent)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Film size={14} />
            Search
          </button>
          <button
            onClick={() => setActiveTab('saved')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              activeTab === 'saved'
                ? 'bg-[var(--accent-glow)] text-[var(--accent)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Bookmark size={14} />
            Saved ({savedVideos.length})
          </button>
        </div>
      </div>

      {/* Main Content Areas */}
      {activeTab === 'search' ? (
        <div className="space-y-6">
          {/* Search Bar */}
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)]"
              />
              <input
                type="text"
                placeholder="Search by video title, model, or keyword…"
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                className="form-input w-full pl-10"
              />
            </div>
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? 'Searching…' : 'Search'}
            </Button>
          </form>

          {/* Quick Performers Filter Chips (Top 10 Fast & Optimized) */}
          {topPerformers.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-xs text-[var(--text-faint)] uppercase tracking-wider font-semibold">
                Catalog performance (Top 10):
              </span>
              <div className="flex flex-wrap gap-2">
                {topPerformers.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handlePerformerSelect(p.full_name)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      queryParam.toLowerCase() === p.full_name.toLowerCase()
                        ? 'border-[var(--accent)] bg-[var(--accent-glow)] text-[var(--text-primary)]'
                        : 'border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--accent-border)]'
                    }`}
                  >
                    {/* {p.thumbnail_url && (
                      <img
                        src={p.thumbnail_url}
                        alt={p.full_name}
                        className="w-4 h-4 rounded-full object-cover"
                      />
                    )} */}
                    {p.full_name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="flex items-center gap-2 p-4 rounded-xl border border-red-500/20 bg-red-500/10 text-red-300 text-sm">
              <AlertCircle size={16} />
              <span>{getErrorMessage(error)}</span>
            </div>
          )}

          {/* Loading Skeleton / Results Info & Sort Controls */}
          {queryParam && !error && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[var(--text-faint)] border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-3">
                <span>
                  «<strong className="text-[var(--text-primary)]">{queryParam}</strong>» found for:{' '}
                  {totalVideos} videos
                </span>
                {totalPages > 1 && (
                  <span className="text-[var(--text-muted)]">
                    • Page {currentPage} / {totalPages}
                  </span>
                )}
              </div>

              {/* Order / Sort Selector */}
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <span className="text-[var(--text-faint)] flex items-center gap-1">
                  <ArrowUpDown size={12} />
                  Sorting:
                </span>
                <select
                  value={currentOrder}
                  onChange={(e) => handleOrderChange(e.target.value as VideoOrder)}
                  disabled={loading}
                  aria-label="Procedure for sorting videos"
                  className="bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-primary)] rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-[var(--accent)] transition-colors cursor-pointer"
                >
                  <option value="latest">Latest</option>
                  <option value="longest">Longest</option>
                  <option value="shortest">Shortest</option>
                  <option value="most-popular">Most Popular</option>
                  <option value="top-rated">Top Rated</option>
                  <option value="top-weekly">Top Weekly</option>
                  <option value="top-monthly">Top Monthly</option>
                </select>
              </div>
            </div>
          )}

          {/* Video Grid */}
          {loading ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-video w-full rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border)] animate-pulse"
                />
              ))}
            </div>
          ) : videos.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {videos.map((v) => (
                <VideoCard key={v.id} video={v} />
              ))}
            </div>
          ) : queryParam ? (
            <div className="py-16 text-center text-[var(--text-muted)] border border-dashed border-[var(--border)] rounded-2xl">
              <Film size={32} className="mx-auto mb-2 opacity-30 text-[var(--accent)]" />
              <p className="text-base text-[var(--text-primary)]">No video found.</p>
              <p className="text-xs mt-1">Try searching with another word or name.</p>
            </div>
          ) : (
            <div className="py-20 text-center text-[var(--text-muted)] border border-dashed border-[var(--border)] rounded-2xl">
              <Search size={36} className="mx-auto mb-3 opacity-30 text-[var(--accent)]" />
              <p className="text-base text-[var(--text-primary)] font-medium">Global Search</p>
              <p className="text-xs mt-1">Type in the search bar or select one of the performance above.</p>
            </div>
          )}

          {/* Pagination Controls (Always preserving query and page in URL) */}
          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-between flex-wrap gap-4 pt-6 border-t border-[var(--border)] mt-8">
              <div className="text-xs text-[var(--text-faint)]">
                Showing: {(currentPage - 1) * 20 + 1} - {Math.min(currentPage * 20, totalVideos)} (Total: {totalVideos} ta)
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => handlePageChange(currentPage - 1)}
                  className="gap-1"
                >
                  <ChevronLeft size={14} /> Previous
                </Button>

                {/* Page numbers */}
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
                  .map((p, idx, arr) => {
                    const prev = arr[idx - 1];
                    const showEllipsis = prev && p - prev > 1;
                    return (
                      <span key={p} className="flex items-center gap-1">
                        {showEllipsis && <span className="text-[var(--text-faint)] px-1">…</span>}
                        <button
                          type="button"
                          onClick={() => handlePageChange(p)}
                          style={{
                            minWidth: 32,
                            height: 32,
                            padding: '0 6px',
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: p === currentPage ? 700 : 500,
                            background: p === currentPage ? 'var(--accent)' : 'rgba(255,255,255,0.03)',
                            color: p === currentPage ? '#fff' : 'var(--text-muted)',
                            border: p === currentPage ? '1px solid var(--accent)' : '1px solid var(--border)',
                            cursor: 'pointer',
                          }}
                        >
                          {p}
                        </button>
                      </span>
                    );
                  })}

                <Button
                  variant="ghost"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => handlePageChange(currentPage + 1)}
                  className="gap-1"
                >
                  Next <ChevronRight size={14} />
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Saved Videos Tab (User-Specific) */
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-[var(--text-muted)]">
              The collection of videos you saved ({savedVideos.length})
            </h2>
            <Button variant="ghost" size="sm" onClick={() => loadSaved()} disabled={savedLoading}>
              <RefreshCw size={13} className={savedLoading ? 'animate-spin' : ''} />
              Refresh
            </Button>
          </div>

          {savedLoading ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-video w-full rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border)] animate-pulse"
                />
              ))}
            </div>
          ) : savedVideos.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {savedVideos.map((sv) => {
                // Map SavedVideo to EPVideo shape for consistent card presentation
                const mappedVideo: EPVideo = {
                  id: sv.videoId,
                  title: sv.title,
                  url: '',
                  default_thumb: {
                    src: sv.defaultThumb,
                    size: 'big',
                    width: 640,
                    height: 360,
                  },
                  length_sec: 0,
                  length_min: sv.lengthMin,
                  views: parseInt(sv.views || '0', 10) || 0,
                  rate: sv.rate || '0.00',
                  keywords: '',
                  embed: '',
                  thumbs: [],
                };
                return <VideoCard key={sv.videoId} video={mappedVideo} />;
              })}
            </div>
          ) : (
            <div className="py-20 text-center text-[var(--text-muted)] border border-dashed border-[var(--border)] rounded-2xl">
              <Bookmark size={36} className="mx-auto mb-3 opacity-30 text-[var(--accent)]" />
              <p className="text-base text-[var(--text-primary)] font-medium">No saved videos</p>
              <p className="text-xs mt-1">
                You can add videos here by pressing the "Save" button while watching them.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
