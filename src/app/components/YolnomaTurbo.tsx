import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bug,
  Check,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Crosshair,
  LoaderCircle,
  Minus,
  Move,
  Play,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import {
  useUpdaterStore,
  type DevPreviewStage,
} from "@/shared/stores/updaterStore";

const stages: Array<{ label: string; value: DevPreviewStage }> = [
  { label: "Available", value: "update-available" },
  { label: "Preparing", value: "preparing" },
  { label: "Downloading", value: "downloading" },
  { label: "Installing", value: "installing" },
  { label: "Complete", value: "complete" },
  { label: "Error", value: "error" },
];

type PositionMode = "left" | "center" | "right" | "custom";
type Point = { x: number; y: number };

const STORAGE_KEY = "yolnoma.turbo.v2";
const PANEL_SIZE = { width: 360, height: 470 };
const COMPACT_SIZE = 48;

function readSavedState() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (!value || typeof value !== "object") return null;
    return {
      mode: ["left", "center", "right", "custom"].includes(value.mode)
        ? (value.mode as PositionMode)
        : "left",
      compact: value.compact === true,
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
    // Dev-only preferences are allowed to fail in restricted browser contexts.
  }
}

export default function YolnomaTurbo() {
  const [open, setOpen] = useState(false);
  const [compact, setCompact] = useState(
    () => readSavedState()?.compact ?? false,
  );
  const [mode, setMode] = useState<PositionMode>(
    () => readSavedState()?.mode ?? "left",
  );
  const [custom, setCustom] = useState<Point>(
    () => readSavedState()?.custom ?? { x: 16, y: 16 },
  );
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{
    pointerX: number;
    pointerY: number;
    x: number;
    y: number;
  } | null>(null);
  const { previewUpdate, previewUpdaterStage } = useUpdaterStore();

  useEffect(() => {
    saveState(mode, compact, custom);
  }, [mode, compact, custom]);

  const getPositionStyle = useCallback((): React.CSSProperties => {
    if (mode === "custom") {
      return { left: custom.x, top: custom.y };
    }
    const horizontal =
      mode === "left"
        ? { left: 16 }
        : mode === "right"
          ? { right: 16 }
          : { left: "50%", transform: "translateX(-50%)" };
    return { ...horizontal, bottom: 16 };
  }, [custom, mode]);

  const resetCustomPosition = () => {
    setMode("left");
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
    const width = compact ? COMPACT_SIZE : PANEL_SIZE.width;
    const height = compact ? COMPACT_SIZE : PANEL_SIZE.height;
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

  if (!import.meta.env.DEV) return null;

  const previewSplash = () =>
    window.dispatchEvent(new CustomEvent("yolnoma:preview-splash"));
  const previewRouteLoading = () =>
    window.dispatchEvent(new CustomEvent("yolnoma:preview-route-loading"));

  if (compact) {
    return (
      <aside className="fixed z-[120]" style={getPositionStyle()}>
        <button
          type="button"
          aria-label="Open Yolnoma Turbo v0.2"
          title="Yolnoma Turbo v0.2"
          onClick={() => setCompact(false)}
          className="flex h-12 w-12 items-center justify-center rounded-full border border-zinc-300 bg-white text-zinc-800 shadow-xl shadow-black/15 transition hover:scale-105 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        >
          <Bug size={19} />
        </button>
      </aside>
    );
  }

  return (
    <aside
      className={`fixed z-[120] w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-zinc-200 bg-white/95 text-zinc-900 shadow-2xl shadow-black/10 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/95 dark:text-zinc-50 ${dragging ? "cursor-grabbing" : ""}`}
      style={getPositionStyle()}
    >
      <div
        role="toolbar"
        onPointerDown={beginDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="flex cursor-grab touch-none items-center justify-between border-b border-zinc-200 px-3 py-2.5 dark:border-zinc-800"
      >
        <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
          <Bug size={14} /> Yolnoma Turbo v0.2
          <Move size={12} className="text-zinc-400" />
        </span>
        <div
          className="flex items-center gap-0.5"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            title="Compact mode"
            aria-label="Compact mode"
            onClick={() => setCompact(true)}
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-white"
          >
            <Minus size={14} />
          </button>
          <button
            type="button"
            title="Collapse panel"
            aria-label="Collapse panel"
            onClick={() => setOpen((value) => !value)}
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-white"
          >
            {open ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="space-y-3 p-4">
          <p className="text-[11px] leading-5 text-zinc-500 dark:text-zinc-400">
            Development-only controls for testing updater and splash designs.
            Drag the header to create a custom position.
          </p>

          <div className="grid grid-cols-4 gap-1.5">
            {(["left", "center", "right", "custom"] as PositionMode[]).map(
              (value) => (
                <button
                  key={value}
                  type="button"
                  disabled={value === "custom" && mode !== "custom"}
                  onClick={() => setMode(value)}
                  className={`rounded-lg border px-2 py-1.5 text-[10px] capitalize transition ${mode === value ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900" : "border-zinc-200 text-zinc-500 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900"}`}
                >
                  {value === "custom" && (
                    <Crosshair size={11} className="mr-1 inline" />
                  )}
                  {value}
                </button>
              ),
            )}
          </div>
          <div className="flex items-center justify-between text-[10px] text-zinc-400">
            <span>
              {mode === "custom"
                ? `Custom: ${Math.round(custom.x)} × ${Math.round(custom.y)}`
                : `Position: ${mode}`}
            </span>
            <button
              type="button"
              onClick={resetCustomPosition}
              className="inline-flex items-center gap-1 hover:text-zinc-900 dark:hover:text-white"
            >
              <RotateCcw size={11} /> Reset
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={previewUpdate}
              className="flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              <Play size={13} /> Full updater
            </button>
            <button
              type="button"
              onClick={previewSplash}
              className="flex items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <Sparkles size={13} /> Splash screen
            </button>
            <button
              type="button"
              onClick={previewRouteLoading}
              className="col-span-2 flex items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <LoaderCircle size={13} /> Opening tool
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {stages.map((stage) => (
              <button
                key={stage.value}
                type="button"
                onClick={() => previewUpdaterStage(stage.value)}
                className="rounded-lg border border-zinc-200 px-2 py-1.5 text-[10px] text-zinc-500 transition hover:border-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:bg-zinc-900 dark:hover:text-white"
              >
                {stage.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-[10px] text-zinc-500 dark:text-zinc-400">
            <CircleAlert size={12} /> Dev mode only — never included in
            production builds.
          </div>
          <div className="flex items-center gap-2 text-[10px] text-emerald-600 dark:text-emerald-300">
            <Check size={12} /> Position and compact mode are saved locally.
          </div>
        </div>
      )}
    </aside>
  );
}
