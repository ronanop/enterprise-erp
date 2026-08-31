/** @vitest-environment jsdom */

import type { ComponentProps } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AssetOperationsDashboard } from "@/components/assets/asset-operations-dashboard";
import {
  clearInventoryUiSnapshot,
  peekInventoryUiSnapshot,
} from "@/components/assets/inventory/inventory-ui-state";
import { BRANCH_ALL_VALUE } from "@/components/assets/shared";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), prefetch: vi.fn() }),
}));

const locations = [
  { id: "loc1", label: "New Delhi" },
  { id: "loc2", label: "Mumbai" },
];

const defaultKpis = {
  totalAssets: 12,
  readyToMove: 2,
  assigned: 8,
  retired: 1,
  pendingDisposal: 1,
  disposed: 0,
  inUseAsComponent: 0,
};

const sampleTransfers = [
  {
    id: "t1",
    documentNumber: "TRF-2026-000001",
    assetId: "a1",
    assetCode: "AST-1",
    assetName: "Laptop One",
    fromLocation: "New Delhi · CRC2",
    toLocation: "Mumbai · CRC-1",
    fromBranchId: "b1",
    toBranchId: "b2",
    effectiveDate: "2026-08-30",
    reason: "Relocation",
    status: "submitted",
    workflowStatus: "in_progress",
  },
];

function renderDashboard(overrides: Partial<ComponentProps<typeof AssetOperationsDashboard>> = {}) {
  const onLocationChange = vi.fn();
  render(
    <AssetOperationsDashboard
      locationId={BRANCH_ALL_VALUE}
      locations={locations}
      onLocationChange={onLocationChange}
      kpis={defaultKpis}
      transferRows={sampleTransfers}
      transferTotal={1}
      branchLookup={{ b1: "Noida", b2: "Mumbai" }}
      {...overrides}
    />,
  );
  return { onLocationChange };
}

beforeEach(() => {
  push.mockReset();
  clearInventoryUiSnapshot();
});

afterEach(() => {
  cleanup();
});

