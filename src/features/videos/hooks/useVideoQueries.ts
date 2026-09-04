import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { EPVideo, SavedVideo, VideoOrder } from '@/features/videos/types/video';
import { videoApi } from '@/features/videos/api/videoApi';
import { getErrorMessage } from '@/shared/lib/errors';
import { toast } from '@/shared/ui/Toast';

export const videoKeys = {
  all: ['videos'] as const,
  search: (query: string, page: number, order: VideoOrder) => [...videoKeys.all, 'search', { query, page, order }] as const,
  detail: (id: string) => [...videoKeys.all, 'detail', id] as const,
  saved: () => [...videoKeys.all, 'saved'] as const,
};

export function useVideoSearch(query: string, page: number, order: VideoOrder, enabled = true) {
  return useQuery({
    queryKey: videoKeys.search(query, page, order),
    queryFn: () => videoApi.search(query, page, 20, order),
    enabled: enabled && Boolean(query.trim()),
    staleTime: 2 * 60_000,
  });
}

export function useVideoDetail(videoId?: string) {
  return useQuery({
    queryKey: videoKeys.detail(videoId ?? ''),
    queryFn: () => videoApi.getById(videoId!),
    enabled: Boolean(videoId),
    staleTime: 5 * 60_000,
  });
}

export function useSavedVideosQuery(enabled = true) {
  return useQuery({
    queryKey: videoKeys.saved(),
    queryFn: videoApi.listSaved,
    enabled,
    staleTime: 5 * 60_000,
  });
}

function toSavedVideo(video: EPVideo): SavedVideo {
  return {
    videoId: video.id,
    title: video.title,
    defaultThumb: video.default_thumb?.src || '',
    lengthMin: video.length_min,
    views: String(video.views),
    rate: video.rate,
  };
}

export function useToggleSavedVideo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ video, isSaved }: { video: EPVideo; isSaved: boolean }) => {
      if (isSaved) {
        await videoApi.unsave(video.id);
        return { saved: false, video: toSavedVideo(video) };
      }
      const savedVideo = toSavedVideo(video);
      await videoApi.save(savedVideo);
      return { saved: true, video: savedVideo };
    },
    onSuccess: ({ saved, video }) => {
      queryClient.setQueryData<SavedVideo[]>(videoKeys.saved(), (current = []) => saved
        ? current.some((item) => item.videoId === video.videoId) ? current : [video, ...current]
        : current.filter((item) => item.videoId !== video.videoId));
      toast.success(saved ? 'Video saved successfully.' : 'Video removed from saved items.');
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Unable to update saved videos.')),
  });
}
