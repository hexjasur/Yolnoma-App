import { useTranslation } from "react-i18next";
import { ScanSearch } from "lucide-react";
import { Button, Input } from "@/shared/ui";
import { useTechScan } from "../hooks/useTechScan";
import { TechScanResults } from "../components/TechScanResults";

export default function TechScanPage() {
  const { t } = useTranslation();
  const { url, setUrl, result, isScanning, error, scan } = useTechScan();

  return (
    <div className="mx-auto min-h-full max-w-6xl space-y-6 p-6 pb-16 text-[var(--text-primary)]">
      <header className="border-b border-white/[0.08] pb-6">
        <div className="mb-1.5 flex items-center gap-2.5 text-[var(--accent)]">
          <ScanSearch size={22} strokeWidth={2} />
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em]">
            {t("techScan.eyebrow")}
          </span>
        </div>
        <h1 className="font-serif text-4xl font-medium tracking-tight text-white">
          {t("techScan.title")}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-white/45">
          {t("techScan.description")}
        </p>
      </header>

      <form
        className="flex flex-col gap-3 md:flex-row md:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          void scan();
        }}
      >
        <div className="flex-1">
          <Input
            id="tech-scan-url"
            label={t("techScan.urlLabel")}
            placeholder={t("techScan.urlPlaceholder")}
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            autoComplete="off"
          />
        </div>
        <Button type="submit" loading={isScanning} disabled={isScanning}>
          {isScanning ? t("techScan.scanning") : t("techScan.scan")}
        </Button>
      </form>

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}

      {result ? (
        <TechScanResults result={result} />
      ) : (
        !error && (
          <p className="text-sm text-white/35">{t("techScan.emptyHint")}</p>
        )
      )}
    </div>
  );
}
