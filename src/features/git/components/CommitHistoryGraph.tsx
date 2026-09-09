import { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { CalendarDays, GitCommitHorizontal, GitMerge, Loader2, RefreshCw, UserRound } from 'lucide-react';
import { toast } from '@/shared/ui/Toast';
import { ToolCard, ToolTitle } from '@/features/developer-tools/components/ToolShell';

type GitCommit = { hash: string; short_hash: string; author: string; date: string; subject: string; parents: string[]; refs: string[] };
type GraphRow = { commit: GitCommit; lane: number; before: string[]; after: string[] };
const LANE_COLORS = ['#3B82F6', '#22D3EE', '#A78BFA', '#F472B6', '#34D399', '#FBBF24'];
const LANE_WIDTH = 16;
const MAX_VISUAL_LANES = 5;
const laneColor = (lane: number) => LANE_COLORS[lane % LANE_COLORS.length];
const visualLane = (lane: number) => Math.min(lane, MAX_VISUAL_LANES - 1);

function buildGraph(commits: GitCommit[]) {
  let lanes: string[] = [];
  let maxLane = 0;
  const rows: GraphRow[] = [];
  for (const commit of commits) {
    let lane = lanes.indexOf(commit.hash);
    if (lane < 0) { lane = lanes.length; lanes = [...lanes, commit.hash]; }
    const before = [...lanes];
    const parents = commit.parents.filter(Boolean);
    const remaining = lanes.filter((hash) => hash !== commit.hash && !parents.includes(hash));
    const after = [...remaining];
    after.splice(Math.min(lane, after.length), 0, ...parents);
    lanes = after;
    maxLane = Math.max(maxLane, lane, ...after.map((_, index) => index));
    rows.push({ commit, lane, before, after });
  }
  return { rows, maxLane };
}

function curve(from: number, to: number, color: string, dashed = false) {
  const x1 = visualLane(from) * LANE_WIDTH + 12;
  const x2 = visualLane(to) * LANE_WIDTH + 12;
  const bend = x1 === x2 ? '' : ` C ${x1} 24, ${x2} 34, ${x2} 66`;
  return <path d={`M ${x1} 8 L ${x1} 20${bend || ` L ${x2} 66`}`} fill="none" stroke={color} strokeWidth={dashed ? 2 : 2.5} strokeLinecap="round" strokeDasharray={dashed ? '3 3' : undefined} opacity={dashed ? 0.55 : 0.95} />;
}

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
  const graph = useMemo(() => buildGraph(commits), [commits]);
  const graphWidth = MAX_VISUAL_LANES * LANE_WIDTH + 24;

  return <ToolCard>
    <ToolTitle icon={GitCommitHorizontal} text="Commit History Graph" subtitle="A GitLens-inspired colored graph of branch lanes, forks, merges, refs, authors, and commit history." />
    <div className="mt-6 flex flex-wrap items-center gap-3"><button type="button" onClick={() => void pickFolder()} className="inline-flex items-center gap-2 border border-[var(--accent)] bg-[var(--accent-glow)] px-4 py-2.5 text-sm font-semibold text-[var(--accent)] hover:bg-[var(--accent-dim)]">Select Git folder</button>{folderPath && <button type="button" onClick={() => void loadHistory()} className="inline-flex items-center gap-2 border border-white/10 px-4 py-2.5 text-sm text-white/60 hover:text-white"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh history</button>}</div>
    {folderPath && <p className="mt-4 truncate border border-white/[0.08] bg-black/20 px-4 py-3 font-mono text-xs text-white/55" title={folderPath}>{folderPath}</p>}
    {loading && <div className="mt-8 flex items-center gap-2 text-sm text-white/45"><Loader2 size={16} className="animate-spin" /> Building colored branch graph...</div>}
    {error && <div className="mt-6 border border-red-400/20 bg-red-400/[0.06] p-4 text-sm text-red-200">{error}</div>}
    {!loading && !error && !folderPath && <div className="mt-8 border border-dashed border-white/10 p-12 text-center text-sm text-white/40">Select a Git repository to see its colored commit graph.</div>}
    {!loading && graph.rows.length > 0 && <div className="mt-8 overflow-x-hidden overflow-y-auto border border-white/[0.08] bg-[#11101b] p-3"><div>{graph.rows.map((row) => <div key={row.commit.hash} className="group grid grid-cols-[auto_minmax(0,1fr)] gap-2" style={{ minHeight: 68 }}><div className="relative shrink-0" style={{ width: graphWidth }}><svg className="absolute inset-0 h-full overflow-visible" width={graphWidth} viewBox={`0 0 ${graphWidth} 68`} aria-hidden="true">{row.before.map((hash, beforeLane) => { const afterLane = row.after.indexOf(hash); return afterLane >= 0 && hash !== row.commit.hash ? curve(beforeLane, afterLane, laneColor(beforeLane), beforeLane !== afterLane) : null; })}{row.commit.parents.map((parent, parentIndex) => { const targetLane = row.after.indexOf(parent); return targetLane >= 0 ? curve(row.lane, targetLane, laneColor(parentIndex === 0 ? row.lane : row.lane + parentIndex), parentIndex > 0) : null; })}<circle cx={visualLane(row.lane) * LANE_WIDTH + 12} cy="8" r={row.commit.parents.length > 1 ? 5 : 4} fill={laneColor(row.lane === 0 ? 0 : row.lane)} stroke="#11101b" strokeWidth="2.5" /></svg></div><div className="min-w-0 border-b border-white/[0.06] pb-3 pt-0.5 group-last:border-0"><div className="flex flex-wrap items-center gap-2">{row.commit.parents.length > 1 ? <GitMerge size={13} className="text-amber-300" /> : <GitCommitHorizontal size={13} style={{ color: laneColor(row.lane === 0 ? 0 : row.lane) }} />}<code className="text-xs" style={{ color: laneColor(row.lane === 0 ? 0 : row.lane) }}>{row.commit.short_hash}</code>{row.commit.refs.map((ref) => <span key={ref} className="border px-2 py-0.5 text-[10px]" style={{ color: laneColor(row.lane), borderColor: `${laneColor(row.lane)}55`, backgroundColor: `${laneColor(row.lane)}18` }}>{ref}</span>)}{row.commit.parents.length > 1 && <span className="text-[10px] uppercase tracking-wider text-amber-200/70">merge · {row.commit.parents.length} parents</span>}</div><p className="mt-1 text-sm font-medium text-white/85">{row.commit.subject}</p><div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-white/35"><span className="inline-flex items-center gap-1"><UserRound size={12} /> {row.commit.author}</span><span className="inline-flex items-center gap-1"><CalendarDays size={12} /> {row.commit.date}</span><span className="font-mono">{row.commit.hash.slice(0, 12)}</span></div></div></div>)}</div></div>}
    {!loading && folderPath && !error && !graph.rows.length && <div className="mt-8 border border-dashed border-white/10 p-10 text-center text-sm text-white/40">No commits found in this repository.</div>}
  </ToolCard>;
}
