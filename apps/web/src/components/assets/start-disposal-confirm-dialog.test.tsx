/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";

import {
  applyOperationalGatesToInventoryPermissions,
  buildInventoryActionPermissions,
} from "@/components/assets/navigation/inventory-permissions";
import {
  canReinstateFromOperationalStatus,
  canStartDisposalFromOperationalStatus,
  isOpsBlockedForNormalOperations,
  operationalStatusHelpText,
} from "@/components/assets/shared/asset-status";

describe("dispose / reinstate gates (simplified lifecycle)", () => {
  it("allows Dispose for Ready and Assigned", () => {
    expect(canStartDisposalFromOperationalStatus("READY_TO_MOVE")).toBe(true);
    expect(canStartDisposalFromOperationalStatus("ASSIGNED")).toBe(true);
    expect(canStartDisposalFromOperationalStatus("RETIRED")).toBe(false);
    expect(canStartDisposalFromOperationalStatus("PENDING_DISPOSAL")).toBe(false);
  });

  it("disables reinstate (Pending Disposal queue removed)", () => {
    expect(canReinstateFromOperationalStatus("PENDING_DISPOSAL")).toBe(true);
    const base = buildInventoryActionPermissions(() => true);
    const pending = applyOperationalGatesToInventoryPermissions(base, "PENDING_DISPOSAL");
    expect(pending.reinstate).toBe(false);
    expect(pending.startDisposal).toBe(false);
  });

  it("shows Dispose for Ready in inventory permissions", () => {
    const base = buildInventoryActionPermissions(() => true);
    const ready = applyOperationalGatesToInventoryPermissions(base, "READY_TO_MOVE");
    expect(ready.startDisposal).toBe(true);
    const assigned = applyOperationalGatesToInventoryPermissions(base, "ASSIGNED");
    expect(assigned.startDisposal).toBe(true);
  });

  it("blocks normal ops for disposed", () => {
    expect(isOpsBlockedForNormalOperations("DISPOSED")).toBe(true);
    expect(operationalStatusHelpText("DISPOSED")).toBeTruthy();
  });

  it("requires disposal:create for Dispose RBAC", () => {
    const perms = buildInventoryActionPermissions((p) => p === "asset.disposal:create");
    expect(perms.startDisposal).toBe(true);
  });
});
