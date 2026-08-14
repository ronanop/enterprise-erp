import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { StartDisposalConfirmDialog } from "@/components/assets/start-disposal-confirm-dialog";
import {
  applyOperationalGatesToInventoryPermissions,
  buildInventoryActionPermissions,
} from "@/components/assets/navigation/inventory-permissions";
import {
  canStartDisposalFromOperationalStatus,
  isOpsBlockedForNormalOperations,
  operationalStatusHelpText,
} from "@/components/assets/shared/asset-status";

describe("Phase 5D retirement helpers", () => {
  it("allows Start Disposal only for RETIRED", () => {
    expect(canStartDisposalFromOperationalStatus("RETIRED")).toBe(true);
    expect(canStartDisposalFromOperationalStatus("PENDING_DISPOSAL")).toBe(false);
    expect(canStartDisposalFromOperationalStatus("READY_TO_MOVE")).toBe(false);
  });

  it("blocks normal ops for retired / pending / disposed", () => {
    expect(isOpsBlockedForNormalOperations("RETIRED")).toBe(true);
    expect(isOpsBlockedForNormalOperations("PENDING_DISPOSAL")).toBe(true);
    expect(isOpsBlockedForNormalOperations("DISPOSED")).toBe(true);
    expect(isOpsBlockedForNormalOperations("READY_TO_MOVE")).toBe(false);
  });

  it("explains operational status in business language", () => {
    expect(operationalStatusHelpText("RETIRED")).toMatch(/not available for assignment/i);
    expect(operationalStatusHelpText("PENDING_DISPOSAL")).toMatch(/disposal workflow/i);
    expect(operationalStatusHelpText("DISPOSED")).toMatch(/completed the disposal/i);
  });
});

describe("inventory ops gates", () => {
  const base = buildInventoryActionPermissions(() => true);

  it("shows Start Disposal only when RETIRED", () => {
    const retired = applyOperationalGatesToInventoryPermissions(base, "RETIRED");
    expect(retired.startDisposal).toBe(true);
    expect(retired.reinstate).toBe(false);
    expect(retired.assign).toBe(false);
    expect(retired.transfer).toBe(false);
    expect(retired.maintenance).toBe(false);

    const ready = applyOperationalGatesToInventoryPermissions(base, "READY_TO_MOVE");
    expect(ready.startDisposal).toBe(false);
    expect(ready.reinstate).toBe(false);
    expect(ready.assign).toBe(true);
  });

  it("requires disposal:create for Start Disposal RBAC", () => {
    const perms = buildInventoryActionPermissions((p) => p === "asset.disposal:create");
    expect(perms.startDisposal).toBe(true);
    expect(perms.reinstate).toBe(true);
    expect(perms.assign).toBe(false);
  });
});

describe("StartDisposalConfirmDialog", () => {
  it("renders confirmation copy and confirms on action", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <StartDisposalConfirmDialog
        open
        asset={{
          id: "a1",
          assetCode: "AST-100",
          assetName: "Dell Latitude 5420",
          serialNumber: "SN-1",
          lifecycleStatus: "active",
          operationalStatus: "RETIRED",
        }}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByTestId("start-disposal-confirm-dialog")).toBeInTheDocument();
    expect(screen.getByText(/Dell Latitude 5420/)).toBeInTheDocument();
    expect(screen.getByText(/no longer available for operational use/i)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("start-disposal-confirm-button"));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("shows error and supports Escape cancel", () => {
    const onCancel = vi.fn();
    render(
      <StartDisposalConfirmDialog
        open
        asset={{
          id: "a1",
          assetCode: "AST-100",
          assetName: "Laptop",
          operationalStatus: "RETIRED",
          lifecycleStatus: "active",
        }}
        error="Asset is already pending disposal."
        onCancel={onCancel}
        onConfirm={() => undefined}
      />,
    );
    expect(screen.getByTestId("start-disposal-error")).toHaveTextContent(
      /already pending disposal/i,
    );
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onCancel).toHaveBeenCalled();
  });
});
