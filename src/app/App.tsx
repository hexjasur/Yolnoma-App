import { useState, useEffect, useRef } from "react";
import AppRoutes from "./router";
import SplashScreen from "./components/SplashScreen";
import { isStandaloneWindow } from "@/shared/lib/window";
import { UpdateModal } from "@/shared/ui";
import { useUpdaterStore } from "@/shared/stores/updaterStore";
import CommandCenter from "./components/CommandCenter";
import GlobalDropzone from "@/shared/components/GlobalDropzone";
import KeyboardShortcutsModal from "@/shared/components/KeyboardShortcutsModal";
import YolnomaTurbo from "./components/YolnomaTurbo";
import RouteLoadingFallback from "./components/RouteLoadingFallback";

const SPLASH_KEY = "yolnoma_splash_shown";

function App() {
  const isStandalone = isStandaloneWindow();
  const [showSplash, setShowSplash] = useState(false);
  const [splashPreview, setSplashPreview] = useState<
    "standard" | "loading" | null
  >(null);
  const [showRouteLoadingPreview, setShowRouteLoadingPreview] = useState(false);
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

  // Development-only visual preview hook. It overlays the existing splash without
  // changing the persisted first-run behavior used by the production app.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const handlePreviewSplash = (event: Event) => {
      const variant = (
        event as CustomEvent<{ variant?: "standard" | "loading" }>
      ).detail?.variant;
      setSplashPreview(variant === "loading" ? "loading" : "standard");
    };
    const handlePreviewRouteLoading = () => setShowRouteLoadingPreview(true);
    window.addEventListener("yolnoma:preview-splash", handlePreviewSplash);
    window.addEventListener(
      "yolnoma:preview-route-loading",
      handlePreviewRouteLoading,
    );
    const handleHideRouteLoading = () => setShowRouteLoadingPreview(false);
    window.addEventListener(
      "yolnoma:hide-route-loading",
      handleHideRouteLoading,
    );
    const handleHideSplash = () => setSplashPreview(null);
    window.addEventListener("yolnoma:hide-splash", handleHideSplash);
    const handleCloseAllPreviews = () => {
      setSplashPreview(null);
      setShowRouteLoadingPreview(false);
      useUpdaterStore.getState().reset();
    };
    window.addEventListener(
      "yolnoma:close-all-previews",
      handleCloseAllPreviews,
    );
    return () => {
      window.removeEventListener("yolnoma:preview-splash", handlePreviewSplash);
      window.removeEventListener(
        "yolnoma:preview-route-loading",
        handlePreviewRouteLoading,
      );
      window.removeEventListener(
        "yolnoma:hide-route-loading",
        handleHideRouteLoading,
      );
      window.removeEventListener("yolnoma:hide-splash", handleHideSplash);
      window.removeEventListener(
        "yolnoma:close-all-previews",
        handleCloseAllPreviews,
      );
    };
  }, []);

  // Automatic background update check once on application startup (non-blocking)
  useEffect(() => {
    if (import.meta.env.DEV || !appReady || hasCheckedStartupRef.current)
      return;
    hasCheckedStartupRef.current = true;

    // Small initial delay so app UI mounts and renders without any initial contention
    const timer = setTimeout(() => {
      useUpdaterStore.getState().checkForUpdates({ silent: true });
    }, 2000);

    return () => clearTimeout(timer);
  }, [appReady]);

  const handleSplashFinish = () => {
    sessionStorage.setItem(SPLASH_KEY, "1");
    setShowSplash(false);
    setAppReady(true);
  };

  return (
    <>
      {!isStandalone && showSplash && (
        <SplashScreen onFinish={handleSplashFinish} />
      )}
      {splashPreview && (
        <SplashScreen
          preview
          loadingPreview={splashPreview === "loading"}
          onFinish={() => setSplashPreview(null)}
        />
      )}
      {appReady && (
        <>
          <AppRoutes />
          <CommandCenter />
          <GlobalDropzone />
          <KeyboardShortcutsModal />
          <UpdateModal />
          <YolnomaTurbo />
          {showRouteLoadingPreview && (
            <div className="fixed inset-0 z-[110] flex h-screen w-screen items-center justify-center bg-black/80 backdrop-blur-sm">
              <RouteLoadingFallback />
            </div>
          )}
        </>
      )}
    </>
  );
}

export default App;
