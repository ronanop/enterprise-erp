/** @vitest-environment jsdom */

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AssetInventoryContainer,
  fetchInventoryPage,
} from "@/components/assets/asset-inventory-container";
import { createAssetNavigation } from "@/components/assets/navigation/asset-navigation";
import { BRANCH_ALL_VALUE, EMPTY_INVENTORY_FILTERS } from "@/components/assets/shared";
import { assetOperationsService } from "@/services/assets-service";

vi.mock("@/components/assets/navigation/use-asset-navigation", () => ({
  useAssetNavigation: () => createAssetNavigation(vi.fn()),
}));

vi.mock("@/hooks/use-user-permissions", () => ({
  useUserPermissions: () => ({
    can: () => true,
    loading: false,
    user: null,
  }),
}));

vi.mock("@/services/assets-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/assets-service")>();
  return {
    ...actual,
    assetCategoryService: {
      search: vi.fn().mockResolvedValue({ items: [] }),
    },
  };
});

vi.mock("@/lib/org-options", () => ({
  listBranchOptions: vi.fn().mockResolvedValue([{ id: "b1", label: "Noida" }]),
  listDepartmentOptions: vi.fn().mockResolvedValue([{ id: "d1", label: "IT" }]),
  listEmployeeOptions: vi.fn().mockResolvedValue([{ id: "e1", label: "Asha Nair (EMP-001)" }]),
}));

const assetItem = {
  id: "asset-1",
  asset_code: "AST-100",
  asset_name: "ThinkPad",
  branch_id: "b1",
  operational_status: "READY_TO_MOVE",
  status: "active",
};

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.spyOn(assetOperationsService, "listAssets").mockImplementation(() =>
    Promise.resolve({
      items: [assetItem],
      total: 1,
      page: 1,
      page_size: 25,
    }),
  );
  vi.spyOn(assetOperationsService, "listAssignments").mockImplementation(() =>
    Promise.resolve({
      items: [],
      total: 0,
      page: 1,
      page_size: 500,
    }),
  );
});

describe("fetchInventoryPage", () => {
  it("loads assets and assignments in parallel", async () => {
    const listAssets = vi.fn().mockResolvedValue({
      items: [assetItem],
      total: 1,
      page: 1,
      page_size: 25,
    });
    const listAssignments = vi.fn().mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 500,
    });
    await fetchInventoryPage({
      preset: "ready",
      filters: EMPTY_INVENTORY_FILTERS,
      headerBranchId: BRANCH_ALL_VALUE,
      page: 1,
      deps: { listAssets, listAssignments },
    });
    expect(listAssets).toHaveBeenCalledOnce();
    expect(listAssignments).toHaveBeenCalledOnce();
  });

  it("uses assetOperationsService when deps omitted", async () => {
    const result = await fetchInventoryPage({
      preset: "all",
      filters: EMPTY_INVENTORY_FILTERS,
      headerBranchId: BRANCH_ALL_VALUE,
      page: 1,
    });
    expect(assetOperationsService.listAssets).toHaveBeenCalled();
    expect(result.assetList.items).toHaveLength(1);
  });
});

describe("AssetInventoryContainer", () => {
  it("renders inventory workspace title", async () => {
    render(<AssetInventoryContainer />);
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "IT Asset Inventory" })).toBeInTheDocument();
    });
  });

  it("loads rows from API", async () => {
    render(<AssetInventoryContainer />);
    await waitFor(() => expect(assetOperationsService.listAssets).toHaveBeenCalled());
    expect(screen.getAllByText("AST-100")[0]).toBeInTheDocument();
  });

  it("applies ready preset filter to API", async () => {
    const user = userEvent.setup();
    render(<AssetInventoryContainer />);
    await waitFor(() => expect(assetOperationsService.listAssets).toHaveBeenCalled());
    await user.click(screen.getByRole("tab", { name: "Ready To Move" }));
    await waitFor(() => {
      expect(assetOperationsService.listAssets).toHaveBeenCalledWith(
        expect.objectContaining({ operational_status: "READY_TO_MOVE" }),
      );
    });
  });

  it("shows error card on failure", async () => {
    vi.mocked(assetOperationsService.listAssets).mockRejectedValue(new Error("boom"));
    render(<AssetInventoryContainer />);
    await waitFor(() => {
      expect(screen.getByTestId("inventory-error-card")).toBeInTheDocument();
    });
  });

  it("retries after error", async () => {
    const user = userEvent.setup();
    vi.mocked(assetOperationsService.listAssets).mockRejectedValueOnce(new Error("fail"));
    render(<AssetInventoryContainer />);
    await waitFor(() => screen.getByRole("button", { name: "Retry" }));
    vi.mocked(assetOperationsService.listAssets).mockImplementation(() =>
      Promise.resolve({
        items: [assetItem],
        total: 1,
        page: 1,
        page_size: 25,
      }),
    );
    await user.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(assetOperationsService.listAssets.mock.calls.length).toBeGreaterThanOrEqual(2));
    expect(screen.getAllByText("AST-100")[0]).toBeInTheDocument();
  });

  it("refetches when header branch changes", async () => {
    const user = userEvent.setup();
    render(<AssetInventoryContainer />);
    await waitFor(() => expect(assetOperationsService.listAssets).toHaveBeenCalled());
    const group = await screen.findByRole("group", { name: "Branch" });
    await waitFor(() => {
      expect(within(group).getByRole("button", { name: "Noida" })).toBeInTheDocument();
    });
    await user.click(within(group).getByRole("button", { name: "Noida" }));
    await waitFor(() => {
      expect(assetOperationsService.listAssets).toHaveBeenCalledWith(expect.objectContaining({ branch_id: "b1" }));
    });
  });
});
