/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InventoryActiveFilterChips, listActiveInventoryFilterChips } from "@/components/assets/inventory/inventory-filter-chips";
import { EMPTY_INVENTORY_FILTERS } from "@/components/assets/shared";

afterEach(() => cleanup());

describe("listActiveInventoryFilterChips", () => {
  it("only surfaces search chips after advanced filters were removed", () => {
    const chips = listActiveInventoryFilterChips({
      ...EMPTY_INVENTORY_FILTERS,
      operationalStatus: "ASSIGNED",
      branchId: "b1",
      search: "mac",
    }, { branches: [{ id: "b1", label: "Head Office" }] });
    expect(chips.map((c) => c.key)).toEqual(["search"]);
    expect(chips[0]?.label).toBe("Search: mac");
  });
});

describe("InventoryActiveFilterChips", () => {
  it("dismisses a search chip", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(
      <InventoryActiveFilterChips
        filters={{ ...EMPTY_INVENTORY_FILTERS, search: "dell" }}
        onDismiss={onDismiss}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Remove filter Search: dell/ }));
    expect(onDismiss).toHaveBeenCalledWith("search");
  });
});
