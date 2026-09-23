import { images } from "@/shared/assets/images";

export default function RouteLoadingFallback() {
  return (
    <div className="flex h-full min-h-[calc(100vh-6rem)] w-full items-center justify-center rounded-3xl border border-[#F2EDE6]/10 bg-gradient-to-b from-[#14110E] to-[#0B0908] px-6 py-16">
      <div
        className="flex flex-col items-center gap-6"
        role="status"
        aria-live="polite"
      >
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
        </div>
      </div>
    </div>
  );
}
