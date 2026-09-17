import { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { readDir } from '@tauri-apps/plugin-fs';
import {
  Bot, Check, ChevronDown, ChevronRight, FileCode2, FileText, Folder,
  FolderOpen, Loader2, MessageSquare, PanelLeft, PanelRight, Save,
  Send, Sparkles, X, XCircle,
} from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useAuth } from '@/features/auth/AuthContext';
import { getApiKey, saveApiKey } from '../storage';
import { DEFAULT_MODELS, type ToolCall } from '../types';
import { fetchOpenRouterModels, getShortModelName, requestOpenRouter } from '../api/openRouterApi';

type ProjectEntry = { name: string; path: string; kind: 'file' | 'directory'; depth: number };
type ChatMessage = { role: 'system' | 'user' | 'assistant' | 'tool'; content: string; tool_calls?: ToolCall[]; tool_call_id?: string };
type PendingEdit = { call: ToolCall; path: string; content: string };

const IGNORED_DIRECTORIES = new Set(['node_modules', '.git', 'dist', 'build', 'target', '.next', 'coverage', '.cache']);
const MAX_DEPTH = 8;
const MAX_FILES = 1800;
const MAX_FILE_CHARS = 40_000;
const TEXT_FILE_PATTERN = /\.(txt|md|mdx|json|jsonc|js|jsx|mjs|cjs|ts|tsx|css|scss|sass|less|html|htm|xml|yaml|yml|toml|ini|env|rs|py|go|java|kt|swift|c|h|cpp|hpp|cs|php|rb|sh|bash|bat|ps1|sql|graphql|vue|svelte|astro|gitignore|dockerfile|lock)$/i;

function joinProjectPath(base: string, name: string) {
  if (base.endsWith('/') || base.endsWith('\\')) return `${base}${name}`;
  return `${base}${base.includes('\\') || /^[A-Za-z]:/.test(base) ? '\\' : '/'}${name}`;
}
function relativePath(root: string, absolute: string) {
  return absolute.slice(root.length).replace(/^[\\/]+/, '').replace(/\\/g, '/');
}
function fileIcon(name: string) {
  return TEXT_FILE_PATTERN.test(name) ? <FileCode2 size={14} /> : <FileText size={14} />;
}

async function scanProject(rootPath: string): Promise<ProjectEntry[]> {
  const entries: ProjectEntry[] = [];
  async function walk(currentPath: string, depth: number) {
    if (depth > MAX_DEPTH || entries.length >= MAX_FILES) return;
    let children;
    try { children = await readDir(currentPath); } catch (error) {
      if (depth === 0) throw new Error(`Cannot read selected project folder: ${String(error)}`);
      return;
    }
    children.sort((a, b) => Number(Boolean(b.isDirectory)) - Number(Boolean(a.isDirectory)) || a.name.localeCompare(b.name));
    for (const child of children) {
      if (entries.length >= MAX_FILES || (child.name.startsWith('.') && child.name !== '.env.example')) continue;
      if (child.isDirectory && IGNORED_DIRECTORIES.has(child.name)) continue;
      const path = joinProjectPath(currentPath, child.name);
      entries.push({ name: child.name, path, kind: child.isDirectory ? 'directory' : 'file', depth });
      if (child.isDirectory) await walk(path, depth + 1);
    }
  }
  await walk(rootPath, 0);
  return entries;
}

const READ_FILE_TOOL = { type: 'function', function: { name: 'read_file', description: 'Read a text file inside the selected project.', parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } } } as const;
const WRITE_FILE_TOOL = { type: 'function', function: { name: 'write_file', description: 'Propose a complete replacement for a text file. The user must approve before writing.', parameters: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] } } } as const;

async function requestAgent(apiKey: string, model: string, messages: ChatMessage[]) {
  return requestOpenRouter({ apiKey, model, maxTokens: 3000, messages, tools: [READ_FILE_TOOL, WRITE_FILE_TOOL], toolChoice: 'auto', title: 'Yolnoma Agent' });
}

