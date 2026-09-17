import { useCallback, useState } from 'react';
export function useModal<T = unknown>() {
  const [isOpen, setIsOpen] = useState(false); const [target, setTarget] = useState<T | null>(null);
  const open = useCallback((item?: T) => { if (item !== undefined) setTarget(item); setIsOpen(true); }, []);
  const close = useCallback(() => { setIsOpen(false); setTimeout(() => setTarget(null), 300); }, []);
  return { isOpen, target, open, close };
}
