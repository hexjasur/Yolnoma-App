/**
 * AI-chat storage helpers.
 *
 * Chat messages — still stored in localStorage (scoped per account).
 * API key      — stored in secrets.dat via Tauri (AES-256-GCM encrypted).
 *               Use getApiKey / saveApiKey / removeApiKey from useAccountStorage.
 */

import type { UserProfile } from '@/features/auth/AuthContext';
import type { ChatMessage } from './types';
import { getApiKey, saveApiKey, removeApiKey } from '@/shared/hooks/useAccountStorage';

export { getApiKey, saveApiKey, removeApiKey };

// ── Legacy keys (cleared on first run) ───────────────────────────────────────

const STORAGE_PREFIX = 'yolnoma.ai-chat';
/** @deprecated localStorage-based API key — cleared during migration */
export const LEGACY_API_KEY = 'yolnoma.openrouter.api-key';
const LEGACY_CHAT = 'yolnoma.ai-chat.messages';

// ── Account-scoped chat (localStorage) ───────────────────────────────────────

function accountScope(user: UserProfile | null) {
  const identity = user?.id || user?.email;
  return identity ? encodeURIComponent(identity.trim().toLowerCase()) : 'guest';
}

export function getAccountChatKey(user: UserProfile | null) {
  return `${STORAGE_PREFIX}.${accountScope(user)}.messages`;
}

export function loadAccountChat(user: UserProfile | null): ChatMessage[] {
  try {
    const stored = localStorage.getItem(getAccountChatKey(user));
    return stored ? (JSON.parse(stored) as ChatMessage[]) : [];
  } catch {
    return [];
  }
}

/** Remove stale global (non-scoped) legacy keys on first run. */
export function clearLegacyAiStorage() {
  localStorage.removeItem(LEGACY_API_KEY);
  localStorage.removeItem(LEGACY_CHAT);
}
