import { useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { readDir, readFile } from '@tauri-apps/plugin-fs';
import { Check, Code2, Eye, FileText, FolderOpen, Loader2, Sparkles, WandSparkles } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { getApiKey } from '@/features/ai/storage';
import { fetchOpenRouterModels, getShortModelName, isLimitError } from '@/features/ai/api/openRouterApi';
import { DEFAULT_MODELS, type OpenRouterModel } from '@/features/ai/types';
import MarkdownContent from '@/features/ai/components/MarkdownContent';
import { toast } from '@/shared/ui/Toast';
import { ToolCard, ToolTitle } from '@/features/developer-tools/components/ToolShell';

type ProxyResponse = { status: number; body: { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } } };
type FileEntry = { path: string; kind: 'file' | 'directory' };
type AssetCandidate = { path: string; details: string; dataUrl?: string };

const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'target', '.next', 'coverage', '.cache', 'out']);
const TEXT_FILE = /\.(md|mdx|txt|json|jsonc|js|jsx|mjs|cjs|ts|tsx|css|scss|html|xml|yaml|yml|toml|ini|env|rs|py|go|java|kt|swift|c|cpp|h|hpp|cs|php|rb|sh|sql|graphql|vue|svelte|astro)$/i;
const IMAGE_FILE = /\.(png|jpe?g|gif|svg|webp|avif|ico)$/i;
const MAX_FILES = 900;
const MAX_FILE_CHARS = 12_000;
const MAX_CONTEXT_CHARS = 65_000;
const MAX_TREE_ENTRIES = 420;

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

function toBase64(bytes: Uint8Array) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function imageMime(path: string) {
  const extension = path.split('.').pop()?.toLowerCase();
  return extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg' : extension === 'svg' ? 'image/svg+xml' : `image/${extension || 'png'}`;
}

async function scanFolder(rootPath: string) {
  const files: FileEntry[] = [];
  async function walk(current: string, depth: number) {
    if (depth > 7 || files.length >= MAX_FILES) return;
    let entries;
    try {
      entries = await readDir(current);
    } catch (error) {
      if (depth === 0) throw new Error(`Selected folder could not be opened: ${String(error)}`);
      return;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (files.length >= MAX_TREE_ENTRIES || (entry.name.startsWith('.') && entry.name !== '.env.example')) continue;
      if (entry.isDirectory && IGNORED_DIRS.has(entry.name)) continue;
      const path = joinPath(current, entry.name);
      files.push({ path, kind: entry.isDirectory ? 'directory' : 'file' });
      if (entry.isDirectory) await walk(path, depth + 1);
    }
  }
  await walk(rootPath, 0);
  return files;
}

