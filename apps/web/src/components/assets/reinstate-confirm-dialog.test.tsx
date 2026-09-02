import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { ReinstateConfirmDialog } from "@/components/assets/reinstate-confirm-dialog";
import {
  applyOperationalGatesToInventoryPermissions,
  buildInventoryActionPermissions,
} from "@/components/assets/navigation/inventory-permissions";
import { buildReturnWizardHref } from "@/components/assets/navigation/assignment-navigation";
import {
  canReinstateFromOperationalStatus,
  isOpsBlockedForTransferOrMaintenance,
} from "@/components/assets/shared/asset-status";

describe("Phase 5E reinstate helpers", () => {
  it("allows Reinstate only for PENDING_DISPOSAL", () => {
    expect(canReinstateFromOperationalStatus("PENDING_DISPOSAL")).toBe(true);
    expect(canReinstateFromOperationalStatus("RETIRED")).toBe(false);
    expect(canReinstateFromOperationalStatus("READY_TO_MOVE")).toBe(false);
    expect(canReinstateFromOperationalStatus("ASSIGNED")).toBe(false);
    expect(canReinstateFromOperationalStatus("DISPOSED")).toBe(false);
  });

  it("blocks transfer/maintenance while ASSIGNED or terminal ops", () => {
    expect(isOpsBlockedForTransferOrMaintenance("ASSIGNED")).toBe(true);
    expect(isOpsBlockedForTransferOrMaintenance("RETIRED")).toBe(true);
    expect(isOpsBlockedForTransferOrMaintenance("PENDING_DISPOSAL")).toBe(true);
    expect(isOpsBlockedForTransferOrMaintenance("DISPOSED")).toBe(true);
    expect(isOpsBlockedForTransferOrMaintenance("READY_TO_MOVE")).toBe(false);
  });
});

describe("inventory reinstate / custody gates", () => {
  const base = buildInventoryActionPermissions(() => true);

  it("shows Reinstate only when PENDING_DISPOSAL", () => {
    const pending = applyOperationalGatesToInventoryPermissions(base, "PENDING_DISPOSAL");
    expect(pending.reinstate).toBe(true);
    expect(pending.startDisposal).toBe(false);
    expect(pending.assign).toBe(false);
    expect(pending.transfer).toBe(false);
    expect(pending.maintenance).toBe(false);

    const ready = applyOperationalGatesToInventoryPermissions(base, "READY_TO_MOVE");
    expect(ready.reinstate).toBe(false);
    expect(ready.assign).toBe(true);
    expect(ready.transfer).toBe(true);
    expect(ready.maintenance).toBe(true);
  });

  it("blocks transfer and maintenance while ASSIGNED", () => {
    const assigned = applyOperationalGatesToInventoryPermissions(base, "ASSIGNED");
    expect(assigned.return).toBe(true);
    expect(assigned.transfer).toBe(false);
    expect(assigned.maintenance).toBe(false);
    expect(assigned.reinstate).toBe(false);
  });

  it("requires disposal:create for Reinstate RBAC", () => {
    const perms = buildInventoryActionPermissions((p) => p === "asset.disposal:create");
    expect(perms.reinstate).toBe(true);
    expect(perms.startDisposal).toBe(true);
    expect(perms.assign).toBe(false);
  });
});

describe("Detail Return navigation", () => {
  it("builds return wizard href with assetId prefilled", () => {
    const href = buildReturnWizardHref({ assetId: "asset-123", intent: "return" });
    expect(href).toContain("/assets/asset-assignments/return");
    expect(href).toContain("assetId=asset-123");
    expect(href).toContain("intent=return");
  });
});

describe("ReinstateConfirmDialog", () => {
  it("renders confirmation copy and confirms on action", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ReinstateConfirmDialog
        open
        asset={{
          id: "a1",
          assetCode: "AST-200",
          assetName: "MacBook Pro",
          serialNumber: "SN-9",
          lifecycleStatus: "active",
          operationalStatus: "PENDING_DISPOSAL",
        }}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByTestId("reinstate-confirm-dialog")).toBeInTheDocument();
    expect(screen.getByText(/MacBook Pro/)).toBeInTheDocument();
    expect(screen.getByText(/return the asset to Ready to Move/i)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("reinstate-confirm-button"));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("shows error and supports Escape cancel", () => {
    const onCancel = vi.fn();
    render(
      <ReinstateConfirmDialog
        open
        asset={{
          id: "a1",
          assetCode: "AST-200",
          assetName: "Laptop",
          operationalStatus: "PENDING_DISPOSAL",
          lifecycleStatus: "active",
        }}
        error="Asset is already ready to move and cannot be reinstated."
        onCancel={onCancel}
        onConfirm={() => undefined}
      />,
    );
    expect(screen.getByTestId("reinstate-error")).toHaveTextContent(/already ready to move/i);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onCancel).toHaveBeenCalled();
  });
});
