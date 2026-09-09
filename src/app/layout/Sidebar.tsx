import { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { getVersion } from '@tauri-apps/api/app';
import {
  LayoutGrid,
  Drama,
  Film,
  LogOut,
  Users,
  CircleUser,
  Blocks,
  ShoppingCart,
  PanelLeftClose,
  PanelLeftOpen,
  Star,
  Bot,
  MessageSquarePlus,
} from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { canAccessPage } from '@/config/roles';
import {
  isFeatureInDevelopment,
  canAccessDevFeature,
  handleDevFeatureClick,
} from '@/config/features';
import { usePluginNavigation } from '@/plugins';
import { ConfirmModal } from '@/shared/ui';
import { TOOL_CATALOG } from '@/config/toolCatalog';
import { usePinnedTools } from '@/shared/hooks/usePinnedTools';
import type { LucideIcon } from 'lucide-react';
import { openAgentWindow } from '@/shared/lib/window';

type SidebarLink = {
  to: string;
  label: string;
  icon: LucideIcon | string;
  name: string;
  inDevelopment?: boolean;
};

const links: SidebarLink[] = [
  { to: '/', label: 'Dashboard', icon: LayoutGrid, name: 'dashboard' },
  {
    to: '/agent',
    label: 'Yolnoma Agent',
    icon: Bot,
    name: 'agent',
    inDevelopment: true,
  },
  {
    to: '/codebase-agent',
    label: 'Codebase Agent',
    icon: Bot,
    name: 'codebase-agent',
  },

  {
    to: '/performances',
    label: 'Performance',
    icon: Drama,
    name: 'performances',
  },
  { to: '/videos', label: 'Stream', icon: Film, name: 'videos' },

  { to: '/users', label: 'Users', icon: Users, name: 'users' },
  { to: '/profile', label: 'Profile', icon: CircleUser, name: 'profile' },

  {
    to: '/marketplace',
    label: 'Marketplace',
    icon: ShoppingCart,
    name: 'marketplace',
    inDevelopment: true,
  },
  {
    to: '/feedback',
    label: 'Ideas & Bugs',
    icon: MessageSquarePlus,
    name: 'feedback',
  },
];

const SIDEBAR_WIDTH_KEY = 'yolnoma_sidebar_width';
const SIDEBAR_COLLAPSED_KEY = 'yolnoma_sidebar_collapsed';
const DEFAULT_SIDEBAR_WIDTH = 256;
const MIN_SIDEBAR_WIDTH = 240;
const MAX_SIDEBAR_WIDTH = 420;
const COLLAPSED_SIDEBAR_WIDTH = 72;

function getStoredWidth() {
  const storedWidth = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY));
  return Number.isFinite(storedWidth)
    ? Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, storedWidth))
    : DEFAULT_SIDEBAR_WIDTH;
}

