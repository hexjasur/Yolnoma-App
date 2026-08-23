import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  Eye,
  Star,
  ExternalLink,
  Calendar,
  Tag,
  Server,
} from 'lucide-react';
import { videoApi } from '@/features/videos/api/videoApi';
import SaveVideoButton from '@/features/videos/components/SaveVideoButton';
import VideoGallery from '@/features/videos/components/VideoGallery';
import { Button } from '@/shared/ui';
import { LineSkeleton } from '@/shared/ui/Skeleton';
import type { EpornerVideo } from '@/features/videos/types/video';

/** Skeleton matching VideoDetailPage layout while data loads. */
function VideoDetailSkeleton() {
  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Nav row */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <LineSkeleton width={140} height={18} />
        <div className="flex items-center gap-3">
          <LineSkeleton width={130} height={32} />
          <LineSkeleton width={90} height={32} />
        </div>
      </div>

      {/* Player */}
      <div className="space-y-3">
        <div
          className="skeleton aspect-video w-full rounded-3xl border border-[var(--border)]"
        />
        <div className="flex gap-2 items-center justify-between flex-wrap">
          <LineSkeleton width={220} height={13} />
          <div className="flex gap-1.5">
            <LineSkeleton width={100} height={26} />
            <LineSkeleton width={100} height={26} />
          </div>
        </div>
      </div>

      {/* Details card */}
      <div className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-6">
        <LineSkeleton width="70%" height={28} />

        <div className="flex flex-wrap items-center gap-4 border-t border-b border-[var(--border)] py-3">
          <LineSkeleton width={60} height={14} />
          <LineSkeleton width={90} height={14} />
          <LineSkeleton width={110} height={14} />
          <LineSkeleton width={130} height={14} />
        </div>

        <div className="space-y-2 pt-1">
          <LineSkeleton width={160} height={12} />
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <LineSkeleton key={i} width={60 + (i % 3) * 20} height={26} />
            ))}
          </div>
        </div>
      </div>

      {/* Gallery */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: 12,
        }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ aspectRatio: '16/9', borderRadius: 10 }} />
        ))}
      </div>
    </div>
  );
}

