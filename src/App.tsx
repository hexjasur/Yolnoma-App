import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import AppRoutes from './pages';
import SplashScreen from './components/SplashScreen';
import CloseDialog from './components/CloseDialog';

const SPLASH_KEY = 'yolnoma_splash_shown';

function App() {
  const [showSplash, setShowSplash] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [idlingCount, setIdlingCount] = useState(0);
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    // sessionStorage — minimize qilib qaytganda chiqmaydi
    const alreadyShown = sessionStorage.getItem(SPLASH_KEY);
    if (!alreadyShown) {
      setShowSplash(true);
    } else {
      setAppReady(true);
    }
  }, []);

  useEffect(() => {
    // Rust dan close-requested eventi
    let unlisten: (() => void) | null = null;

    listen<void>('close-requested', async () => {
      // Idling sonini olish
      try {
        const count = await invoke<number>('get_idling_count');
        setIdlingCount(count);
      } catch {
        setIdlingCount(0);
      }
      setShowCloseDialog(true);
    }).then(fn => { unlisten = fn; });

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  const handleSplashFinish = () => {
    sessionStorage.setItem(SPLASH_KEY, '1');
    setShowSplash(false);
    setAppReady(true);
  };

  return (
    <>
      {showSplash && <SplashScreen onFinish={handleSplashFinish} />}
      {appReady && <AppRoutes />}
      {showCloseDialog && (
        <CloseDialog
          idlingCount={idlingCount}
          onClose={() => setShowCloseDialog(false)}
        />
      )}
    </>
  );
}

export default App;