import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import {
  Bot,
  KeyRound,
  Settings2,
  ShieldCheck,
  Trash2,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
} from "lucide-react";
import { Button } from "@/shared/ui";
import { useAuth } from "@/features/auth/AuthContext";
import {
  fetchOpenRouterModels,
  getShortModelName,
  isLimitError,
  requestChatCompletion,
  generateChatTitle,
} from "../api/openRouterApi";
import {
  DEFAULT_MODELS,
  type ChatMessage,
  type ModelCategory,
  type OpenRouterModel,
  type ChatSession,
  type ChatSessionSummary,
} from "../types";
import { useChatImages } from "../hooks/useChatImages";
import ChatComposer from "../components/ChatComposer";
import ChatMessages from "../components/ChatMessages";
import ApiKeyModal from "../components/ApiKeyModal";
import { buildProjectContext } from "../context/projectContext";
import {
  getApiKey,
  saveApiKey,
  removeApiKey,
  createSession,
  loadChatSession,
  loadChatSessions,
  migrateLegacyChat,
  persistChatSession,
} from "../storage";

export default function AiChatPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedSessionId = searchParams.get("sessionId");

  const [apiKey, setApiKey] = useState("");
  const [draftKey, setDraftKey] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [sidebarTab, setSidebarTab] = useState<"models" | "sessions">(
    "sessions",
  );
  const [sessionSearch, setSessionSearch] = useState("");
  const [openSessionMenu, setOpenSessionMenu] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [titleGenerating, setTitleGenerating] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [models, setModels] = useState<OpenRouterModel[]>(DEFAULT_MODELS);
  const [selectedModels, setSelectedModels] = useState<string[]>([
    DEFAULT_MODELS[0].id,
  ]);
  const [modelCategory, setModelCategory] = useState<ModelCategory>("all");
  const [modelsLoading, setModelsLoading] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [regeneratingMessageId, setRegeneratingMessageId] = useState<
    string | null
  >(null);
  const [error, setError] = useState("");
  const [activeModel, setActiveModel] = useState("");
  const [limitCheckedAt, setLimitCheckedAt] = useState("");
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [sidebarOpenMobile, setSidebarOpenMobile] = useState(false);
  const {
    images: pendingImages,
    setImages: setPendingImages,
    addFiles: addImageFiles,
    addUrl: addImageUrl,
    remove: removePendingImage,
  } = useChatImages(setError);

  const promptInputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hydratedMessagesRef = useRef<string | null>(null);

  // ?sessionId= as it was the moment this page mounted — used once, to
  // hydrate a deep link. Never re-read after that.
  const initialSessionIdRef = useRef(requestedSessionId);
  // Any URL change WE make ourselves (new session, switch session) is
  // stamped here first. The sync effect below ignores a URL change that
  // matches this ref, so our own navigation can never race the still-saving
  // session and wipe the just-sent message back to empty.
  const knownSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    setStorageReady(false);

    const userId = user?.id ?? "";
    getApiKey(userId).then((key) => {
      const accountKey = key ?? "";
      setApiKey(accountKey);
      setDraftKey(accountKey);
      setShowKeyModal(
        !accountKey &&
          sessionStorage.getItem("yolnoma.ai-key-guide-dismissed") !== "true",
      );
      setStorageReady(true);
    });

    if (!userId) return;

    void (async () => {
      let loaded = await loadChatSessions(user);
      const migrated = await migrateLegacyChat(user);
      if (migrated) loaded = await loadChatSessions(user);
      setSessions(loaded);

      const sessionId = initialSessionIdRef.current;
      if (sessionId && loaded.some((session) => session.id === sessionId)) {
        const selected = await loadChatSession(user, sessionId);
        knownSessionIdRef.current = selected.id;
        setActiveSession(selected);
        hydratedMessagesRef.current = JSON.stringify(selected.messages);
        setMessages(selected.messages);
      } else {
        setActiveSession(null);
        setMessages([]);
        if (sessionId) {
          knownSessionIdRef.current = null;
          setSearchParams({}, { replace: true });
        }
      }
      setStorageReady(true);
    })().catch((loadError) =>
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load chat sessions.",
      ),
    );
    // Deliberately runs once per signed-in user only — NOT on every URL
    // change. See the sync effect below for why.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.email]);

  // Keeps the page in sync only when the sessionId in the URL changes from
  // OUTSIDE this component (e.g. a link elsewhere in the app). A URL change
  // this component made itself is skipped, because knownSessionIdRef already
  // matches it.
  useEffect(() => {
    if (!storageReady || !user) return;
    if (!requestedSessionId) return;
    if (requestedSessionId === knownSessionIdRef.current) return;
    if (requestedSessionId === activeSession?.id) {
      knownSessionIdRef.current = requestedSessionId;
      return;
    }
    void selectSession(requestedSessionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedSessionId, storageReady]);

  useEffect(() => {
    if (!storageReady || !activeSession || !user) return;
    const messageSignature = JSON.stringify(messages);
    if (hydratedMessagesRef.current === messageSignature) {
      hydratedMessagesRef.current = null;
      return;
    }
    const session = {
      ...activeSession,
      messages,
      updatedAt: Date.now().toString(),
    };
    setActiveSession(session);
    setSessions((current) =>
      current
        .map((item) =>
          item.id === session.id
            ? {
                ...item,
                title: session.title,
                updatedAt: session.updatedAt,
                messageCount: messages.length,
                model: session.model,
              }
            : item,
        )
        .sort((a, b) => Number(b.updatedAt) - Number(a.updatedAt)),
    );
    void persistChatSession(user, session);
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [loading, messages]);

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
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "INPUT" ||
        target?.isContentEditable
      )
        return;
      if (event.key.length !== 1) return;
      event.preventDefault();
      promptInputRef.current?.focus();
      setPrompt((current) => current + event.key);
    };

    window.addEventListener("keydown", handleGlobalTyping);
    return () => window.removeEventListener("keydown", handleGlobalTyping);
  }, [loading, showKeyModal]);

  useEffect(() => {
    let cancelled = false;
    setModelsLoading(true);
    if (!storageReady || !apiKey.trim()) {
      setModelsLoading(false);
      return () => {
        cancelled = true;
      };
    }
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
        /* keep the built-in models when the catalog request fails */
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
    if (modelCategory === "all") return models;
    return models.filter((model) => {
      const isFree =
        Number(model.pricing?.prompt ?? 1) === 0 &&
        Number(model.pricing?.completion ?? 1) === 0;
      return modelCategory === "free" ? isFree : !isFree;
    });
  }, [modelCategory, models]);

  const saveKey = async () => {
    const cleanKey = draftKey.trim();
    const userId = user?.id ?? "";
    if (cleanKey) {
      await saveApiKey(userId, cleanKey);
      setApiKey(cleanKey);
      setError("");
      setShowKeyModal(false);
    } else {
      await removeApiKey(userId);
      setApiKey("");
      setShowKeyModal(true);
    }
  };

  const dismissKeyGuide = () => {
    sessionStorage.setItem("yolnoma.ai-key-guide-dismissed", "true");
    setShowKeyModal(false);
  };

  const toggleModel = (id: string) => {
    setSelectedModels((current) => (current[0] === id ? current : [id]));
  };

  const newChat = async () => {
    knownSessionIdRef.current = null;
    setActiveSession(null);
    setMessages([]);
    setPrompt("");
    setPendingImages([]);
    setSidebarTab("sessions");
    setSidebarOpenMobile(false);
    setSearchParams({}, { replace: false });
  };

  const selectSession = async (id: string) => {
    if (!user || id === activeSession?.id) return;
    knownSessionIdRef.current = id;
    const session = await loadChatSession(user, id);
    setActiveSession(session);
    hydratedMessagesRef.current = JSON.stringify(session.messages);
    setMessages(session.messages);
    setPrompt("");
    setPendingImages([]);
    setSearchParams({ sessionId: id });
    setOpenSessionMenu(null);
    setSidebarOpenMobile(false);
  };

  const saveSessionTitle = async (id: string) => {
    if (!user || !editingTitle.trim()) return;
    const target =
      activeSession?.id === id
        ? activeSession
        : await loadChatSession(user, id);
    const next = { ...target, title: editingTitle.trim() };
    await persistChatSession(user, next);
    if (activeSession?.id === id) setActiveSession(next);
    setSessions((current) =>
      current.map((item) =>
        item.id === id ? { ...item, title: next.title } : item,
      ),
    );
    setEditingSessionId(null);
  };

  const deleteSession = async (id: string) => {
    if (!user || !window.confirm("Delete this chat session?")) return;
    await invoke("delete_ai_chat_session", { userId: user.id, sessionId: id });
    const remaining = sessions.filter((session) => session.id !== id);
    if (activeSession?.id === id) {
      knownSessionIdRef.current = null;
      setActiveSession(null);
      setMessages([]);
      setSearchParams({}, { replace: false });
      setSessions(remaining);
    } else setSessions(remaining);
    setOpenSessionMenu(null);
  };

  const sendPrompt = async (
    text: string,
    conversationMessages = messages,
    images = pendingImages,
  ) => {
    if ((!text.trim() && !images.length) || loading) return;
    if (!apiKey) {
      setError("Enter and save your OpenRouter API key first.");
      setShowKeyModal(true);
      return;
    }

    const requestModels = selectedModels.filter((modelId) => {
      if (!images.length) return true;
      const model = models.find((candidate) => candidate.id === modelId);
      return model?.architecture?.input_modalities?.includes("image") ?? false;
    });
    if (!requestModels.length) {
      setError(
        "Choose an OpenRouter model that supports image input, such as Gemma 3.",
      );
      return;
    }

    let session = activeSession;
    if (!session) {
      session = await createSession(user);
      knownSessionIdRef.current = session.id;
      setActiveSession(session);
      setSessions((current) => [{ ...session!, messageCount: 0 }, ...current]);
      setSearchParams({ sessionId: session.id });
    }

    const userMessage: ChatMessage = {
      role: "user",
      content: text,
      ...(images.length ? { images } : {}),
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    const nextMessages = [...conversationMessages, userMessage];
    setMessages(nextMessages);
    setPrompt("");
    setPendingImages([]);
    if (promptInputRef.current) promptInputRef.current.style.height = "";
    setError("");
    setLimitCheckedAt("");
    setLoading(true);

    if (session.title === "New chat" && text.trim()) {
      setTitleGenerating(true);
      void generateChatTitle(apiKey, selectedModels[0], text)
        .then((title) => {
          setActiveSession((current) => {
            if (!current) return current;
            const next = { ...current, title, messages: [...nextMessages] };
            if (user) void persistChatSession(user, next);
            return next;
          });
          setSessions((current) =>
            current.map((item) =>
              item.id === session?.id ? { ...item, title } : item,
            ),
          );
        })
        .catch(() => undefined)
        .finally(() => setTitleGenerating(false));
    }

    try {
      for (const model of requestModels) {
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
            role: "assistant",
            content: response.body.choices?.[0]?.message?.content ?? "",
            model,
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
          },
        ]);
        return;
      }
      const checkedAt = new Date().toLocaleTimeString("uz-UZ", {
        hour: "2-digit",
        minute: "2-digit",
      });
      setLimitCheckedAt(checkedAt);
      throw new Error(
        `All selected models reached their limit. Last checked at ${checkedAt}.`,
      );
    } catch (requestError) {
      // Keep the user's message visible on failure — only restore the draft
      // text so they can retry, don't erase what they already sent.
      setPrompt(text);
      setPendingImages(images);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "An unknown error occurred.",
      );
    } finally {
      setLoading(false);
      setActiveModel("");
    }
  };

  const sendMessage = (event: React.SyntheticEvent) => {
    event.preventDefault();
    const text = prompt.trim();
    if ((!text && !pendingImages.length) || loading) return;
    void sendPrompt(text, messages, pendingImages);
  };

  const editUserMessage = (message: ChatMessage) => {
    const index = messages.findIndex((item) => item.id === message.id);
    if (index < 0) return;
    setMessages(messages.slice(0, index));
    setPrompt(message.content);
    setPendingImages(message.images ?? []);
    requestAnimationFrame(() => promptInputRef.current?.focus());
  };

  const regenerateAssistantMessage = (message: ChatMessage) => {
    const index = messages.findIndex((item) => item.id === message.id);
    if (index < 0) return;
    const previousUser = [...messages.slice(0, index)]
      .reverse()
      .find((item) => item.role === "user");
    if (!previousUser || loading) return;
    setMessages(messages.slice(0, index));
    setRegeneratingMessageId(message.id ?? null);
    void sendPrompt(
      previousUser.content,
      messages.slice(0, index),
      previousUser.images ?? [],
    ).finally(() => setRegeneratingMessageId(null));
  };

  const filteredSessions = sessions.filter((session) =>
    session.title.toLowerCase().includes(sessionSearch.toLowerCase()),
  );

  return (
    <div className="mx-auto grid h-[calc(100dvh-150px)] w-full max-w-none grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-5">
      {/* ---------------------------- Chat column ---------------------------- */}
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111109]">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-3 sm:px-5 sm:py-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="shrink-0 rounded-xl bg-[var(--accent-dim)] p-2 text-[var(--accent)]">
              <Bot size={18} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">
                Yolnoma AI
              </p>
              <p className="truncate text-xs text-white/35">
                {selectedModelLabels.join(" → ")}
                {limitCheckedAt && (
                  <span className="text-amber-200/60">
                    {" "}
                    · limit tekshirildi {limitCheckedAt}
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSidebarOpenMobile((v) => !v)}
              className="rounded-lg p-2 text-white/50 hover:bg-white/[0.08] hover:text-white lg:hidden"
              aria-label="Toggle sidebar"
            >
              <MessageSquare size={16} />
            </button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMessages([])}
              disabled={!messages.length}
            >
              <Trash2 size={15} /> Clear
            </Button>
          </div>
        </header>

        <ChatMessages
          messages={messages}
          models={models}
          loading={loading}
          activeModel={activeModel}
          messagesEndRef={messagesEndRef}
          onEditUserMessage={editUserMessage}
          onRegenerateAssistantMessage={regenerateAssistantMessage}
          regeneratingMessageId={regeneratingMessageId}
        />

        {error && (
          <div className="mx-4 mb-3 shrink-0 rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs text-red-200 sm:mx-5">
            {error}
          </div>
        )}

        <ChatComposer
          prompt={prompt}
          loading={loading}
          images={pendingImages}
          promptInputRef={promptInputRef}
          onPromptChange={setPrompt}
          onAddImages={(files) => void addImageFiles(files)}
          onAddImageUrl={addImageUrl}
          onRemoveImage={removePendingImage}
          onSubmit={sendMessage}
        />
      </main>

      {/* ------------------------------ Sidebar ------------------------------ */}
      <aside
        className={`flex min-h-0 flex-col gap-4 overflow-hidden lg:flex ${
          sidebarOpenMobile ? "flex" : "hidden"
        }`}
      >
        <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-white/[0.08] bg-[#111109] p-4">
          <div className="mb-4 grid shrink-0 grid-cols-2 gap-1 rounded-xl border border-white/[0.06] bg-black/10 p-1">
            <button
              type="button"
              onClick={() => setSidebarTab("sessions")}
              className={`flex items-center justify-center gap-2 rounded-lg px-2 py-2 text-[11px] font-semibold transition-colors ${
                sidebarTab === "sessions"
                  ? "bg-[var(--accent-dim)] text-[var(--accent)]"
                  : "text-white/40 hover:text-white/75"
              }`}
            >
              <MessageSquare size={13} /> Sessions
            </button>
            <button
              type="button"
              onClick={() => setSidebarTab("models")}
              className={`flex items-center justify-center gap-2 rounded-lg px-2 py-2 text-[11px] font-semibold transition-colors ${
                sidebarTab === "models"
                  ? "bg-[var(--accent-dim)] text-[var(--accent)]"
                  : "text-white/40 hover:text-white/75"
              }`}
            >
              <Settings2 size={13} /> Models
            </button>
          </div>

          {sidebarTab === "models" ? (
            <>
              <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
                <div className="text-sm font-semibold text-white">
                  Choose a model
                </div>
                {modelsLoading && (
                  <span className="text-[10px] text-white/30">Loading…</span>
                )}
              </div>
              <div className="mb-4 grid shrink-0 grid-cols-3 gap-1 rounded-xl border border-white/[0.06] bg-black/10 p-1">
                {(["all", "free", "paid"] as ModelCategory[]).map(
                  (category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setModelCategory(category)}
                      className={`rounded-lg px-2 py-2 text-[11px] font-semibold capitalize transition-colors ${
                        modelCategory === category
                          ? "bg-[var(--accent-dim)] text-[var(--accent)]"
                          : "text-white/40 hover:text-white/75"
                      }`}
                    >
                      {category}
                    </button>
                  ),
                )}
              </div>
              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
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
                      className={`flex h-10 min-w-0 shrink-0 cursor-pointer items-center gap-2 rounded-xl border px-3 transition-colors ${
                        selectedModels.includes(model.id)
                          ? "border-[var(--accent-border)] bg-[var(--accent-glow)] text-white"
                          : "border-white/[0.06] text-white/55 hover:border-white/[0.14] hover:text-white/80"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedModels.includes(model.id)}
                        onChange={() => toggleModel(model.id)}
                        className="sr-only"
                      />
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${
                          selectedModels.includes(model.id)
                            ? "bg-[var(--accent)]"
                            : "bg-white/20"
                        }`}
                      />
                      <span className="min-w-0 truncate text-xs font-medium">
                        {getShortModelName(model)}
                      </span>
                    </label>
                  ))}
              </div>
            </>
          ) : (
            <>
              <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
                <span className="text-sm font-semibold text-white">
                  Your conversations
                </span>
                <button
                  type="button"
                  onClick={() => void newChat()}
                  className="rounded-lg p-1.5 text-[var(--accent)] hover:bg-white/[0.08]"
                  title="New chat"
                >
                  <Plus size={16} />
                </button>
              </div>
              <div className="mb-3 flex shrink-0 items-center gap-2 rounded-lg border border-white/[0.07] bg-black/10 px-2.5 py-2">
                <Search size={13} className="text-white/30" />
                <input
                  value={sessionSearch}
                  onChange={(event) => setSessionSearch(event.target.value)}
                  placeholder="Search sessions"
                  className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-white/25"
                />
              </div>
              <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-1">
                {filteredSessions.map((session) => (
                  <div
                    key={session.id}
                    className={`group relative flex items-center gap-2 rounded-xl border px-3 py-2.5 ${
                      activeSession?.id === session.id
                        ? "border-[var(--accent-border)] bg-[var(--accent-glow)]"
                        : "border-white/[0.06] hover:border-white/[0.14]"
                    }`}
                  >
                    {editingSessionId === session.id ? (
                      <input
                        autoFocus
                        value={editingTitle}
                        onChange={(event) =>
                          setEditingTitle(event.target.value)
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter")
                            void saveSessionTitle(session.id);
                          if (event.key === "Escape") setEditingSessionId(null);
                        }}
                        onBlur={() => void saveSessionTitle(session.id)}
                        className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => void selectSession(session.id)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <span className="block truncate text-xs font-medium text-white/80">
                          {session.title}
                          {titleGenerating &&
                            activeSession?.id === session.id &&
                            " …"}
                        </span>
                        <span className="text-[10px] text-white/30">
                          {session.messageCount} messages
                        </span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setOpenSessionMenu(
                          openSessionMenu === session.id ? null : session.id,
                        )
                      }
                      className="shrink-0 rounded-md p-1 text-white/30 hover:bg-white/[0.08] hover:text-white"
                      aria-label="Session actions"
                    >
                      <MoreHorizontal size={15} />
                    </button>
                    {openSessionMenu === session.id && (
                      <div className="absolute right-2 top-9 z-20 w-32 rounded-xl border border-white/10 bg-[#211b17] p-1 shadow-xl">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingSessionId(session.id);
                            setEditingTitle(session.title);
                            setOpenSessionMenu(null);
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-white/70 hover:bg-white/[0.08]"
                        >
                          <Pencil size={12} /> Rename
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteSession(session.id)}
                          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-red-300 hover:bg-red-400/10"
                        >
                          <Trash2 size={12} /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {!sessions.length && (
                  <p className="py-5 text-center text-xs text-white/30">
                    No sessions yet.
                  </p>
                )}
              </div>
            </>
          )}
        </section>

        <section className="shrink-0 rounded-2xl border border-white/[0.08] bg-[#111109] p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <KeyRound size={16} /> API key
            </div>
            <span
              className={`h-2 w-2 rounded-full ${
                apiKey ? "bg-emerald-400" : "bg-amber-300"
              }`}
            />
          </div>
          <p className="mt-3 text-xs leading-relaxed text-white/40">
            {apiKey
              ? "Connected and ready to chat."
              : "Required before starting a chat."}
          </p>
          <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
            <Button
              className="w-full justify-center"
              size="sm"
              variant={apiKey ? "ghost" : "primary"}
              onClick={() => setShowKeyModal(true)}
            >
              <KeyRound size={15} /> {apiKey ? "Change key" : "Add API key"}
            </Button>
            <Button
              size="sm"
              variant="danger"
              iconOnly
              title="Remove API key"
              aria-label="Remove API key"
              onClick={async () => {
                if (!window.confirm("Remove the saved OpenRouter API key?"))
                  return;
                await removeApiKey(user?.id ?? "");
                setApiKey("");
                setDraftKey("");
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
