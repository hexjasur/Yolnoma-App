import type { LucideIcon } from "lucide-react";

export type CleanupId =
  | "temp-files"
  | "recycle-bin"
  | "directx-shader-cache"
  | "amd-cache"
  | "npm-cache"
  | "pnpm-cache"
  | "yarn-cache"
  | "cargo-cache"
  | "bun-cache";
export type CleanupCategory = "windows" | "developer";
export type RunState = "idle" | "running" | "success" | "error";

export interface CleanupTask {
  id: CleanupId;
  category: CleanupCategory;
  name: string;
  description: string;
  note: string;
  warning?: boolean;
  icon: LucideIcon;
  script: string;
}

export interface CleanerRunResult {
  completedActions: number;
  message: string;
}
