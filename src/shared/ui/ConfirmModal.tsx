import { useState, type ReactNode } from 'react';
import { AlertTriangle, AlertCircle, Info, Loader2 } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';

export interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
  loading?: boolean;
}

export default function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  loading = false,
}: ConfirmModalProps) {
  const [internalLoading, setInternalLoading] = useState(false);
  const isLoading = loading || internalLoading;

  const handleConfirm = async () => {
    try {
      const result = onConfirm();
      if (result instanceof Promise) {
        setInternalLoading(true);
        await result;
      }
    } finally {
      setInternalLoading(false);
    }
  };

  const getIcon = () => {
    switch (variant) {
      case 'danger':
        return (
          <div className="w-10 h-10 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 shrink-0">
            <AlertCircle size={20} />
          </div>
        );
      case 'warning':
        return (
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
            <AlertTriangle size={20} />
          </div>
        );
      default:
        return (
          <div className="w-10 h-10 rounded-lg bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center text-[var(--accent)] shrink-0">
            <Info size={20} />
          </div>
        );
    }
  };

  const getConfirmButtonClass = () => {
    switch (variant) {
      case 'danger':
        return 'bg-red-500 hover:bg-red-600 text-white border border-red-600 shadow-lg shadow-red-500/20';
      case 'warning':
        return 'bg-amber-500 hover:bg-amber-600 text-black border border-amber-600 font-semibold';
      default:
        return 'bg-[#D97757] hover:bg-[#c96a48] text-white';
    }
  };

  return (
    <Modal
      open={open}
      onClose={isLoading ? () => {} : onClose}
      title={title}
      maxWidth="max-w-[460px]"
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelText}
          </Button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isLoading}
            className={`px-4 py-2 rounded-md text-xs font-medium transition-all inline-flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${getConfirmButtonClass()}`}
          >
            {isLoading && <Loader2 size={13} className="animate-spin" />}
            {confirmText}
          </button>
        </div>
      }
    >
      <div className="flex items-start gap-4 pt-1">
        {getIcon()}
        <div className="flex-1 text-sm text-white/70 leading-relaxed pt-1">
          {typeof description === 'string' ? <p>{description}</p> : description}
        </div>
      </div>
    </Modal>
  );
}
