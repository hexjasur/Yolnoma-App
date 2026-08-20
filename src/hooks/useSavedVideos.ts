import { useEffect, useState, useCallback } from 'react';
import { savedVideosStore } from '@/services/savedVideosStore';
import type { SavedVideo } from '@/types/video';

export function useSavedVideos(autoFetch = true) {
  const [videos, setVideos] = useState<SavedVideo[]>(() => savedVideosStore.getItems());
  const [loading, setLoading] = useState<boolean>(() => savedVideosStore.getLoading());

  useEffect(() => {
    const unsubscribe = savedVideosStore.subscribe(() => {
      setVideos(savedVideosStore.getItems());
      setLoading(savedVideosStore.getLoading());
    });

    if (autoFetch && !savedVideosStore.isInitialized()) {
      savedVideosStore.fetch();
    }

    return unsubscribe;
  }, [autoFetch]);

  const refresh = useCallback(async () => {
    return savedVideosStore.fetch(true);
  }, []);

  return {
    savedVideos: videos,
    savedLoading: loading,
    isInitialized: savedVideosStore.isInitialized(),
    refresh,
  };
}
