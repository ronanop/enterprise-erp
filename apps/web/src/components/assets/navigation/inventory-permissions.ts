import type { InventoryActionPermissions } from "@/components/assets/inventory/interaction/inventory-interaction.types";
import {
  canUserTransferFromOperationalStatus,
  isOpsBlockedForTransferOrMaintenance,
} from "@/components/assets/shared/asset-status";

/** Maps RBAC permission strings to inventory action menu visibility. */
export function buildInventoryActionPermissions(
  can: (permission: string) => boolean,
): InventoryActionPermissions {
  const canUpdate = can("asset.asset:update");
  return {
    viewDetails: can("asset.asset:read"),
    edit: canUpdate,
    delete: canUpdate,
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
 * Gate inventory actions by operational status (UI; backend remains authoritative).
 * Transfer (user-transfer) is ASSIGNED-only; Assign is READY_TO_MOVE-only.
 * Edit/Delete stay RBAC-only — soft-delete validators remain authoritative on the API.
 */
export function applyOperationalGatesToInventoryPermissions(
  base: InventoryActionPermissions,
  operationalStatus: string | null | undefined,
): InventoryActionPermissions {
  const ops = String(operationalStatus ?? "").toUpperCase();
  const maintenanceBlocked = isOpsBlockedForTransferOrMaintenance(ops);
  return {
    ...base,
    assign: base.assign && ops === "READY_TO_MOVE",
    return: base.return && ops === "ASSIGNED",
    transfer: base.transfer && canUserTransferFromOperationalStatus(ops),
    maintenance: base.maintenance && !maintenanceBlocked,
    startDisposal: base.startDisposal && ops === "RETIRED",
    reinstate: base.reinstate && ops === "PENDING_DISPOSAL",
  };
}

export function buildInventoryQuickLinkPermissions(
  can: (permission: string) => boolean,
): Partial<Record<"portal" | "discovery" | "qr" | "history", boolean>> {
  const canRead = can("asset.asset:read");
  return {
    portal: canRead,
    // Hidden — Discovery/History are sections inside Information Portal.
    discovery: false,
    qr: canRead,
    history: false,
  };
}
