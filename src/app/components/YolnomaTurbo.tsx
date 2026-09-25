import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  AlertOctagon,
  Bug,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Crosshair,
  Globe,
  Info,
  Layers,
  LoaderCircle,
  Minus,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  Terminal,
  Trash2,
} from "lucide-react";
import {
  useUpdaterStore,
  type DevPreviewStage,
} from "@/shared/stores/updaterStore";
import { useTurboStore } from "../turbo/turboStore";
import type { TurboLogLevel } from "../turbo/turboTypes";

const UPDATER_STAGES: Array<{ label: string; value: DevPreviewStage }> = [
  { label: "Available", value: "update-available" },
  { label: "Preparing", value: "preparing" },
  { label: "Downloading", value: "downloading" },
  { label: "Installing", value: "installing" },
  { label: "Complete", value: "complete" },
  { label: "Error", value: "error" },
];

type PositionMode = "left" | "center" | "right" | "custom";
type Point = { x: number; y: number };

const STORAGE_KEY = "yolnoma.turbo.v3";
const PANEL_WIDTH = 500;
const PANEL_HEIGHT = 560;
const COMPACT_SIZE = 48;

function readSavedState() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (!value || typeof value !== "object") return null;
    return {
      mode: ["left", "center", "right", "custom"].includes(value.mode)
        ? (value.mode as PositionMode)
        : "right",
      compact: typeof value.compact === "boolean" ? value.compact : true,
      custom: {
        x: Number.isFinite(Number(value.custom?.x))
          ? Number(value.custom?.x)
          : 16,
        y: Number.isFinite(Number(value.custom?.y))
          ? Number(value.custom?.y)
          : 16,
      },
    };
  } catch {
    return null;
  }
}

function saveState(mode: PositionMode, compact: boolean, custom: Point) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ mode, compact, custom }),
    );
  } catch {
    // Local storage may be restricted in some environments
  }
}

