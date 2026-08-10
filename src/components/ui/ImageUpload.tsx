import { useCallback, useRef, useState } from 'react';
import { ImagePlus, X, Loader2 } from 'lucide-react';
import { uploadImage, validateImageFile } from '@/services/imgbb.service';
import type { UploadState } from '@/types';

interface ImageUploadProps {
  label?: string;
  /** Current URL value (controlled) */
  value?: string;
  /** Called with the final hosted URL once upload completes */
  onChange: (url: string) => void;
  placeholder?: string;
}

const INITIAL_STATE: UploadState = { phase: 'idle', progress: 0 };

/**
 * Image upload field:
 *  1. User can type / paste a URL directly
 *  2. OR pick a local file — it gets uploaded to ImgBB and the URL is set automatically
 *  3. Drag & drop is also supported
 */
export default function ImageUpload({
  label,
  value = '',
  onChange,
  placeholder = 'https:// yoki fayl tanlang',
}: ImageUploadProps) {
  const [upload, setUpload] = useState<UploadState>(INITIAL_STATE);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef  = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    const err = validateImageFile(file);
    if (err) { setError(err); return; }

    try {
      const url = await uploadImage(file, setUpload);
      onChange(url);
    } catch (e) {
      setError(String(e));
    } finally {
      setUpload({ phase: 'idle', progress: 0 });
    }
  }, [onChange]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const isUploading = upload.phase === 'uploading' || upload.phase === 'reading';

  return (
    <div>
      {label && <p className="form-label">{label}</p>}

      {/* URL input row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="form-input"
          style={{ flex: 1 }}
          disabled={isUploading}
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="btn btn-ghost btn-icon"
            aria-label="Tozalash"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Drop zone */}
      {!value && (
        <div
          className={`upload-zone ${isDragging ? 'dragover' : ''}`}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          role="button"
          aria-label="Rasm yuklash"
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={onFileChange}
            style={{ display: 'none' }}
          />

          {isUploading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <Loader2 size={22} strokeWidth={1.5} className="animate-spin-slow" style={{ color: 'var(--accent)' }} />
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {upload.phase === 'reading' ? 'O\'qilmoqda…' : `Yuklanmoqda — ${upload.progress}%`}
              </p>
              {/* Progress bar */}
              <div style={{ width: '80%', height: 3, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    background: 'var(--accent)',
                    width: `${upload.progress}%`,
                    transition: 'width 0.2s ease',
                    borderRadius: 99,
                  }}
                />
              </div>
            </div>
          ) : (
            <>
              <ImagePlus size={24} strokeWidth={1.5} style={{ color: 'var(--accent)', margin: '0 auto 10px' }} />
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
                Fayl tashlang yoki <span style={{ color: 'var(--accent)' }}>tanlang</span>
              </p>
              <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4 }}>PNG, JPG, WEBP — max 32 MB</p>
            </>
          )}
        </div>
      )}

      {/* Preview */}
      {value && (
        <div style={{ position: 'relative', marginTop: 10, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}>
          <img
            src={value}
            alt="Preview"
            style={{ width: '100%', maxHeight: 180, objectFit: 'cover', display: 'block' }}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        </div>
      )}

      {/* Error */}
      {error && (
        <p style={{ fontSize: 12, color: '#F2A8A8', marginTop: 6 }}>{error}</p>
      )}
    </div>
  );
}
