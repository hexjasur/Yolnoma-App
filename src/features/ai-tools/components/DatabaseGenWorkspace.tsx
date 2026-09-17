import { useMemo, useRef, useState } from 'react';
import {
  Download,
  FileJson,
  Grip,
  Link2,
  Loader2,
  RefreshCw,
  Sparkles,
  Table2,
  Trash2,
  WandSparkles,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { getApiKey } from '@/shared/hooks/useAccountStorage';
import { DEFAULT_MODELS } from '@/features/ai/types';
import { useAuth } from '@/features/auth/AuthContext';
import { requestOpenRouter } from '@/features/ai/api/openRouterApi';
import SelectMenu from '@/shared/ui/SelectMenu';
import '../css/styles.css';
import { downloadBlob, downloadText } from '@/shared/lib/files';

type Column = {
  name: string;
  type: string;
  nullable?: boolean;
  primaryKey?: boolean;
  unique?: boolean;
  references?: { table: string; column: string };
};
type DbTable = {
  name: string;
  description?: string;
  columns: Column[];
  position: { x: number; y: number };
};
type DatabaseSchema = { name: string; description?: string; tables: DbTable[] };

type Point = { x: number; y: number };

const SAMPLE_PROMPT = 'Library Management System';
const SYSTEM_PROMPT = `You are a senior database architect. Design a normalized relational database from the user's brief. Return ONLY valid JSON with this exact shape: {"name":"string","description":"string","tables":[{"name":"snake_case","description":"string","columns":[{"name":"snake_case","type":"integer|varchar(255)|text|boolean|date|timestamp|decimal(12,2)|json","nullable":false,"primaryKey":false,"unique":false,"references":{"table":"table_name","column":"column_name"}}],"position":{"x":number,"y":number}}]}. Every table must have one primary key. Add foreign keys and join tables for many-to-many relationships. Use 3-12 tables, clear names, and practical columns. Positions should form a readable diagram. Do not include markdown or commentary.`;

/* ── Diagram geometry (Same as HTML card sizes) ───────────── */
const TABLE_W = 250;
const HEADER_H = 42;
const ROW_H = 25;
const ROW_TOP = 62; // the y-value of the center of the first column
const GAP = 44;

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
        name: String(item.name || `table_${index + 1}`)
          .replace(/[^a-zA-Z0-9_]/g, '_')
          .toLowerCase(),
        description: String(item.description || ''),
        position: {
          x: Number(item.position?.x) || 40 + (index % 3) * 300,
          y: Number(item.position?.y) || 40 + Math.floor(index / 3) * 240,
        },
        columns: columns.map((column) => {
          const c = column as Partial<Column>;
          const reference =
            c.references && typeof c.references === 'object'
              ? {
                  table: String(c.references.table || ''),
                  column: String(c.references.column || ''),
                }
              : undefined;
          return {
            name: String(c.name || 'field')
              .replace(/[^a-zA-Z0-9_]/g, '_')
              .toLowerCase(),
            type: String(c.type || 'text'),
            nullable: Boolean(c.nullable),
            primaryKey: Boolean(c.primaryKey),
            unique: Boolean(c.unique),
            ...(reference?.table && reference?.column
              ? { references: reference }
              : {}),
          };
        }),
      };
    }),
  };
}

function schemaToSql(schema: DatabaseSchema) {
  return schema.tables
    .map((table) => {
      const definitions = table.columns.map((column) => {
        const flags = [
          column.primaryKey ? 'PRIMARY KEY' : '',
          column.unique ? 'UNIQUE' : '',
          !column.nullable && !column.primaryKey ? 'NOT NULL' : '',
        ]
          .filter(Boolean)
          .join(' ');
        const reference = column.references
          ? ` REFERENCES ${column.references.table}(${column.references.column})`
          : '';
        return `  ${column.name} ${column.type.toUpperCase()}${flags ? ` ${flags}` : ''}${reference}`;
      });
      return `CREATE TABLE ${table.name} (\n${definitions.join(',\n')}\n);`;
    })
    .join('\n\n');
}

function schemaToJson(schema: DatabaseSchema) {
  return JSON.stringify(schema, null, 2);
}

/* ── Right-angle connector lines ─────────────── */

function rowY(table: DbTable, columnName: string) {
  const index = table.columns.findIndex((item) => item.name === columnName);
  return table.position.y + ROW_TOP + Math.max(index, 0) * ROW_H;
}

function tableHeight(table: DbTable) {
  return HEADER_H + 20 + table.columns.length * ROW_H;
}

