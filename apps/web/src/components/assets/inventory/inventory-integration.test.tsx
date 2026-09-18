/** @vitest-environment jsdom */

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AssetInventoryContainer } from "@/components/assets/asset-inventory-container";
import {
  clearInventoryStale,
  markInventoryStale,
  peekInventoryStale,
} from "@/components/assets/inventory/inventory-refresh";
import { clearInventoryUiSnapshot } from "@/components/assets/inventory/inventory-ui-state";
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
  };
});

vi.mock("@/services/asset-site-location-service", () => ({
  listSiteLocations: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/org-options", () => ({
  listBranchOptions: vi.fn().mockResolvedValue([{ id: "b1", label: "Noida" }]),
  listDepartmentOptions: vi.fn().mockResolvedValue([]),
  listEmployeeOptions: vi.fn().mockResolvedValue([]),
  listEmployeeDirectory: vi.fn().mockResolvedValue([]),
  employeeLabelsFromDirectory: () => ({}),
  employeeDirectoryById: () => ({}),
}));

const readyAsset = {
  id: "asset-99",
  asset_code: "AST-99",
  asset_name: "Surface",
  branch_id: "b1",
  operational_status: "READY_TO_MOVE",
  status: "active",
};

const assignedAsset = {
  id: "asset-88",
  asset_code: "AST-88",
  asset_name: "Laptop",
  branch_id: "b1",
  operational_status: "ASSIGNED",
  status: "active",
};

afterEach(() => {
  cleanup();
  push.mockClear();
  clearInventoryStale();
  clearInventoryUiSnapshot();
  vi.mocked(assetOperationsService.listAssets).mockClear();
});

beforeEach(() => {
  clearInventoryStale();
  vi.spyOn(assetOperationsService, "listAssets").mockImplementation(() =>
    Promise.resolve({
      items: [readyAsset, assignedAsset],
      total: 2,
      page: 1,
      page_size: 25,
    }),
  );
  vi.spyOn(assetOperationsService, "listAssignments").mockImplementation(() =>
    Promise.resolve({
      items: [
        {
          id: "asg-1",
          asset_id: "asset-88",
          status: "active",
          employee_id: "e1",
          document_number: "ASN-1",
        },
      ],
      total: 1,
      page: 1,
      page_size: 200,
    }),
  );
});

async function waitForInventoryReady(assetCode: string) {
  await waitFor(() => expect(screen.getAllByText(assetCode).length).toBeGreaterThan(0));
  await waitFor(() => {
    expect(screen.getByTestId("inventory-export-trigger")).not.toBeDisabled();
  });
  // Org-option hydration recreates `load` and briefly sets loading again — drain that
  // so the Actions menu is not unmounted mid-interaction.
  for (let i = 0; i < 8; i += 1) {
    const calls = vi.mocked(assetOperationsService.listAssets).mock.calls.length;
    await new Promise((r) => setTimeout(r, 40));
    await waitFor(() => {
      expect(screen.getByTestId("inventory-export-trigger")).not.toBeDisabled();
    });
    if (vi.mocked(assetOperationsService.listAssets).mock.calls.length === calls) break;
  }
  expect(screen.getAllByText(assetCode).length).toBeGreaterThan(0);
}

async function tableRowForAssetCode(assetCode: string) {
  await waitForInventoryReady(assetCode);
  const cell = screen.getAllByText(assetCode).find((el) => el.closest("tr"));
  expect(cell).toBeTruthy();
  return cell!.closest("tr")!;
}

async function openAssignMenu(user: ReturnType<typeof userEvent.setup>) {
  const row = await tableRowForAssetCode("AST-99");
  await user.click(within(row).getByRole("button", { name: "More actions" }));
  await user.click(await screen.findByRole("menuitem", { name: "Assign Asset" }));
}

