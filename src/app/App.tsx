import { useState, useEffect, useRef } from 'react';
import AppRoutes from './router';
import SplashScreen from './components/SplashScreen';
import { isStandaloneWindow } from '@/shared/lib/window';
import { UpdateModal } from '@/shared/ui';
import { useUpdaterStore } from '@/shared/stores/updaterStore';

const SPLASH_KEY = 'yolnoma_splash_shown';

function App() {
  const isStandalone = isStandaloneWindow();
  const [showSplash, setShowSplash] = useState(false);
  const [appReady, setAppReady] = useState(isStandalone);
  const hasCheckedStartupRef = useRef(false);

  useEffect(() => {
    if (isStandalone) {
      setAppReady(true);
      return;
    }

    const alreadyShown = sessionStorage.getItem(SPLASH_KEY);
    if (!alreadyShown) {
      setShowSplash(true);
    } else {
      setAppReady(true);
    }
  }, [isStandalone]);

  // Automatic background update check once on application startup (non-blocking)
  useEffect(() => {
    if (!appReady || hasCheckedStartupRef.current) return;
    hasCheckedStartupRef.current = true;

    // Small initial delay so app UI mounts and renders without any initial contention
    const timer = setTimeout(() => {
      useUpdaterStore.getState().checkForUpdates({ silent: true });
    }, 2000);

    return () => clearTimeout(timer);
  }, [appReady]);

  const handleSplashFinish = () => {
    sessionStorage.setItem(SPLASH_KEY, '1');
    setShowSplash(false);
    setAppReady(true);
  };

  return (
    <>
      {!isStandalone && showSplash && <SplashScreen onFinish={handleSplashFinish} />}
      {appReady && (
        <>
          <AppRoutes />
          <UpdateModal />
        </>
      )}
    </>
  );
}

export default App;