/* A distinct color for each connection — they remain distinguishable even if they overlap */
const EDGE_COLORS = [
  '#d19a6a',
  '#7fb3d5',
  '#8fc78a',
  '#c792ea',
  '#e5c07b',
  '#e06c75',
  '#56b6c2',
  '#b58db5',
];

/* Selects the exit and entry sides */
function anchorSides(source: DbTable, target: DbTable) {
  const sLeft = source.position.x,
    sRight = sLeft + TABLE_W;
  const tLeft = target.position.x,
    tRight = tLeft + TABLE_W;
  const sCx = sLeft + TABLE_W / 2,
    tCx = tLeft + TABLE_W / 2;

  if (tLeft - sRight >= GAP)
    return { sx: sRight, tx: tLeft, sDir: 1, tDir: -1 }; // Target on the right.
  if (sLeft - tRight >= GAP)
    return { sx: sLeft, tx: tRight, sDir: -1, tDir: 1 }; // Target on the left
  if (tCx >= sCx) return { sx: sRight, tx: tRight, sDir: 1, tDir: 1 }; // stacked → from the right
  return { sx: sLeft, tx: tLeft, sDir: -1, tDir: -1 }; // stacked → from the left
}

/* Smooth Bézier curve */
function curvedEdge(
  source: DbTable,
  sourceColumn: string,
  target: DbTable,
  targetColumn: string,
  spread = 0,
) {
  const sy = rowY(source, sourceColumn);
  const ty = rowY(target, targetColumn);
  const { sx, tx, sDir, tDir } = anchorSides(source, target);

  const dx = Math.abs(tx - sx);
  const dy = Math.abs(ty - sy);
  // The greater the bend, the wider the arc the line forms.
  const bend = Math.max(60, dx * 0.45, dy * 0.25) + spread;

  const c1x = sx + sDir * bend;
  const c2x = tx + tDir * bend;

  return {
    path: `M ${sx} ${sy} C ${c1x} ${sy}, ${c2x} ${ty}, ${tx} ${ty}`,
    sx,
    sy,
    tx,
    ty,
    sDir,
    tDir,
  };
}

function edgesMarkup(schema: DatabaseSchema) {
  const byName = new Map(schema.tables.map((table) => [table.name, table]));
  let edgeIndex = 0;

  return schema.tables
    .flatMap((table) =>
      table.columns
        .filter((column) => column.references)
        .map((column) => {
          const target = byName.get(column.references!.table);
          if (!target || target.name === table.name) return '';

          const i = edgeIndex++;
          const color = EDGE_COLORS[i % EDGE_COLORS.length];
          // We draw each subsequent line along a slightly different arc.
          const e = curvedEdge(
            table,
            column.name,
            target,
            column.references!.column,
            (i % 4) * 26,
          );

          return (
            // the black "halo" underneath — it shows which line is on top where they intersect
            `<path d="${e.path}" fill="none" stroke="#0d0b09" stroke-width="5.5" stroke-linecap="round" opacity="0.85"/>` +
            `<path d="${e.path}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" opacity="0.95"/>` +
            `<circle cx="${e.sx}" cy="${e.sy}" r="3.5" fill="${color}"/>` +
            `<circle cx="${e.tx}" cy="${e.ty}" r="3.5" fill="${color}"/>` +
            `<text x="${e.sx + e.sDir * 11}" y="${e.sy - 7}" text-anchor="${e.sDir > 0 ? 'start' : 'end'}" fill="${color}" font-family="Arial" font-size="13" font-weight="700">&#8734;</text>` +
            `<text x="${e.tx + e.tDir * 11}" y="${e.ty - 7}" text-anchor="${e.tDir > 0 ? 'start' : 'end'}" fill="${color}" font-family="Arial" font-size="12" font-weight="700">1</text>`
          );
        }),
    )
    .join('');
}

function canvasSize(schema: DatabaseSchema) {
  return {
    width: Math.max(
      1000,
      ...schema.tables.map((table) => table.position.x + TABLE_W + 70),
    ),
    height: Math.max(
      650,
      ...schema.tables.map(
        (table) => table.position.y + tableHeight(table) + 120,
      ),
    ),
  };
}

