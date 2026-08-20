import {
  buildAssignmentWizardHref,
  buildReturnWizardHref,
  assignmentNavigationPaths,
} from "@/components/assets/navigation/assignment-navigation";
import { stashInventoryFocusAsset } from "@/components/assets/inventory/inventory-focus";
import { isStatusActionAllowed } from "@/components/assets/inventory/status-driven-actions";
import type {
  InventoryMenuActionId,
  InventoryQuickLinkId,
} from "@/components/assets/inventory/interaction/inventory-interaction.types";

/** Central path builders for IT asset modules (single routing SSOT). */
export const assetNavigationPaths = {
  inventory: assignmentNavigationPaths.inventory,
  registerNew: "/assets/assets/new",
  inventoryImport: "/assets/inventory-import",
  assignmentNew: assignmentNavigationPaths.new,
  returnWizard: assignmentNavigationPaths.return,
  maintenanceList: "/assets/asset-maintenances",
  assignmentList: assignmentNavigationPaths.list,
  operations: "/assets/operations",
  details: (assetId: string) => `/assets/assets/${encodeURIComponent(assetId)}`,
  edit: (assetId: string) => `/assets/assets/${encodeURIComponent(assetId)}?intent=edit`,
  assignment: (assetId: string) => buildAssignmentWizardHref({ assetId }),
  returnAsset: (assetId: string) => buildReturnWizardHref({ assetId }),
  informationPortal: (assetId: string) =>
    `/assets/information-portal/${encodeURIComponent(assetId)}`,
  discovery: (assetId: string) => `/assets/assets/${encodeURIComponent(assetId)}`,
  qr: (assetId: string) => `/assets/qr-barcode?assetId=${encodeURIComponent(assetId)}`,
  transfer: (assetId: string) =>
    `/assets/asset-transfers?assetId=${encodeURIComponent(assetId)}`,
  maintenance: (assetId: string) =>
    `/assets/asset-maintenances?assetId=${encodeURIComponent(assetId)}`,
  history: (assetId: string) =>
    `/assets/assets/${encodeURIComponent(assetId)}?tab=activity`,
  disposal: (assetId: string) =>
    `/assets/asset-disposals?assetId=${encodeURIComponent(assetId)}`,
} as const;

export type AssetNavigateFn = (href: string) => void;

export type AssetNavigation = {
  openInventory: (assetId?: string) => void;
  openRegisterNew: () => void;
  openInventoryImport: () => void;
  openAssignmentWizard: () => void;
  openReturnWizard: () => void;
  openMaintenanceList: () => void;
  openAssignmentList: () => void;
  openOperations: () => void;
  openDetails: (assetId: string) => void;
  openEdit: (assetId: string) => void;
  openAssignment: (assetId: string) => void;
  openReturn: (assetId: string) => void;
  openPortal: (assetId: string) => void;
  openDiscovery: (assetId: string) => void;
  openQr: (assetId: string) => void;
  openTransfer: (assetId: string) => void;
  openMaintenance: (assetId: string) => void;
  openHistory: (assetId: string) => void;
  openDisposal: (assetId: string) => void;
  openDelete: (assetId: string) => void;
};

export function createAssetNavigation(push: AssetNavigateFn): AssetNavigation {
  return {
    openInventory: (assetId) => {
      stashInventoryFocusAsset(assetId);
      push(assetNavigationPaths.inventory);
    },
    openRegisterNew: () => push(assetNavigationPaths.registerNew),
    openInventoryImport: () => push(assetNavigationPaths.inventoryImport),
    openAssignmentWizard: () => push(buildAssignmentWizardHref()),
    openReturnWizard: () => push(buildReturnWizardHref({})),
    openMaintenanceList: () => push(assetNavigationPaths.maintenanceList),
    openAssignmentList: () => push(assetNavigationPaths.assignmentList),
    openOperations: () => push(assetNavigationPaths.operations),
    openDetails: (assetId) => push(assetNavigationPaths.details(assetId)),
    openEdit: (assetId) => push(assetNavigationPaths.edit(assetId)),
    openAssignment: (assetId) => push(assetNavigationPaths.assignment(assetId)),
    openReturn: (assetId) => push(assetNavigationPaths.returnAsset(assetId)),
    openPortal: (assetId) => push(assetNavigationPaths.informationPortal(assetId)),
    openDiscovery: (assetId) => push(assetNavigationPaths.discovery(assetId)),
    openQr: (assetId) => push(assetNavigationPaths.qr(assetId)),
    openTransfer: (assetId) => push(assetNavigationPaths.transfer(assetId)),
    openMaintenance: (assetId) => push(assetNavigationPaths.maintenance(assetId)),
    openHistory: (assetId) => push(assetNavigationPaths.history(assetId)),
    openDisposal: (assetId) => push(assetNavigationPaths.disposal(assetId)),
    // Soft-delete UX reuses detail surface; backend enforces delete rules.
    openDelete: (assetId) => push(assetNavigationPaths.edit(assetId)),
  };
}

function menuActionToStatusAction(
  action: InventoryMenuActionId,
): "view" | "edit" | "assign" | "return" | "delete" | "history" | "dispose" | null {
  switch (action) {
    case "viewDetails":
      return "view";
    case "edit":
      return "edit";
    case "assign":
      return "assign";
    case "return":
      return "return";
    case "delete":
      return "delete";
    case "dispose":
      return "dispose";
    case "history":
      return "history";
    default:
      return null;
  }
}

export function dispatchInventoryMenuAction(
  navigation: AssetNavigation,
  action: InventoryMenuActionId,
  assetId: string,
  operationalStatus?: string | null,
): void {
  const statusAction = menuActionToStatusAction(action);
  if (statusAction && !isStatusActionAllowed(operationalStatus, statusAction)) {
    return;
  }

  switch (action) {
    case "viewDetails":
      navigation.openDetails(assetId);
      break;
    case "edit":
      navigation.openEdit(assetId);
      break;
    case "assign":
      navigation.openAssignment(assetId);
      break;
    case "return":
      navigation.openReturn(assetId);
      break;
    case "delete":
      navigation.openDelete(assetId);
      break;
    case "dispose":
      navigation.openDisposal(assetId);
      break;
    case "portal":
      navigation.openPortal(assetId);
      break;
    case "discovery":
      navigation.openDiscovery(assetId);
      break;
    case "qr":
      navigation.openQr(assetId);
      break;
    case "transfer":
      navigation.openTransfer(assetId);
      break;
    case "maintenance":
      navigation.openMaintenance(assetId);
      break;
    case "history":
      navigation.openHistory(assetId);
      break;
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}

export function dispatchInventoryQuickLink(
  navigation: AssetNavigation,
  link: InventoryQuickLinkId,
  assetId: string,
): void {
  switch (link) {
    case "portal":
      navigation.openPortal(assetId);
      break;
    case "discovery":
      navigation.openDiscovery(assetId);
      break;
    case "qr":
      navigation.openQr(assetId);
      break;
    case "history":
      navigation.openHistory(assetId);
      break;
    default: {
      const _exhaustive: never = link;
      return _exhaustive;
    }
  }
}
