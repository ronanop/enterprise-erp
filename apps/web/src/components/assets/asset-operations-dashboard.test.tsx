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
    expect(screen.getByTestId("asset-ops-kpi-ops-note")).toHaveTextContent(
      "Counts by Operational Status",
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

  it("renders branch breakdown when provided", () => {
    renderDashboard({
      byBranchRows: [
        {
          branchId: "b1",
          label: "Noida",
          totalAssets: 10,
          readyToMove: 2,
          assigned: 6,
          retired: 1,
          pendingDisposal: 1,
          disposed: 0,
        },
      ],
    });
    expect(screen.getByTestId("asset-ops-branch-breakdown")).toBeInTheDocument();
    expect(screen.getByText("By branch")).toBeInTheDocument();
  });

  it("shows queue count badges", () => {
    renderDashboard({
      queueTotals: { ready: 12, disposal: 3, assignments: 8 },
    });
    expect(screen.getAllByTestId("queue-card-count")).toHaveLength(3);
    expect(screen.getByLabelText("12 total")).toBeInTheDocument();
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

  it("opens inventory presets from view-all actions", async () => {
    const user = userEvent.setup();
    renderDashboard({ branchId: "b1" });
    await user.click(screen.getByRole("button", { name: "View all ready" }));
    expect(push).toHaveBeenCalledWith("/assets/assets");
    expect(peekInventoryUiSnapshot()?.preset).toBe("ready");
    expect(peekInventoryUiSnapshot()?.headerBranchId).toBe("b1");

    await user.click(screen.getByRole("button", { name: "View all pending disposal" }));
    expect(peekInventoryUiSnapshot()?.preset).toBe("pending_disposal");

    await user.click(screen.getByRole("button", { name: "View all assignments" }));
    expect(push).toHaveBeenCalledWith("/assets/asset-assignments");
  });

  it("renders operations queues", () => {
    renderDashboard();
    expect(screen.getByText("Ready to Move Queue")).toBeInTheDocument();
    expect(screen.getByText("Pending Disposal Queue")).toBeInTheDocument();
    expect(screen.getByText("Recent Assignments")).toBeInTheDocument();
    expect(screen.getByText("AST-1")).toBeInTheDocument();
  });

  it("uses 2+1 operations layout (queues row + full-width assignments)", () => {
    renderDashboard();
    const queues = screen.getByTestId("asset-ops-operations-grid");
    expect(queues.className).toMatch(/lg:grid-cols-2/);
    expect(queues.className).not.toMatch(/lg:grid-cols-3/);
    expect(within(queues).getByText("Ready to Move Queue")).toBeInTheDocument();
    expect(within(queues).getByText("Pending Disposal Queue")).toBeInTheDocument();
    expect(within(queues).queryByText("Recent Assignments")).not.toBeInTheDocument();
    expect(
      within(screen.getByTestId("asset-ops-assignments-row")).getByText("Recent Assignments"),
    ).toBeInTheDocument();
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

  it("shows custom empty queue messaging", () => {
    renderDashboard({
      readyQueueRows: [],
      queueErrors: { ready: "Queue API failed" },
    });
    expect(screen.getByText("Could not load queue")).toBeInTheDocument();
    expect(screen.getByText("Queue API failed")).toBeInTheDocument();
  });
});
