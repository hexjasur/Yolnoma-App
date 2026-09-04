import { Bookmark, BookmarkCheck, Loader2 } from 'lucide-react';
import { useSavedVideosQuery, useToggleSavedVideo } from '@/features/videos/hooks/useVideoQueries';
import { Button } from '@/shared/ui';
import type { EPVideo, SavedVideo } from '@/features/videos/types/video';

interface SaveVideoButtonProps {
  video: EPVideo | SavedVideo;
}

function toEPVideo(video: EPVideo | SavedVideo): EPVideo {
  if ('id' in video) return video;
  return {
    id: video.videoId,
    title: video.title,
    url: '',
    default_thumb: { src: video.defaultThumb, size: 'big', width: 640, height: 360 },
    length_sec: 0,
    length_min: video.lengthMin,
    views: Number(video.views) || 0,
    rate: video.rate,
    keywords: '',
    embed: '',
  };
}

export default function SaveVideoButton({ video }: SaveVideoButtonProps) {
  const normalizedVideo = toEPVideo(video);
  const savedQuery = useSavedVideosQuery();
  const toggleSaved = useToggleSavedVideo();
  const isSaved = (savedQuery.data ?? []).some((item) => item.videoId === normalizedVideo.id);

  if (savedQuery.isLoading) {
    return (
      <Button variant="ghost" size="sm" disabled className="gap-2">
        <Loader2 size={14} className="animate-spin" />
        Checking…
      </Button>
    );
  }

  return (
    <Button
      variant={isSaved ? 'primary' : 'ghost'}
      size="sm"
      loading={toggleSaved.isPending}
      onClick={() => toggleSaved.mutate({ video: normalizedVideo, isSaved })}
      className="gap-2"
    >
      {isSaved ? (
        <>
          <BookmarkCheck size={14} className="fill-[var(--text-primary)]" />
          Saved
        </>
      ) : (
        <>
          <Bookmark size={14} />
          Save
        </>
      )}
    </Button>
  );
}
