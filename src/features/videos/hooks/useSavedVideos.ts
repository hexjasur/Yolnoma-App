import { useSavedVideosQuery } from './useVideoQueries';

/** Cached user-specific saved videos, shared by the list and detail views. */
export function useSavedVideos(enabled = true) {
  const query = useSavedVideosQuery(enabled);
  return {
    savedVideos: query.data ?? [],
    savedLoading: query.isLoading,
    isInitialized: query.isFetched,
    refresh: query.refetch,
  };
}
