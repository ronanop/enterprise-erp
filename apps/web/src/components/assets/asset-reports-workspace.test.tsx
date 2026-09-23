/** @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AssetReportsWorkspace } from "@/components/assets/asset-reports-workspace";

const dashboard = vi.fn();

vi.mock("@/lib/auth", () => ({
  isAuthenticated: () => true,
}));

vi.mock("@/services/assets-service", () => ({
  reportService: {
    dashboard: (...args: unknown[]) => dashboard(...args),
  },
}));

beforeEach(() => {
  dashboard.mockResolvedValue({
    generated_at: "2026-09-22T10:00:00Z",
    horizon_days: 30,
    kpis: {
      asset_count: 12,
      assigned_assets: 5,
      available_assets: 4,
      maintenance_due: 1,
      warranty_expiry: 2,
      insurance_expiry: 1,
      disposed_assets: 0,
      in_maintenance: 1,
    },
    analytics_kpis: {
      document_count: 9,
      active_documents: 8,
      assets_with_documents: 6,
      assets_without_documents: 6,
      document_coverage_pct: 50,
      component_count: 14,
      active_components: 11,
      assignment_utilization_pct: 42,
      assets_currently_assigned: 5,
      open_disposals: 1,
    },
    by_status: [
      { status: "active", count: 8 },
      { status: "in_maintenance", count: 2 },
      { status: "disposed", count: 2 },
    ],
    by_operational_status: [
      { status: "ready", count: 4 },
      { status: "assigned", count: 5 },
    ],
    documents: {
      total: 9,
      coverage_pct: 50,
      by_type: [
        { document_type: "invoice", count: 4 },
        { document_type: "warranty", count: 3 },
        { document_type: "manual", count: 2 },
      ],
      by_status: [{ status: "active", count: 8 }],
    },
    components: {
      total: 14,
      by_type: [
        { component_type: "CHARGER", count: 6 },
        { component_type: "MOUSE", count: 5 },
        { component_type: "OTHER", count: 3 },
      ],
      by_status: [{ status: "active", count: 11 }],
    },
    lifecycle: {
      stages: [
        { stage: "Registered", count: 12 },
        { stage: "Assigned", count: 5 },
        { stage: "In maintenance", count: 1 },
        { stage: "Depreciating", count: 3 },
        { stage: "Disposed", count: 2 },
      ],
      open_maintenance: 1,
      open_disposals: 1,
    },
    usage: {
      active_assignments: 5,
      closed_assignments: 7,
      assets_currently_assigned: 5,
      utilization_pct: 42,
      available_assets: 4,
      registrations_by_month: [
        { month: "2026-04", count: 1 },
        { month: "2026-05", count: 2 },
        { month: "2026-09", count: 4 },
      ],
    },
    by_category: [{ category_code: "LAPTOP", category_name: "Laptop", count: 8 }],
    by_department: [],
    recent_transfers: [],
    recent_notifications: [],
    health: {
      pct_in_maintenance: 8,
      open_maintenance: 1,
      policies_expiring: 3,
    },
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AssetReportsWorkspace", () => {
  it("renders analytics reports distinct from operational dashboard KPIs", async () => {
    render(<AssetReportsWorkspace />);

    expect(screen.getByRole("heading", { name: "Asset Reports" })).toBeInTheDocument();
    expect(
      screen.getByText(/documents, components, status mix, usage, and lifecycle/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Run report" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Saved snapshots" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Dashboard" })).not.toBeInTheDocument();
    expect(screen.queryByText("Assets by category")).not.toBeInTheDocument();
    expect(screen.queryByText("Health")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("9")).toBeInTheDocument();
    });
    expect(screen.getByText("Documents")).toBeInTheDocument();
    expect(screen.getByText("Components")).toBeInTheDocument();
    expect(screen.getByText("Asset status mix")).toBeInTheDocument();
    expect(screen.getByText("Documents by type")).toBeInTheDocument();
    expect(screen.getByText("Components by type")).toBeInTheDocument();
    expect(screen.getByText("Lifecycle funnel")).toBeInTheDocument();
    expect(screen.getByText("Registration trend")).toBeInTheDocument();
    expect(dashboard).toHaveBeenCalled();
  });

  it("refreshes analytics on Refresh", async () => {
    const user = userEvent.setup();
    render(<AssetReportsWorkspace />);
    await waitFor(() => expect(dashboard).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(dashboard).toHaveBeenCalledTimes(2));
  });
});
