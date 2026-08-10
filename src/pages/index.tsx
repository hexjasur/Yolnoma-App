import { HashRouter, Routes, Route } from 'react-router-dom';

import Layout from '../components/layout/Layout';
import HomePage from '../pages/HomePage';
import PerformancePage from '../pages/PerformancePage';
import PerformanceDetailPage from './PerformanceDetailPage';
import VideosPage from './VideosPage';
import VideoDetailPage from './VideoDetailPage';
import BgRemover from './BgRemover';

export default function AppRoutes() {
  return (
    <HashRouter>
      <Routes>
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
      </Routes>
    </HashRouter>
  );
}
