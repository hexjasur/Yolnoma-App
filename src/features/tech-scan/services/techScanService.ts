import { invoke } from "@tauri-apps/api/core";
import type { TechScanResult } from "../types";

export function scanWebsiteTech(url: string): Promise<TechScanResult> {
  return invoke<TechScanResult>("scan_website_tech", { url });
}
