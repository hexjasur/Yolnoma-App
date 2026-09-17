import { memo } from 'react';
import { ExternalLink, Film } from 'lucide-react';
import type { AvPerformance } from '@/types';

interface AvPerformanceCardProps {
  item: AvPerformance;
}

const AvPerformanceCard = memo(function AvPerformanceCard({ item }: AvPerformanceCardProps) {
  const image = item.thumbnail_url || item.image_url;

  return (
    <article
      className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] transition-transform duration-200 hover:-translate-y-1 hover:border-[#D97757]/40"
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-black/20">
        <img
          src={image}
          alt={item.title}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          loading="lazy"
          onError={(event) => { event.currentTarget.src = 'https://placehold.co/400x600/1B1713/F2EDE6?text=AV'; }}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0f0d0b] via-transparent to-transparent" />
        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-md border border-[#D97757]/40 bg-[#17100d]/85 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#F4A58A]">
          <Film size={11} /> AV
        </span>
        {item.source_url && (
          <a
            href={item.source_url}
            target="_blank"
            rel="noreferrer"
            className="absolute right-3 top-3 rounded-md border border-white/15 bg-black/60 p-2 text-white/70 opacity-0 transition-opacity group-hover:opacity-100 hover:text-white"
            aria-label="Open source"
          >
            <ExternalLink size={13} />
          </a>
        )}
        <div className="absolute inset-x-0 bottom-0 p-4">
          <h3 className="truncate text-[15px] font-semibold text-[var(--text-primary)]">{item.title}</h3>
          <p className="mt-1 font-mono text-[11px] text-[#D97757]">{item.code}</p>
        </div>
      </div>
    </article>
  );
});

export default AvPerformanceCard;
