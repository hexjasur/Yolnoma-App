import { HashRouter, Routes, Route } from 'react-router-dom';

import Layout from '@/app/layout/Layout';
import ProtectedLayout from '@/app/layout/ProtectedLayout';
import LoginPage from '@/features/auth/pages/LoginPage';
import SessionManagementPage from '@/features/auth/pages/SessionManagementPage';
import ProfilePage from '@/features/account/pages/ProfilePage';
import SettingsPage from '@/features/account/pages/SettingsPage';
import BackgroundRemoverPage from '@/features/background-remover/pages/BackgroundRemoverPage';
import MarketplacePage from '@/features/marketplace/pages/MarketplacePage';
import CurrencyConverterPage from '@/features/currency/pages/CurrencyConverterPage';
import DashboardPage from '@/features/dashboard/pages/DashboardPage';
import PerformanceDetailPage from '@/features/performance/pages/PerformanceDetailPage';
import PerformancePage from '@/features/performance/pages/PerformancePage';
import SteamIdlerPage from '@/features/steam-idler/pages/SteamIdlerPage';
import SteamSamPage from '@/features/steam-sam/pages/SteamSamPage';
import UsersPage from '@/features/users/pages/UsersPage';
import VideoDetailPage from '@/features/videos/pages/VideoDetailPage';
import VideosPage from '@/features/videos/pages/VideosPage';
import { usePluginRoutes } from '@/plugins';
import CleanerPage from '@/features/cleaner/pages/CleanerPage';
import DevelopmentGuard from '@/shared/ui/DevelopmentGuard';
import RoleGuard from '@/shared/ui/RoleGuard';

export default function AppRoutes() {
  const pluginRoutes = usePluginRoutes();

  return (
    <HashRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/session-limit" element={<SessionManagementPage />} />

        {/* Protected Routes */}
        <Route element={<ProtectedLayout />}>
          <Route element={<Layout />}>
            <Route path="/" element={<DashboardPage />} />

            {/* IN-DEVELOPMENT PROTECTED ROUTES */}
            <Route
              path="/marketplace"
              element={
                <DevelopmentGuard featureName="marketplace">
                  <MarketplacePage />
                </DevelopmentGuard>
              }
            />

            {/* STABLE TOOLS */}
            <Route path="/tools/currency" element={<CurrencyConverterPage />} />
            <Route
              path="/tools/bg-remover"
              element={<BackgroundRemoverPage />}
            />
            <Route path="/tools/cleaner" element={<CleanerPage />} />
            <Route path="/tools/steam/sam" element={<SteamSamPage />} />
            <Route
              path="/tools/steam/steam-idler"
              element={<SteamIdlerPage />}
            />

            {/* PERFORMANCE ROUTES — Owner only */}
            <Route
              path="/performances"
              element={
                <RoleGuard
                  page="performances"
                  message="Access restricted: Performances section is available to Owner only."
                >
                  <PerformancePage />
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
                  <PerformanceDetailPage />
                </RoleGuard>
              }
            />

            {/* VIDEO ROUTES — Owner only */}
            <Route
              path="/videos"
              element={
                <RoleGuard
                  page="videos"
                  message="Access restricted: Stream section is available to Owner only."
                >
                  <VideosPage />
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
                  <VideoDetailPage />
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
                  <UsersPage />
                </RoleGuard>
              }
            />

            {/* PROFILE & SETTINGS ROUTES */}
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/settings" element={<SettingsPage />} />

            {/* PLUGIN DYNAMIC ROUTES */}
            {pluginRoutes.map((route) => {
              const Component = route.component;
              return (
                <Route
                  key={route.fullPath}
                  path={route.fullPath}
                  element={<Component />}
                />
              );
            })}
          </Route>
        </Route>
      </Routes>
    </HashRouter>
  );
}
