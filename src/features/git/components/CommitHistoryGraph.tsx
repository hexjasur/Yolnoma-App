import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { CalendarDays, GitCommitHorizontal, GitMerge, Loader2, RefreshCw, UserRound } from 'lucide-react';
import { toast } from '@/shared/ui/Toast';
import { ToolCard, ToolTitle } from '@/features/developer-tools/components/ToolShell';

type GitCommit = { hash: string; short_hash: string; author: string; date: string; subject: string; parents: string[]; refs: string[] };

export default function CommitHistoryGraph({ folderPath, onFolderChange }: { folderPath: string; onFolderChange: (path: string) => void }) {
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadHistory = async (path = folderPath) => {
    if (!path) return;
    setLoading(true); setError('');
    try { setCommits(await invoke<GitCommit[]>('get_git_history', { rootPath: path, limit: 100 })); }
    catch (value) { setCommits([]); setError(value instanceof Error ? value.message : String(value)); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (folderPath) void loadHistory(); }, [folderPath]);
  const pickFolder = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (!selected || typeof selected !== 'string') return;
    onFolderChange(selected); await loadHistory(selected); toast.success('Git history loaded');
  };

  return <ToolCard>
    <ToolTitle icon={GitCommitHorizontal} text="Commit History Graph" subtitle="Explore branches, merges, authors, and the latest commit timeline for the selected repository." />
    <div className="mt-6 flex flex-wrap items-center gap-3"><button type="button" onClick={() => void pickFolder()} className="inline-flex items-center gap-2 border border-[var(--accent)] bg-[var(--accent-glow)] px-4 py-2.5 text-sm font-semibold text-[var(--accent)] hover:bg-[var(--accent-dim)]">Select Git folder</button>{folderPath && <button type="button" onClick={() => void loadHistory()} className="inline-flex items-center gap-2 border border-white/10 px-4 py-2.5 text-sm text-white/60 hover:text-white"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh history</button>}</div>
    {folderPath && <p className="mt-4 truncate border border-white/[0.08] bg-black/20 px-4 py-3 font-mono text-xs text-white/55" title={folderPath}>{folderPath}</p>}
    {loading && <div className="mt-8 flex items-center gap-2 text-sm text-white/45"><Loader2 size={16} className="animate-spin" /> Building commit graph...</div>}
    {error && <div className="mt-6 border border-red-400/20 bg-red-400/[0.06] p-4 text-sm text-red-200">{error}</div>}
    {!loading && !error && !folderPath && <div className="mt-8 border border-dashed border-white/10 p-12 text-center text-sm text-white/40">Select a Git repository to see its commit history graph.</div>}
    {!loading && commits.length > 0 && <div className="mt-8 overflow-auto border border-white/[0.08] bg-[#0d0d0a] p-5"><div className="min-w-[680px]">{commits.map((commit, index) => <div key={commit.hash} className="group relative grid grid-cols-[56px_minmax(0,1fr)] gap-4 pb-7 last:pb-0"><div className="relative flex justify-center"><div className="absolute bottom-0 top-0 w-px bg-[var(--accent)]/25 group-last:hidden" /><div className={`relative z-10 mt-2 flex h-4 w-4 items-center justify-center rounded-full border ${commit.parents.length > 1 ? 'border-amber-300 bg-amber-300/20' : 'border-[var(--accent)] bg-[var(--accent-glow)]'}`}>{commit.parents.length > 1 && <GitMerge size={10} className="text-amber-200" />}</div>{index > 0 && commit.parents.length > 1 && <div className="absolute left-1/2 top-2 h-5 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-t border-amber-300/50" />}</div><div className="rounded border border-transparent px-4 py-2 transition group-hover:border-white/[0.08] group-hover:bg-white/[0.03]"><div className="flex flex-wrap items-center gap-2"><code className="text-xs text-[var(--accent)]">{commit.short_hash}</code>{commit.refs.map((ref) => <span key={ref} className="border border-emerald-300/25 bg-emerald-300/[0.08] px-2 py-0.5 text-[10px] text-emerald-200">{ref}</span>)}{commit.parents.length > 1 && <span className="text-[10px] uppercase tracking-wider text-amber-200/70">merge</span>}</div><p className="mt-2 text-sm font-medium text-white/85">{commit.subject}</p><div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] text-white/35"><span className="inline-flex items-center gap-1"><UserRound size={12} /> {commit.author}</span><span className="inline-flex items-center gap-1"><CalendarDays size={12} /> {commit.date}</span><span>{commit.parents.length || 0} parent{commit.parents.length === 1 ? '' : 's'}</span></div></div></div>)}</div></div>}
    {!loading && folderPath && !error && !commits.length && <div className="mt-8 border border-dashed border-white/10 p-10 text-center text-sm text-white/40">No commits found in this repository.</div>}
  </ToolCard>;
}
