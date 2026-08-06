/** @vitest-environment jsdom */

import type { ComponentProps } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AssetOperationsDashboard } from "@/components/assets/asset-operations-dashboard";
import { BRANCH_ALL_VALUE } from "@/components/assets/shared";

const branches = [
  { id: "b1", label: "Noida" },
  { id: "b2", label: "Mumbai" },
];

const defaultKpis = {
  totalAssets: 12,
  readyToMove: 2,
  assigned: 8,
  retired: 1,
  pendingDisposal: 1,
  disposed: 0,
};

function renderDashboard(overrides: Partial<ComponentProps<typeof AssetOperationsDashboard>> = {}) {
  const onBranchChange = vi.fn();
  render(
    <AssetOperationsDashboard
      branchId={BRANCH_ALL_VALUE}
      branches={branches}
      onBranchChange={onBranchChange}
      kpis={defaultKpis}
      readyQueueRows={[{ id: "1", cells: ["AST-1", "Laptop", "Noida"] }]}
      disposalQueueRows={[]}
      assignmentRows={[]}
      {...overrides}
    />,
  );
  return { onBranchChange };
}

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
    expect(screen.getByRole("heading", { level: 1, name: "Asset Operations" })).toBeInTheDocument();
    expect(
      screen.getByText("Manage enterprise IT assets and daily operations"),
    ).toBeInTheDocument();
  });

  it("renders notification and profile placeholders", () => {
    renderDashboard();
    expect(screen.getByRole("button", { name: "Notifications (placeholder)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Profile (placeholder)" })).toBeInTheDocument();
  });

  it("renders branch selector with All and branches", () => {
    renderDashboard();
    const group = screen.getByRole("group", { name: "Branch" });
    expect(within(group).getByRole("button", { name: "All" })).toBeInTheDocument();
    expect(within(group).getByRole("button", { name: "Noida" })).toBeInTheDocument();
  });

  it("delegates branch change to parent", async () => {
    const user = userEvent.setup();
    const { onBranchChange } = renderDashboard();
    const group = screen.getByRole("group", { name: "Branch" });
    await user.click(within(group).getByRole("button", { name: "Mumbai" }));
    expect(onBranchChange).toHaveBeenCalledWith("b2");
  });

  it("shows KPI loading skeletons when loading", () => {
    renderDashboard({ kpisLoading: true, kpis: null });
    expect(screen.getAllByLabelText("Loading statistic")).toHaveLength(6);
  });

  it("renders KPI values from props", () => {
    renderDashboard();
    const kpiGrid = screen.getByTestId("asset-ops-kpi-grid");
    expect(within(kpiGrid).getByText("12")).toBeInTheDocument();
    expect(within(kpiGrid).getByText("Assigned")).toBeInTheDocument();
  });

  it("shows empty KPI dashes when kpis null and not loading", () => {
    renderDashboard({ kpis: null, kpisLoading: false });
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(6);
  });

  it("applies responsive KPI grid classes", () => {
    renderDashboard();
    const grid = screen.getByTestId("asset-ops-kpi-grid");
    expect(grid.className).toMatch(/xl:grid-cols-6/);
    expect(grid.className).toMatch(/md:grid-cols-3/);
  });

  it("renders six quick action cards", () => {
    renderDashboard();
    const grid = screen.getByTestId("asset-ops-quick-actions-grid");
    expect(within(grid).getByRole("button", { name: /Register Asset/ })).toBeInTheDocument();
    expect(within(grid).getByRole("button", { name: /QR \/ Barcode/ })).toBeInTheDocument();
  });

  it("renders operations queues", () => {
    renderDashboard();
    expect(screen.getByText("Ready To Move Queue")).toBeInTheDocument();
    expect(screen.getByText("Recent Assignments")).toBeInTheDocument();
    expect(screen.getByText("AST-1")).toBeInTheDocument();
  });

  it("shows error card with retry", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    renderDashboard({ errorMessage: "Server unavailable", onRetry });
    expect(screen.getByTestId("asset-ops-error-card")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("shows custom empty queue messaging", () => {
    renderDashboard({
      readyQueueRows: [],
      queueErrors: { ready: "Queue API failed" },
    });
    expect(screen.getByText("Could not load queue")).toBeInTheDocument();
    expect(screen.getByText("Queue API failed")).toBeInTheDocument();
  });
});
