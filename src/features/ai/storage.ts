/** AI Chat persistence: API key remains encrypted; conversations live in Tauri session JSON files. */
import type { UserProfile } from '@/features/auth/AuthContext';
import type { ChatMessage, ChatSession } from './types';
import { getApiKey, saveApiKey, removeApiKey } from '@/shared/hooks/useAccountStorage';
import { createChatSession, getChatSession, listChatSessions, saveChatSession } from './api/openRouterApi';

export { getApiKey, saveApiKey, removeApiKey };

const LEGACY_CHAT_PREFIX = 'yolnoma.ai-chat.';

function accountId(user: UserProfile | null) { return user?.id ?? ''; }

export async function loadChatSessions(user: UserProfile | null) {
  return listChatSessions(accountId(user));
}

export async function loadChatSession(user: UserProfile | null, sessionId: string) {
  return getChatSession(accountId(user), sessionId);
}

export async function createSession(user: UserProfile | null) {
  return createChatSession(accountId(user));
}

export async function persistChatSession(user: UserProfile | null, session: ChatSession) {
  return saveChatSession(accountId(user), session);
}

/** One-time migration from the old account-scoped localStorage history. */
export async function migrateLegacyChat(user: UserProfile | null) {
  const identity = user?.id || user?.email;
  if (!identity) return null;
  const key = `${LEGACY_CHAT_PREFIX}${encodeURIComponent(identity.trim().toLowerCase())}.messages`;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const messages = JSON.parse(raw) as ChatMessage[];
    if (!Array.isArray(messages) || !messages.length) return null;
    const session = await createSession(user);
    session.title = 'Previous conversation';
    session.messages = messages;
    await persistChatSession(user, session);
    localStorage.removeItem(key);
    return session;
  } catch {
    return null;
  }
}
