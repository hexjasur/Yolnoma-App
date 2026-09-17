import type { LucideIcon } from 'lucide-react';
import { Code2, Minimize2, Palette, PanelRight, WandSparkles } from 'lucide-react';
import ToolNavigation from '@/features/developer-tools/components/ToolNavigation';
import { useHashTab } from '@/shared/hooks/useHashTab';
import MinifyTool from '../components/MinifyTool';
import GradientGeneratorTool from '../components/GradientGeneratorTool';
import ScrollbarGeneratorTool from '../components/ScrollbarGeneratorTool';
import ColorPickerTool from '../components/ColorPickerTool';

type Tab = 'minify' | 'gradient-generator' | 'scrollbar-generator' | 'color-picker';
type TabDefinition = [Tab, string, LucideIcon];
const tabs: TabDefinition[] = [
  ['minify', 'Minify', Minimize2],
  ['gradient-generator', 'Gradient CSS', WandSparkles],
  ['scrollbar-generator', 'Scrollbar CSS', PanelRight],
  ['color-picker', 'Color Picker', Palette],
];
export default function CssToolsPage() {
  const [tab, selectTab] = useHashTab(tabs.map(([id]) => id), 'minify', '#/tools/css-tools');
  return (
    <div className="mx-auto min-h-full max-w-7xl pb-16 text-[var(--text-primary)]">
      <header className="border-b border-white/[0.08] pb-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">CSS Tools</p>
        <div className="mt-3 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <h1 className="font-serif text-4xl font-medium tracking-tight text-white md:text-5xl">Shape the details of your interface</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/45">Generate polished CSS for gradients, scrollbars, and compact source code in one focused workspace.</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-white/35"><Code2 size={14} className="text-emerald-400" /> CSS-first tools</div>
        </div>
      </header>
      <div className="mt-8">
        <ToolNavigation items={tabs} active={tab} onChange={selectTab} />
        <main className="mt-8 min-w-0">
          {tab === 'minify' && <MinifyTool />}
          {tab === 'gradient-generator' && <GradientGeneratorTool />}
          {tab === 'scrollbar-generator' && <ScrollbarGeneratorTool />}
          {tab === 'color-picker' && <ColorPickerTool />}
        </main>
      </div>
    </div>
  );
}

export { tabs };
export type { Tab };
