import { useEffect, useState, useRef } from 'react';
import type { EpornerThumb } from '@/features/videos/types/video';

interface HoverPreviewProps {
  defaultThumbUrl: string;
  thumbs?: EpornerThumb[];
  isHovered: boolean;
  className?: string;
}

export default function HoverPreview({ defaultThumbUrl, thumbs, isHovered, className }: HoverPreviewProps) {
  const [frames, setFrames] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const intervalRef = useRef<number | null>(null);

  // Generate or load frame URLs based on Eporner response
  useEffect(() => {
    if (thumbs && thumbs.length > 0) {
      const apiFrames = thumbs.map((t) => t.src);
      setFrames(apiFrames);
      
      // Preload
      apiFrames.forEach((src) => {
        const img = new Image();
        img.src = src;
      });
      return;
    }

    if (!defaultThumbUrl) return;

    // Matches Eporner pattern like: .../1.jpg or .../1_360px.jpg or .../1_big.jpg
    const match = defaultThumbUrl.match(/^(.*\/)(\d+)(_[^/]+|\.[a-zA-Z]+)$/);
    if (match) {
      const [, base, , suffix] = match;
      const generatedFrames = Array.from({ length: 8 }, (_, i) => `${base}${i + 1}${suffix}`);
      setFrames(generatedFrames);

      // Preload images to ensure 60 FPS silliq animatsiya
      generatedFrames.forEach((src) => {
        const img = new Image();
        img.src = src;
      });
    } else {
      setFrames([defaultThumbUrl]);
    }
  }, [defaultThumbUrl, thumbs]);

  // Handle animation loop on hover
  useEffect(() => {
    if (isHovered && frames.length > 1) {
      // Loop through frames
      intervalRef.current = window.setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % frames.length);
      }, 300); // 300ms intervals feels fluid and not too fast
    } else {
      // Reset to first frame when hover ends
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setCurrentIndex(0);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isHovered, frames]);

  if (frames.length === 0) {
    return <div className={`skeleton ${className}`} />;
  }

  return (
    <img
      src={frames[currentIndex]}
      alt="Preview"
      loading="lazy"
      className={className}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        display: 'block',
      }}
      onError={(e) => {
        // Fallback to default if frame fails to load
        if (currentIndex !== 0) {
          e.currentTarget.src = defaultThumbUrl;
        }
      }}
    />
  );
}
