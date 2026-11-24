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

const push = vi.fn();
const reportDashboard = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock("@/lib/auth", () => ({
  isAuthenticated: () => true,
}));

vi.mock("@/services/assets-service", () => ({
  reportService: {
    dashboard: (...args: unknown[]) => reportDashboard(...args),
  },
}));

const defaultKpis = {
  totalAssets: 12,
  readyToMove: 2,
  assigned: 8,
  retired: 1,
  pendingDisposal: 1,
  disposed: 0,
  inUseAsComponent: 0,
};

function renderDashboard(overrides: Partial<ComponentProps<typeof AssetOperationsDashboard>> = {}) {
  render(<AssetOperationsDashboard kpis={defaultKpis} {...overrides} />);
}

beforeEach(() => {
  push.mockReset();
  reportDashboard.mockReset();
  reportDashboard.mockResolvedValue({
    generated_at: "2026-09-22T10:00:00Z",
    by_status: [{ status: "active", count: 8 }],
    by_operational_status: [{ status: "READY_TO_MOVE", count: 4 }],
    analytics_kpis: {
      document_count: 2,
      component_count: 3,
      assignment_utilization_pct: 40,
      open_disposals: 0,
    },
    documents: { total: 2, coverage_pct: 50, by_type: [] },
    components: { total: 3, by_type: [] },
    lifecycle: { stages: [], open_maintenance: 0, open_disposals: 0 },
    usage: {
      active_assignments: 1,
      closed_assignments: 1,
      available_assets: 2,
      utilization_pct: 40,
      assets_currently_assigned: 1,
      registrations_by_month: [],
    },
  });
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

  it("renders page title without helper copy", () => {
    renderDashboard();
    expect(screen.getByRole("heading", { level: 1, name: "Dashboard" })).toBeInTheDocument();
    expect(
      screen.queryByText("Monitor inventory status and jump into common asset workflows."),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Click a tile to open matching inventory")).not.toBeInTheDocument();
    expect(
      within(screen.getByTestId("asset-ops-kpi-grid")).queryByRole("heading", {
        name: /Operational status/i,
      }),
    ).not.toBeInTheDocument();
  });

  it("does not render placeholder notification or profile controls", () => {
    renderDashboard();
    expect(screen.queryByRole("button", { name: "Notifications (placeholder)" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Profile (placeholder)" })).not.toBeInTheDocument();
  });

  it("does not render location selector or by-location breakdown", () => {
    renderDashboard();
    expect(screen.queryByRole("group", { name: "Location" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("asset-ops-location-breakdown")).not.toBeInTheDocument();
    expect(screen.queryByText("By Location")).not.toBeInTheDocument();
  });

  it("opens All Assets with ready preset when In Stock KPI is clicked", async () => {
    const user = userEvent.setup();
    renderDashboard();
    await user.click(screen.getByRole("button", { name: "Open In Stock assets" }));
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

  it("shows KPI loading skeletons when loading", () => {
    renderDashboard({ kpisLoading: true, kpis: null });
    expect(
      within(screen.getByTestId("asset-ops-kpi-grid")).getAllByLabelText("Loading statistic"),
    ).toHaveLength(4);
  });

  it("renders KPI values from props", () => {
    renderDashboard();
    const kpiGrid = screen.getByTestId("asset-ops-kpi-grid");
    expect(within(kpiGrid).getByText("12")).toBeInTheDocument();
    expect(within(kpiGrid).getByText("Assigned")).toBeInTheDocument();
    expect(within(kpiGrid).getByText("In Stock")).toBeInTheDocument();
    expect(within(kpiGrid).queryByText("In Use as Component")).not.toBeInTheDocument();
    expect(within(kpiGrid).queryByText("Retired")).not.toBeInTheDocument();
    expect(within(kpiGrid).queryByText("Pending Disposal")).not.toBeInTheDocument();
  });

  it("shows empty KPI dashes when kpis null and not loading", () => {
    renderDashboard({ kpis: null, kpisLoading: false });
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(4);
  });

  it("applies responsive KPI grid classes", () => {
    renderDashboard();
    const grid = screen.getByTestId("asset-ops-kpi-grid");
    expect(grid.className).toMatch(/xl:grid-cols-4/);
    expect(grid.className).toMatch(/sm:grid-cols-4/);
  });

  it("does not render KPI share percentages or progress bars", () => {
    renderDashboard({
      kpiTrends: {
        readyToMove: { label: "17% of total", direction: "neutral" },
        assigned: { label: "67% of total", direction: "neutral" },
      },
    });
    expect(screen.queryByText("17% of total")).not.toBeInTheDocument();
    expect(screen.queryByText("67% of total")).not.toBeInTheDocument();
    expect(screen.queryByText(/of total/i)).not.toBeInTheDocument();
  });

  it("does not render transfers section", () => {
    renderDashboard();
    expect(screen.queryByTestId("asset-ops-transfers")).not.toBeInTheDocument();
    expect(screen.queryByText("Transfer list")).not.toBeInTheDocument();
    expect(screen.queryByText("Transfers")).not.toBeInTheDocument();
  });

  it("renders register and assign quick actions only", () => {
    renderDashboard();
    const grid = screen.getByTestId("asset-ops-quick-actions-grid");
    expect(within(grid).getByRole("button", { name: /Register Asset/ })).toBeInTheDocument();
    expect(within(grid).getByRole("button", { name: /Assign Asset/ })).toBeInTheDocument();
    expect(within(grid).queryByRole("button", { name: /Return Asset/ })).not.toBeInTheDocument();
    expect(within(grid).queryByRole("button", { name: /Discovery/ })).not.toBeInTheDocument();
    expect(within(grid).queryByRole("button", { name: /Information Portal/ })).not.toBeInTheDocument();
    expect(within(grid).queryByRole("button", { name: /Reports/ })).not.toBeInTheDocument();
  });

  it("embeds reports panel without header Reports control", () => {
    renderDashboard();
    expect(screen.getByTestId("asset-ops-reports-panel")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Reports" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Reports$/ })).not.toBeInTheDocument();
  });

  it("navigates quick actions to existing routes", async () => {
    const user = userEvent.setup();
    renderDashboard();
    const grid = screen.getByTestId("asset-ops-quick-actions-grid");
    await user.click(within(grid).getByRole("button", { name: /Register Asset/ }));
    expect(push).toHaveBeenCalledWith("/assets/assets/new");
    await user.click(within(grid).getByRole("button", { name: /Assign Asset/ }));
    expect(push).toHaveBeenCalledWith("/assets/asset-assignments/new");
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
});
