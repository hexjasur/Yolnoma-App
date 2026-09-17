import React, { useState, useMemo, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import {
  FolderArchive,
  Folder,
  FolderOpen,
  File,
  FileCode,
  FileText,
  FileImage,
  FileAudio,
  FileVideo,
  FileSpreadsheet,
  Search,
  LayoutGrid,
  List as ListIcon,
  ChevronRight,
  ArrowUp,
  DownloadCloud,
  FileUp,
  X,
  Copy,
  Check,
  Download,
  FileQuestion,
} from 'lucide-react';
import { Button } from '@/shared/ui';
import { formatBytes } from '@/shared/lib/files';
import { toast } from '@/shared/ui/Toast';

interface ArchiveEntry {
  path: string;
  name: string;
  is_dir: boolean;
  size: number;
  compressed_size: number;
  modified: string | null;
}

interface ArchiveSummary {
  archive_name: string;
  archive_size: number;
  total_files: number;
  total_folders: number;
  uncompressed_size: number;
  format: string;
  entries: ArchiveEntry[];
}

interface ArchiveFileData {
  name: string;
  path: string;
  size: number;
  kind: 'text' | 'image' | 'video' | 'audio' | 'binary';
  mime_type: string;
  text_content: string | null;
  data_url: string | null;
}

function getFileIcon(name: string, isDir: boolean) {
  if (isDir) return <Folder size={22} className="text-amber-400 shrink-0" />;
  const parts = name.split('.');
  const ext = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';

  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp', 'ico'].includes(ext)) {
    return <FileImage size={22} className="text-purple-400 shrink-0" />;
  }
  if (['mp4', 'mkv', 'avi', 'mov', 'webm', 'wmv'].includes(ext)) {
    return <FileVideo size={22} className="text-rose-400 shrink-0" />;
  }
  if (['mp3', 'wav', 'flac', 'ogg', 'm4a'].includes(ext)) {
    return <FileAudio size={22} className="text-pink-400 shrink-0" />;
  }
  if (['js', 'ts', 'jsx', 'tsx', 'rs', 'py', 'html', 'css', 'json', 'c', 'cpp', 'go', 'toml', 'yaml', 'yml'].includes(ext)) {
    return <FileCode size={22} className="text-emerald-400 shrink-0" />;
  }
  if (['txt', 'md', 'doc', 'docx', 'pdf', 'rtf', 'log', 'ini', 'env'].includes(ext)) {
    return <FileText size={22} className="text-blue-400 shrink-0" />;
  }
  if (['xls', 'xlsx', 'csv'].includes(ext)) {
    return <FileSpreadsheet size={22} className="text-teal-400 shrink-0" />;
  }

  return <File size={22} className="text-[var(--text-faint)] shrink-0" />;
}

