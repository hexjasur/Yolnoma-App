import { useMemo, useState } from 'react';
import {
  Braces,
  Check,
  Code2,
  Copy,
  Hash,
  Palette,
  QrCode,
  ShieldCheck,
  WandSparkles,
} from 'lucide-react';
import MarkdownContent from '@/features/ai/components/MarkdownContent';

type Tab = 'json' | 'jwt' | 'uuid' | 'markdown' | 'color' | 'qr';
type ToolIcon = typeof Code2;

const initialMarkdown = `# Markdown workspace

Write documentation with a live preview. This renderer supports **strong text**, *emphasis*, ~~strikethrough~~, links, images, tables, task lists, blockquotes, and fenced code blocks.

## Example table

| Feature | Status | Notes |
| --- | :---: | --- |
| GitHub Flavored Markdown | ✅ | Tables and task lists included |
| Code blocks | ✅ | Copy-ready with language labels |
| Responsive layout | ✅ | Wide tables scroll on small screens |

> Tip: use the editor on the left and keep the preview open while you write.

- [x] Add a heading
- [ ] Add a code example

\`\`\`ts
const greeting = 'Hello, Markdown';
console.log(greeting);
\`\`\``;

function Card({ children }: { children: React.ReactNode }) {
  return <section className="border border-white/[0.08] bg-[#111109] p-6 shadow-xl md:p-7">{children}</section>;
}

