import { useMemo, useState } from 'react';
import { Clipboard, Code2, Copy, RotateCcw } from 'lucide-react';
import { ToolCard, ToolTitle } from './ToolShell';

type Target = 'fetch' | 'axios' | 'python' | 'rust';

const INITIAL = `curl 'https://api.example.com/users?page=1' \\
  -X POST \\
  -H 'Accept: application/json' \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer YOUR_TOKEN' \\
  --data-raw '{"name":"Yolnoma","active":true}'`;

function shellWords(input: string) {
  const normalized = input.replace(/\\\r?\n/g, ' ').trim();
  const matches = normalized.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? [];
  return matches.map((word) => word.replace(/^['"]|['"]$/g, ''));
}
function parseCurl(input: string) {
  const words = shellWords(input);
  if (words[0] !== 'curl') throw new Error('Command must start with curl.');
  let url = '';
  let method = '';
  let body = '';
  const headers: Array<[string, string]> = [];
  for (let index = 1; index < words.length; index += 1) {
    const word = words[index];
    if (!word.startsWith('-') && !url) { url = word; continue; }
    if ((word === '-X' || word === '--request') && words[index + 1]) { method = words[++index].toUpperCase(); continue; }
    if ((word === '-H' || word === '--header') && words[index + 1]) {
      const header = words[++index]; const separator = header.indexOf(':');
      if (separator > 0) headers.push([header.slice(0, separator).trim(), header.slice(separator + 1).trim()]);
      continue;
    }
    if (['-d', '--data', '--data-raw', '--data-binary', '--data-urlencode'].includes(word) && words[index + 1]) { body = words[++index]; continue; }
    if (word === '-G' || word === '--get') method = 'GET';
  }
  if (!url) throw new Error('No URL found.');
  return { url, method: method || (body ? 'POST' : 'GET'), body, headers };
}
function jsString(value: string) { return JSON.stringify(value); }
function convert(input: string, target: Target) {
  const request = parseCurl(input); const headerObject = Object.fromEntries(request.headers);
  const headers = JSON.stringify(headerObject, null, 2);
  const body = request.body ? `\n  body: ${jsString(request.body)},` : '';
  if (target === 'fetch') return `const response = await fetch(${jsString(request.url)}, {\n  method: '${request.method}',\n  headers: ${headers},${body}\n});\n\nconst data = await response.json();\nconsole.log(data);`;
  if (target === 'axios') return `import axios from 'axios';\n\nconst { data } = await axios({\n  method: '${request.method.toLowerCase()}',\n  url: ${jsString(request.url)},\n  headers: ${headers},${body}\n});\n\nconsole.log(data);`;
  if (target === 'python') return `import requests\n\nresponse = requests.request(\n    method=${jsString(request.method)},\n    url=${jsString(request.url)},\n    headers=${JSON.stringify(headerObject)},${request.body ? `\n    data=${jsString(request.body)},` : ''}\n)\n\nresponse.raise_for_status()\nprint(response.json())`;
  return `use reqwest;\n\n#[tokio::main]\nasync fn main() -> Result<(), reqwest::Error> {\n    let client = reqwest::Client::new();\n    let response = client\n        .${request.method.toLowerCase()}(${jsString(request.url)})${request.headers.map(([key, value]) => `\n        .header(${jsString(key)}, ${jsString(value)})`).join('')}${request.body ? `\n        .body(${jsString(request.body)})` : ''}\n        .send()\n        .await?;\n\n    println!(\"{}\", response.text().await?);\n    Ok(())\n}`;
}

export default function CurlConverterTool() {
  const [input, setInput] = useState(INITIAL); const [target, setTarget] = useState<Target>('fetch'); const [error, setError] = useState('');
  const output = useMemo(() => { try { setError(''); return convert(input, target); } catch (conversionError) { return conversionError instanceof Error ? (setError(conversionError.message), '') : ''; } }, [input, target]);
  const copy = async (value: string) => { await navigator.clipboard.writeText(value); };
  return <ToolCard><ToolTitle icon={Code2} text="cURL → Code Converter" subtitle="Turn a cURL command into ready-to-use code for your preferred stack." /><div className="mt-6 grid gap-5 xl:grid-cols-2"><div><div className="mb-2 flex items-center justify-between"><label className="text-xs font-semibold uppercase tracking-wider text-white/35" htmlFor="curl-input">cURL command</label><button type="button" onClick={() => setInput(INITIAL)} className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white"><RotateCcw size={13} /> Reset</button></div><textarea id="curl-input" value={input} onChange={(event) => setInput(event.target.value)} spellCheck={false} className="min-h-80 w-full resize-y border border-white/[0.08] bg-[#0d0d0a] p-4 font-mono text-xs leading-6 text-white/75 outline-none focus:border-[var(--accent-border)]" />{error && <p className="mt-2 text-xs text-red-300">{error}</p>}</div><div><div className="mb-2 flex items-center justify-between"><label className="text-xs font-semibold uppercase tracking-wider text-white/35" htmlFor="curl-target">Generated code</label><button type="button" disabled={!output} onClick={() => void copy(output)} className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white disabled:opacity-30"><Copy size={13} /> Copy</button></div><select id="curl-target" value={target} onChange={(event) => setTarget(event.target.value as Target)} className="mb-3 border border-white/[0.08] bg-[#0d0d0a] px-3 py-2 text-xs text-white outline-none"><option value="fetch">JavaScript fetch</option><option value="axios">Axios</option><option value="python">Python requests</option><option value="rust">Rust reqwest</option></select><pre className="min-h-80 overflow-auto whitespace-pre-wrap border border-white/[0.08] bg-[#0d0d0a] p-4 font-mono text-xs leading-6 text-emerald-100/75">{output || 'Enter a valid cURL command.'}</pre></div></div><div className="mt-5 flex items-center gap-2 text-xs text-white/35"><Clipboard size={14} /> Supports headers, methods, JSON/form bodies, and multiline commands.</div></ToolCard>;
}
