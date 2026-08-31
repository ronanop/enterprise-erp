/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { IssuedItemsStep } from "@/components/assets/assignment-wizard/steps/issued-items-step";
import { EMPTY_ASSIGNMENT_WIZARD_STATE } from "@/components/assets/assignment-wizard/wizard-types";

afterEach(() => cleanup());

describe("IssuedItemsStep 4C", () => {
  it("renders type, name, and serial for real components", () => {
    render(
      <IssuedItemsStep
        state={EMPTY_ASSIGNMENT_WIZARD_STATE}
        onChange={() => undefined}
        items={[
          {
            id: "c1",
            label: "Charger",
            status: "active",
            componentName: "Dell 65W",
            serialNumber: "CHG001",
          },
          {
            id: "c2",
            label: "Mouse",
            status: "active",
            componentName: "Logitech",
            serialNumber: null,
          },
        ]}
      />,
    );
    expect(screen.getByText("Charger")).toBeInTheDocument();
    expect(screen.getByText("Dell 65W")).toBeInTheDocument();
    expect(screen.getByText("S/N: CHG001")).toBeInTheDocument();
    expect(screen.getByText("S/N: —")).toBeInTheDocument();
  });

  it("disables currently issued components", async () => {
    const user = userEvent.setup();
    let ids: string[] = [];
    render(
      <IssuedItemsStep
        state={EMPTY_ASSIGNMENT_WIZARD_STATE}
        onChange={(p) => {
          ids = p.issuedItemIds ?? ids;
        }}
        items={[
          {
            id: "c1",
            label: "Keyboard",
            status: "Currently issued",
            disabled: true,
            componentName: "Dell",
            serialNumber: "KEY001",
          },
        ]}
      />,
    );
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeDisabled();
    await user.click(checkbox);
    expect(ids).toEqual([]);
  });
});
