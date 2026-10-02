import { useTranslation } from "react-i18next";
import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { readDir } from "@tauri-apps/plugin-fs";
import {
  Bot,
  ChevronDown,
  Clock,
  FileDiff,
  FileText,
  Folder,
  FolderOpen,
  History,
  Save,
  X,
} from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useAuth } from "@/features/auth/AuthContext";
import { getStorageScope } from "@/shared/hooks/useAccountStorage";
import {
  getApiKey,
  saveApiKey,
  getLastProjectPath,
  setLastProjectPath,
  getRecentProjects,
  addRecentProject,
  removeRecentProject,
  type RecentProject,
} from "../storage";
import {
  DEFAULT_MODELS,
  type OpenRouterResponse,
  type ToolCall,
} from "../types";
import {
  fetchOpenRouterModels,
  getShortModelName,
  requestOpenRouter,
} from "../api/openRouterApi";
import SideBySideDiffViewer from "../components/SideBySideDiffViewer";
import type { GitChange } from "@/features/git/types";
import AgentActivityBar, {
  type SidebarPanel,
} from "../components/AgentActivityBar";
import AgentExplorerPanel, {
  type TreeNode,
} from "../components/AgentExplorerPanel";
import AgentSourceControlPanel from "../components/AgentSourceControlPanel";
import AgentChatPanel from "../components/AgentChatPanel";
import AgentEditApprovalModal, {
  type PendingEdit,
} from "../components/AgentEditApprovalModal";

// ─── Types ────────────────────────────────────────────────────────────────────

type FileTab = {
  kind: "file";
  node: TreeNode;
  content: string;
  savedContent: string;
  isPreview?: boolean;
};

type DiffTab = {
  kind: "diff";
  change: GitChange;
  isPreview?: boolean;
};

type EditorTab = FileTab | DiffTab;

type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "target",
  ".next",
  "coverage",
  ".cache",
]);
const MAX_FILE_CHARS = 40_000;
const MAX_SEARCH_FILES = 300;
const TEXT_EXT =
  /\.(txt|md|mdx|json|jsonc|js|jsx|mjs|cjs|ts|tsx|css|scss|sass|less|html|htm|xml|yaml|yml|toml|ini|env|rs|py|go|java|kt|swift|c|h|cpp|hpp|cs|php|rb|sh|bash|bat|ps1|sql|graphql|vue|svelte|astro|gitignore|dockerfile|lock)$/i;

// ─── Path helpers ─────────────────────────────────────────────────────────────

function fwd(base: string, name: string): string {
  const b = base.replace(/\\/g, "/");
  return b.endsWith("/") ? `${b}${name}` : `${b}/${name}`;
}

// ─── Lazy folder reader ───────────────────────────────────────────────────────

async function readFolderChildren(
  absPath: string,
  parentRel: string,
  depth: number,
): Promise<TreeNode[]> {
  let children;
  try {
    children = await readDir(absPath);
  } catch {
    return [];
  }
  return children
    .filter(
      (c) => c.name && (!c.name.startsWith(".") || c.name === ".env.example"),
    )
    .filter((c) => !(c.isDirectory && IGNORED_DIRS.has(c.name)))
    .sort(
      (a, b) =>
        Number(Boolean(b.isDirectory)) - Number(Boolean(a.isDirectory)) ||
        a.name.localeCompare(b.name),
    )
    .map((c) => ({
      name: c.name,
      absPath: fwd(absPath, c.name),
      rel: parentRel === "" ? c.name : `${parentRel}/${c.name}`,
      kind: c.isDirectory ? "directory" : "file",
      depth,
    }));
}

// Full background scan for AI search context
async function fullScan(
  rootPath: string,
  depth = 0,
  max = 2000,
): Promise<TreeNode[]> {
  const result: TreeNode[] = [];
  async function walk(absPath: string, parentRel: string, d: number) {
    if (result.length >= max || d > 8) return;
    const children = await readFolderChildren(absPath, parentRel, d);
    for (const c of children) {
      if (result.length >= max) break;
      result.push(c);
      if (c.kind === "directory") await walk(c.absPath, c.rel, d + 1);
    }
  }
  await walk(rootPath, "", depth);
  return result;
}

// ─── AI tools ─────────────────────────────────────────────────────────────────

const TOOLS = [
  {
    type: "function",
    function: {
      name: "read_file",
      description:
        "Read a single text file inside the selected project. Pass a relative path such as src/app/page.tsx. IMPORTANT: when improving the README, ONLY read README.md — do not read other files unless explicitly needed.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Relative path from project root",
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description:
        "Propose a complete replacement for a file. The user must approve before writing.",
      parameters: {
        type: "object",
        properties: { path: { type: "string" }, content: { type: "string" } },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_in_project",
      description:
        "Search for a text pattern across project files. Returns matching paths, line numbers, and snippets.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          file_pattern: {
            type: "string",
            description: 'Optional extension filter e.g. ".ts"',
          },
        },
        required: ["query"],
      },
    },
  },
] as const;