/* For export (PNG) only — not used on the canvas */
function diagramSvg(schema: DatabaseSchema, scale = 1) {
  const { width, height } = canvasSize(schema);
  const cards = schema.tables
    .map(
      (table) =>
        `<g transform="translate(${table.position.x} ${table.position.y})">` +
        `<rect width="${TABLE_W}" height="${HEADER_H + 20 + table.columns.length * ROW_H}" rx="12" fill="#1d1813" stroke="#8a6548" stroke-width="1.5"/>` +
        `<rect width="${TABLE_W}" height="${HEADER_H}" rx="12" fill="#32241b"/>` +
        `<text x="16" y="27" fill="#fff" font-family="Arial" font-size="16" font-weight="700">${table.name}</text>` +
        table.columns
          .map(
            (column, index) =>
              `<circle cx="16" cy="${ROW_TOP - 1 + index * ROW_H}" r="3" fill="${column.primaryKey ? '#e3b777' : '#8e7a6a'}"/>` +
              `<text x="28" y="${ROW_TOP + 4 + index * ROW_H}" fill="#eee" font-family="Arial" font-size="13">${column.name}</text>` +
              `<text x="${TABLE_W - 12}" y="${ROW_TOP + 4 + index * ROW_H}" text-anchor="end" fill="#a89585" font-family="Arial" font-size="11">${column.type}</text>`,
          )
          .join('') +
        `</g>`,
    )
    .join('');

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(width * scale)}" height="${Math.round(height * scale)}" viewBox="0 0 ${width} ${height}">` +
    `<rect width="100%" height="100%" fill="#100e0b"/>` +
    `<text x="28" y="32" fill="#d19a6a" font-family="Arial" font-size="18" font-weight="700">${schema.name}</text>` +
    `${edgesMarkup(schema)}${cards}</svg>`
  );
}

