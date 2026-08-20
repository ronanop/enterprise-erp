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
  const onRefresh = vi.fn();
  const onAddAsset = vi.fn();
  const onAllocate = vi.fn();
  const onReturn = vi.fn();
  const onImport = vi.fn();
  const onExport = vi.fn();
  const onSearchChange = vi.fn();
  const onSearchSubmit = vi.fn();
  render(
    <AssetOperationsDashboard
      branchId={BRANCH_ALL_VALUE}
      branches={branches}
      onBranchChange={onBranchChange}
      searchValue=""
      onSearchChange={onSearchChange}
      onSearchSubmit={onSearchSubmit}
      onRefresh={onRefresh}
      onAddAsset={onAddAsset}
      onAllocate={onAllocate}
      onReturn={onReturn}
      onImport={onImport}
      onExport={onExport}
      kpis={defaultKpis}
      recentActivity={[
        {
          id: "1",
          kind: "assigned",
          label: "Asset Assigned",
          asset: "AST-1",
          employee: "Asha",
          date: "Aug 1, 2026",
          status: "active",
        },
      ]}
      pendingActions={[
        {
          id: "p1",
          kind: "assignment",
          title: "Pending Assignment",
          detail: "AST-READY",
          onNavigate: vi.fn(),
        },
      ]}
      register={<div data-testid="mock-asset-register">Register</div>}
      {...overrides}
    />,
  );
  return {
    onBranchChange,
    onRefresh,
    onAddAsset,
    onAllocate,
    onReturn,
    onImport,
    onExport,
    onSearchChange,
    onSearchSubmit,
  };
}

afterEach(() => {
  cleanup();
});

