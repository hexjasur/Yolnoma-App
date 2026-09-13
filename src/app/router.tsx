import { lazy, Suspense, type ReactNode } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';

import Layout from '@/app/layout/Layout';
import ProtectedLayout from '@/app/layout/ProtectedLayout';
import RouteLoadingFallback from '@/app/components/RouteLoadingFallback';
import LoginPage from '@/features/auth/pages/LoginPage';
import SessionManagementPage from '@/features/auth/pages/SessionManagementPage';
import DashboardPage from '@/features/dashboard/pages/DashboardPage';
import DevelopmentGuard from '@/shared/ui/DevelopmentGuard';
import RoleGuard from '@/shared/ui/RoleGuard';
import { usePluginRoutes } from '@/plugins';

const ProfilePage = lazy(() => import('@/features/account/pages/ProfilePage'));
const SettingsPage = lazy(() => import('@/features/account/pages/SettingsPage'));
const BackgroundRemoverPage = lazy(() => import('@/features/background-remover/pages/BackgroundRemoverPage'));
const MarketplacePage = lazy(() => import('@/features/marketplace/pages/MarketplacePage'));
const CurrencyConverterPage = lazy(() => import('@/features/currency/pages/CurrencyConverterPage'));
const PerformanceDetailPage = lazy(() => import('@/features/performance/pages/PerformanceDetailPage'));
const PerformancePage = lazy(() => import('@/features/performance/pages/PerformancePage'));
const SteamIdlerPage = lazy(() => import('@/features/steam-idler/pages/SteamIdlerPage'));
const SteamSamPage = lazy(() => import('@/features/steam-sam/pages/SteamSamPage'));
const UsersPage = lazy(() => import('@/features/users/pages/UsersPage'));
const VideoDetailPage = lazy(() => import('@/features/videos/pages/VideoDetailPage'));
const VideosPage = lazy(() => import('@/features/videos/pages/VideosPage'));
const CleanerPage = lazy(() => import('@/features/cleaner/pages/CleanerPage'));
const VideoDownloader = lazy(() =>
  import('@/features/yt-video-downloader/pages/YTVideoDownloader').then(({ VideoDownloader }) => ({
    default: VideoDownloader,
  })),
);
const SteamReviewPage = lazy(() => import('@/features/steam/review/SteamReviewPage'));
const CrosshairPage = lazy(() => import('@/features/crosshair/pages/CrosshairPage'));
const CrosshairOverlayWindow = lazy(() => import('@/features/crosshair/pages/CrosshairOverlayWindow'));
const ImageConverterPage = lazy(() => import('@/features/image-converter/pages/ImageConverterPage'));
const PortScannerPage = lazy(() => import('@/features/port-scanner/pages/PortScannerPage'));
const ArchiveExplorerPage = lazy(() => import('@/features/archive-explorer/pages/ArchiveExplorerPage'));
const AiChatPage = lazy(() => import('@/features/ai/pages/AiChatPage'));
const AiAgentPage = lazy(() => import('@/features/ai/pages/AiAgentPage'));
const CodebaseAgentPage = lazy(() => import('@/features/ai/pages/CodebaseAgentPage'));
const ViCountdown = lazy(() => import('@/features/vi/pages/ViCountdown'));
const World3DPage = lazy(() => import('@/features/world3d/pages/World3DPage'));
const DeveloperToolsPage = lazy(() => import('@/features/developer-tools/pages/DeveloperToolsPage'));
const AiToolsPage = lazy(() => import('@/features/ai-tools/pages/AiToolsPage'));
const CssToolsPage = lazy(() => import('@/features/css-tools/pages/CssToolsPage'));
const GitPage = lazy(() => import('@/features/git/pages/GitPage'));
const FeedbackPage = lazy(() => import('@/features/feedback/pages/FeedbackPage'));
const JsonViewerPage = lazy(() => import('@/features/json-viewer/pages/JsonViewerPage'));

function RouteContent({ children }: { children: ReactNode }) {
  return <Suspense fallback={<RouteLoadingFallback />}>{children}</Suspense>;
}

