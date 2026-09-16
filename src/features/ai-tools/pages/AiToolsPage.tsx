import { WandSparkles } from 'lucide-react';
import ReadmeGeneratorTool from '../components/ReadmeGeneratorTool';
import DatabaseGenWorkspace from '../components/DatabaseGenWorkspace';

export default function AiToolsPage() {
  return (
    <div className="mx-auto min-h-full max-w-7xl pb-16 text-[var(--text-primary)]">
      <header className="border-b border-white/[0.08] pb-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
          AI Tools
        </p>
        <div className="mt-3 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <h1 className="font-serif text-4xl font-medium tracking-tight text-white md:text-5xl">
              AI-powered workspaces for better output
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/45">
              Turn real project context into useful, evidence-based results with focused AI tools built into Yolnoma.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-white/35">
            <WandSparkles size={14} className="text-[var(--accent)]" />
            Context-aware AI tools
          </div>
        </div>
      </header>

      <main className="mt-8 min-w-0">
        <DatabaseGenWorkspace />
        <div className="mt-8">
        <ReadmeGeneratorTool />
        </div>
      </main>
    </div>
  );
}
