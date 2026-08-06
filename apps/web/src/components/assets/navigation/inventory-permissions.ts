import type { InventoryActionPermissions } from "@/components/assets/inventory/interaction/inventory-interaction.types";

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
    history: can("asset.asset:read"),
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
