import { Broom, Box, Code2, Sparkles, Trash2 } from "lucide-react";
import tempFilesScript from "../../../../scripts/cleaner/temp-files.ps1?raw";
import recycleBinScript from "../../../../scripts/cleaner/recycle-bin.ps1?raw";
import directxShaderCacheScript from "../../../../scripts/cleaner/directx-shader-cache.ps1?raw";
import npmCacheScript from "../../../../scripts/cleaner/npm-cache.ps1?raw";
import pnpmCacheScript from "../../../../scripts/cleaner/pnpm-cache.ps1?raw";
import yarnCacheScript from "../../../../scripts/cleaner/yarn-cache.ps1?raw";
import cargoCacheScript from "../../../../scripts/cleaner/cargo-cache.ps1?raw";
import type { CleanupCategory, CleanupTask } from "../types";

export const CLEANUP_GROUPS: Array<{
  id: CleanupCategory;
  title: string;
  description: string;
}> = [
  {
    id: "windows",
    title: "Windows",
    description: "Temporary and regenerable system files.",
  },
  {
    id: "developer",
    title: "Developer tools",
    description: "Clean package caches without deleting your projects.",
  },
];

export const CLEANUP_TASKS: CleanupTask[] = [
  {
    id: "temp-files",
    category: "windows",
    name: "Temporary files",
    description: "Temporary files from your profile and Windows folders.",
    note: "Files currently in use are skipped.",
    icon: Broom,
    script: tempFilesScript,
  },
  {
    id: "recycle-bin",
    category: "windows",
    name: "Recycle Bin",
    description: "Empty the Recycle Bin on local drives.",
    note: "Deleted files cannot be restored afterward.",
    icon: Trash2,
    warning: true,
    script: recycleBinScript,
  },
  {
    id: "directx-shader-cache",
    category: "windows",
    name: "DirectX shader cache",
    description: "Shader files that games can regenerate.",
    note: "Some games may take longer to start once afterward.",
    icon: Sparkles,
    script: directxShaderCacheScript,
  },
  {
    id: "npm-cache",
    category: "developer",
    name: "npm cache",
    description: "Packages downloaded by npm.",
    note: "Skipped automatically if npm is not installed.",
    icon: Code2,
    script: npmCacheScript,
  },
  {
    id: "pnpm-cache",
    category: "developer",
    name: "pnpm store",
    description: "Prune package versions that are no longer in use.",
    note: "Project files and installed modules are not removed.",
    icon: Box,
    script: pnpmCacheScript,
  },
  {
    id: "yarn-cache",
    category: "developer",
    name: "Yarn cache",
    description: "Packages downloaded by Yarn.",
    note: "Skipped automatically if Yarn is not installed.",
    icon: Code2,
    script: yarnCacheScript,
  },
  {
    id: "cargo-cache",
    category: "developer",
    name: "Cargo cache",
    description: "Rust registry and Git dependency caches.",
    note: "Dependencies are downloaded again when needed.",
    icon: Box,
    script: cargoCacheScript,
  },
];
