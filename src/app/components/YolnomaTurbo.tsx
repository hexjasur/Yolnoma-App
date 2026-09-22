import { useState } from "react";
import {
  Bug,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Play,
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

export default function DevPreviewPanel() {
  const [open, setOpen] = useState(false);
  const { previewUpdate, previewUpdaterStage } = useUpdaterStore();

  if (!import.meta.env.DEV) return null;

  const previewSplash = () => {
    window.dispatchEvent(new CustomEvent("yolnoma:preview-splash"));
  };

  return (
    <aside className="fixed bottom-4 left-4 z-[120] w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-zinc-200 bg-white/95 text-zinc-900 shadow-2xl shadow-black/10 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/95 dark:text-zinc-50">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between border-b border-zinc-200 px-4 py-3 text-left transition hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-900"
      >
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
          <Bug size={14} /> Yolnoma Turbo v0.1
        </span>
        {open ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
      </button>

      {open && (
        <div className="space-y-3 p-4">
          <p className="text-[11px] leading-5 text-zinc-500 dark:text-zinc-400">
            The production updater does not work. This panel is only for locally
            testing the design and lifecycle animation.
          </p>

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
        </div>
      )}
    </aside>
  );
}