async function callModel(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
) {
  return requestOpenRouter({
    apiKey,
    model,
    maxTokens: 3000,
    messages,
    tools: [...TOOLS],
    toolChoice: "auto",
    title: "Yolnoma Agent",
  });
}

/** Try models in order; on context/rate-limit error, fall back to the next one */
async function callWithFallback(
  apiKey: string,
  models: string[],
  startIdx: number,
  messages: ChatMessage[],
  onSwitch: (idx: number, msg: string) => void,
): Promise<{ body: OpenRouterResponse; modelIdx: number }> {
  function trim(msgs: ChatMessage[]): ChatMessage[] {
    const system = msgs.find((m) => m.role === "system");
    const rest = msgs.filter((m) => m.role !== "system").slice(-16);
    return system ? [system, ...rest] : rest;
  }

  let currentMessages = messages;
  for (let i = startIdx; i < models.length; i++) {
    try {
      const res = await callModel(apiKey, models[i], currentMessages);
      const errMsg = (res.body.error?.message ?? "") as string;
      const isContextLimit =
        res.status === 400 &&
        (errMsg.toLowerCase().includes("context") ||
          errMsg.toLowerCase().includes("token") ||
          errMsg.toLowerCase().includes("length"));
      const isRateLimit = res.status === 429;

      if ((isContextLimit || isRateLimit) && i < models.length - 1) {
        const reason = isRateLimit ? "rate limit" : "context too large";
        onSwitch(
          i + 1,
          `${models[i]}: ${reason} → switching to ${models[i + 1]}`,
        );
        if (isContextLimit) currentMessages = trim(currentMessages);
        continue;
      }
      return { body: res.body, modelIdx: i };
    } catch {
      if (i < models.length - 1) {
        onSwitch(i + 1, `${models[i]}: error → trying ${models[i + 1]}`);
        continue;
      }
      throw new Error("All models exhausted.");
    }
  }
  throw new Error("No models available.");
}

