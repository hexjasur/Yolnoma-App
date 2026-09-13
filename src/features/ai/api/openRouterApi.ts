import { invoke } from '@tauri-apps/api/core';
import type { ChatMessage, ChatSession, ChatSessionSummary, OpenRouterModel, ProxyResponse } from '../types';

export function getShortModelName(model: OpenRouterModel) {
  const source = model.name ?? model.id.split('/').pop() ?? model.id;
  const shortName = source.replace(/\s+(instruct|instruction|chat|it)$/i, '').trim();
  return shortName.length > 24 ? `${shortName.slice(0, 23)}…` : shortName;
}

export function isLimitError(status: number, message: string) {
  return status === 402 || status === 429 || /limit|quota|rate|credit|capacity/i.test(message);
}

export async function fetchOpenRouterModels(apiKey: string) {
  const response = await invoke<ProxyResponse>('proxy_request', {
    method: 'GET', url: 'https://openrouter.ai/api/v1/models',
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
  });
  const chatModels = (response.body.data ?? [])
    .filter((model) => !/embedding|image|audio|moderation|whisper/i.test(model.id))
    .sort((left, right) => Number(left.pricing?.prompt ?? 1) - Number(right.pricing?.prompt ?? 1))
    .slice(0, 80);
  return { response, models: chatModels };
}

export async function requestChatCompletion(apiKey: string, model: string, messages: ChatMessage[], systemContext: string) {
  return invoke<ProxyResponse>('proxy_request', {
    method: 'POST', url: 'https://openrouter.ai/api/v1/chat/completions',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://yolnoma.app', 'X-Title': 'Yolnoma AI Chat' },
    body: { model, max_tokens: 1200, messages: [{ role: 'system', content: systemContext }, ...messages] },
  });
}

export function listChatSessions(userId: string) {
  return invoke<ChatSessionSummary[]>('list_ai_chat_sessions', { userId });
}
export function getChatSession(userId: string, sessionId: string) {
  return invoke<ChatSession>('get_ai_chat_session', { userId, sessionId });
}
export function createChatSession(userId: string, title = 'New chat') {
  return invoke<ChatSession>('create_ai_chat_session', { userId, title });
}
export function saveChatSession(userId: string, session: ChatSession) {
  return invoke<void>('save_ai_chat_session', { userId, session });
}
export function deleteChatSession(userId: string, sessionId: string) {
  return invoke<void>('delete_ai_chat_session', { userId, sessionId });
}

export async function generateChatTitle(apiKey: string, model: string, prompt: string) {
  const response = await invoke<ProxyResponse>('proxy_request', {
    method: 'POST', url: 'https://openrouter.ai/api/v1/chat/completions',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://yolnoma.app', 'X-Title': 'Yolnoma AI Chat' },
    body: {
      model,
      max_tokens: 24,
      messages: [
        { role: 'system', content: 'Create a concise 3-6 word title for the conversation. Reply with only the title, no quotes, punctuation, or explanation.' },
        { role: 'user', content: prompt.slice(0, 500) },
      ],
    },
  });
  if (response.status < 200 || response.status >= 300) throw new Error(response.body.error?.message ?? `HTTP ${response.status}`);
  return (response.body.choices?.[0]?.message?.content ?? 'New chat').replace(/[\n"']/g, '').trim().slice(0, 80) || 'New chat';
}
