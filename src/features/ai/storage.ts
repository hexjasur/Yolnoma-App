/** AI Chat persistence: API key remains encrypted; conversations live in Tauri session JSON files. */
import type { UserProfile } from "@/features/auth/AuthContext";
import type { ChatMessage, ChatSession } from "./types";
import {
  getApiKey,
  saveApiKey,
  removeApiKey,
  getStorageScope,
} from "@/shared/hooks/useAccountStorage";
import {
  createChatSession,
  getChatSession,
  listChatSessions,
  saveChatSession,
  deleteChatSession as deleteChatSessionApi,
} from "./api/openRouterApi";

export { getApiKey, saveApiKey, removeApiKey };

const LEGACY_CHAT_PREFIX = "yolnoma.ai-chat.";
const LEGACY_GUEST_CHAT_KEY = "yolnoma.ai-chat.messages";

function accountId(user: UserProfile | null) {
  return getStorageScope(user?.id);
}

export async function loadChatSessions(user: UserProfile | null) {
  return listChatSessions(accountId(user));
}

export async function loadChatSession(
  user: UserProfile | null,
  sessionId: string,
) {
  return getChatSession(accountId(user), sessionId);
}

export async function createSession(user: UserProfile | null) {
  return createChatSession(accountId(user));
}

export async function persistChatSession(
  user: UserProfile | null,
  session: ChatSession,
) {
  return saveChatSession(accountId(user), session);
}

export async function deleteChatSession(
  user: UserProfile | null,
  sessionId: string,
) {
  return deleteChatSessionApi(accountId(user), sessionId);
}

/** One-time migration from the old account-scoped localStorage history. */
export async function migrateLegacyChat(user: UserProfile | null) {
  const identity = user?.id || user?.email;
  const key = identity
    ? `${LEGACY_CHAT_PREFIX}${encodeURIComponent(identity.trim().toLowerCase())}.messages`
    : LEGACY_GUEST_CHAT_KEY;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const messages = JSON.parse(raw) as ChatMessage[];
    if (!Array.isArray(messages) || !messages.length) return null;
    const session = await createSession(user);
    session.title = "Previous conversation";
    session.messages = messages;
    await persistChatSession(user, session);
    localStorage.removeItem(key);
    return session;
  } catch {
    return null;
  }
}

// ─── Agent Project Workspace Persistence ──────────────────────────────────────

export type RecentProject = {
  path: string;
  name: string;
  lastOpened: number;
};

const LAST_PROJECT_KEY = "yolnoma.agent.last_project_path";
const RECENT_PROJECTS_KEY = "yolnoma.agent.recent_projects";

export function getLastProjectPath(): string | null {
  try {
    return localStorage.getItem(LAST_PROJECT_KEY);
  } catch {
    return null;
  }
}

export function setLastProjectPath(path: string | null) {
  try {
    if (path) {
      localStorage.setItem(LAST_PROJECT_KEY, path);
    } else {
      localStorage.removeItem(LAST_PROJECT_KEY);
    }
  } catch {
    // ignore
  }
}

export function getRecentProjects(): RecentProject[] {
  try {
    const raw = localStorage.getItem(RECENT_PROJECTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RecentProject[];
  } catch {
    return [];
  }
}

export function addRecentProject(path: string, name: string): RecentProject[] {
  try {
    const list = getRecentProjects().filter((p) => p.path !== path);
    const updated: RecentProject[] = [
      { path, name, lastOpened: Date.now() },
      ...list,
    ].slice(0, 10);
    localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export function removeRecentProject(path: string): RecentProject[] {
  try {
    const list = getRecentProjects().filter((p) => p.path !== path);
    localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(list));
    return list;
  } catch {
    return [];
  }
}
