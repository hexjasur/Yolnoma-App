import { useCallback, useState } from 'react';
import type { Performance } from '@/types';

/**
 * Generic hook to manage open/closed state for a modal
 * that operates on a single Performance item (edit/delete).
 */
export function useModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [target, setTarget] = useState<Performance | null>(null);

  const open = useCallback((item?: Performance) => {
    if (item) setTarget(item);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    // Delay clearing target so close animation plays with data still rendered
    setTimeout(() => setTarget(null), 300);
  }, []);

  return { isOpen, target, open, close };
}
