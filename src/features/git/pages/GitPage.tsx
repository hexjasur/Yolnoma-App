import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  FolderClock,
  GitBranch,
  GitCommitHorizontal,
  History,
  Trash2,
} from "lucide-react";
import ToolNavigation from "@/features/developer-tools/components/ToolNavigation";
import CommitGenerator from "../components/CommitGenerator";
import CommitHistoryGraph from "../components/CommitHistoryGraph";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "@/shared/ui/Toast";
import {
  clearRecentGitFolders,
  listRecentGitFolders,
  rememberGitFolder,
  removeRecentGitFolder,
} from "../storage/recentFolders";

type Tab = "commit-generator" | "history-graph";
type TabDefinition = [Tab, string, LucideIcon];
type GitChange = { path: string; status: string; diff: string };
const tabs: TabDefinition[] = [
  ["commit-generator", "Commit Generator", GitBranch],
  ["history-graph", "History Graph", History],
];
const tabIds = new Set<Tab>(tabs.map(([id]) => id));
function readTabFromUrl(): Tab {
  const query = window.location.hash.split("?")[1];
  const value = query ? new URLSearchParams(query).get("tab") : null;
  return value && tabIds.has(value as Tab)
    ? (value as Tab)
    : "commit-generator";
}

export default function GitPage() {
  const [tab, setTab] = useState<Tab>(readTabFromUrl);
  const [folderPath, setFolderPath] = useState("");
  const [changes, setChanges] = useState<GitChange[]>([]);
  const [recentFolders, setRecentFolders] = useState<string[]>([]);

  useEffect(() => {
    const onHashChange = () => setTab(readTabFromUrl());
    window.addEventListener("hashchange", onHashChange);
    void listRecentGitFolders().then(setRecentFolders);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const selectTab = (next: Tab) => {
    setTab(next);
    window.location.hash = `#/tools/git?tab=${next}`;
  };

  const refreshChanges = async (path = folderPath) => {
    if (!path) return;
    try {
      const next = await invoke<GitChange[]>("get_git_changes", {
        rootPath: path,
      });
      setChanges(next);
      if (!next.length) toast.info("No modified or new Git files found");
    } catch (value) {
      setChanges([]);
      toast.error(value instanceof Error ? value.message : String(value));
    }
  };

  const changeFolder = (path: string) => {
    setFolderPath(path);
    setChanges([]);
    setRecentFolders((current) =>
      [path, ...current.filter((item) => item !== path)].slice(0, 8),
    );
    void rememberGitFolder(path)
      .then(setRecentFolders)
      .catch((value) => {
        toast.error(
          value instanceof Error
            ? value.message
            : "Could not save this project to Recent projects",
        );
      });
  };

  const selectRecentFolder = (path: string) => {
    changeFolder(path);
    void refreshChanges(path);
  };

  const removeRecentFolder = async (path: string) => {
    const next = await removeRecentGitFolder(path);
    setRecentFolders(next);
    if (folderPath === path) {
      setFolderPath("");
      setChanges([]);
    }
  };

  const clearRecentFolders = async () => {
    await clearRecentGitFolders();
    setRecentFolders([]);
  };

  return (
    <div className="mx-auto min-h-full max-w-7xl pb-16 text-[var(--text-primary)]">
      <header className="border-b border-white/[0.08] pb-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
          Git Workspace
        </p>
        <div className="mt-3 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <h1 className="font-serif text-4xl font-medium tracking-tight text-white md:text-5xl">
              A clearer view of your Git story
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/45">
              Generate thoughtful commit options from current changes or explore
              the branch timeline without leaving Yolnoma.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-white/35">
            <GitCommitHorizontal size={14} className="text-emerald-400" /> Local
            repository workspace
          </div>
        </div>
      </header>
      <div className="mt-8">
        <ToolNavigation items={tabs} active={tab} onChange={selectTab} />
        {tab === "commit-generator" && (
          <section className="mt-5 border border-white/[0.08] bg-black/10 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
                  <FolderClock size={14} className="text-[var(--accent)]" />{" "}
                  Recent projects
                </span>
                <p className="mt-1 text-[10px] text-white/25">
                  Your last generated Git workspaces appear here.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void clearRecentFolders()}
                disabled={!recentFolders.length}
                className="text-[10px] text-white/35 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-30"
              >
                Clear all
              </button>
            </div>
            {recentFolders.length ? (
              <div className="grid gap-2 md:grid-cols-2">
                {recentFolders.map((path) => (
                  <div
                    key={path}
                    className="flex min-w-0 items-center gap-2 border border-white/[0.07] bg-white/[0.02] px-3 py-2"
                  >
                    <button
                      type="button"
                      onClick={() => selectRecentFolder(path)}
                      title={path}
                      className="min-w-0 flex-1 truncate text-left font-mono text-xs text-white/60 hover:text-white"
                    >
                      {path}
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeRecentFolder(path)}
                      aria-label={`Remove ${path}`}
                      title="Remove from recent folders"
                      className="shrink-0 p-1 text-white/25 hover:text-red-300"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="border border-dashed border-white/[0.09] px-4 py-5 text-center text-xs text-white/35">
                No recent projects yet. Select a Git folder below to save it
                here.
              </div>
            )}
            <p className="mt-3 text-[10px] text-white/25">
              Stored in the app data file{" "}
              <code>yolnoma-git-recent-folders.json</code>, not localStorage.
            </p>
          </section>
        )}
        <main className="mt-8 min-w-0">
          {tab === "commit-generator" && (
            <CommitGenerator
              folderPath={folderPath}
              changes={changes}
              onFolderChange={changeFolder}
              onRefresh={refreshChanges}
            />
          )}
          {tab === "history-graph" && (
            <CommitHistoryGraph
              folderPath={folderPath}
              onFolderChange={changeFolder}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export { tabs };
export type { Tab };
