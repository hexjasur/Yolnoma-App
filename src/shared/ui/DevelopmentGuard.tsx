import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import { canAccessDevFeature } from '@/config/features';
import { toast } from '@/shared/ui/Toast';

interface DevelopmentGuardProps {
  featureName: string;
  children: React.ReactNode;
  fallbackPath?: string;
  customMessage?: string;
}

/**
 * Route guard that prevents regular users from accessing in-development pages.
 * Only users with role 'owner' or 'tester' can enter.
 * Other users are redirected to fallbackPath and a warning toast is shown.
 */
export default function DevelopmentGuard({
  featureName,
  children,
  fallbackPath = '/',
  customMessage = 'Cannot access: This feature is currently in development.',
}: DevelopmentGuardProps) {
  const { user } = useAuth();
  const allowed = canAccessDevFeature(user?.role, featureName);

  useEffect(() => {
    if (!allowed) {
      toast.warning(customMessage);
    }
  }, [allowed, customMessage]);

  if (!allowed) {
    return <Navigate to={fallbackPath} replace />;
  }

  return <>{children}</>;
}