export default function DatabaseGenWorkspace() {
  const { user } = useAuth();
  const [prompt, setPrompt] = useState(SAMPLE_PROMPT);
  const [schema, setSchema] = useState<DatabaseSchema | null>(null);
  const [model, setModel] = useState(DEFAULT_MODELS[0].id);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState<{
    index: number;
    offset: Point;
  } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const relationships = useMemo(
    () =>
      schema?.tables.flatMap((table) =>
        table.columns
          .filter((column) => column.references)
          .map(
            (column) =>
              `${table.name}.${column.name} → ${column.references!.table}.${column.references!.column}`,
          ),
      ) ?? [],
    [schema],
  );
  const edges = useMemo(() => (schema ? edgesMarkup(schema) : ''), [schema]);
  const size = useMemo(
    () => (schema ? canvasSize(schema) : { width: 1000, height: 650 }),
    [schema],
  );

  const generate = async () => {
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt || generating) return;
    setGenerating(true);
    setError('');
    try {
      const apiKey = await getApiKey(user?.id ?? '');
      if (!apiKey)
        throw new Error(
          'OpenRouter API key not found. Add it in AI Chat first.',
        );
      const response = await requestOpenRouter({
        apiKey,
        model,
        temperature: 0.2,
        maxTokens: 5000,
        responseFormat: { type: 'json_object' },
        title: 'Yolnoma Database Generator',
        systemContext: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: cleanPrompt }],
      });
      const content = response.body.choices?.[0]?.message?.content;
      if (response.status < 200 || response.status >= 300 || !content)
        throw new Error(
          response.body.error?.message ||
            `OpenRouter returned HTTP ${response.status}`,
        );
      const parsed = JSON.parse(
        content.replace(/^```json\s*|\s*```$/g, '').trim(),
      );
      setSchema(normalizeSchema(parsed));
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : 'Could not generate the database schema.',
      );
    } finally {
      setGenerating(false);
    }
  };

  const updatePosition = (index: number, point: Point) =>
    setSchema((current) =>
      current
        ? {
            ...current,
            tables: current.tables.map((table, tableIndex) =>
              tableIndex === index ? { ...table, position: point } : table,
            ),
          }
        : current,
    );

  const exportPng = async () => {
    if (!schema) return;
    const svg = diagramSvg(schema, 2);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d');
      if (!context) return;
      context.drawImage(image, 0, 0);
      canvas.toBlob((blob) => {
        if (blob) downloadBlob('database-schema.png', blob);
      }, 'image/png');
    };
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!dragging || !schema || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scrollX = canvasRef.current.scrollLeft;
    const scrollY = canvasRef.current.scrollTop;
    updatePosition(dragging.index, {
      x: Math.max(
        12,
        (event.clientX - rect.left + scrollX) / zoom - dragging.offset.x,
      ),
      y: Math.max(
        48,
        (event.clientY - rect.top + scrollY) / zoom - dragging.offset.y,
      ),
    });
  };

  const canvasPointerUp = () => setDragging(null);
  const canvasPointerLeave = () => {
    if (dragging) setDragging(null);
  };

  return (
    <section className="overflow-hidden rounded-3xl border border-white/[0.10] bg-[#100e0b] shadow-2xl">
      <div className="relative border-b border-white/[0.12] bg-gradient-to-br from-[#2a1f17] via-[#1f1610] to-[#120d0a] px-7 py-8">
        {/* ── Background layers ───────────────────────────────── */}
        <div
          className="anim-aura pointer-events-none absolute left-1/2 top-0 h-[420px] w-[820px] rounded-full blur-[90px]"
          style={{
            background:
              'radial-gradient(circle, rgba(209,154,106,.16) 0%, transparent 68%)',
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.028) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.028) 1px, transparent 1px)',
            backgroundSize: '38px 38px',
            maskImage:
              'radial-gradient(ellipse 85% 70% at 50% 0%, #000 35%, transparent 100%)',
            WebkitMaskImage:
              'radial-gradient(ellipse 85% 70% at 50% 0%, #000 35%, transparent 100%)',
          }}
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--accent)]/45 to-transparent" />

        {/* ── Header section ───────────────────────────────── */}
        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0 flex-1">
            <div className="mb-4 flex items-center gap-2.5">
              <span className="relative flex items-center gap-2 overflow-hidden rounded-full border border-[var(--accent)]/25 bg-[var(--accent-dim)] px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--accent)]">
                <WandSparkles size={13} className="shrink-0" />
                Database Generator
              </span>
              <span className="h-px w-8 bg-gradient-to-r from-[var(--accent)]/40 to-transparent" />
            </div>

            <h2 className="font-serif text-[2.6rem] font-bold leading-[1.1] tracking-tight text-white">
              Design databases
              <span className="ml-3 bg-gradient-to-r from-[var(--accent)] to-[#c98560] bg-clip-text text-transparent">
                visually
              </span>
            </h2>

            <p className="mt-4 max-w-xl text-[13.5px] leading-relaxed text-white/50">
              Describe your product, let AI generate normalized tables and
              relationships, then arrange the architecture like a whiteboard.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2.5 rounded-full border border-emerald-400/25 bg-gradient-to-r from-emerald-400/12 to-emerald-500/[0.06] px-4 py-2 text-[11px] font-medium text-emerald-200/90 backdrop-blur-sm">
            <span
              className="anim-orb h-1.5 w-1.5 rounded-full bg-emerald-400"
              style={{ boxShadow: '0 0 0 0 rgba(52,211,153,.5)' }}
            />
            OpenRouter powered
          </div>
        </div>

        {/* ── Input panel ──────────────────────────────── */}
        <div className="group relative mt-8">
          {/* external light that is on focus */}
          <div className="pointer-events-none absolute -inset-px rounded-[20px] bg-gradient-to-r from-[var(--accent)]/0 via-[var(--accent)]/25 to-[var(--accent)]/0 opacity-0 blur-[2px] transition-opacity duration-300 group-focus-within:opacity-100" />

          <div className="relative rounded-[20px] border border-white/[0.09] bg-[#15100c]/80 backdrop-blur-sm transition-colors duration-300 group-focus-within:border-[var(--accent)]/35">
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                  event.preventDefault();
                  void generate();
                }
              }}
              rows={3}
              maxLength={600}
              placeholder="Describe your product or system…"
              className="form-textarea min-h-[104px] w-full resize-none rounded-t-[20px] border-0 bg-transparent px-5 pt-5 pb-2 text-[14px] leading-relaxed text-white/90 shadow-none outline-none focus:border-0 focus:bg-transparent focus:ring-0 placeholder:text-white/25"
            />

            {/* preset chips */}
            <div className="flex flex-wrap items-center gap-2 px-5 pb-4">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/25">
                Try
              </span>
              {[
                'Library Management System',
                'E-commerce Store',
                'Hospital Records',
                'SaaS Billing',
              ].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setPrompt(preset)}
                  disabled={generating}
                  className="rounded-full border border-white/[0.07] bg-white/[0.02] px-3 py-1 text-[11px] text-white/45 transition-all duration-150 hover:-translate-y-px hover:border-[var(--accent)]/30 hover:bg-[var(--accent-dim)] hover:text-[var(--accent)] disabled:opacity-30"
                >
                  {preset}
                </button>
              ))}
            </div>

            {/* bottom panel */}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-b-[20px] border-t border-white/[0.06] bg-black/25 px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">
                  Model
                </span>
                <SelectMenu
                  value={model}
                  options={DEFAULT_MODELS.map((m) => ({
                    value: m.id,
                    label: m.name ?? m.id,
                  }))}
                  onChange={setModel}
                  ariaLabel="Select AI model"
                  disabled={generating}
                  className="w-48"
                />
              </div>

              <div className="flex items-center gap-4">
                <span className="hidden text-[10px] tabular-nums text-white/20 sm:block">
                  {prompt.length}/600
                </span>

                <button
                  type="button"
                  onClick={() => void generate()}
                  disabled={generating || !prompt.trim()}
                  className="group/btn relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-gradient-to-br from-[var(--accent)] via-[#d19a6a] to-[#c98560] px-6 py-3 text-xs font-bold tracking-wide text-[#1b120e] shadow-[0_4px_20px_-4px_var(--accent)] transition-all duration-200 hover:-translate-y-0.5 hover:brightness-[1.12] hover:shadow-[0_10px_32px_-6px_var(--accent)] active:translate-y-0 active:scale-[0.97] active:brightness-95 disabled:pointer-events-none disabled:opacity-35 disabled:shadow-none"
                >
                  {/* hover'da yugurib o'tadigan yorug'lik */}
                  <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/45 to-transparent transition-transform duration-700 ease-out group-hover/btn:translate-x-full" />
                  {/* generatsiya paytida uzluksiz shine */}
                  {generating && (
                    <span className="anim-shine absolute inset-0" />
                  )}

                  <span className="relative flex items-center gap-2">
                    {generating ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Sparkles size={14} />
                    )}
                    {generating ? 'Generating…' : 'Generate schema'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Xato ─────────────────────────────────────────── */}
        <div className="relative mt-4 min-h-[22px]">
          {error && (
            <div className="anim-rise inline-flex items-center gap-2 rounded-lg border border-red-500/25 bg-red-500/[0.08] px-3 py-1.5 text-[11.5px] font-medium text-red-300">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
              {error}
            </div>
          )}
        </div>
      </div>

      {!schema ? (
        <div className="flex min-h-[420px] flex-col items-center justify-center gap-4 p-12 text-center">
          <div className="rounded-2xl bg-[var(--accent-dim)] p-5 text-[var(--accent)] shadow-lg shadow-[var(--accent)]/10">
            <Table2 size={32} />
          </div>
          <h3 className="font-serif text-3xl text-white font-bold">
            Your schema canvas is ready
          </h3>
          <p className="max-w-md text-sm leading-6 text-white/45">
            Describe a system above to generate tables, primary keys, foreign
            keys and join tables. You can rearrange everything after generation.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] bg-gradient-to-r from-white/[0.02] to-transparent px-5 py-4">
            <div className="flex items-center gap-4">
              <div className="text-sm font-bold text-white">{schema.name}</div>
              <span className="text-xs text-white/40 font-medium">
                {schema.tables.length} tables · {relationships.length}{' '}
                relationships
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setZoom((value) => Math.min(1.5, value + 0.1))}
                className="rounded-lg border border-white/15 p-2 text-white/60 hover:text-white hover:bg-white/10 hover:border-white/25 transition-all"
                title="Zoom in"
              >
                <ZoomIn size={15} />
              </button>
              <button
                type="button"
                onClick={() => setZoom((value) => Math.max(0.6, value - 0.1))}
                className="rounded-lg border border-white/15 p-2 text-white/60 hover:text-white hover:bg-white/10 hover:border-white/25 transition-all"
                title="Zoom out"
              >
                <ZoomOut size={15} />
              </button>
              <button
                type="button"
                onClick={() =>
                  downloadText(
                    `${schema.name.replace(/\s+/g, '-').toLowerCase()}.sql`,
                    schemaToSql(schema),
                    'text/plain',
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-xs text-white/70 hover:text-white hover:bg-white/10 hover:border-white/25 transition-all"
              >
                <Download size={14} /> SQL
              </button>
              <button
                type="button"
                onClick={() =>
                  downloadText(
                    `${schema.name.replace(/\s+/g, '-').toLowerCase()}.json`,
                    schemaToJson(schema),
                    'application/json',
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-xs text-white/70 hover:text-white hover:bg-white/10 hover:border-white/25 transition-all"
              >
                <FileJson size={14} /> JSON
              </button>
              <button
                type="button"
                onClick={() => void exportPng()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-[var(--accent)] to-[#c98560] px-3 py-2 text-xs font-semibold text-[#1b120e] shadow-lg shadow-[var(--accent)]/20 hover:shadow-xl transition-all"
              >
                <Download size={14} /> PNG
              </button>
              <button
                type="button"
                onClick={() => setSchema(null)}
                className="rounded-lg border border-red-400/30 p-2 text-red-300/70 hover:text-red-200 hover:bg-red-400/10 hover:border-red-400/50 transition-all"
                title="Clear workspace"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>

          <div
            ref={canvasRef}
            onPointerMove={onPointerMove}
            onPointerUp={canvasPointerUp}
            onPointerLeave={canvasPointerLeave}
            className="relative min-h-[650px] overflow-auto bg-[#0d0b09]"
            style={{
              backgroundImage:
                'radial-gradient(circle, rgba(255,255,255,.07) 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          >
            <div
              className="relative"
              style={{
                width: `${size.width * zoom}px`,
                height: `${size.height * zoom}px`,
              }}
            >
              {/* Connection lines only — cards are not drawn here */}
              <svg
                className="pointer-events-none absolute left-0 top-0"
                width={size.width}
                height={size.height}
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: 'top left',
                  zIndex: 1,
                }}
                dangerouslySetInnerHTML={{ __html: edges }}
              />
              <div
                className="absolute left-0 top-0"
                style={{
                  width: size.width,
                  height: size.height,
                  transform: `scale(${zoom})`,
                  transformOrigin: 'top left',
                }}
              >
                {schema.tables.map((table, index) => (
                  <div
                    key={table.name}
                    onPointerDown={(event) => {
                      const rect = event.currentTarget.getBoundingClientRect();
                      setDragging({
                        index,
                        offset: {
                          x: (event.clientX - rect.left) / zoom,
                          y: (event.clientY - rect.top) / zoom,
                        },
                      });
                      event.currentTarget.setPointerCapture(event.pointerId);
                    }}
                    onPointerUp={(event) => {
                      if (
                        event.currentTarget.hasPointerCapture(event.pointerId)
                      )
                        event.currentTarget.releasePointerCapture(
                          event.pointerId,
                        );
                      setDragging(null);
                    }}
                    className={`absolute w-[250px] cursor-grab select-none rounded-xl border border-[#8a6548]/80 bg-[#1d1813] active:cursor-grabbing ${dragging?.index === index ? 'z-20 shadow-2xl shadow-black/60 ring-1 ring-[var(--accent)]/40' : 'z-10 shadow-xl transition-shadow hover:shadow-2xl hover:shadow-[#8a6548]/20'}`}
                    style={{ left: table.position.x, top: table.position.y }}
                  >
                    <div className="flex items-center justify-between rounded-t-xl bg-gradient-to-r from-[#32241b] to-[#2a1d15] px-4 py-2.5">
                      <span className="truncate text-sm font-semibold text-white">
                        {table.name}
                      </span>
                      <Grip size={14} className="text-white/40" />
                    </div>
                    <div className="px-4 py-2.5">
                      {table.columns.map((column) => (
                        <div
                          key={column.name}
                          className="flex items-center justify-between gap-2 border-b border-white/[0.05] py-1.5 text-xs last:border-b-0"
                        >
                          <span className="flex min-w-0 items-center gap-1.5 truncate text-white/85">
                            <span
                              className={`h-1.5 w-1.5 shrink-0 rounded-full ${column.primaryKey ? 'bg-[var(--accent)]' : 'bg-white/30'}`}
                            />
                            {column.primaryKey && (
                              <span className="text-[9px] text-[var(--accent)] font-bold">
                                PK
                              </span>
                            )}
                            {column.name}
                          </span>
                          <span className="shrink-0 text-[10px] text-white/35">
                            {column.type}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 border-t border-white/[0.08] bg-gradient-to-r from-black/20 to-transparent px-5 py-3.5 text-[11px] text-white/40">
            <span className="flex items-center gap-1.5">
              <Grip size={13} /> Drag table cards to arrange
            </span>
            <span className="flex items-center gap-1.5">
              <Link2 size={13} /> {relationships.length} foreign-key
              relationships
            </span>
            <span className="flex items-center gap-1.5">
              <RefreshCw size={13} /> Regenerate anytime without losing your
              exports
            </span>
          </div>
        </>
      )}
    </section>
  );
}

export { schemaToSql, schemaToJson, diagramSvg };
