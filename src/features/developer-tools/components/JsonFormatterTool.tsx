import { useMemo, useState } from 'react';
import { Braces } from 'lucide-react';
import { ToolCard, ToolOutput, ToolTitle } from './ToolShell';

export default function JsonFormatterTool() {
  const [value, setValue] = useState('{"name":"Yolnoma","features":["weather","tools"]}');
  const result = useMemo(() => {
    try { return { value: JSON.stringify(JSON.parse(value), null, 2), error: '' }; }
    catch { return { value: '', error: 'Invalid JSON syntax.' }; }
  }, [value]);
  const copy = async () => navigator.clipboard.writeText(result.value);

  return <ToolCard><ToolTitle icon={Braces} text="JSON Formatter / Validator" subtitle="Validate and format JSON with readable indentation." /><textarea value={value} onChange={(event) => setValue(event.target.value)} className="mt-6 min-h-56 w-full resize-y border border-white/10 bg-black/20 p-4 font-mono text-sm text-white/80 outline-none focus:border-[var(--accent)]" spellCheck={false} /><div className={`mt-3 border-l-2 p-3 text-xs ${result.error ? 'border-red-400 bg-red-400/10 text-red-300' : 'border-emerald-400 bg-emerald-400/10 text-emerald-300'}`}>{result.error || 'Valid JSON'}</div>{!result.error && <ToolOutput value={result.value} onCopy={copy} />}</ToolCard>;
}
