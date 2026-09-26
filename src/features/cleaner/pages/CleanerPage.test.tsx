import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import CleanerPage from "./CleanerPage";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

describe("CleanerPage", () => {
  beforeEach(() => {
    vi.mocked(invoke).mockResolvedValue({
      completedActions: 1,
      message: "Cleanup completed.",
    });
  });

  it("runs only the selected task and shows the completed status", async () => {
    render(<CleanerPage />);

    fireEvent.click(screen.getByRole("button", { name: /Temporary files/ }));
    fireEvent.click(screen.getByRole("button", { name: /Run cleanup · 1/ }));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("run_cleaner", {
        actions: ["temp-files"],
      });
      expect(screen.getByRole("status")).toHaveTextContent(
        "1 task completed successfully. Cleanup completed.",
      );
    });
  });

  it("shows backend errors instead of a false success state", async () => {
    vi.mocked(invoke).mockRejectedValueOnce("PowerShell could not be started.");
    render(<CleanerPage />);

    fireEvent.click(screen.getByRole("button", { name: /npm cache/ }));
    fireEvent.click(screen.getByRole("button", { name: /Run cleanup · 1/ }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        "npm cache failed. PowerShell could not be started.",
      );
    });
  });

  it("locks task selection and shows progress while a task is running", async () => {
    let finishTask:
      | ((result: { completedActions: number; message: string }) => void)
      | undefined;
    vi.mocked(invoke).mockReturnValue(
      new Promise((resolve) => {
        finishTask = resolve;
      }),
    );
    render(<CleanerPage />);

    const taskButton = screen.getByRole("button", { name: /Temporary files/ });
    fireEvent.click(taskButton);
    fireEvent.click(screen.getByRole("button", { name: /Run cleanup · 1/ }));

    expect(taskButton).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "1/1 · Temporary files is running",
    );
    finishTask?.({ completedActions: 1, message: "Cleanup completed." });
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "1 task completed successfully. Cleanup completed.",
      ),
    );
  });
});
