import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Input } from "@/shared/ui";
import type { BandwidthLimit, NetworkApp } from "../types";

const SPEED_PRESETS_KBPS = [64, 256, 1024, 4096] as const;

export function formatSpeed(kbps: number): string {
  return kbps >= 1024 ? `${(kbps / 1024).toFixed(1)} MB/s` : `${kbps} KB/s`;
}

interface AppLimitRowProps {
  app: NetworkApp;
  limit: BandwidthLimit | undefined;
  busy: boolean;
  onApply: (limitKbps: number) => void;
  onRemove: () => void;
}

export function AppLimitRow({
  app,
  limit,
  busy,
  onApply,
  onRemove,
}: AppLimitRowProps) {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const submitDraft = () => {
    const parsed = Number(draft);
    if (!draft.trim() || !Number.isFinite(parsed)) return;
    onApply(Math.floor(parsed));
    setIsEditing(false);
    setDraft("");
  };

  return (
    <li className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <p className="truncate font-medium text-white">{app.name}</p>
          <p
            className="truncate font-mono text-xs text-white/40"
            title={app.exePath}
          >
            {app.exePath}
          </p>
          <p className="mt-1 text-xs text-white/35">
            {t("internetLimit.processes", { count: app.processCount })} ·{" "}
            {Math.round(app.memoryBytes / 1024 / 1024)} MB
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {limit ? (
            <span className="rounded-full bg-amber-400/15 px-3 py-1 text-xs text-amber-200">
              {t("internetLimit.limited", {
                speed: formatSpeed(limit.limitKbps),
              })}
            </span>
          ) : (
            <span className="text-xs text-white/35">
              {t("internetLimit.unlimited")}
            </span>
          )}

          {limit && (
            <Button
              size="sm"
              variant="danger"
              onClick={onRemove}
              disabled={busy}
            >
              {t("internetLimit.remove")}
            </Button>
          )}

          {!isEditing && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setIsEditing(true)}
              disabled={busy}
            >
              {t("internetLimit.limit")}
            </Button>
          )}
        </div>
      </div>

      {isEditing && (
        <div className="mt-4 space-y-3 border-t border-white/[0.06] pt-4">
          <div className="flex flex-wrap gap-2">
            {SPEED_PRESETS_KBPS.map((preset) => (
              <Button
                key={preset}
                size="sm"
                variant="ghost"
                onClick={() => onApply(preset)}
                disabled={busy}
              >
                {formatSpeed(preset)}
              </Button>
            ))}
          </div>
          <form
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              submitDraft();
            }}
          >
            <div className="flex-1">
              <Input
                id={`limit-${app.exePath}`}
                label={t("internetLimit.speedLabel")}
                type="number"
                min={1}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={busy || !draft.trim()}>
                {t("internetLimit.apply")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setIsEditing(false);
                  setDraft("");
                }}
              >
                {t("internetLimit.cancel")}
              </Button>
            </div>
          </form>
        </div>
      )}
    </li>
  );
}
