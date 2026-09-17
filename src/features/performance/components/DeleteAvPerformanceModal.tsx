import { Trash2 } from 'lucide-react';
import type { AvPerformance } from '@/types';
import { useDeleteAvPerformance } from '@/features/performance/hooks/useAvPerformanceQueries';
import { Button, Modal } from '@/shared/ui';
export default function DeleteAvPerformanceModal({ open, item, onClose, onDeleted }: { open: boolean; item: AvPerformance | null; onClose: () => void; onDeleted?: () => void }) {
  const mutation = useDeleteAvPerformance();
  async function remove() { if (!item) return; try { await mutation.mutateAsync(item.id); onDeleted?.(); onClose(); } catch {} }
  return <Modal open={open} onClose={() => !mutation.isPending && onClose()} title="Delete AV performance?" subtitle="This action cannot be undone" maxWidth="max-w-[420px]" footer={<><Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>Cancel</Button><Button variant="danger" loading={mutation.isPending} onClick={remove}><Trash2 size={14} /> Delete</Button></>}><p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>{item?.title ?? 'This AV performance'} will be deleted.</p></Modal>;
}
