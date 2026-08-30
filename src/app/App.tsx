import { useState, useEffect } from 'react';
import AppRoutes from './router';
import SplashScreen from './components/SplashScreen';
import { isStandaloneWindow } from '@/shared/lib/window';

const SPLASH_KEY = 'yolnoma_splash_shown';

function App() {
  const isStandalone = isStandaloneWindow();
  const [showSplash, setShowSplash] = useState(false);
  const [appReady, setAppReady] = useState(isStandalone);

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

  const handleSplashFinish = () => {
    sessionStorage.setItem(SPLASH_KEY, '1');
    setShowSplash(false);
    setAppReady(true);
  };

  return (
    <>
      {!isStandalone && showSplash && <SplashScreen onFinish={handleSplashFinish} />}
      {appReady && <AppRoutes />}
    </>
  );
}

export default App;
