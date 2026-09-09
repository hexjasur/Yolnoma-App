import { useMemo, useState } from 'react';
import { Minimize2 } from 'lucide-react';
import { ToolCard, ToolTitle } from './ToolShell';

type MinifyMode = 'html' | 'css' | 'js';

function minifyHtml(value: string) {
  return value.replace(/<!--[\s\S]*?-->/g, '').replace(/>\s+</g, '><').replace(/\s{2,}/g, ' ').trim();
}

function minifyCss(value: string) {
  return value.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').replace(/\s*([{}:;,>+])\s*/g, '$1').replace(/;}/g, '}').trim();
}

function minifyJs(value: string) {
  return value
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/.*$/gm, '$1')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}()[\];,:+*%=<>?-])\s*/g, '$1')
    .trim();
}

export default function MinifyTool() {
  const [mode, setMode] = useState<MinifyMode>('html');
  const [source, setSource] = useState('');
  const output = useMemo(() => mode === 'html' ? minifyHtml(source) : mode === 'css' ? minifyCss(source) : minifyJs(source), [mode, source]);
  const reduction = source.length ? Math.max(0, Math.round((1 - output.length / source.length) * 100)) : 0;

  return <ToolCard><ToolTitle icon={Minimize2} text="HTML / CSS / JS Minify" subtitle="Remove unnecessary whitespace and comments to produce a compact one-line version." /><div className="mt-6 flex flex-wrap gap-2">{(['html', 'css', 'js'] as MinifyMode[]).map((item) => <button key={item} type="button" onClick={() => setMode(item)} className={`border px-4 py-2 text-xs font-semibold uppercase tracking-wider ${mode === item ? 'border-[var(--accent)] bg-[var(--accent-glow)] text-[var(--accent)]' : 'border-white/10 text-white/45 hover:text-white'}`}>{item}</button>)}</div><div className="mt-4 grid gap-4 xl:grid-cols-2"><div><label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">Source</label><textarea value={source} onChange={(event) => setSource(event.target.value)} className="h-96 w-full resize-y border border-white/10 bg-black/20 p-4 font-mono text-xs leading-6 text-white/80 outline-none focus:border-[var(--accent)]" placeholder={`Paste ${mode.toUpperCase()} here...`} spellCheck={false} /></div><div><div className="mb-2 flex items-center justify-between"><label className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">Minified output</label><span className="text-[10px] text-emerald-300/70">{reduction}% smaller</span></div><textarea readOnly value={output} className="h-96 w-full resize-y border border-white/10 bg-[#0d0d0a] p-4 font-mono text-xs leading-6 text-emerald-100/75 outline-none" /></div></div></ToolCard>;
}
