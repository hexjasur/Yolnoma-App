import { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { AlertCircle, Check, FileCode2, FolderOpen, GitBranch, KeyRound, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import ApiKeyModal from '@/features/ai/components/ApiKeyModal';
import { getApiKey, saveApiKey } from '@/features/ai/storage';
import { fetchOpenRouterModels, isLimitError, requestChatCompletion } from '@/features/ai/api/openRouterApi';
import { DEFAULT_MODELS, type OpenRouterModel, type ProxyResponse } from '@/features/ai/types';
import { toast } from '@/shared/ui/Toast';
import { ToolCard, ToolTitle } from '@/features/developer-tools/components/ToolShell';

type GitChange = { path: string; status: string; diff: string };
const MAX_CONTEXT_CHARS = 100_000;
const SYSTEM_CONTEXT = `You are a senior Git maintainer. Generate one polished Git commit message from only the supplied working-tree changes. Follow Conventional Commits with one of feat, fix, perf, refactor, docs, test, build, chore. Include one tasteful relevant emoji at the end of the subject. Keep the subject under 72 characters. Then add a concise body with 2-5 bullet points describing the meaningful changes. Never invent changes, never include Markdown code fences, and output only the commit message.`;

function buildPrompt(changes: GitChange[]) {
  let used = 0;
  const sections: string[] = [];
  for (const change of changes) {
    const section = `FILE: ${change.path}\nSTATUS: ${change.status}\nDIFF:\n${change.diff}`;
    if (used + section.length > MAX_CONTEXT_CHARS) break;
    sections.push(section);
    used += section.length;
  }
  return `Analyze these current Git changes and write the best-practice commit message. Only these changes are authoritative.\n\n${sections.join('\n\n---\n\n')}`;
}

export default function GitPage() {
  const { user } = useAuth();
  const [folderPath, setFolderPath] = useState('');
  const [changes, setChanges] = useState<GitChange[]>([]);
  const [loadingChanges, setLoadingChanges] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [draftKey, setDraftKey] = useState('');
  const [apiKeyReady, setApiKeyReady] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [models, setModels] = useState<OpenRouterModel[]>(DEFAULT_MODELS);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODELS[0].id);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [fallbackNote, setFallbackNote] = useState('');

  useEffect(() => {
    getApiKey(user?.id ?? '').then((key) => {
      setApiKey(key ?? '');
      setDraftKey(key ?? '');
      setApiKeyReady(true);
    });
  }, [user?.id]);

  useEffect(() => {
    if (!apiKeyReady) return;
    let cancelled = false;
    setModelsLoading(true);
    fetchOpenRouterModels(apiKey)
      .then(({ response, models: available }) => {
        if (cancelled || response.status < 200 || response.status >= 300 || !available.length) return;
        const ordered = [...available.filter((model) => DEFAULT_MODELS.some((fallback) => fallback.id === model.id)), ...available.filter((model) => !DEFAULT_MODELS.some((fallback) => fallback.id === model.id))];
        setModels(ordered);
        setSelectedModel((current) => ordered.some((model) => model.id === current) ? current : ordered[0].id);
      })
      .catch(() => { /* Built-in fallback models remain available. */ })
      .finally(() => { if (!cancelled) setModelsLoading(false); });
    return () => { cancelled = true; };
  }, [apiKey, apiKeyReady]);

  const pickFolder = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (!selected || typeof selected !== 'string') return;
    setFolderPath(selected);
    await refreshChanges(selected);
  };

  const refreshChanges = async (path = folderPath) => {
    if (!path) return;
    setLoadingChanges(true);
    setError('');
    setMessage('');
    try {
      const next = await invoke<GitChange[]>('get_git_changes', { rootPath: path });
      setChanges(next);
      if (!next.length) toast.info('No modified or new Git files found');
    } catch (value) {
      setChanges([]);
      setError(value instanceof Error ? value.message : String(value));
    } finally {
      setLoadingChanges(false);
    }
  };

  const saveKey = async () => {
    const cleanKey = draftKey.trim();
    if (!cleanKey) return;
    await saveApiKey(user?.id ?? '', cleanKey);
    setApiKey(cleanKey);
    setShowKeyModal(false);
    toast.success('OpenRouter API key saved securely');
  };

  const generateCommit = async () => {
    if (!apiKey) { setShowKeyModal(true); return; }
    if (!changes.length) { setError('Select a Git folder with modified or new files first.'); return; }
    setGenerating(true);
    setError('');
    setFallbackNote('');
    const candidates = [selectedModel, ...models.map((model) => model.id).filter((id) => id !== selectedModel)];
    try {
      let lastError = 'No model was able to generate a commit message.';
      for (let index = 0; index < candidates.length; index += 1) {
        const model = candidates[index];
        const response: ProxyResponse = await requestChatCompletion(apiKey, model, [{ role: 'user', content: buildPrompt(changes) }], SYSTEM_CONTEXT);
        const providerError = response.body.error?.message ?? `HTTP ${response.status}`;
        const content = response.body.choices?.[0]?.message?.content?.trim();
        if (response.status >= 200 && response.status < 300 && content) {
          setMessage(content.replace(/^```(?:text|markdown)?\s*|\s*```$/gi, '').trim());
          setSelectedModel(model);
          if (index > 0) setFallbackNote(`Primary model limit reached. Continued automatically with ${model}.`);
          toast.success('Commit message generated');
          return;
        }
        lastError = providerError;
        if (!isLimitError(response.status, providerError)) break;
      }
      setError(lastError);
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value));
    } finally {
      setGenerating(false);
    }
  };

  const changeSummary = useMemo(() => changes.map((change) => `${change.status || 'M '} ${change.path}`).join('\n'), [changes]);

  return <div className="mx-auto min-h-full max-w-7xl pb-16 text-[var(--text-primary)]">
    <header className="border-b border-white/[0.08] pb-8">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">Git Workspace</p>
      <div className="mt-3 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div><h1 className="font-serif text-4xl font-medium tracking-tight text-white md:text-5xl">Commit messages with context</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-white/45">Select a repository, inspect only its modified and new files, then let OpenRouter write a clean Conventional Commit message.</p></div>
        <div className="flex items-center gap-2 text-xs text-white/35"><GitBranch size={14} className="text-emerald-400" /> Changes stay local until you copy them</div>
      </div>
    </header>
    <main className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <ToolCard>
        <ToolTitle icon={Sparkles} text="Git Commit Generator" subtitle="Only current Git changes are sent to the selected AI model; unchanged files are never included." />
        <div className="mt-6 flex flex-wrap items-center gap-3"><button type="button" onClick={() => void pickFolder()} className="inline-flex items-center gap-2 border border-[var(--accent)] bg-[var(--accent-glow)] px-4 py-2.5 text-sm font-semibold text-[var(--accent)] hover:bg-[var(--accent-dim)]"><FolderOpen size={16} /> Select Git folder</button>{folderPath && <button type="button" onClick={() => void refreshChanges()} className="inline-flex items-center gap-2 border border-white/10 px-4 py-2.5 text-sm text-white/60 hover:text-white"><RefreshCw size={15} className={loadingChanges ? 'animate-spin' : ''} /> Refresh changes</button>}</div>
        {folderPath && <p className="mt-4 truncate border border-white/[0.08] bg-black/20 px-4 py-3 font-mono text-xs text-white/55" title={folderPath}>{folderPath}</p>}
        {loadingChanges && <div className="mt-6 flex items-center gap-2 text-sm text-white/45"><Loader2 size={16} className="animate-spin" /> Reading Git changes...</div>}
        {!loadingChanges && folderPath && !changes.length && !error && <div className="mt-6 border border-dashed border-white/10 p-8 text-center text-sm text-white/40">Working tree is clean.</div>}
        {changes.length > 0 && <div className="mt-6"><div className="mb-2 flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">Changed files ({changes.length})</span><span className="text-xs text-emerald-300/70">Only these diffs are analyzed</span></div><div className="max-h-72 overflow-auto border border-white/[0.08] bg-black/20">{changes.map((change) => <div key={`${change.status}-${change.path}`} className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3 last:border-0"><FileCode2 size={15} className="shrink-0 text-[var(--accent)]" /><span className="w-8 shrink-0 font-mono text-xs text-emerald-300/70">{change.status || 'M'}</span><span className="truncate font-mono text-xs text-white/70">{change.path}</span></div>)}</div></div>}
        {error && <div className="mt-6 flex items-start gap-2 border border-red-400/20 bg-red-400/[0.06] p-4 text-sm text-red-200"><AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}</div>}
      </ToolCard>
      <ToolCard>
        <ToolTitle icon={GitBranch} text="Generate" subtitle="Choose a model and generate a ready-to-copy commit message." />
        <label className="mt-6 block text-xs text-white/50">AI model<select value={selectedModel} onChange={(event) => setSelectedModel(event.target.value)} className="mt-2 w-full border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none" disabled={modelsLoading}>{models.map((model) => <option key={model.id} value={model.id}>{model.name ?? model.id}</option>)}</select></label>
        <button type="button" onClick={() => void generateCommit()} disabled={generating || !changes.length} className="mt-5 flex w-full items-center justify-center gap-2 bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40">{generating ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />} {generating ? 'Analyzing changes...' : 'Generate commit message'}</button>
        <button type="button" onClick={() => setShowKeyModal(true)} className="mt-4 inline-flex items-center gap-2 text-xs text-white/45 hover:text-white"><KeyRound size={14} /> {apiKey ? 'Change OpenRouter API key' : 'Add OpenRouter API key'}</button>
        {fallbackNote && <p className="mt-4 border-l-2 border-amber-300/70 pl-3 text-xs leading-5 text-amber-200/80">{fallbackNote}</p>}
        {message && <div className="mt-6"><div className="mb-2 flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">Generated message</span><button type="button" onClick={() => { void navigator.clipboard.writeText(message); toast.success('Commit message copied'); }} className="inline-flex items-center gap-1 text-xs text-white/45 hover:text-white"><Check size={13} /> Copy</button></div><textarea readOnly value={message} className="h-48 w-full resize-y border border-white/[0.08] bg-[#0d0d0a] p-4 font-mono text-xs leading-6 text-emerald-100/80 outline-none" /></div>}
      </ToolCard>
    </main>
    {changeSummary && <p className="sr-only">{changeSummary}</p>}
    {showKeyModal && <ApiKeyModal draftKey={draftKey} onDraftKeyChange={setDraftKey} onSave={() => void saveKey()} onDismiss={() => setShowKeyModal(false)} />}
  </div>;
}
