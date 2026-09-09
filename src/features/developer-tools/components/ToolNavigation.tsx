import type { LucideIcon } from 'lucide-react';

type ToolNavigationItem<T extends string> = [T, string, LucideIcon];

export default function ToolNavigation<T extends string>({ items, active, onChange }: { items: ToolNavigationItem<T>[]; active: T; onChange: (id: T) => void }) {
  return (
    <aside className="border border-white/[0.08] bg-[#111109] p-2">
      <div className="px-4 pb-3 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/30">Workspace</div>
      <nav className="grid grid-cols-2 gap-1 md:grid-cols-3 lg:grid-cols-5">
        {items.map(([id, label, Icon]) => (
          <button key={id} type="button" onClick={() => onChange(id)} className={`flex min-w-0 items-center gap-3 border-l-2 px-4 py-3 text-left text-sm transition ${active === id ? 'border-[var(--accent)] bg-[var(--accent-glow)] text-white' : 'border-transparent text-white/50 hover:bg-white/[0.04] hover:text-white'}`}>
            <Icon size={17} className={active === id ? 'text-[var(--accent)]' : 'text-white/35'} />
            {label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
