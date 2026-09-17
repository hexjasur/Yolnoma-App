import { Database, FileText, WandSparkles, type LucideIcon } from 'lucide-react';
import ToolNavigation from '@/features/developer-tools/components/ToolNavigation';
import { useHashTab } from '@/shared/hooks/useHashTab';
import ReadmeGeneratorTool from '../components/ReadmeGeneratorTool';
import DatabaseGenWorkspace from '../components/DatabaseGenWorkspace';

type Tab = 'database-gen' | 'readme-generator';
type TabDefinition = [Tab, string, LucideIcon];

const tabs: TabDefinition[] = [
  ['database-gen', 'Database Generator', Database],
  ['readme-generator', 'README Generator', FileText],
];
export default function AiToolsPage() {
  const [tab, selectTab] = useHashTab(tabs.map(([id]) => id), 'database-gen', '#/tools/ai-tools');

  return (
    <div className="mx-auto min-h-full max-w-7xl pb-16 text-[var(--text-primary)]">
      <header className="border-b border-white/[0.08] pb-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">AI Tools</p>
        <div className="mt-3 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <h1 className="font-serif text-4xl font-medium tracking-tight text-white md:text-5xl">AI-powered workspaces for better output</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/45">Generate database architecture and project documentation with focused, context-aware AI workspaces.</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-white/35"><WandSparkles size={14} className="text-[var(--accent)]" /> Context-aware AI tools</div>
        </div>
      </header>
      <div className="mt-8">
        <ToolNavigation items={tabs} active={tab} onChange={selectTab} />
        <main className="mt-8 min-w-0">
          {tab === 'database-gen' && <DatabaseGenWorkspace />}
          {tab === 'readme-generator' && <ReadmeGeneratorTool />}
        </main>
      </div>
    </div>
  );
}
