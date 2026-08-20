import { videoApi } from './videoApi';
import type { SavedVideo } from '@/types/video';

type Listener = () => void;

class SavedVideosStore {
  private items: SavedVideo[] = [];
  private isLoaded = false;
  private isLoading = false;
  private listeners = new Set<Listener>();

  public getItems(): SavedVideo[] {
    return this.items;
  }

  public isInitialized(): boolean {
    return this.isLoaded;
  }

  public getLoading(): boolean {
    return this.isLoading;
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (e) {
        console.error('[SavedVideosStore] Listener error:', e);
      }
    });
  }

  public async fetch(force = false): Promise<SavedVideo[]> {
    if (this.isLoaded && !force) {
      return this.items;
    }
    if (this.isLoading) {
      return this.items;
    }

    this.isLoading = true;
    this.notify();

    try {
      const data = await videoApi.listSaved();
      this.items = Array.isArray(data) ? data : [];
      this.isLoaded = true;
    } catch (err) {
      console.error('[SavedVideosStore] Error fetching saved videos:', err);
    } finally {
      this.isLoading = false;
      this.notify();
    }

    return this.items;
  }

  public add(video: SavedVideo): void {
    const exists = this.items.some((v) => v.videoId === video.videoId);
    if (!exists) {
      this.items = [video, ...this.items];
      this.isLoaded = true;
      this.notify();
    }
  }

  public remove(videoId: string): void {
    const prevLength = this.items.length;
    this.items = this.items.filter((v) => v.videoId !== videoId);
    if (this.items.length !== prevLength) {
      this.isLoaded = true;
      this.notify();
    }
  }

  public isSaved(videoId: string): boolean {
    return this.items.some((v) => v.videoId === videoId);
  }
}

export const savedVideosStore = new SavedVideosStore();