export default function Sidebar() {
  const [version, setVersion] = useState<string>('');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [width, setWidth] = useState(getStoredWidth);
  const [isCollapsed, setIsCollapsed] = useState(
    () => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true',
  );
  const [isResizing, setIsResizing] = useState(false);
  const resizeStart = useRef({ pointerX: 0, width: DEFAULT_SIDEBAR_WIDTH });
  const { logout, user } = useAuth();
  const { pinnedTools, togglePinnedTool } = usePinnedTools();

  const pluginNavItems = usePluginNavigation();

  useEffect(() => {
    getVersion()
      .then(setVersion)
      .catch(() => setVersion('0.0.0'));
  }, []);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(width));
  }, [width]);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(isCollapsed));
  }, [isCollapsed]);

  useEffect(() => {
    if (!isResizing) return;

    const handlePointerMove = (event: PointerEvent) => {
      const nextWidth =
        resizeStart.current.width +
        event.clientX -
        resizeStart.current.pointerX;
      setWidth(
        Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, nextWidth)),
      );
    };
    const stopResizing = () => setIsResizing(false);

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopResizing);
    window.addEventListener('pointercancel', stopResizing);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopResizing);
      window.removeEventListener('pointercancel', stopResizing);
    };
  }, [isResizing]);

  const startResizing = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    resizeStart.current = { pointerX: event.clientX, width };
    setIsResizing(true);
  };

  // Filter links based on user's role
  const toolLinks: SidebarLink[] = TOOL_CATALOG.map((tool) => ({
    ...tool,
    name: tool.id,
  }));
  const filteredLinks = [...links, ...toolLinks].filter((link) =>
    canAccessPage(user?.role, link.name),
  );
  const navigationGroups = [
    {
      label: 'Home',
      items: filteredLinks.filter((link) =>
        ['dashboard', 'agent', 'codebase-agent'].includes(link.name),
      ),
    },
    {
      label: 'Workspace',
      items: filteredLinks.filter((link) =>
        ['performances', 'videos', 'users', 'profile', 'marketplace', 'developer-tools', 'feedback'].includes(
          link.name,
        ),
      ),
    },
    {
      label: 'Tools',
      items: filteredLinks
        .filter((link) => TOOL_CATALOG.some((tool) => tool.id === link.name) && link.name !== 'developer-tools')
        .sort((left, right) => left.label.localeCompare(right.label)),
    },
  ];

  return (
    <aside
      className={`select-none relative shrink-0 border-r border-[var(--border)] bg-[var(--bg-elevated)] flex flex-col ${isResizing ? '' : 'transition-[width] duration-200'}`}
      style={{ width: isCollapsed ? COLLAPSED_SIDEBAR_WIDTH : width }}
    >
      {/* Brand */}
      <div
        className={`relative border-b border-[var(--border)] overflow-hidden ${isCollapsed ? 'px-3 py-4' : 'px-6 py-7'}`}
      >
        <div
          className="pointer-events-none absolute -top-10 -left-10 h-32 w-32 rounded-full opacity-20 blur-3xl"
          style={{ background: 'var(--accent)' }}
        />
        {!isCollapsed && (
          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text -faint)] mb-1 relative font-semibold">
            ULTIMATE EDITION
          </p>
        )}
        {!isCollapsed && (
          <h1 className="relative font-serif text-2xl font-medium tracking-tight text-[var(--text-primary)]">
            Yolnoma
          </h1>
        )}
        <button
          type="button"
          onClick={() => setIsCollapsed((collapsed) => !collapsed)}
          className={`relative flex items-center justify-center rounded-md text-[var(--text-faint)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors ${isCollapsed ? 'mx-auto mt-0 h-9 w-9' : 'absolute right-4 top-4 h-8 w-8'}`}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <PanelLeftOpen size={17} />
          ) : (
            <PanelLeftClose size={17} />
          )}
        </button>
      </div>

      {/* Nav */}
      <nav
        className={`flex-1 space-y-1 flex flex-col overflow-y-auto ${isCollapsed ? 'p-2' : 'p-3'}`}
      >
        {navigationGroups.map(
          (group) =>
            group.items.length > 0 && (
              <div key={group.label} className="space-y-1">
                {!isCollapsed && (
                  <div className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
                    {group.label}
                  </div>
                )}
                {group.items.map((link) => {
                  const { to, label, icon: Icon } = link;
                  const inDev =
                    link.inDevelopment || isFeatureInDevelopment(link.name);
                  const hasBypass = canAccessDevFeature(user?.role, link.name);

                  return (
                    <NavLink
                      key={to}
                      to={to}
                      end={to === '/'}
                      title={isCollapsed ? label : undefined}
                      onClick={(e) => {
                        if (link.name === 'agent') {
                          if (handleDevFeatureClick(e, link.name, user?.role)) return;
                          e.preventDefault();
                          void openAgentWindow();
                          return;
                        }
                        handleDevFeatureClick(e, link.name, user?.role);
                      }}
                      className={({ isActive }) =>
                        `group relative flex items-center gap-3 rounded-lg py-2.5 text-sm font-medium transition-colors duration-150 ${isCollapsed ? 'justify-center px-2' : 'px-4'} ${
                          isActive
                            ? 'bg-[var(--accent-glow)] text-[var(--text-primary)]'
                            : inDev && !hasBypass
                              ? 'text-[var(--text-muted)] opacity-80 hover:opacity-100 hover:bg-amber-500/[0.04]'
                              : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[rgba(242,237,230,0.04)]'
                        }`
                      }
                    >
                      {({ isActive }) => {
                        const iconClassName = isActive
                          ? 'text-[var(--accent)]'
                          : inDev && !hasBypass
                            ? 'text-amber-400/60 group-hover:text-amber-400'
                            : 'text-[var(--text-faint)] group-hover:text-[var(--text-muted)]';

                        return (
                          <>
                            <span
                              className={`absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[3px] rounded-full transition-opacity duration-150 ${
                                isActive
                                  ? 'opacity-100 bg-[var(--accent)]'
                                  : 'opacity-0'
                              }`}
                            />
                            {typeof Icon === 'string' ? (
                              <img
                                src={Icon}
                                alt=""
                                className={`h-[17px] w-[17px] object-contain ${iconClassName}`}
                              />
                            ) : (
                              <Icon
                                size={17}
                                strokeWidth={1.75}
                                className={iconClassName}
                              />
                            )}
                            {!isCollapsed && (
                              <span className="truncate">{label}</span>
                            )}
                            {!isCollapsed &&
                              TOOL_CATALOG.some(
                                (tool) => tool.id === link.name,
                              ) && link.name !== 'developer-tools' && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    togglePinnedTool(link.name);
                                  }}
                                  className={`ml-auto rounded p-1 transition-colors ${
                                    pinnedTools.includes(link.name)
                                      ? 'text-[var(--accent)]'
                                      : 'text-[var(--text-faint)] hover:text-[var(--accent)]'
                                  }`}
                                  title={
                                    pinnedTools.includes(link.name)
                                      ? 'Remove from Dashboard'
                                      : 'Add to Dashboard'
                                  }
                                  aria-label={
                                    pinnedTools.includes(link.name)
                                      ? `Remove ${label} from Dashboard`
                                      : `Add ${label} to Dashboard`
                                  }
                                >
                                  <Star
                                    size={13}
                                    fill={
                                      pinnedTools.includes(link.name)
                                        ? 'currentColor'
                                        : 'none'
                                    }
                                  />
                                </button>
                              )}
                            {!isCollapsed && inDev && (
                              <span
                                className={`ml-auto text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                                  hasBypass
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                    : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                }`}
                                title={
                                  hasBypass
                                    ? 'In Development (Access granted for your role)'
                                    : 'In Development (Locked)'
                                }
                              >
                                {hasBypass ? 'TEST' : 'DEV'}
                              </span>
                            )}
                          </>
                        );
                      }}
                    </NavLink>
                  );
                })}
              </div>
            ),
        )}
        {/* Plugin Navigation Section */}
        {pluginNavItems.length > 0 && (
          <div className="pt-3">
            {!isCollapsed && (
              <div className="px-4 py-1.5 text-[10px] uppercase tracking-[0.18em] text-[var(--text-faint)] font-semibold">
                Plugins
              </div>
            )}
            <div className="space-y-1 mt-1">
              {pluginNavItems.map((item) => (
                <NavLink
                  key={item.fullPath}
                  to={item.fullPath}
                  title={isCollapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    `group relative flex items-center gap-3 rounded-lg py-2.5 text-sm font-medium transition-colors duration-150 ${isCollapsed ? 'justify-center px-2' : 'px-4'} ${
                      isActive
                        ? 'bg-[var(--accent-glow)] text-[var(--text-primary)]'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[rgba(242,237,230,0.04)]'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={`absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[3px] rounded-full transition-opacity duration-150 ${
                          isActive
                            ? 'opacity-100 bg-[var(--accent)]'
                            : 'opacity-0'
                        }`}
                      />
                      {item.icon && typeof item.icon !== 'string' ? (
                        item.icon
                      ) : (
                        <Blocks
                          size={17}
                          strokeWidth={1.75}
                          className={
                            isActive
                              ? 'text-[var(--accent)]'
                              : 'text-[var(--text-faint)] group-hover:text-[var(--text-muted)]'
                          }
                        />
                      )}
                      {!isCollapsed && (
                        <span className="truncate">{item.label}</span>
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        )}
        <div className="flex-1" /> {/* Spacer */}
        {/* Separator */}
        <div className="h-px bg-[var(--border)] my-3 mx-2" />
        {/* Logout Button */}
        <button
          onClick={() => setShowLogoutConfirm(true)}
          className={`group relative w-full flex items-center gap-3 rounded-lg py-2.5 text-sm font-medium text-red-400/80 hover:text-red-400 hover:bg-red-500/10 transition-colors duration-150 cursor-pointer ${isCollapsed ? 'justify-center px-2' : 'px-4'}`}
          title={isCollapsed ? 'Sign out' : undefined}
          aria-label={isCollapsed ? 'Sign out' : undefined}
        >
          <LogOut
            size={17}
            strokeWidth={1.75}
            className="text-red-400/60 group-hover:text-red-400"
          />
          {!isCollapsed && 'Sign out'}
        </button>
      </nav>

      {/* Footer */}
      <div
        className={`border-t border-[var(--border)] ${isCollapsed ? 'p-2' : 'p-4'}`}
      >
        {!isCollapsed && (
          <p className="text-[11px] text-[var(--text-faint)] px-2 font-mono">
            {version ? `v${version} — @ 2026 JK Software` : 'Loading…'}
          </p>
        )}
      </div>

      {!isCollapsed && (
        <div
          role="separator"
          aria-label="Resize sidebar"
          aria-orientation="vertical"
          onPointerDown={startResizing}
          className="absolute right-[-3px] top-0 z-20 h-full w-1 cursor-col-resize hover:bg-[var(--accent)] active:bg-[var(--accent)]"
          title="Drag to resize sidebar"
        />
      )}

      {/* Sign Out Confirmation Modal */}
      <ConfirmModal
        open={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={async () => {
          setShowLogoutConfirm(false);
          await logout();
        }}
        title="Sign Out"
        description="Are you sure you want to sign out of your account? You will need to sign in again to access your workspace."
        confirmText="Sign Out"
        cancelText="Cancel"
        variant="danger"
      />
    </aside>
  );
}
