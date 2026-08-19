import { useState, useEffect } from 'react';
import { Download, ExternalLink, Image as ImageIcon, Maximize2 } from 'lucide-react';

interface VideoGalleryProps {
  screenshots: string[];
  title?: string;
}

export default function VideoGallery({ screenshots, title }: VideoGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  // Keep index within bounds if screenshots change
  useEffect(() => {
    if (selectedIndex >= screenshots.length) {
      setSelectedIndex(0);
    }
  }, [screenshots, selectedIndex]);

  if (!screenshots || screenshots.length === 0) {
    return null;
  }

  const activeImage = screenshots[selectedIndex] || screenshots[0];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ImageIcon size={18} className="text-[var(--accent)]" />
          <h2 className="font-serif text-xl font-medium text-[var(--text-primary)]">
            Suratlar va Screenshots galereyasi ({screenshots.length})
          </h2>
        </div>
        <span className="text-xs text-[var(--text-faint)]">
          {selectedIndex + 1} / {screenshots.length}
        </span>
      </div>

      {/* Main Selected Image Showcase */}
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-[var(--border)] bg-[#0F0D0B] shadow-lg group">
        <img
          src={activeImage}
          alt={`${title || 'Video'} screenshot ${selectedIndex + 1}`}
          className="w-full h-full object-contain transition-all duration-300"
          onError={(e) => {
            e.currentTarget.src = 'https://placehold.co/640x360/1B1713/F2EDE6?text=Rasm+yuklanmadi';
          }}
        />

        {/* Hover Overlay with Zoom & Open Original */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setFullscreenImage(activeImage)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-black/70 border border-white/20 text-xs font-medium text-white hover:bg-[var(--accent)] hover:border-[var(--accent)] transition-all cursor-pointer"
          >
            <Maximize2 size={13} />
            To'liq ko'rish
          </button>
          <a
            href={activeImage}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-black/70 border border-white/20 text-xs font-medium text-white hover:bg-white/20 transition-all text-decoration-none"
          >
            <ExternalLink size={13} />
            Original havola
          </a>
        </div>
      </div>

      {/* Thumbnails Strip / Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 pt-2">
        {screenshots.map((url, index) => {
          const isSelected = index === selectedIndex;
          return (
            <button
              key={`${url}-${index}`}
              type="button"
              onClick={() => setSelectedIndex(index)}
              className={`group relative aspect-video overflow-hidden rounded-xl border transition-all cursor-pointer ${
                isSelected
                  ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]/40 scale-[1.03] z-10'
                  : 'border-[var(--border)] bg-[#14110E] hover:border-white/30 opacity-70 hover:opacity-100'
              }`}
            >
              <img
                src={url}
                alt={`Thumb ${index + 1}`}
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                onError={(e) => {
                  e.currentTarget.parentElement?.remove();
                }}
              />
              {isSelected && (
                <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[var(--accent)] shadow" />
              )}
            </button>
          );
        })}
      </div>

      {/* Fullscreen Lightbox Modal */}
      {fullscreenImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setFullscreenImage(null)}
        >
          <div className="relative max-w-5xl max-h-[90vh] flex flex-col items-center">
            <img
              src={fullscreenImage}
              alt="Fullscreen Preview"
              className="max-w-full max-h-[85vh] object-contain rounded-2xl border border-white/10 shadow-2xl"
            />
            <div className="mt-4 flex items-center gap-4">
              <a
                href={fullscreenImage}
                download
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-all text-decoration-none shadow"
              >
                <Download size={14} />
                Yuklab olish
              </a>
              <button
                type="button"
                onClick={() => setFullscreenImage(null)}
                className="px-4 py-2 rounded-xl bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition-all"
              >
                Yopish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
