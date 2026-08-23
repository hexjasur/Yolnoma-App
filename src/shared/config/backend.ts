export interface BackendEnv {
  name: string;
  url: string;
}

export const BACKEND_ENVIRONMENTS: BackendEnv[] = [
  { name: 'Hosting (api.yolnoma.uz)', url: 'https://api.yolnoma.uz' },
  { name: 'Localhost (port 3000)', url: 'http://localhost:3000' },
];

const LOCAL_STORAGE_KEY = 'yolnoma_backend_url';

export function getBackendUrl(): string {
  const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (saved) return saved;
  // Default to hosting
  return 'https://api.yolnoma.uz';
}

export function setBackendUrl(url: string): void {
  localStorage.setItem(LOCAL_STORAGE_KEY, url);
}
