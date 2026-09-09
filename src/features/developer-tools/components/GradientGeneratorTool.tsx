import { useMemo, useState } from 'react';
import { Copy, Download, Plus, RotateCcw, WandSparkles } from 'lucide-react';
import { ToolCard, ToolTitle } from './ToolShell';
import { toast } from '@/shared/ui/Toast';

type GradientType = 'linear' | 'radial' | 'conic' | 'repeating-linear' | 'repeating-radial';
type Stop = { id: string; color: string; position: number };
type Preset = { name: string; type: GradientType; angle: number; stops: [string, number][] };

const presets: Preset[] = [
  { name: 'Sunset', type: 'linear', angle: 135, stops: [['#FF512F', 0], ['#F09819', 100]] },
  { name: 'Ocean', type: 'linear', angle: 120, stops: [['#2193B0', 0], ['#6DD5ED', 100]] },
  { name: 'Aurora', type: 'linear', angle: 115, stops: [['#00F5A0', 0], ['#00D9F5', 48], ['#7B2FF7', 100]] },
  { name: 'Royal', type: 'radial', angle: 0, stops: [['#141E30', 0], ['#243B55', 100]] },
  { name: 'Peach', type: 'radial', angle: 0, stops: [['#ED4264', 0], ['#FFEDBC', 100]] },
  { name: 'Midnight', type: 'conic', angle: 45, stops: [['#050505', 0], ['#3B1D5A', 32], ['#D97757', 68], ['#050505', 100]] },
];

const makeStops = (preset: Preset): Stop[] => preset.stops.map(([color, position]) => ({ id: crypto.randomUUID(), color, position }));
const initialPreset = presets[0];

function stopText(stops: Stop[]) {
  return stops.map((stop) => `${stop.color} ${stop.position}%`).join(', ');
}

function buildGradient(type: GradientType, angle: number, stops: Stop[]) {
  const colors = stopText(stops);
  if (type === 'radial') return `radial-gradient(ellipse at center, ${colors})`;
  if (type === 'repeating-radial') return `repeating-radial-gradient(ellipse at center, ${colors})`;
  if (type === 'conic') return `conic-gradient(from ${angle}deg at center, ${colors})`;
  if (type === 'repeating-linear') return `repeating-linear-gradient(${angle}deg, ${colors})`;
  return `linear-gradient(${angle}deg, ${colors})`;
}

