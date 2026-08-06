/**
 * Pure helpers for Inventory → Assignment/Return workflow integration.
 * No router imports — callers supply navigation + drawer close.
 */

import type { InventoryMenuActionId } from "@/components/assets/inventory/interaction/inventory-interaction.types";
import type { AssetNavigation } from "@/components/assets/navigation/asset-navigation";
import { dispatchInventoryMenuAction } from "@/components/assets/navigation/asset-navigation";
import { assignmentNavigationPaths } from "@/components/assets/navigation/assignment-navigation";

export function isInventoryWorkflowAction(action: InventoryMenuActionId): boolean {
  return action === "assign" || action === "return";
}

/**
 * Close drawer (if workflow action), then dispatch existing AssetNavigation.
 * Prevents duplicate navigation and leaves drawer closed after Issue/Return.
 */
export function handleInventoryMenuWorkflow(input: {
  action: InventoryMenuActionId;
  assetId: string;
  navigation: AssetNavigation;
  closeDrawer: () => void;
}): void {
  if (isInventoryWorkflowAction(input.action)) {
    input.closeDrawer();
  }
  dispatchInventoryMenuAction(input.navigation, input.action, input.assetId);
}

/** Map existing navigation href assetId into wizard container seed (page host). */
export function wizardInitialStateFromAssetId(assetId: string | null | undefined): {
  assetId: string;
} | undefined {
  const id = assetId?.trim();
  if (!id) return undefined;
  return { assetId: id };
}

/** Soft-return target after Issue/Return (Assignment Navigation SSOT). */
export function inventoryPathAfterWorkflow(): string {
  return assignmentNavigationPaths.inventory;
}
