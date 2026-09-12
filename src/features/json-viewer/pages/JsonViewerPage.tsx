import { useMemo, useState, type ChangeEvent } from 'react';
import {
  Braces,
  Check,
  Download,
  FileJson,
  FileText,
  Image as ImageIcon,
  Search,
  Upload,
  WandSparkles,
} from 'lucide-react';
import { toast } from '@/shared/ui/Toast';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
type JsonObject = { [key: string]: JsonValue };

const DEFAULT_RENAMES: Record<string, string> = {
  firstName: 'displayName',
};
const IMAGE_KEY_PATTERN = /image|avatar|photo|thumbnail|cover|banner|poster|url/i;
const IMAGE_URL_PATTERN = /^(https?:\/\/|data:image\/)/i;
const MAX_PREVIEW_CARDS = 500;

function collectKeys(value: JsonValue, keys = new Set<string>(), depth = 0): Set<string> {
  if (depth > 40 || value === null || typeof value !== 'object') return keys;
  if (Array.isArray(value)) {
    value.slice(0, 5000).forEach((item) => collectKeys(item, keys, depth + 1));
    return keys;
  }
  Object.entries(value).forEach(([key, child]) => {
    keys.add(key);
    collectKeys(child, keys, depth + 1);
  });
  return keys;
}

function renameKeys(value: JsonValue, renames: Record<string, string>): JsonValue {
  if (Array.isArray(value)) return value.map((item) => renameKeys(item, renames));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [renames[key]?.trim() || key, renameKeys(child, renames)]),
    );
  }
  return value;
}

function getCards(value: JsonValue): JsonObject[] {
  if (Array.isArray(value)) return value.filter((item): item is JsonObject => Boolean(item && typeof item === 'object' && !Array.isArray(item)));
  if (value && typeof value === 'object') {
    const arrayChild = Object.values(value).find((child) => Array.isArray(child));
    if (Array.isArray(arrayChild)) return arrayChild.filter((item): item is JsonObject => Boolean(item && typeof item === 'object' && !Array.isArray(item)));
    return [value];
  }
  return [];
}

function download(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(value: unknown): string {
  return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] || character);
}

function createHtmlExport(value: JsonValue, title: string): string {
  const cards = getCards(value);
  const cardHtml = cards.map((card) => {
    const imageEntry = Object.entries(card).find(([key, child]) => typeof child === 'string' && IMAGE_KEY_PATTERN.test(key) && IMAGE_URL_PATTERN.test(child));
    const image = imageEntry ? `<img class="card-image" src="${escapeHtml(imageEntry[1])}" alt="" />` : '';
    const fields = Object.entries(card).map(([key, child]) => `<div class="field"><span>${escapeHtml(key)}</span><strong>${escapeHtml(typeof child === 'object' ? JSON.stringify(child) : child)}</strong></div>`).join('');
    return `<article class="card">${image}<div class="fields">${fields}</div></article>`;
  }).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title || 'JSON export')}</title><style>body{margin:0;padding:32px;background:#14110e;color:#f2ede6;font:14px Inter,system-ui,sans-serif}.shell{max-width:1200px;margin:auto}.eyebrow{color:#d97757;text-transform:uppercase;letter-spacing:.16em;font-size:11px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;margin-top:24px}.card{overflow:hidden;border:1px solid #40342c;border-radius:16px;background:#1c1713;box-shadow:0 12px 30px #0004}.card-image{width:100%;height:150px;object-fit:cover;background:#2a211c}.fields{padding:16px}.field{padding:9px 0;border-bottom:1px solid #332a24;display:flex;flex-direction:column;gap:4px}.field:last-child{border-bottom:0}.field span{font-size:10px;color:#a7988d;text-transform:uppercase;letter-spacing:.08em}.field strong{font-weight:500;overflow-wrap:anywhere}</style></head><body><main class="shell"><div class="eyebrow">Yolnoma JSON EDIT/VIEW</div><h1>${escapeHtml(title || 'JSON export')}</h1><section class="grid">${cardHtml || '<p>No object records found.</p>'}</section></main></body></html>`;
}

