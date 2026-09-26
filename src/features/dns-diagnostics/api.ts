import { invoke } from "@tauri-apps/api/core";
import type { DnsQueryResult, DnsRecordType, DnsResolver } from "./types";

export function diagnoseDns(
  domain: string,
  recordTypes: DnsRecordType[],
  resolver: DnsResolver,
) {
  return invoke<DnsQueryResult[]>("diagnose_dns", {
    domain,
    recordTypes,
    resolver,
  });
}
