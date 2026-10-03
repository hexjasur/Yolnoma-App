import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import { canAccessPage } from '@/config/roles';

const getPageKey = (pathname: string): string => {
  if (pathname.startsWith('/profile')) return 'profile';
  if (pathname.startsWith('/settings')) return 'settings';
  return '';
};

export default function ProtectedLayout() {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  const pageKey = getPageKey(location.pathname);
  const requiresAuthentication = Boolean(pageKey);

  // Public tools work in guest mode. Account-owned pages still require a
  // session; role-restricted pages use their own RoleGuard wrappers.
  if (requiresAuthentication && !isAuthenticated) {
    // Redirect to the login page, but save the current location they were
    // trying to go to when they were redirected. This allows us to send them
    // along to that page after they login, which is a nicer user experience
    // than dropping them off on the home page.
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (pageKey && !canAccessPage(user?.role, pageKey)) {
    // Redirect to dashboard if the user does not have permission
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
