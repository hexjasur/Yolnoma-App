import { useState, useEffect, useCallback } from 'react';
import { Bookmark, BookmarkCheck, Loader2 } from 'lucide-react';
import { videoApi } from '@/services/videoApi';
import { savedVideosStore } from '@/services/savedVideosStore';
import { Button } from '@/components/ui';
import type { EpornerVideo, SavedVideo } from '@/types/video';

interface SaveVideoButtonProps {
  video: EpornerVideo | SavedVideo;
}

export default function SaveVideoButton({ video }: SaveVideoButtonProps) {
  const videoId = 'id' in video ? video.id : video.videoId;

  const [isSaved, setIsSaved] = useState<boolean>(() => {
    if (savedVideosStore.isInitialized()) {
      return savedVideosStore.isSaved(videoId);
    }
    return false;
  });
  const [loading, setLoading] = useState<boolean>(() => !savedVideosStore.isInitialized());

  useEffect(() => {
    // Subscribe to store updates
    const unsubscribe = savedVideosStore.subscribe(() => {
      if (savedVideosStore.isInitialized()) {
        setIsSaved(savedVideosStore.isSaved(videoId));
      }
    });

    // If store not initialized yet, query backend status once
    if (!savedVideosStore.isInitialized()) {
      let active = true;
      setLoading(true);
      videoApi.getSaveStatus(videoId)
        .then((status) => {
          if (active) {
            setIsSaved(status);
            setLoading(false);
          }
        })
        .catch((err) => {
          console.error('Error fetching save status:', err);
          if (active) setLoading(false);
        });

      return () => {
        active = false;
        unsubscribe();
      };
    }

    return unsubscribe;
  }, [videoId]);

  const handleToggle = useCallback(async () => {
    setLoading(true);
    try {
      if (isSaved) {
        await videoApi.unsave(videoId);
        savedVideosStore.remove(videoId);
        setIsSaved(false);
      } else {
        const isEporner = 'id' in video;
        const epornerVideo = video as EpornerVideo;
        const savedVideo = video as SavedVideo;

        const thumbUrl = isEporner
          ? (epornerVideo.default_thumb?.src || '')
          : savedVideo.defaultThumb;

        const payload: SavedVideo = {
          videoId,
          title: video.title,
          defaultThumb: thumbUrl,
          lengthMin: isEporner ? epornerVideo.length_min : savedVideo.lengthMin,
          views: isEporner ? String(epornerVideo.views) : savedVideo.views,
          rate: isEporner ? String(epornerVideo.rate) : savedVideo.rate,
        };

        await videoApi.save(payload);
        savedVideosStore.add(payload);
        setIsSaved(true);
      }
    } catch (err) {
      console.error('Error toggling bookmark status:', err);
    } finally {
      setLoading(false);
    }
  }, [isSaved, video, videoId]);

  if (loading) {
    return (
      <Button variant="ghost" size="sm" disabled className="gap-2">
        <Loader2 size={14} className="animate-spin" />
        Tekshirilmoqda...
      </Button>
    );
  }

  return (
    <Button
      variant={isSaved ? 'primary' : 'ghost'}
      size="sm"
      onClick={handleToggle}
      className="gap-2"
    >
      {isSaved ? (
        <>
          <BookmarkCheck size={14} className="fill-[var(--text-primary)]" />
          Saqlandi
        </>
      ) : (
        <>
          <Bookmark size={14} />
          Saqlash
        </>
      )}
    </Button>
  );
}
