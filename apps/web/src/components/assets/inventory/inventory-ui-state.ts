/**
 * Persist inventory view chrome across soft Issue/Return navigation.
 * No full page reload required — remount restores snapshot then refreshes data.
 */

import type { InventoryPresetId } from "@/components/assets/inventory.types";
import {
  BRANCH_ALL_VALUE,
  EMPTY_INVENTORY_FILTERS,
  type InventoryFilterValues,
} from "@/components/assets/shared";

const UI_STATE_KEY = "cr004.inventory.uiState";

export type InventoryUiSnapshot = {
  preset: InventoryPresetId;
  /** IT site location id from Configuration → Locations (header filter). */
  headerLocationId: string;
  draftFilters: InventoryFilterValues;
  appliedFilters: InventoryFilterValues;
  quickSearch: string;
  page: number;
};

function canUseSessionStorage(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

export function saveInventoryUiSnapshot(snapshot: InventoryUiSnapshot): void {
  if (!canUseSessionStorage()) return;
  try {
    window.sessionStorage.setItem(UI_STATE_KEY, JSON.stringify(snapshot));
  } catch {
    /* ignore */
  }
}

export function peekInventoryUiSnapshot(): InventoryUiSnapshot | null {
  if (!canUseSessionStorage()) return null;
  try {
    const raw = window.sessionStorage.getItem(UI_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as InventoryUiSnapshot;
    if (!parsed || typeof parsed !== "object") return null;
    const legacyHeader = (parsed as { headerBranchId?: string }).headerBranchId;
    return {
      preset: parsed.preset ?? "all",
      headerLocationId:
        parsed.headerLocationId ?? legacyHeader ?? BRANCH_ALL_VALUE,
      draftFilters: { ...EMPTY_INVENTORY_FILTERS, ...parsed.draftFilters },
      appliedFilters: { ...EMPTY_INVENTORY_FILTERS, ...parsed.appliedFilters },
      quickSearch: parsed.quickSearch ?? "",
      page: typeof parsed.page === "number" && parsed.page > 0 ? parsed.page : 1,
    };
  } catch {
    return null;
  }
}

export function consumeInventoryUiSnapshot(): InventoryUiSnapshot | null {
  const snap = peekInventoryUiSnapshot();
  clearInventoryUiSnapshot();
  return snap;
}

export function clearInventoryUiSnapshot(): void {
  if (!canUseSessionStorage()) return;
  try {
    window.sessionStorage.removeItem(UI_STATE_KEY);
  } catch {
    /* ignore */
  }
}

export const inventoryUiStateKeys = { ui: UI_STATE_KEY } as const;
