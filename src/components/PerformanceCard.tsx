import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';
import type { Performance } from '@/types';

interface PerformanceCardProps {
  item: Performance;
  onEdit:   (item: Performance) => void;
  onDelete: (item: Performance) => void;
}

/**
 * Memoized card — only re-renders when the item data changes.
 * Hover reveals Edit + Delete action buttons in the top-right corner.
 */
const PerformanceCard = memo(function PerformanceCard({
  item,
  onEdit,
  onDelete,
}: PerformanceCardProps) {
  const navigate = useNavigate();

  function handleCardClick() {
    navigate(`/performances/${item.id}`);
  }

  function handleEdit(e: React.MouseEvent) {
    e.stopPropagation();
    onEdit(item);
  }

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    onDelete(item);
  }

  return (
    <div
      className="perf-card"
      onClick={handleCardClick}
      style={{
        position: 'relative',
        borderRadius: 14,
        overflow: 'hidden',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        cursor: 'pointer',
      }}
    >
      {/* Image */}
      <div style={{ position: 'relative', aspectRatio: '3/4', overflow: 'hidden', background: '#0F0D0B' }}>
        <img
          src={item.image_url}
          alt={item.full_name}
          loading="lazy"
          decoding="async"
          className="perf-img"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          onError={(e) => { e.currentTarget.src = 'https://placehold.co/400x600/1B1713/F2EDE6?text=?'; }}
        />

        {/* Gradient overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to top, rgba(15,13,11,0.92) 0%, rgba(15,13,11,0.1) 45%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        {/* Hover glow */}
        <div
          className="perf-spotlight"
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(circle at 50% 20%, rgba(217,119,87,0.22), transparent 55%)',
            opacity: 0,
            pointerEvents: 'none',
          }}
        />

        {/* Action buttons — fade in on card hover */}
        <div
          className="card-actions"
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            display: 'flex',
            gap: 6,
            opacity: 0,
            transform: 'translateY(-4px)',
          }}
        >
          <button
            onClick={handleEdit}
            aria-label="Tahrirlash"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(20,17,14,0.85)',
              border: '1px solid rgba(242,237,230,0.14)',
              color: 'rgba(242,237,230,0.7)',
              backdropFilter: 'blur(6px)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(217,119,87,0.25)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(217,119,87,0.5)';
              (e.currentTarget as HTMLButtonElement).style.color = '#F2EDE6';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(20,17,14,0.85)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(242,237,230,0.14)';
              (e.currentTarget as HTMLButtonElement).style.color = 'rgba(242,237,230,0.7)';
            }}
          >
            <Pencil size={13} strokeWidth={2} />
          </button>

          <button
            onClick={handleDelete}
            aria-label="O'chirish"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(20,17,14,0.85)',
              border: '1px solid rgba(242,237,230,0.14)',
              color: 'rgba(242,237,230,0.7)',
              backdropFilter: 'blur(6px)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(220,80,80,0.25)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(220,80,80,0.5)';
              (e.currentTarget as HTMLButtonElement).style.color = '#FFC5C5';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(20,17,14,0.85)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(242,237,230,0.14)';
              (e.currentTarget as HTMLButtonElement).style.color = 'rgba(242,237,230,0.7)';
            }}
          >
            <Trash2 size={13} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Name */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '14px 16px 16px' }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: 'var(--text-primary)', lineHeight: 1.3 }}>
          {item.full_name}
        </h3>
      </div>
    </div>
  );
});

export default PerformanceCard;