describe("AssetOperationsDashboard layout", () => {
  it("renders root landmark", () => {
    renderDashboard();
    expect(screen.getByTestId("asset-operations-dashboard")).toBeInTheDocument();
  });

  it("renders page title and subtitle", () => {
    renderDashboard();
    expect(screen.getByRole("heading", { level: 1, name: "IT Asset Operations" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Operational status, location mix, and transfer activity — click a KPI to open All Assets filtered.",
      ),
    ).toBeInTheDocument();
  });

  it("does not render placeholder notification or profile controls", () => {
    renderDashboard();
    expect(screen.queryByRole("button", { name: "Notifications (placeholder)" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Profile (placeholder)" })).not.toBeInTheDocument();
  });

  it("renders location selector with All and locations", () => {
    renderDashboard();
    const group = screen.getByRole("group", { name: "Location" });
    expect(within(group).getByRole("button", { name: "All" })).toBeInTheDocument();
    expect(within(group).getByRole("button", { name: "New Delhi" })).toBeInTheDocument();
  });

  it("opens All Assets with ready preset when Ready to Move KPI is clicked", async () => {
    const user = userEvent.setup();
    renderDashboard();
    await user.click(screen.getByRole("button", { name: "Open Ready to Move assets" }));
    expect(push).toHaveBeenCalledWith("/assets/assets");
    expect(peekInventoryUiSnapshot()?.preset).toBe("ready");
  });

  it("opens All Assets with assigned preset when Assigned KPI is clicked", async () => {
    const user = userEvent.setup();
    renderDashboard();
    await user.click(screen.getByRole("button", { name: "Open Assigned assets" }));
    expect(push).toHaveBeenCalledWith("/assets/assets");
    expect(peekInventoryUiSnapshot()?.preset).toBe("assigned");
  });

  it("opens all-assets preset from Total Assets KPI", async () => {
    const user = userEvent.setup();
    renderDashboard();
    await user.click(screen.getByRole("button", { name: "Open All Assets" }));
    expect(push).toHaveBeenCalledWith("/assets/assets");
    expect(peekInventoryUiSnapshot()?.preset).toBe("all");
  });

  it("delegates location change to parent", async () => {
    const user = userEvent.setup();
    const { onLocationChange } = renderDashboard();
    const group = screen.getByRole("group", { name: "Location" });
    await user.click(within(group).getByRole("button", { name: "Mumbai" }));
    expect(onLocationChange).toHaveBeenCalledWith("loc2");
  });

  it("shows KPI loading skeletons when loading", () => {
    renderDashboard({ kpisLoading: true, kpis: null });
    expect(screen.getAllByLabelText("Loading statistic")).toHaveLength(6);
  });

  it("renders KPI values from props", () => {
    renderDashboard();
    expect(screen.getByTestId("asset-ops-kpi-ops-note")).toHaveTextContent(
      "Click any card to open All Assets with that status filter applied",
    );
    const kpiGrid = screen.getByTestId("asset-ops-kpi-grid");
    expect(within(kpiGrid).getByText("12")).toBeInTheDocument();
    expect(within(kpiGrid).getByText("Assigned")).toBeInTheDocument();
    expect(within(kpiGrid).getByText("Ready to Move")).toBeInTheDocument();
  });

  it("shows empty KPI dashes when kpis null and not loading", () => {
    renderDashboard({ kpis: null, kpisLoading: false });
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(6);
  });

  it("applies responsive KPI grid classes", () => {
    renderDashboard();
    const grid = screen.getByTestId("asset-ops-kpi-grid");
    expect(grid.className).toMatch(/xl:grid-cols-6/);
    expect(grid.className).toMatch(/sm:grid-cols-3/);
  });

  it("renders KPI share trends when provided", () => {
    renderDashboard({
      kpiTrends: {
        readyToMove: { label: "17% of total", direction: "neutral" },
        assigned: { label: "67% of total", direction: "neutral" },
      },
    });
    expect(screen.getByText("17% of total")).toBeInTheDocument();
    expect(screen.getByText("67% of total")).toBeInTheDocument();
  });

  it("renders location breakdown when provided", () => {
    renderDashboard({
      byLocationRows: [
        {
          locationId: "loc1",
          label: "New Delhi",
          totalAssets: 10,
          readyToMove: 2,
          assigned: 6,
          retired: 1,
          pendingDisposal: 1,
          disposed: 0,
          inUseAsComponent: 0,
        },
      ],
    });
    expect(screen.getByTestId("asset-ops-location-breakdown")).toBeInTheDocument();
    expect(screen.getByText("By Location")).toBeInTheDocument();
  });

  it("renders transfer list table with full columns", () => {
    renderDashboard();
    expect(screen.getByTestId("asset-ops-transfers")).toBeInTheDocument();
    expect(screen.getByText("Transfer list")).toBeInTheDocument();
    expect(screen.getByText("TRF-2026-000001")).toBeInTheDocument();
    expect(screen.getByText("Laptop One")).toBeInTheDocument();
    expect(screen.getByText("AST-1")).toBeInTheDocument();
    expect(screen.getByText("New Delhi · CRC2")).toBeInTheDocument();
    expect(screen.getByText("Mumbai · CRC-1")).toBeInTheDocument();
    expect(screen.getByText("Relocation")).toBeInTheDocument();
    expect(screen.queryByText("Ready to Move Queue")).not.toBeInTheDocument();
    expect(screen.queryByText("Pending Disposal Queue")).not.toBeInTheDocument();
  });

  it("navigates to transfers workspace from view all", async () => {
    const user = userEvent.setup();
    renderDashboard();
    await user.click(screen.getByRole("button", { name: "View all transfers" }));
    expect(push).toHaveBeenCalledWith("/assets/asset-transfers");
  });

  it("renders six quick action cards", () => {
    renderDashboard();
    const grid = screen.getByTestId("asset-ops-quick-actions-grid");
    expect(within(grid).getByRole("button", { name: /Register Asset/ })).toBeInTheDocument();
    expect(within(grid).getByRole("button", { name: /QR \/ Barcode/ })).toBeInTheDocument();
  });

  it("navigates quick actions to existing routes", async () => {
    const user = userEvent.setup();
    renderDashboard();
    const grid = screen.getByTestId("asset-ops-quick-actions-grid");
    await user.click(within(grid).getByRole("button", { name: /Register Asset/ }));
    expect(push).toHaveBeenCalledWith("/assets/assets/new");
    await user.click(within(grid).getByRole("button", { name: /Assign Asset/ }));
    expect(push).toHaveBeenCalledWith("/assets/asset-assignments/new");
    await user.click(within(grid).getByRole("button", { name: /Return Asset/ }));
    expect(push).toHaveBeenCalledWith("/assets/asset-assignments/return");
    await user.click(within(grid).getByRole("button", { name: /QR \/ Barcode/ }));
    expect(push).toHaveBeenCalledWith("/assets/qr-barcode");
  });

  it("does not cap dashboard with an inner max-width", () => {
    renderDashboard();
    const root = screen.getByTestId("asset-operations-dashboard");
    expect(root.className).not.toMatch(/max-w-\[/);
  });

  it("shows error card with retry", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    renderDashboard({ errorMessage: "Server unavailable", onRetry });
    expect(screen.getByTestId("asset-ops-error-card")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("shows transfer error messaging", () => {
    renderDashboard({
      transferRows: [],
      transferError: "Transfer API failed",
    });
    expect(screen.getByText("Transfer API failed")).toBeInTheDocument();
  });
});
