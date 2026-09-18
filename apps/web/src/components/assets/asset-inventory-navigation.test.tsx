/** @vitest-environment jsdom */

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AssetInventoryContainer } from "@/components/assets/asset-inventory-container";
import { createAssetNavigation } from "@/components/assets/navigation/asset-navigation";
import { assetOperationsService } from "@/services/assets-service";

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
    const cell = screen.getAllByText(assetCode).find((el) => el.closest("tr"));
    expect(cell).toBeTruthy();
    return cell!.closest("tr")!;
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

  it("navigates on portal quick link from drawer", async () => {
    const user = userEvent.setup();
    render(<AssetInventoryContainer />);
    const row = await tableRowForAssetCode("AST-99");
    await user.click(within(row).getByRole("button", { name: "View" }));
    await user.click(await screen.findByRole("button", { name: "Information Portal" }));
    expect(push).toHaveBeenCalledWith("/assets/information-portal/asset-99");
  });
});
