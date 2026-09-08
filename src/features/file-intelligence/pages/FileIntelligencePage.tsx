import { useMemo, useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { readDir, readFile, stat } from '@tauri-apps/plugin-fs';
import { Files, FolderOpen, HardDrive, Search, Trash2 } from 'lucide-react';

type Entry = { name: string; path: string; size: number; hash?: string };
type Folder = { name: string; path: string; fileCount: number };
type Tab = 'duplicates' | 'largest' | 'empty';

const IGNORE = new Set(['node_modules', '.git', 'target', 'dist', 'build']);
const formatBytes = (value: number) => {
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${(value / 1024 ** 3).toFixed(2)} GB`;
};

async function scanFolder(root: string) {
  const files: Entry[] = [];
  const emptyFolders: Folder[] = [];
  async function walk(current: string) {
    const entries = await readDir(current);
    const visible = entries.filter((entry) => !entry.name.startsWith('.') && !IGNORE.has(entry.name));
    if (visible.length === 0) {
      emptyFolders.push({ name: current.split(/[\\/]/).pop() || current, path: current, fileCount: 0 });
      return;
    }
    let fileCount = 0;
    for (const entry of visible) {
      const child = `${current}/${entry.name}`;
      if (entry.isDirectory) await walk(child);
      else {
        fileCount += 1;
        const metadata = await stat(child);
        const bytes = await readFile(child);
        const digest = await crypto.subtle.digest('SHA-256', bytes);
        const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
        files.push({ name: entry.name, path: child, size: metadata.size ?? 0, hash });
      }
    }
    if (fileCount === 0 && visible.length > 0) emptyFolders.push({ name: current.split(/[\\/]/).pop() || current, path: current, fileCount: 0 });
  }
  await walk(root);
  return { files, emptyFolders };
}

export default function FileIntelligencePage() {
  const [tab, setTab] = useState<Tab>('largest');
  const [root, setRoot] = useState('');
  const [files, setFiles] = useState<Entry[]>([]);
  const [emptyFolders, setEmptyFolders] = useState<Folder[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Papka tanlang — Yolnoma uning ichidagi fayllarni lokal tahlil qiladi.');

  const scan = async () => {
    const selected = await open({ directory: true, multiple: false, title: 'Scan qilinadigan papkani tanlang' });
    if (!selected || Array.isArray(selected)) return;
    setBusy(true);
    setRoot(selected);
    try {
      const result = await scanFolder(selected);
      setFiles(result.files);
      setEmptyFolders(result.emptyFolders);
      setMessage(`${result.files.length} ta fayl va ${result.emptyFolders.length} ta bo‘sh papka topildi.`);
    } catch {
      setMessage('Papka o‘qilmadi. Ruxsatni tekshirib, qayta urinib ko‘ring.');
    } finally {
      setBusy(false);
    }
  };

  const largest = useMemo(() => [...files].sort((a, b) => b.size - a.size).slice(0, 50), [files]);
  const duplicates = useMemo(() => {
    const byName = new Map<string, Entry[]>();
    files.forEach((file) => {
      const key = file.hash || `${file.name.toLowerCase()}::${file.size}`;
      byName.set(key, [...(byName.get(key) || []), file]);
    });
    return [...byName.values()].filter((group) => group.length > 1);
  }, [files]);
  const visible = tab === 'largest' ? largest : tab === 'duplicates' ? duplicates.flat() : emptyFolders;

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-16 text-[var(--text-primary)]">
      <header><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">File Intelligence</p><h1 className="mt-2 font-serif text-4xl font-medium text-white">Understand your storage</h1><p className="mt-2 max-w-2xl text-sm text-white/45">Duplicate fayllarni, eng katta fayllarni va bo‘sh papkalarni bitta lokal skanerda toping.</p></header>
      <section className="rounded-3xl border border-white/[0.08] bg-[#111109] p-6 shadow-2xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><div className="rounded-xl bg-[var(--accent-glow)] p-3 text-[var(--accent)]"><HardDrive size={20} /></div><div><p className="font-semibold text-white">{root ? root.split(/[\\/]/).pop() : 'Papka tanlanmagan'}</p><p className="text-xs text-white/40">{message}</p></div></div><button type="button" onClick={() => void scan()} disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[#17130e] transition hover:brightness-110 disabled:opacity-50"><FolderOpen size={16} />{busy ? 'Scanning…' : 'Scan folder'}</button></div>
      </section>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[230px_1fr]">
        <nav className="space-y-2 rounded-2xl border border-white/[0.08] bg-[#111109] p-3">{([['largest', 'Largest files', HardDrive], ['duplicates', 'Duplicates', Files], ['empty', 'Empty folders', Trash2]] as const).map(([id, label, Icon]) => <button key={id} type="button" onClick={() => setTab(id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${tab === id ? 'bg-[var(--accent-glow)] text-[var(--accent)]' : 'text-white/55 hover:bg-white/[0.04] hover:text-white'}`}><Icon size={17} /><span>{label}</span></button>)}</nav>
        <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111109]"><div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4"><div><h2 className="font-semibold text-white">{tab === 'largest' ? 'Eng katta fayllar' : tab === 'duplicates' ? 'Takroriy fayllar' : 'Bo‘sh papkalar'}</h2><p className="text-xs text-white/35">{visible.length} ta natija</p></div><Search size={17} className="text-white/30" /></div>{visible.length === 0 ? <div className="p-12 text-center text-sm text-white/35">Avval papka scan qiling yoki bu kategoriyada natija yo‘q.</div> : <div className="divide-y divide-white/[0.05]">{visible.map((item, index) => <div key={`${item.path}-${index}`} className="flex items-center justify-between gap-4 px-5 py-3 text-sm"><div className="flex min-w-0 items-center gap-3"><span className="text-xs text-white/25">{index + 1}</span><div className="min-w-0"><p className="truncate text-white/80">{item.name}</p><p className="truncate text-xs text-white/30">{item.path}</p></div></div>{'size' in item && <span className="shrink-0 font-mono text-xs text-[var(--accent)]">{formatBytes(item.size)}</span>}</div>)}</div>}</section>
      </div>
      <p className="text-xs text-white/30">Eslatma: directory picker fayl metadata’sini beradi; aniq fayl hajmi va hash’larini native scanner bosqichida kengaytirish mumkin.</p>
    </div>
  );
}
