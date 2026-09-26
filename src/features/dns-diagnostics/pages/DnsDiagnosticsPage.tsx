import { useState, type FormEvent } from "react";
import { AlertCircle, Check, Clock3, Globe, Search } from "lucide-react";
import { Button } from "@/shared/ui";
import { diagnoseDns } from "../api";
import {
  DNS_RECORD_TYPES,
  type DnsQueryResult,
  type DnsRecordType,
  type DnsResolver,
} from "../types";

const DEFAULT_RECORDS: DnsRecordType[] = ["A", "AAAA", "MX", "TXT", "NS"];

export default function DnsDiagnosticsPage() {
  const [domain, setDomain] = useState("");
  const [resolver, setResolver] = useState<DnsResolver>("cloudflare");
  const [recordTypes, setRecordTypes] =
    useState<DnsRecordType[]>(DEFAULT_RECORDS);
  const [results, setResults] = useState<DnsQueryResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const toggleRecordType = (recordType: DnsRecordType) => {
    setRecordTypes((current) =>
      current.includes(recordType)
        ? current.filter((item) => item !== recordType)
        : [...current, recordType],
    );
  };

  const runDiagnostics = async (event: FormEvent) => {
    event.preventDefault();
    if (!domain.trim()) {
      setError("Enter a domain name to look up.");
      return;
    }
    if (!recordTypes.length) {
      setError("Select at least one DNS record type.");
      return;
    }

    setLoading(true);
    setError("");
    setResults([]);
    try {
      setResults(await diagnoseDns(domain, recordTypes, resolver));
    } catch (lookupError) {
      setError(
        lookupError instanceof Error
          ? lookupError.message
          : String(lookupError),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto min-h-full w-full max-w-5xl space-y-6 p-5 pb-12 text-[var(--text-primary)] sm:p-7">
      <header className="border-b border-[var(--border)] pb-5">
        <div className="mb-2 flex items-center gap-2 text-[var(--accent)]">
          <Globe size={19} />
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em]">
            Network Utility
          </span>
        </div>
        <h1 className="font-serif text-3xl font-medium">DNS Diagnostics</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Query common DNS records and compare public resolver responses.
        </p>
      </header>

      <form
        onSubmit={runDiagnostics}
        className="space-y-5 border-b border-[var(--border)] pb-6"
      >
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_200px]">
          <label className="space-y-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Domain
            <input
              value={domain}
              onChange={(event) => setDomain(event.target.value)}
              placeholder="example.com"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              disabled={loading}
              className="block w-full rounded-lg border border-[var(--border)] bg-white/[0.03] px-3.5 py-3 font-mono text-sm normal-case tracking-normal text-[var(--text-primary)] outline-none focus:border-[var(--accent-border)]"
            />
          </label>
          <label className="space-y-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Resolver
            <select
              value={resolver}
              onChange={(event) =>
                setResolver(event.target.value as DnsResolver)
              }
              disabled={loading}
              className="block w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3.5 py-3 text-sm normal-case tracking-normal text-[var(--text-primary)] outline-none focus:border-[var(--accent-border)]"
            >
              <option value="cloudflare">Cloudflare · 1.1.1.1</option>
              <option value="google">Google · 8.8.8.8</option>
            </select>
          </label>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Record types
          </legend>
          <div className="flex flex-wrap gap-2">
            {DNS_RECORD_TYPES.map((recordType) => {
              const selected = recordTypes.includes(recordType);
              return (
                <label
                  key={recordType}
                  className={`inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-xs font-semibold transition-colors ${
                    selected
                      ? "border-[var(--accent-border)] bg-[var(--accent-dim)] text-[var(--accent)]"
                      : "border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleRecordType(recordType)}
                    disabled={loading}
                    className="sr-only"
                  />
                  {recordType}
                </label>
              );
            })}
          </div>
        </fieldset>

        <Button type="submit" loading={loading} disabled={loading}>
          <Search size={15} /> Look up DNS
        </Button>
      </form>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-red-400/20 bg-red-400/10 px-3.5 py-3 text-sm text-red-200"
        >
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {results.length > 0 && (
        <section aria-label="DNS results" className="space-y-3">
          {results.map((result) => (
            <article
              key={result.recordType}
              className="border-b border-[var(--border)] py-4 last:border-b-0"
            >
              <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h2 className="font-mono text-sm font-bold text-[var(--text-primary)]">
                    {result.recordType}
                  </h2>
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] ${result.status === "NOERROR" ? "text-emerald-400" : "text-amber-300"}`}
                  >
                    {result.status === "NOERROR" ? (
                      <Check size={13} />
                    ) : (
                      <AlertCircle size={13} />
                    )}
                    {result.status}
                  </span>
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                  <Clock3 size={13} /> {result.durationMs} ms ·{" "}
                  {result.resolver}
                </span>
              </header>

              {result.error ? (
                <p className="text-sm text-red-200">{result.error}</p>
              ) : result.answers.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] border-collapse text-left text-xs">
                    <thead className="text-[var(--text-faint)]">
                      <tr>
                        <th className="pb-2 pr-4 font-medium">Name</th>
                        <th className="pb-2 pr-4 font-medium">Type</th>
                        <th className="pb-2 pr-4 font-medium">TTL</th>
                        <th className="pb-2 font-medium">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.answers.map((answer, index) => (
                        <tr
                          key={`${answer.name}-${answer.recordType}-${index}`}
                          className="border-t border-[var(--border)]"
                        >
                          <td className="max-w-48 truncate py-2.5 pr-4 font-mono text-[var(--text-muted)]">
                            {answer.name}
                          </td>
                          <td className="py-2.5 pr-4 font-mono">
                            {answer.recordType}
                          </td>
                          <td className="py-2.5 pr-4 tabular-nums text-[var(--text-muted)]">
                            {answer.ttl}s
                          </td>
                          <td className="break-all py-2.5 font-mono text-[var(--text-primary)]">
                            {answer.data}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-[var(--text-muted)]">
                  No records returned for this query.
                </p>
              )}
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
