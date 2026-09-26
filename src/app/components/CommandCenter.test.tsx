import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CommandCenter from "./CommandCenter";

vi.mock("@/shared/lib/window", () => ({ openAgentWindow: vi.fn() }));

describe("CommandCenter AI workspaces", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.location.hash = "#/";
  });

  it.each([
    ["Database Generator", "database", "#/tools/ai-tools?tab=database-gen"],
    ["README Generator", "readme", "#/tools/ai-tools?tab=readme-generator"],
  ])(
    "finds and opens the AI %s workspace from Ctrl+K",
    (_label, query, path) => {
      render(<CommandCenter />);

      fireEvent.keyDown(window, { key: "k", ctrlKey: true });
      fireEvent.change(
        screen.getByRole("textbox", { name: "Search commands" }),
        {
          target: { value: query },
        },
      );

      const result = screen.getByRole("button", {
        name: new RegExp(`AI Tools · ${_label}`),
      });
      fireEvent.click(result);

      expect(window.location.hash).toBe(path);
    },
  );
});
