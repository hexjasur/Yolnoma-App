import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useIdlingStore } from "@/shared/stores/idlingStore";

export type ActiveToolsStatus = {
  idlingCount: number;
  isCrosshairActive: boolean;
};

export function useActiveToolsStatus(): ActiveToolsStatus {
  const [status, setStatus] = useState<ActiveToolsStatus>({
    idlingCount: 0,
    isCrosshairActive: false,
  });

  useEffect(() => {
    let mounted = true;

    const checkStatus = async () => {
      // Don't poll if tab is hidden
      if (typeof document !== "undefined" && document.hidden) return;

      try {
        const [idleIds, isCrosshairActive] = await Promise.all([
          useIdlingStore
            .getState()
            .syncIdleState()
            .catch(() => []),
          invoke<boolean>("is_crosshair_active").catch(() => false),
        ]);

        if (mounted) {
          setStatus({
            idlingCount: Array.isArray(idleIds) ? idleIds.length : 0,
            isCrosshairActive: Boolean(isCrosshairActive),
          });
        }
      } catch {
        // Tauri unavailable or in test mode
      }
    };

    // Initial check
    checkStatus();

    // Poll every 3 seconds
    const interval = setInterval(checkStatus, 3000);

    const onVisibilityChange = () => {
      if (!document.hidden) {
        checkStatus();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      mounted = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return status;
}
