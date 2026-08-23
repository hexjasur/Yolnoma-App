import { invoke } from '@tauri-apps/api/core';
import { api } from '@/shared/api/http';
import type { EpornerSearchResponse, EpornerVideo, SavedVideo, VideoOrder } from '@/features/videos/types/video';

// Try multiple base URLs in order
const BASE_URLS = [
  'https://www.eporner.com',
  'https://es.eporner.com',
];

async function proxyFetch(path: string): Promise<unknown> {
  let lastError = '';
  for (const base of BASE_URLS) {
    const url = `${base}${path}`;
    try {
      const result = await invoke<unknown>('proxy_eporner', { url });
      return result;
    } catch (err) {
      lastError = String(err);
      console.warn(`Failed with ${base}:`, err);
    }
  }
  throw new Error(lastError);
}

export const videoApi = {
  /**
   * Search videos by query, page & order.
   * Uses thumbsize=big and thumbs=true to retrieve all snapshot thumbnails for hover & galleries.
   */
  search: async (
    query: string,
    page = 1,
    perPage = 20,
    order: VideoOrder = 'latest'
  ): Promise<EpornerSearchResponse> => {
    const orderParam = order || 'latest';
    const path = `/api/v2/video/search/?query=${encodeURIComponent(
      query
    )}&per_page=${perPage}&page=${page}&thumbsize=big&order=${encodeURIComponent(
      orderParam
    )}&thumbs=true&format=json`;
    return proxyFetch(path) as Promise<EpornerSearchResponse>;
  },

  /**
   * Get full video details by ID including big thumbnails and thumbs array.
   */
  getById: async (id: string): Promise<EpornerVideo> => {
    const path = `/api/v2/video/id/?id=${id}&thumbsize=big&thumbs=true&format=json`;
    return proxyFetch(path) as Promise<EpornerVideo>;
  },

  /**
   * User-specific video bookmarking stored in Supabase `savev` table.
   */
  save: async (video: SavedVideo): Promise<void> => {
    await api.post('/api/v2/saved-videos', video);
  },

  /**
   * Remove video from current user's bookmarks.
   */
  unsave: async (videoId: string): Promise<void> => {
    await api.delete(`/api/v2/saved-videos/${videoId}`);
  },

  /**
   * Check if video is saved by current user.
   */
  getSaveStatus: async (videoId: string): Promise<boolean> => {
    try {
      const res = await api.get(`/api/v2/saved-videos/status/${videoId}`);
      return Boolean(res?.data?.isSaved ?? res?.isSaved);
    } catch {
      return false;
    }
  },

  /**
   * Get all saved videos for the authenticated user.
   */
  listSaved: async (): Promise<SavedVideo[]> => {
    try {
      const res = await api.get('/api/v2/saved-videos');
      return res?.data || (Array.isArray(res) ? res : []);
    } catch (err) {
      console.error('Error fetching saved videos:', err);
      return [];
    }
  },
};
