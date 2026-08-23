const AUTH_STORAGE_KEYS = [
  'yolnoma_access_token',
  'yolnoma_refresh_token',
  'yolnoma_session_id',
  'yolnoma_user',
] as const;

export function clearAuthSession(): void {
  AUTH_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
}
