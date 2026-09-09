import { useState, memo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Clock, Eye, Star } from 'lucide-react';
import HoverPreview from './HoverPreview';
import type { EPVideo } from '@/features/videos/types/video';

interface VideoCardProps {
  video: EPVideo;
}

function VideoCard({ video }: VideoCardProps) {
  const location = useLocation();
  const [isHovered, setIsHovered] = useState(false);

  const thumbUrl = video.default_thumb?.src || '';
  const rating = parseFloat(video.rate || '0').toFixed(1);

  // Format views count
  const formattedViews = video.views
    ? video.views >= 1000000
      ? `${(video.views / 1000000).toFixed(1)}M`
      : video.views >= 1000
      ? `${(video.views / 1000).toFixed(0)}K`
      : String(video.views)
    : '0';

  return (
    <div
      className="perf-card relative flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)]"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ minHeight: 280 }}
    >
      <Link
        to={`/videos/${video.id}`}
        state={{ from: location.pathname + location.search }}
        className="block flex-1 flex flex-col text-decoration-none"
      >
        {/* Aspect Ratio Container for Thumbnail */}
        <div className="relative aspect-video w-full overflow-hidden bg-[#14110E] border-b border-[var(--border)]">
          <HoverPreview
            defaultThumbUrl={thumbUrl}
            thumbs={video.thumbs}
            isHovered={isHovered}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />

          {/* Duration Badge */}
          <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1 rounded-md bg-black/75 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[var(--text-primary)]">
            <Clock size={10} />
            {video.length_min || '0:00'}
          </div>
        </div>

        {/* Details Content */}
        <div className="flex flex-1 flex-col p-4">
          <h3
            className="line-clamp-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:text-[var(--accent)]"
            style={{ minHeight: '2.5rem', lineHeight: '1.25rem', marginBottom: 12 }}
            title={video.title}
          >
            {video.title}
          </h3>

          <div className="mt-auto flex items-center justify-between text-xs text-[var(--text-faint)]">
            {/* Rating */}
            <div className="flex items-center gap-1 font-semibold text-[#F2EDE6]">
              <Star size={12} className="fill-[var(--accent)] stroke-[var(--accent)]" />
              <span>{rating}</span>
            </div>

            {/* Views */}
            <div className="flex items-center gap-1">
              <Eye size={12} />
              <span>Viewed {formattedViews} times</span>
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}

export default memo(VideoCard);
