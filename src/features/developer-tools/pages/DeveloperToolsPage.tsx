import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Braces, Code2, Hash, Palette, QrCode, ShieldCheck } from 'lucide-react';
import ToolNavigation from '../components/ToolNavigation';
import JsonFormatterTool from '../components/JsonFormatterTool';
import JwtDecoderTool from '../components/JwtDecoderTool';
import UuidGeneratorTool from '../components/UuidGeneratorTool';
import MarkdownStudioTool from '../components/MarkdownStudioTool';
import ColorPickerTool from '../components/ColorPickerTool';
import QrGeneratorTool from '../components/QrGeneratorTool';

type Tab = 'json' | 'jwt' | 'uuid' | 'markdown' | 'color' | 'qr';
type TabDefinition = [Tab, string, LucideIcon];

const tabs: TabDefinition[] = [
  ['json', 'JSON Formatter', Braces],
  ['jwt', 'JWT Decoder', ShieldCheck],
  ['uuid', 'UUID Generator', Hash],
  ['markdown', 'Markdown Studio', Code2],
  ['color', 'Color Picker', Palette],
  ['qr', 'QR Generator', QrCode],
];

export default function DeveloperToolsPage() {
  const [tab, setTab] = useState<Tab>('json');

  return (
    <div className="mx-auto min-h-full max-w-7xl pb-16 text-[var(--text-primary)]">
      <header className="border-b border-white/[0.08] pb-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">Developer Tools</p>
        <div className="mt-3 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <h1 className="font-serif text-4xl font-medium tracking-tight text-white md:text-5xl">A sharper workspace for everyday code</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/45">Format data, inspect tokens, write Markdown, generate IDs, pick colors, and create QR codes without leaving Yolnoma.</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-white/35"><span className="h-2 w-2 bg-emerald-400" /> Local-first tools</div>
        </div>
      </header>

      <div className="mt-8">
        <ToolNavigation items={tabs} active={tab} onChange={setTab} />
        <main className="mt-8 min-w-0">
          {tab === 'json' && <JsonFormatterTool />}
          {tab === 'jwt' && <JwtDecoderTool />}
          {tab === 'uuid' && <UuidGeneratorTool />}
          {tab === 'markdown' && <MarkdownStudioTool />}
          {tab === 'color' && <ColorPickerTool />}
          {tab === 'qr' && <QrGeneratorTool />}
        </main>
      </div>
    </div>
  );
}
