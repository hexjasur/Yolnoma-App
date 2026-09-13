import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import {
  ImageIcon,
  Upload,
  Trash2,
  FolderOpen,
  Play,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  Search,
  ArrowRight,
  FileImage,
  ChevronDown,
  Sparkles,
  ExternalLink,
  Eye,
  Sliders,
  X,
  Plus,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SupportedFormat =
  | 'png'
  | 'jpeg'
  | 'jpg'
  | 'bmp'
  | 'webp'
  | 'gif'
  | 'ico'
  | 'tiff';

interface FormatMeta {
  id: SupportedFormat;
  label: string;
  category: 'Raster' | 'Web' | 'Icon / Special';
  desc: string;
}

interface ImageInfo {
  width: number;
  height: number;
  format: string;
  file_size: number;
  file_name: string;
  thumbnail?: string;
}

interface ConvertResult {
  input_path: string;
  output_path: string;
  success: boolean;
  error?: string;
  file_size?: number;
  thumbnail?: string;
  width?: number;
  height?: number;
}

interface FileItem {
  id: string;
  path: string;
  name: string;
  detectedFormat: string;
  info?: ImageInfo;
  status: 'ready' | 'converting' | 'done' | 'error';
  result?: ConvertResult;
}

// ─── Format Catalog ───────────────────────────────────────────────────────────

const ALL_FORMATS: FormatMeta[] = [
  { id: 'png', label: 'PNG', category: 'Raster', desc: 'Portable Network Graphics (Lossless)' },
  { id: 'jpeg', label: 'JPEG', category: 'Raster', desc: 'Joint Photographic Experts Group' },
  { id: 'jpg', label: 'JPG', category: 'Raster', desc: 'Standard JPEG photo format' },
  { id: 'bmp', label: 'BMP', category: 'Raster', desc: 'Bitmap Image file (Uncompressed)' },
  { id: 'webp', label: 'WEBP', category: 'Web', desc: 'Modern high compression web format' },
  { id: 'gif', label: 'GIF', category: 'Raster', desc: 'Graphics Interchange Format' },
  { id: 'ico', label: 'ICO', category: 'Icon / Special', desc: 'Windows Icon resource file' },
  { id: 'tiff', label: 'TIFF', category: 'Raster', desc: 'Tagged Image File Format' },
];

const CATEGORIES = ['All', 'Raster', 'Web', 'Icon / Special'] as const;

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function detectFormatFromExtension(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg'].includes(ext)) return 'jpeg';
  if (['png', 'bmp', 'webp', 'gif', 'ico', 'tiff', 'tif'].includes(ext)) {
    return ext === 'tif' ? 'tiff' : ext;
  }
  return ext || 'unknown';
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ImageConverterPage() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [sourceFormat, setSourceFormat] = useState<string>('AUTO');
  const [targetFormat, setTargetFormat] = useState<SupportedFormat>('webp');
  const [jpegQuality, setJpegQuality] = useState(90);
  const [outputDir, setOutputDir] = useState<string>('');
  const [isConverting, setIsConverting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Modal / Popover state for format selection
  const [formatModalOpen, setFormatModalOpen] = useState<'source' | 'target' | null>(null);
  const [formatSearch, setFormatSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');

  // Preview Modal
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  // Fetch initial default download folder once on mount
  useEffect(() => {
    invoke<string>('get_default_output_dir')
      .then((dir) => setOutputDir(dir))
      .catch(() => {});
  }, []);

  // ── File Management Callback ────────────────────────────────────────────────

  const handleNewFilePaths = useCallback(async (paths: string[]) => {
    const validImageExts = ['png', 'jpg', 'jpeg', 'bmp', 'webp', 'gif', 'ico', 'tiff', 'tif'];

    const filtered = paths.filter((p) => {
      const ext = p.split('.').pop()?.toLowerCase() || '';
      return validImageExts.includes(ext);
    });

    if (filtered.length === 0) return;

    // Add unique files immediately with status: 'ready'
    setFiles((prev) => {
      const existingPaths = new Set(prev.map((f) => f.path.toLowerCase()));
      const unique = filtered.filter((p) => !existingPaths.has(p.toLowerCase()));
      if (unique.length === 0) return prev;

      const placeholders: FileItem[] = unique.map((p) => {
        const det = detectFormatFromExtension(p);
        return {
          id: `${p}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          path: p,
          name: p.split(/[\\/]/).pop() ?? p,
          detectedFormat: det.toUpperCase(),
          status: 'ready', // Instantly ready for conversion
        };
      });

      if (placeholders.length > 0) {
        setSourceFormat(placeholders[0].detectedFormat);
      }

      return [...prev, ...placeholders];
    });

    // Load Image Metadata & Base64 thumbnails asynchronously
    for (const p of filtered) {
      try {
        const info = await invoke<ImageInfo>('get_image_info', { inputPath: p });
        setFiles((prev) =>
          prev.map((f) =>
            f.path.toLowerCase() === p.toLowerCase()
              ? {
                  ...f,
                  info,
                  detectedFormat: info.format ? info.format.toUpperCase() : f.detectedFormat,
                  status: 'ready',
                }
              : f
          )
        );
      } catch (err) {
        console.error(`Failed to read info for ${p}:`, err);
      }
    }
  }, []);

  // Store in ref to avoid re-binding Tauri event listener on state updates
  const handleNewFilePathsRef = useRef(handleNewFilePaths);
  useEffect(() => {
    handleNewFilePathsRef.current = handleNewFilePaths;
  }, [handleNewFilePaths]);

  // ── Native Tauri Drag & Drop Listener (Registered ONCE on mount) ────────────

  useEffect(() => {
    let unlistenFn: (() => void) | null = null;
    let isMounted = true;

    async function initListener() {
      try {
        const webview = getCurrentWebview();
        const unlisten = await webview.onDragDropEvent((event) => {
          if (!isMounted) return;
          if (event.payload.type === 'enter' || event.payload.type === 'over') {
            setIsDragging(true);
          } else if (event.payload.type === 'leave') {
            setIsDragging(false);
          } else if (event.payload.type === 'drop') {
            setIsDragging(false);
            if (event.payload.paths && event.payload.paths.length > 0) {
              handleNewFilePathsRef.current(event.payload.paths);
            }
          }
        });

        if (isMounted) {
          unlistenFn = unlisten;
        } else {
          unlisten();
        }
      } catch (e) {
        console.error('Failed to setup Tauri drag-drop listener:', e);
      }
    }

    initListener();

    return () => {
      isMounted = false;
      if (unlistenFn) {
        unlistenFn();
      }
    };
  }, []);

  const handlePickFiles = async () => {
    try {
      const selected = await open({
        multiple: true,
        filters: [
          {
            name: 'Image Files',
            extensions: ['png', 'jpg', 'jpeg', 'bmp', 'webp', 'gif', 'ico', 'tiff', 'tif'],
          },
        ],
      });
      if (!selected) return;
      const paths = Array.isArray(selected) ? selected : [selected];
      await handleNewFilePaths(paths);
    } catch (e) {
      console.error('File picker error:', e);
    }
  };

  const handlePickOutputDir = async () => {
    try {
      const dir = await open({ directory: true, defaultPath: outputDir });
      if (dir && typeof dir === 'string') {
        setOutputDir(dir);
      }
    } catch (e) {
      console.error('Directory picker error:', e);
    }
  };

  const handleOpenFolder = async () => {
    try {
      await invoke('open_output_folder', { path: outputDir || null });
    } catch (e) {
      console.error('Open folder error:', e);
    }
  };

  const handleRemoveFile = (id: string) => {
    setFiles((prev) => {
      const next = prev.filter((f) => f.id !== id);
      if (next.length === 0) setSourceFormat('AUTO');
      return next;
    });
  };

  // ── Conversion ──────────────────────────────────────────────────────────────

  const handleConvert = async () => {
    if (files.length === 0 || isConverting) return;

    setIsConverting(true);

    setFiles((prev) =>
      prev.map((f) => ({ ...f, status: 'converting' }))
    );

    const conversions = files.map((f) => ({
      input_path: f.path,
      output_dir: outputDir ? outputDir : undefined,
      output_format: targetFormat,
      quality: ['jpeg', 'jpg'].includes(targetFormat) ? jpegQuality : undefined,
    }));

    try {
      const results = await invoke<ConvertResult[]>('convert_images_batch', { conversions });

      setFiles((prev) =>
        prev.map((f) => {
          const res = results.find((r) => r.input_path.toLowerCase() === f.path.toLowerCase());
          if (!res) return f;
          return {
            ...f,
            status: res.success ? 'done' : 'error',
            result: res,
          };
        })
      );
    } catch (err) {
      console.error('Batch convert failed:', err);
      setFiles((prev) =>
        prev.map((f) => ({
          ...f,
          status: 'error',
          result: {
            input_path: f.path,
            output_path: '',
            success: false,
            error: String(err),
          },
        }))
      );
    } finally {
      setIsConverting(false);
    }
  };

  const filteredModalFormats = ALL_FORMATS.filter((f) => {
    const matchCat = activeCategory === 'All' || f.category === activeCategory;
    const matchSearch =
      f.label.toLowerCase().includes(formatSearch.toLowerCase()) ||
      f.desc.toLowerCase().includes(formatSearch.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="flex w-full flex-col gap-6 text-[var(--text-primary)]">
      {/* ── Main Work Area ── */}
      <div className="flex flex-col gap-6">
        {/* ── Top Conversion Hero Banner ── */}
        <div className="relative rounded-2xl p-6 bg-[var(--bg-elevated)] border border-[var(--border)] shadow-xl flex flex-col items-center justify-center overflow-hidden">
          {/* Warm background glow */}
          <div
            className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full blur-3xl opacity-20"
            style={{ background: 'var(--accent)' }}
          />

          <div className="relative flex items-center justify-center gap-4 sm:gap-8 w-full max-w-2xl py-2">
            {/* Left Card: Input / Source format */}
            <div
              onClick={handlePickFiles}
              className="flex-1 flex flex-col items-center justify-center p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--border-hover)] transition-all cursor-pointer group shadow-lg min-w-[140px]"
            >
              <div className="w-12 h-12 rounded-xl bg-[var(--bg-base)] group-hover:bg-[var(--bg-hover)] flex items-center justify-center mb-3 transition-colors border border-[var(--border)]">
                <FileImage size={24} className="text-[var(--text-muted)] group-hover:text-[var(--text-primary)]" />
              </div>
              <span className="text-xs uppercase tracking-wider text-[var(--text-faint)] mb-0.5 font-medium">
                {files.length > 0 ? `${files.length} file(s)` : 'Input Format'}
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-bold font-mono text-[var(--text-primary)] tracking-wide">
                  {sourceFormat}
                </span>
                <Plus size={14} className="text-[var(--accent)]" />
              </div>
            </div>

            {/* Middle: "TO" / Exchange Badge */}
            <div className="flex flex-col items-center justify-center shrink-0">
              <div className="relative flex items-center justify-center">
                <div
                  className="absolute w-12 h-12 rounded-full blur-md opacity-40 animate-pulse"
                  style={{ background: 'var(--accent)' }}
                />
                <button
                  onClick={() => setFormatModalOpen('target')}
                  className="relative w-11 h-11 rounded-full text-black font-bold flex items-center justify-center shadow-lg hover:scale-105 transition-transform cursor-pointer border border-[var(--accent-border)]"
                  style={{ background: 'var(--accent)' }}
                >
                  <RefreshCw size={18} className="text-[#14110E]" />
                </button>
              </div>
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-[var(--text-faint)] mt-2 font-mono">
                TO
              </span>
            </div>

            {/* Right Card: Output / Target format */}
            <div
              onClick={() => setFormatModalOpen('target')}
              className="flex-1 flex flex-col items-center justify-center p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--accent-border)] hover:border-[var(--accent-hover)] transition-all cursor-pointer group shadow-lg min-w-[140px]"
            >
              <div className="w-12 h-12 rounded-xl bg-[var(--accent-dim)] group-hover:bg-[var(--accent-hover)] flex items-center justify-center mb-3 transition-colors border border-[var(--accent-border)]">
                <Sparkles size={24} className="text-[var(--accent)]" />
              </div>
              <span className="text-xs uppercase tracking-wider text-[var(--accent)] mb-0.5 font-medium">
                Output Format
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-bold font-mono text-[var(--accent)] tracking-wide uppercase">
                  {targetFormat}
                </span>
                <ChevronDown size={14} className="text-[var(--accent)]" />
              </div>
            </div>
          </div>

          {/* Quick Format Badges Row */}
          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-[var(--border)] flex-wrap justify-center">
            <span className="text-[11px] text-[var(--text-faint)] mr-1 font-medium">Quick Select:</span>
            {ALL_FORMATS.map((fmt) => (
              <button
                key={fmt.id}
                onClick={() => setTargetFormat(fmt.id)}
                className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer ${
                  targetFormat === fmt.id
                    ? 'bg-[var(--accent)] text-black shadow-md scale-105'
                    : 'bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] border border-[var(--border)]'
                }`}
              >
                {fmt.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Drag & Drop Zone or File List ── */}
        {files.length === 0 ? (
          /* Empty State Dropzone */
          <div
            onClick={handlePickFiles}
            className={`flex-1 min-h-[280px] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-8 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-[var(--accent)] bg-[var(--accent-glow)] scale-[1.01]'
                : 'border-[var(--border)] hover:border-[var(--accent-border)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-card)]'
            }`}
          >
            <div className="p-4 rounded-2xl bg-[var(--bg-base)] mb-4 border border-[var(--border)] shadow-inner">
              <Upload
                size={36}
                className={isDragging ? 'text-[var(--accent)] animate-bounce' : 'text-[var(--text-faint)]'}
              />
            </div>
            <h3 className="text-base font-semibold text-[var(--text-primary)] mb-1">
              {isDragging ? 'Drop your images here!' : 'Choose files or drag & drop them here'}
            </h3>
            <p className="text-xs text-[var(--text-muted)] max-w-md mb-4">
              Supports PNG, JPG, JPEG, BMP, WEBP, GIF, ICO, TIFF. Fast multi-file batch conversion!
            </p>
            <button className="btn btn-primary text-xs px-5 py-2">
              Browse Images
            </button>
          </div>
        ) : (
          /* File List & Controls */
          <div className="flex flex-col gap-4">
            {/* Top Toolbar / Settings */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)]">
              <div className="flex items-center gap-4 flex-wrap">
                {/* Destination Directory info */}
                <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                  <span className="text-[var(--text-faint)] font-medium">Save to:</span>
                  <button
                    onClick={handlePickOutputDir}
                    title="Click to change output folder"
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] border border-[var(--border)] text-[var(--accent)] font-mono text-[11px] transition-colors cursor-pointer max-w-xs truncate"
                  >
                    <FolderOpen size={12} className="shrink-0" />
                    <span className="truncate">{outputDir || 'Downloads/YolnomaDownloads/Images'}</span>
                  </button>
                </div>

                {/* Quality Slider (for JPEG) */}
                {['jpeg', 'jpg'].includes(targetFormat) && (
                  <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] pl-3 border-l border-[var(--border)]">
                    <Sliders size={13} className="text-[var(--text-faint)]" />
                    <span>Quality: {jpegQuality}%</span>
                    <input
                      type="range"
                      min={1}
                      max={100}
                      value={jpegQuality}
                      onChange={(e) => setJpegQuality(Number(e.target.value))}
                      className="w-24 accent-[var(--accent)] cursor-pointer"
                    />
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handlePickFiles}
                  className="btn btn-ghost text-xs px-3 py-1.5"
                >
                  <Upload size={13} />
                  Add More
                </button>

                <button
                  onClick={handleConvert}
                  disabled={isConverting || files.length === 0}
                  className="btn btn-primary text-xs px-5 py-2 font-semibold"
                >
                  {isConverting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Converting {files.length} image(s)…</span>
                    </>
                  ) : (
                    <>
                      <Play size={14} />
                      <span>Convert All to {targetFormat.toUpperCase()} ({files.length})</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* File Items Grid / Cards */}
            <div className="space-y-2.5">
              {files.map((file) => (
                <FileRowCard
                  key={file.id}
                  file={file}
                  targetFormat={targetFormat}
                  onRemove={() => handleRemoveFile(file.id)}
                  onPreview={(url, title) => setPreviewImage({ url, title })}
                  onOpenFolder={handleOpenFolder}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Format Selector Modal ── */}
      {formatModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border)] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-[var(--accent)]" />
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                  Select Output Format
                </h3>
              </div>
              <button
                onClick={() => setFormatModalOpen(null)}
                className="p-1 rounded-lg hover:bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Search Input */}
            <div className="p-4 border-b border-[var(--border)]">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
                <input
                  type="text"
                  placeholder="Search Format (PNG, JPEG, BMP, WEBP, ICO...)"
                  value={formatSearch}
                  onChange={(e) => setFormatSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-xs text-[var(--text-primary)] placeholder-[var(--text-faint)] focus:outline-none focus:border-[var(--accent-border)] transition-colors"
                  autoFocus
                />
              </div>
            </div>

            {/* Categories & Grid */}
            <div className="flex flex-1 overflow-hidden min-h-[300px]">
              {/* Left Category Column */}
              <div className="w-36 shrink-0 border-r border-[var(--border)] bg-[var(--bg-base)] p-2 space-y-1">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      activeCategory === cat
                        ? 'bg-[var(--accent-dim)] text-[var(--accent)] border border-[var(--accent-border)]'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Right Format Grid */}
              <div className="flex-1 p-4 overflow-y-auto">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {filteredModalFormats.map((fmt) => {
                    const isSelected = targetFormat === fmt.id;
                    return (
                      <button
                        key={fmt.id}
                        onClick={() => {
                          setTargetFormat(fmt.id);
                          setFormatModalOpen(null);
                        }}
                        className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[var(--accent)] text-black border-[var(--accent)] shadow-lg scale-[1.02]'
                            : 'bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] border-[var(--border)] hover:border-[var(--border-hover)] text-[var(--text-primary)]'
                        }`}
                      >
                        <span className="text-sm font-bold font-mono">{fmt.label}</span>
                        <span
                          className={`text-[10px] mt-1 leading-tight line-clamp-2 ${
                            isSelected ? 'text-black/80 font-medium' : 'text-[var(--text-faint)]'
                          }`}
                        >
                          {fmt.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Image Preview Modal ── */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-6"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-3xl max-h-[85vh] rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border)] p-3 shadow-2xl flex flex-col items-center"
          >
            <div className="w-full flex items-center justify-between pb-2 mb-2 border-b border-[var(--border)]">
              <span className="text-xs font-semibold text-[var(--text-primary)] truncate max-w-md">
                {previewImage.title}
              </span>
              <button
                onClick={() => setPreviewImage(null)}
                className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <img
              src={previewImage.url}
              alt="Preview"
              className="max-h-[70vh] object-contain rounded-lg border border-[var(--border)] bg-[var(--bg-base)]"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── File Row Card Sub-component ──────────────────────────────────────────────

function FileRowCard({
  file,
  targetFormat,
  onRemove,
  onPreview,
  onOpenFolder,
}: {
  file: FileItem;
  targetFormat: SupportedFormat;
  onRemove: () => void;
  onPreview: (url: string, title: string) => void;
  onOpenFolder: () => void;
}) {
  const isDone = file.status === 'done';
  const isError = file.status === 'error';
  const isConverting = file.status === 'converting';

  return (
    <div
      className={`rounded-xl border p-4 transition-all ${
        isDone
          ? 'border-emerald-500/30 bg-emerald-500/[0.04]'
          : isError
          ? 'border-red-500/30 bg-red-500/[0.04]'
          : isConverting
          ? 'border-[var(--accent-border)] bg-[var(--accent-glow)]'
          : 'border-[var(--border)] bg-[var(--bg-card)]'
      }`}
    >
      <div className="flex items-center gap-4">
        {/* Thumbnail preview */}
        <div
          onClick={() => {
            const previewUrl = file.result?.thumbnail || file.info?.thumbnail;
            if (previewUrl) {
              onPreview(previewUrl, file.name);
            }
          }}
          className={`w-14 h-14 rounded-lg bg-[var(--bg-base)] border border-[var(--border)] flex items-center justify-center overflow-hidden shrink-0 relative group ${
            file.info?.thumbnail || file.result?.thumbnail ? 'cursor-pointer' : ''
          }`}
        >
          {file.result?.thumbnail ? (
            <img src={file.result.thumbnail} alt="output" className="w-full h-full object-cover" />
          ) : file.info?.thumbnail ? (
            <img src={file.info.thumbnail} alt="input" className="w-full h-full object-cover" />
          ) : (
            <ImageIcon size={22} className="text-[var(--text-faint)]" />
          )}

          {(file.info?.thumbnail || file.result?.thumbnail) && (
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <Eye size={16} className="text-[var(--text-primary)]" />
            </div>
          )}
        </div>

        {/* File Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-[var(--text-primary)] truncate max-w-sm" title={file.name}>
              {file.name}
            </h4>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--bg-base)] text-[var(--text-muted)] border border-[var(--border)]">
              {file.detectedFormat}
            </span>
            <ArrowRight size={12} className="text-[var(--text-faint)]" />
            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[var(--accent-dim)] text-[var(--accent)] border border-[var(--accent-border)] uppercase">
              {targetFormat}
            </span>
          </div>

          <div className="flex items-center gap-3 mt-1 text-xs text-[var(--text-muted)] flex-wrap">
            {file.info && (
              <span>
                {file.info.width} × {file.info.height} px · {formatBytes(file.info.file_size)}
              </span>
            )}
            {isDone && file.result?.file_size && (
              <span className="text-emerald-400 font-medium">
                → Result: {formatBytes(file.result.file_size)}
              </span>
            )}
            {isConverting && (
              <span className="text-[var(--accent)] flex items-center gap-1">
                <Loader2 size={11} className="animate-spin" /> Processing…
              </span>
            )}
          </div>

          {isError && file.result?.error && (
            <p className="text-xs text-red-400 mt-1 truncate" title={file.result.error}>
              ⚠️ Error: {file.result.error}
            </p>
          )}

          {isDone && file.result?.output_path && (
            <p
              className="text-[11px] text-[var(--text-faint)] mt-1 truncate font-mono"
              title={file.result.output_path}
            >
              Saved: {file.result.output_path}
            </p>
          )}
        </div>

        {/* Status / Quick Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {isDone && (
            <button
              onClick={onOpenFolder}
              className="p-2 rounded-lg text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors cursor-pointer"
              title="Open Folder"
            >
              <ExternalLink size={16} />
            </button>
          )}

          {isDone && <CheckCircle size={18} className="text-emerald-400" />}
          {isError && <XCircle size={18} className="text-red-400" />}

          <button
            onClick={onRemove}
            className="p-2 rounded-lg text-[var(--text-faint)] hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
            title="Remove"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
