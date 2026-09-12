import { useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { readDir, readFile } from '@tauri-apps/plugin-fs';
import { Check, FileText, FolderOpen, Loader2, Sparkles, WandSparkles } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { getApiKey } from '@/features/ai/storage';
import { fetchOpenRouterModels, getShortModelName } from '@/features/ai/api/openRouterApi';
import { DEFAULT_MODELS, type OpenRouterModel } from '@/features/ai/types';
import MarkdownContent from '@/features/ai/components/MarkdownContent';
import { toast } from '@/shared/ui/Toast';
import { ToolCard, ToolTitle } from './ToolShell';

type ProxyResponse = { status: number; body: { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } } };
type FileEntry = { path: string; kind: 'file' | 'directory' };

const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'target', '.next', 'coverage', '.cache', 'out']);
const TEXT_FILE = /\.(md|mdx|txt|json|jsonc|js|jsx|mjs|cjs|ts|tsx|css|scss|html|xml|yaml|yml|toml|ini|env|rs|py|go|java|kt|swift|c|cpp|h|hpp|cs|php|rb|sh|sql|graphql|vue|svelte|astro)$/i;
const IMAGE_FILE = /\.(png|jpe?g|gif|svg|webp|avif|ico)$/i;
const MAX_FILES = 900;
const MAX_FILE_CHARS = 12_000;
const MAX_CONTEXT_CHARS = 65_000;

function joinPath(base: string, name: string) {
  return `${base.replace(/[\\/]$/, '')}${base.includes('\\') || /^[A-Za-z]:/.test(base) ? '\\' : '/'}${name}`;
}

function relativePath(root: string, absolute: string) {
  return absolute.slice(root.length).replace(/^[\\/]+/, '').replace(/\\/g, '/');
}

async function describeAsset(path: string) {
  try {
    const bytes = await readFile(path);
    const size = `${(bytes.byteLength / 1024).toFixed(1)} KB`;
    if (/\.svg$/i.test(path)) return `${size}, vector SVG`;
    const url = URL.createObjectURL(new Blob([bytes]));
    const dimensions = await new Promise<string>((resolve) => {
      const image = new Image();
      image.onload = () => { resolve(`${size}, ${image.naturalWidth}×${image.naturalHeight}px`); URL.revokeObjectURL(url); };
      image.onerror = () => { resolve(size); URL.revokeObjectURL(url); };
      image.src = url;
    });
    return dimensions;
  } catch {
    return 'dimensions unavailable';
  }
}

async function scanFolder(rootPath: string) {
  const files: FileEntry[] = [];
  async function walk(current: string, depth: number) {
    if (depth > 7 || files.length >= MAX_FILES) return;
    const entries = await readDir(current);
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (files.length >= MAX_FILES || (entry.name.startsWith('.') && entry.name !== '.env.example')) continue;
      if (entry.isDirectory && IGNORED_DIRS.has(entry.name)) continue;
      const path = joinPath(current, entry.name);
      files.push({ path, kind: entry.isDirectory ? 'directory' : 'file' });
      if (entry.isDirectory) await walk(path, depth + 1);
    }
  }
  await walk(rootPath, 0);
  return files;
}

async function requestReadme(apiKey: string, model: string, context: string) {
  const system = `You are Yolnoma README Architect, a senior open-source documentation engineer. You inspect a real project context and produce a polished, useful README.md — not a generic template. Never invent features, scripts, dependencies, commands, license, or metrics. If evidence is missing, write a concise TODO or omit the claim. Use the project's actual name and stack. Prefer clear headings, tables where useful, copy-pasteable commands, badges only when their URLs are supported by evidence, and a practical quick-start. Include: project identity, logo/visual identity when known, one-sentence value proposition, features grounded in evidence, tech stack, architecture or folder map, prerequisites, installation, configuration/env variables (never expose secret values), scripts, usage, screenshots placeholder only if no screenshot exists, contribution guidance, roadmap only when supported, and license status. Return ONLY the complete Markdown document, beginning with a top-level title.`;
  return invoke<ProxyResponse>('proxy_request', {
    method: 'POST',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://yolnoma.app',
      'X-Title': 'Yolnoma AI README Generator',
    },
    body: { model, max_tokens: 5000, temperature: 0.25, messages: [{ role: 'system', content: system }, { role: 'user', content: context }] },
  });
}

