import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import { canAccessPage } from '@/config/roles';
import { toast } from '@/shared/ui/Toast';

interface RoleGuardProps {
  /** The page name key used in ROLE_PERMISSIONS (e.g., 'users', 'performances') */
  page: string;
  children: React.ReactNode;
  fallbackPath?: string;
  message?: string;
}

/**
 * Blocks access to a route if the current user's role does not have permission
 * for the given page (as defined in ROLE_PERMISSIONS in roles.ts).
 * Redirects to fallbackPath and shows a warning toast.
 */
export default function RoleGuard({
  page,
  children,
  fallbackPath = '/',
  message = 'You do not have permission to access this page.',
}: RoleGuardProps) {
  const { user } = useAuth();
  const allowed = canAccessPage(user?.role, page);

  useEffect(() => {
    if (!allowed) {
      toast.warning(message);
    }
  }, [allowed, message]);

  if (!allowed) {
    return <Navigate to={fallbackPath} replace />;
  }

  return <>{children}</>;
}
