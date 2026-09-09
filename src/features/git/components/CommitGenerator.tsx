import { useEffect, useMemo, useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { AlertCircle, Check, FileCode2, FolderOpen, KeyRound, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import ApiKeyModal from '@/features/ai/components/ApiKeyModal';
import { getApiKey, saveApiKey } from '@/features/ai/storage';
import { fetchOpenRouterModels, isLimitError, requestChatCompletion } from '@/features/ai/api/openRouterApi';
import { DEFAULT_MODELS, type OpenRouterModel, type ProxyResponse } from '@/features/ai/types';
import { toast } from '@/shared/ui/Toast';
import { ToolCard, ToolTitle } from '@/features/developer-tools/components/ToolShell';

type GitChange = { path: string; status: string; diff: string };
type CommitVariant = { title: string; message: string };
const MAX_CONTEXT_CHARS = 100_000;
const VARIANT_TITLES = ['Overall summary', 'Technical detail', 'User-facing impact', 'Minimal clean version'];
const SYSTEM_CONTEXT = `You are a senior Git maintainer. Analyze only the supplied Git working-tree changes and create exactly four distinct Conventional Commit message variants. Use feat, fix, perf, refactor, docs, test, build, or chore. Every subject must be under 72 characters and include a tasteful, relevant emoji; vary the emoji and make the set feel rich but professional (examples: ✨ 🎨 🐛 🚀 🧹 ⚡ 📝 🔧 🧭). Each variant must have a subject followed by 2-4 concise bullet points. Return only four blocks in this exact format, with no Markdown code fence:
[OVERALL]
<commit message>
[TECHNICAL]
<commit message>
[IMPACT]
<commit message>
[MINIMAL]
<commit message>`;

function buildPrompt(changes: GitChange[]) {
  let used = 0;
  const sections: string[] = [];
  for (const change of changes) {
    const section = `FILE: ${change.path}\nSTATUS: ${change.status}\nDIFF:\n${change.diff}`;
    if (used + section.length > MAX_CONTEXT_CHARS) break;
    sections.push(section);
    used += section.length;
  }
  return `Write four commit message variants from only these current Git changes. Do not infer unlisted work.\n\n${sections.join('\n\n---\n\n')}`;
}

function parseVariants(raw: string): CommitVariant[] {
  const cleaned = raw.replace(/^```(?:text|markdown)?\s*|\s*```$/gi, '').trim();
  const blocks = cleaned.split(/\n\s*\[(?:OVERALL|TECHNICAL|IMPACT|MINIMAL)\]\s*\n?/i).map((block) => block.trim()).filter(Boolean);
  const variants = blocks.slice(0, 4).map((message, index) => ({ title: VARIANT_TITLES[index], message }));
  if (variants.length === 4) return variants;
  return [{ title: VARIANT_TITLES[0], message: cleaned }];
}

export default function CommitGenerator({ folderPath, changes, onFolderChange, onRefresh }: { folderPath: string; changes: GitChange[]; onFolderChange: (path: string) => void; onRefresh: (path?: string) => Promise<void> }) {
  const { user } = useAuth();
  const [loadingChanges, setLoadingChanges] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [variants, setVariants] = useState<CommitVariant[]>([]);
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
    getApiKey(user?.id ?? '').then((key) => { setApiKey(key ?? ''); setDraftKey(key ?? ''); setApiKeyReady(true); });
  }, [user?.id]);
  useEffect(() => {
    if (!apiKeyReady) return;
    let cancelled = false;
    setModelsLoading(true);
    fetchOpenRouterModels(apiKey).then(({ response, models: available }) => {
      if (cancelled || response.status < 200 || response.status >= 300 || !available.length) return;
      const ordered = [...available.filter((model) => DEFAULT_MODELS.some((fallback) => fallback.id === model.id)), ...available.filter((model) => !DEFAULT_MODELS.some((fallback) => fallback.id === model.id))];
      setModels(ordered); setSelectedModel((current) => ordered.some((model) => model.id === current) ? current : ordered[0].id);
    }).catch(() => { /* Built-in models remain available. */ }).finally(() => { if (!cancelled) setModelsLoading(false); });
    return () => { cancelled = true; };
  }, [apiKey, apiKeyReady]);

  const pickFolder = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (!selected || typeof selected !== 'string') return;
    onFolderChange(selected);
    setLoadingChanges(true);
    await onRefresh(selected);
    setLoadingChanges(false);
  };
  const saveKey = async () => {
    const cleanKey = draftKey.trim();
    if (!cleanKey) return;
    await saveApiKey(user?.id ?? '', cleanKey); setApiKey(cleanKey); setShowKeyModal(false); toast.success('OpenRouter API key saved securely');
  };
  const generateCommit = async () => {
    if (!apiKey) { setShowKeyModal(true); return; }
    if (!changes.length) { setError('Select a Git folder with modified or new files first.'); return; }
    setGenerating(true); setError(''); setFallbackNote(''); setVariants([]);
    const candidates = [selectedModel, ...models.map((model) => model.id).filter((id) => id !== selectedModel)];
    try {
      let lastError = 'No model was able to generate commit variants.';
      for (let index = 0; index < candidates.length; index += 1) {
        const model = candidates[index];
        const response: ProxyResponse = await requestChatCompletion(apiKey, model, [{ role: 'user', content: buildPrompt(changes) }], SYSTEM_CONTEXT);
        const providerError = response.body.error?.message ?? `HTTP ${response.status}`;
        const content = response.body.choices?.[0]?.message?.content?.trim();
        if (response.status >= 200 && response.status < 300 && content) {
          setVariants(parseVariants(content)); setSelectedModel(model);
          if (index > 0) setFallbackNote(`Primary model limit reached. Continued automatically with ${model}.`);
          toast.success('4 commit variants generated'); return;
        }
        lastError = providerError;
        if (!isLimitError(response.status, providerError)) break;
      }
      setError(lastError);
    } catch (value) { setError(value instanceof Error ? value.message : String(value)); }
    finally { setGenerating(false); }
  };
  const copyMessage = async (message: string) => { await navigator.clipboard.writeText(message); toast.success('Commit message copied'); };
  const changedFiles = useMemo(() => changes.map((change) => `${change.status || 'M '} ${change.path}`).join('\n'), [changes]);

  return <ToolCard>
    <ToolTitle icon={Sparkles} text="Git Commit Generator" subtitle="Generate four strong commit options from only the current modified and new files." />
    <div className="mt-6 flex flex-wrap items-center gap-3"><button type="button" onClick={() => void pickFolder()} className="inline-flex items-center gap-2 border border-[var(--accent)] bg-[var(--accent-glow)] px-4 py-2.5 text-sm font-semibold text-[var(--accent)] hover:bg-[var(--accent-dim)]"><FolderOpen size={16} /> Select Git folder</button>{folderPath && <button type="button" onClick={() => { setLoadingChanges(true); void onRefresh().finally(() => setLoadingChanges(false)); }} className="inline-flex items-center gap-2 border border-white/10 px-4 py-2.5 text-sm text-white/60 hover:text-white"><RefreshCw size={15} className={loadingChanges ? 'animate-spin' : ''} /> Refresh changes</button>}</div>
    {folderPath && <p className="mt-4 truncate border border-white/[0.08] bg-black/20 px-4 py-3 font-mono text-xs text-white/55" title={folderPath}>{folderPath}</p>}
    {loadingChanges && <div className="mt-6 flex items-center gap-2 text-sm text-white/45"><Loader2 size={16} className="animate-spin" /> Reading Git changes...</div>}
    {!loadingChanges && folderPath && !changes.length && !error && <div className="mt-6 border border-dashed border-white/10 p-8 text-center text-sm text-white/40">Working tree is clean.</div>}
    {changes.length > 0 && <div className="mt-6"><div className="mb-2 flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">Changed files ({changes.length})</span><span className="text-xs text-emerald-300/70">Only these diffs are analyzed</span></div><div className="max-h-52 overflow-auto border border-white/[0.08] bg-black/20">{changes.map((change) => <div key={`${change.status}-${change.path}`} className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3 last:border-0"><FileCode2 size={15} className="shrink-0 text-[var(--accent)]" /><span className="w-8 shrink-0 font-mono text-xs text-emerald-300/70">{change.status || 'M'}</span><span className="truncate font-mono text-xs text-white/70">{change.path}</span></div>)}</div></div>}
    {error && <div className="mt-6 flex items-start gap-2 border border-red-400/20 bg-red-400/[0.06] p-4 text-sm text-red-200"><AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}</div>}
    <div className="mt-8 grid gap-4 border-t border-white/[0.08] pt-6 md:grid-cols-[minmax(0,1fr)_220px]"><div><p className="text-xs text-white/45">The generator creates four perspectives: broad summary, technical detail, user impact, and a minimal clean version.</p>{fallbackNote && <p className="mt-3 border-l-2 border-amber-300/70 pl-3 text-xs leading-5 text-amber-200/80">{fallbackNote}</p>}</div><div><label className="block text-xs text-white/50">AI model<select value={selectedModel} onChange={(event) => setSelectedModel(event.target.value)} className="mt-2 w-full border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none" disabled={modelsLoading}>{models.map((model) => <option key={model.id} value={model.id}>{model.name ?? model.id}</option>)}</select></label></div></div>
    <div className="mt-5 flex flex-wrap items-center gap-4"><button type="button" onClick={() => void generateCommit()} disabled={generating || !changes.length} className="inline-flex items-center gap-2 bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40">{generating ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />} {generating ? 'Generating 4 variants...' : 'Generate 4 commit variants'}</button><button type="button" onClick={() => setShowKeyModal(true)} className="inline-flex items-center gap-2 text-xs text-white/45 hover:text-white"><KeyRound size={14} /> {apiKey ? 'Change API key' : 'Add OpenRouter API key'}</button></div>
    {variants.length > 0 && <div className="mt-7 grid gap-4 lg:grid-cols-2">{variants.map((variant) => <article key={variant.title} className="border border-white/[0.08] bg-black/20 p-5"><div className="mb-3 flex items-center justify-between gap-3"><span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">{variant.title}</span><button type="button" onClick={() => void copyMessage(variant.message)} className="inline-flex items-center gap-1 text-xs text-white/45 hover:text-white"><Check size={13} /> Copy</button></div><textarea readOnly value={variant.message} className="min-h-44 w-full resize-y border border-white/[0.08] bg-[#0d0d0a] p-4 font-mono text-xs leading-6 text-emerald-100/80 outline-none" /></article>)}</div>}
    <p className="sr-only">{changedFiles}</p>
    {showKeyModal && <ApiKeyModal draftKey={draftKey} onDraftKeyChange={setDraftKey} onSave={() => void saveKey()} onDismiss={() => setShowKeyModal(false)} />}
  </ToolCard>;
}
