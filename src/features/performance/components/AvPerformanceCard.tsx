import { memo } from 'react';
import { ExternalLink, Film, Pencil, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { openInNewWindow } from '@/shared/lib/window';
import type { AvPerformance } from '@/types';
interface Props { item: AvPerformance; onEdit: (item: AvPerformance) => void; onDelete: (item: AvPerformance) => void; }
const AvPerformanceCard = memo(function AvPerformanceCard({ item, onEdit, onDelete }: Props) {
  const navigate = useNavigate();
  const path = `/performances/av/${item.id}`;
  return <article className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] transition-transform duration-200 hover:-translate-y-1 hover:border-[#D97757]/40" onClick={() => navigate(path)} data-link={path} data-href={`#${path}`}>
    <div className="relative aspect-[3/4] overflow-hidden bg-black/20"><img src={item.thumbnail_url || item.image_url} alt={item.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" loading="lazy" onError={(e) => { e.currentTarget.src = 'https://placehold.co/400x600/1B1713/F2EDE6?text=AV'; }} /><div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0f0d0b] via-transparent to-transparent" />
      <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-md border border-[#D97757]/40 bg-[#17100d]/85 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#F4A58A]"><Film size={11} /> AV</span>
      <div className="absolute right-3 top-3 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100"><button className="rounded-md border border-white/15 bg-black/70 p-2 text-white/70 hover:text-white" onClick={(e) => { e.stopPropagation(); openInNewWindow(path, item.title); }} aria-label="Open in New Window" title="Open in New Window"><ExternalLink size={13} /></button><button className="rounded-md border border-white/15 bg-black/70 p-2 text-white/70 hover:text-white" onClick={(e) => { e.stopPropagation(); onEdit(item); }} aria-label="Edit" title="Edit"><Pencil size={13} /></button><button className="rounded-md border border-white/15 bg-black/70 p-2 text-white/70 hover:text-red-300" onClick={(e) => { e.stopPropagation(); onDelete(item); }} aria-label="Delete" title="Delete"><Trash2 size={13} /></button></div>
      <div className="absolute inset-x-0 bottom-0 p-4"><h3 className="truncate text-[15px] font-semibold text-[var(--text-primary)]">{item.title}</h3><p className="mt-1 text-[11px] text-[#D97757]">{item.country}</p></div>
    </div></article>;
});
export default AvPerformanceCard;
