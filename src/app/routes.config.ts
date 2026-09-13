import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Archive,
  Bot,
  BrushCleaning,
  Coins,
  Crosshair,
  Download,
  Gamepad,
  Gamepad2,
  ImageIcon,
  GitBranch,
  Radar,
  Sparkles,
  Wrench,
  WandSparkles,
  Palette,
  Trees,
} from 'lucide-react';
import ViIcon from '@/assets/VI.svg';

export type RouteStatus = 'stable' | 'dev' | 'test';
export type RouteComponent = ComponentType;
export type LazyRouteComponent = LazyExoticComponent<RouteComponent>;
export type RouteIcon = LucideIcon | string;

export type ToolDefinition = {
  id: string;
  label: string;
  description: string;
  to: string;
  icon: RouteIcon;
};

export type RouteRoleGuard = {
  kind: 'role';
  page: string;
  message: string;
};

export type RouteDefinition = {
  id: string;
  path: string;
  component: RouteComponent | LazyRouteComponent;
  status?: RouteStatus;
  guard?: RouteRoleGuard;
  label?: string;
  description?: string;
  icon?: RouteIcon;
  navGroup?: 'home' | 'workspace' | 'tools';
  pinnable?: boolean;
};

const lazyPage = (load: () => Promise<{ default: RouteComponent }>): LazyRouteComponent =>
  lazy(load);

const DashboardPage = lazyPage(() => import('@/features/dashboard/pages/DashboardPage'));
const ProfilePage = lazyPage(() => import('@/features/account/pages/ProfilePage'));
const SettingsPage = lazyPage(() => import('@/features/account/pages/SettingsPage'));
const BackgroundRemoverPage = lazyPage(() => import('@/features/background-remover/pages/BackgroundRemoverPage'));
const MarketplacePage = lazyPage(() => import('@/features/marketplace/pages/MarketplacePage'));
const CurrencyConverterPage = lazyPage(() => import('@/features/currency/pages/CurrencyConverterPage'));
const PerformanceDetailPage = lazyPage(() => import('@/features/performance/pages/PerformanceDetailPage'));
const PerformancePage = lazyPage(() => import('@/features/performance/pages/PerformancePage'));
const SteamIdlerPage = lazyPage(() => import('@/features/steam-idler/pages/SteamIdlerPage'));
const SteamSamPage = lazyPage(() => import('@/features/steam-sam/pages/SteamSamPage'));
const UsersPage = lazyPage(() => import('@/features/users/pages/UsersPage'));
const VideoDetailPage = lazyPage(() => import('@/features/videos/pages/VideoDetailPage'));
const VideosPage = lazyPage(() => import('@/features/videos/pages/VideosPage'));
const CleanerPage = lazyPage(() => import('@/features/cleaner/pages/CleanerPage'));
const VideoDownloader = lazyPage(() =>
  import('@/features/yt-video-downloader/pages/YTVideoDownloader').then(({ VideoDownloader }) => ({
    default: VideoDownloader,
  })),
);
const SteamReviewPage = lazyPage(() => import('@/features/steam/review/SteamReviewPage'));
const CrosshairPage = lazyPage(() => import('@/features/crosshair/pages/CrosshairPage'));
const ImagePage = lazyPage(() => import('@/features/image/pages/ImagePage'));
const PortScannerPage = lazyPage(() => import('@/features/port-scanner/pages/PortScannerPage'));
const ArchiveExplorerPage = lazyPage(() => import('@/features/archive-explorer/pages/ArchiveExplorerPage'));
const AiChatPage = lazyPage(() => import('@/features/ai/pages/AiChatPage'));
const AiAgentPage = lazyPage(() => import('@/features/ai/pages/AiAgentPage'));
const CodebaseAgentPage = lazyPage(() => import('@/features/ai/pages/CodebaseAgentPage'));
const ViCountdown = lazyPage(() => import('@/features/vi/pages/ViCountdown'));
const World3DPage = lazyPage(() => import('@/features/world3d/pages/World3DPage'));
const DeveloperToolsPage = lazyPage(() => import('@/features/developer-tools/pages/DeveloperToolsPage'));
const AiToolsPage = lazyPage(() => import('@/features/ai-tools/pages/AiToolsPage'));
const CssToolsPage = lazyPage(() => import('@/features/css-tools/pages/CssToolsPage'));
const GitPage = lazyPage(() => import('@/features/git/pages/GitPage'));
const FeedbackPage = lazyPage(() => import('@/features/feedback/pages/FeedbackPage'));
const JsonViewerPage = lazyPage(() => import('@/features/json-viewer/pages/JsonViewerPage'));

const roleGuard = (page: string, message: string): RouteRoleGuard => ({ kind: 'role', page, message });

