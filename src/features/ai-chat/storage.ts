import type { UserProfile } from '@/features/auth/AuthContext';
import type { ChatMessage } from './types';

const STORAGE_PREFIX = 'yolnoma.ai-chat';
const LEGACY_KEY = 'yolnoma.openrouter.api-key';
const LEGACY_CHAT = 'yolnoma.ai-chat.messages';

function accountScope(user: UserProfile | null) {
  const identity = user?.id || user?.email;
  return identity ? encodeURIComponent(identity.trim().toLowerCase()) : 'guest';
}

export function getAccountStorageKeys(user: UserProfile | null) {
  const scope = accountScope(user);
  return {
    apiKey: `${STORAGE_PREFIX}.${scope}.api-key`,
    chat: `${STORAGE_PREFIX}.${scope}.messages`,
  };
}

export function loadAccountChat(user: UserProfile | null): ChatMessage[] {
  try {
    const stored = localStorage.getItem(getAccountStorageKeys(user).chat);
    return stored ? (JSON.parse(stored) as ChatMessage[]) : [];
  } catch {
    return [];
  }
}

export function loadAccountApiKey(user: UserProfile | null) {
  return localStorage.getItem(getAccountStorageKeys(user).apiKey) ?? '';
}

export function clearLegacyAiStorage() {
  localStorage.removeItem(LEGACY_KEY);
  localStorage.removeItem(LEGACY_CHAT);
}
