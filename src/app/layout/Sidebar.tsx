import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { getVersion } from "@tauri-apps/api/app";
import {
  LayoutGrid,
  Drama,
  Film,
  LogIn,
  LogOut,
  Users,
  CircleUser,
  Blocks,
  ShoppingCart,
  PanelLeftClose,
  PanelLeftOpen,
  Star,
  MessageSquarePlus,
  Keyboard,
} from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import { canAccessPage } from "@/config/roles";
import { canAccessDevFeature, handleDevFeatureClick } from "@/config/features";
import { usePluginNavigation } from "@/plugins";
import { ConfirmModal } from "@/shared/ui";
import { TOOL_CATALOG } from "@/config/toolCatalog";
import { usePinnedTools } from "@/shared/hooks/usePinnedTools";
import { useActiveToolsStatus } from "@/shared/hooks/useActiveToolsStatus";
import type { LucideIcon } from "lucide-react";
import { openAgentWindow } from "@/shared/lib/window";
import { getNavigationRoutes } from "@/app/routes.config";
import { useTranslation } from "react-i18next";

type SidebarLink = {
  to: string;
  label: string;
  icon: LucideIcon | string;
  name: string;
  status: "stable" | "dev" | "test";
  navGroup: "home" | "workspace" | "tools" | "steam";
};

const NAV_ICON_OVERRIDES: Record<string, LucideIcon> = {
  dashboard: LayoutGrid,
  performances: Drama,
  videos: Film,
  users: Users,
  profile: CircleUser,
  feedback: MessageSquarePlus,
  marketplace: ShoppingCart,
};

const links: SidebarLink[] = getNavigationRoutes().map((route) => ({
  to: route.path,
  label: route.label ?? route.id,
  icon: NAV_ICON_OVERRIDES[route.id] ?? route.icon ?? Blocks,
  name: route.id,
  status: route.status ?? "stable",
  navGroup: route.navGroup ?? "tools",
}));
const GUEST_NAVIGATION = new Set([
  "dashboard",
  "currency",
  "bg-remover",
  "archive-explorer",
  "ai-chat-2b-model",
  "ai-tools",
  "cleaner",
  "crosshair-overlay",
  "steam-sam",
  "steam-review",
  "developer-tools",
  "json-viewer",
  "css-tools",
  "feedback",
]);

