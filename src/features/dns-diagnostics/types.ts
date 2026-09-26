export const DNS_RECORD_TYPES = [
  "A",
  "AAAA",
  "CNAME",
  "MX",
  "NS",
  "TXT",
  "CAA",
  "SOA",
] as const;

export type DnsRecordType = (typeof DNS_RECORD_TYPES)[number];

export type DnsRecord = {
  name: string;
  recordType: string;
  ttl: number;
  data: string;
};

export type DnsQueryResult = {
  resolver: string;
  recordType: string;
  status: string;
  statusCode: number;
  durationMs: number;
  answers: DnsRecord[];
  error: string | null;
};

export type DnsResolver = "cloudflare" | "google";
