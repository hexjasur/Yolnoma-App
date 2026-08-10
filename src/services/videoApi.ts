import { invoke } from '@tauri-apps/api/core';
import type { EpornerSearchResponse, EpornerVideo, SavedVideo } from '@/types/video';

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
  search: async (query: string, page = 1, perPage = 20): Promise<EpornerSearchResponse> => {
    const path = `/api/v2/video/search/?query=${encodeURIComponent(
      query
    )}&per_page=${perPage}&page=${page}&thumbsize=medium&order=latest-uploaded&thumbs=true&format=json`;
    return proxyFetch(path) as Promise<EpornerSearchResponse>;
  },

  getById: async (id: string): Promise<EpornerVideo> => {
    const path = `/api/v2/video/id/?id=${id}&thumbsize=medium&thumbs=true&format=json`;
    return proxyFetch(path) as Promise<EpornerVideo>;
  },

  save: (video: SavedVideo): Promise<void> =>
    invoke<void>('save_video', { video }),

  unsave: (videoId: string): Promise<void> =>
    invoke<void>('unsave_video', { videoId }),

  getSaveStatus: (videoId: string): Promise<boolean> =>
    invoke<boolean>('get_video_save_status', { videoId }),

  listSaved: (): Promise<SavedVideo[]> =>
    invoke<SavedVideo[]>('list_saved_videos'),
};
