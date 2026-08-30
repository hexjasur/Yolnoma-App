import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Copy,
  Check,
  ShieldCheck,
  Globe,
  Settings,
} from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

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

  const isOwner = user?.role === 'owner';

  return (
    <header
      className="h-14 shrink-0 border-b px-4 sm:px-6 flex items-center justify-between gap-4 select-none relative z-20 backdrop-blur-md bg-[#14110E]/85"
      style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}
    >
      {/* Left: Navigation controls (Steam style) */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.06] active:bg-white/[0.1] transition-all"
          title="Return to the previous page"
          aria-label="Back"
        >
          <ChevronLeft size={16} strokeWidth={2} />
        </button>

        <button
          type="button"
          onClick={() => navigate(1)}
          className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.06] active:bg-white/[0.1] transition-all"
          title="Go to the next page"
          aria-label="Forward"
        >
          <ChevronRight size={16} strokeWidth={2} />
        </button>

        <button
          type="button"
          onClick={handleRefresh}
          className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.06] active:bg-white/[0.1] transition-all"
          title="Reload the page"
          aria-label="Refresh"
        >
          <RotateCw size={14} strokeWidth={2} />
        </button>
      </div>

      {/* Center: Steam-Style Address Bar */}
      <div className="flex-1 max-w-xl mx-auto">
        <div
          onClick={handleCopyUrl}
          role="button"
          tabIndex={0}
          title="Copies the URL when clicked"
          className="group relative flex items-center justify-between gap-2.5 px-3 py-1.5 rounded-lg
                     bg-[#181411] border border-white/[0.07] hover:border-[#D97757]/40 hover:bg-[#1c1713]
                     transition-all duration-200 cursor-pointer shadow-inner"
        >
          {/* Protocol & Path */}
          <div className="flex items-center gap-2 min-w-0 overflow-hidden text-xs font-mono">
            <Globe size={13} className="text-[#D97757] shrink-0" />
            <span className="text-[#D97757] font-semibold shrink-0">
              yolnoma://
            </span>
            <span className="text-white/80 truncate">
              app/{cleanPath || 'dashboard'}
            </span>
            {location.search && (
              <span className="text-[#D97757]/90 font-medium truncate">
                {location.search}
              </span>
            )}
          </div>

          {/* Copy Action / Indicator */}
          <div className="flex items-center gap-1.5 shrink-0 pl-2 border-l border-white/[0.06]">
            {copied ? (
              <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-sans font-medium">
                <Check size={12} strokeWidth={2.5} />
                Copied!
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[11px] text-white/40 group-hover:text-white/80 font-sans transition-colors">
                <Copy size={11} strokeWidth={2} />
                <span className="hidden sm:inline">Copy</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Right: Role & Status */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Role Badge */}
        {isOwner ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#D97757]/15 border border-[#D97757]/30 text-[#D97757] text-xs font-semibold">
            <ShieldCheck size={13} strokeWidth={2.5} />
            <span>OWNER</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/[0.08] text-white/60 text-xs">
            <span>USER</span>
          </div>
        )}

        <button
          type="button"
          onClick={() => navigate('/profile')}
          className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors"
          title="Profile and Settings"
        >
          <Settings size={15} strokeWidth={1.75} />
        </button>
      </div>
    </header>
  );
}
