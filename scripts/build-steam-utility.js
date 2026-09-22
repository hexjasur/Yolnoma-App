import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const project = resolve(root, "libs", "SteamUtility", "SteamUtility.csproj");
const output = resolve(root, "src-tauri", "resources", "steam-utility");
const runtime = process.platform === "win32" ? "win-x64" : "linux-x64";

mkdirSync(output, { recursive: true });

execFileSync(
  "dotnet",
  [
    "publish",
    project,
    "--configuration",
    "Release",
    "--runtime",
    runtime,
    "--self-contained",
    "true",
    "-p:PublishSingleFile=false",
    "-p:PublishTrimmed=true",
    "-p:DebugType=none",
    "--output",
    output,
  ],
  { cwd: root, stdio: "inherit" },
);

console.log(`[steam-utility] Published ${runtime} helper to ${output}`);
