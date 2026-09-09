import { useMemo, useState } from 'react';
import { ArrowDownUp, Binary, Copy } from 'lucide-react';
import { ToolCard, ToolTitle } from './ToolShell';

type Base64Mode = 'encode' | 'decode';

function encode(value: string, urlSafe: boolean) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  const result = btoa(binary);
  return urlSafe ? result.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : result;
}

function decode(value: string, urlSafe: boolean) {
  const normalized = (urlSafe ? value.replace(/-/g, '+').replace(/_/g, '/') : value).padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(normalized);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export default function Base64Tool() {
  const [mode, setMode] = useState<Base64Mode>('encode');
  const [urlSafe, setUrlSafe] = useState(false);
  const [input, setInput] = useState('');
  const [copied, setCopied] = useState(false);
  const result = useMemo(() => {
    if (!input) return { value: '', error: '' };
    try { return { value: mode === 'encode' ? encode(input, urlSafe) : decode(input.trim(), urlSafe), error: '' }; }
    catch { return { value: '', error: 'Invalid Base64 input.' }; }
  }, [input, mode, urlSafe]);
  const copy = async () => { await navigator.clipboard.writeText(result.value); setCopied(true); window.setTimeout(() => setCopied(false), 1400); };

  return <ToolCard><ToolTitle icon={Binary} text="Base64 Encoder / Decoder" subtitle="Encode Unicode text or decode standard and URL-safe Base64 locally." /><div className="mt-6 flex flex-wrap items-center gap-2"><button type="button" onClick={() => setMode('encode')} className={`border px-4 py-2 text-xs font-semibold uppercase tracking-wider ${mode === 'encode' ? 'border-[var(--accent)] bg-[var(--accent-glow)] text-[var(--accent)]' : 'border-white/10 text-white/45'}`}>Encode</button><button type="button" onClick={() => setMode('decode')} className={`border px-4 py-2 text-xs font-semibold uppercase tracking-wider ${mode === 'decode' ? 'border-[var(--accent)] bg-[var(--accent-glow)] text-[var(--accent)]' : 'border-white/10 text-white/45'}`}>Decode</button><button type="button" onClick={() => { setInput(result.value); setMode(mode === 'encode' ? 'decode' : 'encode'); }} className="ml-1 border border-white/10 p-2 text-white/50 hover:text-white" title="Swap input and output"><ArrowDownUp size={15} /></button><label className="ml-auto flex items-center gap-2 text-xs text-white/50"><input type="checkbox" checked={urlSafe} onChange={(event) => setUrlSafe(event.target.checked)} className="accent-[var(--accent)]" /> URL-safe</label></div><div className="mt-4 grid gap-4 xl:grid-cols-2"><div><label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">{mode === 'encode' ? 'Plain text' : 'Base64 input'}</label><textarea value={input} onChange={(event) => setInput(event.target.value)} className="h-80 w-full resize-y border border-white/10 bg-black/20 p-4 font-mono text-sm leading-6 text-white/80 outline-none focus:border-[var(--accent)]" placeholder={mode === 'encode' ? 'Type text to encode...' : 'Paste Base64 to decode...'} spellCheck={false} /></div><div><div className="mb-2 flex items-center justify-between"><label className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">{mode === 'encode' ? 'Base64 output' : 'Decoded text'}</label><button type="button" onClick={() => void copy()} disabled={!result.value} className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white disabled:opacity-30"><Copy size={14} /> {copied ? 'Copied' : 'Copy'}</button></div><textarea readOnly value={result.error || result.value} className={`h-80 w-full resize-y border border-white/10 bg-[#0d0d0a] p-4 font-mono text-sm leading-6 outline-none ${result.error ? 'text-red-300' : 'text-emerald-100/75'}`} /></div></div></ToolCard>;
}
