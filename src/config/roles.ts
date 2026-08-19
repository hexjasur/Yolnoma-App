// ===== ROLES =====
export const ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  USER: 'user',
};

// ===== ROLE PERMISSIONS =====
// List of pages/features each role can access
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  [ROLES.OWNER]: ['dashboard', 'currency', 'bg-remover', 'steam-idler', 'performances', 'videos', 'users', 'settings', 'profile'],
  [ROLES.ADMIN]: ['dashboard', 'currency', 'bg-remover', 'steam-idler', 'videos', 'users', 'settings', 'profile'],
  [ROLES.USER]:  ['dashboard', 'currency', 'bg-remover', 'videos', 'settings', 'profile'],
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
