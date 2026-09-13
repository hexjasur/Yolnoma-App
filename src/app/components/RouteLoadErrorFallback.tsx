import { AlertOctagon, RefreshCw } from 'lucide-react';

export default function RouteLoadErrorFallback() {
  return (
    <div className="flex h-full min-h-[calc(100vh-6rem)] w-full flex-col items-center justify-center gap-4 rounded-3xl border border-red-500/20 bg-gradient-to-b from-[#14110E] to-[#0B0908] px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-red-500/20 bg-red-500/10 text-red-400">
        <AlertOctagon size={22} />
      </div>
      <div>
        <p className="text-base font-semibold text-[#F2EDE6]">Failed to load this tool</p>
        <p className="mt-1 text-xs text-[#F2EDE6]/40">Something went wrong while opening this page.</p>
      </div>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-2 inline-flex items-center gap-2 rounded-xl bg-[#D97757] px-4 py-2 text-xs font-medium text-white shadow-lg shadow-[#D97757]/20 transition-all hover:bg-[#c96a48]"
      >
        <RefreshCw size={13} />
        Reload
      </button>
    </div>
  );
}