describe("Inventory → Issue", () => {
  it("navigates to assignment wizard with assetId prefill", async () => {
    const user = userEvent.setup();
    render(<AssetInventoryContainer />);
    await openAssignMenu(user);
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith(
        expect.stringContaining("/assets/asset-assignments/new?assetId=asset-99"),
      );
    });
  });

  it("closes drawer before issue navigation", async () => {
    const user = userEvent.setup();
    render(<AssetInventoryContainer />);
    const row = await tableRowForAssetCode("AST-99");
    await user.click(within(row).getByRole("button", { name: "View" }));
    expect(await screen.findByTestId("asset-detail-drawer")).toBeInTheDocument();
    await user.click(within(row).getByRole("button", { name: "More actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Assign Asset" }));
    await waitFor(() => {
      expect(screen.queryByTestId("asset-detail-drawer")).not.toBeInTheDocument();
    });
    expect(push).toHaveBeenCalledTimes(1);
  });

  it("does not double-push on assign", async () => {
    const user = userEvent.setup();
    render(<AssetInventoryContainer />);
    await openAssignMenu(user);
    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
  });
});

describe("Inventory → Return", () => {
  it("navigates to return wizard with assetId", async () => {
    const user = userEvent.setup();
    render(<AssetInventoryContainer />);
    const row = await tableRowForAssetCode("AST-88");
    await user.click(within(row).getByRole("button", { name: "More actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Return Asset" }));
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith(
        expect.stringContaining("/assets/asset-assignments/return?assetId=asset-88"),
      );
    });
    expect(push.mock.calls[0]?.[0]).toContain("intent=return");
  });

  it("closes drawer before return navigation", async () => {
    const user = userEvent.setup();
    render(<AssetInventoryContainer />);
    const row = await tableRowForAssetCode("AST-88");
    await user.click(within(row).getByRole("button", { name: "View" }));
    expect(await screen.findByTestId("asset-detail-drawer")).toBeInTheDocument();
    await user.click(within(row).getByRole("button", { name: "More actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Return Asset" }));
    await waitFor(() => {
      expect(screen.queryByTestId("asset-detail-drawer")).not.toBeInTheDocument();
    });
  });
});

describe("Inventory refresh after workflow", () => {
  it("reloads list when stale flag present on mount", async () => {
    markInventoryStale({ reason: "issue", assetId: "asset-99" });
    render(<AssetInventoryContainer />);
    await waitFor(() => expect(assetOperationsService.listAssets).toHaveBeenCalled());
    await waitFor(() => {
      expect(vi.mocked(assetOperationsService.listAssets).mock.calls.length).toBeLessThanOrEqual(2);
    });
    expect(peekInventoryStale()).toBe(false);
  });

  it("keeps drawer closed after stale refresh", async () => {
    markInventoryStale({ reason: "return", assetId: "asset-88" });
    render(<AssetInventoryContainer />);
    await waitFor(() => expect(assetOperationsService.listAssets).toHaveBeenCalled());
    expect(screen.queryByTestId("asset-detail-drawer")).not.toBeInTheDocument();
  });

  it("retry reloads inventory without full navigation", async () => {
    const user = userEvent.setup();
    vi.mocked(assetOperationsService.listAssets).mockRejectedValue(new Error("boom"));
    render(<AssetInventoryContainer />);
    await waitFor(() => {
      expect(screen.getByText(/Failed to load inventory/i)).toBeInTheDocument();
    });
    vi.mocked(assetOperationsService.listAssets).mockResolvedValue({
      items: [readyAsset],
      total: 1,
      page: 1,
      page_size: 25,
    });
    await user.click(screen.getByRole("button", { name: /^Retry$/i }));
    await waitFor(() => expect(screen.getAllByText("AST-99")[0]).toBeInTheDocument());
    expect(push).not.toHaveBeenCalled();
  });
});

describe("Inventory selection & view", () => {
  it("opens drawer on View without routing", async () => {
    const user = userEvent.setup();
    render(<AssetInventoryContainer />);
    const row = await tableRowForAssetCode("AST-99");
    await user.click(within(row).getByRole("button", { name: "View" }));
    expect(await screen.findByTestId("asset-detail-drawer")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("navigates portal from drawer without closing workflow path", async () => {
    const user = userEvent.setup();
    render(<AssetInventoryContainer />);
    const row = await tableRowForAssetCode("AST-99");
    await user.click(within(row).getByRole("button", { name: "View" }));
    await user.click(await screen.findByRole("button", { name: "Information Portal" }));
    expect(push).toHaveBeenCalledWith("/assets/information-portal/asset-99");
  });
});
