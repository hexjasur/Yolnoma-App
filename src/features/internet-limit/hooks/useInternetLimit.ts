import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "@/shared/ui/Toast";
import {
  getNetworkTrafficSnapshot,
  listBandwidthLimits,
  listNetworkApps,
  removeAppBandwidthLimit,
  startNetworkTrafficMonitor,
  setAppBandwidthLimit,
} from "../services/internetLimitService";
import {
  MAX_LIMIT_KBPS,
  type BandwidthLimit,
  type NetworkApp,
  type NetworkTrafficRate,
  type TrafficMonitorSnapshot,
} from "../types";

function getErrorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return String(error);
}

export function useInternetLimit() {
  const { t } = useTranslation();
  const [apps, setApps] = useState<NetworkApp[]>([]);
  const [limits, setLimits] = useState<BandwidthLimit[]>([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [busyPath, setBusyPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trafficStatus, setTrafficStatus] =
    useState<TrafficMonitorSnapshot["status"]>("idle");
  const [trafficError, setTrafficError] = useState<string | null>(null);
  const [trafficRates, setTrafficRates] = useState<NetworkTrafficRate[]>([]);
  const [observedEventCount, setObservedEventCount] = useState(0);
  const [decodedEventCount, setDecodedEventCount] = useState(0);
  const [unattributedBytes, setUnattributedBytes] = useState(0);

  const refreshLimits = useCallback(async () => {
    try {
      setLimits(await listBandwidthLimits());
    } catch (limitError) {
      toast.error(getErrorMessage(limitError));
    }
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [nextApps] = await Promise.all([
        listNetworkApps(),
        refreshLimits(),
      ]);
      setApps(nextApps);
    } catch (loadError) {
      setError(getErrorMessage(loadError) || t("internetLimit.errors.load"));
    } finally {
      setIsLoading(false);
    }
  }, [refreshLimits, t]);

  const refreshApps = useCallback(async () => {
    try {
      setApps(await listNetworkApps());
    } catch (loadError) {
      setError(getErrorMessage(loadError) || t("internetLimit.errors.load"));
    }
  }, [t]);

  const refreshTraffic = useCallback(async () => {
    try {
      const snapshot = await getNetworkTrafficSnapshot();
      setTrafficStatus(snapshot.status);
      setTrafficError(snapshot.error);
      setTrafficRates(snapshot.apps);
      setObservedEventCount(snapshot.observedEventCount);
      setDecodedEventCount(snapshot.decodedEventCount);
      setUnattributedBytes(snapshot.unattributedBytes);
    } catch (trafficLoadError) {
      setTrafficStatus("error");
      setTrafficError(getErrorMessage(trafficLoadError));
      setTrafficRates([]);
      setObservedEventCount(0);
      setDecodedEventCount(0);
      setUnattributedBytes(0);
    }
  }, []);

  const startTrafficMonitor = useCallback(async () => {
    setTrafficStatus("starting");
    setTrafficError(null);
    try {
      await startNetworkTrafficMonitor();
      await refreshTraffic();
    } catch (monitorError) {
      setTrafficStatus("error");
      setTrafficError(getErrorMessage(monitorError));
      setTrafficRates([]);
      setObservedEventCount(0);
      setDecodedEventCount(0);
      setUnattributedBytes(0);
    }
  }, [refreshTraffic]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refreshApps();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [refreshApps]);

  useEffect(() => {
    void startTrafficMonitor();
    const timer = window.setInterval(() => {
      void refreshTraffic();
    }, 1000);
    return () => window.clearInterval(timer);
  }, [refreshTraffic, startTrafficMonitor]);

  const applyLimit = useCallback(
    async (app: NetworkApp, limitKbps: number) => {
      if (
        !Number.isInteger(limitKbps) ||
        limitKbps < 1 ||
        limitKbps > MAX_LIMIT_KBPS
      ) {
        toast.error(t("internetLimit.errors.invalidSpeed"));
        return;
      }

      setBusyPath(app.exePath);
      try {
        await setAppBandwidthLimit(app.exePath, limitKbps);
        toast.success(t("internetLimit.applied", { name: app.name }));
        await refreshLimits();
      } catch (applyError) {
        toast.error(getErrorMessage(applyError));
      } finally {
        setBusyPath(null);
      }
    },
    [refreshLimits, t],
  );

  const removeLimit = useCallback(
    async (limit: BandwidthLimit) => {
      setBusyPath(limit.exePath);
      try {
        await removeAppBandwidthLimit(limit.policyName);
        toast.success(
          t("internetLimit.removed", {
            name: limit.exePath.split(/[\\/]/).pop() ?? limit.exePath,
          }),
        );
        await refreshLimits();
      } catch (removeError) {
        toast.error(getErrorMessage(removeError));
      } finally {
        setBusyPath(null);
      }
    },
    [refreshLimits, t],
  );

  const limitByPath = useMemo(
    () => new Map(limits.map((limit) => [limit.exePath.toLowerCase(), limit])),
    [limits],
  );

  const trafficByPath = useMemo(
    () =>
      new Map(
        trafficRates.map((rate) => [rate.exePath.toLowerCase(), rate] as const),
      ),
    [trafficRates],
  );

  const visibleApps = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return apps;
    return apps.filter(
      (app) =>
        app.name.toLowerCase().includes(needle) ||
        app.exePath.toLowerCase().includes(needle),
    );
  }, [apps, query]);

  return {
    apps: visibleApps,
    totalApps: apps.length,
    limits,
    limitByPath,
    trafficByPath,
    query,
    setQuery,
    isLoading,
    busyPath,
    error,
    trafficStatus,
    trafficError,
    observedEventCount,
    decodedEventCount,
    unattributedBytes,
    refresh,
    startTrafficMonitor,
    applyLimit,
    removeLimit,
  };
}
