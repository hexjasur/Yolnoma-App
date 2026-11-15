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

export const MAX_LIMIT_KBPS = 10_000_000;
