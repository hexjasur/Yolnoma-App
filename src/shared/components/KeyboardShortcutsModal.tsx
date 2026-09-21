import { useEffect, useState } from 'react';
import { Keyboard, X, Command, Compass, Wrench, Layout, Sparkles } from 'lucide-react';

type ShortcutItem = {
  keys: string[];
  description: string;
};

type ShortcutSection = {
  title: string;
  icon: typeof Compass;
  items: ShortcutItem[];
};

const SHORTCUT_SECTIONS: ShortcutSection[] = [
  {
    title: 'General & Navigation',
    icon: Compass,
    items: [
      { keys: ['Ctrl', 'K'], description: 'Command Palette — Quick search and instant desktop actions' },
      { keys: ['Ctrl', '/'], description: 'Keyboard Shortcuts — Open this reference cheat-sheet' },
      { keys: ['Ctrl', 'B'], description: 'Toggle Sidebar — Collapse or expand navigation panel' },
      { keys: ['Alt', '← / →'], description: 'Navigate Back / Forward in history' },
      { keys: ['Ctrl', 'R'], description: 'Reload — Refresh current page (F5)' },
    ],
  },
  {
    title: 'Direct Tool Shortcuts',
    icon: Wrench,
    items: [
      { keys: ['Ctrl', 'Shift', 'I'], description: 'Steam Idler & SAM — Jump to idling workspace' },
      { keys: ['Ctrl', 'Shift', 'G'], description: 'Git Workspace — Open commit generator & history' },
      { keys: ['Ctrl', 'Shift', 'J'], description: 'JSON Tool — Open JSON editor & visualizer' },
      { keys: ['Ctrl', 'Shift', 'D'], description: 'Global Dropzone — Quick file upload & tool routing' },
      { keys: ['Ctrl', 'Shift', 'A'], description: 'AI Agent — Launch standalone assistant window' },
    ],
  },
  {
    title: 'Tabs & Multi-Window',
    icon: Layout,
    items: [
      { keys: ['Ctrl', 'T'], description: 'New Tab — Open home in a new standalone tab' },
      { keys: ['Ctrl', 'W'], description: 'Close Tab — Close currently active tab' },
      { keys: ['Ctrl', 'Tab'], description: 'Cycle Tabs — Switch to the next open tab' },
      { keys: ['Ctrl', '1..9'], description: 'Select Tab — Switch directly to tab by position' },
    ],
  },
  {
    title: 'Controls & Dialogs',
    icon: Sparkles,
    items: [
      { keys: ['Esc'], description: 'Dismiss — Close active modal, palette, or overlay' },
      { keys: ['↑', '↓', 'Enter'], description: 'List Navigation — Move selection and execute' },
    ],
  },
];

export default function KeyboardShortcutsModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input/textarea (except Ctrl+/)
      const target = e.target as HTMLElement | null;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      // Ctrl+/ or Cmd+/ opens shortcuts modal
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
        return;
      }

      // '?' key opens shortcuts if not in input
      if (!isInput && e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setIsOpen(true);
        return;
      }

      // Esc closes
      if (isOpen && e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
        return;
      }

      // Direct Jump Shortcuts:
      if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
        const key = e.key.toUpperCase();
        if (key === 'I') {
          e.preventDefault();
          window.location.hash = '#/tools/steam/steam-idler';
        } else if (key === 'G') {
          e.preventDefault();
          window.location.hash = '#/tools/git';
        } else if (key === 'J') {
          e.preventDefault();
          window.location.hash = '#/tools/json';
        } else if (key === 'D') {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('yolnoma:open-dropzone'));
        }
      }

      // Ctrl+B sidebar toggle
      if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('yolnoma:toggle-sidebar'));
      }
    };

    const handleCustomOpen = () => {
      setIsOpen(true);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('yolnoma:open-shortcuts', handleCustomOpen);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('yolnoma:open-shortcuts', handleCustomOpen);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={() => setIsOpen(false)}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-white/[0.12] bg-[#16120E] p-6 shadow-2xl shadow-black/80 max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard Shortcuts"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/15 border border-[var(--accent-border)] flex items-center justify-center text-[var(--accent)]">
              <Keyboard size={20} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white tracking-wide flex items-center gap-2">
                <span>Keyboard Shortcuts</span>
                <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-white/[0.06] text-white/50">
                  Cheat-Sheet
                </span>
              </h2>
              <p className="text-xs text-white/40 mt-0.5">
                Quick reference for navigation, workspaces, and window management
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06] transition"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Shortcuts list (scrollable with custom-scrollbar) */}
        <div className="mt-5 space-y-6 overflow-y-auto pr-1 custom-scrollbar">
          {SHORTCUT_SECTIONS.map((section) => {
            const Icon = section.icon;
            return (
              <div key={section.title} className="space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
                  <Icon size={14} />
                  <span>{section.title}</span>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.04] overflow-hidden">
                  {section.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-4 px-4 py-2.5 hover:bg-white/[0.02] transition"
                    >
                      <span className="text-xs text-white/70 font-medium">{item.description}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {item.keys.map((k, kIdx) => (
                          <kbd
                            key={kIdx}
                            className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-md bg-[#221c17] border border-white/[0.12] text-[11px] font-mono font-semibold text-white/90 shadow-sm"
                          >
                            {k === 'Ctrl' ? (
                              <span className="flex items-center gap-0.5">
                                <Command size={10} className="sm:hidden" />
                                <span>Ctrl</span>
                              </span>
                            ) : (
                              k
                            )}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-5 pt-4 border-t border-white/[0.06] flex items-center justify-between text-xs text-white/35 shrink-0">
          <span>Press Esc or click outside to dismiss</span>
          <span className="flex items-center gap-1 text-[var(--accent)] font-medium">
            <span>Tip:</span>
            <span className="text-white/60">Press Ctrl + / at any time</span>
          </span>
        </div>
      </div>
    </div>
  );
}
