// ===== ROLES =====
export const ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  TESTER: 'tester',
  USER: 'user',
};

// ===== ROLE PERMISSIONS =====
// List of pages/features each role can access
// NOTE: 'users' page is strictly for owner and admin only.
// NOTE: 'performances' and 'videos' pages are strictly for owner only.
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  [ROLES.OWNER]: ['dashboard', 'agent', 'codebase-agent', 'currency', 'bg-remover', 'cleaner', 'crosshair-overlay', 'image-converter', 'video-downloader', 'port-scanner', 'archive-explorer', 'ai-chat', 'steam-idler', 'steam-sam', 'steam-review', 'marketplace', 'performances', 'videos', 'users', 'settings', 'profile'],
  [ROLES.ADMIN]: ['dashboard', 'agent', 'codebase-agent', 'currency', 'bg-remover', 'cleaner', 'crosshair-overlay', 'image-converter', 'video-downloader', 'port-scanner', 'archive-explorer', 'ai-chat', 'steam-idler', 'steam-sam', 'steam-review', 'marketplace', 'users', 'settings', 'profile'],
  [ROLES.TESTER]: ['dashboard', 'agent', 'codebase-agent', 'currency', 'bg-remover', 'cleaner', 'crosshair-overlay', 'image-converter', 'video-downloader', 'port-scanner', 'archive-explorer', 'ai-chat', 'steam-idler', 'steam-sam', 'steam-review', 'marketplace', 'settings', 'profile'],
  [ROLES.USER]: ['dashboard', 'agent', 'codebase-agent', 'currency', 'bg-remover', 'cleaner', 'crosshair-overlay', 'image-converter', 'video-downloader', 'port-scanner', 'archive-explorer', 'ai-chat', 'steam-idler', 'steam-sam', 'steam-review', 'marketplace', 'settings', 'profile'],
};

// ===== PAGE ROLES (auto-generated from ROLE_PERMISSIONS) =====
export const PAGE_ROLES = Object.keys(ROLE_PERMISSIONS).reduce((acc, role) => {
  ROLE_PERMISSIONS[role].forEach((page) => {
    if (!acc[page]) acc[page] = [];
    acc[page].push(role);
  });
  return acc;
}, {} as Record<string, string[]>);

// ===== Check if user can access a page =====
export const canAccessPage = (role: string | undefined, page: string): boolean => {
  if (!role) return false;
  if (role === ROLES.OWNER) return true; // Owner has full access to everything
  return Boolean(page && PAGE_ROLES[page]?.includes(role));
};

// ===== Get visible pages for sidebar =====
export const getVisiblePages = (role: string | undefined): string[] => {
  if (!role) return [];
  return ROLE_PERMISSIONS[role] ?? [];
};
