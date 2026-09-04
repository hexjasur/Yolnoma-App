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
  const [ytDlpInstalled, setYtDlpInstalled] = useState<boolean | null>(null);
  const [ffmpegInstalled, setFfmpegInstalled] = useState<boolean | null>(null);
  const [preview, setPreview] = useState<VideoPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const nextTaskId = useRef(1);

  const qualityRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkInstall();
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

  const checkInstall = async () => {
    const [ytDlp, ffmpeg] = await Promise.all([
      invoke<boolean>('check_yt_dlp_installed'),
      invoke<boolean>('check_ffmpeg_installed'),
    ]);
    setYtDlpInstalled(ytDlp);
    setFfmpegInstalled(ffmpeg);
  };

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
    <div className="min-h-[70vh] flex items-start justify-center pt-24 px-6">
      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="flex items-center justify-center gap-2 mb-8 text-center">
          <Video size={18} strokeWidth={1.75} className="text-[#D97757]" />
          <h2 className="text-base font-semibold text-[#F2EDE6]">
            YouTube Downloader
          </h2>
          {ytDlpInstalled === true && (
            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-300/80 ml-1">
              <CheckCircle2 size={12} /> ready
            </span>
          )}
          {ytDlpInstalled === false && (
            <span className="inline-flex items-center gap-1 text-[11px] text-red-300/80 ml-1">
              <XCircle size={12} /> not installed
            </span>
          )}
          {ffmpegInstalled === true && (
            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-300/80 ml-1">
              <CheckCircle2 size={12} /> merge ready
            </span>
          )}
        </div>

        {/* URL input — own centered row */}
        <div className="flex gap-2">
          <input
            type="text"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setPreview(null);
              setPreviewError('');
            }}
            onKeyDown={(e) => e.key === 'Enter' && loadPreview()}
            placeholder="https://youtube.com/watch?v=..."
            disabled={activeCount >= 3 || previewLoading}
            className="min-w-0 flex-1 rounded-xl bg-white/[0.04] border border-white/10 px-4 py-3.5 text-sm text-[#F2EDE6]
                       placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-[#D97757]/40
                       focus:border-[#D97757]/50 transition-all disabled:opacity-50"
          />
          <button
            type="button"
            onClick={loadPreview}
            disabled={!url.trim() || previewLoading || activeCount >= 3}
            className="shrink-0 rounded-lg border border-white/10 px-4 py-2.5 text-sm text-white/75 hover:bg-white/[0.06] disabled:opacity-40"
          >
            {previewLoading ? 'Loading...' : 'Preview'}
          </button>
          <button
            type="button"
            onClick={openDownloadFolder}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-2.5 text-sm text-white/70 hover:bg-white/[0.06]"
            title="Open download folder"
            aria-label="Open download folder"
          >
            <FolderOpen size={15} />
          </button>
        </div>

        {previewError && (
          <p className="mt-3 text-xs text-red-200/80">{previewError}</p>
        )}
        {preview && (
          <div className="mt-4 flex gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            {preview.thumbnail && (
              <img
                src={preview.thumbnail}
                alt=""
                className="h-20 w-32 shrink-0 rounded-lg object-cover"
              />
            )}
            <div className="min-w-0">
              <h3 className="line-clamp-2 text-sm font-medium text-[#F2EDE6]">
                {preview.title}
              </h3>
              <p className="mt-1 text-xs text-white/50">
                {preview.uploader} · {formatDuration(preview.duration)}
              </p>
              {preview.view_count !== null && (
                <p className="mt-1 text-xs text-white/35">
                  {preview.view_count.toLocaleString()} views
                </p>
              )}
            </div>
          </div>
        )}

        {/* Quality + download — centered together below */}
        <div className="mt-4 flex items-center justify-center gap-2.5">
          <div ref={qualityRef} className="relative">
            <button
              type="button"
              onClick={() => setQualityOpen((v) => !v)}
              disabled={activeCount >= 3}
              className="inline-flex items-center gap-2 rounded-lg bg-white/[0.04] border border-white/10
                         px-3.5 py-2.5 text-sm text-[#F2EDE6] hover:bg-white/[0.06] transition-colors
                         disabled:opacity-50 min-w-[150px] justify-between"
            >
              {currentQuality.label}
              <ChevronDown
                size={14}
                className={`text-white/40 transition-transform ${qualityOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {qualityOpen && (
              <div
                className="absolute z-20 mt-1.5 w-full min-w-[170px] rounded-lg border border-white/10
                           bg-[#1B1713] shadow-2xl overflow-hidden"
                style={{ boxShadow: '0 20px 40px -12px rgba(0,0,0,0.6)' }}
              >
                {QUALITIES.map((q) => (
                  <button
                    key={q.value}
                    type="button"
                    onClick={() => {
                      setQuality(q.value);
                      setQualityOpen(false);
                    }}
                    className={`block w-full text-left px-3.5 py-2.5 text-sm transition-colors ${
                      q.value === quality
                        ? 'bg-[#D97757]/15 text-[#F2EDE6]'
                        : 'text-white/60 hover:bg-white/[0.05] hover:text-[#F2EDE6]'
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
            disabled={activeCount >= 3 || !ytDlpInstalled || !preview}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#D97757] px-5 py-2.5 text-sm
                       font-medium text-white hover:bg-[#D97757]/90 disabled:opacity-40 disabled:cursor-not-allowed
                       transition-colors shrink-0"
          >
            <Download size={15} strokeWidth={1.75} />
            {activeCount >= 3 ? 'Limit reached' : 'Download'}
          </button>
        </div>

        {/* Progress */}
        {jobs.length > 0 && (
          <div className="mt-6 space-y-3">
            {jobs.map((job) => (
              <div
                key={job.taskId}
                className="rounded-lg border border-white/10 bg-white/[0.03] p-3"
              >
                <div className="flex items-center justify-between gap-3 text-xs text-white/60">
                  <span className="truncate">{job.url}</span>
                  {job.active && (
                    <button
                      type="button"
                      onClick={() => cancelDownload(job.taskId)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-red-400/20 px-2 py-1 text-red-300/80 hover:bg-red-400/10"
                    >
                      <X size={12} /> Cancel
                    </button>
                  )}
                </div>
                {job.progress && (
                  <div className="mt-2 space-y-1.5">
                    <div className="flex justify-between text-xs text-white/45">
                      <span>{job.progress.percent.toFixed(1)}%</span>
                      <span>
                        {job.progress.speed} · {job.progress.eta}
                      </span>
                      <span>
                        {formatSize(job.progress.downloaded_bytes)} /{' '}
                        {formatSize(job.progress.total_bytes)}
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#D97757] transition-all duration-300"
                        style={{
                          width: `${Math.min(job.progress.percent, 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
                {job.status && (
                  <div
                    className={`mt-2 flex items-start gap-2 text-xs ${job.status.kind === 'success' ? 'text-emerald-200/90' : 'text-red-200/90'}`}
                  >
                    {job.status.kind === 'success' ? (
                      <CheckCircle2 size={14} />
                    ) : (
                      <XCircle size={14} />
                    )}
                    <span>{job.status.text}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {ytDlpInstalled === false && (
          <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/[0.06] px-3.5 py-2.5 text-xs text-red-200/80">
            Bundled yt-dlp.exe was not found. Reinstall the application with its
            resources folder.
          </div>
        )}
        {ytDlpInstalled === true && ffmpegInstalled === false && (
          <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3.5 py-2.5 text-xs text-amber-200/80">
            FFmpeg is not installed. A combined audio/video format will be
            downloaded instead of separate streams.
          </div>
        )}
      </div>
    </div>
  );
}
