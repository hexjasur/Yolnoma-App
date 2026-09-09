import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Code2, Minimize2, PanelRight, WandSparkles } from 'lucide-react';
import ToolNavigation from '@/features/developer-tools/components/ToolNavigation';
import MinifyTool from '../components/MinifyTool';
import GradientGeneratorTool from '../components/GradientGeneratorTool';
import ScrollbarGeneratorTool from '../components/ScrollbarGeneratorTool';

type Tab = 'minify' | 'gradient-generator' | 'scrollbar-generator';
type TabDefinition = [Tab, string, LucideIcon];
const tabs: TabDefinition[] = [
  ['minify', 'Minify', Minimize2],
  ['gradient-generator', 'Gradient CSS', WandSparkles],
  ['scrollbar-generator', 'Scrollbar CSS', PanelRight],
];
const tabIds = new Set<Tab>(tabs.map(([id]) => id));

function readTabFromUrl(): Tab {
  const query = window.location.hash.split('?')[1];
  const value = query ? new URLSearchParams(query).get('tab') : null;
  return value && tabIds.has(value as Tab) ? value as Tab : 'minify';
}

export default function CssToolsPage() {
  const [tab, setTab] = useState<Tab>(readTabFromUrl);
  useEffect(() => {
    const onHashChange = () => setTab(readTabFromUrl());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  const selectTab = (next: Tab) => {
    setTab(next);
    window.location.hash = `#/tools/css-tools?tab=${next}`;
  };
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
        </main>
      </div>
    </div>
  );
}

export { tabs };
export type { Tab };
