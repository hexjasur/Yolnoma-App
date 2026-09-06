import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import {
  Download,
  CheckCircle2,
  XCircle,
  Video,
  ChevronDown,
  X,
  FolderOpen,
} from 'lucide-react';

interface VideoPreview {
  title: string;
  uploader: string;
  duration: number | null;
  thumbnail: string | null;
  webpage_url: string | null;
  view_count: number | null;
}

interface DownloadProgress {
  task_id: number;
  percent: number;
  speed: string;
  eta: string;
  filename: string;
  downloaded_bytes: number;
  total_bytes: number;
}

interface DownloadJob {
  taskId: number;
  url: string;
  progress: DownloadProgress | null;
  status: { kind: 'success' | 'error'; text: string } | null;
  active: boolean;
}

const QUALITIES = [
  { value: 'best', label: 'Best' },
  { value: '2160p', label: '4K (2160p)' },
  { value: '1080p', label: 'Full HD (1080p)' },
  { value: '720p', label: 'HD (720p)' },
  { value: '480p', label: 'SD (480p)' },
];

export function VideoDownloader() {
  const [url, setUrl] = useState('');
  const [quality, setQuality] = useState('best');
  const [qualityOpen, setQualityOpen] = useState(false);
  const [jobs, setJobs] = useState<DownloadJob[]>([]);
  const [preview, setPreview] = useState<VideoPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const nextTaskId = useRef(1);

  const qualityRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unlisten = listen('video-download-progress', (event) => {
      const progress = event.payload as DownloadProgress;
      setJobs((current) =>
        current.map((job) =>
          job.taskId === progress.task_id ? { ...job, progress } : job,
        ),
      );
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (
        qualityRef.current &&
        !qualityRef.current.contains(e.target as Node)
      ) {
        setQualityOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const download = async () => {
    if (!url.trim() || !preview) {
      return;
    }

    const activeCount = jobs.filter((job) => job.active).length;
    if (activeCount >= 3) return;

    const taskId = nextTaskId.current++;
    const taskUrl = url.trim();
    setJobs((current) => [
      ...current,
      {
        taskId,
        url: taskUrl,
        progress: null,
        status: null,
        active: true,
      },
    ]);

    try {
      const result = await invoke<string>('download_youtube_video', {
        payload: { url: taskUrl, quality, task_id: taskId },
      });
      setJobs((current) =>
        current.map((job) =>
          job.taskId === taskId
            ? {
                ...job,
                active: false,
                progress: null,
                status: { kind: 'success', text: result },
              }
            : job,
        ),
      );
    } catch (e) {
      setJobs((current) =>
        current.map((job) =>
          job.taskId === taskId
            ? {
                ...job,
                active: false,
                status: { kind: 'error', text: String(e) },
              }
            : job,
        ),
      );
    }
  };

  const loadPreview = async () => {
    const targetUrl = url.trim();
    if (!targetUrl) return;

    setPreviewLoading(true);
    setPreviewError('');
    setPreview(null);
    try {
      const result = await invoke<VideoPreview>('preview_youtube_video', {
        url: targetUrl,
      });
      setPreview(result);
    } catch (error) {
      setPreviewError(String(error));
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    const targetUrl = url.trim();
    if (!/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(targetUrl)) {
      return;
    }

    const timer = window.setTimeout(() => {
      void loadPreview();
    }, 500);

    return () => window.clearTimeout(timer);
  }, [url]);

  const cancelDownload = async (taskId: number) => {
    try {
      await invoke('cancel_youtube_download', { taskId });
    } catch (e) {
      setJobs((current) =>
        current.map((job) =>
          job.taskId === taskId
            ? { ...job, status: { kind: 'error', text: String(e) } }
            : job,
        ),
      );
    }
  };

  const openDownloadFolder = async () => {
    try {
      await invoke('open_youtube_download_folder');
    } catch (error) {
      setJobs((current) => [
        ...current,
        {
          taskId: nextTaskId.current++,
          url: '',
          progress: null,
          active: false,
          status: { kind: 'error', text: String(error) },
        },
      ]);
    }
  };

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  };

  const currentQuality = QUALITIES.find((q) => q.value === quality)!;
  const activeCount = jobs.filter((job) => job.active).length;
  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'Unknown duration';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60)
      .toString()
      .padStart(2, '0');
    return `${minutes}:${remainingSeconds}`;
  };

  return (
    <div className="min-h-[75vh] flex items-start justify-center pt-16 px-6">
      <div className="w-full max-w-3xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center justify-center gap-2 text-[#D97757] font-semibold text-xs uppercase tracking-[0.2em]">
            <Video size={16} strokeWidth={2} />
            <span>Media Utility</span>
          </div>
          <h1 className="font-serif text-3xl font-medium tracking-tight text-[#F2EDE6]">
            YouTube Video Downloader
          </h1>
          <p className="text-xs text-white/45 max-w-md mx-auto">
            Paste any YouTube link to fetch metadata and download in up to 4K quality with full audio.
          </p>
        </div>

        {/* URL input bar */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setPreview(null);
                setPreviewError('');
              }}
              placeholder="Paste YouTube URL: https://youtube.com/watch?v=... or https://youtu.be/..."
              disabled={activeCount >= 3}
              className="w-full rounded-2xl bg-white/[0.04] border border-white/10 px-5 py-3.5 text-sm text-[#F2EDE6]
                         placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-[#D97757]/40
                         focus:border-[#D97757]/50 transition-all disabled:opacity-50"
            />
            {previewLoading && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 text-xs text-[#D97757]">
                <div className="w-4 h-4 border-2 border-[#D97757]/30 border-t-[#D97757] rounded-full animate-spin" />
                <span className="hidden sm:inline">Fetching…</span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={openDownloadFolder}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5 text-sm text-white/70 hover:bg-white/[0.08] hover:text-white transition-all shadow-md shrink-0"
            title="Open download folder"
            aria-label="Open download folder"
          >
            <FolderOpen size={18} />
            <span className="hidden sm:inline text-xs font-medium">Downloads</span>
          </button>
        </div>

        {previewError && (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-xs text-red-200/90 flex items-start gap-2.5">
            <XCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
            <span>{previewError}</span>
          </div>
        )}

        {/* Large Enhanced Metadata Preview Card */}
        {preview && (
          <div className="bg-[#181410] border border-white/10 rounded-3xl p-5 shadow-2xl space-y-4 animate-in fade-in duration-300">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
              {/* Left: Large 16:9 Thumbnail */}
              <div className="md:col-span-5 relative rounded-2xl overflow-hidden bg-black/40 border border-white/10 group aspect-video">
                {preview.thumbnail ? (
                  <img
                    src={preview.thumbnail}
                    alt={preview.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/20">
                    <Video size={36} />
                  </div>
                )}
                {preview.duration !== null && (
                  <div className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-md text-[11px] font-mono font-medium text-white/90 border border-white/10">
                    {formatDuration(preview.duration)}
                  </div>
                )}
              </div>

              {/* Right: Metadata & Actions */}
              <div className="md:col-span-7 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <h3 className="text-base sm:text-lg font-medium text-[#F2EDE6] line-clamp-2 leading-snug">
                    {preview.title}
                  </h3>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-white/50">
                    <span className="font-medium text-white/70">{preview.uploader}</span>
                    {preview.view_count !== null && (
                      <>
                        <span>•</span>
                        <span>{preview.view_count.toLocaleString()} views</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Quality selection & Download Action */}
                <div className="pt-2 border-t border-white/[0.06] flex flex-wrap items-center gap-3">
                  <div ref={qualityRef} className="relative flex-1 min-w-[140px]">
                    <button
                      type="button"
                      onClick={() => setQualityOpen((v) => !v)}
                      disabled={activeCount >= 3}
                      className="w-full inline-flex items-center justify-between gap-2 rounded-xl bg-white/[0.04] border border-white/10
                                 px-3.5 py-2.5 text-xs text-[#F2EDE6] hover:bg-white/[0.08] transition-colors
                                 disabled:opacity-50"
                    >
                      <span className="truncate">{currentQuality.label}</span>
                      <ChevronDown
                        size={14}
                        className={`text-white/40 transition-transform ${qualityOpen ? 'rotate-180' : ''}`}
                      />
                    </button>

                    {qualityOpen && (
                      <div
                        className="absolute bottom-full mb-1.5 left-0 right-0 rounded-xl border border-white/10
                                   bg-[#1F1A15] shadow-2xl overflow-hidden z-30"
                      >
                        {QUALITIES.map((q) => (
                          <button
                            key={q.value}
                            type="button"
                            onClick={() => {
                              setQuality(q.value);
                              setQualityOpen(false);
                            }}
                            className={`block w-full text-left px-3.5 py-2 text-xs transition-colors ${
                              q.value === quality
                                ? 'bg-[#D97757]/20 text-[#D97757] font-semibold'
                                : 'text-white/60 hover:bg-white/[0.05] hover:text-white'
                            }`}
                          >
                            {q.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={download}
                    disabled={activeCount >= 3}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#D97757] px-6 py-2.5 text-xs
                               font-semibold text-white hover:bg-[#D97757]/90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed
                               transition-all shadow-lg shadow-[#D97757]/20 shrink-0"
                  >
                    <Download size={15} strokeWidth={2} />
                    <span>{activeCount >= 3 ? 'Queue full' : 'Download Video'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Active & Completed Downloads Progress Area */}
        {jobs.length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-white/40">
              Downloads ({jobs.length})
            </div>
            {jobs.map((job) => (
              <div
                key={job.taskId}
                className="rounded-2xl border border-white/10 bg-[#181410] p-4 space-y-2.5 shadow-lg"
              >
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="truncate text-white/80 font-medium">{job.url}</span>
                  {job.active && (
                    <button
                      type="button"
                      onClick={() => cancelDownload(job.taskId)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-red-400/20 bg-red-500/10 px-2.5 py-1 text-xs text-red-300 hover:bg-red-500/20 transition-all"
                    >
                      <X size={12} /> Cancel
                    </button>
                  )}
                </div>

                {job.progress && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-white/50 font-mono">
                      <span className="text-[#D97757] font-bold">{job.progress.percent.toFixed(1)}%</span>
                      <span>{job.progress.speed}</span>
                      <span>ETA: {job.progress.eta}</span>
                      {job.progress.total_bytes > 0 && (
                        <span>
                          {formatSize(job.progress.downloaded_bytes)} / {formatSize(job.progress.total_bytes)}
                        </span>
                      )}
                    </div>
                    <div className="w-full h-2 rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#D97757] to-[#E59880] transition-all duration-300"
                        style={{
                          width: `${Math.min(job.progress.percent, 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {job.status && (
                  <div
                    className={`flex items-start gap-2 text-xs font-medium ${
                      job.status.kind === 'success' ? 'text-emerald-300' : 'text-red-300'
                    }`}
                  >
                    {job.status.kind === 'success' ? (
                      <CheckCircle2 size={15} className="text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle size={15} className="text-red-400 shrink-0 mt-0.5" />
                    )}
                    <span>{job.status.text}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
