import { useEffect, useRef, useMemo } from 'react';
import { Download } from 'lucide-react';
import lightGallery from 'lightgallery';
import 'lightgallery/css/lightgallery.css';
import 'lightgallery/css/lg-zoom.css';
import 'lightgallery/css/lg-thumbnail.css';
import lgThumbnail from 'lightgallery/plugins/thumbnail';
import lgZoom from 'lightgallery/plugins/zoom';

interface VideoGalleryProps {
  defaultThumbUrl: string;
}

export default function VideoGallery({ defaultThumbUrl }: VideoGalleryProps) {
  const galleryRef = useRef<HTMLDivElement>(null);

  // Generate 20 snapshots from Eporner default thumb pattern
  const snapshots = useMemo(() => {
    if (!defaultThumbUrl) return [];
    // E.g. https://static-xx.eporner.com/thumbs/202102/12/12345/1.jpg
    const match = defaultThumbUrl.match(/^(.*\/)(\d+)(_[^/]+|\.[a-zA-Z]+)$/);
    if (!match) return [];
    const [, base, , suffix] = match;
    // Generated snapshot locations: base/snapshots/1.jpg etc.
    return Array.from({ length: 20 }, (_, i) => `${base}snapshots/${i + 1}${suffix}`);
  }, [defaultThumbUrl]);

  useEffect(() => {
    let lgInstance: any = null;
    if (galleryRef.current && snapshots.length > 0) {
      lgInstance = lightGallery(galleryRef.current, {
        plugins: [lgThumbnail, lgZoom],
        speed: 400,
        mobileSettings: {
          controls: true,
          showCloseIcon: true,
          download: true,
        },
      });
    }

    return () => {
      if (lgInstance) {
        lgInstance.destroy();
      }
    };
  }, [snapshots]);

  if (snapshots.length === 0) return null;

  return (
    <div className="space-y-4">
      <h2 className="font-serif text-xl font-medium text-[var(--text-primary)]">
        Screenshots galereyasi
      </h2>

      {/* Grid wrapper for lightGallery */}
      <div
        ref={galleryRef}
        className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
      >
        {snapshots.map((url, i) => (
          <a
            key={i}
            href={url}
            data-src={url}
            className="group relative block aspect-video overflow-hidden rounded-xl border border-[var(--border)] bg-[#1B1713] transition-all hover:border-[var(--accent-border)]"
          >
            <img
              src={url}
              alt={`Screenshot ${i + 1}`}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              onError={(e) => {
                // If 20 snapshots aren't available, hide the broken images
                e.currentTarget.parentElement?.remove();
              }}
            />
            {/* Download overlay on hover */}
            <div className="absolute inset-0 bg-black/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100 flex items-center justify-center">
              <span className="flex items-center gap-1.5 rounded-lg bg-black/60 px-3 py-1.5 text-xs text-white">
                <Download size={12} /> Yuklash
              </span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
