export interface NetworkApp {
  name: string;
  exePath: string;
  processCount: number;
  memoryBytes: number;
}

export interface BandwidthLimit {
  policyName: string;
  exePath: string;
  limitKbps: number;
}

export interface NetworkTrafficRate {
  exePath: string;
  downloadBytesPerSecond: number;
  uploadBytesPerSecond: number;
}

export interface TrafficMonitorSnapshot {
  status: "idle" | "starting" | "running" | "error";
  error: string | null;
  apps: NetworkTrafficRate[];
  observedEventCount: number;
  decodedEventCount: number;
  unattributedBytes: number;
}

export const MAX_LIMIT_KBPS = 10_000_000;
