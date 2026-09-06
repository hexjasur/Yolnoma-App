import { Bot, FolderPlus, Sparkles, Wrench } from 'lucide-react';
import { X } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Button } from '@/shared/ui';

export default function AiAgentPage() {
  const closeAgentWindow = () => {
    void getCurrentWindow().close();
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-[var(--bg-base)] p-6 text-[var(--text-primary)]">
      <button
        type="button"
        onClick={closeAgentWindow}
        className="absolute right-5 top-5 inline-flex items-center gap-2 rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs font-semibold text-red-200 transition-colors hover:bg-red-400/20"
        title="Close Yolnoma Agent window"
      >
        <X size={15} /> Exit
      </button>
      <section className="w-full max-w-3xl rounded-3xl border border-white/[0.09] bg-[#111109] p-8 shadow-2xl md:p-12">
        <div className="mx-auto max-w-xl text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--accent-dim)] text-[var(--accent)]">
            <Bot size={30} />
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
            YOLNOMA AGENT
          </p>
          <h1 className="mt-2 font-serif text-4xl text-white">
            Your project-building agent
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-white/50">
            This workspace is ready for the upcoming agent. It will plan
            projects, create files, run builds, and help fix errors with your
            approval.
          </p>
          <div className="mt-8 grid gap-3 text-left sm:grid-cols-3">
            <Feature icon={<FolderPlus size={18} />} title="Create projects" />
            <Feature icon={<Wrench size={18} />} title="Edit with approval" />
            <Feature
              icon={<Sparkles size={18} />}
              title="Validate and improve"
            />
          </div>
          <Button className="mt-8 w-full justify-center" disabled>
            <Bot size={17} /> Agent workspace coming soon
          </Button>
        </div>
      </section>
    </main>
  );
}

function Feature({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
      <div className="mb-3 text-[var(--accent)]">{icon}</div>
      <p className="text-sm text-white/75">{title}</p>
    </div>
  );
}