async function searchInProject(
  rootPath: string,
  allEntries: TreeNode[],
  query: string,
  filePattern: string,
): Promise<string> {
  if (!query.trim()) return "No query provided.";
  const lower = query.toLowerCase();
  const targets = allEntries
    .filter((e) => e.kind === "file" && TEXT_EXT.test(e.name))
    .filter((e) => !filePattern || e.name.includes(filePattern))
    .slice(0, MAX_SEARCH_FILES);
  const results: string[] = [];
  for (const entry of targets) {
    try {
      const content = await invoke<string>("read_codebase_file", {
        rootPath,
        relativePath: entry.rel,
      });
      const hits = content.split("\n").reduce<string[]>((acc, line, idx) => {
        if (line.toLowerCase().includes(lower))
          acc.push(`  L${idx + 1}: ${line.trim().slice(0, 120)}`);
        return acc;
      }, []);
      if (hits.length)
        results.push(
          `${entry.rel} (${hits.length}):\n${hits.slice(0, 8).join("\n")}`,
        );
    } catch {
      /* skip */
    }
  }
  return results.length
    ? results.join("\n\n")
    : `No matches found for "${query}".`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AiAgentPage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  // Project state
  const [rootPath, setRootPath] = useState("");
  const [loadingProject, setLoadingProject] = useState(false);
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [showRecentsMenu, setShowRecentsMenu] = useState(false);

  // Lazy tree
  const [dirMap, setDirMap] = useState<Map<string, TreeNode[]>>(new Map());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loadingDir, setLoadingDir] = useState<Set<string>>(new Set());

  // Search context
  const [allEntries, setAllEntries] = useState<TreeNode[]>([]);

  // Tabs
  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const [activeTabIdx, setActiveTabIdx] = useState(-1);
  const [loadingFile, setLoadingFile] = useState(false);
  const [saving, setSaving] = useState(false);

  // Sidebar
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [sidebarPanel, setSidebarPanel] = useState<SidebarPanel>("explorer");

  // Git
  const [gitChanges, setGitChanges] = useState<GitChange[]>([]);
  const [gitLoading, setGitLoading] = useState(false);
  const [gitError, setGitError] = useState("");

  // Agent
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<
    Array<{ role: "user" | "assistant"; content: string }>
  >([]);
  const [conversation, setConversation] = useState<ChatMessage[]>([]);
  const [apiKey, setApiKey] = useState("");
  const [draftKey, setDraftKey] = useState("");
  const [modelList, setModelList] = useState(DEFAULT_MODELS.map((m) => m.id));
  const [modelNames, setModelNames] = useState(DEFAULT_MODELS);
  const [currentModelIdx, setCurrentModelIdx] = useState(0);
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentError, setAgentError] = useState("");
  const [pendingEdit, setPendingEdit] = useState<PendingEdit | null>(null);
  const [activity, setActivity] = useState<string[]>([]);

  const activeTab = tabs[activeTabIdx] ?? null;

  const projectName = useMemo(() => {
    const parts = rootPath.replace(/\\/g, "/").split("/").filter(Boolean);
    return parts[parts.length - 1] || "Open a project";
  }, [rootPath]);

  // Flat display list from lazy tree (DFS order)
  const flatTree = useMemo(() => {
    const result: TreeNode[] = [];
    function traverse(parentRel: string) {
      for (const node of dirMap.get(parentRel) ?? []) {
        result.push(node);
        if (node.kind === "directory" && expanded.has(node.rel)) {
          traverse(node.rel);
        }
      }
    }
    traverse("");
    return result;
  }, [dirMap, expanded]);

  const systemPrompt = useMemo(
    () =>
      [
        "You are Yolnoma Agent, an expert coding assistant inside a desktop IDE.",
        "Answer in the same language as the user. Work only inside the selected project root.",
        "Use read_file ONLY for files directly needed to answer. Avoid reading many files at once — this wastes tokens.",
        'When user says "UPGRADE README.md" or similar: ONLY read README.md, then write_file to propose improvements. Do not read other files.',
        "Use search_in_project to locate symbols, functions, or strings across the codebase.",
        "When modifying code, use write_file with the complete file content. User approves before writing.",
        `Selected project: ${rootPath || "none"}`,
        `Project tree (top levels):\n${flatTree
          .slice(0, 80)
          .map(
            (e) =>
              `${"  ".repeat(e.depth)}${e.name}${e.kind === "directory" ? "/" : ""}`,
          )
          .join("\n")}`,
      ].join("\n"),
    [flatTree, rootPath],
  );

  // ── Project loader by path (auto-persistence & recent update) ──────────────

  const loadProjectByPath = useCallback(async (folderPath: string) => {
    if (!folderPath) return;
    setLoadingProject(true);
    setAgentError("");
    try {
      const rootChildren = await readFolderChildren(folderPath, "", 0);
      setRootPath(folderPath);
      setLastProjectPath(folderPath);
      const parts = folderPath.replace(/\\/g, "/").split("/").filter(Boolean);
      const pName = parts[parts.length - 1] || "Project";
      setRecentProjects(addRecentProject(folderPath, pName));
      setDirMap(new Map<string, TreeNode[]>([["", rootChildren]]));
      setExpanded(new Set());
      setTabs([]);
      setActiveTabIdx(-1);
      setMessages([]);
      setConversation([]);
      setActivity([]);
      setShowRecentsMenu(false);
      void fullScan(folderPath).then(setAllEntries);
    } catch (err) {
      setLastProjectPath(null);
      setAgentError(
        err instanceof Error ? err.message : "Could not read project folder.",
      );
    } finally {
      setLoadingProject(false);
    }
  }, []);

  // ── Effects ─────────────────────────────────────────────────────────────────

  // Auto-restore project on mount or reload (Ctrl+R support)
  useEffect(() => {
    setRecentProjects(getRecentProjects());
    const lastPath = getLastProjectPath();
    if (lastPath) {
      void loadProjectByPath(lastPath);
    }
  }, [loadProjectByPath]);

  useEffect(() => {
    void getApiKey(getStorageScope(user?.id)).then((k) => {
      setApiKey(k ?? "");
      setDraftKey(k ?? "");
    });
  }, [user?.id]);

  useEffect(() => {
    void fetchOpenRouterModels(apiKey)
      .then(({ models: found }) => {
        if (found.length) {
          setModelNames(found);
          setModelList(found.map((m) => m.id));
          setCurrentModelIdx(0);
        }
      })
      .catch(() => undefined);
  }, [apiKey]);

  const saveActiveTab = useCallback(async () => {
    if (!activeTab || activeTab.kind !== "file" || saving) return;
    setSaving(true);
    try {
      await invoke("write_codebase_file", {
        rootPath,
        relativePath: activeTab.node.rel,
        content: activeTab.content,
      });
      setTabs((cur) =>
        cur.map((t, i) =>
          i === activeTabIdx && t.kind === "file"
            ? { ...t, savedContent: t.content, isPreview: false }
            : t,
        ),
      );
      setActivity((c) => [`saved ${activeTab.node.rel}`, ...c]);
    } catch (err) {
      setAgentError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }, [activeTab, activeTabIdx, rootPath, saving]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "b") {
        e.preventDefault();
        setSidebarVisible((v) => !v);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        void saveActiveTab();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [saveActiveTab]);

  const loadGitChanges = useCallback(() => {
    if (!rootPath) return;
    setGitLoading(true);
    setGitError("");
    invoke<GitChange[]>("get_git_changes", { rootPath })
      .then(setGitChanges)
      .catch((err) => setGitError(String(err)))
      .finally(() => setGitLoading(false));
  }, [rootPath]);

  useEffect(() => {
    if (sidebarPanel === "source-control") loadGitChanges();
  }, [sidebarPanel, loadGitChanges]);

  // ── Open project via file dialog ─────────────────────────────────────────────

  const openProject = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (!selected || Array.isArray(selected)) return;
    const root = typeof selected === "string" ? selected : selected;
    await loadProjectByPath(root);
  };

  // ── Lazy folder expand ───────────────────────────────────────────────────────

  const toggleFolder = async (node: TreeNode) => {
    const { rel, absPath } = node;
    if (expanded.has(rel)) {
      setExpanded((cur) => {
        const n = new Set(cur);
        n.delete(rel);
        return n;
      });
      return;
    }
    if (!dirMap.has(rel)) {
      setLoadingDir((cur) => new Set(cur).add(rel));
      const children = await readFolderChildren(absPath, rel, node.depth + 1);
      setDirMap((cur) => new Map(cur).set(rel, children));
      setAllEntries((cur) => {
        const existing = new Set(cur.map((e) => e.rel));
        const newOnes = children.filter((c) => !existing.has(c.rel));
        return [...cur, ...newOnes];
      });
      setLoadingDir((cur) => {
        const n = new Set(cur);
        n.delete(rel);
        return n;
      });
    }
    setExpanded((cur) => new Set(cur).add(rel));
  };

  // ── File tabs (VS Code preview tab pattern) ──────────────────────────────────

  const openFileTab = async (node: TreeNode, forcePin = false) => {
    if (node.kind === "directory") {
      await toggleFolder(node);
      return;
    }
    const existing = tabs.findIndex(
      (t) => t.kind === "file" && t.node.rel === node.rel,
    );
    if (existing !== -1) {
      if (forcePin) {
        setTabs((cur) =>
          cur.map((t, i) => (i === existing ? { ...t, isPreview: false } : t)),
        );
      }
      setActiveTabIdx(existing);
      return;
    }
    setLoadingFile(true);
    try {
      const content = await invoke<string>("read_codebase_file", {
        rootPath,
        relativePath: node.rel,
      });
      const truncated =
        content.length > MAX_FILE_CHARS
          ? `${content.slice(0, MAX_FILE_CHARS)}\n\n… truncated …`
          : content;
      const newTab: FileTab = {
        kind: "file",
        node,
        content: truncated,
        savedContent: truncated,
        isPreview: !forcePin,
      };

      setTabs((cur) => {
        const previewIdx = cur.findIndex(
          (t) =>
            t.isPreview && (t.kind === "diff" || t.content === t.savedContent),
        );
        if (previewIdx !== -1 && !forcePin) {
          const next = [...cur];
          next[previewIdx] = newTab;
          setActiveTabIdx(previewIdx);
          return next;
        }
        setActiveTabIdx(cur.length);
        return [...cur, newTab];
      });
    } catch (err) {
      setAgentError(
        err instanceof Error ? err.message : "Could not open file.",
      );
    } finally {
      setLoadingFile(false);
    }
  };

  const openDiffTab = (change: GitChange, forcePin = false) => {
    const existing = tabs.findIndex(
      (t) => t.kind === "diff" && t.change.path === change.path,
    );
    if (existing !== -1) {
      if (forcePin) {
        setTabs((cur) =>
          cur.map((t, i) => (i === existing ? { ...t, isPreview: false } : t)),
        );
      }
      setActiveTabIdx(existing);
      return;
    }
    const newTab: DiffTab = {
      kind: "diff",
      change,
      isPreview: !forcePin,
    };
    setTabs((cur) => {
      const previewIdx = cur.findIndex(
        (t) =>
          t.isPreview && (t.kind === "diff" || t.content === t.savedContent),
      );
      if (previewIdx !== -1 && !forcePin) {
        const next = [...cur];
        next[previewIdx] = newTab;
        setActiveTabIdx(previewIdx);
        return next;
      }
      setActiveTabIdx(cur.length);
      return [...cur, newTab];
    });
  };

  const pinTab = (idx: number) => {
    setTabs((cur) =>
      cur.map((t, i) => (i === idx ? { ...t, isPreview: false } : t)),
    );
  };

  const closeTab = (idx: number) => {
    setTabs((cur) => {
      const next = cur.filter((_, i) => i !== idx);
      setActiveTabIdx((a) => {
        if (a === idx) return Math.min(idx, next.length - 1);
        return a > idx ? a - 1 : a;
      });
      return next;
    });
  };

  const updateTabContent = (content: string) => {
    setTabs((cur) =>
      cur.map((t, i) =>
        i === activeTabIdx && t.kind === "file"
          ? { ...t, content, isPreview: false }
          : t,
      ),
    );
  };

  // ── Agent edit approval ──────────────────────────────────────────────────────

  const approveEdit = async (allow: boolean) => {
    if (!pendingEdit) return;
    const edit = pendingEdit;
    setPendingEdit(null);
    if (!allow) {
      setConversation((c) => [
        ...c,
        { role: "tool", tool_call_id: edit.call.id, content: "User denied." },
      ]);
      return;
    }
    setSaving(true);
    try {
      await invoke("write_codebase_file", {
        rootPath,
        relativePath: edit.path,
        content: edit.content,
      });
      setActivity((c) => [`saved ${edit.path}`, ...c]);
      setTabs((cur) =>
        cur.map((t) =>
          t.kind === "file" && t.node.rel === edit.path
            ? {
                ...t,
                content: edit.content,
                savedContent: edit.content,
                isPreview: false,
              }
            : t,
        ),
      );
      setConversation((c) => [
        ...c,
        {
          role: "tool",
          tool_call_id: edit.call.id,
          content: `Wrote ${edit.path}.`,
        },
      ]);
    } catch (err) {
      setAgentError(err instanceof Error ? err.message : "Write failed.");
      setConversation((c) => [
        ...c,
        {
          role: "tool",
          tool_call_id: edit.call.id,
          content: `Write failed: ${String(err)}`,
        },
      ]);
    } finally {
      setSaving(false);
    }
  };

  // ── Send prompt (with model fallback) ───────────────────────────────────────

  const sendPrompt = async () => {
    const text = prompt.trim();
    if (!text || agentLoading) return;
    if (!apiKey.trim()) {
      setAgentError("OpenRouter API key kiriting.");
      return;
    }
    if (!rootPath) {
      setAgentError("Avval project folder oching.");
      return;
    }
    setPrompt("");
    setAgentError("");
    setAgentLoading(true);
    setActivity((c) => ["thinking…", ...c]);
    const nextConv: ChatMessage[] = [
      ...conversation,
      { role: "user", content: text },
    ];
    setConversation(nextConv);
    setMessages((c) => [...c, { role: "user", content: text }]);

    let modelIdx = currentModelIdx;

    try {
      let working: ChatMessage[] = [
        { role: "system", content: systemPrompt },
        ...nextConv,
      ];
      for (let iter = 0; iter < 8; iter += 1) {
        const { body, modelIdx: usedIdx } = await callWithFallback(
          apiKey.trim(),
          modelList,
          modelIdx,
          working,
          (newIdx, msg) => {
            modelIdx = newIdx;
            setCurrentModelIdx(newIdx);
            setActivity((c) => [msg, ...c]);
          },
        );
        if (body.error) throw new Error(body.error.message || "API error");
        const msg = body.choices?.[0]?.message;
        if (!msg) throw new Error("No response from model.");
        modelIdx = usedIdx;
        working = [
          ...working,
          {
            role: "assistant",
            content: msg.content || "",
            tool_calls: msg.tool_calls,
          },
        ];
        if (!msg.tool_calls?.length) {
          setConversation(working.slice(1));
          setMessages((c) => [
            ...c,
            { role: "assistant", content: msg.content || "" },
          ]);
          return;
        }
        for (const call of msg.tool_calls) {
          let args: {
            path?: string;
            content?: string;
            query?: string;
            file_pattern?: string;
          } = {};
          try {
            args = JSON.parse(call.function.arguments) as typeof args;
          } catch {
            /* ignore */
          }
          if (call.function.name === "search_in_project") {
            const q = args.query ?? "";
            setActivity((c) => [`searching: "${q}"`, ...c]);
            const result = await searchInProject(
              rootPath,
              allEntries,
              q,
              args.file_pattern ?? "",
            );
            working = [
              ...working,
              { role: "tool", tool_call_id: call.id, content: result },
            ];
            continue;
          }
          const relPath = args.path ?? "";
          if (
            !relPath ||
            relPath.includes("..") ||
            /^[\\/]|^[A-Za-z]:/.test(relPath)
          ) {
            throw new Error("Agent returned an invalid path.");
          }
          if (call.function.name === "read_file") {
            setActivity((c) => [`reading ${relPath}`, ...c]);
            const fc = await invoke<string>("read_codebase_file", {
              rootPath,
              relativePath: relPath,
            });
            working = [
              ...working,
              {
                role: "tool",
                tool_call_id: call.id,
                content: fc.slice(0, MAX_FILE_CHARS),
              },
            ];
          } else if (call.function.name === "write_file") {
            if (typeof args.content !== "string")
              throw new Error("Agent did not provide file content.");
            setPendingEdit({ call, path: relPath, content: args.content });
            setAgentLoading(false);
            setConversation(working.slice(1));
            return;
          }
        }
      }
      throw new Error("Agent step limit reached.");
    } catch (err) {
      setAgentError(err instanceof Error ? err.message : String(err));
    } finally {
      setAgentLoading(false);
    }
  };

  const saveKey = async () => {
    const clean = draftKey.trim();
    await saveApiKey(getStorageScope(user?.id), clean);
    setApiKey(clean);
    setAgentError("");
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <main className="flex h-screen min-h-0 flex-col bg-[var(--bg-base)] text-[var(--text-primary)]">
      {/* Top bar */}
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-white/[0.08] bg-[#11100d] px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-[var(--accent-dim)] text-[var(--accent)]">
            <Bot size={14} />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--accent)]">
              Yolnoma Agent
            </p>
            <p className="truncate text-[11px] font-medium text-white">
              {projectName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {currentModelIdx > 0 && (
            <span className="rounded bg-amber-400/15 px-2 py-0.5 text-[10px] text-amber-300">
              fallback:{" "}
              {getShortModelName(
                modelNames[currentModelIdx] ?? {
                  id: modelList[currentModelIdx],
                  name: modelList[currentModelIdx],
                },
              )}
            </span>
          )}

          {/* Recent projects dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowRecentsMenu((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[11px] text-white/70 hover:border-[var(--accent-border)] hover:text-white transition-colors"
              title={t("ai.recentProjects")}
            >
              <History size={12} />
              <span className="hidden sm:inline">{t("ai.recents")}</span>
              <ChevronDown
                size={10}
                className={`transition-transform ${showRecentsMenu ? "rotate-180" : ""}`}
              />
            </button>

            {showRecentsMenu && (
              <div className="absolute right-0 top-full mt-1.5 z-50 w-72 rounded-xl border border-white/10 bg-[#161410] p-1.5 shadow-2xl backdrop-blur-md">
                <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-white/[0.07] mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">
                    Recent Projects
                  </span>
                  <span className="text-[9px] text-white/25">
                    {recentProjects.length} saved
                  </span>
                </div>
                {recentProjects.length === 0 ? (
                  <p className="px-3 py-3 text-center text-xs text-white/30">
                    No recent projects.
                  </p>
                ) : (
                  <div className="max-h-60 overflow-y-auto space-y-0.5">
                    {recentProjects.map((p) => (
                      <div
                        key={p.path}
                        className={`group flex items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs transition-colors cursor-pointer ${
                          p.path === rootPath
                            ? "bg-[var(--accent-dim)] text-[var(--accent)] font-medium"
                            : "text-white/70 hover:bg-white/[0.06] hover:text-white"
                        }`}
                        onClick={() => void loadProjectByPath(p.path)}
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <p className="truncate text-[11px]">{p.name}</p>
                          <p className="truncate text-[9px] text-white/30 font-mono">
                            {p.path}
                          </p>
                        </div>
                        <button
                          type="button"
                          title={t("ai.removeRecent")}
                          onClick={(e) => {
                            e.stopPropagation();
                            setRecentProjects(removeRecentProject(p.path));
                          }}
                          className="opacity-0 group-hover:opacity-100 flex h-4 w-4 shrink-0 items-center justify-center rounded text-white/30 hover:bg-white/10 hover:text-red-300"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={openProject}
            className="inline-flex items-center gap-1.5 rounded border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[11px] text-white/70 hover:border-[var(--accent-border)] hover:text-white"
          >
            <FolderOpen size={12} /> Open folder
          </button>

          <button
            type="button"
            onClick={() => void getCurrentWindow().close()}
            className="inline-flex items-center gap-1.5 rounded border border-red-400/20 bg-red-400/10 px-2.5 py-1.5 text-[11px] font-semibold text-red-200 hover:bg-red-400/20"
          >
            <X size={12} /> Exit
          </button>
        </div>
      </header>

      {/* No project workspace */}
      {!rootPath ? (
        <section className="flex min-h-0 flex-1 items-center justify-center p-6 overflow-y-auto">
          <div className="w-full max-w-xl border border-white/[0.09] bg-[#111109] p-8 text-center rounded-2xl shadow-2xl">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent-dim)] text-[var(--accent)]">
              <FolderOpen size={24} />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--accent)]">
              PROJECT WORKSPACE
            </p>
            <h1 className="mt-2 font-serif text-2xl text-white">
              Open a project to begin
            </h1>
            <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-white/40">
              VSCode-style workspace with lazy tree, preview tabs, side-by-side
              diff with word wrap, and AI codebase assistant.
            </p>
            <div className="mt-5 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={openProject}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-[#1b120e] hover:bg-[#e08a6b] transition-all shadow-md"
              >
                <FolderOpen size={14} /> Choose folder
              </button>
            </div>

            {recentProjects.length > 0 && (
              <div className="mt-7 border-t border-white/[0.08] pt-5 text-left">
                <div className="flex items-center justify-between mb-2.5 px-1">
                  <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white/40">
                    <Clock size={11} className="text-[var(--accent)]" /> Recent
                    Projects
                  </span>
                  <span className="text-[9px] text-white/25 font-mono">
                    {recentProjects.length} saved
                  </span>
                </div>

                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {recentProjects.map((item) => (
                    <div
                      key={item.path}
                      className="group flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-2 hover:border-[var(--accent-border)] hover:bg-white/[0.05] transition-all cursor-pointer"
                      onClick={() => void loadProjectByPath(item.path)}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-amber-400/10 text-amber-300">
                          <Folder size={12} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-white truncate group-hover:text-[var(--accent)] transition-colors">
                            {item.name}
                          </p>
                          <p
                            className="text-[9px] text-white/35 font-mono truncate"
                            title={item.path}
                          >
                            {item.path}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[9px] text-white/25">
                          {new Date(item.lastOpened).toLocaleDateString()}
                        </span>
                        <button
                          type="button"
                          title={t("ai.removeRecent")}
                          onClick={(e) => {
                            e.stopPropagation();
                            setRecentProjects(removeRecentProject(item.path));
                          }}
                          className="opacity-0 group-hover:opacity-100 flex h-4 w-4 items-center justify-center rounded text-white/30 hover:bg-white/10 hover:text-red-300"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {agentError && (
              <p className="mt-3 text-xs text-red-300 bg-red-400/10 rounded-lg p-2">
                {agentError}
              </p>
            )}
          </div>
        </section>
      ) : (
        <div className="flex min-h-0 flex-1">
          {/* ── Activity Bar (Modular component) ── */}
          <AgentActivityBar
            sidebarVisible={sidebarVisible}
            sidebarPanel={sidebarPanel}
            gitChangesCount={gitChanges.length}
            onTogglePanel={(panel) => {
              if (sidebarPanel === panel) {
                setSidebarVisible((v) => !v);
              } else {
                setSidebarPanel(panel);
                setSidebarVisible(true);
              }
            }}
          />

          {/* ── Explorer Panel (Modular component) ── */}
          {sidebarVisible && sidebarPanel === "explorer" && (
            <AgentExplorerPanel
              flatTree={flatTree}
              expanded={expanded}
              loadingDir={loadingDir}
              loadingProject={loadingProject}
              activeRel={
                activeTab?.kind === "file" ? activeTab.node.rel : undefined
              }
              onToggleFolder={toggleFolder}
              onOpenFileTab={openFileTab}
              onOpenProject={openProject}
            />
          )}

          {/* ── Source Control Panel (Modular component) ── */}
          {sidebarVisible && sidebarPanel === "source-control" && (
            <AgentSourceControlPanel
              gitChanges={gitChanges}
              gitLoading={gitLoading}
              gitError={gitError}
              activePath={
                activeTab?.kind === "diff" ? activeTab.change.path : undefined
              }
              onOpenDiffTab={openDiffTab}
              onRefresh={loadGitChanges}
            />
          )}

          {/* ── Editor Tabs & Content ── */}
          <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-[#15130f]">
            {/* Tab bar */}
            <div className="flex h-9 shrink-0 items-end overflow-x-auto border-b border-white/[0.07] bg-[#0f0e0b]">
              {tabs.length === 0 ? (
                <div className="flex items-center gap-2 px-4 py-2 text-xs text-white/20">
                  <FileText size={12} /> Select a file from Explorer
                </div>
              ) : (
                tabs.map((tab, i) => {
                  const isActive = i === activeTabIdx;
                  const isDirty =
                    tab.kind === "file" && tab.content !== tab.savedContent;
                  const label =
                    tab.kind === "file"
                      ? tab.node.name
                      : `${tab.change.path.split("/").pop()} ↕`;
                  const icon =
                    tab.kind === "diff" ? (
                      <FileDiff size={11} className="text-amber-300/60" />
                    ) : isDirty ? (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-white/50" />
                    ) : (
                      <span className="text-[var(--accent)]/50">
                        <FileText size={11} />
                      </span>
                    );
                  return (
                    <div
                      key={
                        tab.kind === "file"
                          ? tab.node.rel
                          : `diff-${tab.change.path}`
                      }
                      className={`group flex h-full shrink-0 cursor-pointer select-none items-center gap-1.5 border-r border-white/[0.07] px-3 text-[11px] transition-colors ${
                        isActive
                          ? "border-t border-t-[var(--accent)] bg-[#15130f] text-white"
                          : "text-white/35 hover:bg-white/[0.04] hover:text-white/60"
                      }`}
                      onClick={() => setActiveTabIdx(i)}
                      onDoubleClick={() => pinTab(i)}
                      title={
                        tab.isPreview
                          ? `${label} (Preview tab — double-click to pin)`
                          : label
                      }
                    >
                      {icon}
                      <span
                        className={`max-w-[130px] truncate ${
                          tab.isPreview
                            ? "italic opacity-90"
                            : "not-italic font-medium"
                        }`}
                      >
                        {label}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          closeTab(i);
                        }}
                        className="ml-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded text-white/20 hover:bg-white/10 hover:text-white"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Breadcrumb + save for file tabs */}
            {activeTab && activeTab.kind === "file" && (
              <div className="flex shrink-0 items-center justify-between border-b border-white/[0.05] px-4 py-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="truncate text-[10px] text-white/25">
                    {activeTab.node.rel}
                  </span>
                  {activeTab.isPreview && (
                    <span className="text-[9px] text-white/20 italic font-mono">
                      (preview)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {activeTab.content !== activeTab.savedContent && (
                    <span className="text-[10px] text-amber-300/60">
                      ● unsaved
                    </span>
                  )}
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void saveActiveTab()}
                    className="inline-flex items-center gap-1 rounded bg-[var(--accent)] px-2 py-0.5 text-[10px] font-semibold text-[#1b120e] disabled:opacity-50"
                  >
                    <Save size={10} /> Ctrl+S
                  </button>
                </div>
              </div>
            )}

            {/* File content / Diff */}
            <div className="min-h-0 flex-1 overflow-hidden flex flex-col">
              {loadingFile ? (
                <div className="flex items-center gap-2 p-5 text-xs text-white/40">
                  <span className="animate-spin text-xs">⟳</span> Reading…
                </div>
              ) : !activeTab ? (
                <div className="flex h-full items-center justify-center text-white/15">
                  <div className="text-center">
                    <FileText className="mx-auto mb-3 opacity-20" size={40} />
                    <p className="text-sm">{t("ai.selectFile")}</p>
                    <p className="mt-1 text-xs">
                      or click a changed file in Source Control to view diff
                    </p>
                  </div>
                </div>
              ) : activeTab.kind === "diff" ? (
                <SideBySideDiffViewer
                  filePath={activeTab.change.path}
                  diff={activeTab.change.diff}
                  status={activeTab.change.status}
                />
              ) : (
                <textarea
                  value={activeTab.content}
                  onChange={(e) => updateTabContent(e.target.value)}
                  className="h-full min-h-full w-full resize-none bg-transparent p-5 font-mono text-[12px] leading-6 text-white/75 outline-none overflow-auto"
                  spellCheck={false}
                />
              )}
            </div>

            {agentError && (
              <p className="shrink-0 border-t border-red-400/10 bg-red-400/5 px-4 py-2 text-xs text-red-300">
                {agentError}
              </p>
            )}
          </section>

          {/* ── Agent Chat Panel (Modular component) ── */}
          <AgentChatPanel
            messages={messages}
            activity={activity}
            prompt={prompt}
            agentLoading={agentLoading}
            apiKey={apiKey}
            draftKey={draftKey}
            modelList={modelList}
            modelNames={modelNames}
            currentModelIdx={currentModelIdx}
            onDraftKeyChange={setDraftKey}
            onSaveKey={() => void saveKey()}
            onModelChange={setCurrentModelIdx}
            onPromptChange={setPrompt}
            onSendPrompt={() => void sendPrompt()}
          />
        </div>
      )}

      {/* ── Edit approval modal (Modular component) ── */}
      <AgentEditApprovalModal
        pendingEdit={pendingEdit}
        onApprove={(allow) => void approveEdit(allow)}
      />
    </main>
  );
}
