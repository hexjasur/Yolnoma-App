import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { scanWebsiteTech } from "../services/techScanService";
import type { TechScanResult } from "../types";

function getErrorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return String(error);
}

export function useTechScan() {
  const { t } = useTranslation();
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<TechScanResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scan = useCallback(async () => {
    const target = url.trim();
    if (!target) {
      setError(t("techScan.errors.empty"));
      return;
    }

    setIsScanning(true);
    setError(null);
    try {
      setResult(await scanWebsiteTech(target));
    } catch (scanError) {
      setResult(null);
      setError(getErrorMessage(scanError));
    } finally {
      setIsScanning(false);
    }
  }, [url, t]);

  return { url, setUrl, result, isScanning, error, scan };
}
