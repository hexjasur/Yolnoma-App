import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Clock, Eye, Star, ExternalLink, Loader2 } from 'lucide-react';
import { videoApi } from '@/services/videoApi';
import SaveVideoButton from '@/components/SaveVideoButton';
import VideoGallery from '@/components/VideoGallery';
import { Button } from '@/components/ui';
import type { EpornerVideo } from '@/types/video';

export default function VideoDetailPage() {
  const { videoId } = useParams<{ videoId: string }>();

  const [video, setVideo] = useState<EpornerVideo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [server, setServer] = useState<'www' | 'es'>('www');

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

  const defaultThumb = video?.default_thumb?.src || '';

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-[var(--text-muted)]">
        <Loader2 size={36} className="animate-spin text-[var(--accent)] mb-4" />
        <p className="text-sm">Video yuklanmoqda...</p>
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Link
          to="/videos"
          className="inline-flex items-center gap-2 text-sm text-[var(--text-faint)] hover:text-[#F2EDE6] transition-colors"
        >
          <ArrowLeft size={15} />
          Orqaga qaytish
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

  return (
    <div className="max-w-5xl mx-auto space-y-8" style={{ fontFamily: 'var(--font-sans)' }}>
      {/* Navigation Row */}
      <div className="flex items-center justify-between">
        <Link
          to="/videos"
          className="inline-flex items-center gap-2 text-sm text-[var(--text-faint)] hover:text-[#F2EDE6] transition-colors"
        >
          <ArrowLeft size={15} />
          Return to the stream
        </Link>
        <SaveVideoButton video={video} />
      </div>

      {/* Embed Player */}
      <div className="space-y-3">
        <div className="relative aspect-video w-full overflow-hidden rounded-3xl border border-[var(--border)] bg-black shadow-lg">
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
        <div className="flex gap-2 items-center justify-end">
          <span className="text-xs text-[var(--text-faint)] font-mono">Server / Subdomen:</span>
          <Button
            variant={server === 'www' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setServer('www')}
            className="h-8 py-0 px-3 text-xs"
          >
            WWW (Standard)
          </Button>
          <Button
            variant={server === 'es' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setServer('es')}
            className="h-8 py-0 px-3 text-xs"
          >
            ES (Subdomain)
          </Button>
        </div>
      </div>

      {/* Video Info Segment */}
      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <h1 className="font-serif text-3xl font-medium tracking-tight text-[var(--text-primary)]">
            {video.title}
          </h1>

          <div className="flex flex-wrap items-center gap-6 text-sm text-[var(--text-muted)]">
            <div className="flex items-center gap-1.5">
              <Clock size={16} />
              <span>Davomiyligi: <strong className="text-[var(--text-primary)]">{video.length_min}</strong></span>
            </div>

            <div className="flex items-center gap-1.5">
              <Star size={16} className="fill-[var(--accent)] stroke-[var(--accent)]" />
              <span>Reyting: <strong className="text-[var(--text-primary)]">{parseFloat(video.rate || '0').toFixed(1)}</strong></span>
            </div>

            <div className="flex items-center gap-1.5">
              <Eye size={16} />
              <span>Ko'rishlar: <strong className="text-[var(--text-primary)]">{video.views?.toLocaleString()}</strong></span>
            </div>
          </div>
        </div>

        {/* Action Widgets / Metadata Panel */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-6 space-y-5">
          <div>
            <span className="text-[10px] uppercase font-mono tracking-wider text-[var(--text-faint)]">
              Video ID
            </span>
            <p className="font-mono text-sm font-semibold text-[var(--text-primary)] mt-1">{video.id}</p>
          </div>

          <div className="h-px bg-[var(--border)]" />

          {/* External links */}
          <div className="space-y-3">
            <a
              href={`https://www.eporner.com/video-${video.id}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full"
            >
              <Button variant="primary" className="w-full justify-center gap-2">
                <ExternalLink size={14} />
                Eporner-da ko'rish
              </Button>
            </a>
          </div>
        </div>
      </div>

      {/* Screenshot gallery */}
      {defaultThumb && (
        <div className="border-t border-[var(--border)] pt-8">
          <VideoGallery defaultThumbUrl={defaultThumb} />
        </div>
      )}
    </div>
  );
}
