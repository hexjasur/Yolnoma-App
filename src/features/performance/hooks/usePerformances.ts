import { usePerformanceList } from './usePerformanceQueries';

/** Shared dashboard query for the recent-performance panel. */
export function usePerformances(enabled = true) {
  const query = usePerformanceList(1, 100, '', enabled);
  return {
    items: query.data?.data ?? [],
    loading: query.isLoading,
    error: query.error,
    refresh: query.refetch,
  };
}
