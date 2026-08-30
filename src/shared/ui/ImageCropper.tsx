import { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, ZoomIn, ZoomOut, RotateCcw, Check, X } from 'lucide-react';

interface ImageCropperProps {
  aspectRatio: number; // 1 = square logo, 16/5 = landscape thumbnail
  label: string;
  currentUrl?: string;
  onCropped: (blob: Blob, dataUrl: string) => void;
  onCancel?: () => void;
  maxSizeMb?: number;
}

// Device pixel ratio for sharp rendering
const DPR = window.devicePixelRatio || 1;

export default function ImageCropper({
  aspectRatio,
  label,
  currentUrl,
  onCropped,
  maxSizeMb = 10,
}: ImageCropperProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isMouseDragging, setIsMouseDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [error, setError] = useState<string | null>(null);

  // Measured container width (responsive)
  const [containerW, setContainerW] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Preview dimensions: always fill container width
  const previewW = containerW;
  const previewH = containerW > 0 ? Math.round(containerW / aspectRatio) : 0;

  // High-res canvas dimensions (for sharp output)
  const canvasW = previewW * DPR;
  const canvasH = previewH * DPR;

  // Measure wrapper width via ResizeObserver
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      if (w > 0) setContainerW(Math.floor(w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Draw the image onto the canvas
  const drawImage = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img || canvasW === 0 || canvasH === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvasW, canvasH);

    // Scale image to fill canvas at zoom=1, then apply user zoom
    const scaleToFit = Math.max(canvasW / img.naturalWidth, canvasH / img.naturalHeight);
    const scale = scaleToFit * zoom;

    const scaledW = img.naturalWidth * scale;
    const scaledH = img.naturalHeight * scale;

    const drawX = (canvasW - scaledW) / 2 + offset.x * DPR;
    const drawY = (canvasH - scaledH) / 2 + offset.y * DPR;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, drawX, drawY, scaledW, scaledH);
  }, [zoom, offset, canvasW, canvasH]);

  useEffect(() => {
    drawImage();
  }, [drawImage]);

  const loadFile = (file: File) => {
    setError(null);
    if (!file.type.startsWith('image/')) {
      setError('Faqat rasm fayllari qabul qilinadi');
      return;
    }
    if (file.size > maxSizeMb * 1024 * 1024) {
      setError(`Fayl hajmi ${maxSizeMb} MB dan oshmasligi kerak`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        imageRef.current = img;
        setImageSrc(src);
        setZoom(1);
        setOffset({ x: 0, y: 0 });
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
    // reset so same file can be selected again
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) loadFile(file);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsMouseDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDragging) return;
    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => setIsMouseDragging(false);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.min(5, Math.max(0.2, z - e.deltaY * 0.002)));
  };

  // Export: use a separate high-res offscreen canvas for output
  const handleCrop = () => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    // Output at 2x resolution of the preview for crisp quality
    const OUT_W = previewW * 2;
    const OUT_H = previewH * 2;

    const out = document.createElement('canvas');
    out.width = OUT_W;
    out.height = OUT_H;
    const ctx = out.getContext('2d')!;

    const scaleToFit = Math.max((OUT_W) / img.naturalWidth, (OUT_H) / img.naturalHeight);
    const scale = scaleToFit * zoom;
    const scaledW = img.naturalWidth * scale;
    const scaledH = img.naturalHeight * scale;
    const drawX = (OUT_W - scaledW) / 2 + offset.x * 2;
    const drawY = (OUT_H - scaledH) / 2 + offset.y * 2;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, drawX, drawY, scaledW, scaledH);

    out.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        onCropped(blob, url);
        setImageSrc(null);
        imageRef.current = null;
        setZoom(1);
        setOffset({ x: 0, y: 0 });
      },
      'image/webp',
      0.95
    );
  };

  const reset = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  return (
    // wrapperRef measures available width — MUST be w-full
    <div ref={wrapperRef} className="w-full space-y-3">
      {containerW === 0 ? null : !imageSrc ? (
        /* ── Drop Zone ─────────────────────────────────── */
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="relative group cursor-pointer flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed transition-all duration-300 overflow-hidden"
          style={{
            width: '100%',
            height: previewH,
            borderColor: isDragging ? '#D97757' : 'rgba(242,237,230,0.12)',
            background: isDragging ? 'rgba(217,119,87,0.05)' : 'rgba(255,255,255,0.02)',
          }}
        >
          {currentUrl ? (
            <>
              <img
                src={currentUrl}
                alt="current"
                className="absolute inset-0 w-full h-full object-cover"
                style={{ opacity: 0.5 }}
              />
              <div className="relative z-10 flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-black/40 backdrop-blur flex items-center justify-center">
                  <Upload size={16} className="text-white/80" />
                </div>
                <p className="text-xs text-white/70 text-center font-medium bg-black/30 px-3 py-1 rounded-lg backdrop-blur">
                  Click to load a new one
                </p>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                <Upload size={20} className="text-white/40 group-hover:text-white/70 transition-colors" />
              </div>
              <p className="text-xs text-white/40 text-center px-4 leading-relaxed">
                {label}
                <br />
                <span className="text-white/25">yoki shu yerga tashlang</span>
              </p>
            </div>
          )}
        </div>
      ) : (
        /* ── Crop Canvas ────────────────────────────────── */
        <div className="space-y-2">
          {/* Canvas viewport — overflow:hidden acts as crop window */}
          <div
            className="relative rounded-xl overflow-hidden border border-white/10"
            style={{
              width: '100%',
              height: previewH,
              cursor: isMouseDragging ? 'grabbing' : 'grab',
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
          >
            {/*
              CSS display size = previewW × previewH
              Canvas internal = canvasW × canvasH  (DPR-scaled → sharp)
            */}
            <canvas
              ref={canvasRef}
              width={canvasW}
              height={canvasH}
              style={{ display: 'block', width: previewW, height: previewH }}
            />
            {/* Guide overlay */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-0 border-2 border-white/25 rounded-xl" />
              {/* Rule of thirds */}
              <div className="absolute top-1/3 left-0 right-0 h-px bg-white/[0.07]" />
              <div className="absolute top-2/3 left-0 right-0 h-px bg-white/[0.07]" />
              <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/[0.07]" />
              <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/[0.07]" />
            </div>
          </div>

          {/* Zoom slider */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setZoom((z) => Math.max(0.2, z - 0.1))}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-white/50 hover:text-white flex-shrink-0"
            >
              <ZoomOut size={13} />
            </button>
            <input
              type="range"
              min={0.2}
              max={5}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="flex-1 accent-[#D97757] h-1"
            />
            <button
              onClick={() => setZoom((z) => Math.min(5, z + 0.1))}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-white/50 hover:text-white flex-shrink-0"
            >
              <ZoomIn size={13} />
            </button>
            <button
              onClick={reset}
              title="Reset"
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-white/50 hover:text-white flex-shrink-0"
            >
              <RotateCcw size={13} />
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                setImageSrc(null);
                imageRef.current = null;
              }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
            >
              <X size={13} /> Bekor qilish
            </button>
            <button
              onClick={handleCrop}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium bg-[#D97757] hover:bg-[#c96a48] text-white transition-colors"
            >
              <Check size={13} /> Tasdiqlash
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
