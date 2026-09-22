import {
  AlertCircle,
  ArrowRight,
  Check,
  Download,
  Loader2,
  LockKeyhole,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import { useUpdaterStore } from "@/shared/stores/updaterStore";
import Button from "./Button";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(k)),
    sizes.length - 1,
  );
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function Stage({
  label,
  active,
  complete,
}: {
  label: string;
  active?: boolean;
  complete?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 text-xs transition-colors ${active ? "text-white" : complete ? "text-emerald-300" : "text-white/35"}`}
    >
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full border ${active ? "border-[#D97757] bg-[#D97757]/20" : complete ? "border-emerald-400/40 bg-emerald-400/10" : "border-white/10 bg-white/[0.03]"}`}
      >
        {complete ? (
          <Check size={12} />
        ) : active ? (
          <Loader2 size={12} className="animate-spin" />
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
        )}
      </span>
      <span>{label}</span>
    </div>
  );
}

export default function UpdateModal() {
  const {
    status,
    updateInfo,
    progress,
    downloadedBytes,
    totalBytes,
    error,
    modalOpen,
    closeModal,
    downloadAndInstall,
  } = useUpdaterStore();

  if (!modalOpen || !updateInfo) return null;

  const isPreparing = status === "preparing";
  const isDownloading = status === "downloading";
  const isInstalling = status === "installing";
  const isComplete = status === "complete";
  const isBusy = isPreparing || isDownloading || isInstalling || isComplete;
  const hasError = status === "error" && Boolean(error);
  const isReady = status === "update-available" || hasError;
  const progressWidth =
    isInstalling || isComplete ? 100 : Math.max(3, progress);

  return (
    <div
      className="fixed inset-0 z-[100] flex min-h-screen items-center justify-center overflow-hidden bg-[#08090d] px-5 py-8 text-white"
      role="dialog"
      aria-modal="true"
      aria-label="Yolnoma software update"
    >
      {/* Animated backdrop: intentionally stays local to the update flow so the normal app is never visible during installation. */}
      <div className="pointer-events-none absolute inset-0 opacity-80">
        <div className="absolute -left-32 -top-32 h-[32rem] w-[32rem] rounded-full bg-[#D97757]/20 blur-[110px] animate-pulse" />
        <div className="absolute -bottom-48 -right-32 h-[34rem] w-[34rem] rounded-full bg-indigo-500/15 blur-[120px] animate-pulse [animation-delay:900ms]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:42px_42px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_72%)]" />
      </div>

      <div className="relative w-full max-w-3xl overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.055] shadow-2xl shadow-black/50 backdrop-blur-2xl">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#D97757] to-transparent" />

        {!isBusy && (
          <button
            onClick={closeModal}
            className="absolute right-5 top-5 z-10 rounded-full p-2 text-white/40 transition hover:bg-white/10 hover:text-white"
            aria-label="Close update dialog"
          >
            <X size={18} />
          </button>
        )}

        <div className="grid gap-0 md:grid-cols-[0.9fr_1.1fr]">
          <div className="relative flex min-h-[420px] flex-col items-center justify-center overflow-hidden border-b border-white/10 px-8 py-10 text-center md:border-b-0 md:border-r">
            <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#D97757]/20 animate-[spin_18s_linear_infinite]" />
            <div className="absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-indigo-300/20 animate-[spin_12s_linear_infinite_reverse]" />
            <div
              className={`relative flex h-24 w-24 items-center justify-center rounded-[2rem] border border-[#D97757]/40 bg-gradient-to-br from-[#D97757]/30 to-indigo-500/20 shadow-[0_0_70px_rgba(217,119,87,0.25)] ${isBusy ? "animate-pulse" : ""}`}
            >
              {isPreparing ? (
                <RefreshCw size={38} className="animate-spin text-[#f3b39c]" />
              ) : isDownloading ? (
                <Download size={38} className="text-[#f3b39c]" />
              ) : isInstalling ? (
                <Sparkles size={38} className="animate-pulse text-[#f3b39c]" />
              ) : isComplete ? (
                <Check size={38} className="text-emerald-300" />
              ) : hasError ? (
                <AlertCircle size={38} className="text-red-300" />
              ) : (
                <Sparkles size={38} className="text-[#f3b39c]" />
              )}
            </div>
            <p className="relative mt-8 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#f3b39c]">
              Yolnoma Updater
            </p>
            <h1 className="relative mt-3 text-2xl font-semibold tracking-tight">
              {isPreparing
                ? "Preparing a safe update"
                : isDownloading
                  ? "Downloading the new version"
                  : isInstalling
                    ? "Finishing the update"
                    : isComplete
                      ? "Update complete"
                      : hasError
                        ? "Update needs attention"
                        : "A better Yolnoma is ready"}
            </h1>
            <p className="relative mt-3 max-w-xs text-sm leading-6 text-white/50">
              {isComplete
                ? "Yolnoma is updated successfully. Restarting now…"
                : isBusy
                  ? "Please keep this window open. Your account data and login session will remain safe."
                  : hasError
                    ? "The update was not installed. You can safely retry without signing in again."
                    : "Yolnoma will stop active tools, install the signed package, and restart automatically."}
            </p>
            <div className="relative mt-8 flex items-center gap-2 text-[11px] text-white/45">
              <LockKeyhole size={13} className="text-emerald-300" /> Signed and
              verified update channel
            </div>
          </div>

          <div className="flex flex-col justify-center px-8 py-9 md:px-10">
            <div className="flex items-center gap-3 text-xs text-white/45">
              <span className="font-mono">v{updateInfo.currentVersion}</span>
              <ArrowRight size={13} className="text-[#D97757]" />
              <span className="rounded-full border border-[#D97757]/30 bg-[#D97757]/10 px-2.5 py-1 font-mono font-semibold text-[#f3b39c]">
                v{updateInfo.version}
              </span>
            </div>

            <h2 className="mt-5 text-sm font-semibold uppercase tracking-[0.16em] text-white/75">
              Update progress
            </h2>
            <div className="mt-4 grid gap-2.5 rounded-2xl border border-white/[0.07] bg-black/10 p-4">
              <Stage
                label="Stop active idling"
                active={isPreparing}
                complete={isDownloading || isInstalling}
              />
              <Stage
                label="Close SteamUtility safely"
                active={isPreparing}
                complete={isDownloading || isInstalling}
              />
              <Stage
                label="Download signed package"
                active={isDownloading}
                complete={isInstalling}
              />
              <Stage
                label="Install and relaunch"
                active={isInstalling}
                complete={isComplete}
              />
            </div>

            {(isDownloading || isInstalling || isComplete) && (
              <div className="mt-5 space-y-2">
                <div className="flex items-center justify-between text-xs text-white/55">
                  <span>
                    {isComplete
                      ? "Restarting Yolnoma…"
                      : isInstalling
                        ? "Applying changes…"
                        : "Downloading installer…"}
                  </span>
                  <span className="font-mono text-[#f3b39c]">
                    {isInstalling || isComplete ? "100%" : `${progress}%`}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#D97757] via-amber-300 to-indigo-400 transition-all duration-300"
                    style={{ width: `${progressWidth}%` }}
                  />
                </div>
                {totalBytes && totalBytes > 0 && isDownloading && (
                  <p className="text-right font-mono text-[11px] text-white/35">
                    {formatBytes(downloadedBytes)} / {formatBytes(totalBytes)}
                  </p>
                )}
              </div>
            )}

            <div className="mt-5 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">
                What’s included
              </p>
              <p className="mt-2 max-h-28 overflow-y-auto whitespace-pre-wrap text-xs leading-5 text-white/65">
                {updateInfo.body ||
                  "Bug fixes, performance improvements, and security updates."}
              </p>
            </div>

            {error && (
              <div className="mt-4 flex gap-2 rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-xs leading-5 text-red-200">
                <AlertCircle
                  size={15}
                  className="mt-0.5 shrink-0 text-red-300"
                />
                <span>{error}</span>
              </div>
            )}

            <div className="mt-7 flex items-center justify-end gap-3">
              {isReady && (
                <Button variant="ghost" size="sm" onClick={closeModal}>
                  Later
                </Button>
              )}
              {isReady && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={downloadAndInstall}
                  className="gap-2"
                >
                  <Download size={14} />
                  {hasError ? "Retry update" : "Update now"}
                </Button>
              )}
              {isBusy && (
                <span className="text-xs text-white/40">
                  {isComplete
                    ? "Restarting automatically…"
                    : "Do not close this window"}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
