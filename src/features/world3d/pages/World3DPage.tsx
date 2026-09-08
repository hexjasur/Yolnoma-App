import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, CloudSun, Compass, Maximize2, Sparkles, Trees, X } from 'lucide-react';
import YolnomaWorld from '../components/YolnomaWorld';

const NODE_ROUTES: Record<string, string> = {
  observatory: '/',
  developer: '/tools/developer-tools',
  'file-forest': '/tools/file-intelligence',
  system: '/',
};

export default function World3DPage() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string | null>(null);
  const selectedLabel = selected === 'observatory' ? 'Observatory' : selected === 'developer' ? 'Developer Lab' : selected === 'file-forest' ? 'File Forest' : selected === 'system' ? 'System Control' : null;
  const openNode = () => { if (selected) navigate(NODE_ROUTES[selected]); };

  return <div className="fixed inset-0 z-20 overflow-hidden bg-[#07131d] text-white"><YolnomaWorld onSelect={setSelected} /><div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,transparent_0%,rgba(3,10,16,.08)_48%,rgba(3,8,13,.75)_100%)]" /><header className="pointer-events-none absolute left-0 right-0 top-0 flex items-start justify-between p-6 md:p-8"><div><p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-amber-200/80"><Trees size={14} /> Yolnoma World</p><h1 className="mt-2 font-serif text-3xl tracking-tight text-white md:text-5xl">The living desktop</h1><p className="mt-2 max-w-md text-xs leading-5 text-white/45">A quiet place for your tools, your data and the weather above it all.</p></div><div className="pointer-events-auto flex items-center gap-2"><Link to="/" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs font-medium text-white/70 backdrop-blur-md transition hover:bg-white/10 hover:text-white"><ArrowLeft size={14} /> Classic dashboard</Link></div></header><div className="pointer-events-none absolute bottom-6 left-6 right-6 flex items-end justify-between gap-4 md:bottom-8 md:left-8 md:right-8"><div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-xs text-white/55 shadow-2xl backdrop-blur-md"><Compass size={16} className="text-amber-200" /><span>Drag to orbit · Scroll to zoom · Click a world node</span></div><div className="hidden items-center gap-2 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-xs text-white/45 backdrop-blur-md sm:flex"><CloudSun size={16} className="text-sky-300" /> Night sky · Living environment</div></div>{selected && <div className="pointer-events-auto absolute bottom-24 left-1/2 w-[min(360px,calc(100vw-32px))] -translate-x-1/2 rounded-3xl border border-white/15 bg-[#0c1820]/90 p-5 shadow-2xl backdrop-blur-xl"><button type="button" onClick={() => setSelected(null)} className="absolute right-4 top-4 text-white/40 hover:text-white"><X size={16} /></button><div className="flex items-center gap-3"><div className="rounded-xl bg-amber-300/15 p-3 text-amber-200"><Sparkles size={19} /></div><div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-200/70">World node</p><h2 className="mt-1 text-lg font-semibold text-white">{selectedLabel}</h2></div></div><p className="mt-4 text-sm leading-6 text-white/55">This place is connected to a real Yolnoma workspace. Open it to continue.</p><button type="button" onClick={openNode} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-200 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-100"><Maximize2 size={15} /> Open workspace</button></div>}</div>;
}
