/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InventoryActiveFilterChips, listActiveInventoryFilterChips } from "@/components/assets/inventory/inventory-filter-chips";
import { EMPTY_INVENTORY_FILTERS } from "@/components/assets/shared";

afterEach(() => cleanup());

describe("listActiveInventoryFilterChips", () => {
  it("omits operational status and empty defaults", () => {
    const chips = listActiveInventoryFilterChips({
      ...EMPTY_INVENTORY_FILTERS,
      operationalStatus: "ASSIGNED",
      branchId: "b1",
      search: "mac",
    }, { branches: [{ id: "b1", label: "Head Office" }] });
    expect(chips.map((c) => c.key)).toEqual(["search", "branchId"]);
    expect(chips[1]?.label).toBe("Branch: Head Office");
  });
});

describe("InventoryActiveFilterChips", () => {
  it("dismisses a chip", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(
      <InventoryActiveFilterChips
        filters={{ ...EMPTY_INVENTORY_FILTERS, lifecycleStatus: "active" }}
        onDismiss={onDismiss}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Remove filter Lifecycle: Active/ }));
    expect(onDismiss).toHaveBeenCalledWith("lifecycleStatus");
  });
});
