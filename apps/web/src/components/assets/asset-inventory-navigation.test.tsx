/** @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AssetInventoryContainer } from "@/components/assets/asset-inventory-container";
import { createAssetNavigation } from "@/components/assets/navigation/asset-navigation";
import { assetOperationsService } from "@/services/assets-service";

const push = vi.fn();

vi.mock("@/components/assets/navigation/use-asset-navigation", () => ({
  useAssetNavigation: () => createAssetNavigation(push),
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
  listDepartmentOptions: vi.fn().mockResolvedValue([]),
  listEmployeeOptions: vi.fn().mockResolvedValue([]),
}));

const assetItem = {
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

describe("AssetInventoryContainer navigation", () => {
  it("opens drawer on View without routing", async () => {
    const user = userEvent.setup();
    render(<AssetInventoryContainer />);
    await waitFor(() => expect(assetOperationsService.listAssets).toHaveBeenCalled());
    expect(screen.getAllByText("AST-99")[0]).toBeInTheDocument();
    const viewButtons = screen.getAllByRole("button", { name: /View/ });
    await user.click(viewButtons[0]!);
    expect(screen.getByTestId("asset-detail-drawer")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("navigates on assign menu action", async () => {
    const user = userEvent.setup();
    render(<AssetInventoryContainer />);
    await waitFor(() => expect(assetOperationsService.listAssets).toHaveBeenCalled());
    expect(screen.getAllByText("AST-99")[0]).toBeInTheDocument();
    const moreButtons = screen.getAllByRole("button", { name: "More actions" });
    await user.click(moreButtons[0]!);
    await user.click(screen.getByRole("menuitem", { name: "Assign Asset" }));
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith(
        expect.stringContaining("/assets/asset-assignments/new?assetId=asset-99"),
      );
    });
  });

  it("navigates on portal quick link from drawer", async () => {
    const user = userEvent.setup();
    render(<AssetInventoryContainer />);
    await waitFor(() => expect(assetOperationsService.listAssets).toHaveBeenCalled());
    expect(screen.getAllByText("AST-99")[0]).toBeInTheDocument();
    const viewButtons = screen.getAllByRole("button", { name: /View/ });
    await user.click(viewButtons[0]!);
    await user.click(screen.getByRole("button", { name: "Portal" }));
    expect(push).toHaveBeenCalledWith("/assets/information-portal/asset-99");
  });
});
