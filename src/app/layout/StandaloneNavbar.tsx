import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Copy,
  Check,
  Globe,
  Sparkles,
} from 'lucide-react';
import { images } from '@/shared/assets/images';

export default function StandaloneNavbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  // Clean path formatting for yolnoma:// URL
  const cleanPath = location.pathname.startsWith('/') ? location.pathname.slice(1) : location.pathname;
  const currentAppUrl = `yolnoma://app/${cleanPath || 'dashboard'}${location.search}`;

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(currentAppUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = currentAppUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <header
      className="h-11 shrink-0 border-b px-3 sm:px-4 flex items-center justify-between gap-3 select-none relative z-20 backdrop-blur-md bg-[#14110E]/90"
      style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}
    >
      {/* Left: Navigation controls (Steam/Tab style) */}
      <div className="flex items-center gap-1 shrink-0">
        <div className="w-6 h-6 rounded-md bg-white/[0.04] border border-white/[0.08] flex items-center justify-center p-1 mr-1">
          <img src={images.brands.logo_png} alt="Yolnoma Logo" className="w-full h-full object-contain" />
        </div>

        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-1 rounded-md text-white/50 hover:text-white hover:bg-white/[0.06] active:bg-white/[0.1] transition-all"
          title="Return to previous page"
          aria-label="Back"
        >
          <ChevronLeft size={15} strokeWidth={2} />
        </button>

        <button
          type="button"
          onClick={() => navigate(1)}
          className="p-1 rounded-md text-white/50 hover:text-white hover:bg-white/[0.06] active:bg-white/[0.1] transition-all"
          title="Go forward"
          aria-label="Forward"
        >
          <ChevronRight size={15} strokeWidth={2} />
        </button>

        <button
          type="button"
          onClick={handleRefresh}
          className="p-1 rounded-md text-white/50 hover:text-white hover:bg-white/[0.06] active:bg-white/[0.1] transition-all"
          title="Refresh page"
          aria-label="Refresh"
        >
          <RotateCw size={13} strokeWidth={2} />
        </button>
      </div>

      {/* Center: Address Bar */}
      <div className="flex-1 max-w-lg mx-auto">
        <div
          className="h-7 px-2.5 rounded-lg flex items-center justify-between gap-2 border text-xs transition-all duration-200"
          style={{
            background: 'rgba(24, 20, 16, 0.65)',
            borderColor: 'rgba(255, 255, 255, 0.08)',
          }}
        >
          <div className="flex items-center gap-1.5 min-w-0 text-white/40">
            <Globe size={11} className="shrink-0 text-[#D97757]" />
            <span className="font-mono text-[11px] truncate tracking-tight text-white/70">
              <span className="text-[#D97757]/80">yolnoma://app/</span>
              <span>{cleanPath || 'dashboard'}</span>
              {location.search && <span className="text-white/40">{location.search}</span>}
            </span>
          </div>

          <button
            type="button"
            onClick={handleCopyUrl}
            className="shrink-0 p-0.5 text-white/40 hover:text-[#D97757] transition-colors rounded"
            title="Copy URL"
            aria-label="Copy URL"
          >
            {copied ? (
              <Check size={12} className="text-emerald-400" />
            ) : (
              <Copy size={11} />
            )}
          </button>
        </div>
      </div>

      {/* Right: Window Tab Badge */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#D97757]/10 border border-[#D97757]/20 text-[#D97757] text-[10px] font-medium tracking-wide">
          <Sparkles size={9} />
          <span>Standalone View</span>
        </span>
      </div>
    </header>
  );
}
