import { beforeEach, describe, expect, it } from "vitest";

import {
  clearInventoryUiSnapshot,
  consumeInventoryUiSnapshot,
  peekInventoryUiSnapshot,
  saveInventoryUiSnapshot,
  type InventoryUiSnapshot,
} from "@/components/assets/inventory/inventory-ui-state";
import { EMPTY_INVENTORY_FILTERS } from "@/components/assets/shared";

const sample: InventoryUiSnapshot = {
  preset: "assigned",
  headerBranchId: "branch-1",
  draftFilters: { ...EMPTY_INVENTORY_FILTERS, operationalStatus: "ASSIGNED", search: "lap" },
  appliedFilters: { ...EMPTY_INVENTORY_FILTERS, operationalStatus: "ASSIGNED", search: "lap" },
  quickSearch: "lap",
  page: 3,
};

beforeEach(() => {
  clearInventoryUiSnapshot();
});

describe("inventory UI snapshot", () => {
  it("saves and consumes snapshot", () => {
    saveInventoryUiSnapshot(sample);
    expect(consumeInventoryUiSnapshot()).toEqual(sample);
  });

  it("consume clears snapshot", () => {
    saveInventoryUiSnapshot(sample);
    consumeInventoryUiSnapshot();
    expect(consumeInventoryUiSnapshot()).toBeNull();
  });

  it("returns null when empty", () => {
    expect(consumeInventoryUiSnapshot()).toBeNull();
  });

  it("preserves search / filters / page / branch / ops status", () => {
    saveInventoryUiSnapshot(sample);
    const snap = consumeInventoryUiSnapshot();
    expect(snap?.quickSearch).toBe("lap");
    expect(snap?.appliedFilters.operationalStatus).toBe("ASSIGNED");
    expect(snap?.page).toBe(3);
    expect(snap?.headerBranchId).toBe("branch-1");
    expect(snap?.preset).toBe("assigned");
  });

  it("clearInventoryUiSnapshot removes key", () => {
    saveInventoryUiSnapshot(sample);
    clearInventoryUiSnapshot();
    expect(consumeInventoryUiSnapshot()).toBeNull();
  });

  it("rejects corrupt JSON", () => {
    sessionStorage.setItem("cr004.inventory.uiState", "{bad");
    expect(peekInventoryUiSnapshot()).toBeNull();
  });

  it("defaults invalid page to 1", () => {
    saveInventoryUiSnapshot({ ...sample, page: 0 });
    expect(consumeInventoryUiSnapshot()?.page).toBe(1);
  });
});
