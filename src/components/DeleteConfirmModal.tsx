import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { performanceService } from '@/services/performance.service';
import type { Performance } from '@/types';
import { Button, Modal } from '@/components/ui';

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
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function handleDelete() {
    if (!item) return;
    setLoading(true);
    setError(null);
    try {
      await performanceService.delete(item.id);
      onDeleted?.(item.id);
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => { if (!loading) { setError(null); onClose(); } }}
      title="O'chirishni tasdiqlang"
      subtitle="Ehtiyot bo'ling"
      maxWidth="max-w-[420px]"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Bekor qilish
          </Button>
          <Button variant="danger" loading={loading} onClick={handleDelete}>
            <Trash2 size={14} />
            O'chirish
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
            {item?.full_name ?? 'Bu ishtirokchi'}
          </span>{' '}
          o'chiriladi. Bu amalni qaytarib bo'lmaydi.
        </p>

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
      </div>
    </Modal>
  );
}