const SIDEBAR_WIDTH_KEY = "yolnoma_sidebar_width";
const SIDEBAR_COLLAPSED_KEY = "yolnoma_sidebar_collapsed";
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
  const [version, setVersion] = useState<string>("");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [width, setWidth] = useState(getStoredWidth);
  const [isCollapsed, setIsCollapsed] = useState(
    () => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true",
  );
  const [isResizing, setIsResizing] = useState(false);
  const resizeStart = useRef({ pointerX: 0, width: DEFAULT_SIDEBAR_WIDTH });
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation("common");
  const { pinnedTools, togglePinnedTool } = usePinnedTools();
  const { idlingCount, isCrosshairActive } = useActiveToolsStatus();

  const pluginNavItems = usePluginNavigation();

  useEffect(() => {
    const handleToggle = () => {
      setIsCollapsed((prev) => !prev);
    };
    window.addEventListener("yolnoma:toggle-sidebar", handleToggle);
    return () =>
      window.removeEventListener("yolnoma:toggle-sidebar", handleToggle);
  }, []);

  useEffect(() => {
    getVersion()
      .then(setVersion)
      .catch(() => setVersion("0.0.0"));
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

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResizing);
    window.addEventListener("pointercancel", stopResizing);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResizing);
      window.removeEventListener("pointercancel", stopResizing);
    };
  }, [isResizing]);

  const startResizing = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    resizeStart.current = { pointerX: event.clientX, width };
    setIsResizing(true);
  };

  // Guest users can discover public tools; account-owned links stay hidden
  // until a user signs in.
  const filteredLinks = user
    ? links.filter((link) => canAccessPage(user.role, link.name))
    : links.filter((link) => GUEST_NAVIGATION.has(link.name));
  const navigationGroups = [
    {
      key: "home",
      items: filteredLinks.filter((link) => link.navGroup === "home"),
    },
    {
      key: "workspace",
      items: filteredLinks.filter((link) => link.navGroup === "workspace"),
    },
    {
      key: "tools",
      items: filteredLinks
        .filter((link) => link.navGroup === "tools")
        .sort((left, right) => left.label.localeCompare(right.label)),
    },
    {
      key: "steam",
      items: filteredLinks
        .filter((link) => link.navGroup === "steam")
        .sort((left, right) => left.label.localeCompare(right.label)),
    },
  ];

  return (
    <aside
      className={`select-none relative shrink-0 border-r border-[var(--border)] bg-[var(--bg-elevated)] flex flex-col ${isResizing ? "" : "transition-[width] duration-200"}`}
      style={{ width: isCollapsed ? COLLAPSED_SIDEBAR_WIDTH : width }}
    >
      {/* Brand */}
      <div
        className={`relative border-b border-[var(--border)] overflow-hidden ${isCollapsed ? "px-3 py-4" : "px-6 py-7"}`}
      >
        <div
          className="pointer-events-none absolute -top-10 -left-10 h-32 w-32 rounded-full opacity-20 blur-3xl"
          style={{ background: "var(--accent)" }}
        />
        {!isCollapsed && (
          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text -faint)] mb-1 relative font-semibold">
            {t("sidebar.brandEdition")}
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
          className={`relative flex items-center justify-center rounded-md text-[var(--text-faint)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors ${isCollapsed ? "mx-auto mt-0 h-9 w-9" : "absolute right-4 top-4 h-8 w-8"}`}
          title={isCollapsed ? t("sidebar.expand") : t("sidebar.collapse")}
          aria-label={isCollapsed ? t("sidebar.expand") : t("sidebar.collapse")}
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
        className={`flex-1 space-y-1 flex flex-col overflow-y-auto ${isCollapsed ? "p-2" : "p-3"}`}
      >
        {navigationGroups.map(
          (group) =>
            group.items.length > 0 && (
              <div key={group.key} className="space-y-1">
                {!isCollapsed && (
                  <div className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
                    {t(`navigation.groups.${group.key}`)}
                  </div>
                )}
                {group.items.map((link) => {
                  const { to, icon: Icon } = link;
                  const label = t(`navigation.routes.${link.name}`, {
                    defaultValue: link.label,
                  });
                  const inDev = link.status !== "stable";
                  const hasBypass = canAccessDevFeature(user?.role, link.name);

                  return (
                    <NavLink
                      key={to}
                      to={to}
                      end={to === "/"}
                      title={isCollapsed ? label : undefined}
                      onClick={(e) => {
                        if (link.name === "agent") {
                          if (handleDevFeatureClick(e, link.name, user?.role))
                            return;
                          e.preventDefault();
                          void openAgentWindow();
                          return;
                        }
                        handleDevFeatureClick(e, link.name, user?.role);
                      }}
                      className={({ isActive }) =>
                        `group relative flex items-center gap-3 rounded-lg py-2.5 text-sm font-medium transition-colors duration-150 ${isCollapsed ? "justify-center px-2" : "px-4"} ${
                          isActive
                            ? "bg-[var(--accent-glow)] text-[var(--text-primary)]"
                            : inDev && !hasBypass
                              ? "text-[var(--text-muted)] opacity-80 hover:opacity-100 hover:bg-amber-500/[0.04]"
                              : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[rgba(242,237,230,0.04)]"
                        }`
                      }
                    >
                      {({ isActive }) => {
                        const iconClassName = isActive
                          ? "text-[var(--accent)]"
                          : inDev && !hasBypass
                            ? "text-amber-400/60 group-hover:text-amber-400"
                            : "text-[var(--text-faint)] group-hover:text-[var(--text-muted)]";

                        return (
                          <>
                            <span
                              className={`absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[3px] rounded-full transition-opacity duration-150 ${
                                isActive
                                  ? "opacity-100 bg-[var(--accent)]"
                                  : "opacity-0"
                              }`}
                            />
                            {typeof Icon === "string" ? (
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

                            {/* Collapsed view status dots */}
                            {isCollapsed &&
                              link.name === "steam-idler" &&
                              idlingCount > 0 && (
                                <span
                                  className="absolute top-1.5 right-1.5 flex h-2 w-2"
                                  title={`Steam Idling: ${idlingCount} ta o‘yin faol`}
                                >
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                                </span>
                              )}
                            {isCollapsed &&
                              link.name === "crosshair-overlay" &&
                              isCrosshairActive && (
                                <span
                                  className="absolute top-1.5 right-1.5 flex h-2 w-2"
                                  title="Crosshair faol"
                                >
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500 shadow-[0_0_6px_#0ea5e9]" />
                                </span>
                              )}

                            {!isCollapsed && (
                              <span className="truncate">{label}</span>
                            )}

                            {/* Expanded view live indicators */}
                            {!isCollapsed &&
                              link.name === "steam-idler" &&
                              idlingCount > 0 && (
                                <span
                                  className="ml-auto mr-1 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono font-semibold shrink-0 shadow-sm"
                                  title={`Steam Idling: ${idlingCount} ta o‘yin fonda ishlamoqda`}
                                >
                                  <span className="relative flex h-1.5 w-1.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                                  </span>
                                  <span>{idlingCount}</span>
                                </span>
                              )}

                            {!isCollapsed &&
                              link.name === "crosshair-overlay" &&
                              isCrosshairActive && (
                                <span
                                  className="ml-auto mr-1 flex items-center gap-1 px-1.5 py-0.5 rounded bg-sky-500/15 border border-sky-500/30 text-sky-400 text-[9px] font-mono font-bold shrink-0"
                                  title="Crosshair Overlay faol"
                                >
                                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-400" />
                                  <span>ON</span>
                                </span>
                              )}
                            {!isCollapsed &&
                              TOOL_CATALOG.some(
                                (tool) => tool.id === link.name,
                              ) &&
                              !["developer-tools", "ai-tools"].includes(
                                link.name,
                              ) && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    togglePinnedTool(link.name);
                                  }}
                                  className={`ml-auto rounded p-1 transition-colors ${
                                    pinnedTools.includes(link.name)
                                      ? "text-[var(--accent)]"
                                      : "text-[var(--text-faint)] hover:text-[var(--accent)]"
                                  }`}
                                  title={
                                    pinnedTools.includes(link.name)
                                      ? t("sidebar.removeFromDashboard", {
                                          label,
                                        })
                                      : t("sidebar.addToDashboard", { label })
                                  }
                                  aria-label={
                                    pinnedTools.includes(link.name)
                                      ? t("sidebar.removeFromDashboard", {
                                          label,
                                        })
                                      : t("sidebar.addToDashboard", { label })
                                  }
                                >
                                  <Star
                                    size={13}
                                    fill={
                                      pinnedTools.includes(link.name)
                                        ? "currentColor"
                                        : "none"
                                    }
                                  />
                                </button>
                              )}
                            {!isCollapsed && inDev && (
                              <span
                                className={`ml-auto text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                                  hasBypass
                                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                    : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                }`}
                                title={
                                  hasBypass
                                    ? "In Development (Access granted for your role)"
                                    : "In Development (Locked)"
                                }
                              >
                                {link.status === "test" || hasBypass
                                  ? "TEST"
                                  : "DEV"}
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
                {t("navigation.groups.plugins")}
              </div>
            )}
            <div className="space-y-1 mt-1">
              {pluginNavItems.map((item) => (
                <NavLink
                  key={item.fullPath}
                  to={item.fullPath}
                  title={isCollapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    `group relative flex items-center gap-3 rounded-lg py-2.5 text-sm font-medium transition-colors duration-150 ${isCollapsed ? "justify-center px-2" : "px-4"} ${
                      isActive
                        ? "bg-[var(--accent-glow)] text-[var(--text-primary)]"
                        : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[rgba(242,237,230,0.04)]"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={`absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[3px] rounded-full transition-opacity duration-150 ${
                          isActive
                            ? "opacity-100 bg-[var(--accent)]"
                            : "opacity-0"
                        }`}
                      />
                      {item.icon && typeof item.icon !== "string" ? (
                        item.icon
                      ) : (
                        <Blocks
                          size={17}
                          strokeWidth={1.75}
                          className={
                            isActive
                              ? "text-[var(--accent)]"
                              : "text-[var(--text-faint)] group-hover:text-[var(--text-muted)]"
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
        {/* Authentication CTA */}
        <button
          onClick={() =>
            user ? setShowLogoutConfirm(true) : navigate("/login")
          }
          className={`group relative w-full flex items-center gap-3 rounded-lg py-2.5 text-sm font-medium text-red-400/80 hover:text-red-400 hover:bg-red-500/10 transition-colors duration-150 cursor-pointer ${isCollapsed ? "justify-center px-2" : "px-4"}`}
          title={isCollapsed ? (user ? t("sidebar.signOut") : t("auth.login")) : undefined}
          aria-label={isCollapsed ? (user ? t("sidebar.signOut") : t("auth.login")) : undefined}
        >
          {user ? (
            <LogOut
              size={17}
              strokeWidth={1.75}
              className="text-red-400/60 group-hover:text-red-400"
            />
          ) : (
            <LogIn
              size={17}
              strokeWidth={1.75}
              className="text-[var(--accent)]/70 group-hover:text-[var(--accent)]"
            />
          )}
          {!isCollapsed && (user ? t("sidebar.signOut") : t("auth.login"))}
        </button>
      </nav>

      {/* Footer */}
      <div
        className={`border-t border-[var(--border)] ${isCollapsed ? "p-2" : "p-3"}`}
      >
        <div
          className={`flex items-center ${isCollapsed ? "justify-center" : "justify-between px-1"}`}
        >
          {!isCollapsed && (
            <p className="text-[11px] text-[var(--text-faint)] font-mono truncate">
              {version ? `v${version}` : "Loading…"}
            </p>
          )}
          <button
            type="button"
            onClick={() =>
              window.dispatchEvent(new CustomEvent("yolnoma:open-shortcuts"))
            }
            className="flex items-center justify-center p-1.5 rounded-md hover:bg-white/[0.08] text-white/40 hover:text-[var(--accent)] transition-colors"
            title={t("sidebar.keyboardShortcuts")}
            aria-label={t("sidebar.keyboardShortcuts")}
          >
            <Keyboard size={15} />
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div
          role="separator"
          aria-label={t("sidebar.resize")}
          aria-orientation="vertical"
          onPointerDown={startResizing}
          className="absolute right-[-3px] top-0 z-20 h-full w-1 cursor-col-resize hover:bg-[var(--accent)] active:bg-[var(--accent)]"
          title={t("sidebar.resize")}
        />
      )}

      {/* Sign Out Confirmation Modal */}
      <ConfirmModal
        open={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={async () => {
          setShowLogoutConfirm(false);
          await logout();
          navigate("/dashboard", { replace: true });
        }}
        title={t("sidebar.signOutTitle")}
        description={t("sidebar.signOutDescription")}
        confirmText={t("sidebar.signOut")}
        cancelText={t("sidebar.cancel")}
        variant="danger"
      />
    </aside>
  );
}
