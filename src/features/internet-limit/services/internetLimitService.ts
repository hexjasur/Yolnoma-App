import { invoke } from "@tauri-apps/api/core";
import type {
  BandwidthLimit,
  NetworkApp,
  TrafficMonitorSnapshot,
} from "../types";

export function startNetworkTrafficMonitor(): Promise<void> {
  return invoke<void>("start_network_traffic_monitor");
}

export function getNetworkTrafficSnapshot(): Promise<TrafficMonitorSnapshot> {
  return invoke<TrafficMonitorSnapshot>("get_network_traffic_snapshot");
}

export function listNetworkApps(): Promise<NetworkApp[]> {
  return invoke<NetworkApp[]>("list_network_apps");
}

export function listBandwidthLimits(): Promise<BandwidthLimit[]> {
  return invoke<BandwidthLimit[]>("list_bandwidth_limits");
}

export function setAppBandwidthLimit(
  exePath: string,
  limitKbps: number,
): Promise<BandwidthLimit> {
  return invoke<BandwidthLimit>("set_app_bandwidth_limit", {
    exePath,
    limitKbps,
  });
}

export function removeAppBandwidthLimit(policyName: string): Promise<void> {
  return invoke<void>("remove_app_bandwidth_limit", { policyName });
}
