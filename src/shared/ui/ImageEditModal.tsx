import { useEffect, useState } from 'react';
import { Check, Loader2, RotateCcw, Upload } from 'lucide-react';
import Modal from './Modal';
import ImageCropper from './ImageCropper';
import type { UploadState } from '@/types';

interface ImageEditModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  label: string;
  aspectRatio: number;
  currentUrl?: string;
  onSave: (blob: Blob, previewUrl: string, onProgress: (state: UploadState) => void) => Promise<void> | void;
}

export default function ImageEditModal({
  open,
  onClose,
  title,
  subtitle = 'Image editor',
  label,
  aspectRatio,
  currentUrl,
  onSave,
}: ImageEditModalProps) {
  const [draft, setDraft] = useState<{ blob: Blob; previewUrl: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setDraft(null);
      setSaveError(null);
      setSaving(false);
      setProgress(0);
    }
  }, [open]);

  const handleClose = () => {
    if (saving) return;
    onClose();
  };

  const handleSave = async () => {
    if (!draft || saving) return;
    setSaveError(null);
    setSaving(true);
    try {
      await onSave(draft.blob, draft.previewUrl, (state) => setProgress(state.progress));
      onClose();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Unable to save the image');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={title}
      subtitle={subtitle}
      maxWidth="max-w-[700px]"
      footer={draft ? (
        <div className="flex w-full items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setDraft(null)}
            disabled={saving}
            className="btn btn-ghost flex items-center gap-2"
          >
            <RotateCcw size={14} /> Edit crop
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="btn btn-primary flex items-center gap-2 disabled:opacity-60"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            {saving ? `Uploading… ${progress}%` : 'Save and upload'}
          </button>
        </div>
      ) : undefined}
    >
      {draft ? (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
            <img
              src={draft.previewUrl}
              alt="Crop preview"
              className="block max-h-[390px] w-full object-contain"
            />
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-3 py-2 text-xs text-emerald-200/80">
            <Check size={14} /> Crop is ready. Review the preview before saving.
          </div>
          {saving && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] text-white/45"><span>Uploading securely</span><span>{progress}%</span></div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#D97757] transition-all" style={{ width: `${progress}%` }} /></div>
            </div>
          )}
          {saveError && <p className="text-xs text-red-300">{saveError}</p>}
        </div>
      ) : (
        <div className="space-y-3">
          <ImageCropper
            aspectRatio={aspectRatio}
            label={label}
            currentUrl={currentUrl}
            onCropped={(blob, previewUrl) => setDraft({ blob, previewUrl })}
            onCancel={handleClose}
            maxSizeMb={10}
          />
          <div className="flex items-center gap-2 text-[11px] text-white/40">
            <Upload size={13} /> JPEG, PNG, or WEBP · max 10 MB · the crop stays inside the image
          </div>
        </div>
      )}
    </Modal>
  );
}
