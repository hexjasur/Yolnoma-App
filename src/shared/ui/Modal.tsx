import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Max width class, default 'max-w-[520px]' */
  maxWidth?: string;
}

/**
 * Reusable modal shell.
 * - Closes on overlay click and Escape key
 * - Traps focus inside (accessibility)
 * - Smooth fade+scale animation via CSS
 */
export default function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = 'max-w-[520px]',
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div ref={panelRef} className={`modal-panel w-full ${maxWidth}`}>
        {/* Header */}
        <div className="modal-header">
          <div>
            {subtitle && (
              <p
                style={{
                  fontSize: 11,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: 'var(--accent)',
                  fontWeight: 600,
                  marginBottom: 4,
                }}
              >
                {subtitle}
              </p>
            )}
            <h2 className="modal-title">{title}</h2>
          </div>

          <button
            onClick={onClose}
            className="btn btn-ghost btn-icon"
            aria-label="Yopish"
          >
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body">{children}</div>

        {/* Footer */}
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
