export default function RouteLoadingFallback() {
  return (
    <div className="flex min-h-[240px] w-full items-center justify-center rounded-2xl border border-[#F2EDE6]/10 bg-[#14110E]/80 px-6 py-12 text-[#F2EDE6]">
      <div className="flex flex-col items-center gap-4" role="status" aria-live="polite">
        <div className="relative h-10 w-10" aria-hidden="true">
          <div className="absolute inset-0 rounded-full border-2 border-[#D97757]/20" />
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-[#D97757]" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-[#F2EDE6]/90">Opening tool</p>
          <p className="mt-1 text-xs text-[#F2EDE6]/45">Preparing this workspace…</p>
        </div>
      </div>
    </div>
  );
}
