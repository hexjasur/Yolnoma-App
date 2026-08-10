import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Film, Bookmark, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { videoApi } from '@/services/videoApi';
import { usePerformances } from '@/hooks/usePerformances';
import VideoCard from '@/components/VideoCard';
import { Button, Input } from '@/components/ui';
import type { EpornerVideo, SavedVideo } from '@/types/video';

export default function VideosPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('query') || '';

  const { items: performers } = usePerformances();

  const [activeTab, setActiveTab] = useState<'search' | 'saved'>('search');
  const [query, setQuery] = useState(initialQuery);
  const [page, setPage] = useState(1);
  const [videos, setVideos] = useState<EpornerVideo[]>([]);
  const [totalVideos, setTotalVideos] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Saved videos state
  const [savedVideos, setSavedVideos] = useState<SavedVideo[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);

  // Sync URL query changes to state
  useEffect(() => {
    const q = searchParams.get('query') || '';
    setQuery(q);
    setPage(1);
  }, [searchParams]);

  // Load Eporner videos
  const fetchVideos = useCallback(async (searchQuery: string, pageNum: number) => {
    if (!searchQuery.trim()) {
      setVideos([]);
      setTotalVideos(0);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await videoApi.search(searchQuery, pageNum);
      setVideos(res.videos || []);
      setTotalVideos(parseInt(String(res.total_count || 0)));
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch when query or page changes
  useEffect(() => {
    if (activeTab === 'search') {
      fetchVideos(query, page);
    }
  }, [query, page, activeTab, fetchVideos]);

  // Load Saved Videos
  const loadSaved = useCallback(async () => {
    setSavedLoading(true);
    try {
      const list = await videoApi.listSaved();
      setSavedVideos(list);
    } catch (err) {
      console.error(err);
    } finally {
      setSavedLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'saved') {
      loadSaved();
    }
  }, [activeTab, loadSaved]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearchParams({ query });
  };

  const handlePerformerSelect = (name: string) => {
    setQuery(name);
    setPage(1);
    setSearchParams({ query: name });
  };

  const totalPages = useMemo(() => Math.ceil(totalVideos / 20), [totalVideos]);

  return (
    <div style={{ fontFamily: 'var(--font-sans)', color: 'var(--text-primary)' }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <p className="text-[11px] letter-spacing-[0.18em] uppercase text-[var(--accent)] font-semibold mb-1">
            Modul
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
            Qidirish
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
            Saqlanganlar
          </button>
        </div>
      </div>

      {activeTab === 'search' ? (
        <div className="space-y-6">
          {/* Search Controls */}
          <div className="grid gap-4 md:grid-cols-[1fr_260px]">
            {/* Input query */}
            <form onSubmit={handleSearchSubmit} className="relative">
              <Input
                placeholder="Performer yoki video nomi..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pr-12"
              />
              <button
                type="submit"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-faint)] hover:text-[var(--text-primary)] transition-colors"
              >
                <Search size={18} />
              </button>
            </form>

            {/* Quick Performer Select */}
            <div className="relative">
              <select
                onChange={(e) => handlePerformerSelect(e.target.value)}
                value={performers.some((p) => p.full_name === query) ? query : ''}
                className="w-full bg-[rgba(242,237,230,0.03)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-border)] focus:bg-[var(--accent-glow)] transition-all cursor-pointer appearance-none"
              >
                <option value="" className="bg-[var(--bg-elevated)]">
                  Tezkor qidiruv (Performerlar)
                </option>
                {performers.map((perf) => (
                  <option key={perf.id} value={perf.full_name} className="bg-[var(--bg-elevated)]">
                    {perf.full_name}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 border-l-4 border-r-4 border-t-4 border-transparent border-t-[var(--text-faint)]" />
            </div>
          </div>

          {/* Error State */}
          {error && (
            <div className="flex items-center gap-3 rounded-xl border border-red-500/25 bg-red-500/[0.06] p-4 text-sm text-red-300">
              <AlertCircle size={16} />
              <span>Ma'lumotlarni yuklashda xatolik yuz berdi: {error}</span>
            </div>
          )}

          {/* Loading Skeletons */}
          {loading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="space-y-3">
                  <div className="skeleton aspect-video w-full rounded-2xl" />
                  <div className="skeleton h-4 w-3/4 rounded-md" />
                  <div className="flex justify-between">
                    <div className="skeleton h-3 w-1/4 rounded-md" />
                    <div className="skeleton h-3 w-1/4 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Video list */}
          {!loading && videos.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {videos.map((video) => (
                <VideoCard key={video.id} video={video} />
              ))}
            </div>
          )}

          {/* Empty search */}
          {!loading && !query.trim() && (
            <div className="rounded-2xl border border-dashed border-[var(--border)] p-12 text-center text-[var(--text-muted)]">
              <Film className="mx-auto mb-4 text-[var(--text-faint)]" size={36} />
              <p className="text-sm">Enter a name to search for data or select a performer from the quick list.</p>
            </div>
          )}

          {/* No results */}
          {!loading && query.trim() && videos.length === 0 && !error && (
            <div className="rounded-2xl border border-dashed border-[var(--border)] p-12 text-center text-[var(--text-muted)]">
              <AlertCircle className="mx-auto mb-4 text-[var(--text-faint)]" size={36} />
              <p className="text-sm">"{query}" bo'yicha hech qanday video topilmadi.</p>
            </div>
          )}

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-[var(--border)] pt-6 mt-8">
              <p className="text-xs text-[var(--text-faint)] font-mono">
                Jami: {totalVideos} video · Sahifa {page} / {totalPages}
              </p>
              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft size={16} /> Oldingi
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                  disabled={page === totalPages}
                >
                  Keyingi <ChevronRight size={16} />
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Saved Videos Tab */
        <div className="space-y-6">
          {savedLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-3">
                  <div className="skeleton aspect-video w-full rounded-2xl" />
                  <div className="skeleton h-4 w-3/4 rounded-md" />
                </div>
              ))}
            </div>
          )}

          {!savedLoading && savedVideos.length === 0 && (
            <div className="rounded-2xl border border-dashed border-[var(--border)] p-12 text-center text-[var(--text-muted)]">
              <Bookmark className="mx-auto mb-4 text-[var(--text-faint)]" size={36} />
              <p className="text-sm">There are no saved Streams yet.</p>
            </div>
          )}

          {!savedLoading && savedVideos.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {savedVideos.map((saved) => {
                // Map SavedVideo back to EpornerVideo format for reuse in VideoCard
                const mappedVideo: EpornerVideo = {
                  id: saved.videoId,
                  title: saved.title,
                  url: `https://www.eporner.com/video-${saved.videoId}/`,
                  default_thumb: { size: 'medium', width: 333, height: 240, src: saved.defaultThumb },
                  length_min: saved.lengthMin,
                  length_sec: 0,
                  views: parseInt(saved.views.replace(/[^0-9]/g, '')) || 0,
                  rate: saved.rate,
                  keywords: '',
                  embed: `https://www.eporner.com/embed/${saved.videoId}/`,
                };
                return <VideoCard key={mappedVideo.id} video={mappedVideo} />;
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
