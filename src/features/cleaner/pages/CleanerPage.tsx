import {
  Check,
  CircleAlert,
  LoaderCircle,
  Play,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/shared/ui";
import { CLEANUP_GROUPS, CLEANUP_TASKS } from "../data/tasks";
import { ScriptPreview } from "../components/ScriptPreview";
import { useCleaner } from "../hooks/useCleaner";
import type { CleanupTask } from "../types";
import "./cleaner.css";

function CleanerPage() {
  const {
    selected,
    runState,
    statusMessage,
    completedCount,
    activeTask,
    toggleTask,
    runCleaner,
  } = useCleaner();
  const selectedTasks = CLEANUP_TASKS.filter((task) =>
    selected.includes(task.id),
  );
  const selectedCount = selectedTasks.length;
  const progress =
    selectedCount === 0
      ? 0
      : Math.round(
          ((completedCount + (runState === "running" ? 0.35 : 0)) /
            selectedCount) *
            100,
        );
  const previewScript = selectedTasks.length
    ? selectedTasks
        .map((task) => `# ── ${task.name} ──\n${task.script.trim()}`)
        .join("\n\n")
    : "# Choose one or more tasks to inspect the exact script.";

  const taskList = (tasks: CleanupTask[]) => {
    const groupSelection = tasks.filter((task) =>
      selected.includes(task.id),
    ).length;
    const group = CLEANUP_GROUPS.find((item) => item.id === tasks[0]?.category);
    return (
      <section className="cleaner-group" key={tasks[0]?.category}>
        <div className="cleaner-group-heading">
          <div>
            <h2>{group?.title}</h2>
            <p>{group?.description}</p>
          </div>
          <span className="cleaner-group-count">
            {groupSelection}/{tasks.length}
          </span>
        </div>
        <div className="cleaner-task-list">
          {tasks.map((task) => {
            const Icon = task.icon;
            const isSelected = selected.includes(task.id);
            return (
              <button
                key={task.id}
                type="button"
                className="cleaner-task"
                disabled={runState === "running"}
                onClick={() => toggleTask(task.id)}
                aria-pressed={isSelected}
              >
                <span className="cleaner-task-icon">
                  <Icon size={15} strokeWidth={1.8} />
                </span>
                <span className="cleaner-task-copy">
                  <span className="cleaner-task-title">
                    {task.name}
                    {task.warning && (
                      <span className="cleaner-warning">Permanent</span>
                    )}
                  </span>
                  <span className="cleaner-task-description">
                    {task.description}
                  </span>
                  <span className="cleaner-task-note">
                    <CircleAlert size={11} />
                    {task.note}
                  </span>
                </span>
                <span className="cleaner-check" aria-hidden="true">
                  {isSelected && <Check size={12} strokeWidth={3} />}
                </span>
              </button>
            );
          })}
        </div>
      </section>
    );
  };

  return (
    <main className="cleaner-page">
      <header className="cleaner-header">
        <div>
          <p className="cleaner-eyebrow">
            <Sparkles size={12} /> System care
          </p>
          <h1>Cleaner v0.2</h1>
          <p className="cleaner-subtitle">
            Choose what to clean. Review the script, then run it.
          </p>
        </div>
        <Button
          className="cleaner-run-button"
          onClick={() => void runCleaner(selectedTasks)}
          loading={runState === "running"}
          disabled={selectedCount === 0 || runState === "running"}
          aria-describedby="cleaner-selection-status"
          title={
            selectedCount === 0
              ? "Select a task first"
              : "Run the selected cleanup tasks"
          }
        >
          {runState === "running" ? (
            "Working…"
          ) : (
            <>
              <Play size={14} fill="currentColor" /> Run cleanup
              {selectedCount > 0 ? ` · ${selectedCount}` : ""}
            </>
          )}
        </Button>
      </header>

      <span id="cleaner-selection-status" className="sr-only">
        {selectedCount} {selectedCount === 1 ? "task" : "tasks"} selected.
      </span>
      <p className="cleaner-notice">
        <ShieldCheck size={15} />
        Only reviewed cleanup actions run. Choose the Recycle Bin option only if
        you are sure you do not need its contents.
      </p>

      <div className="cleaner-groups">
        {CLEANUP_GROUPS.map((group) =>
          taskList(CLEANUP_TASKS.filter((task) => task.category === group.id)),
        )}
      </div>

      {runState !== "idle" && (
        <section
          className={`cleaner-progress is-${runState}`}
          role="status"
          aria-live="polite"
        >
          <div className="cleaner-progress-copy">
            {runState === "running" ? (
              <LoaderCircle size={15} className="animate-spin-slow" />
            ) : runState === "success" ? (
              <Check size={15} />
            ) : (
              <CircleAlert size={15} />
            )}
            <span>
              {statusMessage}
              {activeTask && runState === "running"
                ? ` (${completedCount}/${selectedCount} finished)`
                : ""}
            </span>
          </div>
          <div
            className={`cleaner-progress-track${runState === "running" ? " is-running" : ""}`}
            aria-label={`${progress}% complete`}
          >
            <span style={{ width: `${Math.min(100, progress)}%` }} />
          </div>
        </section>
      )}

      <ScriptPreview script={previewScript} />
    </main>
  );
}

export default CleanerPage;
