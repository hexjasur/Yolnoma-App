import { useRef, useState } from 'react';
import { Upload, Download, Wand2, Loader2, ImageOff, X } from 'lucide-react';
import { toast } from '@/shared/ui/Toast';

export default function RemoveBackground() {
  const [image, setImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [bgRemove, setBgRemove] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  function selectFile(file: File | undefined | null) {
    if (!file) return;
    setImage(file);
    setPreviewUrl(URL.createObjectURL(file));
    setBgRemove(null);
    setError(null);
  }

  function reset() {
    setImage(null);
    setPreviewUrl(null);
    setBgRemove(null);
    setError(null);
  }

  async function handleRemoveBackground() {
    if (!image) return;

    const apiKey = import.meta.env.VITE_REMOVE_BG_API_KEY as string;
    const apiUrl = 'https://api.remove.bg/v1.0/removebg';

    const formData = new FormData();
    formData.append('image_file', image, image.name);
    formData.append('size', 'auto');

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'X-Api-Key': apiKey },
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Request failed: (${res.status})`);
      }

      const data = await res.blob();
      const imageUrl = URL.createObjectURL(data);
      setBgRemove(imageUrl);
    } catch (err) {
      console.error(err);
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '85vh',
        background:
          'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(217,119,87,0.10), transparent), #14110E',
      }}
      className="text-[#F2EDE6] flex items-center justify-center p-8"
    >
      <div className="w-full max-w-3xl">
        <div className="mb-10 text-center">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[#D97757] font-semibold mb-3">
            Tool
          </p>
          <h1 className="font-serif text-4xl font-medium tracking-tight">
            Background remover
          </h1>
          <p className="mt-2 text-white/45 text-sm">
            Upload an image — the background will be removed automatically
          </p>
        </div>

        {/* Upload zone */}
        {!previewUrl && (
          <label
            htmlFor="userImg"
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              selectFile(e.dataTransfer.files?.[0]);
            }}
            className={`flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed
                       px-8 py-16 text-center cursor-pointer transition-colors duration-150
                       ${
                         dragOver
                           ? 'border-[#D97757]/60 bg-[#D97757]/[0.06]'
                           : 'border-white/15 hover:border-white/25 bg-white/[0.02]'
                       }`}
          >
            <div className="h-12 w-12 rounded-full bg-white/[0.05] flex items-center justify-center">
              <Upload size={20} strokeWidth={1.75} className="text-white/50" />
            </div>
            <p className="text-sm text-[#F2EDE6] font-medium">
              Select a file or drop it here
            </p>
            <p className="text-xs text-white/35">PNG, JPG — maximum 12 MB</p>
            <input
              ref={fileInputRef}
              type="file"
              id="userImg"
              accept="image/*"
              className="hidden"
              onChange={(e) => selectFile(e.target.files?.[0])}
            />
          </label>
        )}

        {/* Preview comparison */}
        {previewUrl && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-white/45">
                {image?.name}
              </p>
              <button
                onClick={reset}
                className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-[#F2EDE6] transition-colors"
              >
                <X size={13} strokeWidth={2} />
                Another picture
              </button>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <p className="text-[10px] uppercase tracking-[0.14em] text-white/35 mb-2">
                  Original
                </p>
                <div className="aspect-square rounded-2xl overflow-hidden border border-white/[0.08] bg-[#181410] flex items-center justify-center">
                  <img src={previewUrl} alt="Original" className="w-full h-full object-contain" />
                </div>
              </div>

              <div>
                <p className="text-[10px] uppercase tracking-[0.14em] text-white/35 mb-2">
                  Result
                </p>
                <div
                  className="aspect-square rounded-2xl overflow-hidden border border-white/[0.08] flex items-center justify-center relative"
                  style={{
                    backgroundImage:
                      'linear-gradient(45deg, #1B1713 25%, transparent 25%), linear-gradient(-45deg, #1B1713 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1B1713 75%), linear-gradient(-45deg, transparent 75%, #1B1713 75%)',
                    backgroundSize: '20px 20px',
                    backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
                    backgroundColor: '#100E0C',
                  }}
                >
                  {loading && (
                    <div className="flex flex-col items-center gap-2 text-white/50">
                      <Loader2 size={22} className="animate-spin text-[#D97757]" />
                      <p className="text-xs">Removing background…</p>
                    </div>
                  )}
                  {!loading && bgRemove && (
                    <img src={bgRemove} alt="Background removed" className="w-full h-full object-contain" />
                  )}
                  {!loading && !bgRemove && (
                    <div className="flex flex-col items-center gap-2 text-white/25">
                      <ImageOff size={22} strokeWidth={1.5} />
                      <p className="text-xs">There are no results yet</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {error && (
              <div className="mt-4 rounded-xl border border-red-500/25 bg-red-500/[0.06] px-4 py-3 text-sm text-red-300/80">
                {error}
              </div>
            )}

            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={handleRemoveBackground}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-lg bg-[#D97757] px-5 py-2.5 text-sm font-medium text-white
                           hover:bg-[#D97757]/90 disabled:opacity-50 disabled:cursor-default transition-colors"
              >
                {loading ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Wand2 size={15} strokeWidth={1.75} />
                )}
                {loading ? 'In progress…' : 'Remove background'}
              </button>

              {bgRemove && (
                <a href={bgRemove} download="background_removed_image.png">
                  <button
                    onClick={() => toast.success('Image saved to your Downloads folder')}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-5 py-2.5 text-sm
                               font-medium text-white/80 hover:text-[#F2EDE6] hover:border-[#D97757]/40
                               hover:bg-[#D97757]/[0.08] transition-colors"
                  >
                    <Download size={15} strokeWidth={1.75} />
                    Download
                  </button>
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}