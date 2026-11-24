/** @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const updateMaintenance = vi.fn();
const completeMaintenance = vi.fn();
const getTimeline = vi.fn(async () => []);

vi.mock("@/lib/org-options", () => ({
  listBranchOptions: async () => [{ id: "b1", label: "HQ" }],
  listEmployeeOptions: async () => [{ id: "e1", label: "E001 — Ada" }],
}));

vi.mock("@/services/procurement-service", () => ({
  listVendorOptions: async () => [{ id: "v1", label: "Acme Parts" }],
}));

vi.mock("@/services/assets-service", () => ({
  maintenanceService: {
    get: vi.fn(),
    update: (...args: unknown[]) => updateMaintenance(...args),
    complete: (...args: unknown[]) => completeMaintenance(...args),
    timeline: (...args: unknown[]) => getTimeline(...args),
  },
}));

import { MaintenanceWorkOrderDetailDrawer } from "@/components/assets/maintenance-work-order-detail-drawer";
import type { MaintenanceRow } from "@/services/assets-service";

const baseRow: MaintenanceRow = {
  id: "m1",
  document_number: "AMNT-0001",
  asset_id: "a1",
  asset_code: "ASSET-000113",
  asset_name: "Dell MS116",
  maintenance_type: "corrective",
  reason: "battery issue",
  status: "in_progress",
  version: 2,
  branch_id: "b1",
  cost_amount: null,
  technician_employee_id: null,
  vendor_id: null,
};

afterEach(() => {
  cleanup();
  updateMaintenance.mockReset();
  completeMaintenance.mockReset();
  getTimeline.mockReset();
  getTimeline.mockResolvedValue([]);
});

beforeEach(() => {
  updateMaintenance.mockResolvedValue({
    ...baseRow,
    version: 3,
    cost_amount: 125.5,
    technician_employee_id: "e1",
    vendor_id: "v1",
  });
});

describe("MaintenanceWorkOrderDetailDrawer service details edit", () => {
  it("lets operators edit and save cost, technician, and vendor", async () => {
    const onUpdated = vi.fn();
    const user = userEvent.setup();
    render(
      <MaintenanceWorkOrderDetailDrawer
        open
        workOrder={baseRow}
        onClose={() => undefined}
        onUpdated={onUpdated}
      />,
    );

    await user.click(await screen.findByTestId("maintenance-edit-service-details"));
    const form = screen.getByTestId("maintenance-service-details-form");
    expect(form).toBeInTheDocument();
    expect(screen.getByTestId("maintenance-edit-technician")).toBeInTheDocument();
    expect(screen.getByTestId("maintenance-edit-vendor")).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Cost"));
    await user.type(screen.getByLabelText("Cost"), "125.5");
    await user.click(screen.getByTestId("maintenance-save-service-details"));

    await waitFor(() =>
      expect(updateMaintenance).toHaveBeenCalledWith("m1", {
        version: 2,
        cost_amount: 125.5,
        technician_employee_id: null,
        vendor_id: null,
      }),
    );
    await waitFor(() => expect(onUpdated).toHaveBeenCalled());
    expect(screen.queryByTestId("maintenance-service-details-form")).not.toBeInTheDocument();
    expect(screen.getByText("125.5")).toBeInTheDocument();
  });

  it("hides edit when the work order is completed", async () => {
    render(
      <MaintenanceWorkOrderDetailDrawer
        open
        workOrder={{ ...baseRow, status: "completed" }}
        onClose={() => undefined}
      />,
    );
    await screen.findByText("Work order detail");
    expect(screen.queryByTestId("maintenance-edit-service-details")).not.toBeInTheDocument();
  });
});
