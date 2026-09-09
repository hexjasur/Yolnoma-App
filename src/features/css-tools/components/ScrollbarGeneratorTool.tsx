import { useMemo, useState } from 'react';
import { Copy, Download, PanelRight } from 'lucide-react';
import { toast } from '@/shared/ui/Toast';
import { ToolCard, ToolTitle } from '@/features/developer-tools/components/ToolShell';

const colorDefaults = { thumb: '#7FBF8F', track: '#232E33' };

export default function ScrollbarGeneratorTool() {
  const [thumbColor, setThumbColor] = useState(colorDefaults.thumb);
  const [trackColor, setTrackColor] = useState(colorDefaults.track);
  const [width, setWidth] = useState(14);
  const [radius, setRadius] = useState(3);
  const [borderWidth, setBorderWidth] = useState(0);
  const [borderColor, setBorderColor] = useState('#0D1117');
  const css = useMemo(() => `:root {
  --scrollbar-track: ${trackColor};
  --scrollbar-thumb: ${thumbColor};
  --scrollbar-width: ${width}px;
  --scrollbar-radius: ${radius}px;
  --scrollbar-border-width: ${borderWidth}px;
  --scrollbar-border-color: ${borderColor};
}

/* Firefox */
* {
  scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
  scrollbar-width: ${width <= 8 ? 'thin' : 'auto'};
}

/* Chromium, Safari, and Edge */
*::-webkit-scrollbar {
  width: var(--scrollbar-width);
  height: var(--scrollbar-width);
}

*::-webkit-scrollbar-track {
  background: var(--scrollbar-track);
  border-radius: var(--scrollbar-radius);
}

*::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
  border: var(--scrollbar-border-width) solid var(--scrollbar-border-color);
  border-radius: var(--scrollbar-radius);
}

*::-webkit-scrollbar-thumb:hover {
  filter: brightness(1.12);
}`, [thumbColor, trackColor, width, radius, borderWidth, borderColor]);

  const copyCss = async () => {
    await navigator.clipboard.writeText(css);
    toast.success('Scrollbar CSS copied');
  };
  const downloadCss = () => {
    const url = URL.createObjectURL(new Blob([css], { type: 'text/css' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'scrollbar.css';
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success('Scrollbar CSS downloaded');
  };

  return <ToolCard>
    <ToolTitle icon={PanelRight} text="Scrollbar Generator" subtitle="Tune a cross-browser scrollbar and copy the finished CSS into your project." />
    <div className="mt-6 grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="space-y-5 border border-white/[0.08] bg-black/10 p-5">
        <h3 className="text-sm font-semibold text-white">Settings</h3>
        <ColorField label="Thumb color" value={thumbColor} onChange={setThumbColor} />
        <ColorField label="Track color" value={trackColor} onChange={setTrackColor} />
        <RangeField label="Scrollbar width" value={width} min={4} max={28} unit="px" onChange={setWidth} />
        <RangeField label="Border radius" value={radius} min={0} max={24} unit="px" onChange={setRadius} />
        <RangeField label="Thumb border" value={borderWidth} min={0} max={8} unit="px" onChange={setBorderWidth} />
        <ColorField label="Thumb border color" value={borderColor} onChange={setBorderColor} />
      </aside>
      <div className="min-w-0">
        <div className="mb-2 flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">Live preview</span><span className="text-xs text-white/35">Drag the panel to test scrolling</span></div>
        <div className="scrollbar-preview h-40 overflow-y-scroll border border-white/[0.08] bg-[#171d22] p-5 text-sm leading-7 text-white/55" style={{ scrollbarColor: `${thumbColor} ${trackColor}`, scrollbarWidth: width <= 8 ? 'thin' : 'auto', ['--scrollbar-width' as string]: `${width}px`, ['--scrollbar-radius' as string]: `${radius}px`, ['--scrollbar-border-width' as string]: `${borderWidth}px`, ['--scrollbar-border-color' as string]: borderColor, ['--scrollbar-thumb' as string]: thumbColor, ['--scrollbar-track' as string]: trackColor }}>
          <div style={{ width: '130%' }}>A calm, balanced scrollbar keeps the interface feeling intentional. This preview contains enough content to test the thumb, track, radius, and contrast before you ship the CSS.</div>
          <div className="mt-4" style={{ width: '130%' }}>Scrollbar colors work across modern browsers with the standards-based properties and the WebKit selectors below.</div>
        </div>
        <style>{`.scrollbar-preview::-webkit-scrollbar { width: var(--scrollbar-width); height: var(--scrollbar-width); } .scrollbar-preview::-webkit-scrollbar-track { background: var(--scrollbar-track); border-radius: var(--scrollbar-radius); } .scrollbar-preview::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb); border: var(--scrollbar-border-width) solid var(--scrollbar-border-color); border-radius: var(--scrollbar-radius); } .scrollbar-preview::-webkit-scrollbar-thumb:hover { filter: brightness(1.12); }`}</style>
        <div className="mt-6 flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">Generated CSS</span><div className="flex gap-4"><button type="button" onClick={() => void copyCss()} className="inline-flex items-center gap-1.5 text-xs text-white/45 hover:text-white"><Copy size={13} /> Copy</button><button type="button" onClick={downloadCss} className="inline-flex items-center gap-1.5 text-xs text-white/45 hover:text-white"><Download size={13} /> Download</button></div></div>
        <pre className="mt-2 max-h-[30rem] overflow-auto border border-white/[0.08] bg-[#0d0d0a] p-5 font-mono text-xs leading-6 text-emerald-100/75">{css}</pre>
      </div>
    </div>
  </ToolCard>;
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block text-xs text-white/55">{label}<span className="mt-2 flex items-center gap-2 border border-white/10 bg-black/20 p-2"><input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="h-7 w-7 cursor-pointer border-0 bg-transparent" /><input value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 flex-1 bg-transparent font-mono text-xs uppercase text-white/75 outline-none" /></span></label>;
}
function RangeField({ label, value, min, max, unit, onChange }: { label: string; value: number; min: number; max: number; unit: string; onChange: (value: number) => void }) {
  return <label className="block text-xs text-white/55">{label}<span className="float-right font-mono text-white">{value}{unit}</span><input type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} className="mt-3 w-full accent-[var(--accent)]" /></label>;
}
