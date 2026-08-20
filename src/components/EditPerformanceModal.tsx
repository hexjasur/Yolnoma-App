import { useEffect, useState } from 'react';
import { performanceService } from '@/services/performance.service';
import type { Performance, PerformanceUpdateInput } from '@/types';
import { Button, ImageUpload, Input, Modal, Textarea } from '@/components/ui';

interface EditPerformanceModalProps {
  open: boolean;
  item: Performance | null;
  onClose: () => void;
  onUpdated?: (item: Performance) => void;
}

export default function EditPerformanceModal({
  open,
  item,
  onClose,
  onUpdated,
}: EditPerformanceModalProps) {
  const [form, setForm]       = useState<PerformanceUpdateInput>({});
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // Pre-fill form whenever the target item changes
  useEffect(() => {
    if (item) {
      setForm({
        full_name:    item.full_name,
        image_url:    item.image_url,
        thumbnail_url: item.thumbnail_url ?? '',
        bio:          item.bio ?? item.description ?? '',
        birth_date:   item.birth_date ?? '',
        nationality:  item.nationality ?? '',
        profession:   item.profession ?? '',
      });
    }
  }, [item]);

  function set<K extends keyof PerformanceUpdateInput>(key: K, value: string) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!item) return;

    setLoading(true);
    setError(null);

    try {
      const payload: PerformanceUpdateInput = {};
      if (form.full_name?.trim())    payload.full_name    = form.full_name.trim();
      if (form.image_url?.trim())    payload.image_url    = form.image_url.trim();
      if (form.thumbnail_url !== undefined) payload.thumbnail_url = form.thumbnail_url?.trim() || undefined;
      if (form.bio !== undefined)    payload.bio          = form.bio?.trim() || undefined;
      if (form.birth_date !== undefined)    payload.birth_date   = form.birth_date?.trim() || undefined;
      if (form.nationality !== undefined)   payload.nationality  = form.nationality?.trim() || undefined;
      if (form.profession !== undefined)    payload.profession   = form.profession?.trim() || undefined;

      const updated = await performanceService.update(item.id, payload);
      onUpdated?.(updated);
      onClose();
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    if (loading) return;
    setError(null);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={item?.full_name ?? 'Tahrirlash'}
      subtitle="Tahrirlash"
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
          id="edit-full-name"
          label="To'liq ism"
          value={form.full_name ?? ''}
          onChange={(e) => set('full_name', e.target.value)}
          required
        />

        <Input
          id="edit-profession"
          label="Kasb / Lavozim"
          value={form.profession ?? ''}
          onChange={(e) => set('profession', e.target.value)}
          placeholder="Masalan: Aktyor, Rejissyor"
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Input
            id="edit-nationality"
            label="Millati / Fuqaroligi"
            value={form.nationality ?? ''}
            onChange={(e) => set('nationality', e.target.value)}
          />
          <Input
            id="edit-birth-date"
            label="Tug'ilgan sana"
            type="date"
            value={form.birth_date ?? ''}
            onChange={(e) => set('birth_date', e.target.value)}
          />
        </div>

        {/* ImageUpload: avval ImgBB ga yuklaydi, so'ng URL ni set qiladi */}
        <ImageUpload
          label="Asosiy rasm"
          value={form.image_url ?? ''}
          onChange={(url) => set('image_url', url)}
        />

        <ImageUpload
          label="Thumbnail"
          value={form.thumbnail_url ?? ''}
          onChange={(url) => set('thumbnail_url', url)}
        />

        <Textarea
          id="edit-bio"
          label="Bio / Tavsif"
          value={form.bio ?? ''}
          onChange={(e) => set('bio', e.target.value)}
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

        <button type="submit" style={{ display: 'none' }} />
      </form>
    </Modal>
  );
}
