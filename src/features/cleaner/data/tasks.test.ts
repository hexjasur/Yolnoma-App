import { describe, expect, it } from "vitest";
import { CLEANUP_TASKS } from "./tasks";

describe("Cleaner task registry", () => {
  it("maps every cleanup task to a reviewed standalone script", () => {
    expect(CLEANUP_TASKS.length).toBe(7);
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
});
