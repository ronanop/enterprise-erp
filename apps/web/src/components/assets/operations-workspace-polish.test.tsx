/** @vitest-environment jsdom */

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  classifyActivityDay,
  groupRecentActivityByDay,
} from "@/components/assets/operations-activity-grouping";
import { OperationsHealthSummary } from "@/components/assets/operations-health-summary";
import {
  buildPendingActionItems,
  OperationsPendingActions,
} from "@/components/assets/operations-pending-actions";
import { OperationsRecentActivity } from "@/components/assets/operations-recent-activity";
import { OperationsStickyToolbar } from "@/components/assets/operations-sticky-toolbar";
import { EmptyState, BRANCH_ALL_VALUE } from "@/components/assets/shared";
import { AssignmentHistorySection } from "@/components/assets/inventory/interaction/drawer-sections/assignment-history-section";
import { TimelineSection } from "@/components/assets/inventory/interaction/drawer-sections/timeline-section";
import { DrawerActionBar } from "@/components/assets/inventory/interaction/drawer-sections/drawer-action-bar";

afterEach(() => {
  cleanup();
});

const branches = [
  { id: "b1", label: "Noida" },
  { id: "b2", label: "Mumbai" },
];

const kpis = {
  totalAssets: 20,
  readyToMove: 5,
  assigned: 10,
  retired: 2,
  pendingDisposal: 2,
  disposed: 1,
};

