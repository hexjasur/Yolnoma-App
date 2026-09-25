import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const sourceDir = join(root, "libs", "SteamUtility");
const outputDir = join(root, "src-tauri", "resources", "steam-utility");
const outputName =
  process.platform === "win32" ? "SteamUtility.exe" : "SteamUtility";
const outputPath = join(outputDir, outputName);
const ignoredDirs = new Set(["bin", "obj"]);

function newestSourceMtime(dir) {
  let newest = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (ignoredDirs.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      newest = Math.max(newest, newestSourceMtime(path));
    } else if (
      entry.name.endsWith(".cs") ||
      entry.name.endsWith(".csproj") ||
      entry.name.endsWith(".dll")
    ) {
      newest = Math.max(newest, statSync(path).mtimeMs);
    }
  }
  return newest;
}

if (!existsSync(sourceDir)) {
  console.warn(
    "[ensure-steam-utility-built] Source directory not found; skipping helper rebuild.",
  );
  process.exit(0);
}

const sourceMtime = newestSourceMtime(sourceDir);
const outputMtime = existsSync(outputPath) ? statSync(outputPath).mtimeMs : 0;

if (!outputMtime || sourceMtime > outputMtime) {
  console.warn(
    "[ensure-steam-utility-built] Source is newer than the bundled helper; rebuilding...",
  );
  execFileSync("bun", ["run", "build:libs"], { cwd: root, stdio: "inherit" });
} else {
  console.log(
    "[ensure-steam-utility-built] SteamUtility is up to date; skipping rebuild.",
  );
}
