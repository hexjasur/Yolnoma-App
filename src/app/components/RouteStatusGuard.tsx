import type { ReactNode } from 'react';
import DevelopmentGuard from '@/shared/ui/DevelopmentGuard';
import { canAccessDevFeature } from '@/config/features';
import type { RouteStatus } from '@/app/routes.config';
import { useAuth } from '@/features/auth/AuthContext';
import { Navigate } from 'react-router-dom';
import { toast } from '@/shared/ui/Toast';
import { useEffect } from 'react';

function TestGuard({ featureName, children }: { featureName: string; children: ReactNode }) {
  const { user } = useAuth();
  const allowed = canAccessDevFeature(user?.role, featureName);

  useEffect(() => {
    if (!allowed) toast.warning('Cannot access: This feature is currently in testing.');
  }, [allowed]);

  if (!allowed) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function RouteStatusGuard({
  status = 'stable',
  featureName,
  children,
}: {
  status?: RouteStatus;
  featureName: string;
  children: ReactNode;
}) {
  if (status === 'dev') {
    return <DevelopmentGuard featureName={featureName}>{children}</DevelopmentGuard>;
  }
  if (status === 'test') {
    return <TestGuard featureName={featureName}>{children}</TestGuard>;
  }
  return <>{children}</>;
}
