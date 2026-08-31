/** @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AssetInventoryContainer } from "@/components/assets/asset-inventory-container";
import {
  clearInventoryStale,
  markInventoryStale,
  peekInventoryStale,
} from "@/components/assets/inventory/inventory-refresh";
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

async function openAssignMenu(user: ReturnType<typeof userEvent.setup>) {
  await waitFor(() => expect(screen.getAllByText("AST-99")[0]).toBeInTheDocument());
  const moreButtons = screen.getAllByRole("button", { name: "More actions" });
  await user.click(moreButtons[0]!);
  await user.click(screen.getByRole("menuitem", { name: "Assign Asset" }));
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
    await waitFor(() => expect(screen.getAllByText("AST-99")[0]).toBeInTheDocument());
    await user.click(screen.getAllByRole("button", { name: /View/ })[0]!);
    expect(screen.getByTestId("asset-detail-drawer")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "More actions" })[0]!);
    await user.click(screen.getByRole("menuitem", { name: "Assign Asset" }));
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
    await waitFor(() => expect(screen.getAllByText("AST-88")[0]).toBeInTheDocument());
    const moreButtons = screen.getAllByRole("button", { name: "More actions" });
    // second row is ASSIGNED asset
    await user.click(moreButtons[1]!);
    await user.click(screen.getByRole("menuitem", { name: "Return Asset" }));
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
    await waitFor(() => expect(screen.getAllByText("AST-88")[0]).toBeInTheDocument());
    await user.click(screen.getAllByRole("button", { name: /View/ })[1]!);
    expect(screen.getByTestId("asset-detail-drawer")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "More actions" })[1]!);
    await user.click(screen.getByRole("menuitem", { name: "Return Asset" }));
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
    await waitFor(() => expect(screen.getAllByText("AST-99")[0]).toBeInTheDocument());
    await user.click(screen.getAllByRole("button", { name: /View/ })[0]!);
    expect(screen.getByTestId("asset-detail-drawer")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("navigates portal from drawer without closing workflow path", async () => {
    const user = userEvent.setup();
    render(<AssetInventoryContainer />);
    await waitFor(() => expect(screen.getAllByText("AST-99")[0]).toBeInTheDocument());
    await user.click(screen.getAllByRole("button", { name: /View/ })[0]!);
    await user.click(screen.getByRole("button", { name: "Portal" }));
    expect(push).toHaveBeenCalledWith("/assets/information-portal/asset-99");
  });
});
