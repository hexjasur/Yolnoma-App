import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { canAccessPage } from '../../config/roles';

const getPageKey = (pathname: string): string => {
  if (pathname === '/') return 'dashboard';
  if (pathname.startsWith('/tools/bg-remover')) return 'bg-remover';
  if (pathname.startsWith('/performances')) return 'performances';
  if (pathname.startsWith('/videos')) return 'videos';
  if (pathname.startsWith('/users')) return 'users';
  if (pathname.startsWith('/profile')) return 'profile';
  return '';
};

export default function ProtectedLayout() {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    // Redirect to the login page, but save the current location they were
    // trying to go to when they were redirected. This allows us to send them
    // along to that page after they login, which is a nicer user experience
    // than dropping them off on the home page.
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const pageKey = getPageKey(location.pathname);
  if (pageKey && !canAccessPage(user?.role, pageKey)) {
    // Redirect to dashboard if the user does not have permission
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
