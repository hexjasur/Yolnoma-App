import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Copy,
  Check,
  Globe,
  Plus,
  X,
  Home,
  Film,
  Theater,
  Wrench,
  Users,
  User,
  Settings,
  Compass,
} from 'lucide-react';
import { TabItem, formatRouteTitle, generateTabId } from '@/shared/lib/tabs';
import { toast } from '@/shared/ui/Toast';
import { images } from '@/shared/assets/images';

function getTabIcon(pathname: string) {
  if (pathname.includes('/videos')) return <Film size={12} className="text-[#D97757]" />;
  if (pathname.includes('/performances')) return <Theater size={12} className="text-[#D97757]" />;
  if (pathname.includes('/tools')) return <Wrench size={12} className="text-[#D97757]" />;
  if (pathname.includes('/users')) return <Users size={12} className="text-[#D97757]" />;
  if (pathname.includes('/profile')) return <User size={12} className="text-[#D97757]" />;
  if (pathname.includes('/settings')) return <Settings size={12} className="text-[#D97757]" />;
  if (pathname === '/' || pathname === '') return <Home size={12} className="text-[#D97757]" />;
  return <Compass size={12} className="text-[#D97757]" />;
}

const TABS_STORAGE_KEY = 'yolnoma_standalone_tabs';
const ACTIVE_TAB_STORAGE_KEY = 'yolnoma_standalone_active_tab';

