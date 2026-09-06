import { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, KeyRound, Settings2, ShieldCheck, Trash2 } from 'lucide-react';
import { Button } from '@/shared/ui';
import { useAuth } from '@/features/auth/AuthContext';
import {
  fetchOpenRouterModels,
  getShortModelName,
  isLimitError,
  requestChatCompletion,
} from '../api/openRouterApi';
import {
  DEFAULT_MODELS,
  type ChatMessage,
  type ModelCategory,
  type OpenRouterModel,
} from '../types';
import ChatComposer from '../components/ChatComposer';
import ChatMessages from '../components/ChatMessages';
import ApiKeyModal from '../components/ApiKeyModal';
import { buildProjectContext } from '../context/projectContext';
import {
  clearLegacyAiStorage,
  getAccountStorageKeys,
  loadAccountApiKey,
  loadAccountChat,
} from '../storage';

export default function AiChatPage() {
  const { user } = useAuth();
  const [apiKey, setApiKey] = useState('');
  const [draftKey, setDraftKey] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  const [models, setModels] = useState<OpenRouterModel[]>(DEFAULT_MODELS);
  const [selectedModels, setSelectedModels] = useState<string[]>([
    DEFAULT_MODELS[0].id,
  ]);
  const [modelCategory, setModelCategory] = useState<ModelCategory>('all');
  const [modelsLoading, setModelsLoading] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeModel, setActiveModel] = useState('');
  const [limitCheckedAt, setLimitCheckedAt] = useState('');
  const [showKeyModal, setShowKeyModal] = useState(
    () =>
      !apiKey &&
      sessionStorage.getItem('yolnoma.ai-key-guide-dismissed') !== 'true',
  );
  const promptInputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    clearLegacyAiStorage();
    setStorageReady(false);
    const accountKey = loadAccountApiKey(user);
    setApiKey(accountKey);
    setDraftKey(accountKey);
    setMessages(loadAccountChat(user));
    setShowKeyModal(
      !accountKey &&
        sessionStorage.getItem('yolnoma.ai-key-guide-dismissed') !== 'true',
    );
    setStorageReady(true);
  }, [user?.id, user?.email]);

  useEffect(() => {
    if (!storageReady) return;
    localStorage.setItem(
      getAccountStorageKeys(user).chat,
      JSON.stringify(messages),
    );
  }, [messages, storageReady, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'end',
    });
  }, [loading, messages]);

  useEffect(() => {
    if (apiKey && !showKeyModal && !loading) {
      requestAnimationFrame(() => promptInputRef.current?.focus());
    }
  }, [apiKey, loading, showKeyModal]);

  useEffect(() => {
    const handleGlobalTyping = (event: KeyboardEvent) => {
      if (
        showKeyModal ||
        loading ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      )
        return;
      const target = event.target as HTMLElement | null;
      if (
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'INPUT' ||
        target?.isContentEditable
      )
        return;
      if (event.key.length !== 1) return;
      event.preventDefault();
      promptInputRef.current?.focus();
      setPrompt((current) => current + event.key);
    };

    window.addEventListener('keydown', handleGlobalTyping);
    return () => window.removeEventListener('keydown', handleGlobalTyping);
  }, [loading, showKeyModal]);

  useEffect(() => {
    let cancelled = false;
    setModelsLoading(true);
    fetchOpenRouterModels(apiKey)
      .then(({ response, models: fetchedModels }) => {
        if (
          cancelled ||
          response.status < 200 ||
          response.status >= 300 ||
          !fetchedModels.length
        )
          return;
        const featuredIds = new Set(DEFAULT_MODELS.map((model) => model.id));
        const featuredModels = fetchedModels.filter((model) =>
          featuredIds.has(model.id),
        );
        const availableModels = [
          ...featuredModels,
          ...fetchedModels.filter((model) => !featuredIds.has(model.id)),
        ];
        setModels(availableModels);
        setSelectedModels((current) => {
          const available = new Set(availableModels.map((model) => model.id));
          const kept = current.filter((modelId) => available.has(modelId));
          return kept.length
            ? [kept[0]]
            : availableModels.slice(0, 1).map((model) => model.id);
        });
      })
      .catch(() => {
        // Keep the built-in models available when the catalog request fails.
      })
      .finally(() => {
        if (!cancelled) setModelsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  const selectedModelLabels = useMemo(
    () =>
      selectedModels.map(
        (id) => models.find((model) => model.id === id)?.name ?? id,
      ),
    [models, selectedModels],
  );

  const visibleModels = useMemo(() => {
    if (modelCategory === 'all') return models;
    return models.filter((model) => {
      const isFree =
        Number(model.pricing?.prompt ?? 1) === 0 &&
        Number(model.pricing?.completion ?? 1) === 0;
      return modelCategory === 'free' ? isFree : !isFree;
    });
  }, [modelCategory, models]);

  const saveKey = () => {
    const cleanKey = draftKey.trim();
    if (cleanKey) {
      localStorage.setItem(getAccountStorageKeys(user).apiKey, cleanKey);
      setApiKey(cleanKey);
      setError('');
      setShowKeyModal(false);
    } else {
      localStorage.removeItem(getAccountStorageKeys(user).apiKey);
      setApiKey('');
      setShowKeyModal(true);
    }
  };

  const dismissKeyGuide = () => {
    sessionStorage.setItem('yolnoma.ai-key-guide-dismissed', 'true');
    setShowKeyModal(false);
  };

  const toggleModel = (id: string) => {
    setSelectedModels((current) => (current[0] === id ? current : [id]));
  };

  const sendMessage = async (event: React.SyntheticEvent) => {
    event.preventDefault();
    const text = prompt.trim();
    if (!text || loading) return;
    if (!apiKey) {
      setError('Enter and save your OpenRouter API key first.');
      return;
    }

    const userMessage: ChatMessage = { role: 'user', content: text };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setPrompt('');
    if (promptInputRef.current) promptInputRef.current.style.height = '';
    requestAnimationFrame(() => promptInputRef.current?.focus());
    setError('');
    setLimitCheckedAt('');
    setLoading(true);

    try {
      for (const model of selectedModels) {
        setActiveModel(model);
        const response = await requestChatCompletion(
          apiKey,
          model,
          nextMessages,
          buildProjectContext(user),
        );
        const providerError =
          response.body.error?.message ?? `HTTP ${response.status}`;
        if (
          response.status < 200 ||
          response.status >= 300 ||
          !response.body.choices?.[0]?.message?.content
        ) {
          if (isLimitError(response.status, providerError)) continue;
          throw new Error(providerError);
        }
        setMessages((current) => [
          ...current,
          {
            role: 'assistant',
            content: response.body.choices?.[0]?.message?.content ?? '',
            model,
          },
        ]);
        return;
      }
      const checkedAt = new Date().toLocaleTimeString('uz-UZ', {
        hour: '2-digit',
        minute: '2-digit',
      });
      setLimitCheckedAt(checkedAt);
      throw new Error(
        `All selected models reached their limit. Last checked at ${checkedAt}.`,
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'An unknown error occurred.',
      );
    } finally {
      setLoading(false);
      setActiveModel('');
    }
  };

  return (
    <div className="relative mx-auto grid h-full min-h-0 w-full max-w-none gap-5 overflow-hidden pb-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <main className="order-1 flex h-[calc(100vh-150px)] min-h-0 flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111109] lg:order-1">
        {/* Header */}
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.07] px-5 py-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="shrink-0 rounded-xl bg-[var(--accent-dim)] p-2 text-[var(--accent)]">
              <Bot size={18} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">
                Yolnoma Assistant
              </p>
              <p className="truncate text-xs text-white/35">
                {selectedModelLabels.join(' → ')}
                {limitCheckedAt && (
                  <span className="text-amber-200/60">
                    {' '}
                    · limit tekshirildi {limitCheckedAt}
                  </span>
                )}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMessages([])}
            disabled={!messages.length}
          >
            <Trash2 size={15} /> Clear
          </Button>
        </header>

        {/* Messages */}
        <ChatMessages
          messages={messages}
          models={models}
          loading={loading}
          activeModel={activeModel}
          messagesEndRef={messagesEndRef}
        />

        {error && (
          <div className="mx-5 mb-3 shrink-0 rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs text-red-200">
            {error}
          </div>
        )}

        {/* Input */}
        <ChatComposer
          prompt={prompt}
          loading={loading}
          promptInputRef={promptInputRef}
          onPromptChange={setPrompt}
          onSubmit={sendMessage}
        />
      </main>

      {/* Sidebar */}
      <aside className="order-2 flex flex-col gap-4 lg:order-2">
        <section className="rounded-2xl border border-white/[0.08] bg-[#111109] p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Settings2 size={16} /> Models
            </div>
            <span className="text-[10px] uppercase tracking-wider text-white/30">
              Choose one
            </span>
          </div>
          <div className="mb-4 grid grid-cols-3 gap-1 rounded-xl border border-white/[0.06] bg-black/10 p-1">
            {(['all', 'free', 'paid'] as ModelCategory[]).map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setModelCategory(category)}
                className={`rounded-lg px-2 py-2 text-[11px] font-semibold capitalize transition-colors ${modelCategory === category ? 'bg-[var(--accent-dim)] text-[var(--accent)]' : 'text-white/40 hover:text-white/75'}`}
              >
                {category}
              </button>
            ))}
          </div>
          <div className="flex max-h-[315px] flex-col gap-2 overflow-y-auto pr-1">
            {modelsLoading &&
              Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="h-10 shrink-0 animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.03]"
                />
              ))}
            {!modelsLoading && !visibleModels.length && (
              <p className="text-xs text-white/40">
                No models in this category.
              </p>
            )}
            {!modelsLoading &&
              visibleModels.map((model) => (
                <label
                  key={model.id}
                  title={model.id}
                  className={`flex h-10 min-w-0 shrink-0 cursor-pointer items-center gap-2 rounded-xl border px-3 transition-colors ${selectedModels.includes(model.id) ? 'border-[var(--accent-border)] bg-[var(--accent-glow)] text-white' : 'border-white/[0.06] text-white/55 hover:border-white/[0.14] hover:text-white/80'}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedModels.includes(model.id)}
                    onChange={() => toggleModel(model.id)}
                    className="sr-only"
                  />
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${selectedModels.includes(model.id) ? 'bg-[var(--accent)]' : 'bg-white/20'}`}
                  />
                  <span className="min-w-0 truncate text-xs font-medium">
                    {getShortModelName(model)}
                  </span>
                </label>
              ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/[0.08] bg-[#111109] p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <KeyRound size={16} /> API key
            </div>
            <span
              className={`h-2 w-2 rounded-full ${apiKey ? 'bg-emerald-400' : 'bg-amber-300'}`}
            />
          </div>
          <p className="mt-3 text-xs leading-relaxed text-white/40">
            {apiKey
              ? 'Connected and ready to chat.'
              : 'Required before starting a chat.'}
          </p>
          <div className="mt-4 grid grid-cols-[8fr_2fr] gap-2">
            <Button
              className="w-full justify-center"
              size="sm"
              variant={apiKey ? 'ghost' : 'primary'}
              onClick={() => setShowKeyModal(true)}
            >
              <KeyRound size={15} /> {apiKey ? 'Change key' : 'Add API key'}
            </Button>
            <Button
              className="w-full justify-center"
              size="sm"
              variant="danger"
              iconOnly
              title="Remove API key"
              aria-label="Remove API key"
              onClick={() => {
                if (!window.confirm('Remove the saved OpenRouter API key?'))
                  return;
                localStorage.removeItem(getAccountStorageKeys(user).apiKey);
                setApiKey('');
                setDraftKey('');
                setShowKeyModal(true);
              }}
            >
              <Trash2 size={16} />
            </Button>
          </div>
          <p className="mt-3 flex gap-2 text-[11px] leading-relaxed text-white/35">
            <ShieldCheck size={14} className="shrink-0" /> Stored locally on
            this device.
          </p>
        </section>
      </aside>

      {showKeyModal && (
        <ApiKeyModal
          draftKey={draftKey}
          onDraftKeyChange={setDraftKey}
          onSave={saveKey}
          onDismiss={dismissKeyGuide}
        />
      )}
    </div>
  );
}
