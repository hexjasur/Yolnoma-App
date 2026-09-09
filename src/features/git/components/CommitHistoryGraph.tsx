import { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { GitCommitHorizontal, GitMerge, Loader2, RefreshCw } from 'lucide-react';
import { toast } from '@/shared/ui/Toast';
import { ToolCard, ToolTitle } from '@/features/developer-tools/components/ToolShell';

type GitCommit = { hash: string; short_hash: string; author: string; date: string; subject: string; parents: string[]; refs: string[] };
type GraphRow = { commit: GitCommit; lane: number; before: string[]; after: string[] };
const LANE_COLORS = ['#3B82F6', '#22D3EE', '#A78BFA', '#F472B6', '#34D399', '#FBBF24'];
const LANE_WIDTH = 14;
const MAX_VISUAL_LANES = 5;
const laneColor = (lane: number) => LANE_COLORS[lane % LANE_COLORS.length];
const visualLane = (lane: number) => Math.min(lane, MAX_VISUAL_LANES - 1);

function buildGraph(commits: GitCommit[]) {
  let lanes: string[] = [];
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
    rows.push({ commit, lane, before, after });
  }
  return rows;
}

function curve(from: number, to: number, color: string, dashed = false) {
  const x1 = visualLane(from) * LANE_WIDTH + 12;
  const x2 = visualLane(to) * LANE_WIDTH + 12;
  const bend = x1 === x2 ? '' : ` C ${x1} 20, ${x2} 27, ${x2} 50`;
  return <path d={`M ${x1} 7 L ${x1} 16${bend || ` L ${x2} 50`}`} fill="none" stroke={color} strokeWidth={dashed ? 2 : 2.5} strokeLinecap="round" strokeDasharray={dashed ? '3 3' : undefined} opacity={dashed ? 0.55 : 0.95} />;
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
  const rows = useMemo(() => buildGraph(commits), [commits]);
  const graphWidth = MAX_VISUAL_LANES * LANE_WIDTH + 20;

  return <ToolCard>
    <ToolTitle icon={GitCommitHorizontal} text="Commit History Graph" subtitle="A GitLens-inspired colored graph with aligned commit details and compact branch lanes." />
    <div className="mt-6 flex flex-wrap items-center gap-3"><button type="button" onClick={() => void pickFolder()} className="inline-flex items-center gap-2 border border-[var(--accent)] bg-[var(--accent-glow)] px-4 py-2.5 text-sm font-semibold text-[var(--accent)] hover:bg-[var(--accent-dim)]">Select Git folder</button>{folderPath && <button type="button" onClick={() => void loadHistory()} className="inline-flex items-center gap-2 border border-white/10 px-4 py-2.5 text-sm text-white/60 hover:text-white"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh history</button>}</div>
    {folderPath && <p className="mt-4 truncate border border-white/[0.08] bg-black/20 px-4 py-3 font-mono text-xs text-white/55" title={folderPath}>{folderPath}</p>}
    {loading && <div className="mt-8 flex items-center gap-2 text-sm text-white/45"><Loader2 size={16} className="animate-spin" /> Building colored branch graph...</div>}
    {error && <div className="mt-6 border border-red-400/20 bg-red-400/[0.06] p-4 text-sm text-red-200">{error}</div>}
    {!loading && !error && !folderPath && <div className="mt-8 border border-dashed border-white/10 p-12 text-center text-sm text-white/40">Select a Git repository to see its colored commit graph.</div>}
    {!loading && rows.length > 0 && <div className="mt-8 overflow-hidden border border-white/[0.08] bg-[#11101b]"><div>
      <div className="grid grid-cols-[96px_minmax(0,1fr)_100px_120px_78px] items-center border-b border-white/[0.10] bg-white/[0.035] px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35"><span>Graph</span><span>Description</span><span>Date</span><span>Author</span><span>Commit</span></div>
      <div className="px-4 py-1">{rows.map((row) => <div key={row.commit.hash} className="group grid min-h-[52px] grid-cols-[96px_minmax(0,1fr)_100px_120px_78px] items-start border-b border-white/[0.06] py-1 last:border-0"><div className="relative h-[46px] shrink-0" style={{ width: graphWidth }}><svg className="absolute inset-0 h-full overflow-visible" width={graphWidth} viewBox={`0 0 ${graphWidth} 52`} aria-hidden="true">{row.before.map((hash, beforeLane) => { const afterLane = row.after.indexOf(hash); return afterLane >= 0 && hash !== row.commit.hash ? curve(beforeLane, afterLane, laneColor(beforeLane), beforeLane !== afterLane) : null; })}{row.commit.parents.map((parent, parentIndex) => { const targetLane = row.after.indexOf(parent); return targetLane >= 0 ? curve(row.lane, targetLane, laneColor(parentIndex === 0 ? row.lane : row.lane + parentIndex), parentIndex > 0) : null; })}<circle cx={visualLane(row.lane) * LANE_WIDTH + 12} cy="7" r={row.commit.parents.length > 1 ? 5 : 4} fill={laneColor(row.lane === 0 ? 0 : row.lane)} stroke="#11101b" strokeWidth="2.5" /></svg></div><div className="min-w-0 pr-5"><div className="flex flex-wrap items-center gap-2">{row.commit.parents.length > 1 && <GitMerge size={13} className="text-amber-300" />}{row.commit.refs.map((ref) => <span key={ref} className="border px-2 py-0.5 text-[10px]" style={{ color: laneColor(row.lane), borderColor: `${laneColor(row.lane)}55`, backgroundColor: `${laneColor(row.lane)}18` }}>{ref}</span>)}{row.commit.parents.length > 1 && <span className="text-[10px] uppercase tracking-wider text-amber-200/70">merge · {row.commit.parents.length} parents</span>}</div><p className="mt-0.5 truncate text-sm font-medium text-white/85" title={row.commit.subject}>{row.commit.subject}</p></div><span className="truncate pt-0.5 text-xs text-white/45">{row.commit.date}</span><span className="truncate pt-0.5 text-xs text-white/55" title={row.commit.author}>{row.commit.author}</span><code className="pt-0.5 text-xs" style={{ color: laneColor(row.lane === 0 ? 0 : row.lane) }}>{row.commit.short_hash}</code></div>)}</div>
    </div></div>}
    {!loading && folderPath && !error && !rows.length && <div className="mt-8 border border-dashed border-white/10 p-10 text-center text-sm text-white/40">No commits found in this repository.</div>}
  </ToolCard>;
}
