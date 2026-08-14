/**
 * Dashboard quick-action and queue "View all" navigation (CR-004).
 * Reuses inventory UI snapshot + existing assignment/asset routes — no new pages.
 */

import type { InventoryPresetId } from "@/components/assets/inventory.types";
import {
  saveInventoryUiSnapshot,
  type InventoryUiSnapshot,
} from "@/components/assets/inventory/inventory-ui-state";
import { assignmentNavigationPaths } from "@/components/assets/navigation/assignment-navigation";
import {
  BRANCH_ALL_VALUE,
  EMPTY_INVENTORY_FILTERS,
} from "@/components/assets/shared";

export type AssetNavigateFn = (href: string) => void;

export const dashboardNavigationPaths = {
  registerAsset: "/assets/assets/new",
  assignAsset: assignmentNavigationPaths.new,
  returnAsset: assignmentNavigationPaths.return,
  /** Entry: pick an asset (Ready queue) then open Discovery from inventory/detail. */
  discovery: assignmentNavigationPaths.inventory,
  /** Entry: pick an asset then open Information Portal from inventory. */
  informationPortal: assignmentNavigationPaths.inventory,
  qrBarcode: "/assets/qr-barcode",
  inventory: assignmentNavigationPaths.inventory,
  assignments: assignmentNavigationPaths.list,
} as const;

function inventorySnapshot(
  preset: InventoryPresetId,
  branchId: string,
): InventoryUiSnapshot {
  return {
    preset,
    headerBranchId: branchId || BRANCH_ALL_VALUE,
    draftFilters: { ...EMPTY_INVENTORY_FILTERS },
    appliedFilters: { ...EMPTY_INVENTORY_FILTERS },
    quickSearch: "",
    page: 1,
  };
}

/** Open All Assets with an operational-status preset applied via existing inventory chrome. */
export function openInventoryWithPreset(
  push: AssetNavigateFn,
  preset: InventoryPresetId,
  branchId: string = BRANCH_ALL_VALUE,
): void {
  saveInventoryUiSnapshot(inventorySnapshot(preset, branchId));
  push(dashboardNavigationPaths.inventory);
}

export type DashboardQuickActionId =
  | "register"
  | "assign"
  | "return"
  | "discovery"
  | "informationPortal"
  | "qr";

export function navigateDashboardQuickAction(
  push: AssetNavigateFn,
  action: DashboardQuickActionId,
  branchId: string = BRANCH_ALL_VALUE,
): void {
  switch (action) {
    case "register":
      push(dashboardNavigationPaths.registerAsset);
      break;
    case "assign":
      push(dashboardNavigationPaths.assignAsset);
      break;
    case "return":
      push(dashboardNavigationPaths.returnAsset);
      break;
    case "discovery":
      openInventoryWithPreset(push, "ready", branchId);
      break;
    case "informationPortal":
      openInventoryWithPreset(push, "all", branchId);
      break;
    case "qr":
      push(dashboardNavigationPaths.qrBarcode);
      break;
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}

export type DashboardQueueViewAllId = "ready" | "pendingDisposal" | "assignments";

export function navigateDashboardViewAll(
  push: AssetNavigateFn,
  target: DashboardQueueViewAllId,
  branchId: string = BRANCH_ALL_VALUE,
): void {
  switch (target) {
    case "ready":
      openInventoryWithPreset(push, "ready", branchId);
      break;
    case "pendingDisposal":
      openInventoryWithPreset(push, "pending_disposal", branchId);
      break;
    case "assignments":
      push(dashboardNavigationPaths.assignments);
      break;
    default: {
      const _exhaustive: never = target;
      return _exhaustive;
    }
  }
}
