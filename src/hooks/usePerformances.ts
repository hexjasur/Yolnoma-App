import { useEffect, useSyncExternalStore } from 'react';
import { performanceStore } from '@/services/performanceStore';
import type { Performance } from '@/types';

interface UsePerformancesReturn {
  items: Performance[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addLocal: (item: Performance) => void;
  updateLocal: (updated: Performance) => void;
  removeLocal: (id: string) => void;
}

/**
 * Fetches and caches the performances list globally.
 * Subscribes to the global store so UI feels instant across all pages.
 */
export function usePerformances(): UsePerformancesReturn {
  const state = useSyncExternalStore(performanceStore.subscribe, performanceStore.getSnapshot);

  useEffect(() => {
    // Calls fetch, but store will skip network if already fetched and cached
    performanceStore.fetch();
  }, []);

  return {
    ...state,
    refresh: () => performanceStore.fetch(true),
    addLocal: (item) => performanceStore.addLocal(item),
    updateLocal: (item) => performanceStore.updateLocal(item),
    removeLocal: (id) => performanceStore.removeLocal(id),
  };
}
