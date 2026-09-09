import { useMemo, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { ToolCard, ToolOutput, ToolTitle } from './ToolShell';

export default function JwtDecoderTool() {
  const [token, setToken] = useState('');
  const result = useMemo(() => {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return { header: '', payload: '', error: 'A JWT must contain three segments.' };
      const decode = (part: string) => JSON.stringify(JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/'))), null, 2);
      return { header: decode(parts[0]), payload: decode(parts[1]), error: '' };
    } catch { return { header: '', payload: '', error: 'The JWT could not be decoded.' }; }
  }, [token]);
  const copy = async (value: string) => navigator.clipboard.writeText(value);

  return <ToolCard><ToolTitle icon={ShieldCheck} text="JWT Decoder" subtitle="Decode a token locally without verifying its signature." /><input value={token} onChange={(event) => setToken(event.target.value)} placeholder="Paste your JWT token" className="mt-6 w-full border border-white/10 bg-black/20 p-4 font-mono text-sm text-white/80 outline-none focus:border-[var(--accent)]" spellCheck={false} />{token && <><div className="mt-5 grid gap-5 md:grid-cols-2"><ToolOutput label="Header" value={result.header} onCopy={copy} /><ToolOutput label="Payload" value={result.payload} onCopy={copy} /></div><p className="mt-4 border-l-2 border-amber-400/60 pl-3 text-xs text-amber-300/70">This only decodes the token. Signature verification is not performed.</p></>}</ToolCard>;
}
