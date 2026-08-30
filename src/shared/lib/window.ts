import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useState, useEffect } from 'react';

/**
 * Check if current execution context is in a secondary standalone window (not the 'main' window).
 */
export function isStandaloneWindow(): boolean {
  try {
    const win = getCurrentWindow();
    return win.label !== 'main';
  } catch {
    return false;
  }
}

/**
 * React hook to reactively check whether the component is rendered inside a secondary standalone window.
 */
export function useIsStandalone(): boolean {
  const [standalone, setStandalone] = useState<boolean>(() => isStandaloneWindow());

  useEffect(() => {
    try {
      const win = getCurrentWindow();
      setStandalone(win.label !== 'main');
    } catch {
      setStandalone(false);
    }
  }, []);

  return standalone;
}

/**
 * Open any internal hash route or external link in a new dedicated standalone Yolnoma desktop window.
 *
 * @param url Target route (e.g. "/videos/123", "#/performances", "yolnoma://app/videos/123", or full URL)
 * @param title Optional window title
 */
export async function openInNewWindow(url: string, title?: string): Promise<void> {
  if (!url || typeof url !== 'string') return;
  try {
    await invoke('open_in_new_window', {
      url: url.trim(),
      title: title || null,
    });
  } catch (error) {
    console.error('[Window] Failed to open in new window:', error);
  }
}