function formatValue(value: JsonValue): string {
  if (value === null) return 'null';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function FieldValue({ value }: { value: JsonValue }) {
  if (typeof value === 'string' && IMAGE_URL_PATTERN.test(value)) {
    return <img src={value} alt="" className="h-10 w-10 rounded-lg object-cover border border-white/10" />;
  }
  return <span className="break-words text-sm text-[var(--text-primary)]">{formatValue(value)}</span>;
}

export default function JsonViewerPage() {
  const [rawJson, setRawJson] = useState('');
  const [parsed, setParsed] = useState<JsonValue | null>(null);
  const [fileName, setFileName] = useState('untitled.json');
  const [error, setError] = useState('');
  const [renames, setRenames] = useState<Record<string, string>>(DEFAULT_RENAMES);
  const [query, setQuery] = useState('');
  const [title, setTitle] = useState('JSON Collection');
  const [showRaw, setShowRaw] = useState(false);

  const detectedKeys = useMemo(() => (parsed === null ? [] : [...collectKeys(parsed)].sort()), [parsed]);
  const transformed = useMemo(() => (parsed === null ? null : renameKeys(parsed, renames)), [parsed, renames]);
  const cards = useMemo(() => getCards(transformed), [transformed]);
  const visibleCards = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return cards.slice(0, MAX_PREVIEW_CARDS);
    return cards.filter((card) => JSON.stringify(card).toLowerCase().includes(needle)).slice(0, MAX_PREVIEW_CARDS);
  }, [cards, query]);

  const loadJson = (content: string, name = fileName) => {
    setRawJson(content);
    try {
      const next = JSON.parse(content) as JsonValue;
      setParsed(next);
      setFileName(name);
      setError('');
      toast.success(`Loaded ${name} successfully`);
    } catch (parseError) {
      setParsed(null);
      setError(parseError instanceof Error ? parseError.message : 'Invalid JSON');
      toast.error('JSON could not be parsed');
    }
  };

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => loadJson(String(reader.result || ''), file.name);
    reader.onerror = () => setError('Could not read this file.');
    reader.readAsText(file);
  };

  const exportJson = () => {
    if (transformed === null) return toast.warning('Load valid JSON first');
    const baseName = fileName.replace(/\.json$/i, '') || 'json-export';
    download(JSON.stringify(transformed, null, 2), `${baseName}-transformed.json`, 'application/json');
    toast.success('Transformed JSON exported');
  };

  const exportHtml = () => {
    if (transformed === null) return toast.warning('Load valid JSON first');
    const baseName = fileName.replace(/\.json$/i, '') || 'json-export';
    download(createHtmlExport(transformed, title), `${baseName}-cards.html`, 'text/html');
    toast.success('Card HTML exported');
  };

  return (
    <div className="min-h-full pb-20" style={{ fontFamily: 'var(--font-sans)' }}>
      <div className="mb-8 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]"><Braces size={15} /> Developer Tools / JSON</div>
          <h1 className="font-serif text-4xl font-medium tracking-tight text-[var(--text-primary)]">JSON EDIT/VIEW</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">Edit, validate, rename keys, inspect image-rich records as cards, and export a clean JSON or standalone HTML view.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="btn btn-secondary inline-flex cursor-pointer items-center gap-2"><Upload size={15} /> Load JSON<input type="file" accept=".json,application/json" onChange={handleFile} className="hidden" /></label>
          <button type="button" onClick={exportJson} disabled={parsed === null} className="btn btn-secondary inline-flex items-center gap-2"><Download size={15} /> Export JSON</button>
          <button type="button" onClick={exportHtml} disabled={parsed === null} className="btn btn-primary inline-flex items-center gap-2"><FileText size={15} /> Export HTML</button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,.9fr)]">
        <section className="panel-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4"><div><h2 className="font-semibold text-[var(--text-primary)]">Source JSON</h2><p className="mt-1 text-xs text-[var(--text-faint)]">Paste JSON here or load a file from disk.</p></div><FileJson size={20} className="text-[var(--accent)]" /></div>
          <div className="p-5">
            <textarea value={rawJson} onChange={(event) => setRawJson(event.target.value)} onBlur={() => rawJson.trim() && parsed === null && loadJson(rawJson)} placeholder={'[{\n  "firstName": "Ada",\n  "avatar": "https://..."\n}]'} className="json-editor-textarea form-textarea resize-y font-mono text-xs leading-6" spellCheck={false} />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-[var(--text-faint)]">{rawJson.length.toLocaleString()} characters · {fileName}</span><button type="button" onClick={() => loadJson(rawJson)} className="btn btn-primary inline-flex items-center gap-2"><WandSparkles size={15} /> Parse JSON</button></div>
            {error && <p className="mt-3 rounded-lg border border-red-400/20 bg-red-400/5 px-3 py-2 text-xs text-red-300">{error}</p>}
          </div>
        </section>

        <section className="panel-card">
          <div className="border-b border-[var(--border)] px-5 py-4"><h2 className="font-semibold text-[var(--text-primary)]">Key mapping</h2><p className="mt-1 text-xs text-[var(--text-faint)]">Rename keys everywhere before exporting.</p></div>
          <div className="max-h-[440px] overflow-y-auto p-5">
            {detectedKeys.length === 0 ? <div className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--text-faint)]">Parse JSON to detect keys.</div> : <div className="space-y-2">{detectedKeys.map((key) => <div key={key} className="flex items-center gap-2"><span className="min-w-0 flex-1 truncate rounded-lg bg-[var(--bg-hover)] px-3 py-2 font-mono text-xs text-[var(--text-muted)]">{key}</span><span className="text-[var(--text-faint)]">→</span><input value={renames[key] ?? key} onChange={(event) => setRenames((current) => ({ ...current, [key]: event.target.value }))} className="form-input flex-1 py-2 font-mono text-xs" aria-label={`Rename ${key}`} /></div>)}</div>}
          </div>
          <div className="border-t border-[var(--border)] px-5 py-4"><label className="form-label" htmlFor="export-title">HTML title</label><input id="export-title" value={title} onChange={(event) => setTitle(event.target.value)} className="form-input" /></div>
        </section>
      </div>

      <section className="mt-5 panel-card overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-[var(--border)] px-5 py-4 lg:flex-row lg:items-center lg:justify-between"><div><div className="flex items-center gap-3"><h2 className="font-semibold text-[var(--text-primary)]">Card preview</h2>{parsed !== null && <span className="rounded-full bg-[var(--accent-dim)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">{cards.length.toLocaleString()} records</span>}</div><p className="mt-1 text-xs text-[var(--text-faint)]">{visibleCards.length < cards.length ? `Showing ${visibleCards.length.toLocaleString()} of ${cards.length.toLocaleString()} records` : 'Object records are rendered as visual cards.'}</p></div><div className="flex items-center gap-2"><div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter records..." className="form-input w-56 py-2 pl-9 text-xs" /></div><button type="button" onClick={() => setShowRaw((value) => !value)} className="btn btn-secondary inline-flex items-center gap-2 text-xs">{showRaw ? 'Cards' : 'Raw'} {showRaw ? <Check size={14} /> : <Braces size={14} />}</button></div></div>
        {showRaw ? <pre className="max-h-[620px] overflow-auto p-5 font-mono text-xs leading-6 text-[var(--text-muted)]">{transformed === null ? 'Parse JSON to preview.' : JSON.stringify(transformed, null, 2)}</pre> : visibleCards.length === 0 ? <div className="p-16 text-center text-sm text-[var(--text-faint)]">No object records to display yet.</div> : <div className="grid gap-4 p-5 md:grid-cols-2 2xl:grid-cols-4">{visibleCards.map((card, index) => { const image = Object.entries(card).find(([key, value]) => typeof value === 'string' && IMAGE_KEY_PATTERN.test(key) && IMAGE_URL_PATTERN.test(value)); return <article key={`${index}-${String(card.id ?? card.displayName ?? card.firstName ?? '')}`} className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-card)] transition-colors hover:border-[var(--border-hover)]">{image && <div className="relative h-36 bg-[var(--bg-hover)]"><img src={String(image[1])} alt="" className="h-full w-full object-cover" onError={(event) => { event.currentTarget.style.display = 'none'; }} /><ImageIcon size={22} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[var(--text-faint)]" /></div>}<div className="space-y-2 p-4">{Object.entries(card).map(([key, value]) => <div key={key} className="flex gap-3 border-b border-[var(--border)] pb-2 last:border-0 last:pb-0"><span className="w-2/5 shrink-0 truncate text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">{key}</span><FieldValue value={value} /></div>)}</div></article>; })}</div>}
      </section>
    </div>
  );
}

export { renameKeys, collectKeys, createHtmlExport };
