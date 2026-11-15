import { useTranslation } from "react-i18next";
import type { TechDetection, TechScanResult } from "../types";

interface TechScanResultsProps {
  result: TechScanResult;
}

function groupByCategory(items: TechDetection[]): [string, TechDetection[]][] {
  const groups = new Map<string, TechDetection[]>();
  for (const item of items) {
    const list = groups.get(item.category) ?? [];
    list.push(item);
    groups.set(item.category, list);
  }
  return [...groups.entries()];
}

function DetectionGroup({
  items,
  emptyLabel,
}: {
  items: TechDetection[];
  emptyLabel: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-white/35">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-4">
      {groupByCategory(items).map(([category, list]) => (
        <div key={category}>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-white/40">
            {category}
          </p>
          <ul className="flex flex-wrap gap-2">
            {list.map((item) => (
              <li
                key={`${item.category}-${item.name}`}
                title={item.evidence}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-sm text-white/85"
              >
                {item.name}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function TechScanResults({ result }: TechScanResultsProps) {
  const { t } = useTranslation();
  const headerEntries = Object.entries(result.headers).sort(([a], [b]) =>
    a.localeCompare(b),
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
          <p className="text-[11px] uppercase tracking-[0.15em] text-white/40">
            {t("techScan.host")}
          </p>
          <p className="mt-2 break-all font-medium text-white">{result.host}</p>
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
          <p className="text-[11px] uppercase tracking-[0.15em] text-white/40">
            {t("techScan.status")}
          </p>
          <p className="mt-2 font-medium text-white">{result.status}</p>
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
          <p className="text-[11px] uppercase tracking-[0.15em] text-white/40">
            {t("techScan.generator")}
          </p>
          <p className="mt-2 break-words font-medium text-white">
            {result.generator ?? t("techScan.notFound")}
          </p>
        </div>
      </div>

      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
        <h2 className="mb-4 font-serif text-xl text-white">
          {t("techScan.technologies")}
        </h2>
        <DetectionGroup
          items={result.technologies}
          emptyLabel={t("techScan.noTechnologies")}
        />
      </section>

      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
        <h2 className="mb-4 font-serif text-xl text-white">
          {t("techScan.hosting")}
        </h2>
        <DetectionGroup
          items={result.hosting}
          emptyLabel={t("techScan.noHosting")}
        />
        {(result.nameServers.length > 0 || result.cnameRecords.length > 0) && (
          <div className="mt-5 space-y-1 text-xs text-white/45">
            {result.nameServers.map((ns) => (
              <p key={`ns-${ns}`}>NS: {ns}</p>
            ))}
            {result.cnameRecords.map((cname) => (
              <p key={`cname-${cname}`}>CNAME: {cname}</p>
            ))}
          </div>
        )}
      </section>

      <details className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
        <summary className="cursor-pointer font-serif text-xl text-white">
          {t("techScan.headers", { count: headerEntries.length })}
        </summary>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <tbody>
              {headerEntries.map(([name, value]) => (
                <tr
                  key={name}
                  className="border-t border-white/[0.06] align-top"
                >
                  <th className="w-1/3 py-2 pr-4 font-mono text-xs text-white/60">
                    {name}
                  </th>
                  <td className="break-all py-2 font-mono text-xs text-white/85">
                    {value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
