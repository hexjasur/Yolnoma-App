import { useMemo, useState } from 'react';
import { ArrowDownUp, Copy, Link2, RotateCcw } from 'lucide-react';
import { ToolCard, ToolTitle } from './ToolShell';

type Mode = 'encode' | 'decode';

const EXAMPLE = 'https://yolnoma.app/search?q=hello world&lang=en';

export default function UrlEncoderTool() {
  const [mode, setMode] = useState<Mode>('encode');
  const [input, setInput] = useState(EXAMPLE);
  const [copied, setCopied] = useState(false);

  const result = useMemo(() => {
    if (!input) return { value: '', error: '' };
    try {
      return {
        value: mode === 'encode' ? encodeURIComponent(input) : decodeURIComponent(input),
        error: '',
      };
    } catch {
      return { value: '', error: 'The input contains an invalid URL-encoded sequence.' };
    }
  }, [input, mode]);

  const copy = async () => {
    if (!result.value) return;
    await navigator.clipboard.writeText(result.value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  const swap = () => {
    setInput(result.value);
    setMode((current) => current === 'encode' ? 'decode' : 'encode');
  };

  return (
    <ToolCard>
      <ToolTitle
        icon={Link2}
        text="URL Encoder / Decoder"
        subtitle="Encode or decode URL components locally in your browser."
      />
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setMode('encode')} className={`border px-4 py-2 text-xs font-semibold uppercase tracking-wider ${mode === 'encode' ? 'border-[var(--accent)] bg-[var(--accent-glow)] text-[var(--accent)]' : 'border-white/10 text-white/45 hover:text-white'}`}>Encode</button>
        <button type="button" onClick={() => setMode('decode')} className={`border px-4 py-2 text-xs font-semibold uppercase tracking-wider ${mode === 'decode' ? 'border-[var(--accent)] bg-[var(--accent-glow)] text-[var(--accent)]' : 'border-white/10 text-white/45 hover:text-white'}`}>Decode</button>
        <button type="button" onClick={swap} disabled={!result.value} className="border border-white/10 p-2 text-white/50 hover:text-white disabled:opacity-30" title="Swap input and output" aria-label="Swap input and output"><ArrowDownUp size={15} /></button>
        <button type="button" onClick={() => { setInput(''); setCopied(false); }} className="ml-auto inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white"><RotateCcw size={13} /> Clear</button>
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div>
          <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35" htmlFor="url-input">{mode === 'encode' ? 'Plain URL or text' : 'Encoded URL'}</label>
          <textarea id="url-input" value={input} onChange={(event) => setInput(event.target.value)} spellCheck={false} className="h-80 w-full resize-y border border-white/10 bg-black/20 p-4 font-mono text-sm leading-6 text-white/80 outline-none focus:border-[var(--accent)]" placeholder={mode === 'encode' ? 'Paste a URL or text to encode...' : 'Paste URL-encoded text to decode...'} />
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between"><label className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35" htmlFor="url-output">{mode === 'encode' ? 'Encoded URL' : 'Decoded URL or text'}</label><button type="button" onClick={() => void copy()} disabled={!result.value} className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white disabled:opacity-30"><Copy size={14} /> {copied ? 'Copied' : 'Copy'}</button></div>
          <textarea id="url-output" readOnly value={result.error || result.value} className={`h-80 w-full resize-y border border-white/10 bg-[#0d0d0a] p-4 font-mono text-sm leading-6 outline-none ${result.error ? 'text-red-300' : 'text-emerald-100/75'}`} />
        </div>
      </div>
      <p className="mt-4 text-xs leading-5 text-white/35">Uses encodeURIComponent and decodeURIComponent. Your input stays on this device.</p>
    </ToolCard>
  );
}
