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
  const [open, setOpen] = useState(true);
  const { previewUpdate, previewUpdaterStage } = useUpdaterStore();

  if (!import.meta.env.DEV) return null;

  const previewSplash = () => {
    window.dispatchEvent(new CustomEvent("yolnoma:preview-splash"));
  };

  return (
    <aside className="fixed bottom-4 left-4 z-[120] w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-violet-300/20 bg-[#15131f]/95 text-white shadow-2xl shadow-black/40 backdrop-blur-xl">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between border-b border-white/[0.08] px-4 py-3 text-left transition hover:bg-white/[0.04]"
      >
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-violet-200">
          <Bug size={14} /> Dev Preview
        </span>
        {open ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
      </button>

      {open && (
        <div className="space-y-3 p-4">
          <p className="text-[11px] leading-5 text-white/50">
            Production updater ishlamaydi. Bu panel faqat design va lifecycle
            animatsiyasini lokal test qiladi.
          </p>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={previewUpdate}
              className="flex items-center justify-center gap-2 rounded-xl bg-[#D97757] px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-[#e48a6d]"
            >
              <Play size={13} /> Full updater
            </button>
            <button
              type="button"
              onClick={previewSplash}
              className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-xs font-semibold text-white/80 transition hover:bg-white/10"
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
                className="rounded-lg border border-white/[0.08] px-2 py-1.5 text-[10px] text-white/55 transition hover:border-violet-300/30 hover:bg-violet-300/10 hover:text-white"
              >
                {stage.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-[10px] text-amber-200/60">
            <CircleAlert size={12} /> Dev mode only — never included in
            production builds.
          </div>
        </div>
      )}
    </aside>
  );
}
