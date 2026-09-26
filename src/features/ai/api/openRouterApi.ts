import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  ChatMessage,
  ChatSession,
  ChatSessionSummary,
  OpenRouterModel,
  ProxyResponse,
} from "../types";
import { getApiKey, saveApiKey } from "@/shared/hooks/useAccountStorage";

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

type OpenRouterRequestOptions = {
  apiKey: string;
  model: string;
  messages: Array<{
    role: string;
    content: unknown;
    tool_calls?: unknown[];
    tool_call_id?: string;
  }>;
  maxTokens?: number;
  systemContext?: string;
  tools?: unknown[];
  toolChoice?: unknown;
  responseFormat?: unknown;
  title?: string;
  temperature?: number;
};

export function getShortModelName(model: OpenRouterModel) {
  const source = model.name ?? model.id.split("/").pop() ?? model.id;
  const shortName = source
    .replace(/\s+(instruct|instruction|chat|it)$/i, "")
    .trim();
  return shortName.length > 24 ? `${shortName.slice(0, 23)}…` : shortName;
}

export function isLimitError(status: number, message: string) {
  return (
    status === 402 ||
    status === 429 ||
    /limit|quota|rate|credit|capacity/i.test(message)
  );
}

export function requestOpenRouter(options: OpenRouterRequestOptions) {
  const messages = options.systemContext
    ? [{ role: "system", content: options.systemContext }, ...options.messages]
    : options.messages;
  return invoke<ProxyResponse>("proxy_request", {
    method: "POST",
    url: `${OPENROUTER_BASE}/chat/completions`,
    headers: {
      ...(options.apiKey ? { Authorization: `Bearer ${options.apiKey}` } : {}),
      "Content-Type": "application/json",
      "HTTP-Referer": "https://yolnoma.app",
      "X-Title": options.title ?? "Yolnoma AI Tools",
    },
    body: {
      model: options.model,
      max_tokens: options.maxTokens ?? 1200,
      messages,
      ...(options.tools ? { tools: options.tools } : {}),
      ...(options.toolChoice ? { tool_choice: options.toolChoice } : {}),
      ...(options.responseFormat
        ? { response_format: options.responseFormat }
        : {}),
      ...(options.temperature !== undefined
        ? { temperature: options.temperature }
        : {}),
    },
  });
}

export function responseError(
  response: ProxyResponse,
  fallback = "OpenRouter request failed.",
) {
  return (
    response.body.error?.message ?? `${fallback} (HTTP ${response.status})`
  );
}

export async function fetchOpenRouterModels(apiKey: string) {
  const response = await invoke<ProxyResponse>("proxy_request", {
    method: "GET",
    url: `${OPENROUTER_BASE}/models`,
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
  });
  const chatModels = (response.body.data ?? [])
    .filter(
      (model) => !/embedding|image|audio|moderation|whisper/i.test(model.id),
    )
    .sort(
      (left, right) =>
        Number(left.pricing?.prompt ?? 1) - Number(right.pricing?.prompt ?? 1),
    )
    .slice(0, 80);
  return { response, models: chatModels };
}

export function useOpenRouterSession(
  userId: string,
  defaults: OpenRouterModel[],
) {
  const [apiKey, setApiKey] = useState("");
  const [draftKey, setDraftKey] = useState("");
  const [apiKeyReady, setApiKeyReady] = useState(false);
  const [models, setModels] = useState(defaults);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState("");
  const [selectedModel, setSelectedModel] = useState(defaults[0]?.id ?? "");

  useEffect(() => {
    let cancelled = false;
    setApiKeyReady(false);
    void getApiKey(userId).then((key) => {
      if (cancelled) return;
      setApiKey(key ?? "");
      setDraftKey(key ?? "");
      setApiKeyReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!apiKeyReady) return;
    let cancelled = false;
    setModelsLoading(true);
    setModelsError("");
    void fetchOpenRouterModels(apiKey)
      .then(({ response, models: fetched }) => {
        if (cancelled) return;
        if (
          response.status < 200 ||
          response.status >= 300 ||
          !fetched.length
        ) {
          setModelsError(responseError(response, "Model list unavailable"));
          return;
        }
        const featured = new Set(defaults.map((model) => model.id));
        const ordered = [
          ...fetched.filter((model) => featured.has(model.id)),
          ...fetched.filter((model) => !featured.has(model.id)),
        ];
        setModels(ordered);
        setSelectedModel((current) =>
          ordered.some((model) => model.id === current)
            ? current
            : (ordered[0]?.id ?? ""),
        );
      })
      .catch((error) => {
        if (!cancelled)
          setModelsError(
            error instanceof Error ? error.message : String(error),
          );
      })
      .finally(() => {
        if (!cancelled) setModelsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiKey, apiKeyReady, defaults]);

  const saveKey = async (value: string) => {
    const clean = value.trim();
    await saveApiKey(userId, clean);
    setApiKey(clean);
    setDraftKey(clean);
  };

  return {
    apiKey,
    draftKey,
    setDraftKey,
    apiKeyReady,
    models,
    modelsLoading,
    modelsError,
    selectedModel,
    setSelectedModel,
    saveKey,
  };
}

export function requestChatCompletion(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  systemContext: string,
) {
  const openRouterMessages = messages.map(({ role, content, images }) => ({
    role,
    content: images?.length
      ? [
          ...(content ? [{ type: "text", text: content }] : []),
          ...images.map((image) => ({
            type: "image_url",
            image_url: { url: image.url },
          })),
        ]
      : content,
  }));
  return requestOpenRouter({
    apiKey,
    model,
    messages: openRouterMessages,
    systemContext,
    title: "Yolnoma AI",
  });
}

export function listChatSessions(userId: string) {
  return invoke<ChatSessionSummary[]>("list_ai_chat_sessions", { userId });
}
export function getChatSession(userId: string, sessionId: string) {
  return invoke<ChatSession>("get_ai_chat_session", { userId, sessionId });
}
export function createChatSession(userId: string, title = "New chat") {
  return invoke<ChatSession>("create_ai_chat_session", { userId, title });
}
export function saveChatSession(userId: string, session: ChatSession) {
  return invoke<void>("save_ai_chat_session", { userId, session });
}
export function deleteChatSession(userId: string, sessionId: string) {
  return invoke<void>("delete_ai_chat_session", { userId, sessionId });
}

export async function generateChatTitle(
  apiKey: string,
  model: string,
  prompt: string,
) {
  const response = await requestOpenRouter({
    apiKey,
    model,
    maxTokens: 24,
    title: "Yolnoma AI Chat",
    messages: [{ role: "user", content: prompt.slice(0, 500) }],
    systemContext:
      "Create a concise 3-6 word title for the conversation. Reply with only the title, no quotes, punctuation, or explanation.",
  });
  if (response.status < 200 || response.status >= 300)
    throw new Error(responseError(response));
  return (
    (response.body.choices?.[0]?.message?.content ?? "New chat")
      .replace(/[\n"']/g, "")
      .trim()
      .slice(0, 80) || "New chat"
  );
}

export type { OpenRouterRequestOptions };
