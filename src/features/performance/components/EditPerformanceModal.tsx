import { useEffect, useState } from 'react';
import type { Performance, PerformanceUpdateInput } from '@/types';
import { useUpdatePerformance } from '@/features/performance/hooks/usePerformanceQueries';
import { Button, ImageUpload, Input, Modal, Textarea } from '@/shared/ui';

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
  const [form, setForm] = useState<PerformanceUpdateInput>({});
  const updatePerformance = useUpdatePerformance();

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

    try {
      const payload: PerformanceUpdateInput = {};
      if (form.full_name?.trim())    payload.full_name    = form.full_name.trim();
      if (form.image_url?.trim())    payload.image_url    = form.image_url.trim();
      if (form.thumbnail_url !== undefined) payload.thumbnail_url = form.thumbnail_url?.trim() || undefined;
      if (form.bio !== undefined)    payload.bio          = form.bio?.trim() || undefined;
      if (form.birth_date !== undefined)    payload.birth_date   = form.birth_date?.trim() || undefined;
      if (form.nationality !== undefined)   payload.nationality  = form.nationality?.trim() || undefined;
      if (form.profession !== undefined)    payload.profession   = form.profession?.trim() || undefined;

      const updated = await updatePerformance.mutateAsync({ id: item.id, data: payload });
      onUpdated?.(updated);
      onClose();
    } catch {
      // The mutation reports the user-facing error through the global toast.
    }
  }

  function handleClose() {
    if (updatePerformance.isPending) return;
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={item?.full_name ?? 'Edit performance'}
      subtitle="Edit"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={updatePerformance.isPending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={updatePerformance.isPending}
            onClick={(e) => handleSubmit(e as unknown as React.FormEvent)}
          >
            Save changes
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <Input
          id="edit-full-name"
          label="Full name"
          value={form.full_name ?? ''}
          onChange={(e) => set('full_name', e.target.value)}
          required
        />

        <Input
          id="edit-profession"
          label="Profession / role"
          value={form.profession ?? ''}
          onChange={(e) => set('profession', e.target.value)}
          placeholder="For example: actor, director"
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Input
            id="edit-nationality"
            label="Nationality / citizenship"
            value={form.nationality ?? ''}
            onChange={(e) => set('nationality', e.target.value)}
          />
          <Input
            id="edit-birth-date"
            label="Date of birth"
            type="date"
            value={form.birth_date ?? ''}
            onChange={(e) => set('birth_date', e.target.value)}
          />
        </div>

        <ImageUpload
          label="Primary image"
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
          label="Bio / description"
          value={form.bio ?? ''}
          onChange={(e) => set('bio', e.target.value)}
          rows={3}
        />

        <button type="submit" style={{ display: 'none' }} />
      </form>
    </Modal>
  );
}
