import { invoke } from '@tauri-apps/api/core';
import type { Performance, PerformanceUpdateInput } from '@/types';

export const performanceService = {
  list: () =>
    invoke<Performance[]>('list_performances'),

  get: (id: string) =>
    invoke<Performance>('get_performance', { id }),

  add: (data: { full_name: string; image_url: string; thumbnail_url?: string; description?: string }) =>
    invoke<string>('add_performance', { 
      fullName: data.full_name, 
      imageUrl: data.image_url,
      thumbnailUrl: data.thumbnail_url,
      description: data.description 
    }),

  update: (id: string, data: PerformanceUpdateInput) =>
    invoke<Performance>('update_performance', { 
      id, 
      data: {
        fullName: data.full_name,
        imageUrl: data.image_url,
        thumbnailUrl: data.thumbnail_url,
        description: data.description
      } 
    }),

  delete: (id: string) =>
    invoke<Performance>('delete_performance', { id }),
} as const;
