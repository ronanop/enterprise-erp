import {
  buildAssignmentWizardHref,
  buildReturnWizardHref,
  assignmentNavigationPaths,
} from "@/components/assets/navigation/assignment-navigation";
import type {
  InventoryMenuActionId,
  InventoryQuickLinkId,
} from "@/components/assets/inventory/interaction/inventory-interaction.types";

/** Central path builders for IT asset modules (single routing SSOT). */
export const assetNavigationPaths = {
  inventory: assignmentNavigationPaths.inventory,
  details: (assetId: string) => `/assets/assets/${encodeURIComponent(assetId)}`,
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
  disposal: (assetId?: string) =>
    assetId
      ? `/assets/asset-disposals?assetId=${encodeURIComponent(assetId)}`
      : "/assets/asset-disposals",
  history: (assetId: string) =>
    `/assets/assets/${encodeURIComponent(assetId)}?tab=activity`,
} as const;

export type AssetNavigateFn = (href: string) => void;

export type AssetNavigation = {
  openInventory: () => void;
  openDetails: (assetId: string) => void;
  openAssignment: (assetId: string) => void;
  openReturn: (assetId: string) => void;
  openPortal: (assetId: string) => void;
  openDiscovery: (assetId: string) => void;
  openQr: (assetId: string) => void;
  openTransfer: (assetId: string) => void;
  openMaintenance: (assetId: string) => void;
  openDisposal: (assetId?: string) => void;
  openHistory: (assetId: string) => void;
};

export function createAssetNavigation(push: AssetNavigateFn): AssetNavigation {
  return {
    openInventory: () => push(assetNavigationPaths.inventory),
    openDetails: (assetId) => push(assetNavigationPaths.details(assetId)),
    openAssignment: (assetId) => push(assetNavigationPaths.assignment(assetId)),
    openReturn: (assetId) => push(assetNavigationPaths.returnAsset(assetId)),
    openPortal: (assetId) => push(assetNavigationPaths.informationPortal(assetId)),
    openDiscovery: (assetId) => push(assetNavigationPaths.discovery(assetId)),
    openQr: (assetId) => push(assetNavigationPaths.qr(assetId)),
    openTransfer: (assetId) => push(assetNavigationPaths.transfer(assetId)),
    openMaintenance: (assetId) => push(assetNavigationPaths.maintenance(assetId)),
    openDisposal: (assetId) => push(assetNavigationPaths.disposal(assetId)),
    openHistory: (assetId) => push(assetNavigationPaths.history(assetId)),
  };
}

export function dispatchInventoryMenuAction(
  navigation: AssetNavigation,
  action: InventoryMenuActionId,
  assetId: string,
): void {
  switch (action) {
    case "viewDetails":
      navigation.openDetails(assetId);
      break;
    case "assign":
      navigation.openAssignment(assetId);
      break;
    case "return":
      navigation.openReturn(assetId);
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
    case "startDisposal":
      // Handled by inventory container (confirm + API) before navigating to disposal.
      break;
    case "reinstate":
      // Handled by inventory container (confirm + API).
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