export default function StandaloneTabBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  // Tabs state with sessionStorage persistence
  const [tabs, setTabs] = useState<TabItem[]>(() => {
    try {
      const saved = sessionStorage.getItem(TABS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {}

    const initialId = generateTabId();
    let initialPath = location.pathname;
    let initialSearch = location.search || '';

    if (window.location.hash) {
      let hash = window.location.hash;
      if (hash.startsWith('#/')) hash = hash.slice(1);
      else if (hash.startsWith('#')) hash = hash.slice(1);

      if (hash.includes('?')) {
        const parts = hash.split('?');
        initialPath = parts[0] || '/';
        initialSearch = '?' + parts.slice(1).join('?');
      } else if (hash.startsWith('/')) {
        initialPath = hash;
      }
    }

    const initialTabs = [
      {
        id: initialId,
        title: formatRouteTitle(initialPath),
        path: initialPath || '/',
        search: initialSearch,
      },
    ];

    try {
      sessionStorage.setItem(TABS_STORAGE_KEY, JSON.stringify(initialTabs));
      sessionStorage.setItem(ACTIVE_TAB_STORAGE_KEY, initialId);
    } catch {}

    return initialTabs;
  });

  const [activeTabId, setActiveTabId] = useState<string>(() => {
    try {
      const savedActive = sessionStorage.getItem(ACTIVE_TAB_STORAGE_KEY);
      if (savedActive && tabs.some((t) => t.id === savedActive)) {
        return savedActive;
      }
    } catch {}
    return tabs[0]?.id || '';
  });

  // Ref to track active tab ID inside event callbacks
  const activeTabIdRef = useRef(activeTabId);
  activeTabIdRef.current = activeTabId;

  // Keep sessionStorage in sync with tabs changes
  useEffect(() => {
    try {
      if (tabs.length > 0) {
        sessionStorage.setItem(TABS_STORAGE_KEY, JSON.stringify(tabs));
      } else {
        sessionStorage.removeItem(TABS_STORAGE_KEY);
      }
    } catch {}
  }, [tabs]);

  // Keep sessionStorage in sync with active tab changes
  useEffect(() => {
    try {
      if (activeTabId) {
        sessionStorage.setItem(ACTIVE_TAB_STORAGE_KEY, activeTabId);
      }
    } catch {}
  }, [activeTabId]);

  // Sync active tab state with router path changes
  useEffect(() => {
    setTabs((prevTabs) =>
      prevTabs.map((tab) => {
        if (tab.id === activeTabIdRef.current) {
          return {
            ...tab,
            path: location.pathname,
            search: location.search,
            title: formatRouteTitle(location.pathname),
          };
        }
        return tab;
      })
    );
  }, [location.pathname, location.search]);

  // Listen for 'add-new-tab' from main window or IPC
  useEffect(() => {
    let unlisten: (() => void) | null = null;

    listen<{ url: string; title?: string }>('add-new-tab', (event) => {
      if (event.payload?.url) {
        let rawUrl = event.payload.url.trim();
        // Convert hash path to router path
        if (rawUrl.startsWith('#/')) rawUrl = rawUrl.slice(1);
        if (rawUrl.startsWith('#')) rawUrl = rawUrl.slice(1);
        if (!rawUrl.startsWith('/')) rawUrl = '/' + rawUrl;

        const pathWithoutSearch = rawUrl.split('?')[0] || rawUrl;
        const search = rawUrl.includes('?') ? '?' + rawUrl.split('?').slice(1).join('?') : '';

        setTabs((prevTabs) => {
          // If a tab with the exact same path and search already exists, simply switch to it!
          const existingTab = prevTabs.find((t) => t.path === pathWithoutSearch && (t.search || '') === search);
          if (existingTab) {
            setActiveTabId(existingTab.id);
            navigate(existingTab.path + (existingTab.search || ''));
            return prevTabs;
          }

          const newId = generateTabId();
          const newTitle = formatRouteTitle(pathWithoutSearch);

          setActiveTabId(newId);
          navigate(rawUrl);

          return [
            ...prevTabs,
            {
              id: newId,
              title: newTitle,
              path: pathWithoutSearch,
              search,
            },
          ];
        });
      }
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, [navigate]);

  // Tab operations
  const handleSelectTab = (tab: TabItem) => {
    if (tab.id === activeTabId) return;
    setActiveTabId(tab.id);
    navigate(tab.path + (tab.search || ''));
  };

  const handleCloseTab = useCallback(
    (e: React.MouseEvent, tabId: string) => {
      e.stopPropagation();

      setTabs((prevTabs) => {
        const remainingTabs = prevTabs.filter((t) => t.id !== tabId);

        // If no tabs left, clean storage and close the secondary window
        if (remainingTabs.length === 0) {
          try {
            sessionStorage.removeItem(TABS_STORAGE_KEY);
            sessionStorage.removeItem(ACTIVE_TAB_STORAGE_KEY);
            getCurrentWindow().close();
          } catch {
            // ignore
          }
          return [];
        }

        // If the active tab was closed, switch to adjacent tab
        if (tabId === activeTabIdRef.current) {
          const closedIndex = prevTabs.findIndex((t) => t.id === tabId);
          const nextIndex = Math.min(closedIndex, remainingTabs.length - 1);
          const nextTab = remainingTabs[nextIndex];
          if (nextTab) {
            setActiveTabId(nextTab.id);
            navigate(nextTab.path + (nextTab.search || ''));
          }
        }

        return remainingTabs;
      });
    },
    [navigate]
  );

  const handleAddNewTab = () => {
    const newId = generateTabId();
    const defaultPath = '/';
    const newTab: TabItem = {
      id: newId,
      title: 'Bosh sahifa',
      path: defaultPath,
      search: '',
    };

    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newId);
    navigate(defaultPath);
  };

  // URL copy
  const cleanPath = location.pathname.startsWith('/') ? location.pathname.slice(1) : location.pathname;
  const currentAppUrl = `yolnoma://app/${cleanPath || 'dashboard'}${location.search}`;

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(currentAppUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Havola nusxalandi');
    } catch {
      toast.error('Nusxalab bo‘lmadi');
    }
  };

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  return (
    <header className="shrink-0 select-none z-30 bg-[#0F0D0B] border-b border-white/[0.06] flex flex-col">
      {/* ── 1. Steam Tab Strip ────────────────────────────────────────────── */}
      <div className="h-9 px-2 pt-1 flex items-center gap-1 overflow-x-auto no-scrollbar border-b border-white/[0.04] bg-[#0A0807]">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              onClick={() => handleSelectTab(tab)}
              onAuxClick={(e) => {
                if (e.button === 1) handleCloseTab(e, tab.id);
              }}
              title={tab.title}
              className={`group relative h-8 min-w-[130px] max-w-[200px] flex-1 px-3 rounded-t-lg flex items-center justify-between gap-2 text-xs font-medium cursor-pointer transition-all duration-150 border-t border-x ${
                isActive
                  ? 'bg-[#181410] text-[#F2EDE6] border-white/[0.08] border-b-transparent shadow-sm'
                  : 'bg-transparent text-white/45 hover:text-white/80 hover:bg-white/[0.03] border-transparent'
              }`}
            >
              {/* Active top glow indicator */}
              {isActive && (
                <div className="absolute -top-[1px] left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#D97757] to-transparent rounded-t" />
              )}

              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="shrink-0">{getTabIcon(tab.path)}</span>
                <span className="truncate text-[11px] leading-tight font-medium">
                  {tab.title}
                </span>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={(e) => handleCloseTab(e, tab.id)}
                title="Tabni yopish"
                aria-label="Close Tab"
                className={`p-0.5 rounded text-white/30 hover:text-white hover:bg-white/[0.1] transition-all shrink-0 ${
                  isActive ? 'opacity-80 group-hover:opacity-100' : 'opacity-0 group-hover:opacity-80'
                }`}
              >
                <X size={12} strokeWidth={2.2} />
              </button>
            </div>
          );
        })}

        {/* New Tab Button (+) */}
        <button
          type="button"
          onClick={handleAddNewTab}
          title="Open new tab"
          aria-label="New Tab"
          className="w-7 h-7 shrink-0 rounded-md flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.06] active:bg-white/[0.1] transition-all ml-0.5"
        >
          <Plus size={14} strokeWidth={2} />
        </button>
      </div>

      {/* ── 2. Navigation & Address Bar ───────────────────────────────────── */}
      <div className="h-10 px-3 flex items-center justify-between gap-2.5 bg-[#14110E]">
        {/* Navigation controls */}
        <div className="flex items-center gap-1 shrink-0">
          <div className="w-5 h-5 rounded bg-white/[0.04] flex items-center justify-center p-0.5 mr-0.5">
            <img src={images.brands.logo_png} alt="Logo" className="w-full h-full object-contain" />
          </div>

          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-1 rounded-md text-white/50 hover:text-white hover:bg-white/[0.06] active:bg-white/[0.1] transition-all"
            title="Orqaga"
          >
            <ChevronLeft size={14} strokeWidth={2} />
          </button>

          <button
            type="button"
            onClick={() => navigate(1)}
            className="p-1 rounded-md text-white/50 hover:text-white hover:bg-white/[0.06] active:bg-white/[0.1] transition-all"
            title="Oldinga"
          >
            <ChevronRight size={14} strokeWidth={2} />
          </button>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className={`p-1 rounded-md transition-all ${
              isRefreshing
                ? 'text-[var(--accent)] bg-white/[0.08] cursor-wait'
                : 'text-white/50 hover:text-white hover:bg-white/[0.06] active:bg-white/[0.1]'
            }`}
            title={isRefreshing ? 'Yangilanmoqda...' : 'Refresh'}
          >
            <RotateCw size={12} strokeWidth={2} className={isRefreshing ? 'animate-spin' : ''} />
          </button>

          <button
            type="button"
            onClick={() => navigate('/')}
            className="p-1 rounded-md text-white/50 hover:text-white hover:bg-white/[0.06] active:bg-white/[0.1] transition-all"
            title="Bosh sahifa"
          >
            <Home size={12} strokeWidth={2} />
          </button>
        </div>

        {/* Address Bar */}
        <div className="flex-1 max-w-xl mx-auto">
          <div
            className="h-7 px-2.5 rounded-lg flex items-center justify-between gap-2 border text-xs transition-all duration-200"
            style={{
              background: 'rgba(24, 20, 16, 0.75)',
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
              title="Havolani nusxalash"
            >
              {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={11} />}
            </button>
          </div>
        </div>

        {/* Tab count badge */}
        <div className="shrink-0 flex items-center gap-2">
          <span className="text-[10px] text-white/30 font-mono">
            {tabs.length} {tabs.length === 1 ? 'tab' : 'tabs'}
          </span>
        </div>
      </div>
    </header>
  );
}
