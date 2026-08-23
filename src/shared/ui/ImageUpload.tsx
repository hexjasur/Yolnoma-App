import { useCallback, useRef, useState } from 'react';
import { ImagePlus, X, Loader2, Upload, RefreshCw, Trash2 } from 'lucide-react';
import { uploadImage, validateImageFile } from '@/shared/api/imageUploadApi';
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
 * Enhanced Image upload field:
 *  1. User can type / paste a URL directly
 *  2. Upload a local file — it gets uploaded to ImgBB and the URL is set automatically
 *  3. Seamlessly REPLACE an existing image by clicking "Almashtirish" or dropping a new file
 *  4. Drag & drop is supported both in empty state and over the existing preview
 */
export default function ImageUpload({
  label,
  value = '',
  onChange,
  placeholder = 'https:// or select a file',
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
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const isUploading = upload.phase === 'uploading' || upload.phase === 'reading';

  return (
    <div style={{ position: 'relative' }}>
      {label && <p className="form-label">{label}</p>}

      {/* Hidden File Input (Always in DOM) */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={onFileChange}
        style={{ display: 'none' }}
      />

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

        {/* Upload / Replace button */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={isUploading}
          className="btn btn-ghost"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '0 12px',
            fontSize: 12,
            borderColor: 'var(--border)',
            color: 'var(--accent)',
            whiteSpace: 'nowrap',
          }}
          title={value ? "Upload another image (ImgBB)" : "Upload file (ImgBB)"}
        >
          {isUploading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Upload size={14} strokeWidth={2} />
          )}
          <span>{value ? 'Replace' : 'Download'}</span>
        </button>

        {/* Clear button */}
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="btn btn-ghost btn-icon"
            style={{ color: 'rgba(242,237,230,0.6)' }}
            aria-label="Tozalash"
            title="O'chirish"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Uploading progress banner */}
      {isUploading && (
        <div
          style={{
            padding: '16px',
            borderRadius: 12,
            background: 'rgba(217,119,87,0.08)',
            border: '1px solid rgba(217,119,87,0.3)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
            marginBottom: 10,
          }}
        >
          <Loader2 size={22} strokeWidth={1.5} className="animate-spin" style={{ color: 'var(--accent)' }} />
          <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: 0 }}>
            {upload.phase === 'reading' ? 'Reading file…' : `Uploading to ImgBB — ${upload.progress}%`}
          </p>
          <div style={{ width: '80%', height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 99, overflow: 'hidden' }}>
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
      )}

      {/* Drop zone (when no image is set) */}
      {!value && !isUploading && (
        <div
          className={`upload-zone ${isDragging ? 'dragover' : ''}`}
          onClick={() => fileRef.current?.click()}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          role="button"
          aria-label="Rasm yuklash"
          style={{
            padding: '24px 16px',
            textAlign: 'center',
            borderRadius: 12,
            border: isDragging ? '2px dashed var(--accent)' : '1px dashed var(--border)',
            background: isDragging ? 'rgba(217,119,87,0.1)' : 'rgba(255,255,255,0.02)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <ImagePlus size={26} strokeWidth={1.5} style={{ color: 'var(--accent)', margin: '0 auto 10px' }} />
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
            Drop a file or <span style={{ color: 'var(--accent)', fontWeight: 600 }}>select</span>
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4 }}>PNG, JPG, WEBP — max 32 MB</p>
        </div>
      )}

      {/* Preview Card with Hover Replace Actions (when image is present) */}
      {value && !isUploading && (
        <div
          className="group relative overflow-hidden rounded-xl border border-[var(--border)] bg-[#0F0D0B]"
          style={{
            position: 'relative',
            borderRadius: 12,
            overflow: 'hidden',
            border: isDragging ? '2px dashed var(--accent)' : '1px solid var(--border)',
          }}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <img
            src={value}
            alt="Preview"
            style={{ width: '100%', maxHeight: 200, objectFit: 'cover', display: 'block' }}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />

          {/* Overlay on hover / drag */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: isDragging ? 'rgba(20,17,14,0.85)' : 'rgba(20,17,14,0.65)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              opacity: isDragging ? 1 : 0,
              transition: 'opacity 0.2s ease',
            }}
            className="hover:!opacity-100"
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fileRef.current?.click();
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 8,
                background: 'var(--accent)',
                color: '#fff',
                fontSize: 12,
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              }}
            >
              <RefreshCw size={13} strokeWidth={2} />
              Image replace
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 12px',
                borderRadius: 8,
                background: 'rgba(220,80,80,0.85)',
                color: '#fff',
                fontSize: 12,
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              }}
            >
              <Trash2 size={13} strokeWidth={2} />
              Remove
            </button>
          </div>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <p style={{ fontSize: 12, color: '#F2A8A8', marginTop: 6, marginBottom: 0 }}>{error}</p>
      )}
    </div>
  );
}
