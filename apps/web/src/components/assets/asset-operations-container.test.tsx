/** @vitest-environment jsdom */

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AssetOperationsContainer } from "@/components/assets/asset-operations-container";
import { BRANCH_ALL_VALUE } from "@/components/assets/shared";

const fetchMock = vi.fn();
const listBranchesMock = vi.fn();
const push = vi.fn();
const exportSpy = vi.fn();

vi.mock("@/components/assets/asset-operations-fetch", () => ({
  fetchAssetOperationsData: (...args: unknown[]) => fetchMock(...args),
}));

vi.mock("@/lib/org-options", () => ({
  listBranchOptions: () => listBranchesMock(),
}));

vi.mock("@/components/assets/navigation/use-asset-navigation", () => ({
  useAssetNavigation: () => ({
    openRegisterNew: () => push("/assets/assets/new"),
    openAssignmentWizard: () => push("/assets/asset-assignments/new"),
    openReturnWizard: () => push("/assets/asset-assignments/return?intent=return"),
    openInventoryImport: () => push("/assets/inventory-import"),
    openInventory: () => push("/assets/assets"),
    openMaintenanceList: () => push("/assets/asset-maintenances"),
    openAssignmentList: () => push("/assets/asset-assignments"),
    openDetails: (id: string) => push(`/assets/assets/${id}`),
    openAssignment: (id: string) => push(`/assets/asset-assignments/new?assetId=${id}`),
    openReturn: vi.fn(),
    openPortal: vi.fn(),
    openDiscovery: vi.fn(),
    openQr: vi.fn(),
    openTransfer: vi.fn(),
    openMaintenance: vi.fn(),
    openHistory: vi.fn(),
  }),
}));

vi.mock("@/components/assets/asset-inventory-container", () => ({
  AssetInventoryContainer: (props: {
    branchId?: string;
    embedded?: boolean;
    hideQuickSearch?: boolean;
    forcedSearch?: string;
    onRegisterExport?: (fn: () => void) => void;
  }) => {
    props.onRegisterExport?.(() => exportSpy());
    return (
      <div
        data-testid="asset-inventory-workspace"
        data-embedded={props.embedded ? "true" : "false"}
        data-branch={props.branchId}
        data-hide-search={props.hideQuickSearch ? "true" : "false"}
        data-forced-search={props.forcedSearch ?? ""}
      >
        <div data-testid="asset-register-section-header">Asset Register</div>
        <div data-testid="inventory-table">Inventory table</div>
      </div>
    );
  },
}));

const successPayload = {
  summary: {
    company_id: "c1",
    total_assets: 12,
    ready_to_move: 2,
    assigned: 8,
    retired: 1,
    pending_disposal: 1,
    disposed: 0,
  },
  readyList: {
    items: [
      {
        id: "ready-1",
        asset_code: "AST-READY",
        asset_name: "Ready Laptop",
        operational_status: "READY_TO_MOVE",
        status: "active",
      },
    ],
    total: 1,
    page: 1,
    page_size: 10,
  },
  disposalList: {
    items: [{ id: "d1", asset_code: "AST-D", operational_status: "PENDING_DISPOSAL", status: "active" }],
    total: 1,
    page: 1,
    page_size: 10,
  },
  assignmentsList: {
    items: [
      {
        id: "a1",
        document_number: "ASN-1",
        status: "active",
        allocated_at: "2026-08-01T09:00:00.000Z",
        employee_id: "e1",
      },
    ],
    total: 1,
    page: 1,
    page_size: 10,
  },
  recentAssets: {
    items: [{ id: "r1", asset_code: "AST-R", asset_name: "New", created_at: "2026-08-02T10:00:00.000Z" }],
    total: 1,
    page: 1,
    page_size: 10,
  },
  transferList: {
    items: [
      {
        id: "t1",
        document_number: "TR-1",
        status: "completed",
        updated_at: "2026-08-03T11:00:00.000Z",
      },
    ],
    total: 1,
    page: 1,
    page_size: 10,
  },
  errors: {},
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  listBranchesMock.mockResolvedValue([{ id: "b1", label: "Noida" }]);
  fetchMock.mockResolvedValue(successPayload);
});

