import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SelectMenu from "./SelectMenu";

describe("SelectMenu", () => {
  it("keeps large option lists inside a capped, internally scrollable menu", () => {
    const options = Array.from({ length: 1000 }, (_, index) => ({
      value: `model-${index}`,
      label: `Model ${index}`,
    }));
    const onChange = vi.fn();

    render(
      <SelectMenu
        value="model-0"
        options={options}
        onChange={onChange}
        ariaLabel="Select AI model"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Select AI model" }));
    const listbox = screen.getByRole("listbox", { name: "Select AI model" });

    expect(listbox).toHaveClass("max-h-[min(24rem,60vh)]");
    expect(listbox).toHaveClass("overflow-y-auto");
    expect(screen.getAllByRole("option")).toHaveLength(1000);

    fireEvent.click(screen.getByRole("option", { name: "Model 999" }));
    expect(onChange).toHaveBeenCalledWith("model-999");
  });
});