describe("OperationsStickyToolbar (CR-005 Phase 4)", () => {
  it("renders sticky toolbar landmark", () => {
    render(
      <OperationsStickyToolbar
        branchId={BRANCH_ALL_VALUE}
        branches={branches}
        onBranchChange={vi.fn()}
        searchValue=""
        onSearchChange={vi.fn()}
        onSearchSubmit={vi.fn()}
      />,
    );
    expect(screen.getByTestId("asset-ops-sticky-toolbar")).toBeInTheDocument();
  });

  it("renders global search form", () => {
    render(
      <OperationsStickyToolbar
        branchId={BRANCH_ALL_VALUE}
        branches={branches}
        onBranchChange={vi.fn()}
        searchValue=""
        onSearchChange={vi.fn()}
        onSearchSubmit={vi.fn()}
      />,
    );
    expect(screen.getByTestId("asset-ops-global-search")).toBeInTheDocument();
    expect(screen.getByLabelText("Global asset search")).toBeInTheDocument();
  });

  it("shows search placeholder covering tag/name/serial/employee/dept/branch", () => {
    render(
      <OperationsStickyToolbar
        branchId={BRANCH_ALL_VALUE}
        branches={branches}
        onBranchChange={vi.fn()}
        searchValue=""
        onSearchChange={vi.fn()}
        onSearchSubmit={vi.fn()}
      />,
    );
    expect(screen.getByPlaceholderText(/tag, name, serial, employee, department, branch/i)).toBeInTheDocument();
  });

  it("calls onSearchChange while typing", async () => {
    const user = userEvent.setup();
    const onSearchChange = vi.fn();
    render(
      <OperationsStickyToolbar
        branchId={BRANCH_ALL_VALUE}
        branches={branches}
        onBranchChange={vi.fn()}
        searchValue=""
        onSearchChange={onSearchChange}
        onSearchSubmit={vi.fn()}
      />,
    );
    await user.type(screen.getByLabelText("Global asset search"), "AST");
    expect(onSearchChange).toHaveBeenCalled();
  });

  it("submits search on button click", async () => {
    const user = userEvent.setup();
    const onSearchSubmit = vi.fn();
    render(
      <OperationsStickyToolbar
        branchId={BRANCH_ALL_VALUE}
        branches={branches}
        onBranchChange={vi.fn()}
        searchValue="AST-1"
        onSearchChange={vi.fn()}
        onSearchSubmit={onSearchSubmit}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(onSearchSubmit).toHaveBeenCalledOnce();
  });

  it("submits search on form enter", async () => {
    const user = userEvent.setup();
    const onSearchSubmit = vi.fn();
    render(
      <OperationsStickyToolbar
        branchId={BRANCH_ALL_VALUE}
        branches={branches}
        onBranchChange={vi.fn()}
        searchValue="serial"
        onSearchChange={vi.fn()}
        onSearchSubmit={onSearchSubmit}
      />,
    );
    await user.type(screen.getByLabelText("Global asset search"), "{Enter}");
    expect(onSearchSubmit).toHaveBeenCalled();
  });

  it("renders Add Asset, Allocate, Return, Import, Export, Refresh", () => {
    render(
      <OperationsStickyToolbar
        branchId={BRANCH_ALL_VALUE}
        branches={branches}
        onBranchChange={vi.fn()}
        searchValue=""
        onSearchChange={vi.fn()}
        onSearchSubmit={vi.fn()}
        onAddAsset={vi.fn()}
        onAllocate={vi.fn()}
        onReturn={vi.fn()}
        onImport={vi.fn()}
        onExport={vi.fn()}
        onRefresh={vi.fn()}
      />,
    );
    const bar = screen.getByTestId("asset-ops-sticky-toolbar");
    expect(within(bar).getByTestId("toolbar-add-asset")).toBeInTheDocument();
    expect(within(bar).getByRole("button", { name: /Allocate/ })).toBeInTheDocument();
    expect(within(bar).getByRole("button", { name: /^Return$/ })).toBeInTheDocument();
    expect(within(bar).getByRole("button", { name: /Import/ })).toBeInTheDocument();
    expect(within(bar).getByRole("button", { name: /Export/ })).toBeInTheDocument();
    expect(within(bar).getByTestId("asset-ops-refresh")).toBeInTheDocument();
  });

  it("invokes each toolbar action once", async () => {
    const user = userEvent.setup();
    const handlers = {
      onAddAsset: vi.fn(),
      onAllocate: vi.fn(),
      onReturn: vi.fn(),
      onImport: vi.fn(),
      onExport: vi.fn(),
      onRefresh: vi.fn(),
    };
    render(
      <OperationsStickyToolbar
        branchId={BRANCH_ALL_VALUE}
        branches={branches}
        onBranchChange={vi.fn()}
        searchValue=""
        onSearchChange={vi.fn()}
        onSearchSubmit={vi.fn()}
        {...handlers}
      />,
    );
    const bar = screen.getByTestId("asset-ops-sticky-toolbar");
    await user.click(within(bar).getByTestId("toolbar-add-asset"));
    await user.click(within(bar).getByRole("button", { name: /Allocate/ }));
    await user.click(within(bar).getByRole("button", { name: /^Return$/ }));
    await user.click(within(bar).getByRole("button", { name: /Import/ }));
    await user.click(within(bar).getByRole("button", { name: /Export/ }));
    await user.click(within(bar).getByTestId("asset-ops-refresh"));
    expect(handlers.onAddAsset).toHaveBeenCalledOnce();
    expect(handlers.onAllocate).toHaveBeenCalledOnce();
    expect(handlers.onReturn).toHaveBeenCalledOnce();
    expect(handlers.onImport).toHaveBeenCalledOnce();
    expect(handlers.onExport).toHaveBeenCalledOnce();
    expect(handlers.onRefresh).toHaveBeenCalledOnce();
  });

  it("delegates branch change", async () => {
    const user = userEvent.setup();
    const onBranchChange = vi.fn();
    render(
      <OperationsStickyToolbar
        branchId={BRANCH_ALL_VALUE}
        branches={branches}
        onBranchChange={onBranchChange}
        searchValue=""
        onSearchChange={vi.fn()}
        onSearchSubmit={vi.fn()}
      />,
    );
    const group = screen.getByRole("group", { name: "Branch" });
    await user.click(within(group).getByRole("button", { name: "Mumbai" }));
    expect(onBranchChange).toHaveBeenCalledWith("b2");
  });
});

describe("OperationsHealthSummary (CR-005 Phase 4)", () => {
  it("renders health section", () => {
    render(<OperationsHealthSummary kpis={kpis} />);
    expect(screen.getByTestId("asset-ops-health-summary")).toBeInTheDocument();
    expect(screen.getByText("Asset Health")).toBeInTheDocument();
  });

  it("maps Healthy Assets from readyToMove KPI", () => {
    render(<OperationsHealthSummary kpis={kpis} />);
    expect(screen.getByTestId("health-healthy")).toHaveTextContent("5");
  });

  it("shows Assigned count", () => {
    render(<OperationsHealthSummary kpis={kpis} />);
    expect(screen.getByTestId("health-assigned")).toHaveTextContent("10");
  });

  it("shows Pending Disposal count", () => {
    render(<OperationsHealthSummary kpis={kpis} />);
    expect(screen.getByTestId("health-pending-disposal")).toHaveTextContent("2");
  });

  it("shows Retired count", () => {
    render(<OperationsHealthSummary kpis={kpis} />);
    expect(screen.getByTestId("health-retired")).toHaveTextContent("2");
  });

  it("shows Disposed count", () => {
    render(<OperationsHealthSummary kpis={kpis} />);
    expect(screen.getByTestId("health-disposed")).toHaveTextContent("1");
  });

  it("shows skeleton cells while loading", () => {
    render(<OperationsHealthSummary loading />);
    expect(screen.getAllByLabelText("Loading statistic")).toHaveLength(5);
  });

  it("shows em dash when KPIs missing", () => {
    render(<OperationsHealthSummary kpis={null} />);
    expect(screen.getByTestId("health-healthy")).toHaveTextContent("—");
  });
});

describe("buildPendingActionItems (CR-005 Phase 4)", () => {
  it("limits to 5 items", () => {
    const readyRows = Array.from({ length: 10 }, (_, i) => ({
      id: `r${i}`,
      cells: [`AST-${i}`, "Laptop"],
    }));
    const items = buildPendingActionItems({ readyRows, limit: 5 });
    expect(items).toHaveLength(5);
  });

  it("includes pending assignments from ready queue", () => {
    const items = buildPendingActionItems({
      readyRows: [{ id: "a1", cells: ["AST-A", "Name"] }],
    });
    expect(items[0]?.kind).toBe("assignment");
    expect(items[0]?.detail).toBe("AST-A");
  });

  it("includes pending returns when assigned count > 0", () => {
    const items = buildPendingActionItems({ assignedCount: 3, limit: 5 });
    expect(items.some((i) => i.kind === "return")).toBe(true);
  });

  it("includes pending disposal rows", () => {
    const items = buildPendingActionItems({
      disposalRows: [{ id: "d1", cells: ["AST-D"] }],
    });
    expect(items.some((i) => i.kind === "disposal" && i.detail === "AST-D")).toBe(true);
  });

  it("appends maintenance when room remains", () => {
    const items = buildPendingActionItems({ limit: 5 });
    expect(items.some((i) => i.kind === "maintenance")).toBe(true);
  });

  it("wires allocate navigation with asset id", () => {
    const onAllocate = vi.fn();
    const items = buildPendingActionItems({
      readyRows: [{ id: "asset-9", cells: ["AST-9"] }],
      onAllocate,
    });
    items[0]?.onNavigate?.();
    expect(onAllocate).toHaveBeenCalledWith("asset-9");
  });
});

describe("OperationsPendingActions (CR-005 Phase 4)", () => {
  it("renders pending actions landmark", () => {
    render(<OperationsPendingActions items={[]} />);
    expect(screen.getByTestId("asset-ops-pending-actions")).toBeInTheDocument();
  });

  it("shows empty queue copy", () => {
    render(<OperationsPendingActions items={[]} />);
    expect(screen.getByText("No pending actions")).toBeInTheDocument();
  });

  it("shows skeleton while loading", () => {
    render(<OperationsPendingActions loading />);
    expect(screen.getByTestId("pending-actions-skeleton")).toBeInTheDocument();
  });

  it("renders item titles and Open buttons", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(
      <OperationsPendingActions
        items={[
          {
            id: "1",
            kind: "assignment",
            title: "Pending Assignment",
            detail: "AST-1",
            onNavigate,
          },
        ]}
      />,
    );
    expect(screen.getByText("Pending Assignment")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(onNavigate).toHaveBeenCalledOnce();
  });
});

describe("activity day grouping (CR-005 Phase 4)", () => {
  const now = new Date(2026, 7, 6, 12, 0, 0);

  it("classifies today", () => {
    expect(classifyActivityDay(now.toISOString(), now)).toBe("today");
  });

  it("classifies yesterday", () => {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    expect(classifyActivityDay(y.toISOString(), now)).toBe("yesterday");
  });

  it("classifies earlier", () => {
    expect(classifyActivityDay("2026-07-01T00:00:00.000Z", now)).toBe("earlier");
  });

  it("treats unknown dates as earlier", () => {
    expect(classifyActivityDay("—", now)).toBe("earlier");
  });

  it("groups items into Today / Yesterday / Earlier labels", () => {
    const today = now.toISOString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const groups = groupRecentActivityByDay(
      [
        {
          id: "1",
          kind: "assigned",
          label: "A",
          asset: "AST-1",
          employee: "E",
          date: today,
          status: "active",
        },
        {
          id: "2",
          kind: "registered",
          label: "B",
          asset: "AST-2",
          employee: "—",
          date: yesterday.toISOString(),
          status: "active",
        },
        {
          id: "3",
          kind: "transfer",
          label: "C",
          asset: "AST-3",
          employee: "—",
          date: "2026-01-01T00:00:00.000Z",
          status: "completed",
        },
      ],
      now,
    );
    expect(groups.map((g) => g.label)).toEqual(["Today", "Yesterday", "Earlier"]);
  });

  it("omits empty day buckets", () => {
    const groups = groupRecentActivityByDay(
      [
        {
          id: "1",
          kind: "assigned",
          label: "A",
          asset: "AST-1",
          employee: "E",
          date: now.toISOString(),
          status: "active",
        },
      ],
      now,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]?.label).toBe("Today");
  });
});

