// ─── Domain Models ────────────────────────────────────────────
export interface Performance {
  id: string;
  full_name: string;
  image_url: string;
  thumbnail_url: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export type PerformanceCreateInput = {
  full_name: string;
  image_url: string;
  thumbnail_url?: string;
  description?: string;
};

export type PerformanceUpdateInput = Partial<Omit<Performance, 'id' | 'created_at' | 'updated_at'>>;

// ─── UI State ─────────────────────────────────────────────────
export type SortKey = 'name_asc' | 'name_desc' | 'newest' | 'oldest';

export type UploadPhase = 'idle' | 'reading' | 'uploading' | 'done' | 'error';

export interface UploadState {
  phase: UploadPhase;
  progress: number;      // 0–100
  error?: string;
  url?: string;
}

// ─── ImgBB API ────────────────────────────────────────────────
export interface ImgBBResponse {
  data: {
    url: string;
    display_url: string;
    thumb: { url: string };
    medium?: { url: string };
  };
  success: boolean;
  status: number;
}

export * from './video';