async function requestReadme(apiKey: string, model: string, context: string, customPrompt: string, assets: AssetCandidate[]) {
  const system = `You are Yolnoma README Architect, a senior open-source documentation engineer. You inspect real project files AND provided image previews, then produce a polished, useful README.md — not a generic template. Never invent features, scripts, dependencies, commands, license, or metrics. If evidence is missing, omit the claim. Use the project's actual name and stack. Analyze image previews to identify the real logo, app icon, screenshots, banners, and UI images. Use exact relative asset paths from the context: if a logo is clearly identified, place it near the top using Markdown image syntax such as ![Project logo](path/to/logo.png). Add screenshots or other relevant images only in sections where they make sense, with useful alt text; do not dump every asset into the README. Keep image paths relative to README.md. If no logo is identified, do not invent one. Prefer clear headings, tables where useful, copy-pasteable commands, badges only when their URLs are supported by evidence, and a practical quick-start. Include: identity, visual identity, value proposition, evidence-based features, tech stack, architecture/folder map, prerequisites, installation, configuration/env variables (never expose secret values), scripts, usage, contribution guidance, roadmap only when supported, and license status. Return ONLY the complete Markdown document, beginning with a top-level title.`;
  const imageParts = assets.filter((asset) => asset.dataUrl).flatMap((asset) => [
    { type: 'text', text: `Image candidate: ${asset.path} (${asset.details})` },
    { type: 'image_url', image_url: { url: asset.dataUrl } },
  ]);
  return invoke<ProxyResponse>('proxy_request', {
    method: 'POST',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://yolnoma.app',
      'X-Title': 'Yolnoma AI README Generator',
    },
    body: { model, max_tokens: 5000, temperature: 0.25, messages: [{ role: 'system', content: system }, { role: 'user', content: [{ type: 'text', text: `${context}\n\nCUSTOM USER INSTRUCTIONS:\n${customPrompt || 'No additional instructions. Use your best documentation judgment.'}` }, ...imageParts] }] },
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
  const [customPrompt, setCustomPrompt] = useState('');
  const [activeModel, setActiveModel] = useState('');
  const [assets, setAssets] = useState<AssetCandidate[]>([]);
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');

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
      const selectedFiles = [...priority, ...textEntries.filter((entry) => !priority.includes(entry))].slice(0, 36);
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
      const assetEntries = found.filter((entry) => entry.kind === 'file' && IMAGE_FILE.test(entry.path)).slice(0, 20);
      const assetCandidates = await Promise.all(assetEntries.map(async (entry): Promise<AssetCandidate> => {
        const relative = relativePath(selected, entry.path);
        const details = await describeAsset(entry.path);
        try {
          const bytes = await readFile(entry.path);
          const dataUrl = bytes.byteLength <= 2_000_000 ? `data:${imageMime(entry.path)};base64,${toBase64(bytes)}` : undefined;
          return { path: relative, details, dataUrl };
        } catch {
          return { path: relative, details };
        }
      }));
      const assetDetails = assetCandidates.map((asset) => `${asset.path} — ${asset.details}`);
      setRootPath(selected); setEntries(found);
      setAssets(assetCandidates);
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
      const candidates = [model, ...models.map((item) => item.id).filter((id) => id !== model)];
      let response: ProxyResponse | null = null;
      let lastError = '';
      for (const candidate of candidates) {
        const attempt = await requestReadme(apiKey, candidate, `${context}\n\nTASK: Create a high-quality README for this project. Use the evidence above deeply. Mention the likely logo path and its role when a logo asset exists. Make the document feel specific to this project, useful to a new contributor, and honest about unknowns.`, customPrompt, assets);
        if (attempt.status >= 200 && attempt.status < 300 && attempt.body.choices?.[0]?.message?.content) {
          response = attempt;
          setActiveModel(candidate);
          break;
        }
        lastError = attempt.body.error?.message || `HTTP ${attempt.status}`;
        const canFallback = isLimitError(attempt.status, lastError) || attempt.status >= 500 || attempt.status === 400;
        if (!canFallback) throw new Error(lastError);
        if (candidate !== candidates[candidates.length - 1]) toast.info(`${getShortModelName({ id: candidate })} ishlamadi, keyingi model sinab ko‘rilmoqda…`);
      }
      if (!response) throw new Error(`AI model ishlamadi: ${lastError}`);
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
        {rootPath && <div className="mt-4 space-y-3"><div className="border border-white/[0.08] bg-white/[0.025] p-3"><p className="truncate text-xs font-semibold text-white">{projectName}</p><p className="mt-1 break-all text-[10px] leading-4 text-white/35">{rootPath}</p></div><div className="grid grid-cols-2 gap-2 text-center"><div className="border border-white/[0.07] p-2"><p className="text-lg font-semibold text-white">{fileCount}</p><p className="text-[10px] text-white/35">files found</p></div><div className="border border-white/[0.07] p-2"><p className="text-lg font-semibold text-white">{imageFiles.length}</p><p className="text-[10px] text-white/35">assets</p></div></div><label className="block text-[10px] text-white/35">OpenRouter model<select value={model} onChange={(event) => setModel(event.target.value)} className="mt-1 w-full border border-white/10 bg-[#181410] px-2 py-2 text-[11px] text-white outline-none">{models.map((item) => <option key={item.id} value={item.id}>{getShortModelName(item)}</option>)}</select></label>{activeModel && <p className="text-[10px] text-emerald-300/60">Used model: {getShortModelName({ id: activeModel })}</p>}<p className="text-[10px] leading-4 text-white/30">AI faqat README uchun muhim bo‘lgan 36 tagacha text/config faylni o‘qiydi; barcha fayllar yuborilmaydi. Secret qiymatlar so‘ralmaydi.</p></div>}
        {error && <p className="mt-3 border-l-2 border-red-400/70 pl-3 text-xs leading-5 text-red-300">{error}</p>}
      </aside>
      <section className="min-w-0 border border-white/[0.08] bg-[#0d0d0a]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] px-4 py-3"><div><span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">Generated README</span><p className="mt-1 text-xs text-white/30">AI first reads your project context and visual assets; always review before applying.</p></div><div className="flex flex-wrap items-center gap-2"><div className="inline-flex border border-white/10 bg-white/[0.03] p-0.5"><button type="button" onClick={() => setViewMode('preview')} className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs ${viewMode === 'preview' ? 'bg-white/[0.10] text-white' : 'text-white/40 hover:text-white'}`}><Eye size={14} /> Preview</button><button type="button" onClick={() => setViewMode('code')} className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs ${viewMode === 'code' ? 'bg-white/[0.10] text-white' : 'text-white/40 hover:text-white'}`}><Code2 size={14} /> Code</button></div><button type="button" onClick={() => void generate()} disabled={generating || loadingFolder || !rootPath} className="inline-flex items-center gap-1.5 bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-[#1b120e] disabled:opacity-40">{generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} {generating ? 'Generating…' : 'Generate README'}</button>{readme && <button type="button" onClick={() => void applyReadme()} disabled={applying} className="inline-flex items-center gap-1.5 border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-200 disabled:opacity-40">{applying ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Apply to project</button>}</div></div>
        <div className="border-b border-white/[0.08] p-4"><label className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">Custom instructions <span className="font-normal normal-case tracking-normal text-white/25">(optional)</span><textarea value={customPrompt} onChange={(event) => setCustomPrompt(event.target.value)} rows={3} placeholder="For example: the README should be in English, and you should provide detailed instructions for deployment and environment setup…" className="mt-2 w-full resize-y border border-white/10 bg-white/[0.025] px-3 py-2.5 text-xs leading-5 text-white outline-none placeholder:text-white/25 focus:border-[var(--accent-border)]" /></label></div><div className="min-h-[450px] p-5">{readme ? viewMode === 'preview' ? <article className="markdown-content"><MarkdownContent content={readme} /></article> : <textarea value={readme} onChange={(event) => setReadme(event.target.value)} className="min-h-[430px] w-full resize-y border border-white/10 bg-black/20 p-4 font-mono text-xs leading-6 text-white/75 outline-none focus:border-[var(--accent-border)]" spellCheck={false} aria-label="Generated README Markdown code" /> : <div className="flex min-h-[400px] flex-col items-center justify-center text-center"><FileText size={32} className="text-[var(--accent)]/50" /><h3 className="mt-4 text-base font-semibold text-white/75">A specific README, not a generic template</h3><p className="mt-2 max-w-md text-xs leading-5 text-white/35">Choose a project folder, add optional instructions, and Yolnoma will inspect only the most relevant files and visual assets before writing the documentation.</p></div>}</div>
      </section>
    </div>
  </ToolCard>;
}