describe("OperationsRecentActivity grouping UI (CR-005 Phase 4)", () => {
  const nowIso = new Date().toISOString();

  it("renders day group headers", () => {
    render(
      <OperationsRecentActivity
        items={[
          {
            id: "1",
            kind: "assigned",
            label: "Asset Assigned",
            asset: "AST-1",
            employee: "Asha",
            date: nowIso,
            status: "active",
          },
        ]}
      />,
    );
    expect(screen.getByTestId("activity-day-group")).toHaveTextContent("Today");
  });

  it("uses No Activity empty copy", () => {
    render(<OperationsRecentActivity items={[]} />);
    expect(screen.getByText("No Activity")).toBeInTheDocument();
    expect(screen.getByText(/Activity will appear after operations begin/i)).toBeInTheDocument();
  });

  it("uses skeleton while loading (no spinner)", () => {
    render(<OperationsRecentActivity loading items={[]} />);
    expect(screen.queryByRole("status", { name: /loading/i })).not.toBeInTheDocument();
    expect(screen.getByTestId("asset-ops-recent-activity")).toBeInTheDocument();
  });
});

describe("Smart EmptyState variants (CR-005 Phase 4)", () => {
  it("renders No Assets contextual copy", () => {
    render(<EmptyState variant="no-assets" />);
    expect(screen.getByText("No Assets")).toBeInTheDocument();
    expect(screen.getByText("Register your first asset.")).toBeInTheDocument();
  });

  it("renders No Search Results contextual copy", () => {
    render(<EmptyState variant="no-search" />);
    expect(screen.getByText("No Search Results")).toBeInTheDocument();
    expect(screen.getByText(/Try another Asset Tag or Employee/i)).toBeInTheDocument();
  });

  it("renders No Activity contextual copy", () => {
    render(<EmptyState variant="no-activity" />);
    expect(screen.getByText("No Activity")).toBeInTheDocument();
  });

  it("renders optional action slot", () => {
    render(
      <EmptyState
        variant="no-assets"
        action={<button type="button">Add Asset</button>}
      />,
    );
    expect(screen.getByRole("button", { name: "Add Asset" })).toBeInTheDocument();
  });
});