export default function AppRoutes() {
  const pluginRoutes = usePluginRoutes();

  return (
    <HashRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/session-limit" element={<SessionManagementPage />} />
        <Route
          path="/crosshair-overlay-window"
          element={
            <RouteContent>
              <CrosshairOverlayWindow />
            </RouteContent>
          }
        />

        {/* Protected Routes */}
        <Route element={<ProtectedLayout />}>
          <Route
            path="/agent"
            element={
              <DevelopmentGuard featureName="agent">
                <RouteContent>
                  <AiAgentPage />
                </RouteContent>
              </DevelopmentGuard>
            }
          />
          <Route element={<Layout />}>
            <Route path="/" element={<DashboardPage />} />

            <Route
              path="/codebase-agent"
              element={
                <DevelopmentGuard featureName="codebase-agent">
                  <RouteContent>
                    <CodebaseAgentPage />
                  </RouteContent>
                </DevelopmentGuard>
              }
            />

            {/* IN-DEVELOPMENT PROTECTED ROUTES */}
            <Route
              path="/marketplace"
              element={
                <DevelopmentGuard featureName="marketplace">
                  <RouteContent>
                    <MarketplacePage />
                  </RouteContent>
                </DevelopmentGuard>
              }
            />

            <Route
              path="/vi"
              element={
                <RouteContent>
                  <ViCountdown />
                </RouteContent>
              }
            />

            {/* STABLE TOOLS */}
            <Route
              path="/tools/currency"
              element={
                <RouteContent>
                  <CurrencyConverterPage />
                </RouteContent>
              }
            />
            <Route
              path="/tools/bg-remover"
              element={
                <RouteContent>
                  <BackgroundRemoverPage />
                </RouteContent>
              }
            />
            <Route
              path="/tools/cleaner"
              element={
                <RouteContent>
                  <CleanerPage />
                </RouteContent>
              }
            />
            <Route
              path="/tools/crosshair-overlay"
              element={
                <RouteContent>
                  <CrosshairPage />
                </RouteContent>
              }
            />
            <Route
              path="/tools/image-converter"
              element={
                <RouteContent>
                  <ImageConverterPage />
                </RouteContent>
              }
            />
            <Route
              path="/tools/port-scanner"
              element={
                <RouteContent>
                  <PortScannerPage />
                </RouteContent>
              }
            />
            <Route
              path="/tools/archive-explorer"
              element={
                <RouteContent>
                  <ArchiveExplorerPage />
                </RouteContent>
              }
            />
            <Route
              path="/tools/ai-chat"
              element={
                <RouteContent>
                  <AiChatPage />
                </RouteContent>
              }
            />
            <Route
              path="/tools/ai-tools"
              element={
                <RouteContent>
                  <AiToolsPage />
                </RouteContent>
              }
            />
            <Route
              path="/tools/steam/sam"
              element={
                <RouteContent>
                  <SteamSamPage />
                </RouteContent>
              }
            />
            <Route
              path="/tools/developer-tools"
              element={
                <RouteContent>
                  <DeveloperToolsPage />
                </RouteContent>
              }
            />
            <Route
              path="/tools/css-tools"
              element={
                <RouteContent>
                  <CssToolsPage />
                </RouteContent>
              }
            />
            <Route
              path="/tools/json"
              element={
                <RouteContent>
                  <JsonViewerPage />
                </RouteContent>
              }
            />
            <Route
              path="/tools/git"
              element={
                <RouteContent>
                  <GitPage />
                </RouteContent>
              }
            />
            <Route
              path="/feedback"
              element={
                <RouteContent>
                  <FeedbackPage />
                </RouteContent>
              }
            />
            <Route
              path="/tools/world-3d"
              element={
                <RouteContent>
                  <World3DPage />
                </RouteContent>
              }
            />
            <Route
              path="/tools/steam/review"
              element={
                <RouteContent>
                  <SteamReviewPage />
                </RouteContent>
              }
            />
            <Route
              path="/tools/steam/steam-idler"
              element={
                <RouteContent>
                  <SteamIdlerPage />
                </RouteContent>
              }
            />

            {/* PERFORMANCE ROUTES — Owner only */}
            <Route
              path="/performances"
              element={
                <RoleGuard
                  page="performances"
                  message="Access restricted: Performances section is available to Owner only."
                >
                  <RouteContent>
                    <PerformancePage />
                  </RouteContent>
                </RoleGuard>
              }
            />
            <Route
              path="/performances/:id"
              element={
                <RoleGuard
                  page="performances"
                  message="Access restricted: Performances section is available to Owner only."
                >
                  <RouteContent>
                    <PerformanceDetailPage />
                  </RouteContent>
                </RoleGuard>
              }
            />

            {/* VIDEO ROUTES */}
            <Route
              path="/tools/video-downloader"
              element={
                <RouteContent>
                  <VideoDownloader />
                </RouteContent>
              }
            />
            <Route
              path="/videos"
              element={
                <RoleGuard
                  page="videos"
                  message="Access restricted: Stream section is available to Owner only."
                >
                  <RouteContent>
                    <VideosPage />
                  </RouteContent>
                </RoleGuard>
              }
            />
            <Route
              path="/videos/:videoId"
              element={
                <RoleGuard
                  page="videos"
                  message="Access restricted: Stream section is available to Owner only."
                >
                  <RouteContent>
                    <VideoDetailPage />
                  </RouteContent>
                </RoleGuard>
              }
            />

            {/* USERS ROUTES — Owner & Admin only */}
            <Route
              path="/users"
              element={
                <RoleGuard
                  page="users"
                  message="You do not have permission to access the Users management page."
                >
                  <RouteContent>
                    <UsersPage />
                  </RouteContent>
                </RoleGuard>
              }
            />

            {/* PROFILE & SETTINGS ROUTES */}
            <Route
              path="/profile"
              element={
                <RouteContent>
                  <ProfilePage />
                </RouteContent>
              }
            />
            <Route
              path="/settings"
              element={
                <RouteContent>
                  <SettingsPage />
                </RouteContent>
              }
            />

            {/* PLUGIN DYNAMIC ROUTES */}
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
