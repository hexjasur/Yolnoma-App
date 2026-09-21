import { useEffect, useState, useRef } from 'react';
import {
  UploadCloud,
  FileText,
  FileArchive,
  Image as ImageIcon,
  Sparkles,
  ArrowRight,
  X,
  Code,
  FileCode,
} from 'lucide-react';
import { formatBytes } from '@/shared/lib/files';

type DroppedFile = {
  name: string;
  size: number;
  type: string;
  extension: string;
  file: File;
};

type SuggestedTool = {
  id: string;
  title: string;
  description: string;
  path: string;
  icon: typeof ImageIcon;
  primary?: boolean;
};

export default function GlobalDropzone() {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [droppedFiles, setDroppedFiles] = useState<DroppedFile[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const dragCounter = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Determine suggestions based on file extensions
  const getSuggestions = (files: DroppedFile[]): SuggestedTool[] => {
    if (files.length === 0) return [];
    const firstExt = files[0].extension.toLowerCase();

    // Image files
    if (['jpg', 'jpeg', 'png', 'webp', 'bmp', 'avif'].includes(firstExt)) {
      return [
        {
          id: 'bg-remover',
          title: 'Background Remover (AI)',
          description: 'Sun’iy intellekt orqali rasm fonini olib tashlash',
          path: '/tools/bg-remover',
          icon: Sparkles,
          primary: true,
        },
        {
          id: 'image-converter',
          title: 'Image Converter & Optimizer',
          description: 'Formatni o‘zgartirish, siqish va optimallashtirish',
          path: '/tools/image',
          icon: ImageIcon,
        },
      ];
    }

    // Archive files
    if (['zip', 'rar', '7z', 'tar', 'gz', 'tar.gz'].includes(firstExt)) {
      return [
        {
          id: 'archive-explorer',
          title: 'Archive Explorer',
          description: 'Arxiv ichidagi fayllarni ko‘rish va ochish',
          path: '/tools/archive-explorer',
          icon: FileArchive,
          primary: true,
        },
      ];
    }

    // JSON files
    if (firstExt === 'json') {
      return [
        {
          id: 'json-viewer',
          title: 'JSON Edit & View',
          description: 'JSON ma’lumotlarini ko‘rish, tahrirlash va kartalarga aylantirish',
          path: '/tools/json',
          icon: Code,
          primary: true,
        },
        {
          id: 'developer-tools',
          title: 'Developer Tools',
          description: 'JSON formatter, validator va boshqa dasturchi vositalari',
          path: '/tools/developer-tools',
          icon: FileCode,
        },
      ];
    }

    // CSS files
    if (['css', 'scss', 'sass', 'less'].includes(firstExt)) {
      return [
        {
          id: 'css-tools',
          title: 'CSS Tools',
          description: 'Gradiyentlar, scrollbar generator va minifikatsiya',
          path: '/tools/css-tools',
          icon: FileCode,
          primary: true,
        },
      ];
    }

    // Default fallback suggestions
    return [
      {
        id: 'developer-tools',
        title: 'Developer Tools',
        description: 'Dasturchilar uchun universal asboblar to‘plami',
        path: '/tools/developer-tools',
        icon: FileCode,
        primary: true,
      },
      {
        id: 'archive-explorer',
        title: 'Archive Explorer',
        description: 'Fayl yoki arxivlarni tahlil qilish',
        path: '/tools/archive-explorer',
        icon: FileArchive,
      },
    ];
  };

  const processFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const list: DroppedFile[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const parts = file.name.split('.');
      const extension = parts.length > 1 ? parts.pop() || '' : '';
      list.push({
        name: file.name,
        size: file.size,
        type: file.type,
        extension,
        file,
      });
    }

    setDroppedFiles(list);
    setModalOpen(true);
  };

  useEffect(() => {
    const handleDragEnter = (e: globalThis.DragEvent) => {
      e.preventDefault();
      // Only care about files
      if (e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')) {
        dragCounter.current += 1;
        setIsDraggingOver(true);
      }
    };

    const handleDragOver = (e: globalThis.DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
    };

    const handleDragLeave = (e: globalThis.DragEvent) => {
      e.preventDefault();
      dragCounter.current -= 1;
      if (dragCounter.current <= 0) {
        dragCounter.current = 0;
        setIsDraggingOver(false);
      }
    };

    const handleDrop = (e: globalThis.DragEvent) => {
      e.preventDefault();
      dragCounter.current = 0;
      setIsDraggingOver(false);

      if (e.dataTransfer && e.dataTransfer.files.length > 0) {
        processFiles(e.dataTransfer.files);
      }
    };

    const handleOpenCustomDropzone = () => {
      fileInputRef.current?.click();
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);
    window.addEventListener('yolnoma:open-dropzone', handleOpenCustomDropzone);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
      window.removeEventListener('yolnoma:open-dropzone', handleOpenCustomDropzone);
    };
  }, []);

  const handleToolSelect = (tool: SuggestedTool) => {
    setModalOpen(false);
    setDroppedFiles([]);
    window.location.hash = `#${tool.path}`;
  };

  const suggestions = getSuggestions(droppedFiles);
  const primaryFile = droppedFiles[0];

  return (
    <>
      {/* Hidden manual file input picker */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) {
            processFiles(e.target.files);
          }
          e.target.value = '';
        }}
      />

      {/* ── 1. Global Full-Screen Drag Overlay ─────────────────────────── */}
      {isDraggingOver && (
        <div className="fixed inset-0 z-[150] flex flex-col items-center justify-center bg-black/80 backdrop-blur-md transition-all animate-in fade-in duration-200 pointer-events-none">
          <div className="flex flex-col items-center gap-5 p-12 rounded-3xl border-2 border-dashed border-[var(--accent)] bg-[#1a1410]/90 shadow-2xl max-w-md text-center">
            <div className="w-20 h-20 rounded-2xl bg-[var(--accent)]/15 border border-[var(--accent-border)] flex items-center justify-center text-[var(--accent)] animate-bounce">
              <UploadCloud size={44} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-wide">Faylni shu yerga tashlang</h2>
              <p className="text-sm text-white/50 mt-1.5">
                Rasm, arxiv yoki JSON fayllarni tegishli asboblar bilan tezda oching
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-[var(--accent)] font-medium px-3 py-1.5 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/20">
              <Sparkles size={13} />
              <span>Avtomatik vosita taklif qilinadi</span>
            </div>
          </div>
        </div>
      )}

      {/* ── 2. Dropped File Action Modal ───────────────────────────────── */}
      {modalOpen && primaryFile && (
        <div
          className="fixed inset-0 z-[160] flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-white/[0.12] bg-[#18130f] p-6 shadow-2xl shadow-black/80"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b border-white/[0.08] pb-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-[var(--accent)] shrink-0">
                  <FileText size={22} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-white truncate max-w-xs" title={primaryFile.name}>
                    {primaryFile.name}
                  </h3>
                  <p className="text-xs text-white/40 mt-0.5">
                    {formatBytes(primaryFile.size)} • {primaryFile.extension.toUpperCase() || 'FAYL'}
                    {droppedFiles.length > 1 && ` (+ yana ${droppedFiles.length - 1} ta fayl)`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06] transition"
                aria-label="Yopish"
              >
                <X size={18} />
              </button>
            </div>

            {/* Suggestions list */}
            <div className="mt-5 space-y-2.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/40">
                Qaysi vosita orqali ochmoqchisiz?
              </p>
              {suggestions.map((tool) => {
                const Icon = tool.icon;
                return (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => handleToolSelect(tool)}
                    className={`group w-full flex items-center justify-between gap-4 p-3.5 rounded-xl border text-left transition-all ${
                      tool.primary
                        ? 'border-[var(--accent-border)] bg-[var(--accent-dim)] hover:bg-[var(--accent)]/20 text-white'
                        : 'border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06] text-white/80'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border ${
                          tool.primary
                            ? 'border-[var(--accent-border)] bg-[var(--accent)]/20 text-[var(--accent)]'
                            : 'border-white/[0.08] bg-white/[0.04] text-white/50'
                        }`}
                      >
                        <Icon size={20} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium flex items-center gap-2">
                          <span>{tool.title}</span>
                          {tool.primary && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[var(--accent)]/20 text-[var(--accent)] uppercase">
                              Tavsiya
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-white/40 truncate mt-0.5">{tool.description}</p>
                      </div>
                    </div>
                    <ArrowRight
                      size={16}
                      className="text-white/30 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0"
                    />
                  </button>
                );
              })}
            </div>

            {/* Footer */}
            <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center justify-between text-xs text-white/35">
              <span>Esc yoki tashqarisiga bosib bekor qilish mumkin</span>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-3 py-1.5 rounded-lg hover:bg-white/[0.06] text-white/60 hover:text-white transition"
              >
                Bekor qilish
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