export default function AiAgentPage() {
  const { user } = useAuth();
  const [rootPath, setRootPath] = useState('');
  const [projectEntries, setProjectEntries] = useState<ProjectEntry[]>([]);
  const [selectedFile, setSelectedFile] = useState<ProjectEntry | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loadingProject, setLoadingProject] = useState(false);
  const [loadingFile, setLoadingFile] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [conversation, setConversation] = useState<ChatMessage[]>([]);
  const [apiKey, setApiKey] = useState('');
  const [draftKey, setDraftKey] = useState('');
  const [model, setModel] = useState(DEFAULT_MODELS[0].id);
  const [models, setModels] = useState(DEFAULT_MODELS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingEdit, setPendingEdit] = useState<PendingEdit | null>(null);
  const [saving, setSaving] = useState(false);
  const [activity, setActivity] = useState<string[]>([]);

  const projectName = useMemo(() => { const parts = rootPath.split(/[\\/]/).filter(Boolean); return parts[parts.length - 1] || 'Open a project'; }, [rootPath]);
  const systemPrompt = useMemo(() => [
    'You are Yolnoma Agent, an expert coding assistant inside a desktop IDE.',
    'Answer in the same language as the user. Work only inside the selected project root.',
    'Use read_file for real file contents before making claims. Never invent code or paths.',
    'When asked to modify code, use write_file with the complete intended file content. The app will ask the user for approval before writing.',
    `Selected project: ${rootPath || 'none'}`,
    `Project tree:\n${projectEntries.map((entry) => `${'  '.repeat(entry.depth)}${entry.name}${entry.kind === 'directory' ? '/' : ''}`).join('\n')}`,
  ].join('\n'), [projectEntries, rootPath]);

  useEffect(() => {
    void getApiKey(user?.id ?? '').then((key) => { setApiKey(key ?? ''); setDraftKey(key ?? ''); });
  }, [user?.id]);
  useEffect(() => {
    void fetchOpenRouterModels(apiKey).then(({ models: found }) => {
      if (found.length) { setModels(found); setModel(found[0].id); }
    }).catch(() => undefined);
  }, [apiKey]);

  const openProject = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (!selected || Array.isArray(selected)) return;
    setLoadingProject(true); setError('');
    try {
      const entries = await scanProject(selected);
      setRootPath(selected); setProjectEntries(entries); setSelectedFile(null); setFileContent('');
      setExpanded(new Set([selected, ...entries.filter((entry) => entry.kind === 'directory').map((entry) => entry.path)]));
      setMessages([]); setConversation([]); setActivity([]);
    } catch (scanError) { setError(scanError instanceof Error ? scanError.message : 'The project structure could not be read.'); }
    finally { setLoadingProject(false); }
  };

  const selectFile = async (entry: ProjectEntry) => {
    if (entry.kind === 'directory') { setExpanded((current) => { const next = new Set(current); next.has(entry.path) ? next.delete(entry.path) : next.add(entry.path); return next; }); return; }
    setSelectedFile(entry); setLoadingFile(true); setError('');
    try {
      const content = await invoke<string>('read_codebase_file', { rootPath, relativePath: relativePath(rootPath, entry.path) });
      setFileContent(content.length > MAX_FILE_CHARS ? `${content.slice(0, MAX_FILE_CHARS)}\n\n… file truncated for preview …` : content);
    } catch (readError) { setFileContent(''); setError(readError instanceof Error ? readError.message : 'This file could not be opened.'); }
    finally { setLoadingFile(false); }
  };

  const approveEdit = async (allow: boolean) => {
    if (!pendingEdit) return;
    const edit = pendingEdit; setPendingEdit(null);
    if (!allow) { setConversation((current) => [...current, { role: 'tool', tool_call_id: edit.call.id, content: 'User denied this edit.' }]); return; }
    setSaving(true);
    try {
      await invoke('write_codebase_file', { rootPath, relativePath: edit.path, content: edit.content });
      setActivity((current) => [`saved ${edit.path}`, ...current]);
      const updated = projectEntries.find((entry) => relativePath(rootPath, entry.path) === edit.path);
      if (updated) await selectFile(updated);
      setConversation((current) => [...current, { role: 'tool', tool_call_id: edit.call.id, content: `Successfully wrote ${edit.path}.` }]);
    } catch (writeError) { setError(writeError instanceof Error ? writeError.message : 'The file could not be written.'); setConversation((current) => [...current, { role: 'tool', tool_call_id: edit.call.id, content: `Write failed: ${String(writeError)}` }]); }
    finally { setSaving(false); }
  };

  const sendPrompt = async () => {
    const text = prompt.trim();
    if (!text || loading) return;
    if (!apiKey.trim()) { setError('OpenRouter API key kiriting.'); return; }
    if (!rootPath) { setError('Avval project folder oching.'); return; }
    setPrompt(''); setError(''); setLoading(true); setActivity(['thinking…', ...activity]);
    const nextConversation = [...conversation, { role: 'user' as const, content: text }];
    setConversation(nextConversation); setMessages((current) => [...current, { role: 'user', content: text }]);
    try {
      let working = [{ role: 'system' as const, content: systemPrompt }, ...nextConversation];
      for (let iteration = 0; iteration < 8; iteration += 1) {
        const response = await requestAgent(apiKey.trim(), model, working);
        if (response.status < 200 || response.status >= 300) throw new Error(response.body.error?.message || `OpenRouter HTTP ${response.status}`);
        const message = response.body.choices?.[0]?.message;
        if (!message) throw new Error('OpenRouter javob qaytarmadi.');
        const assistant = { role: 'assistant' as const, content: message.content || '' };
        working = [...working, { role: 'assistant' as const, content: message.content || '', tool_calls: message.tool_calls }];
        if (!message.tool_calls?.length) { setConversation(working.slice(1)); setMessages((current) => [...current, assistant]); return; }
        for (const call of message.tool_calls) {
          let args: { path?: string; content?: string } = {};
          try { args = JSON.parse(call.function.arguments) as typeof args; } catch { /* model error handled below */ }
          const path = args.path || '';
          if (!path || path.includes('..') || path.startsWith('/') || /^[A-Za-z]:/.test(path)) throw new Error('Agent returned an invalid project-relative path.');
          if (call.function.name === 'read_file') {
            setActivity((current) => [`reading ${path}`, ...current]);
            const content = await invoke<string>('read_codebase_file', { rootPath, relativePath: path });
            working = [...working, { role: 'tool', tool_call_id: call.id, content: content.slice(0, MAX_FILE_CHARS) }];
          } else if (call.function.name === 'write_file') {
            if (typeof args.content !== 'string') throw new Error('Agent did not provide file content for the edit.');
            setPendingEdit({ call, path, content: args.content });
            setLoading(false);
            setConversation(working.slice(1));
            return;
          }
        }
      }
      throw new Error('Agent step limit reached.');
    } catch (agentError) { setError(agentError instanceof Error ? agentError.message : String(agentError)); setLoading(false); }
    finally { setLoading(false); }
  };

  const saveKey = async () => { const clean = draftKey.trim(); await saveApiKey(user?.id ?? '', clean); setApiKey(clean); setError(''); };
  const visibleEntries = projectEntries.filter((entry) => { const segments = relativePath(rootPath, entry.path).split('/').filter(Boolean); if (segments.length <= 1) return true; let current = rootPath; for (const segment of segments.slice(0, -1)) { current = joinProjectPath(current, segment); if (!expanded.has(current)) return false; } return true; });

  return <main className="flex h-screen min-h-0 flex-col bg-[var(--bg-base)] text-[var(--text-primary)]">
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.08] bg-[#11100d] px-4"><div className="flex min-w-0 items-center gap-3"><div className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--accent-dim)] text-[var(--accent)]"><Bot size={17} /></div><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">Yolnoma Agent</p><p className="truncate text-sm font-medium text-white">{projectName}</p></div></div><div className="flex items-center gap-2"><button type="button" onClick={openProject} className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/70 hover:border-[var(--accent-border)] hover:text-white"><FolderOpen size={14} /> Open project</button><button type="button" onClick={() => void getCurrentWindow().close()} className="inline-flex items-center gap-2 rounded-md border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs font-semibold text-red-200 hover:bg-red-400/20"><X size={14} /> Exit</button></div></header>
    {!rootPath ? <section className="flex min-h-0 flex-1 items-center justify-center p-6"><div className="w-full max-w-xl border border-white/[0.09] bg-[#111109] p-10 text-center"><div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-lg bg-[var(--accent-dim)] text-[var(--accent)]"><FolderOpen size={25} /></div><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">PROJECT WORKSPACE</p><h1 className="mt-2 font-serif text-3xl text-white">Open a project to begin</h1><p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/45">Read, understand, and safely edit a ready project with OpenRouter-powered Yolnoma Agent.</p><button type="button" onClick={openProject} className="mt-7 inline-flex items-center gap-2 rounded-md bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[#1b120e] hover:bg-[#e08a6b]"><FolderOpen size={16} /> Open project</button>{error && <p className="mt-4 text-xs text-red-300">{error}</p>}</div></section> : <div className="grid min-h-0 flex-1 grid-cols-[260px_minmax(0,1fr)_360px]">
      <aside className="min-h-0 overflow-y-auto border-r border-white/[0.08] bg-[#11100d]"><div className="flex h-11 items-center justify-between border-b border-white/[0.07] px-3"><span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-white/45"><PanelLeft size={14} /> Explorer</span><button type="button" onClick={openProject} className="text-white/40 hover:text-white"><FolderOpen size={14} /></button></div><div className="p-2">{loadingProject ? <div className="flex items-center gap-2 px-2 py-3 text-xs text-white/40"><Loader2 size={14} className="animate-spin" /> Scanning project…</div> : visibleEntries.map((entry) => <button key={entry.path} type="button" onClick={() => void selectFile(entry)} className={`flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-xs hover:bg-white/[0.06] ${selectedFile?.path === entry.path ? 'bg-[var(--accent-dim)] text-white' : 'text-white/60'}`} style={{ paddingLeft: `${8 + entry.depth * 14}px` }}>{entry.kind === 'directory' ? (expanded.has(entry.path) ? <ChevronDown size={13} /> : <ChevronRight size={13} />) : <span className="text-[var(--accent)]">{fileIcon(entry.name)}</span>}{entry.kind === 'directory' && <Folder size={14} className="text-amber-300/70" />}<span className="truncate">{entry.name}</span></button>)}</div></aside>
      <section className="flex min-h-0 min-w-0 flex-col bg-[#15130f]"><div className="flex h-11 shrink-0 items-center justify-between border-b border-white/[0.07] px-4"><div className="flex min-w-0 items-center gap-2 text-xs text-white/50">{selectedFile ? <><span className="text-[var(--accent)]">{fileIcon(selectedFile.name)}</span><span className="truncate">{relativePath(rootPath, selectedFile.path)}</span></> : <><FileText size={14} /> Select a file from Explorer</>}</div><span className="text-[10px] uppercase tracking-wider text-white/25">Editable preview</span></div><div className="min-h-0 flex-1 overflow-auto p-5">{loadingFile ? <div className="flex items-center gap-2 text-xs text-white/40"><Loader2 size={14} className="animate-spin" /> Reading file…</div> : selectedFile ? <textarea value={fileContent} onChange={(event) => setFileContent(event.target.value)} className="h-full min-h-[500px] w-full resize-none whitespace-pre-wrap break-words bg-transparent font-mono text-[12px] leading-6 text-white/75 outline-none" spellCheck={false} /> : <div className="flex h-full items-center justify-center text-center text-sm text-white/30"><div><FileText className="mx-auto mb-3 opacity-40" size={30} /><p>Choose a text file to view and edit</p></div></div>}</div>{selectedFile && <div className="flex items-center justify-between border-t border-white/[0.08] px-4 py-2"><span className="text-[10px] text-white/30">Manual edits are saved directly to the project.</span><button type="button" disabled={saving} onClick={() => void invoke('write_codebase_file', { rootPath, relativePath: relativePath(rootPath, selectedFile.path), content: fileContent }).then(() => setActivity((current) => [`saved ${relativePath(rootPath, selectedFile.path)}`, ...current])).catch((saveError) => setError(String(saveError)))} className="inline-flex items-center gap-2 rounded-md bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-[#1b120e] disabled:opacity-50"><Save size={13} /> Save file</button></div>}{error && <p className="border-t border-red-400/10 bg-red-400/5 px-4 py-2 text-xs text-red-300">{error}</p>}</section>
      <aside className="flex min-h-0 flex-col border-l border-white/[0.08] bg-[#11100d]"><div className="flex h-11 shrink-0 items-center justify-between border-b border-white/[0.07] px-3"><span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-white/45"><PanelRight size={14} /> Agent</span><Sparkles size={14} className="text-[var(--accent)]" /></div><div className="border-b border-white/[0.07] p-3"><div className="mb-2 flex items-center justify-between"><span className="text-[10px] uppercase tracking-wider text-white/35">OpenRouter</span><span className={`h-2 w-2 rounded-full ${apiKey ? 'bg-emerald-400' : 'bg-amber-300'}`} /></div><div className="flex gap-2"><input type="password" value={draftKey} onChange={(event) => setDraftKey(event.target.value)} placeholder="OpenRouter API key" className="min-w-0 flex-1 border border-white/10 bg-white/[0.03] px-2 py-2 text-[11px] text-white outline-none focus:border-[var(--accent-border)]" /><button type="button" onClick={() => void saveKey()} className="rounded-md border border-white/10 px-2 text-[11px] text-white/60 hover:text-white">Save</button></div><select value={model} onChange={(event) => setModel(event.target.value)} className="mt-2 w-full border border-white/10 bg-[#181410] px-2 py-2 text-[11px] text-white outline-none">{models.map((item) => <option key={item.id} value={item.id}>{getShortModelName(item)}</option>)}</select></div><div className="min-h-0 flex-1 overflow-y-auto p-4">{messages.length === 0 ? <div className="mt-5 text-center"><MessageSquare className="mx-auto mb-3 text-[var(--accent)]/60" size={25} /><p className="text-sm text-white/70">Ask Yolnoma Agent</p><p className="mt-2 text-xs leading-relaxed text-white/35">Agent can read relevant files and propose approved edits.</p></div> : <div className="space-y-3">{messages.map((message, index) => <div key={`${message.role}-${index}`} className="border border-white/[0.08] bg-white/[0.025] p-3 text-xs leading-relaxed text-white/70"><span className="mb-1 block text-[10px] uppercase tracking-wider text-[var(--accent)]">{message.role === 'user' ? 'You' : 'Agent'}</span><pre className="whitespace-pre-wrap font-sans">{message.content}</pre></div>)}</div>}{activity.slice(0, 6).map((item, index) => <p key={`${item}-${index}`} className="mt-2 text-[10px] text-white/35">{item}</p>)}</div><div className="border-t border-white/[0.08] p-3"><div className="border border-white/10 bg-white/[0.03] focus-within:border-[var(--accent-border)]"><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendPrompt(); } }} placeholder="Ask about or edit this project…" rows={4} className="w-full resize-none bg-transparent px-3 py-3 text-xs leading-relaxed text-white outline-none placeholder:text-white/25" /><div className="flex items-center justify-between border-t border-white/[0.07] px-3 py-2"><span className="text-[10px] text-white/25">{loading ? 'Agent is working…' : 'Enter to send'}</span><button type="button" onClick={() => void sendPrompt()} disabled={loading || !prompt.trim()} className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--accent)] text-[#1b120e] disabled:opacity-30">{loading ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}</button></div></div></div></aside>
    </div>}
    {pendingEdit && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5"><div className="w-full max-w-2xl border border-white/10 bg-[#181410] shadow-2xl"><div className="flex items-center justify-between border-b border-white/10 px-5 py-4"><div><p className="text-[10px] uppercase tracking-wider text-[var(--accent)]">Agent edit approval</p><h2 className="mt-1 text-sm font-semibold text-white">Write {pendingEdit.path}?</h2></div><button type="button" onClick={() => void approveEdit(false)} className="text-white/40 hover:text-white"><XCircle size={18} /></button></div><pre className="max-h-[55vh] overflow-auto whitespace-pre-wrap p-5 font-mono text-xs leading-5 text-white/65">{pendingEdit.content}</pre><div className="flex justify-end gap-2 border-t border-white/10 px-5 py-4"><button type="button" onClick={() => void approveEdit(false)} className="rounded-md border border-white/10 px-3 py-2 text-xs text-white/60 hover:text-white">Deny</button><button type="button" onClick={() => void approveEdit(true)} className="inline-flex items-center gap-2 rounded-md bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-[#1b120e]"><Check size={13} /> Approve and save</button></div></div></div>}
  </main>;
}
