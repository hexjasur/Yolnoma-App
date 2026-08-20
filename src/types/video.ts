export interface EpornerThumb {
  size: string;
  width: number;
  height: number;
  src: string;
}

export interface EpornerVideo {
  id: string;
  title: string;
  url: string;
  default_thumb: EpornerThumb;
  length_sec: number;
  length_min: string;
  views: number;
  rate: string; // Eporner returns rate as a string, e.g. "0.00"
  keywords: string;
  embed: string;
  added?: string;
  thumbs?: EpornerThumb[];
}

export interface EpornerSearchResponse {
  total_count: string | number;
  page: number;
  per_page: number;
  videos: EpornerVideo[];
}

export interface SavedVideo {
  videoId: string;
  title: string;
  defaultThumb: string;
  lengthMin: string;
  views: string;
  rate: string;
  created_at?: string;
}
