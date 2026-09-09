import { useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { readDir, readTextFile } from '@tauri-apps/plugin-fs';
import { Check, FolderOpen, Loader2, FileText, Sparkles, KeyRound, RotateCcw, X } from 'lucide-react';
import { Button } from '@/shared/ui';
import { useAuth } from '@/features/auth/AuthContext';
import { getApiKey, saveApiKey } from '../storage';
import { fetchOpenRouterModels, getShortModelName } from '../api/openRouterApi';
import { DEFAULT_MODELS, type OpenRouterModel } from '../types';
import type { ProxyResponse, ToolCall } from '../types';
import ApiKeyModal from '../components/ApiKeyModal';
import ChatComposer from '../components/ChatComposer';
import MarkdownContent from '../components/MarkdownContent';
import { buildCodebaseAgentContext } from '../context/projectContext';

// ---------- Config ----------

const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', 'target',
  'coverage', '.turbo', 'out', '.vercel', '.cache',
]);

const IGNORE_FILE_PATTERN = /\.(lock|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|mp4|zip|exe)$/i;

const MAX_TREE_DEPTH = 6;
const MAX_TREE_ENTRIES = 1500;
const MAX_FILE_CHARS = 24000;
const MAX_ITERATIONS = 15;

// ---------- Types ----------

type AgentMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
};

type HistoryTurn = { role: 'user' | 'assistant'; content: string };
type ToolApproval = { paths: string[] };

type LogEntry =
  | { type: 'reading'; path: string }
  | { type: 'read-ok'; path: string; chars: number }
  | { type: 'read-error'; path: string; error: string }
  | { type: 'thinking' };

const READ_FILE_TOOL = {
  type: 'function',
  function: {
    name: 'read_file',
    description:
      'Reads one file inside the selected project and returns its text content. Only relative paths are allowed, such as src/auth/login.ts.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'A relative path from the project root, such as src/auth/login.ts',
        },
      },
      required: ['path'],
    },
  },
} as const;

// ---------- Folder scanning ----------

async function buildFolderTree(rootPath: string): Promise<string> {
  const lines: string[] = [];
  let count = 0;

  async function walk(currentPath: string, relPath: string, depth: number) {
    if (depth > MAX_TREE_DEPTH || count >= MAX_TREE_ENTRIES) return;
    let entries;
    try {
      entries = await readDir(currentPath);
    } catch {
      return;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      if (count >= MAX_TREE_ENTRIES) return;
      if (entry.name.startsWith('.') && entry.name !== '.env.example') continue;

      const childRel = relPath ? `${relPath}/${entry.name}` : entry.name;
      const childAbs = `${currentPath}/${entry.name}`;

      if (entry.isDirectory) {
        if (IGNORE_DIRS.has(entry.name)) continue;
        lines.push(`${'  '.repeat(depth)}${childRel}/`);
        count += 1;
        await walk(childAbs, childRel, depth + 1);
      } else {
        if (IGNORE_FILE_PATTERN.test(entry.name)) continue;
        lines.push(`${'  '.repeat(depth)}${childRel}`);
        count += 1;
      }
    }
  }

  await walk(rootPath, '', 0);
  return lines.join('\n');
}

async function readProjectFile(rootPath: string, relativePath: string): Promise<string> {
  if (relativePath.includes('..') || relativePath.startsWith('/')) {
    throw new Error('Path is not allowed');
  }
  const fullPath = `${rootPath}/${relativePath}`;
  const content = await readTextFile(fullPath);
  return content.length > MAX_FILE_CHARS
      ? `${content.slice(0, MAX_FILE_CHARS)}\n\n...(file truncated; showing ${MAX_FILE_CHARS} of ${content.length} characters)...`
    : content;
}

// ---------- OpenRouter call ----------

async function requestAgentCompletion(apiKey: string, model: string, messages: AgentMessage[]) {
  return invoke<ProxyResponse>('proxy_request', {
    method: 'POST',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://yolnoma.app',
      'X-Title': 'Yolnoma Codebase Agent',
    },
    body: {
      model,
      max_tokens: 2000,
      messages,
      tools: [READ_FILE_TOOL],
      tool_choice: 'auto',
    },
  });
}

// ---------- Component ----------

