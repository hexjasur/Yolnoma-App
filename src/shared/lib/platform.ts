export const isAndroidApp = (): boolean => {
  if (typeof navigator === 'undefined') return false;

  const userAgent = navigator.userAgent.toLowerCase();
  const tauriRuntime = '__TAURI_INTERNALS__' in window;

  return tauriRuntime && /android/.test(userAgent);
};