describe("AssetOperationsContainer (CR-005 Phase 4)", () => {
  it("loads and renders KPI values", async () => {
    render(<AssetOperationsContainer />);
    await waitFor(() => {
      expect(screen.getByText("12")).toBeInTheDocument();
    });
  });

  it("embeds Asset Register with sticky toolbar and quick-action cards", async () => {
    render(<AssetOperationsContainer />);
    await waitFor(() => {
      expect(screen.getByTestId("asset-ops-sticky-toolbar")).toBeInTheDocument();
    });
    expect(screen.getByTestId("asset-ops-quick-actions-grid")).toBeInTheDocument();
    const register = screen.getByTestId("asset-ops-register-section");
    expect(within(register).getByTestId("asset-inventory-workspace")).toBeInTheDocument();
    expect(within(register).getByTestId("asset-register-section-header")).toBeInTheDocument();
    expect(within(register).getByTestId("asset-inventory-workspace").getAttribute("data-embedded")).toBe(
      "true",
    );
  });

  it("hides register quick search when global search is active", async () => {
    render(<AssetOperationsContainer />);
    await waitFor(() => {
      expect(screen.getByTestId("asset-inventory-workspace").getAttribute("data-hide-search")).toBe(
        "true",
      );
    });
  });

  it("applies global search to inventory forcedSearch", async () => {
    const user = userEvent.setup();
    render(<AssetOperationsContainer />);
    const form = await screen.findByTestId("asset-ops-global-search");
    await waitFor(() => expect(screen.getByTestId("asset-ops-kpi-grid")).toBeInTheDocument());
    const input = within(form).getByLabelText("Global asset search");
    await user.clear(input);
    await user.type(input, "AST-9");
    await user.click(within(form).getByRole("button", { name: "Search" }));
    await waitFor(() => {
      expect(screen.getByTestId("asset-inventory-workspace").getAttribute("data-forced-search")).toBe(
        "AST-9",
      );
    });
  });

  it("passes unified branch into inventory container", async () => {
    render(<AssetOperationsContainer />);
    await waitFor(() => {
      expect(screen.getByTestId("asset-inventory-workspace").getAttribute("data-branch")).toBe(
        BRANCH_ALL_VALUE,
      );
    });
  });

  it("refetches KPIs and activity when branch changes", async () => {
    const user = userEvent.setup();
    render(<AssetOperationsContainer />);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(BRANCH_ALL_VALUE);
    });
    const group = await screen.findByRole("group", { name: "Branch" });
    await user.click(within(group).getByRole("button", { name: "Noida" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("b1");
    });
    expect(screen.getByTestId("asset-inventory-workspace").getAttribute("data-branch")).toBe("b1");
  });

  it("renders recent activity from existing APIs", async () => {
    render(<AssetOperationsContainer />);
    await waitFor(() => {
      expect(screen.getByTestId("asset-ops-recent-activity")).toBeInTheDocument();
    });
    expect(screen.getByText("Asset Assigned")).toBeInTheDocument();
    expect(screen.getByText("Asset Registered")).toBeInTheDocument();
    expect(screen.getByText("Asset Transfer")).toBeInTheDocument();
  });

  it("renders health and pending widgets", async () => {
    render(<AssetOperationsContainer />);
    await waitFor(() => {
      expect(screen.getByTestId("asset-ops-health-summary")).toBeInTheDocument();
      expect(screen.getByTestId("asset-ops-pending-actions")).toBeInTheDocument();
    });
    expect(screen.getByTestId("health-healthy")).toHaveTextContent("2");
  });

  it("navigates Add Asset from sticky toolbar", async () => {
    const user = userEvent.setup();
    render(<AssetOperationsContainer />);
    await waitFor(() => expect(screen.getByText("12")).toBeInTheDocument());
    await user.click(screen.getByTestId("toolbar-add-asset"));
    expect(push).toHaveBeenCalledWith("/assets/assets/new");
  });

  it("navigates Allocate from sticky toolbar", async () => {
    const user = userEvent.setup();
    render(<AssetOperationsContainer />);
    const bar = await screen.findByTestId("asset-ops-sticky-toolbar");
    await waitFor(() => expect(screen.getByTestId("asset-ops-kpi-grid")).toBeInTheDocument());
    await user.click(within(bar).getByRole("button", { name: /^Allocate$/ }));
    expect(push).toHaveBeenCalledWith("/assets/asset-assignments/new");
  });

  it("navigates Return from sticky toolbar", async () => {
    const user = userEvent.setup();
    render(<AssetOperationsContainer />);
    const bar = await screen.findByTestId("asset-ops-sticky-toolbar");
    await waitFor(() => expect(screen.getByTestId("asset-ops-kpi-grid")).toBeInTheDocument());
    await user.click(within(bar).getByRole("button", { name: /^Return$/ }));
    expect(push).toHaveBeenCalledWith(expect.stringContaining("/assets/asset-assignments/return"));
  });

  it("navigates Import from sticky toolbar", async () => {
    const user = userEvent.setup();
    render(<AssetOperationsContainer />);
    const bar = await screen.findByTestId("asset-ops-sticky-toolbar");
    await waitFor(() => expect(screen.getByTestId("asset-ops-kpi-grid")).toBeInTheDocument());
    await user.click(within(bar).getByRole("button", { name: /^Import$/ }));
    expect(push).toHaveBeenCalledWith("/assets/inventory-import");
  });

  it("triggers export via registered inventory handler", async () => {
    const user = userEvent.setup();
    render(<AssetOperationsContainer />);
    const bar = await screen.findByTestId("asset-ops-sticky-toolbar");
    await waitFor(() => expect(screen.getByTestId("asset-ops-kpi-grid")).toBeInTheDocument());
    await user.click(within(bar).getByRole("button", { name: /^Export$/ }));
    expect(exportSpy).toHaveBeenCalledOnce();
  });

  it("shows error card when summary fails", async () => {
    fetchMock.mockResolvedValue({
      summary: null,
      readyList: null,
      disposalList: null,
      assignmentsList: null,
      recentAssets: null,
      transferList: null,
      errors: { summary: "Network error" },
    });
    render(<AssetOperationsContainer />);
    await waitFor(() => {
      expect(screen.getByTestId("asset-ops-error-card")).toBeInTheDocument();
    });
  });
});
