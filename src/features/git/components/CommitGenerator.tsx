import { useEffect, useMemo, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  AlertCircle,
  Clock,
  Copy,
  FileCode2,
  FolderOpen,
  KeyRound,
  Loader2,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import ApiKeyModal from "@/features/ai/components/ApiKeyModal";
import { getApiKey, saveApiKey } from "@/features/ai/storage";
import {
  fetchOpenRouterModels,
  isLimitError,
  requestChatCompletion,
} from "@/features/ai/api/openRouterApi";
import {
  DEFAULT_MODELS,
  type OpenRouterModel,
  type ProxyResponse,
} from "@/features/ai/types";
import { toast } from "@/shared/ui/Toast";
import {
  ToolCard,
  ToolTitle,
} from "@/features/developer-tools/components/ToolShell";
import { SelectMenu } from "@/shared/ui";
import { SYSTEM_CONTEXT } from "../context/systemContext";
import {
  listRecentGitFolders,
  rememberGitFolder,
  removeRecentGitFolder,
} from "../storage/recentFolders";

type GitChange = { path: string; status: string; diff: string };
type CommitVariant = { title: string; message: string };

const MAX_CONTEXT_CHARS = 100_000;

const VARIANT_TITLES = [
  "Simple summary",
  "Detailed summary",
  "Best practice + Commitlint",
  "Best practice detailed + Commitlint",
];

function buildPrompt(changes: GitChange[]) {
  let used = 0;
  const sections: string[] = [];
  for (const change of changes) {
    const section = `FILE: ${change.path}\nSTATUS: ${change.status}\nDIFF:\n${change.diff}`;
    if (used + section.length > MAX_CONTEXT_CHARS) break;
    sections.push(section);
    used += section.length;
  }
  return `Write four commit message variants from only these current Git changes. Do not infer unlisted work.\n\n${sections.join("\n\n---\n\n")}`;
}

function parseVariants(raw: string): CommitVariant[] {
  const cleaned = raw
    .replace(/^```(?:text|markdown)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const headerRegex =
    /\[(SIMPLE|DETAILED|BEST PRACTICE DETAILED|BEST PRACTICE)\]/gi;

  const matches = [...cleaned.matchAll(headerRegex)];

  if (matches.length !== 4) {
    return [{ title: VARIANT_TITLES[0], message: cleaned }];
  }

  const variants = matches.map((match, index) => {
    const start = (match.index ?? 0) + match[0].length;
    const end =
      index + 1 < matches.length
        ? (matches[index + 1].index ?? cleaned.length)
        : cleaned.length;

    return {
      title: VARIANT_TITLES[index],
      message: cleaned.slice(start, end).trim(),
    };
  });

  return variants;
}

function folderName(path: string) {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

export default function CommitGenerator({
  folderPath,
  changes,
  onFolderChange,
  onRefresh,
}: {
  folderPath: string;
  changes: GitChange[];
  onFolderChange: (path: string) => void;
  onRefresh: (path?: string) => Promise<void>;
}) {
  const { user } = useAuth();
  const [loadingChanges, setLoadingChanges] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [variants, setVariants] = useState<CommitVariant[]>([]);
  const [error, setError] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [draftKey, setDraftKey] = useState("");
  const [apiKeyReady, setApiKeyReady] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [models, setModels] = useState<OpenRouterModel[]>(DEFAULT_MODELS);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODELS[0].id);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [fallbackNote, setFallbackNote] = useState("");
  const [recentFolders, setRecentFolders] = useState(listRecentGitFolders);

  useEffect(() => {
    getApiKey(user?.id ?? "").then((key) => {
      setApiKey(key ?? "");
      setDraftKey(key ?? "");
      setApiKeyReady(true);
    });
  }, [user?.id]);

  useEffect(() => {
    if (!apiKeyReady) return;
    let cancelled = false;
    setModelsLoading(true);
    fetchOpenRouterModels(apiKey)
      .then(({ response, models: available }) => {
        if (
          cancelled ||
          response.status < 200 ||
          response.status >= 300 ||
          !available.length
        )
          return;
        const ordered = [
          ...available.filter((model) =>
            DEFAULT_MODELS.some((fallback) => fallback.id === model.id),
          ),
          ...available.filter(
            (model) =>
              !DEFAULT_MODELS.some((fallback) => fallback.id === model.id),
          ),
        ];
        setModels(ordered);
        setSelectedModel((current) =>
          ordered.some((model) => model.id === current)
            ? current
            : ordered[0].id,
        );
      })
      .catch(() => {
        /* Built-in models remain available. */
      })
      .finally(() => {
        if (!cancelled) setModelsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiKey, apiKeyReady]);

  const rememberFolder = (path: string) => {
    setRecentFolders(rememberGitFolder(path));
  };

  const selectFolder = async (path: string) => {
    onFolderChange(path);
    rememberFolder(path);
    setLoadingChanges(true);
    setVariants([]);
    setError("");
    await onRefresh(path);
    setLoadingChanges(false);
  };

  const pickFolder = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (!selected || typeof selected !== "string") return;
    await selectFolder(selected);
  };

  const removeRecentFolder = (path: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setRecentFolders(removeRecentGitFolder(path));
  };

  const saveKey = async () => {
    const cleanKey = draftKey.trim();
    if (!cleanKey) return;
    await saveApiKey(user?.id ?? "", cleanKey);
    setApiKey(cleanKey);
    setShowKeyModal(false);
    toast.success("OpenRouter API key saved securely");
  };

  const generateCommit = async () => {
    if (!apiKey) {
      setShowKeyModal(true);
      return;
    }
    if (!changes.length) {
      setError("Select a Git folder with modified or new files first.");
      return;
    }
    setGenerating(true);
    setError("");
    setFallbackNote("");
    setVariants([]);
    const candidates = [
      selectedModel,
      ...models.map((model) => model.id).filter((id) => id !== selectedModel),
    ];
    try {
      let lastError = "No model was able to generate commit variants.";
      for (let index = 0; index < candidates.length; index += 1) {
        const model = candidates[index];
        const response: ProxyResponse = await requestChatCompletion(
          apiKey,
          model,
          [{ role: "user", content: buildPrompt(changes) }],
          SYSTEM_CONTEXT,
        );
        const providerError =
          response.body.error?.message ?? `HTTP ${response.status}`;
        const content = response.body.choices?.[0]?.message?.content?.trim();
        if (response.status >= 200 && response.status < 300 && content) {
          setVariants(parseVariants(content));
          setSelectedModel(model);
          if (index > 0)
            setFallbackNote(
              `Primary model limit reached. Continued automatically with ${model}.`,
            );
          toast.success("4 commit variants generated");
          return;
        }
        lastError = providerError;
        if (!isLimitError(response.status, providerError)) break;
      }
      setError(lastError);
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value));
    } finally {
      setGenerating(false);
    }
  };

  const copyMessage = async (message: string) => {
    await navigator.clipboard.writeText(message);
    toast.success("Commit message copied");
  };

  const changedFiles = useMemo(
    () =>
      changes
        .map((change) => `${change.status || "M "} ${change.path}`)
        .join("\n"),
    [changes],
  );

  return (
    <ToolCard>
      <ToolTitle
        icon={Sparkles}
        text="Git Commit Generator"
        subtitle="Generate commit message options from your current changes. Copy is available; direct commit and push are temporarily disabled."
      />

      {/* Compact top toolbar */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void pickFolder()}
          className="inline-flex items-center gap-1.5 border border-[var(--accent)] bg-[var(--accent-glow)] px-3 py-1.5 text-xs font-semibold text-[var(--accent)] hover:bg-[var(--accent-dim)]"
        >
          <FolderOpen size={14} /> Select Git folder
        </button>
        {folderPath && (
          <button
            type="button"
            onClick={() => {
              setLoadingChanges(true);
              void onRefresh().finally(() => setLoadingChanges(false));
            }}
            className="inline-flex items-center gap-1.5 border border-white/10 px-3 py-1.5 text-xs text-white/60 hover:text-white"
          >
            <RefreshCw
              size={13}
              className={loadingChanges ? "animate-spin" : ""}
            />
            Refresh
          </button>
        )}
        <button
          type="button"
          onClick={() => setShowKeyModal(true)}
          className="ml-auto inline-flex items-center gap-1.5 text-xs text-white/45 hover:text-white"
        >
          <KeyRound size={13} />
          {apiKey ? "Change API key" : "OpenRouter API key"}
        </button>
      </div>

      {folderPath && (
        <p
          className="mt-3 truncate border border-white/[0.08] bg-black/20 px-3 py-2 font-mono text-[11px] text-white/50"
          title={folderPath}
        >
          {folderPath}
        </p>
      )}

      {/* Recent folders on the left, generated commit workspace on the right. */}
      <div className="mt-5 grid gap-5 lg:grid-cols-[200px_minmax(0,1fr)]">
        <div className="min-w-0 lg:col-start-2 lg:row-start-1">
          {loadingChanges && (
            <div className="flex items-center gap-2 text-xs text-white/45">
              <Loader2 size={14} className="animate-spin" /> Git changes
              loading...
            </div>
          )}

          {!loadingChanges && folderPath && !changes.length && !error && (
            <div className="border border-dashed border-white/10 p-6 text-center text-xs text-white/40">
              Working tree clean — no change.
            </div>
          )}

          {changes.length > 0 && (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
                  Changed files ({changes.length})
                </span>
                <span className="text-[10px] text-emerald-300/70">
                  Only these diffs are analyzed.
                </span>
              </div>
              <div className="max-h-40 overflow-auto border border-white/[0.08] bg-black/20">
                {changes.map((change) => (
                  <div
                    key={`${change.status}-${change.path}`}
                    className="flex items-center gap-2.5 border-b border-white/[0.06] px-3 py-2 last:border-0"
                  >
                    <FileCode2
                      size={13}
                      className="shrink-0 text-[var(--accent)]"
                    />
                    <span className="w-6 shrink-0 font-mono text-[11px] text-emerald-300/70">
                      {change.status || "M"}
                    </span>
                    <span className="truncate font-mono text-[11px] text-white/70">
                      {change.path}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 flex items-start gap-2 border border-red-400/20 bg-red-400/[0.06] p-3 text-xs text-red-200">
              <AlertCircle size={14} className="mt-0.5 shrink-0" /> {error}
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-white/[0.08] pt-4">
            <SelectMenu
              value={selectedModel}
              onChange={setSelectedModel}
              options={models.map((model) => ({
                value: model.id,
                label: model.name ?? model.id,
              }))}
              ariaLabel="Select AI model"
              className="min-w-40"
              disabled={modelsLoading}
            />
            <button
              type="button"
              onClick={() => void generateCommit()}
              disabled={generating || !changes.length}
              className={`group/generate relative inline-flex items-center gap-2 overflow-hidden bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-black shadow-[0_4px_18px_-5px_var(--accent)] transition duration-200 hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 ${generating ? "animate-pulse" : ""}`}
            >
              {generating && (
                <span className="pointer-events-none absolute inset-0 animate-pulse bg-white/15" />
              )}
              {generating ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Sparkles size={15} />
              )}
              {generating ? "Being created..." : "Create 4 variants"}
            </button>
          </div>

          {fallbackNote && (
            <p className="mt-3 border-l-2 border-amber-300/70 pl-3 text-[11px] leading-5 text-amber-200/80">
              {fallbackNote}
            </p>
          )}

          {variants.length > 0 && (
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {variants.map((variant) => (
                <article
                  key={variant.title}
                  className="border border-white/[0.08] bg-black/20 p-4"
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
                      {variant.title}
                    </span>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => void copyMessage(variant.message)}
                        aria-label={`Copy ${variant.title} commit message`}
                        className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1 text-[11px] font-medium text-white/65 transition hover:border-white/25 hover:bg-white/[0.05] hover:text-white focus:outline-none focus:ring-2 focus:ring-white/20"
                      >
                        <Copy size={12} /> Copy
                      </button>
                    </div>
                  </div>
                  <textarea
                    readOnly
                    value={variant.message}
                    className="min-h-36 w-full resize-y border border-white/[0.08] bg-[#0d0d0a] p-3 font-mono text-[11px] leading-5 text-emerald-100/80 outline-none"
                  />
                </article>
              ))}
            </div>
          )}

          <p className="sr-only">{changedFiles}</p>
        </div>

        {/* Recent folders — separate grid on the right */}
        <aside className="lg:col-start-1 lg:row-start-1 lg:border-r lg:border-white/[0.08] lg:pr-5">
          <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
            <Clock size={12} /> Recent folders
          </div>
          {recentFolders.length === 0 ? (
            <p className="text-[11px] text-white/30">No folder selected yet.</p>
          ) : (
            <div className="grid grid-cols-1 gap-1.5">
              {recentFolders.map((path) => (
                <div
                  key={path}
                  className={`group flex items-center gap-2 border px-2.5 py-2 text-left text-[11px] transition ${
                    path === folderPath
                      ? "border-[var(--accent)] bg-[var(--accent-glow)] text-[var(--accent)]"
                      : "border-white/[0.08] bg-black/20 text-white/60 hover:border-white/20 hover:text-white"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => void selectFolder(path)}
                    title={path}
                    className="min-w-0 flex-1 truncate text-left font-mono"
                  >
                    {folderName(path)}
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${path} from recent folders`}
                    title="Remove from recent folders"
                    className="shrink-0 opacity-0 transition hover:text-red-300 group-hover:opacity-70 hover:!opacity-100"
                    onClick={(event) => removeRecentFolder(path, event)}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>

      {showKeyModal && (
        <ApiKeyModal
          draftKey={draftKey}
          onDraftKeyChange={setDraftKey}
          onSave={() => void saveKey()}
          onDismiss={() => setShowKeyModal(false)}
        />
      )}
    </ToolCard>
  );
}