export default function CodebaseAgentPage() {
  const { user } = useAuth();

  // API key
  const [apiKey, setApiKey] = useState('');
  const [draftKey, setDraftKey] = useState('');
  const [apiKeyReady, setApiKeyReady] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);

  // Models
  const [models, setModels] = useState<OpenRouterModel[]>(DEFAULT_MODELS);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState('');
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODELS[0].id);

  // Folder
  const [folderPath, setFolderPath] = useState('');
  const [tree, setTree] = useState('');
  const [scanning, setScanning] = useState(false);

  // Conversation (persists across prompts, resets on folder change / manual reset)
  const [history, setHistory] = useState<HistoryTurn[]>([]);
  const messagesRef = useRef<AgentMessage[]>([]);

  // Agent run
  const [prompt, setPrompt] = useState('');
  const [log, setLog] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingApproval, setPendingApproval] = useState<ToolApproval | null>(null);
  const approvalResolver = useRef<((allowed: boolean) => void) | null>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const historyEndRef = useRef<HTMLDivElement>(null);

  // Load API key on mount (same pattern as AiChatPage)
  useEffect(() => {
    setApiKeyReady(false);
    getApiKey(user?.id ?? '').then((key) => {
      setApiKey(key ?? '');
      setDraftKey(key ?? '');
      setApiKeyReady(true);
    });
  }, [user?.id]);

  // Fetch models once we know the key state (works with or without a key)
  useEffect(() => {
    if (!apiKeyReady) return;
    let cancelled = false;
    setModelsLoading(true);
    setModelsError('');
    fetchOpenRouterModels(apiKey)
      .then(({ response, models: fetchedModels }) => {
        if (cancelled) return;
        if (response.status < 200 || response.status >= 300 || !fetchedModels.length) {
          setModelsError(
            response.body?.error?.message ?? `Model ro'yxati kelmadi (HTTP ${response.status})`,
          );
          return;
        }
        const featuredIds = new Set(DEFAULT_MODELS.map((m) => m.id));
        const ordered = [
          ...fetchedModels.filter((m) => featuredIds.has(m.id)),
          ...fetchedModels.filter((m) => !featuredIds.has(m.id)),
        ];
        setModels(ordered);
        setSelectedModel((current) =>
          ordered.some((m) => m.id === current) ? current : ordered[0].id,
        );
      })
      .catch((fetchError) => {
        if (!cancelled) {
          setModelsError(
            fetchError instanceof Error ? fetchError.message : "Model ro'yxatini olishda xato",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setModelsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiKey, apiKeyReady]);

  const selectedModelLabel = useMemo(
    () => models.find((m) => m.id === selectedModel)?.name ?? selectedModel,
    [models, selectedModel],
  );

  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [history, loading]);

  const resetConversation = (currentTree: string) => {
    setHistory([]);
    setLog([]);
    setError('');
    messagesRef.current = currentTree
      ? [{ role: 'system', content: buildCodebaseAgentContext(currentTree) }]
      : [];
  };

  const pickFolder = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (!selected || typeof selected !== 'string') return;
    setFolderPath(selected);
    setTree('');
    resetConversation('');
    setScanning(true);
    try {
      const scanned = await buildFolderTree(selected);
      setTree(scanned);
      resetConversation(scanned);
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : 'The project folder could not be read');
    } finally {
      setScanning(false);
    }
  };

  const runAgent = async (event: React.SyntheticEvent) => {
    event.preventDefault();
    const text = prompt.trim();
    if (!text || loading) return;

    if (!apiKeyReady) {
      setError('The API key is still loading. Please wait a moment.');
      return;
    }
    if (!apiKey) {
      setError('No OpenRouter API key found. Add one using the API key panel.');
      return;
    }
    if (!folderPath || !tree || !messagesRef.current.length) {
      setError('Select a project folder before sending a request.');
      return;
    }

    setLoading(true);
    setError('');
    setLog([]);
    setPrompt('');
    if (promptRef.current) promptRef.current.style.height = '';

    messagesRef.current.push({ role: 'user', content: text });
    setHistory((current) => [...current, { role: 'user', content: text }]);

    try {
      for (let i = 0; i < MAX_ITERATIONS; i += 1) {
        setLog((current) => [...current, { type: 'thinking' }]);
        const response = await requestAgentCompletion(apiKey, selectedModel, messagesRef.current);

        if (response.status < 200 || response.status >= 300) {
          console.error('OpenRouter error body:', JSON.stringify(response.body, null, 2));
          const providerMsg = response.body?.error?.message ?? `HTTP ${response.status}`;
          const metadata = response.body?.error?.metadata?.raw;
          throw new Error(metadata ? `${providerMsg} — ${metadata}` : providerMsg);
        }

        const message = response.body.choices?.[0]?.message;
        if (!message) throw new Error('The model returned no response');

        messagesRef.current.push({
          role: 'assistant',
          content: message.content ?? '',
          tool_calls: message.tool_calls,
        });

        if (!message.tool_calls?.length) {
          setHistory((current) => [...current, { role: 'assistant', content: message.content ?? '' }]);
          setLoading(false);
          return;
        }

        const approved = await new Promise<boolean>((resolve) => {
          setPendingApproval({
            paths: message.tool_calls?.map((call) => {
              try {
                return JSON.parse(call.function.arguments).path ?? 'unknown file';
              } catch {
                return 'unknown file';
              }
            }) ?? [],
          });
          approvalResolver.current = resolve;
        });

        if (!approved) {
          for (const call of message.tool_calls) {
            messagesRef.current.push({
              role: 'tool',
              tool_call_id: call.id,
              content: 'Permission denied by the user. Do not read this file.',
            });
          }
          continue;
        }

        for (const call of message.tool_calls) {
          let relPath = '';
          try {
            relPath = JSON.parse(call.function.arguments).path ?? '';
          } catch {
            // ignore malformed args
          }
          setLog((current) => [...current, { type: 'reading', path: relPath }]);

          try {
            const content = await readProjectFile(folderPath, relPath);
            setLog((current) => [...current, { type: 'read-ok', path: relPath, chars: content.length }]);
            messagesRef.current.push({ role: 'tool', tool_call_id: call.id, content });
          } catch (fileError) {
            const errMsg = fileError instanceof Error ? fileError.message : 'The file could not be read';
            setLog((current) => [...current, { type: 'read-error', path: relPath, error: errMsg }]);
            messagesRef.current.push({ role: 'tool', tool_call_id: call.id, content: `ERROR: ${errMsg}` });
          }
        }
      }

      throw new Error('The agent reached its step limit.');
    } catch (agentError) {
      setError(agentError instanceof Error ? agentError.message : 'An unknown error occurred.');
      // Remove the last user message so the next attempt starts cleanly.
      const lastIdx = messagesRef.current.length - 1;
      if (messagesRef.current[lastIdx]?.role === 'user') {
        messagesRef.current = messagesRef.current.slice(0, lastIdx);
      }
    } finally {
      setLoading(false);
    }
  };

  const resolveApproval = (allowed: boolean) => {
    setPendingApproval(null);
    approvalResolver.current?.(allowed);
    approvalResolver.current = null;
  };

  const saveAgentApiKey = async () => {
    const cleanKey = draftKey.trim();
    await saveApiKey(user?.id ?? '', cleanKey);
    setApiKey(cleanKey);
    setShowKeyModal(false);
    setError('');
  };

  return (
    <div className="mx-auto grid h-full min-h-0 w-full max-w-none gap-5 overflow-hidden pb-4 lg:grid-cols-[300px_minmax(0,1fr)]">
      {/* Sidebar */}
      <aside className="flex flex-col gap-4 overflow-hidden">
        {/* API key status */}
        <section className="rounded-2xl border border-white/[0.08] bg-[#111109] p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              <KeyRound size={14} /> API key
            </div>
            <span
              className={`h-2 w-2 rounded-full ${
                !apiKeyReady ? 'bg-white/20' : apiKey ? 'bg-emerald-400' : 'bg-amber-300'
              }`}
            />
          </div>
          <p className="mt-2 text-[11px] text-white/40">
            {!apiKeyReady
              ? 'Checking...'
              : apiKey
                ? 'Connected (shared with AI Chat)'
                : 'Not found — add an API key here'}
          </p>
          <Button
            size="sm"
            variant={apiKey ? 'ghost' : 'primary'}
            className="mt-3 w-full justify-center"
            onClick={() => setShowKeyModal(true)}
          >
            <KeyRound size={14} /> {apiKey ? 'Change API key' : 'Add API key'}
          </Button>
        </section>

        {/* Model select */}
        <section className="rounded-2xl border border-white/[0.08] bg-[#111109] p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="text-xs font-semibold text-white">Model</div>
            {modelsLoading && <Loader2 size={12} className="animate-spin text-white/40" />}
          </div>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            disabled={modelsLoading || !models.length}
            className="w-full rounded-lg border border-white/[0.08] bg-black/20 px-2 py-2 text-xs text-white focus:outline-none"
          >
            {models.map((m) => (
              <option key={m.id} value={m.id} className="bg-[#111109]">
                {getShortModelName(m)}
              </option>
            ))}
          </select>
          {modelsError && (
            <p className="mt-2 text-[11px] text-amber-300/80">
              {modelsError} — using the default model list
            </p>
          )}
          <p className="mt-2 truncate text-[10px] text-white/25" title={selectedModel}>
            {selectedModelLabel}
          </p>
        </section>

        {/* Folder */}
        <section className="rounded-2xl border border-white/[0.08] bg-[#111109] p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-white">
            <FolderOpen size={14} /> Project folder
          </div>
          <Button size="sm" variant="primary" className="w-full justify-center" onClick={pickFolder}>
            <FolderOpen size={15} /> Choose folder
          </Button>
          {folderPath && (
            <p className="mt-3 truncate text-xs text-white/40" title={folderPath}>
              {folderPath}
            </p>
          )}
          {scanning && (
            <p className="mt-2 flex items-center gap-2 text-xs text-white/40">
              <Loader2 size={12} className="animate-spin" /> Scanning project structure...
            </p>
          )}
          {tree && !scanning && (
            <p className="mt-2 text-xs text-emerald-300/70">
              {tree.split('\n').length} entries found
            </p>
          )}
        </section>

        {/* Activity log */}
        <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-white/[0.08] bg-[#111109] p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-white">
            <Sparkles size={14} /> Agent activity
          </div>
          <div className="flex-1 space-y-1.5 overflow-y-auto pr-1 text-xs">
            {log.length === 0 && (
              <p className="text-white/30">Send a prompt to see the agent activity here.</p>
            )}
            {log.map((entry, i) => {
              if (entry.type === 'thinking')
                return (
                  <p key={i} className="flex items-center gap-1.5 text-white/40">
                    <Loader2 size={11} className="animate-spin" /> thinking...
                  </p>
                );
              if (entry.type === 'reading')
                return (
                  <p key={i} className="flex items-center gap-1.5 text-amber-200/70">
                    <FileText size={11} /> reading: {entry.path}
                  </p>
                );
              if (entry.type === 'read-ok')
                return (
                  <p key={i} className="flex items-center gap-1.5 text-emerald-300/70">
                    <FileText size={11} /> read: {entry.path} ({entry.chars} chars)
                  </p>
                );
              return (
                <p key={i} className="flex items-center gap-1.5 text-red-300/70">
                  <FileText size={11} /> error: {entry.path} — {entry.error}
                </p>
              );
            })}
          </div>
        </section>
      </aside>

      {/* Main */}
      <main className="flex h-[calc(100vh-150px)] min-h-0 flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111109]">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.07] px-5 py-3">
          <p className="text-xs text-white/40">
            {history.length ? `${history.length} messages` : 'No conversation started'}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => resetConversation(tree)}
            disabled={!history.length || loading}
          >
            <RotateCcw size={14} /> New conversation
          </Button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {!history.length && !loading && (
            <p className="text-sm text-white/30">
              Choose a project folder and ask a question — for example, "What issues exist in auth?"
            </p>
          )}
          {history.map((turn, i) => (
            <div
              key={i}
              className={
                turn.role === 'user'
                  ? 'ml-auto max-w-[85%] rounded-2xl bg-[var(--accent-dim)] px-4 py-2.5 text-sm text-white'
                  : 'max-w-[95%] whitespace-pre-wrap text-sm leading-relaxed text-white/85'
              }
            >
              {turn.role === 'assistant' ? (
                <MarkdownContent content={turn.content} />
              ) : (
                turn.content
              )}
            </div>
          ))}
          {loading && (
            <p className="flex items-center gap-2 text-xs text-white/35">
              <Loader2 size={13} className="animate-spin" /> analyzing...
            </p>
          )}
          {error && (
            <div className="rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs text-red-200">
              {error}
            </div>
          )}
          <div ref={historyEndRef} />
        </div>

        {pendingApproval && (
          <section className="mx-4 mb-3 shrink-0 rounded-2xl border border-amber-300/25 bg-amber-300/[0.08] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-amber-100">The agent requests file access</p>
                <p className="mt-1 text-xs leading-relaxed text-amber-100/65">
                  To answer your question, Codebase Agent wants to read the following project file(s). Review the paths and allow access to continue.
                </p>
                <ul className="mt-2 max-h-20 overflow-y-auto space-y-1 text-xs font-mono text-amber-100/80">
                  {pendingApproval.paths.map((path, index) => <li key={`${path}-${index}`}>{path}</li>)}
                </ul>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button type="button" size="sm" variant="ghost" onClick={() => resolveApproval(false)}>
                  <X size={14} /> Deny
                </Button>
                <Button type="button" size="sm" onClick={() => resolveApproval(true)}>
                  <Check size={14} /> Allow
                </Button>
              </div>
            </div>
          </section>
        )}
        <ChatComposer
          prompt={prompt}
          loading={loading}
          promptInputRef={promptRef}
          onPromptChange={setPrompt}
          onSubmit={runAgent}
        />
      </main>
      {showKeyModal && (
        <ApiKeyModal
          draftKey={draftKey}
          onDraftKeyChange={setDraftKey}
          onSave={() => void saveAgentApiKey()}
          onDismiss={() => setShowKeyModal(false)}
        />
      )}
    </div>
  );
}
