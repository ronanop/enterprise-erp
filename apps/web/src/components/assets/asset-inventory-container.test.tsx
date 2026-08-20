/** @vitest-environment jsdom */

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AssetInventoryContainer,
  fetchInventoryPage,
} from "@/components/assets/asset-inventory-container";
import { stashInventoryArrival } from "@/components/assets/inventory/inventory-arrival";
import { stashInventoryFocusAsset } from "@/components/assets/inventory/inventory-focus";
import { saveInventoryUiSnapshot } from "@/components/assets/inventory/inventory-ui-state";
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
  sessionStorage.clear();
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
      page_size: 200,
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
      page_size: 200,
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
      expect(screen.getByRole("heading", { name: "Asset Register" })).toBeInTheDocument();
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

  it("shows success toast on registration arrival", async () => {
    stashInventoryArrival({
      reason: "register",
      assetId: "asset-1",
      toastMessage: "Asset registered successfully.",
    });
    render(<AssetInventoryContainer />);
    await waitFor(() => {
      expect(screen.getByTestId("inventory-success-toast")).toHaveTextContent(
        "Asset registered successfully.",
      );
    });
  });

  it("highlights focused asset row once on registration arrival", async () => {
    stashInventoryArrival({
      reason: "register",
      assetId: "asset-1",
      toastMessage: "Asset registered successfully.",
    });
    render(<AssetInventoryContainer />);
    await waitFor(() => {
      expect(screen.getByTestId("inventory-table-row")).toHaveAttribute("data-highlighted", "true");
    });
  });

  it("resets to page 1 for registration arrival even when prior snapshot saved another page", async () => {
    saveInventoryUiSnapshot({
      preset: "assigned",
      headerBranchId: BRANCH_ALL_VALUE,
      draftFilters: EMPTY_INVENTORY_FILTERS,
      appliedFilters: EMPTY_INVENTORY_FILTERS,
      quickSearch: "",
      page: 2,
    });
    stashInventoryArrival({
      reason: "register",
      assetId: "asset-1",
      toastMessage: "Asset registered successfully.",
    });
    render(<AssetInventoryContainer />);
    await waitFor(() => {
      expect(assetOperationsService.listAssets).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }));
    });
  });

  it("restores focus asset when navigation stashes one directly", async () => {
    stashInventoryFocusAsset("asset-1");
    render(<AssetInventoryContainer />);
    await waitFor(() => {
      expect(screen.getByTestId("inventory-table-row")).toHaveAttribute("data-highlighted", "true");
    });
  });

  it("shows allocation success toast and opens drawer on issue arrival", async () => {
    vi.mocked(assetOperationsService.listAssets).mockResolvedValue({
      items: [
        {
          ...assetItem,
          operational_status: "ASSIGNED",
        },
      ],
      total: 1,
      page: 1,
      page_size: 25,
    });
    vi.mocked(assetOperationsService.listAssignments).mockResolvedValue({
      items: [
        {
          id: "asg-1",
          asset_id: "asset-1",
          status: "active",
          employee_id: "e1",
          document_number: "ASN-9",
          allocated_at: "2026-08-06T10:00:00Z",
          delivery_reference_status: "pending",
          delivery_reference_number: null,
          assignment_remarks: null,
          return_remarks: null,
        },
      ],
      total: 1,
      page: 1,
      page_size: 200,
    });
    stashInventoryArrival({
      reason: "issue",
      assetId: "asset-1",
      toastMessage: "Asset successfully allocated to Rahul Sharma.",
    });
    render(<AssetInventoryContainer />);
    await waitFor(() => {
      expect(screen.getByTestId("inventory-success-toast")).toHaveTextContent(
        "Asset successfully allocated to Rahul Sharma.",
      );
    });
    await waitFor(() => {
      expect(screen.getByTestId("inventory-table-row")).toHaveAttribute("data-highlighted", "true");
    });
    await waitFor(() => {
      expect(screen.getByTestId("asset-detail-drawer")).toBeInTheDocument();
    });
    expect(screen.getByText("Asha Nair (EMP-001)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Return Asset" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Allocate Asset" })).not.toBeInTheDocument();
  });

  it("keeps register on page 1 after assignment arrival even with prior snapshot", async () => {
    saveInventoryUiSnapshot({
      preset: "ready",
      headerBranchId: BRANCH_ALL_VALUE,
      draftFilters: EMPTY_INVENTORY_FILTERS,
      appliedFilters: EMPTY_INVENTORY_FILTERS,
      quickSearch: "",
      page: 3,
    });
    stashInventoryArrival({
      reason: "issue",
      assetId: "asset-1",
      toastMessage: "Asset successfully allocated.",
    });
    render(<AssetInventoryContainer />);
    await waitFor(() => {
      expect(assetOperationsService.listAssets).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1 }),
      );
    });
  });

  it("shows return success toast, clears holder, and restores Allocate CTA", async () => {
    vi.mocked(assetOperationsService.listAssets).mockResolvedValue({
      items: [
        {
          ...assetItem,
          asset_name: "Dell Latitude 7440",
          operational_status: "READY_TO_MOVE",
        },
      ],
      total: 1,
      page: 1,
      page_size: 25,
    });
    vi.mocked(assetOperationsService.listAssignments).mockResolvedValue({
      items: [
        {
          id: "asg-1",
          asset_id: "asset-1",
          status: "returned",
          employee_id: "e1",
          document_number: "ASN-9",
          allocated_at: "2026-08-01T10:00:00Z",
          returned_at: "2026-08-06T12:00:00Z",
          delivery_reference_status: "received",
          delivery_reference_number: "DC-1",
          assignment_remarks: null,
          return_remarks: "Good condition",
          return_condition: "good",
        },
      ],
      total: 1,
      page: 1,
      page_size: 200,
    });
    stashInventoryArrival({
      reason: "return",
      assetId: "asset-1",
      toastMessage: "Dell Latitude 7440 returned successfully.",
    });
    render(<AssetInventoryContainer />);
    await waitFor(() => {
      expect(screen.getByTestId("inventory-success-toast")).toHaveTextContent(
        "Dell Latitude 7440 returned successfully.",
      );
    });
    await waitFor(() => {
      expect(screen.getByTestId("inventory-table-row")).toHaveAttribute("data-highlighted", "true");
    });
    await waitFor(() => {
      expect(screen.getByTestId("asset-detail-drawer")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Allocate Asset" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Return Asset" })).not.toBeInTheDocument();
  });
});
