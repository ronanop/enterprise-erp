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
    by_category: [{ category_code: "LAPTOP", category_name: "Laptop", count: 8 }],
    health: {
      pct_in_maintenance: 8,
      open_maintenance: 1,
      policies_expiring: 3,
    },
    generated_at: "2026-09-18T10:00:00Z",
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AssetReportsWorkspace", () => {
  it("renders dashboard only without Run report or Saved snapshots tabs", async () => {
    render(<AssetReportsWorkspace />);

    expect(screen.getByRole("heading", { name: "Asset Reports" })).toBeInTheDocument();
    expect(
      screen.getByText("Operational dashboards and read-only analytics."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Run report" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Saved snapshots" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Dashboard" })).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("12")).toBeInTheDocument();
    });
    expect(screen.getByText("Assets by category")).toBeInTheDocument();
    expect(screen.getByText("Health")).toBeInTheDocument();
    expect(dashboard).toHaveBeenCalled();
  });

  it("refreshes dashboard on Refresh", async () => {
    const user = userEvent.setup();
    render(<AssetReportsWorkspace />);
    await waitFor(() => expect(dashboard).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(dashboard).toHaveBeenCalledTimes(2));
  });
});