describe("AssetOperationsDashboard (CR-005 Phase 4)", () => {
  it("renders root landmark", () => {
    renderDashboard();
    expect(screen.getByTestId("asset-operations-dashboard")).toBeInTheDocument();
  });

  it("renders page title and workspace subtitle", () => {
    renderDashboard();
    expect(screen.getByRole("heading", { level: 1, name: "Asset Operations" })).toBeInTheDocument();
    expect(
      screen.getByText("Manage all company assets from one workspace."),
    ).toBeInTheDocument();
  });

  it("renders sticky toolbar with branch and refresh", () => {
    renderDashboard();
    expect(screen.getByTestId("asset-ops-sticky-toolbar")).toBeInTheDocument();
    const group = screen.getByRole("group", { name: "Branch" });
    expect(within(group).getByRole("button", { name: "All" })).toBeInTheDocument();
    expect(screen.getByTestId("asset-ops-refresh")).toBeInTheDocument();
  });

  it("renders operations quick-actions card grid", () => {
    renderDashboard();
    expect(screen.getByTestId("asset-ops-quick-actions-grid")).toBeInTheDocument();
  });

  it("renders ready and disposal queue cards", () => {
    renderDashboard();
    expect(screen.getByTestId("asset-ops-queues-row")).toBeInTheDocument();
    expect(screen.getByText("Ready To Move Queue")).toBeInTheDocument();
    expect(screen.getByText("Pending Disposal Queue")).toBeInTheDocument();
  });

  it("delegates branch change to parent", async () => {
    const user = userEvent.setup();
    const { onBranchChange } = renderDashboard();
    const group = screen.getByRole("group", { name: "Branch" });
    await user.click(within(group).getByRole("button", { name: "Mumbai" }));
    expect(onBranchChange).toHaveBeenCalledWith("b2");
  });

  it("invokes onRefresh from sticky Refresh button", async () => {
    const user = userEvent.setup();
    const { onRefresh } = renderDashboard();
    await user.click(screen.getByTestId("asset-ops-refresh"));
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it("submits global search", async () => {
    const user = userEvent.setup();
    const { onSearchChange, onSearchSubmit } = renderDashboard({ searchValue: "AST" });
    const form = screen.getByTestId("asset-ops-global-search");
    await user.type(within(form).getByLabelText("Global asset search"), "-9");
    expect(onSearchChange).toHaveBeenCalled();
    await user.click(within(form).getByRole("button", { name: "Search" }));
    expect(onSearchSubmit).toHaveBeenCalledOnce();
  });

  it("shows KPI loading skeletons when loading", () => {
    renderDashboard({ kpisLoading: true, kpis: null });
    const kpiGrid = screen.getByTestId("asset-ops-kpi-grid");
    expect(within(kpiGrid).getAllByLabelText("Loading statistic")).toHaveLength(6);
  });

  it("renders KPI values in CR-005 order", () => {
    renderDashboard();
    const kpiGrid = screen.getByTestId("asset-ops-kpi-grid");
    const labelOrder = [
      "Total Assets",
      "Ready To Move",
      "Assigned",
      "Pending Disposal",
      "Retired",
      "Disposed",
    ];
    const joined = kpiGrid.textContent ?? "";
    let lastIndex = -1;
    for (const label of labelOrder) {
      const idx = joined.indexOf(label);
      expect(idx).toBeGreaterThan(lastIndex);
      lastIndex = idx;
    }
    expect(within(kpiGrid).getByText("12")).toBeInTheDocument();
  });

  it("renders health summary from KPIs", () => {
    renderDashboard();
    expect(screen.getByTestId("asset-ops-health-summary")).toBeInTheDocument();
    expect(screen.getByTestId("health-healthy")).toHaveTextContent("2");
    expect(screen.getByTestId("health-assigned")).toHaveTextContent("8");
  });

  it("renders pending actions widget", () => {
    renderDashboard();
    expect(screen.getByTestId("asset-ops-pending-actions")).toBeInTheDocument();
    expect(screen.getByText("Pending Assignment")).toBeInTheDocument();
    expect(screen.getByText("AST-READY")).toBeInTheDocument();
  });

  it("invokes sticky toolbar action callbacks", async () => {
    const user = userEvent.setup();
    const handlers = renderDashboard();
    const bar = screen.getByTestId("asset-ops-sticky-toolbar");
    await user.click(within(bar).getByTestId("toolbar-add-asset"));
    await user.click(within(bar).getByRole("button", { name: /Allocate/ }));
    await user.click(within(bar).getByRole("button", { name: /^Return$/ }));
    await user.click(within(bar).getByRole("button", { name: /Import/ }));
    await user.click(within(bar).getByRole("button", { name: /Export/ }));
    expect(handlers.onAddAsset).toHaveBeenCalledOnce();
    expect(handlers.onAllocate).toHaveBeenCalledOnce();
    expect(handlers.onReturn).toHaveBeenCalledOnce();
    expect(handlers.onImport).toHaveBeenCalledOnce();
    expect(handlers.onExport).toHaveBeenCalledOnce();
  });

  it("embeds Asset Register slot", () => {
    renderDashboard();
    const section = screen.getByTestId("asset-ops-register-section");
    expect(within(section).getByTestId("mock-asset-register")).toBeInTheDocument();
  });

  it("renders recent activity rows", () => {
    renderDashboard();
    expect(screen.getByTestId("asset-ops-recent-activity")).toBeInTheDocument();
    expect(screen.getByText("Asset Assigned")).toBeInTheDocument();
    expect(screen.getByText("AST-1")).toBeInTheDocument();
    expect(screen.getByText("Asha")).toBeInTheDocument();
  });

  it("shows empty recent activity state", () => {
    renderDashboard({ recentActivity: [] });
    expect(screen.getByText("No Activity")).toBeInTheDocument();
  });

  it("shows error card with retry via onRefresh", async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn();
    renderDashboard({ errorMessage: "Server unavailable", onRefresh });
    expect(screen.getByTestId("asset-ops-error-card")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it("renders productivity row for health and pending", () => {
    renderDashboard();
    expect(screen.getByTestId("asset-ops-productivity-row")).toBeInTheDocument();
  });
});