describe("Drawer polish (CR-005 Phase 4)", () => {
  it("groups assignment history by day", () => {
    const today = new Date().toISOString();
    render(
      <AssignmentHistorySection
        history={[
          {
            id: "h1",
            assigneeLabel: "Asha",
            documentNumber: "ASN-1",
            status: "active",
            allocatedAt: today,
            returnedAt: "—",
            deliveryReferenceNumber: "—",
            deliveryReferenceStatus: "—",
            assignmentRemarks: "—",
            returnRemarks: "—",
          },
        ]}
      />,
    );
    expect(screen.getByTestId("drawer-history-day-group")).toHaveTextContent("Today");
  });

  it("groups timeline events by day", () => {
    const today = new Date().toISOString();
    render(
      <TimelineSection
        events={[{ id: "t1", label: "Assigned", at: today, kind: "assigned" }]}
      />,
    );
    expect(screen.getByTestId("drawer-timeline-day-group")).toHaveTextContent("Today");
  });

  it("renders sticky drawer action bar", () => {
    render(
      <DrawerActionBar
        asset={{ id: "a1", assetTag: "AST-1" }}
        onAction={vi.fn()}
      />,
    );
    const bar = screen.getByTestId("drawer-action-bar");
    expect(bar.className).toMatch(/sticky/);
  });
});
