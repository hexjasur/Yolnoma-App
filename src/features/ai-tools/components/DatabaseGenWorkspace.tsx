import { useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Download, FileJson, Grip, Link2, Loader2, RefreshCw, Sparkles, Table2, Trash2, WandSparkles, ZoomIn, ZoomOut } from 'lucide-react';
import { getApiKey } from '@/shared/hooks/useAccountStorage';
import { DEFAULT_MODELS, type ProxyResponse } from '@/features/ai/types';
import { useAuth } from '@/features/auth/AuthContext';

type Column = { name: string; type: string; nullable?: boolean; primaryKey?: boolean; unique?: boolean; references?: { table: string; column: string } };
type DbTable = { name: string; description?: string; columns: Column[]; position: { x: number; y: number } };
type DatabaseSchema = { name: string; description?: string; tables: DbTable[] };

type Point = { x: number; y: number };

const SAMPLE_PROMPT = 'Library Management System';
const SYSTEM_PROMPT = `You are a senior database architect. Design a normalized relational database from the user's brief. Return ONLY valid JSON with this exact shape: {"name":"string","description":"string","tables":[{"name":"snake_case","description":"string","columns":[{"name":"snake_case","type":"integer|varchar(255)|text|boolean|date|timestamp|decimal(12,2)|json","nullable":false,"primaryKey":false,"unique":false,"references":{"table":"table_name","column":"column_name"}}],"position":{"x":number,"y":number}}]}. Every table must have one primary key. Add foreign keys and join tables for many-to-many relationships. Use 3-12 tables, clear names, and practical columns. Positions should form a readable diagram. Do not include markdown or commentary.`;

function normalizeSchema(value: unknown): DatabaseSchema {
  const raw = value as Partial<DatabaseSchema>;
  const tables = Array.isArray(raw.tables) ? raw.tables : [];
  return {
    name: String(raw.name || 'Generated Database'),
    description: String(raw.description || ''),
    tables: tables.map((table, index) => {
      const item = table as Partial<DbTable>;
      const columns = Array.isArray(item.columns) ? item.columns : [];
      return {
        name: String(item.name || `table_${index + 1}`).replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase(),
        description: String(item.description || ''),
        position: { x: Number(item.position?.x) || 40 + (index % 3) * 300, y: Number(item.position?.y) || 40 + Math.floor(index / 3) * 240 },
        columns: columns.map((column) => {
          const c = column as Partial<Column>;
          const reference = c.references && typeof c.references === 'object' ? { table: String(c.references.table || ''), column: String(c.references.column || '') } : undefined;
          return { name: String(c.name || 'field').replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase(), type: String(c.type || 'text'), nullable: Boolean(c.nullable), primaryKey: Boolean(c.primaryKey), unique: Boolean(c.unique), ...(reference?.table && reference?.column ? { references: reference } : {}) };
        }),
      };
    }),
  };
}

function schemaToSql(schema: DatabaseSchema) {
  return schema.tables.map((table) => {
    const definitions = table.columns.map((column) => {
      const flags = [column.primaryKey ? 'PRIMARY KEY' : '', column.unique ? 'UNIQUE' : '', !column.nullable && !column.primaryKey ? 'NOT NULL' : ''].filter(Boolean).join(' ');
      const reference = column.references ? ` REFERENCES ${column.references.table}(${column.references.column})` : '';
      return `  ${column.name} ${column.type.toUpperCase()}${flags ? ` ${flags}` : ''}${reference}`;
    });
    return `CREATE TABLE ${table.name} (\n${definitions.join(',\n')}\n);`;
  }).join('\n\n');
}

function schemaToJson(schema: DatabaseSchema) { return JSON.stringify(schema, null, 2); }

