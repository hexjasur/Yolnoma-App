import { images } from "@/shared/assets/images";

export default function RouteLoadingFallback({
  preview = false,
  onDismiss,
}: {
  preview?: boolean;
  onDismiss?: () => void;
}) {
  return (
    <div
      className={`flex items-center justify-center rounded-3xl border border-[#F2EDE6]/10 bg-gradient-to-b from-[#14110E] to-[#0B0908] px-6 py-16 ${preview ? "fixed inset-0 z-[130] h-screen w-screen rounded-none bg-black/80 backdrop-blur-sm" : "h-full min-h-[calc(100vh-6rem)] w-full"}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-6">
        <div className="relative flex h-16 w-16 items-center justify-center">
          <div className="absolute inset-0 animate-ping rounded-full bg-[#D97757]/10" />
          <div className="absolute inset-0 rounded-full border-[3px] border-[#D97757]/15" />
          <img
            src={images.brands.logo_png}
            alt="Yolnoma"
            className="relative h-9 w-9 animate-pulse object-contain"
          />
        </div>

        <div className="flex flex-col items-center gap-1.5 text-center">
          <p className="text-base font-semibold tracking-wide text-[#F2EDE6]">
            Opening tool
          </p>
          <p className="text-xs text-[#F2EDE6]/40">Preparing this workspace…</p>
          {preview && onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-lg border border-[#F2EDE6]/15 px-3 py-1.5 text-[11px] text-[#F2EDE6]/55 transition hover:border-[#F2EDE6]/35 hover:text-[#F2EDE6]"
            >
              Close preview
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