export default function GradientGeneratorTool() {
  const [type, setType] = useState<GradientType>(initialPreset.type);
  const [angle, setAngle] = useState(initialPreset.angle);
  const [stops, setStops] = useState<Stop[]>(makeStops(initialPreset));
  const [copied, setCopied] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState(initialPreset.name);

  const gradient = useMemo(() => buildGradient(type, angle, stops), [type, angle, stops]);
  const css = `.gradient {
  background: ${gradient};
}`;
  const config = JSON.stringify({ type, angle, stops: stops.map(({ color, position }) => ({ color, position })) }, null, 2);

  const applyPreset = (preset: Preset) => {
    setType(preset.type);
    setAngle(preset.angle);
    setStops(makeStops(preset));
    setSelectedPreset(preset.name);
  };
  const updateStop = (id: string, patch: Partial<Stop>) => setStops((current) => current.map((stop) => stop.id === id ? { ...stop, ...patch } : stop));
  const addStop = () => setStops((current) => [...current, { id: crypto.randomUUID(), color: '#FFFFFF', position: 50 }]);
  const removeStop = (id: string) => setStops((current) => current.length > 2 ? current.filter((stop) => stop.id !== id) : current);
  const copyCss = async () => { await navigator.clipboard.writeText(css); setCopied(true); window.setTimeout(() => setCopied(false), 1400); };
  const downloadCss = () => { const blob = new Blob([css], { type: 'text/css' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'gradient.css'; anchor.click(); URL.revokeObjectURL(url); toast.success('Gradient CSS downloaded'); };

  return <ToolCard><ToolTitle icon={WandSparkles} text="Gradient Generator" subtitle="Build production-ready linear, radial, conic, and repeating CSS gradients with live preview." /><div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]"><div className="space-y-5"><div className="h-64 w-full border border-white/[0.12] bg-[#0d0d0a] shadow-inner" style={{ background: gradient }} /><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2">{presets.map((preset) => <button key={preset.name} type="button" onClick={() => applyPreset(preset)} className={`border px-3 py-2 text-xs ${selectedPreset === preset.name ? 'border-[var(--accent)] bg-[var(--accent-glow)] text-[var(--accent)]' : 'border-white/10 text-white/45 hover:text-white'}`}>{preset.name}</button>)}</div><button type="button" onClick={() => applyPreset(initialPreset)} className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white"><RotateCcw size={13} /> Reset</button></div><div className="border border-white/[0.08] bg-black/10 p-4"><div className="grid gap-4 md:grid-cols-2"><label className="text-xs text-white/50">Gradient type<select value={type} onChange={(event) => { setType(event.target.value as GradientType); setSelectedPreset(''); }} className="mt-2 w-full border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none"><option value="linear">Linear</option><option value="radial">Radial</option><option value="conic">Conic</option><option value="repeating-linear">Repeating linear</option><option value="repeating-radial">Repeating radial</option></select></label><label className="text-xs text-white/50">Angle <span className="text-white">{angle}°</span><input type="range" min="0" max="360" value={angle} onChange={(event) => { setAngle(Number(event.target.value)); setSelectedPreset(''); }} className="mt-3 w-full accent-[var(--accent)]" /></label></div></div></div><aside className="border border-white/[0.08] bg-black/10 p-4"><div className="flex items-center justify-between"><h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Color stops</h3><button type="button" onClick={addStop} className="inline-flex items-center gap-1 text-xs text-[var(--accent)]"><Plus size={14} /> Add</button></div><div className="mt-4 space-y-3">{stops.map((stop, index) => <div key={stop.id} className="border border-white/[0.07] p-3"><div className="flex items-center gap-2"><input type="color" value={stop.color} onChange={(event) => { updateStop(stop.id, { color: event.target.value }); setSelectedPreset(''); }} className="h-8 w-8 cursor-pointer border-0 bg-transparent" /><input value={stop.color} onChange={(event) => { updateStop(stop.id, { color: event.target.value }); setSelectedPreset(''); }} className="min-w-0 flex-1 bg-transparent font-mono text-xs uppercase text-white/75 outline-none" /><button type="button" onClick={() => removeStop(stop.id)} disabled={stops.length <= 2} className="text-xs text-white/25 hover:text-red-300 disabled:opacity-20">Remove</button></div><label className="mt-3 block text-[10px] text-white/35">Position: {stop.position}%<input type="range" min="0" max="100" value={stop.position} onChange={(event) => { updateStop(stop.id, { position: Number(event.target.value) }); setSelectedPreset(''); }} className="mt-2 w-full accent-[var(--accent)]" /></label><span className="sr-only">Color stop {index + 1}</span></div>)}</div></aside></div><div className="mt-6 grid gap-4 xl:grid-cols-2"><div><div className="mb-2 flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">CSS output</span><div className="flex gap-3"><button type="button" onClick={() => void copyCss()} className="inline-flex items-center gap-1.5 text-xs text-white/45 hover:text-white"><Copy size={13} /> {copied ? 'Copied' : 'Copy'}</button><button type="button" onClick={downloadCss} className="inline-flex items-center gap-1.5 text-xs text-white/45 hover:text-white"><Download size={13} /> Download</button></div></div><pre className="min-h-32 overflow-auto border border-white/[0.08] bg-[#0d0d0a] p-4 font-mono text-xs leading-6 text-emerald-100/75">{css}</pre></div><div><div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">Config JSON</div><pre className="min-h-32 overflow-auto border border-white/[0.08] bg-[#0d0d0a] p-4 font-mono text-xs leading-6 text-white/55">{config}</pre></div></div></ToolCard>;
}
