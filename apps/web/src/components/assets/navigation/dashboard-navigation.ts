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
  locationId: string,
): InventoryUiSnapshot {
  return {
    preset,
    headerLocationId: locationId || BRANCH_ALL_VALUE,
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
  locationId: string = BRANCH_ALL_VALUE,
): void {
  saveInventoryUiSnapshot(inventorySnapshot(preset, locationId));
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
  locationId: string = BRANCH_ALL_VALUE,
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
      openInventoryWithPreset(push, "ready", locationId);
      break;
    case "informationPortal":
      openInventoryWithPreset(push, "all", locationId);
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

export type DashboardKpiId =
  | "total"
  | "ready"
  | "assigned"
  | "inUseAsComponent"
  | "retired"
  | "pendingDisposal"
  | "disposed";

const KPI_TO_PRESET: Record<DashboardKpiId, InventoryPresetId> = {
  total: "all",
  ready: "ready",
  assigned: "assigned",
  inUseAsComponent: "in_use_as_component",
  retired: "retired",
  pendingDisposal: "pending_disposal",
  disposed: "disposed",
};

/** Open All Assets with the operational-status filter matching a dashboard KPI card. */
export function navigateDashboardKpi(
  push: AssetNavigateFn,
  kpi: DashboardKpiId,
  locationId: string = BRANCH_ALL_VALUE,
): void {
  openInventoryWithPreset(push, KPI_TO_PRESET[kpi], locationId);
}

export function navigateDashboardViewAll(
  push: AssetNavigateFn,
  target: DashboardQueueViewAllId,
  locationId: string = BRANCH_ALL_VALUE,
): void {
  switch (target) {
    case "ready":
      openInventoryWithPreset(push, "ready", locationId);
      break;
    case "pendingDisposal":
      openInventoryWithPreset(push, "pending_disposal", locationId);
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
