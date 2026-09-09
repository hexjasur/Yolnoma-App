import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Binary, Braces, Code2, FileText, Globe2, Hash, LockKeyhole, QrCode, ShieldCheck, Terminal, Regex } from 'lucide-react';
import ToolNavigation from '../components/ToolNavigation';
import JsonFormatterTool from '../components/JsonFormatterTool';
import JwtDecoderTool from '../components/JwtDecoderTool';
import UuidGeneratorTool from '../components/UuidGeneratorTool';
import MarkdownStudioTool from '../components/MarkdownStudioTool';
import QrGeneratorTool from '../components/QrGeneratorTool';
import Base64Tool from '../components/Base64Tool';
import CurlConverterTool from '../components/CurlConverterTool';
import RegexVisualizerTool from '../components/RegexVisualizerTool';
import LoremIpsumTool from '../components/LoremIpsumTool';
import IpLookupTool from '../components/IpLookupTool';
import BcryptTool from '../components/BcryptTool';

type Tab = 'json-formatter' | 'jwt-decoder' | 'uuid-generator' | 'markdown-studio' | 'qr-generator' | 'base64' | 'curl-converter' | 'regex-visualizer' | 'lorem-ipsum' | 'ip-lookup' | 'bcrypt';
type TabDefinition = [Tab, string, LucideIcon];

const tabs: TabDefinition[] = [
  ['json-formatter', 'JSON Formatter', Braces],
  ['jwt-decoder', 'JWT Decoder', ShieldCheck],
  ['uuid-generator', 'UUID Generator', Hash],
  ['markdown-studio', 'Markdown Studio', Code2],
  ['base64', 'Base64 Encoder', Binary],
  ['qr-generator', 'QR Generator', QrCode],
  ['curl-converter', 'cURL → Code', Terminal],
  ['regex-visualizer', 'Regex Visualizer', Regex],
  ['lorem-ipsum', 'Lorem Ipsum', FileText],
  ['ip-lookup', 'IP Lookup', Globe2],
  ['bcrypt', 'Bcrypt Tool', LockKeyhole],
];

const tabIds = new Set<Tab>(tabs.map(([id]) => id));

function readTabFromUrl(): Tab {
  const hash = window.location.hash;
  const hashParts = hash.split('#');
  const nestedHash = hashParts[hashParts.length - 1];
  if (nestedHash && tabIds.has(nestedHash as Tab)) return nestedHash as Tab;
  const query = hash.split('?')[1];
  const value = query ? new URLSearchParams(query).get('tab') : null;
  return value && tabIds.has(value as Tab) ? value as Tab : 'json-formatter';
}

export default function DeveloperToolsPage() {
  const [tab, setTab] = useState<Tab>(readTabFromUrl);

  useEffect(() => {
    const onHashChange = () => setTab(readTabFromUrl());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const selectTab = (next: Tab) => {
    setTab(next);
    const routeHash = window.location.hash.split('?')[0].split('#')[0] || '#/tools/developer-tools';
    window.location.hash = `${routeHash}?tab=${next}`;
  };

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
        <ToolNavigation items={tabs} active={tab} onChange={selectTab} />
        <main className="mt-8 min-w-0">
          {tab === 'json-formatter' && <JsonFormatterTool />}
          {tab === 'jwt-decoder' && <JwtDecoderTool />}
          {tab === 'uuid-generator' && <UuidGeneratorTool />}
          {tab === 'markdown-studio' && <MarkdownStudioTool />}
          {tab === 'base64' && <Base64Tool />}
          {tab === 'qr-generator' && <QrGeneratorTool />}
          {tab === 'curl-converter' && <CurlConverterTool />}
          {tab === 'regex-visualizer' && <RegexVisualizerTool />}
          {tab === 'lorem-ipsum' && <LoremIpsumTool />}
          {tab === 'ip-lookup' && <IpLookupTool />}
          {tab === 'bcrypt' && <BcryptTool />}
        </main>
      </div>
    </div>
  );
}
