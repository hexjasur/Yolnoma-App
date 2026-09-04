export interface EPThumb {
  size: string;
  width: number;
  height: number;
  src: string;
}

export interface EPVideo {
  id: string;
  title: string;
  url: string;
  default_thumb: EPThumb;
  length_sec: number;
  length_min: string;
  views: number;
  rate: string; // Returns rate as a string, e.g. "0.00"
  keywords: string;
  embed: string;
  added?: string;
  thumbs?: EPThumb[];
}

export interface EPSearchResponse {
  total_count: string | number;
  page: number;
  per_page: number;
  videos: EPVideo[];
}

export type VideoOrder =
  | 'latest'
  | 'longest'
  | 'shortest'
  | 'top-rated'
  | 'most-popular'
  | 'top-weekly'
  | 'top-monthly';

export interface SavedVideo {
  videoId: string;
  title: string;
  defaultThumb: string;
  lengthMin: string;
  views: string;
  rate: string;
  created_at?: string;
}
