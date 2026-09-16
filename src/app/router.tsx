import { lazy, Suspense, type ReactElement, type ReactNode } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';

import Layout from '@/app/layout/Layout';
import ProtectedLayout from '@/app/layout/ProtectedLayout';
import RouteLoadingFallback from '@/app/components/RouteLoadingFallback';
import RouteLoadErrorFallback from '@/app/components/RouteLoadErrorFallback';
import RouteStatusGuard from '@/app/components/RouteStatusGuard';
import MobileAccessGuard from '@/app/components/MobileAccessGuard';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import LoginPage from '@/features/auth/pages/LoginPage';
import SessionManagementPage from '@/features/auth/pages/SessionManagementPage';
import RoleGuard from '@/shared/ui/RoleGuard';
import { usePluginRoutes } from '@/plugins';
import { ROUTE_CONFIG, type RouteDefinition } from './routes.config';

const CrosshairOverlayWindow = lazy(() => import('@/features/crosshair/pages/CrosshairOverlayWindow'));

function RouteContent({ children }: { children: ReactNode }) {
  return (
    <AppErrorBoundary fallback={<RouteLoadErrorFallback />}>
      <Suspense fallback={<RouteLoadingFallback />}>{children}</Suspense>
    </AppErrorBoundary>
  );
}

function createConfiguredRoute(route: RouteDefinition): ReactElement {
  const Page = route.component;
  let content = (
      <RouteStatusGuard status={route.status} featureName={route.id}>
        <MobileAccessGuard allowed={route.mobile === true} featureName={route.label ?? route.id}>
          <RouteContent>
            <Page />
          </RouteContent>
        </MobileAccessGuard>
      </RouteStatusGuard>
  );

  if (route.guard?.kind === 'role') {
    content = (
      <RoleGuardWrapper page={route.guard.page} message={route.guard.message}>
        {content}
      </RoleGuardWrapper>
    );
  }

  return <Route key={route.id} path={route.path} element={content} />;
}

function RoleGuardWrapper({
  page,
  message,
  children,
}: {
  page: string;
  message: string;
  children: ReactNode;
}) {
  return (
    <RoleGuard page={page} message={message}>
      {children}
    </RoleGuard>
  );
}

export default function AppRoutes() {
  const pluginRoutes = usePluginRoutes();
  const layoutRoutes = ROUTE_CONFIG.filter((route) => route.id !== 'agent');
  const agentRoute = ROUTE_CONFIG.find((route) => route.id === 'agent');
  const AgentPage = agentRoute?.component;

  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/session-limit" element={<SessionManagementPage />} />
        <Route
          path="/crosshair-overlay-window"
          element={
            <MobileAccessGuard allowed={false} featureName="Crosshair Overlay">
              <RouteContent>
                <CrosshairOverlayWindow />
              </RouteContent>
            </MobileAccessGuard>
          }
        />

        <Route element={<ProtectedLayout />}>
          {agentRoute && (
            <Route
              path={agentRoute.path}
              element={
                <RouteStatusGuard status={agentRoute.status} featureName={agentRoute.id}>
                  <MobileAccessGuard allowed={false} featureName={agentRoute.label ?? agentRoute.id}>
                    {AgentPage && (
                      <RouteContent>
                        <AgentPage />
                      </RouteContent>
                    )}
                  </MobileAccessGuard>
                </RouteStatusGuard>
              }
            />
          )}
          <Route element={<Layout />}>
            {layoutRoutes.map(createConfiguredRoute)}
            {pluginRoutes.map((route) => {
              const Component = route.component;
              return (
                <Route
                  key={route.fullPath}
                  path={route.fullPath}
                  element={
                    <RouteContent>
                      <Component />
                    </RouteContent>
                  }
                />
              );
            })}
          </Route>
        </Route>
      </Routes>
    </HashRouter>
  );
}
