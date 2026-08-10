import { HashRouter, Routes, Route } from 'react-router-dom';

import Layout from '../components/layout/Layout';
import HomePage from '../pages/HomePage';
import PerformancePage from '../pages/PerformancePage';
import PerformanceDetailPage from './PerformanceDetailPage';
import VideosPage from './VideosPage';
import VideoDetailPage from './VideoDetailPage';
import BgRemover from './BgRemover';

import LoginPage from './LoginPage';
import ProtectedLayout from '../components/layout/ProtectedLayout';
import { AuthProvider } from '../context/AuthContext';

export default function AppRoutes() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected Routes */}
          <Route element={<ProtectedLayout />}>
            <Route element={<Layout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/tools" element={<div>Tools Page</div>} />
              <Route path="/tools/bg-remover" element={<BgRemover />} />

              {/* PERFORMANCE ROUTES */}
              <Route path="/performances" element={<PerformancePage />} />
              <Route path="/performances/:id" element={<PerformanceDetailPage />} />

              {/* VIDEO ROUTES */}
              <Route path="/videos" element={<VideosPage />} />
              <Route path="/videos/:videoId" element={<VideoDetailPage />} />
            </Route>
          </Route>
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}
