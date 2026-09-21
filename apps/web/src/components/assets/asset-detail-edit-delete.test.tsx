/**
 * Asset Details Edit/Delete action visibility (RBAC).
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const push = vi.fn();
const replace = vi.fn();
const can = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/hooks/use-user-permissions", () => ({
  useUserPermissions: () => ({ can, user: null, loading: false }),
}));

vi.mock("@/lib/auth", () => ({
  isAuthenticated: () => true,
}));

vi.mock("@/lib/org-options", () => ({
  listEmployeeDirectory: vi.fn(async () => []),
  employeeDirectoryById: () => ({}),
  listBranchOptions: vi.fn(async () => []),
}));

vi.mock("@/components/assets/asset-maintenance-workspace", () => ({
  openMaintenanceForAsset: vi.fn(async () => undefined),
}));

vi.mock("@/services/assets-service", () => ({
  assetRegisterService: {
    get: vi.fn(async () => ({
      id: "asset-1",
      asset_code: "AST-2026-000001",
      asset_name: "Dell Latitude",
      status: "active",
      operational_status: "READY_TO_MOVE",
      serial_number: "SN-1",
      make: "Dell",
      model: "Latitude",
      asset_category_id: "c1",
      asset_type_id: "t1",
      version: 1,
    })),
    softDelete: vi.fn(),
    startDisposal: vi.fn(),
    reinstate: vi.fn(),
  },
  assetLocationService: {
    search: vi.fn(async () => ({ items: [], total: 0, page: 1, page_size: 5 })),
  },
  componentService: {
    search: vi.fn(async () => ({
      items: [
        {
          id: "cmp-1",
          component_type: "CHARGER",
          component_code: "CHG-001",
          component_name: "Charger",
          status: "active",
        },
      ],
      total: 1,
    })),
  },
  componentTypeLabel: (t: string) => (t === "CHARGER" ? "Charger" : t),
}));

vi.mock("@/services/api-client", () => ({
  ApiClientError: class extends Error {
    status: number;
    constructor(message: string, status = 400) {
      super(message);
      this.status = status;
    }
  },
  resourceService: {
    list: vi.fn(async () => ({ data: { items: [] } })),
  },
}));

import { AssetDetailWorkspace } from "@/components/assets/asset-detail-workspace";

describe("AssetDetailWorkspace Edit/Delete actions", () => {
  beforeEach(() => {
    push.mockReset();
    replace.mockReset();
    can.mockReset();
  });

  it("shows Edit Asset and Delete Asset when user has asset.asset:update", async () => {
    can.mockImplementation((p: string) => p === "asset.asset:update");
    render(<AssetDetailWorkspace assetId="asset-1" />);
    expect(await screen.findByTestId("asset-detail-edit")).toBeInTheDocument();
    expect(screen.getByTestId("asset-detail-delete")).toBeInTheDocument();
    expect(screen.getByTestId("asset-detail-edit")).toHaveAttribute(
      "href",
      "/assets/assets/asset-1/edit",
    );
  });

  it("hides Edit/Delete for unauthorized users", async () => {
    can.mockReturnValue(false);
    render(<AssetDetailWorkspace assetId="asset-1" />);
    await waitFor(() => {
      expect(screen.getByTestId("asset-detail-components")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("asset-detail-edit")).not.toBeInTheDocument();
    expect(screen.queryByTestId("asset-detail-delete")).not.toBeInTheDocument();
  });

  it("opens delete confirmation with asset code", async () => {
    can.mockImplementation((p: string) => p === "asset.asset:update");
    render(<AssetDetailWorkspace assetId="asset-1" />);
    await screen.findByTestId("asset-detail-delete");
    screen.getByTestId("asset-detail-delete").click();
    expect(await screen.findByTestId("delete-asset-confirm-dialog")).toBeInTheDocument();
    expect(screen.getByTestId("delete-asset-confirm-message")).toHaveTextContent(
      "AST-2026-000001",
    );
  });

  it("shows charger component in Accessories from real component data", async () => {
    can.mockReturnValue(true);
    render(<AssetDetailWorkspace assetId="asset-1" />);
    await waitFor(() => {
      expect(screen.getByTestId("asset-detail-components")).toBeInTheDocument();
    });
    expect(screen.getByText("Charger")).toBeInTheDocument();
    expect(screen.getByText("CHG-001")).toBeInTheDocument();
  });
});
