import { Trash2 } from 'lucide-react';
import type { Performance } from '@/types';
import { useDeletePerformance } from '@/features/performance/hooks/usePerformanceQueries';
import { Button, Modal } from '@/shared/ui';

interface DeleteConfirmModalProps {
  open: boolean;
  item: Performance | null;
  onClose: () => void;
  onDeleted?: (id: string) => void;
}

export default function DeleteConfirmModal({
  open,
  item,
  onClose,
  onDeleted,
}: DeleteConfirmModalProps) {
  const deletePerformance = useDeletePerformance();

  async function handleDelete() {
    if (!item) return;
    try {
      await deletePerformance.mutateAsync(item.id);
      onDeleted?.(item.id);
      onClose();
    } catch {
      // The mutation reports the user-facing error through the global toast.
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => { if (!deletePerformance.isPending) onClose(); }}
      title="Delete performance?"
      subtitle="This action cannot be undone"
      maxWidth="max-w-[420px]"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={deletePerformance.isPending}>
            Cancel
          </Button>
          <Button variant="danger" loading={deletePerformance.isPending} onClick={handleDelete}>
            <Trash2 size={14} />
            Delete
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Icon */}
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: '50%',
            background: 'rgba(220,80,80,0.10)',
            border: '1px solid rgba(220,80,80,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 4px',
          }}
        >
          <Trash2 size={22} strokeWidth={1.5} style={{ color: '#F2A8A8' }} />
        </div>

        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6 }}>
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
            {item?.full_name ?? 'This performance'}
          </span>{' '}
          will be deleted. This action cannot be undone.
        </p>

      </div>
    </Modal>
  );
}
