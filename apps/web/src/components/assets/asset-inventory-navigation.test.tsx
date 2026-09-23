/** @vitest-environment jsdom */

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AssetInventoryContainer } from "@/components/assets/asset-inventory-container";
import { createAssetNavigation } from "@/components/assets/navigation/asset-navigation";
import { assetOperationsService, assetRegisterService } from "@/services/assets-service";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  usePathname: () => "/assets/assets",
  useSearchParams: () => new URLSearchParams(),
}));

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
    assetLocationService: {
      search: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, page_size: 200 }),
    },
    componentService: {
      ...actual.componentService,
      search: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, page_size: 100 }),
    },
  };
});

vi.mock("@/lib/org-options", () => ({
  listBranchOptions: vi.fn().mockResolvedValue([{ id: "b1", label: "Noida" }]),
  listDepartmentOptions: vi.fn().mockResolvedValue([]),
  listLocationOptions: vi.fn().mockResolvedValue([]),
  listEmployeeOptions: vi.fn().mockResolvedValue([]),
  listEmployeeDirectory: vi.fn().mockResolvedValue([]),
  employeeLabelsFromDirectory: () => ({}),
  employeeDirectoryById: () => ({}),
}));

vi.mock("@/services/asset-site-location-service", () => ({
  listSiteLocations: vi.fn().mockResolvedValue([]),
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
      page_size: 200,
    }),
  );
  vi.spyOn(assetRegisterService, "softDelete").mockResolvedValue(assetItem as never);
});

describe("AssetInventoryContainer navigation", () => {
  async function waitForInventoryReady(assetCode: string) {
    await waitFor(() => expect(screen.getAllByText(assetCode).length).toBeGreaterThan(0));
    await waitFor(() => {
      expect(screen.getByTestId("inventory-export-trigger")).not.toBeDisabled();
    });
    for (let i = 0; i < 8; i += 1) {
      const calls = vi.mocked(assetOperationsService.listAssets).mock.calls.length;
      await new Promise((r) => setTimeout(r, 40));
      await waitFor(() => {
        expect(screen.getByTestId("inventory-export-trigger")).not.toBeDisabled();
      });
      if (vi.mocked(assetOperationsService.listAssets).mock.calls.length === calls) break;
    }
  }

  async function tableRowForAssetCode(assetCode: string) {
    await waitForInventoryReady(assetCode);
    // Desktop table rows use data-testid; asset tag is only shown on mobile cards.
    const row = screen.getByTestId(`inventory-row-${assetItem.id}`);
    expect(row).toBeTruthy();
    return row;
  }

  it("opens drawer on View without routing", async () => {
    const user = userEvent.setup();
    render(<AssetInventoryContainer />);
    const row = await tableRowForAssetCode("AST-99");
    await user.click(within(row).getByRole("button", { name: "View" }));
    expect(await screen.findByTestId("asset-detail-drawer")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("navigates on assign menu action", async () => {
    const user = userEvent.setup();
    render(<AssetInventoryContainer />);
    const row = await tableRowForAssetCode("AST-99");
    await user.click(within(row).getByRole("button", { name: "More actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Assign Asset" }));
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith(
        expect.stringContaining("/assets/asset-assignments/new?assetId=asset-99"),
      );
    });
  });

  it("navigates to existing edit route when Edit is chosen from the menu", async () => {
    const user = userEvent.setup();
    render(<AssetInventoryContainer />);
    const row = await tableRowForAssetCode("AST-99");
    expect(within(row).getByTestId("inventory-action-view")).toBeInTheDocument();
    expect(within(row).queryByTestId("inventory-action-edit")).not.toBeInTheDocument();
    await user.click(within(row).getByRole("button", { name: "More actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Edit" }));
    expect(push).toHaveBeenCalledWith("/assets/assets/asset-99/edit");
  });

  it("opens DeleteAssetConfirmDialog from 3-dot menu; cancel does not soft-delete", async () => {
    const user = userEvent.setup();
    render(<AssetInventoryContainer />);
    const row = await tableRowForAssetCode("AST-99");
    await user.click(within(row).getByRole("button", { name: "More actions" }));
    expect(await screen.findByRole("menuitem", { name: "Delete" })).toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));
    expect(screen.getByTestId("delete-asset-confirm-dialog")).toBeInTheDocument();
    expect(screen.getByTestId("delete-asset-code")).toHaveTextContent("AST-99");
    await user.click(screen.getByTestId("delete-asset-cancel-button"));
    expect(screen.queryByTestId("delete-asset-confirm-dialog")).not.toBeInTheDocument();
    expect(assetRegisterService.softDelete).not.toHaveBeenCalled();
  });

  it("navigates on portal quick link from drawer", async () => {
    const user = userEvent.setup();
    render(<AssetInventoryContainer />);
    const row = await tableRowForAssetCode("AST-99");
    await user.click(within(row).getByRole("button", { name: "View" }));
    await user.click(await screen.findByRole("button", { name: "Information Portal" }));
    expect(push).toHaveBeenCalledWith("/assets/information-portal/asset-99");
  });
});
