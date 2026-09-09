import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Copy } from 'lucide-react';

export type ToolIcon = LucideIcon;

export function ToolCard({ children }: { children: ReactNode }) {
  return <section className="border border-white/[0.08] bg-[#111109] p-6 shadow-xl md:p-7">{children}</section>;
}

export function ToolTitle({ icon: Icon, text, subtitle }: { icon: ToolIcon; text: string; subtitle: string }) {
  return (
    <div className="border-b border-white/[0.08] pb-5">
      <div className="flex items-center gap-3">
        <Icon size={20} className="text-[var(--accent)]" />
        <h2 className="text-lg font-semibold text-white">{text}</h2>
      </div>
      <p className="mt-2 text-sm text-white/40">{subtitle}</p>
    </div>
  );
}

export function ToolOutput({ label, value, onCopy }: { label?: string; value: string; onCopy?: (value: string) => void }) {
  return (
    <div className="mt-5">
      <div className="mb-2 flex items-center justify-between">
        {label && <span className="text-xs font-semibold uppercase tracking-wider text-white/35">{label}</span>}
        {onCopy && <button type="button" onClick={() => void onCopy(value)} className="ml-auto inline-flex items-center gap-1.5 text-white/40 hover:text-white"><Copy size={14} /> Copy</button>}
      </div>
      <pre className="max-h-80 overflow-auto border border-white/[0.06] bg-black/20 p-4 text-xs leading-6 text-white/65">{value || 'No output'}</pre>
    </div>
  );
}
