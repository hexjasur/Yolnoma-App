import { useEffect, useState, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

export interface SystemStats {
  cpuPercent: number;
  ramUsedGb: number;
  ramTotalGb: number;
  diskUsedGb: number;
  diskTotalGb: number;
  gpuPercent?: number | null;
  cpuModel?: string | null;
  cpuCores?: number;
  osName?: string | null;
  hostName?: string | null;
}

const DEFAULT_POLL_INTERVAL_MS = 2000;

export function useSystemStats(enabled: boolean = true) {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isFetchingRef = useRef(false);

  const fetchStats = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const data = await invoke<SystemStats>('get_system_stats');
      setStats(data);
      setError(null);
    } catch (err: any) {
      console.warn('[SystemStats] Error fetching native metrics:', err);
      setError(err?.message || 'Tizim ko\'rsatkichlarini olib bo\'lmadi');
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    // Initial fetch
    fetchStats();

    const startPolling = () => {
      if (timerRef.current) clearInterval(timerRef.current);
      setIsPaused(false);
      timerRef.current = setInterval(() => {
        if (!document.hidden) {
          fetchStats();
        }
      }, DEFAULT_POLL_INTERVAL_MS);
    };

    const stopPolling = () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setIsPaused(true);
    };

    // Visibility-aware polling handler
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        // Immediate fetch upon returning to view
        fetchStats();
        startPolling();
      }
    };

    startPolling();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, fetchStats]);

  return { stats, loading, error, isPaused, refetch: fetchStats };
}