function ToolButton({ active, icon: Icon, label, onClick }: { active: boolean; icon: ToolIcon; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 border-l-2 px-4 py-3 text-left text-sm transition ${active ? 'border-[var(--accent)] bg-[var(--accent-glow)] text-white' : 'border-transparent text-white/50 hover:bg-white/[0.04] hover:text-white'}`}
    >
      <Icon size={17} className={active ? 'text-[var(--accent)]' : 'text-white/35'} />
      {label}
    </button>
  );
}

export default function DeveloperToolsPage() {
  const [tab, setTab] = useState<Tab>('json');
  const [json, setJson] = useState('{"name":"Yolnoma","features":["weather","tools"]}');
  const [jwt, setJwt] = useState('');
  const [markdown, setMarkdown] = useState(initialMarkdown);
  const [color, setColor] = useState('#D97757');
  const [qrText, setQrText] = useState('https://github.com/hexjasur/Yolnoma-App');
  const [uuid, setUuid] = useState(() => crypto.randomUUID());
  const [copied, setCopied] = useState(false);

  const jsonResult = useMemo(() => {
    try {
      return { value: JSON.stringify(JSON.parse(json), null, 2), error: '' };
    } catch {
      return { value: '', error: 'Invalid JSON syntax.' };
    }
  }, [json]);

  const jwtResult = useMemo(() => {
    try {
      const parts = jwt.split('.');
      if (parts.length !== 3) return { header: '', payload: '', error: 'A JWT must contain three segments.' };
      const decode = (part: string) => JSON.stringify(JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/'))), null, 2);
      return { header: decode(parts[0]), payload: decode(parts[1]), error: '' };
    } catch {
      return { header: '', payload: '', error: 'The JWT could not be decoded.' };
    }
  }, [jwt]);

  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  const pickColor = async () => {
    const eyeDropper = (window as Window & { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper;
    if (!eyeDropper) return;
    try {
      setColor((await new eyeDropper().open()).sRGBHex);
    } catch {
      // The picker was cancelled.
    }
  };

  const generateUuid = () => {
    const next = crypto.randomUUID();
    setUuid(next);
    void copy(next);
  };

  const tabs: [Tab, string, ToolIcon][] = [
    ['json', 'JSON Formatter', Braces],
    ['jwt', 'JWT Decoder', ShieldCheck],
    ['uuid', 'UUID Generator', Hash],
    ['markdown', 'Markdown Studio', Code2],
    ['color', 'Color Picker', Palette],
    ['qr', 'QR Generator', QrCode],
  ];

  return (
    <div className="mx-auto min-h-full max-w-7xl pb-16 text-[var(--text-primary)]">
      <header className="border-b border-white/[0.08] pb-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">Developer Tools</p>
        <div className="mt-3 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <h1 className="font-serif text-4xl font-medium tracking-tight text-white md:text-5xl">A sharper workspace for everyday code</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/45">Format data, inspect tokens, write Markdown, generate IDs, pick colors, and create QR codes without leaving Yolnoma.</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-white/35"><span className="h-2 w-2 bg-emerald-400" /> Local-first tools</div>
        </div>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[245px_minmax(0,1fr)]">
        <aside className="h-fit border border-white/[0.08] bg-[#111109] p-2">
          <div className="px-4 pb-3 pt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/30">Workspace</div>
          <nav className="space-y-1">
            {tabs.map(([id, label, Icon]) => <ToolButton key={id} active={tab === id} icon={Icon} label={label} onClick={() => setTab(id)} />)}
          </nav>
        </aside>

        <main className="min-w-0 space-y-5">
          {tab === 'json' && <Card><Title icon={Braces} text="JSON Formatter / Validator" subtitle="Validate and format JSON with readable indentation." /><textarea value={json} onChange={(event) => setJson(event.target.value)} className="mt-6 min-h-56 w-full resize-y border border-white/10 bg-black/20 p-4 font-mono text-sm text-white/80 outline-none focus:border-[var(--accent)]" spellCheck={false} /><div className={`mt-3 border-l-2 p-3 text-xs ${jsonResult.error ? 'border-red-400 bg-red-400/10 text-red-300' : 'border-emerald-400 bg-emerald-400/10 text-emerald-300'}`}>{jsonResult.error || 'Valid JSON'}</div>{!jsonResult.error && <Output value={jsonResult.value} onCopy={copy} />}</Card>}

          {tab === 'jwt' && <Card><Title icon={ShieldCheck} text="JWT Decoder" subtitle="Decode a token locally without verifying its signature." /><input value={jwt} onChange={(event) => setJwt(event.target.value)} placeholder="Paste your JWT token" className="mt-6 w-full border border-white/10 bg-black/20 p-4 font-mono text-sm text-white/80 outline-none focus:border-[var(--accent)]" spellCheck={false} />{jwt && <><div className="mt-5 grid gap-5 md:grid-cols-2"><Output label="Header" value={jwtResult.header} onCopy={copy} /><Output label="Payload" value={jwtResult.payload} onCopy={copy} /></div><p className="mt-4 border-l-2 border-amber-400/60 pl-3 text-xs text-amber-300/70">This only decodes the token. Signature verification is not performed.</p></>}</Card>}

          {tab === 'uuid' && <Card><Title icon={Hash} text="UUID Generator" subtitle="Generate a cryptographically random UUID v4." /><div className="flex min-h-72 flex-col items-center justify-center gap-7 border border-white/[0.06] bg-black/10 p-8"><p className="break-all text-center font-mono text-2xl tracking-wide text-white md:text-3xl">{uuid}</p><button type="button" onClick={generateUuid} className="inline-flex items-center gap-2 bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[#17130e] transition hover:brightness-110"><WandSparkles size={16} /> Generate & copy</button></div></Card>}

          {tab === 'markdown' && <Card><Title icon={Code2} text="Markdown Studio" subtitle="A full GitHub-Flavored Markdown preview with tables, task lists, links, images, quotes, and code blocks." /><div className="mt-6 grid gap-4 xl:grid-cols-2"><div className="border border-white/[0.08] bg-[#0d0d0a]"><div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3"><span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">Editor</span><span className="text-[10px] text-white/25">{markdown.length} chars · {markdown.split('\n').length} lines</span></div><textarea value={markdown} onChange={(event) => setMarkdown(event.target.value)} className="min-h-[620px] w-full resize-y bg-transparent p-5 font-mono text-[13px] leading-6 text-white/80 outline-none" spellCheck={false} /></div><div className="border border-white/[0.08] bg-[#0d0d0a]"><div className="border-b border-white/[0.08] px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">Preview</div><article className="min-h-[620px] overflow-auto p-5 md:p-7"><MarkdownContent content={markdown} /></article></div></div></Card>}

          {tab === 'color' && <Card><Title icon={Palette} text="Color Picker" subtitle="Choose a color or use the system eye dropper when available." /><div className="mt-6 flex min-h-72 flex-wrap items-center gap-8 border border-white/[0.06] bg-black/10 p-8"><input type="color" value={color} onChange={(event) => setColor(event.target.value)} className="h-28 w-28 cursor-pointer border-0 bg-transparent" /><div><p className="font-mono text-4xl text-white">{color}</p><button type="button" onClick={() => void pickColor()} className="mt-4 inline-flex items-center gap-2 border border-white/10 px-4 py-2 text-sm text-white/70 hover:bg-white/[0.06]"><Palette size={15} /> Pick from screen</button><p className="mt-3 text-xs text-white/35">The EyeDropper API is supported in compatible desktop environments.</p></div></div></Card>}

          {tab === 'qr' && <Card><Title icon={QrCode} text="QR Code Generator" subtitle="Generate a QR code from text or a URL." /><div className="mt-6 flex flex-col gap-6 border border-white/[0.06] bg-black/10 p-6 md:flex-row md:items-start"><textarea value={qrText} onChange={(event) => setQrText(event.target.value)} className="min-h-32 flex-1 resize-y border border-white/10 bg-black/20 p-4 text-sm text-white/80 outline-none focus:border-[var(--accent)]" placeholder="Text or URL..." />{qrText && <img className="h-48 w-48 border-8 border-white bg-white object-contain" alt="Generated QR code" src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrText)}`} />}</div><p className="mt-4 text-xs text-white/35">QR image generation uses the QRServer public endpoint.</p></Card>}

          <div className="flex min-h-5 items-center justify-end gap-2 text-xs text-emerald-300/80">{copied && <><Check size={14} /> Copied to clipboard</>}</div>
        </main>
      </div>
    </div>
  );
}

function Title({ icon: Icon, text, subtitle }: { icon: ToolIcon; text: string; subtitle: string }) {
  return <div className="border-b border-white/[0.08] pb-5"><div className="flex items-center gap-3"><Icon size={20} className="text-[var(--accent)]" /><h2 className="text-lg font-semibold text-white">{text}</h2></div><p className="mt-2 text-sm text-white/40">{subtitle}</p></div>;
}

function Output({ label, value, onCopy }: { label?: string; value: string; onCopy: (value: string) => void }) {
  return <div className="mt-5"><div className="mb-2 flex items-center justify-between">{label && <span className="text-xs font-semibold uppercase tracking-wider text-white/35">{label}</span>}<button type="button" onClick={() => void onCopy(value)} className="ml-auto inline-flex items-center gap-1.5 text-white/40 hover:text-white"><Copy size={14} /> Copy</button></div><pre className="max-h-80 overflow-auto border border-white/[0.06] bg-black/20 p-4 text-xs leading-6 text-white/65">{value || 'No output'}</pre></div>;
}
