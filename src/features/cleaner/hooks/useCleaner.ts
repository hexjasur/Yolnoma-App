import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  CleanupId,
  CleanupTask,
  CleanerRunResult,
  RunState,
} from "../types";

export function useCleaner() {
  const [selected, setSelected] = useState<CleanupId[]>([]);
  const [runState, setRunState] = useState<RunState>("idle");
  const [statusMessage, setStatusMessage] = useState("Select items to clean.");
  const [completedCount, setCompletedCount] = useState(0);
  const [activeTask, setActiveTask] = useState("");

  const toggleTask = (id: CleanupId) => {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((taskId) => taskId !== id)
        : [...current, id],
    );
    setRunState("idle");
    setCompletedCount(0);
    setActiveTask("");
    setStatusMessage("Selection updated. Review your choices before running.");
  };

  const runCleaner = async (tasks: CleanupTask[]) => {
    if (!tasks.length || runState === "running") return;

    setRunState("running");
    setCompletedCount(0);
    setStatusMessage(
      `${tasks.length} ${tasks.length === 1 ? "task" : "tasks"} queued.`,
    );

    for (const [index, task] of tasks.entries()) {
      setActiveTask(task.name);
      setStatusMessage(
        `${index + 1}/${tasks.length} · ${task.name} is running…`,
      );
      try {
        await invoke<CleanerRunResult>("run_cleaner", { actions: [task.id] });
        setCompletedCount(index + 1);
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        setRunState("error");
        setActiveTask("");
        const completedNote =
          index > 0
            ? ` (${index} ${index === 1 ? "task" : "tasks"} completed)`
            : "";
        setStatusMessage(`${task.name} failed${completedNote}. ${detail}`);
        return;
      }
    }

    setRunState("success");
    setActiveTask("");
    setStatusMessage(
      `${tasks.length} ${tasks.length === 1 ? "task" : "tasks"} completed successfully.`,
    );
  };

  return {
    selected,
    runState,
    statusMessage,
    completedCount,
    activeTask,
    toggleTask,
    runCleaner,
  };
}
