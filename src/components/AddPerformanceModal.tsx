import { useState } from 'react';
import { performanceService } from '@/services/performance.service';
import type { Performance } from '@/types';
import { Button, ImageUpload, Input, Modal, Textarea } from '@/components/ui';

interface AddPerformanceModalProps {
  open: boolean;
  onClose: () => void;
  /** Called with the newly-created item for optimistic UI update */
  onCreated?: (item: Performance) => void;
}

interface FormState {
  full_name:    string;
  image_url:    string;
  thumbnail_url: string;
  bio:          string;
  birth_date:   string;
  nationality:  string;
  profession:   string;
}

const EMPTY: FormState = {
  full_name: '',
  image_url: '',
  thumbnail_url: '',
  bio: '',
  birth_date: '',
  nationality: '',
  profession: '',
};

export default function AddPerformanceModal({ open, onClose, onCreated }: AddPerformanceModalProps) {
  const [form, setForm]       = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  function set<K extends keyof FormState>(key: K, value: string) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.full_name.trim() || !form.image_url.trim()) return;

    setLoading(true);
    setError(null);

    try {
      // Step 1: create via backend (image_url is already an ImgBB URL at this point)
      const created = await performanceService.add({
        full_name:    form.full_name.trim(),
        image_url:    form.image_url.trim(),
        thumbnail_url: form.thumbnail_url.trim() || undefined,
        bio:          form.bio.trim() || undefined,
        birth_date:   form.birth_date.trim() || undefined,
        nationality:  form.nationality.trim() || undefined,
        profession:   form.profession.trim() || undefined,
      });

      onCreated?.(created);
      setForm(EMPTY);
      onClose();
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    if (loading) return;
    setForm(EMPTY);
    setError(null);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Yangi ishtirokchi"
      subtitle="Qo'shish"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={loading}>
            Bekor qilish
          </Button>
          <Button
            variant="primary"
            loading={loading}
            onClick={(e) => handleSubmit(e as unknown as React.FormEvent)}
          >
            Saqlash
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <Input
          id="add-full-name"
          label="To'liq ism *"
          value={form.full_name}
          onChange={(e) => set('full_name', e.target.value)}
          placeholder="Masalan: Jasur Toshmatov"
          required
          autoFocus
        />

        <Input
          id="add-profession"
          label="Kasb / Lavozim"
          value={form.profession}
          onChange={(e) => set('profession', e.target.value)}
          placeholder="Masalan: Aktyor, Rejissyor"
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Input
            id="add-nationality"
            label="Millati / Fuqaroligi"
            value={form.nationality}
            onChange={(e) => set('nationality', e.target.value)}
            placeholder="O'zbek"
          />
          <Input
            id="add-birth-date"
            label="Tug'ilgan sana"
            type="date"
            value={form.birth_date}
            onChange={(e) => set('birth_date', e.target.value)}
          />
        </div>

        {/* ImageUpload: avval ImgBB ga yuklaydi, so'ng URL ni set qiladi */}
        <ImageUpload
          label="Asosiy rasm *"
          value={form.image_url}
          onChange={(url) => set('image_url', url)}
          placeholder="Rasm URL yoki faylni tanlang"
        />

        <ImageUpload
          label="Thumbnail (ixtiyoriy)"
          value={form.thumbnail_url}
          onChange={(url) => set('thumbnail_url', url)}
          placeholder="Kichik rasm URL yoki faylni tanlang"
        />

        <Textarea
          id="add-bio"
          label="Bio / Tavsif (ixtiyoriy)"
          value={form.bio}
          onChange={(e) => set('bio', e.target.value)}
          placeholder="Ishtirokchi haqida qisqacha ma'lumot…"
          rows={3}
        />

        {error && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              background: 'rgba(220,80,80,0.08)',
              border: '1px solid rgba(220,80,80,0.25)',
              fontSize: 13,
              color: '#F2A8A8',
            }}
          >
            {error}
          </div>
        )}

        {/* Hidden submit — lets Enter key work */}
        <button type="submit" style={{ display: 'none' }} />
      </form>
    </Modal>
  );
}