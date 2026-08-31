import type { InventoryActionPermissions } from "@/components/assets/inventory/interaction/inventory-interaction.types";
import { isOpsBlockedForTransferOrMaintenance } from "@/components/assets/shared/asset-status";

/** Maps RBAC permission strings to inventory action menu visibility. */
export function buildInventoryActionPermissions(
  can: (permission: string) => boolean,
): InventoryActionPermissions {
  return {
    viewDetails: can("asset.asset:read"),
    assign: can("asset.assignment:create"),
    return: can("asset.assignment:return"),
    portal: can("asset.asset:read"),
    discovery: can("asset.asset:read"),
    qr: can("asset.asset:read"),
    transfer: can("asset.transfer:create") || can("asset.transfer:read"),
    maintenance: can("asset.maintenance:create") || can("asset.maintenance:read"),
    startDisposal: can("asset.disposal:create"),
    reinstate: can("asset.disposal:create"),
    history: can("asset.asset:read"),
  };
}

/**
 * Phase 5D/5E: gate inventory actions by operational status (UI; backend remains authoritative).
 */
export function applyOperationalGatesToInventoryPermissions(
  base: InventoryActionPermissions,
  operationalStatus: string | null | undefined,
): InventoryActionPermissions {
  const ops = String(operationalStatus ?? "").toUpperCase();
  const transferMaintBlocked = isOpsBlockedForTransferOrMaintenance(ops);
  return {
    ...base,
    assign: base.assign && ops === "READY_TO_MOVE",
    return: base.return && ops === "ASSIGNED",
    transfer: base.transfer && !transferMaintBlocked,
    maintenance: base.maintenance && !transferMaintBlocked,
    startDisposal: base.startDisposal && ops === "RETIRED",
    reinstate: base.reinstate && ops === "PENDING_DISPOSAL",
  };
}

export function buildInventoryQuickLinkPermissions(
  can: (permission: string) => boolean,
): Partial<Record<"portal" | "discovery" | "qr" | "history", boolean>> {
  return {
    portal: can("asset.asset:read"),
    discovery: can("asset.asset:read"),
    qr: can("asset.asset:read"),
    history: can("asset.asset:read"),
  };
}