export default function ReadmeGeneratorTool() {
  const { user } = useAuth();
  const [rootPath, setRootPath] = useState('');
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [context, setContext] = useState('');
  const [readme, setReadme] = useState('');
  const [model, setModel] = useState(DEFAULT_MODELS[0].id);
  const [models, setModels] = useState<OpenRouterModel[]>(DEFAULT_MODELS);
  const [loadingFolder, setLoadingFolder] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState('');
  const [apiKey, setApiKey] = useState('');

  const projectName = useMemo(() => rootPath.split(/[\\/]/).filter(Boolean).pop() || 'your project', [rootPath]);
  const imageFiles = useMemo(() => entries.filter((entry) => entry.kind === 'file' && IMAGE_FILE.test(entry.path)).map((entry) => relativePath(rootPath, entry.path)), [entries, rootPath]);
  const fileCount = entries.filter((entry) => entry.kind === 'file').length;

  const pickFolder = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (!selected || Array.isArray(selected)) return;
    setLoadingFolder(true); setError(''); setReadme('');
    try {
      const found = await scanFolder(selected);
      const textEntries = found.filter((entry) => entry.kind === 'file' && TEXT_FILE.test(entry.path));
      const priority = textEntries.filter((entry) => /(^|\/)(package\.json|readme|vite\.config|tsconfig|cargo\.toml|pyproject\.toml|requirements|dockerfile|\.env\.example|src\/|app\/|pages\/)/i.test(relativePath(selected, entry.path)));
      const selectedFiles = [...priority, ...textEntries.filter((entry) => !priority.includes(entry))].slice(0, 80);
      let total = 0;
      const snapshots: string[] = [];
      for (const entry of selectedFiles) {
        if (total >= MAX_CONTEXT_CHARS) break;
        try {
          const content = await invoke<string>('read_codebase_file', { rootPath: selected, relativePath: relativePath(selected, entry.path) });
          const chunk = content.slice(0, Math.min(MAX_FILE_CHARS, MAX_CONTEXT_CHARS - total));
          snapshots.push(`\n--- FILE: ${relativePath(selected, entry.path)} ---\n${chunk}`);
          total += chunk.length;
        } catch { /* unreadable/binary files are skipped */ }
      }
      const tree = found.map((entry) => `${relativePath(selected, entry.path)}${entry.kind === 'directory' ? '/' : ''}`).join('\n');
      const scannedImageFiles = found.filter((entry) => entry.kind === 'file' && IMAGE_FILE.test(entry.path)).map((entry) => relativePath(selected, entry.path));
      const assetDetails = await Promise.all(found.filter((entry) => entry.kind === 'file' && IMAGE_FILE.test(entry.path)).slice(0, 20).map(async (entry) => `${relativePath(selected, entry.path)} — ${await describeAsset(entry.path)}`));
      setRootPath(selected); setEntries(found);
      setContext(`PROJECT NAME: ${selected.split(/[\\/]/).filter(Boolean).pop() || 'Project'}\nPROJECT ROOT: ${selected}\n\nFILE TREE:\n${tree}\n\nIMAGE / LOGO ASSETS (use the likely logo path and dimensions in the README when relevant):\n${assetDetails.join('\n') || scannedImageFiles.join('\n') || 'No image assets found'}\n\nTEXT FILE SNAPSHOTS:${snapshots.join('')}`);
      const key = await getApiKey(user?.id ?? '');
      setApiKey(key ?? '');
      if (key) {
        const foundModels = await fetchOpenRouterModels(key).then((result) => result.models).catch(() => []);
        if (foundModels.length) { setModels(foundModels); setModel(foundModels[0].id); }
      }
      toast.success(`Folder scanned: ${found.length} entries`);
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : 'Folder could not be read.');
    } finally { setLoadingFolder(false); }
  };

  const generate = async () => {
    if (!context || !rootPath) { setError('Avval loyiha folderini tanlang.'); return; }
    if (!apiKey) { setError('OpenRouter API key topilmadi. AI Chat yoki Agent sozlamalaridan key kiriting.'); return; }
    setGenerating(true); setError('');
    try {
      const response = await requestReadme(apiKey, model, `${context}\n\nTASK: Create a high-quality README for this project. Use the evidence above deeply. Mention the likely logo path and its role when a logo asset exists. Make the document feel specific to this project, useful to a new contributor, and honest about unknowns.`);
      if (response.status < 200 || response.status >= 300) throw new Error(response.body.error?.message || `OpenRouter HTTP ${response.status}`);
      const content = response.body.choices?.[0]?.message?.content?.trim();
      if (!content) throw new Error('AI README qaytarmadi.');
      setReadme(content.replace(/^```markdown\s*/i, '').replace(/```\s*$/i, '').trim());
      toast.success('README generated — review it before applying.');
    } catch (generationError) { setError(generationError instanceof Error ? generationError.message : String(generationError)); }
    finally { setGenerating(false); }
  };

  const applyReadme = async () => {
    if (!readme || !rootPath) return;
    setApplying(true); setError('');
    try {
      await invoke('write_codebase_file', { rootPath, relativePath: 'README.md', content: `${readme.trim()}\n` });
      toast.success('README.md added to the project folder');
    } catch (writeError) { setError(writeError instanceof Error ? writeError.message : 'README.md yozilmadi.'); }
    finally { setApplying(false); }
  };

  return <ToolCard>
    <ToolTitle icon={WandSparkles} text="README Generator" subtitle="Scan a real project, build deep context, and generate a project-specific README with OpenRouter AI." />
    <div className="mt-5 grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="border border-white/[0.08] bg-black/10 p-4">
        <div className="flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">Project context</span><Sparkles size={14} className="text-[var(--accent)]" /></div>
        <button type="button" onClick={() => void pickFolder()} disabled={loadingFolder} className="mt-4 flex w-full items-center justify-center gap-2 border border-[var(--accent-border)] bg-[var(--accent-glow)] px-3 py-2.5 text-xs font-semibold text-white hover:bg-[var(--accent-dim)] disabled:opacity-50"><FolderOpen size={15} /> {loadingFolder ? 'Scanning…' : rootPath ? 'Choose another folder' : 'Choose project folder'}</button>
        {rootPath && <div className="mt-4 space-y-3"><div className="border border-white/[0.08] bg-white/[0.025] p-3"><p className="truncate text-xs font-semibold text-white">{projectName}</p><p className="mt-1 break-all text-[10px] leading-4 text-white/35">{rootPath}</p></div><div className="grid grid-cols-2 gap-2 text-center"><div className="border border-white/[0.07] p-2"><p className="text-lg font-semibold text-white">{fileCount}</p><p className="text-[10px] text-white/35">files</p></div><div className="border border-white/[0.07] p-2"><p className="text-lg font-semibold text-white">{imageFiles.length}</p><p className="text-[10px] text-white/35">assets</p></div></div><label className="block text-[10px] text-white/35">OpenRouter model<select value={model} onChange={(event) => setModel(event.target.value)} className="mt-1 w-full border border-white/10 bg-[#181410] px-2 py-2 text-[11px] text-white outline-none">{models.map((item) => <option key={item.id} value={item.id}>{getShortModelName(item)}</option>)}</select></label><p className="text-[10px] leading-4 text-white/30">Context includes the file tree, package/config files, source snapshots, and image/logo asset names. Secrets are never requested.</p></div>}
        {error && <p className="mt-3 border-l-2 border-red-400/70 pl-3 text-xs leading-5 text-red-300">{error}</p>}
      </aside>
      <section className="min-w-0 border border-white/[0.08] bg-[#0d0d0a]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] px-4 py-3"><div><span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">Generated README</span><p className="mt-1 text-xs text-white/30">AI first reads your project context; always review before applying.</p></div><div className="flex gap-2"><button type="button" onClick={() => void generate()} disabled={generating || loadingFolder || !rootPath} className="inline-flex items-center gap-1.5 bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-[#1b120e] disabled:opacity-40">{generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} {generating ? 'Generating…' : 'Generate README'}</button>{readme && <button type="button" onClick={() => void applyReadme()} disabled={applying} className="inline-flex items-center gap-1.5 border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-200 disabled:opacity-40">{applying ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Apply to project</button>}</div></div>
        <div className="min-h-[520px] p-5">{readme ? <article className="markdown-content"><MarkdownContent content={readme} /></article> : <div className="flex min-h-[470px] flex-col items-center justify-center text-center"><FileText size={32} className="text-[var(--accent)]/50" /><h3 className="mt-4 text-base font-semibold text-white/75">A specific README, not a generic template</h3><p className="mt-2 max-w-md text-xs leading-5 text-white/35">Choose a project folder and Yolnoma will inspect its structure, configs, source files, scripts, and visual assets before writing the documentation.</p></div>}</div>
      </section>
    </div>
  </ToolCard>;
}
