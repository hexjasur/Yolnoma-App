import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "@/shared/ui/Toast";
import {
  listBandwidthLimits,
  listNetworkApps,
  removeAppBandwidthLimit,
  setAppBandwidthLimit,
} from "../services/internetLimitService";
import { MAX_LIMIT_KBPS, type BandwidthLimit, type NetworkApp } from "../types";

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

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
    query,
    setQuery,
    isLoading,
    busyPath,
    error,
    refresh,
    applyLimit,
    removeLimit,
  };
}
