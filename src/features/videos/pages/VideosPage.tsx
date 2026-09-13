import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Film, Bookmark, AlertCircle, RefreshCw, ArrowUpDown } from 'lucide-react';
import { usePerformanceList } from '@/features/performance/hooks/usePerformanceQueries';
import { useSavedVideos } from '@/features/videos/hooks/useSavedVideos';
import { useVideoSearch } from '@/features/videos/hooks/useVideoQueries';
import { useAuth } from '@/features/auth/AuthContext';
import VideoCard from '@/features/videos/components/VideoCard';
import { Button, Pagination, SearchInput, SelectMenu } from '@/shared/ui';
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
            <SearchInput
              size="lg"
              placeholder="Search by video title, model, or keyword…"
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              onClear={() => setQueryInput('')}
              className="flex-1"
            />
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
                <SelectMenu
                  value={currentOrder}
                  onChange={(value) => handleOrderChange(value as VideoOrder)}
                  disabled={loading}
                  ariaLabel="Sort videos"
                  options={[
                    { value: 'latest', label: 'Latest' },
                    { value: 'longest', label: 'Longest' },
                    { value: 'shortest', label: 'Shortest' },
                    { value: 'most-popular', label: 'Most Popular' },
                    { value: 'top-rated', label: 'Top Rated' },
                    { value: 'top-weekly', label: 'Top Weekly' },
                    { value: 'top-monthly', label: 'Top Monthly' },
                  ]}
                />
              </div>
            </div>
          )}

          {!loading && totalVideos > 0 && (
            <Pagination
              page={currentPage}
              totalPages={totalPages}
              total={totalVideos}
              limit={20}
              onPageChange={handlePageChange}
              loading={loading}
              itemLabel="videos"
            />
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
          {!loading && totalVideos > 0 && (
            <div className="mt-8 border-t border-[var(--border)] pt-6">
              <Pagination
                page={currentPage}
                totalPages={totalPages}
                total={totalVideos}
                limit={20}
                onPageChange={handlePageChange}
                loading={loading}
                itemLabel="videos"
              />
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