export const ROUTE_CONFIG: readonly RouteDefinition[] = [
  { id: 'dashboard', path: '/', component: DashboardPage, label: 'Dashboard', navGroup: 'home' },
  { id: 'agent', path: '/agent', component: AiAgentPage, status: 'dev', label: 'Yolnoma Agent', icon: Bot, navGroup: 'home' },
  { id: 'codebase-agent', path: '/codebase-agent', component: CodebaseAgentPage, status: 'stable', label: 'Codebase Agent', icon: Bot, navGroup: 'home' },
  { id: 'performances', path: '/performances', component: PerformancePage, guard: roleGuard('performances', 'Access restricted: Performances section is available to Owner only.'), label: 'Performance', icon: Gamepad, navGroup: 'workspace' },
  { id: 'performance-detail', path: '/performances/:id', component: PerformanceDetailPage, guard: roleGuard('performances', 'Access restricted: Performances section is available to Owner only.') },
  { id: 'videos', path: '/videos', component: VideosPage, guard: roleGuard('videos', 'Access restricted: Stream section is available to Owner only.'), label: 'Stream', icon: Download, navGroup: 'workspace' },
  { id: 'video-detail', path: '/videos/:videoId', component: VideoDetailPage, guard: roleGuard('videos', 'Access restricted: Stream section is available to Owner only.') },
  { id: 'users', path: '/users', component: UsersPage, guard: roleGuard('users', 'You do not have permission to access the Users management page.'), label: 'Users', icon: Bot, navGroup: 'workspace' },
  { id: 'profile', path: '/profile', component: ProfilePage, label: 'Profile', icon: Bot, navGroup: 'workspace' },
  { id: 'settings', path: '/settings', component: SettingsPage },
  { id: 'marketplace', path: '/marketplace', component: MarketplacePage, status: 'dev', label: 'Marketplace', icon: Coins, navGroup: 'workspace' },
  { id: 'feedback', path: '/feedback', component: FeedbackPage, label: 'Ideas & Bugs', icon: Bot, navGroup: 'workspace' },
  { id: 'currency', path: '/tools/currency', component: CurrencyConverterPage, label: 'Currency Converter', description: '160+ currencies & charts', icon: Coins, navGroup: 'tools', pinnable: true },
  { id: 'bg-remover', path: '/tools/bg-remover', component: BackgroundRemoverPage, label: 'Remove background', description: 'Through AI', icon: Sparkles, navGroup: 'tools', pinnable: true },
  { id: 'steam-idler', path: '/tools/steam/steam-idler', component: SteamIdlerPage, label: 'Steam / Idler', description: 'Automated idling', icon: Gamepad2, navGroup: 'tools', pinnable: true },
  { id: 'image', path: '/tools/image', component: ImagePage, label: 'Image', description: 'Convert, compress & optimize images', icon: ImageIcon, navGroup: 'tools', pinnable: true },
  { id: 'video-downloader', path: '/tools/video-downloader', component: VideoDownloader, label: 'YT Video Downloader', description: 'Download videos locally', icon: Download, navGroup: 'tools', pinnable: true },
  { id: 'port-scanner', path: '/tools/port-scanner', component: PortScannerPage, label: 'Port Scanner', description: 'Inspect local network ports', icon: Radar, navGroup: 'tools', pinnable: true },
  { id: 'archive-explorer', path: '/tools/archive-explorer', component: ArchiveExplorerPage, label: 'Archive Explorer', description: 'Browse compressed files', icon: Archive, navGroup: 'tools', pinnable: true },
  { id: 'ai-chat', path: '/tools/ai-chat', component: AiChatPage, label: 'AI Chat', description: 'Chat with OpenRouter models', icon: Bot, navGroup: 'tools', pinnable: true },
  { id: 'cleaner', path: '/tools/cleaner', component: CleanerPage, label: 'Cleaner', description: 'Clean unwanted files', icon: BrushCleaning, navGroup: 'tools', pinnable: true },
  { id: 'crosshair-overlay', path: '/tools/crosshair-overlay', component: CrosshairPage, label: 'Crosshair Overlay', description: 'Custom desktop crosshair', icon: Crosshair, navGroup: 'tools', pinnable: true },
  { id: 'vi', path: '/vi', component: ViCountdown, label: 'VI COUNTDOWN', description: 'Countdown GTA VI', icon: ViIcon, navGroup: 'tools', pinnable: true },
  { id: 'steam-sam', path: '/tools/steam/sam', component: SteamSamPage, label: 'Steam / SAM', description: 'Manage Steam achievements', icon: Gamepad, navGroup: 'tools', pinnable: true },
  { id: 'steam-review', path: '/tools/steam/review', component: SteamReviewPage, label: 'Steam / Review', description: 'Review Steam games', icon: Gamepad2, navGroup: 'tools', pinnable: true },
  { id: 'developer-tools', path: '/tools/developer-tools', component: DeveloperToolsPage, label: 'Developer Tools', description: 'JSON, JWT, Markdown & more', icon: Wrench, navGroup: 'workspace', pinnable: true },
  { id: 'ai-tools', path: '/tools/ai-tools', component: AiToolsPage, label: 'AI Tools', description: 'AI-powered project workspaces', icon: WandSparkles, navGroup: 'tools', pinnable: true },
  { id: 'json-viewer', path: '/tools/json', component: JsonViewerPage, label: 'JSON EDIT/VIEW', description: 'Edit JSON and transform it into cards', icon: Wrench, navGroup: 'tools', pinnable: true },
  { id: 'css-tools', path: '/tools/css-tools', component: CssToolsPage, label: 'CSS Tools', description: 'Gradients, scrollbars & minify', icon: Palette, navGroup: 'tools', pinnable: true },
  { id: 'git', path: '/tools/git', component: GitPage, label: 'Git', description: 'Generate best-practice commits', icon: GitBranch, navGroup: 'tools', pinnable: true },
  { id: 'world-3d', path: '/tools/world-3d', component: World3DPage, label: 'Yolnoma World', description: 'Explore the living 3D desktop', icon: Trees, navGroup: 'tools', pinnable: true },
];

export const getRouteById = (id: string) => ROUTE_CONFIG.find((route) => route.id === id);
export const getRouteStatus = (id: string): RouteStatus => getRouteById(id)?.status ?? 'stable';
export const getNavigationRoutes = () => ROUTE_CONFIG.filter((route) => route.label && route.navGroup);
export const getToolRoutes = () => ROUTE_CONFIG.filter((route) => route.navGroup === 'tools' && route.description);
