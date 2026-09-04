import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ExternalLink,
  RotateCw,
  ArrowLeft,
  ArrowRight,
  Globe,
} from 'lucide-react';
import { openInNewWindow } from '@/shared/lib/window';
import { toast } from '@/shared/ui/Toast';
import { openUrl } from '@tauri-apps/plugin-opener';

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  targetUrl: string | null;
  linkText: string | null;
  isExternal: boolean;
}

export function ContextMenuProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [menu, setMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    targetUrl: null,
    linkText: null,
    isExternal: false,
  });

  const menuRef = useRef<HTMLDivElement>(null);

  // Close context menu on outside click or scroll or escape
  const closeMenu = useCallback(() => {
    setMenu((prev) => (prev.visible ? { ...prev, visible: false } : prev));
  }, []);

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };

    const handleScroll = () => closeMenu();

    window.addEventListener('click', handleGlobalClick);
    window.addEventListener('contextmenu', handleGlobalClick);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('contextmenu', handleGlobalClick);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [closeMenu]);

  // Global ContextMenu handler
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      // Find closest anchor tag or element with href / data-link
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const linkEl = target.closest('a[href], [data-link], [data-href]') as
        | HTMLAnchorElement
        | HTMLElement
        | null;
      let rawHref: string | null = null;
      let linkText: string | null = null;

      if (linkEl) {
        rawHref =
          linkEl.getAttribute('href') ||
          linkEl.getAttribute('data-link') ||
          linkEl.getAttribute('data-href');
        linkText = linkEl.textContent?.trim() || null;
      }

      // Ignore pure hash resets like href="#"
      if (
        rawHref === '#' ||
        rawHref === 'javascript:void(0)' ||
        rawHref === ''
      ) {
        rawHref = null;
      }

      e.preventDefault();

      let targetUrl = rawHref;
      let isExternal = false;

      if (targetUrl) {
        if (
          targetUrl.startsWith('http://') ||
          targetUrl.startsWith('https://')
        ) {
          // If it points to localhost app url, treat as internal hash route
          if (targetUrl.includes('/#')) {
            targetUrl = targetUrl.substring(targetUrl.indexOf('/#'));
          } else {
            isExternal = true;
          }
        }
      }

      // Calculate coordinates and prevent offscreen overflow
      const menuWidth = 220;
      const menuHeight = targetUrl ? 230 : 190;
      let posX = e.clientX;
      let posY = e.clientY;

      if (posX + menuWidth > window.innerWidth) {
        posX = Math.max(10, window.innerWidth - menuWidth - 10);
      }
      if (posY + menuHeight > window.innerHeight) {
        posY = Math.max(10, window.innerHeight - menuHeight - 10);
      }

      setMenu({
        visible: true,
        x: posX,
        y: posY,
        targetUrl,
        linkText:
          linkText && linkText.length > 24
            ? `${linkText.slice(0, 24)}…`
            : linkText,
        isExternal,
      });
    };

    window.addEventListener('contextmenu', handleContextMenu);
    return () => window.removeEventListener('contextmenu', handleContextMenu);
  }, []);

  // Middle-click (mouse wheel click) & Ctrl+Click handler for opening links in new windows
  useEffect(() => {
    const handleAuxClick = (e: MouseEvent) => {
      // button === 1 is middle mouse click
      if (e.button === 1) {
        const target = e.target as HTMLElement | null;
        if (!target) return;
        const linkEl = target.closest('a[href], [data-link], [data-href]') as
          | HTMLAnchorElement
          | HTMLElement
          | null;
        if (linkEl) {
          const href =
            linkEl.getAttribute('href') ||
            linkEl.getAttribute('data-link') ||
            linkEl.getAttribute('data-href');
          if (href && href !== '#' && href !== 'javascript:void(0)') {
            e.preventDefault();
            e.stopPropagation();
            openInNewWindow(href);
          }
        }
      }
    };

    const handleClick = (e: MouseEvent) => {
      if (e.ctrlKey || e.metaKey) {
        const target = e.target as HTMLElement | null;
        if (!target) return;
        const linkEl = target.closest('a[href], [data-link], [data-href]') as
          | HTMLAnchorElement
          | HTMLElement
          | null;
        if (linkEl) {
          const href =
            linkEl.getAttribute('href') ||
            linkEl.getAttribute('data-link') ||
            linkEl.getAttribute('data-href');
          if (href && href !== '#' && href !== 'javascript:void(0)') {
            e.preventDefault();
            e.stopPropagation();
            openInNewWindow(href);
          }
        }
      }
    };

    window.addEventListener('auxclick', handleAuxClick);
    window.addEventListener('click', handleClick, true);

    return () => {
      window.removeEventListener('auxclick', handleAuxClick);
      window.removeEventListener('click', handleClick, true);
    };
  }, []);

  // Global window.open override
  useEffect(() => {
    const originalOpen = window.open;
    window.open = (url?: string | URL, target?: string, features?: string) => {
      if (url) {
        const urlStr = typeof url === 'string' ? url : url.toString();
        openInNewWindow(urlStr);
        return null;
      }
      return originalOpen.call(window, url, target, features);
    };

    return () => {
      window.open = originalOpen;
    };
  }, []);

  // Actions
  const handleOpenInNewWindow = () => {
    if (menu.targetUrl) {
      openInNewWindow(menu.targetUrl);
    }
    closeMenu();
  };

  const handleOpenInBrowser = async () => {
    if (menu.targetUrl) {
      try {
        await openUrl(menu.targetUrl);
      } catch {
        toast.error('Could not open in the browser');
      }
    }
    closeMenu();
  };

  const handleRefresh = () => {
    window.location.reload();
    closeMenu();
  };

  const handleBack = () => {
    window.history.back();
    closeMenu();
  };

  const handleForward = () => {
    window.history.forward();
    closeMenu();
  };

  return (
    <>
      {children}

      {menu.visible && (
        <div
          ref={menuRef}
          className="w-56 py-1.5  border select-none text-xs text-[#F2EDE6] shadow-2xl backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-100"
          style={{
            position: 'fixed',
            top: `${menu.y}px`,
            left: `${menu.x}px`,
            zIndex: 99999,
            background: 'rgba(24, 20, 16, 0.95)',
            borderColor: 'rgba(255, 255, 255, 0.10)',
            boxShadow:
              '0 20px 45px -10px rgba(0, 0, 0, 0.7), 0 0 30px rgba(217, 119, 87, 0.08)',
          }}
        >
          {/* Subtle top sheen */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#D97757]/40 to-transparent" />

          {/* Link-specific actions */}
          {menu.targetUrl && (
            <>
              <button
                type="button"
                onClick={handleOpenInNewWindow}
                className="w-full px-3 py-2 flex items-center gap-2.5 hover:bg-white/[0.08] text-left text-white/90 hover:text-white transition-colors group"
              >
                <div className="p-1 rounded-md bg-[#D97757]/15 text-[#D97757] group-hover:bg-[#D97757] group-hover:text-white transition-colors">
                  <ExternalLink size={13} strokeWidth={2.2} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[12px] text-[#F2EDE6]">
                    Open in new tab
                  </div>
                  <div className="text-[10px] text-white/40 truncate">
                    {menu.linkText || menu.targetUrl}
                  </div>
                </div>
              </button>

              {menu.isExternal && (
                <button
                  type="button"
                  onClick={handleOpenInBrowser}
                  className="w-full px-3 py-2 flex items-center gap-2.5 hover:bg-white/[0.08] text-left text-white/70 hover:text-white transition-colors"
                >
                  <Globe size={13} className="text-white/40" />
                  <span>Open in browser</span>
                </button>
              )}

              <div className="my-1 border-t border-white/[0.06]" />
            </>
          )}

          {/* General navigation actions */}

          <button
            type="button"
            onClick={handleRefresh}
            className="w-full px-3 py-1.5 flex items-center justify-between gap-2 hover:bg-white/[0.08] text-left text-white/75 hover:text-white transition-colors"
          >
            <div className="flex items-center gap-2">
              <RotateCw size={12} className="text-white/40" />
              <span>Refresh</span>
            </div>
            <span className="text-[10px] text-white/30 font-mono">F5</span>
          </button>

          <button
            type="button"
            onClick={handleBack}
            className="w-full px-3 py-1.5 flex items-center justify-between gap-2 hover:bg-white/[0.08] text-left text-white/75 hover:text-white transition-colors"
          >
            <div className="flex items-center gap-2">
              <ArrowLeft size={12} className="text-white/40" />
              <span>Back</span>
            </div>
            <span className="text-[10px] text-white/30 font-mono">Alt+←</span>
          </button>

          <button
            type="button"
            onClick={handleForward}
            className="w-full px-3 py-1.5 flex items-center justify-between gap-2 hover:bg-white/[0.08] text-left text-white/75 hover:text-white transition-colors"
          >
            <div className="flex items-center gap-2">
              <ArrowRight size={12} className="text-white/40" />
              <span>Forward</span>
            </div>
            <span className="text-[10px] text-white/30 font-mono">Alt+→</span>
          </button>
        </div>
      )}
    </>
  );
}