function downloadText(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function diagramSvg(schema: DatabaseSchema, scale = 1) {
  const width = Math.max(980, ...schema.tables.map((table) => table.position.x + 250)) * scale;
  const height = Math.max(620, ...schema.tables.map((table) => table.position.y + 80 + table.columns.length * 25)) * scale;
  const byName = new Map(schema.tables.map((table) => [table.name, table]));
  const lines = schema.tables.flatMap((table) => table.columns.filter((column) => column.references).map((column) => {
    const target = byName.get(column.references!.table);
    if (!target) return '';
    const sourceX = (table.position.x + 250) * scale;
    const sourceY = (table.position.y + 62 + table.columns.findIndex((item) => item.name === column.name) * 25) * scale;
    const targetY = (target.position.y + 62 + target.columns.findIndex((item) => item.name === column.references!.column) * 25) * scale;
    return `<path d="M ${sourceX} ${sourceY} C ${(sourceX + target.position.x * scale) / 2} ${sourceY}, ${(sourceX + target.position.x * scale) / 2} ${targetY}, ${target.position.x * scale} ${targetY}" fill="none" stroke="#d19a6a" stroke-width="2" opacity=".72"/><circle cx="${target.position.x * scale}" cy="${targetY}" r="4" fill="#d19a6a"/>`;
  })).join('');
  const cards = schema.tables.map((table) => `<g transform="translate(${table.position.x * scale} ${table.position.y * scale})"><rect width="250" height="${62 + table.columns.length * 25}" rx="12" fill="#1d1813" stroke="#8a6548"/><rect width="250" height="42" rx="12" fill="#32241b"/><text x="16" y="27" fill="#fff" font-family="Arial" font-size="16" font-weight="700">${table.name}</text>${table.columns.map((column, index) => `<circle cx="16" cy="${61 + index * 25}" r="3" fill="${column.primaryKey ? '#e3b777' : '#8e7a6a'}"/><text x="28" y="${66 + index * 25}" fill="#eee" font-family="Arial" font-size="13">${column.name}</text><text x="238" y="${66 + index * 25}" text-anchor="end" fill="#a89585" font-family="Arial" font-size="11">${column.type}</text>`).join('')}</g>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#100e0b"/><text x="28" y="32" fill="#d19a6a" font-family="Arial" font-size="18" font-weight="700">${schema.name}</text>${lines}${cards}</svg>`;
}

export default function DatabaseGenWorkspace() {
  const { user } = useAuth();
  const [prompt, setPrompt] = useState(SAMPLE_PROMPT);
  const [schema, setSchema] = useState<DatabaseSchema | null>(null);
  const [model, setModel] = useState(DEFAULT_MODELS[0].id);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState<{ index: number; offset: Point } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const relationships = useMemo(() => schema?.tables.flatMap((table) => table.columns.filter((column) => column.references).map((column) => `${table.name}.${column.name} → ${column.references!.table}.${column.references!.column}`)) ?? [], [schema]);

  const generate = async () => {
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt || generating) return;
    setGenerating(true); setError('');
    try {
      const apiKey = await getApiKey(user?.id ?? '');
      if (!apiKey) throw new Error('OpenRouter API key not found. Add it in AI Chat first.');
      const response = await invoke<ProxyResponse>('proxy_request', { method: 'POST', url: 'https://openrouter.ai/api/v1/chat/completions', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://yolnoma.app', 'X-Title': 'Yolnoma Database Gen' }, body: { model, temperature: 0.2, max_tokens: 5000, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: cleanPrompt }] } });
      const content = response.body.choices?.[0]?.message?.content;
      if (response.status < 200 || response.status >= 300 || !content) throw new Error(response.body.error?.message || `OpenRouter returned HTTP ${response.status}`);
      const parsed = JSON.parse(content.replace(/^```json\s*|\s*```$/g, '').trim());
      setSchema(normalizeSchema(parsed));
    } catch (generationError) { setError(generationError instanceof Error ? generationError.message : 'Could not generate the database schema.'); }
    finally { setGenerating(false); }
  };

  const updatePosition = (index: number, point: Point) => setSchema((current) => current ? { ...current, tables: current.tables.map((table, tableIndex) => tableIndex === index ? { ...table, position: point } : table) } : current);
  const exportPng = async () => {
    if (!schema) return;
    const svg = diagramSvg(schema, 1);
    const image = new Image();
    image.onload = () => { const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height; const context = canvas.getContext('2d'); if (!context) return; context.drawImage(image, 0, 0); canvas.toBlob((blob) => { if (blob) downloadBlob('database-schema.png', blob); }, 'image/png'); };
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!dragging || !schema || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    updatePosition(dragging.index, { x: Math.max(12, (event.clientX - rect.left) / zoom - dragging.offset.x), y: Math.max(48, (event.clientY - rect.top) / zoom - dragging.offset.y) });
  };

  return <section className="overflow-hidden rounded-3xl border border-white/[0.10] bg-[#100e0b] shadow-2xl">
    <div className="border-b border-white/[0.08] bg-gradient-to-r from-[#271b13] to-[#15110e] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]"><WandSparkles size={14} /> Database Gen</p><h2 className="mt-2 font-serif text-3xl text-white">Design databases visually</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">Describe your product, let AI generate normalized tables and relationships, then arrange the architecture like a whiteboard.</p></div><div className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-[11px] text-emerald-200"><Sparkles size={13} /> OpenRouter powered</div></div>
      <div className="mt-5 overflow-hidden rounded-2xl border border-white/[0.12] bg-[#0f0d0b] shadow-inner shadow-black/20 focus-within:border-[var(--accent-border)]">
        <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={3} placeholder="Describe your product or system…" className="form-textarea min-h-[86px] resize-none border-0 bg-transparent px-4 py-3.5 text-sm leading-6 shadow-none focus:border-0 focus:bg-transparent"/>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] bg-white/[0.025] px-3 py-2.5">
          <div className="flex items-center gap-2"><span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">Model</span><select value={model} onChange={(event) => setModel(event.target.value)} className="rounded-lg border border-white/10 bg-[#1c1713] px-2.5 py-1.5 text-[11px] text-white/75 outline-none transition-colors hover:border-white/20 focus:border-[var(--accent-border)]"><option value={DEFAULT_MODELS[0].id}>{DEFAULT_MODELS[0].name}</option><option value={DEFAULT_MODELS[1].id}>{DEFAULT_MODELS[1].name}</option><option value={DEFAULT_MODELS[2].id}>{DEFAULT_MODELS[2].name}</option></select></div>
          <div className="flex items-center gap-3"><button type="button" onClick={() => setPrompt(SAMPLE_PROMPT)} className="text-[11px] text-white/35 transition-colors hover:text-white">Use example</button><button type="button" onClick={() => void generate()} disabled={generating || !prompt.trim()} className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2 text-xs font-bold text-[#1b120e] shadow-lg shadow-black/20 transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45">{generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} {generating ? 'Generating…' : 'Generate schema'}</button></div>
        </div>
      </div>
      <div className="mt-2 min-h-5">{error && <span className="text-xs text-red-300">{error}</span>}</div>
    </div>
    {!schema ? <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 p-8 text-center"><div className="rounded-2xl bg-[var(--accent-dim)] p-4 text-[var(--accent)]"><Table2 size={28} /></div><h3 className="font-serif text-2xl text-white">Your schema canvas is ready</h3><p className="max-w-md text-sm leading-6 text-white/40">Describe a system above to generate tables, primary keys, foreign keys and join tables. You can rearrange everything after generation.</p></div> : <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] px-4 py-3"><div className="flex items-center gap-3"><div className="text-sm font-semibold text-white">{schema.name}</div><span className="text-xs text-white/35">{schema.tables.length} tables · {relationships.length} relationships</span></div><div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => setZoom((value) => Math.min(1.5, value + .1))} className="rounded-lg border border-white/10 p-2 text-white/60 hover:text-white" title="Zoom in"><ZoomIn size={15}/></button><button type="button" onClick={() => setZoom((value) => Math.max(.6, value - .1))} className="rounded-lg border border-white/10 p-2 text-white/60 hover:text-white" title="Zoom out"><ZoomOut size={15}/></button><button type="button" onClick={() => downloadText(`${schema.name.replace(/\s+/g, '-').toLowerCase()}.sql`, schemaToSql(schema), 'text/plain')} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-white/70 hover:text-white"><Download size={14}/> SQL</button><button type="button" onClick={() => downloadText(`${schema.name.replace(/\s+/g, '-').toLowerCase()}.json`, schemaToJson(schema), 'application/json')} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-white/70 hover:text-white"><FileJson size={14}/> JSON</button><button type="button" onClick={() => void exportPng()} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-[#1b120e]"><Download size={14}/> PNG</button><button type="button" onClick={() => setSchema(null)} className="rounded-lg border border-red-400/20 p-2 text-red-300/70 hover:text-red-200" title="Clear workspace"><Trash2 size={15}/></button></div></div>
      <div ref={canvasRef} onPointerMove={onPointerMove} onPointerUp={() => setDragging(null)} onPointerLeave={() => setDragging(null)} className="relative min-h-[650px] overflow-auto bg-[#0d0b09]" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,.09) 1px, transparent 1px)', backgroundSize: '24px 24px' }}><div className="relative min-h-[650px]" style={{ width: `${Math.max(1000, ...schema.tables.map((table) => table.position.x + 320)) * zoom}px`, height: `${Math.max(650, ...schema.tables.map((table) => table.position.y + 260)) * zoom}px` }}><svg className="pointer-events-none absolute inset-0 h-full w-full" style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }} dangerouslySetInnerHTML={{ __html: diagramSvg(schema).replace(/^<svg[^>]*>|<\/svg>$/g, '') }} /><div className="absolute inset-0" style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}>{schema.tables.map((table, index) => <div key={table.name} onPointerDown={(event) => { const rect = event.currentTarget.getBoundingClientRect(); setDragging({ index, offset: { x: (event.clientX - rect.left) / zoom, y: (event.clientY - rect.top) / zoom } }); event.currentTarget.setPointerCapture(event.pointerId); }} className="absolute w-[250px] cursor-grab select-none rounded-xl border border-[#8a6548]/80 bg-[#1d1813] shadow-xl active:cursor-grabbing" style={{ left: table.position.x * zoom, top: table.position.y * zoom }}><div className="flex items-center justify-between rounded-t-xl bg-[#32241b] px-3 py-2.5"><span className="truncate text-sm font-semibold text-white">{table.name}</span><Grip size={14} className="text-white/30" /></div><div className="px-3 py-2">{table.columns.map((column) => <div key={column.name} className="flex items-center justify-between gap-2 border-b border-white/[0.05] py-1.5 text-xs"><span className="flex min-w-0 items-center gap-1.5 truncate text-white/80"><span className={`h-1.5 w-1.5 shrink-0 rounded-full ${column.primaryKey ? 'bg-[var(--accent)]' : 'bg-white/30'}`} />{column.primaryKey && <span className="text-[9px] text-[var(--accent)]">PK</span>}{column.name}</span><span className="shrink-0 text-[10px] text-white/35">{column.type}</span></div>)}</div></div>)}</div></div></div>
      <div className="flex flex-wrap gap-2 border-t border-white/[0.08] bg-black/10 px-4 py-3 text-[11px] text-white/35"><span className="flex items-center gap-1.5"><Grip size={13}/> Drag table cards to arrange</span><span className="flex items-center gap-1.5"><Link2 size={13}/> {relationships.length} foreign-key relationships</span><span className="flex items-center gap-1.5"><RefreshCw size={13}/> Regenerate anytime without losing your exports</span></div>
    </>}
  </section>;
}

export { schemaToSql, schemaToJson };
