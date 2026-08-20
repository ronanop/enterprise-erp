/** @vitest-environment jsdom */

/**
 * Phase 4 Task 6 — E2E / regression coverage for navigation + inventory lifecycle.
 */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AssetInventoryContainer } from "@/components/assets/asset-inventory-container";
import {
  clearInventoryStale,
  markInventoryStale,
  peekInventoryStale,
} from "@/components/assets/inventory/inventory-refresh";
import {
  clearInventoryUiSnapshot,
  consumeInventoryUiSnapshot,
  saveInventoryUiSnapshot,
} from "@/components/assets/inventory/inventory-ui-state";
import { createAssetNavigation } from "@/components/assets/navigation/asset-navigation";
import {
  ASSIGNMENT_DEEP_LINKS,
  createAssignmentNavigation,
} from "@/components/assets/navigation/assignment-navigation";
import { EMPTY_INVENTORY_FILTERS } from "@/components/assets/shared";
import { assetOperationsService } from "@/services/assets-service";

const push = vi.fn();

vi.mock("@/components/assets/navigation/use-asset-navigation", () => ({
  useAssetNavigation: () => createAssetNavigation(push),
}));

vi.mock("@/hooks/use-user-permissions", () => ({
  useUserPermissions: () => ({ can: () => true, loading: false, user: null }),
}));

vi.mock("@/services/assets-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/assets-service")>();
  return {
    ...actual,
    assetCategoryService: { search: vi.fn().mockResolvedValue({ items: [] }) },
  };
});

vi.mock("@/lib/org-options", () => ({
  listBranchOptions: vi.fn().mockResolvedValue([{ id: "b1", label: "Noida" }]),
  listDepartmentOptions: vi.fn().mockResolvedValue([]),
  listEmployeeOptions: vi.fn().mockResolvedValue([]),
}));

const readyAsset = {
  id: "asset-99",
  asset_code: "AST-99",
  asset_name: "Surface",
  branch_id: "b1",
  operational_status: "READY_TO_MOVE",
  status: "active",
};

afterEach(() => {
  cleanup();
  push.mockClear();
  clearInventoryStale();
  clearInventoryUiSnapshot();
});

beforeEach(() => {
  clearInventoryStale();
  clearInventoryUiSnapshot();
  vi.spyOn(assetOperationsService, "listAssets").mockImplementation(() =>
    Promise.resolve({ items: [readyAsset], total: 1, page: 1, page_size: 25 }),
  );
  vi.spyOn(assetOperationsService, "listAssignments").mockImplementation(() =>
    Promise.resolve({ items: [], total: 0, page: 1, page_size: 200 }),
  );
});

describe("E2E — Inventory → Issue navigation", () => {
  it("Assign closes drawer and opens issue wizard once", async () => {
    const user = userEvent.setup();
    render(<AssetInventoryContainer />);
    await waitFor(() => expect(screen.getAllByText("AST-99")[0]).toBeInTheDocument());
    await user.click(screen.getAllByRole("button", { name: /View/ })[0]!);
    expect(screen.getByTestId("asset-detail-drawer")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "More actions" })[0]!);
    await user.click(screen.getByRole("menuitem", { name: "Allocate Asset" }));
    await waitFor(() => expect(screen.queryByTestId("asset-detail-drawer")).not.toBeInTheDocument());
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith(ASSIGNMENT_DEEP_LINKS.newAsset("asset-99"));
  });

  it("snapshots UI state before assign", async () => {
    const user = userEvent.setup();
    render(<AssetInventoryContainer />);
    await waitFor(() => expect(screen.getAllByText("AST-99")[0]).toBeInTheDocument());
    await user.click(screen.getAllByRole("button", { name: "More actions" })[0]!);
    await user.click(screen.getByRole("menuitem", { name: "Allocate Asset" }));
    const snap = consumeInventoryUiSnapshot();
    expect(snap).not.toBeNull();
    expect(snap?.preset).toBe("all");
  });
});

describe("E2E — refresh lifecycle (no duplicate)", () => {
  it("stale remount loads inventory without reloadToken storm", async () => {
    markInventoryStale({ reason: "issue", assetId: "asset-99" });
    render(<AssetInventoryContainer />);
    await waitFor(() => expect(assetOperationsService.listAssets).toHaveBeenCalled());
    await waitFor(() => expect(screen.getAllByText("AST-99")[0]).toBeInTheDocument());
    // lookup hydration may trigger a second load; stale must not add a third via reloadToken
    expect(vi.mocked(assetOperationsService.listAssets).mock.calls.length).toBeLessThanOrEqual(2);
    expect(peekInventoryStale()).toBe(false);
    expect(screen.queryByTestId("asset-detail-drawer")).not.toBeInTheDocument();
  });

  it("restores filters/search/page/branch from snapshot on remount", async () => {
    saveInventoryUiSnapshot({
      preset: "ready",
      headerBranchId: "b1",
      draftFilters: { ...EMPTY_INVENTORY_FILTERS, operationalStatus: "READY_TO_MOVE", search: "surf" },
      appliedFilters: {
        ...EMPTY_INVENTORY_FILTERS,
        operationalStatus: "READY_TO_MOVE",
        search: "surf",
      },
      quickSearch: "surf",
      page: 2,
    });
    markInventoryStale({ reason: "return", assetId: "asset-99" });
    render(<AssetInventoryContainer />);
    await waitFor(() => expect(assetOperationsService.listAssets).toHaveBeenCalled());
    // restored page/filters flow into list query
    await waitFor(() => {
      const calls = vi.mocked(assetOperationsService.listAssets).mock.calls;
      expect(calls.length).toBeGreaterThanOrEqual(1);
      const arg = calls[0]?.[0] as { page?: number; operational_status?: string } | undefined;
      expect(arg?.page).toBe(2);
      expect(arg?.operational_status).toBe("READY_TO_MOVE");
    });
  });
});

describe("E2E — AssignmentNavigation ↔ AssetNavigation parity", () => {
  it("AssetNavigation.assign matches AssignmentNavigation.openIssue href", () => {
    const assetPush = vi.fn();
    const asgPush = vi.fn();
    createAssetNavigation(assetPush).openAssignment("x");
    createAssignmentNavigation(asgPush).openIssue("x");
    expect(assetPush.mock.calls[0]?.[0]).toBe(asgPush.mock.calls[0]?.[0]);
  });

  it("AssetNavigation.return matches AssignmentNavigation.openReturn href", () => {
    const assetPush = vi.fn();
    const asgPush = vi.fn();
    createAssetNavigation(assetPush).openReturn("y");
    createAssignmentNavigation(asgPush).openReturn("y");
    expect(assetPush.mock.calls[0]?.[0]).toBe(asgPush.mock.calls[0]?.[0]);
  });
});

describe("E2E — browser navigation contracts (pure)", () => {
  it("cancel path equals inventory path", () => {
    const push = vi.fn();
    createAssignmentNavigation(push).openInventory();
    expect(push).toHaveBeenCalledWith("/assets/assets");
  });

  it("back to inventory after success uses same path as cancel", () => {
    const push = vi.fn();
    const nav = createAssignmentNavigation(push);
    nav.openInventory("a1");
    nav.openInventory("a1");
    expect(push).toHaveBeenCalledTimes(2);
    expect(push.mock.calls.every((c) => c[0] === "/assets/assets")).toBe(true);
  });
});
