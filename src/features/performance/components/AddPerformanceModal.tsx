import { useEffect, useState } from 'react';
import type { AvPerformance, Performance } from '@/types';
import { useCreatePerformance } from '@/features/performance/hooks/usePerformanceQueries';
import { useCreateAvPerformance } from '@/features/performance/hooks/useAvPerformanceQueries';
import { Button, ImageUpload, Input, Modal, Textarea } from '@/shared/ui';

type CatalogType = 'performance' | 'av_performance';
type AddItem = Performance | AvPerformance;

interface AddPerformanceModalProps {
  open: boolean;
  onClose: () => void;
  defaultType?: CatalogType;
  onCreated?: (item: AddItem) => void;
}

interface FormState {
  full_name: string; title: string; code: string; performer_id: string;
  image_url: string; thumbnail_url: string; source_url: string; bio: string;
  birth_date: string; nationality: string; profession: string; description: string;
  release_date: string; country: string;
}

const EMPTY: FormState = {
  full_name: '', title: '', code: '', performer_id: '', image_url: '', thumbnail_url: '', source_url: '',
  bio: '', birth_date: '', nationality: '', profession: '', description: '', release_date: '', country: 'Japan',
};

export default function AddPerformanceModal({ open, onClose, defaultType = 'performance', onCreated }: AddPerformanceModalProps) {
  const [type, setType] = useState<CatalogType>(defaultType);
  const [form, setForm] = useState<FormState>(EMPTY);
  const createPerformance = useCreatePerformance();
  const createAvPerformance = useCreateAvPerformance();
  const isAv = type === 'av_performance';
  const isPending = createPerformance.isPending || createAvPerformance.isPending;

  useEffect(() => { if (open) setType(defaultType); }, [open, defaultType]);

  function set<K extends keyof FormState>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.image_url.trim()) return;
    try {
      if (isAv) {
        if (!form.title.trim() || !form.code.trim()) return;
        const created = await createAvPerformance.mutateAsync({
          performer_id: form.performer_id.trim() || null,
          title: form.title.trim(), code: form.code.trim(), image_url: form.image_url.trim(),
          thumbnail_url: form.thumbnail_url.trim() || undefined, source_url: form.source_url.trim() || undefined,
          description: form.description.trim() || undefined, release_date: form.release_date.trim() || undefined,
          duration_seconds: undefined, country: form.country.trim() || 'Japan',
        });
        onCreated?.(created);
      } else {
        if (!form.full_name.trim()) return;
        const created = await createPerformance.mutateAsync({
          full_name: form.full_name.trim(), image_url: form.image_url.trim(),
          thumbnail_url: form.thumbnail_url.trim() || undefined, bio: form.bio.trim() || undefined,
          birth_date: form.birth_date.trim() || undefined, nationality: form.nationality.trim() || undefined,
          profession: form.profession.trim() || undefined,
        });
        onCreated?.(created);
      }
      setForm(EMPTY);
      onClose();
    } catch {
      // The mutation reports the user-facing error through the global toast.
    }
  }

  function handleClose() {
    if (isPending) return;
    setForm(EMPTY);
    setType(defaultType);
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title={isAv ? 'New AV performance' : 'New performance'} subtitle="Create" maxWidth="max-w-[620px]" footer={(
      <><Button variant="ghost" onClick={handleClose} disabled={isPending}>Cancel</Button><Button variant="primary" loading={isPending} onClick={(event) => handleSubmit(event as unknown as React.FormEvent)}>Save</Button></>
    )}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <label htmlFor="add-catalog-type" className="form-label">Catalog type *</label>
          <select id="add-catalog-type" value={type} onChange={(event) => setType(event.target.value as CatalogType)} className="form-input">
            <option value="performance">Performance</option>
            <option value="av_performance">AV Performance</option>
          </select>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>Default follows the current page. You can change it before saving.</p>
        </div>

        {isAv ? <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Input id="add-av-title" label="Title *" value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Lily Hart 3" required autoFocus />
            <Input id="add-av-code" label="Product code *" value={form.code} onChange={(e) => set('code', e.target.value)} placeholder="JUL00703" required />
          </div>
          <Input id="add-av-performer-id" label="Performer ID (optional)" value={form.performer_id} onChange={(e) => set('performer_id', e.target.value)} placeholder="Existing performance UUID" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Input id="add-av-country" label="Country" value={form.country} onChange={(e) => set('country', e.target.value)} placeholder="Japan" />
            <Input id="add-av-release-date" label="Release date" type="date" value={form.release_date} onChange={(e) => set('release_date', e.target.value)} />
          </div>
          <ImageUpload label="Primary image *" value={form.image_url} onChange={(url) => set('image_url', url)} placeholder="Image URL or choose a file" />
          <ImageUpload label="Thumbnail (optional)" value={form.thumbnail_url} onChange={(url) => set('thumbnail_url', url)} placeholder="Thumbnail URL or choose a file" />
          <Input id="add-av-source" label="Source URL (optional)" type="url" value={form.source_url} onChange={(e) => set('source_url', e.target.value)} placeholder="https://…" />
          <Textarea id="add-av-description" label="Description (optional)" value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Short description…" rows={3} />
        </> : <>
          <Input id="add-full-name" label="Full name *" value={form.full_name} onChange={(e) => set('full_name', e.target.value)} placeholder="For example: John Doe" required autoFocus />
          <Input id="add-profession" label="Profession / role" value={form.profession} onChange={(e) => set('profession', e.target.value)} placeholder="For example: actor, director" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Input id="add-nationality" label="Nationality / citizenship" value={form.nationality} onChange={(e) => set('nationality', e.target.value)} placeholder="Uzbek" />
            <Input id="add-birth-date" label="Date of birth" type="date" value={form.birth_date} onChange={(e) => set('birth_date', e.target.value)} />
          </div>
          <ImageUpload label="Primary image *" value={form.image_url} onChange={(url) => set('image_url', url)} placeholder="Image URL or choose a file" />
          <ImageUpload label="Thumbnail (optional)" value={form.thumbnail_url} onChange={(url) => set('thumbnail_url', url)} placeholder="Thumbnail URL or choose a file" />
          <Textarea id="add-bio" label="Bio / description (optional)" value={form.bio} onChange={(e) => set('bio', e.target.value)} placeholder="A short description of this performance…" rows={3} />
        </>}
        <button type="submit" style={{ display: 'none' }} />
      </form>
    </Modal>
  );
}
