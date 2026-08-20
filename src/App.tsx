import { useState, useEffect } from 'react';
import AppRoutes from './pages';
import SplashScreen from './components/SplashScreen';

const SPLASH_KEY = 'yolnoma_splash_shown';

function App() {
  const [showSplash, setShowSplash] = useState(false);
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

  const handleSplashFinish = () => {
    sessionStorage.setItem(SPLASH_KEY, '1');
    setShowSplash(false);
    setAppReady(true);
  };

  return (
    <>
      {showSplash && <SplashScreen onFinish={handleSplashFinish} />}
      {appReady && <AppRoutes />}
    </>
  );
}

export default App;