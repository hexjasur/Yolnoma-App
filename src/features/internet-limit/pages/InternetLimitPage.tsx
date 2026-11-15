import { useTranslation } from "react-i18next";
import { Gauge, RefreshCw, ShieldAlert } from "lucide-react";
import { Button, Input } from "@/shared/ui";
import { useInternetLimit } from "../hooks/useInternetLimit";
import { AppLimitRow, formatSpeed } from "../components/AppLimitRow";

export default function InternetLimitPage() {
  const { t } = useTranslation();
  const {
    apps,
    totalApps,
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
  } = useInternetLimit();

  return (
    <div className="mx-auto min-h-full max-w-6xl space-y-6 p-6 pb-16 text-[var(--text-primary)]">
      <header className="border-b border-white/[0.08] pb-6">
        <div className="mb-1.5 flex items-center gap-2.5 text-[var(--accent)]">
          <Gauge size={22} strokeWidth={2} />
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em]">
            {t("internetLimit.eyebrow")}
          </span>
        </div>
        <h1 className="font-serif text-4xl font-medium tracking-tight text-white">
          {t("internetLimit.title")}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-white/45">
          {t("internetLimit.description")}
        </p>
      </header>

      <div className="flex items-start gap-3 rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
        <ShieldAlert size={18} className="mt-0.5 shrink-0" />
        <p>{t("internetLimit.adminNotice")}</p>
      </div>

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}

      {limits.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-serif text-xl text-white">
            {t("internetLimit.activeLimits", { count: limits.length })}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {limits.map((limit) => (
              <li
                key={limit.policyName}
                className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] py-1 pl-3 pr-1 text-sm"
              >
                <span className="text-white/85">
                  {limit.exePath.split(/[\\/]/).pop()} ·{" "}
                  {formatSpeed(limit.limitKbps)}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void removeLimit(limit)}
                  disabled={busyPath !== null}
                >
                  {t("internetLimit.remove")}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="flex-1">
            <Input
              id="internet-limit-search"
              placeholder={t("internetLimit.searchPlaceholder")}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoComplete="off"
            />
          </div>
          <Button
            variant="secondary"
            onClick={() => void refresh()}
            loading={isLoading}
            disabled={isLoading}
          >
            <RefreshCw size={15} />
            {t("internetLimit.refresh")}
          </Button>
        </div>

        <h2 className="font-serif text-xl text-white">
          {t("internetLimit.runningApps", { count: totalApps })}
        </h2>

        {apps.length === 0 && !isLoading ? (
          <p className="text-sm text-white/35">{t("internetLimit.noApps")}</p>
        ) : (
          <ul className="space-y-3">
            {apps.map((app) => (
              <AppLimitRow
                key={app.exePath}
                app={app}
                limit={limitByPath.get(app.exePath.toLowerCase())}
                busy={busyPath === app.exePath}
                onApply={(limitKbps) => void applyLimit(app, limitKbps)}
                onRemove={() => {
                  const limit = limitByPath.get(app.exePath.toLowerCase());
                  if (limit) void removeLimit(limit);
                }}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
