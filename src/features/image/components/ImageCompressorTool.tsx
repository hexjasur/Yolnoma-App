import { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { CheckCircle, FileImage, FolderOpen, Loader2, Minimize2, Trash2, Upload } from 'lucide-react';
import { ToolCard, ToolTitle } from '@/features/developer-tools/components/ToolShell';
import { formatBytes } from '@/shared/lib/files';

type CompressionResult = { input_path: string; output_path: string; success: boolean; error?: string; file_size?: number };
type FileEntry = { path: string; name: string; size?: number; status: 'ready' | 'compressing' | 'done' | 'error'; result?: CompressionResult };

export default function ImageCompressorTool() {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [quality, setQuality] = useState(75);
  const [outputDir, setOutputDir] = useState('');
  const [busy, setBusy] = useState(false);

  const chooseFiles = async () => {
    const selected = await open({ multiple: true, filters: [{ name: 'Image Files', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'tiff'] }] });
    if (!selected) return;
    const paths = Array.isArray(selected) ? selected : [selected];
    const unique = paths.filter((path) => !files.some((file) => file.path.toLowerCase() === path.toLowerCase()));
    setFiles((current) => [...current, ...unique.map((path) => ({ path, name: path.split(/[\\/]/).pop() ?? path, status: 'ready' as const }))]);
  };

  const chooseOutput = async () => {
    const selected = await open({ directory: true, defaultPath: outputDir || undefined });
    if (typeof selected === 'string') setOutputDir(selected);
  };

  const compress = async () => {
    if (!files.length || busy) return;
    setBusy(true);
    setFiles((current) => current.map((file) => ({ ...file, status: 'compressing' })));
    try {
      const results = await invoke<CompressionResult[]>('convert_images_batch', { conversions: files.map((file) => ({ input_path: file.path, output_dir: outputDir || undefined, output_format: 'jpeg', quality, avoid_larger: true })) });
      setFiles((current) => current.map((file) => { const result = results.find((item) => item.input_path === file.path); return result ? { ...file, status: result.success ? 'done' : 'error', result } : file; }));
    } catch (error) {
      setFiles((current) => current.map((file) => ({ ...file, status: 'error', result: { input_path: file.path, output_path: '', success: false, error: String(error) } })));
    } finally { setBusy(false); }
  };

  return <ToolCard>
    <ToolTitle icon={Minimize2} text="Image Compressor" subtitle="Reduce image file sizes by converting images to quality-controlled JPEG locally." />
    <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_280px]">
      <div className="border border-dashed border-white/15 bg-black/10 p-5">
        <button type="button" onClick={() => void chooseFiles()} className="flex min-h-40 w-full flex-col items-center justify-center gap-3 text-center text-white/45 hover:text-white"><Upload size={28} className="text-[var(--accent)]" /><span className="text-sm font-semibold">Choose images</span><span className="text-xs">PNG, JPEG, WEBP, BMP, GIF, or TIFF</span></button>
        {!!files.length && <div className="mt-4 space-y-2 border-t border-white/[0.08] pt-4">{files.map((file) => <div key={file.path} className="flex items-center gap-3 border border-white/[0.07] px-3 py-2.5"><FileImage size={16} className="shrink-0 text-white/35" /><span className="min-w-0 flex-1 truncate text-xs text-white/70">{file.name}</span><span className="text-[10px] text-white/30">{file.result?.file_size ? formatBytes(file.result.file_size) : file.status}</span>{file.status === 'done' && <CheckCircle size={14} className="text-emerald-400" />}</div>)}</div>}
      </div>
      <aside className="border border-white/[0.08] bg-black/10 p-4"><label className="text-xs font-semibold uppercase tracking-wider text-white/40">JPEG quality <span className="text-[var(--accent)]">{quality}</span></label><input type="range" min="20" max="100" value={quality} onChange={(event) => setQuality(Number(event.target.value))} className="mt-4 w-full accent-[var(--accent)]" /><p className="mt-2 text-xs leading-5 text-white/35">Lower quality creates smaller files. Compressed copies use a timestamped filename and never overwrite originals.</p><button type="button" onClick={() => void chooseOutput()} className="mt-5 flex w-full items-center justify-center gap-2 border border-white/10 px-3 py-2 text-xs text-white/60 hover:border-[var(--accent-border)] hover:text-white"><FolderOpen size={14} /> {outputDir ? 'Change output folder' : 'Choose output folder'}</button><button type="button" disabled={!files.length || busy} onClick={() => void compress()} className="mt-3 flex w-full items-center justify-center gap-2 bg-[var(--accent)] px-3 py-2.5 text-xs font-semibold text-[#17130e] disabled:opacity-40">{busy ? <Loader2 size={14} className="animate-spin" /> : <Minimize2 size={14} />} Compress images</button><button type="button" disabled={!files.length || busy} onClick={() => setFiles([])} className="mt-3 flex w-full items-center justify-center gap-2 text-xs text-white/35 hover:text-red-300 disabled:opacity-30"><Trash2 size={13} /> Clear list</button></aside>
    </div>
  </ToolCard>;
}
