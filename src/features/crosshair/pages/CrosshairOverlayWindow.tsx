import { useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { CrosshairConfig, DEFAULT_CROSSHAIR_CONFIG } from '../types';
import { CrosshairSVG } from '../components/CrosshairSVG';

export default function CrosshairOverlayWindow() {
  const [config, setConfig] = useState<CrosshairConfig>(() => {
    try {
      const saved = localStorage.getItem('yolnoma_crosshair_config');
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return DEFAULT_CROSSHAIR_CONFIG;
  });

  useEffect(() => {
    // 1. Force transparency on DOM root elements
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
    const rootEl = document.getElementById('root');
    if (rootEl) {
      rootEl.style.background = 'transparent';
    }

    // 2. Fetch saved configuration from Rust AppData
    invoke<CrosshairConfig | null>('get_saved_crosshair_config')
      .then((saved) => {
        if (saved) {
          setConfig(saved);
        }
      })
      .catch(() => {});

    // 3. Real-time synchronization with main window
    const unlistenPromise = listen<CrosshairConfig>(
      'crosshair-config-changed',
      (event) => {
        if (event.payload) {
          setConfig(event.payload);
        }
      }
    );

    return () => {
      unlistenPromise.then((fn) => fn());
    };
  }, []);

  return (
    <div className="fixed inset-0 w-screen h-screen flex items-center justify-center select-none pointer-events-none overflow-hidden bg-transparent">
      <CrosshairSVG config={config} size={200} />
    </div>
  );
}
