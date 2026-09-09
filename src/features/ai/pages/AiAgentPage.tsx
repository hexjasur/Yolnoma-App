import { useMemo, useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { readDir, readTextFile } from '@tauri-apps/plugin-fs';
import {
  Bot,
  ChevronDown,
  ChevronRight,
  FileCode2,
  FileText,
  Folder,
  FolderOpen,
  Loader2,
  MessageSquare,
  PanelLeft,
  PanelRight,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';

const IGNORED_DIRECTORIES = new Set(['node_modules', '.git', 'dist', 'build', 'target', '.next']);
const MAX_DEPTH = 5;
const MAX_FILES = 600;
const MAX_PREVIEW_CHARS = 30_000;

type ProjectEntry = {
  name: string;
  path: string;
  kind: 'file' | 'directory';
  depth: number;
};

function joinProjectPath(base: string, name: string) {
  if (base.endsWith('/') || base.endsWith('\\')) return `${base}${name}`;
  return `${base}${base.includes('\\') || /^[A-Za-z]:/.test(base) ? '\\' : '/'}${name}`;
}

function fileIcon(name: string) {
  if (/\.(tsx?|jsx?|vue|svelte|css|scss|html|json|rs|py|go|java)$/i.test(name)) {
    return <FileCode2 size={14} />;
  }
  return <FileText size={14} />;
}

async function scanProject(rootPath: string): Promise<ProjectEntry[]> {
  const entries: ProjectEntry[] = [];
  async function walk(currentPath: string, depth: number) {
    if (depth > MAX_DEPTH || entries.length >= MAX_FILES) return;
    let children;
    try {
      children = await readDir(currentPath);
    } catch (readError) {
      if (depth === 0) {
        throw new Error(`Cannot read selected project folder: ${String(readError)}`);
      }
      return;
    }
    children.sort((a, b) => Number(Boolean(b.isDirectory)) - Number(Boolean(a.isDirectory)) || a.name.localeCompare(b.name));
    for (const child of children) {
      if (entries.length >= MAX_FILES || child.name.startsWith('.') && child.name !== '.env.example') continue;
      if (child.isDirectory && IGNORED_DIRECTORIES.has(child.name)) continue;
      const path = joinProjectPath(currentPath, child.name);
      entries.push({ name: child.name, path, kind: child.isDirectory ? 'directory' : 'file', depth });
      if (child.isDirectory) await walk(path, depth + 1);
    }
  }
  await walk(rootPath, 0);
  return entries;
}

export default function AiAgentPage() {
  const [rootPath, setRootPath] = useState('');
  const [projectEntries, setProjectEntries] = useState<ProjectEntry[]>([]);
  const [selectedFile, setSelectedFile] = useState<ProjectEntry | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loadingProject, setLoadingProject] = useState(false);
  const [loadingFile, setLoadingFile] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<string[]>([]);
  const [error, setError] = useState('');

  const projectName = useMemo(() => {
    const parts = rootPath.split(/[\\/]/).filter(Boolean);
    return parts[parts.length - 1] || 'Open a project';
  }, [rootPath]);

  const openProject = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (!selected || Array.isArray(selected)) return;
    setLoadingProject(true);
    setError('');
    try {
      const entries = await scanProject(selected);
      setRootPath(selected);
      setProjectEntries(entries);
      setSelectedFile(null);
      setFileContent('');
      setExpanded(new Set([selected]));
      setMessages([]);
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : 'The project structure could not be read.');
    } finally {
      setLoadingProject(false);
    }
  };

  const selectFile = async (entry: ProjectEntry) => {
    if (entry.kind === 'directory') {
      setExpanded((current) => {
        const next = new Set(current);
        next.has(entry.path) ? next.delete(entry.path) : next.add(entry.path);
        return next;
      });
      return;
    }
    setSelectedFile(entry);
    setLoadingFile(true);
    setError('');
    try {
      const content = await readTextFile(entry.path);
      setFileContent(content.length > MAX_PREVIEW_CHARS
        ? `${content.slice(0, MAX_PREVIEW_CHARS)}\n\n… file truncated for preview …`
        : content);
    } catch (readError) {
      setFileContent('');
      setError(readError instanceof Error ? readError.message : 'This file could not be opened.');
    } finally {
      setLoadingFile(false);
    }
  };

  const sendPrompt = () => {
    const value = prompt.trim();
    if (!value) return;
    setMessages((current) => [...current, value]);
    setPrompt('');
  };

  const visibleEntries = projectEntries.filter((entry) => {
    const segments = entry.path.slice(rootPath.length).split(/[\\/]/).filter(Boolean);
    if (segments.length <= 1) return true;
    let current = rootPath;
    for (const segment of segments.slice(0, -1)) {
      current = joinProjectPath(current, segment);
      if (!expanded.has(current)) return false;
    }
    return true;
  });

  return (
    <main className="flex h-screen min-h-0 flex-col bg-[var(--bg-base)] text-[var(--text-primary)]">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.08] bg-[#11100d] px-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--accent-dim)] text-[var(--accent)]"><Bot size={17} /></div>
          <div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">Yolnoma Agent</p><p className="truncate text-sm font-medium text-white">{projectName}</p></div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={openProject} className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/70 transition-colors hover:border-[var(--accent-border)] hover:text-white"><FolderOpen size={14} /> Open project</button>
          <button type="button" onClick={() => void getCurrentWindow().close()} className="inline-flex items-center gap-2 rounded-md border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs font-semibold text-red-200 transition-colors hover:bg-red-400/20" title="Close Yolnoma Agent window"><X size={14} /> Exit</button>
        </div>
      </header>

      {!rootPath ? (
        <section className="flex min-h-0 flex-1 items-center justify-center p-6">
          <div className="w-full max-w-xl border border-white/[0.09] bg-[#111109] p-10 text-center shadow-2xl">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-lg bg-[var(--accent-dim)] text-[var(--accent)]"><FolderOpen size={25} /></div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">PROJECT WORKSPACE</p>
            <h1 className="mt-2 font-serif text-3xl text-white">Open a project to begin</h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/45">Browse a ready project, inspect files, and work with the Yolnoma Agent from one focused workspace.</p>
            <button type="button" onClick={openProject} className="mt-7 inline-flex items-center gap-2 rounded-md bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[#1b120e] transition-colors hover:bg-[#e08a6b]"><FolderOpen size={16} /> Open project</button>
            {error && <p className="mt-4 text-xs text-red-300">{error}</p>}
          </div>
        </section>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[260px_minmax(0,1fr)_340px]">
          <aside className="min-h-0 overflow-y-auto border-r border-white/[0.08] bg-[#11100d]">
            <div className="flex h-11 items-center justify-between border-b border-white/[0.07] px-3"><span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-white/45"><PanelLeft size={14} /> Explorer</span><button type="button" onClick={openProject} className="text-white/40 hover:text-white" title="Open another project"><FolderOpen size={14} /></button></div>
            <div className="p-2">
              {loadingProject ? <div className="flex items-center gap-2 px-2 py-3 text-xs text-white/40"><Loader2 size={14} className="animate-spin" /> Scanning project…</div> : visibleEntries.map((entry) => (
                <button key={entry.path} type="button" onClick={() => void selectFile(entry)} className={`flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-white/[0.06] ${selectedFile?.path === entry.path ? 'bg-[var(--accent-dim)] text-white' : 'text-white/60'}`} style={{ paddingLeft: `${8 + entry.depth * 14}px` }}>
                  {entry.kind === 'directory' ? (expanded.has(entry.path) ? <ChevronDown size={13} /> : <ChevronRight size={13} />) : <span className="text-[var(--accent)]">{fileIcon(entry.name)}</span>}
                  {entry.kind === 'directory' && <Folder size={14} className="text-amber-300/70" />}
                  <span className="truncate">{entry.name}</span>
                </button>
              ))}
            </div>
          </aside>

          <section className="flex min-h-0 min-w-0 flex-col bg-[#15130f]">
            <div className="flex h-11 shrink-0 items-center justify-between border-b border-white/[0.07] px-4"><div className="flex min-w-0 items-center gap-2 text-xs text-white/50">{selectedFile ? <><span className="text-[var(--accent)]">{fileIcon(selectedFile.name)}</span><span className="truncate">{selectedFile.path.slice(rootPath.length + 1)}</span></> : <><FileText size={14} /> Select a file from Explorer</>}</div><span className="text-[10px] uppercase tracking-wider text-white/25">Preview</span></div>
            <div className="min-h-0 flex-1 overflow-auto p-5">{loadingFile ? <div className="flex items-center gap-2 text-xs text-white/40"><Loader2 size={14} className="animate-spin" /> Reading file…</div> : selectedFile ? <pre className="whitespace-pre-wrap break-words font-mono text-[12px] leading-6 text-white/75">{fileContent}</pre> : <div className="flex h-full items-center justify-center text-center text-sm text-white/30"><div><FileText className="mx-auto mb-3 opacity-40" size={30} /><p>Choose a file to view its contents</p></div></div>}</div>
            {error && <p className="border-t border-red-400/10 bg-red-400/5 px-4 py-2 text-xs text-red-300">{error}</p>}
          </section>

          <aside className="flex min-h-0 flex-col border-l border-white/[0.08] bg-[#11100d]">
            <div className="flex h-11 shrink-0 items-center justify-between border-b border-white/[0.07] px-3"><span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-white/45"><PanelRight size={14} /> Agent</span><Sparkles size={14} className="text-[var(--accent)]" /></div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {messages.length === 0 ? <div className="mt-8 text-center"><MessageSquare className="mx-auto mb-3 text-[var(--accent)]/60" size={25} /><p className="text-sm text-white/70">Ask Yolnoma Agent</p><p className="mt-2 text-xs leading-relaxed text-white/35">Describe what you want to understand or change in this project.</p><div className="mt-6 space-y-2 text-left">{['Explain this project structure', 'Find the main application entry', 'Review the selected file'].map((suggestion) => <button key={suggestion} type="button" onClick={() => setPrompt(suggestion)} className="w-full rounded-md border border-white/[0.08] px-3 py-2 text-left text-xs text-white/50 transition-colors hover:border-[var(--accent-border)] hover:text-white/80">{suggestion}</button>)}</div></div> : <div className="space-y-3">{messages.map((message, index) => <div key={`${message}-${index}`} className="border border-white/[0.08] bg-white/[0.025] p-3 text-xs leading-relaxed text-white/70"><span className="mb-1 block text-[10px] uppercase tracking-wider text-[var(--accent)]">You</span>{message}</div>)}</div>}
            </div>
            <div className="border-t border-white/[0.08] p-3"><div className="border border-white/10 bg-white/[0.03] focus-within:border-[var(--accent-border)]"><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendPrompt(); } }} placeholder="Ask about this project…" rows={4} className="w-full resize-none bg-transparent px-3 py-3 text-xs leading-relaxed text-white outline-none placeholder:text-white/25" /><div className="flex items-center justify-between border-t border-white/[0.07] px-3 py-2"><span className="text-[10px] text-white/25">Enter to send · Shift+Enter for newline</span><button type="button" onClick={sendPrompt} disabled={!prompt.trim()} className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--accent)] text-[#1b120e] transition-opacity disabled:cursor-not-allowed disabled:opacity-30"><Send size={13} /></button></div></div></div>
          </aside>
        </div>
      )}
    </main>
  );
}