export default function VideoDetailPage() {
  const { videoId } = useParams<{ videoId: string }>();
  const location = useLocation();

  const [video, setVideo] = useState<EpornerVideo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [server, setServer] = useState<'www' | 'es'>('www');

  const backTarget =
    location.state?.from ||
    (sessionStorage.getItem('last_video_search_query')
      ? `/videos?query=${encodeURIComponent(sessionStorage.getItem('last_video_search_query')!)}`
      : '/videos');

  const loadVideo = useCallback(async () => {
    if (!videoId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await videoApi.getById(videoId);
      setVideo(data);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [videoId]);

  useEffect(() => {
    loadVideo();
  }, [loadVideo]);

  const screenshots = useMemo(() => {
    if (!video) return [];
    const defaultThumbSrc =
      video.default_thumb?.src ||
      (typeof video.default_thumb === 'string' ? video.default_thumb : '');

    const thumbList = (video.thumbs || []).map((t: any) =>
      typeof t === 'string' ? t : t?.src || ''
    );

    const combined = [defaultThumbSrc, ...thumbList].filter(Boolean);
    return Array.from(new Set(combined));
  }, [video]);

  const tags = useMemo(() => {
    if (!video?.keywords) return [];
    return video.keywords
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);
  }, [video]);

  if (loading) {
    return <VideoDetailSkeleton />;
  }

  if (error || !video) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Link
          to={backTarget}
          className="inline-flex items-center gap-2 text-sm text-[var(--text-faint)] hover:text-[#F2EDE6] transition-colors"
        >
          <ArrowLeft size={15} />
          Back
        </Link>

        <div className="rounded-2xl border border-red-500/25 bg-red-500/[0.06] p-6 text-center">
          <p className="font-semibold text-red-300 mb-2">Video yuklashda xato yuz berdi</p>
          <p className="text-sm text-red-300/70 mb-5">{error || 'Video topilmadi.'}</p>
          <Button variant="ghost" onClick={loadVideo}>
            Qayta urinish
          </Button>
        </div>
      </div>
    );
  }

  const formattedViews = video.views
    ? video.views >= 1000000
      ? `${(video.views / 1000000).toFixed(1)}M`
      : video.views >= 1000
      ? `${(video.views / 1000).toFixed(0)}K`
      : String(video.views)
    : '0';

  const rating = parseFloat(video.rate || '0').toFixed(1);

  return (
    <div className="max-w-5xl mx-auto space-y-8" style={{ fontFamily: 'var(--font-sans)' }}>
      {/* Navigation & Action Row */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Link
          to={backTarget}
          className="inline-flex items-center gap-2 text-sm text-[var(--text-faint)] hover:text-[#F2EDE6] transition-colors"
        >
          <ArrowLeft size={15} />
          Back
        </Link>

        <div className="flex items-center gap-3">
          {video.url && (
            <a
              href={video.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--accent-border)] transition-all text-decoration-none"
            >
              <ExternalLink size={13} />
              Epornerda ko'rish
            </a>
          )}
          <SaveVideoButton video={video} />
        </div>
      </div>

      {/* Embed Player */}
      <div className="space-y-3">
        <div className="relative aspect-video w-full overflow-hidden rounded-3xl border border-[var(--border)] bg-black shadow-2xl">
          <iframe
            src={`https://${server}.eporner.com/embed/${video.id}/`}
            title={video.title}
            width="100%"
            height="100%"
            frameBorder="0"
            allowFullScreen
            allow="autoplay; encrypted-media"
            className="absolute inset-0"
          />
        </div>

        {/* Server Selector Buttons */}
        <div className="flex gap-2 items-center justify-between flex-wrap text-xs text-[var(--text-faint)]">
          <div className="flex items-center gap-2">
            <Server size={13} />
            <span>If the video does not open, switch the server:</span>
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={() => setServer('www')}
              className={`px-3 py-1 rounded-md text-xs font-mono transition-all ${
                server === 'www'
                  ? 'bg-[var(--accent)] text-white font-bold'
                  : 'bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-muted)] hover:text-white'
              }`}
            >
              Server 1 (WWW)
            </button>
            <button
              onClick={() => setServer('es')}
              className={`px-3 py-1 rounded-md text-xs font-mono transition-all ${
                server === 'es'
                  ? 'bg-[var(--accent)] text-white font-bold'
                  : 'bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-muted)] hover:text-white'
              }`}
            >
              Server 2 (ES)
            </button>
          </div>
        </div>
      </div>

      {/* Video Details & Meta Badges */}
      <div className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-6">
        <h1 className="font-serif text-2xl sm:text-3xl font-medium tracking-tight text-[var(--text-primary)]">
          {video.title}
        </h1>

        {/* Metadata stats bar */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--text-muted)] border-t border-b border-[var(--border)] py-3">
          {/* Rating */}
          <div className="flex items-center gap-1.5">
            <Star size={14} className="fill-[var(--accent)] stroke-[var(--accent)]" />
            <span className="font-bold text-[var(--text-primary)]">{rating}</span>
            <span>/ 5.0</span>
          </div>

          {/* Views */}
          <div className="flex items-center gap-1.5">
            <Eye size={14} className="text-[var(--accent)]" />
            <span>{formattedViews} marta ko'rildi</span>
          </div>

          {/* Duration */}
          <div className="flex items-center gap-1.5">
            <Clock size={14} className="text-[var(--accent)]" />
            <span>Davomiyligi: <strong className="text-[var(--text-primary)]">{video.length_min || '0:00'}</strong></span>
          </div>

          {/* Added Date */}
          {video.added && (
            <div className="flex items-center gap-1.5">
              <Calendar size={14} className="text-[var(--accent)]" />
              <span>Qo'shilgan: {video.added}</span>
            </div>
          )}
        </div>

        {/* Tags / Keywords */}
        {tags.length > 0 && (
          <div className="space-y-2 pt-1">
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-faint)] uppercase tracking-wider font-semibold">
              <Tag size={12} />
              <span>Teglar va kalit so'zlar:</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <Link
                  key={tag}
                  to={`/videos?query=${encodeURIComponent(tag)}`}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-white/[0.04] border border-white/[0.08] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--accent-border)] hover:bg-[var(--accent-glow)] transition-all text-decoration-none"
                >
                  {tag}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Screenshots & Thumbnail Gallery */}
      <VideoGallery screenshots={screenshots} title={video.title} />
    </div>
  );
}
