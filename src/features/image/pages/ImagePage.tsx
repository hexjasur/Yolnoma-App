import { Image as ImageIcon, Minimize2, RefreshCw } from 'lucide-react';
import ImageConverterTool from '../components/ImageConverterTool';
import ImageCompressorTool from '../components/ImageCompressorTool';
import { useHashTab } from '@/shared/hooks/useHashTab';

type ImageTab = 'converter' | 'compressor';

export default function ImagePage() {
  const [tab, selectTab] = useHashTab<ImageTab>(['converter', 'compressor'], 'converter', '#/tools/image');

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[var(--bg-base)] text-[var(--text-primary)]">
      <header className="shrink-0 border-b border-[var(--border)] bg-[var(--bg-elevated)] px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-[var(--accent-border)] bg-[var(--accent-dim)] p-2.5"><ImageIcon size={22} className="text-[var(--accent)]" /></div>
          <div><h1 className="text-base font-semibold tracking-wide text-[var(--text-primary)]">Image</h1><p className="text-xs text-[var(--text-muted)]">Convert, compress, and optimize images locally.</p></div>
        </div>
        <div className="mt-4 flex gap-2 border-t border-white/[0.06] pt-3">
          <button type="button" onClick={() => selectTab('converter')} className={`inline-flex items-center gap-2 border px-4 py-2 text-xs font-semibold transition-colors ${tab === 'converter' ? 'border-[var(--accent-border)] bg-[var(--accent-dim)] text-[var(--accent)]' : 'border-white/[0.08] text-white/45 hover:bg-white/[0.05] hover:text-white'}`}><RefreshCw size={14} /> Converter</button>
          <button type="button" onClick={() => selectTab('compressor')} className={`inline-flex items-center gap-2 border px-4 py-2 text-xs font-semibold transition-colors ${tab === 'compressor' ? 'border-[var(--accent-border)] bg-[var(--accent-dim)] text-[var(--accent)]' : 'border-white/[0.08] text-white/45 hover:bg-white/[0.05] hover:text-white'}`}><Minimize2 size={14} /> Compressor</button>
        </div>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto"><div className="p-6 pb-6">{tab === 'converter' ? <ImageConverterTool /> : <ImageCompressorTool />}</div></main>
    </div>
  );
}
