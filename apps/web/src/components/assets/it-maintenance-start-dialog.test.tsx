/** @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ItMaintenanceStartDialog } from "@/components/assets/it-maintenance-start-dialog";

const startFromAsset = vi.fn();

vi.mock("@/services/assets-service", () => ({
  maintenanceService: {
    startFromAsset: (...args: unknown[]) => startFromAsset(...args),
  },
}));

vi.mock("@/lib/org-options", () => ({
  listEmployeeOptions: async () => [],
}));

vi.mock("@/services/procurement-service", () => ({
  listVendorOptions: async () => [],
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  startFromAsset.mockResolvedValue({
    status: "started",
    message: null,
    maintenance: {
      id: "mnt-1",
      asset_id: "asset-1",
      asset_code: "AST-1",
      status: "in_progress",
    },
  });
});

describe("ItMaintenanceStartDialog", () => {
  it("requires reason and duration then starts from asset", async () => {
    const user = userEvent.setup();
    const onStarted = vi.fn();
    const onCancel = vi.fn();

    render(
      <ItMaintenanceStartDialog
        open
        asset={{ id: "asset-1", assetCode: "AST-1", assetName: "Demo Laptop" }}
        onCancel={onCancel}
        onStarted={onStarted}
      />,
    );

    expect(screen.getByRole("heading", { name: "Start maintenance" })).toBeInTheDocument();
    expect(screen.getByText(/Demo Laptop/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Start maintenance" }));
    expect(await screen.findByText(/Reason is required/i)).toBeInTheDocument();
    expect(startFromAsset).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(/Reason/i), "Screen flicker");
    await user.clear(screen.getByLabelText(/Duration/i));
    await user.type(screen.getByLabelText(/Duration/i), "5");
    await user.click(screen.getByRole("button", { name: "Start maintenance" }));

    await waitFor(() => expect(startFromAsset).toHaveBeenCalledTimes(1));
    expect(startFromAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        asset_id: "asset-1",
        reason: "Screen flicker",
        expected_duration_days: 5,
      }),
    );
    expect(onStarted).toHaveBeenCalled();
  });
});