export default function YolnomaTurbo() {
  const [compact, setCompact] = useState(
    () => readSavedState()?.compact ?? true,
  );
  const [mode, setMode] = useState<PositionMode>(
    () => readSavedState()?.mode ?? "right",
  );
  const [custom, setCustom] = useState<Point>(
    () => readSavedState()?.custom ?? { x: 16, y: 16 },
  );
  const [dragging, setDragging] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filters & Search
  const [errorSearch, setErrorSearch] = useState("");
  const [consoleSearch, setConsoleSearch] = useState("");
  const [consoleLevel, setConsoleLevel] = useState<TurboLogLevel | "all">(
    "all",
  );
  const [networkSearch, setNetworkSearch] = useState("");
  const [networkFilter, setNetworkFilter] = useState<
    "all" | "2xx" | "4xx/5xx" | "pending"
  >("all");

  // Expanded details in tabs
  const [expandedErrorId, setExpandedErrorId] = useState<string | null>(null);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [expandedReqId, setExpandedReqId] = useState<string | null>(null);

  // Previews local state
  const [splashPreview, setSplashPreview] = useState<
    "standard" | "loading" | null
  >(null);
  const [showRouteLoadingPreview, setShowRouteLoadingPreview] = useState(false);

  // Turbo store state
  const {
    errors,
    logs,
    requests,
    activeTab,
    setActiveTab,
    clearErrors,
    clearLogs,
    clearRequests,
    resetAll,
  } = useTurboStore();

  // Updater store
  const {
    previewUpdate,
    previewUpdaterStage,
    reset: resetUpdaterPreview,
    devPreview,
    modalOpen,
  } = useUpdaterStore();

  const dragRef = useRef<{
    pointerX: number;
    pointerY: number;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    saveState(mode, compact, custom);
  }, [mode, compact, custom]);

  useEffect(() => {
    const closeOtherPreviews = () => {
      setShowRouteLoadingPreview(false);
      setSplashPreview(null);
    };
    window.addEventListener("yolnoma:close-all-previews", closeOtherPreviews);
    return () =>
      window.removeEventListener(
        "yolnoma:close-all-previews",
        closeOtherPreviews,
      );
  }, []);

  const getPositionStyle = useCallback((): React.CSSProperties => {
    const base: React.CSSProperties = compact
      ? {}
      : {
          width: PANEL_WIDTH,
          maxWidth: "calc(100vw - 32px)",
          height: PANEL_HEIGHT,
          maxHeight: "calc(100vh - 32px)",
        };

    if (mode === "custom") {
      return { ...base, left: custom.x, top: custom.y };
    }
    const horizontal =
      mode === "left"
        ? { left: 16 }
        : mode === "right"
          ? { right: 16 }
          : { left: "50%", transform: "translateX(-50%)" };
    return { ...base, ...horizontal, bottom: 16 };
  }, [compact, custom, mode]);

  const resetCustomPosition = () => {
    setMode("right");
    setCustom({ x: 16, y: 16 });
  };

  const beginDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (compact) return;
    const element = event.currentTarget.closest("aside");
    if (!element) return;
    const rect = element.getBoundingClientRect();
    dragRef.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      x: rect.left,
      y: rect.top,
    };
    setMode("custom");
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = dragRef.current;
    if (!start) return;
    const width = compact ? COMPACT_SIZE : PANEL_WIDTH;
    const height = compact ? COMPACT_SIZE : PANEL_HEIGHT;
    const x = Math.max(
      8,
      Math.min(
        window.innerWidth - width - 8,
        start.x + event.clientX - start.pointerX,
      ),
    );
    const y = Math.max(
      8,
      Math.min(
        window.innerHeight - height - 8,
        start.y + event.clientY - start.pointerY,
      ),
    );
    setCustom({ x, y });
  };

  const endDrag = () => {
    dragRef.current = null;
    setDragging(false);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  // Preview helpers
  const handlePreviewSplash = (variant: "standard" | "loading") => {
    window.dispatchEvent(new CustomEvent("yolnoma:close-all-previews"));
    setSplashPreview(variant);
    window.dispatchEvent(
      new CustomEvent("yolnoma:preview-splash", { detail: { variant } }),
    );
  };

  const handleCloseSplash = () => {
    setSplashPreview(null);
    window.dispatchEvent(new CustomEvent("yolnoma:hide-splash"));
  };

  const handleToggleUpdater = () => {
    if (devPreview && modalOpen) resetUpdaterPreview();
    else {
      window.dispatchEvent(new CustomEvent("yolnoma:close-all-previews"));
      previewUpdate();
    }
  };

  const handleToggleUpdaterStage = (stage: DevPreviewStage) => {
    if (devPreview && modalOpen) resetUpdaterPreview();
    else {
      window.dispatchEvent(new CustomEvent("yolnoma:close-all-previews"));
      previewUpdaterStage(stage);
    }
  };

  const handlePreviewRouteLoading = () => {
    window.dispatchEvent(new CustomEvent("yolnoma:close-all-previews"));
    setShowRouteLoadingPreview(true);
    window.dispatchEvent(new CustomEvent("yolnoma:preview-route-loading"));
  };

  const handleCloseRouteLoading = () => {
    setShowRouteLoadingPreview(false);
    window.dispatchEvent(new CustomEvent("yolnoma:hide-route-loading"));
  };

  // Quick Action triggers
  const triggerTestRuntimeError = () => {
    setTimeout(() => {
      throw new Error(
        "[Turbo Test] Uncaught runtime exception from Turbo Quick Actions",
      );
    }, 0);
  };

  const triggerTestUnhandledRejection = () => {
    Promise.reject(
      new Error(
        "[Turbo Test] Unhandled promise rejection from Turbo Quick Actions",
      ),
    );
  };

  const triggerSampleLogs = () => {
    console.info("[Turbo Test] Application loaded in development mode.", {
      env: "development",
      tauri: true,
    });
    console.log("[Turbo Test] Fetched cached user preferences.", {
      theme: "dark",
      language: "uz",
    });
    console.warn(
      "[Turbo Test] Slow frame render detected (simulated 32ms task).",
    );
    console.error(
      "[Turbo Test] Simulated network connection failure to mock analytics server.",
    );
  };

  const triggerTestFetch = () => {
    fetch("https://httpbin.org/status/200?test=yolnoma_turbo").catch(() => {});
    fetch("https://httpbin.org/status/404?test=not_found").catch(() => {});
  };

  // Filtered collections
  const filteredErrors = useMemo(() => {
    return errors.filter((err) => {
      if (!errorSearch) return true;
      const q = errorSearch.toLowerCase();
      return (
        err.message.toLowerCase().includes(q) ||
        (err.stack && err.stack.toLowerCase().includes(q)) ||
        err.type.toLowerCase().includes(q)
      );
    });
  }, [errors, errorSearch]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (consoleLevel !== "all" && log.level !== consoleLevel) return false;
      if (!consoleSearch) return true;
      return log.formattedMessage
        .toLowerCase()
        .includes(consoleSearch.toLowerCase());
    });
  }, [logs, consoleLevel, consoleSearch]);

  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      if (networkFilter === "pending" && req.networkStatus !== "pending")
        return false;
      if (
        networkFilter === "2xx" &&
        (!req.status || req.status < 200 || req.status >= 300)
      )
        return false;
      if (networkFilter === "4xx/5xx" && (!req.status || req.status < 400))
        return false;
      if (!networkSearch) return true;
      const q = networkSearch.toLowerCase();
      return (
        req.url.toLowerCase().includes(q) ||
        req.method.toLowerCase().includes(q)
      );
    });
  }, [requests, networkFilter, networkSearch]);

  if (!import.meta.env.DEV) return null;

  // Compact floating button
  if (compact) {
    return (
      <aside
        className="fixed z-[999999] select-none"
        style={getPositionStyle()}
      >
        <button
          type="button"
          aria-label="Open Yolnoma Turbo DevTools"
          title="Open Yolnoma Turbo DevTools"
          onClick={() => setCompact(false)}
          className="group relative flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-[#181410]/95 text-white shadow-2xl shadow-black/50 backdrop-blur-xl transition hover:scale-105 hover:border-[#D97757]/50"
        >
          <Bug
            size={20}
            className="text-[#D97757] transition group-hover:rotate-12"
          />

          {/* Badge for Errors */}
          {errors.length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-lg shadow-red-500/50 animate-pulse">
              {errors.length > 99 ? "99+" : errors.length}
            </span>
          )}

          {/* Badge for Warnings if no errors */}
          {errors.length === 0 && logs.some((l) => l.level === "warn") && (
            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 rounded-full bg-amber-500 ring-2 ring-[#181410]" />
          )}
        </button>
      </aside>
    );
  }

  return (
    <aside
      className={`fixed z-[999999] flex flex-col overflow-hidden rounded-xl border border-white/10 bg-[#181410]/95 text-[#F2EDE6] shadow-2xl shadow-black/70 backdrop-blur-2xl ${
        dragging ? "cursor-grabbing" : ""
      }`}
      style={getPositionStyle()}
    >
      {/* Header / Draggable Toolbar */}
      <div
        role="toolbar"
        onPointerDown={beginDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="flex cursor-grab touch-none items-center justify-between border-b border-white/[0.08] px-3.5 py-2.5 bg-black/40 select-none"
      >
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#D97757]/15 border border-[#D97757]/30 text-[#D97757]">
            <Bug size={14} />
          </div>
          <span className="text-xs font-semibold tracking-wide text-white">
            Yolnoma Turbo
          </span>
          <span className="rounded bg-white/[0.08] px-1.5 py-0.5 text-[9px] font-mono font-medium text-white/50 uppercase">
            DevTools
          </span>
          <div className="flex items-center gap-1.5 ml-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          </div>
        </div>

        <div
          className="flex items-center gap-1"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            title="Reset position"
            aria-label="Reset position"
            onClick={resetCustomPosition}
            className="rounded-lg p-1.5 text-white/40 hover:bg-white/[0.08] hover:text-white transition"
          >
            <RotateCcw size={13} />
          </button>
          <button
            type="button"
            title="Compact mode"
            aria-label="Compact mode"
            onClick={() => setCompact(true)}
            className="rounded-lg p-1.5 text-white/40 hover:bg-white/[0.08] hover:text-white transition"
          >
            <Minus size={13} />
          </button>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center border-b border-white/[0.08] bg-black/20 px-2 py-1 gap-1 text-[11px] overflow-x-auto no-scrollbar select-none">
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-medium transition cursor-pointer ${
            activeTab === "overview"
              ? "bg-[#D97757]/20 text-[#D97757] border border-[#D97757]/30"
              : "text-white/60 hover:bg-white/[0.05] hover:text-white"
          }`}
        >
          <Layers size={13} />
          Overview
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("errors")}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-medium transition cursor-pointer relative ${
            activeTab === "errors"
              ? "bg-red-500/20 text-red-400 border border-red-500/30"
              : "text-white/60 hover:bg-white/[0.05] hover:text-white"
          }`}
        >
          <AlertOctagon size={13} />
          Errors
          {errors.length > 0 && (
            <span className="ml-0.5 rounded-full bg-red-500 px-1.5 py-0.2 text-[9px] font-bold text-white leading-none">
              {errors.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("console")}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-medium transition cursor-pointer ${
            activeTab === "console"
              ? "bg-[#D97757]/20 text-[#D97757] border border-[#D97757]/30"
              : "text-white/60 hover:bg-white/[0.05] hover:text-white"
          }`}
        >
          <Terminal size={13} />
          Console
          {logs.length > 0 && (
            <span className="ml-0.5 rounded-full bg-white/10 px-1.5 py-0.2 text-[9px] font-mono text-white/70 leading-none">
              {logs.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("network")}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-medium transition cursor-pointer ${
            activeTab === "network"
              ? "bg-[#D97757]/20 text-[#D97757] border border-[#D97757]/30"
              : "text-white/60 hover:bg-white/[0.05] hover:text-white"
          }`}
        >
          <Globe size={13} />
          Network
          {requests.length > 0 && (
            <span className="ml-0.5 rounded-full bg-white/10 px-1.5 py-0.2 text-[9px] font-mono text-white/70 leading-none">
              {requests.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("preview")}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-medium transition cursor-pointer ${
            activeTab === "preview"
              ? "bg-[#D97757]/20 text-[#D97757] border border-[#D97757]/30"
              : "text-white/60 hover:bg-white/[0.05] hover:text-white"
          }`}
        >
          <Sparkles size={13} />
          Preview
        </button>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 text-xs space-y-3">
        {/* TAB 1: OVERVIEW */}
        {activeTab === "overview" && (
          <div className="space-y-4">
            {/* Status Card */}
            <div className="rounded-xl border border-white/[0.08] bg-black/30 p-3">
              <div className="flex items-center justify-between text-[11px] mb-2">
                <span className="text-white/50 uppercase tracking-wider font-mono">
                  Runtime Environment
                </span>
                <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />{" "}
                  Vite DEV Active
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-white/[0.06] text-center">
                <div className="rounded-lg bg-black/40 p-2">
                  <span className="text-[10px] text-white/40 block">
                    Errors
                  </span>
                  <span
                    className={`text-base font-bold font-mono ${errors.length > 0 ? "text-red-400" : "text-white/80"}`}
                  >
                    {errors.length}
                  </span>
                </div>
                <div className="rounded-lg bg-black/40 p-2">
                  <span className="text-[10px] text-white/40 block">
                    Console Logs
                  </span>
                  <span className="text-base font-bold font-mono text-white/80">
                    {logs.length}
                  </span>
                </div>
                <div className="rounded-lg bg-black/40 p-2">
                  <span className="text-[10px] text-white/40 block">
                    Requests
                  </span>
                  <span className="text-base font-bold font-mono text-white/80">
                    {requests.length}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions Card */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-white/40 font-mono">
                  Quick Actions
                </span>
                <button
                  type="button"
                  onClick={resetAll}
                  className="inline-flex items-center gap-1 text-[10px] text-white/40 hover:text-red-400 transition"
                >
                  <Trash2 size={11} /> Clear All Turbo Data
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-2.5 font-medium text-white/80 hover:bg-white/[0.08] hover:text-white transition"
                >
                  <RefreshCw size={13} className="text-[#D97757]" />
                  Reload App
                </button>

                <button
                  type="button"
                  onClick={triggerSampleLogs}
                  className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-2.5 font-medium text-white/80 hover:bg-white/[0.08] hover:text-white transition"
                >
                  <Terminal size={13} className="text-sky-400" />
                  Emit Sample Logs
                </button>

                <button
                  type="button"
                  onClick={triggerTestRuntimeError}
                  className="flex items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 p-2.5 font-medium text-red-300 hover:bg-red-500/10 transition"
                >
                  <AlertCircle size={13} className="text-red-400" />
                  Test Runtime Error
                </button>

                <button
                  type="button"
                  onClick={triggerTestUnhandledRejection}
                  className="flex items-center justify-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-2.5 font-medium text-amber-300 hover:bg-amber-500/10 transition"
                >
                  <AlertOctagon size={13} className="text-amber-400" />
                  Test Rejection
                </button>

                <button
                  type="button"
                  onClick={triggerTestFetch}
                  className="col-span-2 flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-2.5 font-medium text-white/80 hover:bg-white/[0.08] hover:text-white transition"
                >
                  <Globe size={13} className="text-emerald-400" />
                  Trigger Test Fetch Calls
                </button>
              </div>
            </div>

            {/* Position Settings */}
            <div className="rounded-xl border border-white/[0.08] bg-black/30 p-3 space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-white/50 uppercase tracking-wider font-mono">
                  Panel Position
                </span>
                <span className="text-[10px] text-white/40">
                  {mode === "custom"
                    ? `${Math.round(custom.x)}px × ${Math.round(custom.y)}px`
                    : mode}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {(["left", "center", "right", "custom"] as PositionMode[]).map(
                  (m) => (
                    <button
                      key={m}
                      type="button"
                      disabled={m === "custom" && mode !== "custom"}
                      onClick={() => setMode(m)}
                      className={`rounded-lg border px-2 py-1.5 text-[10px] capitalize transition ${
                        mode === m
                          ? "border-[#D97757] bg-[#D97757]/20 text-white font-medium"
                          : "border-white/[0.06] text-white/50 hover:bg-white/[0.05] hover:text-white"
                      }`}
                    >
                      {m === "custom" && (
                        <Crosshair size={10} className="mr-1 inline" />
                      )}
                      {m}
                    </button>
                  ),
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: ERRORS */}
        {activeTab === "errors" && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="relative flex-1">
                <Search
                  size={12}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30"
                />
                <input
                  type="text"
                  placeholder="Search errors or stack trace..."
                  value={errorSearch}
                  onChange={(e) => setErrorSearch(e.target.value)}
                  className="w-full rounded-lg bg-black/40 border border-white/[0.08] py-1.5 pl-8 pr-2.5 text-[11px] text-white placeholder-white/30 focus:border-[#D97757]/50 focus:outline-none"
                />
              </div>
              {errors.length > 0 && (
                <button
                  type="button"
                  onClick={clearErrors}
                  className="flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1.5 text-[10px] text-white/50 hover:text-white hover:bg-white/[0.06] transition"
                >
                  <Trash2 size={11} /> Clear
                </button>
              )}
            </div>

            {filteredErrors.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-white/40 space-y-1.5">
                <Check size={28} className="text-emerald-400/80 mb-1" />
                <p className="font-medium text-white/70">No errors detected</p>
                <p className="text-[11px]">
                  Runtime exceptions, React crashes, and promise rejections will
                  appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredErrors.map((err) => {
                  const isExpanded = expandedErrorId === err.id;
                  const errorTypeBadge =
                    err.type === "react"
                      ? "bg-purple-500/20 text-purple-300 border-purple-500/30"
                      : err.type === "runtime"
                        ? "bg-red-500/20 text-red-300 border-red-500/30"
                        : err.type === "unhandled-rejection"
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                          : "bg-blue-500/20 text-blue-300 border-blue-500/30";

                  const fullText = `${err.type.toUpperCase()}: ${err.message}\n\nStack:\n${err.stack || "No stack"}\n\nComponent Stack:\n${err.componentStack || "N/A"}`;

                  return (
                    <div
                      key={err.id}
                      className="rounded-xl border border-red-500/25 bg-red-950/20 p-2.5 space-y-1.5 transition"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`rounded border px-1.5 py-0.5 text-[9px] font-mono font-medium ${errorTypeBadge}`}
                          >
                            {err.type}
                          </span>
                          <span className="text-[10px] font-mono text-white/40">
                            {new Date(err.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(fullText, err.id)}
                          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-white/50 hover:text-white hover:bg-white/[0.08] transition"
                        >
                          {copiedId === err.id ? (
                            <Check size={11} className="text-emerald-400" />
                          ) : (
                            <Copy size={11} />
                          )}
                          {copiedId === err.id ? "Copied" : "Copy"}
                        </button>
                      </div>

                      <p className="text-[11px] font-mono text-red-200 font-medium break-words leading-relaxed">
                        {err.message}
                      </p>

                      {err.source && (
                        <p className="text-[10px] font-mono text-white/40 truncate">
                          {err.source}:{err.lineno}:{err.colno}
                        </p>
                      )}

                      {(err.stack || err.componentStack) && (
                        <div className="pt-1 border-t border-white/[0.06]">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedErrorId(isExpanded ? null : err.id)
                            }
                            className="flex items-center gap-1 text-[10px] text-white/50 hover:text-white transition"
                          >
                            {isExpanded ? (
                              <ChevronDown size={11} />
                            ) : (
                              <ChevronRight size={11} />
                            )}
                            {isExpanded
                              ? "Hide Stack Trace"
                              : "View Stack Trace"}
                          </button>

                          {isExpanded && (
                            <div className="mt-2 space-y-2">
                              {err.stack && (
                                <div>
                                  <span className="text-[9px] font-mono uppercase tracking-wider text-white/40 block mb-1">
                                    Stack Trace
                                  </span>
                                  <pre className="max-h-36 overflow-y-auto rounded-lg bg-black/60 p-2 font-mono text-[10px] text-white/70 whitespace-pre-wrap break-all border border-white/5">
                                    {err.stack}
                                  </pre>
                                </div>
                              )}
                              {err.componentStack && (
                                <div>
                                  <span className="text-[9px] font-mono uppercase tracking-wider text-white/40 block mb-1">
                                    React Component Stack
                                  </span>
                                  <pre className="max-h-36 overflow-y-auto rounded-lg bg-black/60 p-2 font-mono text-[10px] text-purple-300 whitespace-pre-wrap break-all border border-purple-500/10">
                                    {err.componentStack}
                                  </pre>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: CONSOLE */}
        {activeTab === "console" && (
          <div className="space-y-2.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <div className="relative flex-1 min-w-[140px]">
                <Search
                  size={12}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30"
                />
                <input
                  type="text"
                  placeholder="Filter console..."
                  value={consoleSearch}
                  onChange={(e) => setConsoleSearch(e.target.value)}
                  className="w-full rounded-lg bg-black/40 border border-white/[0.08] py-1.5 pl-8 pr-2.5 text-[11px] text-white placeholder-white/30 focus:border-[#D97757]/50 focus:outline-none"
                />
              </div>

              {/* Level Filter Buttons */}
              <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded-lg border border-white/[0.06]">
                {(
                  ["all", "log", "info", "warn", "error", "debug"] as const
                ).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setConsoleLevel(lvl)}
                    className={`rounded px-1.5 py-0.5 text-[10px] uppercase font-mono transition ${
                      consoleLevel === lvl
                        ? "bg-white/10 text-white font-medium"
                        : "text-white/40 hover:text-white"
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>

              {logs.length > 0 && (
                <button
                  type="button"
                  onClick={clearLogs}
                  className="rounded-lg border border-white/10 p-1.5 text-white/50 hover:text-white hover:bg-white/[0.06] transition"
                  title="Clear Console"
                >
                  <Trash2 size={11} />
                </button>
              )}
            </div>

            {filteredLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-white/40 space-y-1.5">
                <Terminal size={24} className="text-white/20 mb-1" />
                <p className="font-medium text-white/60">No console output</p>
                <p className="text-[11px]">
                  console.log, info, warn, and error calls will be captured here
                  in real-time.
                </p>
              </div>
            ) : (
              <div className="space-y-1 rounded-xl border border-white/[0.08] bg-black/40 p-1 font-mono text-[11px] divide-y divide-white/[0.04]">
                {filteredLogs.map((log) => {
                  const isExpanded = expandedLogId === log.id;
                  const levelColor =
                    log.level === "error"
                      ? "text-red-400 bg-red-500/10"
                      : log.level === "warn"
                        ? "text-amber-400 bg-amber-500/10"
                        : log.level === "info"
                          ? "text-sky-400 bg-sky-500/10"
                          : log.level === "debug"
                            ? "text-purple-400 bg-purple-500/10"
                            : "text-white/80";

                  return (
                    <div
                      key={log.id}
                      className={`p-1.5 rounded transition hover:bg-white/[0.03] ${
                        log.level === "error" ? "bg-red-500/[0.04]" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-hidden">
                          <span className="text-[9px] text-white/30 shrink-0">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                          <span
                            className={`rounded px-1 text-[9px] uppercase font-bold shrink-0 ${levelColor}`}
                          >
                            {log.level}
                          </span>
                          {log.count > 1 && (
                            <span className="rounded-full bg-white/10 px-1.5 text-[9px] font-bold text-white/60 shrink-0">
                              {log.count}
                            </span>
                          )}
                          <span
                            onClick={() =>
                              setExpandedLogId(isExpanded ? null : log.id)
                            }
                            className="truncate cursor-pointer hover:underline text-white/90 min-w-0 flex-1"
                            title={log.formattedMessage}
                          >
                            {log.formattedMessage}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            copyToClipboard(log.formattedMessage, log.id)
                          }
                          className="p-1 text-white/30 hover:text-white shrink-0"
                          title="Copy log"
                        >
                          {copiedId === log.id ? (
                            <Check size={10} className="text-emerald-400" />
                          ) : (
                            <Copy size={10} />
                          )}
                        </button>
                      </div>

                      {isExpanded && (
                        <pre className="mt-1.5 max-h-40 overflow-y-auto rounded bg-black/60 p-2 text-[10px] text-white/80 whitespace-pre-wrap break-all border border-white/5">
                          {log.formattedMessage}
                        </pre>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: NETWORK */}
        {activeTab === "network" && (
          <div className="space-y-2.5">
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <div className="relative flex-1 min-w-[120px]">
                <Search
                  size={12}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30"
                />
                <input
                  type="text"
                  placeholder="Filter URL or method..."
                  value={networkSearch}
                  onChange={(e) => setNetworkSearch(e.target.value)}
                  className="w-full rounded-lg bg-black/40 border border-white/[0.08] py-1.5 pl-8 pr-2.5 text-[11px] text-white placeholder-white/30 focus:border-[#D97757]/50 focus:outline-none"
                />
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-0.5 bg-black/40 p-0.5 rounded-lg border border-white/[0.06] shrink-0">
                {(["all", "2xx", "4xx/5xx", "pending"] as const).map(
                  (filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setNetworkFilter(filter)}
                      className={`rounded px-1.5 py-0.5 text-[10px] uppercase font-mono transition ${
                        networkFilter === filter
                          ? "bg-white/10 text-white font-medium"
                          : "text-white/40 hover:text-white"
                      }`}
                    >
                      {filter}
                    </button>
                  ),
                )}
              </div>

              {requests.length > 0 && (
                <button
                  type="button"
                  onClick={clearRequests}
                  className="rounded-lg border border-white/10 p-1.5 text-white/50 hover:text-white hover:bg-white/[0.06] transition shrink-0"
                  title="Clear Requests"
                >
                  <Trash2 size={11} />
                </button>
              )}
            </div>

            {filteredRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-white/40 space-y-1.5">
                <Globe size={24} className="text-white/20 mb-1" />
                <p className="font-medium text-white/60">No network requests</p>
                <p className="text-[11px]">
                  Outgoing fetch and XMLHttpRequest calls will be recorded here.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5 min-w-0">
                {filteredRequests.map((req) => {
                  const isExpanded = expandedReqId === req.id;
                  const statusColor =
                    req.networkStatus === "pending"
                      ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
                      : req.status && req.status >= 200 && req.status < 300
                        ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                        : "text-red-400 bg-red-500/10 border-red-500/20";

                  const methodColor =
                    req.method === "GET"
                      ? "text-emerald-400"
                      : req.method === "POST"
                        ? "text-sky-400"
                        : req.method === "DELETE"
                          ? "text-red-400"
                          : "text-amber-400";

                  return (
                    <div
                      key={req.id}
                      className="rounded-xl border border-white/[0.08] bg-black/30 p-2 space-y-1.5 transition hover:border-white/15 min-w-0 overflow-hidden"
                    >
                      <div
                        className="flex items-center justify-between gap-2 min-w-0 w-full cursor-pointer"
                        onClick={() =>
                          setExpandedReqId(isExpanded ? null : req.id)
                        }
                      >
                        <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
                          <span
                            className={`text-[10px] font-mono font-bold shrink-0 ${methodColor}`}
                          >
                            {req.method}
                          </span>
                          <span
                            className={`rounded border px-1.5 py-0.2 text-[9px] font-mono font-medium shrink-0 ${statusColor}`}
                          >
                            {req.networkStatus === "pending"
                              ? "..."
                              : req.status || "ERR"}
                          </span>
                          <span
                            className="text-[11px] font-mono text-white/80 truncate min-w-0 flex-1"
                            title={req.url}
                          >
                            {req.url}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 text-[10px] font-mono text-white/40">
                          {req.durationMs !== undefined && (
                            <span>{req.durationMs}ms</span>
                          )}
                          {isExpanded ? (
                            <ChevronDown size={12} />
                          ) : (
                            <ChevronRight size={12} />
                          )}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="mt-2 pt-2 border-t border-white/[0.06] space-y-2 text-[10px] font-mono">
                          <div>
                            <span className="text-white/40 block mb-0.5">
                              Request URL:
                            </span>
                            <span className="text-white/90 break-all select-all">
                              {req.url}
                            </span>
                          </div>

                          {req.requestBody && (
                            <div>
                              <div className="flex items-center justify-between text-white/40 mb-0.5">
                                <span>Request Body:</span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    copyToClipboard(
                                      req.requestBody || "",
                                      `req_${req.id}`,
                                    )
                                  }
                                  className="text-[9px] hover:text-white"
                                >
                                  {copiedId === `req_${req.id}`
                                    ? "Copied"
                                    : "Copy"}
                                </button>
                              </div>
                              <pre className="max-h-32 overflow-y-auto rounded bg-black/60 p-2 text-white/70 whitespace-pre-wrap break-all border border-white/5">
                                {req.requestBody}
                              </pre>
                            </div>
                          )}

                          {req.responseBody && (
                            <div>
                              <div className="flex items-center justify-between text-white/40 mb-0.5">
                                <span>
                                  Response Preview{" "}
                                  {req.responseSize
                                    ? `(${req.responseSize} bytes)`
                                    : ""}
                                  :
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    copyToClipboard(
                                      req.responseBody || "",
                                      `res_${req.id}`,
                                    )
                                  }
                                  className="text-[9px] hover:text-white"
                                >
                                  {copiedId === `res_${req.id}`
                                    ? "Copied"
                                    : "Copy"}
                                </button>
                              </div>
                              <pre className="max-h-36 overflow-y-auto rounded bg-black/60 p-2 text-white/70 whitespace-pre-wrap break-all border border-white/5">
                                {req.responseBody}
                              </pre>
                            </div>
                          )}

                          {req.error && (
                            <div className="text-red-400">
                              <span className="text-white/40 block mb-0.5">
                                Network Error:
                              </span>
                              <span>{req.error}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: PREVIEWS */}
        {activeTab === "preview" && (
          <div className="space-y-4">
            <p className="text-[11px] leading-relaxed text-white/50">
              Instant design and state previews. Test UI components and updater
              modals in real-time without relaunching the app.
            </p>

            {/* Splash Screen Previews */}
            <div className="rounded-xl border border-white/[0.08] bg-black/30 p-3 space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-white/40 font-mono block">
                Splash Screen Visual Preview
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    splashPreview === "standard"
                      ? handleCloseSplash()
                      : handlePreviewSplash("standard")
                  }
                  className={`flex items-center justify-center gap-2 rounded-xl border p-2.5 text-xs font-semibold transition ${
                    splashPreview === "standard"
                      ? "border-[#D97757] bg-[#D97757]/20 text-white"
                      : "border-white/10 bg-white/[0.04] text-white/80 hover:bg-white/[0.08] hover:text-white"
                  }`}
                >
                  <Sparkles size={13} className="text-[#D97757]" />
                  {splashPreview === "standard"
                    ? "Close Splash"
                    : "Splash (Standard)"}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    splashPreview === "loading"
                      ? handleCloseSplash()
                      : handlePreviewSplash("loading")
                  }
                  className={`flex items-center justify-center gap-2 rounded-xl border p-2.5 text-xs font-semibold transition ${
                    splashPreview === "loading"
                      ? "border-[#D97757] bg-[#D97757]/20 text-white"
                      : "border-white/10 bg-white/[0.04] text-white/80 hover:bg-white/[0.08] hover:text-white"
                  }`}
                >
                  <LoaderCircle size={13} className="text-[#D97757]" />
                  {splashPreview === "loading"
                    ? "Close Splash"
                    : "Splash (Loading)"}
                </button>
              </div>
            </div>

            {/* Auto-Updater Visual Previews */}
            <div className="rounded-xl border border-white/[0.08] bg-black/30 p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-white/40 font-mono">
                  Auto-Updater Previews
                </span>
                {devPreview && modalOpen && (
                  <span className="text-[10px] text-[#D97757] font-medium">
                    Modal Active
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={handleToggleUpdater}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#D97757] to-[#e0896b] px-3 py-2.5 text-xs font-semibold text-white shadow-lg shadow-[#D97757]/20 transition hover:brightness-110"
              >
                <Play size={13} />
                {devPreview && modalOpen
                  ? "Close Updater Preview"
                  : "Preview Complete Update Flow"}
              </button>

              <div className="pt-1">
                <span className="text-[10px] text-white/40 block mb-1.5">
                  Direct Stage Jump:
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {UPDATER_STAGES.map((stage) => (
                    <button
                      key={stage.value}
                      type="button"
                      onClick={() => handleToggleUpdaterStage(stage.value)}
                      className="rounded-lg border border-white/[0.08] bg-black/40 px-2 py-1.5 text-[10px] text-white/60 transition hover:border-white/20 hover:text-white"
                    >
                      {stage.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Route Loading Fallback Preview */}
            <div className="rounded-xl border border-white/[0.08] bg-black/30 p-3 space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-white/40 font-mono block">
                Lazy Load Route Fallback
              </span>
              <button
                type="button"
                onClick={
                  showRouteLoadingPreview
                    ? handleCloseRouteLoading
                    : handlePreviewRouteLoading
                }
                className={`w-full flex items-center justify-center gap-2 rounded-xl border p-2.5 text-xs font-semibold transition ${
                  showRouteLoadingPreview
                    ? "border-[#D97757] bg-[#D97757]/20 text-white"
                    : "border-white/10 bg-white/[0.04] text-white/80 hover:bg-white/[0.08] hover:text-white"
                }`}
              >
                <LoaderCircle size={13} />
                {showRouteLoadingPreview
                  ? "Close Lazy Load Preview"
                  : "Preview Route Loading Fallback"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="flex items-center justify-between border-t border-white/[0.08] bg-black/40 px-3 py-2 text-[10px] text-white/40 select-none">
        <span className="inline-flex items-center gap-1.5">
          <Info size={11} className="text-[#D97757]" />
          Isolated Dev Layer
        </span>
        <span>Drag header to move</span>
      </div>
    </aside>
  );
}
