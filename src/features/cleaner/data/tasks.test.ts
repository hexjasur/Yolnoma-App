import { describe, expect, it } from "vitest";
import { CLEANUP_TASKS } from "./tasks";

describe("Cleaner task registry", () => {
  it("maps every cleanup task to a reviewed standalone script", () => {
    expect(CLEANUP_TASKS.length).toBe(9);
    for (const task of CLEANUP_TASKS) {
      expect(task.script.trim(), `${task.id} script`).not.toBe("");
    }
  });

  it("does not expose Windows Update cache cleanup", () => {
    expect(CLEANUP_TASKS.map((task) => task.id)).not.toContain(
      "windows-update-cache",
    );
  });

  it("keeps destructive Recycle Bin cleanup clearly marked", () => {
    expect(
      CLEANUP_TASKS.find((task) => task.id === "recycle-bin")?.warning,
    ).toBe(true);
  });

  it("skips locked temporary and shader files instead of failing the whole task", () => {
    for (const id of ["temp-files", "directx-shader-cache"] as const) {
      const script = CLEANUP_TASKS.find((task) => task.id === id)?.script ?? "";
      expect(script).toContain("catch");
      expect(script).toContain("skipped");
    }
  });

  it("removes npm cache files directly without invoking npm or PowerShell shims", () => {
    const script =
      CLEANUP_TASKS.find((task) => task.id === "npm-cache")?.script ?? "";
    expect(script).toContain("$env:LOCALAPPDATA");
    expect(script).toContain("npm-cache");
    expect(script).toContain("Remove-Item");
    expect(script).not.toMatch(/^\s*&\s*npm\.cmd\b/m);
  });

  it("includes Bun cache and the four AMD cache directories from the screenshot", () => {
    const bunScript =
      CLEANUP_TASKS.find((task) => task.id === "bun-cache")?.script ?? "";
    const amdScript =
      CLEANUP_TASKS.find((task) => task.id === "amd-cache")?.script ?? "";
    expect(bunScript).toContain(".bun\\install\\cache");
    for (const folder of ["DxCache", "DxcCache", "OglCache", "VkCache"]) {
      expect(amdScript).toContain(folder);
    }
  });
});
