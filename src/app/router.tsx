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
              <Route
                path="/tools/steam/sam"
                element={
                  <DevelopmentGuard featureName="steam-sam">
                    <SteamSamPage />
                  </DevelopmentGuard>
                }
              />

              {/* STABLE TOOLS */}
              <Route path="/tools/currency" element={<CurrencyConverterPage />} />
              <Route path="/tools/bg-remover" element={<BackgroundRemoverPage />} />
              <Route path='/tools/cleaner' element={<CleanerPage />}/>
              <Route path="/tools/steam/steam-idler" element={<SteamIdlerPage />} />

              {/* PERFORMANCE ROUTES */}
              <Route path="/performances" element={<PerformancePage />} />
              <Route path="/performances/:id" element={<PerformanceDetailPage />} />

              {/* VIDEO ROUTES */}
              <Route path="/videos" element={<VideosPage />} />
              <Route path="/videos/:videoId" element={<VideoDetailPage />} />

              {/* USERS ROUTES */}
              <Route path="/users" element={<UsersPage />} />

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
