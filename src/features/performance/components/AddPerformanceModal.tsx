import { useState } from 'react';
import type { Performance } from '@/types';
import { useCreatePerformance } from '@/features/performance/hooks/usePerformanceQueries';
import { Button, ImageUpload, Input, Modal, Textarea } from '@/shared/ui';

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
  const [form, setForm] = useState<FormState>(EMPTY);
  const createPerformance = useCreatePerformance();

  function set<K extends keyof FormState>(key: K, value: string) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.full_name.trim() || !form.image_url.trim()) return;

    try {
      const created = await createPerformance.mutateAsync({
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
    } catch {
      // The mutation reports the user-facing error through the global toast.
    }
  }

  function handleClose() {
    if (createPerformance.isPending) return;
    setForm(EMPTY);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="New performance"
      subtitle="Create"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={createPerformance.isPending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={createPerformance.isPending}
            onClick={(e) => handleSubmit(e as unknown as React.FormEvent)}
          >
            Save
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <Input
          id="add-full-name"
          label="Full name *"
          value={form.full_name}
          onChange={(e) => set('full_name', e.target.value)}
          placeholder="For example: John Doe"
          required
          autoFocus
        />

        <Input
          id="add-profession"
          label="Profession / role"
          value={form.profession}
          onChange={(e) => set('profession', e.target.value)}
          placeholder="For example: actor, director"
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Input
            id="add-nationality"
            label="Nationality / citizenship"
            value={form.nationality}
            onChange={(e) => set('nationality', e.target.value)}
            placeholder="Uzbek"
          />
          <Input
            id="add-birth-date"
            label="Date of birth"
            type="date"
            value={form.birth_date}
            onChange={(e) => set('birth_date', e.target.value)}
          />
        </div>

        <ImageUpload
          label="Primary image *"
          value={form.image_url}
          onChange={(url) => set('image_url', url)}
          placeholder="Image URL or choose a file"
        />

        <ImageUpload
          label="Thumbnail (optional)"
          value={form.thumbnail_url}
          onChange={(url) => set('thumbnail_url', url)}
          placeholder="Thumbnail URL or choose a file"
        />

        <Textarea
          id="add-bio"
          label="Bio / description (optional)"
          value={form.bio}
          onChange={(e) => set('bio', e.target.value)}
          placeholder="A short description of this performance…"
          rows={3}
        />

        {/* Hidden submit preserves Enter-key submission. */}
        <button type="submit" style={{ display: 'none' }} />
      </form>
    </Modal>
  );
}
