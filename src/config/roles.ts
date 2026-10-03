// ===== ROLES =====
export const ROLES = {
  OWNER: "owner",
  ADMIN: "admin",
  // CLOWN: 'clown',
  TESTER: "tester",
  USER: "user",
};

// ===== ROLE PERMISSIONS =====
// List of pages/features each role can access
// NOTE: 'users' page is strictly for owner and admin only.
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  [ROLES.OWNER]: [],

  [ROLES.ADMIN]: ["dashboard", "users", "settings"],

  [ROLES.TESTER]: ["dashboard", "settings"],

  [ROLES.USER]: [
    "dashboard",
    "agent",
    "currency",
    "bg-remover",
    "cleaner",
    "crosshair-overlay",
    "vi",
    "image-converter",
    "video-downloader",
    "port-scanner",
    "archive-explorer",
    "ai-chat-2b-model",
    "ai-tools",
    "steam-idler",
    "steam-sam",
    "steam-review",
    "developer-tools",
    "css-tools",
    "git",
    "world-3d",
    "marketplace",
    "settings",
    "profile",
    "feedback",
    "json-viewer",
    "image",
    "dns-records",
    "start-up-apps",
  ],
};

// ===== PAGE ROLES (auto-generated from ROLE_PERMISSIONS) =====
export const PAGE_ROLES = Object.keys(ROLE_PERMISSIONS).reduce(
  (acc, role) => {
    ROLE_PERMISSIONS[role].forEach((page) => {
      if (!acc[page]) acc[page] = [];
      acc[page].push(role);
    });
    return acc;
  },
  {} as Record<string, string[]>,
);

// ===== Check if user can access a page =====
export const canAccessPage = (
  role: string | undefined,
  page: string,
): boolean => {
  if (!role) return false;
  const normalizedRole = role.trim().toLowerCase();
  if (normalizedRole === ROLES.OWNER) return true; // Owner has full access to everything
  return Boolean(page && PAGE_ROLES[page]?.includes(normalizedRole));
};

// ===== Get visible pages for sidebar =====
export const getVisiblePages = (role: string | undefined): string[] => {
  if (!role) return [];
  return ROLE_PERMISSIONS[role.trim().toLowerCase()] ?? [];
};
