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
  Radar,
  Sparkles,
  Files,
  Wrench,
} from 'lucide-react';
import ViIcon from '@/assets/VI.svg';

export interface ToolDefinition {
  id: string;
  label: string;
  description: string;
  to: string;
  icon: LucideIcon | string;
}

export const TOOL_CATALOG: ToolDefinition[] = [
  { id: 'currency', label: 'Currency Converter', description: '160+ currencies & charts', to: '/tools/currency', icon: Coins },
  { id: 'bg-remover', label: 'Remove background', description: 'Through AI', to: '/tools/bg-remover', icon: Sparkles },
  { id: 'steam-idler', label: 'Steam / Idler', description: 'Automated idling', to: '/tools/steam/steam-idler', icon: Gamepad2 },
  { id: 'image-converter', label: 'Image Converter', description: 'Convert and optimize images', to: '/tools/image-converter', icon: ImageIcon },
  { id: 'video-downloader', label: 'YT Video Downloader', description: 'Download videos locally', to: '/tools/video-downloader', icon: Download },
  { id: 'port-scanner', label: 'Port Scanner', description: 'Inspect local network ports', to: '/tools/port-scanner', icon: Radar },
  { id: 'archive-explorer', label: 'Archive Explorer', description: 'Browse compressed files', to: '/tools/archive-explorer', icon: Archive },
  { id: 'ai-chat', label: 'AI Chat', description: 'Chat with OpenRouter models', to: '/tools/ai-chat', icon: Bot },
  { id: 'cleaner', label: 'Cleaner', description: 'Clean unwanted files', to: '/tools/cleaner', icon: BrushCleaning },
  { id: 'crosshair-overlay', label: 'Crosshair Overlay', description: 'Custom desktop crosshair', to: '/tools/crosshair-overlay', icon: Crosshair },
  { id: 'vi', label: 'VI COUNTDOWN', description: 'Countdown GTA VI', to: '/vi', icon: ViIcon },
  { id: 'steam-sam', label: 'Steam / SAM', description: 'Manage Steam achievements', to: '/tools/steam/sam', icon: Gamepad },
  { id: 'steam-review', label: 'Steam / Review', description: 'Review Steam games', to: '/tools/steam/review', icon: Gamepad2 },
  { id: 'file-intelligence', label: 'File Intelligence', description: 'Duplicates, largest & empty folders', to: '/tools/file-intelligence', icon: Files },
  { id: 'developer-tools', label: 'Developer Tools', description: 'JSON, JWT, Markdown & more', to: '/tools/developer-tools', icon: Wrench },
];