export default function ArchiveExplorerPage() {
  const [filePath, setFilePath] = useState<string>('');
  const [archive, setArchive] = useState<ArchiveSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentPrefix, setCurrentPrefix] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [extracting, setExtracting] = useState(false);

  // File Preview Modal State
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<ArchiveFileData | null>(null);
  const [copiedText, setCopiedText] = useState(false);
  const [extractingSingle, setExtractingSingle] = useState(false);

  const handleSelectFile = async () => {
    try {
      const selected = await openDialog({
        multiple: false,
        filters: [
          {
            name: 'Archives',
            extensions: ['zip', '7z'],
          },
        ],
      });

      if (selected && typeof selected === 'string') {
        await loadArchive(selected);
      }
    } catch (err) {
      toast.error(`Could not open file picker: ${String(err)}`);
    }
  };

  const loadArchive = async (path: string) => {
    setLoading(true);
    setCurrentPrefix('');
    setSearchQuery('');
    setFilePath(path);

    try {
      const summary = await invoke<ArchiveSummary>('list_archive_entries', { filePath: path });
      setArchive(summary);
      toast.success(`Loaded ${summary.archive_name} (${summary.total_files} files)`);
    } catch (err) {
      toast.error(String(err) || 'Could not load archive.');
      setArchive(null);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenFilePreview = async (entry: ArchiveEntry) => {
    if (entry.is_dir || !filePath) return;

    setPreviewModalOpen(true);
    setPreviewLoading(true);
    setPreviewData(null);
    setCopiedText(false);

    try {
      const data = await invoke<ArchiveFileData>('read_archive_entry_content', {
        archivePath: filePath,
        entryPath: entry.path,
      });
      setPreviewData(data);
    } catch (err) {
      toast.error(String(err) || 'Could not preview file.');
      setPreviewModalOpen(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleExtractSingle = async (entryPath: string) => {
    if (!filePath) return;

    try {
      const selectedDir = await openDialog({
        directory: true,
        multiple: false,
        title: 'Select Destination Folder',
      });

      if (selectedDir && typeof selectedDir === 'string') {
        setExtractingSingle(true);
        const res = await invoke<string>('extract_single_entry', {
          archivePath: filePath,
          entryPath,
          destDir: selectedDir,
        });
        toast.success(res || 'File extracted successfully.');
      }
    } catch (err) {
      toast.error(`Extraction failed: ${String(err)}`);
    } finally {
      setExtractingSingle(false);
    }
  };

  const handleExtractAll = async () => {
    if (!filePath || !archive) return;

    try {
      const selectedDir = await openDialog({
        directory: true,
        multiple: false,
        title: 'Select Destination Folder',
      });

      if (selectedDir && typeof selectedDir === 'string') {
        setExtracting(true);
        const res = await invoke<string>('extract_archive', {
          archivePath: filePath,
          destDir: selectedDir,
        });
        toast.success(res || 'Archive extracted successfully.');
      }
    } catch (err) {
      toast.error(`Extraction failed: ${String(err)}`);
    } finally {
      setExtracting(false);
    }
  };

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
    toast.success('Copied to clipboard');
  };

  // Close preview on Esc key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPreviewModalOpen(false);
      }
    };
    if (previewModalOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [previewModalOpen]);

  // Breadcrumbs items
  const breadcrumbs = useMemo(() => {
    if (!currentPrefix) return [{ label: 'Root', prefix: '' }];
    const parts = currentPrefix.split('/').filter(Boolean);
    const crumbs = [{ label: 'Root', prefix: '' }];
    let acc = '';
    for (const part of parts) {
      acc = acc ? `${acc}/${part}` : part;
      crumbs.push({ label: part, prefix: acc });
    }
    return crumbs;
  }, [currentPrefix]);

  // Current folder entries
  const visibleEntries = useMemo(() => {
    if (!archive) return [];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return archive.entries.filter((e) => e.name.toLowerCase().includes(q));
    }

    const map = new Map<string, { entry: ArchiveEntry; isVirtualDir?: boolean }>();
    const prefixSlash = currentPrefix ? `${currentPrefix}/` : '';

    for (const entry of archive.entries) {
      if (entry.path === currentPrefix) continue;

      if (!prefixSlash || entry.path.startsWith(prefixSlash)) {
        const subPath = entry.path.slice(prefixSlash.length);
        const parts = subPath.split('/');
        const immediateItemName = parts[0];

        if (parts.length > 1) {
          const dirKey = immediateItemName;
          if (!map.has(dirKey)) {
            map.set(dirKey, {
              entry: {
                path: prefixSlash ? `${prefixSlash}${dirKey}` : dirKey,
                name: dirKey,
                is_dir: true,
                size: 0,
                compressed_size: 0,
                modified: null,
              },
              isVirtualDir: true,
            });
          }
        } else {
          map.set(entry.name, { entry });
        }
      }
    }

    const items = Array.from(map.values()).map((v) => v.entry);
    return items.sort((a, b) => {
      if (a.is_dir && !b.is_dir) return -1;
      if (!a.is_dir && b.is_dir) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [archive, currentPrefix, searchQuery]);

  const handleNavigateUp = () => {
    if (!currentPrefix) return;
    const parts = currentPrefix.split('/');
    parts.pop();
    setCurrentPrefix(parts.join('/'));
  };

  return (
    <div className="min-h-full p-6 max-w-6xl mx-auto space-y-6 text-[#F2EDE6]">
      {/* Header */}
      <div className="border-b border-[var(--border)] pb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 text-[#D97757] mb-1.5">
            <FolderArchive size={22} strokeWidth={2} />
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em]">File Utility</span>
          </div>
          <h1 className="font-serif text-3xl font-medium tracking-tight text-[var(--text-primary)]">
            Archive Explorer
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Browse, preview text, image, and video files inside ZIP & 7z archives without extracting.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {archive && (
            <Button
              variant="primary"
              onClick={handleExtractAll}
              disabled={extracting}
              className="flex items-center gap-2 text-xs py-2 px-4 shadow-lg shadow-[#D97757]/20"
            >
              <DownloadCloud size={15} />
              <span>{extracting ? 'Extracting…' : 'Extract All'}</span>
            </Button>
          )}

          <Button
            variant="ghost"
            onClick={handleSelectFile}
            disabled={loading}
            className="flex items-center gap-2 text-xs py-2 px-4 bg-white/[0.04] border border-[var(--border)] hover:bg-white/[0.08]"
          >
            <FileUp size={15} className="text-[#D97757]" />
            <span>Open Archive</span>
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      {!archive && !loading ? (
        <div
          onClick={handleSelectFile}
          className="border-2 border-dashed border-[var(--border)] hover:border-[#D97757]/60 rounded-3xl p-16 text-center cursor-pointer bg-[var(--bg-elevated)]/40 hover:bg-white/[0.02] transition-all duration-300 group"
        >
          <div className="w-16 h-16 rounded-2xl bg-[#D97757]/10 text-[#D97757] flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
            <FolderArchive size={32} strokeWidth={1.75} />
          </div>
          <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">
            No archive opened
          </h3>
          <p className="text-sm text-[var(--text-muted)] max-w-sm mx-auto mb-6">
            Click here or use the button above to browse and open any <strong className="text-white">.ZIP</strong> or <strong className="text-white">.7z</strong> archive.
          </p>
          <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#D97757] text-white text-xs font-semibold shadow-lg shadow-[#D97757]/20 group-hover:bg-[#D97757]/90 transition-all">
            <FileUp size={15} /> Browse Archive File
          </span>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Archive Metadata Bar */}
          {archive && (
            <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 text-xs shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#D97757]/15 text-[#D97757] flex items-center justify-center shrink-0">
                  <FolderArchive size={20} />
                </div>
                <div>
                  <div className="font-semibold text-sm text-[var(--text-primary)]">
                    {archive.archive_name}
                  </div>
                  <div className="text-[var(--text-muted)] flex items-center gap-2 text-[11px] mt-0.5">
                    <span className="px-1.5 py-0.2 rounded bg-white/[0.06] font-mono uppercase font-bold text-[#D97757]">{archive.format}</span>
                    <span>·</span>
                    <span>{formatBytes(archive.archive_size)} compressed</span>
                    <span>·</span>
                    <span>{formatBytes(archive.uncompressed_size)} total</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 text-[var(--text-muted)] text-xs font-medium">
                <div>
                  <strong className="text-white">{archive.total_files}</strong> files
                </div>
                <div>
                  <strong className="text-white">{archive.total_folders}</strong> folders
                </div>
              </div>
            </div>
          )}

          {/* Navigation Bar (Breadcrumbs & Controls) */}
          <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-md">
            {/* Breadcrumb path */}
            <div className="flex items-center gap-1.5 flex-1 min-w-[200px] overflow-x-auto py-1">
              <button
                type="button"
                onClick={handleNavigateUp}
                disabled={!currentPrefix || Boolean(searchQuery)}
                className="p-1.5 rounded-lg border border-[var(--border)] hover:bg-white/[0.06] text-[var(--text-muted)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Go up one folder"
              >
                <ArrowUp size={14} />
              </button>

              <div className="flex items-center gap-1 text-xs">
                {breadcrumbs.map((crumb, idx) => (
                  <React.Fragment key={crumb.prefix}>
                    {idx > 0 && <ChevronRight size={13} className="text-[var(--text-faint)]" />}
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentPrefix(crumb.prefix);
                        setSearchQuery('');
                      }}
                      className={`px-2.5 py-1 rounded-lg transition-colors font-medium ${
                        idx === breadcrumbs.length - 1
                          ? 'bg-[#D97757]/15 text-[#D97757] font-semibold'
                          : 'text-[var(--text-muted)] hover:text-white hover:bg-white/[0.04]'
                      }`}
                    >
                      {crumb.label}
                    </button>
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Search and View Mode */}
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search in archive…"
                  className="pl-8 pr-3 py-1.5 rounded-xl bg-white/[0.03] border border-[var(--border)] text-xs focus:outline-none focus:ring-1 focus:ring-[#D97757] w-48"
                />
              </div>

              <div className="flex rounded-xl bg-white/[0.03] border border-[var(--border)] p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-lg transition-all ${
                    viewMode === 'grid' ? 'bg-[#D97757] text-white' : 'text-[var(--text-muted)]'
                  }`}
                  title="Grid view"
                >
                  <LayoutGrid size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded-lg transition-all ${
                    viewMode === 'list' ? 'bg-[#D97757] text-white' : 'text-[var(--text-muted)]'
                  }`}
                  title="List view"
                >
                  <ListIcon size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Explorer Content View */}
          {visibleEntries.length === 0 ? (
            <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-2xl p-16 text-center text-[var(--text-muted)]">
              <FolderOpen size={36} className="mx-auto text-[var(--text-faint)] mb-3" />
              <p className="text-sm">This folder is empty or no files matched your search.</p>
            </div>
          ) : viewMode === 'grid' ? (
            /* Grid View */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
              {visibleEntries.map((item) => {
                const icon = getFileIcon(item.name, item.is_dir);
                return (
                  <div
                    key={item.path}
                    onClick={() => {
                      if (item.is_dir) {
                        setCurrentPrefix(item.path);
                        setSearchQuery('');
                      } else {
                        handleOpenFilePreview(item);
                      }
                    }}
                    className="group relative bg-[var(--bg-elevated)] border border-[var(--border)] hover:border-[#D97757]/50 rounded-2xl p-4 flex flex-col items-center text-center cursor-pointer hover:bg-white/[0.03] transition-all shadow-md hover:shadow-xl"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-white/[0.02] border border-white/[0.04] group-hover:border-[#D97757]/30 flex items-center justify-center mb-3 group-hover:scale-105 transition-all">
                      {icon}
                    </div>
                    <span className="text-xs font-medium text-[var(--text-primary)] line-clamp-2 break-all group-hover:text-[#D97757] transition-colors leading-snug">
                      {item.name}
                    </span>
                    <span className="text-[10px] text-[var(--text-faint)] mt-1.5 font-mono">
                      {item.is_dir ? 'Folder' : formatBytes(item.size)}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            /* List View */
            <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-md">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/[0.06] text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] bg-white/[0.02]">
                    <th className="py-3 px-4">Name</th>
                    <th className="py-3 px-4">Size</th>
                    <th className="py-3 px-4">Compressed</th>
                    <th className="py-3 px-4">Modified</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {visibleEntries.map((item) => {
                    const icon = getFileIcon(item.name, item.is_dir);
                    return (
                      <tr
                        key={item.path}
                        onClick={() => {
                          if (item.is_dir) {
                            setCurrentPrefix(item.path);
                            setSearchQuery('');
                          } else {
                            handleOpenFilePreview(item);
                          }
                        }}
                        className="hover:bg-white/[0.03] cursor-pointer transition-colors group"
                      >
                        <td className="py-3 px-4 font-medium flex items-center gap-2.5 text-[var(--text-primary)] group-hover:text-[#D97757] transition-colors">
                          {icon}
                          <span className="truncate">{item.name}</span>
                        </td>
                        <td className="py-3 px-4 text-[var(--text-muted)] font-mono">
                          {item.is_dir ? '—' : formatBytes(item.size)}
                        </td>
                        <td className="py-3 px-4 text-[var(--text-muted)] font-mono">
                          {item.is_dir ? '—' : formatBytes(item.compressed_size)}
                        </td>
                        <td className="py-3 px-4 text-[var(--text-faint)] font-mono text-[11px]">
                          {item.modified || '—'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {!item.is_dir && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleExtractSingle(item.path);
                              }}
                              className="p-1.5 rounded-lg border border-[var(--border)] hover:bg-white/[0.06] text-[var(--text-muted)] hover:text-white transition-all"
                              title="Extract this file"
                            >
                              <Download size={13} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Enhanced File Preview Modal */}
      {previewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div
            className="bg-[#181410] border border-white/10 rounded-3xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
            style={{ boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8)' }}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between gap-4 bg-white/[0.02]">
              <div className="flex items-center gap-3 min-w-0">
                {previewData && getFileIcon(previewData.name, false)}
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-[#F2EDE6] truncate">
                    {previewData?.name || 'File Preview'}
                  </h3>
                  {previewData && (
                    <p className="text-[11px] text-white/40 font-mono">
                      {formatBytes(previewData.size)} · {previewData.mime_type}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {previewData?.kind === 'text' && previewData.text_content && (
                  <button
                    type="button"
                    onClick={() => handleCopyText(previewData.text_content!)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-xs text-white/80 transition-all"
                  >
                    {copiedText ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                    <span>{copiedText ? 'Copied' : 'Copy'}</span>
                  </button>
                )}

                {previewData && (
                  <button
                    type="button"
                    onClick={() => handleExtractSingle(previewData.path)}
                    disabled={extractingSingle}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#D97757] text-white text-xs font-semibold hover:bg-[#D97757]/90 transition-all shadow-md shrink-0"
                  >
                    <Download size={13} />
                    <span>{extractingSingle ? 'Extracting…' : 'Extract'}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setPreviewModalOpen(false)}
                  className="p-1.5 rounded-xl border border-white/10 text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 bg-[#120F0D]">
              {previewLoading ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-3 text-white/50">
                  <div className="w-8 h-8 border-2 border-[#D97757]/30 border-t-[#D97757] rounded-full animate-spin" />
                  <span className="text-xs">Reading file from archive…</span>
                </div>
              ) : previewData?.kind === 'image' && previewData.data_url ? (
                /* Image Preview */
                <div className="flex items-center justify-center p-4">
                  <img
                    src={previewData.data_url}
                    alt={previewData.name}
                    className="max-h-[60vh] max-w-full object-contain rounded-xl border border-white/10 shadow-2xl bg-black/40"
                  />
                </div>
              ) : previewData?.kind === 'video' && previewData.data_url ? (
                /* Video Preview */
                <div className="flex items-center justify-center p-4">
                  <video
                    src={previewData.data_url}
                    controls
                    autoPlay
                    className="max-h-[60vh] max-w-full rounded-2xl border border-white/10 shadow-2xl bg-black"
                  />
                </div>
              ) : previewData?.kind === 'audio' && previewData.data_url ? (
                /* Audio Preview */
                <div className="flex flex-col items-center justify-center py-16 space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-pink-500/15 text-pink-400 flex items-center justify-center shadow-lg">
                    <FileAudio size={32} />
                  </div>
                  <div className="text-sm font-medium text-white">{previewData.name}</div>
                  <audio src={previewData.data_url} controls autoPlay className="w-full max-w-md mt-4" />
                </div>
              ) : previewData?.kind === 'text' && previewData.text_content !== null ? (
                /* Text / Code Viewer */
                <div className="rounded-2xl border border-white/[0.08] bg-[#16120F] overflow-x-auto p-4 font-mono text-xs text-white/90 leading-relaxed shadow-inner">
                  <pre className="whitespace-pre-wrap break-words">{previewData.text_content}</pre>
                </div>
              ) : (
                /* Binary or Unsupported File */
                <div className="flex flex-col items-center justify-center py-16 space-y-3 text-white/50 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-white/[0.04] text-white/40 flex items-center justify-center mb-1">
                    <FileQuestion size={28} />
                  </div>
                  <p className="text-sm font-medium text-white/80">Binary File Preview Unavailable</p>
                  <p className="text-xs text-white/40 max-w-xs">
                    This file format cannot be rendered directly in the browser. You can extract it to view with your default system application.
                  </p>
                  <button
                    type="button"
                    onClick={() => previewData && handleExtractSingle(previewData.path)}
                    className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#D97757] text-white text-xs font-semibold hover:bg-[#D97757]/90 transition-all shadow-md"
                  >
                    <Download size={14} /> Extract File
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
